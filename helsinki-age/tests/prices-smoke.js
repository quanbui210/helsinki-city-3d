import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.geoCalls=0;window.geoMode='deny';
    Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success,failure){
      window.geoCalls++;queueMicrotask(()=>window.geoMode==='deny'?failure({code:1}):window.geoMode==='unavailable'?failure({code:2}):success({coords:window.geoMode==='outside'?{longitude:2.35,latitude:48.85}:window.geoMode==='espoo'?{longitude:24.83,latitude:60.18}:{longitude:24.953,latitude:60.173}}));
    }}});
  });
  await page.route('**/api/listings',route=>route.fulfill({json:{checkedAt:Date.now(),portals:['oikotie','etuovi','sato','lumo','vuokraovi'].map(portal=>({portal,status:'ok',results:[]}))}}));
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
  assert.equal(await page.evaluate(()=>geoCalls),0,'no permission request on load');
  const initial=await page.evaluate(()=>({...__atlas.nav.state}));
  for(const mode of ['deny','unavailable','outside','espoo']){
    await page.evaluate(mode=>geoMode=mode,mode);await page.locator('#use-location').click();await page.waitForFunction(()=>!document.querySelector('#use-location').disabled);
    assert.deepEqual(await page.evaluate(()=>({...__atlas.nav.state})),initial);assert.equal(await page.locator('#location-card').isVisible(),false);
  }
  await page.evaluate(()=>geoMode='helsinki');await page.locator('#use-location').click();await page.waitForSelector('#location-card:not([hidden])');await page.waitForFunction(()=>!__atlas.nav.flight);
  assert.match(await page.locator('#location-card').textContent(),/You’re in Kruununhaka/);
  assert.equal(await page.evaluate(()=>__atlas.nav.state.lon),24.953);
  await page.locator('#location-card button').filter({hasText:'Price'}).click();
  assert.equal(await page.evaluate(()=>__atlas.layerManager.activeId),'price');
  // The drawer no longer auto-expands on selection; open it explicitly to
  // reach the sale/rent metric toggle and period caption it contains.
  await page.locator('.lens-toggle').click();
  const state=await page.evaluate(()=>({...__atlas.nav.state}));
  assert.deepEqual(await page.evaluate(()=>({sale:__atlas.priceAreas.sources.sale.show,rent:__atlas.priceAreas.sources.rent.show,neutral:__atlas.tileset.style===undefined,groundOnly:Object.values(__atlas.priceAreas.sources).every(s=>s.entities.values.filter(e=>e.polygon).every(e=>e.polygon.classificationType.getValue()===0&&e.priceArea))})),{sale:true,rent:false,neutral:true,groundOnly:true});
  assert.match(await page.locator('.price-period').textContent(),/Q1 2026/);
  await page.locator('[data-price-metric=rent]').click();assert.deepEqual(await page.evaluate(()=>({...__atlas.nav.state})),state);
  assert.match(await page.locator('.price-period').textContent(),/Q4 2025.*archived/);
  assert.equal(await page.evaluate(()=>__atlas.priceAreas.sources.rent.show&&!__atlas.priceAreas.sources.sale.show),true);
  assert.match(page.url(),/metric=rent/);
  await page.evaluate(()=>{__atlas.nav.state.range=2200;__atlas.nav.apply();});
  // Find an actual rendered ground polygon, then exercise both pointer and tap picks.
  let pixel;
  await page.waitForFunction(()=>__atlas.viewer.scene.globe.tilesLoaded);
  for(let attempt=0;attempt<20&&!pixel;attempt++){
    pixel=await page.evaluate(()=>{const scene=__atlas.viewer.scene;for(let y=310;y<630;y+=20)for(let x=350;x<1060;x+=20){const e=scene.pick({x,y})?.id;if(e?.priceArea)return {x,y};}return null;});
    if(!pixel)await page.waitForTimeout(300);
  }
  assert.ok(pixel,'postal polygons must render and be pickable on the ground');
  await page.mouse.move(pixel.x,pixel.y);await page.waitForSelector('#price-area-card:not([hidden])');assert.match(await page.locator('#price-area-card').textContent(),/Monthly rent/);
  await page.mouse.click(pixel.x,pixel.y);assert.equal(await page.locator('#price-area-card').isVisible(),true);
  await mkdir('artifacts/prices',{recursive:true});await page.screenshot({path:'artifacts/prices/rent-desktop.png'});
  const building=await page.evaluate(()=>__atlas.manifest.find(b=>b.address&&__atlas.priceAreas.lookup.sale(b.position)?.avgSalePricePerSqm&&__atlas.priceAreas.lookup.rent(b.position)?.avgRentPerSqm));
  await page.locator('[data-layer=overview]').click();await page.locator('#map-search').fill(building.address);await page.locator('#search-results button').first().click();
  assert.equal(await page.locator('#building-address').textContent(),building.address);
  assert.match(await page.locator('[data-metric=use] .metric-value').textContent(),/\S/);
  // Per-card expand/collapse is gone; noise methodology and the full
  // price/rent trend breakdown now live in the "Full details" dialog.
  await page.locator('#open-building-detail').click();
  assert.match(await page.locator('[data-detail=noise] .detail-body').textContent(),/Modeled noise/);
  assert.match(await page.locator('[data-detail=price] .detail-body').textContent(),/Sale price.*Monthly rent.*not a valuation/s);
  await page.locator('#close-building-detail').click();
  assert.equal(await page.evaluate(()=>Object.values(__atlas.priceAreas.sources).every(s=>!s.show)),true);
  for(const id of ['age','noise','use','price']){
    await page.locator(`[data-layer=${id}]`).click();assert.equal(await page.locator('.record-metrics').isVisible(),true);assert.equal(await page.locator('#building-address').textContent(),building.address);
  }
  await page.screenshot({path:'artifacts/prices/building-desktop.png'});
  // setViewportSize resolves before the page's own 'resize' listener (which
  // recomputes --lens-top for the new width) has actually run, so give it a
  // frame to settle before measuring bounds.
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bounds=await page.locator('#building-card').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844);
  assert.equal(await page.locator('#building-card').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  // Full price/rent breakdown lives in the detail dialog now; open it here
  // to also confirm the dialog itself is laid out sanely at mobile width.
  await page.locator('#open-building-detail').click();
  await page.locator('[data-detail=price] .area-rent').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/prices/building-mobile.png'});
  await page.locator('#close-building-detail').click();
  // Closing the building leaves the price drawer collapsed (it was force-
  // collapsed while the building panel was open); reopen it to reach the
  // rent/sale toggle.
  await page.locator('#close-building').click();await page.locator('.lens-toggle').click();await page.locator('[data-price-metric=rent]').click();await page.screenshot({path:'artifacts/prices/rent-mobile.png'});
  const ground=await page.evaluate(()=>{const scene=__atlas.viewer.scene;for(let y=245;y<470;y+=12)for(let x=20;x<330;x+=12)if(scene.pick({x,y})?.id?.priceArea)return {x,y};return null;});
  assert.ok(ground,'mobile ground polygons must be pickable');await page.touchscreen.tap(ground.x,ground.y);await page.waitForSelector('#price-area-card:not([hidden])');
  await page.waitForTimeout(300);assert.equal(await page.locator('#price-area-card').isVisible(),true,'tap detail stays visible after touch ends');
  await page.screenshot({path:'artifacts/prices/area-mobile.png'});
  await page.reload();await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});assert.equal(await page.evaluate(()=>__atlas.layerManager.state.metric),'rent');assert.equal(await page.evaluate(()=>geoCalls),0);
  assert.deepEqual(errors,[]);console.log('PASS: price ground polygons, hover/tap, metric periods, neutral buildings, shared search context, mobile, location opt-in and silent failures, deep links.');
}finally{await browser.close();}
