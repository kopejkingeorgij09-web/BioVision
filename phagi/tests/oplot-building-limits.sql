-- All accounts and awards in this test are transaction-local.
begin;
do $$
declare k text; required int; initial jsonb; kept jsonb; expected bigint;
begin
  for k,required in select * from (values ('mortar',10),('skybow',12),('tempest',14),('solar',16)) as unlocks(kind,level) loop
    initial:=jsonb_build_object('xp',35000,'buildings',jsonb_build_array(
      jsonb_build_object('id','k','type','keep','level',required-1),jsonb_build_object('id','a','type',k,'level',16)));
    if not oplot.excess_buildings(initial) then raise exception 'Early unlock: %',k;end if;
    initial:=jsonb_set(initial,'{buildings,0,level}',to_jsonb(required));
    if oplot.excess_buildings(initial) then raise exception 'Valid tower rejected: %',k;end if;
    initial:=jsonb_set(initial,'{buildings}',(initial->'buildings')||jsonb_build_array(jsonb_build_object('id','b','type',k,'level',10)));
    kept:=oplot.settle_buildings(initial,100000);
    expected:=oplot.building_refund(k,10,1);
    if expected is null or kept#>>'{limitReceipt,refundGold}'<>expected::text or kept#>>'{buildings,1,id}'<>'a' then raise exception 'High-tier refund: %',k;end if;
  end loop;
end $$;
do $$
declare
  t bigint:=1893500000000; profile int; k text; s jsonb; fixed jsonb; r jsonb; result jsonb; newest jsonb; stored jsonb;
  who text:='quota-qa-'||gen_random_uuid(); code text:=upper(gen_random_uuid()::text); path text:='data/users/'||who||'/oplot/saves/main';
  buildings jsonb:='[{"id":"keep","type":"keep","level":1,"x":2,"y":2},
    {"id":"m0","type":"mine","level":1,"stowed":true,"x":null,"y":null,"pausedStock":17},
    {"id":"m1","type":"mine","level":3,"x":8,"y":2},{"id":"m2","type":"mine","level":3,"stowed":true,"x":null,"y":null,"pausedStock":60},
    {"id":"m3","type":"mine","level":3,"x":12,"y":2,"since":1893499990000},
    {"id":"f0","type":"farm","level":1,"stowed":true,"x":null,"y":null,"pausedStock":7},
    {"id":"f1","type":"farm","level":2,"x":2,"y":8},{"id":"ac","type":"academy","level":1,"x":8,"y":8}]';
begin
  for profile in 1..14 loop
    if oplot.building_cap('wall',profile)<>2*(oplot.raid_axis(10+least(12,profile-1)/2)+oplot.raid_axis(10+(least(12,profile-1)+1)/2))-4+4*(least(profile,8)-1)
      or oplot.building_cap('mine',profile)<>1+(profile>=4)::int+(profile>=7)::int
      or oplot.building_cap('foodstore',profile)<>1+(profile>=6)::int
      or oplot.building_cap('spire',profile)<>(case when profile=1 then 0 else 1+least(profile,8) end)
      or oplot.building_cap('academy',profile)<>(profile>=7)::int
      or oplot.building_cap('icetrap',profile)<>1+2*least(profile,8) then raise exception 'Slot schedule mismatch %',profile;end if;
  end loop;
  -- Exercise surplus removal for every building family, including the final
  -- wall of a long line, housing income and the two separate storage types.
  foreach k in array array['keep','mine','farm','home','den','goldstore','foodstore','academy','archer','cannon','spire','wall','firetrap','icetrap'] loop
    select jsonb_build_object('xp',0,'gold',400,'berries',290,'dragons',jsonb_build_array(jsonb_build_object('id','veteran','level',21)),
      'buildings',jsonb_agg(jsonb_build_object('id','b'||n,'type',k,'level',2,'since',t-50000) order by n))
      into stored from generate_series(0,oplot.building_cap(k,1)) n;
    fixed:=oplot.settle_buildings(stored,t);r:=fixed->'limitReceipt';
    if jsonb_array_length(fixed->'buildings')<>oplot.building_cap(k,1) or r#>>array['removed',k]<>'1'
      or r->'retiredIds'<>jsonb_build_array('b'||oplot.building_cap(k,1)) or fixed->'dragons'<>stored->'dragons'
      or (r->>'refundGold')::int<>oplot.building_refund(k,2,oplot.building_cap(k,1))
      or (r->>'productionGold')::int<>(case k when 'mine' then 80 when 'home' then 17 else 0 end)
      or (r->>'productionBerries')::int<>(case k when 'farm' then 60 else 0 end) then raise exception 'Settlement for %',k;end if;
  end loop;
  s:=jsonb_build_object('version',1,'layoutVersion',2,'xp',0,'gold',448,'berries',298,'buildings',buildings,
    'dragons','[]'::jsonb,'pending',jsonb_build_object('item','gold','op','fixture'),'deliveries',jsonb_build_array('prior'));
  fixed:=oplot.settle_buildings(s,t);r:=fixed->'limitReceipt';
  if r->'retiredIds'<>'["m0","m2","m3","f0","ac"]' or r->'removed'<>'{"mine":3,"farm":1,"academy":1}'
    or r->>'refundGold'<>'1202' or r->>'productionGold'<>'101' or r->>'productionBerries'<>'7'
    or fixed->>'gold'<>'1751' or fixed->>'berries'<>'305'
    or fixed->'buildings'<>jsonb_build_array(buildings->0,buildings->2,buildings->6)
    or s-'buildings'-'gold'-'berries'<>fixed-'buildings'-'gold'-'berries'-'limitReceipt'
    or oplot.settle_buildings(fixed,t+100000)<>fixed then raise exception 'Settlement disbursement or ordering %',r;end if;
  if oplot.profile_xp('{"dragons":[{"level":4}],"buildings":[{"level":4}],"quest":1,"campaign":{"1":2}}')<>151 then raise exception 'Legacy XP';end if;
  if oplot.settle_buildings((s-'xp'-'layoutVersion')||'{"quest":9,"campaign":{}}',t)->>'limitLegacyGrid' is distinct from 'true'
    or fixed ? 'limitLegacyGrid' then raise exception 'Pre-XP layout extent marker';end if;
  if oplot.profile_level('{"xp":314}')<>3 or oplot.profile_level('{"xp":315}')<>4 then raise exception 'Exact XP boundary';end if;
  insert into public.ph_students(uid,code) values(who,code);
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',1,'op','guest','state',s),null,null);
  if result->>'limitAdjusted'<>'true' or result->>'ok'<>'false' then raise exception 'First import was not corrected';end if;
  newest:=result->'cur';r:=newest#>'{state,limitReceipt}';
  if newest->>'rev'<>'1' or newest->>'op'='guest' or oplot.excess_buildings(newest->'state') then raise exception 'Invalid normalized head';end if;
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',1,'op','guest','state',s),null,null);
  if result->'cur'<>newest or (select receipt from oplot.building_settlements where uid=who)<>r then raise exception 'Lost ACK awarded twice';end if;
  -- Even once a new profile level has room, an already reimbursed ID cannot return.
  fixed:=jsonb_set(newest->'state','{xp}','5040'); fixed:=jsonb_set(fixed,'{buildings}',(fixed->'buildings')||jsonb_build_array(buildings->4));
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',2,'op','old-phone','state',fixed),1,newest->>'op');
  if result->'cur'<>newest or result->>'limitAdjusted'<>'true' then raise exception 'Retired ID returned at higher XP';end if;
  fixed:=newest->'state';fixed:=jsonb_set(fixed,'{gold}',to_jsonb((fixed->>'gold')::int-50));
  result:=public.ph_oplot_store(code,path,jsonb_build_object('rev',2,'op','spend','state',fixed),1,newest->>'op');
  if result->>'ok'<>'true' then raise exception 'Could not spend an over-cap wallet';end if;
  update oplot.raid_islands set next_day=oplot.first_raid(now()) where uid=who;
  if oplot.run_night_raids(now()+interval '2 days',who)<>1 then raise exception 'Settled island could not finish its next raid';end if;
  select data into stored from public.ph_docs where ph_docs.path='data/users/'||who||'/oplot/saves/main';
  if stored#>'{state,limitReceipt}'<>r or stored->>'rev'<>'3' or stored#>'{state,pending}'<>s->'pending'
    then raise exception 'Authoritative night dropped the receipt or payment';end if;
  -- A guest receipt belongs to its issuing save. An unconfirmed import and a
  -- failed revision both leave the ledger empty for this newly registered profile.
  who:='quota-import-'||gen_random_uuid();code:=upper(gen_random_uuid()::text);path:='data/users/'||who||'/oplot/saves/main';
  insert into public.ph_students(uid,code) values(who,code);
  begin
    perform public.ph_oplot_store(code,path,jsonb_build_object('rev',1,'op','wrong-origin','state',newest->'state'),null,null);
    raise exception 'Accepted a receipt without its authoritative journal';
  exception when invalid_parameter_value then null;end;
  begin
    perform public.ph_set_if(code,path,jsonb_build_object('rev',1,'op','generic-import','state',newest->'state'),null,null);
    raise exception 'Generic first write adopted another journal';
  exception when invalid_parameter_value then null;end;
  begin
    perform public.ph_oplot_store(code,path,jsonb_build_object('rev',8,'op','wrong-rev','state',s),null,null);
    raise exception 'Committed an invalid revision';
  exception when invalid_parameter_value then null;end;
  if exists(select from oplot.building_settlements where uid=who) or public.ph_oplot_load(code,path) is not null then
    raise exception 'Unconfirmed imports left a journal entry or save';end if;
end $$;
rollback;
