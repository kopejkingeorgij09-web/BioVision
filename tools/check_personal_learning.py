"""Disposable browser tests; external cloud requests are blocked."""
from shutil import which
import argparse,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--url",default="http://127.0.0.1:8010/");args=p.parse_args();output=Path(tempfile.mkdtemp(prefix="bioviz-personal-"))
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json
U=args.url.rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=which('chromium'));c=b.new_context(service_workers='block',viewport={'width':390,'height':844},color_scheme='dark');c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(U) else r.abort());page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(U+'#/reading');expect(page.locator('[data-rd=personal]')).to_be_visible();page.screenshot(path=str(output/'library.png'));page.locator('[data-rd=personal]').click();expect(page.locator('[data-connect]')).to_be_visible();page.locator('[data-generate]').click();assert len(page.locator('[data-code]').input_value())==24;page.locator('[data-close]').click()
 page.goto(U+'#/reading/practice/1.1');expect(page.locator('.rd-question')).to_have_count(20)
 q=page.evaluate("fetch('content/reading/alberts/questions.json').then(r=>r.json()).then(q=>q.find(x=>x.section==='1.1'&&x.type==='mcq'))");card=page.locator('[data-question="'+q['id']+'"]');card.locator('input[value="'+str((q['correct']+1)%4)+'"]').check();card.locator('[data-rd=answer]').click();expect(card.locator('[data-feedback]')).to_contain_text('Пока нет')
 page.goto(U+'#/reading/practice/mistakes');expect(page.locator('.rd-question')).to_have_count(1);card=page.locator('.rd-question');card.locator('input[value="'+str(q['correct'])+'"]').check();card.locator('[data-rd=answer]').click();expect(card.locator('[data-feedback]')).to_contain_text('Верно');page.reload();expect(page.locator('[data-visible-count]')).to_contain_text('подборке: 0')
 page.goto(U+'#/reading/practice/1.1');w=page.locator('.rd-question:has(textarea)').first;w.locator('textarea').fill('Мой ответ');w.locator('.rd-grade summary').click();sels=w.locator('[data-score]');sels.nth(0).select_option('2');sels.nth(1).select_option('1');sels.nth(2).select_option('2');w.locator('[data-rd=save-grade]').click();expect(w.locator('[data-grade-total]')).to_contain_text('5 / 6');page.reload();expect(page.locator('.rd-question:has(textarea)').first.locator('textarea')).to_have_value('Мой ответ');expect(page.locator('.rd-grade summary').first).to_contain_text('5 / 6')
 page.goto(U+'#/reading/homework');expect(page.locator('h1')).to_have_text('Банк заданий');expect(page.locator('[data-new]')).to_have_count(0);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(output/'bank.png'));assert not errors,errors
 print('PASS UI: compact library,wrong-answer stack,resolution,criterion grade,draft reload,retired homework route and mobile dark')
 b.close()
