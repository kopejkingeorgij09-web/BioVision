-- Uncollected resources held by each producer, independent of the island wallet.
create function oplot.producer_capacity(kind text, level int) returns int
language sql immutable strict set search_path='' as $$
  select level * case kind when 'mine' then 360 when 'farm' then 360 when 'home' then 90 else 0 end
$$;
revoke all on function oplot.producer_capacity(text,int) from public,anon,authenticated;

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
      least(oplot.producer_capacity(k,lvl),greatest(0,case when b->'stowed'='true'::jsonb then floor(coalesce(oplot.num(b->>'pausedStock'),0))
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

create or replace function oplot.night_loot(s jsonb, at_time timestamptz, stars int) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  pct int:=(array[0,25,50,80])[stars+1]; instant numeric:=floor(extract(epoch from at_time)*1000);
  gold numeric:=greatest(0,coalesce(oplot.num(s->>'gold'),0));
  berries numeric:=greatest(0,coalesce(oplot.num(s->>'berries'),0));
  total_gold numeric:=gold; total_berries numeric:=berries; prior numeric;
  buildings jsonb[]:='{}'; v jsonb; k text; lvl int; rate numeric; since_ms numeric;
  raw numeric; ready numeric; lost numeric; gold_lost numeric; berries_lost numeric; paused boolean;
begin
  if pct is null then raise exception 'invalid raid stars'; end if;
  for v in select value from jsonb_array_elements(oplot.arr(s->'buildings')) loop
    paused:=coalesce(s->>'layoutVersion'='2' and v->'stowed'='true'::jsonb,false);
    k:=v->>'type'; lvl:=oplot.raid_int(v->>'level',1,100);
    rate:=lvl*(case k when 'mine' then 0.0008 when 'farm' then 0.0006 when 'home' then 0.00017 else 0 end);
    since_ms:=oplot.num(v->>'since');
    if rate>0 and (paused or since_ms is not null) then
      raw:=least(oplot.producer_capacity(k,lvl),greatest(0,case when paused then floor(coalesce(oplot.num(v->>'pausedStock'),0)) else (instant-since_ms)*rate end));
      ready:=floor(raw);
      if k='farm' then prior:=total_berries; total_berries:=total_berries+ready;
      else prior:=total_gold; total_gold:=total_gold+ready; end if;
      lost:=floor((prior+ready)*pct/100)-floor(prior*pct/100);
      if lost>0 then
        if paused then v:=jsonb_set(v,'{pausedStock}',to_jsonb(raw-lost));
        else v:=jsonb_set(v,'{since}',to_jsonb(floor(instant-(raw-lost)/rate))); end if;
      end if;
    end if;
    buildings:=array_append(buildings,v);
  end loop;
  gold_lost:=floor(total_gold*pct/100); berries_lost:=floor(total_berries*pct/100);
  if pct>0 then
    s:=s||jsonb_build_object('gold',gold-floor(gold*pct/100),'berries',berries-floor(berries*pct/100),
      'buildings',to_jsonb(buildings));
  end if;
  return jsonb_build_object('state',s,'goldLost',gold_lost,'berriesLost',berries_lost,'percent',pct);
end $$;
