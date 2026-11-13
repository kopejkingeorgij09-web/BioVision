"""Regression checks for the November BioViz review fixes.

Run a local HTTP server, then: python tools/check_review_fixes.py --url http://127.0.0.1:8010/
Requires Playwright and Chromium. All cloud calls are mocked; no real user data is read or written.
"""
import argparse
import copy
import json
import shutil
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8010/')
parser.add_argument('--only', nargs='+', choices=['progress', 'editor', 'backups', 'offline', 'smoke'])
ARGS = parser.parse_args()
BASE = ARGS.url.rstrip('/') + '/'
LAB = {'id': 'review', 'data': {'title': 'Review lab', 'goal': 'original goal',
       'draft': True, 'photos': [{'id': 'photo_review', 'cap': 'Review'}]}}


class Cloud:
    def __init__(self, context, code='STUDENT-A', local=None):
        self.docs = {'student-a': {'other': 'keep', 'prog': {
            'seen': {'l01': ['mb1', 'mb2']}, 'last': {'id': 'l01', 's': 'mb2'}, 't': 20}},
            'student-b': {'prog': {'seen': {}, 'last': None}}}
        self.writes = []
        self.failure = None
        self.missing_photo = False
        context.add_init_script("localStorage.setItem('bv_code',%s);%s" % (json.dumps(code), local or ''))
        context.route('**/*', self.route)

    def route(self, route):
        req = route.request
        if req.url.startswith(BASE):
            return route.continue_()
        if '/rpc/' not in req.url:
            return route.abort()
        fn = req.url.rsplit('/', 1)[-1]
        data = req.post_data_json
        col = data.get('p_col')
        if self.failure == (fn, col):
            return route.fulfill(status=503, json={'message': 'simulated read outage'})
        if fn == 'bv_login':
            code = data['p_code']
            result = {'role': 'admin' if code == 'ADMIN' else 'student',
                      'id': 'teacher' if code == 'ADMIN' else code.lower(), 'name': 'Review'}
        elif fn == 'bv_get':
            result = self.docs.get(data['p_id']) if col == 'students' else (
                None if self.missing_photo else {'src': 'data:image/png;base64,'}) if col == 'labfiles' else {}
        elif fn == 'bv_set':
            self.writes.append(copy.deepcopy(data))
            self.docs[data['p_id']] = copy.deepcopy(data['p_data'])
            result = True
        elif fn == 'bv_codes':
            result = [{'id': 'student-a', 'name': 'Review', 'code': 'TEST-ONLY'}]
        elif fn == 'bv_list':
            result = [copy.deepcopy(LAB)] if col == 'labworks' else []
        else:
            result = True
        route.fulfill(status=200, content_type='application/json', body=json.dumps(result))


def progress(browser):
    context = browser.new_context(service_workers='block')
    cloud = Cloud(context, local="localStorage.setItem('bv2:seen:l01','[\"someone-else\"]');")
    page = context.new_page()
    page.goto(BASE)
    page.wait_for_function("localStorage.getItem('bv2:progress:student-a:seen:l01') === '[\"mb1\",\"mb2\"]'")
    page.wait_for_timeout(500)
    assert cloud.docs['student-a']['prog']['seen'] == {'l01': ['mb1', 'mb2']}
    assert cloud.docs['student-a']['other'] == 'keep'
    assert cloud.docs['student-a']['prog']['last']['t'] == 20
    page.evaluate("BV.lectureStore.set('seen:l01',['mb1','mb2','mb3']); BV.progress.sync(true)")
    page.wait_for_function("BV.progress.seenOf('l01').has('mb3')")
    page.wait_for_timeout(700)
    assert cloud.docs['student-a']['prog']['seen']['l01'] == ['mb1', 'mb2', 'mb3']
    page.evaluate("BVAUTH.login('STUDENT-B')")
    page.wait_for_timeout(700)
    assert cloud.docs['student-b']['prog']['seen'] == {}
    assert page.evaluate("[...BV.progress.seenOf('l01')]") == []
    page.evaluate("location.hash='#/me'")
    expect(page.locator('#meImport')).to_be_visible()
    page.evaluate("BVAUTH.login('STUDENT-A')")
    page.wait_for_timeout(700)
    assert page.evaluate("BV.progress.seenOf('l01').has('mb3')")
    page.locator('#meImport').click()
    expect(page.locator('#meImport')).to_have_count(0)
    page.wait_for_timeout(700)
    assert 'someone-else' in cloud.docs['student-a']['prog']['seen']['l01']
    saved_state = context.storage_state()
    # A delayed read from A must never write after login as B (especially an admin).
    page.evaluate("""() => {const use=claude.use;window.releaseRead=null;
      claude.use=async n=>{const db=await use(n);if(n!=='db')return db;
        return {...db,doc(path){const ref=db.doc(path);if(path==='students/student-a')
          return {...ref,get:()=>new Promise(r=>{window.releaseRead=()=>r({exists:false})})};return ref}}};
      BV.progress.sync(true)}""")
    page.wait_for_function('window.releaseRead !== null')
    before = len(cloud.writes)
    page.evaluate("BVAUTH.login('ADMIN').then(()=>window.releaseRead())")
    page.wait_for_timeout(500)
    assert len(cloud.writes) == before
    context.close()
    context = browser.new_context(service_workers='block', storage_state=saved_state)
    cloud = Cloud(context)
    cloud.failure = ('bv_login', None)
    page = context.new_page()
    page.goto(BASE)
    page.locator('#pg-home h1').wait_for()
    assert page.evaluate("BVAUTH.me === null && BV.progress.seenOf('l01').has('mb3')")
    assert not cloud.writes
    context.close()
    print('PASS progress: cloud preserved, local profiles isolated, stale session cancelled', flush=True)


def editor(browser):
    context = browser.new_context(service_workers='block')
    cloud = Cloud(context, code='ADMIN')
    page = context.new_page()
    dialogs = []
    accept = False

    def dialog(d):
        dialogs.append(d.type)
        d.accept() if accept else d.dismiss()

    page.on('dialog', dialog)
    page.goto(BASE + '#/labs/review/edit')
    goal = page.locator('textarea[name=goal]')
    goal.fill('unsaved notes')
    page.locator('.tabs [data-nav=home]').click()
    expect(goal).to_have_value('unsaved notes')
    assert page.url.endswith('#/labs/review/edit') and dialogs == ['confirm']
    accept = True
    page.locator('.tabs [data-nav=home]').click()
    expect(page.locator('#pg-home h1')).to_be_visible()
    page.evaluate("location.hash='#/labs/review/edit'")
    expect(goal).to_have_value('original goal')
    accept = False
    page.locator('[data-rm]').click()
    page.locator('.tabs [data-nav=home]').click()
    expect(page).to_have_url(BASE + '#/labs/review/edit')
    goal.fill('saved notes')
    count = len(dialogs)
    page.locator('.lw-form button[type=submit]').click()
    expect(page).to_have_url(BASE + '#/labs/review')
    assert len(dialogs) == count
    assert any(w.get('p_col') == 'labworks' and w['p_data']['goal'] == 'saved notes' for w in cloud.writes)
    context.close()
    print('PASS editor: cancel preserves text/photos; confirm leaves; saving needs no discard prompt', flush=True)


def backups(browser):
    cases = [('bv_codes', None), ('bv_list', 'students'), ('bv_list', 'labworks'),
             ('bv_get', 'site'), ('bv_get', 'labfiles'), 'missing', None]
    for failure in cases:
        context = browser.new_context(service_workers='block', accept_downloads=True)
        cloud = Cloud(context, code='ADMIN')
        page = context.new_page()
        downloads = []
        page.on('download', lambda d: downloads.append(d))
        page.goto(BASE + '#/me')
        page.locator('[data-bak]').wait_for()
        cloud.failure = failure if isinstance(failure, tuple) else None
        cloud.missing_photo = failure == 'missing'
        page.locator('[data-bak]').click()
        if failure is None:
            expect(page.locator('[data-bm]')).to_have_text('Готово.')
            assert len(downloads) == 1
            result = json.loads(downloads[0].path().read_text())
            assert 'photo_review' in result['labfiles'] and len(result['labworks']) == 1
        else:
            expect(page.locator('[data-bm]')).to_contain_text('Не получилось собрать копию')
            assert not downloads
        context.close()
    print('PASS backups: all six failure modes block incomplete downloads; full backup succeeds', flush=True)


def offline(browser):
    context = browser.new_context(service_workers='allow', accept_downloads=True)
    Cloud(context, code='')
    page = context.new_page()
    page.goto(BASE)
    page.wait_for_function('window.BV && BV.offline && navigator.serviceWorker.controller')
    assert page.evaluate('BV.offline.save()')
    # Delete one mandatory script while all optional images remain cached.
    page.wait_for_timeout(500)  # Let the worker finish its background cache writes.
    assert page.evaluate("""async()=>{const c=await caches.open('bioviz-v3');
      const u=new URL('bioviz/core/base.js?v='+BV_VER,location.href).href;
      window.realFetch=window.fetch;window.fetch=(url,...args)=>String(url).includes('/base.js?')
        ?Promise.reject(new Error('Simulated missing script')):window.realFetch(url,...args);
      await c.delete(u);return !await c.match(u)}""")
    assert not page.evaluate('BV.offline.save()')
    assert page.evaluate("BV.store.get('offline',null)") is None
    page.evaluate('window.fetch=window.realFetch')
    assert page.evaluate('BV.offline.save()')
    assert page.evaluate("BV.store.get('offline',null).ver === BV_VER")
    context.close()
    # A new browser has never imported PDF.js. Upload prepares the reader, worker and fonts.
    context = browser.new_context(service_workers='allow')
    Cloud(context, code='')
    page = context.new_page()
    page.goto(BASE + '#/reading')
    expect(page.locator('.rd-book')).to_be_visible()
    assert not page.evaluate("performance.getEntriesByType('resource').some(r=>r.name.endsWith('/pdf.mjs'))")
    text = b'BT /F1 18 Tf 30 150 Td (Offline textbook) Tj ET'
    parts = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
             b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 250 250] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
             b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
             b'<< /Length ' + str(len(text)).encode() + b' >>\nstream\n' + text + b'\nendstream']
    pdf = b'%PDF-1.4\n'
    offsets = [0]
    for i, part in enumerate(parts, 1):
        offsets.append(len(pdf))
        pdf += str(i).encode() + b' 0 obj\n' + part + b'\nendobj\n'
    xref = len(pdf)
    pdf += b'xref\n0 6\n0000000000 65535 f \n' + b''.join(('%010d 00000 n \n' % n).encode() for n in offsets[1:])
    pdf += ('trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n%d\n%%%%EOF\n' % xref).encode()
    page.locator('[data-upload]').set_input_files({'name': 'offline.pdf', 'mimeType': 'application/pdf', 'buffer': pdf})
    expect(page.locator('[data-upload-status]')).to_have_text('Добавлено PDF: 1.', timeout=60000)
    href = page.locator('.rd-local-row a').get_attribute('href')
    context.set_offline(True)
    # Reload the whole shell offline before opening this PDF for the first time.
    page.reload()
    expect(page.locator('.rd-local-row a')).to_be_visible(timeout=30000)
    page.locator('.rd-local-row a').click()
    expect(page.locator('.rd-pdf-page .textLayer')).to_contain_text('Offline textbook', timeout=30000)
    expect(page.locator('.rd-pdf-page canvas')).to_be_visible()
    assert page.url.endswith(href)
    context.close()
    print('PASS offline: partial cache retries; fresh decoder renders stored PDF after offline reload', flush=True)


def smoke(browser):
    for width in (390, 820, 1280):
        for theme in ('light', 'dark'):
            context = browser.new_context(viewport={'width': width, 'height': 900}, color_scheme=theme, service_workers='block')
            Cloud(context, code='')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            for route, selector in [('#/l/1', '#m-l01 .k-title'), ('#/l/2', '#m-l02 .k-title'),
                                    ('#/reading/practice/1.1', '.rd-question')]:
                page.goto(BASE + route)
                expect(page.locator(selector).first).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            assert not errors, errors
            context.close()
    context = browser.new_context(service_workers='block')
    Cloud(context, code='')
    page = context.new_page()
    page.route('**/bioviz/core/konspekt.js?*', lambda r: r.abort())
    page.goto(BASE)
    expect(page.locator('#boot')).to_contain_text('Не получилось загрузить курс', timeout=20000)
    expect(page.get_by_role('button', name='Обновить', exact=True)).to_be_visible()
    page.unroute('**/bioviz/core/konspekt.js?*')
    page.get_by_role('button', name='Обновить', exact=True).click()
    expect(page.locator('#pg-home h1')).to_be_visible()
    context.close()
    print('PASS smoke: phone/tablet/desktop, both themes, visible startup failure and recovery', flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'))
    try:
        checks = {'progress': progress, 'editor': editor, 'backups': backups, 'offline': offline, 'smoke': smoke}
        for name in ARGS.only or checks:
            checks[name](browser)
    finally:
        browser.close()
