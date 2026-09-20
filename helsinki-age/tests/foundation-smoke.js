import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/listings',r=>r.fulfill({json:{portals:[]}}));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
 await page.evaluate(()=>__atlas.nav.flyTo([24.95,60.17],550));await page.waitForFunction(()=>!__atlas.nav.flight&&__atlas.streetTrees.loaded.size>0&&__atlas.realityMesh&&__atlas.distantContext,{},{timeout:60000});await page.waitForTimeout(1800);
 assert.equal(await page.evaluate(()=>__atlas.viewer.imageryLayers.length>0),true);
 // Theme now defaults by local hour; force dusk so this screenshot is deterministic.
 await page.locator('button[data-theme=dusk]').click();await page.waitForTimeout(300);
 await page.screenshot({path:'artifacts/foundation/final-dusk.png'});
 await page.locator('button[data-theme=day]').click();await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>__atlas.tileset.customShader.uniforms.u_dusk.value),0);await page.screenshot({path:'artifacts/foundation/final-day.png'});
 for(const layer of ['age','noise','energy','use','price','parking']){
   await page.evaluate(layer=>__atlas.switchLayer(layer,{year:2026}),layer);await page.waitForTimeout(350);
   const hit=await page.evaluate(()=>{for(let y=300;y<650;y+=15)for(let x=450;x<1000;x+=15){const f=__atlas.viewer.scene.pick({x,y});const id=f?.getProperty?.('buildingId');if(id&&__atlas.layerManager.records.has(id))return {x,y,id};}return null;});assert.ok(hit,`${layer} contains selectable records`);
   await page.mouse.click(hit.x,hit.y);assert.equal(await page.evaluate(()=>__atlas.buildingSelection.record?.buildingId),hit.id);
   assert.equal(await page.evaluate(()=>__atlas.tileset.customShader.uniforms.u_data.value),['age','noise','energy','use'].includes(layer)?1:0);
   await page.locator('#close-building').click();
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__atlas.switchLayer('overview'));await page.screenshot({path:'artifacts/foundation/final-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS: aerial imagery, batched trees, mesh/context loading, day/dusk materials, all six lenses selectable, mobile');
}finally{await browser.close();}
