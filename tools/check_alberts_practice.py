"""Validate the Alberts practice bank and exercise every card in Chromium.

Requires a local HTTP server, Playwright and Chromium for browser checks.
Cloud requests are blocked; only disposable browser-local answers are written.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import shutil

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8010/')
parser.add_argument('--no-browser', action='store_true')
args = parser.parse_args()
base = Path(__file__).resolve().parents[1] / 'content/reading/alberts'
qs = json.loads((base / 'questions.json').read_text())
meta = json.loads((base / 'manifest.json').read_text())
topics = {t['id']: t for c in meta['chapters'] for t in c['topics']}
sections = {t['number'] for t in topics.values() if t['level'] == 2}
assert len(qs) >= 300
assert len({q['id'] for q in qs}) == len(qs)
assert len({q['prompt'].casefold().strip() for q in qs}) == len(qs), 'Duplicate prompt'
assert {q['section'] for q in qs} == sections
assert {q['chapter'] for q in qs} == set(range(1, 8))
assert all(Counter(q['type'] for q in qs)[k] >= 150 for k in ('mcq', 'think'))
for section in sections:
    group = [q for q in qs if q['section'] == section]
    assert len(group) >= 8
    assert {q['type'] for q in group} == {'mcq', 'think'}
for q in qs:
    t = topics[q['sourceTopic']]
    assert q['section'] == '.'.join(q['sourceTopic'].split('-')[:2])
    assert str(q['chapter']) == q['section'].split('.')[0]
    assert q['sourcePage'] == t['page']
    assert len(q['explanation']) >= 80 and len(q['prompt']) >= 30
    if q['type'] == 'mcq':
        assert len(q['options']) == 4 and len(set(q['options'])) == 4
        assert type(q['correct']) is int and 0 <= q['correct'] < 4
    assert not any('<' in q[k] or '>' in q[k] for k in ('prompt', 'explanation'))
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
    page.evaluate("location.hash='#/reading/alberts/1-1-10'")
    expect(page.locator('[data-inline] .rd-question')).to_have_count(4)
    expect(page.locator('[data-inline] .rd-quiz-head a')).to_contain_text(str(sum(q['section'] == '1.1' for q in qs)))
    assert not errors, errors
    context.close()
    print('PASS browser: all 300 cards, answers and sources; old draft; pagination, filters, shuffle and short inline practice', flush=True)
    for width in (390, 820, 1280):
        for theme in ('light', 'dark'):
            context = browser.new_context(viewport={'width': width, 'height': 900}, color_scheme=theme, service_workers='block')
            context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url) else r.abort())
            page = context.new_page()
            page.goto(url + '#/reading/practice/7.5')
            expect(page.locator('.rd-question')).to_have_count(min(20, sum(q['section'] == '7.5' for q in qs)))
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            context.close()
    print('PASS layout: phone, tablet and desktop in both themes', flush=True)
    browser.close()
