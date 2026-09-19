import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {indexZones,noiseAt} from './noise.js';
import {useCategory,useCategories} from '../viewer/src/layers/useCategories.js';
import {energyColors} from '../viewer/src/layers/energyLayer.js';
import {selectedBand,bandColors} from '../viewer/src/layers/noiseLayer.js';
import {certificate,energyIndex,readBatchTable} from './energy.js';
const polygon=(rings,low=45,high=50)=>({type:'Feature',properties:{db_lo:low,db_hi:high},geometry:{type:'Polygon',coordinates:rings}});
const outer=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[2,2],[4,2],[4,4],[2,4],[2,2]];
test('Spatial join respects holes, boundaries, overlaps and open-ended bands',()=>{
 const zones=indexZones([polygon([outer,hole])]);
 assert.equal(noiseAt([3,3],zones),null);assert.equal(noiseAt([11,5],zones),null);
 assert.deepEqual(noiseAt([0,5],zones),{low:45,high:50});
 assert.deepEqual(noiseAt([5,5],indexZones([polygon([outer]),polygon([outer],75,null)])),{low:75,high:null});
 assert.throws(()=>indexZones([polygon([outer],null,50)]));
});
test('Use codes follow the documented classification and unknown is not Other',()=>{
 assert.equal(useCategory('039'),'residential');assert.equal(useCategory(39),'residential');
 assert.equal(useCategory('151'),'commercial');assert.equal(useCategory('531'),'civic');
 assert.equal(useCategory('691'),'industrial');assert.equal(useCategory('999'),'other');
 for(const code of ['',null,'000','1234','E01'])assert.equal(useCategory(code),null);
});
test('Combined is highest available band; missing values never become zero',()=>{
 assert.equal(selectedBand({noise:{road:null}},'combined'),null);
 assert.deepEqual(selectedBand({noise:{road:{low:45,high:50},tram:{low:60,high:65},rail:null}},'combined'),{low:60,high:65});
});
test('Noise presentation colors stay unique and skip the official luminance zigzag',()=>{
 const colors=Object.values(bandColors);
 assert.equal(new Set(colors).size,colors.length);
 assert.ok(!colors.includes('#9BFF00'));
 assert.ok(!colors.includes('#009B00'));
});
test('Energy and use presentation colors stay unique',()=>{
 assert.equal(new Set(energyColors).size,energyColors.length);
 assert.equal(new Set(useCategories.map(c=>c.color)).size,useCategories.length);
});
test('Energy certificates are validated and conflicting duplicates remain unknown',()=>{
 assert.equal(certificate({energiatehokkuusluokka:'A'}),null,'Do not mix older rating fields with the 2013 scheme');
 assert.equal(certificate({energiatod_luokka:'unknown'}),null);
 const a={energiatod_luokka:'A',energiatod_laatimispaiva:'2017-01-01',energiatod_viimeinen_voimassaolopaiva:'2027-01-01'};
 assert.equal(certificate(a).class,'A');
 const table={id:['same','same','same','valid'],attributes:[a,{...a,energiatod_luokka:'B'},a,a]};
 const index=energyIndex([table]);assert.equal(index.get('same'),null);assert.equal(index.get('valid').class,'A');
 assert.throws(()=>readBatchTable(Buffer.alloc(28)));
});
test('Prepared layers contain real joined records and complete source provenance',()=>{
 const m=JSON.parse(readFileSync('viewer/public/buildings-manifest.json'));
 const source=JSON.parse(readFileSync('viewer/public/layers.json'));
 assert.equal(new Set(m.map(b=>b.buildingId)).size,m.length);
 for(const mode of ['road','rail','metro','tram']){
  assert.ok(source.sources[mode].requests.length>0);assert.match(source.sources[mode].sha256,/^[a-f0-9]{64}$/);
  assert.equal(m.filter(b=>b.noise[mode]!==null).length,source.counts[mode]);
  for(const b of m){const band=b.noise[mode];if(band)assert.ok(source.bands.some(s=>s.low===band.low&&s.high===band.high));}
 }
 for(const b of m)assert.equal(b.useCategory,useCategory(b.useCode));
 assert.equal(m.filter(b=>b.energy).length,source.energy.matched);
 assert.ok(source.energy.sources.length>0);
 for(const b of m)if(b.energy){assert.match(b.energy.class,/^[A-G]$/);assert.equal(b.energy.scheme,'2013');}
});
