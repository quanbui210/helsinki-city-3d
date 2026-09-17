import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import proj4 from 'proj4';
import {Cartesian3,Matrix4,Transforms} from 'cesium';
import {RAW,PUBLIC,ROOT,BBOX,PROJECTION} from './config.js';
import {uniqueBuildingBlocks,parseBuilding} from './lib.js';
import {buildingTriangles,encodeB3dm} from './geometry.js';
const manifest=JSON.parse(await readFile(`${ROOT}data-pipeline/buildings-manifest.json`,'utf8'));
const byId=new Map(manifest.map(r=>[r.buildingId,r]));
const projection=proj4(PROJECTION,'EPSG:4326');
const center=projection.forward([(BBOX[0]+BBOX[2])/2,(BBOX[1]+BBOX[3])/2]);
const origin=Cartesian3.fromDegrees(...center,0), transform=Transforms.eastNorthUpToFixedFrame(origin), inverse=Matrix4.inverseTransformation(transform,new Matrix4());
const xml=await readFile(`${RAW}central.gml`,'utf8');
for(const match of xml.matchAll(/srsName="([^"]+)"/g)) if(!match[1].includes('3879')) throw Error('Unsupported source CRS: '+match[1]);
const groups=new Map();
for(const block of uniqueBuildingBlocks(xml)){
 const lo=block.match(/<gml:lowerCorner>(.*?)<\/gml:lowerCorner>/)[1].trim().split(/\s+/).map(Number),hi=block.match(/<gml:upperCorner>(.*?)<\/gml:upperCorner>/)[1].trim().split(/\s+/).map(Number);
 const point=lo.map((v,i)=>(v+hi[i])/2),key=`${Math.floor((point[0]-BBOX[0])/1000)}-${Math.floor((point[1]-BBOX[1])/1000)}`;
 if(!groups.has(key))groups.set(key,[]);groups.get(key).push({block,point,top:hi[2]});
}
await mkdir(`${PUBLIC}tileset`,{recursive:true});
const records=[],children=[];let tileBytes=0,totalTriangles=0;
const allMin=[Infinity,Infinity,Infinity],allMax=[-Infinity,-Infinity,-Infinity];
const box=(lo,hi)=>{const mid=lo.map((v,i)=>(v+hi[i])/2),h=lo.map((v,i)=>(hi[i]-v)/2+1);return [...mid,h[0],0,0,0,h[1],0,0,0,h[2]];};
for(const [key,entries] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
 const positions=[],normals=[],batchIds=[],tileRecords=[];
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 function local(p){const [lon,lat]=projection.forward(p.slice(0,2));const v=Matrix4.multiplyByPoint(inverse,Cartesian3.fromDegrees(lon,lat,p[2]),new Cartesian3());[v.x,v.y,v.z].forEach((a,i)=>{min[i]=Math.min(min[i],a);max[i]=Math.max(max[i],a);allMin[i]=Math.min(allMin[i],a);allMax[i]=Math.max(allMax[i],a)});return [v.x,v.z,-v.y];}
 const tileContentUri=`${key}.b3dm`;
 for(const {block,point,top} of entries){
  const id=block.match(/gml:id="([^"]+)"/)[1],record=byId.get(id);if(!record)throw Error(`Missing manifest ${id}`);
  const {triangles,lod}=buildingTriangles(parseBuilding(block));if(!triangles.length)throw Error(`No geometry ${id}`);
  const featureId=tileRecords.length;
  for(const triangle of triangles){const p=triangle.map(local),a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);if(length<1e-10)continue;for(const v of p){positions.push(...v);normals.push(...n.map(v=>v/length));batchIds.push(featureId);}}
  const result={...record,tileFeatureId:featureId,tileContentUri,lod,position:[...projection.forward(point.slice(0,2)),top]};tileRecords.push(result);records.push(result);
 }
 const tile=encodeB3dm(positions,normals,batchIds,tileRecords);tileBytes+=tile.length;totalTriangles+=positions.length/9;
 await writeFile(`${PUBLIC}tileset/${tileContentUri}`,tile);
 children.push({boundingVolume:{box:box(min,max)},geometricError:0,content:{uri:tileContentUri}});
 console.log(`Tile ${key}: ${tileRecords.length} buildings; ${(tile.length/1048576).toFixed(1)} MB`);
}
const tileset={asset:{version:'1.0',gltfUpAxis:'Y',copyright:'City of Helsinki, CC BY 4.0'},geometricError:4000,root:{boundingVolume:{box:box(allMin,allMax)},transform:Array.from(transform),geometricError:500,refine:'ADD',children}};
await writeFile(`${PUBLIC}tileset/tileset.json`,JSON.stringify(tileset));
await writeFile(`${ROOT}data-pipeline/buildings-manifest.json`,JSON.stringify(records,null,2));await writeFile(`${PUBLIC}buildings-manifest.json`,JSON.stringify(records));
const provenance=JSON.parse(await readFile(`${RAW}provenance.json`,'utf8')),report=JSON.parse(await readFile(`${RAW}join-report.json`,'utf8')),years=records.map(b=>b.constructionYear).filter(y=>y!==null);
const summary={...provenance,...report,center,minYear:Math.min(...years),maxYear:Math.max(...years),tileBytes,tiles:children.length,triangles:totalTriangles,lods:Object.fromEntries([1,2].map(l=>[l,records.filter(r=>r.lod===l).length])),notes:['Geometry snapshot: 26 March 2019; partial central/eastern coverage, not all Helsinki.','Completion dates from the current building register, joined by RATU.','Unknown-year buildings remain visible; historical demolished buildings are not reconstructed.','Source N2000 heights retained without a geoid conversion; no surveyed terrain or textures.']};
await writeFile(`${PUBLIC}dataset.json`,JSON.stringify(summary,null,2));
await rm(`${PUBLIC}tileset/central.b3dm`,{force:true});
console.log(`Wrote ${records.length} buildings in ${children.length} spatial tiles; ${(tileBytes/1048576).toFixed(1)} MB total.`);
