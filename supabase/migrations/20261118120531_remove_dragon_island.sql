select cron.unschedule(jobid) from cron.job where jobname in ('dragon-island-evening','dragon-island-recovery');
drop trigger if exists dragon_review on public.ph_docs;
drop function if exists public.ph_dragon_wallet(text), public.dragon_read(text,text,uuid), public.dragon_map(text), public.dragon_commit(text,uuid,jsonb,jsonb), public.dragon_history(text,bigint,text), public.dragon_recording(text,text), public.dragon_take_ticket(uuid);
drop schema if exists dragon_island cascade;
