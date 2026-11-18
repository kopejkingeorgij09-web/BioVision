-- All established and future school wallets have the same non-repeatable opening balance.
create or replace function dragon_island.wallet(who text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('welcome',50,'credit',50+coalesce(sum(gems),0),'days',coalesce(jsonb_object_agg(day,jsonb_build_object('cards',cards,'gems',gems)),'{}'))
 from (select day,cards,case when cards<20 then 0 else 10+(cards-20)/2 end gems from dragon_island.rewards where uid=who) d
$$;

create function dragon_island.next_evening(at_time timestamptz) returns timestamptz language sql stable set search_path='' as $$
 select (d+case when d at time zone 'Europe/Moscow'<=at_time then interval '1 day' else interval '0' end) at time zone 'Europe/Moscow'
 from (select date_trunc('day',at_time at time zone 'Europe/Moscow')+interval '19 hours' as d) t
$$;
alter table dragon_island.players add column next_invasion timestamptz not null default dragon_island.next_evening(statement_timestamp());
create index dragon_players_due on dragon_island.players(next_invasion,uid);

create table dragon_island.battles(uid text not null,id text not null,moment bigint not null,summary jsonb not null,recording jsonb,primary key(uid,id));
create index dragon_battle_history on dragon_island.battles(uid,moment desc,id desc);
alter table dragon_island.battles enable row level security;
insert into dragon_island.battles(uid,id,moment,summary)
 select p.uid,r->>'id',(r->>'time')::bigint,r from dragon_island.players p cross join lateral jsonb_array_elements(p.state->'reports') r
 where r->>'id' is not null and r->>'time' is not null on conflict do nothing;

create function public.dragon_history(p_uid text,p_before bigint,p_key text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(summary-'ledger' order by moment desc,id desc),'[]') from
 (select summary,moment,id from dragon_island.battles where uid=p_uid and (p_before is null or (moment,id)<(p_before,coalesce(p_key,''))) order by moment desc,id desc limit 21) page
$$;
create function public.dragon_recording(p_uid text,p_id text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('report',summary,'recording',recording) from dragon_island.battles where uid=p_uid and id=p_id
$$;

create or replace function public.dragon_commit(p_uid text,p_op uuid,p_result jsonb,p_changes jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare c jsonb; oldrev bigint; due timestamptz; rec jsonb;
begin
 for c in select value from jsonb_array_elements(p_changes) order by value->>'uid' loop
   perform pg_advisory_xact_lock(hashtextextended('dragon/'||(c->>'uid'),0));
 end loop;
 if p_op is not null and exists(select from dragon_island.receipts where uid=p_uid and op=p_op) then return false;end if;
 for c in select value from jsonb_array_elements(p_changes) loop
   select rev,next_invasion into oldrev,due from dragon_island.players where uid=c->>'uid';
   if coalesce(oldrev,0)<>(c->>'rev')::bigint then return false;end if;
   -- A 19:00 snapshot always precedes any later build, loot transfer or spend.
   if due<=clock_timestamp() then
     if (c->>'scheduled')::timestamptz is distinct from due then return false;end if;
   elsif c ? 'scheduled' then return false;end if;
 end loop;
 for c in select value from jsonb_array_elements(p_changes) loop
   insert into dragon_island.players(uid,rev,state) values(c->>'uid',1,c->'state')
   on conflict(uid) do update set rev=dragon_island.players.rev+1,state=excluded.state,
   next_invasion=case when c ? 'scheduled' then dragon_island.next_evening(dragon_island.players.next_invasion) else dragon_island.players.next_invasion end;
   rec:=c->'archive';
   if rec is not null then
     insert into dragon_island.battles(uid,id,moment,summary,recording) values(c->>'uid',rec->'report'->>'id',(rec->'report'->>'time')::bigint,rec->'report',rec->'recording');
   end if;
 end loop;
 if p_op is not null then insert into dragon_island.receipts values(p_uid,p_op,p_result);end if;
 return true;
end $$;

-- Only a scheduled database job can issue a single-use, short-lived worker ticket.
create extension if not exists pg_net with schema extensions;
create table dragon_island.worker_tickets(token uuid primary key,expires timestamptz not null,uids text[] not null);
alter table dragon_island.worker_tickets enable row level security;
create function public.dragon_take_ticket(p_token uuid) returns text[] language sql volatile security definer set search_path='' as $$
 delete from dragon_island.worker_tickets where token=p_token and expires>clock_timestamp() returning uids
$$;
create function dragon_island.dispatch_due(only_uid text default null) returns integer language plpgsql security definer set search_path='' as $$
declare batch text[]; ticket uuid; n integer:=0;
begin
 delete from dragon_island.worker_tickets where expires<=clock_timestamp();
 for batch in select array_agg(uid order by uid) from (
   select uid,(row_number() over(order by uid)-1)/12 as grp from dragon_island.players
   where next_invasion<=statement_timestamp() and (only_uid is null or uid=only_uid)) due group by grp loop
   ticket:=gen_random_uuid();
   insert into dragon_island.worker_tickets values(ticket,clock_timestamp()+interval '2 minutes',batch);
   perform net.http_post(url:='https://zonrkvsibojyalhnqutd.supabase.co/functions/v1/dragon-island',
     headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('schedule',ticket),timeout_milliseconds:=45000);
   n:=n+cardinality(batch);
 end loop;
 return n;
end $$;
revoke all on dragon_island.battles,dragon_island.worker_tickets from public,anon,authenticated;
revoke all on function dragon_island.next_evening(timestamptz),dragon_island.dispatch_due(text) from public,anon,authenticated;
revoke all on function public.dragon_history(text,bigint,text),public.dragon_recording(text,text),public.dragon_take_ticket(uuid) from public,anon,authenticated;
grant execute on function public.dragon_history(text,bigint,text),public.dragon_recording(text,text),public.dragon_take_ticket(uuid) to service_role;
-- Supabase scheduler uses GMT. 16:00 UTC is 19:00 in Moscow.
select cron.schedule('dragon-island-evening','0 16 * * *','select dragon_island.dispatch_due()');
select cron.schedule('dragon-island-recovery','1-59 * * * *','select dragon_island.dispatch_due()');
