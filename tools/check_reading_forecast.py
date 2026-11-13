"""Disposable browser tests; external cloud requests are blocked."""
from shutil import which
import argparse,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--url",default="http://127.0.0.1:8010/");args=p.parse_args();output=Path(tempfile.mkdtemp(prefix="bioviz-personal-"))
from playwright.sync_api import sync_playwright,expect
from datetime import date,timedelta
U=args.url.rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=which('chromium'));c=b.new_context(service_workers='block');c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(U) else r.abort());page=c.new_page();page.goto(U+'#/reading');expect(page.locator('[data-rd=personal]')).to_be_visible()
 today=date.today();start=today-timedelta(days=6);old=today-timedelta(days=30)
 page.evaluate('d=>{const s=BV.personal.store;s.set("reading:day:calc:"+d.start+":A",{seconds:1800,pages:[1,2,3]});s.set("reading:day:calc:"+d.today+":A",{seconds:1800,pages:[4,5,6]});s.set("reading:day:calc:"+d.today+":B",{seconds:0,pages:[4,5,6]})}',dict(today=str(today),start=str(start)))
 f=page.evaluate('BV.learning.forecast("calc",66)');assert f['pages']==6 and f['pace']==6 and f['days']==70,f
 page.evaluate('d=>{BV.personal.store.set("reading:day:calc:"+d+":old",{seconds:100,pages:[1,2,3]})}',str(old));f=page.evaluate('BV.learning.forecast("calc",66)');assert f['pages']==6 and f['pace']==3 and f['days']==140,f
 assert page.evaluate('BV.learning.forecast("empty",100).days') is None
 # Accelerate time explicitly: scanning (<20s) is excluded, a read page is counted once.
 page.evaluate('''()=>{window.fakeNow=Date.now();Date.now=()=>window.fakeNow;window.readingPage=1;BV.learning.reader(()=>({id:'clock',page:window.readingPage,total:10}));BV.learning.tick();}''')
 page.evaluate('()=>{fakeNow+=10000;BV.learning.tick();readingPage=2;BV.learning.tick()}');assert page.evaluate('BV.learning.forecast("clock",10).pages')==0
 page.evaluate('()=>{fakeNow+=10000;BV.learning.tick();fakeNow+=10000;BV.learning.tick();readingPage=3;BV.learning.tick()}');assert page.evaluate('BV.learning.forecast("clock",10).pages')==1
 print('PASS forecast:calendar frequency,days without reading,unique pages across devices,rereading,insufficient data and actual dwell threshold')
 for width in (390,820,1280):
  for theme in ('light','dark'):
   page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);page.goto(U+'#/reading');expect(page.locator('[data-rd=personal]')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 print('PASS library layout:390,820,1280 in both themes');b.close()
