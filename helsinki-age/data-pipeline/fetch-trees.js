import fs from 'node:fs/promises';
const base='https://kartta.hel.fi/ws/geoserver/avoindata/wfs',features=[],ids=new Set(),requests=[];let total;
do{
 const url=new URL(base);url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'avoindata:Puurekisteri_piste',outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84',sortBy:'id',count:'5000',startIndex:String(features.length)});
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(response.status);const page=await response.json();
 if(!page.features?.length)throw Error('Incomplete tree response');if(total!==undefined&&total!==page.totalFeatures)throw Error('Tree source changed');total=page.totalFeatures;
 for(const f of page.features){if(ids.has(f.id))throw Error('Duplicate tree');ids.add(f.id);features.push(f);}requests.push(url.href);
}while(features.length<total);
const {rectangle:[w,s,e,n]}=JSON.parse(await fs.readFile('viewer/public/map/context.json','utf8'));
const trees=features.filter(f=>{const [x,y]=f.geometry.coordinates;return x>=w&&x<=e&&y>=s&&y<=n;}).map(f=>({id:f.properties.id,position:f.geometry.coordinates.slice(0,2),species:f.properties.suomenknimi,genus:f.properties.suku}));
await fs.writeFile('viewer/public/trees.json',JSON.stringify({metadata:{source:base,requests,retrievedAt:new Date().toISOString(),license:'City of Helsinki · CC BY 4.0',totalSourceRecords:total,note:'Street and park trees, not forest inventory. Source kokoluokka is trunk diameter, not height. Rendered heights/crowns use illustrative defaults.'},trees}));console.log(`${trees.length} recorded trees prepared`);
