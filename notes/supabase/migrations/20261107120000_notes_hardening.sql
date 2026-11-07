-- «Поля» 0.4: закрытый доступ, отзыв кодов, запись только через notes_save.

-- Участники с входом по почте. Аккаунты по коду определяются действующим кодом (см. notes_member).
create table public.notes_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.notes_members enable row level security;
revoke all on public.notes_members from public, anon, authenticated;
grant select, insert, delete on public.notes_members to service_role;

-- Все уже существующие аккаунты по почте сохраняют доступ.
insert into public.notes_members (user_id)
  select id from auth.users where email is null or email not like 'notes-%@polya.invalid'
  on conflict do nothing;

-- Код можно отозвать; user_id заполняет функция notes-code при первом входе новой версии.
alter table public.notes_access_codes
  add column user_id uuid references auth.users (id) on delete set null,
  add column revoked_at timestamptz;
create unique index notes_access_codes_user_id_idx on public.notes_access_codes (user_id) where user_id is not null;
grant select, update on public.notes_access_codes to service_role;

create function public.notes_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.notes_members m where m.user_id = (select auth.uid()))
      or exists (
        select 1
          from public.notes_access_codes c
          join auth.users u on u.id = (select auth.uid())
         where c.revoked_at is null
           and u.email = 'notes-' || left(c.digest, 48) || '@polya.invalid'
      );
$$;
revoke all on function public.notes_member() from public, anon, authenticated;
grant execute on function public.notes_member() to authenticated;

-- Таблица заметок: только чтение напрямую, запись только через notes_save со сверкой ревизии.
drop policy notes_items_insert on public.notes_items;
drop policy notes_items_update on public.notes_items;
drop policy notes_items_read on public.notes_items;
revoke insert, update, delete on public.notes_items from authenticated;
create policy notes_items_read on public.notes_items for select to authenticated
  using (owner_id = (select auth.uid()) and (select public.notes_member()));

create or replace function public.notes_save(
  p_id uuid,
  p_base integer,
  p_operation uuid,
  p_data jsonb,
  p_deleted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  saved public.notes_items%rowtype;
begin
  if caller is null or not public.notes_member() then
    raise exception 'Доступ к «Полям» закрыт' using errcode = '42501';
  end if;
  if p_base is null or p_base < 0 or p_id is null or p_operation is null or p_data is null then
    raise exception 'Неверный запрос' using errcode = '22023';
  end if;
  -- Защита от бесконечного роста строки. 32 МиБ — с запасом для большой тетради.
  if octet_length(p_data::text) > 33554432 then
    raise exception 'Заметка слишком большая для синхронизации' using errcode = '54000';
  end if;

  if p_base = 0 then
    insert into public.notes_items (id, owner_id, data, deleted, revision, operation_id)
      values (p_id, caller, p_data, coalesce(p_deleted, false), 1, p_operation)
      on conflict (id) do nothing
      returning * into saved;
  else
    update public.notes_items
       set data = p_data,
           deleted = coalesce(p_deleted, false),
           revision = revision + 1,
           operation_id = p_operation,
           updated_at = clock_timestamp()
     where id = p_id and owner_id = caller and revision = p_base
      returning * into saved;
  end if;

  if found then
    return jsonb_build_object('saved', true, 'item', to_jsonb(saved));
  end if;

  select * into saved from public.notes_items where id = p_id and owner_id = caller;
  if not found then
    return jsonb_build_object('saved', false, 'item', null);
  end if;
  return jsonb_build_object('saved', saved.operation_id = p_operation, 'item', to_jsonb(saved));
end;
$$;

revoke all on function public.notes_save(uuid, integer, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.notes_save(uuid, integer, uuid, jsonb, boolean) to authenticated;

-- Файлы: только участники; владелец может удалять свои файлы (нужно для очистки).
drop policy notes_files_read on storage.objects;
drop policy notes_files_insert on storage.objects;
create policy notes_files_read on storage.objects for select to authenticated
  using (bucket_id = 'notes-files' and (storage.foldername(name))[1] = (select auth.uid()::text) and (select public.notes_member()));
create policy notes_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'notes-files' and (storage.foldername(name))[1] = (select auth.uid()::text) and (select public.notes_member()));
create policy notes_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'notes-files' and (storage.foldername(name))[1] = (select auth.uid()::text) and (select public.notes_member()));
