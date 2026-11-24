-- Keep all digits in webinar identifiers used by the three-way schedule sync.
do $fix$
declare
  signature regprocedure;
  definition text;
begin
  foreach signature in array array[
    'public._phx_ph_trg()'::regprocedure,
    'public._shad_ph_stage(text,text)'::regprocedure,
    'public._shad_track_bv_trg()'::regprocedure,
    'public._shad_track_row(integer)'::regprocedure
  ] loop
    definition := pg_get_functiondef(signature);
    if position($old$lpad(n::text, 2, '0')$old$ in definition) > 0 then
      execute replace(definition, $old$lpad(n::text, 2, '0')$old$,
                                  $new$lpad(n::text, greatest(2, length(n::text)), '0')$new$);
    end if;
  end loop;
end
$fix$;

create temporary table shad_may30_schedule (
  n integer primary key,
  web_date text not null,
  hw_date text not null
) on commit drop;

insert into shad_may30_schedule values
  (4, '2026-11-25', '2026-11-26'),
  (5, '2026-11-26', '2026-11-28'),
  (6, '2026-11-27', '2026-11-29'),
  (7, '2026-12-01', '2026-12-02'),
  (8, '2026-12-03', '2026-12-04'),
  (9, '2026-12-05', '2026-12-05'),
  (10, '2026-12-06', '2026-12-06'),
  (11, '2026-12-08', '2026-12-09'),
  (12, '2026-12-10', '2026-12-11'),
  (13, '2026-12-12', '2026-12-12'),
  (14, '2026-12-13', '2026-12-13'),
  (15, '2026-12-15', '2026-12-16'),
  (16, '2026-12-17', '2026-12-18'),
  (17, '2026-12-19', '2026-12-20'),
  (18, '2026-12-22', '2026-12-23'),
  (19, '2026-12-24', '2026-12-25'),
  (20, '2026-12-26', '2026-12-26'),
  (21, '2026-12-27', '2026-12-27'),
  (22, '2026-12-29', '2026-12-30'),
  (23, '2026-12-31', '2027-01-01'),
  (24, '2027-01-02', '2027-01-03'),
  (25, '2027-01-05', '2027-01-06'),
  (27, '2027-01-30', '2027-01-31'),
  (29, '2027-01-09', '2027-01-10'),
  (30, '2027-01-12', '2027-01-13'),
  (31, '2027-01-16', '2027-01-17'),
  (33, '2027-01-19', '2027-01-20'),
  (34, '2027-01-23', '2027-01-24'),
  (36, '2027-01-26', '2027-01-27'),
  (37, '2027-02-02', '2027-02-03'),
  (39, '2027-02-06', '2027-02-06'),
  (40, '2027-02-07', '2027-02-07'),
  (41, '2027-01-07', '2027-01-08'),
  (42, '2027-04-29', '2027-04-30'),
  (43, '2027-05-01', '2027-05-01'),
  (44, '2027-01-14', '2027-01-15'),
  (45, '2027-05-02', '2027-05-02'),
  (46, '2027-01-21', '2027-01-22'),
  (47, '2027-05-04', '2027-05-05'),
  (48, '2027-05-06', '2027-05-07'),
  (49, '2027-01-28', '2027-01-29'),
  (50, '2027-02-18', '2027-02-19'),
  (51, '2027-02-25', '2027-02-26'),
  (52, '2027-02-04', '2027-02-05'),
  (53, '2027-03-06', '2027-03-06'),
  (54, '2027-05-08', '2027-05-08'),
  (55, '2027-02-09', '2027-02-10'),
  (56, '2027-05-09', '2027-05-09'),
  (57, '2027-05-11', '2027-05-12'),
  (58, '2027-02-16', '2027-02-17'),
  (59, '2027-05-13', '2027-05-14'),
  (60, '2027-05-15', '2027-05-15'),
  (61, '2027-02-23', '2027-02-24'),
  (62, '2027-05-16', '2027-05-16'),
  (63, '2027-05-18', '2027-05-19'),
  (64, '2027-03-04', '2027-03-05'),
  (65, '2027-02-11', '2027-02-12'),
  (66, '2027-02-13', '2027-02-14'),
  (67, '2027-03-11', '2027-03-12'),
  (68, '2027-02-20', '2027-02-20'),
  (69, '2027-02-21', '2027-02-21'),
  (70, '2027-03-21', '2027-03-21'),
  (71, '2027-02-27', '2027-02-28'),
  (72, '2027-03-02', '2027-03-03'),
  (73, '2027-03-20', '2027-03-20'),
  (74, '2027-03-07', '2027-03-07'),
  (75, '2027-03-09', '2027-03-10'),
  (76, '2027-03-27', '2027-03-28'),
  (77, '2027-03-13', '2027-03-14'),
  (78, '2027-03-16', '2027-03-17'),
  (79, '2027-03-30', '2027-03-31'),
  (80, '2027-03-18', '2027-03-19'),
  (81, '2027-03-23', '2027-03-24'),
  (82, '2027-03-25', '2027-03-26'),
  (83, '2027-04-04', '2027-04-04'),
  (84, '2027-04-01', '2027-04-02'),
  (85, '2027-04-03', '2027-04-03'),
  (86, '2027-04-06', '2027-04-07'),
  (87, '2027-04-08', '2027-04-09'),
  (88, '2027-04-10', '2027-04-11'),
  (89, '2027-04-13', '2027-04-14'),
  (90, '2027-04-15', '2027-04-16'),
  (91, '2027-04-17', '2027-04-17'),
  (92, '2027-04-18', '2027-04-18'),
  (93, '2027-04-20', '2027-04-21'),
  (94, '2027-05-20', '2027-05-21'),
  (95, '2027-05-22', '2027-05-23'),
  (96, '2027-04-22', '2027-04-23'),
  (97, '2027-05-25', '2027-05-26'),
  (98, '2027-05-27', '2027-05-28'),
  (99, '2027-04-24', '2027-04-25'),
  (100, '2027-05-29', '2027-05-29'),
  (101, '2027-05-30', '2027-05-30'),
  (102, '2027-04-27', '2027-04-28');

-- The event carries fallback dates when a personal placement is cleared.
update public.ph_docs as doc
set data = doc.data || jsonb_build_object('pdate', plan.web_date, 'phw', plan.hw_date),
    updated_at = now()
from shad_may30_schedule as plan
where doc.path = 'events/shad-w' || plan.n
  and not doc.deleted
  and doc.data->'to' = jsonb_build_array(public._shad_ph_uid());

-- The normal sync triggers update the event, homework and learner tracker.
insert into public.bv_docs as doc (col, id, data, updated_at)
select 'shad', 'w' || lpad(n::text, greatest(2, length(n::text)), '0'),
       jsonb_build_object('s', 0, 'note', '', 'at', (extract(epoch from now()) * 1000)::bigint,
                          'o', jsonb_build_object('w', jsonb_build_object('date', web_date),
                                                  'h', jsonb_build_object('date', hw_date))),
       now()
from shad_may30_schedule
on conflict (col, id) do update
set data = doc.data || jsonb_build_object(
      'at', excluded.data->'at',
      'o', (coalesce(doc.data->'o', '{}'::jsonb) - 'w' - 'h') || (excluded.data->'o')),
    updated_at = excluded.updated_at;

do $check$
begin
  if exists (
    select 1
    from shad_may30_schedule as plan
    left join public.bv_docs as mark
      on mark.col = 'shad' and mark.id = 'w' || lpad(plan.n::text, greatest(2, length(plan.n::text)), '0')
    left join public.ph_docs as event on event.path = 'events/shad-w' || plan.n and not event.deleted
    left join public.ph_docs as tracker
      on tracker.path = 'track/' || public._shad_ph_uid() || '/items/shad-w' || plan.n and not tracker.deleted
    where mark.data #>> '{o,w,date}' is distinct from plan.web_date
       or mark.data #>> '{o,h,date}' is distinct from plan.hw_date
       or event.data->>'date' is distinct from plan.web_date
       or event.data->>'pdate' is distinct from plan.web_date
       or event.data->>'phw' is distinct from plan.hw_date
       or tracker.data->>'date' is distinct from plan.web_date
       or tracker.data->>'due' is distinct from plan.hw_date
  ) then
    raise exception 'ШАД: даты календаря и трекеров не совпали';
  end if;

  if exists (
    select 1 from public.ph_docs as task
    join shad_may30_schedule as plan on task.data #>> '{lesson,eventId}' = 'shad-w' || plan.n
    where task.parent = 'tasks' and not task.deleted
      and task.data->'to' = jsonb_build_array(public._shad_ph_uid())
      and task.data->>'kind' in ('task', 'test')
      and coalesce(task.data->>'fix', 'false') <> 'true'
      and (task.data->>'due' is distinct from plan.hw_date
        or task.data #>> '{lesson,date}' is distinct from plan.web_date)
  ) then
    raise exception 'ШАД: сроки заданий не совпали';
  end if;
end
$check$;
