export const searchText = text => String(text ?? '').normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/gu, ' ').trim();

export function handwritingLines(page) {
  const strokes = [];
  for (const stroke of page.strokes ?? []) {
    if (stroke.tool !== 'pen' || stroke.geometry || !stroke.points?.length) continue;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const [x, y] of stroke.points) {
      left = Math.min(x, left); right = Math.max(x, right);
      top = Math.min(y, top); bottom = Math.max(y, bottom);
    }
    if (right - left < 460 && bottom - top < 170) strokes.push({ stroke, left, top, right, bottom });
  }
  const heights = strokes.map(item => item.bottom - item.top).filter(height => height >= 6).sort((a, b) => a - b);
  const height = Math.min(82, Math.max(10, heights[Math.floor(heights.length / 2)] ?? 14));
  const rows = [];
  for (const stroke of strokes.sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom))) {
    const y = (stroke.top + stroke.bottom) / 2;
    const row = rows.at(-1);
    if (row && Math.abs(row.y - y) < height * .72) row.strokes.push(stroke);
    else rows.push({ y, strokes: [stroke] });
  }
  const lines = [];
  const order = new Map((page.strokes ?? []).map((stroke, index) => [stroke.id, index]));
  for (const row of rows) {
    const chunks = [];
    for (const entry of row.strokes.sort((a, b) => a.left - b.left)) {
      const chunk = chunks.at(-1);
      if (chunk && entry.left - chunk.right < height * 3.8 && chunk.parts.length < 120) {
        chunk.parts.push(entry);
        chunk.right = Math.max(chunk.right, entry.right);
      } else chunks.push({ parts: [entry], right: entry.right });
    }
    for (const { parts, right } of chunks) {
      const left = parts[0].left, top = Math.min(...parts.map(p => p.top)), bottom = Math.max(...parts.map(p => p.bottom));
      if (parts.length === 1 && right - left < height * .8) continue;
      parts.sort((a, b) => order.get(a.stroke.id) - order.get(b.stroke.id));
      const key = parts.map(({ stroke }) => stroke.id + ':' + stroke.points.length).join('/');
      lines.push({ key, x: (left + right) / 2, y: (top + bottom) / 2, page: page.id,
        width: Math.max(12, right - left), height: Math.max(height, bottom - top),
        strokes: parts.map(({ stroke }) => stroke.points.filter((_, i) => i === stroke.points.length - 1 || i % Math.ceil(stroke.points.length / 250) === 0)
          .map(([x, y, , time]) => [x - left, y - top, time])) });
    }
  }
  return lines;
}

const requests = new Map();
let nextRequest = 0;

export function recognizeInk(points, language, width = 0, height = 0) {
  const bridge = window.NotesAndroid;
  if (!bridge?.recognizeIndexed) return Promise.reject(new Error('Распознавание доступно в приложении Android'));
  return new Promise((resolve, reject) => {
    const id = ++nextRequest;
    const timer = setTimeout(() => {
      requests.delete(id);
      reject(new Error('Модель не ответила. Проверь интернет при первой загрузке.'));
    }, 90000);
    requests.set(id, (text, error) => {
      clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve(text.trim());
    });
    try { bridge.recognizeIndexed(id, JSON.stringify(points), language, width, height); }
    catch (error) { requests.get(id)?.('', error.message); requests.delete(id); }
  });
}

window.notesIndexedInkResult = (id, text, error) => {
  const finish = requests.get(id);
  requests.delete(id);
  finish?.(text, error);
};
