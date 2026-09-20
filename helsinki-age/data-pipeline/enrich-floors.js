import fs from 'node:fs/promises';
import {MAP_BBOX,REGISTER_URL} from './config.js';
const requests=[],values=new Map(),seen=new Set();let start=0,total;
do{
 const url=new URL(REGISTER_URL);url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'avoindata:Rakennukset_alue_rekisteritiedot',outputFormat:'application/json',bbox:`${MAP_BBOX},EPSG:3879`,propertyName:'ratu,i_kerrlkm,tietopalvelu_id',sortBy:'tietopalvelu_id',count:'5000',startIndex:String(start)});
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(response.status);const page=await response.json();if(!Array.isArray(page.features)||!page.features.length)throw Error('Incomplete floor register');
 const count=Number(page.totalFeatures);if(!Number.isFinite(count)||count<1||(total!==undefined&&total!==count))throw Error('Missing or changing source count');total=count;start+=page.features.length;requests.push(url.href);
 for(const f of page.features){const {ratu,i_kerrlkm:n,tietopalvelu_id:id}=f.properties;if(id==null||seen.has(id))throw Error('Missing or repeated register identity');seen.add(id);if(!ratu||!Number.isInteger(n)||n<1||n>100)continue;const key=String(ratu);if(!values.has(key))values.set(key,new Set());values.get(key).add(n);}
}while(start<total);
if(start!==total)throw Error('Incomplete register pagination');
let known=0;
for(const path of ['viewer/public/buildings-manifest.json','data-pipeline/buildings-manifest.json']){
 const manifest=JSON.parse(await fs.readFile(path,'utf8'));known=0;
 for(const r of manifest){const valuesFor=values.get(String(r.ratu));r.floorCount=r.geometrySource!=='espoo-wfs'&&valuesFor?.size===1?[...valuesFor][0]:null;r.floorCountSource=r.floorCount?'Helsinki register i_kerrlkm':null;if(r.floorCount)known++;}
 await fs.writeFile(path,JSON.stringify(manifest,null,path.startsWith('data-pipeline')?2:0));
}
await fs.writeFile('viewer/public/floors-source.json',JSON.stringify({field:'i_kerrlkm',join:'ratu; conflicting floor counts remain unknown; no cross-city join',known,sourceRecords:total,requests,retrievedAt:new Date().toISOString(),fallback:'Unknown records use an explicitly unconfirmed floor selector (1–8), not a fabricated manifest count.'},null,2));console.log(`${known} buildings with register floor counts`);
