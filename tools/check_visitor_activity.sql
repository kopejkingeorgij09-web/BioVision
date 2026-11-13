-- Real RPCs and anon permissions. Synthetic fixtures are entirely rolled back.
begin;
update public.bv_admin set secret_hash=encode(extensions.digest('USAGE-TEST-ADMIN','sha256'),'hex') where id=1;
insert into bv_personal.accounts(id,code_hash) values('00000000-0000-4000-8000-000000001319',encode(extensions.digest('bioviz-personal-v1:USAGE-PROFILE-TEST','sha256'),'hex'));
set local role anon;
do $$
declare items jsonb; report jsonb; own jsonb;
begin
 begin perform public.bv_activity_report('',30);raise exception 'anonymous read allowed';exception when insufficient_privilege then null;end;
 begin perform public.bv_activity_report('USAGE-PROFILE-TEST',30);raise exception 'personal code read allowed';exception when insufficient_privilege then null;end;
 begin perform public.bv_activity_push('wrong-code','00000000000000000000000000001319','[]');raise exception 'unknown profile accepted';exception when insufficient_privilege then null;end;
 begin perform 1 from bv_usage.metrics;raise exception 'direct table read allowed';exception when insufficient_privilege then null;end;
 items:=jsonb_build_array(jsonb_build_object('stream','00000000000000000000000000001319','day',current_date,'key','book:usage-test','kind','book','section','reading','label','Usage test','views',2,'seconds',120,'pages','[1,2,3]'::jsonb,'rev',2));
 perform public.bv_activity_push('USAGE-PROFILE-TEST','00000000000000000000000000001319',items);
 -- Retry and out-of-order requests must not double or decrease counters.
 perform public.bv_activity_push('USAGE-PROFILE-TEST','00000000000000000000000000001319',items);
 perform public.bv_activity_push('USAGE-PROFILE-TEST','00000000000000000000000000001319',jsonb_set(jsonb_set(items,'{0,views}','1'),'{0,rev}','1'));
 -- A second device with the same code appears as one visitor; pages deduplicate.
 perform public.bv_activity_push('USAGE-PROFILE-TEST','00000000000000000000000000001320',items);
 report:=public.bv_activity_report('USAGE-TEST-ADMIN',30);
 select value into own from jsonb_array_elements(report->'rows') where value->>'visitor'='p:00000000-0000-4000-8000-000000001319' and value->>'key'='book:usage-test';
 if own is null or (own->>'views')::int<>4 or (own->>'seconds')::numeric<>240 or (own->>'pages')::int<>3 then raise exception 'bad aggregate: %',own;end if;
 if report::text like '%USAGE-PROFILE-TEST%' then raise exception 'capability exposed';end if;
 perform public.bv_activity_push('','00000000000000000000000000001319',items);
 report:=public.bv_activity_report('USAGE-TEST-ADMIN',30);
 if not exists(select 1 from jsonb_array_elements(report->'rows') where value->>'visitor' like 'g:%' and value->>'key'='book:usage-test') then raise exception 'anonymous visit absent';end if;
 -- A malformed batch must fail as a unit.
 begin perform public.bv_activity_push('','00000000000000000000000000001319',jsonb_set(items,'{0,pages}','["invalid"]'));raise exception 'malformed accepted';exception when raise_exception then if sqlerrm='malformed accepted' then raise;end if;end;
end $$;
reset role;
rollback;
select 'PASS: anon isolation, admin authorization, same-code devices, guest traffic, page deduplication, idempotent retries, stale writes and validation' as result;
