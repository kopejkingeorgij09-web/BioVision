-- ПРЕДЛОЖЕНИЕ, НЕ ПРИМЕНЕНО: применять только с разрешения владельца.
-- 28.10.2026: вход по ученическому коду Георгия (тот же профиль, что у учителя) сообщает teach:true.
-- Права не меняются: учительские данные открывает только код учителя (lv = 4). Поле нужно странице,
-- чтобы показать переключатель «Учитель / Ученик» и попросить код учителя, а не прятать переключатель.
create or replace function public.ph_login(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from _ph_who(p_code);
  if w.lv is null then return null; end if;
  return jsonb_build_object('id', w.uid, 'isOwner', w.lv = 4, 'name', w.uname,
    'teach', w.uid is not null and w.uid = (select a.uid from ph_admin a where a.id = 1));
end $$;
-- Откат: прежнее тело без поля teach (supabase/migrations/20261026_phagi_core.sql).
