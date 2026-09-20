import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});let requests=0,mode='results';const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/listings',async route=>{
   requests++;const query=route.request().postDataJSON();assert.ok(query.address);assert.ok(['Helsinki','Espoo'].includes(query.city));
   await new Promise(resolve=>setTimeout(resolve,350));
   if(mode==='failure'){await route.fulfill({status:503,json:{error:'not_configured'}});return;}
   await route.fulfill({json:{checkedAt:Date.now(),cached:false,portals:['oikotie','etuovi','sato','lumo','vuokraovi'].map(portal=>({portal,status:'ok',results:mode==='results'&&portal==='oikotie'?[{title:'Test search title <script>not executable</script>',snippet:'Unmodified search snippet €1,200. Availability is not verified.',url:'https://asunnot.oikotie.fi/test-listing',portal}]:[]}))}});
 });
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});assert.equal(requests,0,'no listing lookup on map load');
 const records=await page.evaluate(()=>__atlas.manifest.filter(b=>b.address).slice(0,3));
 await page.evaluate(r=>__atlas.showBuilding(r),records[0]);assert.equal(await page.locator('#building-price-context').isVisible(),true);
 assert.equal(requests,0,'opening a record does not search');
 assert.equal(await page.locator('.record-listing-summary').getAttribute('data-state'),'idle');
 await page.locator('.record-listing-summary').click();
 await page.waitForFunction(()=>document.querySelector('.listing-status')?.textContent.startsWith('1 listing'));
 assert.equal(await page.locator('.listing-snippet').textContent(),'Unmodified search snippet €1,200. Availability is not verified.');
 assert.equal(await page.locator('#building-listings script').count(),0);assert.equal(await page.locator('#building-listings article a').getAttribute('target'),'_blank');
 await page.locator('[data-layer=noise]').click();await page.waitForTimeout(500);assert.equal(requests,1,'changing lens retains current results');
 await page.locator('#record-tab-listings').click();await mkdir('artifacts/listings',{recursive:true});await page.locator('#building-listings').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/listings/results-desktop.png'});
 mode='empty';await page.evaluate(r=>__atlas.showBuilding(r),records[1]);assert.equal(requests,1);await page.locator('.record-listing-summary').click();await page.waitForFunction(()=>document.querySelector('.listing-status')?.textContent.startsWith('None found'));
 assert.equal(await page.locator('.listing-manual-links a').count(),5);
 mode='failure';await page.evaluate(r=>__atlas.showBuilding(r),records[2]);await page.locator('.record-listing-summary').click();await page.waitForFunction(()=>document.querySelector('.listing-status')?.textContent.includes('Could not check'));
 await page.setViewportSize({width:390,height:844});await page.locator('#record-tab-listings').click();await page.locator('#building-listings').scrollIntoViewIfNeeded();assert.equal(await page.locator('#building-card').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.screenshot({path:'artifacts/listings/unconfigured-mobile.png'});
 await page.locator('#close-building').click();const before=requests;await page.evaluate(r=>{__atlas.showBuilding(r);__atlas.listingSearch.search();document.querySelector('#close-building').click();},records[0]);await page.waitForTimeout(500);assert.equal(requests,before,'closing aborts an in-flight lookup');
 assert.deepEqual(errors,[]);console.log('PASS: on-demand listing discovery, unchanged snippets, text safety, lens reuse, loading, empty/error fallback, mobile, cancellation. Mock search responses only; no portal requests.');
}finally{await browser.close();}
