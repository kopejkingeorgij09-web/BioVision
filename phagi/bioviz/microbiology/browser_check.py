"""Isolated browser QA: public local files only, no production account/database."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import re
from playwright.sync_api import sync_playwright, expect
BASE="http://127.0.0.1:8765"
BOOK=BASE+"/phagi/bioviz/microbiology/index.html"
OUT=Path("qa-output/microbook"); OUT.mkdir(parents=True, exist_ok=True)
HARNESS="""<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated BioViz integration QA</title>
<style>:root{--card:#fffef9;--soft:#e9efe3;--ink:#203a35;--text:#203a35;--muted:#586b64;--line:#d9dfd4;--bio:#27644f;--accent:#27644f;--ui:#27644f;--font-body:system-ui;--font-display:Georgia}body{margin:0}#bvhost{display:block}</style>
<div id="bvhost"></div><script>
const host=document.getElementById('bvhost');host.dataset.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
window.BVHOST={host,root:host.attachShadow({mode:'open'}),on:true,top:()=>{},dlg:()=>false,full:()=>{},answer:()=>{}};
</script><script src="bioviz/bv.js"></script><script src="bioviz/microbiology/embed.js?v=1"></script></html>"""
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0]=="/phagi/__microbook_qa.html":
            data=HARNESS.encode();self.send_response(200);self.send_header("Content-Type","text/html; charset=utf-8");self.send_header("Content-Length",str(len(data)));self.end_headers();self.wfile.write(data)
        else: super().do_GET()
    def log_message(self,*args): pass
server=ThreadingHTTPServer(("127.0.0.1",8765),Handler)
Thread(target=server.serve_forever,daemon=True).start()
routes={"scale":"scale","redox":"redox","pmf":"pmf","trophy":"trophy","glycolysis":"pathways","exponential":"growth","counting":"cfu","continuous":"monod","envelopes":"envelope","gram":"gram","osmosis":"osmosis","lac":"lac","hgt":"hgt","syntrophy":"syntrophy","biofilm":"biofilm","quorum":"quorum","nitrogen-cycle":"nitrogen","cultivation-method":"evidence"}
checks=0
with sync_playwright() as p:
    browser=p.chromium.launch()
    try:
        for width in (390,768,1280):
            for theme in ("light","dark"):
                context=browser.new_context(viewport={"width":width,"height":900},color_scheme=theme)
                context.route("**/*",lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
                page=context.new_page(); errors=[]
                page.on("pageerror",lambda e: errors.append(str(e)))
                page.goto(BOOK);expect(page.locator(".mb-main h1")).to_contain_text("Жизнь")
                assert page.locator("#microbook").get_attribute("data-theme")==theme;checks+=1
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1");checks+=1
                page.screenshot(path=str(OUT/f"home-{width}-{theme}.png"),full_page=True)
                for route,model in routes.items():
                    page.goto(BOOK+"#"+route)
                    widget=page.locator(f'[data-model="{model}"]');widget.wait_for(state="visible")
                    controls=widget.locator("select")
                    if controls.count():
                        control=controls.first
                        opts=control.locator("option")
                        control.select_option(opts.last.get_attribute("value"))
                    else:
                        control=widget.locator("input").first
                        if control.get_attribute("type")=="range":control.focus();control.press("ArrowRight")
                        else:control.fill("120")
                    assert not re.search(r"NaN|undefined|Infinity",widget.locator(".mb-model-result").inner_html());checks+=1
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),route;checks+=1
                page.goto(BOOK+"#redox")
                expect(page.locator(".mb-stats")).to_contain_text("219,99");checks+=1
                page.locator('select[name="d"]').select_option("-0.42")
                expect(page.locator(".mb-stats")).to_contain_text("239,28");checks+=1
                page.locator(".mb-check summary").click()
                page.get_by_role("button",name="Отметить прочитанным",exact=True).click()
                expect(page.get_by_role("button",name="✓ Отмечено прочитанным",exact=True)).to_be_visible();checks+=1
                page.goto(BOOK+"#atlas")
                images=page.locator(".mb-photo img")
                assert images.count()==12;checks+=1
                for i in range(images.count()):
                    image=images.nth(i);image.scroll_into_view_if_needed()
                    expect(image).to_have_js_property("complete",True)
                    assert image.evaluate("(e)=>e.naturalWidth > 0");checks+=1
                page.locator("[data-photo]").first.click()
                expect(page.locator("dialog")).to_be_visible()
                page.keyboard.press("Escape");expect(page.locator("dialog")).not_to_be_visible();checks+=1
                if width<=760:page.get_by_role("button",name="Содержание",exact=True).click()
                page.get_by_role("searchbox",name="Поиск по учебнику").fill("нитрат")
                assert page.locator(".mb-side .mb-search-results button").count()>0;checks+=1
                page.locator(".mb-side .mb-search-results button").first.click()
                expect(page.locator(".mb-main h1")).to_be_visible()
                page.get_by_role("button",name="Переключить тему учебника",exact=True).click()
                assert page.locator("#microbook").get_attribute("data-theme")!=theme;checks+=1
                page.goto(BOOK);page.get_by_role("button",name="Сохранить офлайн",exact=True).click()
                expect(page.get_by_role("button",name="✓ Учебник сохранён",exact=True)).to_be_visible(timeout=30000);checks+=1
                context.set_offline(True);page.goto(BOOK+"#biofilm")
                expect(page.locator('[data-model="biofilm"]')).to_be_visible();checks+=1
                context.set_offline(False)
                assert not errors,errors
                checks+=1;context.close()
        for width in (390,1280):
            context=browser.new_context(viewport={"width":width,"height":900},color_scheme="dark")
            context.route("**/*",lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
            page=context.new_page();page.goto(BASE+"/phagi/__microbook_qa.html")
            page.get_by_role("button",name="Микробиология · учебник",exact=True).click(timeout=30000)
            expect(page.locator("#microbook .mb-main h1")).to_contain_text("Жизнь")
            assert page.locator("#microbook").get_attribute("data-theme")=="dark";checks+=1
            page.get_by_role("button",name="Прежние модели архитектуры",exact=True).click()
            expect(page.locator("#microbook")).not_to_be_visible()
            expect(page.locator("#prokApp")).to_be_visible();checks+=1
            page.locator('.nav-item[data-go="membrane"]').click()
            expect(page.locator("#m-membrane")).to_be_visible();checks+=1
            page.get_by_role("button",name="Микробиология · учебник",exact=True).click()
            expect(page.locator("#microbook .mb-main h1")).to_contain_text("Жизнь");checks+=1
            page.screenshot(path=str(OUT/f"embedded-{width}-dark.png"),full_page=True)
            context.close()
    finally:browser.close();server.shutdown()
print(f"{checks} browser assertions passed; no live database/account used.")
