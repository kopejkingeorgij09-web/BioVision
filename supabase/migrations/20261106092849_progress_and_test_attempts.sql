-- Preserve the dates of reached SHAD stages across all writers of the shared document.
create function public._bv_shad_stage_dates() returns trigger
language plpgsql set search_path = '' as $$
declare
  previous jsonb := '{}'::jsonb;
  dates jsonb := '{}'::jsonb;
  stage int := least(4, greatest(0, coalesce((new.data->>'s')::int, 0)));
  old_stage int;
  reached jsonb;
  stamp jsonb := to_jsonb(floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
begin
  if tg_op = 'UPDATE' then previous := old.data; end if;
  old_stage := least(4, greatest(0, coalesce((previous->>'s')::int, 0)));
  for i in 1..stage loop
    if i <= old_stage then
      reached := coalesce(previous->'stageAt'->i::text, previous->'at');
    else
      reached := stamp;
    end if;
    if jsonb_typeof(reached) = 'number' then
      dates := dates || jsonb_build_object(i::text, reached);
    end if;
  end loop;
  new.data := jsonb_set(new.data, '{stageAt}', dates);
  return new;
end;
$$;

revoke execute on function public._bv_shad_stage_dates() from public, anon, authenticated;
create trigger bv_shad_stage_dates before insert or update on public.bv_docs
  for each row when (new.col = 'shad' and new.id ~ '^w[0-9]+$' and new.data is not null)
  execute function public._bv_shad_stage_dates();

-- Use the existing private per-student document permissions. Only the teacher can write the archive.
insert into public.ph_rules(path, rd, wr) values ('subs/{self}/attempts', 'interact', 'owner');

create function public.ph_test_retake(p_code text, p_uid text, p_task text, p_attempt text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caller record;
  test jsonb;
  submission jsonb;
  grade jsonb;
  sub_path text := 'subs/' || p_uid || '/items/' || p_task;
  grade_path text := 'grades/' || p_uid || '/items/' || p_task;
  archive_col text := 'subs/' || p_uid || '/attempts';
  archive_id text := md5(p_task || ':' || p_attempt);
  archive_path text := archive_col || '/' || archive_id;
  archived jsonb;
  archived_at timestamptz;
begin
  select * into caller from public._ph_who(p_code);
  if caller.lv is distinct from 4 or caller.uid is null then
    raise exception 'denied' using errcode = '42501';
  end if;
  if p_uid is null or p_task is null or p_attempt is null
     or p_uid !~ '^[A-Za-z0-9_.~:@+-]{1,150}$' or p_task !~ '^[A-Za-z0-9_.~:@+-]{1,150}$' then
    raise exception 'bad attempt' using errcode = '22023';
  end if;

  select data into submission from public.ph_docs where path = sub_path for update;
  select data, updated_at into archived, archived_at from public.ph_docs where path = archive_path and not deleted;
  if found then
    -- A retried request never resets a newer submission or draft.
    return jsonb_build_object('archived', archived, 'path', archive_path, 'at', archived_at, 'reset', false);
  end if;
  if submission->>'status' is distinct from 'submitted'
     or submission->>'updatedAt' is distinct from p_attempt then
    raise exception 'attempt changed' using errcode = '40001';
  end if;

  select data into test from public.ph_docs where path = 'tasks/' || p_task and not deleted;
  if not found then
    select data into test from public.ph_docs
      where id = p_task and parent ~ '^assign/[^/]+/tasks$' and not deleted
        and data->'to' ? p_uid limit 1;
  end if;
  if test->>'kind' is distinct from 'test' or not coalesce(test->'to' ? p_uid, false) then
    raise exception 'test unavailable' using errcode = '22023';
  end if;
  select data into grade from public.ph_docs where path = grade_path and not deleted for update;

  archived_at := clock_timestamp();
  archived := jsonb_build_object('task', p_task, 'submission', submission, 'grade', grade, 'questions', test->'q');
  insert into public.ph_docs(path, parent, id, data, updated_at)
    values (archive_path, archive_col, archive_id, archived, archived_at);
  update public.ph_docs set data = null, deleted = true, updated_at = archived_at
    where path in (sub_path, grade_path) and not deleted;
  return jsonb_build_object('archived', archived, 'path', archive_path, 'at', archived_at, 'reset', true);
end;
$$;

revoke execute on function public.ph_test_retake(text, text, text, text) from public, anon, authenticated;
grant execute on function public.ph_test_retake(text, text, text, text) to anon, authenticated;
