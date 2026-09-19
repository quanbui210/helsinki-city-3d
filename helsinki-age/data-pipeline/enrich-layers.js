import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PUBLIC,ROOT,RAW,REGISTER_URL,BBOX} from './config.js';
import {noiseSources,indexZones,noiseAt} from './noise.js';
import {useCategory} from '../viewer/src/layers/useCategories.js';

// Use --offline to reproduce the join from cached, validated responses.
await mkdir(RAW,{recursive:true});
const manifest=JSON.parse(await readFile(`${PUBLIC}buildings-manifest.json`,'utf8'));
let previousMetadata={};
try{previousMetadata=JSON.parse(await readFile(`${PUBLIC}layers.json`,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const metadata={studyYear:2022,metric:'Lden',license:'City of Helsinki, CC BY 4.0',
  join:'Point-in-polygon at CityGML envelope center (not facade exposure or a footprint intersection). Highest band wins overlaps. No nearest-zone fallback.',
  combined:'Highest available mode band; not total acoustic exposure. Missing modes remain unknown.',
  sources:{},bands:[],counts:{},
  use:{field:'c_kayttark',codeList:'RA_KAYTTARK',source:'https://kartta.hel.fi/avoindata/dokumentit/Rakennusrekisteri_avoindata_metatiedot_20160601.pdf'},
};
const bands=new Map();
for(const [mode,name] of Object.entries(noiseSources)){
  const cache=`${RAW}noise-${mode}.json`;
  let collection;
  if(process.argv.includes('--offline'))collection=JSON.parse(await readFile(cache,'utf8'));
  else{
    const features=new Map(),requests=[];let startIndex=0,total;
    for(;;){
      const url=new URL(REGISTER_URL);
      url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:`avoindata:${name}`,outputFormat:'application/json',srsName:'CRS:84',bbox:`${BBOX.join(',')},EPSG:3879`,count:'1000',startIndex:String(startIndex),sortBy:'id'});
      const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw Error(`Noise ${mode}: HTTP ${response.status}`);
      const page=await response.json();
      if(page.type!=='FeatureCollection'||!Array.isArray(page.features))throw Error('Invalid WFS response');
      total=Number(page.numberMatched??page.totalFeatures);
      if(!Number.isFinite(total))throw Error('WFS must declare total count to verify completeness');
      requests.push(url.href);
      if(!page.features.length){if(startIndex<total)throw Error('Truncated WFS page');break;}
      const previous=features.size;
      for(const feature of page.features){if(!feature.id)throw Error('Missing feature ID');features.set(feature.id,feature);}
      if(features.size-previous!==page.features.length)throw Error('Duplicate WFS page or feature');
      startIndex+=page.features.length;
      if(startIndex>=total)break;
    }
    if(features.size!==total||!total)throw Error(`Incomplete or empty ${mode} collection`);
    collection={type:'FeatureCollection',features:[...features.values()],requests,retrieved:new Date().toISOString()};
    await writeFile(cache,JSON.stringify(collection));
  }
  const zones=indexZones(collection.features);
  for(const zone of zones){
    const color=zone.feature.properties.colour;
    if(!/^#[\da-f]{6}$/i.test(color))throw Error('Invalid source band color');
    bands.set(`${zone.low}:${zone.high}`,{low:zone.low,high:zone.high,color});
  }
  for(const building of manifest){building.noise??={};building.noise[mode]=noiseAt(building.position,zones);}
  metadata.sources[mode]={layer:name,requests:collection.requests,retrieved:collection.retrieved,features:zones.length,sha256:createHash('sha256').update(JSON.stringify(collection.features)).digest('hex')};
  metadata.counts[mode]=manifest.filter(b=>b.noise[mode]!==null).length;
  console.log(`${mode}: ${zones.length} zones; ${metadata.counts[mode]}/${manifest.length} building centers in zones`);
}
metadata.bands=[...bands.values()].sort((a,b)=>a.low-b.low);
for(const building of manifest){building.useCategory=useCategory(building.useCode);building.energy??=null;}
if(previousMetadata.energy&&manifest.some(b=>b.energy))metadata.energy={...previousMetadata.energy,matched:manifest.filter(b=>b.energy).length};
metadata.counts.use=manifest.filter(b=>b.useCategory!==null).length;
// Keep the public array contract; one record per unique buildingId, O(1) runtime lookup.
if(new Set(manifest.map(b=>b.buildingId)).size!==manifest.length)throw Error('Duplicate building IDs');
await writeFile(`${PUBLIC}buildings-manifest.json`,JSON.stringify(manifest));
await writeFile(`${ROOT}data-pipeline/buildings-manifest.json`,JSON.stringify(manifest,null,2));
await writeFile(`${PUBLIC}layers.json`,JSON.stringify(metadata,null,2));
console.log(`Enriched ${manifest.length} buildings; manifest ${(Buffer.byteLength(JSON.stringify(manifest))/1048576).toFixed(2)} MiB`);
