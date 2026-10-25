/* Углубление теории «Клетки» до уровня олимпиады СПбГУ.
   BV.DEEP.add(mod, secId, {sub, html}) дописывает блок в конец существующего раздела конспекта
   и добавляет его подразделы в оглавление; BV.DEEP.insert(mod, afterId, sec) вставляет новый раздел
   после указанного. Каждый блок начинается с «мостика» от школьного знания. */
(function(){
const K=BV.K,R=BVHOST.root;
const CSS=`
.dp-band{display:flex;align-items:center;gap:10px;margin:34px 0 4px;padding:10px 14px;border-radius:14px;
  background:linear-gradient(90deg,color-mix(in oklab,var(--hema) 14%,var(--surface)),color-mix(in oklab,var(--hema) 3%,var(--surface)));
  border:1px solid color-mix(in oklab,var(--hema) 28%,var(--line))}
.dp-band b{font:600 12.5px var(--font-body);letter-spacing:.09em;text-transform:uppercase;color:var(--hema)}
.dp-band span{font-size:13.5px;color:var(--muted)}
.dp-band svg{flex:none;width:22px;height:22px;color:var(--hema)}
.k-bridge{background:color-mix(in oklab,var(--ok) 8%,var(--surface));border-color:color-mix(in oklab,var(--ok) 30%,var(--line))}
.k-bridge>b:first-child{color:var(--ok)}
.k-bridge .dp-sch{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:4px 0 2px}
.k-bridge .dp-sch i{font-style:normal;font-weight:700;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding-top:2px;white-space:nowrap}
@media (max-width:560px){.k-bridge .dp-sch{grid-template-columns:1fr}.k-bridge .dp-sch i{padding-top:6px}}
.k-spbu{background:color-mix(in oklab,var(--violet,#8a4fbf) 7%,var(--surface));border-color:color-mix(in oklab,var(--violet,#8a4fbf) 28%,var(--line))}
.k-spbu>b:first-child{color:var(--violet,#8a4fbf)}
.dp-num{font-family:var(--font-mono);font-size:14px;background:var(--surface-2);border-radius:8px;padding:2px 7px;white-space:nowrap}
.dp-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0 14px}
@media (max-width:700px){.dp-two{grid-template-columns:1fr}}
.dp-two>div{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:var(--surface)}
.dp-two>div>b{display:block;font-size:14.5px;margin-bottom:4px}
/* в подписях к интерактивным рисункам блоком идёт только первый <b>, остальные внутри текста */
.kf .k-steptx b:not(:first-child){display:inline;font-family:var(--font-body);font-weight:700;font-size:inherit;margin:0}
.dp-err{border:1px dashed var(--bad);border-radius:12px;padding:10px 12px;color:var(--muted);font-size:14px}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg>';
const D=BV.DEEP={};
/* полоса «Уровень СПбГУ» перед углублённой частью раздела */
D.band=(t='Уровень СПбГУ',s='глубже конспекта: то, что спрашивают на отборе и финале олимпиады СПбГУ')=>`<div class="dp-band">${ICON}<div><b>${t}</b><br><span>${s}</span></div></div>`;
/* мостик: что знаешь из школы → как на самом деле */
D.bridge=(school,deep,title='Мостик от школы')=>K.box('bridge',title,`<div class="dp-sch"><i>В школе</i><div>${school}</div><i>Глубже</i><div>${deep}</div></div>`);
D.spbu=(html,title='Как спрашивают на СПбГУ')=>K.box('spbu',title,html);
D.two=(a,b)=>`<div class="dp-two"><div>${a}</div><div>${b}</div></div>`;
D.num=s=>`<span class="dp-num">${s}</span>`;
const safe=(fn,label)=>()=>{try{return fn()}catch(e){console.error('Раздел',label,e);return `<div class="dp-err">Этот фрагмент не загрузился. Обнови страницу; если не поможет, напиши учителю.</div>`}};
const find=(mod,id)=>{const d=BV.KR[mod];return d&&(d.sections||[]).find(s=>s.id===id)};
D.add=(mod,id,part)=>{const s=find(mod,id);if(!s){console.warn('Нет раздела',mod,id);return}
  const old=s.html,extra=safe(part.html,mod+'/'+id+'+');
  s.html=()=>{let a='';try{a=old()}catch(e){console.error(e);a='<div class="dp-err">Основная часть раздела не загрузилась.</div>'}return a+extra()};
  if(part.sub)s.sub=(s.sub||[]).concat(part.sub);
  if(part.kw)s.kw=(s.kw||[]).concat(part.kw)};
D.insert=(mod,after,sec)=>{const d=BV.KR[mod];if(!d)return;sec.html=safe(sec.html,mod+'/'+sec.id);
  const i=after==null?-1:d.sections.findIndex(s=>s.id===after);
  if(i<0)d.sections.push(sec);else d.sections.splice(i+1,0,sec)};
D.renum=(mod,id,no)=>{const s=find(mod,id);if(s)s.no=no};
})();
