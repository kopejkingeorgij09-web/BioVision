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
    // Compare the actual first volley with the displayed range, on both save geometries.
    // The blockers stand directly between tower and attacker on these horizontal lanes.
    const types=['archer','cannon','spire','mortar','skybow','tempest','solar'];
    const {rows:towers}=await db.query(`select kind,lvl level,v version,oplot.tower_reach(kind,lvl,v) reach
      from unnest($1::text[]) kind cross join unnest(array[1,3,6,9,12,16]) lvl cross join generate_series(1,2) v`,[types]);
    for(const v of [1,2])for(const kind of types){
      const formation={v:3,layoutVersion:v,entrySide:0,attackers:[{id:'a',type:'raider',x:0,y:4,hp:10,damage:999,level:2,species:1,enchant:0,flying:kind==='skybow'}]};
      const island={layoutVersion:v,buildings:[{id:'t',type:kind,x:5,y:3,level:1},{id:'w',type:'wall',x:1,y:4,level:1},{id:'h',type:'farm',x:2,y:3,level:1}]};
      const {rows:[{shot}]}=await db.query(`select jsonb_path_exists(oplot.simulate_raid($1::jsonb,1,'2030-01-01','test',$2::jsonb),
        '$.replay.events[*] ? (@.t == 1 && @.kind == "tower" && @.id == "t" && @.target == "a")') as shot`,[JSON.stringify(island),JSON.stringify(formation)]);
      assert.ok(shot,kind+' across buildings and walls (layout '+v+')');
    }
    async function targets(kind,points){
      const actors=points.map(([x,y,hp,flying=false])=>({x,y,hp,flying}));
      return (await db.query(`select idx from oplot.tower_targets(jsonb_populate_record(null::oplot.raid_actor,jsonb_build_object('x',0,'y',0,'type',$1::text,'level',1)),
        array(select jsonb_populate_record(null::oplot.raid_actor,j) from jsonb_array_elements($2::jsonb) j),1) order by secondary,idx`,[kind,JSON.stringify(actors)])).rows.map(r=>r.idx);
    }
    assert.deepEqual(await targets('archer',[[5,5,4],[4,5,2]]),[2]); // sqrt(50)>7; sqrt(41)<7.
    assert.deepEqual(await targets('mortar',[[1,1,3],[2,3,1],[1,2,4,true],[5,5,10]]),[1,2]);
    assert.deepEqual(await targets('skybow',[[1,1,5],[2,3,1,true]]),[2]);
    assert.deepEqual(await targets('tempest',[[1,1,4],[2,1,6],[1,2,4,true],[2,2,10]]),[1,2,3]);
    assert.deepEqual(await targets('solar',[[1,1,4],[4,4,12,true],[9,0,40]]),[2]);
    return {towers};
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
    const checked=await page.evaluate(({towers})=>{
      const canvas=document.createElement('canvas'),w=680,h=560;canvas.width=w;canvas.height=h;
      const c=canvas.getContext('2d',{willReadFrequently:true}),state={gridSize:16,gridWidth:16,gridHeight:15,grid:true};
      function pixels(range){
        Art.island(c,w,h,0,{...state,nightCoverage:range});
        return c.getImageData(0,0,w,h).data;
      }
      let count=0,plain;
      for(const {kind,level,reach,version} of towers){
        if(state.layoutVersion!==version){Object.assign(state,{layoutVersion:version,gridSize:version===2?55:16,gridWidth:version===2?55:16,gridHeight:version===2?52:15});plain=pixels(null)}
        const span=version===2?OplotLayout.size(kind):1;
        const displayed=nightTowerReach(kind,level,version);if(reach!==displayed)throw Error([kind,level,reach,displayed].join('/'));
        for(const [x,y] of [[0,0],[state.gridWidth-span,state.gridHeight-span],[7*version,6*version]]){
          const tinted=pixels({x,y,span,reach:displayed});
          for(let cy=0;cy<state.gridHeight;cy++)for(let cx=0;cx<state.gridWidth;cx++){
            const pt=Art.point(cx,cy,w,h,state.gridSize),k=(Math.floor(pt.x)+Math.floor(pt.y)*w)*4;
            const inside=tinted[k]!==plain[k]||tinted[k+1]!==plain[k+1]||tinted[k+2]!==plain[k+2];
            const dist=Math.hypot(cx-x-(span-1)/2,cy-y-(span-1)/2);
            if(Math.abs(dist-reach)<.7)continue; // Ignore the anti-aliased border.
            if(inside!==(dist<=reach))throw Error([kind,level,x,y,cx,cy].join('/'));
            count++;
          }
        }
      }
      return count;
    },sql);
    assert.ok(checked>300000);
    const key='phagi.oplot.v1.local.standalone';
    await page.evaluate(key=>{const state=initialState();state.gold=450;
      state.buildings.push({id:'tower',type:'cannon',x:1,y:2,level:6,since:Date.now()});localStorage.setItem(key,JSON.stringify(state));
    },key);
    await page.reload();await page.locator('.tabs [data-do="tab"][data-id="build"]').click();
    await page.locator('[data-do="structure"][data-id="tower"]').click();
    await page.locator('[data-do="range"][data-id="tower"]').click();
    await page.waitForFunction(()=>window.observedRange?.x===1&&window.observedRange?.reach===16);
    assert.match(await page.locator('#mapnote').innerText(),/16 кл. · только наземные цели/);
    await page.locator('.tabs [data-do="tab"][data-id="build"]').click();
    await page.locator('[data-do="structure"][data-id="tower"]').click();
    await page.locator('[data-do="move"][data-id="tower"]').click();
    await page.waitForFunction(()=>window.observedRange?.x===1&&window.observedRange?.y===2&&window.observedRange?.reach===16);
    assert.match(await page.locator('#mapnote').innerText(),/Радиус огня — 16 кл. · только наземные цели/);
    await page.locator('#world').press('ArrowRight');await page.waitForFunction(()=>window.observedRange?.x===2&&window.observedRange?.y===2);
    await page.locator('#maptools [data-do="cancelplace"]').click();await page.waitForFunction(()=>!window.observedRange);
    await page.locator('.tabs [data-do="tab"][data-id="build"]').click();await page.locator('[data-do="construct"][data-id="archer"]').click();
    await page.waitForFunction(()=>window.observedRange?.reach===14);
    assert.match(await page.locator('#mapnote').innerText(),/14 кл. · земля и воздух/);
    console.log('PASS',sql.towers.length,'level/range combinations,',checked,'painted cells, both raid formats, seven tower mechanics and touch/keyboard inspection.');
  }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
