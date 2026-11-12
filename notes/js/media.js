import { attachmentBlob } from './cloud.js';
import { createSurface, showExistingMarks } from './ink.js';
import { button, element } from './text.js';

const pdfResources = document.documentElement.dataset.bundled === 'true'
  ? new URL('./vendor/pdfjs/', location.href).href
  : 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/';
export const pdfBase = pdfResources + 'legacy/build/';
export const maxFile = 50 * 1024 * 1024;
const extensions = {
  pdf: 'application/pdf', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', webm: 'video/webm',
  mov: 'video/quicktime', m4v: 'video/x-m4v',
};

export function describeFile(file) {
  const mime = extensions[file.name.split('.').at(-1).toLowerCase()]
    ?? Object.values(extensions).find(type => type === file.type);
  if (!mime) throw new Error('Формат не поддерживается: ' + file.name);
  if (file.size > maxFile) throw new Error('Файл больше 50 МБ: ' + file.name);
  if (!file.size) throw new Error('Пустой файл: ' + file.name);
  return { id: crypto.randomUUID(), name: file.name, mime, size: file.size, marks: {} };
}

let pdfModule;
export async function pdfDocument(blob) {
  pdfModule ??= import(pdfBase + 'pdf.mjs').catch(error => {
    pdfModule = null;
    throw error;
  });
  const pdf = await pdfModule;
  pdf.GlobalWorkerOptions.workerSrc = pdfBase + 'pdf.worker.mjs';
  return pdf.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false,
    cMapUrl: pdfResources + 'cmaps/', cMapPacked: true, standardFontDataUrl: pdfResources + 'standard_fonts/',
    wasmUrl: pdfResources + 'wasm/',
  });
}

const indexedPdfs = new Map();
export function pdfSearchPages(library, id) {
  const key = library + ':' + id;
  if (!indexedPdfs.has(key)) {
    const pending = (async () => {
      const task = await pdfDocument(await attachmentBlob(library, id));
      try {
        const pdf = await task.promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map(item => item.str ?? '').join(' ').trim());
          page.cleanup();
        }
        return pages;
      } finally { await task.destroy(); }
    })().catch(error => { indexedPdfs.delete(key); throw error; });
    if (indexedPdfs.size >= 24) indexedPdfs.delete(indexedPdfs.keys().next().value);
    indexedPdfs.set(key, pending);
  }
  return indexedPdfs.get(key);
}

export async function openMedia(root, attachment, options) {
  const { library, signal, surfaceOptions, onMark, close, message } = options;
  const view = element('div', undefined, 'viewer');
  const controls = element('div', undefined, 'controls');
  const loading = element('p', 'Загрузка вложения…', 'muted');
  view.append(controls, loading);
  controls.append(button('← К заметке', close), element('strong', attachment.name));
  root.append(view);

  let pageView;
  let paperSignal;
  function show(content, width, key) {
    paperSignal?.abort();
    paperSignal = new AbortController();
    pageView?.remove();
    const paper = element('div', undefined, 'paper mark-file' + (attachment.mime === 'application/pdf' ? ' pdf-paper' : ''));
    paper.append(content);
    view.append(paper);
    pageView = paper;
    const surface = createSurface(paper, attachment.marks[key] ?? { strokes: [], texts: [] }, {
      ...surfaceOptions, signal: paperSignal.signal, width,
      commit(mark, history) {
        attachment.marks[key] = mark;
        onMark(attachment, history);
      },
    });
    options.onSurface?.(surface);
  }

  signal.addEventListener('abort', () => paperSignal?.abort(), { once: true });
  let blob;
  try {
    blob = await attachmentBlob(library, attachment.id, attachment);
    if (signal.aborted) return;
    loading.remove();
    const url = URL.createObjectURL(blob);
    signal.addEventListener('abort', () => URL.revokeObjectURL(url), { once: true });
    const download = element('a', 'Скачать оригинал');
    download.href = url;
    download.download = attachment.name;
    controls.append(download);

    if (attachment.mime === 'application/pdf') {
      loading.textContent = 'Подготовка страниц PDF…';
      view.append(loading);
      const task = await pdfDocument(blob);
      if (signal.aborted) { await task.destroy(); return; }
      signal.addEventListener('abort', () => void task.destroy(), { once: true });
      const document = await task.promise;
      if (signal.aborted) return;
      let page = 1, generation = 0, painting;
      const number = element('span');
      const prev = button('‹', () => draw(page - 1).catch(report));
      const next = button('›', () => draw(page + 1).catch(report));
      controls.append(prev, number, next);
      async function draw(index) {
        if (index < 1 || index > document.numPages || signal.aborted) return;
        page = index;
        options.onPage?.(page);
        number.textContent = page + ' / ' + document.numPages;
        prev.disabled = page === 1;
        next.disabled = page === document.numPages;
        const mine = ++generation;
        painting?.cancel();
        const content = await document.getPage(index);
        if (signal.aborted || mine !== generation) return;
        const canvas = element('canvas');
        const natural = content.getViewport({ scale: 1 });
        const pixels = Math.max(1300, Math.min(8192, Math.floor(Math.sqrt(24000000 * natural.width / natural.height)), root.clientWidth * (devicePixelRatio || 1) * 2));
        const viewport = content.getViewport({ scale: pixels / natural.width });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        painting = content.render({ canvas, canvasContext: canvas.getContext('2d'), viewport });
        await painting.promise;
        if (signal.aborted || mine !== generation) return;
        loading.remove();
        show(canvas, 1000, 'page-' + index);
      }
      function report(error) {
        if (!signal.aborted && error.name !== 'RenderingCancelledException') message(error.message);
      }
      await draw(Math.min(document.numPages, Math.max(1, options.initialPage ?? 1)));
      return;
    }

    if (attachment.mime === 'text/plain') {
      const text = await blob.text();
      if (signal.aborted) return;
      const lines = text.split(/\r?\n/).flatMap(line => line.match(/.{1,140}/gu) ?? ['']);
      const count = Math.ceil(lines.length / 42);
      let index = 0;
      const label = element('span');
      const prev = button('‹', () => draw(index - 1));
      const next = button('›', () => draw(index + 1));
      if (count > 1) controls.append(prev, label, next);
      function draw(page) {
        index = page;
        label.textContent = (index + 1) + ' / ' + count;
        prev.disabled = index === 0;
        next.disabled = index === count - 1;
        show(element('pre', lines.slice(index * 42, (index + 1) * 42).join('\n')), 1000, 'text-' + index);
      }
      draw(0);
      return;
    }

    if (attachment.mime.startsWith('image/')) {
      const image = element('img');
      image.alt = attachment.name;
      image.src = url;
      await image.decode();
      if (!signal.aborted) show(image, 1000, 'image');
      return;
    }

    const video = element('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    view.append(video);
    signal.addEventListener('abort', () => { video.pause(); video.removeAttribute('src'); video.load(); }, { once: true });
    const frameControls = element('div', undefined, 'controls frame-controls');
    const frames = element('select');
    frames.setAttribute('aria-label', 'Пометки к кадрам');
    const caption = element('span');
    function fill() {
      const options = [new Option('Пометки по времени', '')];
      for (const key of Object.keys(attachment.marks).sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))) {
        options.push(new Option((Number(key.slice(6)) / 1000).toFixed(2) + ' с', key));
      }
      frames.replaceChildren(...options);
    }
    function capture(key) {
      if (!video.videoWidth || video.readyState < 2) return message('Дождись загрузки кадра');
      video.pause();
      const canvas = element('canvas');
      canvas.width = Math.min(1400, video.videoWidth);
      canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      caption.textContent = 'Кадр на ' + (Number(key.slice(6)) / 1000).toFixed(2) + ' с';
      show(canvas, 1000, key);
    }
    let sought = '';
    video.addEventListener('seeked', () => {
      if (!sought) return;
      capture(sought);
      sought = '';
    });
    video.addEventListener('play', () => { pageView?.remove(); paperSignal?.abort(); caption.textContent = ''; fill(); });
    video.addEventListener('error', () => message('Этот формат видео не воспроизводится на устройстве'));
    frames.addEventListener('change', () => {
      if (!frames.value) return;
      video.pause();
      const time = Number(frames.value.slice(6)) / 1000;
      if (Math.abs(video.currentTime - time) < .001) capture(frames.value);
      else { sought = frames.value; video.currentTime = time; }
    });
    frameControls.append(button('Пометить кадр', () => capture('frame-' + Math.round(video.currentTime * 1000))), frames, caption);
    view.append(frameControls);
    fill();
  } catch (error) {
    if (signal.aborted) return;
    loading.textContent = 'Не удалось открыть вложение. ' + error.message;
    if (!loading.isConnected) view.append(loading);
  }
}


export const boardFileWidth = 720;

function editBoardFile(panel, tools, file, options) {
  tools.classList.add('board-image-tools');
  panel.classList.add('board-image-panel');
  const move = button('Переместить', () => {});
  move.className = 'board-image-move';
  move.setAttribute('aria-label', 'Переместить изображение ' + file.name);
  const resize = button('↘', () => {});
  resize.className = 'board-image-resize';
  resize.setAttribute('aria-label', 'Изменить размер изображения ' + file.name);
  const document = file.mime === 'application/pdf';
  const label = document ? 'PDF' : file.mime.startsWith('video/') ? 'видео' : 'изображение';
  move.setAttribute('aria-label', 'Переместить ' + label + ' ' + file.name);
  resize.setAttribute('aria-label', 'Изменить размер ' + label + ' ' + file.name);
  const size = button('Размер ↔', () => {});
  size.className = 'board-file-size';
  size.setAttribute('aria-label', 'Изменить размер ' + label + ' сверху');
  tools.append(move, size, resize);
  if (document) { tools.classList.add('board-document-tools'); panel.classList.add('board-document'); }
  let gesture, frame = 0;

  function layout([x, y, width]) {
    width = Math.max(64, Math.min(4000, width));
    for (const node of [panel, tools]) {
      node.style.left = x + 'px'; node.style.top = y + 'px'; node.style.width = width + 'px';
    }
    panel.style.setProperty('--image-scale', width / boardFileWidth);
    tools.style.height = panel.offsetHeight + 'px';
    for (const text of panel.querySelectorAll('.board-existing-text')) text.style.transform = 'scale(' + width / 1000 + ')';
    options.host.dispatchEvent(new Event('boardviewchange'));
  }
  const object = {
    id: file.id,
    lasso: file.mime.startsWith('image/'),
    bounds() {
      const width = file.boardWidth ?? boardFileWidth;
      return [file.boardPosition.x, file.boardPosition.y, width, panel.offsetHeight * width / (parseFloat(panel.style.width) || width)];
    },
    preview: layout,
    commit(bounds) {
      const width = Math.max(64, Math.min(4000, bounds[2]));
      file.boardPosition = { x: bounds[0], y: bounds[1] };
      file.boardWidth = width;
      layout([bounds[0], bounds[1], width]);
      return { boardPosition: { ...file.boardPosition }, boardWidth: width };
    },
  };
  layout(object.bounds());
  options.registerObject?.(object);

  function nextBounds(event) {
    const { bounds, start, mode, zoom } = gesture;
    const dx = (event.clientX - start[0]) / zoom, dy = (event.clientY - start[1]) / zoom;
    if (mode === 'move') return [bounds[0] + dx, bounds[1] + dy, bounds[2], bounds[3]];
    const aspect = bounds[3] / bounds[2];
    const width = Math.max(64, Math.min(4000, bounds[2] + (dx + dy * aspect) / (1 + aspect * aspect)));
    return [bounds[0], bounds[1], width, bounds[3] * width / bounds[2]];
  }
  for (const [handle, mode] of [[move, 'move'], [size, 'resize'], [resize, 'resize']]) {
    handle.addEventListener('pointerdown', event => {
      if (gesture || (event.button !== 0 && event.pointerType !== 'pen')) return;
      event.preventDefault(); event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      options.onInteraction?.(true);
      gesture = { pointer: event.pointerId, bounds: object.bounds(), start: [event.clientX, event.clientY], mode,
        zoom: options.boardView?.().zoom ?? 1 };
    }, { signal: options.signal });
    handle.addEventListener('pointermove', event => {
      if (!gesture || gesture.pointer !== event.pointerId) return;
      event.preventDefault(); gesture.next = nextBounds(event);
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (gesture) layout(gesture.next); });
    }, { signal: options.signal });
    function finish(event) {
      if (!gesture || gesture.pointer !== event.pointerId) return;
      cancelAnimationFrame(frame); frame = 0;
      const before = gesture.bounds, after = nextBounds(event);
      gesture = null;
      if (event.type === 'pointerup' && after.some((value, i) => Math.abs(value - before[i]) > .1)) {
        object.commit(after); options.onTransform?.(file);
      } else layout(before);
      options.onInteraction?.(false);
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(type, finish, { signal: options.signal });
    handle.addEventListener('keydown', event => {
      if (gesture) return;
      const bounds = object.bounds();
      const step = event.shiftKey ? 20 : 5;
      if (mode === 'move' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        bounds[0] += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        bounds[1] += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      } else if (mode === 'resize' && ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); bounds[2] *= ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1.05 : 1 / 1.05;
      } else return;
      object.commit(bounds); options.onTransform?.(file);
    }, { signal: options.signal });
  }
  options.signal.addEventListener('abort', () => { cancelAnimationFrame(frame); gesture = null; options.onInteraction?.(false); }, { once: true });
}

export function boardFilesWithPositions(files) {
  let nextX = Math.max(70, ...files.map(file => file.boardPosition ? file.boardPosition.x + 800 : 70));
  return files.map(file => {
    if (file.boardPosition) return file;
    const placed = { ...file, boardPosition: { x: nextX, y: 80 } };
    nextX += 800;
    return placed;
  });
}

export async function mountBoardFile(content, controls, file, options) {
  const { signal, library, host, surfaceOptions, onMark, onSurface } = options;
  const { x, y } = file.boardPosition;
  const panel = element('section', undefined, 'board-file');
  const tools = element('div', undefined, 'board-file-controls');
  for (const node of [panel, tools]) {
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    node.style.width = (file.boardWidth ?? boardFileWidth) + 'px';
  }
  panel.dataset.attachment = file.id;
  const title = element('div', file.name, 'board-file-title');
  const status = element('p', 'Загрузка…', 'muted');
  panel.append(title, status);
  content.append(panel);
  controls.append(tools);
  try {
    const blob = await attachmentBlob(library, file.id, file);
    if (signal.aborted) return;
    status.remove();

    if (file.mime === 'application/pdf') {
      const task = await pdfDocument(blob);
      if (signal.aborted) { await task.destroy(); return; }
      signal.addEventListener('abort', () => void task.destroy().catch(() => {}), { once: true });
      const pdf = await task.promise;
      if (signal.aborted) return;
      const queued = new WeakMap();
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const sheet = queued.get(entry.target);
          if (!sheet) continue;
          sheet.visible = entry.isIntersecting;
          if (sheet.visible) void sheet.render();
          else {
            sheet.task?.cancel();
            sheet.canvas?.remove();
            sheet.canvas = null;
          }
        }
      }, { root: host, rootMargin: '280px' });
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
      for (let start = 1; start <= pdf.numPages && !signal.aborted; start += 12) {
        const pages = await Promise.all(Array.from({ length: Math.min(12, pdf.numPages - start + 1) }, (_, offset) => pdf.getPage(start + offset)));
        if (signal.aborted) return;
        for (const [offset, page] of pages.entries()) {
          const number = start + offset;
          const natural = page.getViewport({ scale: 1 });
          const height = Math.round(boardFileWidth * natural.height / natural.width);
          const sheet = element('section', undefined, 'board-pdf-page');
          sheet.dataset.page = number;
          sheet.style.aspectRatio = natural.width + ' / ' + natural.height;
          sheet.style.height = 'auto';
          sheet.setAttribute('aria-label', 'Страница ' + number + ' из ' + pdf.numPages);
          const tag = element('small', number + ' / ' + pdf.numPages, 'board-page-number');
          sheet.append(tag);
          showExistingMarks(sheet, file.marks?.['page-' + number], boardFileWidth, height);
          panel.append(sheet);
          const state = {
            visible: false, canvas: null, task: null, failed: false, pixels: 0,
            resolution() {
              const zoom = options.boardView?.().zoom ?? 1;
              const desired = Math.ceil((file.boardWidth ?? boardFileWidth) * zoom * (devicePixelRatio || 1));
              return Math.max(1100, Math.min(8192, Math.floor(Math.sqrt(24000000 * natural.width / natural.height)), desired));
            },
            async render() {
              const pixels = state.resolution();
              if (state.task || state.failed || signal.aborted || (state.canvas && state.pixels >= pixels)) return;
              const canvas = element('canvas');
              const viewport = page.getViewport({ scale: pixels / natural.width });
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              try {
                state.task = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport });
                await state.task.promise;
                if (!signal.aborted && state.visible) {
                  state.canvas?.remove();
                  state.canvas = canvas; state.pixels = pixels;
                  sheet.prepend(canvas);
                }
              } catch (error) {
                if (!signal.aborted && error.name !== 'RenderingCancelledException') {
                  state.failed = true;
                  sheet.append(element('p', 'Не удалось показать страницу ' + number));
                }
              } finally {
                state.task = null;
                page.cleanup();
                if (state.visible && !state.canvas && !state.failed && !signal.aborted) void state.render();
              }
            },
          };
          let refresh;
          host.addEventListener('boardviewchange', () => {
            clearTimeout(refresh);
            refresh = setTimeout(() => { if (state.visible) void state.render(); }, 180);
          }, { signal });
          signal.addEventListener('abort', () => clearTimeout(refresh), { once: true });
          queued.set(sheet, state);
          observer.observe(sheet);
        }
      }
      editBoardFile(panel, tools, file, options);
      return;
    }

    if (file.mime === 'text/plain') {
      const text = await blob.text();
      if (signal.aborted) return;
      const lines = text.split(/\r?\n/).flatMap(line => line.match(/.{1,140}/gu) ?? ['']);
      for (let i = 0; i < lines.length; i += 42) {
        const sheet = element('section', undefined, 'board-file-sheet');
        sheet.append(element('pre', lines.slice(i, i + 42).join('\n')));
        panel.append(sheet);
        showExistingMarks(sheet, file.marks?.['text-' + i / 42], boardFileWidth, sheet.offsetHeight);
      }
      editBoardFile(panel, tools, file, options);
      return;
    }

    const url = URL.createObjectURL(blob);
    signal.addEventListener('abort', () => URL.revokeObjectURL(url), { once: true });
    const sheet = element('section', undefined, 'board-file-sheet');
    panel.append(sheet);
    if (file.mime.startsWith('image/')) {
      const image = element('img');
      image.alt = file.name;
      image.src = url;
      sheet.append(image);
      await image.decode();
      if (!signal.aborted) {
        showExistingMarks(sheet, file.marks?.image, file.boardWidth ?? boardFileWidth, sheet.offsetHeight);
        editBoardFile(panel, tools, file, options);
      }
      return;
    }

    const video = element('video');
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    sheet.append(video);
    video.addEventListener('loadedmetadata', () => { if (!signal.aborted) editBoardFile(panel, tools, file, options); }, { once: true });
    const play = button('Воспроизвести', () => video.paused ? video.play().catch(() => {}) : video.pause());
    const time = element('input');
    time.type = 'range';
    time.min = 0;
    time.step = 0.1;
    time.value = 0;
    time.disabled = true;
    time.setAttribute('aria-label', 'Позиция видео');
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration)) { time.max = video.duration; time.disabled = false; }
    });
    let frame, frameSignal, unregister, seek;
    const frames = element('select');
    frames.setAttribute('aria-label', 'Пометки к кадрам');
    function frameOptions() {
      const options = [new Option('Пометки к кадрам', '')];
      for (const key of Object.keys(file.marks ?? {}).filter(key => key.startsWith('frame-')).sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))) {
        options.push(new Option((Number(key.slice(6)) / 1000).toFixed(2) + ' с', key));
      }
      frames.replaceChildren(...options);
    }
    function closeFrame() {
      unregister?.();
      unregister = undefined;
      frameSignal?.abort();
      frame?.remove();
      frame = null;
    }
    function capture(key) {
      if (video.readyState < 2 || !video.videoWidth) return;
      video.pause();
      closeFrame();
      frameSignal = new AbortController();
      frame = element('section', undefined, 'paper board-video-frame');
      frame.style.top = sheet.offsetTop + 'px';
      const canvas = element('canvas');
      canvas.width = Math.min(1200, video.videoWidth);
      canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      frame.append(canvas);
      tools.append(frame);
      const surface = createSurface(frame, structuredClone(file.marks?.[key] ?? { strokes: [], texts: [] }), {
        ...surfaceOptions, signal: frameSignal.signal, width: 1000,
        commit(mark, history) {
          file.marks ??= {};
          file.marks[key] = mark;
          onMark?.(file, history);
          frameOptions();
          frames.value = key;
        },
      });
      unregister = onSurface?.(surface);
    }
    video.addEventListener('play', () => { closeFrame(); play.textContent = 'Пауза'; });
    video.addEventListener('pause', () => { play.textContent = 'Воспроизвести'; });
    video.addEventListener('timeupdate', () => { time.value = video.currentTime; });
    video.addEventListener('seeked', () => { if (seek) { capture(seek); seek = ''; } });
    time.oninput = () => { closeFrame(); video.currentTime = time.valueAsNumber; };
    frames.onchange = () => {
      if (!frames.value) return;
      video.pause();
      const seconds = Number(frames.value.slice(6)) / 1000;
      if (Math.abs(video.currentTime - seconds) < 0.002) capture(frames.value);
      else { seek = frames.value; video.currentTime = seconds; }
    };
    tools.append(play, time, button('Пометить кадр', () => capture('frame-' + Math.round(video.currentTime * 1000))), frames);
    frameOptions();
    signal.addEventListener('abort', () => { closeFrame(); video.pause(); }, { once: true });
  } catch (error) {
    if (!signal.aborted) panel.append(element('p', 'Не удалось открыть файл. ' + error.message));
  }
}
