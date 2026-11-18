export const welcomeGems=50;
export const unlockLevel={home:1,farm:1,mine:1,food:1,gold:1,tower:1,nest:1,incubator:1,garrison:2,ice:3,storm:5,ward:7};
export const functions={
 home:'Вмещает четырёх драконов на каждом уровне.',farm:'Производит еду для роста драконов.',mine:'Добывает золото для строительства и улучшений.',
 food:'Хранит 1000 еды на уровень.',gold:'Хранит 1000 золота на уровень.',nest:'Позволяет скрестить двух свободных драконов.',
 incubator:'Выводит детёнышей из яиц, можно открыть второе место.',garrison:'Позволяет назначить до трёх драконов на оборону.',
};
export const xpFor=level=>12*(level-1)*level;
export const islandLevel=xp=>Math.floor((1+Math.sqrt(1+Math.max(0,xp||0)/3))/2);
export function inheritedXp(s){
 const built=s.buildings.filter(b=>!['home','water-home','farm','mine','gold','food','nest','incubator','tower','garrison'].includes(b.id)).length;
 const upgrades=s.buildings.reduce((n,b)=>n+(b.level-1)*18,0);
 return Math.max(xpFor(Math.max(1,...s.buildings.map(b=>unlockLevel[b.kind]||1))),built*25+upgrades+6*(s.feeds||0)+24*(s.hatches||0)+12*(s.sorties||0));
}
export function canBuild(s,kind){return islandLevel(s.xp)>=(unlockLevel[kind]||Infinity);}
export function nextInvasion(now){
 const day=86400000,slot=Math.floor(now/day)*day+16*3600000;
 return slot>now?slot:slot+day;
}
