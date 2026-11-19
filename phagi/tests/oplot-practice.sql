-- Synthetic profiles and a read-only training fight; every fixture rolls back.
begin;
do $practice$
declare
  who text:='qa-practice-'||gen_random_uuid(); other_uid text:='qa-practice-'||gen_random_uuid();
  code1 text:=upper(gen_random_uuid()::text); code2 text:=upper(gen_random_uuid()::text);
  day1 date:='2030-02-15'; base jsonb:='{"xp":0,"gold":150,"berries":100,"dragons":[],"buildings":[{"id":"k","type":"keep","level":1,"x":4,"y":4}]}';
  layout jsonb; original jsonb; historical jsonb; before_doc jsonb; result jsonb; saved jsonb; formation jsonb;
  normal jsonb; focus jsonb; area jsonb; bonus int; h int; side int; i int; before_wallet jsonb;
  attacker jsonb; trained jsonb; denied boolean:=false;
begin
  insert into public.ph_students(uid,code) values(who,code1),(other_uid,code2);
  original:=oplot.night_battle(base,6,day1,who); side:=(original#>>'{replay,entrySide}')::int;
  historical:=((original->'replay')-'entrySide'-'gridSize'-'gridWidth'-'gridHeight')||'{"v":1}';
  historical:=jsonb_set(historical,'{attackers,0}',
    (historical#>'{attackers,0}')||'{"species":53,"level":18,"hp":987,"damage":73,"flying":false}');
  insert into oplot.raid_reports(uid,day,summary,replay) values(who,day1,
    jsonb_build_object('day',day1,'stars',original->'stars','wave',6),historical);
  saved:=jsonb_build_object('rev',1,'op','unmodified','state',base);
  perform public.ph_oplot_store(code1,'data/users/'||who||'/oplot/saves/main',saved,null,null);
  select to_jsonb(d) into before_doc from public.ph_docs d where d.path='data/users/'||who||'/oplot/saves/main';
  before_wallet:=public.ph_oplot_wallet(code1);
  layout:=base||'{"xp":5040,"buildings":[{"id":"new-keep","type":"keep","level":5,"x":14,"y":13},
                      {"id":"new-tower","type":"archer","level":8,"x":0,"y":4}]}';
  result:=public.ph_oplot_practice(code1,day1,layout);
  if result<>public.ph_oplot_practice(code1,day1,layout) or result->>'originalStars'<>original->>'stars'
    or result#>>'{replay,gridWidth}'<>'16' or result#>>'{replay,buildings,0,id}'<>'new-keep'
    or result#>>'{replay,entrySide}'<>side::text then raise exception 'Wrong layout, seed or nonrepeatable practice'; end if;
  for i in 0..jsonb_array_length(historical->'attackers')-1 loop
    attacker:=historical->'attackers'->i; trained:=(result#>'{replay,attackers}')->i;
    if (attacker-'x'-'y')<>(trained-'x'-'y') then raise exception 'Historical stats changed'; end if;
    if side in (0,2) and (trained->>'y'<>attacker->>'y' or trained->>'x'<>(case when side=0 then '0' else '15' end)) or
       side in (1,3) and (trained->>'x'<>attacker->>'x' or trained->>'y'<>(case when side=1 then '0' else '15' end))
       then raise exception 'Approach changed after expansion'; end if;
  end loop;
  if before_doc<>(select to_jsonb(d) from public.ph_docs d where d.path='data/users/'||who||'/oplot/saves/main')
    or before_wallet<>public.ph_oplot_wallet(code1)
    or historical<>(select replay from oplot.raid_reports where uid=who and day=day1)
    or (select count(*) from oplot.raid_reports where uid=who)<>1 or (select i.wave from oplot.raid_islands i where uid=who)<>6
    then raise exception 'Practice changed live progression, wallet or history'; end if;
  begin perform public.ph_oplot_practice(code2,day1,layout);exception when invalid_parameter_value then denied:=true;end;
  if not denied or has_function_privilege('anon','oplot.simulate_raid(jsonb,integer,date,text,jsonb)','execute') then raise exception 'Foreign practice'; end if;

  base:='{"buildings":[{"id":"k","type":"keep","level":9,"x":0,"y":4}],"dragons":[{"id":"d","species":0,"level":16,"enchant":2}]}';
  formation:=jsonb_build_object('v',2,'entrySide',0,'attackers',(select jsonb_agg(jsonb_build_object('id','a'||n,
    'type','raider','species',1,'level',6,'hp',6000,'damage',1,'flying',false,'enchant',0,'x',0,'y',y) order by n)
    from unnest(array[4,3,5,6]) with ordinality as spots(y,n)));
  original:=oplot.simulate_raid(base,1,day1,who,formation||'{"v":1}');
  if exists(select from jsonb_array_elements(original#>'{replay,events}') e
      where e->>'kind' in ('strike','wall') and ((e->>'ultimate')::boolean or (e->>'amount')::int<>1)) then
    raise exception 'A legacy raider received a new attack in a historical rematch'; end if;
  normal:=oplot.simulate_raid(base,1,day1,who,formation);
  focus:=oplot.simulate_raid(jsonb_set(base,'{dragons,0,specialty}','"focus"'),1,day1,who,formation);
  area:=oplot.simulate_raid(jsonb_set(base,'{dragons,0,specialty}','"area"'),1,day1,who,formation);
  bonus:=round(.40*(focus#>>'{replay,defenders,0,damage}')::int*1.36);
  select (e->>'amount')::int into h from jsonb_array_elements(normal#>'{replay,events}') e where e->>'kind'='guard' and e->>'ultimate'='true' limit 1;
  if h is null or h+bonus is distinct from (select (e->>'amount')::int from jsonb_array_elements(focus#>'{replay,events}') e
     where e->>'kind'='guard' and e->>'ultimate'='true' limit 1) or focus#>>'{replay,defenders,0,specialty}'<>'focus'
    then raise exception 'Focus damage'; end if;
  if (select count(*) from jsonb_array_elements(area#>'{replay,events}') e where e->>'secondary'='true' and e->>'t'='4')<>2
    or exists(select from jsonb_array_elements(area#>'{replay,events}') e where e->>'secondary'='true'
      and (e->>'ultimate'<>'true' or (e->>'amount')::int<>round(.55*(area#>>'{replay,defenders,0,damage}')::int*1.36)))
    or not exists(select from jsonb_array_elements(area#>'{replay,events}') e where e->>'kind'='strike' and e->>'ultimate'='true')
    then raise exception 'Sweep targets or raider ultimate'; end if;
end $practice$;
rollback;
