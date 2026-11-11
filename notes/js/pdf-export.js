import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } from './vendor/pdf-lib.js';
import { outline } from './ink.js';
import { attachmentBlob } from './cloud.js';
import { boardFilesWithPositions, boardFileWidth } from './media.js';

const W = 794, H = 1123, S = .75;
const intersects = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
const color = value => {
  if (!/^#[0-9a-f]{6}$/i.test(value) || ['#eee9ff', '#28223c'].includes(value)) return rgb(.12, .12, .15);
  return rgb(...value.slice(1).match(/../g).map(c => parseInt(c, 16) / 255));
};
const bounds = points => {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const [x, y] of points) { l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); b = Math.max(b, y); }
  return [l, t, Math.max(1, r - l), Math.max(1, b - t)];
};

// Text is embedded as lossless, transparent 2x images so Cyrillic works offline
// without downloading fonts. Handwriting and embedded PDFs remain vectors.
async function textImage(pdf, text, width, size = 16, bold = false, italic = false) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px sans-serif`;
  ctx.font = font;
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (ctx.measureText(line + character).width > width - 16 && line) { lines.push(line); line = ''; }
      line += character;
    }
    lines.push(line);
  }
  const height = Math.max(size * 1.35, lines.length * size * 1.35 + 10);
  // Bound canvas dimensions; callers split long text into page-sized blocks.
  const density = Math.min(2, 8192 / Math.max(width, height));
  canvas.width = Math.ceil(width * density); canvas.height = Math.ceil(height * density);
  ctx.scale(density, density); ctx.font = font; ctx.fillStyle = '#25242d'; ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, 8, 5 + i * size * 1.35));
  const image = await pdf.embedPng(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());
  canvas.width = canvas.height = 0;
  return { image, width, height };
}

function imageNode(image, box, pdfPage = false) {
  return { box, draw(page, ox, oy) {
    const options = { x: (box[0] - ox) * S, y: (H - box[1] + oy - box[3]) * S, width: box[2] * S, height: box[3] * S };
    if (pdfPage) page.drawPage(image, options); else page.drawImage(image, options);
  } };
}

async function addMarks(pdf, scene, mark, x = 0, y = 0, scale = 1) {
  for (const stroke of mark?.strokes ?? []) {
    if (!stroke.points?.length) continue;
    const points = stroke.points.map(([a, b, p]) => [x + a * scale, y + b * scale, p ?? .5]);
    const width = stroke.width * scale, box = bounds(points), padding = width * 4;
    box[0] -= padding; box[1] -= padding; box[2] += padding * 2; box[3] += padding * 2;
    let path;
    const [a, b] = [points[0], points.at(-1)];
    if (stroke.geometry === 'polygon') path = 'M ' + points.map(p => p.slice(0, 2).join(' ')).join(' L ') + ' Z';
    else if (stroke.tool === 'rect') path = `M ${a[0]} ${a[1]} L ${b[0]} ${a[1]} L ${b[0]} ${b[1]} L ${a[0]} ${b[1]} Z`;
    else if (stroke.tool === 'ellipse') {
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
      if (!rx || !ry) continue;
      path = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
    } else if (['line', 'highlight'].includes(stroke.tool)) path = 'M ' + points.map(p => p.slice(0, 2).join(' ')).join(' L ');
    else path = outline(points, width);
    const filled = !stroke.geometry && !['line', 'rect', 'ellipse', 'highlight'].includes(stroke.tool);
    scene.push({ box, draw(page, ox, oy) {
      const ink = color(stroke.color);
      page.drawSvgPath(path, { x: -ox * S, y: (H + oy) * S, scale: S,
        ...(filled ? { color: ink } : { borderColor: ink, borderWidth: width * (stroke.tool === 'highlight' ? 4 : 1) }),
        opacity: stroke.tool === 'highlight' ? .28 : 1, borderOpacity: stroke.tool === 'highlight' ? .28 : 1 });
    } });
  }
  for (const text of mark?.texts ?? []) {
    const width = (text.width ?? 250) * scale;
    const result = await textImage(pdf, text.text, width, (text.pt ?? 12) * 4 / 3 * scale, text.bold, text.italic);
    scene.push(imageNode(result.image, [x + text.x * scale, y + text.y * scale, width, result.height]));
  }
}

async function originalImage(pdf, blob) {
  const bytes = await blob.arrayBuffer();
  if (blob.type === 'image/jpeg') return pdf.embedJpg(bytes);
  if (blob.type === 'image/png') return pdf.embedPng(bytes);
  const image = new Image(), url = URL.createObjectURL(blob);
  try {
    image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return await pdf.embedPng(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}

async function addAttachment(pdf, scene, file, library, board) {
  const blob = await attachmentBlob(library, file.id);
  const width = board ? file.boardWidth ?? boardFileWidth : W;
  const x = board ? file.boardPosition.x : 0;
  let y = board ? file.boardPosition.y : 0;
  if (board) {
    const title = await textImage(pdf, file.name, width, 16 * width / boardFileWidth, true);
    scene.push(imageNode(title.image, [x, y, width, title.height]));
    y += 46 * width / boardFileWidth;
  }
  if (file.mime === 'application/pdf') {
    const source = await PDFDocument.load(await blob.arrayBuffer());
    const embedded = await pdf.embedPages(source.getPages());
    for (const [i, page] of embedded.entries()) {
      const height = width * page.height / page.width;
      scene.push(imageNode(page, [x, y, width, height], true));
      await addMarks(pdf, scene, file.marks?.['page-' + (i + 1)], x, y, width / 1000);
      y += height + (board ? 22 : 0);
    }
  } else if (file.mime.startsWith('image/')) {
    const image = await originalImage(pdf, blob), height = width * image.height / image.width;
    scene.push(imageNode(image, [x, y, width, height]));
    await addMarks(pdf, scene, file.marks?.image, x, y, width / 1000);
  } else if (file.mime === 'text/plain') {
    const lines = (await blob.text()).split(/\r?\n/).flatMap(line => line.match(/.{1,100}/gu) ?? ['']);
    for (let i = 0; i < lines.length; i += 42) {
      const text = await textImage(pdf, lines.slice(i, i + 42).join('\n'), width);
      scene.push(imageNode(text.image, [x, y, width, text.height]));
      await addMarks(pdf, scene, file.marks?.['text-' + i / 42], x, y, width / 1000);
      y += text.height + 22;
    }
  } else {
    // PDF is static: include the filename and all annotated video frames.
    const label = await textImage(pdf, 'Видео: ' + file.name, width);
    scene.push(imageNode(label.image, [x, y, width, label.height])); y += label.height;
    const url = URL.createObjectURL(blob), video = document.createElement('video');
    try {
      video.preload = 'auto'; video.muted = true;
      const ready = new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('Не удалось прочитать видео: ' + file.name)); });
      video.src = url; await ready;
      const keys = Object.keys(file.marks ?? {}).filter(key => key.startsWith('frame-'));
      for (const key of keys.length ? keys : ['frame-0']) {
        const seconds = Number(key.slice(6)) / 1000;
        if (Math.abs(video.currentTime - seconds) > .001) {
          await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = reject; video.currentTime = seconds; });
        }
        const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const image = await pdf.embedPng(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());
        const height = width * image.height / image.width;
        scene.push(imageNode(image, [x, y, width, height]));
        await addMarks(pdf, scene, file.marks?.[key], x, y, width / 1000); y += height + 22;
        canvas.width = canvas.height = 0;
      }
    } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
  }
}

export function boardTiles(scene) {
  if (!scene.length) return [[0, 0, W, H]];
  const extent = bounds(scene.flatMap(({ box: [x, y, w, h] }) => [[x, y], [x + w, y + h]]));
  const tiles = [];
  // Use a sparse map rather than filling every empty square between far-away notes.
  const cells = new Set();
  const left = extent[0] - 24, top = extent[1] - 24;
  for (const { box } of scene) {
    for (let row = Math.max(0, Math.floor((box[1] - top) / H)); row <= Math.floor((box[1] + box[3] - top) / H); row++) {
      for (let col = Math.max(0, Math.floor((box[0] - left) / W)); col <= Math.floor((box[0] + box[2] - left) / W); col++) {
        cells.add(row + ':' + col);
        if (cells.size > 2000) throw new Error('Слишком большая доска: уменьши масштаб вложений перед экспортом (более 2000 листов).');
      }
    }
  }
  for (const [row, col] of [...cells].map(key => key.split(':').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])) tiles.push([left + col * W, top + row * H, W, H]);
  return tiles;
}

function renderScene(pdf, scene, tiles) {
  for (const tile of tiles) {
    const page = pdf.addPage([W * S, H * S]);
    page.pushOperators(pushGraphicsState(), rectangle(0, 0, W * S, H * S), clip(), endPath());
    for (const node of scene) if (intersects(node.box, tile)) node.draw(page, tile[0], tile[1]);
    page.pushOperators(popGraphicsState());
  }
}

export async function exportNotesPdf(notes, library, progress = () => {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(notes.length === 1 ? notes[0].data.title : 'Поля - библиотека заметок');
  pdf.setCreator('Поля');
  for (const [i, { data }] of notes.entries()) {
    progress(`${i + 1} / ${notes.length}: ${data.title}`);
    if (data.kind === 'board') {
      const scene = [];
      for (const file of boardFilesWithPositions(data.attachments ?? [])) await addAttachment(pdf, scene, file, library, true);
      for (const mark of data.pages ?? []) await addMarks(pdf, scene, mark);
      renderScene(pdf, scene, boardTiles(scene));
    } else {
      if (data.kind === 'text') {
        const scene = [], lines = String(data.body ?? '').split('\n').flatMap(line => line.match(/.{1,90}/gu) ?? ['']);
        let y = 24;
        for (let line = 0; line < Math.max(1, lines.length); line += 44) {
          const text = await textImage(pdf, lines.slice(line, line + 44).join('\n'), W - 48, (data.textPt ?? 12) * 4 / 3);
          scene.push(imageNode(text.image, [24, y, text.width, text.height])); y += text.height; 
        }
        renderScene(pdf, scene, Array.from({ length: Math.max(1, Math.ceil((y + 24) / H)) }, (_, i) => [0, i * H, W, H]));
      } else for (const mark of data.pages ?? []) {
        const scene = []; await addMarks(pdf, scene, mark); renderScene(pdf, scene, [[0, 0, W, H]]);
      }
      for (const file of data.attachments ?? []) {
        const scene = []; await addAttachment(pdf, scene, file, library, false);
        // Attachments are paginated independently after the notebook's own pages.
        const last = Math.max(H, ...scene.map(node => node.box[1] + node.box[3]));
        renderScene(pdf, scene, Array.from({ length: Math.ceil(last / H) }, (_, i) => [0, i * H, W, H]));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (!pdf.getPageCount()) pdf.addPage([W * S, H * S]);
  return pdf.save();
}

export async function savePdf(bytes, filename) {
  const native = window.NotesAndroid;
  if (native?.beginPdfExport) {
    if (!native.beginPdfExport(filename)) throw new Error('Дождись сохранения предыдущего PDF.');
    try {
      for (let i = 0; i < bytes.length; i += 49152) {
        const chunk = bytes.subarray(i, i + 49152);
        if (!native.appendPdfChunk(btoa(String.fromCharCode(...chunk)))) throw new Error('Не удалось записать PDF.');
        if (i % (49152 * 8) === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      native.finishPdfExport();
    } catch (error) { native.cancelPdfExport(); throw error; }
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
