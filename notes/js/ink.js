const svgNamespace = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}) {
  const node = document.createElementNS(svgNamespace, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const limit = (n, low, high) => Math.max(low, Math.min(n, high));
const center = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const line = point => point.slice(0, 2).map(n => n.toFixed(2)).join(' ');

function outline(points, width) {
  if (points.length === 1) {
    const [x, y, pressure] = points[0];
    const radius = width * (0.25 + pressure * 0.5);
    return `M ${x - radius} ${y} a ${radius} ${radius} 0 1 0 ${2 * radius} 0 a ${radius} ${radius} 0 1 0 ${-2 * radius} 0 Z`;
  }
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y, pressure] = points[i];
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent = Math.atan2(next[1] - previous[1], next[0] - previous[0]) + Math.PI / 2;
    const radius = width * (0.22 + pressure * 0.64);
    const dx = Math.cos(tangent) * radius, dy = Math.sin(tangent) * radius;
    left.push([x + dx, y + dy]);
    right.push([x - dx, y - dy]);
  }
  const perimeter = left.concat(right.reverse());
  const start = center(perimeter.at(-1), perimeter[0]);
  return 'M ' + line(start) + perimeter.map((p, i) =>
    ' Q ' + line(p) + ' ' + line(center(p, perimeter[(i + 1) % perimeter.length]))).join('') + ' Z';
}

function shapeNode(stroke) {
  const { points, tool, width } = stroke;
  const legacyAuto = ['#28223c', '#eee9ff'].includes(stroke.color);
  const color = stroke.color === 'auto' || legacyAuto ? (tool === 'highlight' ? '#e8af2d' : 'var(--ink)') : stroke.color;
  const [x1, y1] = points[0], [x2, y2] = points.at(-1);
  const attrs = { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  if (tool === 'line') return svg('line', { ...attrs, x1, y1, x2, y2 });
  if (tool === 'rect') return svg('rect', { ...attrs, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
  if (tool === 'ellipse') return svg('ellipse', { ...attrs, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, rx: Math.abs(x2 - x1) / 2, ry: Math.abs(y2 - y1) / 2 });
  if (tool === 'highlight') return svg('polyline', {
    ...attrs, opacity: 0.28, 'stroke-width': width * 4, points: points.map(p => line(p)).join(' '),
  });
  return svg('path', { fill: color, d: outline(points, width) });
}

function within(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, y] = polygon[i], [px, py] = polygon[j];
    if ((y > p[1]) !== (py > p[1]) && p[0] < (px - x) * (p[1] - y) / (py - y) + x) inside = !inside;
  }
  return inside;
}

function nearSegment(p, a, b, radius) {
  const x = b[0] - a[0], y = b[1] - a[1], length = x * x + y * y;
  if (!length) return distance(p, a) < radius;
  const t = limit(((p[0] - a[0]) * x + (p[1] - a[1]) * y) / length, 0, 1);
  return distance(p, [a[0] + t * x, a[1] + t * y]) < radius;
}

function segments(stroke) {
  const [a, b] = [stroke.points[0], stroke.points.at(-1)];
  if (stroke.tool === 'rect') return [a, [b[0], a[1]], b, [a[0], b[1]], a];
  if (stroke.tool === 'ellipse') {
    const [cx, cy] = center(a, b);
    return Array.from({ length: 25 }, (_, i) => {
      const angle = i * Math.PI / 12;
      return [cx + (b[0] - a[0]) / 2 * Math.cos(angle), cy + (b[1] - a[1]) / 2 * Math.sin(angle)];
    });
  }
  return stroke.points;
}

function straighten(stroke) {
  const points = stroke.points;
  if (stroke.tool !== 'pen' || points.length < 4) return stroke;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of points) {
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  const width = right - left, height = bottom - top, span = Math.hypot(width, height);
  if (span < 8) return stroke;
  const start = points[0], end = points.at(-1);
  if (distance(start, end) > span * .3 || Math.min(width, height) < span * .12) {
    if (points.every(point => nearSegment(point, start, end, span * .13))) {
      return { ...stroke, tool: 'line', points: [start, end] };
    }
    return stroke;
  }
  let rectangleError = 0, ellipseError = 0;
  for (const [x, y] of points) {
    rectangleError += Math.min(x - left, right - x, y - top, bottom - y);
    ellipseError += Math.abs(Math.hypot(2 * (x - left) / width - 1, 2 * (y - top) / height - 1) - 1) * Math.min(width, height) / 2;
  }
  const tool = rectangleError <= ellipseError ? 'rect' : 'ellipse';
  return { ...stroke, tool, points: [[left, top], [right, bottom]] };
}

export function showExistingMarks(host, mark, width, height) {
  if (!mark) return;
  const scale = width / 1000;
  const layer = svg('svg', { class: 'board-existing-ink', viewBox: '0 0 1000 ' + height / scale });
  layer.append(...(mark.strokes ?? []).map(shapeNode));
  const text = document.createElement('div');
  text.className = 'board-existing-text';
  text.style.transform = 'scale(' + scale + ')';
  for (const item of mark.texts ?? []) {
    const field = document.createElement('span');
    field.textContent = item.text;
    field.style.left = item.x + 'px';
    field.style.top = item.y + 'px';
    field.style.width = (item.width ?? 250) + 'px';
    field.style.fontSize = (item.pt ?? 12) + 'pt';
    if (item.bold) field.style.fontWeight = '700';
    if (item.italic) field.style.fontStyle = 'italic';
    text.append(field);
  }
  host.append(layer, text);
}

export function createSurface(host, content, options) {
  const { settings, commit, notifySelection, notifyText, sideTool, penContact, signal } = options;
  const board = Boolean(options.board);
  const surface = svg('svg', { class: 'ink', 'aria-label': 'Область для рукописи' });
  const ink = svg('g'), preview = svg('g'), overlay = svg('g');
  surface.append(ink, preview, overlay);
  const typing = document.createElement('div');
  typing.className = 'ink-text';
  host.append(surface, typing);
  let view = options.initialView ?? { x: 0, y: 0, zoom: 1 };
  let active;
  let selected = [];
  let selectedOutline = [];
  let state = content;
  const pointers = new Map();
  let gesture;
  let width, height;
  let newTextId;

  function viewport() {
    const scale = board ? view.zoom : host.clientWidth / options.width;
    return { scale: scale || 1, left: board ? view.x : 0, top: board ? view.y : 0 };
  }

  function coordinates(x, y) {
    const rect = surface.getBoundingClientRect();
    const { scale, left, top } = viewport();
    const outer = rect.width / (host.clientWidth || 1) || 1;
    return [((x - rect.left) / outer - left) / scale, ((y - rect.top) / outer - top) / scale];
  }

  function renderView() {
    const { scale, left, top } = viewport();
    width = host.clientWidth;
    height = host.clientHeight;
    surface.setAttribute('viewBox', [0, 0, width || 1, height || 1].join(' '));
    const transform = `translate(${left} ${top}) scale(${scale})`;
    for (const layer of [ink, preview, overlay]) layer.setAttribute('transform', transform);
    for (const layer of options.worldLayers ?? []) layer.style.transform = 'translate(' + left + 'px,' + top + 'px) scale(' + scale + ')';
    typing.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
    host.style.setProperty('--paper-scale', scale);
    host.style.setProperty('--grid-x', left + 'px');
    host.style.setProperty('--grid-y', top + 'px');
  }

  function render() {
    ink.replaceChildren(...(state.strokes ?? []).map(shapeNode));
    overlay.replaceChildren();
    if (selectedOutline.length) overlay.append(svg('polygon', {
      points: selectedOutline.map(line).join(' '), fill: '#7e80f02a', stroke: '#7775e7',
      'stroke-width': 1.5, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke',
    }));
    typing.replaceChildren();
    for (const item of state.texts ?? []) {
      const box = document.createElement('div');
      box.className = 'ink-text-box';
      box.style.left = item.x + 'px';
      box.style.top = item.y + 'px';
      const available = Math.max(48, (board ? Infinity : options.width) - item.x);
      const maxWidth = Math.min(available, 2200);
      const field = document.createElement('textarea');
      const handle = document.createElement('button');
      handle.className = 'text-resize';
      handle.type = 'button';
      handle.setAttribute('aria-label', 'Изменить ширину текстового поля');
      field.value = item.text;
      field.rows = 1;
      field.dataset.textId = item.id;
      field.placeholder = 'Текст…';
      field.setAttribute('aria-label', 'Текст рядом со штрихами');
      let width = limit(item.width ?? 250, 48, maxWidth);
      let snapshotTaken = item.id === newTextId;
      let resize;
      function measure() {
        box.style.width = width + 'px';
        field.style.fontSize = (item.pt ?? 12) + 'pt';
        field.style.fontWeight = item.bold ? '700' : '400';
        field.style.fontStyle = item.italic ? 'italic' : 'normal';
        field.style.height = 'auto';
        field.style.height = field.scrollHeight + 2 + 'px';
      }
      function editFormat(properties) {
        Object.assign(item, properties);
        width = limit(item.width ?? width, 48, maxWidth);
        if (properties.width !== undefined) item.width = width;
        commit(state);
        measure();
        notify();
      }
      function notify() {
        notifyText?.({ id: item.id, pt: item.pt ?? 12, width, bold: item.bold, italic: item.italic, edit: editFormat });
      }
      field.addEventListener('focus', notify);
      field.addEventListener('blur', () => { snapshotTaken = false; });
      field.addEventListener('input', () => {
        item.text = field.value;
        commit(state, !snapshotTaken);
        snapshotTaken = true;
        measure();
      });
      handle.addEventListener('pointerdown', event => {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        resize = { x: event.clientX, width };
        notify();
      });
      handle.addEventListener('pointermove', event => {
        if (!resize) return;
        width = limit(Math.round(resize.width + (event.clientX - resize.x) / (surface.getBoundingClientRect().width / (host.clientWidth || 1) * viewport().scale)), 48, maxWidth);
        measure();
      });
      function endResize(event) {
        if (!resize) return;
        const initial = resize.width;
        resize = null;
        if (event.type === 'pointerup' && width !== initial) editFormat({ width });
        else { width = initial; measure(); }
      }
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(type, endResize);
      handle.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        editFormat({ width: width + (event.key === 'ArrowLeft' ? -10 : 10) });
      });
      box.append(field, handle);
      typing.append(box);
      measure();
    }
    newTextId = undefined;
  }

  function addText(point) {
    const rect = surface.getBoundingClientRect();
    const fallback = coordinates(rect.left + Math.min(width * .18, 115), rect.top + Math.min(height * .28, 180));
    const [x, y] = point ?? fallback;
    const item = { id: crypto.randomUUID(), x: board ? x : limit(x, 0, options.width - 48), y, text: '', pt: settings().textPt ?? 12 };
    newTextId = item.id;
    update({ ...state, texts: [...(state.texts ?? []), item] });
    typing.lastElementChild?.querySelector('textarea')?.focus();
  }

  function update(next) {
    state = next;
    commit(next);
    render();
  }

  function localPoint(event) {
    const [x, y] = coordinates(event.clientX, event.clientY);
    return [x, y, event.pointerType === 'pen' ? limit(event.pressure || 0.45, 0.05, 1) : 0.5, Math.round(event.timeStamp)];
  }

  function zoom(x, y, value) {
    const rect = surface.getBoundingClientRect();
    const point = coordinates(x, y);
    view.zoom = limit(value, 0.15, 6);
    view.x = x - rect.left - point[0] * view.zoom;
    view.y = y - rect.top - point[1] * view.zoom;
    renderView();
  }

  function erase(point) {
    const radius = 16 / viewport().scale;
    for (const stroke of state.strokes ?? []) {
      const points = segments(stroke);
      if (points.some((p, i) => nearSegment(point, p, points[i + 1] ?? p, radius))) active.erased.add(stroke.id);
    }
    Array.from(ink.children).forEach((node, i) => {
      if (active.erased.has(state.strokes[i].id)) node.setAttribute('opacity', '0.18');
    });
  }

  function strokePreview() {
    preview.replaceChildren(active.tool === 'lasso' || active.tool === 'move'
      ? svg('polyline', {
        fill: 'none', stroke: '#7775e7', 'stroke-width': 1.5, 'stroke-dasharray': '5 4',
        'vector-effect': 'non-scaling-stroke', points: active.points.map(line).join(' '),
      }) : shapeNode(active));
  }

  function beginStroke(event, tool) {
    const prefs = settings();
    const point = localPoint(event);
    const onPdf = board && prefs.autoColor && Array.from(host.querySelectorAll('.board-pdf-page')).some(sheet => {
      const r = sheet.getBoundingClientRect();
      return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
    active = {
      id: crypto.randomUUID(), pointer: event.pointerId, pointerType: event.pointerType, tool,
      color: onPdf && tool !== 'highlight' ? '#25242d' : prefs.autoColor ? 'auto' : prefs.color, width: prefs.width, points: [point], erased: new Set(),
      screen: [event.clientX, event.clientY],
    };
    if (tool === 'erase') erase(point);
    else if (tool !== 'hand') strokePreview();
  }

  surface.addEventListener('pointerdown', event => {
    const prefs = settings();
    if (event.pointerType === 'touch' && (board || !prefs.finger)) {
      if (active?.pointerType === 'pen') return;
      event.preventDefault();
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      surface.setPointerCapture(event.pointerId);
      const p = [...pointers.values()];
      gesture = { center: p.length > 1 ? center(...p) : p[0], distance: p.length > 1 ? distance(...p) : 0 };
      return;
    }
    if (active || (event.button !== 0 && event.pointerType !== 'pen')) return;
    if (event.pointerType === 'pen') {
      pointers.clear();
      gesture = null;
      penContact?.();
    }
    const point = localPoint(event);
    let tool = sideTool?.(event, true) ?? prefs.tool;
    if (tool === 'text') {
      event.preventDefault();
      addText(point);
      return;
    }
    if (board && (event.shiftKey || tool === 'hand')) tool = 'hand';
    if (tool === 'lasso' && selected.length && within(point, selectedOutline)) tool = 'move';
    else if (tool !== 'hand') {
      selected = [];
      selectedOutline = [];
      overlay.replaceChildren();
      notifySelection?.([], null);
    }
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    beginStroke(event, tool);
  });

  surface.addEventListener('pointermove', event => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      const p = [...pointers.values()];
      const next = p.length > 1 ? center(...p) : p[0];
      const span = p.length > 1 ? distance(...p) : 0;
      const factor = gesture.distance && span ? span / gesture.distance : 1;
      const dx = next[0] - gesture.center[0], dy = next[1] - gesture.center[1];
      if (board) {
        if (factor !== 1) zoom(...gesture.center, view.zoom * factor);
        view.x += dx;
        view.y += dy;
        renderView();
      } else {
        if (factor !== 1) options.pinch?.(factor, ...gesture.center);
        host.closest('#content')?.scrollBy({ left: -dx, top: -dy, behavior: 'instant' });
      }
      gesture = { center: next, distance: span };
      return;
    }
    if (!active || event.pointerId !== active.pointer) return;
    if (event.pointerType === 'pen') {
      const next = sideTool?.(event, false);
      if (next !== active.tool && ['pen', 'highlight', 'erase'].includes(next) &&
          ['pen', 'highlight', 'erase'].includes(active.tool) && [next, active.tool].includes('erase')) {
        finishStroke(event, true);
        beginStroke(event, next);
      }
    }
    if (active.tool === 'hand') {
      view.x += event.clientX - active.screen[0];
      view.y += event.clientY - active.screen[1];
      active.screen = [event.clientX, event.clientY];
      renderView();
      return;
    }
    const samples = event.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [event]) {
      const point = localPoint(sample);
      if (active.tool === 'erase') erase(point);
      else if (distance(point, active.points.at(-1)) > 0.2) active.points.push(point);
    }
    if (active.tool !== 'erase') strokePreview();
  });

  function end(event) {
    if (pointers.delete(event.pointerId)) {
      const p = [...pointers.values()];
      gesture = p.length ? { center: p.length > 1 ? center(...p) : p[0], distance: p.length > 1 ? distance(...p) : 0 } : null;
    }
    finishStroke(event, event.type === 'pointerup');
  }

  function finishStroke(event, save) {
    if (!active || active.pointer !== event.pointerId) return;
    const { id, points, tool, color, width, erased } = active;
    active = null;
    preview.replaceChildren();
    if (!save) { render(); return; }
    const endPoint = localPoint(event);
    if (distance(endPoint, points.at(-1)) > 0.2) points.push(endPoint);
    if (tool === 'hand') return;
    if (tool === 'erase') {
      if (erased.size) update({ ...state, strokes: (state.strokes ?? []).filter(stroke => !erased.has(stroke.id)) });
      return;
    }
    if (tool === 'lasso') {
      if (points.length < 3) return;
      selected = (state.strokes ?? []).filter(stroke => segments(stroke).some(p => within(p, points)));
      selectedOutline = selected.length ? points : [];
      notifySelection?.(selected, text => {
        const p = selectedOutline[0] ?? [25, 25];
        selected = [];
        selectedOutline = [];
        notifySelection?.([], null);
        update({ ...state, texts: [...(state.texts ?? []), { id: crypto.randomUUID(), x: p[0], y: p[1], text }] });
      }, () => {
        const ids = new Set(selected.map(stroke => stroke.id));
        selected = [];
        selectedOutline = [];
        notifySelection?.([], null);
        update({ ...state, strokes: state.strokes.map(stroke => ids.has(stroke.id) ? straighten(stroke) : stroke) });
      });
      render();
      return;
    }
    if (tool === 'move') {
      const last = points.at(-1);
      const dx = last[0] - points[0][0], dy = last[1] - points[0][1];
      const shift = p => [p[0] + dx, p[1] + dy, ...p.slice(2)];
      const ids = new Set(selected.map(stroke => stroke.id));
      const strokes = state.strokes.map(stroke => ids.has(stroke.id) ? { ...stroke, points: stroke.points.map(shift) } : stroke);
      selected = strokes.filter(stroke => ids.has(stroke.id));
      selectedOutline = selectedOutline.map(shift);
      update({ ...state, strokes });
      return;
    }
    const stroke = { id, points: ['line', 'rect', 'ellipse'].includes(tool) ? [points[0], points.at(-1)] : points, tool, color, width };
    update({ ...state, strokes: [...(state.strokes ?? []), stroke] });
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, end);
  surface.addEventListener('contextmenu', event => event.preventDefault());
  if (board) surface.addEventListener('wheel', event => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) zoom(event.clientX, event.clientY, view.zoom * Math.exp(-event.deltaY * 0.006));
    else {
      view.x -= event.deltaX;
      view.y -= event.deltaY;
      renderView();
    }
  }, { passive: false });
  const resize = new ResizeObserver(renderView);
  resize.observe(host);
  signal?.addEventListener('abort', () => resize.disconnect(), { once: true });
  renderView();
  render();
  return {
    host,
    view: () => ({ ...view }),
    addTextNear(clientX, clientY) {
      const point = coordinates(clientX, clientY);
      const nearby = (state.texts ?? []).filter(item => Math.abs(item.x - point[0]) < 5 && Math.abs(item.y - point[1]) < 160);
      if (nearby.length) point[1] = Math.max(...nearby.map(item => item.y)) + 35;
      addText(point);
    },
    focus(x, y, fitWidth = 0) {
      if (!board) return;
      const zoom = fitWidth ? limit(Math.min(1, (width - 44) / fitWidth), 0.15, 6) : view.zoom;
      view = { x: 22 - x * zoom, y: 49 - y * zoom, zoom };
      renderView();
    },
    zoom(factor) {
      const rect = surface.getBoundingClientRect();
      zoom(rect.x + width / 2, rect.y + height / 2, view.zoom * factor);
    },
    fit() {
      const points = (state.strokes ?? []).flatMap(stroke => stroke.points).concat((state.texts ?? []).map(t => [t.x, t.y]));
      for (const file of options.worldLayers?.[0]?.children ?? []) {
        const x = file.offsetLeft, y = file.offsetTop;
        points.push([x, y], [x + file.offsetWidth, y + file.offsetHeight]);
      }
      if (!points.length) view = { x: 0, y: 0, zoom: 1 };
      else {
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const [x, y] of points) { left = Math.min(x, left); top = Math.min(y, top); right = Math.max(x, right); bottom = Math.max(y, bottom); }
        const zoom = limit(Math.min(width / (right - left + 240), height / (bottom - top + 160)), 0.15, 2);
        view = { zoom, x: (width - (left + right) * zoom) / 2, y: (height - (top + bottom) * zoom) / 2 };
      }
      renderView();
    },
  };
}
