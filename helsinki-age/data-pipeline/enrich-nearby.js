import fs from 'node:fs/promises';
import {nearbyFor} from '../viewer/src/nearby.js';
import {curateLandmarks} from './landmarks.js';
const raw='data-pipeline/raw/nearby/',transit=JSON.parse(await fs.readFile(raw+'transit.json','utf8'));
const [w,s,e,n]=transit.bounds,bbox=[s,w,n,e].join(',');
const query=`[out:json][timeout:90];(nwr[shop=mall](${bbox});nwr[leisure=stadium][name](${bbox});nwr[railway=station][name~"^(Helsinki|Helsingin päärautatieasema|Pasila|Leppävaara)$"](${bbox});nwr[name~"Tuomiokirkko|Uspenski|Temppeliaukio|Suomenlinnan linnoitus|Sibelius-monumentti|Oodi|Ateneum|Kiasma",i][~"amenity|tourism|historic"~"."](${bbox}););out center tags;`;
let osm;
if(process.argv.includes('--offline'))osm=JSON.parse(await fs.readFile(raw+'landmarks.json','utf8'));
else{
 const endpoint=process.env.OVERPASS_URL||'https://overpass-api.de/api/interpreter';
 const response=await fetch(endpoint,{method:'POST',headers:{'User-Agent':'HelsinkiLensDataPreparation/1.0 (local landmark snapshot)','Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`Overpass HTTP ${response.status}; wait at least 30 seconds before retrying, or use an existing --offline snapshot.`);
 osm={...await response.json(),endpoint,query,retrievedAt:new Date().toISOString()};
 if(osm.remark||!Array.isArray(osm.elements))throw Error('Incomplete Overpass response');
 await fs.writeFile(raw+'landmarks.json',JSON.stringify(osm));
}
const landmarks=curateLandmarks(osm.elements,transit.bounds);
if(landmarks.length<8)throw Error('Landmark snapshot unexpectedly incomplete');
const sources={transit:{...transit.source,feed:transit.feed},landmarks:{url:osm.endpoint,query:osm.query,retrievedAt:osm.retrievedAt,osmTimestamp:osm.osm3s?.timestamp_osm_base,license:'OpenStreetMap contributors, ODbL 1.0',documentation:'https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL'}};
const data={bounds:transit.bounds,stops:transit.stops,landmarks,sources,notes:['Straight-line distances, not walking routes.','Stops are separate GTFS boarding platforms; parent stations and entrances are excluded.','Lines run somewhere in the feed window, not necessarily today. No live departures.','Landmarks are a curated subset; absence does not mean there are no points of interest.','OSM polygon markers use bounding-box centers, not verified entrances.']};
for(const path of ['viewer/public/buildings-manifest.json','data-pipeline/buildings-manifest.json']){
 const manifest=JSON.parse(await fs.readFile(path,'utf8'));
 for(const r of manifest)Object.assign(r,nearbyFor(r.position,data.stops,landmarks));
 await fs.writeFile(path,JSON.stringify(manifest,null,path.startsWith('data-pipeline')?2:0));
}
await fs.writeFile('viewer/public/nearby.json',JSON.stringify(data));
console.log(`${transit.stops.length} stops, ${landmarks.length} curated landmarks; both manifests enriched.`);
