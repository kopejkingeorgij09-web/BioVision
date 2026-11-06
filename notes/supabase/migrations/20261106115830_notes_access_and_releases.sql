create table public.notes_access_codes (
  digest text primary key check (digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.notes_access_codes enable row level security;
revoke all on public.notes_access_codes from public, anon, authenticated;
grant select on public.notes_access_codes to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('notes-releases', 'notes-releases', true, 52428800);
