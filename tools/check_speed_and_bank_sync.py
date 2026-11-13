"""Regressions for lazy loading, returning/offline visits, durable records and part-two sync.
Only local files and a simulated cloud are used; no real visitor data is accessed.
"""
from shutil import which
import copy, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE='http://127.0.0.1:8010/'
QS=json.loads((Path(__file__).resolve().parents[1]/'content/reading/alberts/questions.json').read_text())
MCQ=next(q for q in QS if q['section']=='1.1' and q['type']=='mcq')
class Cloud:
 def __init__(self):self.accounts={};self.fail=False;self.fail_files=set();self.requests=[]
 def route(self,route):
  req=route.request;self.requests.append(req.url)
  if req.url.startswith(BASE):
   if any(f in req.url for f in self.fail_files):return route.abort()
   return route.continue_()
  if '/rpc/' not in req.url:return route.abort()
  fn=req.url.rsplit('/',1)[-1];d=req.post_data_json
  if fn=='bv_personal_sync':
   if self.fail:return route.fulfill(status=503,json={'message':'test outage'})
   code=d['p_code'];action=d['p_action']
   if action=='create':
    if code in self.accounts:return route.fulfill(json={'error':'Код занят'})
    self.accounts[code]={'owner':'profile-'+str(len(self.accounts)+1),'records':{},'cursor':0}
   acc=self.accounts.get(code)
   if not acc:return route.fulfill(json={'error':'Код не найден'})
   items=[]
   if action=='push':
    for item in d['p_items']:
     old=acc['records'].get(item['id']);rev=old['rev'] if old else 0;ok=rev==item['rev']
     if ok:
      acc['cursor']+=1;old={'id':item['id'],'rev':rev+1,'data':copy.deepcopy(item['data']),'updated':acc['cursor']};acc['records'][item['id']]=old
     items.append({**old,'ok':ok})
   if action=='pull':items=[r for r in acc['records'].values() if r['updated']>d['p_items'][0].get('cursor',0)]
   return route.fulfill(json={'owner':acc['owner'],'items':items,'cursor':acc['cursor']})
  result=[] if fn=='bv_list' else {} if fn=='bv_get' else None if fn=='bv_login' else True
  return route.fulfill(json=result)
 def attach(self,c):c.route('**/*',self.route)

def ready(page,path,selector):
 page.goto(BASE+path);expect(page.locator(selector)).to_be_visible(timeout=15000)

def open_bank(page):ready(page,'#/reading/practice/1.1','[data-question="1-1-mcq"] textarea')

def connect(page,create):
 ready(page,'#/me','[data-personal-profile]');page.locator('[data-personal-profile]').click();page.locator('[data-code]').fill('TEST-CODE-BANK-SYNC');page.locator('button[value='+('create' if create else 'login')+']').click();expect(page.locator('[data-profile-status]')).to_contain_text('Синхронизировано')

with sync_playwright() as p:
 b=p.chromium.launch(executable_path=which('chromium'));cloud=Cloud();c=b.new_context(service_workers='block',viewport={'width':390,'height':844},color_scheme='dark');cloud.attach(c);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 ready(page,'#/reading','#rd-alberts')
 assert not any('/lectures/' in r or '/admin.js' in r or '/konspekt.js' in r for r in cloud.requests)
 assert page.locator('.intro').count()==0
 page.evaluate("location.hash='#/l/1'");expect(page.locator('#m-l01 .k-sheet')).to_be_visible();assert not any('/02-16s-' in r for r in cloud.requests)
 page.evaluate("location.hash='#/reading'");expect(page.locator('#rd-alberts')).to_be_visible();before=len(cloud.requests);page.evaluate("location.hash='#/l/1'");expect(page.locator('#m-l01 .k-sheet')).to_be_visible();assert not any('/lectures/' in r for r in cloud.requests[before:])
 # Failed optional modules never block an unrelated route, and retry is possible.
 cloud.fail_files={'/admin.js','/02-16s-'};page.evaluate("location.hash='#/l/2'");expect(page.get_by_role('button',name='Повторить',exact=True)).to_be_visible();page.evaluate("location.hash='#/reading'");expect(page.locator('#rd-alberts')).to_be_visible();cloud.fail_files.clear();page.evaluate("location.hash='#/l/2'");expect(page.locator('#m-l02 .k-sheet')).to_be_visible();c.close();print('PASS lazy loading: relevant files only, no replayed intro, repeat visit, optional failure isolation and retry',flush=True)
 # Global search must load and index the full course even if no lecture was opened yet.
 c=b.new_context(service_workers='block');cloud.attach(c);page=c.new_page();ready(page,'#/reading','#rd-alberts');page.locator('.sr-btn').click();expect(page.locator('.sr-in input')).to_be_visible();page.locator('.sr-in input').fill('эндосимбиоз');expect(page.locator('.sr-it').first).to_be_visible();page.keyboard.press('Escape');before=len(cloud.requests);page.locator('.sr-btn').click();expect(page.locator('.sr-in input')).to_be_visible();assert not any('/lectures/' in r for r in cloud.requests[before:]);c.close();print('PASS lazy search: complete course index on demand, reused on repeat',flush=True)
 # An old profile is readable without copying its entire blob; each edit writes one record.
 c=b.new_context(service_workers='block');cloud.attach(c);c.add_init_script("""if(!localStorage.getItem('seeded')){const records={};for(let i=0;i<600;i++)records['reading:answer:old'+i]={value:{draft:'Механизм и проверка. '.repeat(100)},rev:1,dirty:false};records['reading:answer:1-1-mcq']={value:{ok:true,chosen:1,draft:'Старый ответ'},rev:0,dirty:true};localStorage.setItem('bv-personal-state:guest',JSON.stringify({records}));localStorage.setItem('seeded','1')}""")
 page=c.new_page();open_bank(page);card=page.locator('[data-question="1-1-mcq"]');expect(card).to_contain_text('обновлённое задание');expect(card.locator('textarea')).to_have_value('Старый ответ')
 page.evaluate("()=>{window.writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){writes.push({key:k,size:v.length});return set.call(this,k,v)}}")
 card.locator('textarea').fill('Новая причинная модель');writes=page.evaluate('writes');assert max(x['size'] for x in writes)<4000,writes
 assert page.evaluate("BV.personal.store.get('reading:answer:1-1-mcq',{}).previous.ok") is True
 page.reload();expect(card.locator('textarea')).to_have_value('Новая причинная модель');assert page.evaluate("BV.personal.store.get('reading:answer:old599',{}).draft.length")>1000
 # Real quota failure must leave the previous durable answer usable.
 page.evaluate("()=>{window.normalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('bv-personal-record:'))throw new DOMException('full','QuotaExceededError');return normalSet.call(this,k,v)};try{BV.personal.store.set('reading:answer:old599',{draft:'must not replace'})}catch(e){};Storage.prototype.setItem=normalSet}")
 assert page.evaluate("BV.personal.store.get('reading:answer:old599',{}).draft")!='must not replace'
 c.close();print('PASS storage: 600-record legacy migration, O(1) draft writes, reload, old task history and quota failure',flush=True)
 # Two independent browsers: unsubmitted choices and written rubric drafts as well as results.
 a=b.new_context(service_workers='block');cloud.attach(a);pa=a.new_page();connect(pa,True);open_bank(pa);written=pa.locator('[data-question="1-1-mcq"]');written.locator('textarea').fill('Две причины: ресурс или энергия; проверяем раздельно.');written.locator('.rd-grade summary').click();written.locator('[data-score="0"]').select_option('2');written.locator('[data-score="1"]').select_option('1');written.locator('[data-score="2"]').select_option('2');written.locator('[data-rd=reveal]').click();choice=pa.locator('[data-question="'+MCQ['id']+'"]');choice.locator('input[value="'+str(MCQ['correct'])+'"]').check();pa.evaluate('BV.personal.sync()')
 z=b.new_context(service_workers='block');cloud.attach(z);pb=z.new_page();connect(pb,False);open_bank(pb);wb=pb.locator('[data-question="1-1-mcq"]');expect(wb.locator('textarea')).to_have_value('Две причины: ресурс или энергия; проверяем раздельно.');expect(wb.locator('[data-feedback]')).to_contain_text('Разбор.');assert wb.locator('[data-score="0"]').input_value()=='2';expect(pb.locator('[data-question="'+MCQ['id']+'"] input[value="'+str(MCQ['correct'])+'"]')).to_be_checked()
 cloud.fail=True;wb.locator('textarea').fill('Офлайн: добавление одного ATP не различает все причины.');pb.reload();expect(wb.locator('textarea')).to_have_value('Офлайн: добавление одного ATP не различает все причины.');cloud.fail=False;pb.evaluate('BV.personal.sync()');pa.evaluate('BV.personal.sync()');pa.reload();expect(written.locator('textarea')).to_have_value('Офлайн: добавление одного ATP не различает все причины.')
 written.locator('.rd-grade summary').click();written.locator('[data-rd=save-grade]').click();pa.evaluate('BV.personal.sync()');pb.evaluate('BV.personal.sync()');expect(wb.locator('.rd-grade summary')).to_contain_text('5 / 6');pb.reload();expect(wb.locator('.rd-grade summary')).to_contain_text('5 / 6');assert pb.evaluate("BV.personal.store.get('reading:answer:1-1-mcq',{}).history.length")==1
 # Concurrent different drafts produce a recoverable conflict, never silent loss.
 pa.evaluate("BV.personal.store.set('reading:answer:concurrent',{draft:'A'});BV.personal.sync()");pb.evaluate("BV.personal.store.set('reading:answer:concurrent',{draft:'B'});BV.personal.sync()");assert pb.evaluate('BV.personal.conflicts.some(c=>c.local.draft===\'B\'&&c.remote.draft===\'A\')')
 a.close();z.close();print('PASS bank sync: unsubmitted MCQ, part-two draft, revealed analysis, unsaved criteria, offline reload, saved grade, history and concurrent conflicts',flush=True)
 c=b.new_context(service_workers='allow');cloud.attach(c);page=c.new_page();ready(page,'#/reading','#rd-alberts');page.wait_for_function('BV.offline && navigator.serviceWorker.controller');assert page.evaluate('BV.offline.save()');page.wait_for_timeout(500);c.set_offline(True);start=time.monotonic();page.reload();expect(page.locator('#rd-alberts')).to_be_visible();elapsed=time.monotonic()-start;assert elapsed<4,elapsed;assert not errors,errors;c.close();print('PASS repeat shell: complete offline reload in %.2f s'%elapsed,flush=True);b.close()
