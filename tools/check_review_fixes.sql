-- Run only in a disposable PostgreSQL database after the BioViz core and review migrations.
-- These are deliberately fake credentials. All fixtures are rolled back.
begin;
insert into public.bv_admin(id, secret_hash) values
  (1, encode(extensions.digest('REVIEW-ADMIN-ONLY','sha256'),'hex'));
insert into public.bv_students(id, code, name) values
  ('review-a', 'REVIEW-A-ONLY', 'Test A'), ('review-b', 'REVIEW-B-ONLY', 'Test B');
insert into public.bv_docs(col,id,data) values
 ('labworks','review-published','{"title":"Published","photos":[{"id":"review-public-photo"}]}'),
 ('labworks','review-draft','{"title":"Draft","draft":true,"photos":[{"id":"review-draft-photo"}]}'),
 ('labfiles','review-public-photo','{"src":"public"}'),
 ('labfiles','review-draft-photo','{"src":"private"}'),
 ('labfiles','review-orphan-photo','{"src":"orphan"}');

set local role anon;
do $$
declare d jsonb;
begin
  if public.bv_get('', 'labworks','review-published')->>'title' <> 'Published' then raise exception 'public lab unavailable'; end if;
  if public.bv_get('', 'labfiles','review-public-photo')->>'src' <> 'public' then raise exception 'public photo unavailable'; end if;
  if public.bv_list('', 'labworks') @> '[{"id":"review-draft"}]'::jsonb then raise exception 'draft in anonymous list'; end if;
  if public.bv_list('REVIEW-A-ONLY', 'labworks') @> '[{"id":"review-draft"}]'::jsonb then raise exception 'draft in student list'; end if;
  if not public.bv_list('REVIEW-ADMIN-ONLY', 'labworks') @> '[{"id":"review-draft"}]'::jsonb then raise exception 'admin cannot list drafts'; end if;
  if public.bv_get('REVIEW-ADMIN-ONLY','labworks','review-draft')->>'title' <> 'Draft' then raise exception 'admin draft unavailable'; end if;
  if public.bv_get('REVIEW-ADMIN-ONLY','labfiles','review-draft-photo')->>'src' <> 'private' then raise exception 'admin photo unavailable'; end if;
  begin perform public.bv_get('', 'labworks','review-draft'); raise exception 'anonymous draft exposed'; exception when insufficient_privilege then null; end;
  begin perform public.bv_get('REVIEW-A-ONLY', 'labworks','review-draft'); raise exception 'student draft exposed'; exception when insufficient_privilege then null; end;
  begin perform public.bv_get('', 'labfiles','review-draft-photo'); raise exception 'draft photo exposed'; exception when insufficient_privilege then null; end;
  begin perform public.bv_get('', 'labfiles','review-orphan-photo'); raise exception 'orphan photo exposed'; exception when insufficient_privilege then null; end;
  begin perform public.bv_set('REVIEW-A-ONLY','labworks','review-draft','{}'); raise exception 'student can write labs'; exception when insufficient_privilege then null; end;
  begin perform public.bv_set('REVIEW-A-ONLY','students','review-b','{}'); raise exception 'student can write another profile'; exception when insufficient_privilege then null; end;
  begin perform public._bv_merge_student('{}','{}'); raise exception 'merge helper exposed'; exception when insufficient_privilege then null; end;
  begin perform public.bv_list('', 'students'); raise exception 'student list exposed'; exception when insufficient_privilege then null; end;

  perform public.bv_set('REVIEW-A-ONLY','students','review-a',
    '{"other":"keep","prog":{"seen":{"l01":["s1"]},"last":{"id":"l01","s":"s1","t":20},"t":20}}');
  perform public.bv_set('REVIEW-A-ONLY','students','review-a',
    '{"prog":{"seen":{},"last":null,"t":30}}');
  perform public.bv_set('REVIEW-A-ONLY','students','review-a',
    '{"prog":{"seen":{"l01":["s2","s2"],"l02":["x1"]},"last":{"id":"l01","s":"old","t":10},"t":10}}');
  d := public.bv_get('REVIEW-A-ONLY','students','review-a');
  if d->>'other' <> 'keep' or d#>'{prog,seen}' <> '{"l01":["s1","s2"],"l02":["x1"]}'::jsonb
    or d#>>'{prog,last,s}' <> 's1' then raise exception 'progress lost: %', d; end if;
  perform public.bv_set('REVIEW-A-ONLY','students','review-a',
    '{"prog":{"seen":{"l01":["s3"]},"last":{"id":"l01","s":"s3","t":40},"t":40}}');
  if public.bv_get('REVIEW-A-ONLY','students','review-a')#>>'{prog,last,s}' <> 's3' then raise exception 'new position not saved'; end if;
  -- Publishing makes photos readable; reverting to a draft immediately revokes access.
  perform public.bv_set('REVIEW-ADMIN-ONLY','labworks','review-draft','{"photos":[{"id":"review-draft-photo"}],"draft":false}');
  if public.bv_get('', 'labfiles','review-draft-photo')->>'src' <> 'private' then raise exception 'published photo unavailable'; end if;
  perform public.bv_set('REVIEW-ADMIN-ONLY','labworks','review-draft','{"photos":[{"id":"review-draft-photo"}],"draft":true}');
  begin perform public.bv_get('', 'labfiles','review-draft-photo'); raise exception 'unpublished photo still exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: draft/photo access, publication changes, RPC permissions and progress merge' as result;
