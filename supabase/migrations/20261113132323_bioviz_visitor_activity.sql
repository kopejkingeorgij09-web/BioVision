-- Usage contains counters and public material labels, never answers or capability codes.
-- Private tables; public RPCs intentionally use capability authorization.
create schema if not exists bv_usage;
revoke all on schema bv_usage from public, anon, authenticated;
create table bv_usage.metrics (
 device text not null, stream text not null, scope text not null,
 owner uuid references bv_personal.accounts(id) on delete cascade,
 day date not null, key text not null, kind text not null, section text not null, label text not null,
 views integer not null, seconds numeric not null, pages jsonb not null,
 rev bigint not null, last_at timestamptz not null default now(),
 primary key(device,stream,scope,day,key)
);
create index usage_recent on bv_usage.metrics(day);
create index usage_owner on bv_usage.metrics(owner);
create table bv_usage.limits (device text primary key, since timestamptz not null default now(), attempts integer not null);
alter table bv_usage.metrics enable row level security;
alter table bv_usage.limits enable row level security;
revoke all on all tables in schema bv_usage from public, anon, authenticated;

create function public.bv_activity_push(p_code text,p_device text,p_items jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare who uuid; device_hash text; scope_id text; it jsonb; date_id date; tries integer;
begin
 if p_device is null or p_device !~ '^[a-f0-9]{32}$' then raise exception 'Invalid device';end if;
 if p_code is not null and p_code<>'' then
  select id into who from bv_personal.accounts where code_hash=encode(extensions.digest('bioviz-personal-v1:'||p_code,'sha256'),'hex');
  if who is null then raise exception 'denied' using errcode='42501';end if;
 end if;
 scope_id:=coalesce(who::text,'guest');
 device_hash:=encode(extensions.digest('bioviz-usage-v1:'||p_device,'sha256'),'hex');
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 or octet_length(p_items::text)>250000 then raise exception 'Invalid batch';end if;
 insert into bv_usage.limits as l(device,attempts) values(device_hash,1) on conflict(device) do update set attempts=case when l.since<now()-interval '1 hour' then 1 else l.attempts+1 end,since=case when l.since<now()-interval '1 hour' then now() else l.since end returning attempts into tries;
 if tries>3000 then raise exception 'Too many requests';end if;
 -- The per-device row lock also serializes quota checks and retries from multiple tabs.
 for it in select value from jsonb_array_elements(p_items) loop
  if not coalesce((it->>'stream') ~ '^[a-f0-9]{32}$'
   and (it->>'key') ~ '^[A-Za-z0-9_.:-]{1,180}$'
   and (it->>'kind') in ('page','lecture','topic','book','action')
   and (it->>'section') in ('course','labs','reading','practice','profile')
   and length(it->>'label') between 1 and 180
   and (it->>'rev')::bigint between 1 and 1000000000
   and (it->>'views')::integer between 0 and 100000
   and (it->>'seconds')::numeric between 0 and 86400
   and jsonb_typeof(it->'pages')='array',false) then raise exception 'Invalid metric';end if;
  if jsonb_array_length(it->'pages')>1000 or exists(select 1 from jsonb_array_elements_text(it->'pages') p where p !~ '^[0-9]{1,6}$' or p::integer not between 1 and 100000) then raise exception 'Invalid pages';end if;
  date_id:=(it->>'day')::date;
  if date_id is null then raise exception 'Invalid date';end if;
  -- Old offline counters outside the dashboard window can be acknowledged and discarded.
  if date_id<current_date-89 or date_id>current_date+1 then continue;end if;
  insert into bv_usage.metrics as m(device,stream,scope,owner,day,key,kind,section,label,views,seconds,pages,rev)
   values(device_hash,it->>'stream',scope_id,who,date_id,it->>'key',it->>'kind',it->>'section',it->>'label',(it->>'views')::integer,(it->>'seconds')::numeric,it->'pages',(it->>'rev')::bigint)
   on conflict(device,stream,scope,day,key) do update set label=excluded.label,views=excluded.views,seconds=excluded.seconds,pages=excluded.pages,rev=excluded.rev,last_at=now() where excluded.rev>m.rev;
 end loop;
 if (select count(*) from bv_usage.metrics where device=device_hash and day>=current_date-89)>20000 then raise exception 'Usage quota reached';end if;
 return true;
end $$;

create function public.bv_activity_report(p_code text,p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare role_name text; result jsonb;
begin
 select w.role into role_name from public._bv_who(p_code) w;
 if role_name is distinct from 'admin' then raise exception 'denied' using errcode='42501';end if;
 with source as (
  select *,case when owner is null then 'g:'||device else 'p:'||owner::text end as visitor
  from bv_usage.metrics where day>=current_date-(greatest(1,least(90,coalesce(p_days,30)))-1)
 ), totals as (
  select visitor,key,kind,section,max(label) label,sum(views) views,round(sum(seconds),1) seconds,max(last_at) last_at
  from source group by visitor,key,kind,section
 ), page_counts as (
  -- One page per calendar day across tabs/devices, so simultaneous reading is not doubled.
  select visitor,key,count(distinct (day::text||':'||p.value)) pages
  from source cross join lateral jsonb_array_elements_text(pages) p(value) group by visitor,key
 )
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('pages',coalesce(p.pages,0)) order by t.last_at desc),'[]'::jsonb)
 into result from totals t left join page_counts p using(visitor,key);
 return jsonb_build_object('rows',result,'days',greatest(1,least(90,coalesce(p_days,30))));
end $$;
revoke all on function public.bv_activity_push(text,text,jsonb), public.bv_activity_report(text,integer) from public;
grant execute on function public.bv_activity_push(text,text,jsonb), public.bv_activity_report(text,integer) to anon,authenticated;
