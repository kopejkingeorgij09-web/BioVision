'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=__dirname,context=vm.createContext({window:{}});
let count=0;
const check=(v,name)=>{assert.ok(v,name);count++;},near=(a,b)=>Math.abs(a-b)<1e-6;
for(const file of ['content.js','sources.js','enrichment.js','models.js','diagrams.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context,{filename:file});
const W=context.window,B=W.MICROBOOK,M=W.MicroMath,all=[...B.primer,...B.chapters.flatMap(c=>c.sections)];
check(B.chapters.length===4,'four chapters');check(all.length===50,'47 topics + 3 prerequisites');
check(new Set(all.map(s=>s.id)).size===50,'unique routes');check(W.MicroModels.types.length===18,'18 models');
for(const s of all){check(s.body.length>=600,s.id+' depth');check(s.question&&s.answer,s.id+' self explanation');check(s.refs.every(r=>W.MICROSOURCES[r]),s.id+' references');if(s.model&&s.model!=='atlas')check(W.MicroModels.types.includes(s.model),s.id+' model');}
check(near(M.redox(-.32,.82).dg,-219.9858),'NADH energy');check(near(M.redox(-.42,.82).dg,-239.2828),'H2 energy');
check(M.redox(.42,-.32).dg>0,'uphill transfer');check(M.redox(.42,-.32).ceiling===0,'no negative ATP output');
check(near(M.scale(5,10).time/M.scale(1,10).time,25),'quadratic diffusion');
check(near(M.scale(1,10).ratio/M.scale(5,10).ratio,5),'surface ratio');
check(M.growth(.5,.5,1)===1000,'lag');check(M.growth(4,.5,1)>M.growth(2,.5,1),'growth');
check(M.growth(100,.5,1)<=1e8,'capacity');check(near(M.cfu(120,.2,-4).value,6e6),'CFU volume/dilution');
check(near(M.cfu(0,.1,-5).upper95,2995732),'zero count uncertainty');
check(near(M.monod(1,1,.8),.4),'Monod half max');check(near(M.pmf(-150,.5,15).ratio,5),'ATP rotor');
check(M.biofilm(0,100,.1)===1,'surface boundary');check(M.biofilm(200,200,.1)<M.biofilm(100,100,.1),'depth gradient');
check(M.syntrophy(1e-7)<M.syntrophy(1e-1),'product removal');check(M.quorum(40,10).response<M.quorum(40,0).response,'signal washout');
const defaults={"scale":{"r":1,"D":10},"redox":{"d":-0.32,"a":0.82},"pmf":{"psi":-150,"pH":0.5,"c":10},"trophy":{"energy":"photo","electrons":"litho","carbon":"auto"},"pathways":{"path":"EMP"},"growth":{"g":30,"lag":1,"time":4,"axis":"log"},"cfu":{"C":86,"V":0.1,"exp":-5},"monod":{"S":2,"ks":1,"D":0.4},"envelope":{"kind":"positive","impact":"none"},"gram":{"step":3,"error":"normal"},"osmosis":{"inside":0.3,"outside":0.1,"T":25},"lac":{"lactose":"yes","glucose":"low"},"hgt":{"mode":"transformation"},"syntrophy":{"logp":-3},"biofilm":{"L":150,"k":0.1},"quorum":{"density":40,"wash":1},"nitrogen":{"process":"fix"},"evidence":{"method":"dna"}};
for(const [type,v] of Object.entries(defaults)){const r=W.MicroModels.preview(type,v);check(!/NaN|undefined|Infinity/.test(JSON.stringify(r)),type+' render');check(r.stats&&r.note,type+' explanation');}
check(W.MICROPHOTOS.length===19,'photo count');
for(const p of W.MICROPHOTOS){check(fs.existsSync(path.resolve(dir,p.url||'../img/prok/'+p.file)),p.id+' bytes');check(p.author&&p.license&&p.scale&&/^https:\/\/(commons.wikimedia.org|phil.cdc.gov|www.frontiersin.org)\//.test(p.source),p.id+' provenance');}
for(const file of ['reader.js','embed.js','content.js','models.js','sources.js'])new vm.Script(fs.readFileSync(path.join(dir,file),'utf8'),{filename:file});



for(const c of B.chapters.slice(0,3))for(const s of c.sections.filter(s=>!s.future)){check(s.body.length>2000,s.id+' expanded explanation');if(s.diagram)check(W.MicroDiagrams.draw(s.diagram).svg.includes('viewBox'),s.id+' scientific diagram');}for(const c of B.chapters.slice(0,3)){check(B.recall[c.id].length===6,c.id+' recall questions');for(const q of B.recall[c.id])check(all.some(s=>s.id===q.link),'recall route');}

console.log(count+' checks passed. Browser layout QA is separate.');
