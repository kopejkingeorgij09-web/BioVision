-- Higher citadel tiers use the same levels and prices as the game. Existing receipts stay final.
create or replace function oplot.profile_xp(s jsonb) returns numeric language sql immutable set search_path='' as $$
  select greatest(0,coalesce(oplot.num(s->>'xp'),
    (select coalesce(sum(10*(oplot.raid_int(d->>'level',1,100)-1)),0) from jsonb_array_elements(oplot.arr(s->'dragons')) d)
    +(select coalesce(sum(12*(oplot.raid_int(b->>'level',1,case when b->>'type'='keep' then 12 else 9 end)-1)),0) from jsonb_array_elements(oplot.arr(s->'buildings')) b)
    +35*coalesce(oplot.num(s->>'quest'),0)
    +(select 25*coalesce(sum(oplot.num(val)),0) from jsonb_each_text(case when jsonb_typeof(s->'campaign')='object' then s->'campaign' else '{}' end) e(k,val))))
$$;

create or replace function oplot.building_refund(kind text,level int,copy_no int) returns bigint language sql immutable set search_path='' as $$
  with price as (select case kind when 'keep' then 0 when 'mine' then 65 when 'farm' then 60 when 'home' then 80
    when 'den' then 85 when 'goldstore' then 90 when 'foodstore' then 75 when 'academy' then 220 when 'archer' then 70
    when 'cannon' then 95 when 'spire' then 130 when 'wall' then 20 when 'firetrap' then 40 when 'icetrap' then 35 end as base,
    kind in ('mine','farm','goldstore','foodstore') as industry)
  select (case when kind in ('mine','farm') and copy_no=0 then 0 when industry then base*(1+2*copy_no) else base end
    +coalesce((select sum(round(case when kind='keep' then (array[400,950,1900,3600,6200,9800,14500,20500,29000,41000,57000])[n+1]
      when industry then base*(.65+.24*n+.018*n*n) else (base*.72+12)*(n+1) end))
      from generate_series(0,level-2) n),0))::bigint from price
$$;

create or replace function oplot.settle_buildings(s jsonb,at_ms bigint) returns jsonb language plpgsql immutable set search_path='' as $$
declare xp numeric:=oplot.profile_xp(s); profile int:=oplot.profile_level(s); kept jsonb; receipt jsonb;
begin
  if not oplot.excess_buildings(s) then return s; end if;
  with ranked as (
    select b,ord,k,oplot.raid_int(b->>'level',1,case when b->>'type'='keep' then 12 else 9 end) as lvl,
      row_number() over(partition by k order by oplot.raid_int(b->>'level',1,case when b->>'type'='keep' then 12 else 9 end) desc,(b->'stowed'='true'::jsonb) is true,ord) as priority,
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
