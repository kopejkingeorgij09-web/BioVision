export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function button(label, run, className) {
  const control = element('button', label, className);
  control.type = 'button';
  control.addEventListener('click', run);
  return control;
}

function math(formula, block) {
  const node = element(block ? 'div' : 'span', formula, 'formula');
  if (window.katex) window.katex.render(formula, node, { displayMode: block, throwOnError: false, trust: false });
  else node.title = 'Для отображения формулы нужна загруженная библиотека KaTeX';
  return node;
}

function inline(target, text, openNote) {
  const pattern = /(\[\[([a-f0-9-]{36})(?:\|([^\]]+))?\]\]|\x60([^\x60]+)\x60|\$([^$\n]+)\$|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/gi;
  let position = 0;
  for (const hit of text.matchAll(pattern)) {
    target.append(text.slice(position, hit.index));
    const [, , id, title, code, formula, bold, italic, label, url] = hit;
    if (id) {
      const link = element('a', title || 'Заметка');
      link.href = '#note=' + id;
      link.onclick = event => { event.preventDefault(); openNote(id); };
      target.append(link);
    } else if (code !== undefined) target.append(element('code', code));
    else if (formula !== undefined) target.append(math(formula, false));
    else if (bold !== undefined) target.append(element('strong', bold));
    else if (italic !== undefined) target.append(element('em', italic));
    else {
      const link = element('a', label);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      target.append(link);
    }
    position = hit.index + hit[0].length;
  }
  target.append(text.slice(position));
}

export function markdown(source, openNote) {
  const preview = element('article', undefined, 'markdown');
  const lines = source.split('\n');
  const fence = String.fromCharCode(96).repeat(3);
  const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (line.startsWith(fence)) {
      const content = [];
      while (++index < lines.length && !lines[index].startsWith(fence)) content.push(lines[index]);
      const pre = element('pre');
      pre.append(element('code', content.join('\n')));
      preview.append(pre);
      continue;
    }
    if (line.trim() === '$$') {
      const content = [];
      while (++index < lines.length && lines[index].trim() !== '$$') content.push(lines[index]);
      preview.append(math(content.join('\n'), true));
      continue;
    }
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? '')) {
      const table = element('table');
      const row = (input, tag) => {
        const tr = element('tr');
        for (const cell of cells(input)) {
          const node = element(tag);
          inline(node, cell, openNote);
          tr.append(node);
        }
        return tr;
      };
      const head = element('thead'), body = element('tbody');
      head.append(row(line, 'th'));
      index += 2;
      while (index < lines.length && lines[index].includes('|')) body.append(row(lines[index++], 'td'));
      index -= 1;
      table.append(head, body);
      preview.append(table);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const node = element('h' + heading[1].length);
      inline(node, heading[2], openNote);
      preview.append(node);
      continue;
    }
    const unordered = /^\s*[-*]\s+/;
    const ordered = /^\s*\d+\.\s+/;
    const marker = unordered.test(line) ? unordered : ordered.test(line) ? ordered : null;
    if (marker) {
      const list = element(marker === ordered ? 'ol' : 'ul');
      while (index < lines.length && marker.test(lines[index])) {
        const li = element('li');
        inline(li, lines[index++].replace(marker, ''), openNote);
        list.append(li);
      }
      index -= 1;
      preview.append(list);
      continue;
    }
    const node = element(line.startsWith('> ') ? 'blockquote' : 'p');
    inline(node, line.replace(/^> /, ''), openNote);
    preview.append(node);
  }
  return preview;
}

export function textEditor(body, update, openNote) {
  const root = element('div', undefined, 'text-note');
  const field = element('textarea');
  field.value = body;
  field.placeholder = 'Начни конспект. # — заголовок, - — список, $…$ — формула.';
  field.setAttribute('aria-label', 'Текст конспекта');
  let preview;
  root.append(field);
  field.addEventListener('input', () => update(field.value));

  function insert(before, after = '', fallback = '') {
    const { selectionStart, selectionEnd, value } = field;
    const selected = value.slice(selectionStart, selectionEnd) || fallback;
    field.setRangeText(before + selected + after, selectionStart, selectionEnd, 'end');
    field.focus();
    if (selected) field.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
    field.dispatchEvent(new Event('input'));
  }

  field.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      insert('  ');
    }
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.code === 'KeyB') { event.preventDefault(); insert('**', '**', 'жирный текст'); }
    if (event.code === 'KeyI') { event.preventDefault(); insert('*', '*', 'курсив'); }
    if (event.code === 'Digit1') { event.preventDefault(); insert('# ', '', 'Заголовок'); }
    if (event.shiftKey && event.code === 'KeyL') { event.preventDefault(); insert('- ', '', 'Пункт'); }
  });
  return {
    root, field, insert,
    toggle() {
      field.hidden = !field.hidden;
      if (field.hidden) { preview = markdown(field.value, openNote); root.append(preview); }
      else { preview.remove(); field.focus(); }
      return field.hidden;
    },
  };
}
