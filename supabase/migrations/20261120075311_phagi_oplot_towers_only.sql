create or replace function oplot.guard_power(d jsonb) returns numeric language sql immutable set search_path='' as $$
  with stats as (select oplot.raid_int(d->>'level',1,100) lvl,oplot.raid_rank(oplot.raid_int(d->>'species',0,62)) tier,
    1+.18*oplot.raid_int(d->>'enchant',0,5) enchant),
  attacks as (select *,round((7+1.75*lvl)*(array[1,1.23,1.49,1.81])[tier]) base from stats)
  select base+(round(base*(.52+.035*(tier-1))*enchant)
    +round(base*enchant*case d->>'specialty' when 'focus' then .40 when 'area' then .55 else 0 end))
    /(case when tier<3 then 4 else 3 end) from attacks
$$;

-- Experienced islands face stronger first arrivals as well as the normal nightly growth.
create or replace function oplot.night_squad(wave int) returns table(slot int,level int,hp int,damage int)
language sql immutable strict set search_path='' as $$
  select i,lvl,48+8*lvl+10*wave+least(50,wave)*wave,9+3*lvl+2*wave
  from generate_series(1,least(10,3+wave/2)) i
  cross join lateral (select least(100,2+wave*2+(i-1)%3+greatest(0,wave-10)/3) lvl) levels
  order by i
$$;

-- Change the guard roster only, preserving the original island for geometry and settlement.
-- An archived attacking formation keeps all its historical stats when used for practice.
do $migration$
declare sim regprocedure; body text; rule record;
begin
  foreach sim in array array['oplot.simulate_classic_raid(jsonb,int,date,text,jsonb)'::regprocedure,
      'oplot.simulate_grid_raid(jsonb,int,date,text,jsonb)'::regprocedure] loop
    body:=pg_get_functiondef(sim);
    for rule in select * from (values
      ('order by oplot.guard_power(d) desc',
       'and (s#>''{settings,nightTowersOnly}'') is distinct from ''true''::jsonb order by oplot.guard_power(d) desc'),
      ('55+7*lvl','55+8.5*lvl'),('7+1.45*lvl','7+1.75*lvl'),
      ('select * from oplot.night_squad(wave) order by slot',
       'select * from oplot.night_squad(wave+2*greatest(0,(select max(oplot.raid_int(b0->>''level'',1,16))
          from jsonb_array_elements(oplot.arr(s->''buildings'')) b0 where b0->>''type''=''keep'')-4))
        order by slot limit least(10,3+wave/2)')
    ) as rules(before,after) loop
      if strpos(body,rule.before)=0 then raise exception 'Unexpected simulator % near %',sim,rule.before; end if;
      body:=replace(body,rule.before,rule.after);
    end loop;
    execute body;
  end loop;
end $migration$;

-- A shutout pays the same as three defensive stars in a manual wave. Round before tripling.
create function oplot.night_victory_reward(s jsonb,wave int,towers_only boolean) returns jsonb
language sql immutable strict set search_path='' as $$
  with factor as (select case when towers_only then 3 else 1 end n),
  prize as (select round(1.5*(42+7*wave))*n gold,round(1.5*(42*.62+5*wave))*n berries,(30+3*wave)*n xp from factor),
  warehouses as (select 450+coalesce(sum(450*lvl*lvl) filter(where kind='goldstore'),0) gold,
    300+coalesce(sum(320*lvl*lvl) filter(where kind='foodstore'),0) berries
    from (select b->>'type' kind,oplot.raid_int(b->>'level',1,16) lvl from jsonb_array_elements(oplot.arr(s->'buildings')) b) stores),
  credited as (select least(p.gold,greatest(0,w.gold-coalesce(oplot.num(s->>'gold'),0))) gold,
    least(p.berries,greatest(0,w.berries-coalesce(oplot.num(s->>'berries'),0))) berries from warehouses w,prize p)
  select jsonb_build_object('gold',c.gold,'berries',c.berries,'xp',p.xp,'full',c.gold<p.gold or c.berries<p.berries)
    from credited c,prize p
$$;
revoke all on function oplot.night_victory_reward(jsonb,int,boolean) from public,anon,authenticated;

create or replace function oplot.run_night_raids(p_now timestamptz default clock_timestamp(), p_uid text default null) returns int
language plpgsql security definer set search_path='' as $$
declare
  due record; schedule oplot.raid_islands%rowtype; doc jsonb; s jsonb; fight jsonb; loot jsonb;
  report jsonb; reward jsonb; towers_only boolean; done int:=0; at_time timestamptz;
  last_due date:=((p_now at time zone 'Europe/Moscow')-interval '3 hours')::date;
begin
  -- Lock the same save row first as ph_set_if. Other workers skip this profile;
  -- after its current transaction finishes the next minute will pick it up.
  for due in
    select d.path,i.uid from oplot.raid_islands i join public.ph_docs d
      on d.path='data/users/'||i.uid||'/oplot/saves/main'
    where i.next_day<=last_due and not d.deleted and (p_uid is null or i.uid=p_uid)
    order by i.next_day,i.uid limit 64 for update of d skip locked
  loop
    begin
      select * into schedule from oplot.raid_islands where uid=due.uid for update;
      if not found or schedule.next_day>last_due then continue; end if;
      if exists(select from oplot.raid_reports r where r.uid=due.uid and r.day=schedule.next_day) then
        update oplot.raid_islands set next_day=schedule.next_day+1 where uid=due.uid;
        continue;
      end if;
      select data into doc from public.ph_docs where path=due.path and not deleted;
      s:=doc->'state';
      if jsonb_typeof(s) is distinct from 'object' or jsonb_array_length(oplot.arr(s->'buildings'))=0 then continue; end if;
      at_time:=oplot.raid_at(schedule.next_day);
      fight:=oplot.night_battle(s,schedule.wave+1,schedule.next_day,due.uid);
      loot:=oplot.night_loot(s,at_time,(fight->>'stars')::int);
      report:=jsonb_build_object('day',schedule.next_day,'at',at_time,'wave',schedule.wave+1,'stars',fight->'stars',
        'percent',loot->'percent','goldLost',loot->'goldLost','berriesLost',loot->'berriesLost');
      s:=loot->'state';
      towers_only:=coalesce(s#>'{settings,nightTowersOnly}'='true'::jsonb,false);
      report:=report||jsonb_build_object('towersOnly',towers_only);
      if (fight->>'stars')::int=0 then
        reward:=oplot.night_victory_reward(s,schedule.wave+1,towers_only);
        s:=s||jsonb_build_object('gold',coalesce(oplot.num(s->>'gold'),0)+(reward->>'gold')::numeric,
          'berries',coalesce(oplot.num(s->>'berries'),0)+(reward->>'berries')::numeric,
          'xp',oplot.profile_xp(s)+(reward->>'xp')::numeric);
        report:=report||jsonb_build_object('reward',reward);
      end if;
      insert into oplot.raid_reports(uid,day,summary,replay) values(due.uid,schedule.next_day,report,fight->'replay');
      update public.ph_docs set
        data=doc||jsonb_build_object('rev',coalesce((doc->>'rev')::int,0)+1,
          'op','night:'||schedule.next_day||':'||gen_random_uuid(),'state',s||jsonb_build_object('lastRaid',report)),
        updated_at=clock_timestamp() where path=due.path;
      update oplot.raid_islands set next_day=schedule.next_day+1,wave=schedule.wave+1 where uid=due.uid;
      done:=done+1;
    exception when others then
      if p_uid is not null then raise; end if;
      raise warning 'Oplot night raid for % deferred (%): %',due.uid,sqlstate,sqlerrm;
    end;
  end loop;
  return done;
end $$;
