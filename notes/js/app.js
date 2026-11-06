import { edit, list, read } from './local.js';
import { attachmentBlob, cloudEnabled, identity, libraryId, signIn, signInByCode, signOut, synchronize } from './cloud.js';
import { createSurface } from './ink.js';
import { boardFilesWithPositions, boardFileWidth, describeFile, mountBoardFile, openMedia, pdfBase } from './media.js';
import { button, element, textEditor } from './text.js';
import { cloudConfig } from './config.js';
import { createPenButton, defaultPenButton } from './pen-button.js';
import { createUtilities } from './utilities.js';

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
const appVersion = { name: '0.6.0', code: 7 };
const releaseBase = cloudConfig.url + '/storage/v1/object/public/notes-releases/';
const darkMode = matchMedia('(prefers-color-scheme: dark)');
const existingPrefs = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}');
const accountLabel = () => identity()?.app_metadata?.notes_access_code ? 'Аккаунт по коду' : identity()?.email ?? 'Войти';
const prefs = {
  tool: 'pen', color: matchMedia('(prefers-color-scheme: dark)').matches ? '#eee9ff' : '#28223c',
  width: 3, textPt: 12, finger: false, theme: 'system', holdShapes: true,
  autoColor: !existingPrefs.color || ['#28223c', '#eee9ff'].includes(existingPrefs.color),
  ...existingPrefs,
  penButtonsVersion: 2,
};
if (!existingPrefs.penButtonsVersion && prefs.tool === 'lasso') prefs.tool = 'pen';
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
let failedWrite = false;
let surfaces = [];
let selectedText;
let documentText;
let objectClipboard;
let selectionHost;
const notebookZoom = new Map();
const utilities = createUtilities($('utilities'), $('timer-chip'), message);
let fullscreen = false;

const buttonSettings = () => ({ ...defaultPenButton, ...prefs.penButton });
const holdActions = { none: 'Без действия', pen: 'Перо', erase: 'Ластик', highlight: 'Маркер', lasso: 'Лассо' };
const pressActions = { ...holdActions, text: 'Текст', newText: 'Новое текстовое поле', undo: 'Отменить', redo: 'Повторить' };
let gestureTool;
let penSettingsDraft;
const baseTool = () => gestureTool ?? prefs.tool;
const penButton = createPenButton({
  settings: () => penSettingsDraft ?? buttonSettings(),
  enabled: () => Boolean(penSettingsDraft || current && surfaces.length && !$('dialog').open),
  changed: updateToolButtons,
  activate(action, gesture) {
    if (penSettingsDraft) {
      $('pen-button-status').textContent = (gesture === 'double' ? 'Двойное нажатие' : 'Короткое нажатие') + ' → ' + pressActions[action];
      return;
    }
    if (action === 'undo' || action === 'redo') { history(action === 'redo'); return; }
    if (action === 'newText') { addTextBlock(); return; }
    if (!tools[action]) return;
    const previous = baseTool();
    gestureTool = gestureTool === action ? undefined : action;
    if (previous === 'lasso' && baseTool() !== 'lasso') surfaces.forEach(surface => surface.deselect());
    updateToolButtons();
  },
});

function chooseTool(tool) {
  if (baseTool() === 'lasso' && tool !== 'lasso') surfaces.forEach(surface => surface.deselect());
  gestureTool = undefined;
  prefs.tool = tool;
  remember();
  updateToolButtons();
}

function updateToolButtons() {
  const held = penButton.held();
  const effective = held === 'none' ? baseTool() : held;
  for (const control of document.querySelectorAll('[data-ink-tool]')) {
    control.setAttribute('aria-pressed', String(control.dataset.inkTool === effective));
  }
  $('content').classList.toggle('lasso-mode', effective === 'lasso');
  const status = $('pen-button-status');
  if (status) status.textContent = penButton.isPressed()
    ? 'Кнопка нажата → ' + holdActions[held] : 'Кнопка отпущена';
}

window.notesPenButton = (down, contact, canceled, time, source) => {
  penButton.input(down, contact, canceled, time);
  const diagnostic = $('pen-button-signal');
  const channel = { button: 'событие кнопки', touch: 'касание', hover: 'наведение' }[source];
  if (diagnostic && channel) {
    diagnostic.textContent = 'Сигнал Android · ' + channel + ' · ' + (down ? 'нажата' : 'отпущена');
  }
};

function sideTool(event) {
  if (event.pointerType !== 'pen') return baseTool();
  const bridge = window.NotesAndroid;
  const pointerButton = Boolean(event.buttons & 2) || event.button === 2;
  const held = pointerButton || (bridge?.penButtonPressed ? bridge.penButtonPressed() : penButton.isPressed());
  if (held) {
    const tool = buttonSettings().hold;
    return tool === 'none' ? baseTool() : tool;
  }
  if (event.button === 5 || event.buttons & 32) return 'erase';
  return baseTool();
}

function message(text) {
  $('message').textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { $('message').textContent = ''; }, 6500);
}

function report(error) { message(error.message ?? String(error)); }

function choose(title, populate) {
  const dialog = $('dialog');
  dialog.replaceChildren(element('h2', title));
  populate(dialog, () => dialog.close());
  if (dialog.open) dialog.querySelector('input, select, button')?.focus();
  else dialog.showModal();
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
  $('focus-mode').setAttribute('aria-label', focus ? 'Вернуть библиотеку' : 'Скрыть библиотеку');
  $('focus-mode').title = focus ? 'Вернуть библиотеку' : 'Скрыть библиотеку';
}

function updateFullscreen(active) {
  fullscreen = Boolean(active);
  const control = $('fullscreen');
  control.hidden = !current && !fullscreen;
  control.setAttribute('aria-pressed', String(fullscreen));
  control.title = fullscreen ? 'Выйти из полного экрана' : 'Полный экран';
  control.setAttribute('aria-label', control.title);
  $('app').classList.toggle('fullscreen', fullscreen);
  $('app').classList.remove('library-open');
}
window.notesFullscreenChanged = updateFullscreen;
document.addEventListener('fullscreenchange', () => updateFullscreen(Boolean(document.fullscreenElement)));

async function setFullscreen(active) {
  if (window.NotesAndroid?.setFullscreen) { window.NotesAndroid.setFullscreen(active); return; }
  if (window.webkit?.messageHandlers?.notesFullscreen) {
    window.webkit.messageHandlers.notesFullscreen.postMessage(active);
    return;
  }
  try {
    if (active) {
      await document.documentElement.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else updateFullscreen(false);
  } catch {
    updateFullscreen(active);
    if (active) message('Этот браузер оставляет свою панель на экране.');
  }
}

function boardViewport(id, signal) {
  const key = 'biovision-notes-board-view:' + scope + ':' + id;
  let initialView, pending, timer;
  try {
    const view = JSON.parse(localStorage.getItem(key));
    if (view && [view.x, view.y, view.zoom].every(Number.isFinite) && view.zoom >= .15 && view.zoom <= 6) initialView = view;
  } catch { /* Storage can be unavailable in a private session. */ }
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    try { localStorage.setItem(key, JSON.stringify(pending)); } catch { /* The board remains usable. */ }
    pending = undefined;
  }
  signal.addEventListener('abort', flush, { once: true });
  window.addEventListener('pagehide', flush, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); }, { signal });
  return { initialView, onViewChange(view) {
    pending = view;
    timer ??= setTimeout(flush, 180);
  } };
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

function queue(work) {
  const pending = writes.catch(() => {}).then(work);
  writes = pending;
  $('sync').textContent = 'Сохраняется на устройстве…';
  pending.then(() => {
    failedWrite = false;
    $('sync').textContent = identity() ? 'Сохранено локально' : 'Сохранено на устройстве';
    schedule();
  }, error => {
    failedWrite = true;
    $('sync').textContent = 'Ошибка локального сохранения';
    report(error);
  });
  return pending;
}

function save(data, { deleted = false, file, item = current } = {}) {
  const owner = scope;
  const snapshot = structuredClone(data);
  const operation = crypto.randomUUID();
  const modified = Date.now();
  const local = { ...item, data: snapshot, deleted, modified, operation, pending: owner !== 'local' };
  if (current?.id === local.id) current = local;
  const index = items.findIndex(entry => entry.id === local.id);
  if (index < 0) items.push(local);
  else items[index] = local;
  return queue(() => edit(owner, item.id, existing => ({
    ...local, revision: existing?.revision ?? 0,
  }), file));
}

function mutate(data, history = true, file) {
  if (!current) return;
  if (history) { back.push(structuredClone(current.data)); if (back.length > 40) back.shift(); forward = []; }
  save(data, { file });
  updateUndo();
}

function history(redo = false) {
  const [source, target] = redo ? [forward, back] : [back, forward];
  if (!current || !source.length) return;
  target.push(structuredClone(current.data));
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

const folderColors = { violet: 'Сиреневый', blue: 'Голубой', green: 'Зелёный', gold: 'Янтарный', rose: 'Розовый' };

function libraryItems() {
  return visible().sort((a, b) => a.data.title.localeCompare(b.data.title, 'ru', { numeric: true }));
}

function folderPath(id, records = libraryItems()) {
  const path = [];
  const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const entry = records.find(item => item.id === id && item.data.kind === 'folder');
    if (!entry) break;
    path.unshift(entry);
    id = entry.data.parent;
  }
  return path;
}

function inFolder(records, id) {
  const parents = new Set(records.filter(item => item.data.kind === 'folder').map(item => item.id));
  return records.filter(item => (parents.has(item.data.parent) ? item.data.parent : null) === id);
}

function renderLibrary() {
  const nav = $('tree');
  const records = libraryItems();
  const term = $('query').value.trim().toLocaleLowerCase('ru');
  nav.replaceChildren();
  function row(item, depth = 0) {
    const link = button(item ? kinds[item.data.kind][0] + '  ' + item.data.title : '⌂  Библиотека', () => open(item?.id));
    link.className = 'library-link';
    link.style.setProperty('--depth', depth);
    if (item) link.title = item.data.title;
    if (current?.id === item?.id && current || !current && (item?.id ?? null) === folder) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  if (term) {
    for (const item of records.filter(item => [item.data.title, item.data.body ?? ''].some(value => value.toLocaleLowerCase('ru').includes(term)))) row(item);
    if (!nav.childElementCount) nav.append(element('p', 'Ничего не найдено', 'muted'));
  } else {
    row(null);
    const expanded = new Set(folderPath(folder, records).map(item => item.id));
    function branch(parent, depth) {
      for (const item of inFolder(records, parent).filter(item => item.data.kind === 'folder')) {
        row(item, depth);
        if (expanded.delete(item.id)) branch(item.id, depth + 1);
      }
    }
    branch(null, 0);
    if (current) row(current);
  }
}

async function preload(item, owner) {
  if (!identity() || !navigator.onLine) return;
  for (const file of item.data.attachments ?? []) {
    if (owner !== scope) return;
    try {
      await attachmentBlob(owner, file.id);
      if (file.mime === 'application/pdf') {
        const cache = await caches.open('biovision-notes-assets-v1');
        await Promise.all(['pdf.mjs', 'pdf.worker.mjs'].map(async path => {
          if (!await cache.match(pdfBase + path)) await cache.add(pdfBase + path);
        }));
      }
    } catch (error) {
      if (!await read('files', owner, file.id)) message('Не удалось сохранить для офлайн: ' + file.name);
      else if (file.mime === 'application/pdf') message('Просмотр PDF офлайн ещё не подготовлен');
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
  else if ((item ? hash : '') !== location.hash) window.history.pushState(null, '', hash);
  $('app').classList.remove('library-open');
  render();
  if (item) void preload(item, scope);
}

async function create(kind, title, paper, color) {
  const item = { id: crypto.randomUUID(), library: scope, revision: 0 };
  const data = { kind, title, parent: folder, paper };
  if (kind === 'pages' || kind === 'board') data.pages = [blank()];
  if (kind === 'text') data.body = '';
  if (kind !== 'folder') data.attachments = [];
  else data.color = color;
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
    const color = select(folderColors, 'violet', 'Цвет папки');
    const folderColor = labelled('Цвет папки', color);
    const toggle = () => {
      pattern.hidden = kind.value === 'folder' || kind.value === 'text';
      folderColor.hidden = kind.value !== 'folder';
    };
    kind.addEventListener('change', toggle);
    toggle();
    const actions = element('div', undefined, 'dialog-actions');
    const submit = element('button', 'Создать', 'primary');
    submit.type = 'submit';
    actions.append(button('Отмена', close), submit);
    form.append(labelled('Тип', kind), labelled('Название', title), pattern, folderColor, actions);
    form.onsubmit = async event => {
      event.preventDefault();
      if (!title.value.trim()) return;
      submit.disabled = true;
      try { await create(kind.value, title.value.trim(), paper.value, color.value); close(); }
      catch (error) { report(error); submit.disabled = false; }
    };
    dialog.append(form);
    title.focus();
  });
}

function welcome() {
  const records = libraryItems();
  const path = folderPath(folder, records);
  const currentFolder = path.at(-1);
  const section = element('section', undefined, 'library-view');
  const breadcrumbs = element('nav', undefined, 'library-path');
  breadcrumbs.setAttribute('aria-label', 'Путь к папке');
  breadcrumbs.append(button('Библиотека', () => open(null)));
  for (const entry of path) {
    breadcrumbs.append(element('span', '›', 'muted'), button(entry.data.title, () => open(entry.id)));
  }
  breadcrumbs.lastElementChild.setAttribute('aria-current', 'page');
  const title = element('div', undefined, 'library-title');
  title.append(element('h1', currentFolder?.data.title ?? 'Мои заметки'));
  const actions = element('div', undefined, 'library-actions');
  actions.append(button('Новая папка', () => createDialog('folder')),
    button('Новая заметка', () => createDialog(), 'primary'));
  if (currentFolder) actions.append(button('Действия с папкой', () => more(currentFolder)));
  title.append(actions);
  section.append(breadcrumbs, title);

  const controls = element('div', undefined, 'library-actions library-view-options');
  const mode = select({ grid: 'Плитки', list: 'Список' }, prefs.libraryLayout ?? 'grid', 'Вид библиотеки');
  mode.onchange = () => { prefs.libraryLayout = mode.value; remember(); welcome(); $('content').querySelector('[aria-label="Вид библиотеки"]').focus(); };
  controls.append(labelled('Вид', mode));
  section.append(controls);
  const entries = inFolder(records, currentFolder?.id ?? null);
  for (const [label, group] of [
    ['Папки', entries.filter(item => item.data.kind === 'folder')],
    ['Заметки', entries.filter(item => item.data.kind !== 'folder')],
  ]) {
    if (!group.length) continue;
    section.append(element('h2', label));
    const cards = element('div', undefined, 'library-items ' + (prefs.libraryLayout === 'list' ? 'library-list' : ''));
    for (const item of group) {
      const card = element('article', undefined, 'library-card');
      const itemKind = item.data.kind;
      const openItem = button('', () => open(item.id));
      openItem.className = 'library-card-open';
      openItem.setAttribute('aria-label', item.data.title);
      const icon = element('span', itemKind === 'folder' ? '' : kinds[itemKind][0], 'library-item-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.dataset.color = itemKind === 'folder' ? item.data.color ?? 'violet' : 'note';
      const info = element('span', undefined, 'library-item-text');
      const childCount = itemKind === 'folder' ? inFolder(records, item.id).length : 0;
      info.append(element('strong', item.data.title), element('small', itemKind === 'folder' ? 'Объектов · ' + childCount : kinds[itemKind][1], 'muted'));
      openItem.append(icon, info);
      const actions = button('⋯', () => more(item));
      actions.className = 'library-card-menu';
      actions.setAttribute('aria-label', 'Действия с «' + item.data.title + '»');
      card.append(openItem, actions);
      cards.append(card);
    }
    section.append(cards);
  }
  if (!entries.length) section.append(element('p', 'Здесь пока пусто. Создай заметку или папку.', 'library-empty muted'));
  const previous = $('content').querySelector('.library-view');
  if (previous) previous.replaceWith(section);
  else $('content').append(section);
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
      chooseTool(key);
    });
    control.dataset.inkTool = key;
    if (['line', 'rect', 'ellipse'].includes(key)) extra.append(control);
    else bar.append(control);
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
  const paste = button('Вставить объекты', pasteObjects);
  paste.id = 'paste-objects';
  paste.disabled = !objectClipboard;
  extra.append(color, width, finger, recognize, straighten, paste);
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

function selectionActions(selection) {
  const menu = $('selection-actions');
  if (!selection) { menu.hidden = true; selectionHost = undefined; return; }
  if (selectionHost !== selection.host || menu.hidden) {
    menu.replaceChildren(button('Дублировать', selection.duplicate), button('Вырезать', selection.cut), button('Удалить', selection.delete));
    selectionHost = selection.host;
  }
  const area = $('content').getBoundingClientRect();
  menu.hidden = selection.bottom < area.top || selection.top > area.bottom;
  if (menu.hidden) return;
  const width = menu.offsetWidth, height = menu.offsetHeight;
  const minX = Math.max(6, area.left + 5), maxX = Math.max(minX, area.right - width - 5);
  const left = Math.max(minX, Math.min(maxX, selection.x - width / 2));
  const preferred = selection.top - height - 8 >= area.top ? selection.top - height - 8 : selection.bottom + 8;
  const top = Math.max(area.top + 5, Math.min(area.bottom - height - 5, preferred));
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function pasteObjects() {
  if (!objectClipboard) return;
  const area = $('content').getBoundingClientRect();
  const visible = surface => {
    const rect = surface.host.getBoundingClientRect();
    return Math.max(0, Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top));
  };
  const target = surfaces.find(surface => surface.host === selectionHost) ??
    [...surfaces].sort((a, b) => visible(b) - visible(a))[0];
  target?.paste(objectClipboard);
}

function commonSurface() {
  return {
    settings: () => ({ ...prefs, tool: baseTool() }), signal: editor.signal,
    sideTool,
    showSelection: selectionActions,
    clipboard: { write(data) {
      objectClipboard = structuredClone(data);
      if ($('paste-objects')) $('paste-objects').disabled = false;
      message('Вырезано. Вставь через «Дополнительно» или ⌘V / Ctrl+V.');
    } },
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

function render() {
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
  $('heading').textContent = 'Библиотека';
  $('back-to-folder').hidden = !current;
  $('more').hidden = !current;
  $('focus-mode').hidden = !current;
  $('fullscreen').hidden = !current && !fullscreen;
  if (!current && fullscreen) void setFullscreen(false);
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
      if (worldLayers) paper.append(...worldLayers);
      surface = createSurface(paper, structuredClone(data), {
        ...commonSurface(), board, width: 794, worldLayers,
        ...(board ? boardViewport(current.id, editor.signal) : {}),
        pinch: notebook?.pinch,
        commit(next, history) {
          mutate({ ...current.data, pages: current.data.pages.map(page => page.id === data.id ? next : page) }, history);
        },
      });
      surfaces.push(surface);
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
    if (current?.id === item.id) dialog.append(button('Инструменты', () => { close(); utilities.open(); }));
    const form = element('form');
    const title = element('input');
    title.value = item.data.title;
    title.required = true;
    title.maxLength = 150;
    const folders = visible().filter(entry => entry.data.kind === 'folder');
    const choices = { '': 'Библиотека' };
    for (const entry of folders) {
      let ancestor = entry;
      const seen = new Set();
      while (ancestor && ancestor.id !== item.id && !seen.has(ancestor.id)) {
        seen.add(ancestor.id);
        ancestor = folders.find(candidate => candidate.id === ancestor.data.parent);
      }
      if (!ancestor) choices[entry.id] = folderPath(entry.id, folders).map(item => item.data.title).join(' › ');
    }
    const destination = select(choices, item.data.parent ?? '', 'Переместить в папку');
    const controls = element('div', undefined, 'dialog-actions');
    const submit = element('button', 'Сохранить', 'primary');
    submit.type = 'submit';
    controls.append(button('Закрыть', close), submit);
    const color = select(folderColors, item.data.color ?? 'violet', 'Цвет папки');
    form.append(labelled('Название', title), labelled('Переместить в папку', destination));
    if (item.data.kind === 'folder') form.append(labelled('Цвет папки', color));
    form.append(controls);
    form.onsubmit = async event => {
      event.preventDefault();
      if (!title.value.trim()) return;
      try {
        const latest = items.find(entry => entry.id === item.id && !entry.deleted);
        if (!latest) { close(); return; }
        const parent = destination.value || null;
        if (latest.data.kind === 'folder' && folderPath(parent).some(entry => entry.id === latest.id)) {
          return message('Выбери папку вне этой ветки');
        }
        const data = { ...latest.data, title: title.value.trim(), parent };
        if (latest.data.kind === 'folder') data.color = color.value;
        await save(data, { item: latest });
        if (current?.id === latest.id) folder = parent;
        close(); render();
      } catch (error) { report(error); }
    };
    dialog.append(form);
    const selectedFile = current?.id === item.id ? current.data.kind === 'board' ? boardFileId : attachmentId : null;
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
  if (!navigator.onLine) { if (!failedWrite) $('sync').textContent = 'Офлайн · сохранено локально'; return; }
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
    const refresh = selected && selected.operation !== current.operation && !selected.pending;
    const libraryChanged = !current && (items.length !== updated.length ||
      updated.some(item => !items.some(local => local.id === item.id && local.operation === item.operation)));
    items = updated;
    if (folder && !items.some(item => item.id === folder && !item.deleted)) folder = null;
    if (refresh) {
      if (selected.deleted) open(selected.data.parent);
      else { current = selected; back = []; forward = []; render(); }
    } else {
      if (selected) current = selected;
      renderLibrary();
      if (libraryChanged) welcome();
    }
    if (result.conflicts) message('Правки с двух устройств сохранены отдельными версиями');
    if (result.error) throw result.error;
    $('sync').textContent = updated.some(item => item.pending) ? 'Сохранено локально · есть правки' : 'Синхронизировано';
  } catch (error) {
    if (!failedWrite) $('sync').textContent = 'Сохранено локально · повторим';
    $('sync').title = error.message;
  } finally { syncing = false; }
}

async function changeAccount() {
  await writes.catch(() => {});
  scope = libraryId();
  objectClipboard = undefined;
  items = await list('items', scope);
  $('account').textContent = accountLabel();
  $('sync').textContent = identity() ? 'Сохранено локально' : 'Локальная библиотека';
  open(null, { replace: true });
  schedule(0);
}

function codeAccount() {
  choose('Войти или создать аккаунт по коду', (dialog, close) => {
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
    const description = element('p', 'Войди с одним аккаунтом на всех устройствах. Заметки без входа хранятся в отдельной локальной библиотеке.', 'muted');
    const actions = element('div', undefined, 'dialog-actions');
    const login = element('button', 'Войти', 'primary');
    const signup = element('button', 'Создать аккаунт');
    login.type = signup.type = 'submit';
    actions.append(button('Войти по коду', codeAccount), button('Закрыть', close), signup, login);
    form.append(description, labelled('Почта', email), labelled('Пароль', password), actions);
    form.onsubmit = async event => {
      event.preventDefault();
      login.disabled = signup.disabled = true;
      try {
        if (await signIn(email.value, password.value, event.submitter === signup)) {
          close();
          await changeAccount();
        } else description.textContent = 'Подтверди почту по ссылке из письма и войди.';
      } catch (error) { description.textContent = error.message; }
      finally { login.disabled = signup.disabled = false; }
    };
    dialog.append(form);
  });
}

$('new-item').onclick = () => createDialog();
$('query').oninput = renderLibrary;
$('back-to-folder').onclick = () => open(folder);
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
$('fullscreen').onclick = () => void setFullscreen(!fullscreen);
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
window.addEventListener('popstate', () => open(location.hash.slice(6) || null, { replace: true }));
window.addEventListener('online', () => schedule(0));
window.addEventListener('offline', () => { if (identity() && !failedWrite) $('sync').textContent = 'Офлайн · сохранено локально'; });
window.addEventListener('focus', () => schedule(0));
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('dialog').open && utilities.close()) { event.preventDefault(); return; }
  if (event.key === 'Escape' && fullscreen && !$('dialog').open && !document.fullscreenElement) {
    void setFullscreen(false);
    return;
  }
  if (event.key === 'Escape' && selectionHost && !$('selection-actions').hidden) {
    surfaces.find(surface => surface.host === selectionHost)?.deselect();
    return;
  }
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
  if (!input && event.code === 'KeyV' && objectClipboard && surfaces.length) { event.preventDefault(); pasteObjects(); }
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
      : 'Распакуй архив. Заверши «Поля» через ⌘Q, замени приложение в «Программах» и открой новую копию.'));
  } catch {
    status.textContent = 'Не удалось проверить обновления. Попробуй ещё раз.';
  } finally { check.disabled = false; }
}

function penButtonSettings() {
  choose('Кнопка S Pen', (dialog, close) => {
    const draft = buttonSettings();
    penSettingsDraft = draft;
    penButton.reset();
    const table = element('div', undefined, 'pen-bindings');
    const fields = [];
    for (const [gesture, title, hint, choices] of [
      ['hold', 'Удержание', 'Временный инструмент, пока кнопка нажата', holdActions],
      ['tap', 'Одно нажатие', 'Отпусти кнопку рядом с экраном', pressActions],
      ['double', 'Два нажатия', 'Нажми и отпусти кнопку дважды', pressActions],
    ]) {
      const field = select(choices, draft[gesture], title);
      const row = element('label', undefined, 'pen-binding');
      const text = element('span');
      text.append(element('strong', title), element('small', hint, 'muted'));
      row.append(text, field);
      field.onchange = () => { draft[gesture] = field.value; penButton.reset(); };
      fields.push([gesture, field]);
      table.append(row);
    }
    const status = element('p', 'Поднеси перо к экрану и нажми кнопку для проверки', 'pen-test');
    status.id = 'pen-button-status';
    status.setAttribute('role', 'status');
    const signal = element('small', 'Сигнал Android · ожидаю нажатия', 'muted');
    signal.id = 'pen-button-signal';
    function finish() {
      if (penSettingsDraft !== draft) return;
      penSettingsDraft = undefined;
      penButton.reset();
      updateToolButtons();
    }
    const actions = element('div', undefined, 'dialog-actions');
    actions.append(button('Сбросить', () => {
      Object.assign(draft, defaultPenButton);
      for (const [gesture, field] of fields) field.value = draft[gesture];
      penButton.reset();
    }), button('Отмена', close), button('Применить', () => {
      prefs.penButton = { ...draft };
      if (gestureTool === 'lasso') surfaces.forEach(surface => surface.deselect());
      gestureTool = undefined;
      remember();
      finish();
      close();
    }, 'primary'));
    dialog.append(table, status, signal, actions);
    dialog.addEventListener('close', finish, { once: true });
    updateToolButtons();
  });
}

$('settings').onclick = () => choose('Настройки', (dialog, close) => {
  const theme = select(themes, prefs.theme, 'Тема');
  theme.onchange = () => { prefs.theme = theme.value; applyTheme(); remember(); };
  const shapes = select({ on: 'Включено', off: 'Выключено' }, prefs.holdShapes ? 'on' : 'off', 'Фигуры при удержании');
  shapes.onchange = () => { prefs.holdShapes = shapes.value === 'on'; remember(); };
  dialog.append(labelled('Тема', theme), labelled('Фигуры при удержании', shapes), button('Цвет пера по теме', () => {
    prefs.autoColor = true; applyTheme(); remember();
  }), element('p', '⌘+/− меняет размер текста. ⌘Y добавляет текстовое поле. ⌘Z отменяет действие, ⇧⌘Z повторяет его. На других клавиатурах используй Ctrl.', 'muted'));
  if (window.NotesAndroid) dialog.append(button('Кнопка S Pen', penButtonSettings));
  dialog.append(button('Инструменты', () => { close(); utilities.open(); }));
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
  if ('serviceWorker' in navigator && !window.NotesAndroid && !window.NotesMac) {
    navigator.serviceWorker.register('./sw.js').catch(report);
  }
} catch (error) { report(error); }
