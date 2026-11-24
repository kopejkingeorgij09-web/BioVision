// Run with a Phagi HTTP server. All accounts and writes in these flows are fixtures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const site = process.argv[2] || 'http://127.0.0.1:18748/phagi/';
const uid = 'forest-pupil';
const lessons = ['spruce-deck','pine-deck','birch-deck'];
const sub = id => `subs/${uid}/items/${id}`;
const app = 'srs/'+uid+'/forest/';
const pathToCardLedger = path => path.startsWith(app+'cards-');

function server() {
  let tick = Date.now();
  let mode = '';
  let failSubmission = '';
  let interrupted = 0;
  let delayNextSubmission = false;
  let delayed = null;
  const stamp = () => new Date(++tick).toISOString();
  const docs = new Map();
  const put = (path, data) => {
    const t = stamp();
    docs.set(path, { data: structuredClone(data), t });
    return t;
  };
  put('people/'+uid, {label:'Ученик',joinedAt:stamp()});
  const assignment = {title:'Экосистема',kind:'homework',to:[uid],subject:'bio',max:10,createdAt:stamp()};
  put('tasks/written-fixture', assignment);
  put('tasks/fail-fixture', {...assignment, title:'Почвы'});
  put('tasks/old-fixture', {...assignment, title:'Старая работа'});
  put(sub('old-fixture'), {text:'Готово',status:'submitted',updatedAt:stamp()});
  const test = {...assignment,title:'Тест о лесе',kind:'test',q:[{t:'text',text:'Клён и ель. Что хвойное?',acc:['ель'],pts:1}]};
  put('tasks/test-fixture', test);
  put('tasks/empty-fixture', {...test,title:'Пустой тест'});
  for (const id of lessons) put('decks/'+id, {title:id,to:[uid],subject:'bio',cards:[{i:'first',f:'Вопрос',b:'Ответ'}]});

  async function attach(ctx) {
    await ctx.route('**/rest/v1/rpc/*', async route => {
      const fn = route.request().url().split('/').pop(), a = route.request().postDataJSON() || {};
      let result = null;
      if (fn==='ph_login') result = {id:uid,isOwner:false,name:'Ученик'};
      if (fn==='ph_list') {
        const pre = a.p_col+'/';
        result = [...docs].filter(([p, d]) => p.startsWith(pre) && !p.slice(pre.length).includes('/') && d.data)
          .map(([p,d]) => ({id:p.slice(pre.length),...d}));
      }
      if (fn==='ph_sync') {
        result = {now:stamp(),ch:[...docs].filter(([p,d]) => d.t>a.p_since &&
          (a.p_cols.includes(p.slice(0,p.lastIndexOf('/'))) || a.p_docs.includes(p)))
          .map(([p,d]) => ({p,d:d.data,t:d.t}))};
        if (delayed && a.p_cols.includes(`subs/${uid}/items`)) {
          result.ch = result.ch.filter(change=>change.p!==sub('written-fixture'));
          result.ch.push({p:sub('written-fixture'),d:delayed.prior.data,t:delayed.prior.t});
        }
      }
      if (fn==='ph_get') result = docs.get(a.p_path)?.data ?? null;
      if (fn==='ph_set') {
        if (a.p_path===sub('fail-fixture') && a.p_data.status==='submitted' && failSubmission==='offline') return route.abort();
        const prior = docs.get(a.p_path);
        result = put(a.p_path,a.p_data);
        if (a.p_path===sub('written-fixture') && a.p_data.status==='submitted' && delayNextSubmission) {
          delayNextSubmission=false;
          await new Promise(release => { delayed={prior,release}; });
        }
        if (a.p_path===sub('fail-fixture') && a.p_data.status==='submitted' && failSubmission==='lost-response') {
          failSubmission = '';
          return route.abort();
        }
      }
      if (fn==='ph_update') result = put(a.p_path,{...docs.get(a.p_path)?.data,...a.p_data});
      if (fn==='ph_delete') result = put(a.p_path,null);
      if (fn==='ph_set_if') {
        const cur = docs.get(a.p_path)?.data || null;
        if ((cur?.rev ?? null)!==a.p_rev || (cur?.op ?? null)!==a.p_op) result={ok:false,cur};
        else {
          if (mode==='offline' && pathToCardLedger(a.p_path)) { interrupted++; return route.abort(); }
          result={ok:true,t:put(a.p_path,a.p_data)};
          if (mode==='lost-response' && pathToCardLedger(a.p_path)) {
            mode=''; interrupted++; return route.abort();
          }
        }
      }
      return route.fulfill({json:result,headers:{'access-control-allow-origin':'*'}});
    });
  }

  const points = () => [...docs].reduce((total, [path,doc]) => {
    if (!doc.data) return total;
    if (pathToCardLedger(path)) return total+Object.keys(doc.data.cards).length;
    return total+(path.startsWith(app+'hw-')?10:0);
  }, 0);
  return {
    attach, points, docs,
    delayWritten() { delayNextSubmission=true; },
    isWaiting() { return !!delayed; },
    resumeWritten() { const hold=delayed; delayed=null; hold?.release(); },
    stopRewards(value) { mode=value; },
    stopSubmission(value) { failSubmission=value; },
    interrupted: () => interrupted,
    seedGrove(points) {
      const cards = Object.fromEntries(Array.from({length:points}, (_,i)=>[`seed-${i}`,true]));
      put(app+'cards-2000-01-01',{rev:1,op:'seed',cards});
    }
  };
}

async function main() {
  const browser = await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try {
    for (const [width, dark, reduced] of [[390, true, false],[1180, false, true]]) {
      const fixture = server();
      const errors = [];
      const context = async () => {
        const ctx = await browser.newContext({viewport:{width,height:895},colorScheme:dark?'dark':'light',
          reducedMotion:reduced?'reduce':'no-preference',serviceWorkers:'block'});
        await fixture.attach(ctx);
        await ctx.addInitScript(() => localStorage.setItem('ph_code','FOREST-QA'));
        const page=await ctx.newPage();
        page.setDefaultTimeout(10000);
        page.on('pageerror',e=>errors.push(e.message));
        return [ctx,page];
      };
      const [ctx,page] = await context();
      const [otherCtx,other] = await context();
      const wait = async fn => {
        for (let i=0;i<140;i++) {
          if (fn()) return;
          await new Promise(resolve=>setTimeout(resolve,50));
        }
        assert.ok(fn(),'expected fixture persistence');
      };
      const ready = async p => {
        await p.goto(site,{waitUntil:'domcontentloaded'});
        await p.waitForFunction(() => S.joined && S.forest?.ready && S.subs[meId()] && myDecks().length===3 && progressReady());
      };
      const nav = (p, v) => p.locator(`#nav [data-v="${v}"]`).click();
      const total = (p, score) => p.waitForFunction(n => document.querySelector('#forest-corner b').textContent===String(n),score);
      const report = (p, points) => p.waitForFunction(value =>
        document.querySelector('.forest-notice-visible')?.textContent===`+${value} · лес тебя не забудет!`,points);
      const showCard = async (p, id) => {
        await nav(p,'cards');
        await p.locator('[data-act=cardstab][data-v=decks]').click();
        await p.locator(`[data-act=deck][data-id="${id}"]`).click();
        await p.locator('[data-act=study][data-all]').click();
        await p.locator('#showbtn').click();
      };
      const startAssignment = (p, id) => p.locator(`#main [data-act=open][data-id="${id}"]`).click();
      const backToTasks = p => p.locator('#main .back[data-v="tasks"]').click();
      try {
        await ready(page);
        await nav(page,'cards');
        await page.locator('[data-act=cardstab][data-v=lab]').click();
        assert.equal(await page.locator('#motivation-bacteria').getAttribute('aria-pressed'),'true');
        assert.equal(await page.getByRole('heading',{name:'Чашка Петри',exact:true}).isVisible(),true);
        await page.locator('#motivation-forest').click();
        await total(page,0);
        await page.locator('[data-v=forest].forest-scene-link').click();
        await page.locator('h1').filter({hasText:'Мой лес'}).waitFor();
        await page.waitForFunction(()=>document.querySelector('.forest-backdrop')?.naturalWidth>0);
        assert.equal(await page.locator('.forest-plant').count(),0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

        await showCard(page,lessons[0]);
        await page.locator('[data-act=rate][data-g="1"]').click();
        assert.equal(fixture.points(),0);
        await page.locator('#showbtn').click();
        await page.keyboard.press('3');
        await total(page,1);
        if (!reduced) await page.locator('.forest-flight').waitFor();
        await report(page,1);
        await page.locator('#forest-corner button').click();
        await page.locator('.forest-plant img').waitFor();
        assert.equal(await page.locator('.forest-plant img').getAttribute('src'),'forest/art/spruce.webp');
        await showCard(page,lessons[0]);
        await page.locator('[data-act=rate][data-g="4"]').click();
        await page.locator('.rv-done [data-act=endreview]').click();
        await total(page,1);

        await nav(page,'tasks');
        await startAssignment(page,'written-fixture');
        await page.locator('#ans-written-fixture').fill('Смешанный лес');
        await page.locator('[data-act=draft]').click();
        await page.getByText('Черновик сохранён',{exact:true}).waitFor();
        assert.equal(fixture.docs.get(sub('written-fixture')).data.status,'draft');
        assert.equal(fixture.points(),1);
        fixture.delayWritten();
        await page.locator('[data-act=submit]').click();
        await wait(fixture.isWaiting);
        await page.evaluate(()=>PHCLOUD.sync());
        await page.waitForFunction(()=>S.subs[meId()]['written-fixture'].status==='draft');
        fixture.resumeWritten();
        await total(page,11);
        await report(page,10);
        await page.locator('[data-act=unsubmit]').click();
        await page.locator('[data-act=submit]').click();
        assert.equal(fixture.points(),11);

        await nav(page,'tasks');
        await startAssignment(page,'fail-fixture');
        await page.locator('#ans-fail-fixture').fill('Лесная почва');
        fixture.stopSubmission('offline');
        await page.locator('[data-act=submit]').click();
        await page.getByText('Проверьте связь и попробуйте ещё раз.',{exact:false}).waitFor({timeout:6000});
        assert.equal(fixture.points(),11);
        fixture.stopSubmission('lost-response');
        await page.locator('[data-act=submit]').click();
        await total(page,21);
        await page.locator('[data-act=unsubmit]').waitFor();

        await backToTasks(page);
        await startAssignment(page,'test-fixture');
        await page.locator('#ta-test-fixture-0').fill('ель');
        await page.locator('[data-act=submittest]').click();
        await total(page,31);
        await page.evaluate(()=>submitTest('empty-fixture',true));
        assert.equal(fixture.docs.get(sub('empty-fixture')).data.forestCredit,undefined);

        // One card on two devices, including a committed write with a lost response.
        await ready(other);
        await Promise.all([showCard(page,lessons[1]),showCard(other,lessons[1])]);
        fixture.stopRewards('lost-response');
        await Promise.all([page.locator('[data-act=rate][data-g="3"]').click(),other.locator('[data-act=rate][data-g="4"]').click()]);
        await total(page,32);
        await wait(()=>fixture.interrupted()===1);
        assert.equal(fixture.points(),32);

        // A different card persists in the local outbox and is retried on reload.
        await page.locator('.rv-done [data-act=endreview]').click();
        await showCard(page,lessons[2]);
        fixture.stopRewards('offline');
        await page.locator('[data-act=rate][data-g="3"]').click();
        await wait(()=>fixture.interrupted()===2);
        assert.equal(fixture.points(),32);
        fixture.stopRewards('');
        await ready(page);
        await total(page,33);

        await nav(page,'forest');
        await page.locator('#motivation-bacteria').click();
        await page.getByRole('heading',{name:'Карточки',exact:true}).waitFor();
        assert.equal(await page.locator('#forest-corner').isVisible(),false);
        await page.locator('#motivation-forest').click();
        await total(page,33);
        await page.locator('[data-v=forest].forest-scene-link').click();
        await page.waitForFunction(()=>[...document.querySelectorAll('.forest-plant img')].every(img=>img.complete&&img.naturalWidth));
        if (process.env.PHAGI_FOREST_SCREENSHOT) await page.screenshot({path:`${process.env.PHAGI_FOREST_SCREENSHOT}-${width}.png`});

        fixture.seedGrove(240);
        await total(page,273);
        await page.locator('.forest-glades').getByText('Поляна 2 из 2').waitFor();
        await page.getByRole('button',{name:'Предыдущая поляна'}).click();
        await page.locator('.forest-glades').getByText('Поляна 1 из 2').waitFor();
        assert.equal(await page.locator('.forest-plant').count(),30);
        assert.equal(await page.locator('.forest-collection li').count(),6);
        assert.deepEqual(errors,[]);
        console.log('PASS forest workflows',width,dark?'dark':'light');
      } catch (error) {
        console.error('Fixture flow state', width, await page.evaluate(() => ({
          view:S.view, task:S.taskId, points:S.forest?.points, sub:S.subs[meId()]?.[S.taskId],
          toast:document.querySelector('#toast').textContent
        })), errors);
        throw error;
      } finally {
        fixture.resumeWritten();
        await otherCtx.close();
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
}

main().catch(error=>{ console.error(error); process.exitCode=1; });
