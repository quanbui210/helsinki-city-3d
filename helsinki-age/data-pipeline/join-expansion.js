import {readFile, writeFile} from 'node:fs/promises';
import {BBOX, RAW, REGISTER_URL, ROOT} from './config.js';
import {uniqueBuildingBlocks, extractRatu, buildRegisterIndex, joinBuilding} from './lib.js';

const features = new Map();
const requests = [];
for (let startIndex = 0; ;) {
  const url = new URL(REGISTER_URL);
  url.search = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'avoindata:Rakennukset_alue_rekisteritiedot',
    outputFormat: 'application/json', srsName: 'EPSG:3879', bbox: `${BBOX.join(',')},EPSG:3879`,
    count: '2000', startIndex: String(startIndex), sortBy: 'tietopalvelu_id',
  });
  const page = await fetch(url, {signal: AbortSignal.timeout(60000)}).then(r => {
    if (!r.ok) throw new Error(`${r.status}: ${url}`);
    return r.json();
  });
  if (!Array.isArray(page.features)) throw new Error('WFS did not return a FeatureCollection');
  requests.push(url.href);
  const previous = features.size;
  for (const feature of page.features) features.set(feature.id, feature);
  console.log(`Register: ${features.size} records`);
  startIndex += page.features.length;
  const total = Number(page.numberMatched ?? page.totalFeatures);
  if (!page.features.length || (Number.isFinite(total) && startIndex >= total)) break;
  if (features.size === previous) throw new Error('WFS pagination repeated a page');
}

const xml = await readFile(`${RAW}increment.gml`, 'utf8');
const index = buildRegisterIndex([...features.values()]);
const existing = new Set(JSON.parse(await readFile(`${ROOT}data-pipeline/buildings-manifest.json`, 'utf8')).map(b => b.buildingId));
const manifest = [];
for (const block of uniqueBuildingBlocks(xml)) {
  const id = block.match(/gml:id="([^"]+)"/)[1];
  if (existing.has(id)) continue;
  manifest.push({...joinBuilding(id, extractRatu(block), index), tileFeatureId: manifest.length, geometrySource: 'citydb-wfs'});
}
if (new Set(manifest.map(b => b.buildingId)).size !== manifest.length) throw new Error('Duplicate GML IDs');
if (!manifest.length) throw new Error('No new buildings to join');
const report = {
  buildings: manifest.length,
  registerRecords: features.size,
  registerRatus: index.size,
  joined: manifest.filter(b => b.joinStatus === 'matched').length,
  unknown: manifest.filter(b => b.constructionYear === null).length,
  statuses: Object.fromEntries([...new Set(manifest.map(b => b.joinStatus))].map(s => [s, manifest.filter(b => b.joinStatus === s).length])),
  joinKey: 'CityGML RATU or Rakennustunnus_(RATU) = WFS ratu',
  yearField: 'c_valmpvm',
  registerRequests: requests,
};
if (!report.joined) throw new Error('No construction-year joins; refusing to publish an empty timeline');
await writeFile(`${RAW}increment-manifest.json`, JSON.stringify(manifest, null, 2));
await writeFile(`${RAW}increment-join-report.json`, JSON.stringify(report, null, 2));
console.log(report);
