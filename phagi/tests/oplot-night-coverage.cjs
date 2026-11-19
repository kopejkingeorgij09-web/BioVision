// Requires Playwright and @electric-sql/pglite. No network database or user profile is used.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const {chromium}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();
const url=process.argv[2]||pathToFileURL(path.join(__dirname,'..','oplot.html')).href;

async function serverCoverage(){
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema extensions;create schema cron;
      create table cron.job(jobname text,schedule text,command text);
      create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job values($1,$2,$3) returning 1::bigint$$;`);
    const dir=path.join(__dirname,'../../supabase/migrations');
    const files=fs.readdirSync(dir).filter(name=>/(_bioviz_core|_phagi_core|_phagi_teacher_is_georgiy|_ph_set_if_rev|_phagi_oplot_[\w]+)\.sql$/.test(name)).sort();
    for(const file of files)await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
    // One raider starts at (0,4). Its first tick precedes movement; this measures the actual primary targeting radius.
    const {rows:towers}=await db.query(`select kind,level,max(dist) filter(where jsonb_path_exists(
        oplot.simulate_raid(jsonb_build_object('buildings',jsonb_build_array(jsonb_build_object(
          'type',kind,'id','tower','x',dist,'y',4,'level',level))),1,'2030-01-01','fixture',
          '{"v":2,"entrySide":0,"attackers":[{"id":"a","type":"raider","species":0,"level":1,"x":0,"y":4,"hp":1,"damage":999,"flying":false,"enchant":0}]}')
        ,'$.replay.events[*] ? (@.t == 1 && @.kind == "tower" && @.target == "a")'))::int as reach
      from unnest(array['archer','cannon','spire']) as k(kind) cross join
        unnest(array[1,2,3,5,6,8,9,11,12,30]) as l(level) cross join generate_series(0,9) as d(dist)
      group by kind,level order by kind,level`);
    const {rows:distances}=await db.query(`select dx,dy,oplot.raid_distance(
      jsonb_populate_record(null::oplot.raid_actor,jsonb_build_object('x',dx,'y',dy)),
      jsonb_populate_record(null::oplot.raid_actor,'{"x":0,"y":0}')) as distance
      from generate_series(-15,15) dx cross join generate_series(-15,15) dy`);
    return {towers,distances};
  }finally{await db.close()}
}
async function main(){
  const sql=await serverCoverage(),browser=await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try{
    const page=await browser.newPage({viewport:{width:390,height:800},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    await page.addInitScript(()=>{
      window.addEventListener('DOMContentLoaded',()=>{
        const art=window.Art;window.Art={...art,island(...args){
          if(args[0].canvas.id==='world')window.observedRange=args[4]?.nightCoverage;
          return art.island(...args);
        }};
      });
    });
    await page.goto(url);await page.waitForFunction(()=>window.Art);
    const checked=await page.evaluate(({towers,distances})=>{
      const metric=new Map(distances.map(p=>[[p.dx,p.dy].join(','),p.distance]));
      const canvas=document.createElement('canvas'),w=480,h=420;canvas.width=w;canvas.height=h;
      const c=canvas.getContext('2d',{willReadFrequently:true}),state={gridSize:16,gridWidth:16,gridHeight:15,grid:true};
      function pixels(range){
        Art.island(c,w,h,0,{...state,nightCoverage:range});
        return c.getImageData(0,0,w,h).data;
      }
      const plain=pixels(null);let count=0;
      for(const {kind,level,reach} of towers){
        const displayed=nightTowerReach(kind,level);if(reach!==displayed)throw Error([kind,level,reach,displayed].join('/'));
        for(const [x,y] of [[0,0],[15,14],[7,6]]){
          const tinted=pixels({x,y,reach:displayed});
          for(let cy=0;cy<state.gridHeight;cy++)for(let cx=0;cx<state.gridWidth;cx++){
            const pt=Art.point(cx,cy,w,h,state.gridSize),k=(Math.floor(pt.x)+Math.floor(pt.y)*w)*4;
            const inside=tinted[k]!==plain[k]||tinted[k+1]!==plain[k+1]||tinted[k+2]!==plain[k+2];
            if(inside!==(metric.get([cx-x,cy-y].join(','))<=reach))throw Error([kind,level,x,y,cx,cy].join('/'));
            count++;
          }
        }
      }
      return count;
    },sql);
    assert.equal(checked,21600);
    const key='phagi.oplot.v1.local.standalone';
    await page.evaluate(key=>{const state=initialState();state.gold=450;
      state.buildings.push({id:'tower',type:'cannon',x:1,y:2,level:6,since:Date.now()});localStorage.setItem(key,JSON.stringify(state));
    },key);
    await page.reload();await page.locator('.tabs [data-do="tab"][data-id="build"]').click();
    await page.locator('[data-do="structure"][data-id="tower"]').click();
    await page.locator('[data-do="move"][data-id="tower"]').click();
    await page.waitForFunction(()=>window.observedRange?.x===1&&window.observedRange?.y===2&&window.observedRange?.reach===5);
    assert.match(await page.locator('#mapnote').innerText(),/Ночная зона огня — 5 клеток · только наземные цели/);
    await page.locator('#world').press('ArrowRight');await page.waitForFunction(()=>window.observedRange?.x===2&&window.observedRange?.y===2);
    await page.locator('#maptools [data-do="cancelplace"]').click();await page.waitForFunction(()=>!window.observedRange);
    await page.locator('.tabs [data-do="tab"][data-id="build"]').click();await page.locator('[data-do="construct"][data-id="archer"]').click();
    await page.waitForFunction(()=>window.observedRange?.reach===4);
    assert.match(await page.locator('#mapnote').innerText(),/4 клетки · земля и воздух/);
    console.log('PASS 30 observed SQL targeting ranges, 21,600 rendered cells against oplot.raid_distance, touch and keyboard placement.');
  }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
