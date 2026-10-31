/* Режим бамбука: сам бамбук.
   Высота растёт с уровнем без ограничений: каждый уровень делает стебель в 1,42 раза выше, поэтому шкала логарифмическая.
   Одно коленце стебля = один уровень. Листья = прожитые дни: зелёный закрыт, сухой провал, голубой заморозка. */
(function(){
const {esc, icon} = B;
const PX = 120, LO = -1, PAD = 70;                        // пикселей на порядок, нижний порядок (0,1 м), отступ под землю
const HI = Math.log10(B.MILES[B.MILES.length - 1][0]) + 0.8;
const H = Math.round((HI - LO) * PX) + PAD;
const W = 360, X = 128;
const yOf = h => H - PAD - (Math.log10(Math.max(h, 0.1)) - LO) * PX;

function rnd(seed){ let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }

function scene(c){
  const top = yOf(c.height), ground = H - PAD;
  // небо: от земли к космосу (позиции стопов по высоте)
  const stop = h => ((yOf(h)) / H * 100).toFixed(2) + '%';
  const sky = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" class="s-deep"/><stop offset="${stop(1e9)}" class="s-space"/><stop offset="${stop(1e5)}" class="s-space"/>
    <stop offset="${stop(5e4)}" class="s-strato"/><stop offset="${stop(1.1e4)}" class="s-high"/><stop offset="${stop(800)}" class="s-sky"/><stop offset="${stop(1)}" class="s-low"/><stop offset="100%" class="s-low"/></linearGradient>`;
  const r = rnd(42); let stars = '';
  const starTop = yOf(1.2e5);
  for (let i = 0; i < 260; i++){ const y = r() * starTop, x = r() * W; stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r() * 1.2 + .3).toFixed(2)}" class="star" opacity="${(r() * .7 + .3).toFixed(2)}"/>`; }
  // коленца по уровням
  let stalk = '';
  for (let L = 1; L <= c.level; L++){
    const y1 = yOf(B.heightAt(L)), y0 = L === c.level ? top : yOf(B.heightAt(L + 1));
    const w = 9 + Math.min(5, L / 12);
    stalk += `<rect x="${X - w / 2}" y="${y0}" width="${w}" height="${Math.max(0, y1 - y0)}" rx="2" class="cul ${L % 2 ? 'a' : 'b'}"/>`;
    stalk += `<rect x="${X - w / 2 - 2}" y="${y1 - 2.5}" width="${w + 4}" height="5" rx="2.5" class="node"/>`;
  }
  const y1 = yOf(B.heightAt(1));
  stalk = `<rect x="${X - 4.5}" y="${y1}" width="9" height="${Math.max(0, ground - y1)}" rx="2" class="cul b"/>` + stalk;
  // листья по дням
  let leaves = '';
  const per = {};
  Object.keys(c.days).sort().forEach(d => {
    const x = c.days[d]; if (!['good', 'fail', 'frozen'].includes(x.result)) return;
    const lv = B.levelOf(x.total);
    const y = Math.max(top + 6, yOf(lv.height));
    const k = Math.round(y / 7);
    const n = per[k] = (per[k] || 0) + 1; if (n > 6) return;
    const side = n % 2 ? 1 : -1, len = 18 + (n % 3) * 5, yy = y + (n > 2 ? 3 : 0);
    const ang = 28 + n * 6;
    leaves += `<path class="leaf ${x.result}" d="M0 0 C ${len * .35} -6 ${len * .75} -5 ${len} 0 C ${len * .75} 5 ${len * .35} 6 0 0Z" transform="translate(${X + side * 5} ${yy}) rotate(${side > 0 ? -ang : 180 + ang})"><title>${B.fmtW(d)}: ${({good: 'день закрыт', fail: 'провал', frozen: 'заморозка'})[x.result]}</title></path>`;
  });
  // вехи
  let miles = '', lastT = 1e9;
  B.MILES.forEach(m => {
    const y = yOf(m[0]), ok = m[0] <= c.height;
    const ty = Math.min(y - 6, lastT - 13); lastT = ty;
    miles += `<g class="mile ${ok ? 'ok' : ''} ${m[0] > 2e4 ? 'hi' : ''}"><line x1="${X + 14}" x2="${W - 6}" y1="${y}" y2="${y}"/>
      <text x="${X + 20}" y="${ty}" class="mt">${ok ? '✓ ' : ''}${esc(m[1])}</text><text x="${W - 8}" y="${ty}" class="mh" text-anchor="end">${B.fmtH(m[0])}</text></g>`;
  });
  // шкала слева
  let axis = '';
  for (let k = 0; k <= HI; k += 3){ const y = yOf(Math.pow(10, k)); axis += `<text x="6" y="${y + 3}" class="ax ${k > 4 ? 'hi' : ''}">10<tspan dy="-5" font-size="8">${k}</tspan><tspan dy="5"> м</tspan></text>`; }
  return `<svg class="scene" viewBox="0 0 ${W} ${H}" width="100%" style="aspect-ratio:${W}/${H}" role="img" aria-label="Бамбук высотой ${B.fmtH(c.height)}">
    <defs>${sky}<radialGradient id="glow"><stop offset="0%" class="g0"/><stop offset="100%" class="g1"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars}
    <path d="M0 ${ground} Q ${W * .3} ${ground - 14} ${W * .55} ${ground - 4} T ${W} ${ground - 8} V ${H} H 0Z" class="hill"/>
    <rect x="0" y="${ground + 6}" width="${W}" height="${PAD}" class="soil"/>
    ${axis}${miles}${stalk}${leaves}
    <circle cx="${X}" cy="${top}" r="18" fill="url(#glow)"/>
    <path d="M${X} ${top - 14} C ${X + 6} ${top - 6} ${X + 6} ${top} ${X} ${top + 4} C ${X - 6} ${top} ${X - 6} ${top - 6} ${X} ${top - 14}Z" class="tip"/>
    <g class="here"><rect x="${X - 112}" y="${top - 13}" width="96" height="24" rx="12"/><text x="${X - 64}" y="${top + 3}" text-anchor="middle">${B.fmtH(c.height)}</text></g>
  </svg>`;
}

/* для «Итогов»: та же сцена на любой прошлый день */
B.bambooScene = scene;
B.bambooTopY = (h, svg) => yOf(h) * svg.getBoundingClientRect().height / H;

B.views.bamboo = {
  title: 'Бамбук',
  render(){
    const c = B.calc(), {prev, next} = B.mileFor(c.height);
    const lp = prev && next ? (Math.log(c.height) - Math.log(prev[0])) / (Math.log(next[0]) - Math.log(prev[0])) : 1;
    let x7 = 0, n7 = 0; for (let i = 1; i <= 7; i++){ const d = c.days[B.add(c.today, -i)]; if (d){ x7 += d.xp; n7++; } }
    const avg = n7 ? x7 / n7 : 0;
    const eta = next && avg > 0 ? Math.ceil((B.xpForHeight(next[0]) - c.total) / avg) : null;
    return `<div class="page bamboo-page">
      <header class="page-h"><div><div class="eyebrow">Бамбук</div><h1>${B.fmtH(c.height)}</h1></div></header>
      <div class="cols">
        <div class="col">
          <section class="card scene-card"><div class="scene-wrap" id="sceneWrap">${scene(c)}</div></section>
        </div>
        <div class="col">
          ${B.levelCard(c, true)}
          ${next ? `<section class="card next-mile">
            <div class="eyebrow">Следующая веха</div>
            <h2>${esc(next[1])}</h2><p class="muted">${esc(next[2])}</p>
            ${B.bar(lp, 'xp')}
            <div class="row between"><span class="muted">${prev ? '✓ ' + esc(prev[1]) : ''}</span><span class="mono">ещё ${B.fmtH(next[0] - c.height)}</span></div>
            <p class="hint">${eta != null ? `При темпе последней недели (${Math.round(avg)} XP в день) дорастёшь примерно за ${eta} ${B.plural(eta, 'день', 'дня', 'дней')}.` : 'Темп появится после первых закрытых дней.'}</p>
          </section>` : `<section class="card"><h2>Дальше карты нет</h2><p class="muted">Бамбук выше наблюдаемой Вселенной. Дальше только ты.</p></section>`}
          <section class="card"><div class="kpis">
            <div class="kpi"><b>${c.goods}</b><span>дней закрыто</span></div>
            <div class="kpi"><b>${c.fails}</b><span>сухих листьев</span></div>
            <div class="kpi"><b>${c.best}</b><span>лучшая серия</span></div>
            <div class="kpi"><b>${B.num(c.xpAll)}</b><span>XP заработано</span></div>
          </div>
          <a class="btn sm ghost" href="#/stats">${icon('chart')} Как рос бамбук и итоги</a>
          <p class="hint">Заморозка этой недели ${c.freezeLeft ? 'ещё есть: один провал простится' : 'уже потрачена: следующий провал со штрафом'}.</p></section>
          <section class="card rules"><h2>${icon('leaf')}Как растёт бамбук</h2>
            <ul class="plain xp">
              <li><span>Утренний план</span><b>+${B.XP.plan}</b></li>
              <li><span>Каждое главное дело</span><b>+${B.XP.top}</b></li>
              <li><span>Задача (важная +${B.XP.taskP1})</span><b>+${B.XP.task}</b></li>
              <li><span>Шаг большого дела</span><b>+${B.XP.sub}</b></li>
              <li><span>Фокус, за каждые 25 минут</span><b>+${B.XP.pomo}</b></li>
              <li><span>Привычка (минимум вдвое меньше)</span><b>+${B.XP.habit}</b></li>
              <li><span>Чтение, за 3 минуты (до ${B.XP.readMax})</span><b>+1</b></li>
              <li><span>Тренировка</span><b>+${B.XP.sport}</b></li>
              <li><span>Стадия веба ШАДа</span><b>+${B.XP.shad}</b></li>
              <li><span>Вечерний разбор с планом на завтра</span><b>+${B.XP.review}</b></li>
              <li><span>Мысль в дневнике (до трёх)</span><b>+${B.XP.note}</b></li>
              <li><span>Закрытый день: 5 × серия</span><b>до +50</b></li>
              <li class="neg"><span>Перенос задачи</span><b>${B.XP.postpone}</b></li>
              <li class="neg"><span>Незакрытый день, серия с нуля</span><b>${B.XP.fail}</b></li>
            </ul>
            <p class="hint">Каждый уровень делает бамбук в ${B.num(B.GROW, 2)} раза выше. Уровень может и упасть, если дни проваливаются подряд.</p>
          </section>
        </div>
      </div>
    </div>`;
  },
  mount(){
    const w = B.$('#sceneWrap'); if (!w) return;
    const svg = w.querySelector('svg'), c = B.calc();
    requestAnimationFrame(() => {
      const scale = svg.getBoundingClientRect().height / H;
      w.scrollTop = Math.max(0, yOf(c.height) * scale - w.clientHeight * 0.45);
    });
  }
};
})();
