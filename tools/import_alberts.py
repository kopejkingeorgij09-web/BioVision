"""Import the owner's Alberts volume 1 PDF. Requires PyMuPDF and Pillow.

Usage: python3 tools/import_alberts.py /path/to/volume1.pdf
The PDF is the authority; generated text is accompanied by source page links.
"""
import collections
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
WORD_FORMS = set(re.findall(r'[а-яёa-z]+(?:-[а-яёa-z]+)*',
                           '\n'.join(p.get_text() for p in doc).lower()))


def discretionary(left, right):
    # Never silently erase a genuine compound-word hyphen. Join a line-wrap
    # hyphen only if the unbroken word is attested elsewhere in this very PDF
    # and the hyphenated compound is not. Unknown forms retain the source '-'.
    return ((left + right).lower() in WORD_FORMS
            and (left + '-' + right).lower() not in WORD_FORMS)


def dewrap(s):
    return re.sub(r'([а-яёa-z]+)-\n([а-яёa-z]+)',
                  lambda m: m[1] + ('' if discretionary(m[1], m[2]) else '-') + m[2], s)


def clean(s):
    return re.sub(r'\s+', ' ', s.replace('\u00ad', '').replace('\u2002', ' ')).strip()


def joined(lines):
    s = '\n'.join(lines)
    s = dewrap(s)
    return clean(s)


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
            Image.open(io.BytesIO(pix.tobytes('png'))).save(target, 'WEBP', quality=90)
        with Image.open(target) as im:
            width, height = im.size
        out.append({'kind': 'figure', 'src': 'figures/' + name,
                    'width': width, 'height': height, 'page': pnum,
                    'y': r.y0, 'alt': f'Иллюстрация со страницы {pnum} PDF'})
    return out


def paragraphs(b, pnum):
    lines = b['lines']
    chunks, current = [], []
    left = min(l['bbox'][0] for l in lines)
    for l in lines:
        # Original paragraphs start with a 22.7 pt indent. Caption blocks do not.
        if current and l['bbox'][0] > left + 14 and l['bbox'][0] < left + 30:
            chunks.append(current)
            current = []
        current.append(l)
    if current:
        chunks.append(current)
    result = []
    for chunk in chunks:
        parts = []
        for l in chunk:
            line = ''
            for s in l['spans']:
                v = html.escape(s['text'].replace('\u00ad', ''))
                if 'Bold' in s['font']:
                    v = '<b>' + v + '</b>'
                if 'Italic' in s['font'] or s['font'].endswith('-It'):
                    v = '<i>' + v + '</i>'
                if s['size'] < 7.5:
                    # PDF flags mark superscripts; preserve other small glyphs
                    # as subscripts (chemical formulae are frequent).
                    tag = 'sup' if s['flags'] & 1 else 'sub'
                    v = f'<{tag}>' + v + f'</{tag}>'
                line += v
            parts.append(line)
        v = '\n'.join(parts)
        v = dewrap(v)
        v = re.sub(r'\s+', ' ', v).strip()
        if v:
            result.append({'kind': 'caption' if any('Calibri' in s['font'] for s in chunk[0]['spans']) else 'p',
                           'html': v, 'text': joined([''.join(s['text'] for s in l['spans']) for l in chunk]),
                           'page': pnum, 'y': chunk[0]['bbox'][1]})
    return result


chapters, topics = [], []
verbatim = []
prose_checks = []
chapter = None
topic = None
figure_count = 0
chapter_names = {
    1: 'Клетки и геномы', 2: 'Химия клетки и биосинтез', 3: 'Белки',
    4: 'ДНК, хромосомы и геномы', 5: 'Репликация, восстановление и рекомбинация ДНК',
    6: 'Клеточные механизмы считывания генома: от ДНК к белку',
    7: 'Управление экспрессией генов',
}

for pi, page in enumerate(doc):
    pnum = pi + 1
    all_blocks = page.get_text('dict', flags=FLAGS)['blocks']
    # Exact, unmodified text layer: no dehyphenation, normalization or rewriting.
    raw_text = ''.join(''.join(s['text'] for s in l['spans']) + '\n'
                       for b in all_blocks for l in b.get('lines', []))
    verbatim.append({'page': pnum, 'text': raw_text,
                     'sha256': hashlib.sha256(raw_text.encode()).hexdigest()})
    blocks = []
    for b in all_blocks:
        if b['bbox'][1] <= 44:
            continue
        # A PDF block can contain BOTH a heading and the following paragraph.
        # Separating it by lines prevents the paragraph from being discarded.
        if heading(b) and any(content_line(l) for l in b['lines']):
            for selected in [[l for l in b['lines'] if not content_line(l)],
                             [l for l in b['lines'] if content_line(l)]]:
                if selected:
                    r = fitz.Rect(selected[0]['bbox'])
                    for line in selected[1:]:
                        r |= fitz.Rect(line['bbox'])
                    blocks.append({'type': 0, 'bbox': tuple(r), 'lines': selected})
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
    visuals = graphics(page, blocks, pnum)
    figure_count += len(visuals)
    items = [(b['bbox'][1], 'text', b) for b in blocks]
    items += [(v['y'], 'figure', v) for v in visuals]
    for y, kind, b in sorted(items, key=lambda v: v[0]):
        if kind == 'figure':
            topic['blocks'].append(b)
            continue
        t = text(b)
        if not t:
            continue
        if heading(b):
            number = re.search(r'(?<!\d)([1-7]\.\d+(?:\.\d+)?)\.?(?=\s|$)', t)
            if number:
                code = number.group(1)
                title = clean(t[:number.start()] + t[number.end():])
                title = re.sub(r'([а-яё])-\s+([а-яё])', r'\1\2', title)
                topic = {'id': code.replace('.', '-'), 'number': code, 'title': title,
                         'level': len(code.split('.')), 'chapter': chapter['n'],
                         'page': pnum, 'blocks': []}
                chapter['topics'].append(topic)
                topics.append(topic)
            else:
                # Chapter titles are already in the reader's own heading.
                spans = [s for l in b['lines'] for s in l['spans']]
                if not any(s['size'] >= 23 for s in spans):
                    topic['blocks'].append({'kind': 'heading', 'text': t, 'page': pnum})
            continue
        if any(content_line(l) for l in b['lines']):
            generated = paragraphs(b, pnum)
            # Test each source prose/caption block, not a statistical sample.
            # Whitespace and line-wrap hyphens change in reflow; all remaining
            # characters must appear in exactly the same order.
            compare = lambda s: re.sub(r'[\s-]', '', s.replace('\u00ad', ''))
            expected = compare(text(b))
            actual = compare(''.join(v['text'] for v in generated))
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
    # Reflow paragraphs split by a printed page, even when a figure/caption is
    # between their two halves. Keep source-page navigation for the other blocks.
    for t in ch['topics']:
        previous = None
        merged = []
        for b in t['blocks']:
            if b['kind'] == 'p':
                if (previous and previous['page'] != b['page']
                        and re.match(r'^[а-яёa-z]', b['text'])
                        and not re.search(r'[.!?:;][»”\"]?$', previous['text'])):
                    hyphen = previous['text'].endswith('-')
                    left = re.search(r'([а-яёa-z]+)-$', previous['text'])
                    right = re.match(r'([а-яёa-z]+)', b['text'])
                    if hyphen and left and right and discretionary(left[1], right[1]):
                        previous['text'] = previous['text'][:-1]
                        previous['html'] = re.sub(r'-((?:</[^>]+>)*)$', r'\1', previous['html'])
                    previous['text'] += ('' if hyphen else ' ') + b['text']
                    previous['html'] += ('' if hyphen else ' ') + b['html']
                    continue
                previous = b
            merged.append(b)
        t['blocks'] = merged
    name = f'chapter-{ch["n"]}.json'
    (OUT / name).write_text(json.dumps(ch, ensure_ascii=False, separators=(',', ':')))
    manifest['chapters'].append({**{k: v for k, v in ch.items() if k != 'topics'}, 'file': name,
                                'topics': [{k: v for k, v in t.items() if k != 'blocks'} for t in ch['topics']]})
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
         'scope': 'Exact text-layer roundtrip on every PDF page; ordered character comparison of every reflowed prose/caption block, ignoring whitespace and line-wrap hyphens. This is not proof of visual glyph mapping or completeness of the published edition.',
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
print(f'Done: {len(topics)} topics, {figure_count} illustrations, {len(doc)} source pages')
