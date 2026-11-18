-- ph_update locks the event row before merging the patch. Consume the operation
-- under that same lock, leaving the existing ofiles format for every reader.
create or replace function public.ph_apply_occurrence_file() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  edit jsonb := new.data->'occFileEdit';
  day text := edit->>'day';
  file_id text := edit->>'id';
  file jsonb := edit->'file';
  dates jsonb := coalesce(nullif(new.data->'ofiles','null'::jsonb), '{}'::jsonb);
  items jsonb;
begin
  if day is null or day !~ '^\d{4}-\d{2}-\d{2}$'
    or file_id is null or file_id !~ '^[a-zA-Z0-9_-]{8,64}$' then
    raise exception 'Invalid occurrence or file' using errcode='22023';
  end if;
  items := coalesce(nullif(dates->day,'null'::jsonb),'[]'::jsonb);
  if edit->>'action' = 'add' and file->>'id' = file_id
    and jsonb_typeof(file->'name') = 'string' then
    if not exists (select 1 from jsonb_array_elements(items) item where item->>'id'=file_id) then
      items := items || jsonb_build_array(file);
    end if;
  elsif edit->>'action' = 'remove' then
    select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into items
      from jsonb_array_elements(items) with ordinality as f(item,ord)
      where item->>'id' is distinct from file_id;
  else
    raise exception 'Invalid attachment operation' using errcode='22023';
  end if;
  new.data := jsonb_set(new.data - 'occFileEdit','{ofiles}',jsonb_set(dates,array[day],items));
  return new;
end $$;
revoke all on function public.ph_apply_occurrence_file() from public, anon, authenticated;
create trigger ph_apply_occurrence_file before insert or update of data on public.ph_docs
for each row when (new.parent='events' and new.data ? 'occFileEdit')
execute function public.ph_apply_occurrence_file();
