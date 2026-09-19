import {readFile, writeFile} from 'node:fs/promises';
import {RAW, ROOT} from './config.js';
import {uniqueBuildingBlocks, parseYear} from './lib.js';

const xml = await readFile(`${RAW}increment.gml`, 'utf8');
const existing = new Set(JSON.parse(await readFile(`${ROOT}data-pipeline/buildings-manifest.json`, 'utf8')).map(b => b.buildingId));
const manifest = [];
for (const block of uniqueBuildingBlocks(xml)) {
  const id = block.match(/gml:id="([^"]+)"/)[1];
  if (existing.has(id)) continue;
  const year = parseYear(block.match(/<bldg:yearOfConstruction>([^<]+)<\/bldg:yearOfConstruction>/)?.[1]
    ?? block.match(/name="valmistumispvm"[^>]*>\s*<gen:value>([^<]*)/)?.[1]);
  const ratu = block.match(/name="rakennustunnus"[^>]*>\s*<gen:value>([^<]*)/)?.[1]?.trim() || null;
  const address = block.match(/name="osoite"[^>]*>\s*<gen:value>([^<]*)/)?.[1]?.trim() || '';
  const purpose = block.match(/name="kayttotarkoitus"[^>]*>\s*<gen:value>([^<]*)/)?.[1]?.trim() || '';
  manifest.push({
    buildingId: id, ratu, constructionYear: year,
    joinStatus: year !== null ? 'matched' : 'unmatched',
    address, purpose, useCode: '', registerId: null,
    tileFeatureId: manifest.length, geometrySource: 'espoo-wfs',
  });
}
if (new Set(manifest.map(b => b.buildingId)).size !== manifest.length) throw new Error('Duplicate GML IDs');
if (!manifest.length) throw new Error('No new Espoo buildings to join');
const report = {
  buildings: manifest.length,
  joined: manifest.filter(b => b.joinStatus === 'matched').length,
  unknown: manifest.filter(b => b.constructionYear === null).length,
  statuses: Object.fromEntries([...new Set(manifest.map(b => b.joinStatus))].map(s => [s, manifest.filter(b => b.joinStatus === s).length])),
  joinKey: 'CityGML bldg:yearOfConstruction or valmistumispvm',
  yearField: 'yearOfConstruction',
};
if (!report.joined) throw new Error('No construction-year joins; refusing to publish an empty timeline');
await writeFile(`${RAW}increment-manifest.json`, JSON.stringify(manifest, null, 2));
await writeFile(`${RAW}increment-join-report.json`, JSON.stringify(report, null, 2));
console.log(report);
