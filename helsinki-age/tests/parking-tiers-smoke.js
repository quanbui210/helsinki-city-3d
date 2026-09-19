import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/listings',r=>r.fulfill({json:{portals:[]}}));
 await page.goto('http://localhost:5173/?layer=parking');await page.waitForFunction(()=>window.__atlas,null,{timeout:120000});
 await mkdir('artifacts/parking-tiers',{recursive:true});
 const inspect=()=>page.evaluate(()=>{const r=__atlas.layerManager.renderers.get('parking');return {weights:r.weights,clusters:r.clusters.map(c=>({count:c.count,members:c.members.length})),areas:r.sources[0].entities.values.length,points:r.points.show,signature:r.lastSignature};});
 await page.waitForTimeout(1500);let state=await inspect();assert.equal(state.weights.area,1);assert.ok(state.areas>0);await page.screenshot({path:'artifacts/parking-tiers/city.png'});
 const zoom=async(range,lon=24.95)=>{await page.evaluate(({range,lon})=>{Object.assign(__atlas.nav.state,{range,lon,lat:60.17});__atlas.nav.apply();},{range,lon});await page.waitForTimeout(250);};
 await zoom(1700);state=await inspect();assert.equal(state.weights.cluster,1);assert.ok(state.clusters.length>0);assert.ok(state.clusters.every(c=>c.count===c.members));await page.screenshot({path:'artifacts/parking-tiers/district.png'});
 const signature=state.signature;await zoom(1700,24.97);assert.notEqual((await inspect()).signature,signature);
 await zoom(2800);state=await inspect();assert.ok(state.weights.cluster>0&&state.weights.area>0);
 await zoom(850);state=await inspect();assert.ok(state.weights.cluster>0&&state.weights.point>0);
 await zoom(500);state=await inspect();assert.equal(state.weights.point,1);assert.equal(state.clusters.length,0);assert.equal(state.points,true);await page.screenshot({path:'artifacts/parking-tiers/street.png'});
 await zoom(1700);const target=await page.locator('.tiered-cluster').evaluateAll(items=>items.findIndex(e=>{const r=e.getBoundingClientRect();return r.x>450&&r.x<1000&&r.y>150&&r.y<650;}));assert.ok(target>=0);await page.locator('.tiered-cluster').nth(target).click();await page.waitForFunction(()=>!__atlas.nav.flight);assert.ok(await page.evaluate(()=>__atlas.nav.state.range<1700));
 await page.evaluate(()=>__atlas.switchLayer('overview'));assert.equal(await page.locator('.tiered-clusters').isVisible(),false);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__atlas.switchLayer('parking'));await zoom(1700);await page.screenshot({path:'artifacts/parking-tiers/mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS tier crossfades, aggregate footprint, dynamic counted clusters, click-to-zoom, cleanup and mobile');
}finally{await browser.close();}
