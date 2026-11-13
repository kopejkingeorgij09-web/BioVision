"""Browser regression: self-service codes, cross-device course/reading sync and usage.
All remote requests are mocked. No real visitor data or credentials are used.
"""
import argparse, copy, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8010/');p.add_argument('--out',default='/tmp/bioviz-visitors');args=p.parse_args()
BASE=args.url.rstrip('/')+'/';OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)

class Cloud:
 def __init__(self):self.accounts={};self.metrics={};self.requests=[];self.fail=False;self.errors=[]
 def route(self,route):
  r=route.request
  if r.url.startswith(BASE):return route.continue_()
  if '/rpc/' not in r.url:return route.abort()
  fn=r.url.rsplit('/',1)[-1];d=r.post_data_json;result=None
  if fn=='bv_personal_sync':
   code=d['p_code'];a=d['p_action']
   if a=='create':
    if code in self.accounts:return route.fulfill(json={'error':'Этот код уже занят'})
    self.accounts[code]={'owner':'00000000-0000-4000-8000-'+str(len(self.accounts)+1).zfill(12),'records':{},'cursor':0}
   account=self.accounts.get(code)
   if not account:return route.fulfill(json={'error':'Код не найден'})
   items=[]
   if a=='push':
    for item in d['p_items']:
     old=account['records'].get(item['id']);rev=old['rev'] if old else 0;ok=rev==item['rev']
     if ok:
      account['cursor']+=1;old={'id':item['id'],'data':item['data'],'rev':rev+1,'updated':account['cursor']};account['records'][item['id']]=old
     items.append({**old,'ok':ok})
   if a=='pull':items=[r for r in account['records'].values() if r['updated']>d['p_items'][0]['cursor']]
   result={'owner':account['owner'],'items':items,'cursor':account['cursor']}
  elif fn=='bv_activity_push':
   self.requests.append(copy.deepcopy(d))
   if self.fail:return route.fulfill(status=503,json={'message':'test outage'})
   who=self.accounts.get(d['p_code'],{}).get('owner');visitor='p:'+who if who else 'g:'+hashlib.sha256(d['p_device'].encode()).hexdigest()
   for item in d['p_items']:
    key=(d['p_device'],item['stream'],who,item['day'],item['key']);old=self.metrics.get(key)
    if not old or item['rev']>old['rev']:self.metrics[key]={**item,'visitor':visitor,'last_at':datetime.now(timezone.utc).isoformat()}
   result=True
  elif fn=='bv_activity_report':
   if d['p_code']!='USAGE-ADMIN':return route.fulfill(status=403,json={'message':'denied'})
   groups={}
   for r in self.metrics.values():
    k=(r['visitor'],r['key']);v=groups.setdefault(k,{**r,'views':0,'seconds':0,'pages':set()});v['views']+=r['views'];v['seconds']+=r['seconds'];v['pages'].update((r['day'],page) for page in r['pages'])
   result={'rows':[{**r,'pages':len(r['pages'])} for r in groups.values()]}
  elif fn=='bv_login':result={'role':'admin','id':'teacher','name':'Test'} if d['p_code']=='USAGE-ADMIN' else None
  elif fn=='bv_get':result={}
  elif fn=='bv_list':result=[]
  else:result=True
  route.fulfill(json=result)
 def attach(self,context):context.route('**/*',self.route)

def rows(page):return page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('bv-usage-outbox:')).flatMap(k=>Object.values(JSON.parse(localStorage[k])))")
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium');cloud=Cloud()
 c=browser.new_context(viewport={'width':390,'height':844},color_scheme='dark',service_workers='block');cloud.attach(c);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#/reading');expect(page.locator('.rd-upload')).to_be_visible();assert page.locator('.rd-upload').bounding_box()['height']<145;expect(page.get_by_text('Письменные работы',exact=True)).to_have_count(0);expect(page.locator('.dock [data-nav=labs]')).to_have_text('Лабы');page.screenshot(path=str(OUT/'library-dark-390.png'))
 page.evaluate("BV.lectureStore.set('seen:l01',['mb1']);BV.lectureStore.set('last',{id:'l01',s:'mb1',t:10});location.hash='#/me'")
 expect(page.locator('[data-personal-profile]')).to_be_visible();page.locator('[data-personal-profile]').click();page.locator('[data-code]').fill('visitor-test-personal-code');page.locator('button[value=create]').click();expect(page.locator('[data-profile-status]')).to_contain_text('Синхронизировано');assert page.evaluate("BV.lectureStore.get('seen:l01',[])")==['mb1']
 page.evaluate("BV.personal.store.set('reading:progress:alberts',{topic:'1-intro',page:17});BV.personal.store.set('reading:marks:alberts',[{key:'p:17',page:17}]);BV.lectureStore.set('seen:l01',['mb1','mb2'])");page.evaluate('BV.personal.sync()')
 second=browser.new_context(service_workers='block');cloud.attach(second);other=second.new_page();other.on('pageerror',lambda e:errors.append(str(e)));other.goto(BASE+'#/me');expect(other.locator('[data-personal-profile]')).to_be_visible();other.locator('[data-personal-profile]').click();other.locator('[data-code]').fill('visitor-test-personal-code');other.locator('button[value=login]').click();expect(other.locator('[data-profile-status]')).to_contain_text('Синхронизировано');assert other.evaluate("BV.lectureStore.get('seen:l01',[])")==['mb1','mb2'];assert other.evaluate("BV.personal.store.get('reading:progress:alberts',{}).page")==17;assert other.evaluate("BV.personal.store.get('reading:marks:alberts',[]).length")==1
 print('PASS self-service code: guest import, course marks, reading position and bookmarks on a second device')
 # Measured reading: 20 seconds on a page count; hidden time and idle do not.
 page.goto(BASE+'#/reading/alberts/1-intro');expect(page.locator('#rd-topic-title')).to_be_visible();page.evaluate("window.clock=Date.now();Date.now=()=>clock;window.readPage=1;BV.learning.reader(()=>({id:'alberts',page:readPage}));BV.activity.tick()")
 page.evaluate('clock+=10000;BV.activity.tick();clock+=10000;BV.activity.tick();readPage=2;BV.activity.tick()');assert any(r['key']=='book:alberts' and r['pages']==[1] for r in rows(page));assert any(r['kind']=='topic' and r['label']==('Альбертс · '+' '.join(page.locator('#rd-topic-title').text_content().split()))[:180] for r in rows(page))
 page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});window.testHidden=true;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))")
 before=sum(r['seconds'] for r in rows(page));page.evaluate('clock+=60000;BV.activity.tick()');assert sum(r['seconds'] for r in rows(page))==before
 page.evaluate("window.testHidden=false;document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));clock+=120000;BV.activity.tick()");assert sum(r['seconds'] for r in rows(page))==before
 # Offline counters survive a new document/stream, then clear only after success.
 cloud.fail=True;page.evaluate("BV.activity.action('search','Поиск в книге');BV.activity.flush()");assert any(r['dirty'] for r in rows(page));pending=len(rows(page));page.reload();expect(page.locator('#rd-topic-title')).to_be_visible();assert len(rows(page))>=pending;cloud.fail=False;page.evaluate('BV.activity.flush()');assert not any(r['dirty'] for r in rows(page));assert all('draft' not in json.dumps(d) for d in cloud.requests)
 other.evaluate('BV.activity.action("search","Поиск в книге");BV.activity.flush()');assert len({r['visitor'] for r in cloud.metrics.values() if r['visitor'].startswith('p:')})==1
 print('PASS usage: active reading, completed pages, background/idle exclusion, durable retry across reloads and same-code visitor identity')
 # Display report through the real admin route; no participant issuance controls.
 admin=browser.new_context(service_workers='block',viewport={'width':390,'height':844},color_scheme='dark');cloud.attach(admin);ap=admin.new_page();ap.on('pageerror',lambda e:errors.append(str(e)));ap.goto(BASE+'#/me');ap.get_by_text('Вход руководителя',exact=True).click();ap.locator('#meCode').fill('USAGE-ADMIN');ap.locator('#meForm button').click();expect(ap.locator('#aUsage')).to_be_visible();expect(ap.locator('.usage-visitor')).not_to_have_count(0);expect(ap.locator('#cNew,#aPpl')).to_have_count(0);expect(ap.locator('[data-usage]')).to_contain_text('Поиск в книге');expect(ap.locator('[data-usage]')).to_contain_text('Альбертс');ap.locator('[data-period]').select_option('7');expect(ap.locator('[data-usage-status]')).to_contain_text('Обновлено')
 for width in (390,820,1280):
  for theme in ('light','dark'):
   ap.set_viewport_size({'width':width,'height':900});ap.emulate_media(color_scheme=theme);assert ap.evaluate('document.documentElement.scrollWidth<=innerWidth+1');ap.locator('#aUsage').scroll_into_view_if_needed();ap.screenshot(path=str(OUT/f'admin-{theme}-{width}.png'))
 assert not errors,errors
 print('PASS admin: populated report, periods, no participant controls, mobile/tablet/desktop layouts and both themes');browser.close()
