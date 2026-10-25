-- 1) Трекер ШАД: коллекция 'shad', читать и писать может только учитель.
-- 2) Исправление: без кода роль = NULL, и проверки давали NULL вместо false. Теперь coalesce(..., false).
create or replace function public._bv_can(p_code text, p_col text, p_id text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare w record; r boolean;
begin
  select * into w from _bv_who(p_code);
  if p_col = 'kedits' then r := (not p_write) or w.role = 'admin';
  elsif p_col = 'students' then r := w.role = 'admin' or (w.role = 'student' and p_id = w.uid);
  elsif p_col = 'shad' then r := w.role = 'admin';
  else r := false;
  end if;
  return coalesce(r, false);
end $$;

create or replace function public.bv_list(p_code text, p_col text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _bv_who(p_code);
  if not coalesce(p_col = 'kedits' or (p_col in ('students','shad') and w.role = 'admin'), false) then
    raise exception 'denied' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data) order by updated_at)
                   from bv_docs where col = p_col), '[]'::jsonb);
end $$;

revoke execute on function public._bv_can(text,text,text,boolean) from public, anon, authenticated;
