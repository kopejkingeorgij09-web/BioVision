'use strict';
(() => {
  const names = {bands:'Опыт Мезельсона и Сталя',clamps:'Два скользящих зажима в 3D',mature:'От праймера до непрерывной ДНК',bubble:'Прочитайте репликационный пузырь',telomere:'Три состояния конца хромосомы'};
  const button = (label,fn) => {const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;};
  function el(tag,cls,text) {const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;}
  function controls(host){const row=el('div','controls');host.append(row);return row;}
  function status(host){const p=el('p','status');p.setAttribute('aria-live','polite');host.append(p);return p;}
  function stepper(host,id) {
    const labels=id==='mature'?['Праймер','Замещение','Лигирование']:['Конец матрицы','Теломераза','Достройка'];
    const notes=id==='mature'?['3′-конец предыдущей по ходу синтеза ДНК может служить праймером для замещения.','В этом состоянии ДНК содержит все основания, но связь в одном месте ещё отсутствует.','Каталитическое действие лигазы делает остов непрерывным.']:['Для заполнения крайнего промежутка отсутствует внешний 3′-OH.','Удлиняется G-богатый 3′-конец самой ДНК. Матрицей служит РНК теломеразы.','Pol α–праймаза начинает комплементарную цепь. Зрелая теломера сохраняет 3′-выступ.'];
    const row=controls(host),fig=el('figure'),img=el('img'),p=el('figcaption');fig.append(img,p);host.append(fig);p.setAttribute('aria-live','polite');
    img.width=1484;img.height=686;
    function choose(i){img.src='media/'+id+'-'+i+'.png';img.alt=labels[i]+'. '+notes[i];p.textContent=notes[i];[...row.children].forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));}
    labels.forEach((l,i)=>row.append(button(l,()=>choose(i))));choose(0);
  }
  function density(host){
    const row=controls(host),lab=el('label','','Модель'),sel=el('select');sel.setAttribute('aria-label','Модель репликации');
    const models=[['semi','Полуконсервативная'],['conserv','Консервативная'],['disp','Дисперсная']];models.forEach(([v,t])=>sel.add(new Option(t,v)));lab.append(sel);row.append(lab);
    const gen=el('input');gen.type='range';gen.min='0';gen.max='3';gen.value='1';gen.step='1';gen.setAttribute('aria-label','Поколение');const val=el('output');const gLabel=el('label','','Поколение');gLabel.append(gen,val);row.append(gLabel);
    const plot=el('div','gradient-plot'),density=el('div','densities'),tube=el('div','tube'),caption=el('div','generation','Плотность возрастает вниз ↓');
    ['лёгкая','промежуточная','тяжёлая'].forEach(t=>density.append(el('span','',t)));plot.append(density,tube,caption);host.append(plot);tube.setAttribute('aria-hidden','true');
    const read=status(host);
    function draw(){
      const n=Number(gen.value),m=sel.value;val.value=String(n);tube.replaceChildren();let data,txt;
      if(n===0){data=[[84,1]];txt='Вся ДНК содержит тяжёлый азот.';}
      else if(m==='semi'){const h=2**(1-n);data=[[50,h]];if(h<1)data.push([16,1-h]);txt=n===1?'Все дуплексы гибридные.':('Гибридные дуплексы составляют '+h*100+' %, лёгкие — '+(1-h)*100+' %.');}
      else if(m==='conserv'){const h=2**(-n);data=[[84,h],[16,1-h]];txt='Сохранившийся тяжёлый дуплекс даёт '+h*100+' % ДНК, полностью лёгкие — '+(1-h)*100+' %.';}
      else{data=[[16+68/2**n,1]];txt='Все молекулы имеют одну среднюю плотность. Доля тяжёлого материала в каждой составляет '+100/2**n+' %.';}
      data.forEach(([y,f])=>{const b=el('i','band');b.style.top=y+'%';b.style.height=(4+8*f)+'px';tube.append(b);});read.textContent=txt;
    }
    sel.onchange=gen.oninput=draw;draw();
  }
  function bubble(host){
    const row=controls(host),orient=el('select');orient.setAttribute('aria-label','Ориентация верхней матрицы');orient.add(new Option('3′ → 5′ слева направо','0'));orient.add(new Option('5′ → 3′ слева направо','1'));
    const lab=el('label','','Верхняя матрица');lab.append(orient);row.append(lab);const fig=el('figure'),img=el('img');img.width=1484;img.height=686;fig.append(img);host.append(fig);
    const prompt=el('p','hint','У какой вилки верхняя матрица служит для непрерывного синтеза?');host.append(prompt);const answers=controls(host),out=status(host);let visible=false;
    const reveal=button('Показать схему',()=>{visible=!visible;draw();});
    function draw(){img.src='media/bubble-'+orient.value+Number(visible)+'.png';img.alt='Верхняя матрица '+orient.options[orient.selectedIndex].text+'. '+(visible?'Сплошные и прерывистые дочерние цепи показаны стрелками.':'Показаны только родительские цепи.');reveal.textContent=visible?'Скрыть дочерние цепи':'Показать схему';reveal.setAttribute('aria-pressed',String(visible));}
    function answer(side){const correct=side===(orient.value==='0'?'right':'left');out.textContent=correct?'Верно. Полимераза следует за этой вилкой, читая верхнюю матрицу 3′→5′.':'Проследите верхнюю матрицу от 3′ к 5′. Какая вилка движется в ту же сторону?';if(correct){visible=true;draw();}}
    answers.append(button('У левой',()=>answer('left')),button('У правой',()=>answer('right')),reveal);
    orient.onchange=()=>{visible=false;out.textContent='';draw();};draw();
  }
  let structures;
  async function clamps(host){
    const menu=controls(host),canvas=el('canvas'),caption=el('p','hint');canvas.tabIndex=0;canvas.setAttribute('aria-label','Вращаемая структура. Стрелки поворачивают модель, клавиша Home возвращает исходный вид.');
    host.append(canvas,caption);const tip=el('p','hint','Потяните модель в сторону или используйте стрелки на клавиатуре.');host.append(tip);
    const link=el('a','','Карточка экспериментальной структуры ↗');host.append(link);
    let code='2POL',ax=-.28,ay=.15,drag=null,models=null;
    const palette=[[57,100,119],[5,129,111],[183,84,46]];
    function draw(){
      if(!models || !canvas.isConnected)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
      const ratio=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
      const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#f4f5ed';ctx.fillRect(0,0,w,h);
      const sf=Math.min(h*.42,w*.43)/models[code].radius, seg=[];
      models[code].chains.forEach((chain,ci)=>{
        let prev=null,old=null;
        for(const v of chain){const [x,y,z]=v;const x1=x*Math.cos(ay)+z*Math.sin(ay),z1=-x*Math.sin(ay)+z*Math.cos(ay);
          const y1=y*Math.cos(ax)-z1*Math.sin(ax),z2=y*Math.sin(ax)+z1*Math.cos(ax);const curr=[w/2+x1*sf,h/2+y1*sf,z2];
          if(prev && Math.hypot(x-old[0],y-old[1],z-old[2])<7.2)seg.push([prev,curr,ci]);prev=curr;old=v;
        }
      });
      seg.sort((a,b)=>a[0][2]-b[0][2]);ctx.lineCap='round';ctx.lineWidth=Math.max(2,Math.min(w,h)*.0108);
      seg.forEach(([a,b,i])=>{const shade=.80+.16*(a[2]/models[code].radius);ctx.strokeStyle='rgb('+palette[i].map(v=>Math.max(0,Math.min(255,Math.round(v*shade)))).join(',')+')';ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();});
      canvas.dataset.drawn=code;
    }
    function choose(name){code=name;ax=-.28;ay=.15;buttons.forEach(([k,b])=>b.setAttribute('aria-pressed',String(k===code)));caption.textContent=code==='2POL'?'β-зажим E. coli · димер · 2,5 Å · PDB 2POL.':'PCNA дрожжей Saccharomyces cerevisiae · тример · 2,3 Å · PDB 1PLQ.';link.href='https://www.rcsb.org/structure/'+code;draw();}
    const buttons=[['2POL','β-зажим E. coli'],['1PLQ','PCNA дрожжей']].map(([k,name])=>[k,button(name,()=>choose(k))]);
    buttons.forEach(([,b])=>menu.append(b));menu.append(button('Вид сбоку',()=>{ax=Math.PI/2;ay=0;draw();}),button('Сбросить',()=>choose(code)));
    canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(!drag)return;ay+=(e.clientX-drag[0])*.012;ax+=(e.clientY-drag[1])*.012;drag=[e.clientX,e.clientY];draw();};
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
    canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')choose(code);if(e.key==='ArrowLeft')ay-=.15;if(e.key==='ArrowRight')ay+=.15;if(e.key==='ArrowUp')ax-=.15;if(e.key==='ArrowDown')ax+=.15;draw();};
    choose(code);
    try{
      structures??=fetch('media/clamps.json').then(r=>{if(!r.ok)throw Error('coordinates');return r.json();});
      const raw=await structures;models={};Object.entries(raw).forEach(([k,chains])=>{models[k]={chains,radius:Math.max(...chains.flat().map(v=>Math.hypot(...v)))};});
      new ResizeObserver(draw).observe(canvas);draw();
    }catch{const img=el('img');img.src='media/clamp.png';img.alt='Две экспериментальные структуры скользящих зажимов';canvas.replaceWith(img);tip.textContent='Показана статическая проекция двух структур.';}
  }
  function mount(host,id){host.append(el('h3','',names[id]));if(id==='bands')density(host);else if(id==='clamps')clamps(host);else if(id==='bubble')bubble(host);else stepper(host,id);}
  const parameter=new URLSearchParams(location.search).get('widget');
  if(Object.hasOwn(names,parameter)){document.body.classList.add('widget-only');const container=document.querySelector('#widget-only');container.hidden=false;container.className='widget';mount(container,parameter);return;}
  document.querySelectorAll('[data-widget]').forEach(n=>mount(n,n.dataset.widget));
  const contents=document.querySelector('#contents details');if(matchMedia('(max-width:780px)').matches)contents.open=false;
  const links=Array.from(document.querySelectorAll('.contents nav a'));
  const observer=new IntersectionObserver(entries=>{const active=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(active)links.forEach(a=>a.classList.toggle('active',a.hash==='#'+active.target.id));},{rootMargin:'-8% 0px -65% 0px',threshold:0});
  document.querySelectorAll('.unit').forEach(s=>observer.observe(s));
  const dialog=document.querySelector('#zoom-dialog');document.querySelectorAll('.zoom').forEach(a=>a.addEventListener('click',e=>{if(!dialog.showModal)return;e.preventDefault();const img=dialog.querySelector('img');img.src=a.href;img.alt=a.querySelector('img').alt;dialog.showModal();}));dialog.querySelector('button').onclick=()=>dialog.close();
})();
