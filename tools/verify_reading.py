"""Independently compare source PDF characters with every displayed text block."""
from pathlib import Path
from html.parser import HTMLParser
import collections
import hashlib
import json
import fitz


class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def html_text(markup):
    parser = TextOnly()
    parser.feed(markup)
    parser.close()
    return ''.join(parser.parts)


def verify():
    base = Path(__file__).resolve().parents[1] / 'content/reading/alberts'
    read = lambda name: json.loads((base / name).read_text())
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    audit, manifest = read('audit.json'), read('manifest.json')
    assert audit['failures'] == 0
    assert audit['textComparison'] == 'exact; no ignored or normalized characters'
    assert sha(base / 'source.pdf') == manifest['sha256'] == audit['sourceSha256']
    doc = fitz.open(base / 'source.pdf')
    verbatim = read('verbatim.json')['pages']
    assert len(doc) == len(verbatim) == manifest['pages'] == audit['verbatimPagesChecked']
    source_lines, source_rects = {}, {}
    for number, page in enumerate(doc, 1):
        blocks = page.get_text('dict', flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']
        values = []
        for bi, block in enumerate(blocks):
            for li, line in enumerate(block['lines']):
                value = ''.join(s['text'] for s in line['spans']) + '\n'
                key = (number, bi, li)
                assert key not in source_lines
                source_lines[key] = value
                source_rects[key] = fitz.Rect(line['bbox']) & page.rect
                values.append(value)
        exact = ''.join(values)
        saved = verbatim[number - 1]
        assert saved['page'] == number
        assert exact == saved['text'], f'Exact text mismatch on PDF page {number}'
        assert hashlib.sha256(exact.encode()).hexdigest() == saved['sha256']
    for name, digest in audit['dataSha256'].items():
        assert sha(base / name) == digest, f'Content changed since audit: {name}'
    accounted = collections.Counter()
    stats = {'sourceTextLinesTotal': len(source_lines), 'nativeTextBlocksVerified': 0,
             'nativeTextLinesVerified': 0, 'nativeTextCodepointsVerified': 0,
             'graphicTextLinesVerified': 0}
    ids, sections, figures = set(), set(), set()

    def keys(ref):
        assert ref['lines'] == sorted(set(ref['lines'])), f'Out-of-order source lines: {ref}'
        return [(ref['page'], ref['block'], li) for li in ref['lines']]

    def check_text(block):
        assert 'source' in block, f'Untraceable text block on page {block["page"]}'
        references = keys(block['source'])
        expected = ''.join(source_lines[key] for key in references)
        assert expected == block['text'], f'Exact source mismatch: {block["source"]}'
        assert html_text(block['html']) == expected, f'HTML changed source characters: {block["source"]}'
        accounted.update(references)
        stats['nativeTextBlocksVerified'] += 1
        stats['nativeTextLinesVerified'] += len(references)
        stats['nativeTextCodepointsVerified'] += len(expected)

    for entry in manifest['chapters']:
        chapter = read(entry['file'])
        assert [t['id'] for t in entry['topics']] == [t['id'] for t in chapter['topics']]
        for topic in chapter['topics']:
            assert topic['id'] not in ids
            ids.add(topic['id'])
            if topic['level'] == 2:
                sections.add(topic['number'])
            if topic.get('sourceTitle'):
                check_text(topic['sourceTitle'])
            for block in topic['blocks']:
                assert 1 <= block['page'] <= len(doc)
                if block['kind'] != 'figure':
                    check_text(block)
                else:
                    assert (base / block['src']).is_file()
                    assert block['width'] > 0 and block['height'] > 0
                    rect = fitz.Rect(block['rect']) + (-1, -1, 1, 1)
                    for ref in block['sourceLines']:
                        for key in keys(ref):
                            assert key in source_lines
                            assert rect.contains(source_rects[key]), f'Clipped diagram label: {key}'
                            accounted[key] += 1
                            stats['graphicTextLinesVerified'] += 1
                    figures.add(block['src'])
    missing = set(source_lines) - set(accounted)
    duplicates = {key: n for key, n in accounted.items() if n != 1}
    assert not missing, f'{len(missing)} source lines missing: {sorted(missing)[:12]}'
    assert not duplicates, f'Source lines attributed more than once: {list(duplicates.items())[:12]}'
    assert set(accounted) == set(source_lines)
    stats['sourceTextLinesAccountedFor'] = len(accounted)
    questions = read('questions.json')
    assert len(questions) == audit['questions'], 'Practice count differs from audit metadata'
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
    if 'imageSha256' in audit:
        assert set(audit['imageSha256']) == figures
        for name, digest in audit['imageSha256'].items():
            assert sha(base / name) == digest, f'Original-page crop changed: {name}'
        stats['imageChecksumsVerified'] = len(figures)
    stats.update(pdfPagesVerified=len(doc), outlineEntries=len(ids), figures=len(figures), questions=len(questions))
    return stats


if __name__ == '__main__':
    print('PASS:', json.dumps(verify(), ensure_ascii=False))
    print('Every native text character matches its source PDF text layer, including spaces, line breaks and hyphens. '
          'Every source line is accounted for. Visual glyph mapping and published-edition completeness are not certified.')
