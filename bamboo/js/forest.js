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

/* ---------- большой лес для компьютера ----------
   Панорама с небом по времени суток, горами, туманом, ручьём и прудом. Деревья стоят на тех же местах, что и в
   маленькой сцене (x растянут по ширине). Вехи открывают живность и детали, а если несколько дней не было дел,
   лес затягивает туманом: штрафа нет, но видно, что он заскучал. */
const RW = 1400, RH = 600, RG = 318;
const FEATS = [[2, 'Светлячки по вечерам'], [3, 'Ручей'], [5, 'Пруд с отражением неба'], [8, 'Тропинка и грибы'], [12, 'Бабочки днём'], [17, 'Птицы над рощей'], [30, 'Горное эхо: второй хребет'], [52, 'Вековой дуб у тропы'], [100, 'Олени']];
const SKIES = {
  night: ['#0A1330', '#1B2A52', 'Ночь'], dawn: ['#41508A', '#F3AE8A', 'Рассвет'], day: ['#5E9CD8', '#D4EAF4', 'День'],
  sunset: ['#3C3F7A', '#F28C5E', 'Закат'], dusk: ['#1D2552', '#7A6496', 'Сумерки']
};
function phase(h){ return h < 5 || h >= 22 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : h < 20 ? 'sunset' : 'dusk'; }
function mix(a, b, t){
  const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), A = p(a), B2 = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B2[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const ryAt = depth => RG + 14 + depth * (RH - RG - 40);
function idleDays(c){
  const t = c.today || B.today(); let last = '';
  for (const k in c.days){ const d = c.days[k]; if ((d.result === 'good' || d.result === 'some') && k > last) last = k; }
  if (!last) return 0;
  const today = c.days[t]; if (today && (today.result === 'good' || today.result === 'some')) return 0;
  return Math.max(0, B.diff(last, t) - 1);
}
/* в какой день был достигнут каждый уровень: копим опыт по дням */
function levelDates(c){
  const out = {}; let sum = 0, L = 1;
  Object.keys(c.days || {}).sort().forEach(k => { sum += (c.days[k] || {}).xp || 0; while (sum >= B.xpForLevel(L + 1)){ L++; out[L] = k; } });
  return out;
}
function richScene(c){
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60, ph = phase(h), [s0, s1] = SKIES[ph];
  const night = ph === 'night' || ph === 'dusk', L = c.level, idle = idleDays(c);
  const r = rnd(9001);
  // небесное светило идёт по дуге: солнце 6–20 ч, луна в остальное время
  const dayT = Math.max(0, Math.min(1, (h - 6) / 14)), nightT = ((h + 4) % 24) / 10;
  const sx = 120 + (night ? Math.min(1, nightT) : dayT) * (RW - 240), sy = 70 + Math.pow((night ? Math.min(1, nightT) : dayT) - 0.5, 2) * 4 * 120;
  let sky = '';
  if (night || ph === 'dawn'){ for (let i = 0; i < 90; i++){ const x = r() * RW, y = r() * (RG - 60), o = night ? 0.4 + r() * 0.6 : 0.15 + r() * 0.3; sky += `<circle class="star" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.6 + r() * 1.2).toFixed(1)}" style="opacity:${o.toFixed(2)};animation-delay:${(r() * 4).toFixed(1)}s"/>`; } }
  sky += night ? `<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="30" fill="#F4F1DE"/><circle cx="${(sx + 12).toFixed(0)}" cy="${(sy - 6).toFixed(0)}" r="26" fill="${s0}" opacity=".9"/>`
    : `<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="70" fill="#FFE9A8" opacity=".25"/><circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="36" fill="${ph === 'day' ? '#FFE27A' : '#FFC27A'}"/>`;
  if (!night){ for (let i = 0; i < 4; i++){ const cy = 50 + r() * 140, cx = r() * RW, w = 120 + r() * 140;
    sky += `<g class="cloud" style="animation-duration:${(140 + r() * 120).toFixed(0)}s;animation-delay:-${(r() * 200).toFixed(0)}s"><ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(w / 2).toFixed(0)}" ry="16" fill="#fff" opacity=".7"/><ellipse cx="${(cx - w / 6).toFixed(0)}" cy="${(cy - 12).toFixed(0)}" rx="${(w / 4).toFixed(0)}" ry="18" fill="#fff" opacity=".75"/><ellipse cx="${(cx + w / 7).toFixed(0)}" cy="${(cy - 8).toFixed(0)}" rx="${(w / 5).toFixed(0)}" ry="15" fill="#fff" opacity=".7"/></g>`; } }
  // горы и холмы: чем дальше, тем ближе к цвету неба
  const gDay = night ? '#22422E' : ph === 'day' ? '#5E9A4A' : '#4E7E45';
  const m1 = mix(s1, '#3C5A78', 0.35), m2 = mix(s1, gDay, 0.45), m3 = mix(s1, gDay, 0.7);
  let hills = '';
  if (L >= 30) hills += `<path fill="${mix(s1, '#2F4660', 0.22)}" d="M0 ${RG - 120} L120 ${RG - 190} L220 ${RG - 140} L360 ${RG - 230} L470 ${RG - 160} L600 ${RG - 210} L760 ${RG - 130} L900 ${RG - 220} L1040 ${RG - 150} L1180 ${RG - 240} L1300 ${RG - 170} L${RW} ${RG - 200} V${RG} H0Z"/>`;
  hills += `<path fill="${m1}" d="M0 ${RG - 70} L90 ${RG - 120} L190 ${RG - 80} L330 ${RG - 170} L420 ${RG - 110} L520 ${RG - 150} L660 ${RG - 80} L800 ${RG - 160} L930 ${RG - 95} L1080 ${RG - 175} L1200 ${RG - 100} L1310 ${RG - 140} L${RW} ${RG - 90} V${RG} H0Z"/>
    <path fill="#fff" opacity="${night ? .25 : .7}" d="M330 ${RG - 170} L300 ${RG - 150} L318 ${RG - 152} L330 ${RG - 142} L345 ${RG - 155} L362 ${RG - 150}Z M1080 ${RG - 175} L1052 ${RG - 156} L1068 ${RG - 157} L1080 ${RG - 148} L1094 ${RG - 160} L1110 ${RG - 154}Z"/>
    <rect class="mist" y="${RG - 70}" width="${RW}" height="60" fill="${s1}" opacity=".35"/>
    <path fill="${m2}" d="M0 ${RG - 30} C180 ${RG - 80} 320 ${RG - 20} 520 ${RG - 50} S880 ${RG - 90} 1060 ${RG - 40} S1300 ${RG - 60} ${RW} ${RG - 30} V${RG + 20} H0Z"/>
    <path fill="${m3}" d="M0 ${RG - 4} C220 ${RG - 36} 420 ${RG + 6} 640 ${RG - 16} S1060 ${RG - 30} ${RW} ${RG - 6} V${RH} H0Z"/>`;
  // кромка леса на дальнем холме густеет с каждым уровнем
  const rl = rnd(31337), tl = Math.min(c.level * 3, 240), tcol = mix(m3, night ? '#0E2016' : '#1F3B27', 0.45);
  let edge = '';
  for (let i = 0; i < tl; i++){ const x = rl() * RW, hh = 14 + rl() * 22, y = RG - 6 - Math.sin(x / RW * Math.PI * 3) * 8 + rl() * 6;
    edge += `<path d="M${x.toFixed(0)} ${(y - hh).toFixed(0)} l${(hh * 0.32).toFixed(1)} ${hh.toFixed(0)} h-${(hh * 0.64).toFixed(1)}Z"/>`; }
  hills += `<g fill="${tcol}" opacity=".9">${edge}</g>`;
  const g0 = night ? '#26472F' : mix(gDay, '#8DBF5E', 0.25), g1 = night ? '#152C1C' : mix(gDay, '#2F5E2A', 0.55);
  const water = mix('#3F7FB0', s1, night ? 0.15 : 0.3);
  let ground = `<rect y="${RG}" width="${RW}" height="${RH - RG}" fill="url(#rgr)"/>`;
  if (L >= 3) ground += `<path class="stream" d="M980 ${RG + 2} C940 ${RG + 40} 1010 ${RG + 70} 930 ${RG + 110} S760 ${RG + 170} 640 ${RG + 210} S330 ${RH - 20} 250 ${RH}" fill="none" stroke="${water}" stroke-width="16" stroke-linecap="round" opacity=".95"/>
    <path class="stream-glint" d="M980 ${RG + 2} C940 ${RG + 40} 1010 ${RG + 70} 930 ${RG + 110} S760 ${RG + 170} 640 ${RG + 210} S330 ${RH - 20} 250 ${RH}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="14 40" opacity=".45"/>`;
  if (L >= 5) ground += `<ellipse cx="1160" cy="${RG + 120}" rx="150" ry="30" fill="${water}"/><ellipse cx="1160" cy="${RG + 116}" rx="120" ry="18" fill="${s0}" opacity=".35"/><ellipse class="glint" cx="1130" cy="${RG + 118}" rx="40" ry="3" fill="#fff" opacity=".35"/>`;
  if (L >= 8){ ground += `<path d="M760 ${RH} C770 ${RH - 60} 860 ${RH - 90} 820 ${RG + 140} S700 ${RG + 70} 760 ${RG + 30}" fill="none" stroke="#B99B6B" stroke-width="22" stroke-linecap="round" opacity=".55"/>`;
    [[880, RH - 70], [905, RH - 58], [690, RG + 150], [1010, RH - 30]].forEach(([x, y]) => { ground += `<g transform="translate(${x} ${y})"><rect x="-2" y="-8" width="4" height="8" fill="#F1E6D0"/><path d="M-8 -7 Q0 -18 8 -7Z" fill="#C8402F"/><circle cx="-2" cy="-11" r="1.3" fill="#fff"/><circle cx="3" cy="-10" r="1" fill="#fff"/></g>`; }); }
  // цветы и трава: дни с делами
  const act = Object.values(c.days || {}).filter(d => d.result === 'good' || d.result === 'some').length;
  let flowers = '';
  const rf = rnd(4243);
  for (let i = 0; i < Math.min(act, 220); i++){
    const fx = 10 + rf() * (RW - 20), fy = RG + 24 + rf() * (RH - RG - 30), k = rf(), col = k < 0.25 ? '#FFFFFF' : k < 0.45 ? '#F5D547' : k < 0.65 ? '#E58FB4' : k < 0.8 ? '#9FB8F5' : '';
    flowers += col ? `<g class="fw" transform="translate(${fx.toFixed(0)} ${fy.toFixed(0)})"><path d="M0 0 v-9" stroke="#3F7A36" stroke-width="1.4"/><circle cy="-10" r="3.2" fill="${col}"/><circle cy="-10" r="1.2" fill="#E9B23B"/></g>`
      : `<path class="grass" d="M${fx.toFixed(0)} ${fy.toFixed(0)} l-3 -9 M${fx.toFixed(0)} ${fy.toFixed(0)} l0 -12 M${fx.toFixed(0)} ${fy.toFixed(0)} l4 -9"/>`;
  }
  // деревья
  const grown = Math.max(0, L - 1), shrink = grown > 40 ? Math.max(0.45, Math.sqrt(40 / grown)) : 1;
  const list = [];
  for (let i = 0; i < grown; i++){ const p = spot(i); list.push(Object.assign(p, {x: p.x / W * RW, y: ryAt(p.depth), i})); }
  if (L >= 52) list.push({kind: 'oak', x: 560, y: RH - 60, depth: 0.95, hue: 0.2, big: true});
  list.sort((a, b) => a.y - b.y);
  const when = levelDates(c), KN = {pine: 'сосна', spruce: 'ель', birch: 'берёза', oak: 'дуб', maple: 'клён', linden: 'липа'};
  const trees = list.map(p => { const sc = p.big ? 2.1 : (0.5 + p.depth * 0.95) * shrink, dt = p.big ? '' : when[p.i + 2];
    return `<g class="rt"><title>${p.big ? 'Вековой дуб: веха «Дубрава»' : `Дерево ${p.i + 1}, ${KN[p.kind] || 'дерево'}${dt ? `: выросло ${B.fmtS(dt)}` : ''}`}</title><ellipse cx="${p.x.toFixed(0)}" cy="${(p.y + 2).toFixed(0)}" rx="${(26 * sc).toFixed(1)}" ry="${(5 * sc).toFixed(1)}" fill="#000" opacity=".16"/>${tree(p.kind, p.x, p.y, sc, p.hue, p.depth < 0.3 ? 'dist' : '')}</g>`; }).join('');
  const f = Math.max(0, Math.min(1, c.frac || 0)), gy = RH - 18, nk = spot(grown).kind;
  const growing = f < 0.25 ? sprout(RW / 2, gy, 2 + f * 4) : tree(nk, RW / 2, gy, 0.6 + f * 1.1, 0.3, 'grow');
  // живность
  let life = '';
  if (L >= 2 && night){ const r2 = rnd(77); for (let i = 0; i < 28; i++) life += `<circle class="ff" cx="${(r2() * RW).toFixed(0)}" cy="${(RG + 20 + r2() * (RH - RG - 60)).toFixed(0)}" r="2.2" style="animation-delay:${(r2() * 5).toFixed(1)}s;animation-duration:${(3 + r2() * 4).toFixed(1)}s"/>`; }
  if (L >= 12 && !night){ const r3 = rnd(55); for (let i = 0; i < 5; i++){ const col = ['#F2B84B', '#E58FB4', '#FFFFFF', '#9FB8F5', '#F2B84B'][i]; life += `<g class="bf" style="animation-delay:-${(r3() * 10).toFixed(1)}s"><g transform="translate(${(200 + r3() * 1000).toFixed(0)} ${(RG + 60 + r3() * 160).toFixed(0)})"><path class="wing" d="M0 0 C-6 -8 -10 -2 -6 2Z M0 0 C6 -8 10 -2 6 2Z" fill="${col}"/></g></g>`; } }
  if (L >= 17 && ph !== 'night'){ for (let i = 0; i < 4; i++) life += `<g class="bird" style="animation-delay:-${i * 9}s;animation-duration:${38 + i * 6}s"><path d="M0 ${110 + i * 26} q8 -8 16 0 q8 -8 16 0" fill="none" stroke="${night ? '#C9D3E8' : '#2B3440'}" stroke-width="2" stroke-linecap="round"/></g>`; }
  if (L >= 100) life += `<g transform="translate(1250 ${RH - 90}) scale(1.4)" fill="#7A5232"><ellipse cx="0" cy="-20" rx="18" ry="9"/><rect x="-14" y="-14" width="3" height="16"/><rect x="10" y="-14" width="3" height="16"/><path d="M14 -24 l8 -14 l4 2 l-6 14Z"/><circle cx="23" cy="-38" r="5"/><path d="M22 -42 l-4 -10 M24 -42 l4 -10" stroke="#5A3A22" stroke-width="1.5"/></g>`;
  // лучи от солнца днём и на закате
  let rays = '';
  if (ph === 'sunset' || ph === 'dawn'){ for (let i = 0; i < 5; i++){ const a = -0.5 + i * 0.28, len = 900; const x2 = sx + Math.sin(a) * len, x3 = sx + Math.sin(a + 0.07) * len;
    rays += `<path class="ray" d="M${sx.toFixed(0)} ${sy.toFixed(0)} L${x2.toFixed(0)} ${(sy + len).toFixed(0)} L${x3.toFixed(0)} ${(sy + len).toFixed(0)}Z" style="animation-delay:-${i * 2}s"/>`; } }
  // передний край: густая трава и папоротники по углам, мягко качаются
  const rg = rnd(2024), gcol = night ? '#0F2416' : mix(g1, '#1D3B1E', 0.35);
  let blades = '';
  for (let i = 0; i < 170; i++){ const x = rg() * RW, hb = 14 + rg() * 26 + (x < 200 || x > RW - 200 ? 18 : 0), lean = (rg() - 0.5) * 14;
    blades += `<path d="M${x.toFixed(0)} ${RH + 2} q${(lean / 2).toFixed(1)} -${(hb / 2).toFixed(0)} ${lean.toFixed(1)} -${hb.toFixed(0)} q${(-lean / 4).toFixed(1)} ${(hb / 2).toFixed(0)} ${(3 - lean / 3).toFixed(1)} ${hb.toFixed(0)}Z"/>`; }
  const fern = (x, flip) => `<g transform="translate(${x} ${RH + 4}) scale(${flip ? -1 : 1} 1)">${[[-60, 1], [-35, 1.15], [-10, 1.25], [15, 1.1], [40, 0.95]].map(([ang, k]) => `<path transform="rotate(${ang}) scale(${k})" d="M0 0 C-6 -40 -4 -80 0 -110 C4 -80 6 -40 0 0Z M0 -20 l-14 -8 M0 -36 l-13 -9 M0 -52 l-11 -9 M0 -68 l-9 -8 M0 -84 l-6 -7 M0 -20 l14 -8 M0 -36 l13 -9 M0 -52 l11 -9 M0 -68 l9 -8 M0 -84 l6 -7" stroke="${gcol}" stroke-width="3" stroke-linecap="round"/>`).join('')}</g>`;
  const front = `<g class="front" fill="${gcol}">${blades}</g>${fern(40, false)}${fern(RW - 40, true)}`;
  // ночь затемняет землю и деревья, туман приходит, когда дел нет несколько дней
  const shade = night ? `<rect width="${RW}" height="${RH}" fill="#0A1330" opacity="${ph === 'night' ? .38 : .22}" style="mix-blend-mode:multiply"/>` : ph === 'sunset' || ph === 'dawn' ? `<rect width="${RW}" height="${RH}" fill="#F28C5E" opacity=".1"/>` : '';
  const fog = idle >= 2 ? `<rect class="fog" width="${RW}" height="${RH}" fill="url(#rfog)" opacity="${Math.min(0.85, 0.3 + idle * 0.1).toFixed(2)}"/>` : '';
  return {svg: `<svg class="scene rich" viewBox="0 0 ${RW} ${RH}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Лес: ${B.fmtTrees(grown)}, ${SKIES[ph][2].toLowerCase()}">
    <defs><linearGradient id="rsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s0}"/><stop offset="1" stop-color="${s1}"/></linearGradient>
      <linearGradient id="rgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g0}"/><stop offset="1" stop-color="${g1}"/></linearGradient>
      <linearGradient id="rfog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9CED3" stop-opacity=".2"/><stop offset=".55" stop-color="#C9CED3" stop-opacity=".95"/><stop offset="1" stop-color="#B7BEC4" stop-opacity=".9"/></linearGradient>
      <radialGradient id="rglow"><stop offset="0" stop-color="#FFF6C8" stop-opacity=".55"/><stop offset="1" stop-color="#FFF6C8" stop-opacity="0"/></radialGradient></defs>
    <rect width="${RW}" height="${RH}" fill="url(#rsky)"/>${sky}${hills}${ground}${flowers}${trees}
    <ellipse cx="${RW / 2}" cy="${gy - 40}" rx="${110 + f * 60}" ry="${110 + f * 60}" fill="url(#rglow)"/>
    <ellipse cx="${RW / 2}" cy="${gy + 3}" rx="${30 + f * 50}" ry="6" fill="#000" opacity=".18"/><g class="rt"><title>Растёт дерево ${L}-го уровня: ${Math.round(f * 100)}% пути до взрослого</title>${growing}</g>${rays}${front}${shade}${life}${fog}
  </svg>`, ph, idle};
}
function richBlock(c){
  const {svg, ph, idle} = richScene(c), {next} = B.mileFor(c.level);
  const toTree = c.need - c.into, soon = FEATS.filter(x => x[0] > c.level).slice(0, 3), open = FEATS.filter(x => x[0] <= c.level);
  return `<section class="rich-forest">
    <div class="rf-scene">${svg}
      <div class="rf-hud">
        <div class="rf-lvl"><b>${c.level}</b><span>уровень</span></div>
        <div class="rf-txt"><div class="rf-name">${c.trees ? B.fmtTrees(c.trees) : 'Поляна'} · ${SKIES[ph][2].toLowerCase()}</div>
          ${B.bar(c.frac, 'xp')}<div class="rf-sub">ещё ${B.num(Math.max(0, toTree))} XP, и дерево в центре станет взрослым${next ? ` · до вехи «${esc(next[1])}» ${next[0] - c.level} ${B.plural(next[0] - c.level, 'уровень', 'уровня', 'уровней')}` : ''}</div></div>
      </div>
      ${idle >= 2 ? `<div class="rf-fog">Лес затянуло туманом: ${idle} ${B.plural(idle, 'день', 'дня', 'дней')} без дел. Одно сделанное дело, и он рассеется.</div>` : ''}
    </div>
    <div class="rf-feats">${open.map(x => `<span class="on">✓ ${esc(x[1])}</span>`).join('')}${soon.map(x => `<span>${icon('lock')}<b>ур. ${x[0]}</b> ${esc(x[1])}</span>`).join('')}</div>
  </section>`;
}

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
      ${richBlock(c)}
      <div class="cols">
        <div class="col fr-small">
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
