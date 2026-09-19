import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PUBLIC,REGISTER_URL} from './config.js';
const features=new Map(),requests=[];let startIndex=0;
for(;;){
 const url=new URL(REGISTER_URL);
 url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'avoindata:Helsinki_osoiteluettelo',outputFormat:'application/json',srsName:'CRS:84',count:'5000',startIndex:String(startIndex),sortBy:'id'});
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Address WFS HTTP ${response.status}`);
 const page=await response.json(),total=Number(page.numberMatched??page.totalFeatures);
 if(!Array.isArray(page.features)||!Number.isFinite(total))throw Error('Invalid address response');
 if(!page.features.length&&startIndex<total)throw Error('Truncated address response');
 const previous=features.size;for(const f of page.features){if(!f.id)throw Error('Missing address ID');features.set(f.id,f);}
 if(features.size-previous!==page.features.length)throw Error('Repeated address page');
 requests.push(url.href);startIndex+=page.features.length;console.log(`Addresses ${startIndex}/${total}`);
 if(startIndex===total)break;if(startIndex>total)throw Error('Address count changed during fetch');
}
const addresses=[];
for(const feature of features.values()){
 const p=feature.properties,position=feature.geometry?.coordinates;
 if(!p.katunimi||feature.geometry?.type!=='Point'||!position?.every(Number.isFinite))throw Error('Invalid address geometry or street');
 const number=p.osoitenumero_teksti??[p.osoitenumero,p.osoitekirjain].filter(v=>v!==null&&v!==undefined).join('');
 addresses.push({name:[p.katunimi,number].filter(Boolean).join(' '),alias:[p.gatan,number].filter(Boolean).join(' '),position:position.slice(0,2),postcode:p.postinumero??'',id:p.id});
}
await mkdir(`${PUBLIC}search`,{recursive:true});
const bytes=JSON.stringify(addresses);
await writeFile(`${PUBLIC}search/addresses.json`,bytes);
await writeFile(`${PUBLIC}search/source.json`,JSON.stringify({source:'City of Helsinki, Helsinki_osoiteluettelo WFS',license:'CC BY 4.0',retrieved:new Date().toISOString(),requests,records:addresses.length,sha256:createHash('sha256').update(bytes).digest('hex'),note:'Official address points; no nearest-building inference. 3D building coverage remains partial.'},null,2));
