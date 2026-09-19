import earcut from 'earcut';
import {NS,nodes} from './lib.js';
export function ringPoints(ring) {
  const list = nodes(ring,'gml','posList')[0];
  const numbers = (list ? list.textContent : nodes(ring,'gml','pos').map(n=>n.textContent).join(' ')).trim().split(/\s+/).map(Number);
  if (numbers.length%3 || numbers.some(n=>!Number.isFinite(n))) throw new Error('Invalid 3D coordinates');
  const points=[];for(let i=0;i<numbers.length;i+=3) points.push(numbers.slice(i,i+3));
  if (points.length>1 && points[0].every((v,i)=>Math.abs(v-points.at(-1)[i])<1e-7)) points.pop();
  return points;
}
export function triangulate(rings) {
  if (!rings.length || rings[0].length<3) return [];
  // Project onto the dominant plane; earcut preserves interior courtyard/window holes.
  const normal=[0,0,0], outer=rings[0];
  for(let i=0;i<outer.length;i++) {const a=outer[i],b=outer[(i+1)%outer.length];normal[0]+=(a[1]-b[1])*(a[2]+b[2]);normal[1]+=(a[2]-b[2])*(a[0]+b[0]);normal[2]+=(a[0]-b[0])*(a[1]+b[1]);}
  const drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const axes=[0,1,2].filter(a=>a!==drop), origin=outer[0];
  const points=rings.flat(), holes=[];let offset=outer.length;
  for (const ring of rings.slice(1)){holes.push(offset);offset+=ring.length;}
  const flat=points.flatMap(p=>axes.map(a=>p[a]-origin[a]));
  const indices=earcut(flat,holes,2), result=[];
  for(let i=0;i<indices.length;i+=3) result.push(indices.slice(i,i+3).map(j=>points[j]));
  return result;
}
function ancestorName(node, names) {
  for (let n = node; n; n = n.parentNode) if (names.has(n.localName)) return n.localName;
}
function hrefId(node) {
  const href = node.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') || node.getAttribute('xlink:href') || node.getAttribute('href');
  return href ? href.replace(/^#/, '') : null;
}
export function buildingTriangles(building) {
  const installation = new Set(['BuildingInstallation', 'outerBuildingInstallation', 'interiorBuildingInstallation']);
  const polygons = nodes(building, 'gml', 'Polygon').filter(p => !ancestorName(p, installation));
  const byId = new Map(polygons.map(p => [p.getAttributeNS(NS.gml, 'id') || p.getAttribute('gml:id'), p]).filter(([id]) => id));
  const lodOf = polygon => {
    const name = ancestorName(polygon, new Set(['lod1Solid', 'lod1MultiSurface', 'lod2Solid', 'lod2MultiSurface', 'lod3Solid', 'lod3MultiSurface', 'lod4Solid', 'lod4MultiSurface']));
    return name ? Number(name[3]) : 0;
  };
  const referenced = [];
  for (const solid of nodes(building, 'bldg', 'lod2Solid')) {
    if (ancestorName(solid, installation)) continue;
    for (const member of nodes(solid, 'gml', 'surfaceMember')) {
      const id = hrefId(member);
      if (id && byId.has(id)) referenced.push(byId.get(id));
    }
  }
  const selected = referenced.length ? referenced : polygons;
  const lod = referenced.length ? 2 : Math.max(0, ...selected.map(lodOf));
  const source = referenced.length ? referenced : selected.filter(p => lodOf(p) === lod);
  const triangles = [];
  for (const p of source) {
    const rings = nodes(p, 'gml', 'LinearRing').map(ringPoints);
    triangles.push(...triangulate(rings));
  }
  return {triangles, lod};
}
const pad = (buffer, alignment=8, fill=0) => Buffer.concat([buffer, Buffer.alloc((alignment-buffer.length%alignment)%alignment,fill)]);
export function encodeB3dm(positions,normals,batchIds,records) {
  const pos=Buffer.from(new Float32Array(positions).buffer), norm=Buffer.from(new Float32Array(normals).buffer), ids=Buffer.from(new Float32Array(batchIds).buffer);
  const binary=Buffer.concat([pos,norm,ids]);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++){const a=i%3;min[a]=Math.min(min[a],positions[i]);max[a]=Math.max(max[a],positions[i]);}
  const gltf={asset:{version:'2.0',generator:'Helsinki Age deterministic CityGML converter'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,_BATCHID:2},material:0}]}],materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.85}}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:pos.length,target:34962},{buffer:0,byteOffset:pos.length,byteLength:norm.length,target:34962},{buffer:0,byteOffset:pos.length+norm.length,byteLength:ids.length,target:34962}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:'VEC3',min,max},{bufferView:1,componentType:5126,count:normals.length/3,type:'VEC3'},{bufferView:2,componentType:5126,count:batchIds.length,type:'SCALAR',min:[0],max:[records.length-1]}]};
  const json=pad(Buffer.from(JSON.stringify(gltf)),4,0x20),bin=pad(binary,4);
  const glbHeader=Buffer.alloc(20);glbHeader.write('glTF');glbHeader.writeUInt32LE(2,4);glbHeader.writeUInt32LE(28+json.length+bin.length,8);glbHeader.writeUInt32LE(json.length,12);glbHeader.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const glb=pad(Buffer.concat([glbHeader,json,binHeader,bin]));
  const ftRaw=Buffer.from(JSON.stringify({BATCH_LENGTH:records.length}));
  const ft=Buffer.concat([ftRaw,Buffer.alloc((8-(28+ftRaw.length)%8)%8,0x20)]);
  const keys=['buildingId','ratu','constructionYear','address','purpose','joinStatus','lod'];
  const bt=pad(Buffer.from(JSON.stringify(Object.fromEntries(keys.map(key=>[key,records.map(r=>r[key]??null)])))),8,0x20);
  const header=Buffer.alloc(28);header.write('b3dm');header.writeUInt32LE(1,4);header.writeUInt32LE(28+ft.length+bt.length+glb.length,8);header.writeUInt32LE(ft.length,12);header.writeUInt32LE(bt.length,20);
  return Buffer.concat([header,ft,bt,glb]);
}
