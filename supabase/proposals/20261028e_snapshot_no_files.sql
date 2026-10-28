-- ПРЕДЛОЖЕНИЕ, НЕ ПРИМЕНЕНО: применять с разрешения владельца.
-- Ежедневные снимки без файлов (фото и PDF, files/... и subs/<uid>/files/...): файлы после загрузки не меняются,
-- а 14 ежедневных копий фотографий быстро съели бы бесплатные 500 МБ базы.
create or replace function backup.ph_daily_snapshot() returns text
language plpgsql security definer set search_path = public, backup as $$
declare d date := (now() at time zone 'Europe/Moscow')::date; t text := 'ph_docs_auto_' || to_char(d, 'YYYYMMDD'); r record; n int;
begin
  execute format('drop table if exists backup.%I', t);
  execute format($q$create table backup.%I as select * from public.ph_docs where path not like 'files/%%' and path not like 'subs/%%/files/%%'$q$, t);
  execute format('revoke all on backup.%I from anon, authenticated', t);
  for r in select tablename from pg_tables where schemaname = 'backup' and tablename like 'ph_docs_auto_%'
           and tablename < 'ph_docs_auto_' || to_char(d - 14, 'YYYYMMDD') loop
    execute format('drop table backup.%I', r.tablename);
  end loop;
  execute format('select count(*) from backup.%I', t) into n;
  return t || ': ' || n;
end $$;
revoke all on function backup.ph_daily_snapshot() from public, anon, authenticated;
