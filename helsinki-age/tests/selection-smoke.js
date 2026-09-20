import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];let calls=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/listings',async route=>{calls++;await route.fulfill({json:{checkedAt:Date.now(),portals:['oikotie','etuovi','sato','lumo','vuokraovi'].map(portal=>({portal,status:'ok',results:portal==='etuovi'?[{title:'Address search match',snippet:'Search-provided text. Check current availability with the portal.',url:'https://www.etuovi.com/test-result',portal}]:[]}))}});});
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
 const record=await page.evaluate(()=>__atlas.manifest.filter(r=>r.address).sort((a,b)=>Math.hypot(a.position[0]-24.95,a.position[1]-60.17)-Math.hypot(b.position[0]-24.95,b.position[1]-60.17))[0]);
 await page.evaluate(r=>__atlas.selectSearchResult({buildingId:r.buildingId,position:r.position,range:650}),record);
 await page.waitForFunction(()=>!__atlas.nav.flight&&__atlas.buildingSelection.features.size>0);
 await page.locator('.record-listing-summary').click();
 await page.waitForFunction(()=>document.querySelector('.record-listing-summary').dataset.state==='found');
 assert.equal(await page.locator('#record-panel-context').isVisible(),true);
 assert.match(await page.locator('.record-listing-summary').textContent(),/1 listing found/);
 const visibleHeader=async()=>{
   const h=await page.locator('.record-header').boundingBox(),c=await page.locator('#building-card').boundingBox();assert.ok(h.y>=c.y&&h.y+h.height<=c.y+c.height);
   assert.equal(await page.locator('#building-card').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 };
 await visibleHeader();await page.locator('#building-prompt').scrollIntoViewIfNeeded();await visibleHeader();
 await page.locator('.record-listing-summary').click();assert.equal(await page.locator('#building-listings').isVisible(),true);assert.equal(await page.locator('#building-year').isVisible(),false);
 assert.equal(await page.evaluate(()=>__atlas.buildingSelection.stage.enabled),true);
 assert.equal(await page.evaluate(()=>__atlas.buildingSelection.edge.selected.length),1);
 assert.equal(await page.locator('#selected-address-marker').isVisible(),true);
 await mkdir('artifacts/selection',{recursive:true});await page.screenshot({path:'artifacts/selection/listings-desktop.png'});
 const hit=await page.evaluate(id=>{for(let y=350;y<650;y+=8)for(let x=500;x<950;x+=8){const f=__atlas.viewer.scene.pick({x,y});if(f?.getProperty?.('buildingId')===id)return {x,y};}return null;},record.buildingId);
 assert.ok(hit,'selected building geometry is pickable');await page.mouse.click(hit.x,hit.y);assert.equal(await page.evaluate(()=>__atlas.buildingSelection.record.buildingId),record.buildingId);
 await page.locator('[data-layer=noise]').click();assert.equal(await page.locator('#building-listings').isVisible(),true);await page.waitForTimeout(400);assert.equal(calls,1);
 await page.locator('#record-tab-listings').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#record-tab-context').getAttribute('aria-selected'),'true');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!__atlas.layerSwitcher.open);await visibleHeader();
 await page.locator('#building-prompt').scrollIntoViewIfNeeded();await visibleHeader();await page.locator('.record-listing-summary').click();await page.screenshot({path:'artifacts/selection/listings-mobile.png'});
 await page.locator('#close-building').click();assert.equal(await page.locator('#selected-address-marker').isVisible(),false);assert.equal(await page.evaluate(()=>__atlas.buildingSelection.features.size),0);assert.equal(await page.evaluate(()=>__atlas.layerSwitcher.open),true);
 await page.evaluate(()=>__atlas.showBuilding({address:'Example 1',position:[24.95,60.17]}));assert.equal(await page.evaluate(()=>__atlas.buildingSelection.features.size),0);assert.equal(await page.locator('#selected-address-marker').isVisible(),true);assert.equal(await page.locator('#selected-address-marker').textContent(),'');
 assert.deepEqual(errors,[]);console.log('PASS: pinned result summary, accessible tabs, stable header while scrolling, streamed building outline, layer retention, mobile focus and address-point fallback.');
}finally{await browser.close();}
