"""Verify all supplied source pages and the checked reflow artifacts (PyMuPDF)."""
from pathlib import Path
import hashlib
import html
import json
import re
import fitz

base = Path(__file__).resolve().parents[1] / 'content/reading/alberts'
read = lambda name: json.loads((base / name).read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
audit, manifest = read('audit.json'), read('manifest.json')
assert audit['failures'] == 0
assert sha(base / 'source.pdf') == manifest['sha256'] == audit['sourceSha256']
doc = fitz.open(base / 'source.pdf')
verbatim = read('verbatim.json')['pages']
assert len(doc) == len(verbatim) == manifest['pages'] == audit['verbatimPagesChecked']
for number, page in enumerate(doc, 1):
    blocks = page.get_text('dict', flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']
    exact = ''.join(''.join(s['text'] for s in line['spans']) + '\n'
                    for block in blocks for line in block.get('lines', []))
    saved = verbatim[number - 1]
    assert saved['page'] == number
    assert exact == saved['text'], f'Exact text mismatch on PDF page {number}'
    assert hashlib.sha256(exact.encode()).hexdigest() == saved['sha256']
for name, digest in audit['dataSha256'].items():
    assert sha(base / name) == digest, f'Content changed since ordered-character audit: {name}'
ids, sections, figures = set(), set(), set()
compare = lambda text: re.sub(r'[\s-]', '', text)
for entry in manifest['chapters']:
    chapter = read(entry['file'])
    assert [t['id'] for t in entry['topics']] == [t['id'] for t in chapter['topics']]
    for topic in chapter['topics']:
        assert topic['id'] not in ids
        ids.add(topic['id'])
        if topic['level'] == 2:
            sections.add(topic['number'])
        for block in topic['blocks']:
            assert 1 <= block['page'] <= len(doc)
            if 'html' in block:
                plain = html.unescape(re.sub(r'<[^>]+>', '', block['html']))
                assert compare(plain) == compare(block['text']), f'HTML text mismatch in {topic["id"]}'
            if block['kind'] == 'figure':
                assert (base / block['src']).is_file()
                assert block['width'] > 0 and block['height'] > 0
                figures.add(block['src'])
questions = read('questions.json')
assert len({q['id'] for q in questions}) == len(questions)
assert {q['section'] for q in questions} == sections
for section in sections:
    assert {q['type'] for q in questions if q['section'] == section} == {'mcq', 'think'}
for q in questions:
    assert q['sourceTopic'] in ids
    assert q['explanation'] and q['prompt']
    if q['type'] == 'mcq':
        assert len(q['options']) >= 3 and 0 <= q['correct'] < len(q['options'])
assert len(figures) == manifest['figures']
print(f'PASS: {len(doc)} exact source pages; {audit["verbatimCodepoints"]:,} text-layer codepoints; '
      f'{audit["proseAndCaptionBlocksChecked"]} audited prose/caption blocks; '
      f'{len(ids)} outline entries; {len(figures)} composite illustrations; {len(questions)} questions.')
print('Scope: text-layer fidelity and complete supplied PDF; visual glyph mapping and published-edition completeness are not certified.')
