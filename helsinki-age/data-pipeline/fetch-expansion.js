import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CITY_URL, INCREMENTS, PUBLIC, RAW, ROOT} from './config.js';
import {buildingBlocks, envelopeCenter, insideBbox} from './lib.js';

const exists = path => access(path).then(() => true, () => false);
const pageSize = Number(process.env.CITYGML_PAGE || 8);
const requested = new Set(process.argv.slice(2).filter(arg => !arg.startsWith('-')));
const existing = new Set(JSON.parse(await readFile(`${ROOT}data-pipeline/buildings-manifest.json`, 'utf8')).map(b => b.buildingId));
const published = new Set(
  (JSON.parse(await readFile(`${PUBLIC}dataset.json`, 'utf8')).expansions || [])
    .flatMap(entry => (entry.increments || []).map(increment => increment.id).concat(entry.id || [])),
);
published.add('west');
const targets = INCREMENTS.filter(increment => requested.size ? requested.has(increment.id) : !published.has(increment.id));
if (!targets.length) throw new Error('No expansion increments selected');

async function get(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(180000)});
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}

const requests = [];
const selected = [];
const stats = [];

for (const increment of targets) {
  const pagesDir = `${RAW}expansion-pages/${increment.id}/`;
  await mkdir(pagesDir, {recursive: true});
  const buildings = new Map();
  let startIndex = 0, matched;
  for (;;) {
    const cache = `${pagesDir}${startIndex}.xml`;
    let xml;
    if (await exists(cache)) xml = await readFile(cache, 'utf8');
    else {
      const url = new URL(CITY_URL);
      url.search = new URLSearchParams({
        service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'bldg:Building',
        bbox: increment.bbox.join(','), count: String(pageSize), startIndex: String(startIndex),
      });
      xml = await get(url);
      await writeFile(cache, xml);
      requests.push(url.href);
    }
    const returned = Number(xml.match(/numberReturned="(\d+)"/)?.[1]);
    matched = Number(xml.match(/numberMatched="(\d+)"/)?.[1]);
    if (!Number.isFinite(matched) || !Number.isFinite(returned)) throw new Error(`${increment.id}: CityGML WFS page omitted counts`);
    if (xml.includes('ExceptionReport')) throw new Error(`${increment.id}: CityGML WFS exception`);
    for (const block of buildingBlocks(xml)) {
      const id = block.match(/gml:id="([^"]+)"/)?.[1];
      if (!id) throw new Error('CityGML building missing gml:id');
      if (buildings.has(id)) continue;
      buildings.set(id, block);
    }
    console.log(`${increment.id}: ${buildings.size} unique / ${matched} matched @ ${startIndex}`);
    if (!returned) {
      if (startIndex < matched) throw new Error(`${increment.id}: truncated CityGML WFS page`);
      break;
    }
    startIndex += returned;
    if (startIndex >= matched) break;
  }
  let excludedPlanned = 0, skippedExisting = 0, kept = 0;
  for (const block of buildings.values()) {
    const id = block.match(/gml:id="([^"]+)"/)[1];
    const center = envelopeCenter(block);
    if (!center) throw new Error('A building has no bounds');
    if (existing.has(id) || !insideBbox(center, increment.bbox)) { skippedExisting++; continue; }
    if (/<gen:value>suunnitteilla<\/gen:value>|name="SUUNNITELMA_ALUE"/i.test(block)) { excludedPlanned++; continue; }
    existing.add(id);
    selected.push(`<cityObjectMember>${block.replace(/<app:appearance>[\s\S]*?<\/app:appearance>/g, '')}</cityObjectMember>`);
    kept++;
  }
  stats.push({id: increment.id, area: increment.area, bbox: increment.bbox, matched, uniqueReturned: buildings.size, kept, skippedExisting, excludedPlanned});
}

if (!selected.length) throw new Error('No new expansion buildings');
const cropped = `<?xml version="1.0"?><CityModel xmlns="http://www.opengis.net/citygml/2.0" xmlns:bldg="http://www.opengis.net/citygml/building/2.0" xmlns:gml="http://www.opengis.net/gml" xmlns:gen="http://www.opengis.net/citygml/generics/2.0" xmlns:core="http://www.opengis.net/citygml/2.0">${selected.join('\n')}</CityModel>`;
await writeFile(`${RAW}increment.gml`, cropped);
await writeFile(`${RAW}expansion-provenance.json`, JSON.stringify({
  area: targets.map(i => i.area).join('; '),
  increments: stats,
  crs: 'EPSG:3879',
  citySource: CITY_URL,
  citySourceDate: new Date().toISOString().slice(0, 10),
  retrievedAt: new Date().toISOString(),
  requests,
  buildings: selected.length,
  sha256: createHash('sha256').update(cropped).digest('hex'),
  note: 'Official citydb WFS. Envelope centers in the requested increment, excluding already published IDs. No nearest-building inference.',
}, null, 2));
console.log(`Wrote ${selected.length} new buildings from ${targets.map(i => i.id).join(', ')}.`);
