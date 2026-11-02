-- 28.10.2026, по просьбе владельца: ежедневный снимок всех работ (ph_docs) в закрытую схему backup.
-- Каждый день в 00:00 UTC (03:00 МСК) таблица backup.ph_docs_auto_ГГГГММДД, хранятся 14 последних дней.
-- Схема backup не открыта для anon и authenticated и не публикуется через API.
-- Восстановить документ: insert into public.ph_docs select * from backup.ph_docs_auto_ГГГГММДД where path = '...'
--   on conflict (path) do update set data = excluded.data, deleted = excluded.deleted, updated_at = now();
create extension if not exists pg_cron;
create schema if not exists backup;
revoke all on schema backup from anon, authenticated;
create or replace function backup.ph_daily_snapshot() returns text
language plpgsql security definer set search_path = public, backup as $$
declare d date := (now() at time zone 'Europe/Moscow')::date; t text := 'ph_docs_auto_' || to_char(d, 'YYYYMMDD'); r record; n int;
begin
  execute format('drop table if exists backup.%I', t);
  execute format('create table backup.%I as table public.ph_docs', t);
  execute format('revoke all on backup.%I from anon, authenticated', t);
  for r in select tablename from pg_tables where schemaname = 'backup' and tablename like 'ph_docs_auto_%'
           and tablename < 'ph_docs_auto_' || to_char(d - 14, 'YYYYMMDD') loop
    execute format('drop table backup.%I', r.tablename);
  end loop;
  execute format('select count(*) from backup.%I', t) into n;
  return t || ': ' || n;
end $$;
revoke all on function backup.ph_daily_snapshot() from public, anon, authenticated;
select cron.schedule('ph-daily-snapshot', '0 0 * * *', 'select backup.ph_daily_snapshot()');
