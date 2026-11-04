-- Связка «Фагов» с трекером ШАДа и «Зовом леса» (04.11.2026, по просьбе владельца).
--
-- ДЗ к вебу ШАДа на «Фагах» — это задания (tasks/<id>) с lesson.eventId = 'shad-w<n>'.
-- Занятие events/shad-w<n> — веб <n> из shad/plan.json (pdate, phw — даты веба и ДЗ по плану).
--
-- 1) Фаги → трекер. Когда Георгий сдал все основные задания веба, отметка shad/wNN
--    поднимается до «ДЗ решено» (s = 3). Когда сданы все задания работы над ошибками
--    (у задания поле fix = true) или основное ДЗ проверено без потерь, — до «Закрыт» (s = 4).
--    Стадия только растёт. Бонус за качество (до +10 опыта) лежит в bv_docs col 'shadx'
--    {b, score, max, at}: доля баллов по проверенному ДЗ, считается, когда всё проверено.
-- 2) Трекер → Фаги. Перенёс веб или срок ДЗ в «Зове леса» (shad/wNN поле o),
--    и занятие на «Фагах» переезжает, а задания веба меняют дату занятия и срок.

-- профиль Георгия на «Фагах»: только его сдачи двигают его лес
create or replace function public._shad_ph_uid() returns text language sql immutable as $$ select 'u_a7f09iDQmUe0Pa3S8bZuYQ'::text $$;

create or replace function public._shad_ph_stage(p_uid text, p_ev text) returns void
language plpgsql security definer set search_path = public as $$
declare
  n int; tot int; sub int; ftot int; fsub int; graded boolean; sc numeric; mx numeric;
  s_new int; b int; cur jsonb; cs int; id_ text; ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  n := nullif(substring(p_ev from '^shad-w(\d+)$'), '')::int;
  if n is null or p_uid <> _shad_ph_uid() then return; end if;
  with t as (
    select d.id, d.data, coalesce((d.data->>'fix')::boolean, false) fx
    from ph_docs d
    where d.parent = 'tasks' and not d.deleted and d.data->'lesson'->>'eventId' = p_ev
      and d.data->'to' ? p_uid and d.data->>'kind' in ('test', 'task')
  ), x as (
    select t.*, s.data sd, g.data gd,
      case when t.data->>'kind' = 'test'
           then (select sum(coalesce((q->>'pts')::numeric, 1)) from jsonb_array_elements(t.data->'q') q)
           else (t.data->>'max')::numeric end tmax
    from t
    left join ph_docs s on s.path = 'subs/' || p_uid || '/items/' || t.id and not s.deleted
    left join ph_docs g on g.path = 'grades/' || p_uid || '/items/' || t.id and not g.deleted
  )
  select count(*) filter (where not fx),
         count(*) filter (where not fx and sd->>'status' = 'submitted'),
         count(*) filter (where fx),
         count(*) filter (where fx and sd->>'status' = 'submitted'),
         coalesce(bool_and((gd->>'score') is not null or (data->>'kind' = 'test' and sd->>'status' = 'submitted')) filter (where not fx), false),
         sum(coalesce((gd->>'score')::numeric, case when data->>'kind' = 'test' and sd->>'status' = 'submitted' then (sd->>'auto')::numeric end)) filter (where not fx),
         sum(tmax) filter (where not fx)
    into tot, sub, ftot, fsub, graded, sc, mx
  from x;

  if tot = 0 or sub < tot then return; end if;
  s_new := 3;
  if (ftot > 0 and fsub = ftot) or (ftot = 0 and graded and mx > 0 and sc >= mx) then s_new := 4; end if;

  id_ := 'w' || lpad(n::text, 2, '0');
  select data into cur from bv_docs where col = 'shad' and id = id_;
  cs := coalesce((cur->>'s')::int, 0);
  if cur is null then
    insert into bv_docs(col, id, data, updated_at) values ('shad', id_, jsonb_build_object('s', s_new, 'note', '', 'at', ms), now());
  elsif s_new > cs then
    update bv_docs set data = data || jsonb_build_object('s', s_new, 'at', ms), updated_at = now() where col = 'shad' and id = id_;
  end if;

  if graded and mx > 0 then
    b := greatest(0, least(10, round(10 * sc / mx)))::int;
    insert into bv_docs(col, id, data, updated_at)
      values ('shadx', id_, jsonb_build_object('b', b, 'score', sc, 'max', mx, 'at', ms), now())
    on conflict (col, id) do update set data = excluded.data, updated_at = now()
      where (bv_docs.data->>'b')::int is distinct from b or (bv_docs.data->>'score')::numeric is distinct from sc;
  end if;
end $$;

create or replace function public._shad_ph_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text[]; ev text;
begin
  p := string_to_array(new.path, '/');
  if array_length(p, 1) <> 4 or p[1] not in ('subs', 'grades') or p[3] <> 'items' then return null; end if;
  select data->'lesson'->>'eventId' into ev from ph_docs where path = 'tasks/' || p[4] and not deleted;
  if ev like 'shad-w%' then perform _shad_ph_stage(p[2], ev); end if;
  return null;
end $$;

drop trigger if exists shad_ph_sync on public.ph_docs;
create trigger shad_ph_sync after insert or update on public.ph_docs
  for each row when (new.path like 'subs/%/items/%' or new.path like 'grades/%/items/%')
  execute function public._shad_ph_trg();

create or replace function public._shad_bv_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; ev text; e jsonb; nd text; nt text; ne text; nh text; iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  n := nullif(substring(new.id from '^w(\d+)$'), '')::int;
  if n is null then return null; end if;
  ev := 'shad-w' || n;
  select data into e from ph_docs where path = 'events/' || ev and not deleted;
  if e is null then return null; end if;
  nd := coalesce(new.data->'o'->'w'->>'date', e->>'pdate', e->>'date');
  nt := coalesce(new.data->'o'->'w'->>'from', '');
  ne := coalesce(new.data->'o'->'w'->>'to', '');
  nh := coalesce(new.data->'o'->'h'->>'date', e->>'phw');
  if nd is distinct from e->>'date' or nt is distinct from coalesce(e->>'start', '') or ne is distinct from coalesce(e->>'end', '')
     or (nh is not null and position('ДЗ к ' || substr(nh, 9, 2) || '.' || substr(nh, 6, 2) || '.' in coalesce(e->>'note', '')) = 0) then
    update ph_docs set data = data || jsonb_build_object('date', nd, 'start', nt, 'end', ne, 'updatedAt', iso,
        'note', case when nh is null then coalesce(data->>'note', '')
                     else regexp_replace(coalesce(data->>'note', ''), 'ДЗ к \d\d\.\d\d\.', 'ДЗ к ' || substr(nh, 9, 2) || '.' || substr(nh, 6, 2) || '.') end),
      updated_at = now()
    where path = 'events/' || ev;
  end if;
  update ph_docs set data = jsonb_set(data, '{lesson,date}', to_jsonb(nd)) || jsonb_build_object('updatedAt', iso), updated_at = now()
  where parent = 'tasks' and not deleted and data->'lesson'->>'eventId' = ev and data->'lesson'->>'date' is distinct from nd;
  if nh is not null then
    update ph_docs set data = data || jsonb_build_object('due', nh, 'updatedAt', iso), updated_at = now()
    where parent = 'tasks' and not deleted and data->'lesson'->>'eventId' = ev
      and not coalesce((data->>'fix')::boolean, false) and data->>'due' is distinct from nh;
  end if;
  return null;
end $$;

drop trigger if exists shad_bv_sync on public.bv_docs;
create trigger shad_bv_sync after insert or update on public.bv_docs
  for each row when (new.col = 'shad') execute function public._shad_bv_trg();

revoke execute on function public._shad_ph_stage(text, text) from public, anon, authenticated;
revoke execute on function public._shad_ph_trg() from public, anon, authenticated;
revoke execute on function public._shad_bv_trg() from public, anon, authenticated;

-- бонус 'shadx' читает только учитель (пишет его только сервер)
create or replace function public._bv_can(p_code text, p_col text, p_id text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare w record; r boolean;
begin
  select * into w from _bv_who(p_code);
  if p_col in ('kedits','labworks','labfiles','site') then r := (not p_write) or w.role = 'admin';
  elsif p_col = 'students' then r := w.role = 'admin' or (w.role = 'student' and p_id = w.uid);
  elsif p_col in ('shad','bamboo') then r := w.role = 'admin';
  elsif p_col = 'shadx' then r := (not p_write) and w.role = 'admin';
  else r := false;
  end if;
  return coalesce(r, false);
end $$;

create or replace function public.bv_list(p_code text, p_col text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if not coalesce(p_col in ('kedits','labworks','site') or (p_col in ('students','shad','bamboo','shadx') and w.role = 'admin'), false) then
    raise exception 'denied' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data) order by updated_at)
                   from bv_docs where col = p_col), '[]'::jsonb);
end $$;
