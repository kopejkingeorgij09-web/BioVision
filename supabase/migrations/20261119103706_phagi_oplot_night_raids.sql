-- Island documents use the same row lock and revision comparison as public.ph_set_if.
create table oplot.raid_islands (
  uid text primary key,
  next_day date not null,
  wave integer not null default 0 check (wave >= 0)
);
create index raid_islands_due on oplot.raid_islands(next_day,uid);
create table oplot.raid_reports (
  uid text not null, day date not null,
  summary jsonb not null, replay jsonb not null,
  primary key(uid,day)
);
alter table oplot.raid_islands enable row level security;
alter table oplot.raid_reports enable row level security;
revoke all on oplot.raid_islands, oplot.raid_reports from public, anon, authenticated;

create function oplot.raid_at(d date) returns timestamptz language sql immutable set search_path='' as $$
  select (d + time '03:00') at time zone 'Europe/Moscow'
$$;
create function oplot.first_raid(arrived timestamptz) returns date language sql immutable set search_path='' as $$
  select local_time::date + (local_time::time >= time '03:00')::int
  from (select arrived at time zone 'Europe/Moscow' as local_time) clock
$$;

create function oplot.register_island() returns trigger language plpgsql security definer set search_path='' as $$
declare who text := split_part(new.path,'/',3);
begin
  if new.deleted or jsonb_array_length(oplot.arr(new.data#>'{state,buildings}'))=0 then
    delete from oplot.raid_islands where uid=who;
  else
    -- A purchase, normal save or raid updates the same document. Only its first
    -- valid cloud save starts the clock. A re-created island keeps its wave history.
    insert into oplot.raid_islands(uid,next_day,wave)
      select who,oplot.first_raid(clock_timestamp()),coalesce((
        select (summary->>'wave')::int from oplot.raid_reports where uid=who order by day desc limit 1),0)
      on conflict (uid) do nothing;
  end if;
  return new;
end $$;
create trigger oplot_register_island after insert or update of data,deleted on public.ph_docs
for each row when (new.path ~ '^data/users/[^/]+/oplot/saves/main$')
execute function oplot.register_island();

insert into oplot.raid_islands(uid,next_day)
select split_part(path,'/',3),oplot.first_raid(statement_timestamp())
from public.ph_docs where path ~ '^data/users/[^/]+/oplot/saves/main$' and not deleted
and jsonb_array_length(oplot.arr(data#>'{state,buildings}'))>0
on conflict do nothing;

-- The stable species numbers and their masks match the island's genetics catalogue.
create function oplot.raid_rank(species int) returns int language sql immutable set search_path='' as $$
  with original as (select array[1,2,4,8,16,3,5,10,20,17,12,24,47,63,32] m),
  masks as (select m || array(select i from generate_series(1,63) i where i<>all(m) order by i) a from original)
  select least(4,bit_count(coalesce(a[species+1],1)::bit(6)))::int from masks
$$;
create function oplot.raid_int(v text, low int, high int) returns int language sql immutable set search_path='' as $$
  select greatest(low,least(high,coalesce(oplot.num(v),low)))::int
$$;

-- Order defenders by expected damage per attack, including their passive ability.
create function oplot.guard_power(d jsonb) returns numeric language sql immutable set search_path='' as $$
  with stats as (select oplot.raid_int(d->>'level',1,100) lvl,
    oplot.raid_rank(oplot.raid_int(d->>'species',0,62)) tier,
    oplot.raid_int(d->>'enchant',0,5) enchant),
  damage as (select *,round((7+1.45*lvl)*(array[1,1.23,1.49,1.81])[tier]) base from stats)
  select base+round(base*(.52+.035*(tier-1))*(1+.18*enchant))/(case when tier<3 then 4 else 3 end) from damage
$$;

-- All mutable combat HP and coordinates live in these in-memory arrays. Only
-- the initial positions and an ordered list of changes enter the replay.
create type oplot.raid_actor as (
  id text, type text, species int, level int, x int, y int,
  hp int, damage int, flying boolean, enchant int, wait_until int
);
create function oplot.raid_actor_json(a oplot.raid_actor) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_strip_nulls(to_jsonb(a)-'wait_until')
$$;
create function oplot.raid_event(tick int, kind text, actor oplot.raid_actor, target oplot.raid_actor,
                                 amount int, narrative text) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('t',tick,'kind',kind,'id',actor.id,'target',target.id,
    'from',jsonb_build_array(actor.x,actor.y),'to',jsonb_build_array(target.x,target.y),
    'amount',amount,'hp',target.hp,'text',narrative)
$$;
create function oplot.raid_move(a oplot.raid_actor, goal oplot.raid_actor) returns oplot.raid_actor
language plpgsql immutable set search_path='' as $$
begin
  if abs(goal.x-a.x)>=abs(goal.y-a.y) then a.x:=a.x+sign(goal.x-a.x);
  else a.y:=a.y+sign(goal.y-a.y); end if;
  return a;
end $$;
create function oplot.raid_distance(a oplot.raid_actor,b oplot.raid_actor) returns int language sql immutable set search_path='' as $$
  select abs(a.x-b.x)+abs(a.y-b.y)
$$;

create function oplot.night_battle(s jsonb, wave int, raid_day date, who text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  buildings oplot.raid_actor[]:='{}'; guards oplot.raid_actor[]:='{}'; raiders oplot.raid_actor[]:='{}';
  a oplot.raid_actor; b oplot.raid_actor; g oplot.raid_actor; dest oplot.raid_actor;
  snapshot jsonb; events jsonb[]:='{}'; v jsonb; k text; distinct_seed int;
  i int; j int; h int; tick int:=0; ticks int:=0; target int; distance int; nearest int;
  base_hp int; amount int; guard_target int; gate int; lvl int; rank int; spell int; keep_x int:=4; keep_y int:=4;
  side int; edge int; goals int:=0; destroyed int:=0; keep_down boolean:=false; stars int; reach int;
begin
  distinct_seed:=mod(abs(hashtext(who||'/'||raid_day::text)::bigint),997)::int;
  for v in select value from jsonb_array_elements(oplot.arr(s->'buildings')) limit 100 loop
    k:=v->>'type';
    if k is null or k not in ('keep','farm','mine','home','den','archer','cannon','spire','wall','firetrap','icetrap','goldstore','foodstore','academy') then continue; end if;
    lvl:=oplot.raid_int(v->>'level',1,100);
    base_hp:=case k when 'keep' then 112 when 'goldstore' then 70 when 'foodstore' then 62 when 'academy' then 84
      when 'wall' then 35 when 'archer' then 40 when 'cannon' then 45 when 'spire' then 48
      when 'mine' then 31 when 'farm' then 28 when 'home' then 35 when 'den' then 38 else 7 end;
    b:=row(coalesce(v->>'id','b'||cardinality(buildings)),k,null,lvl,
      oplot.raid_int(v->>'x',0,9),oplot.raid_int(v->>'y',0,9),ceil(base_hp*(0.76+lvl*0.24))::int,
      case k when 'archer' then 6+4*lvl when 'cannon' then 10+6*lvl when 'spire' then 7+5*lvl
        when 'firetrap' then 18+10*lvl else 0 end,null,null,0)::oplot.raid_actor;
    buildings:=array_append(buildings,b);
    if k='keep' then keep_x:=b.x; keep_y:=b.y; end if;
    if k not in ('wall','icetrap','firetrap') then goals:=goals+1; end if;
  end loop;

  for v in select d from jsonb_array_elements(oplot.arr(s->'dragons')) d
    where jsonb_typeof(d)='object'
    order by oplot.guard_power(d) desc, d->>'id'
    limit 4 loop
    lvl:=oplot.raid_int(v->>'level',1,100); rank:=oplot.raid_rank(oplot.raid_int(v->>'species',0,62));
    spell:=oplot.raid_int(v->>'enchant',0,5);
    j:=cardinality(guards);
    g:=row(coalesce(v->>'id','g'||j),'guard',oplot.raid_int(v->>'species',0,62),lvl,
      greatest(0,least(9,keep_x+(array[0,-1,1,0])[j+1])),
      greatest(0,least(9,keep_y+(array[0,0,0,1])[j+1])),
      round((55+7*lvl)*(array[1,1.19,1.42,1.70])[rank])::int,
      round((7+1.45*lvl)*(array[1,1.23,1.49,1.81])[rank])::int,lvl>20,spell,0)::oplot.raid_actor;
    guards:=array_append(guards,g);
  end loop;

  side:=distinct_seed%4;
  for i in 1..least(7,2+wave/3) loop
    edge:=greatest(0,least(9,(case when side%2=0 then keep_y else keep_x end) + ((i-1)%3) - least(1,i-1)*2));
    lvl:=least(100,2+wave*2+(i-1)%3);
    a:=row('a'||i,'raider',(distinct_seed+i*3)%63,lvl,
      case side when 0 then 0 when 2 then 9 else edge end,
      case side when 1 then 0 when 3 then 9 else edge end,
      24+lvl*5+wave*4,5+lvl*2+wave,lvl>20,0,0)::oplot.raid_actor;
    raiders:=array_append(raiders,a);
  end loop;
  snapshot:=jsonb_build_object('buildings',coalesce((select jsonb_agg(oplot.raid_actor_json(b0)) from unnest(buildings) b0),'[]'),
    'defenders',coalesce((select jsonb_agg(oplot.raid_actor_json(g0)) from unnest(guards) g0),'[]'),
    'attackers',(select jsonb_agg(oplot.raid_actor_json(a0)) from unnest(raiders) a0));
  for tick in 1..45 loop
    ticks:=tick;
    exit when destroyed>=goals or not exists(select from unnest(raiders) e where e.hp>0);
    -- Tower shots precede movement. Cannons splash ground groups, spires and archers reach airborne units.
    for i in 1..cardinality(buildings) loop
      b:=buildings[i];
      if b.hp<=0 or b.type not in ('archer','cannon','spire') then continue; end if;
      if b.type='cannon' and tick%2=0 then continue; end if;
      reach:=least(7,(case when b.type='archer' then 4 else 3 end)+b.level/3);
      nearest:=reach+1; target:=0;
      for j in 1..cardinality(raiders) loop
        a:=raiders[j]; distance:=oplot.raid_distance(a,b);
        if a.hp>0 and distance<nearest and (b.type<>'cannon' or not a.flying) then target:=j; nearest:=distance; end if;
      end loop;
      if target=0 then continue; end if;
      dest:=raiders[target];
      for j in 1..cardinality(raiders) loop
        a:=raiders[j];
        if a.hp<=0 or (j<>target and (b.type<>'cannon' or a.flying or oplot.raid_distance(a,dest)>1)) then continue; end if;
        amount:=case when j=target then b.damage else (b.damage+1)/2 end;
        a.hp:=greatest(0,a.hp-amount); raiders[j]:=a;
        events:=array_append(events,oplot.raid_event(tick,'tower',b,a,amount,'Выстрел башни'));
        if a.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',b,a,0,'Налётчик выбыл')); end if;
      end loop;
    end loop;
    for i in 1..cardinality(guards) loop
      g:=guards[i]; if g.hp<=0 then continue; end if;
      target:=0; nearest:=100;
      for j in 1..cardinality(raiders) loop
        a:=raiders[j]; distance:=oplot.raid_distance(a,g);
        if a.hp>0 and distance<nearest and (g.flying or not a.flying) then nearest:=distance; target:=j; end if;
      end loop;
      if target=0 then continue; end if;
      a:=raiders[target];
      if nearest>1 then
        dest:=oplot.raid_move(g,a);
        if not g.flying and exists(select from unnest(buildings) z where z.type='wall' and z.hp>0 and (z.x,z.y)=(dest.x,dest.y)) then continue; end if;
        events:=array_append(events,oplot.raid_event(tick,'move',g,dest,0,'Защитник сближается')); guards[i]:=dest;
      else
        g.wait_until:=g.wait_until+1; guards[i]:=g;
        rank:=oplot.raid_rank(g.species);
        amount:=g.damage;
        if g.wait_until%(case when rank<3 then 4 else 3 end)=0 then
          amount:=amount+round(g.damage*(.52+.035*(rank-1))*(1+.18*g.enchant));
          if exists(select from unnest(buildings) z where z.type='spire' and z.hp>0 and oplot.raid_distance(z,g)<=2) then amount:=amount+5; end if;
        end if;
        a.hp:=greatest(0,a.hp-amount); raiders[target]:=a;
        events:=array_append(events,oplot.raid_event(tick,'guard',g,a,amount,
          case when g.wait_until%(case when rank<3 then 4 else 3 end)=0 then 'Защитник применил способность' else 'Защитник атакует' end));
        if a.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',g,a,0,'Налётчик выбыл')); end if;
      end if;
    end loop;
    for i in 1..cardinality(raiders) loop
      a:=raiders[i]; if a.hp<=0 or a.wait_until>=tick then continue; end if;
      guard_target:=0;
      for j in 1..cardinality(guards) loop
        g:=guards[j];
        if g.hp>0 and oplot.raid_distance(a,g)<=1 and (a.flying or not g.flying) then guard_target:=j; exit; end if;
      end loop;
      if guard_target>0 then
        g:=guards[guard_target]; g.hp:=greatest(0,g.hp-a.damage); guards[guard_target]:=g;
        events:=array_append(events,oplot.raid_event(tick,'strike',a,g,a.damage,'Налётчик атакует защитника'));
        if g.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',a,g,0,'Защитник выбыл')); end if;
        continue;
      end if;
      target:=0; nearest:=100;
      for j in 1..cardinality(buildings) loop
        b:=buildings[j]; distance:=oplot.raid_distance(a,b);
        if b.hp>0 and b.type not in ('wall','icetrap','firetrap') and distance<nearest then target:=j; nearest:=distance; end if;
      end loop;
      if target=0 then continue; end if;
      b:=buildings[target];
      if nearest<=1 then
        b.hp:=greatest(0,b.hp-a.damage); buildings[target]:=b;
        events:=array_append(events,oplot.raid_event(tick,'strike',a,b,a.damage,'Удар по постройке'));
        if b.hp=0 then
          destroyed:=destroyed+1; keep_down:=keep_down or b.type='keep';
          events:=array_append(events,oplot.raid_event(tick,'destroy',a,b,0,'Постройка разрушена'));
        end if;
        continue;
      end if;
      dest:=oplot.raid_move(a,b); gate:=0;
      if not a.flying then
        for j in 1..cardinality(buildings) loop
          b:=buildings[j]; if b.type='wall' and b.hp>0 and (b.x,b.y)=(dest.x,dest.y) then gate:=j; exit; end if;
        end loop;
      end if;
      if gate>0 then
        b:=buildings[gate]; b.hp:=greatest(0,b.hp-a.damage); buildings[gate]:=b;
        events:=array_append(events,oplot.raid_event(tick,'wall',a,b,a.damage,'Налётчик пробивает стену'));
        if b.hp=0 then events:=array_append(events,oplot.raid_event(tick,'destroy',a,b,0,'В стене открылась брешь')); end if;
        continue;
      end if;
      events:=array_append(events,oplot.raid_event(tick,'move',a,dest,0,case when a.flying then 'Налётчик летит' else 'Налётчик наступает' end));
      raiders[i]:=dest;
      if dest.flying then continue; end if;
      for j in 1..cardinality(buildings) loop
        b:=buildings[j];
        if b.hp<=0 or b.type not in ('firetrap','icetrap') or (b.x,b.y)<>(dest.x,dest.y) then continue; end if;
        b.hp:=0; buildings[j]:=b;
        for h in 1..cardinality(raiders) loop
          a:=raiders[h]; if a.hp<=0 or a.flying or oplot.raid_distance(a,b)>1 then continue; end if;
          a.hp:=greatest(0,a.hp-b.damage);
          if b.type='icetrap' then a.wait_until:=greatest(a.wait_until,tick+least(5,1+b.level)); end if;
          raiders[h]:=a;
          events:=array_append(events,oplot.raid_event(tick,'trap',b,a,b.damage,case when b.type='icetrap' then 'Ловушка замедлила налётчика' else 'Вспыхнула огненная руна' end));
          if a.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',b,a,0,'Налётчик выбыл')); end if;
        end loop;
      end loop;
    end loop;
  end loop;
  stars:=(goals>0 and 2*destroyed>=goals)::int+keep_down::int+(goals>0 and destroyed=goals)::int;
  events:=array_append(events,jsonb_build_object('t',ticks,'kind','end','id','','target','',
    'from',jsonb_build_array(keep_x,keep_y),'to',jsonb_build_array(keep_x,keep_y),'amount',stars,'text','Ночной рейд завершён'));
  return jsonb_build_object('stars',stars,'replay',snapshot||jsonb_build_object('v',1,'events',to_jsonb(events),'duration',ticks));
end $$;

-- Allocate the rounded loss across the stored balance and each producer in
-- order. This makes total losses exactly floor(total whole resources * rate).
create function oplot.night_loot(s jsonb, at_time timestamptz, stars int) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  pct int:=(array[0,25,50,80])[stars+1]; instant numeric:=floor(extract(epoch from at_time)*1000);
  gold numeric:=greatest(0,coalesce(oplot.num(s->>'gold'),0));
  berries numeric:=greatest(0,coalesce(oplot.num(s->>'berries'),0));
  total_gold numeric:=gold; total_berries numeric:=berries; prior numeric;
  buildings jsonb[]:='{}'; v jsonb; k text; lvl int; rate numeric; since_ms numeric;
  raw numeric; ready numeric; lost numeric; gold_lost numeric; berries_lost numeric;
begin
  if pct is null then raise exception 'invalid raid stars'; end if;
  for v in select value from jsonb_array_elements(oplot.arr(s->'buildings')) loop
    k:=v->>'type'; lvl:=oplot.raid_int(v->>'level',1,100);
    rate:=lvl*(case k when 'mine' then 0.0008 when 'farm' then 0.0006 when 'home' then 0.00017 else 0 end);
    since_ms:=oplot.num(v->>'since');
    if rate>0 and since_ms is not null then
      raw:=least(90*lvl,greatest(0,(instant-since_ms)*rate));
      ready:=floor(raw);
      if k='farm' then prior:=total_berries; total_berries:=total_berries+ready;
      else prior:=total_gold; total_gold:=total_gold+ready; end if;
      lost:=floor((prior+ready)*pct/100)-floor(prior*pct/100);
      if lost>0 then
        v:=jsonb_set(v,'{since}',to_jsonb(floor(instant-(raw-lost)/rate)));
      end if;
    end if;
    buildings:=array_append(buildings,v);
  end loop;
  gold_lost:=floor(total_gold*pct/100); berries_lost:=floor(total_berries*pct/100);
  if pct>0 then
    s:=s||jsonb_build_object('gold',gold-floor(gold*pct/100),'berries',berries-floor(berries*pct/100),
      'buildings',to_jsonb(buildings));
  end if;
  return jsonb_build_object('state',s,'goldLost',gold_lost,'berriesLost',berries_lost,'percent',pct);
end $$;

create function oplot.run_night_raids(p_now timestamptz default clock_timestamp(), p_uid text default null) returns int
language plpgsql security definer set search_path='' as $$
declare
  due record; schedule oplot.raid_islands%rowtype; doc jsonb; s jsonb; fight jsonb; loot jsonb;
  report jsonb; done int:=0; at_time timestamptz;
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
      insert into oplot.raid_reports(uid,day,summary,replay) values(due.uid,schedule.next_day,report,fight->'replay');
      update public.ph_docs set
        data=doc||jsonb_build_object('rev',coalesce((doc->>'rev')::int,0)+1,
          'op','night:'||schedule.next_day||':'||gen_random_uuid(),'state',(loot->'state')||jsonb_build_object('lastRaid',report)),
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

-- A save submitted after a missed cron minute must never expose newly purchased
-- resources to yesterday's raid. Settle due raids against the last cloud snapshot
-- while holding its row lock, then let the existing compare-and-swap reject a
-- stale client revision. Batching bounds the request after a prolonged outage.
create function oplot.settle_island(who text, island_path text) returns boolean language plpgsql set search_path='' as $$
declare n int; as_of timestamptz;
begin
  if island_path is distinct from 'data/users/'||who||'/oplot/saves/main' then
    raise exception 'Нужен остров этого профиля' using errcode='42501';
  end if;
  perform 1 from public.ph_docs where path=island_path and not deleted for update;
  if not found then return true; end if;
  as_of:=clock_timestamp();
  for n in 1..4 loop
    exit when oplot.run_night_raids(as_of,who)=0;
  end loop;
  return not exists(select from oplot.raid_islands where uid=who and oplot.raid_at(next_day)<=as_of);
end $$;

-- The same owner may switch between teacher and pupil views. Island access
-- follows the authenticated platform uid. Diamond awards have their own rules.
create function oplot.island_owner(p_code text) returns text language plpgsql stable set search_path='' as $$
declare identity_row record;
begin
  select * into identity_row from public._ph_who(p_code);
  if identity_row.lv is null or identity_row.lv not in (2,4) or nullif(identity_row.uid,'') is null then
    raise exception 'Войдите в профиль «Фагов»' using errcode='42501';
  end if;
  return identity_row.uid;
end $$;

create function public.ph_oplot_store(p_code text,p_path text,p_data jsonb,p_rev int,p_op text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare who text:=oplot.island_owner(p_code); current_doc jsonb;
begin
  if not oplot.settle_island(who,p_path) then
    select data into current_doc from public.ph_docs where path=p_path and not deleted;
    return jsonb_build_object('ok',false,'cur',current_doc);
  end if;
  return public.ph_set_if(p_code,p_path,p_data,p_rev,p_op);
end $$;
create function public.ph_oplot_load(p_code text,p_path text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare who text:=oplot.island_owner(p_code); settled boolean; current_doc jsonb;
begin
  settled:=oplot.settle_island(who,p_path);
  select data into current_doc from public.ph_docs where path=p_path and not deleted;
  if not settled then return current_doc||jsonb_build_object('_raidPending',true); end if;
  return current_doc;
end $$;
revoke all on function public.ph_oplot_store(text,text,jsonb,int,text),public.ph_oplot_load(text,text) from public;
grant execute on function public.ph_oplot_store(text,text,jsonb,int,text),public.ph_oplot_load(text,text) to anon, authenticated, service_role;

create function public.ph_oplot_raids(p_code text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who text:=oplot.island_owner(p_code);
begin
  return (select coalesce(jsonb_agg(r.summary||jsonb_build_object('replay',r.replay) order by r.day desc),'[]')
    from (select day,summary,replay from oplot.raid_reports where uid=who order by day desc limit 10) r);
end $$;
revoke all on function oplot.raid_at(date), oplot.first_raid(timestamptz), oplot.register_island(),
  oplot.raid_rank(int), oplot.raid_int(text,int,int), oplot.guard_power(jsonb),
  oplot.raid_actor_json(oplot.raid_actor), oplot.raid_event(int,text,oplot.raid_actor,oplot.raid_actor,int,text),
  oplot.raid_move(oplot.raid_actor,oplot.raid_actor), oplot.raid_distance(oplot.raid_actor,oplot.raid_actor),
  oplot.island_owner(text), oplot.settle_island(text,text), oplot.night_battle(jsonb,int,date,text), oplot.night_loot(jsonb,timestamptz,int), oplot.run_night_raids(timestamptz,text)
  from public, anon, authenticated;
revoke all on function public.ph_oplot_raids(text) from public;
grant execute on function public.ph_oplot_raids(text) to anon, authenticated, service_role;

-- Midnight UTC is 03:00 Moscow. The first due minute runs the simulation;
-- repeating the eligibility check also catches missed days and locked saves.
select cron.schedule('oplot-night-raids','* * * * *','select oplot.run_night_raids()');
