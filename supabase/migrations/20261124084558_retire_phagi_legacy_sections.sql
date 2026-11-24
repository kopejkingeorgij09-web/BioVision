-- Retire the class games and notebook application. Keep original submissions,
-- grades and files at their existing identifiers, including handwritten work.
select cron.unschedule(jobid) from cron.job where jobname = 'oplot-night-raids';

lock table public.ph_docs in share row exclusive mode;

drop trigger if exists oplot_study_rewards on public.ph_docs;
drop trigger if exists oplot_register_island on public.ph_docs;
drop trigger if exists oplot_finished_review on public.ph_docs;
drop trigger if exists oplot_check_grid_save on public.ph_docs;
drop trigger if exists oplot_check_building_limits on public.ph_docs;

drop function if exists public.ph_oplot_buy(text,text,uuid);
drop function if exists public.ph_oplot_load(text,text);
drop function if exists public.ph_oplot_practice(text,date,jsonb);
drop function if exists public.ph_oplot_raids(text);
drop function if exists public.ph_oplot_scout(text);
drop function if exists public.ph_oplot_store(text,text,jsonb,integer,text);
drop function if exists public.ph_oplot_wallet(text);
drop schema if exists oplot cascade;

-- Regular material entries keep each source PDF, its title, and its assignment.
-- An ID conflict aborts publication instead of changing an existing assignment.
insert into public.ph_docs (path,parent,id,data)
select 'tasks/archived-book-' || id, 'tasks', 'archived-book-' || id,
       jsonb_build_object('kind','material','subject',data->'subject','to',data->'to',
         'title',data->'title','body',coalesce(data->>'topic',''),
         'files',jsonb_build_array(data->'file'),'links','[]'::jsonb,
         'createdAt',data->'createdAt','updatedAt',to_jsonb(clock_timestamp()))
from public.ph_docs
where parent='nbooks' and not deleted and data->'file'->>'id' is not null;

-- Store notebook geometry and both personal annotation layers outside the app.
-- Original coordinates and identifiers are needed to reconstruct marked pages.
create schema if not exists phagi_archive;
revoke all on schema phagi_archive from public, anon, authenticated;
create table if not exists phagi_archive.notebook_documents (
  path text primary key,
  data jsonb not null,
  updated_at timestamptz not null
);
alter table phagi_archive.notebook_documents enable row level security;
revoke all on table phagi_archive.notebook_documents from public, anon, authenticated;
insert into phagi_archive.notebook_documents(path,data,updated_at)
select path,data,updated_at from public.ph_docs
where not deleted and (parent='nbooks' or parent ~ '^(subs|grades)/[^/]+/nb$');

update public.ph_docs set data = data - 'nb', updated_at=clock_timestamp()
where not deleted and (parent='tasks' or parent ~ '^assign/[^/]+/tasks$') and data ? 'nb';
update public.ph_docs set data=null,deleted=true,updated_at=clock_timestamp()
where not deleted and (parent='nbooks' or parent ~ '^(subs|grades)/[^/]+/nb$');

delete from public.ph_docs where path ~ '^(arena|arenacfg)(/|$)|^data/users/[^/]+/oplot(/|$)';
delete from public.ph_rules where split_part(path,'/',1) in ('arena','arenacfg');
update public.ph_docs set data=data-'oplotFinish',updated_at=clock_timestamp()
where parent ~ '^srs/[^/]+/decks$' and data ? 'oplotFinish';

-- An old installed client must not re-create a removed game or notebook via
-- the general document RPCs. Tombstones can still propagate to offline clients.
alter table public.ph_docs drop constraint if exists ph_retired_sections;
alter table public.ph_docs add constraint ph_retired_sections check (
  deleted or path !~ '^(arena|arenacfg|nbooks)(/|$)|^data/users/[^/]+/oplot(/|$)|^(subs|grades)/[^/]+/nb(/|$)'
);
