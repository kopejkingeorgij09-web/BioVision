-- Game state is writable only by the authenticated game service. No legacy data migration.
create schema dragon_island;
revoke all on schema dragon_island from public, anon, authenticated;
create table dragon_island.players(uid text primary key, rev bigint not null, state jsonb not null);
create table dragon_island.receipts(uid text not null, op uuid not null, result jsonb, primary key(uid,op));
create table dragon_island.rewards(uid text not null, day text not null, cards integer not null, primary key(uid,day));
create index dragon_island_players_shield on dragon_island.players (((state->>'shield')::bigint));

-- SRS supplies its own local calendar key. Keep the high water mark for late writes and multiple tabs.
create function dragon_island.credit(who text, days jsonb) returns void language sql set search_path='' as $$
 insert into dragon_island.rewards(uid,day,cards)
 select who,k,v::int from jsonb_each_text(case when jsonb_typeof(days)='object' then days else '{}'::jsonb end) d(k,v)
 where k ~ '^\d{4}-\d\d-\d\d$' and k >= '2026-11-18' and v ~ '^\d{1,7}$'
 on conflict(uid,day) do update set cards=excluded.cards where dragon_island.rewards.cards<excluded.cards
$$;
create function dragon_island.on_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform dragon_island.credit(split_part(new.path,'/',2),new.data->'days');
 return new;
exception when others then
 -- Game outages must not roll back coursework. Wallet reads also reconcile the confirmed document.
 raise warning 'Dragon reward reconciliation deferred: %', sqlstate; return new;
end $$;
create trigger dragon_review after insert or update of data on public.ph_docs for each row
 when (not new.deleted and new.path ~ '^srs/[^/]+/meta/streak$') execute function dragon_island.on_review();
select dragon_island.credit(split_part(path,'/',2),data->'days') from public.ph_docs
 where not deleted and path ~ '^srs/[^/]+/meta/streak$';
create function dragon_island.wallet(who text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('credit',coalesce(sum(gems),0),'days',coalesce(jsonb_object_agg(day,jsonb_build_object('cards',cards,'gems',gems)),'{}'))
 from (select day,cards,case when cards<20 then 0 else 10+(cards-20)/2 end gems from dragon_island.rewards where uid=who) d
$$;
create function public.ph_dragon_wallet(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare w record; wallet jsonb;
begin
 select * into w from public._ph_who(p_code); if w.lv is distinct from 2 then raise exception 'Требуется ученический профиль' using errcode='42501';end if;
 perform dragon_island.credit(w.uid,(select data->'days' from public.ph_docs where path='srs/'||w.uid||'/meta/streak' and not deleted));
 wallet:=dragon_island.wallet(w.uid);
 return wallet||jsonb_build_object('balance',(wallet->>'credit')::bigint-coalesce((select (state->>'spent')::bigint from dragon_island.players where uid=w.uid),0));
end $$;
revoke all on function public.ph_dragon_wallet(text) from public;
grant execute on function public.ph_dragon_wallet(text) to anon,authenticated,service_role;
create function public.dragon_read(p_uid text,p_peer text,p_op uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('me',(select to_jsonb(p)-'uid' from dragon_island.players p where uid=p_uid),
 'peer',(select to_jsonb(p)-'uid' from dragon_island.players p where uid=p_peer),
 'receipt',(select jsonb_build_object('result',result) from dragon_island.receipts where uid=p_uid and op=p_op),
 'wallet',dragon_island.wallet(p_uid),'now',floor(extract(epoch from statement_timestamp())*1000)::bigint)
$$;
create function public.dragon_map(p_uid text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',uid,'name',state->>'name','shield',state->'shield',
 'map', (select coalesce(jsonb_agg(b-'since'),'[]') from jsonb_array_elements(state->'buildings') b),
 'guards',(select count(*) from jsonb_array_elements(state->'dragons') d where d->>'guard'='true')) order by uid),'[]')
 from dragon_island.players where uid<>p_uid and (uid like 'qa-isle-%')=(p_uid like 'qa-isle-%')
$$;
create function public.dragon_commit(p_uid text,p_op uuid,p_result jsonb,p_changes jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare c jsonb; oldrev bigint;
begin
 -- Acquire locks in a global order, including players who do not yet have a row.
 for c in select value from jsonb_array_elements(p_changes) order by value->>'uid' loop
   perform pg_advisory_xact_lock(hashtextextended('dragon/'||(c->>'uid'),0));
 end loop;
 if p_op is not null and exists(select from dragon_island.receipts where uid=p_uid and op=p_op) then return false;end if;
 for c in select value from jsonb_array_elements(p_changes) loop
   select rev into oldrev from dragon_island.players where uid=c->>'uid';
   if coalesce(oldrev,0)<>(c->>'rev')::bigint then return false;end if;
 end loop;
 for c in select value from jsonb_array_elements(p_changes) loop
   insert into dragon_island.players(uid,rev,state) values(c->>'uid',1,c->'state')
   on conflict(uid) do update set rev=dragon_island.players.rev+1,state=excluded.state;
 end loop;
 if p_op is not null then insert into dragon_island.receipts values(p_uid,p_op,p_result);end if;
 return true;
end $$;
revoke all on function public.dragon_read(text,text,uuid),public.dragon_map(text),public.dragon_commit(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.dragon_read(text,text,uuid),public.dragon_map(text),public.dragon_commit(text,uuid,jsonb,jsonb) to service_role;
revoke all on all functions in schema dragon_island from public,anon,authenticated;
