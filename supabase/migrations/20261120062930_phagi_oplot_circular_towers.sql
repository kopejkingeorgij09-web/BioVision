-- The tower's centre is also the origin of the circle drawn on the island.
create or replace function oplot.raid_span(kind text) returns int language sql immutable set search_path='' as $$
  select case when kind='keep' then 5 when kind in ('goldstore','foodstore','den','academy','mortar','solar') then 4
    when kind in ('archer','cannon','home','farm','mine','skybow','tempest') then 3 when kind='spire' then 2
    when kind in ('firetrap','icetrap','wall') then 1 end
$$;

create function oplot.tower_reach(kind text,lvl int,layout_version int) returns int language sql immutable strict set search_path='' as $$
  select (case kind when 'archer' then 7 when 'cannon' then 6 when 'spire' then 6 when 'mortar' then 8
    when 'skybow' then 8 when 'tempest' then 7 when 'solar' then 8 end + least(16,greatest(1,lvl))/3)
    *case when layout_version=2 then 2 else 1 end
$$;

create function oplot.tower_targets(b oplot.raid_actor,raiders oplot.raid_actor[],layout_version int)
returns table(idx int,secondary boolean) language sql immutable strict set search_path='' as $$
  with origin as (select case when layout_version=2 then (oplot.raid_span(b.type)-1)*.5 else 0 end as centre),
  eligible as (select n,(raiders[n]).x x,(raiders[n]).y y,(raiders[n]).hp hp,
      ((raiders[n]).x-b.x-centre)^2+((raiders[n]).y-b.y-centre)^2 as d2
    from generate_subscripts(raiders,1) n cross join origin where (raiders[n]).hp>0
      and case when b.type in ('cannon','mortar') then not (raiders[n]).flying when b.type='skybow' then (raiders[n]).flying else true end),
  first_hit as (select * from eligible where d2<=oplot.tower_reach(b.type,b.level,layout_version)^2
    order by case when b.type='solar' then hp else 0 end desc,d2,n limit 1),
  splash as (select e.n from eligible e cross join first_hit f where e.n<>f.n and b.type in ('cannon','mortar','tempest')
    and (e.x-f.x)^2+(e.y-f.y)^2 <= ((case b.type when 'cannon' then 1 when 'mortar' then 2.25 else 2 end)
      *case when layout_version=2 then 2 else 1 end)^2
    order by (e.x-f.x)^2+(e.y-f.y)^2,e.n limit case when b.type='tempest' then 2 end)
  select n,false from first_hit union all select n,true from splash
$$;

create function oplot.state_building_cap(kind text,profile int,s jsonb) returns int language sql immutable set search_path='' as $$
  select case when required is null then oplot.building_cap(kind,profile)
    else (coalesce((select max(oplot.raid_int(b->>'level',1,16)) from jsonb_array_elements(oplot.arr(s->'buildings')) b where b->>'type'='keep'),1)>=required)::int end
    from (select case kind when 'mortar' then 10 when 'skybow' then 12 when 'tempest' then 14 when 'solar' then 16 end required) u
$$;

create or replace function oplot.excess_buildings(s jsonb) returns boolean language sql immutable set search_path='' as $$
  select exists(select 1 from jsonb_array_elements(oplot.arr(s->'buildings')) b
    group by b->>'type' having count(*)>oplot.state_building_cap(b->>'type',oplot.profile_level(s),s))
$$;

-- Keep previous economy and replay rules, replacing only the level cap, prices and tower stage.
do $migration$
declare fn regprocedure; body text; first_pos int; last_pos int; multi boolean; event_name text;
begin
  foreach fn in array array['oplot.profile_xp(jsonb)'::regprocedure,'oplot.settle_buildings(jsonb,bigint)'::regprocedure] loop
    body:=pg_get_functiondef(fn);
    if strpos(body,'then 12 else 9 end')=0 then raise exception 'Unexpected level rule in %',fn; end if;
    execute replace(replace(body,'case when b->>''type''=''keep'' then 12 else 9 end','16'),'oplot.building_cap(k,profile)','oplot.state_building_cap(k,profile,s)');
  end loop;
  body:=pg_get_functiondef('oplot.building_refund(text,int,int)'::regprocedure);
  if strpos(body,'41000,57000]')=0 then raise exception 'Unexpected citadel prices'; end if;
  execute replace(replace(body,'41000,57000]','41000,57000,76000,99000,125000,155000]'),
    'when ''wall'' then 20','when ''mortar'' then 1800 when ''skybow'' then 3200 when ''tempest'' then 5400 when ''solar'' then 8200 when ''wall'' then 20');
  foreach fn in array array['oplot.simulate_classic_raid(jsonb,int,date,text,jsonb)'::regprocedure,'oplot.simulate_grid_raid(jsonb,int,date,text,jsonb)'::regprocedure] loop
    multi:=fn='oplot.simulate_grid_raid(jsonb,int,date,text,jsonb)'::regprocedure;
    event_name:=case when multi then 'oplot.raid_grid_event' else 'oplot.raid_event' end;
    body:=pg_get_functiondef(fn);
    body:=replace(body,'distinct_seed int;', 'distinct_seed int; shot record;');
    body:=replace(body,'''archer'',''cannon'',''spire''','''archer'',''cannon'',''spire'',''mortar'',''skybow'',''tempest'',''solar''');
    body:=replace(body,'when ''spire'' then 48','when ''spire'' then 48 when ''mortar'' then 66 when ''skybow'' then 56 when ''tempest'' then 64 when ''solar'' then 82');
    body:=replace(body,'when ''spire'' then 7+5*lvl','when ''spire'' then 7+5*lvl when ''mortar'' then 15+8*lvl when ''skybow'' then 10+7*lvl when ''tempest'' then 9+6*lvl when ''solar'' then 22+9*lvl');
    first_pos:=strpos(body,'if b.type=''cannon'' and tick%2=0');
    last_pos:=strpos(body,E'    end loop;\n    for i in 1..cardinality(guards) loop');
    if first_pos=0 or last_pos<=first_pos then raise exception 'Unexpected tower loop in %',fn; end if;
    body:=left(body,first_pos-1)||format($shots$if (b.type in ('cannon','tempest','solar') and tick%%2=0) or (b.type='mortar' and (tick-1)%%3<>0) then continue; end if;
      for shot in select * from oplot.tower_targets(b,raiders,%s) order by secondary,idx loop
        j:=shot.idx; a:=raiders[j];
        amount:=case when shot.secondary then (b.damage+1)/2 else b.damage end;
        a.hp:=greatest(0,a.hp-amount); raiders[j]:=a;
        if not shot.secondary then dest:=a; end if;
        events:=array_append(events,%s(tick,'tower',b,a,amount,'Выстрел башни')||
          case when b.type='tempest' and shot.secondary then jsonb_build_object('relay',jsonb_build_array(dest.x,dest.y)) else '{}'::jsonb end);
        if a.hp=0 then events:=array_append(events,%s(tick,'fall',b,a,0,'Налётчик выбыл')); end if;
      end loop;
$shots$,case when multi then 2 else 1 end,event_name,event_name)||substr(body,last_pos);
    execute body;
  end loop;
end $migration$;
revoke all on function oplot.tower_reach(text,int,int),oplot.tower_targets(oplot.raid_actor,oplot.raid_actor[],int),
  oplot.state_building_cap(text,int,jsonb) from public,anon,authenticated;
