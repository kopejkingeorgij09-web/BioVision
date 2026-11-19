-- Run against PostgreSQL after phagi_oplot_diamonds. All study data and purchases roll back.
begin;
create function pg_temp.oplot_doc(p text, v jsonb) returns void language sql as $$
  insert into public.ph_docs(path,parent,id,data) values(p,regexp_replace(p,'/[^/]+$',''),substring(p from '([^/]+)$'),v)
  on conflict(path) do update set data=excluded.data,deleted=false
$$;
do $test$
declare
  uid1 text:='qa-oplot-'||gen_random_uuid(); uid2 text:='qa-oplot-'||gen_random_uuid();
  c1 text:=upper(gen_random_uuid()::text); c2 text:=upper(gen_random_uuid()::text);
  deck text:=gen_random_uuid()::text; hw text:=gen_random_uuid()::text; quiz text:=gen_random_uuid()::text;
  review text:='srs/'||uid1||'/decks/'||deck; submission text:='subs/'||uid1||'/items/'||hw;
  grade text:='grades/'||uid1||'/items/'||hw; op uuid:=gen_random_uuid(); denied boolean;
  learned jsonb:='["2026-11-21",1,2.5,1,0]'; w jsonb; purchase jsonb;
begin
  insert into public.ph_students(uid,code) values(uid1,c1),(uid2,c2);
  perform pg_temp.oplot_doc('decks/'||deck,jsonb_build_object('to',jsonb_build_array(uid1),'cards','[{"i":"one"}]'::jsonb));
  perform pg_temp.oplot_doc(review,jsonb_build_object('s',jsonb_build_object('one',learned,'unknown',learned)));
  perform pg_temp.oplot_doc(review||'~1',jsonb_build_object('s',jsonb_build_object('one',learned)));
  perform pg_temp.oplot_doc('srs/'||uid2||'/decks/'||deck,jsonb_build_object('s',jsonb_build_object('one',learned)));
  w:=public.ph_oplot_wallet(c1);
  if w<> '{"cards":1,"homework":0,"spent":0,"balance":1}' or (public.ph_oplot_wallet(c2)->>'cards')::int<>0 then
    raise exception 'Card award or account isolation failed: %',w;
  end if;
  purchase:=public.ph_oplot_buy(c1,'incubate',op);
  if purchase->>'balance'<>'0' or public.ph_oplot_buy(c1,'incubate',op)<>purchase then raise exception 'Debit replay failed'; end if;
  denied:=false;
  begin perform public.ph_oplot_buy(c1,'gold',op); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Purchase key reused for a different item'; end if;
  denied:=false;
  begin perform public.ph_oplot_buy(c1,'incubate',gen_random_uuid()); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Overdrawn wallet'; end if;
  perform pg_temp.oplot_doc('tasks/'||hw,jsonb_build_object('kind','task','to',jsonb_build_array(uid1),'max',10));
  perform pg_temp.oplot_doc(submission,'{"status":"draft"}');
  perform pg_temp.oplot_doc(grade,'{"notes":[]}');
  perform pg_temp.oplot_doc(submission,'{"status":"submitted","updatedAt":"2026-11-19T09:00:00Z"}');
  if public.ph_oplot_wallet(c1)->>'homework'<>'0' then raise exception 'Ungraded work was rewarded'; end if;
  perform pg_temp.oplot_doc(grade,'{"score":0,"returnedAt":"2026-11-19T10:00:00Z"}');
  if public.ph_oplot_wallet(c1)->>'homework'<>'5' then raise exception 'Minimum reward'; end if;
  perform pg_temp.oplot_doc(grade,'{"score":5,"returnedAt":"2026-11-19T10:05:00Z"}');
  if public.ph_oplot_wallet(c1)->>'homework'<>'8' then raise exception 'Half credit'; end if;
  perform pg_temp.oplot_doc(grade,'{"score":10,"returnedAt":"2026-11-19T10:06:00Z"}');
  perform pg_temp.oplot_doc(grade,'{"score":1,"returnedAt":"2026-11-19T10:07:00Z"}');
  if public.ph_oplot_wallet(c1)->>'homework'<>'10' then raise exception 'Regrading lost an earned reward'; end if;
  perform pg_temp.oplot_doc('tasks/'||quiz,jsonb_build_object('kind','test','to',jsonb_build_array(uid1,uid2),
    'q','[{"t":"text","acc":["1,0"],"pts":2},{"t":"single","ans":[1]},{"t":"multi","ans":[0,2]}]'::jsonb));
  perform pg_temp.oplot_doc('subs/'||uid1||'/items/'||quiz,'{"status":"submitted","answers":["1",1,[2,0]],"auto":0}');
  perform pg_temp.oplot_doc('subs/'||uid2||'/items/'||quiz,'{"status":"submitted","answers":["wrong",0,[1]],"auto":999}');
  if public.ph_oplot_wallet(c1)->>'homework'<>'20' or public.ph_oplot_wallet(c2)->>'homework'<>'5' then
    raise exception 'Independent quiz scoring failed'; end if;
  denied:=false;
  begin perform public.ph_oplot_wallet(''); exception when insufficient_privilege then denied:=true; end;
  if not denied or has_schema_privilege('anon','oplot','usage') or has_table_privilege('authenticated','oplot.credits','insert') then
    raise exception 'Anonymous balance or ledger access'; end if;
end $test$;
rollback;
