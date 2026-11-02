-- ПРЕДЛОЖЕНИЕ, НЕ ПРИМЕНЕНО. Шаг 3 плана CAS-PLAN-RU.md: только после того, как ph_set_if применена
-- и все открытые страницы получили клиент с PHCLOUD.CAS = true (подняты ?v=, прошло время на обновление кеша).
--
-- Зачем: старая вкладка (страница до CAS) пишет остров обычным ph_set и затирает чужую запись без проверки.
-- После этого шага ph_set для острова драконов отказывает, если запись не продолжает счётчик rev документа в базе.
-- Старая вкладка получит ошибку записи и покажет «Повторить / Отменить», а не перезапишет остров молча.
-- Остальные документы платформы ph_set пишет как раньше.

create or replace function public.ph_set(p_code text, p_path text, p_data jsonb) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare w record; sp record; t timestamptz := clock_timestamp(); cur jsonb; cur_rev int;
begin
  select * into w from _ph_who(p_code);
  select * into sp from _ph_split(p_path);
  if not _ph_ok(w.lv, w.uid, p_path, true) then raise exception 'denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 400000 then raise exception 'bad body' using errcode = '22023'; end if;
  if p_path like 'srs/%/meta/dragons' then
    select case when deleted then null else data end into cur from ph_docs where path = p_path for update;
    cur_rev := case when cur is null then 0 when jsonb_typeof(cur -> 'rev') = 'number' then (cur ->> 'rev')::int else 0 end;
    if jsonb_typeof(p_data -> 'rev') <> 'number' or (p_data ->> 'rev')::int <> cur_rev + 1 then
      raise exception 'stale rev' using errcode = '40001'; end if;
  end if;
  insert into ph_docs(path, parent, id, data, deleted, updated_at) values (p_path, sp.parent, sp.id, p_data, false, t)
  on conflict (path) do update set data = excluded.data, deleted = false, updated_at = t;
  return t;
end $$;

-- Откат: прежнее тело ph_set из supabase/migrations/20261026_phagi_core.sql (строки 131–142).
