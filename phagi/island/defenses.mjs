// Range is measured in the same world units as movement; one cell is 20 units.
export const defenses={
 tower:{name:'Дозорная башня',gold:180,color:'#ffd168',role:'Поражает ближайшего дракона каждые 1,5 с.'},
 ice:{name:'Ледяной маяк',gold:220,color:'#9ae5fc',role:'Замедляет всех драконов в зоне действия. Действует, пока маяк цел.'},
 storm:{name:'Грозовой обелиск',gold:280,color:'#f7d861',role:'Разряд перепрыгивает на соседних драконов. Между целями должно быть не более одной клетки.'},
 ward:{name:'Оберег скалы',gold:260,color:'#d8aff5',role:'Снижает урон соседним постройкам. Сам кристалл уязвим. Из нескольких оберегов действует сильнейший.'}
};
export function defenseStats(kind,level){
 const n=level-1;
 switch(kind){
 case 'tower':return {hp:Math.round(125*(1+.25*n)),range:37+Math.min(12,n),damage:9*level};
 case 'ice':return {hp:Math.round(90*(1+.25*n)),range:31+Math.min(14,n),slow:Math.min(72,48+2*n)};
 case 'storm':return {hp:Math.round(106*(1+.25*n)),range:32+Math.min(12,n),damage:7+5*n,targets:level>=3?3:2};
 case 'ward':return {hp:Math.round(102*(1+.25*n)),range:27+Math.min(14,n),shield:Math.min(55,20+3*n)};
 default:return null;
 }
}
export function defenseText(kind,level){
 const v=defenseStats(kind,level);if(!v)return '';
 const effect=kind==='ice'?'замедление '+v.slow+'%':kind==='ward'?'защита '+v.shield+'%':'урон '+v.damage+(kind==='storm'?' · целей до '+v.targets:'');
 return 'Прочность '+v.hp+' · радиус '+(v.range/20).toLocaleString('ru')+' кл. · '+effect;
}
