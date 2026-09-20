import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.route('**/api/listings',r=>r.fulfill({json:{portals:[]}}));
  await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
  const building=await page.evaluate(()=>__atlas.manifest.find(b=>b.address&&b.energy&&b.constructionYear));
  await page.evaluate(r=>__atlas.selectSearchResult({buildingId:r.buildingId,position:r.position,range:650}),building);
  await page.waitForFunction(()=>!__atlas.nav.flight);

  // 1. Escape closes only the dialog, not the underlying building panel.
  await page.locator('#open-building-detail').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').open),true,'dialog should be open');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').open),false,'Escape should close the dialog');
  assert.equal(await page.locator('#building-card').isVisible(),true,'Escape must not also close the building panel');
  console.log('PASS escape-closes-dialog-only');

  // 2. Backdrop click closes the dialog (matches existing about-dialog convention).
  await page.locator('#open-building-detail').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').open),true);
  await page.mouse.click(20,20); // corner of viewport, outside the centered dialog box
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').open),false,'backdrop click should close the dialog');
  console.log('PASS backdrop-click-closes-dialog');

  // 3. Explicit close button works.
  await page.locator('#open-building-detail').click();
  await page.locator('#close-building-detail').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').open),false);
  console.log('PASS close-button-closes-dialog');

  // 4. building-prompt / cinematic-view relocated into the dialog as secondary actions.
  await page.locator('#open-building-detail').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').contains(document.querySelector('#building-prompt'))),true,'building-prompt should now live inside the dialog');
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').contains(document.querySelector('#cinematic-view'))),true,'cinematic-view should now live inside the dialog');
  assert.equal(await page.locator('#building-prompt').isVisible(),true);
  assert.equal(await page.locator('#cinematic-view').isVisible(),true);
  console.log('PASS prompts-relocated-into-dialog');

  // 5. Closing the building panel while the dialog is open closes both cleanly.
  await page.locator('#close-building').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').open),false,'#close-building must also close the open detail dialog');
  assert.equal(await page.locator('#building-card').isVisible(),false);
  console.log('PASS close-building-closes-dialog-too');

  // 6. Switching layers while the dialog is open closes it instead of leaving stale content.
  await page.evaluate(r=>__atlas.selectSearchResult({buildingId:r.buildingId,position:r.position,range:650}),building);
  await page.waitForFunction(()=>!__atlas.nav.flight);
  await page.locator('#open-building-detail').click();
  await page.locator('[data-layer=energy]').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#building-detail-dialog').open),false,'switching layers should close the dialog rather than leave it open on stale data');
  assert.equal(await page.locator('#building-card').isVisible(),true,'switching layers while retaining a selection keeps the building panel open');
  console.log('PASS layer-switch-closes-dialog');

  console.log('ALL INTERACTION CHECKS PASSED');
}finally{await browser.close();}
