create or replace function oplot.guard_power(d jsonb) returns numeric language sql immutable set search_path='' as $$
  with stats as (select oplot.raid_int(d->>'level',1,100) lvl,oplot.raid_rank(oplot.raid_int(d->>'species',0,62)) tier,
    1+.18*oplot.raid_int(d->>'enchant',0,5) enchant),
  attacks as (select *,round((7+1.55*lvl)*(array[1,1.23,1.49,1.81])[tier]) base from stats)
  select base+(round(base*(.52+.035*(tier-1))*enchant)
    +round(base*enchant*case d->>'specialty' when 'focus' then .40 when 'area' then .55 else 0 end))
    /(case when tier<3 then 4 else 3 end) from attacks
$$;

-- Experienced islands face stronger first arrivals as well as the normal nightly growth.
create or replace function oplot.night_squad(wave int) returns table(slot int,level int,hp int,damage int)
language sql immutable strict set search_path='' as $$
  select i,lvl,40+6*lvl+8*wave,7+2*lvl+ceil(1.45*wave)::int
  from generate_series(1,least(10,3+wave/2)) i
  cross join lateral (select least(100,2+wave*2+(i-1)%3+greatest(0,wave-10)/3) lvl) levels
  order by i
$$;

-- Use the same growth for player-owned guards on both map versions. Only fresh
-- attacking formations use the revised citadel adjustment. Practice reuses the archived stats.
do $migration$
declare sim regprocedure; body text; rule record;
begin
  foreach sim in array array['oplot.simulate_classic_raid(jsonb,int,date,text,jsonb)'::regprocedure,
      'oplot.simulate_grid_raid(jsonb,int,date,text,jsonb)'::regprocedure] loop
    body:=pg_get_functiondef(sim);
    for rule in select * from (values
      ('55+8.5*lvl','55+7.5*lvl'),('7+1.75*lvl','7+1.55*lvl'),
      ($old$oplot.night_squad(wave+2*greatest(0,(select max(oplot.raid_int(b0->>'level',1,16))
          from jsonb_array_elements(oplot.arr(s->'buildings')) b0 where b0->>'type'='keep')-4))$old$,
       $new$oplot.night_squad(wave+(select greatest(0,max(oplot.raid_int(b0->>'level',1,16))-4)/3
          from jsonb_array_elements(oplot.arr(s->'buildings')) b0 where b0->>'type'='keep'))$new$)
    ) as changes(before,after) loop
      if strpos(body,rule.before)=0 then raise exception 'Unexpected simulator % near %',sim,rule.before; end if;
      body:=replace(body,rule.before,rule.after);
    end loop;
    execute body;
  end loop;
end $migration$;
