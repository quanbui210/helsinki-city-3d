import test from 'node:test';
import assert from 'node:assert/strict';
import {parkingType,parkingLookup} from '../viewer/src/parkingData.js';
test('parking restrictions override numeric class and mixed permit rules remain explicit',()=>{
  assert.equal(parkingType({luokka:8,tyyppi:'Pysäköintikielto'}),null);
  assert.equal(parkingType({luokka:0,tyyppi:'Polkupyörä'}),null);
  assert.equal(parkingType({luokka:6}),'permitPaid');
  assert.equal(parkingType({luokka:8}),'permitTimed');
  assert.equal(parkingType({tyyppi:'Kuormauspaikka'}),'loading');
  assert.equal(parkingType({tyyppi:'Inva'}),'accessible');
  assert.equal(parkingType({luokka:99}),'unknown');
});
test('counts capacities within radius, handles cell boundaries and unknown capacities',()=>{
  const lookup=parkingLookup({residentZones:[],paidZones:[],spots:[{position:[24.9999,60],capacity:5,type:'metered'},{position:[25.001,60],capacity:null,type:'loading'},{position:[25.02,60],capacity:100,type:'metered'}]});
  const r=lookup([25,60]);assert.equal(r.nearbyParkingSpots,5);assert.equal(r.parkingMappedSegments,2);assert.equal(r.parkingUnknownCapacity,1);assert.deepEqual(r.parkingSpotBreakdown,{metered:5,loading:0});
  assert.equal(lookup([24,60]).parkingMappedSegments,0);assert.equal(lookup(null).paidZoneId,null);
});
test('zone membership respects holes instead of guessing nearest zone',()=>{
  const geometry={type:'Polygon',coordinates:[[[24,59],[26,59],[26,61],[24,61],[24,59]],[[24.9,59.9],[25.1,59.9],[25.1,60.1],[24.9,60.1],[24.9,59.9]]]};
  const lookup=parkingLookup({residentZones:[{id:'A',geometry}],paidZones:[],spots:[]});
  assert.equal(lookup([25,60]).residentZoneId,null);assert.equal(lookup([24.5,60]).residentZoneId,'A');assert.equal(lookup([27,60]).residentZoneId,null);
});
