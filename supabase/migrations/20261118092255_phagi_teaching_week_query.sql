create or replace function public.bv_teaching_week(p_code text,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not coalesce((select w.role='admin' from public._bv_who(p_code) w),false) then
    raise exception 'denied' using errcode='42501';
  end if;
  -- Select the small collections before reading JSON. The same table also contains large PDF chunks.
  with people as materialized (
    select id,data->>'label' as name from public.ph_docs where parent='people' and not deleted
  ), work as materialized (
    select id,data->>'title' as title,data->>'kind' as kind,data->'lesson' as lesson,data->'to' as recipients
    from public.ph_docs where parent='tasks' and not deleted
  ), events as materialized (
    select id,data from public.ph_docs where parent='events' and not deleted
  ), days as (select p_day+i as day from generate_series(-1,6) i),
  lessons as (
    select e.id, day, e.data->>'title' as title, e.data->>'start' as start,
      (select string_agg(p.name,', ' order by p.name) from people p where e.data->'to' ? p.id) as names,
      jsonb_array_length(coalesce(e.data->'files','[]')) + jsonb_array_length(coalesce(e.data->'ofiles'->day::text,'[]')) as files,
      (select count(*) from work t where t.lesson->>'eventId'=e.id and (e.data->>'repeat' is distinct from 'weekly' or t.lesson->>'date'=day::text)) as tasks
    from events e cross join days
    where not (coalesce(e.data->'to','[]') ? public._shad_ph_uid()) and not (coalesce(e.data->'skip','[]') ? day::text)
      and (e.data->>'date'=day::text or (e.data->>'repeat'='weekly' and e.data->>'date'<=day::text
        and (nullif(e.data->>'until','') is null or e.data->>'until'>=day::text)
        and (day-nullif(e.data->>'date','')::date)%7=0))
  ), answers as materialized (
    select t.id,t.title,p.id as uid,p.name,
      (select s.data from public.ph_docs s where s.path='subs/'||p.id||'/items/'||t.id and not s.deleted) as sub,
      (select g.data->>'returnedAt' from public.ph_docs g where g.path='grades/'||p.id||'/items/'||t.id and not g.deleted) as returned
    from work t join people p on t.recipients ? p.id where t.kind='task'
  ), reviews as (
    select id,title,uid,name,sub->>'updatedAt' as submitted from answers
    where sub->>'status'='submitted' and (returned is null or returned<sub->>'updatedAt')
  ) select jsonb_build_object('lessons',coalesce((select jsonb_agg(to_jsonb(l) order by day,start,title) from lessons l),'[]'),
    'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by submitted,id,uid) from reviews r),'[]')) into result;
  return result;
end $$;
