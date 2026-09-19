import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RAW,PUBLIC,ROOT} from './config.js';
import {readBatchTable,energyIndex} from './energy.js';

const base='https://kartta.hel.fi/3d/atlas/';
const offline=process.argv.includes('--offline');
await mkdir(RAW,{recursive:true});
async function download(url,file){
  if(offline)return readFile(file);
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`Energy Atlas: HTTP ${response.status} ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());await writeFile(file,bytes);return bytes;
}
const config=JSON.parse(await download(`${base}config.json`,`${RAW}atlas-config.json`));
const layer=config.layers.find(layer=>layer.name==='Energy Buildings');
if(!layer?.url)throw Error('Energy Buildings absent from Atlas configuration');
const tilesetUrl=new URL(`${layer.url.replace(/\/$/,'')}/tileset.json`,base);
const tileset=JSON.parse(await download(tilesetUrl,`${RAW}atlas-tileset.json`));
const manifest=JSON.parse(await readFile(`${PUBLIC}buildings-manifest.json`,'utf8'));
const xs=manifest.map(b=>b.position[0]*Math.PI/180),ys=manifest.map(b=>b.position[1]*Math.PI/180);
const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
const uris=new Set();
function walk(tile){
  const region=tile.boundingVolume?.region;
  if(!region)throw Error('Expected geographic Atlas tile bounds');
  if(region[0]>bounds[2]||region[1]>bounds[3]||region[2]<bounds[0]||region[3]<bounds[1])return;
  if(tile.content){if(!tile.content.uri?.endsWith('.b3dm'))throw Error('Unsupported Atlas content');uris.add(tile.content.uri);}
  for(const child of tile.children??[])walk(child);
}
walk(tileset.root);
const tables=[],sources=[];
for(const uri of [...uris].sort()){
  const url=new URL(uri,tilesetUrl).href;
  const bytes=await download(url,`${RAW}energy-${uri.replaceAll('/','-')}`);
  tables.push(readBatchTable(bytes));
  sources.push({url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  console.log(`Energy attributes: ${uri}`);
}
const index=energyIndex(tables);
let matched=0;
for(const building of manifest){building.energy=index.get(building.buildingId)??null;if(building.energy)matched++;}
if(!matched)throw Error('No energy certificates joined; refusing to publish');
const metadata=JSON.parse(await readFile(`${PUBLIC}layers.json`,'utf8'));
metadata.energy={status:'available',retrieved:offline?metadata.energy?.retrieved??null:new Date().toISOString(),
  configUrl:`${base}config.json`,tilesetUrl:tilesetUrl.href,field:'attributes.energiatod_luokka',
  metric:'Archived energy certificate class (2013 scheme); not measured annual consumption or a current rating',
  join:'Exact CityGML buildingId = Atlas batch-table id. Conflicting certificate records become unknown. No spatial or RATU fallback.',
  matched,sources,license:'City of Helsinki, CC BY 4.0'};
await writeFile(`${PUBLIC}buildings-manifest.json`,JSON.stringify(manifest));
await writeFile(`${ROOT}data-pipeline/buildings-manifest.json`,JSON.stringify(manifest,null,2));
await writeFile(`${PUBLIC}layers.json`,JSON.stringify(metadata,null,2));
console.log(`Energy: ${matched}/${manifest.length} archived certificates joined by exact building ID`);
