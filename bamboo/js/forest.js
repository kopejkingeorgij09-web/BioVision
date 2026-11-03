/* Зов леса: сам лес.
   Каждый уровень сажает новое дерево: на уровне L в лесу L − 1 взрослых деревьев и одно растущее,
   его размер показывает, сколько опыта набрано внутри уровня. Места и породы деревьев зависят только от номера,
   поэтому лес не перетасовывается. Цветы на траве — дни, в которые было сделано хоть что-то. */
(function(){
const {esc, icon} = B;
const W = 640, H = 380, GROUND = 196;
const KINDS = ['pine', 'birch', 'oak', 'spruce', 'maple', 'pine', 'oak', 'birch', 'spruce', 'linden'];

function rnd(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* место i-го дерева: глубина (0 — дальний ряд, 1 — передний) и x */
function spot(i){
  const r = rnd(i * 7919 + 13);
  let depth = r(), x = 24 + r() * (W - 48);
  // переднюю середину оставляем растущему дереву
  if (depth > 0.72 && Math.abs(x - W / 2) < 70) x = x < W / 2 ? x - 90 : x + 90;
  return {depth, x: Math.max(18, Math.min(W - 18, x)), kind: KINDS[Math.floor(r() * KINDS.length)], tilt: (r() - 0.5) * 4, hue: r()};
}
const yAt = depth => GROUND + 10 + depth * (H - GROUND - 26);

function tree(kind, x, y, s, hue, extra = ''){
  // s — масштаб, дерево высотой примерно 110·s
  const g = (body) => `<g class="tree ${kind} ${extra}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})">${body}</g>`;
  const v = hue > 0.5 ? 'b' : 'a';
  switch (kind){
    case 'pine': return g(`<rect class="trunk" x="-4" y="-30" width="8" height="30" rx="2"/>
      <path class="cn ${v}" d="M0 -112 L26 -62 L14 -62 L34 -28 L-34 -28 L-14 -62 L-26 -62Z"/>`);
    case 'spruce': return g(`<rect class="trunk" x="-3.5" y="-18" width="7" height="18" rx="2"/>
      <path class="sp ${v}" d="M0 -120 L18 -88 L10 -88 L28 -56 L16 -56 L36 -18 L-36 -18 L-16 -56 L-28 -56 L-10 -88 L-18 -88Z"/>`);
    case 'birch': return g(`<rect class="bark" x="-4" y="-70" width="8" height="70" rx="3"/>
      <path class="mark" d="M-4 -52h4M0 -36h4M-4 -20h3"/>
      <ellipse class="lf l ${v}" cx="-12" cy="-80" rx="20" ry="26"/><ellipse class="lf l ${v}" cx="12" cy="-90" rx="20" ry="28"/><ellipse class="lf l2" cx="0" cy="-104" rx="15" ry="18"/>`);
    case 'oak': return g(`<path class="trunk" d="M-6 0 L-4 -40 L-14 -54 L-10 -56 L0 -46 L10 -58 L13 -55 L4 -40 L6 0Z"/>
      <circle class="lf o ${v}" cx="-22" cy="-70" r="22"/><circle class="lf o ${v}" cx="20" cy="-72" r="24"/><circle class="lf o2" cx="0" cy="-92" r="26"/><circle class="lf o ${v}" cx="-4" cy="-62" r="18"/>`);
    case 'maple': return g(`<rect class="trunk" x="-4" y="-44" width="8" height="44" rx="2"/>
      <circle class="lf m ${v}" cx="-16" cy="-66" r="20"/><circle class="lf m ${v}" cx="16" cy="-68" r="20"/><circle class="lf m2" cx="0" cy="-86" r="22"/>`);
    default: return g(`<rect class="trunk" x="-4" y="-40" width="8" height="40" rx="2"/>
      <ellipse class="lf o ${v}" cx="0" cy="-78" rx="32" ry="40"/><ellipse class="lf o2" cx="-6" cy="-90" rx="18" ry="22"/>`);
  }
}
function sprout(x, y, s){
  return `<g class="tree sprout" transform="translate(${x} ${y}) scale(${s.toFixed(3)})"><path class="stem" d="M0 0 C0 -10 1 -18 0 -26"/>
    <path class="lf l" d="M0 -18 C-12 -22 -16 -30 -14 -34 C-6 -32 -1 -26 0 -18Z"/><path class="lf l2" d="M0 -24 C10 -30 16 -36 14 -42 C6 -40 1 -32 0 -24Z"/></g>`;
}

/* c: {level, frac, days?}; days нужны только для цветов */
function scene(c){
  const grown = Math.max(0, c.level - 1);
  const shrink = grown > 30 ? Math.max(0.42, Math.sqrt(30 / grown)) : 1;
  const list = [];
  for (let i = 0; i < grown; i++){ const p = spot(i); list.push(Object.assign(p, {y: yAt(p.depth), i})); }
  list.sort((a, b) => a.y - b.y);
  const r = rnd(4242);
  let flowers = '';
  const active = c.days ? Object.values(c.days).filter(d => d.result === 'good' || d.result === 'some').length : 0;
  for (let i = 0; i < Math.min(active, 140); i++){
    const fx = 10 + r() * (W - 20), fy = GROUND + 18 + r() * (H - GROUND - 26), k = r();
    flowers += k < 0.5 ? `<circle class="fl ${k < 0.2 ? 'w' : k < 0.35 ? 'y' : 'p'}" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="2.2"/>`
      : `<path class="grass" d="M${fx.toFixed(1)} ${fy.toFixed(1)} l-2 -6 M${fx.toFixed(1)} ${fy.toFixed(1)} l0 -8 M${fx.toFixed(1)} ${fy.toFixed(1)} l3 -6"/>`;
  }
  const trees = list.map(p => tree(p.kind, p.x, p.y, (0.42 + p.depth * 0.62) * shrink, p.hue)).join('');
  // растущее дерево впереди по центру
  const nk = spot(grown).kind, f = Math.max(0, Math.min(1, c.frac || 0));
  const gy = H - 14;
  const growing = f < 0.25 ? sprout(W / 2, gy, 1.3 + f * 3) : tree(nk, W / 2, gy, 0.35 + f * 0.75, 0.3, 'grow');
  return `<svg class="scene forest" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Лес: ${B.fmtTrees(grown)}, растёт ещё одно">
    <defs><linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sky0"/><stop offset="1" class="sky1"/></linearGradient>
      <linearGradient id="fgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gr0"/><stop offset="1" class="gr1"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#fsky)"/>
    <circle class="sun" cx="${W - 92}" cy="64" r="26"/>
    <path class="hill far" d="M0 ${GROUND - 30} C120 ${GROUND - 74} 220 ${GROUND - 20} 330 ${GROUND - 48} S540 ${GROUND - 80} ${W} ${GROUND - 36} V${GROUND + 20} H0Z"/>
    <path class="hill near" d="M0 ${GROUND - 4} C140 ${GROUND - 34} 260 ${GROUND + 4} 380 ${GROUND - 18} S560 ${GROUND - 26} ${W} ${GROUND - 2} V${H} H0Z"/>
    <rect y="${GROUND}" width="${W}" height="${H - GROUND}" fill="url(#fgr)"/>
    ${flowers}${trees}
    <ellipse class="shadow" cx="${W / 2}" cy="${gy + 2}" rx="${18 + f * 30}" ry="4"/>
    ${growing}
  </svg>`;
}
B.forestScene = scene;

B.views.forest = {
  title: 'Лес',
  render(){
    const c = B.calc(), {prev, next} = B.mileFor(c.level);
    const lp = prev && next ? (c.level - 1 + c.frac - (prev[0] - 1)) / (next[0] - prev[0]) : 1;
    let x7 = 0, n7 = 0; for (let i = 1; i <= 7; i++){ const d = c.days[B.add(c.today, -i)]; if (d){ x7 += d.xp; n7++; } }
    const avg = n7 ? x7 / n7 : 0;
    const left = next ? B.xpForLevel(next[0]) - c.total : 0;
    const eta = next && avg > 0 ? Math.ceil(left / avg) : null;
    const act = Object.values(c.days).filter(d => d.result === 'good' || d.result === 'some').length;
    return `<div class="page forest-page">
      <header class="page-h"><div><div class="eyebrow">Лес · ${prev ? esc(prev[1]) : 'Семечко'}</div><h1>${c.trees ? B.fmtTrees(c.trees) : 'Поляна'}</h1></div></header>
      <div class="cols">
        <div class="col">
          <section class="card scene-card">${scene(c)}</section>
          <p class="hint">Впереди по центру растёт дерево ${c.level}-го уровня: оно ${Math.round(c.frac * 100)}% пути до взрослого. Цветы и трава на поляне — дни, когда ты что-то сделал (${act}).</p>
        </div>
        <div class="col">
          ${B.levelCard(c, true)}
          ${next ? `<section class="card next-mile">
            <div class="eyebrow">Следующая веха · уровень ${next[0]}</div>
            <h2>${esc(next[1])}</h2><p class="muted">${esc(next[2])}</p>
            ${B.bar(lp, 'xp')}
            <div class="row between"><span class="muted">${prev ? '✓ ' + esc(prev[1]) : ''}</span><span class="mono">ещё ${B.num(left)} XP</span></div>
            <p class="hint">${eta != null ? `При темпе последней недели (${Math.round(avg)} XP в день) дойдёшь примерно за ${eta} ${B.plural(eta, 'день', 'дня', 'дней')}.` : 'Темп появится через несколько дней.'}</p>
          </section>` : `<section class="card"><h2>Лес до горизонта</h2><p class="muted">Все вехи пройдены. Деревья продолжают расти с каждым уровнем.</p></section>`}
          <section class="card"><div class="kpis">
            <div class="kpi"><b>${c.trees}</b><span>деревьев</span></div>
            <div class="kpi"><b>${c.level}</b><span>уровень</span></div>
            <div class="kpi"><b>${act}</b><span>дней с делами</span></div>
            <div class="kpi"><b>${B.num(c.xpAll)}</b><span>XP заработано</span></div>
          </div>
          <a class="btn sm ghost" href="#/stats">${icon('chart')} Как рос лес и итоги</a></section>
          <section class="card rules"><h2>${icon('tree')}Как растёт лес</h2>
            <ul class="plain xp">
              <li><span>Сделанное дело</span><b>+${B.XP.task}</b></li>
              <li><span>Важное дело или с короной</span><b>+${B.XP.taskP1}</b></li>
              <li><span>Подзадача</span><b>+${B.XP.sub}</b></li>
              <li><span>Отметка привычки (минимум вдвое меньше)</span><b>+${B.XP.habit}</b></li>
            </ul>
            <p class="hint">Опыт дают только дела и привычки. Чтение и тренировка считаются, когда отмечены их привычки. Новый уровень сажает новое дерево, а уровень от уровня нужно чуть больше опыта: ${B.need(1)}, ${B.need(2)}, ${B.need(3)} XP и дальше на 25 больше. Штрафов нет.</p>
          </section>
        </div>
      </div>
    </div>`;
  }
};
B.views.bamboo = B.views.forest;   // старые ссылки #/bamboo
})();
