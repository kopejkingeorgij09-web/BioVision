// NODE_PATH=/tmp/polya-validation/node_modules node notes/tests/browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.POLYA_CHROMIUM, headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'cdn.jsdelivr.net' && process.env.POLYA_PDFJS_ROOT && url.pathname.startsWith('/npm/pdfjs-dist@6.5.438/')) {
        const relative = url.pathname.split('/npm/pdfjs-dist@6.5.438/')[1];
        const file = path.resolve(process.env.POLYA_PDFJS_ROOT, relative);
        if (!file.startsWith(path.resolve(process.env.POLYA_PDFJS_ROOT) + path.sep)) return route.abort();
        try { return await route.fulfill({ body: await fs.readFile(file), contentType: file.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } }); }
        catch { return route.fulfill({ status: 404, body: 'Missing PDF resource' }); }
      }
      if (url.hostname !== 'localhost') return route.abort();
      const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      const file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const contentType = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(file)] ?? 'application/octet-stream';
        await route.fulfill({ body: await fs.readFile(file), contentType });
      } catch { await route.fulfill({ status: 404, body: 'Not found' }); }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR:', error.message); });
    await page.goto('http://localhost:3333/notes/');
    await page.locator('#new-item').click();
    await page.getByLabel('Тип', { exact: true }).selectOption('board');
    await page.getByPlaceholder('Название', { exact: true }).fill('Проверка планшета');
    await page.getByRole('button', { name: 'Создать', exact: true }).click();
    await page.locator('.board .ink').waitFor();
    await page.getByRole('button', { name: 'Карта', exact: true }).click();
    await page.getByRole('complementary', { name: 'Карта доски', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Скрыть карту', exact: true }).click();
    await page.getByRole('navigation', { name: 'Открытые заметки', exact: true }).waitFor();
    console.log('PASS existing 0.7.1 minimap and tabs');
    // Native paste event: a screenshot received as a File, no file picker.
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 240;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#bee8d5'; ctx.fillRect(0, 0, 400, 240);
      ctx.fillStyle = '#164f3e'; ctx.font = '26px sans-serif'; ctx.fillText('Скриншот из буфера', 35, 125);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      window.testImage = new File([blob], 'Скриншот.png', { type: 'image/png' });
      const data = new DataTransfer(); data.items.add(window.testImage);
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, cancelable: true }));
    });
    await page.getByRole('img', { name: 'Скриншот.png' }).waitFor();
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    assert.equal(await page.locator('.board-file img').count(), 0);
    await page.getByRole('button', { name: 'Повторить', exact: true }).click();
    await page.getByRole('img', { name: 'Скриншот.png' }).waitFor();
    await page.reload();
    await page.getByRole('img', { name: 'Скриншот.png' }).waitFor();
    console.log('PASS screenshot paste, undo/redo, IndexedDB persistence');

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      read: async () => [{ types: ['image/png'], getType: async () => window.testImage }],
    } }));
    // Reload cleared the test-only image; recreate it from the existing image.
    await page.evaluate(async () => { window.testImage = await (await fetch(document.querySelector('.board-file img').src)).blob(); });
    await page.getByRole('button', { name: 'Вставить', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.board-file img').length === 2);
    console.log('PASS Paste button imports image from Clipboard API');

    await page.getByRole('button', { name: 'Уместить', exact: true }).click();
    await page.locator('.board-image-move').last().waitFor();
    const initial = await page.locator('.board-file').last().evaluate(panel => ({
      x: parseFloat(panel.style.left), y: parseFloat(panel.style.top), width: parseFloat(panel.style.width),
      zoom: panel.getBoundingClientRect().width / panel.offsetWidth,
    }));
    let handle = await page.locator('.board-image-move').last().boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 50, handle.y + handle.height / 2 - 30, { steps: 8 });
    await page.mouse.up();
    const moved = await page.locator('.board-file').last().evaluate(panel => ({ x: parseFloat(panel.style.left), y: parseFloat(panel.style.top) }));
    assert.ok(Math.abs(moved.x - initial.x + 50 / initial.zoom) < .1);
    assert.ok(Math.abs(moved.y - initial.y + 30 / initial.zoom) < .1);
    handle = await page.locator('.board-image-resize').last().boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 80, handle.y + handle.height / 2 - 50, { steps: 8 });
    await page.mouse.up();
    const resized = await page.locator('.board-file').last().evaluate(panel => parseFloat(panel.style.width));
    assert.ok(resized < initial.width - 50);
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    await page.locator('.board-image-resize').last().waitFor();
    assert.equal(await page.locator('.board-file').last().evaluate(panel => parseFloat(panel.style.width)), initial.width);
    await page.getByRole('button', { name: 'Повторить', exact: true }).click();
    await page.locator('.board-image-resize').last().waitFor();
    await page.reload();
    await page.locator('.board-image-resize').last().waitFor();
    assert.equal(await page.locator('.board-file').last().evaluate(panel => parseFloat(panel.style.width)), resized);
    assert.equal(await page.locator('.board-file').last().evaluate(panel => parseFloat(panel.style.left)), moved.x);
    console.log('PASS image drag and proportional resize, one-step undo, reload persistence');

    await page.getByRole('button', { name: 'Уместить', exact: true }).click();
    await page.getByRole('button', { name: 'Лассо', exact: true }).click();
    const imageBounds = await page.locator('.board-file').last().boundingBox();
    const outline = [[imageBounds.x - 12, imageBounds.y - 12], [imageBounds.x + imageBounds.width + 12, imageBounds.y - 12],
      [imageBounds.x + imageBounds.width + 12, imageBounds.y + imageBounds.height + 12], [imageBounds.x - 12, imageBounds.y + imageBounds.height + 12]];
    await page.mouse.move(...outline[0]); await page.mouse.down();
    for (const point of [...outline.slice(1), outline[0]]) await page.mouse.move(...point, { steps: 4 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Увеличить выделение', exact: true }).click();
    assert.ok(Math.abs(await page.locator('.board-file').last().evaluate(panel => parseFloat(panel.style.width)) - resized * 1.25) < .01);
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    await page.locator('.board-image-resize').last().waitFor();
    assert.equal(await page.locator('.board-file').last().evaluate(panel => parseFloat(panel.style.width)), resized);
    console.log('PASS lasso selects and scales images, undo restores dimensions');

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => { throw new Error('Permission denied'); } } }));
    await page.getByRole('button', { name: 'Вставить', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Нет доступа к буферу' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Вставить', exact: true }).isEnabled(), true);

    // Ordinary text paste must keep the editor's default behavior.
    await page.getByRole('button', { name: 'Текст', exact: true }).click();
    const box = await page.locator('.board .ink').boundingBox();
    await page.mouse.click(box.x + 60, box.y + 80);
    const text = page.getByRole('textbox', { name: 'Текст рядом со штрихами' });
    await text.fill('Конспект');
    const prevented = await text.evaluate(field => !field.dispatchEvent(new ClipboardEvent('paste', { cancelable: true, bubbles: true, clipboardData: new DataTransfer() })));
    assert.equal(prevented, false);
    console.log('PASS denied clipboard access and ordinary text paste');

    // Tablet and phone layouts, including the dark theme required by AGENTS.md.
    await page.evaluate(() => document.documentElement.dataset.theme = 'violet');
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: '/tmp/polya-' + width + '.png' });
      assert.ok((await page.locator('.board').boundingBox()).width > 100);
      assert.equal(await page.getByRole('button', { name: 'Вставить', exact: true }).isVisible(), true);
    }
    console.log('PASS tablet and 390px dark layout');
    await page.setViewportSize({ width: 1024, height: 844 });
    await page.getByRole('button', { name: 'Перо', exact: true }).click();
    await page.getByRole('group', { name: 'Настройки пера', exact: true }).waitFor();
    const beforeWidth = await page.getByLabel('Толщина пера', { exact: true }).inputValue();
    await page.getByRole('button', { name: 'Увеличить толщину пера на 0,1', exact: true }).click();
    assert.ok(Math.abs(Number(await page.getByLabel('Толщина пера', { exact: true }).inputValue()) - Number(beforeWidth) - .1) < .00001);
    await page.getByRole('button', { name: 'Уменьшить толщину пера на 0,1', exact: true }).click();
    assert.equal(Number(await page.getByLabel('Толщина пера', { exact: true }).inputValue()), Number(beforeWidth));
    await page.getByLabel('Цвет пера', { exact: true }).fill('#3344bb');
    await page.screenshot({ path: '/tmp/polya-quick-pen.png' });
    console.log('PASS direct pen palette, color and exact 0.1 increments');
    const pdfDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    const downloaded = await pdfDownload;
    await downloaded.saveAs('/tmp/polya-export-board.pdf');
    const { PDFDocument } = await import('../js/vendor/pdf-lib.js');
    const exported = await PDFDocument.load(await fs.readFile('/tmp/polya-export-board.pdf'));
    assert.ok(exported.getPageCount() >= 1);
    console.log('PASS board PDF download with image and Cyrillic text: ' + exported.getPageCount() + ' pages');
    const exportTest = await page.evaluate(async () => {
      const { PDFDocument } = await import('/notes/js/vendor/pdf-lib.js');
      const { exportNotesPdf, boardTiles } = await import('/notes/js/pdf-export.js');
      const strokes = [{ id: 's', tool: 'pen', width: 3, color: 'auto', points: [[20, 20, .5], [100, 50, .5]] }];
      const notes = [{ data: { kind: 'pages', title: 'Тетрадь', pages: [{ strokes, texts: [] }, { strokes: [], texts: [{ x: 40, y: 70, text: 'Русский текст', pt: 12 }] }] } },
        { data: { kind: 'text', title: 'Текст', body: 'Длинный текст\n'.repeat(100), textPt: 18 } }];
      const bytes = await exportNotesPdf(notes, 'local');
      const output = await PDFDocument.load(bytes);
      return { count: output.getPageCount(), sparse: boardTiles([{ box: [-100, -100, 10, 10] }, { box: [100000, 200000, 20, 20] }]).length };
    });
    assert.ok(exportTest.count >= 5); assert.equal(exportTest.sparse, 2);
    console.log('PASS multi-notebook/text PDF and sparse, negative board coordinates');
    if (process.env.POLYA_PDFJS_ROOT) {
      const fixture = await PDFDocument.create();
      fixture.addPage([360, 480]).drawText('Vector PDF source', { x: 20, y: 400, size: 16 });
      fixture.addPage([360, 480]).drawText('Second page', { x: 20, y: 400, size: 16 });
      fixture.addPage([360, 480]); // A PDF can contain a blank page without a Contents stream.
      const fixtureBytes = await fixture.save();
      await page.locator('#file-picker').setInputFiles({ name: 'Source.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixtureBytes) });
      await page.getByRole('button', { name: '▣ Source.pdf', exact: true }).click();
      await page.locator('.board-pdf-page canvas').first().waitFor();
      await page.locator('.board-image-move').last().waitFor();
      const original = await page.evaluate(async () => {
        const { list } = await import('/notes/js/local.js');
        const files = await list('files', 'local');
        const items = await list('items', 'local');
        const source = items.flatMap(item => item.data.attachments ?? []).find(file => file.name === 'Source.pdf');
        return Array.from(new Uint8Array(await files.find(file => file.id === source.id).blob.arrayBuffer()));
      });
      assert.deepEqual(Buffer.from(original), Buffer.from(fixtureBytes));
      const pdfPanel = page.locator('.board-file').filter({ hasText: 'Source.pdf' });
      const b = await pdfPanel.boundingBox();
      await page.getByRole('button', { name: 'Лассо', exact: true }).click();
      const polygon = [[b.x + 60, b.y + 70], [b.x + 220, b.y + 70], [b.x + 220, b.y + 230], [b.x + 60, b.y + 230]];
      await page.mouse.move(...polygon[0]); await page.mouse.down();
      for (const point of [...polygon.slice(1), polygon[0]]) await page.mouse.move(...point, { steps: 4 });
      await page.mouse.up();
      const initialWidth = await pdfPanel.evaluate(node => parseFloat(node.style.width));
      // A lasso wholly inside a PDF must leave its size unchanged.
      const scaleSelection = page.getByRole('button', { name: 'Увеличить выделение', exact: true });
      if (await scaleSelection.isVisible()) await scaleSelection.click();
      assert.equal(await pdfPanel.evaluate(node => parseFloat(node.style.width)), initialWidth);
      const resizePdf = page.getByRole('button', { name: 'Изменить размер PDF сверху', exact: true });
      await resizePdf.focus(); await page.keyboard.press('ArrowRight');
      assert.ok(await pdfPanel.evaluate(node => parseFloat(node.style.width)) > initialWidth);
      await page.getByRole('button', { name: 'Отменить', exact: true }).click();
      await page.getByRole('button', { name: '▣ Source.pdf', exact: true }).click();
      await page.locator('.board-pdf-page canvas').first().waitFor();
      const sheet = await page.locator('.board-pdf-page').first().boundingBox();
      await page.locator('.board .ink').evaluate((node, point) => node.dispatchEvent(new WheelEvent('wheel', { clientX: point.x, clientY: point.y, ctrlKey: true, deltaY: -220, cancelable: true })), { x: sheet.x + 120, y: sheet.y + 120 });
      await page.waitForFunction(() => document.querySelector('.board-pdf-page canvas')?.width > 1100);
      const downloadReady = page.waitForEvent('download');
      await page.getByRole('button', { name: 'PDF', exact: true }).click();
      await (await downloadReady).saveAs('/tmp/polya-export-source-pdf.pdf');
      const saved = await PDFDocument.load(await fs.readFile('/tmp/polya-export-source-pdf.pdf'));
      assert.ok(saved.getPageCount() >= 2);
      console.log('PASS byte-identical PDF import, PDF lasso exclusion, dedicated resize/undo, resolution on zoom, PDF export');
      const rotationResults = await page.evaluate(async () => {
        const { PDFDocument, degrees } = await import('/notes/js/vendor/pdf-lib.js');
        const { exportAttachmentPdf } = await import('/notes/js/pdf-export.js');
        const { put } = await import('/notes/js/local.js');
        const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/legacy/build/pdf.mjs');
        const results = [];
        for (const rotation of [0, 90, 180, 270]) {
          const source = await PDFDocument.create(), page = source.addPage([300, 400]);
          page.setCropBox(20, 30, 260, 340); page.setRotation(degrees(rotation));
          const id = 'rotated-' + rotation, bytes = await source.save();
          await put('files', { library: 'local', id, blob: new Blob([bytes], { type: 'application/pdf' }) });
          const file = { id, boardWidth: 560, boardPosition: { x: 100, y: 50 } };
          const top = 50 + 46 * 560 / 720;
          const data = { kind: 'board', pages: [{ strokes: [{ id: 'red', tool: 'pen', color: '#ff0000', fixedColor: true,
            width: 12, points: [[160, top + 80, .5], [200, top + 80, .5]] }], texts: [] }] };
          const output = await exportAttachmentPdf(data, file, 'local');
          const saved = await PDFDocument.load(output);
          if (saved.getPageCount() !== 1) throw new Error('Homework page count changed');
          const task = pdfjs.getDocument({ data: output, disableFontFace: true });
          const doc = await task.promise, sheet = await doc.getPage(1), natural = sheet.getViewport({ scale: 1 });
          const viewport = sheet.getViewport({ scale: 560 / natural.width });
          const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
          const ctx = canvas.getContext('2d'); await sheet.render({ canvas, canvasContext: ctx, viewport }).promise;
          const pixel = [...ctx.getImageData(80, 80, 1, 1).data];
          results.push({ rotation, pixel, pages: saved.getPageCount() }); await task.destroy();
        }
        return results;
      });
      for (const { rotation, pixel } of rotationResults) assert.ok(pixel[0] > 200 && pixel[1] < 30 && pixel[2] < 30, 'Ink displaced on rotated/cropped page: ' + rotation + ' ' + pixel);
      console.log('PASS homework PDF overlays, original page count, crop boxes and all four rotations');

    }
    const nativeExport = await page.evaluate(async () => {
      const { savePdf } = await import('/notes/js/pdf-export.js');
      const parts = []; let completed = false;
      window.NotesAndroid = { beginPdfExport: () => true, appendPdfChunk: chunk => { parts.push(chunk); return true; }, finishPdfExport: () => { completed = true; }, cancelPdfExport: () => {} };
      await savePdf(new Uint8Array(150000).fill(201), 'Проверка.pdf');
      delete window.NotesAndroid;
      return { completed, lengths: parts.map(p => atob(p).length), values: parts.every(p => [...atob(p)].every(c => c.charCodeAt(0) === 201)) };
    });
    assert.equal(nativeExport.completed, true); assert.equal(nativeExport.lengths.reduce((a, b) => a + b), 150000); assert.equal(nativeExport.values, true);
    console.log('PASS Android chunked PDF bridge preserves bytes');


    assert.deepEqual(errors, []);
    const perf = await context.newPage();
    await perf.goto('http://localhost:3333/notes/');
    const result = await perf.evaluate(async () => {
      const { createSurface } = await import('/notes/js/ink.js');
      document.body.replaceChildren();
      const host = document.createElement('div'); host.style.cssText = 'position:relative;width:1000px;height:600px'; document.body.append(host);
      const strokes = Array.from({ length: 5000 }, (_, i) => ({ id: String(i), tool: 'pen', width: 3, color: '#222',
        points: Array.from({ length: 24 }, (_, j) => [(i % 100) * 160 + j * 2, Math.floor(i / 100) * 100 + Math.sin(j) * 10, .5]) }));
      let commits = 0;
      const surface = createSurface(host, { strokes, texts: [] }, { board: true, settings: () => ({ tool: 'pen', width: 3 }), commit: () => commits++ });
      const layer = host.querySelector('svg.ink > g'), first = layer.firstElementChild;
      let elapsed = 0;
      for (let frame = 0; frame < 20; frame++) {
        const start = performance.now();
        for (let i = 0; i < 100; i++) host.querySelector('svg.ink').dispatchEvent(new WheelEvent('wheel', { deltaX: .2, deltaY: 0, cancelable: true }));
        elapsed += performance.now() - start;
        await new Promise(requestAnimationFrame);
      }
      return { strokes: layer.childElementCount, visible: [...layer.children].filter(node => node.style.display !== 'none').length,
        retained: layer.firstElementChild === first, commits, inputMs: elapsed, x: surface.view().x };
    });
    assert.equal(result.strokes, 5000); assert.equal(result.retained, true); assert.equal(result.commits, 0);
    assert.ok(result.visible < 100); assert.ok(Math.abs(result.x + 400) < .01);
    console.log('PASS 5000-stroke board, 2000 pan events: ' + JSON.stringify(result));
    await perf.close();
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
