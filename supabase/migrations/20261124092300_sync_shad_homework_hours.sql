-- The owner's planned homework slot is independent of the webinar slot.
create or replace function public._shad_personal_task_due() returns trigger
language plpgsql security definer set search_path = public as $$
declare slot jsonb; n text;
begin
  if new.data->'to' is distinct from jsonb_build_array(_shad_ph_uid())
     or coalesce(new.data->>'kind','') not in ('test','task')
     or coalesce(new.data->>'fix','false')='true' then
    new.data := new.data - 'studySlot';
    return new;
  end if;
  n := substring(new.data #>> '{lesson,eventId}' from '^shad-w([0-9]+)$');
  if n is null then
    new.data := new.data - 'studySlot';
    return new;
  end if;
  select data #> '{o,h}' into slot from bv_docs
    where col='shad' and id=case when length(n)=1 then 'w0' else 'w' end || n;
  new.data := (new.data - 'studySlot') || jsonb_build_object('due',coalesce(slot->>'date',''));
  if coalesce(slot->>'date','')<>'' and coalesce(slot->>'from','')<>'' then
    new.data := new.data || jsonb_build_object('studySlot',jsonb_strip_nulls(jsonb_build_object(
      'date',slot->>'date','from',slot->>'from','to',slot->>'to','endDate',slot->>'endDate')));
  end if;
  return new;
end $$;

drop trigger shad_personal_task_due on public.ph_docs;
create trigger shad_personal_task_due before insert or update of data on public.ph_docs
  for each row when (new.parent='tasks' and
    (new.data #>> '{lesson,eventId}' ~ '^shad-w[0-9]+$' or new.data ? 'studySlot'))
  execute function public._shad_personal_task_due();

create or replace function public._shad_personal_placement_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare event_id text;
begin
  event_id := 'shad-w'||substring((case when tg_op='DELETE' then old.id else new.id end) from '^w0?([1-9][0-9]*)$');
  -- The BEFORE trigger above derives the current date and interval on every matching task.
  update ph_docs set data=data, updated_at=now()
    where parent='tasks' and not deleted and data #>> '{lesson,eventId}'=event_id
      and data->'to'=jsonb_build_array(_shad_ph_uid())
      and data->>'kind' in ('test','task') and coalesce(data->>'fix','false')<>'true';
  return null;
end $$;
drop trigger shad_personal_placement_update on public.bv_docs;
create trigger shad_personal_placement_update after update of data on public.bv_docs
  for each row when (new.col='shad' and new.data #> '{o,h}' is distinct from old.data #> '{o,h}')
  execute function public._shad_personal_placement_changed();

update public.ph_docs t set data=t.data, updated_at=now()
from public.bv_docs b where b.col='shad' and b.id ~ '^w0?[1-9][0-9]*$'
 and b.data #>> '{o,h,from}'<>'' and t.parent='tasks' and not t.deleted
 and t.data #>> '{lesson,eventId}'='shad-w'||ltrim(substr(b.id,2),'0')
 and t.data->'to'=jsonb_build_array(public._shad_ph_uid())
 and t.data->>'kind' in ('test','task') and coalesce(t.data->>'fix','false')<>'true';
