
/* Данные плана (вебы, курсы, часы, перерыв) лежат в plan.json и грузятся при старте.
   Здесь только логика: стадии, отрисовка, сохранение отметок. */
let PLAN = [], COURSES = {}, HOURS = {web:3.75, hw:1.9}, BREAK = {after:"", label:"", range:""}, LMS = "";
async function loadPlan(){
  const r = await fetch("plan.json", {cache:"no-cache"});
  if (!r.ok) throw new Error("plan.json не загрузился");
  const d = await r.json();
  COURSES = d.courses; HOURS = d.hours || HOURS; BREAK = d.break || BREAK; LMS = d.lms || "";
  // внутренний короткий формат: c — курс, t — название, w и h — [дата, начало, конец]
  PLAN = d.webs.map(x => ({n:x.n, c:x.course, code:x.code, t:x.title, w:[x.web.date,x.web.from,x.web.to], h:[x.hw.date,x.hw.from,x.hw.to]}));
}
const STAGES = [
  {s:0, label:"Не начат", desc:"Веб ещё впереди"},
  {s:1, label:"Смотрю", desc:"Начал веб, досмотрю позже"},
  {s:2, label:"Веб посмотрен", desc:"Есть конспект от руки"},
  {s:3, label:"ДЗ решено", desc:"Решил сам и сверил с решениями"},
  {s:4, label:"Закрыт", desc:"Ошибки разобраны, тема понятна"}
];
const MONTHS = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const MONTHS_FULL = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WD = ["вс","пн","вт","ср","чт","пт","сб"];

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2,"0");
const at = (d,t) => new Date(`${d}T${t}:00+03:00`);
const dparts = d => { const [y,m,dd] = d.split("-").map(Number); return {y,m,dd,wd:new Date(Date.UTC(y,m-1,dd)).getUTCDay()}; };
const fmtDay = d => { const p = dparts(d); return `${WD[p.wd]}, ${p.dd} ${MONTHS[p.m-1]}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

let progress = {};      // n -> {s, note, at}
let db = null;
let filterS = "all", filterC = "all";
let openN = null;

const st = n => (progress[n] && progress[n].s) || 0;
function lateness(p, now = Date.now()){
  const s = st(p.n);
  if (s < 2 && now > at(p.w[0], p.w[2])) return "веб";
  if (s < 3 && now > at(p.h[0], p.h[2])) return "ДЗ";
  return null;
}
function moscowToday(){
  const d = new Date(Date.now() + 3*3600e3);
  return d.toISOString().slice(0,10);
}
function weekStart(d){
  const p = dparts(d); const t = Date.UTC(p.y,p.m-1,p.dd); const shift = (p.wd + 6) % 7;
  return new Date(t - shift*864e5).toISOString().slice(0,10);
}
function addDays(d, k){ const p = dparts(d); return new Date(Date.UTC(p.y,p.m-1,p.dd) + k*864e5).toISOString().slice(0,10); }
// сколько дней от сегодня до даты: 0 сегодня, 1 завтра, -1 вчера
function daysFrom(today, d){ const a = dparts(today), b = dparts(d); return Math.round((Date.UTC(b.y,b.m-1,b.dd) - Date.UTC(a.y,a.m-1,a.dd)) / 864e5); }
function relLabel(k){
  if (k === 0) return "сегодня";
  if (k === 1) return "завтра";
  if (k === 2) return "послезавтра";
  if (k > 2 && k < 7) return `через ${k} ${k < 5 ? "дня" : "дней"}`;
  return "";
}
function rangeLabel(ws){
  const we = addDays(ws, 6), a = dparts(ws), b = dparts(we);
  return a.m === b.m ? `${a.dd}–${b.dd} ${MONTHS[a.m-1]}` : `${a.dd} ${MONTHS[a.m-1]} – ${b.dd} ${MONTHS[b.m-1]}`;
}

/* ---------- storage ---------- */
const LS_KEY = "shad-track-progress";
function lsLoad(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch(e){ return {}; } }
function lsSave(){ try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch(e){} }
function setSync(kind, text){ const el = $("#sync"); el.className = "sync " + kind; el.querySelector("span").textContent = text; }

const writing = {}; const pending = {};
async function persist(n){
  if (!db){ lsSave(); return; }
  if (writing[n]){ pending[n] = true; return; }
  writing[n] = true;
  try {
    const v = progress[n];
    if (!v || (!v.s && !v.note)) await db.doc("shad/w" + pad(n)).delete();
    else await db.doc("shad/w" + pad(n)).set({s:v.s||0, note:v.note||"", at:v.at||Date.now()});
    setSync("cloud","Сохранено в облаке");
  } catch(e){
    setSync("local","Не сохранилось в облаке, копия на устройстве");
    lsSave();
  } finally {
    writing[n] = false;
    if (pending[n]){ pending[n] = false; persist(n); }
  }
}
function setStage(n, s){
  progress[n] = Object.assign({}, progress[n], {s, at:Date.now()});
  renderAll(); persist(n);
}
const noteTimers = {};
function setNote(n, note){
  progress[n] = Object.assign({}, progress[n], {note, at:Date.now()});
  clearTimeout(noteTimers[n]);
  noteTimers[n] = setTimeout(() => { persist(n); const sv = $("#savedNote"); if (sv) sv.textContent = "Заметка сохранена"; }, 700);
}

async function initStore(){
  // облако: Supabase через ../bioviz/x/cloud.js, писать может только учитель (вход секретным кодом)
  const me = window.BVAUTH ? await BVAUTH.ready : null;
  try { db = me && me.role === "admin" && window.claude ? await window.claude.use("db") : null; } catch(e){ db = null; }
  $("#loginBtn").hidden = !!db; $("#logoutBtn").hidden = !db;
  if (!db){
    progress = lsLoad(); renderAll();
    setSync("local","Только на этом устройстве · войди кодом, чтобы сохранять в облако");
    return;
  }
  setSync("cloud","Синхронизирую…");
  db.collection("shad").onSnapshot(snap => {
    const next = {};
    snap.docs.forEach(d => { const n = parseInt(d.id.slice(1),10); const v = d.data(); if (n) next[n] = {s:v.s||0, note:v.note||"", at:v.at||0}; });
    // keep a note the viewer is typing right now
    if (openN && noteTimers[openN] && progress[openN]) next[openN] = Object.assign({}, next[openN], {note:progress[openN].note});
    progress = next;
    setSync("cloud","Сохраняется в облаке, видно на всех устройствах");
    renderAll(true);
  }, () => { setSync("local","Облако недоступно, копия на устройстве"); });
}

/* ---------- render ---------- */
function renderSummary(){
  const now = Date.now();
  const done = PLAN.filter(p => st(p.n) === 4).length;
  const units = PLAN.reduce((a,p) => a + st(p.n), 0);
  const late = PLAN.filter(p => lateness(p, now)).length;
  let hrs = 0; PLAN.forEach(p => { const s = st(p.n); if (s < 2) hrs += HOURS.web * (s === 1 ? .5 : 1); if (s < 3) hrs += HOURS.hw; });
  $("#bigDone").innerHTML = `${done}<small>/ ${PLAN.length}</small>`;
  $("#kPct").textContent = Math.round(units / (PLAN.length*4) * 100) + "%";
  $("#kLate").textContent = late;
  $("#kHours").textContent = "≈" + Math.round(hrs) + " ч";

  const nextP = PLAN.find(p => st(p.n) < 4);
  const todayStr = moscowToday();
  const tape = $("#tape");
  tape.innerHTML = PLAN.map(p => {
    const cls = ["cell"]; if (lateness(p, now)) cls.push("late"); if (nextP && p.n === nextP.n) cls.push("now");
    return `<button class="${cls.join(" ")}" style="--cc:var(--${p.c})" data-s="${st(p.n)}" data-n="${p.n}" title="${p.n}. ${esc(p.t)} · ${STAGES[st(p.n)].label}" aria-label="Веб ${p.n}: ${esc(p.t)}, ${STAGES[st(p.n)].label}"></button>`;
  }).join("");

  const nx = $("#next");
  if (!nextP){ nx.innerHTML = `<span class="lbl">Готово</span><span class="ttl">Все ${PLAN.length} вебов закрыты</span><span></span>`; nx.style.setProperty("--cc","var(--done)"); return; }
  const late1 = lateness(nextP, now);
  const s = st(nextP.n);
  const what = s < 2 ? "Смотреть веб" : s < 3 ? "Решить ДЗ" : "Разобрать ошибки";
  const slot = s < 2 ? nextP.w : nextP.h, rel = relLabel(daysFrom(todayStr, slot[0]));
  const when = `${rel ? rel + ", " : ""}${fmtDay(slot[0])} · ${slot[1]}–${slot[2]}`;
  nx.style.setProperty("--cc", `var(--${nextP.c})`);
  nx.dataset.n = nextP.n;
  nx.innerHTML = `<span class="lbl">${late1 ? "Догнать" : "Дальше"}</span>
    <span style="min-width:0;display:grid;gap:2px"><span class="ttl">${nextP.n}. ${esc(nextP.t)}</span><span class="when">${what} · ${when}</span></span>
    <span class="go">Отметить</span>`;
}

function renderLegend(){
  $("#legend").innerHTML = Object.entries(COURSES).map(([k,c]) => `<span style="--cc:var(--${k})"><i></i>${c.name}</span>`).join("") +
    `<span style="--cc:var(--sheet)"><i style="box-shadow:inset 0 0 0 2px var(--pen)"></i>отстаю</span>`;
}

function renderFilters(){
  const now = Date.now();
  const counts = {
    all: PLAN.length,
    ahead: PLAN.filter(p => st(p.n) < 4 && !lateness(p, now)).length,
    late: PLAN.filter(p => lateness(p, now)).length,
    done: PLAN.filter(p => st(p.n) === 4).length
  };
  const S = [["all","Все"],["ahead","Впереди"],["late","Отстаю"],["done","Закрыты"]];
  $("#fStatus").innerHTML = S.map(([k,l]) => `<button class="chip${k==="late"?" warn":""}" data-fs="${k}" aria-pressed="${filterS===k}">${l}<span class="n">${counts[k]}</span></button>`).join("");
  const C = [["all","Все курсы"], ...Object.entries(COURSES).map(([k,c]) => [k,c.name])];
  $("#fCourse").innerHTML = C.map(([k,l]) => `<button class="chip" data-fc="${k}" aria-pressed="${filterC===k}" style="--cc:var(--${k})">${k!=="all"?"<i></i>":""}${l}</button>`).join("");
}

function passes(p, now){
  if (filterC !== "all" && p.c !== filterC) return false;
  const s = st(p.n), l = lateness(p, now);
  if (filterS === "ahead") return s < 4 && !l;
  if (filterS === "late") return !!l;
  if (filterS === "done") return s === 4;
  return true;
}

function rowHTML(p, now, todayStr){
  const s = st(p.n), l = lateness(p, now), d = dparts(p.w[0]), hd = dparts(p.h[0]);
  const meter = [1,2,3,4].map(i => `<i class="${s>=i?"on":""}"></i>`).join("");
  const hwSame = p.h[0] === p.w[0];
  const note = progress[p.n] && progress[p.n].note ? `<span class="slot note">заметка</span>` : "";
  const k = daysFrom(todayStr, p.w[0]), rel = s < 2 ? relLabel(k) : "";
  const past = k < 0 ? " past" : "";
  return `<button class="row" data-n="${p.n}" data-s="${s}" style="--cc:var(--${p.c})">
    <span class="date${k===0?" today":""}${past}"><span>${WD[d.wd]}</span><b>${d.dd}</b><span>${MONTHS[d.m-1]}</span></span>
    <span class="body">
      <span class="tagline"><span class="num">${pad(p.n)}</span><span class="course">${COURSES[p.c].name}</span><span class="code">${p.code}</span>${rel ? `<span class="rel${k===0?" now":""}">${rel}</span>` : ""}</span>
      <span class="title">${esc(p.t)}</span>
      <span class="slots"><span class="slot web"><i>веб</i>${p.w[1]}–${p.w[2]}</span><span class="slot hw"><i>ДЗ</i>${hwSame ? "" : `${WD[hd.wd]} ${hd.dd}${hd.m === d.m ? "" : " " + MONTHS[hd.m-1]}, `}${p.h[1]}–${p.h[2]}</span>${note}</span>
    </span>
    <span class="stat"><span class="meter" aria-hidden="true">${meter}</span>${l ? `<span class="late-tag">отстаю: ${l}</span>` : `<span class="slabel">${STAGES[s].label}</span>`}</span>
  </button>`;
}

// полоска пн–вс: заливка — день веба, точка — день ДЗ
function weekStrip(ws, all, todayStr){
  const days = [];
  for (let i = 0; i < 7; i++){
    const d = addDays(ws, i), p = dparts(d);
    const w = all.find(x => x.w[0] === d), h = all.filter(x => x.h[0] === d);
    const cls = ["day"]; if (w) cls.push("has-web"); if (d === todayStr) cls.push("today"); if (d < todayStr) cls.push("past");
    const cc = w ? w.c : h.length ? h[0].c : "";
    const what = [w ? `веб ${w.n}` : "", h.length ? `ДЗ ${h.map(x => x.n).join(", ")}` : ""].filter(Boolean).join(", ");
    days.push(`<span class="${cls.join(" ")}"${cc ? ` style="--cc:var(--${cc})"` : ""} title="${fmtDay(d)}${what ? ": " + what : ""}"><span class="wd">${WD[p.wd]}</span><b>${p.dd}</b>${h.length ? '<i class="hw-dot"></i>' : ""}</span>`);
  }
  return `<div class="strip" aria-hidden="true">${days.join("")}</div>`;
}
function renderWeeks(){
  const now = Date.now(), todayStr = moscowToday(), curWs = weekStart(todayStr);
  const groups = new Map();
  PLAN.forEach(p => { if (!passes(p, now)) return; const ws = weekStart(p.w[0]); if (!groups.has(ws)) groups.set(ws, []); groups.get(ws).push(p); });
  const allWeeks = [...new Set(PLAN.map(p => weekStart(p.w[0])))];
  let html = `<p class="strip-key"><i class="k-web"></i>день веба<i class="k-hw"></i>день ДЗ<i class="k-today"></i>сегодня</p>`, breakDone = false, lastMonth = "";
  if (!groups.size){
    const msg = filterS === "late" ? "Ты идёшь по плану, догонять нечего." : filterS === "done" ? "Пока ни один веб не закрыт полностью. Нажми на веб и отметь, сколько сделано." : "По этому фильтру вебов нет.";
    $("#weeks").innerHTML = `<div class="empty">${msg}</div>`; return;
  }
  for (const [ws, items] of groups){
    if (!breakDone && ws > BREAK.after){ html += `<div class="break"><b>${BREAK.label}</b><span class="mono">${BREAK.range}</span></div>`; breakDone = true; }
    const mk = items[0].w[0].slice(0,7);
    if (mk !== lastMonth){ const m = dparts(items[0].w[0]); html += `<h2 class="month">${MONTHS_FULL[m.m-1]}<span>${m.y}</span></h2>`; lastMonth = mk; }
    const idx = allWeeks.indexOf(ws) + 1;
    const all = PLAN.filter(p => weekStart(p.w[0]) === ws);
    const wd = all.filter(p => st(p.n) === 4).length;
    html += `<section class="week${ws===curWs?" current":""}" data-ws="${ws}">
      <div class="week-h"><h3>Неделя ${idx}</h3><span class="rng">${rangeLabel(ws)}</span><span class="wp">${wd}/${all.length} закрыто</span></div>
      ${weekStrip(ws, all, todayStr)}
      <div class="list">${items.map(p => rowHTML(p, now, todayStr)).join("")}</div></section>`;
  }
  $("#weeks").innerHTML = html;
}

function renderStats(){
  const cs = Object.entries(COURSES).map(([k,c]) => {
    const items = PLAN.filter(p => p.c === k);
    const by = [0,0,0,0,0]; items.forEach(p => by[st(p.n)]++);
    const tot = items.length;
    const seg = [4,3,2,1].map(s => by[s] ? `<span style="width:${by[s]/tot*100}%;background:var(--${k});opacity:${[0,.3,.55,.8,1][s]}"></span>` : "").join("");
    const last = items[items.length-1];
    return `<div class="course-row" style="--cc:var(--${k})"><span class="nm"><i></i>${c.full}</span><span class="ct">${by[4]}/${tot}</span>
      <div class="bar">${seg}</div><span class="hint" style="grid-column:1/-1;font-size:12px">по плану до ${fmtDay(last.w[0])}</span></div>`;
  }).join("");
  const by = [0,0,0,0,0]; PLAN.forEach(p => by[st(p.n)]++);
  const notes = PLAN.filter(p => progress[p.n] && progress[p.n].note);
  $("#stats").innerHTML = `
    <div class="card"><h3>По курсам</h3>${cs}</div>
    <div class="card"><h3>На каком этапе вебы</h3><div class="stages">${STAGES.map(s => `<div class="stg"><b>${by[s.s]}</b><span>${s.label}</span></div>`).join("")}</div></div>
    <div class="card"><h3>Заметки к вебам</h3>${notes.length ? notes.map(p => `<button class="row" data-n="${p.n}" data-s="${st(p.n)}" style="--cc:var(--${p.c});border-top:1px solid var(--rule)"><span class="date"><b>${p.n}</b><span>веб</span></span><span class="body"><span class="title">${esc(p.t)}</span><span class="meta" style="white-space:pre-wrap;font-family:var(--f-body)">${esc(progress[p.n].note)}</span></span><span></span></button>`).join("") : `<p class="hint">Здесь соберутся заметки, которые ты оставишь в вебах: где остановился, что осталось непонятным.</p>`}</div>`;
}

function renderAll(fromSnap){
  renderSummary(); renderFilters(); renderWeeks();
  if (!$("#view-stats").hidden) renderStats();
  if (openN) renderSheet(openN, true);
}

/* ---------- sheet ---------- */
function renderSheet(n, keepNote){
  const p = PLAN[n-1], s = st(n), now = Date.now(), l = lateness(p, now);
  const sh = $("#sheet");
  const ta = sh.querySelector("textarea");
  const typed = keepNote && ta ? ta.value : null;
  const hadFocus = ta && document.activeElement === ta;
  const optFocus = document.activeElement && document.activeElement.classList.contains("opt");
  sh.style.setProperty("--cc", `var(--${p.c})`);
  sh.innerHTML = `<div class="grab"></div>
    <div class="sh-top"><span class="course">${COURSES[p.c].name}</span><span class="code">[${p.code}]</span><span class="mono">веб ${n}/${PLAN.length}</span>
      <span class="sh-nav"><button class="icon-btn" id="shPrev" aria-label="Предыдущий веб" ${n===1?"disabled":""}>‹</button><button class="icon-btn" id="shNext" aria-label="Следующий веб" ${n===PLAN.length?"disabled":""}>›</button><button class="icon-btn" id="shClose" aria-label="Закрыть">✕</button></span></div>
    <h2 id="shTitle">${esc(p.t)}</h2>
    <dl class="when">
      <div><dt>Веб</dt><dd>${fmtDay(p.w[0])} · ${p.w[1]}–${p.w[2]}${l==="веб"?'<span class="late-tag">отстаю</span>':""}</dd></div>
      <div><dt>ДЗ</dt><dd>${fmtDay(p.h[0])} · ${p.h[1]}–${p.h[2]}${l==="ДЗ"?'<span class="late-tag">отстаю</span>':""}</dd></div>
    </dl>
    <p class="sec-l">Насколько закрыт</p>
    <div class="opts" role="radiogroup" aria-label="Насколько закрыт веб">
      ${STAGES.map(o => `<button class="opt${o.s===4?" done":""}" role="radio" aria-checked="${s===o.s}" data-stage="${o.s}"><span class="dot">${o.s===4?"✓":o.s}</span><span><b>${o.label}</b><span>${o.desc}</span></span></button>`).join("")}
    </div>
    <p class="sec-l"><label for="note">Заметка</label></p>
    <textarea id="note" placeholder="Где остановился, какие задачи не вышли, что спросить в чате курса">${esc(typed !== null ? typed : (progress[n] && progress[n].note) || "")}</textarea>
    <div class="sh-foot"><span class="saved" id="savedNote">${progress[n] && progress[n].at ? "Обновлено " + new Date(progress[n].at).toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "Изменения сохраняются сразу"}</span>
      <a class="lms" href="${esc(LMS)}" target="_blank" rel="noopener">Открыть платформу ↗</a>
      <button class="btn primary" id="shDone">Готово</button></div>`;
  if (hadFocus){ const t = sh.querySelector("textarea"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  else if (optFocus){ const b = sh.querySelector('.opt[aria-checked="true"]'); if (b) b.focus({preventScroll:true}); }
}
function openSheet(n){
  openN = n; const sc = $("#scrim");
  renderSheet(n);
  sc.hidden = false; requestAnimationFrame(() => sc.classList.add("open"));
  document.body.style.overflow = "hidden";
  setTimeout(() => { const b = $('.opt[aria-checked="true"]'); if (b) b.focus({preventScroll:true}); }, 30);
}
function closeSheet(){
  const sc = $("#scrim"); if (sc.hidden) return;
  if (openN && noteTimers[openN]){ clearTimeout(noteTimers[openN]); noteTimers[openN] = null; persist(openN); }
  sc.classList.remove("open"); document.body.style.overflow = "";
  const last = openN; openN = null;
  setTimeout(() => { sc.hidden = true; const r = document.querySelector(`.row[data-n="${last}"]`); if (r) r.focus({preventScroll:true}); }, 180);
  renderAll();
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button, a"); if (!t) { if (e.target === $("#scrim")) closeSheet(); return; }
  if (t.matches(".row, .cell, #next") && t.dataset.n) return openSheet(+t.dataset.n);
  if (t.dataset.stage !== undefined && openN) return setStage(openN, +t.dataset.stage);
  if (t.id === "shClose" || t.id === "shDone") return closeSheet();
  if (t.id === "shPrev" && openN > 1){ flushNote(); openN--; return renderSheet(openN); }
  if (t.id === "shNext" && openN < PLAN.length){ flushNote(); openN++; return renderSheet(openN); }
  if (t.dataset.fs){ filterS = t.dataset.fs; renderFilters(); renderWeeks(); return; }
  if (t.dataset.fc){ filterC = t.dataset.fc; renderFilters(); renderWeeks(); return; }
  if (t.id === "toToday") return scrollToCurrent();
  if (t.dataset.tab){
    document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b === t));
    $("#view-plan").hidden = t.dataset.tab !== "plan";
    $("#view-stats").hidden = t.dataset.tab !== "stats";
    if (t.dataset.tab === "stats") renderStats();
    try { localStorage.setItem("shad-track-tab", t.dataset.tab); } catch(e){}
    window.scrollTo({top:0});
  }
});
function flushNote(){ if (openN && noteTimers[openN]){ clearTimeout(noteTimers[openN]); noteTimers[openN] = null; persist(openN); } }
document.addEventListener("input", e => { if (e.target.id === "note" && openN) { setNote(openN, e.target.value); const sv = $("#savedNote"); if (sv) sv.textContent = "Сохраняю…"; } });
document.addEventListener("keydown", e => {
  if ($("#scrim").hidden) return;
  if (e.key === "Escape") closeSheet();
  if (e.target.tagName === "TEXTAREA") return;
  if (e.key === "ArrowRight" && openN < PLAN.length){ openN++; renderSheet(openN); }
  if (e.key === "ArrowLeft" && openN > 1){ openN--; renderSheet(openN); }
  if (/^[0-4]$/.test(e.key) && openN) setStage(openN, +e.key);
});
function scrollToCurrent(){
  const cur = weekStart(moscowToday());
  const secs = [...document.querySelectorAll(".week")];
  const target = secs.find(s => s.dataset.ws >= cur) || secs[secs.length-1];
  if (!target) return;
  const off = $("#top").offsetHeight + $("#toolbar").offsetHeight + 8;
  window.scrollTo({top: target.getBoundingClientRect().top + window.scrollY - off, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
}
function sizeTop(){ document.documentElement.style.setProperty("--topH", $("#top").offsetHeight + "px"); }
addEventListener("resize", sizeTop);

/* ---------- вход ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.id === "loginBtn"){ const f = $("#login"); f.hidden = !f.hidden; if (!f.hidden) $("#code").focus(); }
  if (t.id === "logoutBtn"){ BVAUTH.logout(); location.reload(); }
});
$("#login").addEventListener("submit", async e => {
  e.preventDefault(); const m = $("#loginMsg"); m.textContent = "Проверяю…";
  try { const r = await BVAUTH.login($("#code").value);
    if (r.role !== "admin"){ BVAUTH.logout(); m.textContent = "Это код ученика. Для трекера нужен код учителя."; return; }
    // отметки, сделанные до входа на этом устройстве, переносим в облако
    try { localStorage.setItem("shad-track-merge", localStorage.getItem(LS_KEY) || "{}"); } catch(er){}
    location.reload();
  } catch(er){ m.textContent = er.message; }
});
async function mergeLocal(){
  let loc = {}; try { loc = JSON.parse(localStorage.getItem("shad-track-merge") || "{}"); localStorage.removeItem("shad-track-merge"); } catch(e){}
  for (const [n,v] of Object.entries(loc)){ const cur = progress[n]; if (!cur || (v.at||0) > (cur.at||0)){ progress[n] = v; await persist(+n); } }
}

(async function boot(){
  try { await loadPlan(); }
  catch(e){ $("#weeks").innerHTML = `<div class="empty">Не получилось загрузить план. Обнови страницу.</div>`; return; }
  document.title = "Трек к ШАДу";
  $("#brandSub").textContent = `вышмат · ${PLAN.length} вебов`;
  $("#bigDone").innerHTML = `0<small>/ ${PLAN.length}</small>`;
  $("#tape").setAttribute("aria-label", `Все ${PLAN.length} вебов по порядку`);
  renderLegend();
  progress = {};
  renderAll();
  sizeTop();
  try { const tb = localStorage.getItem("shad-track-tab"); if (tb === "stats") document.getElementById("tab-stats").click(); } catch(e){}
  await initStore();
  if (db) setTimeout(mergeLocal, 1500);
  setInterval(() => { if (!openN) { renderSummary(); renderFilters(); } }, 5*60e3);
})();
