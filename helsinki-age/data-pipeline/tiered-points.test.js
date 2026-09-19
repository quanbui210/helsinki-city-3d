import test from 'node:test';
import assert from 'node:assert/strict';
import {tierWeights,clusterPoints} from '../viewer/src/tieredPoints.js';
import {parkingAggregate} from '../viewer/src/layers/parkingLayer.js';
test('tier weights crossfade without gaps',()=>{
  assert.deepEqual(tierWeights(4800),{area:1,cluster:0,point:0});
  assert.deepEqual(tierWeights(400),{area:0,cluster:0,point:1});
  for(let r=180;r<12000;r+=10){const w=tierWeights(r);assert.ok(Math.abs(w.area+w.cluster+w.point-1)<1e-8);for(const v of Object.values(w))assert.ok(v>=0&&v<=1);}
  assert.ok(tierWeights(2800).area>0&&tierWeights(2800).cluster>0);
  assert.ok(tierWeights(850).point>0&&tierWeights(850).cluster>0);
});
test('screen clusters conserve members and regroup after camera projection changes',()=>{
  const points=[{x:10,y:10},{x:20,y:20},{x:100,y:10}];const first=clusterPoints(points);
  assert.deepEqual(first.map(c=>c.count),[2,1]);assert.equal(first.reduce((s,c)=>s+c.members.length,0),3);
  assert.equal(clusterPoints(points.map(p=>({...p,x:p.x*.1}))).length,1);
});
test('density only covers occupied cells and counts segments, not capacities',()=>{
  const areas=parkingAggregate([{position:[25,60],capacity:300},{position:[25,60],capacity:null}]);
  assert.equal(areas.length,1);assert.equal(areas[0].count,2);assert.equal(areas[0].metric,2/80);assert.deepEqual(parkingAggregate([]),[]);
});
