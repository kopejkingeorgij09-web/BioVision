"""Import the owner's Alberts volume 1 PDF. Requires PyMuPDF and Pillow.

Usage: python3 tools/import_alberts.py /path/to/volume1.pdf
The PDF is the authority; generated text is accompanied by source page links.
"""
import hashlib
import html
import io
import json
import re
import shutil
import sys
from pathlib import Path

import fitz
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'content/reading/alberts'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'figures').mkdir(exist_ok=True)
doc = fitz.open(sys.argv[1])
FLAGS = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES
def clean(s):
    # Used for navigation labels only. Never used for the displayed book text.
    return re.sub(r'\s+', ' ', s).strip()


def joined(lines):
    return clean('\n'.join(lines))


def exact(lines):
    return ''.join(''.join(s['text'] for s in line['spans']) + '\n' for line in lines)


def rich(lines, title=False):
    result = []
    for line in lines:
        parts = []
        for s in line['spans']:
            value = html.escape(s['text'])
            if 'Bold' in s['font']:
                value = '<b>' + value + '</b>'
            if 'Italic' in s['font'] or s['font'].endswith('-It'):
                value = '<i>' + value + '</i>'
            if s['size'] < 7.5:
                tag = 'sup' if s['flags'] & 1 else 'sub'
                value = f'<{tag}>' + value + f'</{tag}>'
            if title and re.fullmatch(r'\s*[1-7](?:\.\d+){0,2}\.?\s*', s['text']):
                # Its exact text remains in the DOM and audit. The same number
                # is already displayed in the reader's topic navigation label.
                value = '<span class="rd-heading-number">' + value + '</span>'
            parts.append(value)
        result.append(''.join(parts) + '\n')
    return ''.join(result)


def source(b, indices=None):
    ids = b['_source']['lines']
    return {**b['_source'], 'lines': ids if indices is None else [ids[i] for i in indices]}


def original_block(b, kind='heading'):
    return {'kind': kind, 'html': rich(b['lines']), 'text': exact(b['lines']),
            'source': source(b), 'page': b['_source']['page']}


def text(b):
    return joined([''.join(s['text'] for s in l['spans']) for l in b.get('lines', [])])


def heading(b):
    spans = [s for l in b.get('lines', []) for s in l['spans']]
    return any('MyriadPro' in s['font'] and s['size'] >= 11.5 for s in spans)


def content_line(l):
    return any(('Kudrashov' in s['font'] or 'Calibri' in s['font']) for s in l['spans'])


def overlap(a, b):
    r = a & b
    return not r.is_empty and r.width > 3 and r.height > 3


def graphics(page, blocks, pnum):
    # Composite crops include vector drawings and their labels, not just embedded
    # bitmaps. Protect individual text lines because text wraps around figures.
    protected, boxes = [], []
    for b in blocks:
        for l in b.get('lines', []):
            r = fitz.Rect(l['bbox'])
            if content_line(l) or heading(b):
                protected.append(r)
            elif r.y0 > 45:
                boxes.append(r)
    for img in page.get_image_info():
        r = fitz.Rect(img['bbox'])
        if r.y0 > 44 and r.width > 5 and r.height > 5:
            boxes.append(r)
    for d in page.get_drawings():
        r = fitz.Rect(d['rect'])
        if r.y0 < 45 or r.y1 > 650 or r.width > 440 or r.is_empty:
            continue
        if not any(overlap(r, t) for t in protected):
            boxes.append(r + (-.5, -.5, .5, .5))
    groups = []
    for box in sorted(boxes, key=lambda r: (r.y0, r.x0)):
        if any(overlap(box, t) for t in protected):
            continue
        i = 0
        while i < len(groups):
            g = groups[i]
            near = not (box + (-17, -14, 17, 14) & g).is_empty
            union = box | g
            if near and not any(overlap(union, t) for t in protected):
                box = union
                groups.pop(i)
                i = 0
            else:
                i += 1
        groups.append(box)
    out = []
    for n, r in enumerate(sorted(groups, key=lambda r: (r.y0, r.x0))):
        if r.width < 12 or r.height < 12 or r.get_area() < 450:
            continue
        r = (r + (-2, -2, 2, 2)) & page.rect
        name = f'p{pnum:04}-{n:02}.webp'
        target = OUT / 'figures' / name
        if not target.exists():
            pix = page.get_pixmap(matrix=fitz.Matrix(2.4, 2.4), clip=r, alpha=False)
            Image.open(io.BytesIO(pix.tobytes('png'))).save(target, 'WEBP', lossless=True, method=2)
        with Image.open(target) as im:
            width, height = im.size
        out.append({'kind': 'figure', 'src': 'figures/' + name,
                    'width': width, 'height': height, 'page': pnum,
                    'y': r.y0, 'rect': list(r), 'sourceLines': [],
                    'alt': f'Иллюстрация со страницы {pnum} PDF'})
    return out


def cover_graphic_text(page, blocks, figures, pnum):
    """Every diagram/table label must be inside an actual original-page crop."""
    for b in blocks:
        if heading(b) or any(content_line(l) for l in b['lines']) or b['bbox'][1] <= 44:
            continue
        missed = []
        for i, line in enumerate(b['lines']):
            rect = fitz.Rect(line['bbox'])
            target = next((f for f in figures if (fitz.Rect(f['rect']) + (-1, -1, 1, 1)).contains(rect)), None)
            if target:
                target['sourceLines'].append(source(b, [i]))
            else:
                missed.append(i)
        if missed:
            rect = (fitz.Rect(b['bbox']) + (-2, -2, 2, 2)) & page.rect
            name = f'figures/p{pnum:04}-text-{b["_source"]["block"]:03}.webp'
            target = OUT / name
            if not target.exists():
                pix = page.get_pixmap(matrix=fitz.Matrix(2.4, 2.4), clip=rect, alpha=False)
                Image.open(io.BytesIO(pix.tobytes('png'))).save(target, 'WEBP', lossless=True, method=2)
            with Image.open(target) as im:
                width, height = im.size
            figures.append({'kind': 'figure', 'src': name, 'width': width, 'height': height,
                            'page': pnum, 'y': rect.y0, 'rect': list(rect),
                            'sourceLines': [source(b, missed)],
                            'alt': f'Фрагмент оригинала со страницы {pnum} PDF'})
    return figures


def paragraphs(b, pnum):
    lines = b['lines']
    chunks, current = [], []
    left = min(l['bbox'][0] for l in lines)
    for i, l in enumerate(lines):
        # Original paragraphs start with a 22.7 pt indent. Caption blocks do not.
        if current and l['bbox'][0] > left + 14 and l['bbox'][0] < left + 30:
            chunks.append(current)
            current = []
        current.append((i, l))
    if current:
        chunks.append(current)
    result = []
    for chunk in chunks:
        indices, selected = zip(*chunk)
        value = exact(selected)
        if value:
            result.append({'kind': 'caption' if any('Calibri' in s['font'] for s in selected[0]['spans']) else 'p',
                           'html': rich(selected), 'text': value, 'source': source(b, indices),
                           'page': pnum, 'y': selected[0]['bbox'][1]})
    return result


chapters, topics = [], []
verbatim = []
prose_checks = []
chapter = None
topic = None
figure_count = 0
chapter_names = {
    1: 'Клетки и геномы', 2: 'Химия клетки и биосинтез', 3: 'Белки',
    4: 'ДНК, хромосомы и геномы', 5: 'Репликация, репарация и рекомбинация ДНК',
    6: 'Клеточные механизмы считывания генома: путь от ДНК к белку',
    7: 'Контроль генной экспрессии',
}

for pi, page in enumerate(doc):
    pnum = pi + 1
    all_blocks = page.get_text('dict', flags=FLAGS)['blocks']
    for bi, b in enumerate(all_blocks):
        b['_source'] = {'page': pnum, 'block': bi, 'lines': list(range(len(b['lines'])))}
    # Exact, unmodified text layer: no dehyphenation, normalization or rewriting.
    raw_text = ''.join(''.join(s['text'] for s in l['spans']) + '\n'
                       for b in all_blocks for l in b.get('lines', []))
    verbatim.append({'page': pnum, 'text': raw_text,
                     'sha256': hashlib.sha256(raw_text.encode()).hexdigest()})
    blocks = []
    for b in all_blocks:
        # A PDF block can contain BOTH a heading and the following paragraph.
        # Separating it by lines prevents the paragraph from being discarded.
        if heading(b) and any(content_line(l) for l in b['lines']):
            for indices in [[i for i, l in enumerate(b['lines']) if not content_line(l)],
                            [i for i, l in enumerate(b['lines']) if content_line(l)]]:
                selected = [b['lines'][i] for i in indices]
                if selected:
                    r = fitz.Rect(selected[0]['bbox'])
                    for line in selected[1:]:
                        r |= fitz.Rect(line['bbox'])
                    blocks.append({'type': 0, 'bbox': tuple(r), 'lines': selected, '_source': source(b, indices)})
        else:
            blocks.append(b)
    # The first volume has seven chapters; front matter is retained separately.
    ch = next((int(s['text'].strip()) for b in all_blocks for l in b.get('lines', []) for s in l['spans']
               if 'Myriad' in s['font'] and s['size'] >= 23 and re.fullmatch(r'\s*[1-7]\s*', s['text'])), None)
    if ch:
        chapter = {'n': ch, 'title': chapter_names[ch], 'page': pnum, 'topics': []}
        chapters.append(chapter)
        topic = None
    if chapter is None:
        if not chapters:
            chapter = {'n': 0, 'title': 'Об издании и чтении книги', 'page': 1, 'topics': []}
            chapters.append(chapter)
    if topic is None:
        topic = {'id': f'{chapter["n"]}-intro', 'title': chapter['title'], 'level': 1,
                 'chapter': chapter['n'], 'page': pnum, 'blocks': []}
        chapter['topics'].append(topic)
        topics.append(topic)
    visuals = cover_graphic_text(page, blocks, graphics(page, blocks, pnum), pnum)
    figure_count += len(visuals)
    items = [(b['bbox'][1], 'text', b) for b in blocks]
    items += [(v['y'], 'figure', v) for v in visuals]
    for y, kind, b in sorted(items, key=lambda v: v[0]):
        if kind == 'figure':
            topic['blocks'].append(b)
            continue
        t = text(b)
        if not t:
            topic['blocks'].append(original_block(b, 'p'))
            continue
        if b['bbox'][1] <= 44 and not heading(b):
            topic['blocks'].append(original_block(b, 'running'))
            continue
        if heading(b):
            number = re.search(r'(?<!\d)([1-7]\.\d+(?:\.\d+)?)\.?(?=\s|$)', t)
            if number:
                code = number.group(1)
                title = clean(t[:number.start()] + t[number.end():])
                topic = {'id': code.replace('.', '-'), 'number': code, 'title': title,
                         'level': len(code.split('.')), 'chapter': chapter['n'],
                         'page': pnum, 'blocks': [],
                         'sourceTitle': {**original_block(b), 'html': rich(b['lines'], title=True)}}
                chapter['topics'].append(topic)
                topics.append(topic)
            else:
                spans = [s for l in b['lines'] for s in l['spans']]
                if ch and any(s['size'] >= 23 and s['text'].strip() == str(ch) for s in spans):
                    topic['sourceTitle'] = {**original_block(b), 'html': rich(b['lines'], title=True)}
                else:
                    topic['blocks'].append(original_block(b))
            continue
        if any(content_line(l) for l in b['lines']):
            generated = paragraphs(b, pnum)
            # Test each source prose/caption block, not a statistical sample.
            # No exceptions: retain every source character, including spaces,
            # newlines, ordinary hyphens and discretionary hyphens.
            expected = exact(b['lines'])
            actual = ''.join(v['text'] for v in generated)
            if expected != actual:
                raise ValueError(f'Text mismatch on source page {pnum}: {text(b)[:80]}')
            prose_checks.append({'page': pnum, 'characters': len(expected)})
            topic['blocks'].extend(generated)
    if pnum % 100 == 0:
        print(f'{pnum}/{len(doc)} pages, {len(topics)} topics, {figure_count} figure crops', flush=True)

manifest = {'id': 'alberts', 'title': 'Молекулярная биология клетки',
            'authors': 'Брюс Альбертс и соавторы', 'edition': '5-е издание · Том 1 · 2012',
            'pages': len(doc), 'source': 'source.pdf',
            'driveUrl': 'https://drive.google.com/file/d/1NR9AlsWwvBl2Nhs9kAUNId5UKrN0D9fj/view',
            'sha256': hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),
            'figures': figure_count, 'chapters': []}
for ch in chapters:
    name = f'chapter-{ch["n"]}.json'
    (OUT / name).write_text(json.dumps(ch, ensure_ascii=False, separators=(',', ':')))
    manifest['chapters'].append({**{k: v for k, v in ch.items() if k != 'topics'}, 'file': name,
                                'topics': [{k: v for k, v in t.items() if k not in ('blocks', 'sourceTitle')} for t in ch['topics']]})
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
(OUT / 'verbatim.json').write_text(json.dumps({'pages': verbatim}, ensure_ascii=False, separators=(',', ':')))
roundtrip = json.loads((OUT / 'verbatim.json').read_text())['pages']
for source, saved in zip(verbatim, roundtrip, strict=True):
    if source['text'] != saved['text'] or hashlib.sha256(saved['text'].encode()).hexdigest() != source['sha256']:
        raise ValueError(f'Verbatim roundtrip mismatch on page {source["page"]}')
audit = {'sourceSha256': manifest['sha256'], 'sourceBytes': Path(sys.argv[1]).stat().st_size,
         'pdfPages': len(doc), 'verbatimPagesChecked': len(roundtrip),
         'verbatimCodepoints': sum(len(p['text']) for p in roundtrip),
         'proseAndCaptionBlocksChecked': len(prose_checks),
         'proseAndCaptionCharactersChecked': sum(v['characters'] for v in prose_checks),
         'failures': 0,
         'textComparison': 'exact; no ignored or normalized characters',
         'scope': 'Exact text-layer roundtrip on every PDF page and exact character equality of native text blocks, including spaces and hyphens. Every source line must be accounted for by native text or an original-page graphic crop. Visual glyph mapping and published-edition completeness are not certified.',
         'sourceIssues': ['The supplied PDF ends mid-bibliographic-entry on PDF page 796 (printed page 813).',
                          'The supplied preliminary edition has inconsistent page references and unfinished publication metadata.']}
(OUT / 'audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2))
# Full text is an independent search index; the reader loads only the active chapter.
(OUT / 'search.json').write_text(json.dumps([
    {'id': t['id'], 'title': t['title'], 'chapter': t['chapter'], 'page': t['page'],
     'text': ' '.join(b.get('text', '') for b in t['blocks'])} for t in topics
], ensure_ascii=False, separators=(',', ':')))
audit['dataSha256'] = {f.name: hashlib.sha256(f.read_bytes()).hexdigest()
                       for f in list(OUT.glob('chapter-*.json')) + [OUT / 'verbatim.json', OUT / 'search.json']}
(OUT / 'audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2))
shutil.copyfile(sys.argv[1], OUT / 'source.pdf')
from verify_reading import verify
audit.update(verify())
(OUT / 'audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2))
print(f'Done: {len(topics)} topics, {figure_count} illustrations, {len(doc)} source pages')
