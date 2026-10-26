-- «Фаги естественных наук» (папка phagi/): облако платформы. Применено к проекту Supabase «bioviz» 26.10.2026.
-- Раньше платформа жила артефактом claude.ai с базой документов и 20 правилами доступа.
-- Здесь та же модель: документы по путям, правила в ph_rules, проверка на сервере в функциях ph_*.
-- Таблицы закрыты RLS без политик, из браузера доступны только функции.
-- Учитель входит тем же секретным кодом, что и в БиоВиз (хеш в bv_admin), и получает свой старый uid.
-- Ученицы входят кодами вида FAG-XXXX-XXXX, каждый код привязан к старому uid ученицы, поэтому прогресс сохранился.

create table public.ph_admin (
  id int primary key default 1 check (id = 1),
  uid text not null
);
create table public.ph_students (
  uid text primary key,
  code text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
create table public.ph_docs (
  path text primary key,
  parent text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
create index ph_docs_parent on public.ph_docs(parent);
create index ph_docs_updated on public.ph_docs(updated_at);

-- правило: минимальный уровень для чтения/записи на пути и ниже; {self} = uid вошедшего
create table public.ph_rules (
  path text primary key,
  rd text,
  wr text
);
insert into public.ph_rules(path, rd, wr) values
  ('', 'interact', 'owner'),
  ('people', 'interact', null), ('people/{self}', null, 'interact'),
  ('subs', 'owner', 'owner'), ('subs/{self}', 'interact', 'interact'),
  ('grades', 'owner', 'owner'), ('grades/{self}', 'interact', null),
  ('srs', 'owner', 'owner'), ('srs/{self}', 'interact', 'interact'),
  ('rsvp', 'owner', 'owner'), ('rsvp/{self}', 'interact', 'interact'),
  ('data/users/{self}', 'interact', 'interact'),
  ('petri', 'owner', 'owner'), ('petri/{self}', 'interact', null),
  ('arena', 'interact', 'owner'), ('arena/{self}', null, 'interact'),
  ('assign', 'interact', 'owner'), ('assign/{self}', null, 'interact'),
  ('track', 'owner', 'owner'), ('track/{self}', 'interact', null);

alter table public.ph_admin enable row level security;
alter table public.ph_students enable row level security;
alter table public.ph_docs enable row level security;
alter table public.ph_rules enable row level security;
revoke all on public.ph_admin, public.ph_students, public.ph_docs, public.ph_rules from anon, authenticated;

create or replace function public._ph_lv(t text) returns int language sql immutable as $$
  select case t when 'view' then 1 when 'interact' then 2 when 'admin' then 3 when 'owner' then 4 else null end $$;

-- кто вошёл: lv 4 = учитель (owner), 2 = ученица (interact), null = никто
create or replace function public._ph_who(p_code text, out lv int, out uid text, out uname text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare c text := upper(trim(coalesce(p_code,'')));
begin
  lv := null; uid := null; uname := null;
  if c = '' then return; end if;
  if exists (select 1 from bv_admin where secret_hash = encode(digest(c,'sha256'),'hex')) then
    select 4, a.uid, 'Учитель' into lv, uid, uname from ph_admin a where a.id = 1; return;
  end if;
  select 2, s.uid, s.name into lv, uid, uname from ph_students s where s.code = c;
end $$;

create or replace function public._ph_ok(p_lv int, p_uid text, p_path text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s text[] := string_to_array(p_path, '/'); n int := coalesce(array_length(s,1),0);
  r record; ps text[]; k int; i int; m boolean; lr int; lw int;
begin
  if p_lv is null or p_uid is null or n = 0 then return false; end if;
  -- чужие data/users/<id> закрыты от всех, учителя тоже
  if n >= 2 and s[1] = 'data' and s[2] = 'users' and (n < 3 or s[3] is distinct from p_uid) then return false; end if;
  for r in select x.path, x.rd as r_rd, x.wr as r_wr from ph_rules x order by (case when x.path = '' then 0 else array_length(string_to_array(x.path,'/'),1) end) desc loop
    if r.path = '' then k := 0; ps := '{}'; else ps := string_to_array(r.path,'/'); k := array_length(ps,1); end if;
    if k > n then continue; end if;
    m := true;
    for i in 1..k loop
      if ps[i] = '{self}' then if s[i] is distinct from p_uid then m := false; exit; end if;
      elsif ps[i] <> s[i] then m := false; exit; end if;
    end loop;
    if not m then continue; end if;
    if lr is null and r.r_rd is not null then lr := _ph_lv(r.r_rd); end if;
    if lw is null and r.r_wr is not null then lw := _ph_lv(r.r_wr); end if;
  end loop;
  lr := coalesce(lr, 1); lw := coalesce(lw, 2);
  return coalesce(p_lv >= (case when p_write then greatest(lw, lr) else lr end), false);
end $$;

create or replace function public._ph_merge(a jsonb, b jsonb) returns jsonb language plpgsql immutable as $$
declare k text; v jsonb; r jsonb := coalesce(a, '{}'::jsonb);
begin
  for k, v in select * from jsonb_each(b) loop
    if jsonb_typeof(v) = 'object' and v ? '__delete__' then r := r - k;
    elsif jsonb_typeof(v) = 'object' and jsonb_typeof(r -> k) = 'object' then r := jsonb_set(r, array[k], _ph_merge(r -> k, v));
    else r := jsonb_set(r, array[k], v); end if;
  end loop;
  return r;
end $$;

create or replace function public._ph_split(p_path text, out parent text, out id text) language plpgsql immutable as $$
declare s text[] := string_to_array(p_path,'/'); n int := coalesce(array_length(s,1),0);
begin
  if n < 2 or n % 2 <> 0 or length(p_path) > 1000 or p_path !~ '^[A-Za-z0-9_.~:@+/-]+$' then raise exception 'bad path' using errcode = '22023'; end if;
  id := s[n]; parent := array_to_string(s[1:n-1], '/');
end $$;

create or replace function public.ph_login(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  if w.lv is null then return null; end if;
  return jsonb_build_object('id', w.uid, 'isOwner', w.lv = 4, 'name', w.uname);
end $$;

create or replace function public.ph_get(p_code text, p_path text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  perform _ph_split(p_path);
  if not _ph_ok(w.lv, w.uid, p_path, false) then return null; end if;
  return (select data from ph_docs where path = p_path and not deleted);
end $$;

create or replace function public.ph_set(p_code text, p_path text, p_data jsonb) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare w record; sp record; t timestamptz := clock_timestamp();
begin
  select * into w from _ph_who(p_code);
  select * into sp from _ph_split(p_path);
  if not _ph_ok(w.lv, w.uid, p_path, true) then raise exception 'denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 400000 then raise exception 'bad body' using errcode = '22023'; end if;
  insert into ph_docs(path, parent, id, data, deleted, updated_at) values (p_path, sp.parent, sp.id, p_data, false, t)
  on conflict (path) do update set data = excluded.data, deleted = false, updated_at = t;
  return t;
end $$;

create or replace function public.ph_update(p_code text, p_path text, p_data jsonb) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare w record; cur jsonb; t timestamptz := clock_timestamp();
begin
  select * into w from _ph_who(p_code);
  perform _ph_split(p_path);
  if not _ph_ok(w.lv, w.uid, p_path, true) then raise exception 'denied' using errcode = '42501'; end if;
  select data into cur from ph_docs where path = p_path and not deleted for update;
  if not found then raise exception 'missing' using errcode = '22023'; end if;
  cur := _ph_merge(cur, p_data);
  if octet_length(cur::text) > 400000 then raise exception 'bad body' using errcode = '22023'; end if;
  update ph_docs set data = cur, updated_at = t where path = p_path;
  return t;
end $$;

create or replace function public.ph_delete(p_code text, p_path text) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare w record; t timestamptz := clock_timestamp();
begin
  select * into w from _ph_who(p_code);
  perform _ph_split(p_path);
  if not _ph_ok(w.lv, w.uid, p_path, true) then raise exception 'denied' using errcode = '42501'; end if;
  update ph_docs set data = null, deleted = true, updated_at = t where path = p_path;
  return t;
end $$;

create or replace function public.ph_list(p_code text, p_col text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  if w.lv is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data, 't', updated_at) order by id)
    from ph_docs where parent = p_col and not deleted and _ph_ok(w.lv, w.uid, path, false)), '[]'::jsonb);
end $$;

-- одним запросом: что поменялось после p_since в нужных коллекциях и документах
create or replace function public.ph_sync(p_code text, p_cols text[], p_docs text[], p_since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  if w.lv is null then raise exception 'denied' using errcode = '42501'; end if;
  return jsonb_build_object('now', clock_timestamp(), 'ch', coalesce((select jsonb_agg(jsonb_build_object(
      'p', path, 'c', parent, 'id', id, 'd', case when deleted then null else data end, 't', updated_at))
    from ph_docs where updated_at > p_since and (parent = any(p_cols) or path = any(p_docs))
      and _ph_ok(w.lv, w.uid, path, false)), '[]'::jsonb));
end $$;

create or replace function public.ph_profiles(p_code text, p_ids text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  if w.lv is null then return '{}'::jsonb; end if;
  return coalesce((select jsonb_object_agg(uid, jsonb_build_object('name', name)) from ph_students where uid = any(p_ids)), '{}'::jsonb)
    || coalesce((select jsonb_build_object(a.uid, jsonb_build_object('name', 'Георгий')) from ph_admin a where a.uid = any(p_ids)), '{}'::jsonb);
end $$;

create or replace function public.ph_codes(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  if w.lv is distinct from 4 then raise exception 'denied' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', uid, 'code', code, 'name', name) order by created_at) from ph_students), '[]'::jsonb);
end $$;

create or replace function public.ph_code_new(p_code text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare w record; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int; sid text;
begin
  select * into w from _ph_who(p_code);
  if w.lv is distinct from 4 then raise exception 'denied' using errcode = '42501'; end if;
  loop
    c := 'FAG-';
    for i in 1..8 loop
      c := c || substr(abc, 1 + (get_byte(gen_random_bytes(1),0) % 32), 1);
      if i = 4 then c := c || '-'; end if;
    end loop;
    exit when not exists (select 1 from ph_students where code = c);
  end loop;
  sid := 'u_' || translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_');
  sid := left(sid, 24);
  insert into ph_students(uid, code, name) values (sid, c, left(trim(coalesce(p_name,'')), 40));
  return jsonb_build_object('id', sid, 'code', c, 'name', left(trim(coalesce(p_name,'')), 40));
end $$;

create or replace function public.ph_code_delete(p_code text, p_uid text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  if w.lv is distinct from 4 then raise exception 'denied' using errcode = '42501'; end if;
  delete from ph_students where uid = p_uid;
  return true;
end $$;

revoke execute on function public._ph_lv(text), public._ph_who(text), public._ph_ok(int,text,text,boolean),
  public._ph_merge(jsonb,jsonb), public._ph_split(text) from public, anon, authenticated;
revoke execute on function public.ph_login(text), public.ph_get(text,text), public.ph_set(text,text,jsonb),
  public.ph_update(text,text,jsonb), public.ph_delete(text,text), public.ph_list(text,text),
  public.ph_sync(text,text[],text[],timestamptz), public.ph_profiles(text,text[]), public.ph_codes(text),
  public.ph_code_new(text,text), public.ph_code_delete(text,text) from public;
grant execute on function public.ph_login(text), public.ph_get(text,text), public.ph_set(text,text,jsonb),
  public.ph_update(text,text,jsonb), public.ph_delete(text,text), public.ph_list(text,text),
  public.ph_sync(text,text[],text[],timestamptz), public.ph_profiles(text,text[]), public.ph_codes(text),
  public.ph_code_new(text,text), public.ph_code_delete(text,text) to anon, authenticated;

-- uid учителя: отдельный, не совпадает ни с одной ученицей (u_a7f09… это «Георгий»-ученик со своим кодом)
insert into public.ph_admin(id, uid) values (1, 'u_teacher_owner');

-- после применения: фиксированный search_path у вспомогательных функций
alter function public._ph_split(text) set search_path = public;
alter function public._ph_lv(text) set search_path = public;
alter function public._ph_merge(jsonb,jsonb) set search_path = public;
