-- Local synthetic island only. Covers the cron path, practice, reconnaissance, save versioning and loot.
begin;
do $$
declare
  who text:='qa-multi-'||gen_random_uuid(); code text:=upper(gen_random_uuid()::text); path text:='data/users/'||who||'/oplot/saves/main';
  day1 date:='2030-04-14'; day2 date:=oplot.first_raid(statement_timestamp());
  base jsonb:='{"layoutVersion":2,"xp":0,"gold":100,"berries":75,"dragons":[],"buildings":[{"id":"keep","type":"keep","x":7,"y":7,"level":1}]}';
  old_base jsonb:='{"xp":0,"gold":100,"berries":75,"dragons":[],"buildings":[{"id":"keep","type":"keep","x":4,"y":4,"level":1}]}';
  formation jsonb:='{"v":3,"layoutVersion":2,"entrySide":0,"attackers":[{"id":"a","type":"raider","species":0,"level":4,"x":0,"y":10,"hp":100,"damage":100,"flying":false,"enchant":0}]}';
  spare jsonb:='{"id":"spare","type":"farm","x":null,"y":null,"stowed":true,"level":1,"pausedStock":13,"since":0}';
  rectangle jsonb; archived jsonb; malformed jsonb; guard_base jsonb; guard_wave jsonb; sky jsonb; fort jsonb; s jsonb; f jsonb; orig jsonb; report jsonb; result jsonb; wallet jsonb; latest jsonb;
  events jsonb; failed boolean:=false; i int;
begin
  if (select array_agg(oplot.raid_span(k) order by i0) from unnest(array['keep','goldstore','foodstore','den','academy','archer','cannon','home','farm','mine','spire','wall','firetrap','icetrap']) with ordinality t(k,i0))
    <>array[5,4,4,4,4,3,3,3,3,3,2,1,1,1] then raise exception 'Footprint contract';end if;
  if array(select oplot.raid_axis(n) from generate_series(10,16) n)<>array[33,36,40,43,46,50,53] then raise exception 'Profile axes differ';end if;
  if not oplot.valid_grid_layout(base) or oplot.valid_grid_layout(jsonb_set(base,'{buildings,0,x}','31'))
     or oplot.valid_grid_layout(jsonb_set(base,'{buildings,0,stowed}','true'))
     or oplot.valid_grid_layout(jsonb_set(base,'{buildings}',(base->'buildings')||'[{"id":"x","type":"wall","x":11,"y":11}]'))
     or not oplot.valid_grid_layout(jsonb_set(base,'{buildings}',(base->'buildings')||'[{"id":"x","type":"wall","x":12,"y":11}]'))
     then raise exception 'Footprints inside the board without overlaps'; end if;
  rectangle:=jsonb_set(base,'{buildings}',(base->'buildings')||'[{"id":"edge","type":"farm","x":4,"y":32,"level":1}]');
  if oplot.raid_dimensions(base)<>array[33,33] or oplot.raid_dimensions(rectangle)<>array[33,35]
    or not oplot.valid_grid_layout(rectangle) or oplot.raid_dimensions(jsonb_set(rectangle,'{buildings,1,y}','31'))<>array[33,34]
    or oplot.raid_dimensions(jsonb_set(rectangle,'{buildings,1}',spare))<>array[33,33]
    or oplot.valid_grid_layout(jsonb_set(rectangle,'{buildings,1,y}','33')) then raise exception 'Grandfathered compact borders';end if;
  for malformed in select value from jsonb_array_elements(
    '[null,[],{},{"buildings":7},{"buildings":[false]},{"buildings":[{"type":"keep","id":7,"x":1,"y":1}]},
      {"buildings":[{"type":"keep","id":"k","x":{},"y":1}]},{"buildings":[{"type":"keep","id":"k","x":0,"y":99999999999999999999999999}]},
      {"buildings":[{"type":"keep","id":"k","stowed":"false","x":0,"y":0}]}]') loop
    if oplot.valid_grid_layout(malformed) then raise exception 'Accepted malformed map: %',malformed;end if;
  end loop;
  for i in 1..12 loop
    if oplot.night_battle(old_base,i,day1+i,who)<>oplot.simulate_classic_raid(old_base,i,day1+i,who,null) then raise exception 'Original night changed'; end if;
  end loop;
  fort:=jsonb_set(base,'{buildings}',(base->'buildings')||'[{"id":"w","type":"wall","x":2,"y":10,"level":2},{"id":"t","type":"icetrap","x":3,"y":10,"level":1}]');
  f:=oplot.simulate_raid(fort,1,day1,who,formation);events:=f#>'{replay,events}';
  if f#>>'{replay,gridWidth}'<>'33' or f#>>'{replay,layoutVersion}'<>'2' or f#>>'{replay,buildings,0,span}'<>'5'
     or not jsonb_path_exists(events,'$[*] ? (@.t == 1 && @.kind == "wall" && @.target == "w")')
     or not jsonb_path_exists(events,'$[*] ? (@.t == 1 && @.kind == "move" && @.to[0] == 1)')
     or not jsonb_path_exists(events,'$[*] ? (@.t == 2 && @.kind == "trap" && @.id == "t")')
     or jsonb_path_exists(events,'$[*] ? ((@.t == 3 || @.t == 4) && @.kind == "move" && @.id == "a")')
     then raise exception 'Ground stride jumped a wall or an intervening ice trap';end if;
  sky:=jsonb_set(formation,'{attackers,0,flying}','true');
  events:=oplot.simulate_raid(fort,1,day1,who,sky)#>'{replay,events}';
  if jsonb_path_exists(events,'$[*] ? (@.kind == "wall" || @.kind == "trap")') or
     not jsonb_path_exists(events,'$[*] ? (@.t == 1 && @.kind == "move" && @.to[0] == 2)') then raise exception 'Flight or doubled movement';end if;
  sky:=jsonb_set(formation,'{entrySide}','2');
  events:=oplot.simulate_raid(base,1,day1,who,sky)#>'{replay,events}';
  if not jsonb_path_exists(events,'$[*] ? (@.t == 11 && @.kind == "strike" && @.target == "keep" && @.from[0] == 12 && @.to[0] == 9 && @.to[1] == 9)')
    then raise exception 'Raider must attack the near face before reaching the anchor and aim at the centre';end if;
  for i in 1..2 loop
    s:=jsonb_set(base,'{buildings}',jsonb_build_array(jsonb_build_object('id','c','type','cannon','level',1,'x',17+i,'y',9)));
    events:=oplot.simulate_raid(s,1,day1,who,sky)#>'{replay,events}';
    if jsonb_path_exists(events,'$[*] ? (@.t == 1 && @.kind == "tower")')<>(i=2)
      then raise exception 'Cannon circular range from its centre';end if;
  end loop;
  s:=jsonb_set(base,'{buildings}',(base->'buildings')||jsonb_build_array(spare));
  f:=oplot.night_battle(s,1,day1,who);
  if jsonb_path_exists(f,'$.replay.buildings[*] ? (@.id == "spare")') or
    f<>oplot.night_battle(s||jsonb_build_object('layoutDraft',jsonb_build_object('buildings','[]'::jsonb)),1,day1,who)
    then raise exception 'Stowed buildings or draft affected base'; end if;
  f:=oplot.night_loot(s,now(),3);
  if f->>'goldLost'<>'80' or f->>'berriesLost'<>'70' or f#>>'{state,buildings,1,pausedStock}'<>'3' or f#>>'{state,berries}'<>'15'
    then raise exception 'Frozen inventory is neither produced twice nor hidden from raid losses';end if;

  -- The full 55×55 diagonal takes fifty turns even on an undefended island.
  fort:=jsonb_set(jsonb_set(base||'{"xp":5040}','{buildings,0,x}','50'),'{buildings,0,y}','50');
  sky:=jsonb_set(jsonb_set(formation,'{attackers,0,y}','0'),'{attackers,0,damage}','999');
  f:=oplot.simulate_raid(fort,1,day1,who,sky);
  if f->>'stars'<>'3' or (f#>>'{replay,duration}')::int not between 50 and 68 or
    not jsonb_path_exists(f,'$.replay.events[*] ? (@.kind == "destroy" && @.target == "keep" && @.t >= 50)') then
    raise exception 'The clock expired before the raider could cross 55×55';end if;
  archived:=f->'replay';
  if archived->>'gridSize'<>'55' or archived->>'gridWidth'<>'55' or archived->>'gridHeight'<>'55' then raise exception 'Old far keep moved';end if;
  -- The ground guard starts north of this keep, directly opposite a grounded raider.
  -- The unobstructed flank is short enough to intercept before the first hit on the keep.
  guard_base:='{"layoutVersion":2,"xp":0,"buildings":[{"id":"fort","type":"keep","x":15,"y":15,"level":1}],
    "dragons":[{"id":"guard","species":0,"level":10,"enchant":0}]}';
  guard_wave:=formation||'{"entrySide":3,"gridWidth":33,"gridHeight":33,
    "attackers":[{"id":"a","type":"raider","species":0,"level":4,"x":17,"y":32,"hp":20,"damage":112,"flying":false,"enchant":0}]}';
  result:=oplot.simulate_raid(guard_base,1,day1,who,guard_wave);events:=result#>'{replay,events}';
  if result->>'stars'<>'0' or not jsonb_path_exists(events,'$[*] ? (@.kind == "guard" && @.id == "guard" && @.target == "a")')
    or jsonb_path_exists(events,'$[*] ? (@.kind == "strike" && @.target == "fort")')
    or jsonb_path_exists(events,'$[*] ? (@.kind == "move" && @.id == "guard" && @.to[0] >= 15 && @.to[0] <= 19 && @.to[1] >= 15 && @.to[1] <= 19)')
    then raise exception 'Ground guard failed to intercept via the open flank';end if;
  -- Enclosing all four neighbors of the starting guard keeps it in place until a breach opens.
  guard_base:=jsonb_set(guard_base,'{buildings}',(guard_base->'buildings')||'[{"id":"left","type":"wall","x":16,"y":14,"level":2},
    {"id":"right","type":"wall","x":18,"y":14,"level":2},{"id":"back","type":"wall","x":17,"y":13,"level":2}]');
  events:=oplot.simulate_raid(guard_base,1,day1,who,guard_wave)#>'{replay,events}';
  if not jsonb_path_exists(events,'$[*] ? (@.kind == "strike" && @.target == "fort")')
    or jsonb_path_exists(events,'$[*] ? (@.kind == "move" && @.id == "guard")')
    then raise exception 'Ground guard escaped sealed perimeter';end if;
  -- Every single plot is occupied. The first wall is in the final array slot:
  -- the occupancy arrays and actor indices must survive more than 3,000 slots.
  fort:=jsonb_set(fort,'{buildings}',(fort->'buildings')||(select jsonb_agg(
    jsonb_build_object('id','w'||x||'/'||y,'type','wall','x',x,'y',y,'level',1) order by y desc,x desc)
    from generate_series(0,54) x cross join generate_series(0,54) y where x<50 or y<50));
  if not oplot.valid_grid_layout(fort) or not jsonb_path_exists(oplot.simulate_raid(fort,1,day1,who,sky),
    '$.replay.events[*] ? (@.t == 1 && @.kind == "wall" && @.target == "w0/0")') then raise exception 'Dense full-grid lookup';end if;
  -- Transitional 20..32-wide v3 snapshots also preserve their relative shoreline lane.
  f:=oplot.simulate_raid(base,1,day1,who,formation||'{"gridWidth":32,"gridHeight":30}');
  if f#>>'{replay,attackers,0,y}'<>floor(10.5*33/30)::text then raise exception 'Intermediate archive entrance mapping';end if;
  insert into public.ph_students(uid,code) values(who,code);
  wallet:=public.ph_oplot_wallet(code);
  perform public.ph_oplot_store(code,path,jsonb_build_object('rev',1,'op','original','state',old_base),null,null);
  orig:=oplot.night_battle(old_base,2,day1,who);
  insert into oplot.raid_reports(uid,day,summary,replay) values(who,day1,jsonb_build_object('wave',2,'stars',orig->'stars'),orig->'replay');
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',2,'op','large','state',s),1,'original');
  if result->>'ok'<>'true' then raise exception 'Version upgrade failed';end if;
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',3,'op','oldphone','state',old_base),2,'large');
  if result->>'ok'<>'false' or result#>>'{cur,state,layoutVersion}'<>'2' then raise exception 'Old client overwrote v2';end if;
  begin
    perform public.ph_oplot_store(code,path,jsonb_build_object('rev',3,'op','invalid','state',jsonb_set(s,'{buildings,0,x}','34')),2,'large');
  exception when invalid_parameter_value then failed:=true; end;
  if not failed then raise exception 'Invalid proposal accepted';end if;
  result:=public.ph_oplot_practice(code,day1,jsonb_set(s,'{xp}','4235'));
  if result#>>'{replay,gridWidth}'<>'53' or result#>>'{replay,gridHeight}'<>'50' or result#>>'{replay,entrySide}'<>orig#>>'{replay,entrySide}'
     or result#>>'{replay,attackers,0,hp}'<>orig#>>'{replay,attackers,0,hp}'
     or ((orig#>>'{replay,entrySide}')::int%2=0 and (result#>>'{replay,attackers,0,y}')::int<>floor(((orig#>>'{replay,attackers,0,y}')::int+.5)*50/10))
     or ((orig#>>'{replay,entrySide}')::int%2=1 and (result#>>'{replay,attackers,0,x}')::int<>floor(((orig#>>'{replay,attackers,0,x}')::int+.5)*53/10))
     or orig->'replay'<>(select replay from oplot.raid_reports where uid=who and day=day1) then raise exception 'Archive changed or old formation trained incorrectly';end if;
  insert into oplot.raid_reports(uid,day,summary,replay) values(who,day1-1,
    jsonb_build_object('day',day1-1,'wave',1,'stars',3),archived);
  result:=public.ph_oplot_practice(code,day1-1,rectangle);
  if result#>>'{replay,gridWidth}'<>'33' or result#>>'{replay,gridHeight}'<>'35' or result#>>'{replay,gridSize}'<>'35'
    or result#>>'{replay,attackers,0,hp}'<>archived#>>'{attackers,0,hp}' or result#>>'{replay,entrySide}'<>archived->>'entrySide'
    or not exists(select from jsonb_array_elements(public.ph_oplot_raids(code)) r where r->'replay'=archived)
    then raise exception 'Practice must replay a 55x55 recording on the occupied 33x35 terrain';end if;
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',3,'op','old-border','state',rectangle),2,'large');
  if result->>'ok'<>'true' then raise exception 'Old southern edge refused';end if;
  insert into oplot.scout_passes values(who,day2);
  report:=public.ph_oplot_scout(code);
  update oplot.raid_islands set next_day=day2 where uid=who;
  if oplot.run_night_raids(oplot.raid_at(day2)+interval '1 second',who)<>1 then raise exception 'Native cron wave did not execute';end if;
  select r.replay into latest from oplot.raid_reports r where uid=who and day=day2;
  if latest->>'entrySide'<>report->>'entrySide' or latest->>'layoutVersion'<>'2'
    or latest->>'gridWidth'<>'33' or latest->>'gridHeight'<>'35' or latest->>'gridSize'<>'35' or wallet<>public.ph_oplot_wallet(code)
    or not oplot.valid_grid_layout((public.ph_oplot_load(code,path))->'state') then raise exception 'Scout, wallet or main save regression';end if;
  orig:=public.ph_oplot_load(code,path);
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',(orig->>'rev')::int+1,'op','clear-border','state',base),
    (orig->>'rev')::int,orig->>'op');
  if result->>'ok'<>'true' or oplot.raid_dimensions((public.ph_oplot_load(code,path))->'state')<>array[33,33]
    then raise exception 'Clearing the occupied border failed to release the strip';end if;

end $$;
rollback;
