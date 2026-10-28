/* Осмотр дракона (этап 2 Драконов 3.0): нажатие на дракона на острове или в списке открывает отдельную сцену.
   Камера плавно приближается от того места, где дракон был на острове, дракон крупно и живой (риг из рисунка A,
   anim.js), части тела можно рассмотреть мышью, касанием и с клавиатуры, рядом имя, возраст, пол, стихии,
   характеристики, «Покормить», «Родословная», «В бой» и отдельная кнопка «Генетический паспорт»:
   хромосомы, сцепление, правила наследования с метками «как в природе», «условность модели», «только рисунок»,
   ген в таблице подсвечивает часть тела и наоборот.
   Закрытие возвращает камеру туда же, остров при этом не перестраивается: его камера (S.drgCam) и выбор не меняются.
   Сцена живёт вне дерева страницы (последний ребёнок body), поэтому перерисовка острова ей не мешает.
   Модули рисунка и анимации (morph, shape, art, texcache, sprites, anim, rig, stats) подгружаются при первом осмотре.
   Верхняя часть файла — чистые помощники без DOM, их проверяет inspect.test.js. */
(function(root){
'use strict';
const DRG=root.DRG||(typeof require!=='undefined'?require('./genetics.js'):null);

/* ---------- части тела, гены, генотип: без DOM ---------- */
const PART={head:'Голова',eyes:'Глаза',horns:'Рога',collar:'Воротник',crest:'Гребень',body:'Тело',skin:'Чешуя и узор',
  metal:'Блеск чешуи',wings:'Крылья',legs:'Лапы',spurs:'Шпоры',tailEnd:'Кончик хвоста',mace:'Булава',breath:'Дыхание',aura:'Сияние'};
const PART_ORDER=Object.keys(PART);
const ELN={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const ELW={F:'огонь',W:'вода',T:'земля',A:'воздух',P:'флора',L:'свет',D:'тьма',e:'без стихии','0':'нейтральный (ничего не добавляет)'};
const AL={Cb:'cᵇ',R1:'R¹',R2:'R²',Wg:'Wgˢ','-':'−'};
const al=a=>AL[a]||a;
const num=v=>String(Math.round(v*10)/10).replace('.',',');

/* какие части тела есть у этого дракона: по слоям рисунка (поле of или part), тень не часть тела */
function partsHere(G){const s=new Set();G.layers.forEach(l=>{const k=l.of||l.part;if(PART[k])s.add(k)});return PART_ORDER.filter(k=>s.has(k))}

/* аллели локуса у этого генотипа: где лежит ген и сколько у него копий */
function allelesOf(g,l){
  for(const c of Object.keys(DRG.CHROMS)){const i=DRG.CHROMS[c].loci.indexOf(l);if(i>=0)return {kind:'auto',chr:c,al:[g[c][0][i],g[c][1][i]]}}
  const zi=DRG.Z.loci.indexOf(l);
  if(zi>=0)return g.sex==='M'?{kind:'zz',chr:'Z',al:[g.Z[0][zi],g.Z[1][zi]]}:{kind:'zw',chr:'Z',al:[g.Z[0][zi]]};
  if(l==='Sp')return g.sex==='F'?{kind:'w',chr:'W',al:[g.W]}:{kind:'none',chr:'W',al:[]};
  if(l==='G')return {kind:'mt',chr:'mt',al:[g.mt]};
  return {kind:'none',chr:null,al:[]}}
function allelesText(g,l){
  const a=allelesOf(g,l);
  if(a.kind==='auto'||a.kind==='zz')return a.al.map(al).join('/');
  if(a.kind==='zw')return al(a.al[0])+' (одна Z)';
  if(a.kind==='w')return al(a.al[0])+' (на W)';
  if(a.kind==='mt')return al(a.al[0])+' (митохондрии)';
  return 'нет: у самца нет W'}

/* как ген проявился: читаем готовый фенотип (DRG.phenotype), правила доминирования здесь не повторяются */
const SPAN=ph=>`размах ${num(ph.spanM)} м, «+» ${ph.span} из 6`;
const SHOW={
  E:ph=>ph.breath==='dormant'?'не проявляется: ss гасит стихию':ph.elements.length?ph.elements.map(e=>ELN[e]).join(' и '):'стихии нет, дымный',
  E2:ph=>ph.breath==='dormant'?'не проявляется: ss гасит стихию':ph.elements.length?'стихии вместе с E: '+ph.elements.map(e=>ELN[e]).join(', '):'ничего не добавляет',
  S:ph=>ph.breath==='dormant'?'искры нет, дремлющий':'искра есть',
  C:ph=>({dark:'тёмный',bronze:'бронзовый',pale:'бледный'})[ph.color],
  H:ph=>ph.horns?'рога есть':'рогов нет',K:ph=>ph.mace?'булава есть':'булавы нет',
  R:ph=>({big:'большой гребень',mid:'средний гребень',none:'гребня нет'})[ph.crest],
  Wg:ph=>ph.shortWings?'короткие крылья':'обычные крылья',Q1:SPAN,Q2:SPAN,Q3:SPAN,
  M:ph=>ph.metal?'блеск есть':'блеска нет',N:ph=>ph.night?'ночное зрение':'обычное зрение',
  Sp:ph=>ph.spurs?'шпоры есть':ph.sex==='M'?'у самцов шпор не бывает':'шпор нет',
  G:ph=>ph.glow?'глаза светятся':'глаза не светятся'};

/* ---------- генетический паспорт ----------
   Метки: nat — так устроено у настоящих организмов (с источником), mod — условность модели (числа и выбор признаков
   придуманы для игры), art — только рисунок, генами не задаётся. Правила доминирования повторяют DRG.phenotype,
   inspect.test.js сверяет их с фенотипом перебором. */
const TAG={nat:'Как в природе',mod:'Условность модели',art:'Только рисунок'};
const RULE={
  E:'Аллели стихий F, W, T, A, P, L, D кодоминантны: у F/W видны обе стихии. Аллель e рецессивен, у e/e стихии нет.',
  E2:'Второй ген стихии на той же аутосоме, расширение модели. Аллель 0 нейтральный, стихийные аллели кодоминантны и добавляются к стихиям E: так бывает три или четыре стихии. s/s гасит и их.',
  S:'S доминантен. У s/s нет искры, и стихия не проявляется при любых аллелях E: это эпистаз.',
  C:'Три аллеля, ряд доминирования C > cᵇ > c: тёмный, бронзовый, бледный.',
  H:'H доминантен: с одной копией рога уже есть.',K:'K доминантен: с одной копией на хвосте булава.',
  R:'Неполное доминирование: R¹/R¹ большой гребень, R¹/R² средний, R²/R² гребня нет.',
  Wg:'Wgˢ доминантен по длине крыльев и рецессивно летален: Wgˢ/Wgˢ гибнет в яйце.',
  Q1:'Один из трёх генов размаха: каждый «+» добавляет 0,5 м к базовым 3 м.',Q2:'Один из трёх генов размаха: каждый «+» добавляет 0,5 м к базовым 3 м.',Q3:'Один из трёх генов размаха: каждый «+» добавляет 0,5 м к базовым 3 м.',
  M:'M доминантен, ген на Z: самцу нужна одна копия из двух, у самки Z одна.',
  N:'n рецессивен, ген на Z: самцу для ночного зрения нужно n/n, самке хватает одного n.',
  Sp:'Ген на W: шпоры бывают только у самок, мать передаёт W дочерям.',
  G:'Ген в митохондриях: передаётся от матери всем детям, от отца никогда.'};
/* краткий ответ: почему у этого дракона так. Читает аллели и готовый фенотип, правила те же, что в RULE */
const hasA=(a,x)=>a.al.includes(x);
const BRIEF={
  E:(g,ph)=>{const a=allelesOf(g,'E').al;if(ph.breath==='dormant')return `Аллели ${a.map(al).join('/')} есть, но s/s гасит стихию.`;
    if(!ph.elements.length)return 'Обе копии e: стихии нет, дракон дымный.';
    if(ph.elements.length===2)return `${a.map(al).join(' и ')} кодоминантны: видны обе стихии.`;
    return a[0]===a[1]?`Обе копии ${a[0]}: стихия ${ELN[a[0]].toLowerCase()}.`:`${a.find(x=>x!=='e')} проявляется, e рецессивен.`},
  E2:(g,ph)=>{const a=allelesOf(g,'E2').al.filter(x=>x!=='0');if(!a.length)return 'Обе копии 0: вторых стихий нет, всё решает E.';
    if(ph.breath==='dormant')return `Аллели ${a.map(al).join('/')} есть, но s/s гасит стихию.`;
    return `${[...new Set(a)].map(x=>ELN[x]).join(' и ')} из E2 добавляется к стихиям E: всего ${ph.elements.length}.`},
  S:(g,ph)=>ph.breath==='dormant'?'Обе копии s: искры нет, поэтому стихия не проявляется.':'Есть хотя бы один S: искра есть, стихия может проявиться.',
  C:(g,ph)=>{const a=allelesOf(g,'C');return ph.color==='dark'?'Есть C, он доминирует над остальными: окрас тёмный.':ph.color==='bronze'?`${a.al.map(al).join('/')}: cᵇ доминирует над c, окрас бронзовый.`:'Обе копии c: окрас бледный.'},
  H:(g,ph)=>ph.horns?'Есть хотя бы один H: рога есть.':'Обе копии h: рогов нет.',
  K:(g,ph)=>ph.mace?'Есть хотя бы один K: на хвосте булава.':'Обе копии k: булавы нет.',
  R:(g,ph)=>({big:'Две копии R¹: гребень большой.',mid:'R¹ и R²: гетерозигота промежуточная, гребень средний.',none:'Две копии R²: гребня нет.'})[ph.crest],
  Wg:(g,ph)=>ph.shortWings?'Одна копия Wgˢ: крылья короткие. Две копии были бы смертельны.':'Обе копии +: крылья обычные.',
  Q:(g,ph)=>`У трёх генов размаха вместе ${ph.span} «+» из 6: 3 м + ${ph.span} × 0,5 м = ${num(ph.spanM)} м.`,
  M:(g,ph)=>g.sex==='F'?`У самки одна Z, на ней ${al(allelesOf(g,'M').al[0])}: блеск ${ph.metal?'есть':'не проявляется'}.`:ph.metal?'Есть хотя бы один M: чешуя блестит.':'Обе копии m: блеска нет.',
  N:(g,ph)=>g.sex==='F'?`У самки одна Z, на ней ${allelesOf(g,'N').al[0]}: ${ph.night?'рецессивный n проявляется сразу, зрение ночное':'зрение обычное'}.`:ph.night?'Обе копии n: зрение ночное.':'Есть хотя бы один N: зрение обычное.',
  Sp:(g,ph)=>g.sex==='M'?'У самца нет W, поэтому нет и гена шпор.':ph.spurs?'На W аллель Sp: шпоры есть.':'На W аллель sp: шпор нет.',
  G:(g,ph)=>ph.glow?'В митохондриях аллель G: глаза светятся. Его передала мать.':'В митохондриях аллель g: глаза не светятся.'};
['Q1','Q2','Q3'].forEach(l=>BRIEF[l]=BRIEF.Q);
/* пример у настоящих организмов к каждому гену: только хрестоматийные случаи, источник в SOURCES */
const EX={
  E:{t:'Кодоминирование: у человека с группой крови AB проявляются оба аллеля, A и B.',src:['grif']},
  E2:{t:'Аллель — один из вариантов гена; у признака, который задают несколько генов (полигенный признак), варианты разных генов складываются. Модель берёт этот механизм, а сами стихии выдуманы.',src:['nhgriAl','nhgriPoly']},
  S:{t:'Рецессивный эпистаз: у мышей cc (альбиносы) белые при любых аллелях гена агути, в потомстве дигибридного скрещивания 9 : 3 : 4.',src:['grif']},
  C:{t:'Серия множественных аллелей окраски у кроликов: дикий тип > шиншилла > гималайский > альбинос.',src:['grif','inge']},
  H:{t:'Полное доминирование: у гороха Менделя жёлтая окраска семян доминирует над зелёной, во втором поколении 3 : 1.',src:['grif','inge']},
  K:{t:'Полное доминирование, как у гороха Менделя: от двух гетерозигот 3/4 потомков с доминантным признаком.',src:['grif','inge']},
  R:{t:'Неполное доминирование: красный львиный зев × белый дают розовые цветки, во втором поколении 1 : 2 : 1.',src:['grif','inge']},
  Wg:{t:'Летальный аллель жёлтой окраски у мышей: жёлтый × жёлтый даёт 2 жёлтых : 1 нежёлтому, потому что гомозиготы гибнут до рождения.',src:['castle','grif']},
  Q:{t:'Полигенный признак: окраска зёрен пшеницы у Нильссона-Эле складывается из нескольких генов, получается плавный ряд оттенков.',src:['grif','inge']},
  M:{t:'Сцепление с Z: у кур полосатая окраска оперения (ген на Z) позволяет различать петушков и курочек сразу после вылупления.',src:['grif','inge']},
  N:{t:'Рецессивный признак на половой хромосоме у гетерогаметного пола проявляется с одной копией, как дальтонизм у мужчин XY.',src:['grif']},
  Sp:null,
  G:{t:'Митохондриальное наследование: наследственная оптическая нейропатия Лебера у человека передаётся только от матери.',src:['grif','alb']}};
['Q1','Q2','Q3'].forEach(l=>EX[l]=EX.Q);
/* гаметы этого дракона: распределение гаплотипов из движка (DRG.hapDist), отмечены кроссоверные */
function gametesOf(g,chr){
  if(chr==='mt')return g.sex==='F'?[{h:[g.mt],p:1,rec:false}]:[];
  if(chr==='Z'&&g.sex==='F')return [{h:g.Z[0],p:0.5,rec:false,chr:'Z'},{h:[g.W],p:0.5,rec:false,chr:'W'}];
  const pair=chr==='Z'?g.Z:g[chr],r=chr==='Z'?DRG.Z.r:DRG.CHROMS[chr].r,eq=(a,b)=>a.join()===b.join();
  const m=new Map();DRG.hapDist(pair,r).forEach(x=>{const k=x.h.join();m.set(k,{h:x.h,p:(m.has(k)?m.get(k).p:0)+x.p,rec:!eq(x.h,pair[0])&&!eq(x.h,pair[1])})});
  return [...m.values()].sort((a,b)=>b.p-a.p)}
/* выросты на щеках по стихии похожи на рога, но задаются геном E: в карточке H это поясняется */
const CHEEK={spikes:'Шипы',jags:'Зубцы',plates:'Пластины',crystals:'Кристаллы'};
/* если части нет, подсвечиваем место, где она бывает */
const SPOT={horns:'head',collar:'head',breath:'head',crest:'body',metal:'body',skin:'body',mace:'tailEnd',tailEnd:'body',spurs:'legs'};
function spotOf(p,parts){let q=p;for(let i=0;i<3&&q&&!parts.includes(q);i++)q=SPOT[q];return q&&parts.includes(q)?q:'body'}

/* где ген виден на рисунке: части, у которых он есть в карте MORPH.SRC. E, S и C задают форму и окраску почти всего тела,
   у них в списке только части, которые от них появляются или пропадают */
const WIDE=['E','S','C'];
function partsOfLocus(l){const S=root.MORPH?root.MORPH.SRC:null;if(!S)return [];
  return PART_ORDER.filter(p=>{const s=S[p];return s&&(WIDE.includes(l)?s.has.includes(l):s.has.concat(s.shape,s.color).includes(l))})}
const FACTS=[
  {tag:'nat',h:'Пары хромосом и мейоз',l:[],src:['grif','inge'],
   t:'Аутосомы парные: одна хромосома пары от матери, другая от отца. В каждую гамету уходит одна хромосома из пары, какая именно, решает случай. Поэтому потомки одних родителей получаются разными.'},
  {tag:'nat',h:'Сцепление и кроссинговер',l:['H','K','M','N'],src:['sturt','grif','albm'],
   t:'Гены одной хромосомы наследуются вместе, пока их не разделит кроссинговер, и чем дальше гены друг от друга, тем чаще это случается. Частота рекомбинации r — это доля рекомбинантных гамет, то есть гамет с новым сочетанием аллелей. Она служит расстоянием на генетической карте: так Стёртевант в 1913 году построил первую карту хромосомы дрозофилы. 50 % рекомбинантных гамет не значит, что перекрёст случается ровно в половине мейозов: между далёкими генами перекрёстов бывает несколько, и чётное их число возвращает прежнее сочетание.'},
  {tag:'mod',h:'Расстояния на карте',l:['H','K','M','N'],src:[],
   t:'Между H и K 18 % рекомбинантных гамет, между M и N 10 %: эти числа выбраны для игры. 50 % означает независимое наследование, как у генов на разных хромосомах.'},
  {tag:'mod',h:'Ген E2 и три-четыре стихии',l:['E2','E'],src:[],
   t:'E2 добавлен в модель 28 октября 2026 года, чтобы стихий могло быть больше двух: в одном диплоидном гене всего две копии. E2 лежит на той же хромосоме, что E, с 50 % рекомбинантных гамет к соседнему гену размаха Q1, то есть наследуется независимо. Это параметр игры, а не измерение. У драконов, выведенных раньше, E2 = 0/0, и с ними ничего не поменялось. Число звёздочек ✦ у дракона равно числу его разных стихийных атак.'},
  {tag:'nat',h:'Половые хромосомы ZW',l:['M','N','Sp'],src:['grif'],
   t:'Самка ZW, самец ZZ, как у птиц и бабочек. Самка получает Z от отца, а W от матери, поэтому гены Z у неё в одной копии и проявляются сразу, даже рецессивные.'},
  {tag:'mod',h:'Шпоры на W',l:['Sp'],src:[],
   t:'Ген шпор на W придуман для игры, чтобы был признак только по материнской линии. У настоящих птиц на W мало генов, а шпоры у кур обычно растут у петухов.'},
  {tag:'nat',h:'Митохондрии от матери',l:['G'],src:['nhgri','alb'],
   t:'У большинства животных митохондрии с их ДНК переходят к потомку только из яйцеклетки. Поэтому митохондриальный ген наследуется по материнской линии.'},
  {tag:'mod',h:'Один вариант митохондрий',l:['G'],src:['medgen'],
   t:'В модели у дракона один вариант митохондриального гена. В настоящей клетке митохондрий много, в каждой своя ДНК, и доля митохондрий с разными вариантами может быть разной (гетероплазмия). Число копий и гетероплазмия в модели не учтены.'},
  {tag:'mod',h:'Свечение глаз',l:['G'],src:[],
   t:'Сам признак придуман для игры. У настоящих животных гены митохондрий в основном нужны для клеточного дыхания.'},
  {tag:'nat',h:'Эпистаз',l:['S','E'],src:['grif'],
   t:'Один ген может скрыть действие другого. У s/s стихия не проявляется, какие бы аллели E ни были. Похожим образом у мышей генотип cc (альбинизм) скрывает окраску, которую задают другие гены.'},
  {tag:'nat',h:'Множественные аллели, кодоминирование, неполное доминирование',l:['C','E','R'],src:['grif','inge'],
   t:'У гена бывает больше двух аллелей, как ряд окраски кроликов. Кодоминантные аллели видны оба, как A и B у групп крови человека: так у F/W две стихии. При неполном доминировании гетерозигота промежуточная, как розовые цветки у гибрида красного и белого львиного зева: так у R¹/R² средний гребень.'},
  {tag:'nat',h:'Полигенный признак',l:['Q1','Q2','Q3'],src:['grif'],
   t:'Размах крыльев складывают три гена, каждый «+» добавляет понемногу. Поэтому у потомков много промежуточных значений, как у роста человека.'},
  {tag:'mod',h:'Числа размаха',l:['Q1','Q2','Q3'],src:[],
   t:'3 м и 0,5 м за каждый «+» выбраны для игры. Среда, питание и случай на размах в модели не влияют, у настоящих полигенных признаков влияют.'},
  {tag:'nat',h:'Летальный аллель',l:['Wg'],src:['castle','grif'],
   t:'Аллель может быть доминантным по виду и смертельным в двух копиях. Wgˢ/Wgˢ не вылупляется. У двух короткокрылых родителей среди зигот +/+, Wgˢ/+ и Wgˢ/Wgˢ как 1 : 2 : 1, четверть яиц не развивается, и среди вылупившихся короткокрылых и обычных 2 : 1, а не 3 : 1. Так объяснили жёлтую окраску мышей: жёлтые мыши все гетерозиготны.'},
  {tag:'mod',h:'Мутации',l:['E'],src:['grif'],
   t:'Частота 1/400 на ген в каждой гамете и то, что треть мутаций Стихии даёт Свет или Тьму, — игровые параметры, подобранные, чтобы редкие драконы иногда появлялись. Это не биологическая константа: у настоящих генов мутации гораздо реже, в учебниках обычно приводят порядок 10⁻⁵–10⁻⁶ на ген за поколение. Прогнозы и доли в журнале считаются без мутаций, поэтому изредка вылупляется потомок вне расчёта.'},
  {tag:'art',h:'Что задаёт только рисунок',l:[],src:[],
   t:'Форма тела, рогов и чешуи по стихии, цвета, манера движения, атаки и сияние нарисованы для игры. Гены решают, есть ли часть и какой вариант взять, а как он выглядит, придумал художник. Возраст тоже меняет вид, но это развитие, оно не наследуется.'}];
const SOURCES={
  grif:'Griffiths A. J. F. и др. Introduction to Genetic Analysis. W. H. Freeman, любое издание: менделевское наследование, сцепление, половые хромосомы, взаимодействие генов, летальные аллели, полигенные признаки.',
  inge:'Инге-Вечтомов С. Г. Генетика с основами селекции. СПб.: Изд-во Н-Л, 2010.',
  sturt:'Sturtevant A. H. The linear arrangement of six sex-linked factors in Drosophila, as shown by their mode of association // Journal of Experimental Zoology. 1913. Vol. 14. P. 43–59.',
  castle:'Castle W. E., Little C. C. On a modified Mendelian ratio among yellow mice // Science. 1910. Vol. 32. P. 868–870.',
  alb:'Alberts B. и др. Molecular Biology of the Cell. Garland Science, любое издание: генетические системы митохондрий.',
  albm:'Alberts B., Johnson A., Lewis J. и др. Molecular Biology of the Cell. 4-е изд. New York: Garland Science, 2002. Глава «Meiosis». https://www.ncbi.nlm.nih.gov/books/NBK26840/',
  nhgri:'National Human Genome Research Institute. Talking Glossary of Genomic and Genetic Terms: Mitochondrial DNA. https://www.genome.gov/genetics-glossary/Mitochondrial-DNA',
  nhgriAl:'National Human Genome Research Institute. Talking Glossary of Genomic and Genetic Terms: Allele. https://www.genome.gov/genetics-glossary/Allele',
  nhgriPoly:'National Human Genome Research Institute. Talking Glossary of Genomic and Genetic Terms: Polygenic Trait. https://www.genome.gov/genetics-glossary/Polygenic-Trait',
  medgen:'NCBI MedGen: Mitochondrial inheritance (определение, гетероплазмия). https://www.ncbi.nlm.nih.gov/medgen/165802'};

/* генотип по хромосомам, сцепление из CHROMS */
/* bred — дракон выведен на острове: тогда [0] пришла с яйцеклеткой матери, [1] со сперматозоидом отца (DRG.fuse),
   у первых драконов и драконов с рынка порядок гомологов ничего не значит */
function genoModel(g,bred){
  const ph=DRG.phenotype(g),blocks=[],R=bred?['от матери','от отца']:['1-я','2-я'];
  const links=(loci,r)=>r.map((x,i)=>x<0.5?{a:loci[i],b:loci[i+1],r:x}:null).filter(Boolean);
  Object.keys(DRG.CHROMS).forEach((c,ci)=>{const C=DRG.CHROMS[c];
    blocks.push({id:c,title:'Аутосома '+(ci+1),loci:C.loci,rows:[[R[0],g[c][0]],[R[1],g[c][1]]],links:links(C.loci,C.r),show:C.loci.map(l=>SHOW[l](ph))})});
  const Zl=DRG.Z.loci;
  if(g.sex==='M')blocks.push({id:'Z',title:'Половые хромосомы: самец ZZ',loci:Zl,rows:[[bred?'Z от матери':'Z',g.Z[0]],[bred?'Z от отца':'Z',g.Z[1]]],links:links(Zl,DRG.Z.r),show:Zl.map(l=>SHOW[l](ph)),
    note:'Гена шпор Sp у самца нет: он лежит на W.'});
  else blocks.push({id:'Z',title:'Половые хромосомы: самка ZW',loci:Zl,rows:[[bred?'Z от отца':'Z',g.Z[0]]],links:[],show:Zl.map(l=>SHOW[l](ph)),
    note:'Z одна, поэтому по M и N самка гемизиготна: проявляется единственный аллель.',
    w:{loci:['Sp'],rows:[[bred?'W от матери':'W',[g.W]]],show:[SHOW.Sp(ph)]}});
  blocks.push({id:'mt',title:'Митохондрии',mt:g.mt,show:[SHOW.G(ph)],note:'Не пара хромосом: митохондрии достаются только от матери. В модели это один вариант гена, а в настоящей клетке митохондрий много, и их ДНК бывает разной (гетероплазмия): число копий в модели не учтено.'});
  return {ph,blocks}}

/* что в части тела от генов (есть ли, форма, окраска), что от возраста и что только оформление; карта MORPH.SRC */
function partInfo(M,g,part){
  const s=M.src[part],out={part,name:PART[part]||part,rows:[],age:M.age[part]||null,cosm:M.cosm[part]||null};
  if(s)[['has','Есть или нет'],['shape','Форма и размер'],['color','Окраска']].forEach(([c,t])=>out.rows.push({c,title:t,
    loci:s[c].map(l=>({l,al:allelesText(g,l),why:(s.why&&s.why[c]&&s.why[c][l])||DRG.LOCI[l].name.toLowerCase()}))}));
  return out}

/* часть рига под точкой → часть тела. Голова, туловище, хвост и шея уточняются по слоям рисунка в точке (layerAt) */
const RIGMAP={wingFar:'wings',wingNear:'wings',tailCr:'crest',trunkCr:'crest',neckCr:'crest',lid:'eyes',breath:'breath',aura:'aura',ground:null};
function bodyPartOf(rp,M,layerAt){
  if(rp in RIGMAP)return RIGMAP[rp];
  if(rp==='tailTip')return M.mace?'mace':'tailEnd';
  if(/^[FN][HF]s$/.test(rp))return 'spurs';
  if(/^[FN][HF][uf]$/.test(rp))return 'legs';
  const k=layerAt?layerAt():null;
  if(k&&PART[k]&&k!=='wings')return k;
  return rp==='head'||rp==='headBack'?'head':'body'}

const seedOf=id=>{let h=7;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return h%9973};
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

const PURE={PART,PART_ORDER,partsHere,allelesOf,allelesText,genoModel,partInfo,bodyPartOf,SHOW,TAG,RULE,FACTS,SOURCES,partsOfLocus,BRIEF,EX,gametesOf,spotOf};
if(typeof document==='undefined'){if(typeof module!=='undefined'&&module.exports)module.exports=PURE;return}

/* ---------- подгрузка модулей рисунка ---------- */
const SRC_URL=(()=>{try{const u=new URL(document.currentScript.src);return {dir:u.origin+u.pathname.replace(/[^/]*$/,''),q:u.search}}catch(e){return {dir:'dragons/',q:''}}})();
const NEED=[['MORPH','morph'],['SHAPE','shape'],['ART','art'],['DRTEX','texcache'],['SPR','sprites'],['ANIM','anim'],['RIG','rig'],['DSTATS','stats']];
let loading=null;
function loadAll(){
  if(loading)return loading;
  loading=NEED.reduce((p,[g,f])=>p.then(()=>root[g]?null:new Promise((res,rej)=>{const s=document.createElement('script');
    s.src=SRC_URL.dir+f+'.js'+SRC_URL.q;s.onload=res;s.onerror=()=>rej(new Error('не загрузился '+f+'.js'));document.head.appendChild(s)})),Promise.resolve());
  loading.catch(()=>{loading=null});
  return loading}

/* ---------- сцена ---------- */
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PADY=14;            /* под ногами: островок-подставка, в единицах рисунка */
const ZMAX=4,HI_AT=1.5,HI_OFF=1.25,CAP=4.4;   /* крупная текстура с 1,5×, обратно ниже 1,25×; px·dpr не больше 4,4 */
let V=null;

function open(info,api,fromEl){
  if(V&&!V.closing){show(V,info,'switch');return}
  if(V)finish(V);
  const r=fromEl&&fromEl.getBoundingClientRect?fromEl.getBoundingClientRect():null;
  const v=V={info,api,tok:0,mtok:0,dead:false,closing:false,sel:null,sub:null,mask:null,X:null,Xhi:null,hiLoad:false,A:null,
    from:r&&r.width>4&&r.height>4?{x:r.left,y:r.top,w:r.width,h:r.height}:null,fromTag:fromEl?fromEl.tagName.toLowerCase():null,
    focusBack:fromEl&&fromEl.focus&&fromEl.tagName==='BUTTON'?fromEl:null,hidden:null,
    cam:null,camT:{cx:0,cy:0,z:1},fly:null,perf:{draw:[],hit:0,mask:0,prep:0},ptrs:new Map(),last:performance.now(),hint:true,pend:null};
  build(v);
  document.body.classList.add('dri-open');
  v.root.classList.add('dim');
  v.raf=requestAnimationFrame(frame);
  loadAll().then(()=>show(v,info,'first')).catch(e=>failed(v,e));
  return v}

function failed(v,e){if(v.dead)return;console.error(e);v.root.classList.add('on','in');
  v.$('.dri-load').innerHTML='Не получилось показать дракона. <button class="btn sm" data-dk="close">Вернуться</button>'}

/* показать дракона: first — открытие сцены, switch — другой дракон из родословной,
   keep — тот же дракон заново (вырос до новой стадии или сильно изменилось окно): выбор части и вкладка остаются */
async function show(v,info,mode){
  const tok=++v.tok;v.info=info;
  const ph=DRG.phenotype(info.genome),M=root.MORPH.morph(ph,info.lvl),G=root.SHAPE.build(M),P=root.ANIM.profile(M,G.rig);
  const t0=performance.now();
  v.next={ph,M,G,P};
  layout(v,G);
  const px=pxFor(v,G,1);
  let X;try{X=await root.RIG.get(ph,info.lvl,{px,dpr:v.dpr})}catch(e){if(tok===v.tok)failed(v,e);return}
  if(tok!==v.tok||v.dead){root.RIG.release(X);return}
  v.perf.prep=performance.now()-t0;
  dropTextures(v);
  Object.assign(v,{ph,M,G,P,X,Xpx:px,defs:root.RIG.partsOf(G.rig,P),parts:partsHere(G),stats:root.DSTATS.of(ph,info.lvl,P)});
  v.A=new root.ANIM.Animator(M,X.R,{seed:seedOf(info.id),reduce:reduced()});
  const home={cx:G.box.x+G.box.w/2,cy:(G.box.y+PADY)/2,z:1};
  v.home=home;v.camT=Object.assign({},home);
  const to={ax:v.sx,ay:v.sy,cx:home.cx,cy:home.cy,Z:v.baseZ};
  if(mode==='first'){
    hideOrigin(v);
    if(v.from&&!reduced())v.fly={t0:performance.now(),dur:520,from:camOfRect(v,v.from),to};
    v.cam=Object.assign({},v.fly?v.fly.from:to);
    v.root.classList.remove('dim');v.root.classList.add('on');
    requestAnimationFrame(()=>{if(!v.dead)v.root.classList.add('in')});
    v.$('.dri-load').hidden=true}
  else{v.cam=Object.assign({},to);
    if(mode==='switch'){v.sel=null;v.sub=null;v.loc=null;v.pend=null;if(v.hidden){v.hidden.style.visibility='';v.hidden=null}}}
  v.root.setAttribute('aria-label','Осмотр: '+info.name);
  v.stage.setAttribute('aria-label',`${info.name} крупно. Стрелки двигают вид, плюс и минус приближают, Enter гладит дракона`);
  renderPanel(v);
  if(mode==='keep'&&v.sel){const s=v.sel;if(v.parts.includes(s))select(v,s,false);else select(v,null,false)}}

/* ---------- раскладка: сцена слева и панель справа или сцена сверху и лист снизу ---------- */
function layout(v,G){
  G=G||v.G;const W=v.root.clientWidth||innerWidth,H=v.root.clientHeight||innerHeight,dpr=Math.min(2,devicePixelRatio||1);
  const side=W>=640&&W/H>1.25,pw=side?Math.round(clamp(W*0.36,300,400)):0;
  const sheet=side?0:Math.round(clamp(H*0.48,230,Math.max(230,H-240)));
  const sw=W-pw,sh=H-sheet,top=56,bot=side?36:20;
  v.dpr=dpr;v.W=W;v.H=H;v.side=side;
  v.root.classList.toggle('side',side);v.root.classList.toggle('sheet',!side);
  const st=v.root.style;st.setProperty('--stw',sw+'px');st.setProperty('--sth',sh+'px');st.setProperty('--pw',pw+'px');st.setProperty('--sh',sheet+'px');
  st.setProperty('--sx',(sw/2)+'px');st.setProperty('--sy',(top+(sh-top-bot)*0.55)+'px');
  if(v.cv.width!==Math.round(W*dpr)||v.cv.height!==Math.round(H*dpr)){v.cv.width=Math.round(W*dpr);v.cv.height=Math.round(H*dpr);v.hl.width=v.cv.width;v.hl.height=v.cv.height}
  v.sx=sw/2*dpr;v.sy=(top+(sh-top-bot)/2)*dpr;
  if(G){const bh=PADY-G.box.y;v.baseZ=Math.min((sw-24)*dpr*0.9/G.box.w,(sh-top-bot)*dpr*0.92/bh)}}
const pxFor=(v,G,k)=>Math.max(0.3,Math.round(Math.min(v.baseZ*k/(G.scale*v.dpr),CAP/v.dpr)*20)/20);
function camOfRect(v,r){const G=v.next?v.next.G:v.G,d=v.dpr;
  return {ax:(r.x+r.w/2)*d,ay:(r.y+r.h/2)*d,cx:G.box.x+G.box.w/2,cy:(G.box.y+PADY)/2,Z:Math.max(0.05,Math.min(r.w*d/G.box.w,r.h*d/(PADY-G.box.y)))}}
function clampCam(v,c){const b=v.G.box;c.z=clamp(c.z,1,ZMAX);c.cx=clamp(c.cx,b.x,b.x+b.w);c.cy=clamp(c.cy,b.y,PADY);return c}
const viewOf=c=>[c.Z,0,0,c.Z,c.ax-c.Z*c.cx,c.ay-c.Z*c.cy];

/* ---------- кадр ---------- */
let NF=0;   /* все кадры осмотра с загрузки страницы: по приросту за секунду видно, не идут ли два цикла сразу */
function frame(now){
  const v=V;if(!v||v.dead)return;NF++;
  v.raf=document.hidden?0:requestAnimationFrame(frame);
  const dt=Math.min(0.1,(now-v.last)/1000);v.last=now;
  if(v.A){const ev=v.A.update(dt);if(ev.length)onEvents(v,ev)}
  stepCam(v,dt,now);
  if(v.A&&v.X&&v.cam)draw(v,now);
  if(v.closing&&now>=v.closeAt)finish(v)}
function stepCam(v,dt,now){
  if(!v.cam)return;
  if(v.fly){const f=v.fly,p=ease(clamp((now-f.t0)/f.dur,0,1)),a=f.from,b=f.to;
    v.cam={ax:a.ax+(b.ax-a.ax)*p,ay:a.ay+(b.ay-a.ay)*p,cx:a.cx+(b.cx-a.cx)*p,cy:a.cy+(b.cy-a.cy)*p,Z:Math.exp(Math.log(a.Z)+(Math.log(b.Z)-Math.log(a.Z))*p)};
    if(p>=1)v.fly=null;return}
  if(v.closing)return;
  const t=v.camT,k=v.snap||reduced()?1:1-Math.exp(-dt*11),c=v.cam;v.snap=false;
  c.ax+=(v.sx-c.ax)*k;c.ay+=(v.sy-c.ay)*k;c.cx+=(t.cx-c.cx)*k;c.cy+=(t.cy-c.cy)*k;
  c.Z=Math.exp(Math.log(c.Z)+(Math.log(v.baseZ*t.z)-Math.log(c.Z))*k);
  /* крупная текстура, когда приблизили, и обратно, когда отдалили */
  const z=c.Z/v.baseZ;
  if(z>=HI_AT&&!v.Xhi&&!v.hiLoad)loadHi(v);
  else if(z<HI_OFF&&v.Xhi){const X=v.Xhi;v.Xhi=null;root.RIG.release(X);root.DRTEX.shared.drop(X.key)}}
async function loadHi(v){
  const px=pxFor(v,v.G,2);if(px<=v.Xpx*1.2)return;
  v.hiLoad=true;const tok=v.tok;
  try{const X=await root.RIG.get(v.ph,v.info.lvl,{px,dpr:v.dpr});
    if(tok!==v.tok||v.dead||v.cam.Z/v.baseZ<HI_OFF){root.RIG.release(X);root.DRTEX.shared.drop(X.key)}else v.Xhi=X}
  catch(e){}finally{v.hiLoad=false}}

function draw(v,now){
  const c=v.ctx,W=v.cv.width,H=v.cv.height,view=viewOf(v.cam),t0=performance.now();v.view=view;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  pedestal(v,c,view);
  const pose=v.A.pose;
  root.RIG.draw(c,v.Xhi||v.X,pose,view);
  if(v.sel&&v.mask){const h=v.hctx;h.setTransform(1,0,0,1,0,0);h.clearRect(0,0,W,H);
    root.RIG.draw(h,v.mask,Object.assign({},pose,{food:null}),view);
    h.setTransform(1,0,0,1,0,0);h.globalCompositeOperation='source-in';h.fillStyle=v.col.hl;h.fillRect(0,0,W,H);h.globalCompositeOperation='source-over';
    c.globalAlpha=reduced()?0.42:0.3+0.16*(0.5+0.5*Math.sin((now-v.selT)/1000*4));c.drawImage(v.hl,0,0);c.globalAlpha=1}
  root.RIG.drawFx(c,v.X,v.A.fx,view,v.col.ink);
  const d=performance.now()-t0,P=v.perf.draw;P.push(d);if(P.length>120)P.shift()}
/* островок под ногами: трава сверху, скала снизу, в цветах острова */
function pedestal(v,c,view){
  const b=v.G.box,cx=b.x+b.w/2,rx=b.w*0.47,ry=Math.max(7,rx*0.12);
  c.setTransform(view[0],0,0,view[3],view[4],view[5]);
  c.fillStyle=v.col.rock2;c.beginPath();c.ellipse(cx,ry*0.9,rx*0.9,ry*1.7,0,0,Math.PI);c.fill();
  c.fillStyle=v.col.rock;c.beginPath();c.ellipse(cx,ry*0.5,rx*0.97,ry*1.15,0,0,Math.PI);c.fill();
  const g=c.createLinearGradient(0,-ry,0,ry);g.addColorStop(0,v.col.grass);g.addColorStop(1,v.col.grass2);
  c.fillStyle=g;c.beginPath();c.ellipse(cx,2,rx,ry,0,0,Math.PI*2);c.fill();
  c.setTransform(1,0,0,1,0,0)}

function readColors(v){
  const cs=getComputedStyle(v.root),g=k=>cs.getPropertyValue(k).trim();
  v.col={grass:g('--isl-grass')||'#93D45E',grass2:g('--isl-grass2')||'#5EA83A',rock:'#B79E72',rock2:'#8E7752',ink:g('--muted')||'#58695F',hl:'#FFF6C2'}}

/* ---------- события анимации ---------- */
function onEvents(v,ev){
  ev.forEach(e=>{if(e.type!=='end')return;
    if(e.state==='eat'&&v.pend){const p=v.pend;v.pend=null;
      if(p.rebuild)show(v,v.info,'keep').then(()=>{if(v.A&&!v.dead)v.A.play('happy')})
      else if(p.happy)v.A.play('happy')}})}

/* ---------- попадание по части тела ----------
   Каждая часть рига рисуется в свой пиксель строки N×1 (перенос так, чтобы точка нажатия попала в пиксель i),
   побеждает верхняя непрозрачная. Внутри головы и туловища точку уточняют слои рисунка в покое. */
function hitTest(v,px,py){
  const t0=performance.now(),X=v.Xhi||v.X,N=X.order.length;
  if(!v.hit||v.hit.width<N){v.hit=document.createElement('canvas');v.hit.width=N;v.hit.height=1;v.hitc=v.hit.getContext('2d',{willReadFrequently:true})}
  const c=v.hitc,view=v.view,pose=Object.assign({},v.A.pose,{food:null}),ix=Math.floor(px),iy=Math.floor(py);
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,v.hit.width,1);
  X.order.forEach((p,i)=>{c.save();c.beginPath();c.rect(i,0,1,1);c.clip();
    root.RIG.draw(c,Object.assign({},X,{order:[p]}),pose,[view[0],view[1],view[2],view[3],view[4]+i-ix,view[5]-iy]);c.restore()});
  const d=c.getImageData(0,0,N,1).data;let out=null;
  for(let i=N-1;i>=0;i--)if(d[i*4+3]>90){const rp=X.order[i].name;out=bodyPartOf(rp,v.M,()=>layerAt(v,rp,px,py));break}
  v.perf.hit=performance.now()-t0;
  return out}
const paths=new Map();
function inPath(d,w){let p=paths.get(d);if(!p){if(paths.size>400)paths.clear();p=new Path2D(d);paths.set(d,p)}
  const c=inPath.c||(inPath.c=document.createElement('canvas').getContext('2d'));return c.isPointInPath(p,w[0],w[1])}
function layerAt(v,rp,px,py){
  const MAT=root.ANIM.MAT,m=v.A.pose.mat[rp];if(!m)return null;
  const w=MAT.app(MAT.inv(MAT.mul(v.view,m)),[px,py]),R=v.G.rig;
  if(rp==='head'&&Math.hypot(w[0]-R.eye[0],w[1]-R.eye[1])<R.eyeR*1.35)return 'eyes';
  const def=v.defs.find(d=>d.name===rp);if(!def)return null;
  const L=v.G.layers.filter(l=>!l.rig&&!l.line&&!l.blur&&!l.fx&&!(l.op!=null&&l.op<0.6)&&def.only(l));
  for(let i=L.length-1;i>=0;i--)if(inPath(L[i].d,w))return L[i].of||L[i].part;
  return null}

/* ---------- выбор части: маска той же позы для подсветки, камера к части ---------- */
async function select(v,part,zoom){
  v.sel=part;v.selT=performance.now();
  if(part&&v.hint){v.hint=false;v.root.classList.add('nohint')}
  renderPart(v);renderChips(v);genoHi(v);
  const tok=++v.mtok;
  if(!part){dropMask(v);if(zoom)camHome(v);return}
  const t0=performance.now();
  let X;try{X=await root.RIG.get(v.ph,v.info.lvl,{px:v.Xpx,dpr:v.dpr,part})}catch(e){return}
  if(tok!==v.mtok||v.dead||v.sel!==part){root.RIG.release(X);return}
  dropMask(v);v.mask=X;v.perf.mask=performance.now()-t0;
  if(zoom)camTo(v,X)}
function dropMask(v){if(v.mask){root.RIG.release(v.mask);v.mask=null}}
/* рамка части в мире по текущей позе (изгиб хвоста не учитывается, для камеры этого хватает) */
function boxOf(v,X){
  const MAT=root.ANIM.MAT,pose=v.A.pose;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  X.order.forEach(p=>{const m0=pose.mat[p.m||p.name];if(!m0)return;const m=MAT.mul(m0,p.Fi);
    [[0,0],[p.w,0],[0,p.h],[p.w,p.h]].forEach(q=>{const w=MAT.app(m,q);x0=Math.min(x0,w[0]);y0=Math.min(y0,w[1]);x1=Math.max(x1,w[0]);y1=Math.max(y1,w[1])})});
  return x1>x0?{x:x0,y:y0,w:x1-x0,h:y1-y0}:null}
function camTo(v,X){
  const b=boxOf(v,X);if(!b)return;
  const sw=v.sx*2,sh=(v.sy/v.dpr-56)*2*v.dpr;
  const z=clamp(Math.min(sw*0.5/(Math.max(b.w,8)*v.baseZ),sh*0.5/(Math.max(b.h,8)*v.baseZ)),1.15,3.2);
  v.camT=clampCam(v,{cx:b.x+b.w/2,cy:b.y+b.h/2,z})}
function camHome(v){v.camT=Object.assign({},v.home)}
function zoomAt(v,px,py,f,snap){
  const c=v.camT,Z=v.baseZ*c.z,wx=c.cx+(px-v.sx)/Z,wy=c.cy+(py-v.sy)/Z,nz=clamp(c.z*f,1,ZMAX),Z2=v.baseZ*nz;
  v.camT=clampCam(v,{cx:wx-(px-v.sx)/Z2,cy:wy-(py-v.sy)/Z2,z:nz});if(snap)v.snap=true}
function pan(v,dx,dy,snap){const c=v.camT,Z=v.baseZ*c.z;v.camT=clampCam(v,{cx:c.cx-dx*v.dpr/Z,cy:c.cy-dy*v.dpr/Z,z:c.z});if(snap)v.snap=true}

/* ---------- реакции ---------- */
function say(v,t){const e=v.$('.dri-say');if(e)e.textContent=t}
function react(v,part){
  const A=v.A;if(!A)return;const s=A.state();
  if(part==='eyes'){if(!A.P.sleepy){A.blinkT=0;say(v,v.info.name+' моргает')}return}
  if(part==='breath'){if(s==='idle'){A.play('attack');say(v,'Так выглядит дыхание: '+breathWord(v))}return}
  if(s==='idle'){A.play('happy');say(v,v.info.name+' радуется')}}
const breathWord=v=>v.M.breath==='smoke'?'дым':v.M.breath==='dormant'?'дремлющий не дышит стихией':v.M.elements.map(e=>ELW[e]).join(' и ');
function tap(v,x,y){
  if(!v.A||v.fly)return;
  const part=hitTest(v,x*v.dpr,y*v.dpr);
  if(!part){if(v.sel)select(v,null,true);return}
  react(v,part);v.loc=null;
  if(part!==v.sel)select(v,part,true);else genoHi(v)}
function feed(v){
  const inf=v.info;if(!inf.own||!inf.feed||!inf.feed.can)return;
  const r=v.api.feed(inf.id);if(!r)return;
  const now=v.api.info(inf.id);if(!now){say(v,'Этого дракона больше нет на острове');return}
  v.info=now;v.A.play('eat');v.stats=root.DSTATS.of(v.ph,now.lvl,v.P);
  if(r.lvup){v.pend={happy:true,rebuild:root.MORPH.stageOf(now.lvl)!==root.MORPH.stageOf(inf.lvl)};say(v,`${now.name} вырос до ${now.lvl}-го уровня!`)}
  else{v.pend=null;const n=now.feeds-now.fed;say(v,`Съел корм: −${inf.feed.cost} 🌾. До ${now.lvl+1}-го уровня ещё ${n} ${plural(n,'кормление','кормления','кормлений')}`)}
  renderHead(v);renderMain(v)}

/* ---------- закрытие ---------- */
function back(v){if(v.sub){setSub(v,null);return}if(v.sel){select(v,null,true);return}close(v)}
function originEl(v){
  if(!v.info)return null;const q=`[data-act="drginsp"][data-dragon="${CSS.escape(v.info.id)}"]`;
  const els=[...document.querySelectorAll((v.fromTag||'')+q)].concat([...document.querySelectorAll(q)]);
  return els.find(e=>{const r=e.getBoundingClientRect();return r.width>4&&r.height>4&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth})||null}
function hideOrigin(v){const e=originEl(v);if(e){e.style.visibility='hidden';v.hidden=e}}
function close(v){
  if(v.closing||v.dead)return;v.closing=true;
  const e=originEl(v),r=e&&e.getBoundingClientRect(),fly=!!(r&&v.cam&&v.G&&!reduced());
  if(v.hidden&&v.hidden!==e)v.hidden.style.visibility='';
  if(e){e.style.visibility='hidden';v.hidden=e}
  v.root.classList.remove('in','on','dim');v.root.classList.add('out');
  const dur=fly?400:160;
  if(fly){v.next=null;v.fly={t0:performance.now(),dur,from:Object.assign({},v.cam),to:camOfRect(v,{x:r.left,y:r.top,w:r.width,h:r.height})}}
  v.closeAt=performance.now()+dur;
  setTimeout(()=>finish(v),dur+250)}   /* если вкладка в фоне и кадры стоят */
function finish(v){
  if(v.dead)return;v.dead=true;if(V===v)V=null;
  if(v.raf)cancelAnimationFrame(v.raf);
  removeEventListener('keydown',v.onKey,true);removeEventListener('resize',v.onResize);document.removeEventListener('visibilitychange',v.onVis);
  if(v.mo)v.mo.disconnect();
  dropTextures(v);
  if(v.hl){v.hl.width=v.hl.height=0}if(v.cv){v.cv.width=v.cv.height=0}if(v.hit){v.hit.width=v.hit.height=0}
  v.root.remove();document.body.classList.remove('dri-open');
  if(v.hidden)v.hidden.style.visibility='';
  const e=originEl(v);if(e)e.style.visibility='';
  if(v.focusBack&&v.focusBack.isConnected)v.focusBack.focus({preventScroll:true});
  else{const b=e&&e.tagName==='BUTTON'?e:null;if(b)b.focus({preventScroll:true})}}
function dropTextures(v){
  dropMask(v);
  if(v.Xhi){const X=v.Xhi;v.Xhi=null;root.RIG.release(X);root.DRTEX.shared.drop(X.key)}
  if(v.X){root.RIG.release(v.X);v.X=null}}

/* ---------- DOM ---------- */
function build(v){
  const el=document.createElement('div');el.className='dri';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Осмотр дракона');
  el.innerHTML=`<div class="dri-bg"></div><canvas class="dri-cv" aria-hidden="true"></canvas>
  <div class="dri-stage" tabindex="0" role="img" aria-label="Дракон крупно"></div>
  <div class="dri-top"><button class="dri-x" data-dk="close">← К острову</button>
    <div class="dri-zm" role="group" aria-label="Масштаб"><button data-dk="zin" aria-label="Приблизить">+</button><button data-dk="zout" aria-label="Отдалить">−</button><button data-dk="zfit" aria-label="Весь дракон">⤢</button></div></div>
  <p class="dri-hint" aria-hidden="true">Нажмите на часть тела, чтобы рассмотреть её</p>
  <p class="dri-load">Готовлю дракона…</p>
  <section class="dri-pan" aria-labelledby="dri-t"><div class="dri-head"></div><div class="dri-body"></div></section>`;
  document.body.appendChild(el);
  v.root=el;v.$=s=>el.querySelector(s);v.cv=v.$('.dri-cv');v.ctx=v.cv.getContext('2d');v.stage=v.$('.dri-stage');
  v.hl=document.createElement('canvas');v.hctx=v.hl.getContext('2d');
  readColors(v);layout(v,null);
  el.addEventListener('click',e=>onClick(v,e));
  const st=v.stage;
  st.addEventListener('pointerdown',e=>{if(v.closing)return;try{st.setPointerCapture(e.pointerId)}catch(x){}
    v.ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(v.ptrs.size===1){v.moved=0;v.pinched=false}
    if(v.ptrs.size===2){const [a,b]=[...v.ptrs.values()];v.pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);v.pinched=true}});
  st.addEventListener('pointermove',e=>{const p=v.ptrs.get(e.pointerId);if(!p||!v.G)return;
    const dx=e.clientX-p[0],dy=e.clientY-p[1];v.ptrs.set(e.pointerId,[e.clientX,e.clientY]);
    if(v.ptrs.size===1){v.moved+=Math.abs(dx)+Math.abs(dy);if(v.moved>6&&!v.pinched){pan(v,dx,dy,true);st.classList.add('drag')}}
    else if(v.ptrs.size===2&&v.pinch){const [a,b]=[...v.ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),r=v.root.getBoundingClientRect();
      zoomAt(v,((a[0]+b[0])/2-r.left)*v.dpr,((a[1]+b[1])/2-r.top)*v.dpr,d/v.pinch,true);v.pinch=d}});
  const up=e=>{if(!v.ptrs.has(e.pointerId))return;v.ptrs.delete(e.pointerId);st.classList.remove('drag');
    if(e.type==='pointerup'&&!v.ptrs.size&&v.moved<=6&&!v.pinched){const r=v.root.getBoundingClientRect();tap(v,e.clientX-r.left,e.clientY-r.top)}
    if(v.ptrs.size<2)v.pinch=null};
  st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);
  st.addEventListener('wheel',e=>{e.preventDefault();if(!v.G)return;const r=v.root.getBoundingClientRect();zoomAt(v,(e.clientX-r.left)*v.dpr,(e.clientY-r.top)*v.dpr,Math.exp(-e.deltaY*0.0018),true)},{passive:false});
  v.onKey=e=>onKey(v,e);addEventListener('keydown',v.onKey,true);
  let rs=0;v.onResize=()=>{clearTimeout(rs);rs=setTimeout(()=>resized(v),120)};addEventListener('resize',v.onResize);
  v.onVis=()=>{if(!document.hidden&&!v.raf&&!v.dead){v.last=performance.now();v.raf=requestAnimationFrame(frame)}};document.addEventListener('visibilitychange',v.onVis);
  v.mo=new MutationObserver(()=>readColors(v));v.mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class']});
  v.$('.dri-x').focus({preventScroll:true})}
function resized(v){
  if(v.dead)return;const z0=v.baseZ;layout(v);if(!v.G||!v.cam)return;
  v.cam.Z*=v.baseZ/z0;v.cam.ax=v.sx;v.cam.ay=v.sy;
  if(Math.abs(pxFor(v,v.G,1)-v.Xpx)/v.Xpx>0.2)show(v,v.info,'keep');   /* сильно изменился размер: новая текстура */
}

function onClick(v,e){
  const b=e.target.closest('[data-dk]');if(!b||b.disabled||v.closing)return;
  const k=b.dataset.dk;
  if(k==='close')close(v);
  else if(k==='zin'||k==='zout'){if(v.G)zoomAt(v,v.sx,v.sy,k==='zin'?1.35:1/1.35)}
  else if(k==='zfit'){if(v.G){if(v.sel)select(v,null,false);camHome(v)}}
  /* ссылка к разделу «Как устроено наследование»: переход по #dri-law сменил бы адрес страницы, поэтому только прокрутка */
  else if(k==='law'){e.preventDefault();const h=v.$('.dri-law h4');if(h){h.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});h.focus({preventScroll:true})}}
  else if(!v.A)return;
  else if(k==='geno')setSub(v,'geno');
  else if(k==='ped')setSub(v,'ped');
  else if(k==='main')setSub(v,null);
  else if(k==='feed')feed(v);
  else if(k==='fight'){if(v.api.fight&&v.info.own){const id=v.info.id,go=v.api.fight;close(v);setTimeout(()=>go(id),180)}else{v.A.play('attack');say(v,'В поход ходят только со своего острова')}}
  else if(k==='part'){const p=b.dataset.p;if(p===v.sel)select(v,null,true);else{select(v,p,true);if(p==='breath'||p==='eyes')react(v,p)}}
  else if(k==='unsel'){v.loc=null;select(v,null,true)}
  else if(k==='loc'){const l=b.dataset.l;selLoc(v,l===v.loc?null:l)}
  else if(k==='unloc')selLoc(v,null);
  else if(k==='goto'){const inf=v.api.info(b.dataset.id);if(inf)show(v,inf,'switch').then(()=>{if(!v.dead)v.$('.dri-x').focus({preventScroll:true})})}}

function onKey(v,e){
  if(v.dead||document.querySelector('dialog[open]'))return;
  e.stopPropagation();   /* сочетания страницы (поиск, Esc острова) не срабатывают под сценой */
  const k=e.key,onStage=document.activeElement===v.stage;
  if(k==='Escape'){e.preventDefault();if(!v.closing)back(v);return}
  if(k==='Tab'){trap(v,e);return}
  if(e.ctrlKey||e.metaKey||e.altKey||!v.G||v.closing)return;
  if(k==='+'||k==='='){e.preventDefault();zoomAt(v,v.sx,v.sy,1.3)}
  else if(k==='-'||k==='_'){e.preventDefault();zoomAt(v,v.sx,v.sy,1/1.3)}
  else if(k==='0'){e.preventDefault();if(v.sel)select(v,null,false);camHome(v)}
  else if(onStage&&k.startsWith('Arrow')){e.preventDefault();const s=48;pan(v,k==='ArrowLeft'?s:k==='ArrowRight'?-s:0,k==='ArrowUp'?s:k==='ArrowDown'?-s:0)}
  else if(onStage&&(k==='Enter'||k===' ')){e.preventDefault();react(v,'body')}}
function trap(v,e){
  const f=[...v.root.querySelectorAll('button:not([disabled]),[tabindex="0"],summary')].filter(x=>x.getClientRects().length&&!x.closest('[hidden]'));
  if(!f.length)return;const i=f.indexOf(document.activeElement);
  if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus()}
  else if(!e.shiftKey&&(i===-1||i===f.length-1)){e.preventDefault();f[0].focus()}}

/* ---------- панель ---------- */
/* сохранить фокус при перерисовке куска панели: кнопка с тем же data-dk (и data-p) снова получает фокус */
function setHTML(el,html){
  const a=document.activeElement,k=a&&el.contains(a)&&a.dataset?[a.dataset.dk,a.dataset.p||'',a.dataset.id||'']:null;
  el.innerHTML=html;
  if(k){const b=[...el.querySelectorAll('[data-dk]')].find(x=>x.dataset.dk===k[0]&&(x.dataset.p||'')===k[1]&&(x.dataset.id||'')===k[2]);if(b)b.focus({preventScroll:true})}}
function renderPanel(v){renderHead(v);if(v.sub)renderSub(v);else renderMain(v)}
function elText(v){return v.M.breath==='dormant'?'дремлющий, стихия не проявляется':v.M.breath==='smoke'?'дымный, без стихии':v.M.elements.map(e=>ELN[e]).join(' и ')}
function renderHead(v){
  const i=v.info,M=v.M,rr=DRG.rarity(v.ph),f=i.feed;
  const fd=i.own&&f?`<button class="btn sm" data-dk="feed"${f.can?'':' disabled'}>Покормить · ${f.cost} 🌾</button>`:'';
  setHTML(v.$('.dri-head'),`<div class="dri-hd"><h2 id="dri-t">${esc(i.name)}</h2><span class="dri-sex" title="${i.genome.sex==='F'?'самка, ZW':'самец, ZZ'}">${i.genome.sex==='F'?'♀':'♂'}<span class="sr"> ${i.genome.sex==='F'?'самка':'самец'}</span></span><span class="dri-rar r${rr}" title="Редкость: как трудно вывести такой фенотип">${esc(DRG.RARITY[rr])}</span>${(()=>{const B=window.DSTATS&&DSTATS.badge(v.ph);return B&&B.rank?`<span class="dri-rank" title="${esc(B.title)}">${B.stars}<span class="sr"> ${esc(B.title)}</span></span>`:''})()}</div>
  <p class="dri-sub">${i.lvl}-й уровень · ${esc(M.stageName)} · ${esc(elText(v))}${(()=>{const B=window.DSTATS&&DSTATS.badge(v.ph);return B&&B.hyb?' · сочетание «'+esc(B.hyb)+'»':''})()}</p>
  <button class="dri-geno" data-dk="geno" aria-pressed="${v.sub==='geno'}"><span aria-hidden="true">🧬</span> Генетический паспорт</button>
  <div class="dri-acts${fd?'':' two'}">${fd}<button class="btn ghost sm" data-dk="ped" aria-pressed="${v.sub==='ped'}">Родословная</button><button class="btn ghost sm" data-dk="fight">В бой</button></div>
  ${i.own&&f&&!f.can&&f.why?`<p class="dri-why">${esc(f.why)}</p>`:''}<p class="dri-say" aria-live="polite"></p>`)}
function renderMain(v){
  if(v.sub)return;
  setHTML(v.$('.dri-body'),`<div class="dri-part"></div><div class="dri-chips"></div><div class="dri-stats"></div><div class="dri-facts"></div>`);
  renderPart(v);renderChips(v);renderStats(v);renderFacts(v)}
function renderChips(v){const e=v.$('.dri-chips');if(!e||!v.parts)return;
  setHTML(e,`<h3>Части тела</h3><div class="dri-cl" role="group" aria-label="Части тела">${v.parts.map(p=>`<button class="dri-chip" data-dk="part" data-p="${p}" aria-pressed="${v.sel===p}">${PART[p]}</button>`).join('')}</div>`)}
function renderPart(v){const e=v.$('.dri-part');if(!e)return;
  if(!v.sel){e.innerHTML='';return}
  const P=partInfo(v.M,v.info.genome,v.sel);
  setHTML(e,`<div class="dri-pc"><div class="dri-pch"><h3>${esc(P.name)}</h3><button class="dri-ux" data-dk="unsel" aria-label="Снять выделение">✕</button></div>${partRows(P)}</div>`)}
/* гены части по наличию, форме и окраске, отдельно возраст и оформление; links — гены кнопками (в паспорте) */
function partRows(P,links){
  const lb=x=>links?`<button class="dri-l dri-lk" data-dk="loc" data-l="${x.l}"><b>${x.l}</b> ${esc(x.al)}<small>${esc(x.why)}</small></button>`:`<span class="dri-l"><b>${x.l}</b> ${esc(x.al)}<small>${esc(x.why)}</small></span>`;
  const rows=P.cosm?'':P.rows.map(r=>`<dt>${r.title}</dt><dd>${r.loci.length?r.loci.map(lb).join(''):r.c==='has'?'есть у всех драконов':'не зависит от генов'}</dd>`).join('');
  return `${rows?`<dl>${rows}</dl>`:''}
    ${P.age?`<p class="dri-age"><span class="dri-tag art">Возраст</span> ${esc(P.age)}. Это развитие, оно не наследуется.</p>`:''}
    ${P.cosm?`<p class="dri-age"><span class="dri-tag art">${TAG.art}</span> ${esc(P.cosm)}. Не наследуется.</p>`:''}`}
function renderStats(v){const e=v.$('.dri-stats');if(!e)return;const s=v.stats,N=root.DSTATS.NAMES;
  const ic={hp:'❤️',atk:'⚔️',def:'🛡️',spd:'💨'};
  setHTML(e,`<h3>Боевые характеристики</h3><div class="dri-st">${['hp','atk','def','spd'].map(k=>`<div><span aria-hidden="true">${ic[k]}</span><b>${s[k]}</b><small>${N[k]}</small></div>`).join('')}</div>
    <details class="dri-src" data-k="drisrc"><summary>Из чего складываются числа</summary>
    ${['hp','atk','def','spd'].map(k=>`<p><b>${N[k]} ${s[k]}</b> = ${s.src[k].map(([l,x])=>esc(l)+' '+x).join(' + ')}${k!=='spd'&&s.lvlK!==1?` × уровень ${num(s.lvlK)}`:''}</p>`).join('')}
    <p class="dri-note">${esc(s.note)}</p></details>`)}
function renderFacts(v){const e=v.$('.dri-facts');if(!e)return;const i=v.info,L=[];
  L.push(i.home?'Живёт: '+esc(i.home):'Без дома');
  L.push(i.parents&&i.parents.length?`${i.gen}-е поколение`:i.from==='market'?'С рынка':'Один из первых драконов острова');
  if(i.gold!=null)L.push(`+${i.gold} 🪙 за карточку`);
  if(i.own&&i.feed&&!i.feed.max)L.push(`Кормлений до ${i.lvl+1}-го уровня: ${i.fed} из ${i.feeds}`);
  setHTML(e,`<ul>${L.map(x=>`<li>${x}</li>`).join('')}</ul>`)}

function setSub(v,s){v.sub=s;if(!s)v.loc=null;renderHead(v);if(s)renderSub(v);else renderMain(v);
  const p=v.$('.dri-pan');if(p)p.scrollTop=0;const h=v.$('.dri-body h3[tabindex]');if(h)h.focus({preventScroll:true});else{const b=v.$('[data-dk="geno"]');if(b)b.focus({preventScroll:true})}}
function renderSub(v){
  const head=t=>`<button class="dri-b2" data-dk="main">← К осмотру</button><h3 tabindex="-1">${t}</h3>`;
  if(v.sub==='geno'){setHTML(v.$('.dri-body'),head('Генетический паспорт '+esc(v.info.name))+genoHTML(v.info.genome,!!(v.info.parents&&v.info.parents.length)));genoHi(v)}
  else setHTML(v.$('.dri-body'),head('Родословная')+pedHTML(v))}
function genoHTML(g,bred){
  const m=genoModel(g,bred),th=l=>`<th scope="col" data-l="${l}"><button class="dri-lb" data-dk="loc" data-l="${l}" aria-pressed="false" aria-label="Ген ${l}, ${esc(DRG.LOCI[l].name.toLowerCase())}: показать на драконе">${l}<small>${esc(DRG.LOCI[l].name.toLowerCase())}</small></button></th>`;
  const tbl=(loci,rows,show)=>`<table><thead><tr><th></th>${loci.map(th).join('')}</tr></thead><tbody>${rows.map(([n,h])=>`<tr><th scope="row">${n}</th>${h.map((a,i)=>`<td data-l="${loci[i]}">${esc(al(a))}</td>`).join('')}</tr>`).join('')}
    <tr class="ph"><th scope="row">видно</th>${show.map((x,i)=>`<td data-l="${loci[i]}">${esc(x)}</td>`).join('')}</tr></tbody></table>`;
  const sn=Object.keys(SOURCES),ref=f=>f.src.length?` <small class="dri-ref">Источник: ${f.src.map(k=>sn.indexOf(k)+1).join(', ')}</small>`:'';
  return `<p class="dri-gn">Каждая аутосома в паре. Столбец — ген, строка — одна хромосома пары: аллели в строке лежат на одной хромосоме и вместе уходят в гамету, если не случится кроссинговер.${bred?' Дракон выведен на острове, поэтому известно, какая хромосома от матери, а какая от отца.':''}</p>
  <p class="dri-gn"><a href="#dri-law" class="dri-jump" data-dk="law">Что в модели как в природе, а что придумано для игры ↓</a></p>
  <p class="dri-gn">Нажмите на ген, и на драконе подсветится, где он виден. Нажмите на часть тела дракона, и в таблице подсветятся её гены.</p>
  <div class="dri-loc" aria-live="polite"></div>`+
  m.blocks.map(b=>{
    if(b.id==='mt')return `<section class="dri-chr"><h4>${b.title}</h4><p class="dri-mt" data-l="G"><button class="dri-lb" data-dk="loc" data-l="G" aria-pressed="false" aria-label="Ген G, свечение глаз: показать на драконе">G<small>${esc(DRG.LOCI.G.name.toLowerCase())}</small></button> <span class="dri-al">${esc(al(b.mt))}</span> · ${esc(b.show[0])}</p><p class="dri-gn">${esc(b.note)}</p>${gamHTML(g,'mt')}</section>`;
    const ln=b.links.map(x=>`${x.a} и ${x.b} сцеплены: рекомбинантных гамет ${Math.round(x.r*100)} %`).join('; ');
    return `<section class="dri-chr"><h4>${b.title}${ln?`<small>${esc(ln)}</small>`:''}</h4>${tbl(b.loci,b.rows,b.show)}${b.w?tbl(b.w.loci,b.w.rows,b.w.show):''}${gamHTML(g,b.id)}
      ${b.id==='A1'?`<p class="dri-gn">Аллели E: ${Object.entries(ELW).map(([k,w])=>k+' '+w).join(', ')}. Здесь W означает воду, это не половая хромосома W.</p>`:''}${b.note?`<p class="dri-gn">${esc(b.note)}</p>`:''}</section>`}).join('')+
  `<section class="dri-law" id="dri-law"><h4 tabindex="-1">Как устроено наследование</h4><p class="dri-gn">Метки: <span class="dri-tag nat">${TAG.nat}</span> так у настоящих организмов, <span class="dri-tag mod">${TAG.mod}</span> придумано для игры, <span class="dri-tag art">${TAG.art}</span> генами не задаётся.</p>
    ${FACTS.map(f=>`<div class="dri-fact"><span class="dri-tag ${f.tag}">${TAG[f.tag]}</span><b>${esc(f.h)}</b><p>${esc(f.t)}${ref(f)}</p></div>`).join('')}
    <h4>Источники</h4><ol class="dri-src">${sn.map(k=>`<li>${esc(SOURCES[k])}</li>`).join('')}</ol></section>`}
/* какие гаметы даёт этот дракон: проценты из движка, кроссоверные помечены. Произошёл ли кроссинговер у самого дракона, не записано */
const pct=p=>{const v=Math.round(p*1000)/10;return String(v).replace('.',',')+' %'};
function gamHTML(g,chr){
  const G=gametesOf(g,chr);
  if(chr==='mt')return `<p class="dri-gam">${g.sex==='F'?`Все яйцеклетки несут митохондрии с ${esc(al(g.mt))}.`:'Сперматозоиды митохондрий потомку не передают.'}</p>`;
  if(!G.length)return '';
  const any=G.some(x=>x.rec);
  return `<p class="dri-gam">Гаметы этого дракона: ${G.map(x=>`<span class="dri-gm${x.rec?' rec':''}">${x.chr?x.chr+' ':''}${esc(x.h.map(al).join(' '))} ${pct(x.p)}</span>`).join(' ')}${any?' <small>Курсивом кроссоверные: такие гаплотипы получаются только после кроссинговера.</small>':''}</p>`}
/* подсветка ген ↔ часть тела в паспорте: v.loc — выбранный ген, v.sel — выбранная часть */
function genoHi(v){
  const body=v.$('.dri-body');if(!body||v.sub!=='geno')return;
  const gs=v.sel&&root.MORPH?root.MORPH.genesOf(v.sel):[];
  body.querySelectorAll('[data-l]').forEach(e=>{const l=e.dataset.l;
    if(e.tagName==='BUTTON')e.setAttribute('aria-pressed',String(l===v.loc));
    else{e.classList.toggle('hi',gs.includes(l));e.classList.toggle('on',l===v.loc)}});
  const c=v.$('.dri-loc');if(!c)return;
  const g=v.info.genome,ph=v.ph,chip=p=>`<button class="dri-chip" data-dk="part" data-p="${p}" aria-pressed="${v.sel===p}">${PART[p]}</button>`;
  if(v.loc){const l=v.loc,ps=partsOfLocus(l),here=ps.filter(p=>v.parts.includes(p)),miss=ps.filter(p=>!v.parts.includes(p));
    const fs=FACTS.filter(f=>f.l.includes(l)),ex=EX[l],sn=Object.keys(SOURCES),refs=a=>a&&a.length?` <small class="dri-ref">Источник: ${a.map(k=>sn.indexOf(k)+1).join(', ')}</small>`:'';
    setHTML(c,`<div class="dri-pc"><div class="dri-pch"><h3>${l} · ${esc(DRG.LOCI[l].name)}</h3><button class="dri-ux" data-dk="unloc" aria-label="Снять выделение гена">✕</button></div>
      <p><span class="dri-al">${esc(allelesText(g,l))}</span> · ${esc(SHOW[l](ph))}</p><p class="dri-brief">${esc(BRIEF[l](g,ph))}</p>
      ${WIDE.includes(l)?'<p class="dri-gn">Задаёт форму и окраску почти всего тела.</p>':''}
      ${here.length?`<p class="dri-gn">${WIDE.includes(l)?'От него зависит, есть ли':'Где виден'}:</p><div class="dri-cl" role="group" aria-label="Где виден ген">${here.map(chip).join('')}</div>`:''}
      ${l==='H'&&!ph.horns&&CHEEK[v.M.head.cheek]?`<p class="dri-gn">${CHEEK[v.M.head.cheek]} на щеках: примета стихии (ген E), к рогам они не относятся.</p>`:''}
      ${!here.length&&miss.length&&!WIDE.includes(l)?`<p class="dri-gn">${esc(miss.map(p=>PART[p]).join(', '))}: у этого дракона нет. Подсвечено место, где бывает: ${esc((PART[v.sel]||'').toLowerCase())}.</p>`:''}
      ${here.length&&miss.length?`<p class="dri-gn">Ещё бывает: ${miss.map(p=>PART[p].toLowerCase()).join(', ')}.</p>`:''}
      <details class="dri-more" data-k="more-${l}"${v.more?' open':''}><summary>Подробнее: механизм и пример</summary>
        <p><span class="dri-tag mod">${TAG.mod}</span> ${esc(RULE[l])}</p>
        ${ex?`<p><span class="dri-tag nat">${TAG.nat}</span> ${esc(ex.t)}${refs(ex.src)}</p>`:''}
        ${fs.map(f=>`<p><span class="dri-tag ${f.tag}">${TAG[f.tag]}</span> <b>${esc(f.h)}.</b> ${esc(f.t)}${refs(f.src)}</p>`).join('')}</details></div>`);
    const d=c.querySelector('details');if(d)d.addEventListener('toggle',()=>{v.more=d.open})}
  else if(v.sel){const P=partInfo(v.M,g,v.sel);
    setHTML(c,`<div class="dri-pc"><div class="dri-pch"><h3>${esc(P.name)}</h3><button class="dri-ux" data-dk="unsel" aria-label="Снять выделение">✕</button></div>
      ${gs.length?'<p class="dri-gn">Гены этой части подсвечены в таблице.</p>':''}${partRows(P,true)}</div>`)}
  else c.innerHTML=''}
function selLoc(v,l){
  v.loc=l||null;
  /* ген одной части: подсветить её и приблизить; ген всего тела (E, S, C): показать дракона целиком */
  if(l){const ps=partsOfLocus(l),here=ps.filter(p=>v.parts.includes(p));
    if(WIDE.includes(l))select(v,null,true);
    else select(v,here.length?here[0]:spotOf(ps[0],v.parts),true)}
  genoHi(v)}
function pedHTML(v){
  const i=v.info,pic=(n,w)=>{try{return root.ART.svg(root.MORPH.morph(DRG.phenotype(n.genome),n.lvl||12),{width:w,key:'pd'+n.id,label:n.name})}catch(e){return ''}};
  const card=(n,role,w)=>{if(!n||n.unknown)return `<div class="dri-pp none"><span>${role}</span><b>не записано</b></div>`;
    const tag=n.alive&&n.id!==i.id?'button':'div';
    return `<${tag} class="dri-pp"${tag==='button'?` data-dk="goto" data-id="${esc(n.id)}" aria-label="Осмотреть: ${esc(n.name)}"`:''}>${pic(n,w)}<span>${role}</span><b>${esc(n.name)}</b><small>${n.alive?(n.lvl?n.lvl+'-й уровень':''):'улетел с острова'}</small></${tag}>`};
  if(!i.parents||!i.parents.length)return `<p class="dri-gn">${esc(i.name)}: ${i.from==='market'?'с рынка, родители':'один из первых драконов острова, родители'} не записаны.</p>`;
  const [m,f]=i.parents,gp=n=>n&&n.parents&&n.parents.length?n.parents:[null,null];
  return `<div class="dri-ped"><h4>Родители</h4><div class="dri-pg two">${card(m,'мать ♀',96)}${card(f,'отец ♂',96)}</div>
    <h4>Бабушки и дедушки</h4><div class="dri-pg four">${card(gp(m)[0],'мать матери',72)}${card(gp(m)[1],'отец матери',72)}${card(gp(f)[0],'мать отца',72)}${card(gp(f)[1],'отец отца',72)}</div>
    <p class="dri-gn">Генотипы родителей можно открыть, если родитель ещё живёт на острове: нажмите на него.</p></div>`}

/* для проверок и замеров */
function state(){const v=V;if(!v)return null;
  return {open:!v.dead,closing:v.closing,id:v.info&&v.info.id,ready:!!v.X,sel:v.sel,sub:v.sub,anim:v.A&&v.A.state(),z:v.cam&&v.baseZ?v.cam.Z/v.baseZ:null,fly:!!v.fly,hi:!!v.Xhi,mask:!!v.mask,
    perf:{prep:v.perf.prep,hit:v.perf.hit,mask:v.perf.mask,draw:v.perf.draw.slice()},bytes:(v.X?v.X.bytes:0)+(v.Xhi?v.Xhi.bytes:0)+(v.mask?v.mask.bytes:0),layout:v.side?'side':'sheet'}}
function tapAt(x,y){if(V)tap(V,x,y)}
function partAt(x,y){return V&&V.A&&V.view?hitTest(V,x*V.dpr,y*V.dpr):null}
/* где на экране часть тела (CSS-пиксели): для проверок нажатием в нужную точку */
function whereIs(part){const v=V;if(!v||!v.A)return null;
  return root.RIG.get(v.ph,v.info.lvl,{px:v.Xpx,dpr:v.dpr,part}).then(X=>{const b=boxOf(v,X),vw=v.view;root.RIG.release(X);if(!b)return null;
    return {x:(vw[0]*(b.x+b.w/2)+vw[4])/v.dpr,y:(vw[3]*(b.y+b.h/2)+vw[5])/v.dpr}})}

root.DRGINSP=Object.assign({open,close:()=>{if(V)close(V)},state,tapAt,partAt,whereIs,loadAll,frames:()=>NF},PURE);
addEventListener('pagehide',()=>{if(V)finish(V)});
})(typeof window!=='undefined'?window:globalThis);
