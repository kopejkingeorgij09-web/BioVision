-- Diary overview. Return only the labels, counts and identifiers required by the teacher.
create or replace function public.bv_teaching_week(p_code text, p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not coalesce((select w.role='admin' from public._bv_who(p_code) w), false) then
    raise exception 'denied' using errcode='42501';
  end if;
  with days as (select p_day+i as day from generate_series(-1,6) i),
  lessons as (
    select e.id, day, e.data->>'title' as title, e.data->>'start' as start,
      (select string_agg(p.data->>'label', ', ' order by p.data->>'label') from public.ph_docs p
       where p.parent='people' and not p.deleted and e.data->'to' ? p.id) as names,
      jsonb_array_length(coalesce(e.data->'files','[]')) + jsonb_array_length(coalesce(e.data->'ofiles'->day::text,'[]')) as files,
      (select count(*) from public.ph_docs t where t.parent='tasks' and not t.deleted
       and t.data->'lesson'->>'eventId'=e.id and (e.data->>'repeat' is distinct from 'weekly' or t.data->'lesson'->>'date'=day::text)) as tasks
    from public.ph_docs e cross join days
    where e.parent='events' and not e.deleted and not (coalesce(e.data->'to','[]') ? public._shad_ph_uid())
      and not (coalesce(e.data->'skip','[]') ? day::text)
      and (e.data->>'date'=day::text or (e.data->>'repeat'='weekly' and e.data->>'date'<=day::text
        and (nullif(e.data->>'until','') is null or e.data->>'until'>=day::text)
        and (day - nullif(e.data->>'date','')::date)%7=0))
  ), reviews as (
    select t.id,p.id as uid,p.data->>'label' as name,t.data->>'title' as title,s.data->>'updatedAt' as submitted
    from public.ph_docs p join public.ph_docs s on s.parent='subs/'||p.id||'/items' and not s.deleted
    join public.ph_docs t on t.path='tasks/'||s.id and not t.deleted and t.data->'to' ? p.id
    left join public.ph_docs g on g.path='grades/'||p.id||'/items/'||s.id and not g.deleted
    where p.parent='people' and not p.deleted and t.data->>'kind'='task' and s.data->>'status'='submitted'
      and (g.data->>'returnedAt' is null or g.data->>'returnedAt'<s.data->>'updatedAt')
  ) select jsonb_build_object('lessons',coalesce((select jsonb_agg(to_jsonb(l) order by day,start,title) from lessons l),'[]'),
    'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by submitted,id,uid) from reviews r),'[]')) into result;
  return result;
end $$;

-- Publish once, even when the browser loses the successful response.
create or replace function public.ph_publish_lesson(p_code text, p_bundle jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eid text := p_bundle->>'eventId'; bid text := p_bundle->>'batch'; day text := p_bundle->>'day';
  ev jsonb; part jsonb; tid text; f jsonb := p_bundle->'file'; stamp text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if (public.ph_login(p_code)->>'isOwner')::boolean is not true then raise exception 'denied' using errcode='42501'; end if;
  if eid is null or eid !~ '^[a-zA-Z0-9_-]{1,120}$' or bid is null or bid !~ '^[a-zA-Z0-9_-]{12,64}$'
     or day is null or day::date::text<>day then raise exception 'invalid lesson'; end if;
  perform pg_advisory_xact_lock(hashtextextended('events/'||eid,0));
  select data into ev from public.ph_docs where path='events/'||eid and not deleted for update;
  if ev->'lessonPublications' ? bid then return; end if;
  if p_bundle ? 'event' then
    if ev is not null then raise exception 'event exists'; end if;
    ev := p_bundle->'event';
    if ev->>'date' is distinct from day or coalesce(trim(ev->>'title'),'')='' then raise exception 'invalid event'; end if;
    perform public.ph_set(p_code,'events/'||eid,ev || jsonb_build_object('createdAt',stamp,'updatedAt',stamp,'repeat','none'));
  elsif ev is null or coalesce(ev->'to','[]') is distinct from p_bundle->'to'
    or (ev->>'date' is distinct from day and (ev->>'repeat' is distinct from 'weekly' or ev->>'date'>day
      or (day::date-(ev->>'date')::date)%7<>0 or nullif(ev->>'until','')<day))
    or coalesce(ev->'skip','[]') ? day then raise exception 'lesson changed'; end if;
  if f is not null and f<>'null'::jsonb then
    if public.ph_get(p_code,'files/'||(f->>'id'))->>'parts' is null then raise exception 'file missing'; end if;
    perform public.ph_update(p_code,'events/'||eid,jsonb_build_object('occFileEdit',
      jsonb_build_object('action','add','day',day,'id',f->>'id','file',f)));
  end if;
  for part in select value from jsonb_array_elements(p_bundle->'tasks') loop
    if part->>'kind' not in ('test','task') then raise exception 'invalid task'; end if;
    tid := bid||'-'||(part->>'kind');
    if public.ph_get(p_code,'tasks/'||tid) is not null then raise exception 'task exists'; end if;
    perform public.ph_set(p_code,'tasks/'||tid,part || jsonb_build_object('to',ev->'to','subject',ev->'subject',
      'lesson',jsonb_build_object('eventId',eid,'date',day),'createdAt',stamp,'updatedAt',stamp));
  end loop;
  perform public.ph_update(p_code,'events/'||eid,jsonb_build_object('lessonPublications',jsonb_build_object(bid,day)));
end $$;

create or replace function public.ph_review_answer(p_code text,p_task text,p_uid text,p_submitted text,p_returned text,p_feedback text,p_score numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare s jsonb; g jsonb; path_g text := 'grades/'||p_uid||'/items/'||p_task;
begin
  if (public.ph_login(p_code)->>'isOwner')::boolean is not true then raise exception 'denied' using errcode='42501'; end if;
  select data into s from public.ph_docs where path='subs/'||p_uid||'/items/'||p_task and not deleted for update;
  select data into g from public.ph_docs where path=path_g and not deleted for update;
  if s->>'status' is distinct from 'submitted' or s->>'updatedAt' is distinct from p_submitted
    or g->>'returnedAt' is distinct from p_returned then raise exception 'review changed'; end if;
  perform public.ph_set(p_code,path_g,coalesce(g,'{}') || jsonb_build_object('score',p_score,'feedback',p_feedback,
    'returnedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
end $$;
revoke all on function public.bv_teaching_week(text,date),public.ph_publish_lesson(text,jsonb),public.ph_review_answer(text,text,text,text,text,text,numeric) from public;
grant execute on function public.bv_teaching_week(text,date),public.ph_publish_lesson(text,jsonb),public.ph_review_answer(text,text,text,text,text,text,numeric) to anon,authenticated;
