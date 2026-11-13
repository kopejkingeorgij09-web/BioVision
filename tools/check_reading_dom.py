"""Compare every native reading DOM text node with the verified book data.

Requires Playwright and a local BioVision HTTP server on port 8000.
No application data is sent to external services. Screenshots are optional.
"""
import json
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8000/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium')
    context = browser.new_context(viewport={'width': 390, 'height': 844}, color_scheme='dark', service_workers='block')
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE)
                  and route.request.resource_type != 'image' else route.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '#/reading')
    page.locator('.rd-book').wait_for()
    manifest = page.evaluate("fetch('content/reading/alberts/manifest.json').then(r=>r.json())")
    count = 0
    for chapter in manifest['chapters']:
        result = page.evaluate('''async (entry) => {
          const c = await (await fetch('content/reading/alberts/'+entry.file)).json();
          let checked=0, characters=0, figures=0;
          for(const t of c.topics){
            location.hash='#/reading/alberts/'+t.id;
            const start=performance.now();let article;
            while(!(article=BVHOST.root.querySelector('.rd-text[data-rd-topic="'+t.id+'"]'))){
              if(performance.now()-start>10000)throw Error('Topic did not open: '+t.id);
              await new Promise(r=>setTimeout(r,1));
            }
            const expected=[...(t.sourceTitle?[t.sourceTitle]:[]),...t.blocks.filter(b=>b.kind!=='figure')];
            const actual=[...article.querySelectorAll('[data-rd-source]')];
            if(actual.length!==expected.length)throw Error('Different text block count: '+t.id);
            const byKey=new Map(actual.map(el=>[el.dataset.rdSource,el]));
            for(const b of expected){
              const s=b.source,key=s.page+':'+s.block+':'+s.lines.join(',');
              const el=byKey.get(key);
              if(!el||el.textContent!==b.text)throw Error('DOM character mismatch: '+t.id+' '+key);
              checked++;characters+=b.text.length;
            }
            const originalFigures=t.blocks.filter(b=>b.kind==='figure');
            const imgs=[...article.querySelectorAll('.rd-figure img')];
            if(imgs.length!==originalFigures.length)throw Error('Different figure count: '+t.id);
            for(let i=0;i<imgs.length;i++)if(!new URL(imgs[i].src).pathname.endsWith(originalFigures[i].src))throw Error('Wrong figure: '+t.id);
            figures+=imgs.length;
          }
          return {topics:c.topics.length,textBlocks:checked,domCodeUnits:characters,figures};
        }''', chapter)
        count += result['topics']
        print('Chapter', chapter['n'], json.dumps(result), flush=True)
    assert count == 401
    assert not errors, errors
    print('PASS: every text block and every figure is rendered across all', count,
          'outline entries; no character normalization or hyphen exceptions.', flush=True)
    browser.close()
