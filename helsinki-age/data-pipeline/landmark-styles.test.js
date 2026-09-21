import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchLandmarkStyles} from './landmark-styles.js';

function tileMetadata(file){
 const buffer=fs.readFileSync(`viewer/public/tileset/${file}`),ft=buffer.readUInt32LE(12),bt=buffer.readUInt32LE(20),glb=28+ft+bt,jsonLength=buffer.readUInt32LE(glb+12);
 return {table:JSON.parse(buffer.toString('utf8',28+ft,28+ft+bt).trim()),gltf:JSON.parse(buffer.toString('utf8',glb+20,glb+20+jsonLength))};
}

test('curated destination matching is bounded and reproducible',()=>{
 const manifest=JSON.parse(fs.readFileSync('viewer/public/buildings-manifest.json')),nearby=JSON.parse(fs.readFileSync('viewer/public/nearby.json'));
 const matches=matchLandmarkStyles(manifest,nearby.landmarks);
 assert.deepEqual(matches.map(match=>match.landmarkName).sort(),['Bolt Arena','Espoo Metro Areena','Helsinki Cathedral','Helsinki Icehall','Helsinki Olympic Stadium','Veikkaus Arena']);
 assert.equal(matches.filter(match=>match.landmarkStyle==='stadium').length,5);
 assert.ok(matches.every(match=>match.distanceM<=(match.landmarkStyle==='stadium'?45:20)));
});

test('prepared tiles expose per-vertex style IDs and per-feature landmark identity',()=>{
 const manifest=JSON.parse(fs.readFileSync('viewer/public/buildings-manifest.json')),styled=manifest.filter(record=>record.landmarkStyle);
 assert.equal(styled.length,6);assert.equal(new Set(styled.map(record=>record.landmarkId)).size,6);
 for(const file of new Set(styled.map(record=>record.tileContentUri))){
  const {table,gltf}=tileMetadata(file),attribute=gltf.meshes[0].primitives[0].attributes._STYLEID;
  assert.ok(Number.isInteger(attribute));assert.equal(gltf.accessors[attribute].componentType,5121);assert.equal(gltf.accessors[attribute].count,gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION].count);
  for(const record of styled.filter(record=>record.tileContentUri===file)){assert.equal(table.landmarkStyle[record.tileFeatureId],record.landmarkStyle);assert.equal(table.landmarkName[record.tileFeatureId],record.landmarkName);}
 }
});
