-- Integration fixtures are strictly scoped by uid. Even on a populated database
-- the scheduler is never called against real saves. Everything rolls back.
begin;

do $loot$
declare
  moment timestamptz:='2030-01-04 00:00Z'; ms bigint:=extract(epoch from moment)*1000;
  original jsonb; loot jsonb; b jsonb; original_b jsonb; s jsonb; stars int; pct int;
  produced int; gold int; berries int; ix int; rate numeric; capped numeric;
begin
  if oplot.first_raid('2030-01-03T23:59:59Z')<>'2030-01-04' or
     oplot.first_raid('2030-01-04T00:00:00Z')<>'2030-01-05' or
     oplot.raid_at('2030-01-04')<>moment then raise exception 'Moscow cut-off'; end if;
  original:=jsonb_build_object('gold',101,'berries',11,'buildings',jsonb_build_array(
    jsonb_build_object('id','m','type','mine','level',1,'since',ms-848487),
    jsonb_build_object('id','h','type','home','level',1,'since',ms-246917),
    jsonb_build_object('id','f','type','farm','level',2,'since',ms-750000),
    jsonb_build_object('id','u','type','home','level',1,'since',ms+60000),
    jsonb_build_object('id','keep','type','keep','level',2)));
  for stars in 0..3 loop
    pct:=(array[0,25,50,80])[stars+1];
    loot:=oplot.night_loot(original,moment,stars); s:=loot->'state';
    if (loot->>'percent')::int<>pct or (loot->>'goldLost')::int<>floor(502*pct/100.0)
       or (loot->>'berriesLost')::int<>floor(731*pct/100.0) then raise exception 'Loot tier %: %',stars,loot; end if;
    gold:=(s->>'gold')::int; berries:=(s->>'berries')::int;
    for ix in 0..3 loop
      b:=s->'buildings'->ix; original_b:=original->'buildings'->ix;
      if b-'since'<>original_b-'since' then raise exception 'Changed producer identity'; end if;
      rate:=case b->>'type' when 'farm' then 0.0006 when 'home' then 0.00017 else 0.0008 end*(b->>'level')::int;
      capped:=least((b->>'level')::int*(case b->>'type' when 'home' then 90 else 360 end),greatest(0,(ms-(b->>'since')::bigint)*rate));
      produced:=floor(capped);
      if b->>'type'='farm' then berries:=berries+produced; else gold:=gold+produced; end if;
      if ix=1 and abs((capped-floor(capped))-0.97589)>0.00018 then raise exception 'Lost fractional production: %',capped; end if;
    end loop;
    if gold<>502-(loot->>'goldLost')::int or berries<>731-(loot->>'berriesLost')::int then raise exception 'Stock conservation'; end if;
    if s->'buildings'->3<>original->'buildings'->3 or (stars=0 and s<>original) then raise exception 'Changed intact producers'; end if;
  end loop;
end $loot$;

do $battle$
declare
  board jsonb:='[{"id":"keep","type":"keep","x":4,"y":4,"level":1}]';
  fixture jsonb; ground jsonb; air jsonb; mixed jsonb; shield jsonb; units jsonb;
  evt jsonb; pos int; x int; y int; typ text;
begin
  -- A complete square of walls and an outer ring of ice cover every approach.
  for x in 0..8 loop for y in 0..8 loop
    pos:=greatest(abs(x-4),abs(y-4));
    if pos in (2,3) then
      typ:=case when pos=2 then 'wall' else 'icetrap' end;
      board:=board||jsonb_build_array(jsonb_build_object('id',format('%s-%s-%s',typ,x,y),'type',typ,'x',x,'y',y,'level',1));
    end if;
  end loop; end loop;
  fixture:=jsonb_build_object('buildings',board,'dragons','[]'::jsonb);
  ground:=oplot.night_battle(fixture,1,'2030-09-02','qa-replay');
  air:=oplot.night_battle(fixture,10,'2030-09-02','qa-replay');
  mixed:=oplot.night_battle(fixture,9,'2030-09-02','qa-replay');
  if ground<>oplot.night_battle(fixture,1,'2030-09-02','qa-replay') then raise exception 'Replay is nondeterministic'; end if;
  if not exists(select from jsonb_array_elements(ground#>'{replay,events}') e where e->>'kind'='wall')
     or not exists(select from jsonb_array_elements(ground#>'{replay,events}') e where e->>'kind'='destroy' and e->>'target' like 'wall-%')
     or not exists(select from jsonb_array_elements(ground#>'{replay,events}') e where e->>'kind'='trap')
     or exists(select from jsonb_array_elements(air#>'{replay,events}') e where e->>'kind' in ('wall','trap'))
     then raise exception 'Ground breach or flight'; end if;
  if not exists(select from jsonb_array_elements(mixed#>'{replay,attackers}') u where u->>'level'='20' and u->>'flying'='false')
     or not exists(select from jsonb_array_elements(mixed#>'{replay,attackers}') u where u->>'level'='21' and u->>'flying'='true')
     then raise exception 'Level 20/21 boundary'; end if;
  units:='[{"id":"a","species":5,"level":21,"enchant":5},{"id":"b","species":5,"level":20,"enchant":0},
    {"id":"c","species":5,"level":7},{"id":"d","species":5,"level":10},{"id":"weak","species":0,"level":1},{"id":"fifth","species":5,"level":5}]';
  fixture:=jsonb_build_object('dragons',units,'buildings',
    '[{"id":"keep","type":"keep","x":4,"y":4,"level":1},
      {"id":"gold","type":"goldstore","x":3,"y":4,"level":2},{"id":"gold1","type":"goldstore","x":3,"y":5,"level":1},
      {"id":"food","type":"foodstore","x":5,"y":4,"level":5},{"id":"academy","type":"academy","x":5,"y":3,"level":1},
      {"id":"tower","type":"archer","x":4,"y":4,"level":4}]'::jsonb);
  shield:=oplot.night_battle(fixture,1,'2030-09-02','qa-replay');
  if jsonb_array_length(shield#>'{replay,defenders}')<>5 or exists(select from jsonb_array_elements(shield#>'{replay,defenders}') z where z->>'id'='weak')
     or not exists(select from jsonb_array_elements(shield#>'{replay,defenders}') z where z->>'id'='a' and z->>'flying'='true' and z->>'enchant'='5')
     or not exists(select from jsonb_array_elements(shield#>'{replay,defenders}') z where z->>'id'='b' and z->>'flying'='false')
     or not exists(select from jsonb_array_elements(shield#>'{replay,buildings}') z where z->>'id'='gold' and (z->>'hp')::int>70)
     or not exists(select from jsonb_array_elements(shield#>'{replay,buildings}') z where z->>'id'='academy' and (z->>'hp')::int=84)
     or not exists(select from jsonb_array_elements(shield#>'{replay,events}') z where z->>'kind'='tower')
     or not exists(select from jsonb_array_elements(shield#>'{replay,events}') z where z->>'kind'='guard')
     or shield->>'stars'<>'0' then raise exception 'Defender/tower/storage fixture: %',shield; end if;
  if oplot.guard_power('{"species":5,"level":21,"enchant":5}')<=oplot.guard_power('{"species":5,"level":21,"enchant":0}')
     then raise exception 'Enchantment power'; end if;
  for evt in select value from jsonb_array_elements(ground#>'{replay,events}') loop
    if not (evt ?& array['t','kind','from','to','id','target','text','amount']) then raise exception 'Incomplete replay event'; end if;
  end loop;
end $battle$;

-- A rematch uses the recorded attacker roster, even across balance versions.
do $garrison$
declare
  roster jsonb:='[{"id":"ordinary","species":0,"level":1},{"id":"rare","species":5,"level":10},
    {"id":"tie-b","species":0,"level":12},{"id":"tie-a","species":0,"level":12},
    {"id":"specialist","species":0,"level":12,"enchant":3,"specialty":"area"},{"id":"elder","species":13,"level":24}]';
  island jsonb; opening jsonb; replay jsonb; v int; w int; prev_hp int; hp int; ids text[];
begin
  for v in 1..2 loop
    island:=jsonb_build_object('layoutVersion',v,'buildings','[{"id":"k","type":"keep","level":5,"x":4,"y":4}]'::jsonb,'dragons',roster);
    prev_hp:=0;
    foreach w in array array[1,3,7,14,30] loop
      opening:=oplot.night_battle(island,w,'2030-05-20','qa-guard')->'replay';
      select array_agg(d->>'id' order by n) into ids from jsonb_array_elements(opening->'defenders') with ordinality e(d,n);
      if ids<>array['elder','specialist','rare','tie-a','tie-b'] then raise exception 'Incorrect guard order: %',ids; end if;
      select sum((a->>'hp')::int) into hp from jsonb_array_elements(opening->'attackers') a;
      if hp<=prev_hp or jsonb_array_length(opening->'attackers')<>least(10,3+w/2) then raise exception 'Wave progression at %',w;end if;
      prev_hp:=hp;
    end loop;
    opening:=jsonb_set(opening,'{attackers}',jsonb_build_array((opening->'attackers'->0)||'{"hp":11,"damage":2,"level":2,"flying":false}'));
    replay:=oplot.simulate_raid(island,30,'2030-05-20','qa-guard',opening)->'replay';
    if replay->'attackers'<>opening->'attackers' then raise exception 'Practice changed the historical squad'; end if;
  end loop;
end $garrison$;

do $expanded_grid$
declare
  board jsonb; state jsonb; player text; replay jsonb; extent record; growth int; sample jsonb;
  test_day date:='2030-08-06'; legacy jsonb; reports jsonb; code text:=upper(gen_random_uuid()::text);
  owner_id text:='qa-grid-replay-'||gen_random_uuid(); dir int; kx int; ky int; last_x int; last_y int;
begin
  for growth in 0..12 loop
    sample:=jsonb_build_object('xp',growth*growth*35);
    replay:=oplot.night_battle(sample,1,test_day,'empty')->'replay';
    if oplot.raid_grid_growth(sample)<>growth or (replay->>'gridWidth')::int<>10+(growth+1)/2 or
       (replay->>'gridHeight')::int<>10+growth/2 or replay->'gridSize'<>replay->'gridWidth' or
       (growth>0 and oplot.raid_grid_growth(jsonb_build_object('xp',growth*growth*35-1))<>growth-1)
       then raise exception 'Expansion at level %',growth+1; end if;
  end loop;
  if oplot.raid_grid_growth('{}')<>0 or oplot.raid_grid_growth('{"xp":-1}')<>0 or
     oplot.raid_grid_growth('{"xp":1000000000000000000000000000000}')<>12 then raise exception 'XP bounds'; end if;
  -- Test both orientations of the new edge and all 256 slots. Objects beyond
  -- the original 100 cells include the stronghold and the gate to its east.
  for extent in select * from (values (35,11,10),(315,12,11),(4235,16,15),(5040,16,16)) u(xp,width,height) loop
    last_x:=extent.width-1; last_y:=extent.height-1; kx:=last_x-3; ky:=last_y-2;
    select jsonb_agg(jsonb_build_object('id','tile-'||x||'-'||y,'type',
      case when (x,y)=(kx,ky) then 'keep' else 'wall' end,'level',1,'x',x,'y',y) order by y,x)
      into board from generate_series(0,last_x) x cross join generate_series(0,last_y) y;
    state:=jsonb_build_object('xp',extent.xp,'buildings',board,'dragons','[{"id":"guard","species":0,"level":1}]'::jsonb);
    for dir in 0..3 loop
      select 'edge-'||n into player from generate_series(1,200) n
        where mod(abs(hashtext('edge-'||n||'/'||test_day::text)::bigint),997)%4=dir limit 1;
      if player is null then raise exception 'Missing test seed'; end if;
      replay:=oplot.night_battle(state,5,test_day,player)->'replay';
      if (replay->>'gridWidth')::int<>extent.width or (replay->>'gridHeight')::int<>extent.height
         or replay->'gridSize'<>replay->'gridWidth' or jsonb_array_length(replay->'buildings')<>extent.width*extent.height
         or (select count(distinct (v->>'x',v->>'y')) from jsonb_array_elements(replay->'buildings') v)<>extent.width*extent.height
         or (replay#>>'{defenders,0,x}')::int<>kx or (replay#>>'{defenders,0,y}')::int<>ky
         then raise exception 'Expanded placement % by %',extent.width,extent.height; end if;
      if exists(select from jsonb_array_elements(replay->'attackers') u where
         (case when dir%2=0 then u->>'x' else u->>'y' end)::int<>(case dir when 2 then last_x when 3 then last_y else 0 end))
         then raise exception 'Spawn on edge %',dir; end if;
      if exists(select from jsonb_array_elements(replay->'events') e cross join lateral (values(e->'from'),(e->'to')) pt(v)
        where (pt.v->>0)::int not between 0 and last_x or (pt.v->>1)::int not between 0 and last_y)
        then raise exception 'Actor left rectangle'; end if;
      if dir=2 and (not exists(select from jsonb_array_elements(replay->'events') e
         where e->>'kind'='wall' and e->>'target'='tile-'||(last_x-1)||'-'||ky) or
         not exists(select from jsonb_array_elements(replay->'events') e where e->>'kind'='move' and e->>'id'='a1'
           and e->'from'=jsonb_build_array(last_x,ky) and e->'to'=jsonb_build_array(last_x-1,ky)))
         then raise exception 'No breach or movement on added land'; end if;
    end loop;
  end loop;
  -- Archived records predate the width field. The read endpoint returns their
  -- original replay unchanged; the player uses a 10-tile fallback.
  insert into public.ph_students(uid,code) values(owner_id,code);
  legacy:='{"v":1,"buildings":[{"id":"keep","type":"keep","x":4,"y":4}],"attackers":[],"defenders":[],"events":[],"duration":1}';
  insert into oplot.raid_reports(uid,day,summary,replay) values(owner_id,test_day,jsonb_build_object('day',test_day),legacy);
  reports:=public.ph_oplot_raids(code);
  if reports#>'{0,replay}'<>legacy or (reports#>'{0,replay}') ?| array['gridSize','gridWidth','gridHeight'] then raise exception 'Legacy replay rewritten'; end if;
end $expanded_grid$;

do $islands$
declare
  uid1 text:='qa-night-'||gen_random_uuid(); uid2 text:='qa-night-'||gen_random_uuid();
  code1 text:=upper(gen_random_uuid()::text); code2 text:=upper(gen_random_uuid()::text);
  path1 text:='data/users/'||uid1||'/oplot/saves/main'; path2 text:='data/users/'||uid2||'/oplot/saves/main';
  uid3 text:='qa-night-'||gen_random_uuid(); code3 text:=upper(gen_random_uuid()::text);
  path3 text:='data/users/'||uid3||'/oplot/saves/main';
  island jsonb; before_raid jsonb; after_raid jsonb; after_save jsonb; cas jsonb; reports jsonb; first_report jsonb; denied boolean:=false;
  first_day date; k int; wallet jsonb;
begin
  insert into public.ph_students(uid,code) values(uid1,code1),(uid2,code2),(uid3,code3);
  if exists(select from oplot.raid_islands where uid in (uid1,uid2)) or public.ph_oplot_load(code1,path1) is not null or public.ph_oplot_raids(code1)<>'[]' or
     oplot.run_night_raids(now()+interval '10 days',uid2)<>0 then raise exception 'Local-only island was attacked'; end if;
  island:='{"gold":100,"berries":100,"diamonds":75,"purchases":{"abc":true},"questFlags":["hatch"],
    "dragons":[],"egg":{"species":5},"buildings":[{"id":"keep","type":"keep","x":4,"y":4,"level":1}]}';
  before_raid:=jsonb_build_object('rev',1,'op','initial','state',island,'version',1);
  cas:=public.ph_oplot_store(code1,path1,before_raid,null,null);
  if cas->>'ok'<>'true' then raise exception 'First CAS save'; end if;
  select next_day into first_day from oplot.raid_islands where uid=uid1;
  if first_day is distinct from oplot.first_raid(now()) then raise exception 'Registration'; end if;
  wallet:=public.ph_oplot_wallet(code1);
  if oplot.run_night_raids(oplot.raid_at(first_day)-interval '1 microsecond',uid1)<>0 then raise exception 'Early raid'; end if;
  if oplot.run_night_raids(oplot.raid_at(first_day),uid1)<>1 then raise exception 'Missing punctual raid'; end if;
  select data into after_raid from public.ph_docs where path=path1;
  first_report:=public.ph_oplot_raids(code1)->0;
  if first_report->>'day'<>first_day::text or first_report->>'stars'<>'3' or first_report->>'percent'<>'80' or
     first_report->>'goldLost'<>'80' or after_raid#>>'{state,berries}'<>'20' or after_raid#>>'{state,gold}'<>'20' or
     first_report-'replay'<>after_raid#>'{state,lastRaid}' or after_raid->>'rev'<>'2' or after_raid->>'op' not like 'night:%' then
    raise exception 'Offline replay/snapshot: %',after_raid; end if;
  if (after_raid->'state')-array['lastRaid','gold','berries']<>island-array['gold','berries'] or after_raid->>'version'<>'1' or
     wallet<>public.ph_oplot_wallet(code1) then raise exception 'Raid changed player property'; end if;
  if oplot.run_night_raids(oplot.raid_at(first_day)+interval '4 hour',uid1)<>0 or first_report<>public.ph_oplot_raids(code1)->0 then
    raise exception 'Duplicate processing'; end if;
  cas:=public.ph_set_if(code1,path1,before_raid||'{"rev":2,"op":"stale-phone"}',1,'initial');
  if cas->>'ok'<>'false' or cas->'cur'<>after_raid then raise exception 'Stale CAS won against raid'; end if;
  after_save:=jsonb_set(after_raid||'{"rev":3,"op":"rebased"}','{state,marker}','true');
  cas:=public.ph_set_if(code1,path1,after_save,2,after_raid->>'op');
  if cas->>'ok'<>'true' then raise exception 'CAS after rebase'; end if;
  if public.ph_oplot_raids(code2)<>'[]' then raise exception 'Leaked report'; end if;
  perform public.ph_oplot_store(code2,path2,before_raid,null,null);
  if public.ph_oplot_raids(code2)<>'[]' or (select data from public.ph_docs where path=path2)<>before_raid then raise exception 'Account isolation'; end if;
  -- The scheduler missed a night. Client writes cross the very same save lock
  -- and charge the old stored balance before the purchase can enter game state.
  update oplot.raid_islands set next_day=first_day-1 where uid=uid2;
  cas:=public.ph_oplot_store(code2,path2,jsonb_set(before_raid||'{"rev":2,"op":"purchase"}','{state,gold}','500'),1,'initial');
  if cas->>'ok'<>'false' or cas#>>'{cur,state,gold}'<>'20' or public.ph_oplot_raids(code2)#>>'{0,goldLost}'<>'80'
     then raise exception 'Delayed raid used a post-night purchase'; end if;
  after_save:=jsonb_set((cas->'cur')||'{"rev":3,"op":"purchase-again"}','{state,gold}','420');
  cas:=public.ph_oplot_store(code2,path2,after_save,2,cas#>>'{cur,op}');
  if cas->>'ok'<>'true' or (select data#>>'{state,gold}' from public.ph_docs where path=path2)<>'420'
     then raise exception 'Rebased purchase disappeared'; end if;
  begin perform public.ph_oplot_store(code1,path2,after_save,2,'initial');
    exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Cross-profile save'; end if;
  denied:=false;
  -- The third island wakes up after six consecutive missed nights.
  perform public.ph_oplot_store(code3,path3,before_raid,null,null);
  update oplot.raid_islands set next_day=first_day-6 where uid=uid3;
  after_save:=public.ph_oplot_load(code3,path3);
  if after_save->>'_raidPending' is distinct from 'true' or after_save#>>'{state,lastRaid,wave}'<>'4' then
    raise exception 'Long-outage load pagination'; end if;
  after_save:=public.ph_oplot_load(code3,path3);
  if after_save ? '_raidPending' or after_save#>>'{state,lastRaid,day}'<>(first_day-1)::text
     or after_save<>public.ph_oplot_load(code3,path3) then raise exception 'Morning login is out of date'; end if;
  begin perform public.ph_oplot_load(code2,path1); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Cross-profile load'; end if;
  denied:=false;

  -- After an outage the oldest missing night is processed first, then each later
  -- night is recorded exactly once; reports are returned newest first, up to ten.
  for k in 1..11 loop
    if oplot.run_night_raids(oplot.raid_at(first_day+11)+interval '7 hours',uid1)<>1 then raise exception 'Missed day %',k; end if;
  end loop;
  if oplot.run_night_raids(oplot.raid_at(first_day+11)+interval '8 hours',uid1)<>0 then raise exception 'Second run'; end if;
  reports:=public.ph_oplot_raids(code1);
  if jsonb_array_length(reports)<>10 or reports->0->>'wave'<>'12' or reports->9->>'wave'<>'3' or
     (reports#>>'{0,replay,attackers,0,damage}')::int<=(reports#>>'{1,replay,attackers,0,damage}')::int or
     (select count(*) from oplot.raid_reports where uid=uid1)<>12 or
     first_report<>(select summary||jsonb_build_object('replay',replay) from oplot.raid_reports where uid=uid1 and day=first_day)
     then raise exception 'Wave sequence or report retention'; end if;
  if (select data#>>'{state,marker}' from public.ph_docs where path=path1)<>'true' then raise exception 'New client save overwritten'; end if;
  update public.ph_docs set deleted=true where path=path1;
  if exists(select from oplot.raid_islands where uid=uid1) then raise exception 'Deleted island still scheduled'; end if;
  begin perform public.ph_oplot_raids(''); exception when insufficient_privilege then denied:=true; end;
  if not denied or has_schema_privilege('anon','oplot','usage') or has_table_privilege('authenticated','oplot.raid_reports','update')
     or has_function_privilege('anon','oplot.run_night_raids(timestamptz,text)','execute') then raise exception 'Private raid access'; end if;
  if not exists(select from cron.job where jobname='oplot-night-raids' and schedule='* * * * *' and command='select oplot.run_night_raids()') then
    raise exception 'Cron schedule'; end if;
end $islands$;

-- The local integration runner provisions a synthetic platform teacher in a
-- disposable database. Credentials and teacher mappings are never edited here.
do $teacher$
declare
  test_code text:=nullif(current_setting('oplot.synthetic_teacher_code',true),'');
  who text; path text; other_path text:='data/users/qa-not-this-teacher/oplot/saves/main';
  first_day date; doc jsonb; answer jsonb; denied boolean:=false;
begin
  if test_code is null then return; end if;
  who:=oplot.island_owner(test_code);
  if who not like 'qa-local-teacher-%' or exists(select from public.ph_students where uid=who) or
     (select lv from public._ph_who(test_code))<>4 then raise exception 'Expected a synthetic teacher-only uid'; end if;
  path:='data/users/'||who||'/oplot/saves/main';
  doc:='{"rev":1,"op":"teacher","state":{"gold":50,"berries":10,"buildings":[{"id":"k","type":"keep","x":4,"y":4,"level":1}],"dragons":[]}}';
  if public.ph_oplot_load(test_code,path) is not null or public.ph_oplot_raids(test_code)<>'[]' then raise exception 'Fixture already used'; end if;
  answer:=public.ph_oplot_store(test_code,path,doc,null,null);
  if answer->>'ok'<>'true' or public.ph_oplot_load(test_code,path)<>doc then raise exception 'Own teacher save'; end if;
  select next_day into first_day from oplot.raid_islands where uid=who;
  if first_day is null or oplot.run_night_raids(oplot.raid_at(first_day),who)<>1 or
     public.ph_oplot_raids(test_code)#>>'{0,goldLost}'<>'40' or public.ph_oplot_load(test_code,path)#>>'{state,gold}'<>'10'
     then raise exception 'Own teacher report'; end if;
  begin perform public.ph_oplot_load(test_code,other_path); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Teacher read another island'; end if;
  denied:=false;
  begin perform public.ph_oplot_store(test_code,other_path,doc,null,null); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Teacher wrote another island'; end if;
  denied:=false;
  begin perform public.ph_oplot_wallet(test_code); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Teacher-only uid gained access to student diamond awards'; end if;
end $teacher$;
rollback;
