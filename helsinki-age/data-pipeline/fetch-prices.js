import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {PUBLIC,RAW,REGISTER_URL} from './config.js';
import {cell,changeQoQ} from './price-data.js';

const ROOT='https://pxdata.stat.fi/PxWeb/api/v1/en/';
async function json(url,options){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(90000)});
  if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
async function discover(database,subject,pattern){
  const listing=await json(`${ROOT}${database}/${subject}`);
  const table=listing.find(t=>t.type==='t'&&pattern.test(t.text));
  if(!table)throw Error(`No verified postal-area table in ${database}/${subject}`);
  const url=`${ROOT}${database}/${subject}/${table.id}`;
  return {url,table,metadata:await json(url)};
}
async function boundaries(year){
  const u=new URL('https://geo.stat.fi/geoserver/postialue/wfs');
  u.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:`postialue:pno_${year}`,outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84',cql_filter:"kunta IN ('091','049')"});
  const data=await json(u);
  if(!data.features?.length||data.numberReturned<data.totalFeatures)throw Error('Incomplete postal boundaries');
  return {url:u.href,features:data.features};
}
async function query(source,kind,codes){
  const variables=source.metadata.variables;
  const time=variables.find(v=>v.time),area=variables.find(v=>v.text==='Postal code');
  const segment=variables.find(v=>v.text===(kind==='sale'?'Building type':'Number of rooms'));
  const info=variables.find(v=>v.text==='Information');
  const selectedSegment=segment.values[segment.valueTexts.findIndex(v=>v===(kind==='sale'?'Blocks of flats, two-room flat':'Two-room flat'))];
  const metric=info.values[info.valueTexts.findIndex(v=>kind==='sale'?v==='Price per square meter (EUR/m2)':v==='Rents per square meter (eur/m2)')];
  if(!selectedSegment||!metric)throw Error('Source categories changed; review the selection');
  const periods=time.values.slice(-2);
  const selections={[time.code]:periods,[area.code]:codes.filter(c=>area.values.includes(c)),[segment.code]:[selectedSegment],[info.code]:[metric]};
  const request={query:variables.map(v=>({code:v.code,selection:{filter:'item',values:selections[v.code]}})),response:{format:'json-stat2'}};
  const data=await json(source.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  await writeFile(`${RAW}prices-${kind}.json`,JSON.stringify({source,request,data}));
  const values=new Map(codes.map(code=>{
    const at=period=>cell(data,{[time.code]:period,[area.code]:code,[segment.code]:selectedSegment,[info.code]:metric});
    const previous=at(periods[0]),value=at(periods[1]);
    return [code,{value,previous,change:changeQoQ(value,previous,periods[1],periods[0])}];
  }));
  return {values,meta:{url:source.url,title:source.metadata.title,table:source.table.id,updated:source.table.updated,quarter:periods[1],quarterLabel:time.valueTexts.at(-1),previousQuarter:periods[0],segment:segment.valueTexts[segment.values.indexOf(selectedSegment)],boundaryYear:Number(area.map.match(/\d{4}/)?.[0]),notes:data.note??[],archived:source.url.includes('Passiivi'),unit:kind==='sale'?'EUR/m²':'EUR/m²/month'}};
}

await mkdir(RAW,{recursive:true});
// Discover from live listings on every refresh; table IDs are not guessed.
const saleSource=await discover('StatFin','ashi',/Prices per square meter.*by postal code area, quarterly/);
let rentSource;
try{rentSource=await discover('StatFin','asvu',/Average rents.*by postal code area/);}catch(error){
  // Only fall back when the live listing genuinely has no postal table.
  if(!error.message.startsWith('No verified postal-area table'))throw error;
  rentSource=await discover('StatFin_Passiivi','asvu',/Average rents.*by postal code area/);
}
const yearFor=source=>Number(source.metadata.variables.find(v=>v.text==='Postal code').map.match(/\d{4}/)?.[0]);
const [saleBounds,rentBounds]=await Promise.all([boundaries(yearFor(saleSource)),boundaries(yearFor(rentSource))]);
const codes=[...new Set([...saleBounds.features,...rentBounds.features].map(f=>f.properties.posti_alue))].sort();
const sale=await query(saleSource,'sale',codes),rent=await query(rentSource,'rent',codes);
const byCode=features=>new Map(features.map(f=>[f.properties.posti_alue,f]));
const sb=byCode(saleBounds.features),rb=byCode(rentBounds.features);
const areas=codes.map(postalCode=>({postalCode,name:(sb.get(postalCode)||rb.get(postalCode)).properties.nimi,rentName:rb.get(postalCode)?.properties.nimi??null,geometry:sb.get(postalCode)?.geometry??null,rentGeometry:rb.get(postalCode)?.geometry??null,avgSalePricePerSqm:sale.values.get(postalCode).value,avgRentPerSqm:rent.values.get(postalCode).value,quarter:sale.meta.quarter,rentQuarter:rent.meta.quarter,priceChangeQoQ:sale.values.get(postalCode).change,rentChangeQoQ:rent.values.get(postalCode).change}));
const metadata={fetchedAt:new Date().toISOString(),license:'CC BY 4.0',attribution:'Statistics Finland',sale:sale.meta,rent:rent.meta,boundaries:{sale:saleBounds.url,rent:rentBounds.url},methodology:'Two-room flats benchmark. Sale: old dwellings in blocks of flats, unadjusted mean transaction price. Rent: non-subsidised two-room dwellings, monthly rent per m². No all-room total is published in these postal tables; room categories are not averaged together. Each metric uses its own official postal boundary vintage. Null means suppressed or unavailable, never zero. QoQ compares adjacent published quarters; changes in the mix of dwellings can affect these averages. This is not a quality-adjusted price index or an individual property valuation.'};
await writeFile(`${PUBLIC}price-by-area.json`,JSON.stringify({metadata,areas}));
const u=new URL(REGISTER_URL);u.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'avoindata:Kaupunginosajako',outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84'});
const districts=await json(u);
if(!districts.features?.length||districts.numberReturned<districts.totalFeatures)throw Error('Incomplete Helsinki district boundaries');
const context=JSON.parse(await readFile(`${PUBLIC}map/context.json`,'utf8'));
const names=new Map(context.neighborhoods.map(n=>[n.name.toLocaleUpperCase('fi'),n.name]));
await writeFile(`${PUBLIC}map/district-boundaries.json`,JSON.stringify({type:'FeatureCollection',source:u.href,license:'CC BY 4.0 · City of Helsinki',features:districts.features.map(f=>({type:'Feature',geometry:f.geometry,properties:{name:names.get(f.properties.nimi_fi)||f.properties.nimi_fi.toLocaleLowerCase('fi').replace(/(^|[- ])\p{L}/gu,c=>c.toLocaleUpperCase('fi'))}}))}));
console.log(`${areas.length} postal areas: sale ${sale.meta.quarter} (${areas.filter(a=>a.avgSalePricePerSqm!==null).length} reported), rent ${rent.meta.quarter} (${areas.filter(a=>a.avgRentPerSqm!==null).length} reported); ${districts.features.length} Helsinki districts.`);
