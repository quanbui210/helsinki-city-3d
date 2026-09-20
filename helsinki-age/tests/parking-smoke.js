import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/listings',r=>r.fulfill({json:{portals:[]}}));
await page.goto('http://localhost:5173/?layer=parking');await page.waitForFunction(()=>window.__atlas,null,{timeout:120000});
assert.equal(await page.evaluate(()=>__atlas.layerManager.renderers.get('parking').sources.every(s=>s.show)),true);
const r=await page.evaluate(()=>__atlas.manifest.find(r=>r.nearbyParkingSpots>30&&r.residentZoneId&&r.paidZoneId&&r.address));assert.ok(r);
await page.evaluate(r=>__atlas.selectSearchResult({buildingId:r.buildingId,position:r.position,range:700}),r);await page.waitForFunction(()=>!__atlas.nav.flight);
// Per-card expand/collapse is gone; full parking detail now lives in the
// "Full details & sources" dialog reached from the compact grid.
await page.locator('#open-building-detail').click();
assert.match(await page.locator('[data-detail=parking] .detail-body').textContent(),/not whether this specific building has its own parking/);
assert.match(await page.locator('[data-detail=parking] .detail-body').textContent(),/within 200 m/);
await page.locator('[data-detail=parking] .detail-body').scrollIntoViewIfNeeded();await mkdir('artifacts/parking',{recursive:true});await page.screenshot({path:'artifacts/parking/desktop.png'});
await page.locator('#close-building-detail').click();
await page.evaluate(()=>__atlas.switchLayer('noise'));assert.equal(await page.evaluate(()=>__atlas.layerManager.renderers.get('parking').active),false);
await page.evaluate(()=>__atlas.switchLayer('parking'));assert.equal(await page.evaluate(()=>__atlas.layerManager.renderers.get('parking').active),true);
await page.setViewportSize({width:390,height:844});await page.locator('#open-building-detail').click();await page.locator('[data-detail=parking] .detail-body').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/parking/mobile.png'});
await page.locator('#close-building-detail').click();
assert.equal(await page.locator('#building-card').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
await page.evaluate(()=>__atlas.showBuilding({address:'Outside coverage',position:[24.7,60.2]}));
await page.locator('#open-building-detail').click();
assert.match(await page.locator('[data-detail=parking] .detail-body').textContent(),/No digitized data/);
assert.deepEqual(errors,[]);console.log('PASS parking zones, selection context, mobile layout, layer cleanup and coverage gaps');
}finally{await browser.close();}
