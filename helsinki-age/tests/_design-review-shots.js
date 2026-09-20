import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  await mkdir('artifacts/design-review',{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.route('**/api/listings',r=>r.fulfill({json:{portals:[]}}));
  await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
  const building=await page.evaluate(()=>__atlas.manifest.find(b=>b.address&&b.energy&&b.constructionYear));
  await page.evaluate(r=>__atlas.selectSearchResult({buildingId:r.buildingId,position:r.position,range:650}),building);
  await page.waitForFunction(()=>!__atlas.nav.flight);
  await page.screenshot({path:'artifacts/design-review/desktop-compact.png'});
  await page.locator('#open-building-detail').click();
  await page.waitForTimeout(200);
  await page.screenshot({path:'artifacts/design-review/desktop-dialog.png'});
  await page.locator('#close-building-detail').click();
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:'artifacts/design-review/mobile-compact.png'});
  await page.locator('#open-building-detail').click();
  await page.waitForTimeout(200);
  await page.screenshot({path:'artifacts/design-review/mobile-dialog.png'});
  console.log('done');
}finally{await browser.close();}
