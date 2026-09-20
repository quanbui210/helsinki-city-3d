import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:5173/?layer=age&year=1900');
  await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
  const camera=await page.evaluate(()=>({...__atlas.nav.state}));
  await mkdir('artifacts/layers',{recursive:true});
  for(const layer of ['use','noise','energy','age']){
    const start=Date.now();await page.locator(`button[data-layer="${layer}"]`).click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.deepEqual(await page.evaluate(()=>({...__atlas.nav.state})),camera,'layer switching must preserve the camera');
    const result=await page.evaluate(()=>{
      const a=__atlas;let checked=0,bad=0;
      for(const content of a.loadedContents.values())for(let i=0;i<content.featuresLength;i++){
        const f=content.getFeature(i),record=a.layerManager.records.get(f.getProperty('buildingId'));
        const expected=a.layerManager.activeId==='age'?(record.constructionYear===null||record.constructionYear<=a.slider.year):true;
        if(f.show!==expected)bad++;
        if(f.getProperty('useCategory')!==(record.useCategory??'unknown'))bad++;
        if(f.getProperty('noise_road')!==(record.noise.road?.low??-1))bad++;
        if(f.getProperty('energyClass')!==(record.energy?.class??'unknown'))bad++;
        if(a.layerManager.activeId!=='age'&&!a.tileset.style.color.evaluateColor(f).equals(f.color))bad++;
        checked++;
      }return {checked,bad};
    });
    assert.ok(result.checked>100);assert.equal(result.bad,0);console.log(layer,result,'switch ms',Date.now()-start);
    await page.screenshot({path:`artifacts/layers/${layer}.png`});
  }
  // The drawer no longer auto-expands on tab selection; open it explicitly
  // to reach the transport-source controls it contains.
  await page.locator('button[data-layer="noise"]').click();await page.locator('.lens-toggle').click();
  for(const mode of ['road','rail','metro','tram','combined']){
    await page.locator(`[data-noise-mode="${mode}"]`).click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const result=await page.evaluate(()=>{
      const a=__atlas;let bad=0,known=0,unknown=0;
      for(const content of a.loadedContents.values())for(let i=0;i<content.featuresLength;i++){
        const f=content.getFeature(i),value=f.getProperty('noise_'+a.layerManager.state.mode);
        const expected=a.tileset.style.color.evaluateColor(f);
        if(!expected.equals(f.color))bad++;
        value===-1?unknown++:known++;
      }return {bad,known,unknown};
    });assert.equal(result.bad,0);assert.ok(result.unknown>0);console.log(mode,result);
  }
  await page.reload();await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
  assert.equal(await page.locator('#noise-mode').inputValue(),'combined');
  await page.locator('button[data-layer="age"]').click();assert.equal(await page.locator('#year').inputValue(),'1900');
  await page.locator('button[data-layer="noise"]').click();assert.equal(await page.locator('#noise-mode').inputValue(),'combined');
  await page.locator('.district-button').filter({hasText:'Vallila'}).click();
  await page.waitForFunction(()=>!__atlas.nav.flight&&__atlas.tileset.tilesLoaded);
  assert.equal(await page.evaluate(()=>{let bad=0;for(const c of __atlas.loadedContents.values())for(let i=0;i<c.featuresLength;i++){const f=c.getFeature(i);if(f.getProperty('noise_combined')===undefined)bad++;}return bad;}),0);
  await page.setViewportSize({width:390,height:844});
  for(const layer of ['noise','use','energy','age']){await page.locator(`button[data-layer="${layer}"]`).click();await page.screenshot({path:`artifacts/layers/mobile-${layer}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  assert.deepEqual(errors,[]);console.log('PASS: lenses, real streamed properties, colors, camera continuity, deep links, mobile');
}finally{await browser.close();}

