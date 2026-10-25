-- БиоВиз: облако учеников. Применено к проекту Supabase «bioviz» 25.10.2026.
-- Таблицы закрыты RLS без политик: напрямую из браузера их не прочитать.
-- Весь доступ идёт через функции bv_*, которые проверяют код входа.
-- Код учителя хранится только как sha256-хеш в bv_admin; сам код в репозиторий не кладём.

create extension if not exists pgcrypto with schema extensions;

create table public.bv_admin (
  id int primary key default 1 check (id = 1),
  secret_hash text not null
);
create table public.bv_students (
  id text primary key,
  code text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
create table public.bv_docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
alter table public.bv_admin enable row level security;
alter table public.bv_students enable row level security;
alter table public.bv_docs enable row level security;
revoke all on public.bv_admin, public.bv_students, public.bv_docs from anon, authenticated;

create or replace function public._bv_who(p_code text, out role text, out uid text, out uname text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare c text := upper(trim(coalesce(p_code,'')));
begin
  role := null; uid := null; uname := null;
  if c = '' then return; end if;
  if exists (select 1 from bv_admin where secret_hash = encode(digest(c,'sha256'),'hex')) then
    role := 'admin'; uid := 'teacher'; uname := 'Учитель'; return;
  end if;
  select 'student', s.id, s.name into role, uid, uname from bv_students s where s.code = c;
end $$;

create or replace function public.bv_login(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if w.role is null then return null; end if;
  return jsonb_build_object('role', w.role, 'id', w.uid, 'name', w.uname);
end $$;

create or replace function public._bv_can(p_code text, p_col text, p_id text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if p_col = 'kedits' then return (not p_write) or w.role = 'admin'; end if;
  if p_col = 'students' then
    return w.role = 'admin' or (w.role = 'student' and p_id = w.uid);
  end if;
  return false;
end $$;

create or replace function public.bv_get(p_code text, p_col text, p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _bv_can(p_code, p_col, p_id, false) then raise exception 'denied' using errcode = '42501'; end if;
  return (select data from bv_docs where col = p_col and id = p_id);
end $$;

create or replace function public.bv_set(p_code text, p_col text, p_id text, p_data jsonb) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not _bv_can(p_code, p_col, p_id, true) then raise exception 'denied' using errcode = '42501'; end if;
  if p_id !~ '^[A-Za-z0-9_.:@+-]{1,120}$' then raise exception 'bad id'; end if;
  if octet_length(p_data::text) > 900000 then raise exception 'too large'; end if;
  insert into bv_docs(col, id, data, updated_at) values (p_col, p_id, p_data, now())
  on conflict (col, id) do update set data = excluded.data, updated_at = now();
  return true;
end $$;

create or replace function public.bv_delete(p_code text, p_col text, p_id text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not _bv_can(p_code, p_col, p_id, true) then raise exception 'denied' using errcode = '42501'; end if;
  delete from bv_docs where col = p_col and id = p_id;
  return true;
end $$;

create or replace function public.bv_list(p_code text, p_col text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if not (p_col = 'kedits' or (p_col = 'students' and w.role = 'admin')) then
    raise exception 'denied' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data) order by updated_at)
                   from bv_docs where col = p_col), '[]'::jsonb);
end $$;

create or replace function public.bv_codes(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if w.role is distinct from 'admin' then raise exception 'denied' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'created', created_at) order by created_at)
                   from bv_students), '[]'::jsonb);
end $$;

create or replace function public.bv_code_new(p_code text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare w record; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int; sid text;
begin
  select * into w from _bv_who(p_code);
  if w.role is distinct from 'admin' then raise exception 'denied' using errcode = '42501'; end if;
  loop
    c := 'BIO-';
    for i in 1..8 loop
      c := c || substr(abc, 1 + (get_byte(gen_random_bytes(1),0) % 32), 1);
      if i = 4 then c := c || '-'; end if;
    end loop;
    exit when not exists (select 1 from bv_students where code = c);
  end loop;
  sid := 's_' || encode(gen_random_bytes(6), 'hex');
  insert into bv_students(id, code, name) values (sid, c, left(trim(coalesce(p_name,'')), 40));
  return jsonb_build_object('id', sid, 'code', c, 'name', left(trim(coalesce(p_name,'')), 40));
end $$;

create or replace function public.bv_code_delete(p_code text, p_id text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if w.role is distinct from 'admin' then raise exception 'denied' using errcode = '42501'; end if;
  delete from bv_students where id = p_id;
  delete from bv_docs where col = 'students' and id = p_id;
  return true;
end $$;

revoke execute on function public._bv_who(text), public._bv_can(text,text,text,boolean) from public, anon, authenticated;
revoke execute on function public.bv_login(text), public.bv_get(text,text,text), public.bv_set(text,text,text,jsonb),
  public.bv_delete(text,text,text), public.bv_list(text,text), public.bv_codes(text),
  public.bv_code_new(text,text), public.bv_code_delete(text,text) from public;
grant execute on function public.bv_login(text), public.bv_get(text,text,text), public.bv_set(text,text,text,jsonb),
  public.bv_delete(text,text,text), public.bv_list(text,text), public.bv_codes(text),
  public.bv_code_new(text,text), public.bv_code_delete(text,text) to anon, authenticated;

-- Код учителя задаётся отдельно (не в репозитории):
-- insert into public.bv_admin(id, secret_hash) values (1, encode(extensions.digest('<КОД>','sha256'),'hex'))
--   on conflict (id) do update set secret_hash = excluded.secret_hash;
