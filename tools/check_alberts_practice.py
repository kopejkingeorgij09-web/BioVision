"""Validate the Alberts practice bank and exercise every card in Chromium.

Requires a local HTTP server, Playwright and Chromium for browser checks.
Cloud requests are blocked; only disposable browser-local answers are written.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8010/')
parser.add_argument('--no-browser', action='store_true')
args = parser.parse_args()
base = Path(__file__).resolve().parents[1] / 'content/reading/alberts'
qs = json.loads((base / 'questions.json').read_text())
meta = json.loads((base / 'manifest.json').read_text())
topics = {t['id']: t for c in meta['chapters'] for t in c['topics']}
sections = {t['number'] for t in topics.values() if t['level'] == 2}
sources = {s['id']: s for s in json.loads((base / 'practice-sources.json').read_text())}
assert len(qs) == 600
assert len({q['id'] for q in qs}) == len(qs)
assert len({q['prompt'].casefold().strip() for q in qs}) == len(qs), 'Duplicate prompt'
assert {q['section'] for q in qs} == sections
assert {q['chapter'] for q in qs} == set(range(1, 8))
assert Counter(q['type'] for q in qs) == {'mcq': 450, 'think': 150}
for section in sections:
    group = [q for q in qs if q['section'] == section]
    assert len(group) >= 8
    counts = Counter(q['type'] for q in group)
    assert counts['mcq'] == 3 * counts['think'], section
    for start in range(0, len(group), 4):
        assert [q['type'] for q in group[start:start+4]] == ['mcq']*3+['think']
assert {q['adaptation']['id'] for q in qs if q.get('adaptation')} == set(sources)
assert {s['group'] for s in sources.values()} == {'yp', 'urfu', 'mipt', 'skoltech', 'mit'}
for s in sources.values():
    assert re.fullmatch('[0-9a-f]{64}', s['sha256'])
    assert urlparse(s['url']).scheme == 'https' and urlparse(s['url']).hostname
for q in qs:
    t = topics[q['sourceTopic']]
    assert q['section'] == '.'.join(q['sourceTopic'].split('-')[:2])
    assert str(q['chapter']) == q['section'].split('.')[0]
    assert q['sourcePage'] == t['page']
    assert len(q['explanation']) >= 80 and len(q['prompt']) >= 30
    if q['type'] == 'mcq':
        assert len(q['options']) == 4 and len(set(q['options'])) == 4
        assert type(q['correct']) is int and 0 <= q['correct'] < 4
    if q.get('adaptation'):
        a = q['adaptation']
        s = sources[a['id']]
        assert all(a[k] == s[k] for k in ('title', 'group', 'label', 'kind', 'url', 'changes'))
        assert type(a['page']) is int and 1 <= a['page'] <= s['pages']
        assert a['task']
        if a['group'] == 'mit':
            assert a['license'] == 'CC BY-NC-SA 4.0' and a['credit'] == s['credit']
print('PASS data:', len(qs), 'questions;', dict(Counter(q['type'] for q in qs)),
      '; 27 sections; chapter counts', dict(sorted(Counter(q['chapter'] for q in qs).items())), flush=True)
if args.no_browser:
    raise SystemExit(0)

from playwright.sync_api import sync_playwright, expect

url = args.url.rstrip('/') + '/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'))
    context = browser.new_context(service_workers='block')
    context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url) else r.abort())
    context.add_init_script("localStorage.setItem('bv2:reading:answer:1-1-think',JSON.stringify({draft:'Старый черновик',ok:false}));")
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url + '#/reading/practice/1.1')
    expect(page.locator('[data-question="1-1-think"] textarea')).to_have_value('Старый черновик')
    expect(page.locator('[data-bank-count]')).to_contain_text('к повторению 1')
    new_test = next(q for q in qs if q['section'] == '1.1' and '-extra-' in q['id'] and q['type'] == 'mcq')
    card = page.locator('[data-question="'+new_test['id']+'"]')
    card.locator('input[value="'+str((new_test['correct']+1)%4)+'"]').check()
    card.locator('[data-rd=answer]').click()
    expect(card.locator('[data-feedback]')).to_contain_text('Пока нет.')
    page.locator('[data-bank-section]').select_option('')
    page.locator('[data-bank-chapter]').select_option('')
    expect(page.locator('.rd-question')).to_have_count(20)
    expect(page.locator('.rd-question textarea')).to_have_count(5)
    # Every source link, prompt, explanation, answer and persisted record is exercised.
    checked = []
    while True:
        result = page.evaluate('''async qs => {
          const root=BVHOST.root, out=[];
          const wait=async test=>{const start=performance.now();while(!test()){
            if(performance.now()-start>5000)throw Error('Answer did not update');
            await new Promise(r=>setTimeout(r,1));}};
          for(const card of root.querySelectorAll('[data-bank-list] .rd-question')){
            const q=qs.find(q=>q.id===card.dataset.question);
            if(card.querySelector('h3').textContent!==q.prompt)throw Error('Prompt mismatch '+q.id);
            const links=[...card.querySelectorAll('a')].map(a=>a.getAttribute('href'));
            if(!links.includes('#/reading/alberts/'+q.sourceTopic)||!links.includes('#/reading/alberts/pdf/'+q.sourcePage))throw Error('Source link '+q.id);
            const citation=card.querySelector('[data-practice-source]');
            if(q.adaptation){
              const a=q.adaptation;
              if(!citation||citation.getAttribute('href')!==a.url.split('#')[0]+'#page='+a.page||!citation.textContent.includes(a.title))throw Error('Adaptation source '+q.id);
              if(citation.target!=='_blank'||!citation.rel.includes('noopener'))throw Error('Unsafe source link '+q.id);
              if(!card.querySelector('.rd-provenance').textContent.includes(a.task))throw Error('Missing task locator '+q.id);
            }else if(citation)throw Error('False adaptation label '+q.id);
            if(q.type==='mcq'){
              const opts=[...card.querySelectorAll('fieldset label span')].map(s=>s.textContent);
              if(JSON.stringify(opts)!==JSON.stringify(q.options))throw Error('Options mismatch '+q.id);
              card.querySelector('input[value="'+q.correct+'"]').checked=true;
              card.querySelector('[data-rd="answer"]').click();
            }else{
              card.querySelector('textarea').value='Мой разбор '+q.id;
              card.querySelector('[data-rd="reveal"]').click();
            }
            await wait(()=>card.querySelector('[data-feedback]').textContent.includes(q.explanation));
            if(q.type==='think')card.querySelector('[data-rd="self-ok"]').click();
            const answer=BV.store.get('reading:answer:'+q.id,null);
            if(!answer||answer.ok!==true)throw Error('Answer not saved '+q.id);
            if(q.type==='think'&&answer.draft!=='Мой разбор '+q.id)throw Error('Draft not saved '+q.id);
            out.push(q.id);
          }return out;
        }''', qs)
        checked.extend(result)
        if page.locator('[data-rd=bank-next]').is_disabled():
            break
        page.locator('[data-rd=bank-next]').click()
    assert len(checked) == len(set(checked)) == len(qs)
    expect(page.locator('[data-bank-count]')).to_contain_text(f'Закреплено {len(qs)} из {len(qs)}')
    page.locator('[data-bank-status]').select_option('new')
    expect(page.locator('.rd-question')).to_have_count(0)
    expect(page.locator('[data-bank-pager]')).to_be_hidden()
    page.locator('[data-bank-status]').select_option('')
    for group in ('adapted', 'original', 'yp', 'urfu', 'mipt', 'skoltech', 'mit'):
        page.locator('[data-bank-source]').select_option(group)
        expected = [q for q in qs if (bool(q.get('adaptation')) if group == 'adapted' else
                    not q.get('adaptation') if group == 'original' else q.get('adaptation', {}).get('group') == group)]
        expect(page.locator('[data-visible-count]')).to_contain_text(f'подборке: {len(expected)}')
        expect(page.locator('.rd-question')).to_have_count(min(20, len(expected)))
        if group not in ('original',):
            expect(page.locator('.rd-provenance')).to_have_count(min(20, len(expected)))
    # Intersect sources, type and theme, including an empty result.
    page.locator('[data-bank-type]').select_option('think')
    expect(page.locator('.rd-question')).to_have_count(0)
    page.locator('[data-bank-type]').select_option('')
    page.locator('[data-bank-source]').select_option('')
    page.locator('[data-bank-chapter]').select_option('7')
    expect(page.locator('[data-visible-count]')).to_contain_text(str(sum(q['chapter'] == 7 for q in qs)))
    page.locator('[data-bank-section]').select_option('7.5')
    page.locator('[data-bank-type]').select_option('mcq')
    expect(page.locator('.rd-question')).to_have_count(min(20, sum(q['section'] == '7.5' and q['type'] == 'mcq' for q in qs)))
    page.locator('[data-bank-chapter]').select_option('1')
    expect(page.locator('[data-bank-section]')).to_have_value('')
    shown = min(20, sum(q['chapter'] == 1 and q['type'] == 'mcq' for q in qs))
    expect(page.locator('.rd-question')).to_have_count(shown)
    page.locator('[data-rd=shuffle]').click()
    assert len(set(page.locator('.rd-question').evaluate_all('(els)=>els.map(e=>e.dataset.question)'))) == shown
    page.locator('[data-bank-type]').select_option('')
    page.locator('[data-bank-chapter]').select_option('')
    page.locator('[data-rd=shuffle]').click()
    expect(page.locator('.rd-question textarea')).to_have_count(5)
    for section in sorted(sections):
        end = [t for t in topics.values() if t['level'] == 3 and t['id'].startswith(section.replace('.', '-')+'-')][-1]
        page.evaluate('id=>location.hash="#/reading/alberts/"+id', end['id'])
        expect(page.locator('[data-inline] .rd-question')).to_have_count(4)
        expect(page.locator('[data-inline] textarea')).to_have_count(1)
        expect(page.locator('[data-inline] fieldset')).to_have_count(3)
        expect(page.locator('[data-inline] .rd-quiz-head a')).to_contain_text(str(sum(q['section'] == section for q in qs)))
    assert not errors, errors
    context.close()
    print('PASS browser: all 600 cards, answers and sources; old draft; pagination, source filters, shuffle and 3:1 inline practice in all 27 themes', flush=True)
    for width in (390, 820, 1280):
        for theme in ('light', 'dark'):
            context = browser.new_context(viewport={'width': width, 'height': 900}, color_scheme=theme, service_workers='block')
            context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url) else r.abort())
            page = context.new_page()
            page.goto(url + '#/reading/practice/7.5')
            expect(page.locator('.rd-question')).to_have_count(min(20, sum(q['section'] == '7.5' for q in qs)))
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.locator('[data-bank-section]').select_option('')
            page.locator('[data-bank-chapter]').select_option('')
            page.locator('[data-bank-source]').select_option('mit')
            page.locator('.rd-provenance summary').first.click()
            expect(page.locator('[data-practice-source]').first).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            context.close()
    print('PASS layout: phone, tablet and desktop in both themes', flush=True)
    browser.close()
