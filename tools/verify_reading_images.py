"""Verify every book illustration against a fresh raster of its PDF source crop.

--rebuild writes lossless WebP crops and records their checksums in audit.json.
Without the flag this command is read-only. Requires PyMuPDF and Pillow.
"""
import hashlib
import json
from pathlib import Path
import sys
import fitz
from PIL import Image

base = Path(__file__).resolve().parents[1] / 'content/reading/alberts'
manifest = json.loads((base / 'manifest.json').read_text())
audit_path = base / 'audit.json'
audit = json.loads(audit_path.read_text())
assert hashlib.sha256((base / 'source.pdf').read_bytes()).hexdigest() == manifest['sha256']
doc = fitz.open(base / 'source.pdf')
rebuild = '--rebuild' in sys.argv
figures = {}
for chapter in manifest['chapters']:
    for topic in json.loads((base / chapter['file']).read_text())['topics']:
        for block in topic['blocks']:
            if block['kind'] == 'figure':
                if block['src'] in figures:
                    assert figures[block['src']]['rect'] == block['rect']
                figures[block['src']] = block
hashes = {}
for i, (name, figure) in enumerate(sorted(figures.items()), 1):
    pix = doc[figure['page'] - 1].get_pixmap(matrix=fitz.Matrix(2.4, 2.4), clip=fitz.Rect(figure['rect']), alpha=False)
    original = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    path = base / name
    if rebuild:
        original.save(path, 'WEBP', lossless=True, method=2)
    with Image.open(path) as saved:
        assert saved.size == original.size == (figure['width'], figure['height']), f'Crop dimensions differ: {name}'
        assert saved.convert('RGB').tobytes() == original.tobytes(), f'Crop pixels differ: {name}'
    hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    if i % 100 == 0:
        print(f'{i}/{len(figures)} original-page crops verified pixel-for-pixel', flush=True)
assert len(figures) == manifest['figures']
if rebuild:
    audit.update(imageEncoding='lossless WebP', rasterScale=2.4,
                 originalCropsPixelVerified=len(figures), imageSha256=hashes)
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2))
else:
    assert hashes == audit['imageSha256'], 'Illustrations changed since the recorded pixel audit'
print(f'PASS: all {len(figures)} illustrations match fresh original-page crops pixel-for-pixel at 2.4x raster scale.', flush=True)
