import { edit, list, read } from './local.js';
import { attachmentBlob, cloudEnabled, identity, libraryId, signIn, signInByCode, signOut, synchronize } from './cloud.js';
import { createSurface } from './ink.js';
import { describeFile, openMedia, pdfBase } from './media.js';
import { button, element, textEditor } from './text.js';
import { cloudConfig } from './config.js';

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
const appVersion = { name: '0.2.0', code: 2 };
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
  attachmentId = null;
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
  const bar = $('tools');
  if (!board && prefs.tool === 'hand') prefs.tool = 'pen';
  const activeButtons = [];
  for (const [key, label] of Object.entries(tools)) {
    if (key === 'hand' && !board) continue;
    const control = button(label, () => {
      prefs.tool = key;
      remember();
      for (const [id, item] of activeButtons) item.setAttribute('aria-pressed', String(id === key));
    });
    activeButtons.push([key, control]);
    control.setAttribute('aria-pressed', String(key === prefs.tool));
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
  bar.append(color, width, finger, recognize, straighten);
  textControls(bar, prefs.textPt, true);
  if (withLayout) {
    const paper = select(layouts, current.data.paper, 'Разметка');
    paper.onchange = () => {
      mutate({ ...current.data, paper: paper.value });
      for (const node of $('content').querySelectorAll('.page,.board')) {
        node.classList.remove(...Object.keys(layouts));
        node.classList.add(paper.value);
      }
    };
    bar.append(paper, numberControl('grid-size', 'Шаг разметки', current.data.gridSize ?? 24, 8, 100, 1, value => {
      mutate({ ...current.data, gridSize: value });
      $('content').style.setProperty('--grid-size', value + 'px');
    }));
  }
  if (board) bar.append(button('−', () => surface.zoom(.8)), button('＋', () => surface.zoom(1.25)), button('Уместить', surface.fit));
}

function commonSurface() {
  return {
    settings: () => prefs, signal: editor.signal,
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

function render() {
  editor.abort();
  editor = new AbortController();
  selectedStrokes = [];
  recognizedText = null;
  shapeSelection = null;
  selectedText = documentText = undefined;
  surfaces = [];
  const root = $('content'), bar = $('tools');
  root.replaceChildren();
  bar.replaceChildren();
  bar.hidden = !current;
  root.scrollTop = 0;
  root.style.setProperty('--grid-size', (current?.data.gridSize ?? 24) + 'px');
  $('title').hidden = !current;
  $('heading').hidden = Boolean(current);
  $('heading').textContent = items.find(item => item.id === folder)?.data.title ?? 'Все заметки';
  $('more').hidden = !current;
  renderLibrary();
  remember();
  if (!current) { welcome(); return; }
  $('title').value = current.data.title;
  const attachment = current.data.attachments?.find(item => item.id === attachmentId);
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
      surface = createSurface(paper, structuredClone(data), {
        ...commonSurface(), board, width: 794,
        commit(next, history) {
          mutate({ ...current.data, pages: current.data.pages.map(page => page.id === data.id ? next : page) }, history);
        },
      });
      surfaces.push(surface);
    }
    inkControls(board, surface, true);
    if (!board) {
      const addPage = () => {
        mutate({ ...current.data, pages: [...current.data.pages, blank()] });
        render();
        root.scrollTop = root.scrollHeight;
      };
      bar.append(button('＋ Страница', addPage));
      pages.append(button('＋ Страница', addPage));
    }
    if (board && files.childElementCount) {
      for (const item of current.data.attachments) bar.append(button('▣ ' + item.name, () => { attachmentId = item.id; render(); }));
    }
  }
  bar.append(button('Прикрепить', () => $('file-picker').click()), undo, redo);
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
    if (attachmentId) dialog.append(button('Отсоединить вложение', () => {
      mutate({ ...current.data, attachments: current.data.attachments.filter(file => file.id !== attachmentId) });
      attachmentId = null;
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
    items = updated;
    if (refresh) {
      if (selected.deleted) open(selected.data.parent);
      else { current = selected; back = []; forward = []; render(); }
    } else {
      if (selected) current = selected;
      renderLibrary();
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
$('more').onclick = () => { if (current) more(current); };
$('account').onclick = account;
$('sync').onclick = () => identity() ? runSync() : account();
$('show-library').onclick = () => $('app').classList.add('library-open');
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
      mutate({ ...current.data, attachments: [...current.data.attachments, item] }, true, {
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
  if (!(event.metaKey || event.ctrlKey) || event.isComposing || event.altKey || $('dialog').open) return;
  if (event.code === 'KeyK') { event.preventDefault(); $('app').classList.add('library-open'); $('query').focus(); }
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

$('settings').onclick = () => choose('Настройки', (dialog, close) => {
  const theme = select(themes, prefs.theme, 'Тема');
  theme.onchange = () => { prefs.theme = theme.value; applyTheme(); remember(); };
  dialog.append(labelled('Тема', theme), button('Цвет пера по теме', () => {
    prefs.autoColor = true; applyTheme(); remember();
  }), element('p', '⌘+/− меняет размер текста. ⌘Y добавляет текстовое поле. ⌘Z отменяет действие, ⇧⌘Z повторяет его. На других клавиатурах используй Ctrl.', 'muted'));
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
