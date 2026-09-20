import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('artifacts/step-inside',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/listings',r=>r.fulfill({json:{portals:[]}}));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
 await page.evaluate(()=>{const a=__atlas,r=a.manifest.find(r=>r.address==='Aleksanterinkatu 20');a.selectSearchResult({buildingId:r.buildingId,position:r.position,name:r.address,range:650});});
 await page.waitForFunction(()=>!__atlas.nav.flight);const before=await page.evaluate(()=>({...__atlas.nav.state}));const cameraBefore=await page.evaluate(()=>{const p=__atlas.viewer.camera.positionWC;return [p.x,p.y,p.z];});
 await page.locator('#step-inside-button').click();await page.waitForFunction(()=>__atlas.stepInside.facade&&!__atlas.nav.flight,null,{timeout:90000});
 assert.equal(await page.locator('.map-tools').isVisible(),false);
 const initial=await page.evaluate(()=>({ground:__atlas.stepInside.dim.ground,height:__atlas.viewer.camera.positionCartographic.height,distances:__atlas.stepInside.distances}));
 assert.ok(initial.ground>=0);assert.ok(initial.height>0);assert.ok(initial.distances.some(d=>d<120),'nearby geometry obstructs at least one ray');
 await page.screenshot({path:'artifacts/step-inside/first-floor.png'});
 await page.locator('#step-floor').fill('4');await page.locator('#step-floor').dispatchEvent('change');await page.waitForFunction(()=>!__atlas.nav.flight);
 assert.ok(await page.evaluate(()=>__atlas.viewer.camera.positionCartographic.height)>initial.height+5);
 await page.screenshot({path:'artifacts/step-inside/fourth-floor.png'});
 await page.locator('#step-month').fill('6');await page.locator('#step-month').dispatchEvent('input');const summer=await page.evaluate(()=>__atlas.stepInside.sun.altitude);
 await page.locator('#step-month').fill('12');await page.locator('#step-month').dispatchEvent('input');assert.ok(summer>await page.evaluate(()=>__atlas.stepInside.sun.altitude)+.7);
 await page.locator('#step-look').fill('30');await page.locator('#step-look').dispatchEvent('input');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#step-inside').isVisible(),false);assert.deepEqual(await page.evaluate(()=>({...__atlas.nav.state})),before);const cameraAfter=await page.evaluate(()=>{const p=__atlas.viewer.camera.positionWC;return [p.x,p.y,p.z];});assert.ok(Math.hypot(...cameraAfter.map((v,i)=>v-cameraBefore[i]))<.01);
 assert.equal(await page.locator('#step-inside-button').evaluate(e=>e===document.activeElement),true);
 await page.setViewportSize({width:390,height:844});await page.locator('#step-inside-button').click();await page.waitForFunction(()=>__atlas.stepInside.facade&&!__atlas.nav.flight,null,{timeout:90000});
 await page.screenshot({path:'artifacts/step-inside/mobile.png'});
 const fit=await page.locator('#step-inside').evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight,bottom:e.getBoundingClientRect().bottom}));assert.ok(fit.bottom<=844);assert.ok(fit.scroll<=fit.client+1,'controls and readouts fit without scrolling');
 await page.locator('#step-exit').click();
 // A failed geometry load must remain escapable and never leave stale assessments.
 await page.evaluate(()=>__atlas.stepInside.enter({...__atlas.manifest[0],tileContentUri:'missing.b3dm'},document.querySelector('#step-inside-button')));
 assert.match(await page.locator('#step-status').innerText(),/unavailable/);assert.match(await page.locator('#step-openness').innerText(),/not assessed/);await page.locator('#step-exit').click();
 await page.evaluate(()=>__atlas.stepInside.enter({...__atlas.manifest.find(r=>r.address==='Pohjoisesplanadi 21'),floorCount:null}));assert.equal(await page.locator('#step-floor').getAttribute('max'),'8');assert.match(await page.locator('#step-floor-note').innerText(),/unconfirmed/);await page.locator('#step-facade').selectOption('4');await page.waitForFunction(()=>!__atlas.nav.flight);await page.locator('#step-month').fill('6');await page.locator('#step-month').dispatchEvent('input');assert.match(await page.locator('#step-sun').innerText(),/Direct sun possible/);await page.locator('#step-exit').click();
 assert.deepEqual(errors,[]);console.log('PASS: real facade placement, floor height, seasonal sun, rotation, restored map/focus, mobile, geometry failure');
}finally{await browser.close();}
