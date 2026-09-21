import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
await fs.mkdir('artifacts/nearby',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/listings',r=>r.fulfill({json:{portals:[]}}));await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__atlas?.nearbyPlaces,null,{timeout:90000});
 const zoom=async range=>{await page.evaluate(range=>{__atlas.nav.flyTo([24.95,60.17],range);__atlas.layerSwitcher.collapse();},range);await page.waitForFunction(()=>!__atlas.nav.flight);await page.waitForTimeout(200);};
 const state=()=>page.evaluate(()=>{const r=__atlas.nearbyPlaces.renderer;return {weights:r.weights,clusters:r.clusters.length,points:r.points.show,areas:r.sources.length};});
 await zoom(4500);assert.equal((await state()).points,false);assert.equal((await state()).clusters,0);assert.equal((await state()).areas,0);
 await zoom(1700);assert.ok((await state()).clusters>0);await page.screenshot({path:'artifacts/nearby/clusters.png'});
 const cluster=page.locator('.nearby-cluster').filter({visible:true});assert.equal(await cluster.filter({hasText:/^\d+$/}).count(),0);assert.ok(await cluster.locator('img').count()>0);assert.ok((await cluster.first().getAttribute('aria-label')).length>0);const index=await cluster.evaluateAll(nodes=>nodes.findIndex(e=>{const r=e.getBoundingClientRect();return r.x>450&&r.x<1000&&r.y>180&&r.y<700;}));assert.ok(index>=0);await cluster.nth(index).click();await page.waitForFunction(()=>!__atlas.nav.flight);assert.ok(await page.evaluate(()=>__atlas.nav.state.range)<1700);
 await zoom(500);
 for(const layer of ['overview','price','noise','age','energy','use','parking']){await page.evaluate(layer=>__atlas.switchLayer(layer),layer);await page.waitForTimeout(100);assert.equal((await state()).points,true);}
 await page.evaluate(async()=>{__atlas.switchLayer('overview');await __atlas.mapContext.setTheme('day');});
 // Public renderer picking: a POI click must not clear a selected building.
 await page.evaluate(()=>__atlas.showBuilding(__atlas.manifest.find(r=>r.address==='Aleksanterinkatu 20')));
 assert.ok(await page.locator('.record-nearby .nearby-place img').count()>=1);assert.match(await page.locator('.record-nearby').innerText(),/Nearby transit.*HSL stops/s);
 const hit=await page.evaluate(()=>{const a=__atlas;for(const e of a.nearbyPlaces.renderer.entries){const p=e.primitive.computeScreenSpacePosition(a.viewer.scene);if(p&&p.x>350&&p.x<850&&p.y>170&&p.y<700&&a.viewer.scene.pick(p)?.id?.renderer===a.nearbyPlaces.renderer)return {x:p.x,y:p.y};}return null;});assert.ok(hit);await page.mouse.click(hit.x,hit.y);assert.equal(await page.locator('.nearby-map-detail').isVisible(),true);assert.equal(await page.locator('#building-card').isVisible(),true);await page.locator('.nearby-close').click();
 await page.screenshot({path:'artifacts/nearby/building.png'});
 await page.locator('.record-nearby .nearby-place').first().click();await page.waitForFunction(()=>!__atlas.nav.flight);await page.waitForTimeout(100);assert.equal(await page.locator('#building-card').isVisible(),false);assert.equal(await page.locator('.nearby-map-detail').isVisible(),true);await page.locator('.nearby-close').click();
 await page.evaluate(()=>__atlas.nearbyPlaces.fill(__atlas.buildingPanel.nearby,{position:[24.95,60.17],nearbyTransit:[],nearbyLandmarks:[]}));assert.match(await page.locator('.record-nearby').innerText(),/No mapped transit stops within 1.5 km/);
 await page.evaluate(()=>__atlas.nearbyPlaces.fill(__atlas.buildingPanel.nearby,{position:[0,0]}));assert.match(await page.locator('.record-nearby').innerText(),/coverage is unavailable/);
 await zoom(550);await page.screenshot({path:'artifacts/nearby/daylight.png'});
 const checkDock=async()=>{const boxes=await page.evaluate(()=>{const a=document.querySelector('.lens-tabs').getBoundingClientRect(),b=document.querySelector('.lens-toggle').getBoundingClientRect();return {top:a.top,btop:b.top,bottom:a.bottom,bbottom:b.bottom,right:b.right,width:innerWidth};});assert.ok(boxes.btop>=boxes.top&&boxes.bbottom<=boxes.bottom+2);assert.ok(boxes.right<=boxes.width);};
 await checkDock();await page.locator('.lens-toggle').click();await checkDock();await page.locator('.lens-toggle').click();
 const label=await page.locator('.map-label:not([hidden])').first().evaluate(e=>({color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));assert.equal(label.color,'rgb(246, 250, 247)');assert.ok(label.bg.includes('0.91'));
 await page.setViewportSize({width:390,height:844});await checkDock();await page.screenshot({path:'artifacts/nearby/mobile.png'});
 await page.evaluate(async()=>{await __atlas.stepInside.enter(__atlas.manifest.find(r=>r.address==='Aleksanterinkatu 20'));});await page.waitForTimeout(100);assert.equal((await state()).points,false);assert.equal(await page.locator('.nearby-map-key').isVisible(),false);await page.locator('#step-exit').click();await page.waitForTimeout(100);assert.equal((await state()).points,true);
 assert.deepEqual(errors,[]);console.log('PASS nearby: city hidden / clusters / icons, all lenses, picking, panel and empty states, HSL pictograms, readable labels, stable Details row, mobile, Step Inside isolation');
}finally{await browser.close();}
