/* Элитная группа · биоинформатика: выравнивание, ORF и трансляция, дерево UPGMA. */
(function(){
const {hooks}=BV,K=BV.K,VZ=BV.VZ,C=VZ.C,EL=BV.EL,{t,ln,dot,rect,path,arrow,num}=VZ;
const fig=EL.fig,S=EL.seq,AA3=EL.AA3;

/* ---------------- 1. Выравнивание ---------------- */
const ALN=fig('biAln',s=>K.fig({id:'biAln'+s,n:'1.1',t:'Матрица выравнивания',vb:[1000,560],svg:'<g></g>',
  ctl:K.seg('biAm'+s,[['g','Глобальное (Нидлман — Вунш)'],['l','Локальное (Смит — Уотерман)']],'g')+K.rng('biAg'+s,'Штраф за пропуск',-4,-1,1,-2,'')+K.rng('biAs'+s,'Штраф за несовпадение',-3,0,1,-1,''),
  after:'<div class="el-row"><label class="msg">Последовательность 1 <input type="text" id="biA1'+s+'" value="GATTACA" maxlength="12" size="12"></label><label class="msg">Последовательность 2 <input type="text" id="biA2'+s+'" value="GCATGCA" maxlength="12" size="12"></label></div><div class="k-steptx"></div>',
  cap:'Каждая ячейка — лучший счёт выравнивания префиксов. Жёлтым показан путь, по которому восстанавливается само выравнивание.'}));

function align(a,b,mode,gap,mis,mat){
  const n=a.length,k=b.length,loc=mode==='l';
  const M=[],P=[];
  for(let i=0;i<=n;i++){M.push(new Array(k+1).fill(0));P.push(new Array(k+1).fill(''))}
  for(let i=1;i<=n;i++){M[i][0]=loc?0:i*gap;P[i][0]=loc?'':'u'}
  for(let j=1;j<=k;j++){M[0][j]=loc?0:j*gap;P[0][j]=loc?'':'l'}
  let best=0,bi=n,bj=k;
  for(let i=1;i<=n;i++)for(let j=1;j<=k;j++){
    const d=M[i-1][j-1]+(a[i-1]===b[j-1]?mat:mis),u=M[i-1][j]+gap,l=M[i][j-1]+gap;
    let v=Math.max(d,u,l),p=v===d?'d':v===u?'u':'l';
    if(loc&&v<0){v=0;p=''}
    M[i][j]=v;P[i][j]=p;
    if(loc&&v>best){best=v;bi=i;bj=j}}
  let i=loc?bi:n,j=loc?bj:k,A='',B='',L='';
  while(i>0||j>0){const p=P[i][j];
    if(loc&&M[i][j]===0)break;
    if(p==='d'||(i>0&&j>0&&!p&&!loc)){A=a[i-1]+A;B=b[j-1]+B;L=(a[i-1]===b[j-1]?'|':'·')+L;i--;j--}
    else if(p==='u'||(j===0&&i>0)){A=a[i-1]+A;B='-'+B;L=' '+L;i--}
    else if(p==='l'||(i===0&&j>0)){A='-'+A;B=b[j-1]+B;L=' '+L;j--}
    else break}
  const path=new Set();
  {let x=loc?bi:n,y=loc?bj:k;
   while(x>0||y>0){path.add(x+','+y);if(loc&&M[x][y]===0)break;const p=P[x][y];
     if(p==='d'){x--;y--}else if(p==='u'||y===0){x--}else if(p==='l'||x===0){y--}else break;
     if(x<0||y<0)break}
   path.add(x+','+y)}
  const ident=L.split('').filter(c=>c==='|').length;
  return {M,A,B,L,path,score:loc?best:M[n][k],ident,start:[i,j]};
}
function alnDraw(st,sfx){
  const f=BVHOST.root.querySelector('#f-biAln'+sfx);
  const g1=f&&f.querySelector('#biA1'+sfx),g2=f&&f.querySelector('#biA2'+sfx);
  const a=(S.clean(g1?g1.value:'GATTACA')||'GATTACA').slice(0,12);
  const b=(S.clean(g2?g2.value:'GCATGCA')||'GCATGCA').slice(0,12);
  const mode=st.m||'g',gap=+(st.g??-2),mis=+(st.s??-1),mat=mode==='l'?2:1;
  const R=align(a,b,mode,gap,mis,mat);
  const n=a.length,k=b.length;
  const cw=Math.min(62,760/(k+1)),ch=Math.min(44,400/(n+1));
  const x0=150,y0=90;
  let h='';
  h+=t(x0+cw*(k+1)/2,46,mode==='g'?'Глобальное выравнивание: путь из левого верхнего угла в правый нижний':'Локальное выравнивание: путь от максимума до первого нуля',{s:17,w:600,c:C.muted,a:'middle'});
  for(let j=0;j<=k;j++)h+=t(x0+(j+0.5)*cw,y0-10,j?b[j-1]:'–',{s:17,w:700,c:j?C.hema:C.muted,a:'middle'});
  for(let i=0;i<=n;i++)h+=t(x0-14,y0+(i+0.62)*ch,i?a[i-1]:'–',{s:17,w:700,c:i?C.eosin:C.muted,a:'end'});
  for(let i=0;i<=n;i++)for(let j=0;j<=k;j++){
    const on=R.path.has(i+','+j),v=R.M[i][j];
    h+=rect(x0+j*cw+1,y0+i*ch+1,cw-2,ch-2,on?'#f6e7a8':(v>0?'#eef3fb':'#ffffff'),{r:5,st:on?C.amber:C.line,sw:on?2.5:1});
    h+=t(x0+(j+0.5)*cw,y0+(i+0.66)*ch,String(v),{s:Math.min(16,cw*0.34),w:on?700:500,c:on?C.ink:(v<0?C.muted:C.ink),a:'middle'})}
  const yb=y0+(n+1)*ch+34;
  h+=t(x0,yb,R.A,{s:21,w:700,c:C.eosin,mono:true});
  h+=t(x0,yb+26,R.L,{s:21,w:700,c:C.muted,mono:true});
  h+=t(x0,yb+52,R.B,{s:21,w:700,c:C.hema,mono:true});
  h+=t(x0,yb+86,`Счёт: ${R.score}  ·  совпадений: ${R.ident} из ${R.L.length}  (${num(R.ident/Math.max(1,R.L.length)*100,0)} %)`,{s:18,w:600,c:C.ink});
  const tx=mode==='g'
   ? `<p><b>Нидлман — Вунш (1970)</b> выравнивает последовательности целиком. Первая строка и первый столбец заполняются штрафами за пропуски, дальше каждая ячейка = max(по диагонали + совпадение/несовпадение, сверху + пропуск, слева + пропуск). Итоговый счёт стоит в правом нижнем углу, а само выравнивание восстанавливают обратным ходом.</p><p>Совпадение +${mat}, несовпадение ${mis}, пропуск ${gap}. Счёт: <b>${R.score}</b>.</p>`
   : `<p><b>Смит — Уотерман (1981)</b> ищет лучший общий фрагмент. Отличий три: отрицательные значения обнуляются, старт — максимум по всей матрице, обратный ход идёт до первого нуля. Так находят консервативные домены в непохожих в целом белках.</p><p>Лучший локальный счёт: <b>${R.score}</b>.</p>`;
  return {svg:h,tx};
}
['','L'].forEach(s=>{
  VZ.live('biAln'+s,{rng:[['biAg'+s,'g'],['biAs'+s,'s']],seg:[['biAm'+s,'m','g']]},st=>alnDraw(st,s));
  setTimeout(()=>{const f=BVHOST.root.querySelector('#f-biAln'+s);if(!f)return;
    ['#biA1'+s,'#biA2'+s].forEach(sel=>{const el=f.querySelector(sel);if(el)el.addEventListener('input',()=>{
      const fn=EL.H['biAln'+s];if(fn)fn(f,f.querySelector('.kf-st>svg'))})})},0)});

/* ---------------- 2. ORF и трансляция ---------------- */
const ORF=fig('biOrf',s=>K.fig({id:'biOrf'+s,n:'2.1',t:'Рамки считывания и трансляция',vb:[1000,470],svg:'<g></g>',
  ctl:K.seg('biOf'+s,[['1','Рамка +1'],['2','Рамка +2'],['3','Рамка +3'],['-1','Рамка −1'],['all','Все шесть']],'all'),
  after:'<div class="el-row"><label class="msg" style="flex:1;min-width:260px">Последовательность <input type="text" id="biOs'+s+'" value="TACGATGGCTTCCAAGGTGACCCTGTAAGCT" size="34"></label></div><div class="k-steptx"></div>',
  cap:'Открытая рамка считывания (ORF) — участок от старт-кодона ATG до стоп-кодона в той же рамке. У прокариот ORF обычно совпадает с геном, у эукариот ген разорван интронами.'}));

function orfDraw(st,sfx){
  const f=BVHOST.root.querySelector('#f-biOrf'+sfx),inp=f&&f.querySelector('#biOs'+sfx);
  const seq=(S.clean(inp?inp.value:'')||'TACGATGGCTTCCAAGGTGACCCTGTAAGCT').slice(0,60);
  const mode=st.f||'all',L=seq.length;
  const w=Math.min(26,860/L),x0=70;
  let h='';
  h+=t(x0,54,'5′',{s:16,w:700,c:C.muted});
  for(let i=0;i<L;i++)h+=t(x0+(i+0.5)*w,74,seq[i],{s:Math.min(19,w*0.9),w:700,c:C.ink,a:'middle',mono:true});
  h+=t(x0+L*w+10,74,'3′',{s:16,w:700,c:C.muted});
  const rc=S.rc(seq);
  for(let i=0;i<L;i++)h+=t(x0+(i+0.5)*w,100,S.comp(seq)[i],{s:Math.min(19,w*0.9),w:600,c:C.muted,a:'middle',mono:true});
  const frames=mode==='all'?['1','2','3','-1','-2','-3']:[mode];
  const COL={'1':C.hema,'2':C.sky,'3':C.teal,'-1':C.eosin,'-2':C.violet,'-3':C.amber};
  let y=140,found=[];
  frames.forEach(fr=>{
    const rev=fr.startsWith('-'),off=Math.abs(+fr)-1,src=rev?rc:seq;
    h+=t(x0-12,y+16,'рамка '+(rev?'−':'+')+Math.abs(+fr),{s:15,w:700,c:COL[fr],a:'end'});
    let inOrf=false,orfStart=0;
    for(let i=off;i+2<src.length;i+=3){
      const cod=src.slice(i,i+3),aa=S.CODE[cod]||'X';
      const px=rev?x0+(L-i-3)*w:x0+i*w;
      const stop=aa==='*',start=cod==='ATG';
      if(start&&!inOrf){inOrf=true;orfStart=i}
      h+=rect(px+1,y,w*3-2,24,stop?'#f6dada':start?'#d9f0e2':(inOrf?'#eef3fb':'#f6f7f9'),{r:4,st:inOrf||start?COL[fr]:C.line,sw:inOrf||start?1.6:1});
      h+=t(px+w*1.5,y+17,stop?'стоп':aa,{s:Math.min(14,w*0.72),w:700,c:stop?C.bad:start?C.ok:C.ink,a:'middle'});
      if(stop&&inOrf){found.push({fr,len:(i-orfStart)/3,aa:S.tr(src.slice(orfStart,i+3))});inOrf=false}}
    y+=36});
  const best=found.sort((a,b)=>b.len-a.len)[0];
  h+=t(x0-12,y+26,'',{s:1});
  let tx;
  if(best){const p=best.aa.replace('*','');
    tx=`<p>Самая длинная открытая рамка найдена в рамке <b>${best.fr.startsWith('-')?'−':'+'}${Math.abs(+best.fr)}</b>: ${best.len} ${best.len%10===1&&best.len%100!==11?'кодон':'кодонов'} до стоп-кодона.</p><p>Белок: <b>${p.split('').map(c=>AA3[c]||c).join('-')}</b> (${p.length} а. о.).</p><p>Зелёным отмечен ATG — старт-кодон (метионин), красным — стоп-кодоны TAA, TAG, TGA.</p>`}
  else tx='<p>В этой последовательности нет ни одной полной открытой рамки: либо нет ATG, либо после него не встретился стоп-кодон. Попробуй другую последовательность или другую рамку.</p>';
  if(mode==='all')tx+='<p class="msg">Шесть рамок — три на прямой цепи и три на комплементарной. Программы вроде ORFfinder просматривают все шесть.</p>';
  return {svg:h,tx};
}
['','L'].forEach(s=>{
  VZ.live('biOrf'+s,{seg:[['biOf'+s,'f','all']]},st=>orfDraw(st,s));
  setTimeout(()=>{const f=BVHOST.root.querySelector('#f-biOrf'+s),el=f&&f.querySelector('#biOs'+s);
    if(el)el.addEventListener('input',()=>{const fn=EL.H['biOrf'+s];if(fn)fn(f,f.querySelector('.kf-st>svg'))})},0)});

/* ---------------- 3. Дерево UPGMA ---------------- */
const TREE=fig('biTree',s=>K.fig({id:'biTree'+s,n:'3.1',t:'Построение дерева методом UPGMA',vb:[1000,470],svg:'<g></g>',
  ctl:K.seg('biTs'+s,[['0','Матрица расстояний'],['1','Шаг 1'],['2','Шаг 2'],['3','Шаг 3'],['4','Готовое дерево']],'0'),
  after:'<div class="k-steptx"></div>',
  cap:'UPGMA объединяет пару с наименьшим расстоянием и пересчитывает матрицу как среднее. Метод предполагает постоянную скорость эволюции — «молекулярные часы».'}));

const TAXA=['Человек','Шимпанзе','Горилла','Орангутан','Макака'];
const D0=[[0,1.2,1.6,3.3,7.1],[1.2,0,1.7,3.4,7.2],[1.6,1.7,0,3.4,7.1],[3.3,3.4,3.4,0,7.3],[7.1,7.2,7.1,7.3,0]];
function upgma(){
  let names=TAXA.map(x=>x),D=D0.map(r=>r.slice()),sizes=names.map(()=>1),heights=names.map(()=>0);
  const steps=[];
  while(names.length>1){
    let bi=0,bj=1,bv=Infinity;
    for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(D[i][j]<bv){bv=D[i][j];bi=i;bj=j}
    const h=bv/2;
    steps.push({a:names[bi],b:names[bj],d:bv,h,names:names.slice(),D:D.map(r=>r.slice())});
    const nn=`(${names[bi]}, ${names[bj]})`;
    const ND=[],NS=[],NN=[],NH=[];
    const keep=names.map((_,i)=>i).filter(i=>i!==bi&&i!==bj);
    keep.forEach(i=>{NN.push(names[i]);NS.push(sizes[i]);NH.push(heights[i])});
    NN.push(nn);NS.push(sizes[bi]+sizes[bj]);NH.push(h);
    for(let x=0;x<NN.length;x++){ND.push(new Array(NN.length).fill(0))}
    keep.forEach((i,xi)=>keep.forEach((j,xj)=>{ND[xi][xj]=D[i][j]}));
    keep.forEach((i,xi)=>{const v=(D[i][bi]*sizes[bi]+D[i][bj]*sizes[bj])/(sizes[bi]+sizes[bj]);
      ND[xi][NN.length-1]=v;ND[NN.length-1][xi]=v});
    names=NN;D=ND;sizes=NS;heights=NH}
  return steps;
}
const STEPS=upgma();
function treeDraw(st){
  const step=Math.min(4,+(st.s??0));
  let h='';
  const cur=step===0?{names:TAXA,D:D0}:STEPS[Math.min(step-1,STEPS.length-1)];
  const names=step>=4?STEPS[STEPS.length-1].names:cur.names,D=step>=4?STEPS[STEPS.length-1].D:cur.D;
  /* матрица */
  const cw=86,chh=36,x0=120,y0=110;
  h+=t(x0,76,'Матрица расстояний (замен на 100 сайтов)',{s:17,w:600,c:C.muted});
  const short=s=>s.length>11?s.slice(0,9)+'…':s;
  names.forEach((nm,j)=>h+=t(x0+(j+0.5)*cw,y0-8,short(nm),{s:12,w:700,c:C.hema,a:'middle'}));
  names.forEach((nm,i)=>{h+=t(x0-10,y0+(i+0.66)*chh,short(nm),{s:12,w:700,c:C.eosin,a:'end'});
    names.forEach((_,j)=>{const v=D[i][j];
      let min=false;
      if(step<4){let bv=Infinity;for(let p=0;p<names.length;p++)for(let q=p+1;q<names.length;q++)if(D[p][q]<bv)bv=D[p][q];min=i!==j&&Math.abs(v-bv)<1e-9}
      h+=rect(x0+j*cw+1,y0+i*chh+1,cw-2,chh-2,i===j?'#f3f4f7':min?'#f6e7a8':'#ffffff',{r:5,st:min?C.amber:C.line,sw:min?2.5:1});
      h+=t(x0+(j+0.5)*cw,y0+(i+0.68)*chh,i===j?'—':num(v,1),{s:14,w:min?700:500,c:i===j?C.muted:C.ink,a:'middle'})})});
  /* дерево */
  const tx0=560,ty0=300,scale=42;
  const leaves=TAXA.slice();
  const pos={};leaves.forEach((nm,i)=>pos[nm]={x:tx0,y:ty0+i*34,h:0});
  const shown=STEPS.slice(0,step>=4?STEPS.length:step);
  h+=t(tx0,ty0-42,'Дерево',{s:17,w:600,c:C.muted});
  leaves.forEach((nm,i)=>h+=t(tx0-8,ty0+i*34+5,nm,{s:14,w:600,c:C.ink,a:'end'}));
  const node={};leaves.forEach(nm=>node[nm]={x:tx0,y:pos[nm].y});
  shown.forEach(s=>{const A=node[s.a],B=node[s.b];if(!A||!B)return;
    const x=tx0+s.h*scale*2,y=(A.y+B.y)/2;
    h+=ln(A.x,A.y,x,A.y,{c:C.hema,w:2.5})+ln(B.x,B.y,x,B.y,{c:C.hema,w:2.5})+ln(x,A.y,x,B.y,{c:C.hema,w:2.5});
    h+=t(x+6,y+4,num(s.h,2),{s:12,w:600,c:C.muted});
    node[`(${s.a}, ${s.b})`]={x,y};delete node[s.a];delete node[s.b]});
  let tx;
  if(step===0)tx='<p>Расстояние между видами считают по числу замен в выравненных последовательностях. Чем меньше расстояние, тем ближе родство. Жёлтым отмечена наименьшая пара — с неё и начинают.</p>';
  else if(step>=4)tx='<p>Дерево готово. Высота узла равна половине расстояния между объединёнными группами: UPGMA считает, что от узла до каждого листа эволюция шла одинаково долго. Поэтому все листья оказываются на одной вертикали — это <b>ультраметрическое</b> дерево.</p><p>Если скорость эволюции в линиях разная, UPGMA ошибается. Тогда берут метод присоединения соседей (Neighbor Joining) или методы максимального правдоподобия.</p>';
  else{const s=STEPS[step-1];tx=`<p><b>Шаг ${step}.</b> Наименьшее расстояние — ${num(s.d,1)} между «${s.a}» и «${s.b}». Их объединяют в узел на высоте ${num(s.d,1)} / 2 = <b>${num(s.h,2)}</b>.</p><p>Расстояния до новой группы пересчитывают как среднее, взвешенное по числу видов в объединяемых группах — отсюда и название: Unweighted Pair Group Method with Arithmetic mean.</p>`}
  return {svg:h,tx};
}
['','L'].forEach(s=>VZ.live('biTree'+s,{seg:[['biTs'+s,'s','0']]},treeDraw));

/* ---------------- лаборатория ---------------- */
hooks.bioinf={show:()=>EL.lab('labBioinf',{
  intro:`<div class="el-intro"><div><b>Всё считается здесь</b>Матрица выравнивания, рамки считывания и дерево строятся по настоящим алгоритмам прямо в браузере, без интернета.</div><div><b>Свои данные</b>В выравнивание и поиск рамок можно вписать собственные последовательности.</div><div><b>Задел на семестр</b>Это основа для BLAST, филогении и работы с NCBI в следующем семестре.</div></div>`,
  list:[{f:'biAln',t:'Выравнивание: Нидлман — Вунш и Смит — Уотерман',p:'Матрица заполняется на глазах, путь обратного хода подсвечен. Поменяй штрафы и посмотри, как меняется выравнивание.',c:'var(--hema)',doc:['bioinf','aln']},
    {f:'biOrf',t:'Рамки считывания и трансляция',p:'Шесть рамок, старт- и стоп-кодоны, самая длинная ORF и её белок.',c:'var(--ok)',doc:['bioinf','orf']},
    {f:'biTree',t:'Дерево методом UPGMA',p:'От матрицы расстояний до готового дерева по шагам, на примере приматов.',c:'var(--sky)',doc:['bioinf','tree']}]})};

/* ---------------- конспект ---------------- */
VZ.doc('bioinf',{kick:'Конспект · Биоинформатика · элитная группа',title:'Выравнивание, рамки считывания и филогения',
 lead:'Как компьютер сравнивает последовательности, чем глобальное выравнивание отличается от локального, как из ДНК получают белок и как из матрицы расстояний строят дерево. Основа для BLAST и филогенетики.',
 intro:`<div class="k-goal"><b>После этого конспекта нужно уметь</b><ul><li>заполнить матрицу Нидлмана — Вунша вручную и восстановить выравнивание;</li><li>объяснить, когда нужен Смит — Уотерман, а когда глобальное выравнивание;</li><li>находить открытые рамки считывания в шести рамках и транслировать их;</li><li>строить дерево UPGMA и называть его ограничения.</li></ul></div>`,
 end:'Дальше: задачи по биоинформатике в банке задач, сборник «Вуз», тема «Биоинформатика».'});

VZ.sec('bioinf',{id:'aln',no:1,t:'Выравнивание последовательностей',sub:[['k-bialg','Динамическое программирование'],['k-bimat','Матрицы замен']],html:()=>`
 <p class="k-lead">Выравнивание — это способ расположить две последовательности друг под другом так, чтобы максимально совпали родственные позиции. Пропуски (гэпы) соответствуют вставкам и делециям.</p>
 <h3 id="k-bialg">Динамическое программирование</h3>
 <p>Перебрать все варианты невозможно: для двух последовательностей по 100 нуклеотидов их астрономически много. Поэтому задачу решают по частям: счёт для префиксов длины i и j выражается через три соседние уже посчитанные ячейки.</p>
 ${VZ.f('F(i,j) = max{ F(i−1,j−1) + s(aᵢ,bⱼ);&nbsp; F(i−1,j) + d;&nbsp; F(i,j−1) + d }')}
 ${EL.FIG.biAln.doc}
 ${K.tbl(['','Нидлман — Вунш (1970)','Смит — Уотерман (1981)'],[['Что ищет','выравнивание целиком','лучший общий фрагмент'],['Край матрицы','штрафы за пропуски','нули'],['Отрицательные значения','разрешены','обнуляются'],['Начало обратного хода','правый нижний угол','максимум по всей матрице'],['Конец обратного хода','левый верхний угол','первый ноль'],['Когда применять','гомологичные белки сходной длины','поиск доменов, BLAST']])}
 ${K.box('vuz','Вузовский уровень · штраф за гэп','<p>Линейный штраф (каждый пропуск одинаков) биологически неточен: одна делеция из 5 нуклеотидов вероятнее, чем 5 независимых делеций. Поэтому используют <b>аффинный штраф</b>: открытие гэпа стоит дорого (обычно −10…−12), продолжение дёшево (−0,5…−2). Алгоритм Гото (1982) считает такое выравнивание за то же время, но с тремя матрицами вместо одной.</p>')}
 <h3 id="k-bimat">Матрицы замен</h3>
 <p>Для белков замены неравноценны: лейцин на изолейцин — почти безобидно, лейцин на пролин — часто катастрофа. Это учитывают матрицы замен.</p>
 ${K.tbl(['Семейство','Как построено','Чем больше число'],[['PAM','от эволюционной модели на близких белках, экстраполяция','PAM250 — для <b>дальних</b> родственников'],['BLOSUM','напрямую из блоков выровненных участков','BLOSUM80 — для <b>близких</b>; BLOSUM45 — для дальних']])}
 ${K.trap('<p>Шкалы PAM и BLOSUM направлены в разные стороны. Большое число PAM — далёкое родство, большое число BLOSUM — близкое. BLOSUM62 — стандарт по умолчанию в BLAST.</p>')}
 ${K.choice({t:'1. Вы ищете в геноме бактерии участок, похожий на один домен большого эукариотического белка. Что выбрать?',opts:['глобальное выравнивание с BLOSUM80','локальное выравнивание','глобальное с аффинным штрафом','выравнивание нуклеотидов без матрицы замен'],ok:[1],a:'<p>Последовательности в целом не гомологичны, общий у них только домен. Глобальное выравнивание попытается растянуть совпадение на всю длину и испортит результат. Нужен Смит — Уотерман или его быстрое приближение — BLAST.</p>'})}
`});

VZ.sec('bioinf',{id:'orf',no:2,t:'Рамки считывания, ORF и трансляция',html:()=>`
 <p class="k-lead">Двухцепочечная ДНК читается в шести рамках: три на каждой цепи. Какая из них настоящая — определяют по наличию длинной открытой рамки и по сигналам начала трансляции.</p>
 ${EL.FIG.biOrf.doc}
 <p><b>Открытая рамка считывания (ORF)</b> — участок от ATG до стоп-кодона в той же рамке, без стоп-кодонов внутри. Стоп-кодоны: TAA (охра), TAG (амбер), TGA (опал).</p>
 ${K.ex('<p>Случайная последовательность содержит стоп-кодон примерно в 3 кодонах из 64, то есть в среднем каждые ≈ 21 кодон. Поэтому ORF длиннее 100 кодонов в случайной ДНК почти не встречается, и такую находку считают вероятным геном.</p>')}
 ${K.box('vuz','Вузовский уровень · чем ORF отличается от гена','<p>У прокариот ORF обычно и есть ген: нет интронов, трансляция начинается на последовательности Шайна — Дальгарно за 5–10 нуклеотидов до ATG. У эукариот всё сложнее: ген разорван интронами, поэтому ORF в геномной ДНК обрывается, и искать надо в кДНК. Старт выбирается по правилу Козак (gccRccAUGG), а первым кодоном может быть и не ATG (редкие альтернативные старты GUG, CUG).</p><p>Кроме того, генетический код не совсем универсален: у митохондрий человека TGA кодирует триптофан, а AGA и AGG — стоп.</p>')}
 ${K.seq({t:'2. Расставь шаги поиска гена в прочитанном контиге.',items:['трансляция найденной рамки в белок','поиск ORF во всех шести рамках','поиск гомологов полученного белка через BLAST','получение нуклеотидной последовательности'],ok:'4213',a:'<p>Сначала последовательность, затем поиск рамок, трансляция и только потом сравнение с базами: гомология белков видна там, где нуклеотидное сходство уже потеряно.</p>'})}
`});

VZ.sec('bioinf',{id:'tree',no:3,t:'Филогенетическое дерево',html:()=>`
 <p class="k-lead">Дерево показывает гипотезу о родстве. Длины ветвей несут информацию об эволюционном расстоянии, а порядок ветвления — о последовательности расхождения линий.</p>
 ${EL.FIG.biTree.doc}
 ${K.tbl(['Метод','Идея','Плюс','Минус'],[['UPGMA','кластеризация по матрице расстояний, среднее арифметическое','очень прост, понятен вручную','требует равной скорости эволюции'],['Neighbor Joining','минимизация общей длины дерева','быстрый, не требует молекулярных часов','даёт неукоренённое дерево'],['Максимальная экономия','минимум эволюционных событий','опирается на сами признаки','«притяжение длинных ветвей»'],['Максимальное правдоподобие','модель замен + вероятность данных','статистически строгий','вычислительно тяжёлый']])}
 ${K.box('ol','На олимпиаде','<p>Терминология: <b>клада</b> — предок со всеми потомками (монофилетическая группа); <b>парафилетическая</b> группа — предок не со всеми потомками (например, «рептилии» без птиц); <b>полифилетическая</b> — объединение по схожести без общего предка. Корень дерева обычно ставят по внешней группе (outgroup).</p>')}
 ${K.choice({t:'3. У вида X скорость накопления замен вдвое выше, чем у остальных. Что произойдёт при построении дерева UPGMA?',opts:['ничего, метод это учитывает','X окажется искусственно ближе к корню, то есть «отделившимся раньше»','X окажется искусственно ближе к своему настоящему родственнику','дерево станет неукоренённым'],ok:[1],a:'<p>UPGMA переводит расстояние в время, деля пополам. Если у X замены копятся быстрее, его расстояния до всех велики, и метод решит, что X отделился раньше всех. Это классическая ошибка молекулярных часов; Neighbor Joining от неё свободен.</p>'})}
 ${VZ.src('Needleman S.B., Wunsch C.D. J. Mol. Biol. 48: 443–453 (1970); Smith T.F., Waterman M.S. J. Mol. Biol. 147: 195–197 (1981); Henikoff S., Henikoff J.G. PNAS 89: 10915–10919 (1992).')}
`});
})();
