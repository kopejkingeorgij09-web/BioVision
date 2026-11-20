// Shared by standalone saves and the island UI. Cloud settlements are issued by the server.
(function(root){
 'use strict';
 const layout=typeof module==='object'&&module.exports?require('./oplot-layout.js'):root.OplotLayout;
 const gold=Object.freeze({keep:0,mine:65,farm:60,home:80,den:85,goldstore:90,foodstore:75,academy:220,archer:70,cannon:95,spire:130,wall:20,firetrap:40,icetrap:35});
 const industry={mine:[1,4,7],farm:[1,4,7],goldstore:[1,6],foodstore:[1,6]};
 const production={mine:400,farm:300,home:85}; // hundredths per five seconds at level one
 function experience(state){
   return Number.isSafeInteger(state.xp)?state.xp:layout.legacyXP(state);
 }
 const profileLevel=state=>1+Math.floor(Math.sqrt(Math.max(0,experience(state))/35));
 function slots(type,level){
   if(!Object.hasOwn(gold,type))return 0;
   if(Object.hasOwn(industry,type))return industry[type].filter(required=>required<=level).length;
   if(type==='keep'||type==='den')return 1;
   if(type==='academy')return level>=7?1:0;
   if(type==='spire'&&level<2)return 0;
   const capped=Math.min(level,8);
   if(type==='wall'){
     const field=layout.gridAtLevel(level);
     return 2*(field.width+field.height)-4+4*(capped-1);
   }
   return 1+(type==='firetrap'||type==='icetrap'?2:1)*capped;
 }
 const cap=(type,state)=>slots(type,profileLevel(state));
 function nextUnlock(type,state){
   const level=profileLevel(state),current=slots(type,level);
   for(let next=level+1;next<=13;next++)if(slots(type,next)>current)return next;
   return null;
 }
 function buildGold(type,existingCount){
   if(!Object.hasOwn(gold,type))throw new RangeError('Unknown building type');
   if(!Object.hasOwn(industry,type))return gold[type];
   if(!existingCount&&(type==='mine'||type==='farm'))return 0;
   return gold[type]*(1+2*existingCount);
 }
 const keepPrices=[400,950,1900,3600,6200,9800,14500,20500,29000,41000,57000];
 function upgradeGold(type,currentLevel){
   if(!Object.hasOwn(gold,type))throw new RangeError('Unknown building type');
   const step=currentLevel-1;
   if(type==='keep')return keepPrices[step]??Infinity;
   if(Object.hasOwn(industry,type))return Math.round(gold[type]*(650+240*step+18*step*step)/1000);
   return Math.round((gold[type]*72+1200)*currentLevel/100);
 }
 function harvest(b,now){
   if(!Object.hasOwn(production,b.type))return 0;
   const qty=b.stowed?b.pausedStock||0:Math.floor((now-b.since)*production[b.type]*b.level/500000);
   return Math.max(0,Math.min(b.level*90,qty));
 }
 function validReceipt(r){
   const unsigned=n=>Number.isSafeInteger(n)&&n>=0;
   if(r?.version!==1||!unsigned(r.at)||!unsigned(r.profileLevel)||r.profileLevel<1||
     !['refundGold','productionGold','productionBerries'].every(k=>unsigned(r[k]))||
     !r.removed||typeof r.removed!=='object'||Array.isArray(r.removed)||!Array.isArray(r.retiredIds)||!r.retiredIds.length)return false;
   const entries=Object.entries(r.removed);
   return entries.every(([t,n])=>Object.hasOwn(gold,t)&&unsigned(n)&&n>0)&&
     entries.reduce((n,[,count])=>n+count,0)===r.retiredIds.length&&
     r.retiredIds.every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,96}$/.test(id))&&new Set(r.retiredIds).size===r.retiredIds.length;
 }
 function needsSettlement(state){
   const level=profileLevel(state),counts=new Map(),retired=new Set(state.limitReceipt?.retiredIds||[]);
   for(const b of state.buildings){
     const count=(counts.get(b.type)||0)+1;
     if(retired.has(b.id)||count>slots(b.type,level))return true;
     counts.set(b.type,count);
   }
   return false;
 }
 function reconcile(state,now){
   if(!needsSettlement(state))return state;
   if(!Number.isSafeInteger(now)||now<0)throw new RangeError('Settlement needs a Unix timestamp in milliseconds');
   const level=profileLevel(state),groups=new Map(),retired=new Set(state.limitReceipt?.retiredIds||[]);
   const remove=new Set(),costs=new Map();
   for(const b of state.buildings){
     let group=groups.get(b.type);if(!group){group=[];groups.set(b.type,group)}
     costs.set(b,buildGold(b.type,group.length));group.push(b);
   }
   for(const [type,group] of groups){
     // Stable sorting retains the original order for equally strong, equally placed buildings.
     const eligible=group.filter(b=>!retired.has(b.id)).sort((a,b)=>b.level-a.level||Number(!!a.stowed)-Number(!!b.stowed));
     for(const b of eligible.slice(slots(type,level)))remove.add(b.id);
   }
   const receipt={version:1,at:now,profileLevel:level,removed:{},refundGold:0,productionGold:0,productionBerries:0,retiredIds:[]};
   const buildings=[];
   for(const b of state.buildings){
     if(!remove.has(b.id)&&!retired.has(b.id)){buildings.push(b);continue}
     if(state.limitReceipt)continue;
     receipt.retiredIds.push(b.id);receipt.removed[b.type]=(receipt.removed[b.type]||0)+1;
     receipt.refundGold+=costs.get(b);
     for(let l=1;l<b.level;l++)receipt.refundGold+=upgradeGold(b.type,l);
     if(b.type==='farm')receipt.productionBerries+=harvest(b,now);else receipt.productionGold+=harvest(b,now);
   }
   const settled={...state,xp:experience(state),buildings,gold:state.gold+receipt.refundGold+receipt.productionGold,
     berries:state.berries+receipt.productionBerries,limitReceipt:state.limitReceipt||receipt};
   if(state.xp===undefined&&state.layoutVersion!==2)settled.limitLegacyGrid=true;
   return settled;
 }
 const api=Object.freeze({keepMax:keepPrices.length+1,profileLevel,cap,nextUnlock,buildGold,upgradeGold,needsSettlement,validReceipt,reconcile});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OplotLimits=api;
})(typeof window==='object'?window:null);
