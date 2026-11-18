-- The teacher may switch to their linked personal student profile. Bind to its existing UID.
create or replace function public.ph_dragon_wallet(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare w record; wallet jsonb;
begin
 select * into w from public._ph_who(p_code); if w.lv is null or not exists(select from public.ph_students p where p.uid=w.uid) then raise exception 'Требуется ученический профиль' using errcode='42501';end if;
 perform dragon_island.credit(w.uid,(select data->'days' from public.ph_docs where path='srs/'||w.uid||'/meta/streak' and not deleted));
 wallet:=dragon_island.wallet(w.uid);
 return wallet||jsonb_build_object('balance',(wallet->>'credit')::bigint-coalesce((select (state->>'spent')::bigint from dragon_island.players where uid=w.uid),0));
end $$;
