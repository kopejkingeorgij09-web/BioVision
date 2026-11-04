-- Мост «Фаги» ↔ «Зов леса» (04.11.2026, по просьбе владельца). Фаги — учёба, «Зов леса» — планирование.
--
-- 1) Лента с Фагов для «Зова леса»: коллекция bv_docs col 'phx' (читает только учитель, пишет только сервер).
--    ev_<id>   занятие из расписания Фагов (кроме вебов ШАДа): {title,date,start,end,repeat,until,skip,subject,role}
--              role 'learn' — занятие Георгия как ученика, 'teach' — урок с ученицами;
--    dl_<id>   срок задания Георгию: {title,due,subject,kind,shad,fix,done,doneAt,checked,score,max};
--    day_<дата> что было на Фагах за день (по Москве): {cards, subs:[названия], grades:[{t,score,max}]}.
-- 2) Задачи «Зова леса» (bv_docs col 'bamboo', t_<id>) ↔ дела Георгия на Фагах (ph_docs data/users/<uid>/bt_<id>):
--    название, срок (на Фагах — неделя wk и день due), отметка, удаление. Значения сравниваются, поэтому без петель.
-- 3) Этап веба ШАДа с Фагов: ph_docs data/users/<uid>/shadst-w<n> {s} → отметка shad/wNN (дальше работают прежние триггеры).
-- 4) Привычка «англ карточки» в «Зове леса» отмечается сама по карточкам, повторённым на Фагах (auto 'cards', от 10 за день).
-- Нужны миграции 20261104_shad_phagi_sync.sql (функция _shad_ph_uid) и 20261104b_shad_phagi_tracker.sql.

create or replace function public._msk_today() returns text language sql stable as $$
  select to_char((now() at time zone 'Europe/Moscow')::date, 'YYYY-MM-DD') $$;
create or replace function public._monday(d text) returns text language sql immutable as $$
  select case when coalesce(d, '') = '' then '' else to_char(date_trunc('week', d::date)::date, 'YYYY-MM-DD') end $$;

create or replace function public._phx_put(p_id text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_data is null then delete from bv_docs where col = 'phx' and id = p_id; return; end if;
  insert into bv_docs(col, id, data, updated_at) values ('phx', p_id, p_data, now())
  on conflict (col, id) do update set data = excluded.data, updated_at = now() where bv_docs.data is distinct from excluded.data;
end $$;

-- занятие из расписания Фагов
create or replace function public._phx_event(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare e jsonb; del boolean;
begin
  if p_id like 'shad-w%' then return; end if;
  select data, deleted into e, del from ph_docs where path = 'events/' || p_id;
  if e is null or del then perform _phx_put('ev_' || p_id, null); return; end if;
  perform _phx_put('ev_' || p_id, jsonb_build_object('title', coalesce(e->>'title', ''), 'date', coalesce(e->>'date', ''),
    'start', coalesce(e->>'start', ''), 'end', coalesce(e->>'end', ''), 'repeat', coalesce(e->>'repeat', 'none'),
    'until', coalesce(e->>'until', ''), 'skip', coalesce(e->'skip', '[]'::jsonb), 'subject', coalesce(e->>'subject', ''),
    'role', case when coalesce(e->'to', '[]'::jsonb) ? _shad_ph_uid() then 'learn' else 'teach' end));
end $$;

-- срок задания Георгию и его состояние
create or replace function public._phx_task(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare t jsonb; del boolean; s jsonb; g jsonb; cur jsonb; g_uid text := _shad_ph_uid(); done boolean; mx numeric;
begin
  select data, deleted into t, del from ph_docs where path = 'tasks/' || p_id;
  if t is null or del or not (coalesce(t->'to', '[]'::jsonb) ? g_uid) or coalesce(t->>'kind', '') not in ('test', 'task')
     or coalesce(t->>'due', '') = '' then
    perform _phx_put('dl_' || p_id, null); return;
  end if;
  select data into s from ph_docs where path = 'subs/' || g_uid || '/items/' || p_id and not deleted;
  select data into g from ph_docs where path = 'grades/' || g_uid || '/items/' || p_id and not deleted;
  select data into cur from bv_docs where col = 'phx' and id = 'dl_' || p_id;
  done := coalesce(s->>'status', '') = 'submitted';
  mx := case when t->>'kind' = 'test' then (select sum(coalesce((q->>'pts')::numeric, 1)) from jsonb_array_elements(coalesce(t->'q', '[]'::jsonb)) q)
             else nullif(t->>'max', '')::numeric end;
  perform _phx_put('dl_' || p_id, jsonb_build_object('title', coalesce(t->>'title', ''), 'due', t->>'due', 'subject', coalesce(t->>'subject', ''),
    'kind', t->>'kind', 'shad', nullif(substring(coalesce(t->'lesson'->>'eventId', '') from '^shad-w(\d+)$'), '')::int,
    'fix', coalesce((t->>'fix')::boolean, false), 'done', done,
    'doneAt', case when done then coalesce(nullif(cur->>'doneAt', ''), _msk_today()) else '' end,
    'checked', (g->>'score') is not null or (t->>'kind' = 'test' and done),
    'score', coalesce(g->'score', case when t->>'kind' = 'test' and done then s->'auto' end), 'max', mx));
end $$;

-- запись в итоги дня: k = 'subs' | 'grades' (массив без повторов) или 'cards' (число)
create or replace function public._phx_day(p_date text, k text, v jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur jsonb; nd jsonb;
begin
  select data into cur from bv_docs where col = 'phx' and id = 'day_' || p_date;
  cur := coalesce(cur, '{}'::jsonb);
  if k = 'cards' then nd := cur || jsonb_build_object('cards', v);
  elsif coalesce(cur->k, '[]'::jsonb) @> jsonb_build_array(v) then return;
  else nd := cur || jsonb_build_object(k, coalesce(cur->k, '[]'::jsonb) || jsonb_build_array(v));
  end if;
  perform _phx_put('day_' || p_date, nd);
end $$;

-- задача «Зова леса» → дело Георгия на Фагах
create or replace function public._bt_out(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare b jsonb; tid text; p text; cur jsonb; cdel boolean; d jsonb; g_uid text := _shad_ph_uid();
begin
  tid := substring(p_id from 3);
  p := 'data/users/' || g_uid || '/bt_' || tid;
  select data into b from bv_docs where col = 'bamboo' and id = p_id;
  select data, deleted into cur, cdel from ph_docs where path = p;
  if b is null or coalesce((b->>'deleted')::boolean, false) then
    if cur is not null and not cdel then update ph_docs set deleted = true, updated_at = clock_timestamp() where path = p; end if;
    return;
  end if;
  d := jsonb_build_object('kind', 'todo', 'src', 'bamboo', 'text', coalesce(b->>'title', ''), 'due', coalesce(b->>'due', ''),
    'time', coalesce(b->>'time', ''), 'wk', _monday(b->>'due'), 'done', coalesce((b->>'done')::boolean, false),
    'doneAt', coalesce(b->'doneAt', '0'::jsonb), 'ord', coalesce(b->'ord', '0'::jsonb), 'proj', coalesce(b->>'proj', 'inbox'));
  if cur is null then
    insert into ph_docs(path, parent, id, data) values (p, 'data/users/' || g_uid, 'bt_' || tid,
      d || jsonb_build_object('createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  elsif cdel or cur->>'text' is distinct from d->>'text' or cur->>'due' is distinct from d->>'due' or cur->>'wk' is distinct from d->>'wk'
        or (cur->>'done')::boolean is distinct from (d->>'done')::boolean or cur->>'time' is distinct from d->>'time' then
    update ph_docs set data = cur || d, deleted = false, updated_at = clock_timestamp() where path = p;
  end if;
end $$;

-- дело на Фагах → задача «Зова леса»
create or replace function public._bt_in(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare r record; tid text; b jsonb; wk text; due text; t text := _msk_today(); dn boolean; ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select data, deleted, id into r from ph_docs where path = p_path;
  if r is null then return; end if;
  tid := substring(r.id from 4);
  select data into b from bv_docs where col = 'bamboo' and id = 't_' || tid;
  if r.deleted then
    if b is not null and not coalesce((b->>'deleted')::boolean, false) then
      update bv_docs set data = data || '{"deleted": true}'::jsonb, updated_at = now() where col = 'bamboo' and id = 't_' || tid;
    end if;
    return;
  end if;
  wk := coalesce(r.data->>'wk', '');
  due := case when wk = '' then ''
              when b is not null and _monday(b->>'due') = wk then b->>'due'
              when t >= wk and t <= to_char(wk::date + 6, 'YYYY-MM-DD') then t
              else wk end;
  dn := coalesce((r.data->>'done')::boolean, false);
  if b is null then
    insert into bv_docs(col, id, data, updated_at) values ('bamboo', 't_' || tid, jsonb_build_object('id', tid, 'title', coalesce(r.data->>'text', ''),
      'proj', 'inbox', 'pri', 4, 'due', due, 'time', '', 'est', 0, 'done', dn, 'status', case when dn then 'done' else 'todo' end,
      'big', false, 'subs', '[]'::jsonb, 'notes', '', 'created', ms, 'postpones', '[]'::jsonb, 'ord', coalesce(r.data->'ord', '0'::jsonb),
      'doneAt', case when dn then to_jsonb(ms) else 'null'::jsonb end, 'src', 'phagi'), now());
  elsif coalesce((b->>'deleted')::boolean, false) or b->>'title' is distinct from r.data->>'text' or coalesce(b->>'due', '') is distinct from due
        or coalesce((b->>'done')::boolean, false) is distinct from dn then
    update bv_docs set data = data || jsonb_build_object('title', coalesce(r.data->>'text', ''), 'due', due, 'done', dn, 'deleted', false,
        'status', case when dn then 'done' when b->>'status' = 'done' then 'todo' else coalesce(b->>'status', 'todo') end,
        'doneAt', case when dn then coalesce(nullif(b->'doneAt', 'null'::jsonb), to_jsonb(ms)) else 'null'::jsonb end), updated_at = now()
    where col = 'bamboo' and id = 't_' || tid;
  end if;
end $$;

-- один триггер на ph_docs раздаёт изменения
create or replace function public._phx_ph_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text[]; g_uid text := _shad_ph_uid(); n int; d text; title text; ms bigint := (extract(epoch from now()) * 1000)::bigint; b jsonb;
begin
  p := string_to_array(new.path, '/');
  if p[1] = 'events' and array_length(p, 1) = 2 then perform _phx_event(p[2]);
  elsif p[1] = 'tasks' and array_length(p, 1) = 2 then perform _phx_task(p[2]);
  elsif p[1] in ('subs', 'grades') and array_length(p, 1) = 4 and p[2] = g_uid and p[3] = 'items' then
    perform _phx_task(p[4]);
    select data->>'title' into title from ph_docs where path = 'tasks/' || p[4];
    if title is not null and not new.deleted then
      if p[1] = 'subs' and new.data->>'status' = 'submitted' and (tg_op = 'INSERT' or coalesce(old.data->>'status', '') <> 'submitted') then
        perform _phx_day(_msk_today(), 'subs', to_jsonb(title));
      elsif p[1] = 'grades' and (new.data->>'score') is not null and (tg_op = 'INSERT' or old.data->>'returnedAt' is distinct from new.data->>'returnedAt') then
        perform _phx_day(_msk_today(), 'grades', jsonb_build_object('t', title, 'score', new.data->'score', 'max',
          (select data->'max' from bv_docs where col = 'phx' and id = 'dl_' || p[4])));
      end if;
    end if;
  elsif new.path = 'srs/' || g_uid || '/meta/streak' then
    for d in select jsonb_object_keys(coalesce(new.data->'days', '{}'::jsonb)) loop
      if tg_op = 'INSERT' or (old.data->'days'->d) is distinct from (new.data->'days'->d) then
        perform _phx_day(d, 'cards', new.data->'days'->d);
      end if;
    end loop;
  elsif p[1] = 'data' and p[2] = 'users' and p[3] = g_uid and array_length(p, 1) = 4 then
    if p[4] like 'bt\_%' then perform _bt_in(new.path);
    elsif p[4] like 'shadst-w%' and not new.deleted then
      n := nullif(substring(p[4] from '^shadst-w(\d+)$'), '')::int;
      if n is not null and (new.data->>'s') is not null then
        select data into b from bv_docs where col = 'shad' and id = 'w' || lpad(n::text, 2, '0');
        if b is null then
          insert into bv_docs(col, id, data, updated_at) values ('shad', 'w' || lpad(n::text, 2, '0'),
            jsonb_build_object('s', (new.data->>'s')::int, 'note', '', 'at', ms), now());
        elsif coalesce((b->>'s')::int, 0) is distinct from (new.data->>'s')::int then
          update bv_docs set data = data || jsonb_build_object('s', (new.data->>'s')::int, 'at', ms), updated_at = now()
          where col = 'shad' and id = 'w' || lpad(n::text, 2, '0');
        end if;
      end if;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists phx_ph on public.ph_docs;
create trigger phx_ph after insert or update on public.ph_docs
  for each row when (new.path like 'events/%' or new.path like 'tasks/%' or new.path like 'subs/%' or new.path like 'grades/%'
                     or new.path like 'srs/%/meta/streak' or new.path like 'data/users/%')
  execute function public._phx_ph_trg();

create or replace function public._phx_ph_del_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text[];
begin
  p := string_to_array(old.path, '/');
  if p[1] = 'events' and array_length(p, 1) = 2 then perform _phx_put('ev_' || p[2], null);
  elsif p[1] = 'tasks' and array_length(p, 1) = 2 then perform _phx_put('dl_' || p[2], null);
  elsif p[1] = 'data' and p[3] = _shad_ph_uid() and p[4] like 'bt\_%' then
    update bv_docs set data = data || '{"deleted": true}'::jsonb, updated_at = now()
    where col = 'bamboo' and id = 't_' || substring(p[4] from 4) and not coalesce((data->>'deleted')::boolean, false);
  end if;
  return null;
end $$;
drop trigger if exists phx_ph_del on public.ph_docs;
create trigger phx_ph_del after delete on public.ph_docs
  for each row when (old.path like 'events/%' or old.path like 'tasks/%' or old.path like 'data/users/%')
  execute function public._phx_ph_del_trg();

-- задачи «Зова леса» → Фаги
create or replace function public._bt_bv_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update ph_docs set deleted = true, updated_at = clock_timestamp()
    where path = 'data/users/' || _shad_ph_uid() || '/bt_' || substring(old.id from 3) and not deleted;
    return null;
  end if;
  perform _bt_out(new.id);
  return null;
end $$;
drop trigger if exists bt_bv on public.bv_docs;
create trigger bt_bv after insert or update on public.bv_docs
  for each row when (new.col = 'bamboo' and new.id like 't\_%') execute function public._bt_bv_trg();
drop trigger if exists bt_bv_del on public.bv_docs;
create trigger bt_bv_del after delete on public.bv_docs
  for each row when (old.col = 'bamboo' and old.id like 't\_%') execute function public._bt_bv_trg();

-- права: 'phx' читает только учитель, пишет только сервер
create or replace function public._bv_can(p_code text, p_col text, p_id text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare w record; r boolean;
begin
  select * into w from _bv_who(p_code);
  if p_col in ('kedits','labworks','labfiles','site') then r := (not p_write) or w.role = 'admin';
  elsif p_col = 'students' then r := w.role = 'admin' or (w.role = 'student' and p_id = w.uid);
  elsif p_col in ('shad','bamboo') then r := w.role = 'admin';
  elsif p_col in ('shadx','phx') then r := (not p_write) and w.role = 'admin';
  else r := false;
  end if;
  return coalesce(r, false);
end $$;

create or replace function public.bv_list(p_code text, p_col text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if not coalesce(p_col in ('kedits','labworks','site') or (p_col in ('students','shad','bamboo','shadx','phx') and w.role = 'admin'), false) then
    raise exception 'denied' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data) order by updated_at)
                   from bv_docs where col = p_col), '[]'::jsonb);
end $$;

-- заполнить сразу
do $$
declare r record;
begin
  for r in select id from ph_docs where parent = 'events' and not deleted and id not like 'shad-w%' loop perform _phx_event(r.id); end loop;
  for r in select id from ph_docs where parent = 'tasks' and not deleted loop perform _phx_task(r.id); end loop;
  for r in select id from bv_docs where col = 'bamboo' and id like 't\_%' and not coalesce((data->>'deleted')::boolean, false) loop perform _bt_out(r.id); end loop;
  -- дела Георгия, заведённые на Фагах до моста, становятся задачами «Зова леса»
  for r in select path, parent, id, data from ph_docs where parent = 'data/users/' || _shad_ph_uid() and not deleted
           and data->>'kind' = 'todo' and id not like 'bt\_%' loop
    insert into ph_docs(path, parent, id, data) values (r.parent || '/bt_' || r.id, r.parent, 'bt_' || r.id, r.data) on conflict (path) do nothing;
    update ph_docs set deleted = true, updated_at = clock_timestamp() where path = r.path;
  end loop;
  for r in select d.key, d.value from ph_docs s, jsonb_each(coalesce(s.data->'days', '{}'::jsonb)) d
           where s.path = 'srs/' || _shad_ph_uid() || '/meta/streak' and not s.deleted loop
    perform _phx_day(r.key, 'cards', r.value);
  end loop;
end $$;

-- «англ карточки» отмечается сама: от 10 карточек за день на Фагах (ручные отметки остаются)
update bv_docs set data = data || '{"auto": "cards", "min": 10}'::jsonb, updated_at = now()
where col = 'bamboo' and id like 'h\_%' and data->>'name' ilike '%карточ%' and coalesce(data->>'auto', '') = '';

revoke execute on function public._phx_put(text, jsonb) from public, anon, authenticated;
revoke execute on function public._phx_event(text) from public, anon, authenticated;
revoke execute on function public._phx_task(text) from public, anon, authenticated;
revoke execute on function public._phx_day(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public._bt_out(text) from public, anon, authenticated;
revoke execute on function public._bt_in(text) from public, anon, authenticated;
revoke execute on function public._phx_ph_trg() from public, anon, authenticated;
revoke execute on function public._phx_ph_del_trg() from public, anon, authenticated;
revoke execute on function public._bt_bv_trg() from public, anon, authenticated;
