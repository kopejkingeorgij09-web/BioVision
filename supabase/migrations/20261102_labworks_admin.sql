-- Лабораторные работы и возможности руководителя (2 ноября 2026).
-- Новые коллекции в bv_docs:
--   labworks  лабораторные работы: читать могут все, писать только учитель;
--   labfiles  фотографии к работам (одна фотография = один документ), права те же;
--   site      настройки сайта: объявление на главной, скрытые лекции. Права те же.
-- Прогресс участников лежит в уже существующей коллекции students (участник пишет свой документ,
-- учитель читает все), поэтому для него ничего менять не нужно.
-- Новая функция bv_code_rename: учитель переименовывает участника, код остаётся прежним.

create or replace function public._bv_can(p_code text, p_col text, p_id text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare w record; r boolean;
begin
  select * into w from _bv_who(p_code);
  if p_col in ('kedits','labworks','labfiles','site') then r := (not p_write) or w.role = 'admin';
  elsif p_col = 'students' then r := w.role = 'admin' or (w.role = 'student' and p_id = w.uid);
  elsif p_col in ('shad','bamboo') then r := w.role = 'admin';
  else r := false;
  end if;
  return coalesce(r, false);
end $$;

-- labfiles списком не отдаём: фотографии тяжёлые, их читают по одной через bv_get.
create or replace function public.bv_list(p_code text, p_col text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if not coalesce(p_col in ('kedits','labworks','site') or (p_col in ('students','shad','bamboo') and w.role = 'admin'), false) then
    raise exception 'denied' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data) order by updated_at)
                   from bv_docs where col = p_col), '[]'::jsonb);
end $$;

create or replace function public.bv_code_rename(p_code text, p_id text, p_name text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if w.role is distinct from 'admin' then raise exception 'denied' using errcode = '42501'; end if;
  update bv_students set name = left(trim(coalesce(p_name,'')), 40) where id = p_id;
  return found;
end $$;

revoke execute on function public._bv_can(text,text,text,boolean) from public, anon, authenticated;
revoke execute on function public.bv_code_rename(text,text,text) from public;
grant execute on function public.bv_code_rename(text,text,text) to anon, authenticated;
