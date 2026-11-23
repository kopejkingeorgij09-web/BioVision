-- Link the private planner to one reading profile, after proving both identities.
create table bv_personal.alberts_link (
  singleton boolean primary key default true check (singleton),
  owner uuid not null references bv_personal.accounts(id) on delete cascade
);
alter table bv_personal.alberts_link enable row level security;
revoke all on bv_personal.alberts_link from public, anon, authenticated;

create function bv_personal.refresh_alberts_reader(who uuid) returns void
language sql set search_path='' as $$
  with first_read as (
    select p.page, min(split_part(d.id,':',4)) as day
    from bv_personal.docs d cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(d.data->'pages')='array' then d.data->'pages' else '[]' end
    ) p(page)
    where d.owner=who and d.id ~ '^reading:day:alberts:[0-9]{4}-[0-9]{2}-[0-9]{2}:'
      and p.page ~ '^[1-9][0-9]{0,2}$'
    group by p.page
  ), bookmark as (
    select data from bv_personal.docs where owner=who and id='reading:progress:alberts'
  )
  insert into public.bv_docs as d(col,id,data)
  values ('bamboo','study_alberts_reader', jsonb_build_object(
    'pages',coalesce((select jsonb_object_agg(page,day) from first_read),'{}'),
    'manualAt',(select floor(extract(epoch from updated_at)*1000) from public.bv_docs where col='bamboo' and id='study_alberts'),
    'page',(select data->'page' from bookmark),'t',(select data->'t' from bookmark)))
  on conflict(col,id) do update set data=excluded.data,updated_at=now()
  where d.data is distinct from excluded.data
$$;

create function bv_personal.refresh_alberts_manual(who uuid) returns void
language plpgsql set search_path='' as $$
declare mark jsonb;
begin
  -- Serialize revision allocation with the reader's delta-sync cursor.
  perform 1 from bv_personal.accounts where id=who for update;
  select jsonb_build_object('current',data->'current','records',data->'records','t',
    coalesce(data->'markedAt',to_jsonb(floor(extract(epoch from updated_at)*1000))))
    into mark from public.bv_docs where col='bamboo' and id='study_alberts';
  insert into bv_personal.docs as d(owner,id,data) values(who,'reading:zov:alberts',mark)
  on conflict(owner,id) do update set data=excluded.data,rev=d.rev+1,updated=nextval('bv_personal.versions')
  where d.data is distinct from excluded.data;
end $$;

create function bv_personal.on_alberts_reader() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and new.id like 'reading:day:alberts:%' and
     (new.data->'pages') is not distinct from (old.data->'pages') then return null; end if;
  if exists(select 1 from bv_personal.alberts_link where owner=new.owner) then
    perform bv_personal.refresh_alberts_reader(new.owner);
  end if;
  return null;
end $$;
create trigger alberts_reader after insert or update on bv_personal.docs for each row
when (new.id='reading:progress:alberts' or new.id like 'reading:day:alberts:%')
execute function bv_personal.on_alberts_reader();

create function bv_personal.on_alberts_manual() returns trigger language plpgsql set search_path='' as $$
declare who uuid;
begin
  select owner into who from bv_personal.alberts_link;
  if who is not null then perform bv_personal.refresh_alberts_manual(who); end if;
  return null;
end $$;
create trigger alberts_manual after insert or update on public.bv_docs for each row
when (new.col='bamboo' and new.id='study_alberts') execute function bv_personal.on_alberts_manual();
create trigger alberts_manual_removed after delete on public.bv_docs for each row
when (old.col='bamboo' and old.id='study_alberts') execute function bv_personal.on_alberts_manual();

create function public.bv_link_alberts(p_code text,p_reader_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare profile jsonb; who uuid;
begin
  if not public._bv_can(p_code,'bamboo','study_alberts',true) then
    raise exception 'Нужен вход в Зов леса' using errcode='42501';
  end if;
  profile:=public.bv_personal_sync(p_reader_code,'login','[]');
  if profile->>'owner' is null then return false; end if;
  who:=(profile->>'owner')::uuid;
  perform 1 from bv_personal.accounts where id=who for update;
  insert into bv_personal.alberts_link(owner) values(who) on conflict do nothing;
  if not exists(select 1 from bv_personal.alberts_link where owner=who) then
    raise exception 'Уже подключён другой профиль чтения';
  end if;
  perform bv_personal.refresh_alberts_reader(who);
  perform bv_personal.refresh_alberts_manual(who);
  return true;
end $$;
revoke all on function bv_personal.refresh_alberts_reader(uuid), bv_personal.refresh_alberts_manual(uuid), bv_personal.on_alberts_reader(), bv_personal.on_alberts_manual() from public,anon,authenticated;
revoke all on function public.bv_link_alberts(text,text) from public;
grant execute on function public.bv_link_alberts(text,text) to anon,authenticated;
