-- Expected damage per attack over a complete ability cycle. The area specialization
-- counts one additional target. Ties use the stable ASCII dragon ID in both clients.
create or replace function oplot.guard_power(d jsonb) returns numeric language sql immutable set search_path='' as $$
  with stats as (select oplot.raid_int(d->>'level',1,100) lvl,oplot.raid_rank(oplot.raid_int(d->>'species',0,62)) tier,
    1+.18*oplot.raid_int(d->>'enchant',0,5) enchant),
  attacks as (select *,round((7+1.45*lvl)*(array[1,1.23,1.49,1.81])[tier]) base from stats)
  select base+(round(base*(.52+.035*(tier-1))*enchant)
    +round(base*enchant*case d->>'specialty' when 'focus' then .40 when 'area' then .55 else 0 end))
    /(case when tier<3 then 4 else 3 end) from attacks
$$;

create function oplot.night_squad(wave int) returns table(slot int,level int,hp int,damage int)
language sql immutable strict set search_path='' as $$
  select i,lvl,36+6*lvl+6*wave,6+2*lvl+ceil(1.30*wave)::int
  from generate_series(1,least(10,3+wave/2)) i
  cross join lateral (select least(100,2+wave*2+(i-1)%3+greatest(0,wave-10)/3) lvl) levels
  order by i
$$;
revoke all on function oplot.night_squad(int) from public,anon,authenticated;

-- Both simulators still own their original pathfinding and replay formats. Change
-- only the guard slots and the fresh-roster branch. Archived attackers retain
-- their original level, HP, damage, entry side and ability version in practice.
do $migration$
declare simulator regprocedure; body text; rule record; multi boolean;
begin
  foreach simulator in array array['oplot.simulate_classic_raid(jsonb,int,date,text,jsonb)'::regprocedure,
    'oplot.simulate_grid_raid(jsonb,int,date,text,jsonb)'::regprocedure] loop
    multi:=simulator='oplot.simulate_grid_raid(jsonb,int,date,text,jsonb)'::regprocedure;
    body:=pg_get_functiondef(simulator);
    for rule in select * from (values
      ('order by oplot.guard_power(d) desc, d->>''id''','order by oplot.guard_power(d) desc, (d->>''id'') collate "C"'),
      ('limit 4 loop','limit 5 loop'),
      (case when multi then 'keep_x+(array[0,-3,3,0])' else 'keep_x+(array[0,-1,1,0])' end,
       case when multi then 'keep_x+(array[0,-3,3,0,3])' else 'keep_x+(array[0,-1,1,0,0])' end),
      (case when multi then 'keep_y+(array[-3,0,0,3])' else 'keep_y+(array[0,0,0,1])' end,
       case when multi then 'keep_y+(array[-3,0,0,3,-3])' else 'keep_y+(array[0,0,0,1,-1])' end),
      ('distinct_seed int;', 'distinct_seed int; invader record;'),
      ('for i in 1..least(7,2+wave/3) loop','for invader in select * from oplot.night_squad(wave) order by slot loop
      i:=invader.slot;'),
      ('((i-1)%3) - least(1,i-1)*2','(case when i%2=0 then i/2 else -(i/2) end)'),
      ('lvl:=least(100,2+wave*2+(i-1)%3);','lvl:=invader.level;'),
      ('24+lvl*5+wave*4,5+lvl*2+wave','invader.hp,invader.damage')
    ) as changes(before,after) loop
      if strpos(body,rule.before)=0 then raise exception 'Unexpected definition of % near %',simulator,rule.before; end if;
      body:=replace(body,rule.before,rule.after);
    end loop;
    execute body;
  end loop;
end $migration$;
