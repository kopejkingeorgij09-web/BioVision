-- ШАД в трекере «Фагов» (04.11.2026, по просьбе владельца).
--
-- У ученического профиля Георгия на «Фагах» трекер track/<uid>/items/shad-w<n>: по записи на каждый веб из shad/plan.json,
-- блок 's' + код курса, предмет 'shad', этап stage = отметка s из трекера ШАДа (0 «Не начат» … 4 «Закрыт»).
-- Синхронизация в обе стороны:
--   «Зов леса» / трекер ШАДа (bv_docs col='shad') → запись трекера: этап, дата веба, время, срок ДЗ;
--   правка записи на «Фагах» (учителем) → bv_docs: этап s и переносы в поле o (w.date, h.date).
-- Значения сравниваются перед записью, поэтому триггеры не гоняют друг друга по кругу.

create or replace function public._shad_track_row(n int) returns void
language plpgsql security definer set search_path = public as $$
declare e jsonb; b jsonb; tp text; t jsonb; nt text; due text; st int; tm text;
begin
  tp := 'track/' || _shad_ph_uid() || '/items/shad-w' || n;
  select data into t from ph_docs where path = tp and not deleted;
  if t is null then return; end if;
  select data into e from ph_docs where path = 'events/shad-w' || n and not deleted;
  select data into b from bv_docs where col = 'shad' and id = 'w' || lpad(n::text, 2, '0');
  st := coalesce((b->>'s')::int, 0);
  nt := coalesce(e->>'date', t->>'date');
  due := coalesce(b->'o'->'h'->>'date', e->>'phw', t->>'due', '');
  tm := case when coalesce(e->>'start', '') = '' then '' else (e->>'start') || case when coalesce(e->>'end', '') <> '' then '–' || (e->>'end') else '' end end;
  if (t->>'stage')::int is distinct from st or t->>'date' is distinct from nt or coalesce(t->>'due', '') is distinct from due
     or coalesce(t->>'time', '') is distinct from tm then
    update ph_docs set data = data || jsonb_build_object('stage', st, 'date', nt, 'due', due, 'time', tm,
        'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), updated_at = clock_timestamp()
    where path = tp;
  end if;
end $$;

-- записи трекера: даты берутся из уже перенесённых занятий events/shad-w<n>
insert into ph_docs(path, parent, id, data)
select 'track/' || _shad_ph_uid() || '/items/shad-w' || v.n, 'track/' || _shad_ph_uid() || '/items', 'shad-w' || v.n,
  jsonb_build_object('kind', 'lesson', 'shad', v.n, 'subj', 'shad', 'block', 's' || v.c, 'title', v.code || ': ' || v.t,
    'date', coalesce(e.data->>'date', '2026-11-03'), 'time', '', 'due', '', 'hw', 'ДЗ к вебу', 'points', '[]'::jsonb, 'stage', 0, 'note', '',
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
from (values
  (1,'m1','Семинар 1','Школьная математика, необходимая для Вышмата'),
  (2,'m1','Лекция 1','Необходимые навыки для изучения ВышМата'),
  (3,'ag','Веб 1','Матрицы и операции над ними, СЛАУ'),
  (4,'m1','Семинар 2','Метод математической индукции'),
  (5,'m1','Лекция 2','Комплексные числа. Формула Эйлера'),
  (6,'ag','Веб 2','Определитель матрицы. Методы Крамера и Гаусса'),
  (7,'m1','Лекция 3','Определение предела последовательности'),
  (8,'ag','Веб 3','Вектор, базис, система координат'),
  (9,'m1','Лекция 4','Вычисление пределов последовательностей'),
  (10,'m1','Семинар 3','Предел последовательности (семинар)'),
  (11,'ag','Веб 4','Замена базиса'),
  (12,'m1','Лекция 5','Супремум и инфимум. Теорема Вейерштрасса'),
  (13,'m1','Лекция 6','Частичные пределы. Фундаментальные последовательности'),
  (14,'ag','Веб 5','Скалярное, векторное и смешанное произведения'),
  (15,'m1','Семинар 4','Понятие функции и эскизы графиков'),
  (16,'ag','Веб 6','Прямые и плоскости в пространстве'),
  (17,'m1','Лекция 7','Предел функции по Гейне и по Коши'),
  (18,'m1','Лекция 8','Вычисление пределов функций'),
  (19,'m1','Семинар 5','Предел функции (семинар)'),
  (20,'ag','Веб 7','Кривые второго порядка'),
  (21,'m1','Лекция 9','Замечательные пределы и эквивалентные замены'),
  (22,'m1','Семинар 6','Замечательные пределы, эквивалентные замены (семинар)'),
  (23,'ag','Веб 8','Эллипс, гипербола и парабола: основные свойства'),
  (24,'gr','Веб 1','Предел функции и односторонние пределы'),
  (25,'gr','Веб 2','Непрерывность и классификация точек разрыва'),
  (26,'dm','Веб 1','Комбинаторика, бином Ньютона и треугольник Паскаля'),
  (27,'gr','Веб 3','Равномерная непрерывность и асимптоты'),
  (28,'dm','Веб 2','Бинарные отношения и отображения'),
  (29,'m1','Лекция 10','Определение производной функции'),
  (30,'m1','Семинар 7','Производная функции (семинар)'),
  (31,'m1','Лекция 11','Производная сложной функции. Теоремы о среднем'),
  (32,'dm','Веб 3','Теория графов: теория'),
  (33,'m1','Лекция 12','Производные высших порядков. Формула Тейлора'),
  (34,'m1','Семинар 8','Формула Маклорена и формула Тейлора (семинар)'),
  (35,'dm','Веб 4','Теория графов: практика'),
  (36,'m1','Лекция 13','Вычисление пределов с помощью формулы Тейлора'),
  (37,'gr','Веб 4','Монотонность и дифференцируемость функций'),
  (38,'dm','Веб 5','Деревья и раскраски'),
  (39,'gr','Веб 5','Выпуклость и вогнутость функций'),
  (40,'gr','Веб 6','Точки экстремума и точки перегиба'),
  (41,'la','Азы 1/2','Матрицы и операции над ними, СЛАУ'),
  (42,'gr','Веб 7','План построения графиков функций'),
  (43,'gr','Веб 8','Практика построения графиков функций'),
  (44,'la','Азы 2/2','Определители. Методы Крамера и Гаусса'),
  (45,'gr','Веб 9','Параметрические функции'),
  (46,'la','Системы 1/3','Определитель матрицы'),
  (47,'gr','Веб 10','Функции в полярной системе координат'),
  (48,'gr','Веб 11','Неявные функции'),
  (49,'la','Системы 2/3','Обратная матрица и ранг. Определитель Вандермонда'),
  (50,'in','Азы 1/3','Азы интегрирования, урок 1/3'),
  (51,'in','Азы 2/3','Азы интегрирования, урок 2/3'),
  (52,'la','Системы 3/3','СЛАУ, ФСР, критерий Кронекера–Капелли'),
  (53,'in','Азы 3/3','Азы интегрирования, урок 3/3'),
  (54,'in','Техники 1/3','Техники интегрирования, урок 1/3'),
  (55,'la','Пространства 1/4','Линейные пространства, линейная зависимость'),
  (56,'in','Техники 2/3','Техники интегрирования, урок 2/3'),
  (57,'in','Техники 3/3','Техники интегрирования, урок 3/3'),
  (58,'la','Пространства 2/4','Линейная оболочка и подпространства'),
  (59,'in','Геометрия 1/4','Геометрическое приложение, урок 1/4'),
  (60,'in','Геометрия 2/4','Геометрическое приложение, урок 2/4'),
  (61,'la','Пространства 3/4','Базис и размерность, формула Грассмана'),
  (62,'in','Геометрия 3/4','Геометрическое приложение, урок 3/4'),
  (63,'in','Геометрия 4/4','Геометрическое приложение, урок 4/4'),
  (64,'la','Пространства 4/4','Переход между базисами, сопряжённое пространство'),
  (65,'m2','Лекция 1','Функции нескольких переменных и их графики'),
  (66,'m2','Лекция 2','Повторные и двойные пределы'),
  (67,'la','Операторы 1/6','Линейные отображения, образ и ядро, линейные операторы'),
  (68,'m2','Лекция 3','Частные производные и дифференцируемость ФНП'),
  (69,'m2','Лекция 4','Частные производные высших порядков'),
  (70,'la','Операторы 2/6','Бонусный веб: практика по собственным значениям и векторам'),
  (71,'m2','Лекция 5','Производная по направлению, градиент, Тейлор'),
  (72,'m2','Лекция 6','Экстремумы ФНП — безусловные и условные'),
  (73,'la','Операторы 3/6','Собственные значения и векторы оператора, диагонализируемость, инвариантные подпространства'),
  (74,'m2','Семинар 1','Решение задач по ФНП, часть 1'),
  (75,'m2','Семинар 2','Решение задач по ФНП, часть 2'),
  (76,'la','Операторы 4/6','Теория на жорданову нормальную форму'),
  (77,'m2','Лекция 7','Интеграл Римана и свойства интегрируемых функций'),
  (78,'m2','Лекция 8','Ньютон–Лейбниц. Замена переменных, по частям'),
  (79,'la','Операторы 5/6','Практика на жорданову нормальную форму'),
  (80,'m2','Лекция 9','Несобственные интегралы'),
  (81,'m2','Семинар 3','Решение задач по интегралам, часть 1'),
  (82,'m2','Семинар 4','Решение задач по интегралам, часть 2'),
  (83,'la','Евклидовы 1/4','Билинейные и квадратичные формы'),
  (84,'m2','Лекция 10','Числовые ряды. Сравнение, Даламбер, Коши'),
  (85,'m2','Лекция 11','Числовые ряды. Дирихле, Абель, Раабе, Лейбниц'),
  (86,'la','Евклидовы 2/4','Метод Лагранжа, закон инерции, критерий Сильвестра'),
  (87,'m2','Лекция 12','Функц. последовательности. Равномерная сходимость'),
  (88,'m2','Лекция 13','Функциональные и степенные ряды'),
  (89,'la','Евклидовы 3/4','Евклидовы пространства, Грам–Шмидт, проекции'),
  (90,'la','Операторы 6/6','Функции от операторов и матричная экспонента'),
  (91,'m2','Семинар 5','Решение задач по рядам, часть 1'),
  (92,'m2','Семинар 6','Решение задач по рядам, часть 2'),
  (93,'la','Евклидовы 4/4','Ортогональное дополнение, классификация линий и поверхностей'),
  (94,'in','Кратные 1/2','Кратные интегралы, урок 1/2'),
  (95,'in','Кратные 2/2','Кратные интегралы, урок 2/2'),
  (96,'la','ML 1/3','LU-разложение и разложение Холецкого'),
  (97,'in','Олимпиадное 1/4','Олимпиадное интегрирование, урок 1/4'),
  (98,'in','Олимпиадное 2/4','Олимпиадное интегрирование, урок 2/4'),
  (99,'la','ML 2/3','QR-разложение и метод наименьших квадратов'),
  (100,'in','Олимпиадное 3/4','Олимпиадное интегрирование, урок 3/4'),
  (101,'in','Олимпиадное 4/4','Олимпиадное интегрирование, урок 4/4'),
  (102,'la','ML 3/3','SVD-разложение и метод главных компонент')
) v(n, c, code, t)
left join ph_docs e on e.path = 'events/shad-w' || v.n and not e.deleted
on conflict (path) do nothing;

do $$ begin perform _shad_track_row(n) from generate_series(1, 102) n; end $$;

-- «Зов леса» → трекер «Фагов» (после shad_bv_sync, который двигает занятие: триггеры идут по алфавиту)
create or replace function public._shad_bv_track_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  n := nullif(substring(new.id from '^w(\d+)$'), '')::int;
  if n is not null then perform _shad_track_row(n); end if;
  return null;
end $$;
drop trigger if exists shad_bv_track on public.bv_docs;
create trigger shad_bv_track after insert or update on public.bv_docs
  for each row when (new.col = 'shad') execute function public._shad_bv_track_trg();

-- трекер «Фагов» → «Зов леса»: учитель поменял этап, дату веба или срок ДЗ
create or replace function public._shad_track_bv_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; id_ text; b jsonb; e jsonb; st int; o jsonb; ms bigint := (extract(epoch from now()) * 1000)::bigint; ch boolean := false;
begin
  if new.deleted then return null; end if;
  n := nullif(substring(new.id from '^shad-w(\d+)$'), '')::int;
  if n is null then return null; end if;
  id_ := 'w' || lpad(n::text, 2, '0');
  select data into b from bv_docs where col = 'shad' and id = id_;
  select data into e from ph_docs where path = 'events/shad-w' || n and not deleted;
  st := coalesce((new.data->>'stage')::int, 0);
  o := coalesce(b->'o', '{}'::jsonb);
  if new.data->>'date' is not null and new.data->>'date' is distinct from coalesce(o->'w'->>'date', e->>'date') then
    o := jsonb_set(o, '{w}', coalesce(o->'w', '{}'::jsonb) || jsonb_build_object('date', new.data->>'date')); ch := true;
  end if;
  if coalesce(new.data->>'due', '') <> '' and new.data->>'due' is distinct from coalesce(o->'h'->>'date', e->>'phw') then
    o := jsonb_set(o, '{h}', coalesce(o->'h', '{}'::jsonb) || jsonb_build_object('date', new.data->>'due')); ch := true;
  end if;
  if b is null then
    insert into bv_docs(col, id, data, updated_at) values ('shad', id_, jsonb_build_object('s', st, 'note', '', 'at', ms, 'o', o), now());
  elsif st is distinct from coalesce((b->>'s')::int, 0) or ch then
    update bv_docs set data = data || jsonb_build_object('s', st, 'at', ms, 'o', o), updated_at = now() where col = 'shad' and id = id_;
  end if;
  return null;
end $$;
drop trigger if exists shad_track_bv on public.ph_docs;
create trigger shad_track_bv after update on public.ph_docs
  for each row when (new.path like 'track/u_a7f09iDQmUe0Pa3S8bZuYQ/items/shad-w%') execute function public._shad_track_bv_trg();

revoke execute on function public._shad_track_row(int) from public, anon, authenticated;
revoke execute on function public._shad_bv_track_trg() from public, anon, authenticated;
revoke execute on function public._shad_track_bv_trg() from public, anon, authenticated;
