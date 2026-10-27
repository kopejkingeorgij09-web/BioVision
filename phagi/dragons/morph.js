/* Морфология дракона: фенотип и уровень превращаются в описание тела.
   Внешность берётся только отсюда. Архетип стихии задаёт основу тела, наследуемые признаки
   (рога, булава, гребень, крылья, окрас, глаза, шпоры) накладываются поверх, возраст меняет пропорции.
   Случайности нет: одинаковые фенотип и уровень всегда дают одинаковую морфологию.
   Генотип сюда не попадает, только фенотип из DRG.phenotype(). */
(function(root){
'use strict';

/* ---------- архетипы взрослого дракона ----------
   Единицы рисунка: земля y=0, высоты вверх. body: длина корпуса (бедро → плечо), высота бедра и плеча,
   радиусы бедра, живота и груди, провис живота, шея (длина, угол над горизонтом, S-изгиб, толщина у основания и у головы),
   хвост (длина, наклон вниз, закрутка вверх, волна, толщина у основания в долях бедра, кончик), лапы (толщина, длина стопы, пальцеходящие).
   head: длина и высота, доля морды, сужение морды (0 острая, 1 тупая), надбровье, глубина челюсти, наклон, высота темени, угловатость. */
const ARCH={
  F:{name:'Огонь',
    body:{len:62,hipH:58,shH:70,hipR:19,bellyR:24,chestR:30,sag:1.15,arch:2,neckL:44,neckA:52,neckS:.12,neckR0:16,neckR1:10,tailL:92,tailA:12,tailCurl:34,tailWave:0,tailR0:.72,tailTip:1.6,legT:1.05,footL:14,digi:.8},
    head:{L:46,H:24,snout:.5,taper:.55,brow:.9,jaw:.75,tilt:8,crown:.5,angular:.9,eyeK:1,slant:.55,hood:.2,browH:1,fang:.8,smile:.15,whisk:0,tusk:0,cheekK:1,eye:'almond',cheek:'spikes',mouth:'grin'},
    wing:{type:'jag',span:1,chord:1,raise:1,fingers:4},
    tail:'flame',skin:'lava',crest:'spikes',horn:'swept',collar:null},
  W:{name:'Вода',
    body:{len:84,hipH:40,shH:43,hipR:16,bellyR:19,chestR:20,sag:1,arch:1,neckL:62,neckA:38,neckS:.38,neckR0:13,neckR1:8,tailL:124,tailA:2,tailCurl:-6,tailWave:1,tailR0:.78,tailTip:1.2,legT:.8,footL:13,digi:.5},
    head:{L:42,H:20,snout:.56,taper:.3,brow:0,jaw:.4,tilt:0,crown:.4,angular:0,eyeK:1.15,slant:-.15,hood:0,browH:0,fang:0,smile:.6,whisk:1,tusk:0,cheekK:1,eye:'round',cheek:'fins',mouth:'smile'},
    wing:{type:'fin',span:.78,chord:1.2,raise:.75,fingers:5},
    tail:'fluke',skin:'ripple',crest:'fin',horn:'straight',collar:'fins'},
  T:{name:'Земля',
    body:{len:70,hipH:44,shH:50,hipR:28,bellyR:34,chestR:34,sag:1.2,arch:4,neckL:26,neckA:24,neckS:0,neckR0:21,neckR1:15,tailL:64,tailA:18,tailCurl:4,tailWave:0,tailR0:.82,tailTip:4,legT:1.6,footL:15,digi:.25},
    head:{L:44,H:28,snout:.4,taper:.8,brow:1,jaw:.95,tilt:14,crown:.45,angular:.6,eyeK:.82,slant:.12,hood:.5,browH:1.4,fang:0,smile:0,whisk:0,tusk:1,cheekK:1,eye:'hooded',cheek:'plates',mouth:'flat'},
    wing:{type:'stub',span:.46,chord:.9,raise:.6,fingers:3},
    tail:'blunt',skin:'plates',crest:'plates',horn:'blunt',collar:null},
  A:{name:'Воздух',
    body:{len:56,hipH:76,shH:84,hipR:13,bellyR:15,chestR:17,sag:.95,arch:2,neckL:58,neckA:64,neckS:.18,neckR0:10,neckR1:6.5,tailL:110,tailA:-2,tailCurl:46,tailWave:0,tailR0:.6,tailTip:1,legT:.62,footL:12,digi:1},
    head:{L:36,H:17,snout:.45,taper:.5,brow:.3,jaw:.45,tilt:-6,crown:.85,angular:.2,eyeK:1.28,slant:-.4,hood:0,browH:.15,fang:0,smile:.5,whisk:0,tusk:0,cheekK:1,eye:'round',cheek:'tufts',mouth:'smile'},
    wing:{type:'long',span:1.2,chord:.62,raise:1.05,fingers:4},
    tail:'ribbons',skin:'feather',crest:'tufts',horn:'antenna',collar:'tufts'},
  P:{name:'Флора',
    body:{len:60,hipH:50,shH:60,hipR:24,bellyR:30,chestR:27,sag:1.14,arch:3,neckL:36,neckA:52,neckS:.25,neckR0:15,neckR1:11,tailL:88,tailA:10,tailCurl:26,tailWave:0,tailR0:.7,tailTip:1.6,legT:1.05,footL:13,digi:.55},
    head:{L:40,H:23,snout:.42,taper:.62,brow:.25,jaw:.55,tilt:4,crown:.7,angular:.1,eyeK:1.15,slant:-.1,hood:.1,browH:.3,fang:0,smile:.8,whisk:0,tusk:0,cheekK:1,eye:'round',cheek:'leaves',mouth:'smile'},
    wing:{type:'leaf',span:.95,chord:1.05,raise:.8,fingers:3},
    tail:'leaf',skin:'veins',crest:'leaves',horn:'antler',collar:'leaves'},
  L:{name:'Свет',
    body:{len:58,hipH:64,shH:80,hipR:15,bellyR:19,chestR:24,sag:1,arch:1,neckL:64,neckA:70,neckS:.45,neckR0:12,neckR1:7,tailL:100,tailA:6,tailCurl:20,tailWave:0,tailR0:.6,tailTip:1,legT:.75,footL:12,digi:.85},
    head:{L:42,H:17,snout:.55,taper:.35,brow:.2,jaw:.4,tilt:12,crown:.55,angular:.25,eyeK:1.05,slant:-.05,hood:.28,browH:.4,fang:.25,smile:.25,whisk:0,tusk:0,cheekK:1,eye:'almond',cheek:'crystals',mouth:'flat'},
    wing:{type:'feather',span:1.12,chord:1.1,raise:1.1,fingers:5},
    tail:'fan',skin:'shimmer',crest:'shards',horn:'spire',collar:null},
  D:{name:'Тьма',
    body:{len:72,hipH:50,shH:46,hipR:18,bellyR:20,chestR:23,sag:.9,arch:7,neckL:40,neckA:20,neckS:-.2,neckR0:13,neckR1:9,tailL:108,tailA:8,tailCurl:-14,tailWave:.5,tailR0:.6,tailTip:1,legT:.9,footL:14,digi:.9},
    head:{L:48,H:18,snout:.6,taper:.18,brow:1,jaw:.5,tilt:2,crown:.3,angular:1,eyeK:.95,slant:.85,hood:.3,browH:1,fang:1.25,smile:-.2,whisk:0,tusk:0,cheekK:1,eye:'narrow',cheek:'jags',mouth:'grin'},
    wing:{type:'hook',span:1.18,chord:.85,raise:.85,fingers:4},
    tail:'blade',skin:'bands',crest:'hooks',horn:'hook',collar:null}
};
const EL=['F','W','T','A','P','L','D'];

/* Нейтральный дракон (дремлющий ss или дымный ee): средние пропорции всех семи, без примет стихии */
ARCH.N=(()=>{
  const avg=g=>{const o={};Object.keys(ARCH.F[g]).forEach(k=>{if(typeof ARCH.F[g][k]==='number')o[k]=EL.reduce((s,e)=>s+ARCH[e][g][k],0)/EL.length});return o};
  return {name:'Без стихии',body:avg('body'),head:Object.assign(avg('head'),{eye:'almond',cheek:null,mouth:'flat',fang:.3,whisk:0,tusk:0}),wing:Object.assign(avg('wing'),{type:'plain',fingers:4}),
    tail:'plain',skin:'scales',crest:'ridge',horn:'plain',collar:null}})();

/* ---------- гибриды ----------
   Аллели Стихии кодоминантны: у дракона с двумя стихиями обе видны. Каждая часть тела берётся
   от той стихии, у которой по этой части больше вес; числовые пропорции тела и головы смешиваются
   с теми же весами. Таблица не зависит от порядка аллелей, поэтому FW и WF выглядят одинаково. */
const PRI={
  body:  {T:5,A:4,W:3.5,D:3,F:2.5,L:2,P:1.5},
  head:  {F:4.5,W:4,D:3.5,L:2.5,T:2,A:1.5,P:1},
  wing:  {F:5,L:4,D:3.5,A:3,P:2.5,W:2,T:1},
  tail:  {W:5,P:4,A:3.5,D:3,L:2.8,F:2.5,T:1},
  skin:  {F:5,T:4,L:3.5,D:3,W:2.5,P:2,A:1},
  crest: {P:5,W:4.5,T:4,D:3.5,F:3,L:2.5,A:2},
  collar:{P:5,W:4,A:3}
};
const winner=(part,els)=>els.slice().sort((a,b)=>(PRI[part][b]||0)-(PRI[part][a]||0)||EL.indexOf(a)-EL.indexOf(b))[0];
/* смешать числовые параметры группы: вес доминирующей стихии в квадрате, чтобы она была заметнее */
function blend(group,els,part){
  if(els.length===1)return Object.assign({},ARCH[els[0]][group]);
  const w=els.map(e=>Math.pow(PRI[part][e]||1,2)),sw=w[0]+w[1],o={},win=ARCH[winner(part,els)][group];
  /* числа смешиваются, признаки-слова (форма глаза, щёки, рот) берутся у стихии-победителя */
  Object.keys(ARCH[els[0]][group]).forEach(k=>{const a=ARCH[els[0]][group][k],b=ARCH[els[1]][group][k];
    o[k]=typeof a==='number'?(a*w[0]+b*w[1])/sw:win[k]});
  return o}

/* ---------- возраст ----------
   Стадии привязаны к уровню кормления. Меняются пропорции: у малыша крупная голова и глаза, короткая морда и шея,
   крылышки; у развитого взрослого шире грудь, больше крылья и рога. Генотип от уровня не меняется. */
const STAGES=[
  {name:'малыш',from:1,to:3},{name:'подросток',from:4,to:9},{name:'взрослый',from:10,to:15},{name:'развитый взрослый',from:16,to:20}];
const stageOf=lvl=>{lvl=lvl||1;return lvl>=16?3:lvl>=10?2:lvl>=4?1:0};
const AGE=[
  {scale:.58,len:.84,legs:.8,legT:1.15,radius:1.08,head:1.5,eye:1.7,snout:.62,neck:.62,tail:.72,wing:.5,horn:.3,crest:.35,mace:.55,spurs:0,chest:.92,detail:0,aura:0},
  {scale:.78,len:.95,legs:.95,legT:1.02,radius:1,head:1.18,eye:1.25,snout:.86,neck:.86,tail:.88,wing:.8,horn:.68,crest:.72,mace:.8,spurs:.6,chest:.97,detail:.6,aura:0},
  {scale:1,len:1,legs:1,legT:1,radius:1,head:1,eye:1,snout:1,neck:1,tail:1,wing:1,horn:1,crest:1,mace:1,spurs:1,chest:1,detail:1,aura:0},
  {scale:1.07,len:1.02,legs:1,legT:1.08,radius:1.03,head:1,eye:.95,snout:1.05,neck:1.03,tail:1.05,wing:1.12,horn:1.18,crest:1.12,mace:1.1,spurs:1.15,chest:1.1,detail:1.4,aura:1}
];

/* ---------- цвет ----------
   Цвет стихии, окрас C меняет тон: тёмный глубже, бронзовый с медью, бледный светлее. */
const PAL={
  F:{base:'#D9472B',deep:'#6E1A12',light:'#FF9A55',accent:'#FFC24A',eye:'#FFD23A'},
  W:{base:'#2C7FC9',deep:'#103A6B',light:'#86CCF4',accent:'#A8F3FF',eye:'#FFB648'},
  T:{base:'#9A6B3A',deep:'#47301B',light:'#CFA56E',accent:'#E2CDA0',eye:'#F0A12C'},
  A:{base:'#8DC3E4',deep:'#47759A',light:'#E6F5FF',accent:'#FFFFFF',eye:'#FF9158'},
  P:{base:'#3F9E50',deep:'#1B5126',light:'#9DD96E',accent:'#F3D35A',eye:'#FFC93D'},
  L:{base:'#EFC955',deep:'#A97E19',light:'#FFF5C9',accent:'#FFFFFF',eye:'#8E6CFF'},
  D:{base:'#5A3E8A',deep:'#1F1435',light:'#9C7DD6',accent:'#C98BFF',eye:'#FF4D6D'},
  smoke:{base:'#8A8D94',deep:'#3E4047',light:'#C3C6CC',accent:'#D9DBE0',eye:'#E8C66A'},
  dormant:{base:'#A8A294',deep:'#575245',light:'#D6D0C2',accent:'#E6E1D6',eye:'#C9B98A'}
};
function hex2rgb(h){let x=h.slice(1);if(x.length===3)x=x.replace(/./g,c=>c+c);const n=parseInt(x,16);return [n>>16&255,n>>8&255,n&255]}
function rgb2hex(r){return '#'+r.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('')}
function mix(a,b,t){const x=hex2rgb(a),y=hex2rgb(b);return rgb2hex(x.map((v,i)=>v+(y[i]-v)*t))}
function toned(p,color){
  const f=c=>color==='dark'?mix(c,'#17121E',0.2):color==='bronze'?mix(c,'#B27A3A',0.42):mix(c,'#FFFFFF',0.38);
  return {base:f(p.base),deep:color==='pale'?mix(p.deep,'#FFFFFF',0.2):f(p.deep),light:color==='dark'?p.light:f(p.light),accent:p.accent}}

function palette(ph,els,bodyEl,headEl){
  const key=ph.breath==='dormant'?'dormant':ph.breath==='smoke'?'smoke':null;
  const p1=toned(PAL[key||bodyEl],ph.color),other=els.find(e=>e!==bodyEl),p2=other?toned(PAL[other],ph.color):p1;
  return {
    base:p1.base,deep:p1.deep,light:p1.light,accent:p1.accent,
    base2:p2.base,deep2:p2.deep,light2:p2.light,accent2:p2.accent,
    belly:mix(p1.base,'#FFF1D2',0.58),edge:mix(p1.deep,'#0B0810',0.45),
    wing:mix(p2.base,p2.light,0.25),wingDeep:p2.deep,
    horn:mix('#F1E3C2',p1.base,0.08),claw:'#F2E9D6',
    /* цвет радужки: свечение G и ночное зрение n перекрывают цвет стихии головы */
    eye:ph.glow?'#8FFBFF':ph.night?'#B7F07A':(PAL[key||headEl]||PAL.dormant).eye,pupil:'#120E16',
    glow:ph.glow?'#7DF3FF':null}}

/* общий стиль рисунка, одинаковый для всех драконов: голова и глаза крупнее натуральных, тело плотнее,
   лапы толще, хвост короче. Так дракон читается издалека и выглядит живее. К генотипу отношения не имеет. */
const STYLE={head:1.58,eye:2.15,girth:1.12,neck:1.22,leg:1.25,tail:.86};

/* цвета слоёв по палитре дракона; null = слой без заливки */
function paints(M){
  const p=M.pal,two=M.elements.length>1;
  const leaf=mix(p.base2,'#5DBB4C',0.35),crest=mix(p.base2,p.deep2,0.3);
  const tex={lava:mix(p.base,p.deep,0.38),plates:mix(p.base,p.deep,0.42),veins:mix(p.base,p.light,0.35),shimmer:mix(p.light,'#fff',0.35),
    bands:two?p.deep2:mix(p.deep,'#000',0.1),feather:mix(p.base,p.light,0.4),ripple:mix(p.base,p.light,0.2)}[M.skin]||mix(p.base,p.deep,0.3);
  return {
    belly:p.belly,scute:mix(p.belly,p.edge,0.42),
    wingFar:mix(p.wing,'#000',0.34),boneFar:mix(p.wingDeep,'#000',0.3),bone:mix(p.wingDeep,p.wing,0.25),
    wingFold:p.wingDeep,vein:mix(p.wingDeep,p.wing,0.35),
    feather:mix(p.light2,p.wing,0.3),featherFar:mix(p.light2,'#000',0.32),
    legFar:mix(p.base,'#000',0.36),claw:p.claw,tooth:'#FFFBEF',
    hornFar:mix(p.horn,'#000',0.28),horn:p.horn,hornLine:mix(p.horn,p.deep,0.45),
    crest,crestDark:mix(crest,'#000',0.3),crystal:mix(p.light2,'#FFFFFF',0.35),crystalDark:mix(p.light2,p.deep2,0.35),
    leaf,leafDark:mix(leaf,'#000',0.3),rib:mix(p.edge,p.base2,0.3),
    mace:mix(p.base,'#5A5560',0.5),maceSpike:p.horn,
    fireOuter:'#FF8A2A',fireInner:'#FFE27A',water:'#7CC4FF',earth:'#B08A5C',air:'#D4ECFF',flora:'#6CC24A',light:'#FFF3B0',dark:'#7A52C7',smoke:'#8C8F96',
    texFill:tex,texLine:M.skin==='feather'?mix(p.light,'#fff',0.4):mix(p.deep,'#000',0.12),
    /* лава в швах всегда огненная: это примета кожи Огня, даже на чужой окраске у гибрида */
    lava:mix('#FF5A14',p.accent,0.15),lavaHot:'#FFD36A',sparkle:'#FFFFFF',
    scaleLine:mix(p.deep,'#000',0.1),scaleHi:mix(p.light,'#FFFFFF',0.35),
    /* свет и тень: тень холодная и тёмная, блик светлый, отражённый свет снизу тёплый */
    core:mix(p.deep,'#140A22',0.4),hi:mix(p.light,'#FFFFFF',0.4),bounce:mix(p.light,p.belly,0.5),fold:mix(p.deep,'#000',0.15),
    rim:mix(p.light,'#FFFFFF',0.5),metal:'#FFFFFF',edgeLine:p.edge,edgeFill:p.edge,browLine:mix(p.deep,'#000',0.3),
    brow:mix(p.base,p.deep,0.3),plate:mix(p.base,p.deep,0.25),cheekFin:mix(p.wing,p.light2,0.25),whisker:mix(p.light,p.belly,0.4),
    eyeWhite:mix('#FFF8E6',p.eye,0.12),iris:p.eye,irisDeep:mix(p.eye,'#000',0.45),pupil:p.pupil,tapetum:'#EFFFC0',white:'#FFFFFF',lid:mix(p.edge,'#000',0.2),
    glow:p.glow||p.eye,shadow:'#000',aura:p.accent,body:p.base,shade:null}}


/* ---------- карта генов по частям тела ----------
   has — от каких генов зависит, есть ли часть вообще; shape — её форма и размер; color — окраска и свечение.
   why — пояснение там, где связь неочевидна, отдельно для наличия, формы и окраски. Карта сверена с рисунком перебором:
   morph.test.js меняет по одному гену у разных драконов и проверяет, что изменилось ровно то, что здесь записано,
   и что каждый записанный ген на что-то влияет. */
const ARC=['E','S'],ARCC=['E','S','C'];
const SRC={
  body:   {has:[],shape:ARC,color:ARCC,why:{shape:{S:'у дремлющего ss тело без примет стихии'},color:{S:'дремлющий окрашен нейтрально'}}},
  head:   {has:[],shape:ARC,color:ARCC,why:{shape:{S:'у дремлющего голова без примет стихии'}}},
  skin:   {has:[],shape:ARC,color:ARCC,why:{shape:{E:'узор чешуи по стихии кожи'}}},
  legs:   {has:[],shape:ARC,color:ARCC},
  wings:  {has:[],shape:ARC.concat(['Wg','Q1','Q2','Q3']),color:ARCC,why:{shape:{Wg:'короткие крылья',Q1:'размах',Q2:'размах',Q3:'размах'}}},
  horns:  {has:['H'],shape:ARC,color:ARCC,why:{shape:{E:'форма рогов по стихии'}}},
  crest:  {has:['R'],shape:['R'].concat(ARC),color:ARCC,why:{has:{R:'у R2/R2 гребня нет'},shape:{R:'R1/R1 большой, R1/R2 обычный'}}},
  mace:   {has:['K'],shape:ARC,color:ARCC},
  tailEnd:{has:['K'].concat(ARC),shape:['E'],color:['E','C'],why:{has:{K:'булава занимает кончик хвоста',E:'у дымного ee кончика нет',S:'у дремлющего хвост простой'},shape:{E:'кончик хвоста по стихии'}}},
  eyes:   {has:[],shape:ARC.concat(['N']),color:ARCC.concat(['N','G']),why:{shape:{S:'дремлющий спит, глаза закрыты',N:'ночные глаза крупнее'},
    color:{E:'цвет глаз по стихии головы',S:'у дремлющего свой цвет глаз',C:'веки и надбровья в цвет чешуи',N:'зеленоватый глаз с отблеском',G:'свечение глаз'}}},
  metal:  {has:['M'],shape:ARC,color:[],why:{shape:{E:'блеск ложится по телу'}}},
  spurs:  {has:['Sp'],shape:ARC,color:ARCC,why:{has:{Sp:'только у самок, ген на W'}}},
  breath: {has:['S'],shape:['E'],color:['E'],why:{has:{S:'дремлющий не дышит'},shape:{E:'у каждой стихии своё дыхание, без стихии дым'}}},
  collar: {has:ARC,shape:['E'],color:['E','C'],why:{has:{E:'воротник бывает у Воды, Воздуха и Флоры',S:'у дремлющего воротника нет'}}}
};
/* все локусы части без повторов: для подсветки генов при наведении */
const genesOf=part=>{const s=SRC[part];return s?[...new Set(s.has.concat(s.shape,s.color))]:[]};

/* ---------- сборка ---------- */
function morph(ph,lvl){
  const stage=stageOf(lvl),age=AGE[stage];
  const active=ph.breath==='element'&&ph.elements.length>0;
  const els=active?ph.elements.slice():[];
  const pick=part=>active?winner(part,els):'N';
  const arch={body:pick('body'),head:pick('head'),wing:pick('wing'),tail:pick('tail'),skin:pick('skin'),crest:pick('crest')};
  const collarEl=active?els.filter(e=>PRI.collar[e]).sort((a,b)=>PRI.collar[b]-PRI.collar[a])[0]:null;
  arch.collar=collarEl||null;

  const body=active?blend('body',els,'body'):Object.assign({},ARCH.N.body);
  const head=active?blend('head',els,'head'):Object.assign({},ARCH.N.head);
  const wa=ARCH[arch.wing].wing;

  /* возраст: пропорции, не масштаб */
  body.len*=age.len;body.hipH*=age.legs;body.shH*=age.legs;
  body.hipR*=age.radius;body.bellyR*=age.radius;body.chestR*=age.radius*age.chest;
  body.neckL*=age.neck;body.tailL*=age.tail;body.legT*=age.legT;body.footL*=age.legs;
  head.L*=age.head*STYLE.head;head.H*=age.head*STYLE.head;head.snout*=age.snout;
  ['hipR','bellyR','chestR'].forEach(k=>body[k]*=STYLE.girth);body.neckR0*=STYLE.neck;body.neckR1*=STYLE.neck;body.legT*=STYLE.leg;body.tailL*=STYLE.tail;

  /* размах: полигенный признак Q1–Q3 (0…6 «+»), короткие крылья Wg перекрывают его */
  const spanK=0.8+0.06*(ph.span||0);
  const wing={type:wa.type,fingers:wa.fingers,chord:wa.chord,raise:wa.raise*(ph.shortWings?0.7:1),
    short:!!ph.shortWings,span:wa.span*(ph.shortWings?0.34:spanK)*age.wing};

  const crestSize=ph.crest==='big'?2:ph.crest==='mid'?1:0;
  const M={
    v:1,lvl:lvl||1,stage,stageName:STAGES[stage].name,scale:age.scale,detail:age.detail,aura:age.aura&&active?1:0,
    sex:ph.sex,breath:ph.breath,elements:els,arch,body,head,wing,
    tailEnd:ARCH[arch.tail].tail,skin:ARCH[arch.skin].skin,collar:arch.collar?ARCH[arch.collar].collar:null,
    horns:ph.horns?{style:ARCH[arch.head].horn,size:age.horn}:null,
    crest:crestSize?{style:ARCH[arch.crest].crest,size:crestSize,k:age.crest}:null,
    mace:ph.mace?{size:age.mace}:null,
    spurs:ph.spurs&&age.spurs>0?{size:age.spurs}:null,
    eyes:{night:!!ph.night,glow:!!ph.glow,size:age.eye*STYLE.eye},
    metal:!!ph.metal,color:ph.color,
    pal:palette(ph,els,arch.body,arch.head),
    /* что в части тела задаёт возраст (уровень кормления): это не наследуется и потомкам не передаётся */
    age:{body:'пропорции и общий размер',head:'размер головы',eyes:'размер глаз',wings:'длина крыльев',horns:'длина рогов',
      crest:'высота гребня',mace:'размер булавы',spurs:'появляются с 4-го уровня',skin:'чёткость узора',legs:'длина лап'},
    /* оформление: ни гены, ни возраст тут ничего не сообщают о наследственности */
    cosm:{aura:'сияние развитого взрослого (с 16-го уровня), украшение',shadow:'тень на земле'},
    /* причины каждой части для паспорта: has — есть ли часть, shape — её форма, color — окраска.
       Архетип стихии выбирает E, а ss гасит стихию (тело нейтральное), поэтому форма почти всего зависит от E и S.
       Возраст меняет размер и пропорции, это не ген, он описан в age. Списки проверяет morph.test.js перебором аллелей. */
    src:SRC
  };
  return M}

const MORPH={ARCH,PRI,STAGES,AGE,PAL,EL,STYLE,SRC,genesOf,stageOf,morph,mix,paints};
if(typeof module!=='undefined'&&module.exports)module.exports=MORPH;else root.MORPH=MORPH;
})(typeof window!=='undefined'?window:globalThis);
