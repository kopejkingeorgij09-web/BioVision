-- Personal capability codes are separate from teacher/student authorization.
create schema if not exists bv_personal;
revoke all on schema bv_personal from public, anon, authenticated;
create table bv_personal.accounts (id uuid primary key default gen_random_uuid(), code_hash text unique not null);
create table bv_personal.docs (owner uuid references bv_personal.accounts(id) on delete cascade, id text not null, data jsonb, rev bigint not null default 1, primary key(owner,id));
create table bv_personal.limits (ip text primary key, since timestamptz not null default now(), attempts integer not null default 0, failed integer not null default 0);
alter table bv_personal.accounts enable row level security;
alter table bv_personal.docs enable row level security;
alter table bv_personal.limits enable row level security;
revoke all on all tables in schema bv_personal from public, anon, authenticated;
create function public.bv_personal_sync(p_code text,p_action text,p_items jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h text; who uuid; v_ip text; tries integer; it jsonb; existing bv_personal.docs%rowtype; result jsonb := '[]';
begin
 if p_code is null or length(p_code)<12 or length(p_code)>128 then raise exception 'Код: от 12 до 128 символов'; end if;
 h := encode(extensions.digest('bioviz-personal-v1:'||p_code,'sha256'),'hex');
 v_ip := coalesce(nullif(split_part(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-forwarded-for',',',1),''),'unknown');
 -- Return errors as data: failed attempt counters must commit, not roll back with an exception.
 insert into bv_personal.limits as l(ip,attempts) values(v_ip,1) on conflict(ip) do update set attempts=case when l.since<now()-interval '1 hour' then 1 else l.attempts+1 end,failed=case when l.since<now()-interval '1 hour' then 0 else l.failed end,since=case when l.since<now()-interval '1 hour' then now() else l.since end returning attempts into tries;
 if tries>3000 then return jsonb_build_object('error','Слишком много запросов. Попробуй позже.');end if;
 select id into who from bv_personal.accounts where code_hash=h;
 if who is null or p_action='create' then
  update bv_personal.limits set failed=failed+1 where ip=v_ip returning failed into tries;
  if tries>20 then return jsonb_build_object('error','Слишком много попыток. Попробуй через час.');end if;
 end if;
 if p_action='create' then
  if who is not null then return jsonb_build_object('error','Этот код уже занят. Используй вход или придумай другой.');end if;
  insert into bv_personal.accounts(code_hash) values(h) returning id into who;
 elsif who is null then return jsonb_build_object('error','Код не найден. Проверь ввод.');end if;
 if p_action in ('create','login') then return jsonb_build_object('owner',who);end if;
 -- Serialize per owner, so two devices cannot silently overwrite the same revision.
 perform 1 from bv_personal.accounts where id=who for update;
 if p_action='push' then
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 then raise exception 'Неверная пачка';end if;
  for it in select value from jsonb_array_elements(p_items) loop
   if not ((it->>'id') like 'reading:%' or (it->>'id') like 'personal:homework:%') or length(it->>'id')>180 or octet_length((it->'data')::text)>200000 then raise exception 'Неверная запись';end if;
   select * into existing from bv_personal.docs where owner=who and id=it->>'id';
   if coalesce(existing.rev,0)=coalesce((it->>'rev')::bigint,0) then
    insert into bv_personal.docs(owner,id,data,rev) values(who,it->>'id',it->'data',1) on conflict(owner,id) do update set data=excluded.data,rev=bv_personal.docs.rev+1 returning * into existing;
    result:=result||jsonb_build_array(jsonb_build_object('id',existing.id,'data',existing.data,'rev',existing.rev,'ok',true));
   else
    result:=result||jsonb_build_array(jsonb_build_object('id',existing.id,'data',existing.data,'rev',existing.rev,'ok',false));
   end if;
  end loop;
  if (select count(*) from bv_personal.docs where owner=who)>10000 then raise exception 'Достигнут лимит записей';end if;
 elsif p_action='pull' then
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'data',d.data,'rev',d.rev)),'[]') into result from bv_personal.docs d where owner=who;
 else raise exception 'Неизвестное действие';end if;
 return jsonb_build_object('owner',who,'items',result);
end $$;
revoke all on function public.bv_personal_sync(text,text,jsonb) from public;
grant execute on function public.bv_personal_sync(text,text,jsonb) to anon,authenticated;
