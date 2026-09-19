import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAddress,addressItems,searchPlaces} from '../viewer/src/ui/AddressSearch.js';
test('Official address matching supports Swedish aliases without inventing a nearby building join',()=>{
 const addresses=[{name:'Hämeentie 1',alias:'Tavastvägen 1',position:[25,60]},{name:'Hämeentie 2',alias:'Tavastvägen 2',position:[25,60]}];
 const items=addressItems(addresses,[{buildingId:'real',address:'Hämeentie 1',position:[25,60],constructionYear:1900}],{neighborhoods:[],labels:[]});
 assert.equal(searchPlaces(items,'tavastvagen 1')[0].buildingId,'real');
 assert.equal(searchPlaces(items,'Hameentie 2')[0].buildingId,undefined);
 assert.equal(normalizeAddress(' HÄMEENTIE   1 '),'hameentie 1');
 assert.deepEqual(searchPlaces(items,'no such street'),[]);
});
test('Prepared geocoder has official points, provenance and complete count',()=>{
 const a=JSON.parse(readFileSync('viewer/public/search/addresses.json'));
 const source=JSON.parse(readFileSync('viewer/public/search/source.json'));
 assert.equal(a.length,source.records);assert.ok(a.length>50000);assert.ok(source.requests.length>1);
 assert.equal(new Set(a.map(v=>v.id)).size,a.length);
 for(const address of a){assert.ok(address.name);assert.equal(address.position.length,2);assert.ok(address.position.every(Number.isFinite));}
});
