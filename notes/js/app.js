import { edit, list, read } from './local.js';
import { attachmentBlob, cloudEnabled, identity, libraryId, signIn, signInByCode, signOut, synchronize } from './cloud.js';
import { createSurface } from './ink.js';
import { boardFilesWithPositions, boardFileWidth, describeFile, mountBoardFile, openMedia, pdfResources } from './media.js';
import { button, element, textEditor } from './text.js';
import { cloudConfig } from './config.js';
import { createPenButton, defaultPenButton } from './pen-button.js';
import { rebase } from './merge.js';

const $ = id => document.getElementById(id);
const kinds = {
  folder: ['▤', 'Папка', 'Папка для конспектов'],
  pages: ['▧', 'Тетрадь', 'Страницы с вертикальной прокруткой'],
  board: ['⊞', 'Доска', 'Бесконечное поле для схем'],
  text: ['¶', 'Текстовый конспект', 'Набор с клавиатуры, формулы и ссылки'],
};
const layouts = { grid: 'Клетка', dots: 'Точка', lines: 'Линейка', blank: 'Чистый лист' };
const tools = { pen: 'Перо', highlight: 'Маркер', erase: 'Ластик', lasso: 'Лассо', text: 'Текст', hand: 'Рука', line: 'Линия', rect: 'Прямоугольник', ellipse: 'Эллипс' };
const blank = () => ({ id: crypto.randomUUID(), strokes: [], texts: [] });
const preferenceKey = 'biovision-notes-pen';
const themes = { system: 'Как в системе', white: 'Белая', gray: 'Серая', warm: 'Тёплая белая', violet: 'Тёмно-фиолетовая', green: 'Тёмно-зелёная', black: 'Чёрная' };
const appVersion = { name: '0.3.0', code: 3 };
const releaseBase = cloudConfig.url + '/storage/v1/object/public/notes-releases/';
const darkMode = matchMedia('(prefers-color-scheme: dark)');
const existingPrefs = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}');
const accountLabel = () => identity()?.app_metadata?.notes_access_code ? 'Аккаунт по коду' : identity()?.email ?? 'Войти';
const prefs = {
  tool: 'pen', color: matchMedia('(prefers-color-scheme: dark)').matches ? '#eee9ff' : '#28223c',
  width: 3, textPt: 12, finger: false, theme: 'system',
  autoColor: !existingPrefs.color || ['#28223c', '#eee9ff'].includes(existingPrefs.color),
  ...existingPrefs,
};
let scope = libraryId();
let items = [];
let current;
let folder = null;
let attachmentId = null;
let boardFileId = null;
let focusBoardFile = false;
let moreInkTools = false;
let editor = new AbortController();
let writes = Promise.resolve();
let syncTimer;
let syncing = false;
let messageTimer;
let back = [], forward = [];
let selectedStrokes = [];
let recognizedText;
let shapeSelection;
const failedWrites = new Map();
const failedWrite = () => failedWrites.size > 0;
let pendingWrites = 0;
let staleView = false;
const activePointers = new Set();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('polya-notes') : null;
let surfaces = [];
let selectedText;
let documentText;
const notebookZoom = new Map();
window.addEventListener('notes-db-outdated', () => {
  message('«Поля» обновились в другой вкладке. Перезагрузи эту вкладку, чтобы продолжить работу.');
});

const buttonSettings = () => ({ ...defaultPenButton, ...prefs.penButton });
let toolBeforeToggle;
const penButton = createPenButton({
  settings: buttonSettings,
  enabled: () => Boolean(current && surfaces.length && !$('dialog').open),
  changed: updateToolButtons,
  activate(action) {
    if (action === 'undo' || action === 'redo') { history(action === 'redo'); return; }
    if (action === 'newText') { addTextBlock(); return; }
    if (!tools[action] || action === 'hand' && !current?.data.pages?.length) return;
    if (prefs.tool === action) {
      chooseTool(toolBeforeToggle?.action === action ? toolBeforeToggle.previous : 'pen');
      toolBeforeToggle = undefined;
    } else {
      toolBeforeToggle = { action, previous: prefs.tool };
      chooseTool(action);
    }
  },
});

function chooseTool(tool) {
  prefs.tool = tool;
  remember();
  updateToolButtons();
}

function updateToolButtons() {
  const held = penButton.held();
  const effective = held === 'none' ? prefs.tool : held;
  for (const control of document.querySelectorAll('[data-ink-tool]')) {
    control.setAttribute('aria-pressed', String(control.dataset.inkTool === effective));
  }
  const status = $('pen-button-status');
  if (status) status.textContent = penButton.isPressed() ? 'Кнопка удерживается' : 'Кнопка отпущена';
}

window.notesPenButton = (down, contact, canceled, time) => penButton.input(down, contact, canceled, time);

function sideTool(event, first) {
  if (event.pointerType !== 'pen') return prefs.tool;
  if (event.button === 5 || event.buttons & 32) return 'erase';
  const native = window.NotesAndroid?.penButtonPressed;
  const held = first && native ? window.NotesAndroid.penButtonPressed() : penButton.held() !== 'none';
  if (held || (event.buttons & 2) || event.button === 2) {
    const tool = buttonSettings().hold;
    if (tool !== 'none') return tool;
  }
  return prefs.tool;
}

function message(text) {
  $('message').textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { $('message').textContent = ''; }, 6500);
}

function report(error) { message(error.message ?? String(error)); }

function choose(title, populate) {
  const dialog = $('dialog');
  if (dialog.open) dialog.close();
  dialog.replaceChildren(element('h2', title));
  populate(dialog, () => dialog.close());
  dialog.showModal();
}

function labelled(label, input) {
  const field = element('label');
  field.append(element('span', label), input);
  return field;
}

function select(choices, value, label) {
  const control = element('select');
  for (const [id, title] of Object.entries(choices)) control.append(new Option(title, id));
  control.value = value;
  control.setAttribute('aria-label', label);
  return control;
}

function applyTheme() {
  document.documentElement.dataset.theme = prefs.theme === 'system' ? (darkMode.matches ? 'violet' : 'white') : prefs.theme;
  if (prefs.autoColor) prefs.color = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  if ($('pen-color')) $('pen-color').value = prefs.color;
}
function remember() {
  localStorage.setItem(preferenceKey, JSON.stringify(prefs));
  $('content').classList.toggle('finger', prefs.finger);
  const focus = Boolean(current && prefs.focusMode);
  $('app').classList.toggle('focus-mode', focus);
  $('focus-mode').setAttribute('aria-pressed', String(focus));
  $('focus-mode').setAttribute('aria-label', focus ? 'Вернуть библиотеку' : 'Во весь экран');
  $('focus-mode').title = focus ? 'Вернуть библиотеку' : 'Во весь экран';
}

function numberControl(id, title, value, min, max, step, change) {
  const field = element('input');
  field.type = 'number';
  field.id = id;
  field.min = min;
  field.max = max;
  field.step = step;
  field.value = value;
  field.setAttribute('aria-label', title);
  field.onchange = () => {
    const number = field.valueAsNumber;
    const next = Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : Number(value);
    change(next);
    field.value = next;
  };
  const label = labelled(title, field);
  label.className = 'tool-number';
  return label;
}

function addTextBlock() {
  const host = $('content').getBoundingClientRect();
  const visibleSurface = surfaces.map(surface => {
    const rect = surface.host.getBoundingClientRect();
    return { surface, size: Math.max(0, Math.min(rect.bottom, host.bottom) - Math.max(rect.top, host.top)) };
  }).sort((a, b) => b.size - a.size)[0];
  if (!visibleSurface) return;
  const rect = visibleSurface.surface.host.getBoundingClientRect();
  const top = Math.max(rect.top, host.top);
  const bottom = Math.min(rect.bottom, host.bottom);
  visibleSurface.surface.addTextNear(rect.left + Math.min(rect.width * .18, 115), top + Math.min((bottom - top) * .28, 140));
}

function setTextSize(pt) {
  pt = Math.min(96, Math.max(6, pt));
  if (selectedText) selectedText.edit({ pt });
  else if (documentText) documentText(pt);
  else { prefs.textPt = pt; remember(); }
  if ($('text-pt')) $('text-pt').value = pt;
}

function textControls(bar, pt, withWidth) {
  bar.append(numberControl('text-pt', 'Текст, pt', pt, 6, 96, 1, setTextSize));
  if (withWidth) {
    const width = numberControl('text-width', 'Ширина поля', 250, 48, 2200, 1, value => {
      selectedText?.edit({ width: value });
      queueMicrotask(() => { if ($('text-width') && selectedText) $('text-width').value = selectedText.width; });
    });
    width.querySelector('input').disabled = true;
    bar.append(width);
  }
}

function schedule(delay = 1200) {
  clearTimeout(syncTimer);
  if (identity() && navigator.onLine) syncTimer = setTimeout(runSync, delay);
}

function writeStatus() {
  if (failedWrite()) {
    $('sync').textContent = 'Не сохранено на устройстве: ' + failedWrites.size;
    return;
  }
  $('sync').textContent = identity() ? 'Сохранено локально' : 'Сохранено на устройстве';
}

function queue(work, id) {
  const pending = writes.catch(() => {}).then(work);
  writes = pending;
  pendingWrites += 1;
  if (!failedWrite()) $('sync').textContent = 'Сохраняется на устройстве…';
  pending.then(() => {
    // Каждая запись — полный снимок заметки, поэтому успешная запись той же заметки закрывает прошлую ошибку.
    failedWrites.delete(id);
    writeStatus();
    schedule();
  }, error => {
    failedWrites.set(id, error);
    writeStatus();
    void storageWarning(error);
  }).finally(() => { pendingWrites -= 1; });
  return pending;
}

async function storageWarning(error) {
  let detail = '';
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (quota) detail = ' Занято ' + Math.round(usage / 1048576) + ' из ' + Math.round(quota / 1048576) + ' МБ.';
  } catch {}
  const full = error?.name === 'QuotaExceededError' || /quota/i.test(error?.message ?? '');
  message((full ? 'На устройстве закончилось место для заметок.' : 'Не удалось сохранить на устройстве: ' + (error?.message ?? error) + '.')
    + detail + ' Не закрывай приложение, пока статус не станет «Сохранено».');
}

const busy = () => activePointers.size > 0 || Boolean(document.activeElement?.closest?.('#content') && document.activeElement.matches('textarea, input'));

// Экран должен показывать ровно current: правки строятся от него. Поэтому чужие изменения
// подставляются вместе с перерисовкой, когда человек не пишет и не набирает текст.
function refreshWhenIdle() {
  staleView = true;
  if (busy()) return;
  staleView = false;
  void (async () => {
    await writes.catch(() => {});
    if (!current || busy()) { staleView = Boolean(current); return; }
    const fresh = await read('items', scope, current.id);
    if (!fresh || fresh.operation === current.operation) return;
    const index = items.findIndex(entry => entry.id === fresh.id);
    if (index >= 0) items[index] = fresh; else items.push(fresh);
    if (fresh.deleted) { open(fresh.data.parent); return; }
    const scrollTop = $('content').scrollTop;
    current = fresh; back = []; forward = [];
    render();
    $('content').scrollTop = scrollTop;
  })().catch(report);
}

// Снимок заметки отделён от объектов, которые правит экран. Штрихи после завершения не меняются,
// поэтому их копии общие для всех снимков: шаг отмены стоит ссылок, а не полной копии заметки.
const strokeCopies = new WeakMap();
function snapshotOf(value) {
  if (Array.isArray(value)) return value.map(snapshotOf);
  if (!value || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value instanceof Blob ? value : structuredClone(value);
  const stroke = Array.isArray(value.points) && typeof value.id === 'string';
  if (stroke && strokeCopies.has(value)) return strokeCopies.get(value);
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = snapshotOf(value[key]);
  if (stroke) { strokeCopies.set(value, copy); strokeCopies.set(copy, copy); }
  return copy;
}

// Большая заметка пишется в IndexedDB сотни миллисекунд: это блокирует поток, где рисуется перо.
// Поэтому запись ждёт паузы (перо поднято и 300 мс тишины, но не дольше 2 с), а несколько правок
// подряд сливаются в одну запись. Базой слитой записи остаётся версия до первой из них.
const unsaved = new Map();
const idleWaiters = new Set();
let lastChange = 0;
let flushNow = false;
function writeWhenIdle() {
  const started = Date.now();
  return new Promise(resolve => {
    const done = () => { idleWaiters.delete(done); resolve(); };
    idleWaiters.add(done);
    (function check() {
      if (!idleWaiters.has(done)) return;
      if (flushNow || (!activePointers.size && (Date.now() - started > 2000 || Date.now() - lastChange >= 300))) done();
      else setTimeout(check, 100);
    })();
  });
}
function flushWrites() {
  flushNow = true;
  for (const done of [...idleWaiters]) done();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushWrites(); else flushNow = false;
});
window.addEventListener('pagehide', flushWrites);

function save(data, { deleted = false, file, item = current } = {}) {
  const owner = scope;
  const urgent = Boolean(file) || deleted || current?.id !== item.id;
  const snapshot = snapshotOf(data);
  const operation = crypto.randomUUID();
  const modified = lastChange = Date.now();
  const local = { ...item, data: snapshot, deleted, modified, operation, pending: owner !== 'local' };
  if (current?.id === local.id) current = local;
  const index = items.findIndex(entry => entry.id === local.id);
  if (index < 0) items.push(local);
  else items[index] = local;
  const previous = unsaved.get(item.id);
  const replaces = previous && previous.local === item && !previous.file && previous.owner === owner;
  const entry = { owner, local, file, base: replaces ? previous.base : item };
  if (replaces) previous.superseded = entry;
  unsaved.set(item.id, entry);
  let merged = false;
  const base = entry.base;
  const written = queue(async () => {
    if (entry.superseded) return;
    if (!urgent) await writeWhenIdle();
    if (entry.superseded) return;
    if (unsaved.get(item.id) === entry) unsaved.delete(item.id);
    return edit(owner, item.id, existing => {
      // Сверка версии: запись на устройстве должна быть той, от которой построена правка.
      // Иначе её успели изменить другая вкладка или облако, и мы сливаем, а не затираем.
      const result = rebase(existing, base, local);
      merged = result.merged;
      return result.record;
    }, file, { operation: base.operation, revision: base.revision, record: { ...local, revision: base.revision } });
  }, item.id).then(next => {
    if (entry.superseded) return entry.superseded.promise;
    channel?.postMessage({ library: owner, id: item.id, operation: next?.operation });
    if (merged && owner === scope) {
      const at = items.findIndex(entry => entry.id === next.id);
      if (at >= 0 && items[at].operation === local.operation) items[at] = next;
      if (current?.id === next.id) refreshWhenIdle();
    }
    return next;
  });
  entry.promise = written;
  return written;
}

function mutate(data, history = true, file) {
  if (!current) return;
  if (history) { back.push(current.data); if (back.length > 100) back.shift(); forward = []; }
  save(data, { file });
  updateUndo();
}

function history(redo = false) {
  const [source, target] = redo ? [forward, back] : [back, forward];
  if (!current || !source.length) return;
  target.push(current.data);
  const field = document.activeElement;
  const id = field?.dataset.textId;
  const textDocument = field?.matches('.text-note textarea');
  const cursor = field?.selectionStart;
  const scrollTop = $('content').scrollTop;
  save(source.pop());
  render();
  $('content').scrollTop = scrollTop;
  const focused = id ? $('content').querySelector('[data-text-id="' + id + '"]')
    : textDocument ? $('content').querySelector('.text-note textarea') : null;
  if (focused) { focused.focus(); focused.setSelectionRange(cursor, cursor); }
}

function updateUndo() {
  if ($('undo')) $('undo').disabled = !back.length;
  if ($('redo')) $('redo').disabled = !forward.length;
}

function visible() { return items.filter(item => !item.deleted); }

function renderLibrary() {
  const nav = $('tree');
  nav.replaceChildren();
  const term = $('query').value.trim().toLocaleLowerCase('ru');
  const records = visible().sort((a, b) => {
    const fa = a.data.kind === 'folder', fb = b.data.kind === 'folder';
    return fa === fb ? a.data.title.localeCompare(b.data.title, 'ru') : fa ? -1 : 1;
  });
  const parents = new Set(records.filter(item => item.data.kind === 'folder').map(item => item.id));
  function row(item, depth) {
    const line = element('div', undefined, 'tree-row');
    line.style.paddingLeft = Math.min(depth, 6) * 12 + 'px';
    const link = button(kinds[item.data.kind][0] + '  ' + item.data.title, () => open(item.id));
    link.title = item.data.title;
    if (current?.id === item.id || folder === item.id && !current) link.setAttribute('aria-current', 'true');
    line.append(link);
    nav.append(line);
  }
  if (term) {
    for (const item of records.filter(item => [item.data.title, item.data.body ?? ''].some(value => value.toLocaleLowerCase('ru').includes(term)))) row(item, 0);
  } else {
    const seen = new Set();
    function branch(parent, depth) {
      for (const item of records) {
        if (seen.has(item.id)) continue;
        const actual = parents.has(item.data.parent) ? item.data.parent : null;
        if (actual !== parent) continue;
        seen.add(item.id);
        row(item, depth);
        if (item.data.kind === 'folder') branch(item.id, depth + 1);
      }
    }
    branch(null, 0);
    for (const item of records) if (!seen.has(item.id)) row(item, 0);
  }
  if (!nav.childElementCount) nav.append(element('p', term ? 'Ничего не найдено' : 'Библиотека пуста', 'muted'));
}

let pdfOffline;
// PDF.js лежит в vendor/pdfjs. Кладём в кеш все его файлы, включая шрифты, CMap и wasm,
// иначе часть PDF откроется онлайн, но не офлайн.
function preparePdfOffline() {
  if (!('caches' in window) || window.NotesAndroid || window.NotesMac) return Promise.resolve();
  pdfOffline ??= (async () => {
    const manifest = await (await fetch(pdfResources + 'files.json')).json();
    const cache = await caches.open('biovision-notes-pdfjs-' + manifest.version);
    const missing = [];
    for (const path of manifest.files) if (!await cache.match(pdfResources + path)) missing.push(pdfResources + path);
    for (let index = 0; index < missing.length; index += 12) await cache.addAll(missing.slice(index, index + 12));
  })().catch(error => { pdfOffline = null; throw error; });
  return pdfOffline;
}

async function preload(item, owner) {
  if (navigator.onLine && (item.data.attachments ?? []).some(file => file.mime === 'application/pdf')) {
    preparePdfOffline().catch(() => message('Просмотр PDF офлайн ещё не подготовлен'));
  }
  if (!identity() || !navigator.onLine) return;
  for (const file of item.data.attachments ?? []) {
    if (owner !== scope) return;
    try {
      await attachmentBlob(owner, file.id);
    } catch (error) {
      if (!await read('files', owner, file.id)) message('Не удалось сохранить для офлайн: ' + file.name);
    }
  }
}

function open(id, { replace = false } = {}) {
  const item = items.find(entry => entry.id === id && !entry.deleted);
  if (id && !item) { message('Заметка не найдена на этом устройстве'); return; }
  if (item?.data.kind === 'folder') { folder = item.id; current = null; }
  else { current = item; folder = item?.data.parent ?? null; }
  attachmentId = boardFileId = null;
  focusBoardFile = false;
  back = [];
  forward = [];
  const hash = item ? '#note=' + item.id : location.pathname + location.search;
  if (replace) window.history.replaceState(null, '', hash);
  else if (hash !== location.hash) window.history.pushState(null, '', hash);
  $('app').classList.remove('library-open');
  render();
  if (item) void preload(item, scope);
}

async function create(kind, title, paper) {
  const item = { id: crypto.randomUUID(), library: scope, revision: 0 };
  const data = { kind, title, parent: folder, paper };
  if (kind === 'pages' || kind === 'board') data.pages = [blank()];
  if (kind === 'text') data.body = '';
  if (kind !== 'folder') data.attachments = [];
  await save(data, { item });
  open(item.id);
  if (kind === 'text') $('content').querySelector('textarea')?.focus();
}

function createDialog(defaultKind = 'pages') {
  choose('Новая заметка или папка', (dialog, close) => {
    const form = element('form');
    const kind = select(Object.fromEntries(Object.entries(kinds).map(([key, value]) => [key, value[1]])), defaultKind, 'Тип');
    const title = element('input');
    title.placeholder = 'Название';
    title.maxLength = 150;
    title.required = true;
    const paper = select(layouts, 'dots', 'Разметка');
    const pattern = labelled('Разметка', paper);
    const toggle = () => { pattern.hidden = kind.value === 'folder' || kind.value === 'text'; };
    kind.addEventListener('change', toggle);
    toggle();
    const actions = element('div', undefined, 'dialog-actions');
    const submit = element('button', 'Создать', 'primary');
    submit.type = 'submit';
    actions.append(button('Отмена', close), submit);
    form.append(labelled('Тип', kind), labelled('Название', title), pattern, actions);
    form.onsubmit = async event => {
      event.preventDefault();
      if (!title.value.trim()) return;
      submit.disabled = true;
      try { await create(kind.value, title.value.trim(), paper.value); close(); }
      catch (error) { report(error); submit.disabled = false; }
    };
    dialog.append(form);
    title.focus();
  });
}

function welcome() {
  const section = element('section', undefined, 'welcome');
  const currentFolder = items.find(item => item.id === folder && !item.deleted);
  section.append(element('h1', currentFolder?.data.title ?? 'Мои заметки'));
  section.append(element('p', currentFolder ? 'Открой заметку в библиотеке или создай новую в этой папке.' : 'Тетради для рукописи, доски для схем и конспекты для клавиатуры.'));
  const cards = element('div', undefined, 'cards');
  for (const [kind, [icon, label, description]] of Object.entries(kinds)) {
    const card = button('', () => createDialog(kind));
    card.append(element('strong', icon + '  ' + label), element('span', description, 'muted'));
    cards.append(card);
  }
  section.append(cards);
  if (currentFolder) {
    section.append(button('← ' + (currentFolder.data.parent ? 'На уровень выше' : 'Все заметки'), () => open(currentFolder.data.parent)));
    section.append(button('Действия с папкой', () => more(currentFolder)));
  }
  $('content').append(section);
}

function fileBar() {
  const bar = element('div', undefined, 'attachments');
  for (const item of current.data.attachments ?? []) {
    const control = button(item.name, () => { attachmentId = item.id; render(); });
    control.setAttribute('aria-pressed', String(item.id === attachmentId));
    bar.append(control);
  }
  return bar;
}

function insertLink(editor) {
  choose('Ссылка на заметку', (dialog, close) => {
    const controls = element('div', undefined, 'dialog-actions');
    const choices = Object.fromEntries(visible().filter(item => item.id !== current.id && item.data.kind !== 'folder').map(item => [item.id, item.data.title]));
    const target = select(choices, Object.keys(choices)[0], 'Заметка');
    if (!Object.keys(choices).length) dialog.append(element('p', 'Создай ещё одну заметку, чтобы вставить ссылку.'));
    else {
      dialog.append(target);
      controls.append(button('Вставить', () => {
        close();
        editor.insert('[[' + target.value + '|' + choices[target.value].replace(/[\]|\n]/g, ' ') + ']]');
      }, 'primary'));
    }
    controls.append(button('Закрыть', close));
    dialog.append(controls);
  });
}

function recognition() {
  choose('Распознать рукопись', (dialog, close) => {
    const info = element('p', 'Выбери язык рукописи. При первом запуске на Android понадобится скачать языковую модель.');
    const lang = select({ ru: 'Русский', en: 'English' }, 'ru', 'Язык');
    const field = element('input');
    field.placeholder = 'Распознанный текст';
    const result = recognizedText;
    const run = button('Распознать', () => {
      if (!window.NotesAndroid?.recognize) { info.textContent = 'Распознавание доступно в Android-приложении.'; return; }
      run.disabled = true;
      window.notesInkResult = (text, error) => {
        run.disabled = false;
        if (error) info.textContent = error;
        else field.value = text;
      };
      window.NotesAndroid.recognize(JSON.stringify(selectedStrokes.map(stroke => stroke.points)), lang.value);
    });
    dialog.append(info, lang, run, field, button('Вставить', () => {
      if (field.value.trim()) { result?.(field.value.trim()); close(); }
    }, 'primary'), button('Закрыть', close));
  });
}

function inkControls(board, surface, withLayout) {
  const bar = $('tools'), extra = $('extra-tools');
  if (!board && prefs.tool === 'hand') prefs.tool = 'pen';
  for (const key of ['pen', 'erase', 'highlight', 'lasso', 'text', 'hand', 'line', 'rect', 'ellipse']) {
    const label = tools[key];
    if (key === 'hand' && !board) continue;
    const control = button(label, () => {
      toolBeforeToggle = undefined;
      chooseTool(key);
    });
    control.dataset.inkTool = key;
    bar.append(control);
  }
  const color = element('input');
  color.type = 'color';
  color.id = 'pen-color';
  color.value = prefs.color;
  color.setAttribute('aria-label', 'Цвет пера');
  color.onchange = () => { prefs.color = color.value; prefs.autoColor = false; remember(); };
  const width = numberControl('pen-width', 'Толщина пера', prefs.width, .5, 36, .1, value => { prefs.width = value; remember(); });
  const finger = button('Рисовать пальцем', () => {
    prefs.finger = !prefs.finger;
    finger.setAttribute('aria-pressed', String(prefs.finger));
    remember();
  });
  finger.hidden = board;
  finger.setAttribute('aria-pressed', String(prefs.finger));
  const recognize = button('Распознать', recognition);
  recognize.id = 'recognize';
  recognize.disabled = true;
  const straighten = button('Выровнять фигуру', () => shapeSelection?.());
  straighten.id = 'straighten';
  straighten.disabled = true;
  extra.append(color, width, finger, recognize, straighten);
  textControls(extra, prefs.textPt, true);
  const advanced = button('Дополнительно', () => {
    moreInkTools = !moreInkTools;
    extra.hidden = !moreInkTools;
    advanced.setAttribute('aria-expanded', String(moreInkTools));
  });
  advanced.setAttribute('aria-expanded', String(moreInkTools));
  extra.hidden = !moreInkTools;
  bar.append(advanced);
  if (withLayout) {
    const paper = select(layouts, current.data.paper, 'Разметка');
    paper.onchange = () => {
      mutate({ ...current.data, paper: paper.value });
      for (const node of $('content').querySelectorAll('.page,.board')) {
        node.classList.remove(...Object.keys(layouts));
        node.classList.add(paper.value);
      }
    };
    extra.append(paper, numberControl('grid-size', 'Шаг разметки', current.data.gridSize ?? 24, 8, 100, 1, value => {
      mutate({ ...current.data, gridSize: value });
      $('content').style.setProperty('--grid-size', value + 'px');
    }));
  }
  updateToolButtons();
  if (board) bar.append(button('−', () => surface.zoom(.8)), button('＋', () => surface.zoom(1.25)), button('Уместить', surface.fit));
}

function commonSurface() {
  return {
    settings: () => prefs, signal: editor.signal,
    sideTool,
    penContact: () => penButton.use(),
    notifyText(text) {
      selectedText = text;
      $('text-pt').value = text.pt;
      $('text-width').disabled = false;
      $('text-width').value = text.width;
    },
    notifySelection(strokes, insert, reshape) {
      selectedStrokes = strokes;
      recognizedText = insert;
      shapeSelection = reshape;
      if ($('recognize')) $('recognize').disabled = !strokes.length;
      if ($('straighten')) $('straighten').disabled = !strokes.length;
    },
  };
}

function notebookViewport(root, pages, id, signal) {
  let scale = notebookZoom.get(id) ?? 1;
  const apply = () => {
    const base = Math.max(120, Math.min(794, root.clientWidth - 30));
    pages.style.setProperty('--sheet-width', base * scale + 'px');
  };
  function setScale(value, x, y) {
    const viewport = root.getBoundingClientRect();
    x ??= viewport.left + viewport.width / 2;
    y ??= viewport.top + viewport.height / 2;
    const target = Array.from(pages.querySelectorAll('.page')).reduce((best, page) => {
      const rect = page.getBoundingClientRect();
      const distance = Math.max(rect.top - y, y - rect.bottom, 0);
      return !best || distance < best.distance ? { page, rect, distance } : best;
    }, null);
    scale = Math.min(3, Math.max(.4, value));
    notebookZoom.set(id, scale);
    apply();
    if (target) {
      const next = target.page.getBoundingClientRect();
      root.scrollLeft += next.left + (x - target.rect.left) * next.width / target.rect.width - x;
      root.scrollTop += next.top + (y - target.rect.top) * next.height / target.rect.height - y;
    }
    update();
  }
  const zoomOut = button('−', () => setScale(scale / 1.2));
  const zoomIn = button('＋', () => setScale(scale * 1.2));
  const fit = button('По ширине', () => setScale(1));
  zoomOut.setAttribute('aria-label', 'Уменьшить масштаб листа');
  zoomIn.setAttribute('aria-label', 'Увеличить масштаб листа');
  fit.setAttribute('aria-label', 'Масштаб по ширине');
  function update() {
    fit.textContent = scale === 1 ? 'По ширине' : Math.round(scale * 100) + '% · По ширине';
    zoomOut.disabled = scale <= .4;
    zoomIn.disabled = scale >= 3;
  }
  const resize = new ResizeObserver(apply);
  resize.observe(root);
  signal.addEventListener('abort', () => resize.disconnect(), { once: true });
  root.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setScale(scale * Math.exp(-event.deltaY * .008), event.clientX, event.clientY);
  }, { passive: false, signal });
  apply();
  update();
  return { controls: [zoomOut, zoomIn, fit], pinch: (factor, x, y) => setScale(scale * factor, x, y) };
}

// Длинная тетрадь: листы далеко от экрана не держат SVG и поля ввода, только место под себя.
const lazyPages = 8;
function lazyPage(paper, mount, notebook) {
  notebook.pageObserver ??= new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.lazyToggle?.(entry.isIntersecting);
  }, { root: $('content'), rootMargin: '150% 0px' });
  let page;
  paper.lazyToggle = visible => {
    if (visible && !page) {
      const controller = new AbortController();
      editor.signal.addEventListener('abort', () => controller.abort(), { once: true, signal: controller.signal });
      page = { controller, surface: mount(controller.signal) };
      surfaces.push(page.surface);
    } else if (!visible && page && !paper.contains(document.activeElement) && !activePointers.size) {
      page.controller.abort();
      surfaces = surfaces.filter(item => item !== page.surface);
      paper.replaceChildren();
      page = null;
    }
  };
  notebook.pageObserver.observe(paper);
  editor.signal.addEventListener('abort', () => notebook.pageObserver.disconnect(), { once: true });
}

function render() {
  const previousBoard = surfaces.find(surface => surface.host.dataset.note === current?.id);
  editor.abort();
  editor = new AbortController();
  selectedStrokes = [];
  recognizedText = null;
  shapeSelection = null;
  selectedText = documentText = undefined;
  surfaces = [];
  const root = $('content'), bar = $('tools'), extra = $('extra-tools');
  root.replaceChildren();
  bar.replaceChildren();
  extra.replaceChildren();
  extra.hidden = true;
  bar.hidden = !current;
  root.scrollTop = 0;
  root.style.setProperty('--grid-size', (current?.data.gridSize ?? 24) + 'px');
  $('title').hidden = !current;
  $('heading').hidden = Boolean(current);
  $('heading').textContent = items.find(item => item.id === folder)?.data.title ?? 'Все заметки';
  $('more').hidden = !current;
  $('focus-mode').hidden = !current;
  renderLibrary();
  remember();
  if (!current) { welcome(); return; }
  $('title').value = current.data.title;
  const attachment = current.data.kind === 'board' ? null : current.data.attachments?.find(item => item.id === attachmentId);
  const files = fileBar();
  if (files.childElementCount && (current.data.kind !== 'board' || attachment)) root.append(files);
  const undo = button('↶', () => history());
  const redo = button('↷', () => history(true));
  undo.id = 'undo'; redo.id = 'redo';
  undo.setAttribute('aria-label', 'Отменить');
  redo.setAttribute('aria-label', 'Повторить');
  if (attachment) {
    inkControls(false, null, false);
    void openMedia(root, structuredClone(attachment), {
      library: scope, signal: editor.signal, surfaceOptions: commonSurface(), message,
      close() { attachmentId = null; render(); },
      onSurface(surface) { surfaces = [surface]; selectedText = undefined; $('text-width').disabled = true; },
      onMark(updated, history) {
        mutate({ ...current.data, attachments: current.data.attachments.map(file => file.id === updated.id ? updated : file) }, history);
      },
    });
  } else if (current.data.kind === 'text') {
    let lastEdit = 0;
    const field = textEditor(current.data.body, body => {
      const now = Date.now();
      mutate({ ...current.data, body }, now - lastEdit > 900);
      lastEdit = now;
    }, open);
    function updateSize(pt) { field.root.style.setProperty('--note-font', pt + 'pt'); }
    documentText = pt => {
      mutate({ ...current.data, textPt: pt });
      updateSize(pt);
    };
    const pt = current.data.textPt ?? 12;
    updateSize(pt);
    root.append(field.root);
    textControls(bar, pt, false);
    const fence = String.fromCharCode(96).repeat(3);
    const preview = button('Просмотр', () => {
      preview.textContent = field.toggle() ? 'Редактировать' : 'Просмотр';
    });
    bar.append(preview, button('Заголовок', () => field.insert('# ', '', 'Заголовок')),
      button('Список', () => field.insert('- ', '', 'Пункт')),
      button('Формула', () => field.insert('$', '$', 'x^2')),
      button('Код', () => field.insert(fence + '\n', '\n' + fence, 'код')),
      button('Таблица', () => field.insert('\n| Столбец 1 | Столбец 2 |\n| --- | --- |\n| Значение | Значение |\n')),
      button('Ссылка', () => insertLink(field)));
  } else {
    const board = current.data.kind === 'board';
    const pages = board ? root : element('div', undefined, 'pages');
    if (!board) root.append(pages);
    const notebook = board ? null : notebookViewport(root, pages, current.id, editor.signal);
    let surface;
    for (const [index, data] of current.data.pages.entries()) {
      const paper = element('div', undefined, 'paper ' + (board ? 'board ' : 'page ') + current.data.paper);
      const wrap = board ? pages : element('section', undefined, 'page-wrap');
      if (!board) {
        const label = element('div', 'Страница ' + (index + 1), 'page-label');
        if (current.data.pages.length > 1) label.append(button('Удалить', () => {
          if (!confirm('Удалить страницу ' + (index + 1) + '?')) return;
          mutate({ ...current.data, pages: current.data.pages.filter(page => page.id !== data.id) });
          render();
        }));
        wrap.append(label);
        pages.append(wrap);
      }
      wrap.append(paper);
      const worldLayers = board ? [element('div', undefined, 'board-world'), element('div', undefined, 'board-world board-world-controls')] : undefined;
      if (worldLayers) {
        paper.dataset.note = current.id;
        paper.append(...worldLayers);
      }
      const mount = signal => createSurface(paper, structuredClone(current.data.pages.find(page => page.id === data.id) ?? data), {
        ...commonSurface(), board, width: 794, worldLayers, signal,
        initialView: previousBoard?.view(),
        pinch: notebook?.pinch,
        commit(next, history) {
          mutate({ ...current.data, pages: current.data.pages.map(page => page.id === data.id ? next : page) }, history);
        },
      });
      if (board || current.data.pages.length <= lazyPages) {
        surface = mount(editor.signal);
        surfaces.push(surface);
      } else lazyPage(paper, mount, notebook);
      if (worldLayers) {
        const boardFiles = boardFilesWithPositions(current.data.attachments ?? []);
        const nav = element('nav', undefined, 'board-file-nav');
        nav.setAttribute('aria-label', 'Файлы на доске');
        for (const file of boardFiles) {
          void mountBoardFile(...worldLayers, structuredClone(file), {
            signal: editor.signal, library: scope, host: paper, surfaceOptions: commonSurface(),
            onMark(updated, history) {
              mutate({ ...current.data, attachments: current.data.attachments.map(item => item.id === updated.id ? updated : item) }, history);
            },
            onSurface(frame) {
              surfaces.unshift(frame);
              return () => { surfaces = surfaces.filter(item => item !== frame); selectedText = undefined; };
            },
          });
          const focus = () => {
            boardFileId = file.id;
            for (const chip of nav.children) chip.setAttribute('aria-pressed', String(chip.dataset.file === file.id));
            surface.focus(file.boardPosition.x, file.boardPosition.y, boardFileWidth);
          };
          const chip = button('▣ ' + file.name, focus);
          chip.dataset.file = file.id;
          chip.setAttribute('aria-pressed', String(file.id === boardFileId));
          nav.append(chip);
          if (file.id === boardFileId && focusBoardFile) focus();
        }
        if (nav.childElementCount) root.append(nav);
        focusBoardFile = false;
      }
    }
    inkControls(board, surface, true);
    if (!board) {
      const addPage = () => {
        mutate({ ...current.data, pages: [...current.data.pages, blank()] });
        render();
        root.scrollTop = root.scrollHeight;
      };
      bar.append(...notebook.controls, button('＋ Страница', addPage));
      pages.append(button('＋ Страница', addPage));
    }

  }
  const attach = button('Прикрепить', () => $('file-picker').click());
  bar.append(attach, undo, redo);
  updateUndo();
}

function more(item) {
  choose('Действия', (dialog, close) => {
    const form = element('form');
    const title = element('input');
    title.value = item.data.title;
    title.required = true;
    title.maxLength = 150;
    const folders = visible().filter(entry => entry.data.kind === 'folder');
    const choices = { '': 'Все заметки' };
    for (const entry of folders) {
      let ancestor = entry;
      const seen = new Set();
      while (ancestor && ancestor.id !== item.id && !seen.has(ancestor.id)) {
        seen.add(ancestor.id);
        ancestor = folders.find(candidate => candidate.id === ancestor.data.parent);
      }
      if (!ancestor) choices[entry.id] = entry.data.title;
    }
    const destination = select(choices, item.data.parent ?? '', 'Папка');
    const controls = element('div', undefined, 'dialog-actions');
    const submit = element('button', 'Сохранить', 'primary');
    submit.type = 'submit';
    controls.append(button('Закрыть', close), submit);
    form.append(labelled('Название', title), labelled('Папка', destination), controls);
    form.onsubmit = async event => {
      event.preventDefault();
      if (!title.value.trim()) return;
      try {
        await save({ ...item.data, title: title.value.trim(), parent: destination.value || null }, { item });
        close(); render();
      } catch (error) { report(error); }
    };
    dialog.append(form);
    const selectedFile = current?.data.kind === 'board' ? boardFileId : attachmentId;
    if (selectedFile) dialog.append(button('Отсоединить вложение', () => {
      const attachments = current.data.kind === 'board' ? boardFilesWithPositions(current.data.attachments) : current.data.attachments;
      mutate({ ...current.data, attachments: attachments.filter(file => file.id !== selectedFile) });
      attachmentId = boardFileId = null;
      close(); render();
    }));
    dialog.append(button('Удалить', async () => {
      if (visible().some(entry => entry.data.parent === item.id)) return message('Сначала перемести содержимое папки');
      if (!confirm('Удалить «' + item.data.title + '»?')) return;
      try {
        await save(item.data, { item, deleted: true });
        close(); open(item.data.parent);
      } catch (error) { report(error); }
    }));
  });
}

async function runSync() {
  if (syncing || !identity()) return;
  if (!navigator.onLine) { if (!failedWrite()) $('sync').textContent = 'Офлайн · сохранено локально'; return; }
  syncing = true;
  const owner = scope;
  try {
    await writes;
    $('sync').textContent = 'Синхронизация…';
    const result = await synchronize(owner);
    if (owner !== scope) return;
    const flushed = writes;
    await flushed;
    const updated = await list('items', owner);
    if (owner !== scope || writes !== flushed) { schedule(); return; }
    const selected = updated.find(item => item.id === current?.id);
    items = updated;
    if (selected && selected.operation !== current.operation) refreshWhenIdle();
    else if (selected) current = selected;
    renderLibrary();
    if (result.conflicts) message('Правки с двух устройств сохранены отдельными версиями');
    if (result.error) throw result.error;
    $('sync').textContent = updated.some(item => item.pending) ? 'Сохранено локально · есть правки' : 'Синхронизировано';
  } catch (error) {
    if (!failedWrite()) $('sync').textContent = 'Сохранено локально · повторим';
    $('sync').title = error.message;
  } finally { syncing = false; }
}

async function changeAccount() {
  await writes.catch(() => {});
  scope = libraryId();
  items = await list('items', scope);
  $('account').textContent = accountLabel();
  $('sync').textContent = identity() ? 'Сохранено локально' : 'Локальная библиотека';
  open(null, { replace: true });
  schedule(0);
}

function codeAccount() {
  choose('Войти по коду', (dialog, close) => {
    const form = element('form');
    const code = element('input');
    code.type = 'password';
    code.required = true;
    code.autocomplete = 'current-password';
    code.placeholder = 'Персональный код';
    const description = element('p', 'Введи выданный код. При первом входе появится аккаунт. Используй тот же код на всех устройствах.', 'muted');
    const submit = element('button', 'Войти по коду', 'primary');
    submit.type = 'submit';
    form.append(description, labelled('Код доступа', code), submit, button('Войти по почте', emailAccount), button('Закрыть', close));
    form.onsubmit = async event => {
      event.preventDefault();
      submit.disabled = true;
      try { await signInByCode(code.value); close(); await changeAccount(); }
      catch (error) { description.textContent = error.message; }
      finally { submit.disabled = false; }
    };
    dialog.append(form);
  });
}

function account() {
  if (!cloudEnabled) return message('Облачный проект пока не настроен');
  if (identity()) {
    choose('Аккаунт', (dialog, close) => {
      dialog.append(element('p', accountLabel()), button('Синхронизировать', () => { close(); void runSync(); }));
      dialog.append(button('Выйти', async () => {
        close();
        await signOut();
        await changeAccount();
      }));
    });
    return;
  }
  codeAccount();
}

function emailAccount() {
  choose('Вход по почте', (dialog, close) => {
    const form = element('form');
    const email = element('input'), password = element('input');
    email.type = 'email'; email.required = true; email.autocomplete = 'username';
    password.type = 'password'; password.required = true; password.minLength = 6; password.autocomplete = 'current-password';
    const description = element('p', 'Вход для уже созданных аккаунтов. Новые аккаунты создаются по персональному коду. Заметки без входа хранятся в отдельной локальной библиотеке.', 'muted');
    const actions = element('div', undefined, 'dialog-actions');
    const login = element('button', 'Войти', 'primary');
    login.type = 'submit';
    actions.append(button('Войти по коду', codeAccount), button('Закрыть', close), login);
    form.append(description, labelled('Почта', email), labelled('Пароль', password), actions);
    form.onsubmit = async event => {
      event.preventDefault();
      login.disabled = true;
      try {
        if (await signIn(email.value, password.value)) {
          close();
          await changeAccount();
        } else description.textContent = 'Не удалось войти. Проверь почту и пароль.';
      } catch (error) { description.textContent = error.message; }
      finally { login.disabled = false; }
    };
    dialog.append(form);
  });
}

$('new-item').onclick = () => createDialog();
$('query').oninput = renderLibrary;
$('more').onclick = () => { if (current) more(current); };
$('account').onclick = account;
$('sync').onclick = () => identity() ? runSync() : account();
$('show-library').onclick = () => {
  prefs.focusMode = false;
  remember();
  $('app').classList.add('library-open');
};
$('focus-mode').onclick = () => {
  prefs.focusMode = !prefs.focusMode;
  $('app').classList.remove('library-open');
  remember();
};
$('hide-library').onclick = () => $('app').classList.remove('library-open');
$('title').onchange = () => {
  if (!current) return;
  const title = $('title').value.trim();
  if (title) { mutate({ ...current.data, title }); renderLibrary(); }
  else $('title').value = current.data.title;
};
$('title').onkeydown = event => { if (event.key === 'Enter' && !event.isComposing) event.target.blur(); };
$('file-picker').onchange = async event => {
  const target = current?.id;
  const files = Array.from(event.target.files);
  event.target.value = '';
  for (const file of files) {
    if (current?.id !== target) break;
    try {
      const item = describeFile(file);
      if (item.mime === 'application/pdf') preparePdfOffline().catch(() => message('Просмотр PDF офлайн ещё не подготовлен'));
      const attachments = [...current.data.attachments, item];
      const board = current.data.kind === 'board';
      if (board) { boardFileId = item.id; focusBoardFile = true; }
      mutate({ ...current.data, attachments: board ? boardFilesWithPositions(attachments) : attachments }, true, {
        library: scope, id: item.id, blob: file.slice(0, file.size, item.mime), remote: false,
      });
      await writes;
    } catch (error) { report(error); }
  }
  if (target && current?.id === target) render();
};
$('content').addEventListener('pointerdown', event => activePointers.add(event.pointerId), true);
for (const type of ['pointerup', 'pointercancel']) {
  window.addEventListener(type, event => {
    activePointers.delete(event.pointerId);
    if (staleView) setTimeout(() => { if (staleView && !busy()) refreshWhenIdle(); }, 300);
  }, true);
}
document.addEventListener('focusout', () => setTimeout(() => { if (staleView && !busy()) refreshWhenIdle(); }, 300));
channel?.addEventListener('message', async ({ data }) => {
  if (data?.library !== scope || !data.id) return;
  const fresh = await read('items', scope, data.id).catch(() => null);
  if (!fresh) return;
  if (current?.id === fresh.id) {
    if (fresh.operation !== current.operation) refreshWhenIdle();
    return;
  }
  const index = items.findIndex(entry => entry.id === fresh.id);
  if (index >= 0) items[index] = fresh; else items.push(fresh);
  renderLibrary();
});
window.addEventListener('popstate', () => open(location.hash.slice(6) || null, { replace: true }));
window.addEventListener('online', () => schedule(0));
window.addEventListener('offline', () => { if (identity() && !failedWrite()) $('sync').textContent = 'Офлайн · сохранено локально'; });
window.addEventListener('focus', () => schedule(0));
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && prefs.focusMode && !$('dialog').open) {
    prefs.focusMode = false;
    remember();
  }
  if (!(event.metaKey || event.ctrlKey) || event.isComposing || event.altKey || $('dialog').open) return;
  if (event.code === 'KeyK') { event.preventDefault(); $('show-library').click(); $('query').focus(); }
  const input = event.target.matches?.('input, textarea');
  const editorInput = event.target.matches?.('.ink-text textarea, .text-note textarea');
  if (current && (!input || editorInput) && event.code === 'KeyZ') {
    const canUndo = (event.shiftKey ? forward : back).length;
    if (canUndo) { event.preventDefault(); history(event.shiftKey); }
  }
  if (!current || (input && !editorInput)) return;
  if (event.code === 'KeyY' && surfaces.length) { event.preventDefault(); addTextBlock(); }
  if ($('text-pt') && ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract'].includes(event.code)) {
    event.preventDefault();
    const plus = ['Equal', 'NumpadAdd'].includes(event.code);
    setTextSize(Number($('text-pt').value) + (plus ? 1 : -1));
  }
  if (selectedText && ['KeyB', 'KeyI'].includes(event.code)) {
    event.preventDefault();
    const key = event.code === 'KeyB' ? 'bold' : 'italic';
    selectedText.edit({ [key]: !selectedText[key] });
  }
});

async function checkUpdates(status, check) {
  check.disabled = true;
  status.textContent = 'Проверяю обновления…';
  try {
    const response = await fetch(releaseBase + 'latest.json', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Манифест обновлений недоступен');
    const release = await response.json();
    if (!Number.isSafeInteger(release.code) || !/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error('Неверный манифест');
    if (release.code <= appVersion.code) {
      status.textContent = 'Установлена актуальная версия ' + appVersion.name;
      return;
    }
    const android = Boolean(window.NotesAndroid);
    const filename = android ? 'Polya-Android.apk' : 'Polya-macOS.zip';
    const link = element('a', 'Скачать ' + release.version);
    link.href = releaseBase + 'v' + release.version + '/' + filename;
    status.replaceChildren(link, element('p', android
      ? 'Открой скачанный APK и подтверди обновление.'
      : 'Распакуй архив и замени старое приложение «Поля» новым.'));
  } catch {
    status.textContent = 'Не удалось проверить обновления. Попробуй ещё раз.';
  } finally { check.disabled = false; }
}

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const appleWeb = () => /iPad|iPhone|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document && !window.NotesMac;

async function persistStorage() {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist().catch(() => false);
}

async function storageStatus(target) {
  if (window.NotesAndroid || window.NotesMac) { target.textContent = 'Заметки хранятся в приложении.'; return; }
  const persisted = await persistStorage();
  let text = persisted ? 'Хранилище постоянное: браузер не удалит заметки сам.' : 'Браузер может очистить заметки при нехватке места или долгом простое.';
  if (!persisted && appleWeb() && !standalone()) text += ' На iPad добавь «Поля» на экран «Домой» (Поделиться → На экран «Домой»): Safari удаляет данные сайтов через 7 дней без посещений.';
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (quota) text += ' Занято ' + Math.round(usage / 1048576) + ' МБ из ' + Math.round(quota / 1048576) + ' МБ.';
  } catch {}
  target.textContent = text;
}

function penButtonSettings() {
  choose('Кнопка S Pen', (dialog, close) => {
    const hold = { none: 'Ничего', pen: 'Перо', erase: 'Ластик', highlight: 'Маркер', lasso: 'Лассо' };
    const tap = { ...hold, text: 'Инструмент «Текст»', newText: 'Новое текстовое поле', undo: 'Отменить', redo: 'Повторить' };
    for (const [gesture, title, choices] of [
      ['hold', 'Удержание', hold], ['tap', 'Один короткий щелчок', tap], ['double', 'Двойной щелчок', tap],
    ]) {
      const control = select(choices, buttonSettings()[gesture], title);
      control.onchange = () => {
        prefs.penButton = { ...buttonSettings(), [gesture]: control.value };
        remember();
        updateToolButtons();
      };
      dialog.append(labelled(title, control));
    }
    const status = element('p', '', 'muted');
    status.id = 'pen-button-status';
    status.setAttribute('role', 'status');
    dialog.append(element('p', 'Поднеси кончик пера к экрану. Чтобы переключить инструмент, нажми и отпусти кнопку рядом с экраном. Чтобы воспользоваться временным инструментом, удерживай кнопку и коснись экрана.', 'muted'), status,
      button('По умолчанию', () => { delete prefs.penButton; remember(); penButtonSettings(); }),
      button('Закрыть', close));
    updateToolButtons();
  });
}

$('settings').onclick = () => choose('Настройки', (dialog, close) => {
  const theme = select(themes, prefs.theme, 'Тема');
  theme.onchange = () => { prefs.theme = theme.value; applyTheme(); remember(); };
  dialog.append(labelled('Тема', theme), button('Цвет пера по теме', () => {
    prefs.autoColor = true; applyTheme(); remember();
  }), element('p', '⌘+/− меняет размер текста. ⌘Y добавляет текстовое поле. ⌘Z отменяет действие, ⇧⌘Z повторяет его. На других клавиатурах используй Ctrl.', 'muted'));
  const storage = element('p', 'Проверяю хранилище…', 'muted');
  dialog.append(storage);
  void storageStatus(storage);
  if (window.NotesAndroid) dialog.append(button('Кнопка S Pen', penButtonSettings));
  if (window.NotesAndroid || window.NotesMac) {
    const status = element('div', 'Версия ' + appVersion.name, 'muted');
    const check = button('Проверить обновления', () => void checkUpdates(status, check));
    dialog.append(status, check);
  }
  dialog.append(button('Закрыть', close));
});
darkMode.addEventListener('change', applyTheme);
applyTheme();

try {
  items = await list('items', scope);
  $('account').textContent = accountLabel();
  const initial = location.hash.slice(6);
  if (initial && visible().some(item => item.id === initial)) open(initial, { replace: true });
  else render();
  schedule(0);
  setInterval(runSync, 15000);
  void persistStorage();
  if ('serviceWorker' in navigator && !window.NotesAndroid && !window.NotesMac) {
    navigator.serviceWorker.register('./sw.js?v=' + appVersion.name).catch(report);
  }
} catch (error) { report(error); }
