-- «Неделя»: синхронизация по коду. Выполнить один раз в SQL Editor проекта nedelya.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.wk_docs (
  owner text not null,
  id text not null,
  data jsonb,
  at bigint not null,
  primary key (owner, id)
);
create index if not exists wk_docs_at on public.wk_docs (owner, at);
create table if not exists public.wk_tries (ip text not null, at timestamptz not null default now());
create index if not exists wk_tries_ip on public.wk_tries (ip, at);
alter table public.wk_docs enable row level security;
alter table public.wk_tries enable row level security;

create or replace function public.wk_owner(code text) returns text
language plpgsql immutable set search_path = public, extensions as $$
begin
  if code is null or length(code) < 8 or length(code) > 128 then raise exception 'Код должен быть от 8 до 128 символов'; end if;
  return encode(extensions.digest('nedelya:' || code, 'sha256'), 'hex');
end $$;

create or replace function public.wk_ip() returns text language sql stable as $$
  select coalesce(nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''), 'unknown')
$$;

create or replace function public.wk_check(code text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare o text := wk_owner(code); n int; v_ip text := wk_ip();
begin
  if (select count(*) from wk_tries t where t.ip = v_ip and t.at > now() - interval '1 hour') >= 20 then
    raise exception 'Слишком много попыток, попробуй через час';
  end if;
  select count(*) into n from wk_docs d where d.owner = o and d.data is not null;
  if n = 0 then insert into wk_tries(ip) values (v_ip); end if;
  delete from wk_tries t where t.at < now() - interval '1 day';
  return json_build_object('docs', n);
end $$;

create or replace function public.wk_pull(code text, since bigint default 0) returns table(id text, data jsonb, at bigint)
language sql security definer set search_path = public, extensions as $$
  select d.id, d.data, d.at from wk_docs d where d.owner = wk_owner(code) and d.at > since order by d.at limit 5000
$$;

create or replace function public.wk_push(code text, items jsonb) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare o text := wk_owner(code); it jsonb; t bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; n int;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 500 then raise exception 'Слишком большая пачка'; end if;
  for it in select * from jsonb_array_elements(items) loop
    if length(it->>'id') > 80 then raise exception 'Плохой id'; end if;
    if octet_length(coalesce(it->'data', 'null'::jsonb)::text) > 200000 then raise exception 'Запись больше 200 КБ'; end if;
    insert into wk_docs(owner, id, data, at) values (o, it->>'id', nullif(it->'data', 'null'::jsonb), t)
      on conflict (owner, id) do update set data = excluded.data, at = excluded.at;
  end loop;
  select count(*) into n from wk_docs d where d.owner = o;
  if n > 5000 then raise exception 'Больше 5000 записей под одним кодом'; end if;
  return t;
end $$;

revoke all on function public.wk_owner(text) from public, anon, authenticated;
revoke all on function public.wk_ip() from public, anon, authenticated;
revoke all on function public.wk_check(text) from public;
revoke all on function public.wk_pull(text, bigint) from public;
revoke all on function public.wk_push(text, jsonb) from public;
grant execute on function public.wk_check(text) to anon, authenticated;
grant execute on function public.wk_pull(text, bigint) to anon, authenticated;
grant execute on function public.wk_push(text, jsonb) to anon, authenticated;
