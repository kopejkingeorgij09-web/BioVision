create table public.notes_items (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and
    data ? 'kind' and
    coalesce(data->>'kind' in ('folder', 'pages', 'board', 'text'), false)
  ),
  deleted boolean not null default false,
  revision integer not null check (revision > 0),
  operation_id uuid not null,
  updated_at timestamptz not null default now()
);

create index notes_items_owner_id_id_idx on public.notes_items (owner_id, id);
alter table public.notes_items enable row level security;
revoke all on public.notes_items from public, anon, authenticated;
grant select, insert, update on public.notes_items to authenticated;

create policy notes_items_read on public.notes_items for select to authenticated
  using (owner_id = (select auth.uid()));
create policy notes_items_insert on public.notes_items for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy notes_items_update on public.notes_items for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create function public.notes_save(
  p_id uuid,
  p_base integer,
  p_operation uuid,
  p_data jsonb,
  p_deleted boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  saved public.notes_items%rowtype;
begin
  if caller is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_base = 0 then
    insert into public.notes_items (id, owner_id, data, deleted, revision, operation_id)
      values (p_id, caller, p_data, p_deleted, 1, p_operation)
      on conflict (id) do nothing
      returning * into saved;
  else
    update public.notes_items
       set data = p_data,
           deleted = p_deleted,
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notes-files', 'notes-files', false, 52428800,
  array['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp',
        'image/gif', 'image/heic', 'image/heif', 'image/avif',
        'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
);

create policy notes_files_read on storage.objects for select to authenticated
  using (bucket_id = 'notes-files' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy notes_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'notes-files' and (storage.foldername(name))[1] = (select auth.uid()::text));
