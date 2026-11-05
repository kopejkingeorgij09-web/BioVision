-- Sync only the owner's personal SHAD homework. Keep existing shared triggers intact.
create function public._shad_personal_task_due() returns trigger
language plpgsql security definer set search_path = public as $$
declare due text; n text;
begin
  if new.data->'to' is distinct from jsonb_build_array(_shad_ph_uid())
    or coalesce(new.data->>'kind', '') not in ('test', 'task')
    or coalesce(new.data->>'fix', 'false') = 'true' then return new; end if;
  n := substring(new.data #>> '{lesson,eventId}' from '^shad-w([0-9]+)$');
  if n is null then return new; end if;
  select data #>> '{o,h,date}' into due from bv_docs
    where col = 'shad' and id = case when length(n) = 1 then 'w0' else 'w' end || n;
  new.data := jsonb_set(new.data, '{due}', to_jsonb(coalesce(due, '')));
  return new;
end $$;
revoke execute on function public._shad_personal_task_due() from public, anon, authenticated;

create trigger shad_personal_task_due before insert or update of data on public.ph_docs
  for each row when (new.parent = 'tasks' and new.data #>> '{lesson,eventId}' ~ '^shad-w[0-9]+$')
  execute function public._shad_personal_task_due();

create function public._shad_personal_placement_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare event_id text; due text;
begin
  event_id := 'shad-w' || substring((case when tg_op = 'DELETE' then old.id else new.id end) from '^w0?([1-9][0-9]*)$');
  due := case when tg_op = 'DELETE' then '' else coalesce(new.data #>> '{o,h,date}', '') end;
  update ph_docs set data = jsonb_set(data, '{due}', to_jsonb(due)), updated_at = now()
    where parent = 'tasks' and not deleted and data #>> '{lesson,eventId}' = event_id
      and data->'to' = jsonb_build_array(_shad_ph_uid())
      and data->>'kind' in ('test', 'task') and coalesce(data->>'fix', 'false') <> 'true'
      and data->>'due' is distinct from due;
  return null;
end $$;
revoke execute on function public._shad_personal_placement_changed() from public, anon, authenticated;

create trigger shad_personal_placement_insert after insert on public.bv_docs
  for each row when (new.col = 'shad' and new.data #>> '{o,h,date}' is not null)
  execute function public._shad_personal_placement_changed();
create trigger shad_personal_placement_update after update of data on public.bv_docs
  for each row when (new.col = 'shad' and (new.data #>> '{o,h,date}') is distinct from (old.data #>> '{o,h,date}'))
  execute function public._shad_personal_placement_changed();
create trigger shad_personal_placement_delete after delete on public.bv_docs
  for each row when (old.col = 'shad' and old.data #>> '{o,h,date}' is not null)
  execute function public._shad_personal_placement_changed();
