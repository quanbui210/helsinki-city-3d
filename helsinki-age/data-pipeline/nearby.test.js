import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {distanceM,nearbyFor,insideCoverage} from '../viewer/src/nearby.js';
import {groupTransitStops} from '../viewer/src/NearbyPlaces.js';
import {curateLandmarks,landmarkType} from './landmarks.js';
test('nearest three are ordered, distances are geodesic, landmarks bounded, and empty inputs stay empty',()=>{
 const stops=[4,1,3,2].map(i=>({id:String(i),name:'Stop',type:'bus',code:'H'+i,position:[24.95,60.17+i*.001],lines:['Bus 1']}));
 const result=nearbyFor([24.95,60.17],stops,[{id:'far',position:[25,61],name:'Far',type:'museum'}]);assert.deepEqual(result.nearbyTransit.map(p=>p.id),['1','2','3']);assert.equal(result.nearbyLandmarks.length,0);assert.ok(Math.abs(distanceM([24.95,60.17],[24.95,60.18])-1112)<1);assert.deepEqual(nearbyFor([0,0],[],[]),{nearbyTransit:[],nearbyLandmarks:[]});assert.equal(insideCoverage([0,0],[24,60,25,61]),false);
});
test('curation excludes similarly named rentals and minor chapels; relation/node duplicates collapse',()=>{
 assert.equal(landmarkType({name:'Kiasma',amenity:'bicycle_rental'}),null);assert.equal(landmarkType({name:'Small chapel',amenity:'place_of_worship'}),null);
 const tags={name:'Kiasma',tourism:'gallery',wikidata:'Q11871262'};
 const list=curateLandmarks([{type:'node',id:1,lon:24.94,lat:60.17,tags},{type:'relation',id:2,center:{lon:24.94,lat:60.17},tags}],[24,60,25,61]);assert.equal(list.length,1);assert.equal(list[0].id,'osm:relation/2');
});
test('opposite-direction platforms collapse into one readable transit option',()=>{
 const grouped=groupTransitStops([
  {id:'a',name:'Hallituskatu',type:'tram',distanceM:90,lines:['Tram 7']},
  {id:'b',name:'Hallituskatu',type:'tram',distanceM:80,lines:['Tram 7','Tram 7H']},
  {id:'c',name:'Hallituskatu',type:'bus',distanceM:95,lines:['Bus 55']},
 ]);
 assert.equal(grouped.length,2);assert.equal(grouped[0].distanceM,80);assert.equal(grouped[0].platforms,2);assert.deepEqual(grouped[0].lines,['Tram 7','Tram 7H']);
});
test('all prepared buildings have three served stops and bounded landmark lists with provenance',()=>{
 const m=JSON.parse(fs.readFileSync('viewer/public/buildings-manifest.json')),d=JSON.parse(fs.readFileSync('viewer/public/nearby.json')),ids=new Set(d.stops.map(p=>p.id));
 assert.ok(d.stops.length>1000);assert.ok(d.landmarks.length>=10&&d.landmarks.length<=40);assert.ok(d.landmarks.some(p=>p.sourceName==='Mall of Tripla'));assert.ok(d.landmarks.some(p=>p.sourceName==='Helsinki'&&p.type==='station'));assert.ok(d.sources.transit.feed[0].feed_end_date);assert.ok(d.sources.landmarks.osmTimestamp);
 for(const r of m){assert.equal(r.nearbyTransit.length,3);assert.equal(new Set(r.nearbyTransit.map(p=>p.id)).size,3);assert.ok(r.nearbyTransit.every((p,i)=>ids.has(p.id)&&p.lines.length&&Number.isFinite(p.distanceM)&&(!i||p.distanceM>=r.nearbyTransit[i-1].distanceM)));assert.ok(r.nearbyLandmarks.every(p=>p.distanceM<=800));}
 for(const r of [m[0],m[Math.floor(m.length/2)],m.find(r=>r.geometrySource==='espoo-wfs')])assert.deepEqual({nearbyTransit:r.nearbyTransit,nearbyLandmarks:r.nearbyLandmarks},nearbyFor(r.position,d.stops,d.landmarks));
});
