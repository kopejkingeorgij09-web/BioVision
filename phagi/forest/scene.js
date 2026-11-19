window.PhagiForest = (() => {
  'use strict';

  const LEAF = '<path d="M20 4c-8 0-14 4-14 10a5 5 0 0 0 5 5c6 0 10-6 9-15ZM4 21c3-5 7-9 12-12"/>';
  const TREES = '<path d="m7 3 5 8H9l4 6H2l4-6H3l4-8Zm0 14v4m11-16 4 7h-2l3 5h-8m3 0v4"/>';
  const PETRI = '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01m7 5h.01M9 16h.01m7-8h.01"/>';
  const icon = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const POINTS_PER_PLANT = 8;
  const spots = [
    [34,78], [67,78], [51,69], [19,65], [46,88], [82,67],
    [24,87], [69,62], [15,76], [75,88], [43,64], [60,91],
    [89,78], [41,77], [55,83], [59,65], [31,67], [79,73],
    [13,88], [48,61], [66,86], [34,92], [54,74], [83,87],
    [24,72], [89,70], [53,93], [72,72], [31,82], [92,88]
  ];
  const PLANT_ORDER = ['spruce','pine','birch','spruce','flowers','pine','oak','spruce',
    'pine','rowan','spruce','flowers','pine','birch','oak','pine'];
  const PLANTS = {
    spruce: { name: 'Ель', size: 1.05 },
    pine: { name: 'Сосна', size: 1.17 },
    birch: { name: 'Берёза', size: 1 },
    oak: { name: 'Дуб', size: .83 },
    rowan: { name: 'Рябина', size: .69 },
    flowers: { name: 'Лесные цветы', size: .29 }
  };
  const GROVE_POINTS = spots.length * POINTS_PER_PLANT;
  const glades = points => Math.max(1, Math.ceil(points / GROVE_POINTS));
  const number = new Intl.NumberFormat('ru-RU');
  const format = n => number.format(n);
  const plural = new Intl.PluralRules('ru-RU');
  const pointWord = n => ({ one:'балл', few:'балла', many:'баллов' })[plural.select(n)] || 'балла';
  const art = type => `forest/art/${type}.webp`;

  function controls(mode) {
    return `<div class="forest-modes" role="group" aria-label="Режим мотивации">
      <button id="motivation-bacteria" type="button" data-act="motivation" data-mode="bacteria" aria-pressed="${mode==='bacteria'}">${icon(PETRI)}Бактерии</button>
      <button id="motivation-forest" type="button" data-act="motivation" data-mode="forest" aria-pressed="${mode==='forest'}">${icon(TREES)}Лес</button>
    </div>`;
  }

  function render(progress, selected = 0, compact = false) {
    const { points, ready } = progress;
    const unlocked = glades(points);
    const glade = selected ? Math.min(selected, unlocked) : unlocked;
    const score = Math.max(0, Math.min(GROVE_POINTS, points - (glade-1)*GROVE_POINTS));
    const count = Math.ceil(score / POINTS_PER_PLANT);
    const population = Object.fromEntries(Object.keys(PLANTS).map(type => [type, 0]));
    const plants = spots.slice(0, count).map(([x, y], i) => {
      const type = PLANT_ORDER[i % PLANT_ORDER.length];
      population[type]++;
      const growth = i === count-1 ? .56 + .44 * ((score-1)%POINTS_PER_PLANT+1) / POINTS_PER_PLANT : 1;
      const variation = 1 + (((i*13)%7)-3)*.035;
      const size = ((y-60)*.64+17) * PLANTS[type].size * growth * variation;
      return { x: glade%2 ? x : 100-x, y, size, type, newest: i === count-1 };
    }).sort((a, b) => a.y-b.y);
    const layer = plants.map(({ x, y, size, type, newest }) => `
      <span class="forest-plant${newest?' forest-plant-new':''}" style="--x:${x}%;--y:${y}%;--size:${size.toFixed(2)}%">
        <img src="${art(type)}" alt="" decoding="async">
      </span>`).join('');
    const stage = count < 3 ? 'Тихая поляна' : count < 10 ? 'Молодая роща' : 'Смешанный лес';
    const title = compact ? '<h2>Мой лес</h2>' : '<h1>Мой лес</h1>';
    const scene = `<section class="forest-scene${compact?' forest-scene-compact':''}" aria-label="Мой лес">
      <div class="forest-landscape" aria-hidden="true">
        <img class="forest-backdrop" src="${art('glade')}" alt="">
        ${layer}
        <i class="forest-pollen"></i><i class="forest-pollen"></i><i class="forest-pollen"></i>
      </div>
      <div class="forest-scene-top">
        <div>${title}<p>${stage}</p></div>
        <div class="forest-score">${icon(LEAF)}<b>${ready ? format(points) : '…'}</b><span>${ready ? pointWord(points) : 'баллы'}</span></div>
      </div>
      ${compact ? '<button class="forest-scene-link" type="button" data-act="go" data-v="forest">Открыть лес <span aria-hidden="true">→</span></button>' : ''}
    </section>`;
    if (compact) return scene;
    const remaining = count*POINTS_PER_PLANT-score+1;
    const hint = !ready ? 'Загружаем прогресс…' : score === 0 ? 'Пройди карточку, чтобы посадить первую ель.'
      : count === spots.length ? 'До новой поляны' : 'До следующего растения';
    const left = count === spots.length ? GROVE_POINTS-score+1 : remaining;
    const progressLabel = ready && score > 0 ? `<strong>${left} ${pointWord(left)}</strong>` : '';
    const pagination = unlocked > 1 ? `<div class="forest-glades" role="group" aria-label="Поляны">
      <button type="button" data-act="forestglade" data-glade="${glade-1}" aria-label="Предыдущая поляна"${glade===1?' disabled':''}>←</button>
      <span>Поляна ${format(glade)} из ${format(unlocked)}</span>
      <button type="button" data-act="forestglade" data-glade="${glade+1}" aria-label="Следующая поляна"${glade===unlocked?' disabled':''}>→</button>
    </div>` : '';
    const species = count ? `<section class="forest-collection">
      <h2>Растёт на поляне</h2>
      <ul>${Object.entries(population).filter(([, n]) => n).map(([type, n]) =>
        `<li><img src="${art(type)}" alt="" loading="lazy"><span>${PLANTS[type].name}</span><b>${n}</b></li>`
      ).join('')}</ul>
    </section>` : '';
    return scene+`<div class="forest-growth">
      <p>${hint} ${progressLabel}</p>${pagination}
    </div>${species}`+`<section class="forest-rules">
      <div><b>+${PhagiForestProgress.HOMEWORK_POINTS}</b><span>За отправленную домашку<small>Один раз за задание</small></span></div>
      <div><b>+${PhagiForestProgress.CARD_POINTS}</b><span>За пройденную карточку<small>Один раз в день за карточку</small></span></div>
    </section>
    <div class="forest-links">
      <button class="btn" type="button" data-act="go" data-v="cards">К карточкам</button>
      <button class="btn ghost" type="button" data-act="go" data-v="tasks">К заданиям</button>
    </div>`;
  }

  function corner(progress) {
    const root = document.getElementById('forest-corner');
    const active = progress?.mode === 'forest';
    root.hidden = !active;
    if (!active) return;
    const value = progress.ready ? format(progress.points) : '…';
    const button = root.querySelector('button');
    const total = button.querySelector('b');
    if (total.textContent !== value) {
      total.textContent = value;
      button.setAttribute('aria-label', `Мой лес, баллы ${value}`);
    }
  }

  let noticeTimer;
  function reward(points, origin) {
    const root = document.getElementById('forest-corner');
    const target = root.querySelector('button');
    const notice = root.querySelector('[role="status"]');
    const end = target.getBoundingClientRect();
    if (root.hidden || !end.width) return;
    const targetX = end.left+end.width/2;
    const targetY = end.top+end.height/2;
    const say = () => {
      notice.textContent = `+${points} · лес тебя не забудет!`;
      notice.classList.add('forest-notice-visible');
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        notice.classList.remove('forest-notice-visible');
        notice.textContent = '';
      }, 2650);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !target.animate) {
      say();
      return;
    }
    const x = Math.max(42, Math.min(innerWidth-42, origin ? origin.left+origin.width/2 : innerWidth*.5));
    const y = Math.max(50, Math.min(innerHeight-55, origin ? origin.top+origin.height/2 : innerHeight*.57));
    const dx = targetX-x, dy = targetY-y;
    const token = document.createElement('span');
    token.className = 'forest-flight';
    token.setAttribute('aria-hidden', 'true');
    token.innerHTML = `${icon(LEAF)}<b>+${points}</b>`;
    token.style.left = x+'px';
    token.style.top = y+'px';
    document.body.append(token);
    const a = token.animate([
      { transform: 'translate(-50%,-50%) scale(.65)', opacity: 0 },
      { transform: 'translate(-50%,-50%) translateY(-19px) scale(1.1)', opacity: 1, offset: .23 },
      { transform: `translate(-50%,-50%) translate(${dx*.56}px,${dy*.48-45}px) scale(.9)`, opacity: 1, offset: .58 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.23)`, opacity: .18 }
    ], { duration: 720, easing: 'cubic-bezier(.18,.66,.36,1)', fill: 'both' });
    a.onfinish = () => {
      token.remove();
      if (root.hidden) return;
      target.animate([{ transform:'scale(1)' }, { transform:'scale(1.1)' }, { transform:'scale(1)' }], { duration:270 });
      say();
    };
  }

  return { TREES, controls, render, corner, reward, glades };
})();
