/* Зов леса: фоновые шумы для фокуса. Всё генерируется в браузере (Web Audio), файлов нет.
   Белый, розовый и коричневый шум, дождь, океан, вентилятор. Громкость и «включать с таймером» помнятся. */
(function(){
const LS = 'bamboo-noise';
let S = {kind: 'brown', vol: 0.5, auto: true};
try { S = Object.assign(S, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };
B.NOISES = [['white', 'Белый'], ['pink', 'Розовый'], ['brown', 'Коричневый'], ['rain', 'Дождь'], ['ocean', 'Океан'], ['fan', 'Вентилятор']];

let ctx = null, master = null, nodes = [], timers = [], playing = null;
const bufs = {};
function ac(){
  if (!ctx){ ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
/* буфер шума на 6 секунд, зациклен; розовый по фильтру Пола Келлета, коричневый интегрированием */
function buffer(type){
  if (bufs[type]) return bufs[type];
  const n = ctx.sampleRate * 6, b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++){
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w * 0.35;
      else if (type === 'pink'){
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856;
        b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .09; b6 = w * .115926;
      } else { last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
    }
  }
  return bufs[type] = b;
}
function src(type){ const s = ctx.createBufferSource(); s.buffer = buffer(type); s.loop = true; s.start(); nodes.push(s); return s; }
function filt(type, f, q){ const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q) x.Q.value = q; nodes.push(x); return x; }
function gain(v){ const g = ctx.createGain(); g.gain.value = v; nodes.push(g); return g; }

function build(kind){
  if (kind === 'white'){ src('white').connect(filt('lowpass', 9000)).connect(gain(.8)).connect(master); }
  else if (kind === 'pink'){ src('pink').connect(gain(1)).connect(master); }
  else if (kind === 'brown'){ src('brown').connect(filt('lowpass', 2000)).connect(gain(1)).connect(master); }
  else if (kind === 'fan'){
    src('pink').connect(filt('lowpass', 650)).connect(gain(1.6)).connect(master);
    const o = ctx.createOscillator(); o.frequency.value = 96; o.start(); nodes.push(o); o.connect(gain(.025)).connect(master);
  } else if (kind === 'ocean'){
    const g = gain(.5); src('brown').connect(filt('lowpass', 900)).connect(g).connect(master);
    const l = ctx.createOscillator(); l.frequency.value = .085; l.start(); nodes.push(l);
    const d = gain(.45); l.connect(d).connect(g.gain);
    src('pink').connect(filt('highpass', 2500)).connect(gain(.06)).connect(master);
  } else if (kind === 'rain'){
    src('pink').connect(filt('highpass', 500)).connect(filt('lowpass', 7000)).connect(gain(.55)).connect(master);
    src('brown').connect(filt('lowpass', 300)).connect(gain(.35)).connect(master);
    // капли: короткие щелчки шума через полосовой фильтр в случайные моменты
    const drop = () => {
      if (!playing) return;
      const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = buffer('white');
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 4000; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12 + Math.random() * .25, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .05 + Math.random() * .06);
      s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 5, .15);
    };
    timers.push(setInterval(() => { for (let i = 0; i < 3; i++) if (Math.random() < .55) setTimeout(drop, Math.random() * 90); }, 90));
  }
}
function clear(){ timers.forEach(clearInterval); timers = []; nodes.forEach(n => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }); nodes = []; }

B.noise = {
  get state(){ return Object.assign({playing}, S); },
  play(kind){
    try { ac(); } catch (e) { return; }
    kind = kind || S.kind;
    if (playing === kind) return;
    clear(); playing = kind; S.kind = kind; save();
    build(kind);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(S.vol, ctx.currentTime, .4);
    B.emit('noise');
  },
  stop(){
    if (!playing || !ctx) return;
    playing = null;
    master.gain.setTargetAtTime(0, ctx.currentTime, .25);
    setTimeout(() => { if (!playing) clear(); }, 900);
    B.emit('noise');
  },
  vol(v){ S.vol = v; save(); if (ctx && playing) master.gain.setTargetAtTime(v, ctx.currentTime, .1); },
  auto(v){ S.auto = v; save(); }
};

/* блок управления в карточке таймера */
B.noiseUi = () => {
  const s = B.noise.state;
  return `<div class="noise">
    <div class="noise-row">${B.icon('sparkle')}<span>Фон</span>
      ${s.playing ? `<button class="btn sm" data-act="nzStop">${B.icon('pause')} Выключить</button>` : `<button class="btn sm" data-act="nzPlay">${B.icon('play')} Включить</button>`}
      <input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-in="nzVol" aria-label="Громкость" class="grow"></div>
    <div class="chips sm">${B.NOISES.map(([k, l]) => `<button class="chip ${s.kind === k ? 'on' : ''} ${s.playing === k ? 'live' : ''}" data-act="nzKind" data-k="${k}">${l}</button>`).join('')}</div>
    <label class="switch sm"><input type="checkbox" ${s.auto ? 'checked' : ''} data-in="nzAuto"><span></span>Включать вместе с таймером</label>
  </div>`;
};
B.acts.nzPlay = () => B.noise.play();
B.acts.nzStop = () => B.noise.stop();
B.acts.nzKind = el => { if (B.noise.state.playing) B.noise.play(el.dataset.k); else { S.kind = el.dataset.k; save(); B.noise.play(el.dataset.k); } };
B.inputs.nzVol = el => B.noise.vol(+el.value);
B.inputs.nzAuto = el => B.noise.auto(el.checked);
B.on('noise', () => { const box = document.querySelector('.noise'); if (box) box.outerHTML = B.noiseUi(); });
})();
