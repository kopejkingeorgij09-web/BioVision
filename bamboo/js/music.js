/* Зов леса: музыка в разделе «Лес».
   Классика в свободных записях с Викисклада (общественное достояние или свободные лицензии),
   файлы не лежат в репозитории, браузер берёт их прямо с upload.wikimedia.org.
   Сначала пробуем MP3, который Викисклад делает из исходника (его играют все браузеры), потом сам исходник.
   Плеер живёт вне страницы, поэтому музыка не обрывается при переходе в другой раздел. */
(function(){
const {esc, icon} = B;
// [произведение, композитор, файл на Викискладе]
const TRACKS = [
  ['Лунный свет', 'Дебюсси', 'Clair_de_lune_(Claude_Debussy)_Suite_bergamasque.ogg'],
  ['Лунная соната, I часть', 'Бетховен', 'Beethoven_Moonlight_1st_movement.ogg'],
  ['Симфония «Из Нового света», Largo', 'Дворжак', "Antonin_Dvorak_-_symphony_no._9_in_e_minor_'from_the_new_world',_op._95_-_ii._largo.ogg"],
  ['Концерт № 2 для фортепиано, I часть', 'Рахманинов', 'Sergei_Rachmaninoff_-_piano_concerto_no._2_in_c_minor,_op._18_-_i._moderato.ogg'],
  ['Влтава', 'Сметана', "Bedrich_Smetana_-_ma_vlast_-_i._vltava_'the_moldau'.ogg"],
  ['Ноктюрн до-диез минор', 'Шопен', 'Chopin,_Nocturne_in_C-sharp_minor,_Op._Posth.ogg'],
  ['Лебединое озеро, сцена из I акта', 'Чайковский', 'Peter_Ilyich_Tchaikovsky-_Swan_Lake-_Extract_from_Act_1.ogg'],
  ['Гимнопедия № 1', 'Сати', 'Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg'],
  ['Утро, из «Пер Гюнта»', 'Григ', 'Musopen_-_Morning.ogg'],
  ['Богатырские ворота', 'Мусоргский', 'Modest_Mussorgsky_-_pictures_at_an_exhibition_-_x._la_grande_porte_de_kiev_-_allegro_alla_breve._maestoso._con_grandezza.ogg'],
  ['Зима, I часть', 'Вивальди', 'Vivaldi_Winter_mvt_1_Allegro_non_molto_-_The_USAF_Concert.ogg'],
  ['Ноктюрн ми-бемоль мажор', 'Шопен', 'Frederic_Chopin_-_Nocturne_Eb_major_Opus_9,_number_2.ogg'],
  ['Марс, вестник войны', 'Холст', 'Gustav_Holst_-_the_planets,_op._32_-_i._mars,_the_bringer_of_war.ogg'],
  ['Патетическая симфония, I часть', 'Чайковский', "Tchaikovsky,_Symphony_No._6_In_B_Minor,_Op._74,_'Pathetique'_-_I._Adagio,_Allegro_Non_Troppo.ogg"],
];
/* свои песни: файлы с устройства хранятся в IndexedDB этого браузера в исходном виде,
   в репозиторий и в облако не уходят. В списке они идут первыми: [название, исполнитель, null, blob-адрес, id] */
const OWN = [];
const idb = () => new Promise((ok, no) => { const r = indexedDB.open('zov-music', 1); r.onupgradeneeded = () => r.result.createObjectStore('t', {keyPath: 'id'}); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const tx = async (mode, fn) => { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction('t', mode), r = fn(t.objectStore('t')); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
const all = () => OWN.concat(TRACKS);
const KEY = 'zov-music-i';
const enc = f => encodeURIComponent(f).replace(/'/g, '%27').replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/* путь на upload.wikimedia.org: первые знаки md5 от имени файла */
function md5(s){
  const b = unescape(encodeURIComponent(s)), n = b.length, w = [];
  for (let i = 0; i < n; i++) w[i >> 2] |= b.charCodeAt(i) << (i % 4 * 8);
  w[n >> 2] |= 0x80 << (n % 4 * 8); w[(((n + 8) >> 6) + 1) * 16 - 2] = n * 8;
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], K = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  for (let o = 0; o < w.length; o += 16){
    let A = a0, B_ = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++){
      let F, g;
      if (i < 16){ F = (B_ & C) | (~B_ & D); g = i; }
      else if (i < 32){ F = (D & B_) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48){ F = B_ ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B_ | ~D); g = (7 * i) % 16; }
      const t = D; D = C; C = B_;
      const x = (A + F + K[i] + (w[o + g] | 0)) | 0, r = S[(i >> 4) * 4 + i % 4];
      B_ = (B_ + ((x << r) | (x >>> (32 - r)))) | 0; A = t;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B_) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  return [a0, b0, c0, d0].map(v => { let h = ''; for (let i = 0; i < 4; i++) h += ((v >>> (i * 8)) & 255).toString(16).padStart(2, '0'); return h; }).join('');
}
const srcs = f => {
  const h = md5(f), p = `${h[0]}/${h.slice(0, 2)}/${enc(f)}`, base = 'https://upload.wikimedia.org/wikipedia/commons/';
  return [`${base}transcoded/${p}/${enc(f)}.mp3`, base + p];
};
const srcsOf = t => t[3] ? [t[3]] : srcs(t[2]);
const page = f => 'https://commons.wikimedia.org/wiki/File:' + enc(f);

let au = null, idx = -1, alt = 0, fails = 0, fade = null, broke = false, seeking = false;
const mmss = x => { x = Math.max(0, Math.floor(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
const dur = () => au && isFinite(au.duration) ? au.duration : 0;
const get = () => { try { const r = localStorage.getItem(KEY), v = r == null ? -1 : +r; return v >= 0 && v < all().length ? v : -1; } catch { return -1; } };
const put = v => { try { localStorage.setItem(KEY, String(v)); } catch {} };
const playing = () => !!au && !au.paused;

function fadeTo(v, ms, done){
  clearInterval(fade); const from = au.volume, t0 = Date.now();
  fade = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / ms); au.volume = from + (v - from) * k; if (k >= 1){ clearInterval(fade); done && done(); } }, 50);
}
function load(i){
  const L = all(); idx = (i + L.length) % L.length; alt = 0; put(idx);
  au.src = srcsOf(L[idx])[0]; au.volume = 0;
  au.play().then(() => fadeTo(1, 2500)).catch(() => {});
  sync();
}
function ensure(){
  if (au) return;
  au = new Audio(); au.preload = 'auto';
  au.addEventListener('ended', () => { fails = 0; load(idx + 1); });
  au.addEventListener('playing', () => { fails = 0; broke = false; sync(); });
  au.addEventListener('pause', sync);
  au.addEventListener('timeupdate', tick);
  au.addEventListener('loadedmetadata', tick);
  au.addEventListener('error', () => {
    const s = srcsOf(all()[idx]);
    if (alt + 1 < s.length){ alt++; au.src = s[alt]; au.play().then(() => fadeTo(1, 2500)).catch(() => {}); return; }
    if (++fails >= all().length){ broke = true; fails = 0; sync(); return; }   // сети нет или Викисклад недоступен
    load(idx + 1);
  });
  if ('mediaSession' in navigator){
    navigator.mediaSession.setActionHandler('nexttrack', () => B.acts.musNext());
    navigator.mediaSession.setActionHandler('previoustrack', () => B.acts.musPrev());
    try { navigator.mediaSession.setActionHandler('seekto', d => { if (d.seekTime != null) au.currentTime = d.seekTime; }); } catch {}
  }
}
function sync(){
  const t = all()[idx];
  if (t && 'mediaSession' in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({title: t[0], artist: t[1], album: 'Зов леса'});
  B.$$('.rf-music').forEach(el => { el.outerHTML = pill(); });
}
/* полоска перемотки обновляется на месте, без перерисовки всего плеера */
function tick(){
  if (seeking || !au) return;
  const d = dur(), c = au.currentTime || 0;
  B.$$('.rf-music .rf-seek').forEach(el => {
    const r = el.querySelector('input'); if (!r) return;
    r.max = Math.max(1, Math.floor(d)); r.value = Math.floor(c); r.style.setProperty('--p', d ? (c / d * 100).toFixed(2) + '%' : '0%');
    el.querySelector('.rf-t0').textContent = mmss(c); el.querySelector('.rf-t1').textContent = d ? mmss(d) : '–:––';
  });
}
function seekRow(){
  const d = dur(), c = au ? au.currentTime || 0 : 0;
  return `<div class="rf-seek"><span class="rf-t0">${mmss(c)}</span><input type="range" min="0" max="${Math.max(1, Math.floor(d))}" step="1" value="${Math.floor(c)}" style="--p:${d ? (c / d * 100).toFixed(2) : 0}%" data-in="musSeek" aria-label="Перемотка"><span class="rf-t1">${d ? mmss(d) : '–:––'}</span></div>`;
}
const addBtn = () => `<label class="rf-mb sm rf-add" title="Добавить свои песни с устройства" aria-label="Добавить свои песни">${icon('plus')}<input type="file" accept="audio/*" multiple hidden data-in="musAdd"></label>`;
function addRow(t){
  return `<div class="rf-own">${addBtn()}<span>${OWN.length ? `своих песен ${OWN.length}` : 'добавить свои песни'}</span>${t[3] ? `<button class="rf-del" data-act="musDel" aria-label="Убрать эту песню из плеера">убрать эту</button>` : ''}</div>`;
}
function pill(){
  const t = all()[idx], on = playing();
  if (broke) return `<div class="rf-music"><button class="rf-mb" data-act="musToggle" aria-label="Попробовать снова">${icon('music', 'mi')}</button><span class="rf-mt"><b>Музыка не загрузилась</b><span>нужен интернет, нажми ещё раз</span></span></div>`;
  if (!t) return `<div class="rf-music idle">${addBtn()}<button class="rf-mb" data-act="musToggle" aria-label="Включить музыку">${icon('music', 'mi')}</button><span class="rf-mt"><b>Музыка леса</b><span>классика до мурашек</span></span></div>`;
  return `<div class="rf-music full ${on ? 'on' : ''}"><div class="rf-row"><button class="rf-mb sm prev" data-act="musPrev" aria-label="Назад: с начала или предыдущая">${icon('skip')}</button><button class="rf-mb" data-act="musToggle" aria-label="${on ? 'Пауза' : 'Играть'}">${icon(on ? 'pause' : 'play')}</button>
    ${t[3] ? `<span class="rf-mt"><b>${esc(t[0])}</b><span>${esc(t[1] || 'своя песня')}</span></span>` : `<a class="rf-mt" href="${page(t[2])}" target="_blank" rel="noopener" title="Запись на Викискладе: исполнитель и лицензия"><b>${esc(t[0])}</b><span>${esc(t[1])}</span></a>`}
    <button class="rf-mb sm" data-act="musNext" aria-label="Следующая">${icon('skip')}</button></div>${seekRow()}${addRow(t)}</div>`;
}
B.music = {pill};
/* название и исполнитель из тегов ID3v2 (TIT2, TPE1), иначе из имени файла */
async function tags(f){
  const name = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
  let title = name, artist = '';
  try {
    const b = new Uint8Array(await f.slice(0, 256 * 1024).arrayBuffer());
    if (b[0] === 73 && b[1] === 68 && b[2] === 51){
      const v = b[3], size = (b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9];
      let p = 10; const end = Math.min(b.length, 10 + size);
      while (p + 10 < end){
        const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
        const n = v === 4 ? (b[p + 4] << 21) | (b[p + 5] << 14) | (b[p + 6] << 7) | b[p + 7] : (b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7];
        if (!/^[A-Z0-9]{4}$/.test(id) || n <= 0) break;
        if (id === 'TIT2' || id === 'TPE1'){
          const e = b[p + 10], d = b.subarray(p + 11, p + 10 + n);
          const txt = new TextDecoder(e === 1 ? 'utf-16' : e === 2 ? 'utf-16be' : e === 3 ? 'utf-8' : 'windows-1251').decode(d).replace(/\0/g, ' ').replace(/\s*[\[(][^\])]*\.(me|ru|com|net|org|cc|fm|su|biz|info)\b[^\])]*[\])]/gi, '').trim();
          if (txt){ if (id === 'TIT2') title = txt; else artist = txt; }
        }
        p += 10 + n;
      }
    }
  } catch {}
  return {title, artist};
}
async function loadOwn(){
  try {
    const rows = await tx('readonly', st => st.getAll());
    OWN.length = 0;
    (rows || []).sort((a, b) => a.at - b.at).forEach(r => OWN.push([r.title, r.artist, null, URL.createObjectURL(r.blob), r.id]));
    sync();
  } catch {}
}
B.inputs.musAdd = async (el, e) => {
  if (e.type !== 'change' || !el.files.length) return;
  const files = [...el.files]; let n = 0;
  B.toast('Добавляю…', 1200);
  for (const f of files){
    const m = await tags(f), id = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try { await tx('readwrite', st => st.put({id, title: m.title, artist: m.artist, blob: f, at: Date.now() + n})); n++; } catch {}
  }
  const was = idx >= 0 ? all()[idx] : null;
  await loadOwn();
  if (was) idx = all().findIndex(t => t[2] === was[2] && t[4] === was[4]);
  B.toast(n ? `Добавлено песен: ${n}. Они хранятся только в этом браузере` : 'Не вышло сохранить: мало места в браузере', 2600);
  if (n && !playing()){ ensure(); load(0); }
};
B.acts.musDel = async () => {
  const t = all()[idx]; if (!t || !t[3]) return;
  try { await tx('readwrite', st => st.delete(t[4])); } catch {}
  URL.revokeObjectURL(t[3]); OWN.splice(OWN.indexOf(t), 1);
  const go = playing(); ensure(); if (go) load(idx); else { idx = Math.min(idx, all().length - 1); sync(); }
  B.toast('Песня убрана из плеера', 1400);
};
if (window.indexedDB) loadOwn();
B.acts.musPrev = () => {
  ensure(); if (idx < 0) return B.acts.musToggle();
  if (au.currentTime > 3){ au.currentTime = 0; tick(); return; }
  if (playing()) fadeTo(0, 300, () => load(idx - 1)); else load(idx - 1);
};
B.inputs.musSeek = (el, e) => {
  if (!au) return;
  const d = dur(), v = +el.value;
  el.style.setProperty('--p', d ? (v / d * 100).toFixed(2) + '%' : '0%');
  const t0 = el.parentNode.querySelector('.rf-t0'); if (t0) t0.textContent = mmss(v);
  if (e.type === 'input'){ seeking = true; return; }
  seeking = false; if (d) au.currentTime = v;
};
B.acts.musToggle = () => {
  ensure();
  if (broke){ broke = false; load(idx < 0 ? 0 : idx); return; }
  if (idx < 0){ const last = get(); load(last < 0 ? (OWN.length ? 0 : Math.floor(Math.random() * TRACKS.length)) : last); return; }
  if (playing()) fadeTo(0, 600, () => au.pause());
  else { au.volume = 0; au.play().then(() => fadeTo(1, 1500)).catch(() => {}); }
};
B.acts.musNext = () => { ensure(); if (playing()) fadeTo(0, 400, () => load(idx + 1)); else load(idx + 1); };
})();
