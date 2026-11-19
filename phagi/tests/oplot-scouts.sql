-- Each fixture runs within this transaction; no real profile is touched.
begin;
do $scouts$
declare
  who text:='qa-scout-a-'||gen_random_uuid()::text;
  other text:='qa-scout-b-'||gen_random_uuid()::text;
  code_a text:=upper(gen_random_uuid()::text); code_b text:=upper(gen_random_uuid()::text);
  deck text:='qa-scout-deck-'||gen_random_uuid()::text; root_path text; other_path text;
  study_day date:=(clock_timestamp() at time zone 'Europe/Moscow')::date;
  upcoming date:=oplot.first_raid(clock_timestamp());
  nd jsonb:=jsonb_build_object('day',study_day,'n',0);
  stamp jsonb:=jsonb_build_object('card','b','studyDay',study_day,'ended',floor(extract(epoch from clock_timestamp())*1000));
  good jsonb:=jsonb_build_array(study_day+2,2,2.5,1,0);
  better jsonb:=jsonb_build_array(study_day+3,3,2.5,2,0);
  again jsonb:=jsonb_build_array(study_day,0,2.3,0,1);
  report jsonb; replay jsonb; daily_states jsonb;
begin
  insert into public.ph_students(uid,code,name) values(who,code_a,'A'),(other,code_b,'B');
  root_path:='srs/'||who||'/decks/'||deck; other_path:='srs/'||other||'/decks/'||deck;
  insert into public.ph_docs(path,parent,id,data) values('decks/'||deck,'decks',deck,
    jsonb_build_object('to',jsonb_build_array(who),'cards','[{"i":"a"},{"i":"b"}]'::jsonb));
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',jsonb_build_object('b',good),'nd',nd,'oplotFinish',stamp));
  if public.ph_oplot_scout(code_a)->>'unlocked'<>'false' then raise exception 'Partial deck unlocked';end if;
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',jsonb_build_object('a',good,'b',again),'nd',nd,'oplotFinish',stamp));
  if public.ph_oplot_scout(code_a)->>'unlocked'<>'false' then raise exception 'Again unlocked';end if;
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',jsonb_build_object('a',good,'b',good),'nd',nd));
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',jsonb_build_object('a',good,'b',good),'nd',nd,'oplotFinish',stamp));
  if public.ph_oplot_scout(code_a)->>'unlocked'<>'false' then raise exception 'Replayed old SRS or stale marker unlocked';end if;
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',jsonb_build_object('a',good,'b',better),'nd',nd,'oplotFinish',stamp));
  report:=public.ph_oplot_scout(code_a);
  if report->>'unlocked'<>'true' or (report->>'day')::date<>upcoming or (report->>'at')::timestamptz<>oplot.raid_at(upcoming)
    then raise exception 'Completed deck not credited: %',report;end if;
  replay:=oplot.night_battle('{"buildings":[{"id":"k","type":"keep","x":5,"y":5,"level":1}],"dragons":[]}',1,upcoming,who)->'replay';
  if report->'entrySide' is distinct from replay->'entrySide' then raise exception 'Forecast disagrees with battle: % %',report,replay;end if;
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',jsonb_build_object('a',good,'b',better),'nd',nd,'oplotFinish',stamp));
  if (select count(*) from oplot.scout_passes where uid=who)<>1 then raise exception 'Duplicate';end if;
  -- A second pupil cannot earn access with someone else's assignment or see their side.
  perform public.ph_set(code_b,other_path,jsonb_build_object('s',jsonb_build_object('a',good,'b',better),'nd',nd,'oplotFinish',stamp));
  if public.ph_oplot_scout(code_b) ? 'entrySide' then raise exception 'Foreign deck unlocked';end if;
  update public.ph_docs set data=jsonb_build_object('to',jsonb_build_array(other),'parts',1) where path='decks/'||deck;
  insert into public.ph_docs(path,parent,id,data) values('deckparts/'||deck||'~0','deckparts',deck||'~0',
    jsonb_build_object('deck',deck,'k',0,'cards','[{"i":"a"},{"i":"b"}]'::jsonb));
  perform public.ph_set(code_b,other_path,jsonb_build_object('s',jsonb_build_object('a',good),'nd',nd,'shards',2));
  perform public.ph_set(code_b,other_path||'~1',jsonb_build_object('s',jsonb_build_object('b',good),'oplotFinish',
    stamp||jsonb_build_object('ended',floor(extract(epoch from (clock_timestamp()-interval '25 hours'))*1000))));
  if public.ph_oplot_scout(code_b) ? 'entrySide' then raise exception 'Expired completion unlocked';end if;
  perform public.ph_set(code_b,other_path||'~1',jsonb_build_object('s',jsonb_build_object('b',better),'oplotFinish',stamp));
  if public.ph_oplot_scout(code_b)->>'unlocked'<>'true' then raise exception 'Sharded review failed';end if;
  update oplot.scout_passes set raid_day=upcoming-1 where uid=who;
  if public.ph_oplot_scout(code_a) ? 'entrySide' then raise exception 'Expired scout still displayed';end if;
  -- In a 21-card deck the normal queue stops at 20 new cards. An explicit
  -- full-deck session must also finish card 21, even after using today's quota.
  update public.ph_docs set data=jsonb_build_object('to',jsonb_build_array(who),'cards',
    (select jsonb_agg(jsonb_build_object('i',i::text)) from generate_series(1,21) i)) where path='decks/'||deck;
  select jsonb_object_agg(i::text,good) into daily_states from generate_series(1,20) i;
  nd:=jsonb_build_object('day',study_day,'n',20);
  stamp:=stamp||'{"card":"20","full":true}'::jsonb;
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',daily_states,'nd',nd,'oplotFinish',stamp));
  if public.ph_oplot_scout(code_a) ? 'entrySide' then raise exception 'Partial full-deck review received daily exception';end if;
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',daily_states||jsonb_build_object('20',better),'nd',nd,'oplotFinish',stamp||'{"full":false}'::jsonb));
  if public.ph_oplot_scout(code_a)->>'unlocked'<>'true' then raise exception 'Daily cap completion lost';end if;
  delete from oplot.scout_passes where uid=who;
  perform public.ph_set(code_a,root_path,jsonb_build_object('s',daily_states||jsonb_build_object('20',better,'21',good),'nd',nd,'oplotFinish',stamp||'{"card":"21"}'::jsonb));
  if public.ph_oplot_scout(code_a)->>'unlocked'<>'true' then raise exception 'Full review over daily cap lost';end if;
  if has_table_privilege('anon','oplot.scout_passes','select') or has_function_privilege('anon','oplot.scout_deck_complete(text,text,text,text,boolean)','execute') then raise exception 'Private data exposed';end if;
  begin perform public.ph_oplot_scout('');raise exception 'Anonymous report';exception when insufficient_privilege then null; end;
end $scouts$;
rollback;
