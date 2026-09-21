import {readFile,readdir,writeFile} from 'node:fs/promises';
import {landmarkStyleId,matchLandmarkStyles} from './landmark-styles.js';

const PUBLIC='viewer/public/',pad=(buffer,alignment=4,fill=0)=>Buffer.concat([buffer,Buffer.alloc((alignment-buffer.length%alignment)%alignment,fill)]);

function encodeGlb(gltf,binary){
 const json=pad(Buffer.from(JSON.stringify(gltf)),4,0x20),bin=pad(binary,4);
 const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
 return pad(Buffer.concat([header,json,binHeader,bin]),8);
}
function patchTile(buffer,records){
 if(buffer.toString('ascii',0,4)!=='b3dm'||buffer.readUInt32LE(8)!==buffer.length)throw Error('Invalid B3DM');
 const ftJsonLength=buffer.readUInt32LE(12),ftBinLength=buffer.readUInt32LE(16),btJsonLength=buffer.readUInt32LE(20),btBinLength=buffer.readUInt32LE(24);
 if(ftBinLength||btBinLength)throw Error('Unsupported binary feature or batch table');
 const ft=buffer.subarray(28,28+ftJsonLength),btOffset=28+ftJsonLength;
 const table=JSON.parse(buffer.toString('utf8',btOffset,btOffset+btJsonLength).trim());
 const glbOffset=btOffset+btJsonLength,glb=buffer.subarray(glbOffset),jsonLength=glb.readUInt32LE(12),jsonOffset=20;
 const gltf=JSON.parse(glb.toString('utf8',jsonOffset,jsonOffset+jsonLength));
 const binHeaderOffset=jsonOffset+jsonLength,binLength=glb.readUInt32LE(binHeaderOffset),binOffset=binHeaderOffset+8;
 let binary=Buffer.from(glb.subarray(binOffset,binOffset+binLength)),attribute=gltf.meshes[0].primitives[0].attributes._STYLEID;
 const batchAccessor=gltf.accessors[gltf.meshes[0].primitives[0].attributes._BATCHID],batchView=gltf.bufferViews[batchAccessor.bufferView],count=batchAccessor.count;
 if(batchAccessor.componentType!==5126||batchAccessor.type!=='SCALAR')throw Error('Unsupported batch ID encoding');
 const batchIds=new Float32Array(binary.buffer,binary.byteOffset+(batchView.byteOffset||0),count);
 const styles=Buffer.from(Uint8Array.from(batchIds,id=>landmarkStyleId(records[id]?.landmarkStyle)));
 if(attribute===undefined){
  const offset=pad(binary,4).length;binary=Buffer.concat([pad(binary,4),styles]);
  const view=gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:styles.length,target:34962})-1;
  attribute=gltf.accessors.push({bufferView:view,componentType:5121,count,type:'SCALAR',min:[0],max:[2]})-1;
  gltf.meshes[0].primitives[0].attributes._STYLEID=attribute;
 }else{
  const accessor=gltf.accessors[attribute],view=gltf.bufferViews[accessor.bufferView],offset=view.byteOffset||0;
  if(accessor.count!==count||offset+view.byteLength!==gltf.buffers[0].byteLength)throw Error('Unexpected existing style attribute');
  binary=Buffer.concat([binary.subarray(0,offset),styles]);view.byteLength=styles.length;accessor.componentType=5121;
 }
 gltf.buffers[0].byteLength=binary.length;
 for(const key of ['landmarkStyle','landmarkName','landmarkId'])table[key]=records.map(record=>record?.[key]??null);
 const bt=pad(Buffer.from(JSON.stringify(table)),8,0x20),outGlb=encodeGlb(gltf,binary);
 const header=Buffer.alloc(28);header.write('b3dm');header.writeUInt32LE(1,4);header.writeUInt32LE(28+ft.length+bt.length+outGlb.length,8);header.writeUInt32LE(ft.length,12);header.writeUInt32LE(bt.length,20);
 return Buffer.concat([header,ft,bt,outGlb]);
}

const nearby=JSON.parse(await readFile(`${PUBLIC}nearby.json`,'utf8'));
const manifests=['data-pipeline/buildings-manifest.json',`${PUBLIC}buildings-manifest.json`];
const manifest=JSON.parse(await readFile(manifests[1],'utf8'));
for(const record of manifest){delete record.landmarkStyle;delete record.landmarkName;delete record.landmarkId;}
const matches=matchLandmarkStyles(manifest,nearby.landmarks),byId=new Map(matches.map(match=>[match.buildingId,match]));
for(const record of manifest){const match=byId.get(record.buildingId);if(match)Object.assign(record,{landmarkStyle:match.landmarkStyle,landmarkName:match.landmarkName,landmarkId:match.landmarkId});}
const byTile=new Map();
for(const record of manifest){if(!byTile.has(record.tileContentUri))byTile.set(record.tileContentUri,[]);byTile.get(record.tileContentUri)[record.tileFeatureId]=record;}
for(const file of (await readdir(`${PUBLIC}tileset`)).filter(file=>file.endsWith('.b3dm'))){
 const records=byTile.get(file);if(!records)throw Error(`No manifest records for ${file}`);
 if(records.some(record=>!record))throw Error(`Non-contiguous feature IDs in ${file}`);
 await writeFile(`${PUBLIC}tileset/${file}`,patchTile(await readFile(`${PUBLIC}tileset/${file}`),records));
}
for(const path of manifests)await writeFile(path,JSON.stringify(manifest,null,path.startsWith('data-pipeline')?2:0));
await writeFile(`${PUBLIC}landmark-styles.json`,JSON.stringify({styles:{stadium:1,cathedral:2},matches,source:{landmarks:'/nearby.json',method:'nearest curated landmark to official modeled-building center',maximumDistanceM:{stadium:45,cathedral:20}},notes:['Styles identify a curated first set of destinations; they do not infer every stadium or church.','Official CityGML geometry is retained. Materials and illumination are interpretive.']},null,2));
console.log(`Styled ${matches.filter(match=>match.landmarkStyle==='stadium').length} stadiums and ${matches.filter(match=>match.landmarkStyle==='cathedral').length} cathedral.`);
