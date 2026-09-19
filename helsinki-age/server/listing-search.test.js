import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createListingSearch,listingMiddleware} from './listing-search.js';
import {listingPortals,listingAddress,listingQuery,safeListingUrl} from '../viewer/src/listingPortals.js';
const address={address:'Meritullinkatu 13',city:'Helsinki',postalCode:'00170'};
const fake=(calls)=>async(url,options)=>{
  calls.push({url:new URL(url),options});const domain=new URL(url).searchParams.get('q').split('site:')[1];
  return {ok:true,json:async()=>({web:{results:[{title:'Exact title',description:'Exact snippet €1,200, not extracted.',url:`https://${domain}/example`,thumbnail:{src:'must not survive'}},{title:'Wrong domain',description:'Bad',url:'https://evil.test/page'},{title:'No snippet',url:`https://${domain}/other`}]}})};
};
test('five scoped queries, unmodified snippets, no portal requests, bounded response fields',async()=>{
  const calls=[],service=createListingSearch({apiKey:'test-secret',storageAllowed:true,fetchImpl:fake(calls),spacing:0});
  const r=await service.search(address,'client');assert.equal(r.status,200);assert.equal(calls.length,5);
  calls.forEach((call,i)=>{assert.equal(call.url.origin,'https://api.search.brave.com');assert.equal(call.url.searchParams.get('q'),listingQuery(listingAddress(address),listingPortals[i]));assert.equal(call.options.headers['X-Subscription-Token'],'test-secret');assert.equal(call.options.redirect,'error');});
  r.body.portals.forEach(p=>{assert.equal(p.results.length,1);assert.deepEqual(Object.keys(p.results[0]).sort(),['portal','snippet','title','url']);assert.equal(p.results[0].snippet,'Exact snippet €1,200, not extracted.');});
  assert.equal((await service.search({...address,address:'  MERITULLINKATU   13  '},'other')).body.cached,true);assert.equal(calls.length,5);
});
test('cache expires, requires storage rights, and simultaneous requests deduplicate',async()=>{
  let time=0;const calls=[],service=createListingSearch({apiKey:'key',storageAllowed:true,fetchImpl:fake(calls),spacing:0,now:()=>time});
  await Promise.all([service.search(address,'a'),service.search(address,'b')]);assert.equal(calls.length,5);
  time=86400000;await service.search(address,'a');assert.equal(calls.length,10);
  const uncached=createListingSearch({apiKey:'key',storageAllowed:false,fetchImpl:fake(calls),spacing:0});
  await uncached.search(address,'a');await uncached.search(address,'a');assert.equal(calls.length,20);
});
test('missing credentials, errors and cost caps never claim empty results',async()=>{
  assert.equal((await createListingSearch({apiKey:''}).search(address,'a')).body.error,'not_configured');
  let calls=0;const failed=createListingSearch({apiKey:'key',spacing:0,fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
  const r=await failed.search(address,'a');assert.equal(calls,1);assert.ok(r.body.portals.every(p=>p.status==='unavailable'));
  const capped=createListingSearch({apiKey:'key',dailyLimit:1,spacing:0,fetchImpl:fake([])});
  await capped.search(address,'a');assert.equal((await capped.search({...address,address:'Other Street 2'},'b')).status,429);
});
test('query input and result URL validation reject injected operators and unsafe hosts',()=>{
  assert.equal(listingAddress({...address,address:'street 1" site:evil.test'}),null);
  assert.equal(listingAddress({...address,city:'Paris'}),null);
  for(const url of ['javascript:alert(1)','https://oikotie.fi.evil.test/a','https://evil.test/oikotie.fi','https://user@oikotie.fi/'])assert.equal(safeListingUrl(url,'oikotie.fi'),null);
  assert.ok(safeListingUrl('https://asunnot.oikotie.fi/a','oikotie.fi'));
});
test('HTTP endpoint rejects foreign origins and returns JSON without a key',async()=>{
  const api=listingMiddleware(createListingSearch({apiKey:''}));const server=createServer((req,res)=>api(req,res,()=>{res.writeHead(404);res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const request={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(address)};
    let r=await fetch(base+'/api/listings',request);assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).error,'not_configured');
    r=await fetch(base+'/api/listings',{...request,headers:{...request.headers,Origin:'https://elsewhere.test'}});assert.equal(r.status,403);
    r=await fetch(base+'/api/listings');assert.equal(r.status,405);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
