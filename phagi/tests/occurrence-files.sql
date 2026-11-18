-- Run after the migration. Exercise the production trigger with an isolated row.
begin;
do $test$
declare
  p text := 'events/qa-' || gen_random_uuid()::text;
  day text := '2026-11-17';
  f jsonb := '{"id":"T-qa-doc-a","name":"sample.pdf","type":"application/pdf"}';
  other_file jsonb := '{"id":"T-qa-doc-b","name":"sample.pdf","type":"application/pdf"}';
  attachment jsonb;
  original jsonb := '{"title":"fixture","ofiles":{"2026-11-16":[{"id":"legacy001"}],"2026-11-17":[{"id":"legacy002"}]}}';
  actual jsonb;
begin
  insert into public.ph_docs(path,parent,id,data) values(p,'events',split_part(p,'/',2),original);
  foreach attachment in array array[f,other_file,f] loop
    update public.ph_docs set data=data || jsonb_build_object('occFileEdit',
      jsonb_build_object('action','add','day',day,'id',attachment->>'id','file',attachment)) where path=p;
  end loop;
  select data into actual from public.ph_docs where path=p;
  if actual <> jsonb_set(original,array['ofiles',day],(original#>array['ofiles',day]) || jsonb_build_array(f,other_file)) then
    raise exception 'Duplicate, missing file, or unrelated event fields changed';
  end if;
  update public.ph_docs set data=data || jsonb_build_object('occFileEdit',
    jsonb_build_object('action','remove','day',day,'id',f->>'id')) where path=p;
  select data into actual from public.ph_docs where path=p;
  if actual <> jsonb_set(original,array['ofiles',day],(original#>array['ofiles',day]) || jsonb_build_array(other_file)) then
    raise exception 'Removing one file changed another';
  end if;
end $test$;
rollback;
