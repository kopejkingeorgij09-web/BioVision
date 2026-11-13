-- Main BioViz: protect unpublished laboratory work and merge reading progress atomically.
-- The RPC/code authentication model and permissions of other applications stay intact.
create or replace function public._bv_can(p_code text, p_col text, p_id text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare w record; r boolean;
begin
  select * into w from public._bv_who(p_code);
  if p_col in ('labworks','labfiles') then
    if w.role = 'admin' then return true; end if;
    if p_write then return false; end if;
    if p_col = 'labworks' then
      return exists (select 1 from public.bv_docs where col = 'labworks' and id = p_id
        and coalesce(data->>'draft', 'false') = 'false');
    end if;
    -- A photo is public only while referenced by a published laboratory work.
    return exists (select 1 from public.bv_docs where col = 'labworks'
      and coalesce(data->>'draft', 'false') = 'false'
      and data->'photos' @> jsonb_build_array(jsonb_build_object('id', p_id)));
  elsif p_col in ('kedits','site') then r := (not p_write) or w.role = 'admin';
  elsif p_col = 'students' then r := w.role = 'admin' or (w.role = 'student' and p_id = w.uid);
  elsif p_col in ('shad','bamboo') then r := w.role = 'admin';
  elsif p_col in ('shadx','phx') then r := (not p_write) and w.role = 'admin';
  else r := false;
  end if;
  return coalesce(r, false);
end $$;

create or replace function public.bv_list(p_code text, p_col text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w record;
begin
  select * into w from public._bv_who(p_code);
  if not coalesce(p_col in ('kedits','labworks','site') or
      (p_col in ('students','shad','bamboo','shadx','phx') and w.role = 'admin'), false) then
    raise exception 'denied' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data) order by updated_at)
    from public.bv_docs where col = p_col and
      (p_col <> 'labworks' or w.role = 'admin' or coalesce(data->>'draft', 'false') = 'false')), '[]'::jsonb);
end $$;

-- Invoker-only helper, not a public RPC. It runs inside bv_set's locked UPSERT.
create or replace function public._bv_merge_student(p_old jsonb, p_new jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare a jsonb := coalesce(p_old->'prog', '{}'::jsonb);
        b jsonb := coalesce(p_new->'prog', '{}'::jsonb);
        seen jsonb; last_place jsonb; atime numeric := 0; btime numeric := 0;
begin
  if not p_new ? 'prog' then return p_old || p_new; end if;
  if jsonb_typeof(a) <> 'object' then a := '{}'::jsonb; end if;
  if jsonb_typeof(b) <> 'object' then raise exception 'bad progress'; end if;
  select coalesce(jsonb_object_agg(lecture, sections), '{}'::jsonb) into seen from (
    select lecture, jsonb_agg(distinct section order by section) as sections from (
      select e.key as lecture, s.value as section from
        jsonb_each(case when jsonb_typeof(a->'seen') = 'object' then a->'seen' else '{}'::jsonb end) e
        cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end) s
        where jsonb_typeof(s.value) = 'string'
      union all
      select e.key, s.value from
        jsonb_each(case when jsonb_typeof(b->'seen') = 'object' then b->'seen' else '{}'::jsonb end) e
        cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end) s
        where jsonb_typeof(s.value) = 'string'
    ) marks group by lecture
  ) lectures;
  if jsonb_typeof(a#>'{last,t}') = 'number' then atime := (a#>>'{last,t}')::numeric;
  elsif jsonb_typeof(a->'t') = 'number' then atime := (a->>'t')::numeric; end if;
  if jsonb_typeof(b#>'{last,t}') = 'number' then btime := (b#>>'{last,t}')::numeric;
  elsif jsonb_typeof(b->'t') = 'number' then btime := (b->>'t')::numeric; end if;
  last_place := case when jsonb_typeof(b->'last') <> 'object' or b->'last' is null then a->'last'
    when jsonb_typeof(a->'last') <> 'object' or a->'last' is null or btime >= atime then b->'last' else a->'last' end;
  return p_old || p_new || jsonb_build_object('prog', a || b || jsonb_build_object(
    'seen', seen, 'last', coalesce(last_place, 'null'::jsonb),
    't', greatest(case when jsonb_typeof(a->'t') = 'number' then (a->>'t')::numeric else 0 end,
                  case when jsonb_typeof(b->'t') = 'number' then (b->>'t')::numeric else 0 end)));
end $$;
revoke all on function public._bv_merge_student(jsonb,jsonb) from public, anon, authenticated;

create or replace function public.bv_set(p_code text, p_col text, p_id text, p_data jsonb) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public._bv_can(p_code, p_col, p_id, true) then raise exception 'denied' using errcode = '42501'; end if;
  if p_id !~ '^[A-Za-z0-9_.:@+-]{1,120}$' then raise exception 'bad id'; end if;
  if p_col = 'students' and (jsonb_typeof(p_data) <> 'object' or p_data is null) then raise exception 'bad document'; end if;
  if octet_length(p_data::text) > 900000 then raise exception 'too large'; end if;
  -- ON CONFLICT holds the row lock while merging, including simultaneous first writes.
  insert into public.bv_docs(col, id, data, updated_at)
    values (p_col, p_id, case when p_col = 'students' then public._bv_merge_student('{}'::jsonb, p_data) else p_data end, now())
  on conflict (col, id) do update set data = case when p_col = 'students'
    then public._bv_merge_student(bv_docs.data, excluded.data) else excluded.data end, updated_at = now();
  return true;
end $$;
