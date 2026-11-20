-- Two synthetic islands exercise the actual scheduler and archived practice. No player data is kept.
begin;
do $test$
declare
  who text; pass text; path text; day date:='2032-04-16'; solo boolean; v int; r jsonb; doc jsonb; s jsonb; practice jsonb;
  base jsonb:='{"xp":22000,"gold":5,"berries":6,"dragons":[{"id":"guard","species":0,"level":15}],
    "buildings":[{"type":"keep","level":1,"id":"k","x":4,"y":4},{"type":"archer","level":16,"id":"a","x":3,"y":5},
    {"type":"spire","level":16,"id":"s","x":5,"y":3},{"type":"cannon","level":16,"id":"c","x":3,"y":3}]}';
  mult int; expected jsonb; replay jsonb; mature jsonb;
begin
  foreach solo in array array[false,true] loop
    who:='qa-tower-guard-'||gen_random_uuid();pass:=upper(gen_random_uuid()::text);path:='data/users/'||who||'/oplot/saves/main';
    mult:=case when solo then 3 else 1 end;
    expected:=jsonb_build_object('gold',74*mult,'berries',47*mult,'xp',33*mult,'full',false);
    s:=case when solo then base||'{"settings":{"nightTowersOnly":true}}'::jsonb else base end;
    insert into public.ph_students(uid,code) values(who,pass);
    insert into public.ph_docs(path,parent,id,data) values(path,'data/users/'||who||'/oplot/saves','main',jsonb_build_object('rev',1,'op','fixture','state',s));
    update oplot.raid_islands set next_day=day where uid=who;
    if oplot.run_night_raids(oplot.raid_at(day),who)<>1 then raise exception 'No raid'; end if;
    select summary into r from oplot.raid_reports h where h.uid=who;
    select data into doc from public.ph_docs d where d.path='data/users/'||who||'/oplot/saves/main';
    if r->'reward' is distinct from expected or r->'towersOnly' is distinct from to_jsonb(solo)
        or doc#>'{state,lastRaid}' is distinct from r or doc#>'{state,dragons}' is distinct from base->'dragons'
        or (doc#>>'{state,gold}')::int<>5+74*mult or (doc#>>'{state,berries}')::int<>6+47*mult
        or (doc#>>'{state,xp}')::int<>22000+33*mult then raise exception 'Incorrect settlement: %',r; end if;
    practice:=public.ph_oplot_practice(pass,day,s);
    if practice ? 'reward' or jsonb_array_length(practice#>'{replay,defenders}')<>(case when solo then 0 else 1 end)
       or oplot.run_night_raids(oplot.raid_at(day),who)<>0 then raise exception 'Practice/duplicate settlement'; end if;
    if (select data from public.ph_docs d where d.path='data/users/'||who||'/oplot/saves/main') is distinct from doc then raise exception 'Duplicate credit'; end if;
    update public.ph_docs d set data=jsonb_set(data,'{state,buildings}',jsonb_build_array(base->'buildings'->0))
      where d.path='data/users/'||who||'/oplot/saves/main';
    if solo then
      perform oplot.run_night_raids(oplot.raid_at(day+1),who);
      select h.summary into strict r from oplot.raid_reports h where h.uid=who and h.day='2032-04-17';
      if (r->>'stars')::int=0 or r ? 'reward' then raise exception 'Lost island received a prize: %',r; end if;
    end if;
  end loop;
  if oplot.night_victory_reward(base||'{"gold":448,"berries":350}',1,true)<>'{"gold":2,"berries":0,"xp":99,"full":true}' then raise exception 'Storage limits'; end if;
  for v in 1..2 loop
    s:=jsonb_build_object('layoutVersion',v,'dragons',base->'dragons','settings','{"nightTowersOnly":true}'::jsonb,
      'buildings','[{"id":"k","type":"keep","level":1,"x":8,"y":8}]'::jsonb);
    replay:=oplot.night_battle(s,1,day,'test')->'replay';
    mature:=oplot.night_battle(jsonb_set(s,'{buildings,0,level}','12'),1,day,'test')->'replay';
    if replay->'defenders'<>'[]' or (mature#>>'{attackers,0,hp}')::int<=(replay#>>'{attackers,0,hp}')::int
       or (mature#>>'{attackers,0,damage}')::int<=(replay#>>'{attackers,0,damage}')::int then raise exception 'Difficulty or roster (layout %)',v; end if;
    if (replay#>>'{attackers,0,level}')::int<>4 or (mature#>>'{attackers,0,level}')::int<>8
       or (mature#>>'{attackers,0,hp}')::int<>112 or (mature#>>'{attackers,0,damage}')::int<>28 then
      raise exception 'First night difficulty jumped for a developed keep (layout %)',v;
    end if;
  end loop;
end $test$;
rollback;
