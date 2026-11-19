-- One settlement per island, including a first import of an offline island.
-- Keep the receipts outside the freely edited save so a restored client cannot
-- discard its payout record or revive an already reimbursed building ID.
create table oplot.building_settlements (
  uid text primary key,
  receipt jsonb not null
);
alter table oplot.building_settlements enable row level security;
revoke all on table oplot.building_settlements from public, anon, authenticated;

create function oplot.profile_xp(s jsonb) returns numeric language sql immutable set search_path='' as $$
  select greatest(0,coalesce(oplot.num(s->>'xp'),
    (select coalesce(sum(10*(oplot.raid_int(d->>'level',1,100)-1)),0) from jsonb_array_elements(oplot.arr(s->'dragons')) d)
    +(select coalesce(sum(12*(oplot.raid_int(b->>'level',1,9)-1)),0) from jsonb_array_elements(oplot.arr(s->'buildings')) b)
    +35*coalesce(oplot.num(s->>'quest'),0)
    +(select 25*coalesce(sum(oplot.num(val)),0) from jsonb_each_text(case when jsonb_typeof(s->'campaign')='object' then s->'campaign' else '{}' end) e(k,val))))
$$;

create function oplot.building_cap(kind text,profile integer) returns int language sql immutable set search_path='' as $$
  select case
    when kind in ('keep','den') then 1 when kind='academy' then (profile>=7)::int
    when kind in ('mine','farm') then 1+(profile>=4)::int+(profile>=7)::int
    when kind in ('goldstore','foodstore') then 1+(profile>=6)::int
    when kind='spire' and profile<2 then 0
    when kind in ('home','archer','cannon','spire') then 1+least(profile,8)
    when kind in ('firetrap','icetrap') then 1+2*least(profile,8)
    when kind='wall' then 2*(oplot.raid_axis(10+least(profile,13)/2)+oplot.raid_axis(10+(least(profile,13)-1)/2))-4+4*(least(profile,8)-1)
  end
$$;

create function oplot.building_refund(kind text,level int,copy_no int) returns bigint language sql immutable set search_path='' as $$
  with price as (select case kind when 'keep' then 0 when 'mine' then 65 when 'farm' then 60 when 'home' then 80
    when 'den' then 85 when 'goldstore' then 90 when 'foodstore' then 75 when 'academy' then 220 when 'archer' then 70
    when 'cannon' then 95 when 'spire' then 130 when 'wall' then 20 when 'firetrap' then 40 when 'icetrap' then 35 end as base,
    kind in ('mine','farm','goldstore','foodstore') as industry)
  select (case when kind in ('mine','farm') and copy_no=0 then 0 when industry then base*(1+2*copy_no) else base end
    +coalesce((select sum(round(case when kind='keep' then 175*1.65^n
      when industry then base*(.65+.24*n+.018*n*n) else (base*.72+12)*(n+1) end))
      from generate_series(0,level-2) n),0))::bigint from price
$$;

create function oplot.profile_level(s jsonb) returns int language sql immutable set search_path='' as $$
  select least(2147483647,1+floor(sqrt(oplot.profile_xp(s)/35)))::int
$$;

create function oplot.excess_buildings(s jsonb) returns boolean language sql immutable set search_path='' as $$
  select exists(select from jsonb_array_elements(oplot.arr(s->'buildings')) b
    group by b->>'type' having count(*)>oplot.building_cap(b->>'type',oplot.profile_level(s)))
$$;

-- Retention and pricing use separate ordering: levels and active plots decide
-- what stays, the original ordinal of each type determines its purchase price.
create function oplot.settle_buildings(s jsonb,at_ms bigint) returns jsonb language plpgsql immutable set search_path='' as $$
declare xp numeric:=oplot.profile_xp(s); profile int:=oplot.profile_level(s); kept jsonb; receipt jsonb;
begin
  if not oplot.excess_buildings(s) then return s; end if;
  with ranked as (
    select b,ord,k,oplot.raid_int(b->>'level',1,9) as lvl,
      row_number() over(partition by k order by oplot.raid_int(b->>'level',1,9) desc,(b->'stowed'='true'::jsonb) is true,ord) as priority,
      (row_number() over(partition by k order by ord)-1)::int as copy_no
    from jsonb_array_elements(s->'buildings') with ordinality e(b,ord) cross join lateral (select b->>'type' as k) kind
  ), marked as (
    select *,coalesce(priority>oplot.building_cap(k,profile),false) as extra from ranked
  ), retired as (
    select *,oplot.building_refund(k,lvl,copy_no) as refund,
      least(90*lvl,greatest(0,case when b->'stowed'='true'::jsonb then floor(coalesce(oplot.num(b->>'pausedStock'),0))
        else floor((at_ms-coalesce(oplot.num(b->>'since'),at_ms))*lvl*
          (case k when 'mine' then .0008 when 'farm' then .0006 when 'home' then .00017 else 0 end)) end)) as stock
    from marked where extra
  )
  select (select jsonb_agg(b order by ord) from marked where not extra),
    jsonb_build_object('version',1,'at',at_ms,'profileLevel',profile,
      'removed',(select jsonb_object_agg(k,n) from (select k,count(*) n from retired group by k) counts),
      'refundGold',coalesce(sum(refund),0),'productionGold',coalesce(sum(stock) filter(where k in ('mine','home')),0),
      'productionBerries',coalesce(sum(stock) filter(where k='farm'),0),'retiredIds',jsonb_agg(b->'id' order by ord))
    into kept,receipt from retired;
  -- The pre-XP single-cell client used a fixed 10x10 source layout, even if
  -- its reconstructed experience now unlocks a larger island.
  if not (s ? 'xp') and coalesce(s->>'layoutVersion','1')='1' then s:=s||'{"limitLegacyGrid":true}'::jsonb;end if;
  return s||jsonb_build_object('xp',xp,'buildings',coalesce(kept,'[]'::jsonb),'limitReceipt',receipt,
    'gold',coalesce(oplot.num(s->>'gold'),0)+(receipt->>'refundGold')::numeric+(receipt->>'productionGold')::numeric,
    'berries',coalesce(oplot.num(s->>'berries'),0)+(receipt->>'productionBerries')::numeric);
end $$;

create function oplot.returns_retired(s jsonb,r jsonb) returns boolean language sql immutable set search_path='' as $$
  select exists(select from jsonb_array_elements(oplot.arr(s->'buildings')) b
    join jsonb_array_elements_text(oplot.arr(r->'retiredIds')) dead(id) on b->>'id'=dead.id)
$$;

-- This covers the generic document RPCs and the scheduler's direct write too.
-- All changes for a given path serialize on the same ph_docs row as its CAS.
create function oplot.guard_building_limits() returns trigger language plpgsql security definer set search_path='' as $$
declare who text:=split_part(new.path,'/',3); s jsonb:=new.data->'state'; r jsonb;
begin
  if oplot.excess_buildings(s) then raise exception 'Число построек превышает лимит профиля' using errcode='22023';end if;
  select receipt into r from oplot.building_settlements where uid=who;
  if s->'limitReceipt' is distinct from r then
    raise exception 'Обновите облачное состояние острова' using errcode='22023';
  end if;
  if r is not null and oplot.returns_retired(s,r) then raise exception 'Это здание уже возмещено' using errcode='22023';end if;
  return new;
end $$;
-- Install the write guard in the same transaction as the cutover. Finish any
-- already due raid against its historical lineup before deciding what is owed.
-- New CAS tokens make pre-cutover writes conflict; unaffected heads keep their token.
do $$
declare d record; doc jsonb; s jsonb; at_time timestamptz:=statement_timestamp(); instant bigint:=floor(extract(epoch from at_time)*1000);
begin
  lock table public.ph_docs in share row exclusive mode;
  for d in select path from public.ph_docs where not deleted and path ~ '^data/users/[^/]+/oplot/saves/main$'
    and oplot.excess_buildings(data->'state') order by path for update loop
    while oplot.run_night_raids(at_time,split_part(d.path,'/',3))>0 loop
      null;
    end loop;
    select data into strict doc from public.ph_docs where path=d.path;
    s:=oplot.settle_buildings(doc->'state',instant);
    insert into oplot.building_settlements values(split_part(d.path,'/',3),s->'limitReceipt');
    update public.ph_docs set data=doc||jsonb_build_object('state',s,'rev',coalesce((doc->>'rev')::int,0)+1,
      'op','limits:'||gen_random_uuid()),updated_at=clock_timestamp() where path=d.path;
  end loop;
  create trigger oplot_check_building_limits before insert or update of data,deleted on public.ph_docs
    for each row when (not new.deleted and new.path ~ '^data/users/[^/]+/oplot/saves/main$') execute function oplot.guard_building_limits();
end $$;

create or replace function public.ph_oplot_store(p_code text,p_path text,p_data jsonb,p_rev int,p_op text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare who text:=oplot.island_owner(p_code); cur jsonb; proposed jsonb:=p_data->'state'; receipt jsonb;
  settled boolean; answer jsonb; corrected boolean:=false;
begin
  settled:=oplot.settle_island(who,p_path);
  select data into cur from public.ph_docs where path=p_path and not deleted;
  select j.receipt into receipt from oplot.building_settlements j where j.uid=who;
  if not settled or (cur#>>'{state,layoutVersion}'='2' and p_data#>>'{state,layoutVersion}' is distinct from '2') then
    return jsonb_build_object('ok',false,'cur',cur)||case when receipt is not null and proposed->'limitReceipt' is distinct from receipt
      then '{"limitAdjusted":true}'::jsonb else '{}'::jsonb end;
  end if;
  if receipt is not null and (proposed->'limitReceipt' is distinct from receipt or oplot.returns_retired(proposed,receipt))
    or cur is not null and (oplot.excess_buildings(proposed) or proposed->'limitReceipt' is distinct from cur#>'{state,limitReceipt}') then
    return jsonb_build_object('ok',false,'cur',cur,'limitAdjusted',true);
  end if;
  if cur is null and receipt is null and proposed ? 'limitReceipt' then
    raise exception 'Облачный отчёт создаётся из исходного острова' using errcode='22023';
  end if;
  if cur is null and receipt is null and p_rev is null and oplot.excess_buildings(proposed) then
    -- Reserve and lock the save row before issuing anything. ph_set_if uses this
    -- same tombstone convention. A concurrent initial write may have won meanwhile.
    insert into public.ph_docs(path,parent,id,data,deleted,updated_at)
      values(p_path,'data/users/'||who||'/oplot/saves','main',null,true,clock_timestamp()) on conflict(path) do nothing;
    select case when deleted then null else data end into cur from public.ph_docs where path=p_path for update;
    if cur is not null then
      return jsonb_build_object('ok',false,'cur',cur)||case when cur#>'{state,limitReceipt}' is not null
        then '{"limitAdjusted":true}'::jsonb else '{}'::jsonb end;
    end if;
    proposed:=oplot.settle_buildings(proposed,floor(extract(epoch from clock_timestamp())*1000)::bigint);
    insert into oplot.building_settlements values(who,proposed->'limitReceipt');
    p_data:=p_data||jsonb_build_object('state',proposed,'op','limits:'||gen_random_uuid());corrected:=true;
  end if;
  answer:=public.ph_set_if(p_code,p_path,p_data,p_rev,p_op);
  if corrected then
    if answer->>'ok' is distinct from 'true' then raise exception 'Не удалось подтвердить первичную запись' using errcode='40001';end if;
    return jsonb_build_object('ok',false,'cur',p_data,'limitAdjusted',true);
  end if;
  if answer->>'ok'='false' and answer#>'{cur,state,limitReceipt}' is distinct from p_data#>'{state,limitReceipt}' then
    return answer||'{"limitAdjusted":true}'::jsonb;
  end if;
  return answer;
end $$;
revoke all on function oplot.profile_xp(jsonb),oplot.profile_level(jsonb),oplot.building_cap(text,int),
  oplot.building_refund(text,int,int),oplot.excess_buildings(jsonb),oplot.settle_buildings(jsonb,bigint),
  oplot.returns_retired(jsonb,jsonb),oplot.guard_building_limits()
  from public,anon,authenticated;
