export const elements = ['Огонь','Вода','Ветер','Земля','Флора','Энергия','Металл','Пустота','Тьма','Свет'];
export const colors = ['#ce5238','#369bbc','#8ecbb0','#b78345','#6ca34f','#e5b832','#82a3ae','#9675ba','#696385','#eadb91'];
export const signs = ['♨','≈','≋','▲','❧','ϟ','⬡','◌','☾','☼'];
export const rarities = ['','Обычный','Редкий','Эпический','Легендарный'];
export const roles = ['Штурмовик','Страж','Стрелок','Ловчий','Осадный'];
export const skills = ['Рывок','Прикрытие','Дальний залп','Оцепенение','Пролом'];
const records = `0|Углеклюв
1|Приливник
2|Перистый свистун
3|Янтарный кряж
4|Вересковая лапа
5|Искрохвост
6|Меднолоб
7|Тихоступ
8|Сумеречник
9|Зореглаз
01|Паровой скат
02|Пепельная ласточка
03|Лавовый тур
04|Огнецвет
06|Кузнечный жук
07|Угольный шёлк
08|Ночная свеча
09|Алый венец
12|Морской змей
13|Рифовый молот
14|Лотосовый плавник
15|Грозовая игла
16|Ртутная выдра
17|Глубинник
18|Лунная нерпа
19|Жемчужный парус
23|Горный планёр
24|Семенной вихрь
25|Громоперо
26|Складнокрыл
27|Беззвучный сокол
28|Дымчатый стриж
29|Золотая чайка
34|Лесной валун
35|Резонатор
36|Рудный барс
37|Пещерный странник
38|Сланцевый крот
45|Цветущий луч
46|Ивовый разряд
47|Бронзовый шип
48|Блуждающий корень
49|Полуночный плющ
56|Магнитный скок
57|Шаровая тень
59|Солнечный ток
67|Полый колокол
68|Воронёный коготь
69|Зеркальный гребень
79|Звёздный провал
013|Гейзерный исполин
469|Коралловый гонец
257|Огненный папоротник
578|Крылатый тигель
468|Пепельный звонарь
239|Гелиотроп
017|Пляшущий шлак
189|Искристый кулик
034|Багряный клин
256|Облачный аммонит
238|Штормовой пастух
145|Опаловая цапля
079|Донный фонарь
246|Пенный зубр
058|Росный охотник
367|Полярная сирена
159|Листопадник
137|Грозовой дятел
026|Рассветный гриф
489|Звёздный филин
068|Летучий бархан
237|Молниевый мох
459|Железная орхидея
147|Малахитовый страж
356|Горный оракул
012|Чёрный базальт
589|Зеркальная дюна
248|Шелестящий призрак
136|Северный цветок
057|Буревестник рощи
269|Никелевый угорь
479|Спектральный овод
138|Метеорный волк
014|Ночной арфист
789|Серебряное затмение
5789|Странник кальдеры
1346|Владыка четырёх приливов
0269|Хранитель янтарного бора
2578|Астролябия
0134|Полуденный левиафан
0149|Садовник облаков
2356|Звонкая бездна
2478|Хрустальный долгопят
0178|Первый гром
2569|Корона перевала
3467|Затонувший компас
0159|Певчий монолит
1389|Ходячая зарница
0257|Пожиратель эха
3468|Ловец северного света`;
export const species = records.split('\n').map((line,index) => {
  const [key,name] = line.split('|');
  const types = Array.from(key,Number);
  const role = ({'3':1,'1':2,'26':0})[key] ?? ((index+types.at(-1))%roles.length);
  return {id:'s'+key, name, types, rarity:types.length, role, index, art:({'3':'earth','1':'water','26':'metal'})[key] || 'study',
    hp:[145,210,106,132,165][role]+index%11, power:[21,16,23,17,25][role]+index%4, range:[12,10,30,22,15][role], speed:[15,8,10,13,9][role]};
});
export const byId = Object.fromEntries(species.map(s=>[s.id,s]));
export const starPrices = [10,20,35,55,80];
export const foodPrice = level=>Math.ceil(30*Math.pow(level,1.42));
export function stats(d) {
  const s = byId[d.species], scale = 1 + .09 * (d.level + 2*d.stars - 1);
  return {hp:Math.round(s.hp*scale), power:Math.round(s.power*scale), range:s.range, speed:s.speed};
}
export function distribution(a,b) {
  const p=byId[a.species], q=byId[b.species], hi=Math.max(p.rarity,q.rarity), lo=Math.min(p.rarity,q.rarity);
  const types=new Set([...p.types,...q.types]);
  const pool=species.filter(s=>s.types.every(e=>types.has(e)));
  const bracket={'11':[30,45],'22':[20,35],'33':[10,25],'12':[1,3],'23':[.5,2]}[''+lo+hi];
  const t=(Math.max(1,Math.min(30,(a.level+b.level)/2))-1)/29;
  const promoted=bracket&&pool.some(s=>s.rarity===hi+1)?(bracket[0]+(bracket[1]-bracket[0])*t)/100:0;
  const weights=new Map([[hi,(1-promoted)*(lo===hi?1:.7)]]);
  if(lo!==hi)weights.set(lo,(1-promoted)*.3);
  if(promoted)weights.set(hi+1,promoted);
  return pool.filter(s=>weights.has(s.rarity)).map(s=>({id:s.id,p:weights.get(s.rarity)/pool.filter(o=>o.rarity===s.rarity).length}));
}
export function percentages(rows) {
  const values=rows.map(r=>Math.floor(r.p*100000)), order=rows.map((r,i)=>({i,rest:r.p*100000-values[i]})).sort((a,b)=>b.rest-a.rest);
  const left=values.length?100000-values.reduce((sum,v)=>sum+v,0):0;
  for(let j=0;j<left;j++)values[order[j].i]++;
  return values.map(n=>n/1000);
}
export function draw(rows,random) {
  let roll=random();
  for(const r of rows){roll-=r.p;if(roll<0)return r.id;}
  return rows.at(-1).id;
}
export function pairing(id, stock=species) {
  for(let i=0;i<stock.length;i++)for(const b of stock.slice(i)) {
    const a=stock[i]; if(a.rarity>=byId[id].rarity || b.rarity>=byId[id].rarity)continue;
    if(distribution({species:a.id,level:1},{species:b.id,level:1}).some(r=>r.id===id))return [a,b];
  }
  return [];
}
