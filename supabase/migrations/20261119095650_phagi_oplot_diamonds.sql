-- Драконий Оплот. All amounts come from published assignments and persisted study records.
create schema oplot;
revoke all on schema oplot from public, anon, authenticated;
create table oplot.credits (
  uid text not null, kind text not null check (kind in ('card','homework')),
  source text not null, item text not null, amount smallint not null check (amount between 1 and 10),
  primary key(uid,kind,source,item)
);
create table oplot.purchases (
  uid text not null, op uuid not null, item text not null, price smallint not null check (price>0),
  primary key(uid,op)
);
create table oplot.imported (uid text primary key);
alter table oplot.credits enable row level security;
alter table oplot.purchases enable row level security;
alter table oplot.imported enable row level security;

create function oplot.arr(v jsonb) returns jsonb language sql immutable set search_path='' as $$
  select case when jsonb_typeof(v)='array' then v else '[]'::jsonb end
$$;
create function oplot.num(v text) returns numeric language sql immutable set search_path='' as $$
  select case when length(v)<=40 and v ~ '^-?[0-9]+([.][0-9]+)?$' then v::numeric end
$$;
-- Teacher and teacher-authorized assigners have different source collections (including deck parts).
create function oplot.assigned(who text, coll text, doc_id text) returns setof public.ph_docs
language sql stable set search_path='' as $$
  with roots(parent,priority) as (
    select coll,0 union all
    select 'assign/'||a||'/'||coll,1 from public.ph_docs cfg,
      lateral jsonb_array_elements_text(oplot.arr(cfg.data->'assigners')) a
      where cfg.path='cfg/main' and not cfg.deleted
  )
  select d.* from roots r join public.ph_docs d on d.path=r.parent||'/'||doc_id
    where not d.deleted and oplot.arr(d.data->'to') ? who order by priority,d.path limit 1
$$;

create function oplot.credit_cards(who text, deck text, progress jsonb) returns void language plpgsql set search_path='' as $$
declare head public.ph_docs; part_parent text; personal boolean:=deck='mistakes';
begin
  if jsonb_typeof(progress) is distinct from 'object' or progress='{}' then return; end if;
  if personal then
    select * into head from public.ph_docs where path='data/users/'||who||'/mistakes' and not deleted and data->>'kind'='deck';
    part_parent:=head.parent;
  else
    select * into head from oplot.assigned(who,'decks',deck);
    part_parent:=case when head.parent='decks' then 'deckparts' else regexp_replace(head.parent,'/decks$','/dparts') end;
  end if;
  if head.path is null then return; end if;
  with parts(cards) as (
    select head.data->'cards' where coalesce(oplot.num(head.data->>'parts'),0)=0 union all
    select p.data->'cards' from public.ph_docs p where p.parent=part_parent and not p.deleted
      and p.data->>'deck'=deck and oplot.num(p.data->>'k')>=0
      and oplot.num(p.data->>'k')<oplot.num(head.data->>'parts')
      and p.id=deck||'~'||(p.data->>'k')
  ), done as (
    select c from parts, lateral jsonb_array_elements(oplot.arr(cards)) c
      where progress ? (c->>'i') and oplot.num((progress->(c->>'i'))->>3)>0
  )
  insert into oplot.credits(uid,kind,source,item,amount)
  select who,'card',deck,case when personal then c->>'src' else c->>'i' end,1 from done
  where not personal or exists (
    -- Removing/recreating a mistake card for the same question preserves its identity.
    select from oplot.assigned(who,'tasks',regexp_replace(c->>'src',':[0-9]+$','')) t
      where c->>'src' ~ ':[0-9]+$' and t.data->>'kind'='test'
        and oplot.num(substring(c->>'src' from ':([0-9]+)$'))<jsonb_array_length(oplot.arr(t.data->'q'))
  ) on conflict do nothing;
end $$;

create function oplot.normal_answer(v text) returns text language sql immutable set search_path='' as $$
  select trim(regexp_replace(translate(lower(coalesce(v,'')),'ё,','е.'),'[[:space:]]+',' ','g'))
$$;
create function oplot.correct(q jsonb, a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare ans text:=oplot.normal_answer(a#>>'{}');
begin
  case q->>'t'
    when 'text' then return ans<>'' and exists(select from jsonb_array_elements_text(oplot.arr(q->'acc')) k
      where oplot.normal_answer(k)=ans or abs(oplot.num(oplot.normal_answer(k))-oplot.num(ans))<0.000000001);
    when 'single' then return exists(select from jsonb_array_elements_text(oplot.arr(q->'ans')) k
      where oplot.num(k)=oplot.num(a#>>'{}'));
    when 'multi' then return jsonb_typeof(a)='array' and jsonb_array_length(oplot.arr(q->'ans'))>0
      and (select array_agg(distinct oplot.num(k) order by oplot.num(k)) from jsonb_array_elements_text(oplot.arr(a)) k)
        =(select array_agg(distinct oplot.num(k) order by oplot.num(k)) from jsonb_array_elements_text(oplot.arr(q->'ans')) k);
    else return false;
  end case;
end $$;
create function oplot.credit_homework(who text, task_id text) returns void language plpgsql set search_path='' as $$
declare t jsonb; sub jsonb; grade jsonb; score numeric; maximum numeric; returned boolean; reward int;
begin
  select data into t from oplot.assigned(who,'tasks',task_id);
  if coalesce(t->>'kind','') not in ('test','task') then return; end if;
  if t#>>'{nb,id}' is not null and exists(select from public.ph_docs where path='nbooks/'||(t#>>'{nb,id}') and not deleted) then return; end if;
  select data into sub from public.ph_docs where path='subs/'||who||'/items/'||task_id and not deleted;
  if sub->>'status' is distinct from 'submitted' then return; end if;
  select data into grade from public.ph_docs where path='grades/'||who||'/items/'||task_id and not deleted;
  returned:=nullif(grade->>'returnedAt','') is not null and coalesce(sub->>'updatedAt','')<=grade->>'returnedAt';
  if t->>'kind'='test' then
    -- Use the teacher's key. The saved 'auto' and 'total' fields belong to the student's document.
    if jsonb_typeof(sub->'answers') is distinct from 'array' or jsonb_array_length(oplot.arr(t->'q'))=0 then return; end if;
    select sum(pts),sum(case when oplot.correct(q,(sub->'answers')->(idx::int-1)) then pts else 0 end)
      into maximum,score from jsonb_array_elements(oplot.arr(t->'q')) with ordinality questions(q,idx),
      lateral (select coalesce(nullif(oplot.num(q->>'pts'),0),1) pts) weight;
    if returned then score:=coalesce(oplot.num(grade->>'score'),score); end if;
  else
    if not coalesce(returned,false) then return; end if;
    maximum:=oplot.num(t->>'max'); score:=oplot.num(grade->>'score');
  end if;
  reward:=5+case when maximum>0 and score is not null then round(5*greatest(0,least(1,score/maximum)))::int else 0 end;
  insert into oplot.credits(uid,kind,source,item,amount) values(who,'homework',task_id,'',reward)
  on conflict(uid,kind,source,item) do update set amount=excluded.amount where oplot.credits.amount<excluded.amount;
end $$;

create function oplot.on_work() returns trigger language plpgsql security definer set search_path='' as $$
declare who text:=split_part(new.path,'/',2);
begin
  if split_part(new.path,'/',1)='srs' then
    perform oplot.credit_cards(who,regexp_replace(new.id,'~[0-9]+$',''),new.data->'s');
  elsif split_part(new.path,'/',1)='grades' or new.data->>'status'='submitted' then
    perform oplot.credit_homework(who,new.id);
  end if;
  return null;
end $$;
create trigger oplot_study_rewards after insert or update of data on public.ph_docs
  for each row when (not new.deleted and (new.path ~ '^srs/[^/]+/decks/[^/]+$' or new.path ~ '^(subs|grades)/[^/]+/items/[^/]+$'))
  execute function oplot.on_work();

create function oplot.student(p_code text) returns text language plpgsql stable set search_path='' as $$
declare w record;
begin
  select * into w from public._ph_who(p_code);
  if w.lv is null or not exists(select from public.ph_students where uid=w.uid) then
    raise exception 'Нужен ученический профиль «Фагов»' using errcode='42501';
  end if;
  return w.uid;
end $$;
create function oplot.import_history(who text) returns void language plpgsql set search_path='' as $$
declare d record;
begin
  insert into oplot.imported values(who) on conflict do nothing;
  if not found then return; end if;
  for d in select id,data->'s' states from public.ph_docs where parent='srs/'||who||'/decks' and not deleted loop
    perform oplot.credit_cards(who,regexp_replace(d.id,'~[0-9]+$',''),d.states);
  end loop;
  for d in select id from public.ph_docs where parent='subs/'||who||'/items' and not deleted and data->>'status'='submitted' loop
    perform oplot.credit_homework(who,d.id);
  end loop;
end $$;
create function oplot.wallet(who text) returns jsonb language sql stable set search_path='' as $$
  with c as (select coalesce(sum(amount) filter(where kind='card'),0) cards,
      coalesce(sum(amount) filter(where kind='homework'),0) homework from oplot.credits where uid=who),
    p as (select coalesce(sum(price),0) spent from oplot.purchases where uid=who)
  select jsonb_build_object('cards',cards,'homework',homework,'spent',spent,'balance',cards+homework-spent) from c,p
$$;
create function public.ph_oplot_wallet(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare who text:=oplot.student(p_code);
begin
  perform oplot.import_history(who);
  return oplot.wallet(who);
end $$;
create function public.ph_oplot_buy(p_code text,p_item text,p_op uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare who text:=oplot.student(p_code); prior text; price int; wallet jsonb;
begin
  price:=case p_item when 'incubate' then 1 when 'berries' then 3 when 'gold' then 5 end;
  if price is null or p_op is null then raise exception 'Неизвестная покупка' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('oplot/'||who,0));
  perform oplot.import_history(who);
  select p.item into prior from oplot.purchases p where p.uid=who and p.op=p_op;
  if prior is not null and prior<>p_item then raise exception 'Номер покупки уже использован' using errcode='22023'; end if;
  if prior is null then
    wallet:=oplot.wallet(who);
    if (wallet->>'balance')::bigint<price then raise exception 'Недостаточно алмазов' using errcode='22023'; end if;
    insert into oplot.purchases values(who,p_op,p_item,price);
  end if;
  return oplot.wallet(who)||jsonb_build_object('op',p_op,'item',p_item,'price',price);
end $$;
revoke all on all tables in schema oplot from public,anon,authenticated;
revoke all on all functions in schema oplot from public,anon,authenticated;
revoke all on function public.ph_oplot_wallet(text),public.ph_oplot_buy(text,text,uuid) from public,anon,authenticated;
grant execute on function public.ph_oplot_wallet(text),public.ph_oplot_buy(text,text,uuid) to anon,authenticated,service_role;
