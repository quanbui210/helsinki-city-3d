import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
await fs.mkdir('artifacts/landmarks',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('**/api/listings',route=>route.fulfill({json:{portals:[]}}));await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas?.nearbyPlaces,null,{timeout:90000});
 assert.equal(await page.evaluate(()=>__atlas.manifest.filter(record=>record.landmarkStyle==='stadium').length),5);
 assert.ok(await page.evaluate(()=>__atlas.tileset.customShader.fragmentShaderText.includes('(1.0-landmark)')));
 await page.locator('#map-search').fill('Helsinki Olympic');await page.waitForSelector('#search-results button');
 assert.match(await page.locator('#search-results button').first().innerText(),/Helsinki Olympic Stadium.*Featured landmark/s);await page.locator('#search-results button').first().click();
 await page.waitForFunction(()=>!__atlas.nav.flight);await page.waitForFunction(()=>[...__atlas.loadedContents.values()].some(content=>Array.from({length:content.featuresLength},(_,i)=>content.getFeature(i)).some(feature=>feature.getProperty('landmarkName')==='Helsinki Olympic Stadium')));
 assert.equal(await page.locator('#building-address').innerText(),'Helsinki Olympic Stadium');assert.equal(await page.locator('.record-listing-summary').isHidden(),true);assert.equal(await page.locator('#record-tab-listings').isHidden(),true);assert.equal(await page.locator('#step-inside-button').isHidden(),true);
 await page.locator('#close-building').click();await page.evaluate(async()=>{__atlas.layerSwitcher.collapse();await __atlas.mapContext.setTheme('day');Object.assign(__atlas.nav.state,{lon:24.9272573,lat:60.1869938,range:560,heading:24,pitch:-52});__atlas.nav.apply();});await page.waitForTimeout(500);await page.screenshot({path:'artifacts/landmarks/olympic-stadium-day.png'});
 await page.evaluate(async()=>{await __atlas.mapContext.setTheme('dusk');});await page.waitForTimeout(300);await page.screenshot({path:'artifacts/landmarks/olympic-stadium-dusk.png'});
 const cathedral=await page.evaluate(()=>__atlas.manifest.find(record=>record.landmarkName==='Helsinki Cathedral'));await page.evaluate(record=>__atlas.selectSearchResult({buildingId:record.buildingId,position:record.position,range:380}),cathedral);await page.waitForFunction(()=>!__atlas.nav.flight);await page.waitForTimeout(300);
 assert.equal(await page.locator('#building-address').innerText(),'Helsinki Cathedral');assert.equal(await page.locator('#step-inside-button').isHidden(),true);await page.locator('#close-building').click();await page.locator('#map-search').fill('Helsinki Cathedral');await page.evaluate(()=>{Object.assign(__atlas.nav.state,{lon:24.9521853,lat:60.1703785,range:620,heading:35,pitch:-48});__atlas.nav.apply();});await page.waitForTimeout(500);await page.screenshot({path:'artifacts/landmarks/helsinki-cathedral-dusk.png'});
 const ordinary=await page.evaluate(()=>__atlas.manifest.find(record=>record.address&&record.buildingId&&!record.landmarkStyle));await page.evaluate(record=>__atlas.showBuilding(record),ordinary);assert.equal(await page.locator('.record-listing-summary').isVisible(),true);assert.equal(await page.locator('#record-tab-listings').isVisible(),true);assert.equal(await page.locator('#step-inside-button').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS landmarks: curated IDs, shader, destination search, non-residential actions, stadium and Cathedral views');
}finally{await browser.close();}
