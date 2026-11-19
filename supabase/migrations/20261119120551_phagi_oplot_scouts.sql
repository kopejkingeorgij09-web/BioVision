-- School review progress is saved in one or more SRS documents. The client
-- writes the shard containing its last successfully rated card after the others.
create table oplot.scout_passes (
  uid text primary key,
  raid_day date not null
);
alter table oplot.scout_passes enable row level security;
revoke all on oplot.scout_passes from public,anon,authenticated;

create function oplot.scout_deck_complete(who text, deck text, last_card text, study_day text, full_deck boolean)
returns boolean language plpgsql stable set search_path='' as $$
declare
  head public.ph_docs;
  part_parent text;
  srs_parent text:='srs/'||who||'/decks';
  schedule jsonb;
begin
  if deck='mistakes' then
    select * into head from public.ph_docs where path='data/users/'||who||'/mistakes'
      and not deleted and data->>'kind'='deck';
    part_parent:=head.parent;
  else
    select * into head from oplot.assigned(who,'decks',deck);
    part_parent:=case when head.parent='decks' then 'deckparts' else regexp_replace(head.parent,'/decks$','/dparts') end;
  end if;
  if head.path is null then return false; end if;
  select data into schedule from public.ph_docs where path=srs_parent||'/'||deck and not deleted;
  if schedule is null then return false; end if;

  return (with parts(cards) as (
    select head.data->'cards' where coalesce(oplot.num(head.data->>'parts'),0)=0 union all
    select p.data->'cards' from public.ph_docs p where p.parent=part_parent and not p.deleted
      and p.data->>'deck'=deck and oplot.num(p.data->>'k')>=0 and oplot.num(p.data->>'k')<oplot.num(head.data->>'parts')
      and p.id=deck||'~'||(p.data->>'k')
  ), states as (
    select e.key,e.value from public.ph_docs s
    cross join lateral jsonb_each(case when jsonb_typeof(s.data->'s')='object' then s.data->'s' else '{}' end) e
    where s.parent=srs_parent and not s.deleted and (s.id=deck or
      (regexp_replace(s.id,'~[0-9]+$','')=deck and oplot.num(substring(s.id from '~([0-9]+)$')) between 1 and coalesce(oplot.num(schedule->>'shards'),1)-1))
  )
  select coalesce(bool_or(c->>'i'=last_card),false) and
    coalesce(bool_and(case when states.key is null then
      -- A standard daily queue includes up to twenty previously unseen cards.
      not full_deck and coalesce(schedule#>>'{nd,day}'=study_day and oplot.num(schedule#>>'{nd,n}')>=20,false)
      else coalesce(oplot.num(states.value->>3)>0 and (states.value->>0)>study_day,false) end),false)
  from parts cross join lateral jsonb_array_elements(oplot.arr(cards)) c left join states on states.key=c->>'i');
end $$;

create function oplot.on_finished_review() returns trigger language plpgsql security definer set search_path='' as $$
declare
  mark jsonb:=new.data->'oplotFinish';
  who text:=split_part(new.path,'/',2);
  deck text:=regexp_replace(new.id,'~[0-9]+$','');
  card text:=mark->>'card';
  study_day text:=mark->>'studyDay';
  ms numeric:=oplot.num(mark->>'ended');
  instant timestamptz:=clock_timestamp();
  target_day date:=oplot.first_raid(instant);
  rated jsonb:=new.data->'s'->card;
begin
  if ms is null or abs(ms-extract(epoch from instant)*1000)>86400000 then return null; end if;
  if oplot.first_raid(to_timestamp((ms/1000)::float8))<>target_day then return null; end if;
  if card is null or study_day is null or study_day not between ((instant at time zone 'UTC')::date-1)::text and ((instant at time zone 'UTC')::date+1)::text then return null; end if;
  if not coalesce(oplot.num(rated->>3)>0 and (rated->>0)>study_day,false)
    or (tg_op='UPDATE' and (old.data->'s'->card) is not distinct from rated) then return null; end if;
  if exists(select 1 from oplot.scout_passes p where p.uid=who and p.raid_day>=target_day) then return null; end if;
  if oplot.scout_deck_complete(who,deck,card,study_day,coalesce(mark->'full'='true'::jsonb,false)) then
    insert into oplot.scout_passes as p values(who,target_day)
      on conflict(uid) do update set raid_day=excluded.raid_day where p.raid_day<excluded.raid_day;
  end if;
  return null;
end $$;
revoke all on function oplot.scout_deck_complete(text,text,text,text,boolean),oplot.on_finished_review() from public,anon,authenticated;
create trigger oplot_finished_review after insert or update of data on public.ph_docs
  for each row when (not new.deleted and new.data ? 'oplotFinish' and new.path ~ '^srs/[^/]+/decks/[^/]+$')
  execute function oplot.on_finished_review();

create function public.ph_oplot_scout(p_code text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  who text:=oplot.island_owner(p_code);
  target_day date:=oplot.first_raid(statement_timestamp());
  unlocked boolean;
begin
  select exists(select from oplot.scout_passes p where p.uid=who and p.raid_day=target_day) into unlocked;
  return jsonb_build_object('day',target_day,'at',oplot.raid_at(target_day),'unlocked',unlocked)
    || case when unlocked then jsonb_build_object('entrySide',oplot.raid_seed(who,target_day)%4) else '{}'::jsonb end;
end $$;
revoke all on function public.ph_oplot_scout(text) from public;
grant execute on function public.ph_oplot_scout(text) to anon,authenticated,service_role;
