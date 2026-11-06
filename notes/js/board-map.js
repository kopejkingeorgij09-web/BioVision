import { button, element } from './text.js';

const svg = (tag, attrs = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

export function boardMap(surface, data, change, ask, signal) {
  const panel = element('aside', undefined, 'board-map');
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Карта доски');
  const header = element('div', undefined, 'map-header');
  const close = button('×', () => toggle(false));
  close.setAttribute('aria-label', 'Скрыть карту');
  header.append(element('strong', 'Карта доски'), close);
  const map = svg('svg', { viewBox: '0 0 240 144', 'aria-label': 'Обзор доски' });
  const list = element('div', undefined, 'map-bookmarks');
  const add = button('＋ Закладка', () => {
    const { x, y, zoom } = surface.camera();
    ask('Новая закладка', '', label => {
      change([...data().bookmarks ?? [], { id: crypto.randomUUID(), label, x, y, zoom }]);
      refresh();
    });
  });
  panel.append(header, map, add, list);
  const control = button('Карта', () => toggle(panel.hidden));
  control.setAttribute('aria-expanded', 'false');
  function toggle(visible) {
    panel.hidden = !visible;
    control.setAttribute('aria-expanded', String(visible));
    if (visible) refresh();
  }

  let frame, project, inverse;
  const draw = () => {
    frame = undefined;
    if (panel.hidden || signal.aborted) return;
    const view = surface.camera(), note = data(), page = note.pages[0];
    let left = view.x - view.width / 2, right = view.x + view.width / 2;
    let top = view.y - view.height / 2, bottom = view.y + view.height / 2;
    function include(x, y) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const strokes = page.strokes ?? [];
    for (const stroke of strokes) for (const [x, y] of stroke.points) include(x, y);
    for (const item of [...page.texts ?? [], ...note.bookmarks ?? []]) include(item.x, item.y);
    const files = Array.from(surface.host.querySelectorAll('.board-file'));
    for (const file of files) {
      include(file.offsetLeft, file.offsetTop);
      include(file.offsetLeft + file.offsetWidth, file.offsetTop + file.offsetHeight);
    }
    const ratio = Math.min(220 / Math.max(right - left, 1), 124 / Math.max(bottom - top, 1));
    const dx = 120 - (left + right) / 2 * ratio, dy = 72 - (top + bottom) / 2 * ratio;
    project = (x, y) => [x * ratio + dx, y * ratio + dy];
    inverse = (x, y) => [(x - dx) / ratio, (y - dy) / ratio];
    const pieces = [];
    const step = Math.max(1, Math.ceil(strokes.length / 600));
    for (let i = 0; i < strokes.length; i += step) {
      const points = strokes[i].points;
      if (!points?.length) continue;
      const skip = Math.max(1, Math.ceil(points.length / 28));
      pieces.push('M' + project(...points[0]) + points.filter((_, index) => index && (index % skip === 0 || index === points.length - 1))
        .map(point => 'L' + project(...point)).join(''));
    }
    const layer = svg('path', { d: pieces.join(' '), class: 'map-ink' });
    const [x, y] = project(view.x - view.width / 2, view.y - view.height / 2);
    map.replaceChildren(layer, svg('rect', { x, y, width: view.width * ratio, height: view.height * ratio, class: 'map-viewport' }));
    for (const file of files) {
      const [x, y] = project(file.offsetLeft, file.offsetTop);
      map.append(svg('rect', { x, y, width: Math.max(2, file.offsetWidth * ratio),
        height: Math.max(2, file.offsetHeight * ratio), class: 'map-file' }));
    }
    for (const item of page.texts ?? []) {
      const [cx, cy] = project(item.x, item.y);
      map.append(svg('circle', { cx, cy, r: 1.6, class: 'map-file' }));
    }
    for (const item of note.bookmarks ?? []) {
      const [cx, cy] = project(item.x, item.y);
      const pin = svg('circle', { cx, cy, r: 3, class: 'map-pin' });
      const title = svg('title'); title.textContent = item.label; pin.append(title);
      map.append(pin);
    }
  };
  map.addEventListener('click', event => {
    if (!inverse) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(map.getScreenCTM().inverse());
    surface.jump(...inverse(point.x, point.y));
    update();
  });
  function update() {
    if (!panel.hidden && frame === undefined) frame = requestAnimationFrame(draw);
  }
  function refresh() {
    list.replaceChildren();
    for (const mark of data().bookmarks ?? []) {
      const row = element('div', undefined, 'map-mark');
      const jump = button(mark.label, () => { surface.jump(mark.x, mark.y, mark.zoom); update(); });
      const edit = button('✎', () => ask('Переименовать закладку', mark.label, label => {
        change(data().bookmarks.map(item => item.id === mark.id ? { ...item, label } : item)); refresh();
      }));
      const remove = button('×', () => {
        change(data().bookmarks.filter(item => item.id !== mark.id)); refresh();
      });
      edit.setAttribute('aria-label', 'Переименовать «' + mark.label + '»');
      remove.setAttribute('aria-label', 'Удалить закладку «' + mark.label + '»');
      row.append(jump, edit, remove);
      list.append(row);
    }
    if (!list.childElementCount) list.append(element('p', 'Сохрани текущую область доски закладкой.', 'muted'));
    update();
  }
  const resize = new ResizeObserver(update);
  resize.observe(surface.host);
  signal.addEventListener('abort', () => { resize.disconnect(); cancelAnimationFrame(frame); }, { once: true });
  return { panel, control, update };
}
