import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeBuildings,rayTriangle,rayDistance,facadePoint,floorDimensions,openness} from '../viewer/src/sightlineGeometry.js';
import {solarNoonPosition} from '../viewer/src/solarPosition.js';
test('triangle rays respect direction, misses and first obstruction',()=>{
 const a=[-2,-2,10],b=[2,-2,10],c=[0,2,10];assert.equal(rayTriangle([0,0,0],[0,0,1],a,b,c),10);assert.equal(rayTriangle([0,0,0],[0,0,-1],a,b,c),null);
 const geometry={id:'wall',min:[-2,-2,10],max:[2,2,10],triangles:Float32Array.from([...a,...b,...c])};assert.deepEqual(rayDistance([0,0,0],[0,0,1],[geometry]),{distance:10,hit:'wall'});assert.equal(rayDistance([20,0,0],[0,0,1],[geometry]).hit,null);
});
test('real generated tile decodes and facade origins lie outside their own wall',()=>{
 const bytes=fs.readFileSync('viewer/public/tileset/0-0.b3dm'),groups=decodeBuildings(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));assert.ok(groups.length>0);
 const g=groups[0],dim=floorDimensions(g,null);assert.equal(dim.maxFloor,8);assert.equal(dim.perFloor,3);
 const faces=Array.from({length:8},(_,i)=>facadePoint(g,i*Math.PI/4,dim.ground+1.5)).filter(Boolean);assert.ok(faces.length);for(const f of faces)assert.ok(rayDistance(f.origin,f.direction,[g],120).distance>.1);
});
test('Helsinki solar-noon seasonal altitude and azimuth conventions',()=>{
 const summer=solarNoonPosition(2026,6,[24.95,60.17]),winter=solarNoonPosition(2026,12,[24.95,60.17]);assert.ok(summer.altitude*180/Math.PI>50&&summer.altitude*180/Math.PI<55);assert.ok(winter.altitude*180/Math.PI>5&&winter.altitude*180/Math.PI<9);assert.ok(summer.direction[1]<-.5&&Math.abs(summer.direction[0])<.03);assert.ok(Math.abs(Math.hypot(...summer.direction)-1)<1e-9);
});
test('openness labels are capped qualitative summaries, not availability promises',()=>{assert.equal(openness([10,15,20]),'Faces another building closely');assert.equal(openness([35,40,60]),'Partially blocked');assert.equal(openness([90,120,1000]),'Mostly open');});
test('basement bases do not place the floor camera underground; invalid counts stay unconfirmed',()=>{
 const g={id:'basement',min:[0,-12,0],max:[10,24,10]},near=[{id:'neighbor',min:[20,4,0],max:[30,25,10]}];
 const d=floorDimensions(g,4,near);assert.equal(d.ground,4);assert.equal(d.perFloor,5);assert.equal(d.groundEstimated,true);assert.equal(floorDimensions(g,0,near).maxFloor,8);
});
test('real Esplanadi park-facing and enclosed facades separate qualitatively',()=>{
 const manifest=JSON.parse(fs.readFileSync('viewer/public/buildings-manifest.json')),r=manifest.find(r=>r.address==='Pohjoisesplanadi 21');
 const tiles=JSON.parse(fs.readFileSync('viewer/public/tileset/tileset.json')),groups=[];
 for(const tile of tiles.root.children){const b=tile.boundingVolume.box;if(Math.hypot(b[0]+1300,b[1]+1700)>2300)continue;const bytes=fs.readFileSync('viewer/public/tileset/'+tile.content.uri);groups.push(...decodeBuildings(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));}
 const g=groups.find(g=>g.id===r.buildingId),height=floorDimensions(g,r.floorCount,groups).ground+1.5;
 const label=angle=>{const f=facadePoint(g,angle,height);return openness(Array.from({length:7},(_,i)=>{const a=f.angle+(i-3)*Math.PI/9;return rayDistance(f.origin,[Math.sin(a),0,-Math.cos(a)],groups,120).distance;}));};
 assert.equal(label(Math.PI),'Mostly open');assert.equal(label(0),'Faces another building closely');
});
