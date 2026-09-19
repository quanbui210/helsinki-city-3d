import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();let calls=0;
 await page.route('**/api/listings',async route=>{calls++;const {address}=route.request().postDataJSON();if(address==='Slow 1')await new Promise(r=>setTimeout(r,1300));await route.fulfill({json:{checkedAt:Date.now(),portals:['oikotie','etuovi','sato','lumo','vuokraovi'].map(portal=>({portal,status:'ok',results:portal==='etuovi'?[{title:address,snippet:'Search match',url:'https://www.etuovi.com/example'}]:[]}))}}).catch(()=>{});});
 const setup=async()=>{await page.goto('http://localhost:5173/');await page.evaluate(async()=>{const {ListingSearch}=await import('/src/ui/ListingSearch.js');const root=document.createElement('div');document.body.append(root);window.searchTest=new ListingSearch(root);window.testRoot=root;window.selectTest=address=>searchTest.show({address,city:'Helsinki'});});};
 await setup();await page.evaluate(()=>{for(let i=0;i<6;i++)selectTest(`Rapid ${i}`);searchTest.close();});await page.waitForTimeout(650);assert.equal(calls,0);
 await page.evaluate(()=>selectTest('Fast 1'));await page.waitForTimeout(200);assert.equal(calls,0);await page.waitForFunction(()=>testRoot.textContent.includes('View listing'));assert.equal(calls,1);
 await page.evaluate(()=>{searchTest.close();selectTest(' fast   1 ');});assert.match(await page.evaluate(()=>testRoot.textContent),/View listing/);assert.equal(calls,1);
 await setup();await page.evaluate(()=>selectTest('Fast 1'));assert.match(await page.evaluate(()=>testRoot.textContent),/View listing/);assert.equal(calls,1);
 await page.evaluate(()=>selectTest('Slow 1'));await page.waitForTimeout(600);await page.evaluate(()=>selectTest('Next 2'));await page.waitForFunction(()=>testRoot.querySelector('strong')?.textContent==='Next 2');await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>testRoot.querySelector('strong').textContent),'Next 2');
 const before=calls;await page.evaluate(async()=>{const {requestListings}=await import('/src/listingCache.js');const {listingAddress}=await import('/src/listingPortals.js');const a=listingAddress({address:'Duplicate 3',city:'Helsinki'});const x=requestListings(a),y=requestListings(a);if(x.promise!==y.promise)throw Error('Promises differ');await x.promise;});assert.equal(calls,before+1);
 await page.evaluate(()=>localStorage.clear());await setup();await page.evaluate(()=>selectTest('Fast 1'));await page.waitForFunction(()=>testRoot.textContent.includes('View listing'));assert.equal(calls,before+2);
 await page.evaluate(()=>{for(const key of Object.keys(localStorage)){if(key.startsWith('helsinki-lens:listings:')){const entry=JSON.parse(localStorage[key]);entry.timestamp=Date.now()-86400001;localStorage[key]=JSON.stringify(entry);}}});await setup();await page.evaluate(()=>selectTest('Fast 1'));await page.waitForFunction(()=>testRoot.textContent.includes('View listing'));assert.equal(calls,before+3);
 console.log('PASS: debounce cancellation, synchronous cache, reload persistence, TTL, cleared cache, deduplicated promises and stale-response protection');
}finally{await browser.close();}
