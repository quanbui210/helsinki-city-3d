import test from 'node:test';
import assert from 'node:assert/strict';
import {foundationMiddleware} from './foundation.js';
const invoke=(middleware,url,method='GET')=>new Promise(resolve=>middleware({url,method},{writeHead(status,headers){this.status=status;this.headers=headers;},end(body){resolve({status:this.status,headers:this.headers,body});}},()=>resolve({next:true})));
test('aerial proxy keeps credentials server-side and deduplicates cached requests',async()=>{
  let calls=0;const middleware=foundationMiddleware({apiKey:'test-secret',fetchImpl:async url=>{calls++;assert.equal(url.searchParams.get('api-key'),'test-secret');assert.match(url.pathname,/ortokuva\/default\/WGS84_Pseudo-Mercator\/12\/1185\/2331.jpg/);return new Response(new Uint8Array([255,216,255]));}});
  const results=await Promise.all([invoke(middleware,'/api/foundation/aerial/12/2331/1185.jpg'),invoke(middleware,'/api/foundation/aerial/12/2331/1185')]);
  assert.equal(calls,1);assert.ok(results.every(r=>r.status===200));assert.equal(JSON.stringify(results).includes('test-secret'),false);
  assert.equal((await invoke(middleware,'/api/foundation/aerial/19/1/1')).status,400);
  assert.equal((await invoke(middleware,'/api/foundation/context/../../secrets')).status,404);
  assert.equal((await invoke(middleware,'/api/foundation/aerial/12/0/0.jpg')).status,404);
});
test('missing key and upstream errors return bounded neutral responses',async()=>{
 const missing=foundationMiddleware({apiKey:''});assert.equal((await invoke(missing,'/api/foundation/aerial/12/2331/1185.jpg')).status,503);
 const failed=foundationMiddleware({apiKey:'test-secret',fetchImpl:async()=>{throw Error('credential URL');}});const r=await invoke(failed,'/api/foundation/aerial/12/2331/1185.jpg');assert.equal(r.status,502);assert.equal(r.body,'{}');
});
