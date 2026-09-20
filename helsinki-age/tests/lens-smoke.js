import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const artifactDir=process.env.LENS_ARTIFACT_DIR??'artifacts/lens';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('/api/listings'))errors.push(m.text().slice(0,300));});
 await page.route('**/api/listings',route=>route.fulfill({json:{checkedAt:Date.now(),portals:['oikotie','etuovi','sato','lumo','vuokraovi'].map(portal=>({portal,status:'ok',results:[]}))}}));
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
 assert.equal(await page.title(),'Helsinki Lens');
 assert.deepEqual(await page.evaluate(()=>({layer:__atlas.layerManager.activeId,unstyled:__atlas.tileset.style===undefined,orbit:__atlas.nav.orbit,shadows:__atlas.viewer.shadowMap.enabled})),{layer:'overview',unstyled:true,orbit:true,shadows:true});
 const start=await page.evaluate(()=>__atlas.nav.state.heading);await page.waitForFunction(h=>__atlas.nav.state.heading!==h,start);
 await page.locator('#map-search').focus();assert.equal(await page.evaluate(()=>__atlas.nav.orbit),false);
 await mkdir(artifactDir,{recursive:true});await page.screenshot({path:artifactDir+'/overview.png'});
 const building=await page.evaluate(()=>__atlas.manifest.filter(b=>b.address&&b.energy).sort((a,b)=>b.address.length-a.address.length)[0]);
 await page.locator('#map-search').fill(building.address);
 await page.locator('#search-results button').first().click();await page.waitForFunction(()=>!__atlas.nav.flight);
 assert.equal(await page.locator('#building-address').textContent(),building.address);
 assert.equal(await page.locator('#building-card').isVisible(),true);
 // See how loud this street is → is a secondary action inside the "Full
 // details" dialog now, not the compact default view.
 await page.locator('#open-building-detail').click();await page.locator('#building-prompt').click();assert.equal(await page.evaluate(()=>__atlas.layerManager.activeId),'noise');
 assert.equal(await page.locator('#building-address').textContent(),building.address);
 await page.screenshot({path:artifactDir+'/search-noise.png'});
 await page.locator('button[data-layer="energy"]').click();await page.locator('#open-building-detail').click();assert.match(await page.locator('[data-detail=energy] .detail-body').textContent(),/Archived class/);await page.locator('#close-building-detail').click();
 const fullest=await page.evaluate(()=>__atlas.manifest.reduce((a,b)=>JSON.stringify(b).length>JSON.stringify(a).length?b:a));
 await page.evaluate(record=>__atlas.showBuilding(record),fullest);
 const checkCard=async()=>{
  const bounds=await page.locator('#building-card').boundingBox(),viewport=page.viewportSize();
  assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y+bounds.height<=viewport.height);
  assert.equal(await page.locator('#building-card').evaluate(e=>e.scrollWidth<=e.clientWidth),true,'long content must wrap, not clip horizontally');
  // The compact grid itself never grows uneven card heights; the relocated
  // prompt is reachable one layer down, inside the detail dialog.
  await page.locator('#open-building-detail').click();
  await page.locator('#building-prompt').scrollIntoViewIfNeeded();assert.ok(await page.locator('#building-prompt').isVisible());
  await page.locator('#close-building-detail').click();
 };
 await checkCard();await page.screenshot({path:artifactDir+'/record-desktop.png'});
 // setViewportSize resolves before the page's own 'resize' listener (which
 // recomputes --lens-top for the new width) has actually run, so give it a
 // frame to settle before measuring — same pattern used below for style resets.
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await checkCard();await page.screenshot({path:artifactDir+'/record-mobile.png'});
 await page.locator('#close-building').click();await page.locator('button[data-layer="overview"]').click();
 assert.equal(await page.evaluate(()=>__atlas.tileset.style===undefined),true);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.evaluate(()=>{for(const c of __atlas.loadedContents.values())for(let i=0;i<c.featuresLength;i++){const f=c.getFeature(i);if(!f.show||f.color.red!==1||f.color.green!==1||f.color.blue!==1)return false;}return true;}),true,'overview restores unstyled full model');
 await page.locator('#map-search').fill('no-such-address-zzzz');await page.waitForSelector('#search-results p');assert.match(await page.locator('#search-results p').textContent(),/No matching address/);
 await page.locator('#map-search').fill('A.I. Virtanens plats 1');await page.locator('#search-results button').first().click();assert.match(await page.locator('#building-status').textContent(),/No 3D building record/);
 await page.locator('#close-building').click();await page.locator('#map-search').fill('');await page.screenshot({path:artifactDir+'/overview-mobile.png'});
 const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();await rp.goto('http://localhost:5173/');await rp.waitForFunction(()=>window.__atlas,null,{timeout:90000});assert.equal(await rp.evaluate(()=>__atlas.nav.orbit),false);await reduced.close();
 assert.deepEqual(errors,[]);console.log('PASS: neutral Overview, reduced motion, official geocoder, shared record flow, long-content panels, mobile, rendering');
}finally{await browser.close();}

