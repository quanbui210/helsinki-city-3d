import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {MAP_BBOX,RAW,REGISTER_URL} from './config.js';
await mkdir(`${RAW}context`,{recursive:true});
const layers=['Maavesi_maa_alueet_yleistetty','Opaskartta_alue','Opaskartta_muuviiva','Opaskartta_nimisto','Kaupunginosajako','Nimisto_piste_rekisteritiedot'];
const bbox=MAP_BBOX;
for(const layer of layers){
 if(process.argv.includes('--missing')){try{await readFile(`${RAW}context/${layer}.geojson`);continue;}catch{}}
 const all=[];const seen=new Set();
 for(let startIndex=0;;){
  const url=new URL(REGISTER_URL);url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:`avoindata:${layer}`,outputFormat:'application/json',srsName:'EPSG:4326',bbox:`${bbox.join(',')},EPSG:3879`,count:'2000',startIndex:String(startIndex),sortBy:layer.startsWith('Maavesi')?'tietopalvelu_id':'id'});
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`${layer}: ${response.status}`);
  const data=await response.json();if(!data.features)throw Error(`Invalid ${layer} response`);
  let added=0;for(const f of data.features){const id=f.properties.id ?? f.properties.tietopalvelu_id;if(seen.has(id))continue;seen.add(id);all.push(f);added++;}
  startIndex+=data.features.length;
  console.log(`${layer}: ${all.length} / ${data.numberMatched}`);
  if(!data.features.length||startIndex>=Number(data.numberMatched))break;
  if(!added)throw Error(`Repeated ${layer} page`);
 }
 await writeFile(`${RAW}context/${layer}.geojson`,JSON.stringify({type:'FeatureCollection',features:all}));
}
await writeFile(`${RAW}context/source.json`,JSON.stringify({endpoint:REGISTER_URL,layers,bbox,crs:'EPSG:3879',outputCRS:'EPSG:4326',retrievedAt:new Date().toISOString()}));
