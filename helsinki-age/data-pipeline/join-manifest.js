import { readFile, writeFile } from 'node:fs/promises';
import { RAW, ROOT } from './config.js';
import { uniqueBuildingBlocks, extractRatu, buildRegisterIndex, joinBuilding } from './lib.js';
const xml = await readFile(`${RAW}central.gml`,'utf8');
const register = JSON.parse(await readFile(`${RAW}buildings.geojson`,'utf8'));
const index = buildRegisterIndex(register.features);
const manifest = [];
for (const block of uniqueBuildingBlocks(xml)) {
  const id = block.match(/gml:id="([^"]+)"/)[1];
  const ratu = extractRatu(block);
  manifest.push({...joinBuilding(id,ratu,index),tileFeatureId:manifest.length});
}
if (new Set(manifest.map(b=>b.buildingId)).size!==manifest.length) throw new Error('Duplicate GML IDs');
const report = {buildings:manifest.length, registerRecords:register.features.length, registerRatus:index.size, joined:manifest.filter(b=>b.joinStatus==='matched').length, unknown:manifest.filter(b=>b.constructionYear===null).length, statuses:Object.fromEntries([...new Set(manifest.map(b=>b.joinStatus))].map(s=>[s,manifest.filter(b=>b.joinStatus===s).length])), joinKey:'CityGML Rakennustunnus_(RATU) = WFS ratu', yearField:'c_valmpvm'};
if (!report.joined) throw new Error('No construction-year joins; refusing to publish an empty timeline');
await writeFile(`${ROOT}data-pipeline/buildings-manifest.json`,JSON.stringify(manifest,null,2));
await writeFile(`${RAW}join-report.json`,JSON.stringify(report,null,2));
console.log(report);
