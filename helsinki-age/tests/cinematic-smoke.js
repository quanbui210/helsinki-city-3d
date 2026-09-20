import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import sharp from 'sharp';

const expectedFinal={x:-40,y:40,z:90};
const near=(a,b,tol=4)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=tol;

async function capture(page){
  // Cinematic view is a secondary action inside the "Full details" dialog
  // now; opening it closes the dialog itself (see BuildingPanel.closeDetail
  // in main.js's #cinematic-view handler) so the flythrough is unobstructed.
  await page.locator('#open-building-detail').click();
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.locator('#cinematic-view').click()]);
  await page.waitForFunction(()=>document.querySelector('#cinematic-view')?.getAttribute('aria-busy')!=='true');
  const path=await download.path();
  assert.ok(path,'download path');
  assert.match(download.suggestedFilename(),/helsinki-lens\.png/);
  return readFile(path);
}

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas,null,{timeout:90000});
  const first=await page.evaluate(()=>__atlas.manifest.filter(r=>r.address&&r.position).sort((a,b)=>Math.hypot(a.position[0]-24.95,a.position[1]-60.17)-Math.hypot(b.position[0]-24.95,b.position[1]-60.17))[0]);
  const second=await page.evaluate(()=>__atlas.manifest.filter(r=>r.address&&r.position).sort((a,b)=>Math.hypot(a.position[0]-24.95,a.position[1]-60.17)-Math.hypot(b.position[0]-24.95,b.position[1]-60.17))[8]);
  assert.notEqual(first.buildingId,second.buildingId);
  await page.evaluate(r=>__atlas.selectSearchResult({buildingId:r.buildingId,position:r.position,range:650}),first);
  await page.waitForFunction(()=>!__atlas.nav.flight);
  await page.locator('#open-building-detail').click();
  assert.equal(await page.locator('#cinematic-view').isVisible(),true);
  await page.locator('#cinematic-view').scrollIntoViewIfNeeded();
  await page.locator('#close-building-detail').click();
  const png1=await capture(page);
  assert.equal(png1[0],0x89);assert.equal(png1[1],0x50);assert.equal(png1[2],0x4e);assert.equal(png1[3],0x47);
  const offset1=await page.evaluate(pos=>__atlas.cinematic.localCameraOffset(__atlas.viewer,pos),first.position);
  assert.ok(near(offset1,expectedFinal),`first building final offset ${JSON.stringify(offset1)}`);
  const png2=await capture(page);
  const offset1b=await page.evaluate(pos=>__atlas.cinematic.localCameraOffset(__atlas.viewer,pos),first.position);
  assert.ok(near(offset1b,expectedFinal),`second run leftover state ${JSON.stringify(offset1b)}`);
  await page.evaluate(r=>__atlas.selectSearchResult({buildingId:r.buildingId,position:r.position,range:650}),second);
  await page.waitForFunction(()=>!__atlas.nav.flight);
  const png3=await capture(page);
  const offset2=await page.evaluate(pos=>__atlas.cinematic.localCameraOffset(__atlas.viewer,pos),second.position);
  assert.ok(near(offset2,expectedFinal),`second building used previous path ${JSON.stringify(offset2)}`);
  const worlds=await page.evaluate(records=>{
    const a=__atlas.viewer.camera.positionWC;
    return {second:{x:a.x,y:a.y,z:a.z},firstOrigin:records[0].position,secondOrigin:records[1].position};
  },[first,second]);
  assert.ok(Math.hypot(worlds.firstOrigin[0]-worlds.secondOrigin[0],worlds.firstOrigin[1]-worlds.secondOrigin[1])>0.0005);
  const meta=await sharp(png3).metadata();
  assert.equal(meta.format,'png');assert.ok(meta.width>400&&meta.height>300);
  const crop=await sharp(png3).extract({left:meta.width-220,top:meta.height-90,width:200,height:70}).stats();
  assert.ok(crop.channels[0].mean<90||crop.channels[1].stdev>8,'watermark strip should be visible in the bottom-right');
  await mkdir('artifacts/cinematic',{recursive:true});
  await sharp(png1).toFile('artifacts/cinematic/first.png');
  await sharp(png3).toFile('artifacts/cinematic/second.png');
  assert.ok(png1.length>20000&&png2.length>20000&&png3.length>20000);
  assert.deepEqual(errors,[]);
  console.log('PASS: cinematic still export, watermarked PNG, building-relative path, repeatable.');
}finally{await browser.close();}
