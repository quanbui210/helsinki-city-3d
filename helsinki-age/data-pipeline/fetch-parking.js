import fs from 'node:fs/promises';
import bbox from '@turf/bbox';
import clipping from 'polygon-clipping';
import {parkingType,parkingLookup} from '../viewer/src/parkingData.js';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await fs.readFile(new URL(path,root),'utf8'));
const endpoint='https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
const names=['Pysakointipaikat_alue','Pysakoinnin_maksuvyohykkeet_alue','Asukas_ja_yrityspysakointivyohykkeet_alue'];
const sources=[];
async function fetchLayer(name){
  const path=`data-pipeline/raw/parking-${name}.json`;
  if(process.argv.includes('--offline'))return read(path);
  const features=[],ids=new Set(),requests=[];let total;
  do{
    const url=new URL(endpoint);url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:`avoindata:${name}`,outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84',count:'2000',startIndex:String(features.length),sortBy:'id'});
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`${name}: ${response.status}`);
    const page=await response.json();if(!Array.isArray(page.features)||!page.features.length)throw Error(`Incomplete ${name}`);
    if(total!==undefined&&total!==Number(page.totalFeatures))throw Error('Source changed during pagination');total=Number(page.totalFeatures);if(!Number.isFinite(total))throw Error('Missing total');
    for(const feature of page.features){if(ids.has(feature.id))throw Error('Duplicate source feature');ids.add(feature.id);features.push(feature);}
    requests.push(url.href);
  }while(features.length<total);
  if(features.length!==total)throw Error('Feature count mismatch');
  const data={type:'FeatureCollection',features,source:{name,requests,retrievedAt:new Date().toISOString()}};
  await fs.writeFile(new URL(path,root),JSON.stringify(data));return data;
}
const layers=[];for(const name of names){const data=await fetchLayer(name);layers.push(data);sources.push(data.source??{name,note:'Exploratory offline cache'});}
const [west,south,east,north]=(await read('viewer/public/map/context.json')).rectangle;
let excluded=0;
const spots=layers[0].features.flatMap(f=>{const type=parkingType(f.properties);if(!type){excluded++;return [];}
  const b=bbox(f),position=[(b[0]+b[2])/2,(b[1]+b[3])/2];
  if(position[0]<west-.005||position[0]>east+.005||position[1]<south-.003||position[1]>north+.003)return [];
  const n=Number(f.properties.paikat_ala);
  return [{id:f.id,position,type,capacity:Number.isInteger(n)&&n>0?n:null}];
});
const data={metadata:{retrievedAt:new Date().toISOString(),radiusMeters:200,license:'City of Helsinki · CC BY 4.0',sources,excludedNonCarOrProhibitedSegments:excluded,method:'Area-derived estimated capacity (paikat_ala), summed for segment bounding-box centres within 200 m straight-line distance. Zero/unreported capacity is unknown. Restricted uses are included and labelled separately. Zone membership uses point-in-polygon, not nearest zone. Coverage mainly inner Helsinki and permit zones. Boundaries approximate; check street signs.',liveAvailability:'Not included: the public Parkkiopas API reports parking usage; reliable complete free-space counts were not verified.',documentation:'https://kartta.hel.fi/paikkatietohakemisto/pth/?id=436'},spots,
  paidZones:layers[1].features.map(f=>({id:String(f.properties.vyohykkeen_nro),name:f.properties.nimi,geometry:f.geometry})),residentZones:layers[2].features.map(f=>({id:f.properties.asukaspysakointitunnus,name:f.properties.alueen_nimi,geometry:f.geometry}))};
const polygons=zones=>zones.map(z=>z.geometry.coordinates);
const paid=clipping.union(...polygons(data.paidZones)),resident=clipping.union(...polygons(data.residentZones));
data.displayZones=[['paid',clipping.difference(paid,resident)],['resident',clipping.difference(resident,paid)],['both',clipping.intersection(paid,resident)]].map(([kind,coordinates])=>({kind,geometry:{type:'MultiPolygon',coordinates}}));
const lookup=parkingLookup(data);
for(const path of ['viewer/public/buildings-manifest.json','data-pipeline/buildings-manifest.json']){const manifest=await read(path);for(const record of manifest)Object.assign(record,lookup(record.position));await fs.writeFile(new URL(path,root),JSON.stringify(manifest,null,path.startsWith('data-pipeline')?2:0));}
await fs.writeFile(new URL('viewer/public/parking.json',root),JSON.stringify(data));
console.log(`Parking: ${spots.length} segments, ${data.residentZones.length} resident zones, ${data.paidZones.length} paid zones; both manifests enriched.`);
