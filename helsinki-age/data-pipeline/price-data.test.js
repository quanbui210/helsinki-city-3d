import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cell,changeQoQ} from './price-data.js';
import {spatialIndex,createAreaLookup} from '../viewer/src/areaData.js';

test('JSON-stat selection honors dimension order, sparse suppression and leading-zero postcodes',()=>{
  const d={id:['area','period'],size:[2,2],dimension:{area:{category:{index:{'00100':1,'00200':0}}},period:{category:{index:['2025Q4','2026Q1']}}},value:{0:100,2:200,3:220}};
  assert.equal(cell(d,{area:'00100',period:'2026Q1'}),220);
  assert.equal(cell(d,{area:'00200',period:'2026Q1'}),null);
  assert.equal(cell(d,{area:'00300',period:'2026Q1'}),null);
  assert.equal(changeQoQ(220,200,'2026Q1','2025Q4'),10);
  assert.equal(changeQoQ(null,200,'2026Q1','2025Q4'),null);
  assert.equal(changeQoQ(220,0,'2026Q1','2025Q4'),null);
  assert.equal(changeQoQ(220,200,'2026Q1','2025Q3'),null);
});
test('point joins respect polygon holes, multipolygons and absent geometry',()=>{
  const area={geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[5,0],[5,5],[0,5],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]],[[[10,10],[11,10],[11,11],[10,11],[10,10]]]]}};
  const find=spatialIndex([area,{geometry:null}]);
  assert.equal(find([3,3]),area);assert.equal(find([1.5,1.5]),null);assert.equal(find([10.5,10.5]),area);assert.equal(find([20,20]),null);assert.equal(find(undefined),null);
});
test('prepared prices retain provenance, real coverage and suppressed values',async()=>{
  const data=JSON.parse(await readFile(new URL('../viewer/public/price-by-area.json',import.meta.url),'utf8'));
  assert.equal(data.metadata.sale.boundaryYear,2022);assert.equal(data.metadata.rent.boundaryYear,2018);
  assert.equal(new Set(data.areas.map(a=>a.postalCode)).size,data.areas.length);
  assert.ok(data.areas.some(a=>a.avgSalePricePerSqm===null));assert.ok(data.areas.some(a=>a.avgRentPerSqm===null));
  const lookup=createAreaLookup(data);assert.equal(lookup.sale([24.941,60.169]).postalCode,'00100');
  assert.equal(lookup.rent([24.941,60.169]).postalCode,'00100');
  assert.equal(lookup.sale([0,0]),null);
  for(const a of data.areas){assert.match(a.postalCode,/^\d{5}$/);if(a.avgSalePricePerSqm===null)assert.equal(a.priceChangeQoQ,null);if(a.avgRentPerSqm===null)assert.equal(a.rentChangeQoQ,null);}
});
