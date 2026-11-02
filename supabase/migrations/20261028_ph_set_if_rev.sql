-- Применено 28.10.2026 по разрешению владельца, после снимка backup.ph_docs_20261028.
--
-- Зачем: ph_set пишет документ целиком, «последняя запись побеждает». Остров драконов (srs/<uid>/meta/dragons)
-- клиент теперь пишет с счётчиком rev и перед записью перечитывает документ (phagi/dragons/store.js),
-- но между чтением и записью другое устройство может успеть записать, и его запись пропадёт.
-- ph_set_if закрывает это окно: запись проходит, только если в базе лежит ровно та версия, от которой считал клиент.
--
-- p_rev, p_op: rev и op документа, от которого клиент считал (его «подтверждённое» состояние).
--   p_rev is null  → документа быть не должно (первая запись);
--   у старых документов без rev он считается 0, без op — null.
-- Новый документ обязан нести rev = p_rev + 1 (или 1 для первой записи).
-- Ответ: {"ok":true,"t":<время>} или {"ok":false,"cur":<документ в базе>} без записи.
-- Права те же, что у ph_set (_ph_ok на запись), ph_set не меняется.

create or replace function public.ph_set_if(p_code text, p_path text, p_data jsonb, p_rev int, p_op text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare w record; sp record; t timestamptz := clock_timestamp(); cur jsonb; cur_rev int; ins int;
begin
  select * into w from _ph_who(p_code);
  select * into sp from _ph_split(p_path);
  if not _ph_ok(w.lv, w.uid, p_path, true) then raise exception 'denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 400000 then raise exception 'bad body' using errcode = '22023'; end if;
  if jsonb_typeof(p_data -> 'rev') <> 'number' or (p_data ->> 'rev')::numeric <> coalesce(p_rev, 0) + 1 then
    raise exception 'bad rev' using errcode = '22023'; end if;

  -- строка документа под блокировкой до конца транзакции; если строки нет, вставка без данных занимает путь
  insert into ph_docs(path, parent, id, data, deleted, updated_at) values (p_path, sp.parent, sp.id, null, true, t)
  on conflict (path) do nothing;
  get diagnostics ins = row_count;
  select case when deleted then null else data end into cur from ph_docs where path = p_path for update;

  cur_rev := case when cur is null then null
                  when jsonb_typeof(cur -> 'rev') = 'number' then (cur ->> 'rev')::int else 0 end;
  if (cur is null) <> (p_rev is null)
     or (cur is not null and (cur_rev <> p_rev or (cur ->> 'op') is distinct from p_op)) then
    if ins = 1 then delete from ph_docs where path = p_path; end if;  -- занятый путь не оставляем
    return jsonb_build_object('ok', false, 'cur', cur);
  end if;

  update ph_docs set data = p_data, deleted = false, updated_at = t where path = p_path;
  return jsonb_build_object('ok', true, 't', t);
end $$;

revoke execute on function public.ph_set_if(text,text,jsonb,int,text) from public;
grant execute on function public.ph_set_if(text,text,jsonb,int,text) to anon, authenticated;

-- Откат: drop function public.ph_set_if(text,text,jsonb,int,text);
