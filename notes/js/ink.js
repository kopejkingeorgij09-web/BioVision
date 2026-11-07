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
  let color = stroke.color === 'auto' || legacyAuto ? (tool === 'highlight' ? '#e8af2d' : 'var(--ink)') : stroke.color;
  if (tool !== 'highlight' && !stroke.fixedColor && color !== '#25242d' && /^#[0-9a-f]{6}$/i.test(color)) {
    const rgb = color.slice(1).match(/../g).map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    if (luminance > .60) color = 'var(--light-ink-fallback,' + color + ')';
    else if (luminance < .13) color = 'var(--dark-ink-fallback,' + color + ')';
  }
  const [x1, y1] = points[0], [x2, y2] = points.at(-1);
  const attrs = { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  if (tool === 'line') return svg('line', { ...attrs, x1, y1, x2, y2 });
  if (tool === 'rect') return svg('rect', { ...attrs, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
  if (tool === 'ellipse') return svg('ellipse', { ...attrs, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, rx: Math.abs(x2 - x1) / 2, ry: Math.abs(y2 - y1) / 2 });
  if (stroke.geometry === 'polygon') return svg('polygon', { ...attrs, points: points.map(line).join(' ') });
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

function segmentDistance(p, a, b) {
  const x = b[0] - a[0], y = b[1] - a[1], length = x * x + y * y;
  if (!length) return distance(p, a);
  const t = limit(((p[0] - a[0]) * x + (p[1] - a[1]) * y) / length, 0, 1);
  return distance(p, [a[0] + t * x, a[1] + t * y]);
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

function simplify(points, tolerance) {
  let farthest = tolerance, split = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const error = segmentDistance(points[i], points[0], points.at(-1));
    if (error > farthest) { farthest = error; split = i; }
  }
  if (split === -1) return [points[0], points.at(-1)];
  return simplify(points.slice(0, split + 1), tolerance).slice(0, -1).concat(simplify(points.slice(split), tolerance));
}

function evenSamples(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  const length = lengths.at(-1);
  let i = 1;
  const samples = Array.from({ length: 65 }, (_, index) => {
    const target = length * index / 64;
    while (lengths[i] < target && i < points.length - 1) i++;
    const fraction = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    const a = points[i - 1], b = points[i];
    return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  });
  return { length, samples };
}

function regularRectangle(corners) {
  const [a, b, c, d] = corners;
  const x = b[0] - a[0] + c[0] - d[0], y = b[1] - a[1] + c[1] - d[1];
  const angle = Math.atan2(y, x), u = [Math.cos(angle), Math.sin(angle)], v = [-u[1], u[0]];
  const project = ([x, y], axis) => x * axis[0] + y * axis[1];
  const us = corners.map(p => project(p, u)), vs = corners.map(p => project(p, v));
  const midU = (Math.min(...us) + Math.max(...us)) / 2, midV = (Math.min(...vs) + Math.max(...vs)) / 2;
  let halfU = (Math.max(...us) - Math.min(...us)) / 2, halfV = (Math.max(...vs) - Math.min(...vs)) / 2;
  if (Math.min(halfU, halfV) >= Math.max(halfU, halfV) * .84) halfU = halfV = (halfU + halfV) / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
    const s = midU + i * halfU, t = midV + j * halfV;
    return [s * u[0] + t * v[0], s * u[1] + t * v[1]];
  });
}

function straighten(stroke) {
  if (stroke.tool !== 'pen' || stroke.geometry || stroke.points.length < 2) return stroke;
  const { length, samples: points } = evenSamples(stroke.points);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of points) {
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  const width = right - left, height = bottom - top, span = Math.hypot(width, height);
  if (span < 22) return stroke;
  const start = points[0], end = points.at(-1);
  const gap = distance(start, end);
  if (gap >= span * .78 && length <= gap * 1.5 &&
      points.every(point => segmentDistance(point, start, end) <= gap * .10)) {
    const finish = [...end];
    if (Math.abs(end[0] - start[0]) < gap * .07) finish[0] = start[0];
    if (Math.abs(end[1] - start[1]) < gap * .07) finish[1] = start[1];
    return { ...stroke, tool: 'line', points: [start, finish] };
  }
  if (gap > span * .26 || Math.min(width, height) < span * .19 || length < span * 1.9 || length > span * 3.5) return stroke;

  // Start at the point farthest from the seam, then simplify both halves of the loop.
  const seam = center(start, end);
  const opposite = points.reduce((far, point, i) => distance(point, seam) > distance(points[far], seam) ? i : far, 0);
  const ring = points.slice(opposite, -1).concat([seam], points.slice(1, opposite + 1));
  const split = points.length - opposite - 1;
  const vertices = simplify(ring.slice(0, split + 1), span * .07).slice(0, -1)
    .concat(simplify(ring.slice(split), span * .07).slice(0, -1));
  const corners = vertices.filter((point, i) =>
    segmentDistance(point, vertices[(i + vertices.length - 1) % vertices.length], vertices[(i + 1) % vertices.length]) > span * .05);
  const area = Math.abs(corners.reduce((sum, [x, y], i) => {
    const [a, b] = corners[(i + 1) % corners.length];
    return sum + x * b - y * a;
  }, 0)) / 2;
  const closesPolygon = area > width * height * .28 &&
    corners.every((p, i) => distance(p, corners[(i + 1) % corners.length]) > span * .16);
  if (closesPolygon && (corners.length === 3 || corners.length === 4)) {
    let polygon = corners;
    if (corners.length === 4) {
      const nearlyRight = corners.every((p, i) => {
        const prev = corners[(i + 3) % 4], next = corners[(i + 1) % 4];
        const dot = (prev[0] - p[0]) * (next[0] - p[0]) + (prev[1] - p[1]) * (next[1] - p[1]);
        return Math.abs(dot) / (distance(p, prev) * distance(p, next)) < .48;
      });
      polygon = nearlyRight ? regularRectangle(corners) : null;
    }
    if (polygon) {
      const closed = polygon.concat([polygon[0]]).map(([x, y]) => [x, y, .5]);
      return { ...stroke, geometry: 'polygon', points: closed };
    }
  }

  const radialErrors = points.map(([x, y]) => Math.abs(Math.hypot(2 * (x - left) / width - 1, 2 * (y - top) / height - 1) - 1));
  if (area < width * height * .45 || Math.max(...radialErrors) > .30 ||
      radialErrors.reduce((sum, value) => sum + value, 0) / points.length > .12) return stroke;
  if (Math.min(width, height) >= Math.max(width, height) * .83) {
    const cx = (left + right) / 2, cy = (top + bottom) / 2, radius = (width + height) / 4;
    return { ...stroke, tool: 'ellipse', points: [[cx - radius, cy - radius], [cx + radius, cy + radius]] };
  }
  return { ...stroke, tool: 'ellipse', points: [[left, top], [right, bottom]] };
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
  const { settings, commit, notifySelection, showSelection, clipboard, notifyText, sideTool, penContact, signal } = options;
  const board = Boolean(options.board);
  const surface = svg('svg', { class: 'ink', 'aria-label': 'Область для рукописи' });
  const ink = svg('g'), preview = svg('g'), overlay = svg('g');
  surface.append(ink, preview, overlay);
  const typing = document.createElement('div');
  typing.className = 'ink-text';
  host.append(surface, typing);
  let view = options.initialView ?? { x: 0, y: 0, zoom: 1 };
  let lastView = { ...view };
  let active;
  let shapeTimer;
  let hold;
  let selected = [];
  let selectedTexts = [];
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
    if (board && (view.x !== lastView.x || view.y !== lastView.y || view.zoom !== lastView.zoom)) {
      lastView = { ...view };
      options.onViewChange?.(lastView);
    }
    positionSelection();
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
      box.classList.toggle('lasso-target', settings().tool === 'lasso');
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

  function clearSelection() {
    selected = [];
    selectedTexts = [];
    selectedOutline = [];
    showSelection?.(null);
    notifySelection?.([], null);
  }

  function selectionData() {
    return { strokes: selected, texts: selectedTexts };
  }

  function shifted(data, dx, dy, duplicate) {
    return {
      strokes: data.strokes.map(stroke => ({
        ...stroke, id: duplicate ? crypto.randomUUID() : stroke.id,
        points: stroke.points.map(([x, y, ...sample]) => [x + dx, y + dy, ...sample]),
      })),
      texts: data.texts.map(text => ({
        ...text, id: duplicate ? crypto.randomUUID() : text.id, x: text.x + dx, y: text.y + dy,
      })),
    };
  }

  function removeSelected() {
    const ids = new Set([...selected, ...selectedTexts].map(item => item.id));
    clearSelection();
    update({
      ...state,
      strokes: (state.strokes ?? []).filter(stroke => !ids.has(stroke.id)),
      texts: (state.texts ?? []).filter(text => !ids.has(text.id)),
    });
  }

  function appendCopies(data, dx, dy, selectCopy = false) {
    const copy = shifted(data, dx, dy, true);
    clearSelection();
    update({
      ...state,
      strokes: [...(state.strokes ?? []), ...copy.strokes],
      texts: [...(state.texts ?? []), ...copy.texts],
    });
    if (selectCopy) {
      selected = copy.strokes;
      selectedTexts = copy.texts;
      const xs = [], ys = [];
      for (const stroke of selected) for (const [x, y] of segments(stroke)) { xs.push(x); ys.push(y); }
      for (const text of selectedTexts) {
        const box = typing.querySelector('[data-text-id="' + CSS.escape(text.id) + '"]').parentElement;
        xs.push(text.x, text.x + box.offsetWidth); ys.push(text.y, text.y + box.offsetHeight);
      }
      const bounds = values => values.reduce(([min, max], value) => [Math.min(min, value), Math.max(max, value)], [Infinity, -Infinity]);
      const [l, r] = bounds(xs), [t, b] = bounds(ys);
      selectedOutline = [[l - 8, t - 8], [r + 8, t - 8], [r + 8, b + 8], [l - 8, b + 8]];
      render();
      positionSelection();
    }
  }

  function positionSelection() {
    if (!selectedOutline.length || active) return;
    const rect = surface.getBoundingClientRect();
    const { scale, left, top } = viewport();
    const outer = rect.width / (host.clientWidth || 1) || 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of selectedOutline) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    showSelection?.({
      host, x: rect.left + (left + (minX + maxX) / 2 * scale) * outer,
      top: rect.top + (top + minY * scale) * outer,
      bottom: rect.top + (top + maxY * scale) * outer,
      duplicate: () => appendCopies(selectionData(), 18, 18),
      delete: removeSelected,
      copy: () => clipboard?.write(selectionData(), false),
      cut: () => { clipboard?.write(selectionData(), true); removeSelected(); },
    });
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
      if (points.some((p, i) => segmentDistance(point, p, points[i + 1] ?? p) < radius)) active.erased.add(stroke.id);
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
      }) : shapeNode(active.shape ?? active));
  }

  function waitForShape(event) {
    if (active.tool !== 'pen' || !settings().holdShapes || active.shape) return;
    const screen = [event.clientX, event.clientY];
    if (distance(screen, active.screen) < 5) return;
    active.screen = screen;
    clearTimeout(shapeTimer);
    const stroke = active;
    shapeTimer = setTimeout(() => {
      if (active !== stroke || signal?.aborted) return;
      const shape = straighten(stroke);
      if (shape === stroke) return;
      stroke.shape = shape;
      strokePreview();
    }, 500);
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
      color: onPdf && tool !== 'highlight' ? '#25242d' : prefs.autoColor ? 'auto' : prefs.color,
      fixedColor: onPdf, width: prefs.width, points: [point], erased: new Set(),
      screen: [event.clientX, event.clientY],
    };
    if (tool === 'move') {
      const ids = new Set(selected.map(stroke => stroke.id));
      const textIds = new Set(selectedTexts.map(text => text.id));
      active.ink = Array.from(ink.children).filter((_, index) => ids.has(state.strokes[index].id));
      active.text = Array.from(typing.children).filter(box => textIds.has(box.firstElementChild.dataset.textId));
    } else if (tool === 'erase') erase(point);
    else if (tool !== 'hand' && tool !== 'text') strokePreview();
  }

  function cancelHold() {
    clearTimeout(hold?.timer);
    hold = undefined;
  }

  function pasteAt(data, targetX, targetY) {
    const points = data.strokes.flatMap(stroke => stroke.points).concat(data.texts.map(text => [text.x, text.y]));
    if (!points.length) return;
    const left = points.reduce((min, point) => Math.min(min, point[0]), Infinity);
    const top = points.reduce((min, point) => Math.min(min, point[1]), Infinity);
    appendCopies(data, targetX - left, targetY - top, true);
  }

  function offerPaste(x, y) {
    if (!clipboard?.has()) return;
    clipboard.offer(host, x, y, data => pasteAt(data, ...coordinates(x, y)));
  }

  surface.addEventListener('pointerdown', event => {
    const prefs = settings();
    clipboard?.dismiss();
    const point = localPoint(event);
    const inside = prefs.tool === 'lasso' && selectedOutline.length && within(point, selectedOutline);
    if (event.pointerType === 'touch' && !active && !pointers.size && clipboard?.has()) {
      const { pointerId, clientX, clientY } = event;
      hold = { pointerId, clientX, clientY, timer: setTimeout(() => {
        cancelHold();
        clearTimeout(shapeTimer);
        pointers.delete(pointerId);
        gesture = null;
        if (active?.pointer === pointerId) { active = null; preview.replaceChildren(); render(); }
        offerPaste(clientX, clientY);
      }, 500) };
    } else cancelHold();
    if (event.pointerType === 'touch' && !inside && (board || !prefs.finger)) {
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
      if (event.button === 2 && !event.pressure && !(event.buttons & 1)) return;
      pointers.clear();
      gesture = null;
      penContact?.();
    }
    let tool = sideTool?.(event, true) ?? prefs.tool;
    if (tool === 'text') {
      event.preventDefault();
      if (hold) {
        surface.setPointerCapture(event.pointerId);
        beginStroke(event, 'text');
      } else addText(point);
      return;
    }
    if (board && (event.shiftKey || tool === 'hand')) tool = 'hand';
    if (tool === 'lasso' && selectedOutline.length && within(point, selectedOutline)) { tool = 'move'; showSelection?.(null); }
    else if (tool !== 'hand') {
      clearSelection();
      overlay.replaceChildren();
    }
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    beginStroke(event, tool);
  });

  surface.addEventListener('pointermove', event => {
    if (hold?.pointerId === event.pointerId && Math.hypot(event.clientX - hold.clientX, event.clientY - hold.clientY) > 9) cancelHold();
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
    if (active.tool === 'text') return;
    if (active.tool === 'move') {
      const [x, y] = localPoint(event), [startX, startY] = active.points[0];
      const dx = x - startX, dy = y - startY;
      for (const node of [...active.ink, overlay.firstElementChild]) node?.setAttribute('transform', `translate(${dx} ${dy})`);
      for (const node of active.text) node.style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }
    if (event.pointerType === 'pen') {
      const next = sideTool?.(event);
      if (next !== active.tool && ['pen', 'highlight', 'erase'].includes(next) &&
          ['pen', 'highlight', 'erase'].includes(active.tool) && [next, active.tool].includes('erase')) {
        finishStroke(event, true);
        beginStroke(event, next);
      }
    }
    if (active.shape) return;
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
    if (active.tool !== 'erase') {
      strokePreview();
      waitForShape(event);
    }
  });

  function end(event) {
    if (hold?.pointerId === event.pointerId) cancelHold();
    if (pointers.delete(event.pointerId)) {
      const p = [...pointers.values()];
      gesture = p.length ? { center: p.length > 1 ? center(...p) : p[0], distance: p.length > 1 ? distance(...p) : 0 } : null;
    }
    finishStroke(event, event.type === 'pointerup');
  }

  function finishStroke(event, save) {
    if (!active || active.pointer !== event.pointerId) return;
    const { id, points, tool, color, fixedColor, width, erased, shape } = active;
    clearTimeout(shapeTimer);
    active = null;
    preview.replaceChildren();
    if (!save) { render(); positionSelection(); return; }
    if (tool === 'text') { addText(points[0]); return; }
    const endPoint = localPoint(event);
    if (distance(endPoint, points.at(-1)) > 0.2) points.push(endPoint);
    if (tool === 'hand') return;
    if (tool === 'erase') {
      if (erased.size) update({ ...state, strokes: (state.strokes ?? []).filter(stroke => !erased.has(stroke.id)) });
      return;
    }
    if (tool === 'lasso') {
      if (points.length < 3) return;
      selected = (state.strokes ?? []).filter(stroke => segments(stroke).some(point => within(point, points)));
      const boxes = Array.from(typing.children);
      selectedTexts = (state.texts ?? []).filter((text, index) => {
        const width = boxes[index]?.offsetWidth ?? text.width ?? 250;
        const height = boxes[index]?.offsetHeight ?? 30;
        const right = text.x + width, bottom = text.y + height;
        const corners = [[text.x, text.y], [right, text.y], [text.x, bottom], [right, bottom], [text.x + width / 2, text.y + height / 2]];
        return corners.some(point => within(point, points)) ||
          points.some(([x, y]) => x >= text.x && x <= right && y >= text.y && y <= bottom);
      });
      selectedOutline = selected.length || selectedTexts.length ? points : [];
      notifySelection?.(selected, text => {
        const p = selectedOutline[0] ?? [25, 25];
        clearSelection();
        update({ ...state, texts: [...(state.texts ?? []), { id: crypto.randomUUID(), x: p[0], y: p[1], text }] });
      }, () => {
        const ids = new Set(selected.map(stroke => stroke.id));
        clearSelection();
        update({ ...state, strokes: state.strokes.map(stroke => ids.has(stroke.id) ? straighten(stroke) : stroke) });
      });
      render();
      positionSelection();
      return;
    }
    if (tool === 'move') {
      const last = points.at(-1);
      const dx = last[0] - points[0][0], dy = last[1] - points[0][1];
      if (Math.hypot(dx, dy) <= .2) { render(); positionSelection(); return; }
      const moved = shifted(selectionData(), dx, dy, false);
      const strokes = new Map(moved.strokes.map(item => [item.id, item]));
      const texts = new Map(moved.texts.map(item => [item.id, item]));
      selected = moved.strokes;
      selectedTexts = moved.texts;
      selectedOutline = selectedOutline.map(([x, y]) => [x + dx, y + dy]);
      update({
        ...state,
        strokes: (state.strokes ?? []).map(item => strokes.get(item.id) ?? item),
        texts: (state.texts ?? []).map(item => texts.get(item.id) ?? item),
      });
      positionSelection();
      return;
    }
    const stroke = shape
      ? { id, points: shape.points, tool: shape.tool, color, width, ...(shape.geometry ? { geometry: shape.geometry } : {}) }
      : { id, points: ['line', 'rect', 'ellipse'].includes(tool) ? [points[0], points.at(-1)] : points, tool, color, width };
    if (fixedColor) stroke.fixedColor = true;
    update({ ...state, strokes: [...(state.strokes ?? []), stroke] });
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, end);
  surface.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (event.pointerType !== 'touch' && event.button === 2) offerPaste(event.clientX, event.clientY);
  });
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
  host.closest('#content')?.addEventListener('scroll', positionSelection, { passive: true, signal });
  signal?.addEventListener('abort', () => { cancelHold(); clearTimeout(shapeTimer); resize.disconnect(); showSelection?.(null); }, { once: true });
  renderView();
  render();
  return {
    host,
    camera() {
      return { x: (width / 2 - view.x) / view.zoom, y: (height / 2 - view.y) / view.zoom,
        zoom: view.zoom, width: width / view.zoom, height: height / view.zoom };
    },
    jump(x, y, zoom = view.zoom) {
      if (!board) return;
      zoom = limit(zoom, .15, 6);
      view = { x: width / 2 - x * zoom, y: height / 2 - y * zoom, zoom };
      renderView();
    },
    deselect() { clearSelection(); render(); },
    paste(data) {
      const rect = host.getBoundingClientRect(), area = host.closest('#content').getBoundingClientRect();
      const x = Math.max(rect.left, area.left), y = Math.max(rect.top, area.top);
      pasteAt(data, ...coordinates(x + 26, y + 60));
    },
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
