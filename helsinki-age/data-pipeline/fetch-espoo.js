import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ESPOO_INCREMENTS, ESPOO_URL, PUBLIC, RAW, ROOT} from './config.js';
import {buildingBlocks, geometryBounds, insideBbox} from './lib.js';

const exists = path => access(path).then(() => true, () => false);
const pageSize = Number(process.env.ESPOO_PAGE || 20);
const requested = new Set(process.argv.slice(2).filter(arg => !arg.startsWith('-')));
const published = new Set(
  (JSON.parse(await readFile(`${PUBLIC}dataset.json`, 'utf8')).expansions || [])
    .flatMap(entry => (entry.increments || []).map(increment => increment.id).concat(entry.id || [])),
);
const targets = ESPOO_INCREMENTS.filter(increment => requested.size ? requested.has(increment.id) : !published.has(increment.id));
if (!targets.length) throw new Error('No Espoo increments selected');

const existing = new Set(JSON.parse(await readFile(`${ROOT}data-pipeline/buildings-manifest.json`, 'utf8')).map(b => b.buildingId));

async function get(url) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(180000)});
      if ([502, 503, 504].includes(response.status)) {
        lastError = new Error(`${response.status}: ${url}`);
        await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`${response.status}: ${url}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

const keyOf = bbox => bbox.join('_');
function split(bbox) {
  const midX = (bbox[0] + bbox[2]) / 2, midY = (bbox[1] + bbox[3]) / 2;
  return [
    [bbox[0], bbox[1], midX, midY],
    [midX, bbox[1], bbox[2], midY],
    [bbox[0], midY, midX, bbox[3]],
    [midX, midY, bbox[2], bbox[3]],
  ];
}

const requests = [];
const selected = [];
const stats = [];

for (const increment of targets) {
  const pagesDir = `${RAW}expansion-pages/${increment.id}/`;
  await mkdir(pagesDir, {recursive: true});
  const buildings = new Map();
  const queue = [increment.bbox];
  let truncatedCells = 0;
  while (queue.length) {
    const bbox = queue.shift();
    const cache = `${pagesDir}${keyOf(bbox)}.xml`;
    let xml;
    if (await exists(cache)) xml = await readFile(cache, 'utf8');
    else {
      const url = new URL(ESPOO_URL);
      url.search = new URLSearchParams({
        service: 'WFS', version: '1.1.0', request: 'GetFeature', typeName: 'bldg:building_lod2',
        srsName: 'EPSG:3879', BBOX: bbox.join(','), maxFeatures: String(pageSize),
      });
      xml = await get(url);
      if (xml.includes('ExceptionReport') || xml.includes('ServiceException')) throw new Error(`${increment.id}: Espoo WFS exception`);
      await writeFile(cache, xml.replace(/<app:appearance>[\s\S]*?<\/app:appearance>/g, ''));
      requests.push(url.href);
    }
    const blocks = [...buildingBlocks(xml)];
    const span = Math.min(bbox[2] - bbox[0], bbox[3] - bbox[1]);
    if (blocks.length >= pageSize && span > 80) {
      queue.push(...split(bbox));
      continue;
    }
    if (blocks.length >= pageSize) truncatedCells++;
    for (const block of blocks) {
      const id = block.match(/gml:id="([^"]+)"/)?.[1];
      if (!id) throw new Error('Espoo CityGML building missing gml:id');
      if (!buildings.has(id)) buildings.set(id, block);
    }
    console.log(`${increment.id}: ${buildings.size} unique @ ${bbox.join(',')} (+${blocks.length})`);
  }

  let skippedExisting = 0, excludedPlanned = 0, kept = 0, skippedUnbounded = 0;
  for (const block of buildings.values()) {
    const id = block.match(/gml:id="([^"]+)"/)[1];
    const bounds = geometryBounds(block);
    if (!bounds) { skippedUnbounded++; continue; }
    const center = bounds.center;
    if (existing.has(id) || !insideBbox(center, increment.bbox)) { skippedExisting++; continue; }
    if (/<gen:value>suunnitteilla<\/gen:value>|name="SUUNNITELMA_ALUE"/i.test(block)) { excludedPlanned++; continue; }
    existing.add(id);
    selected.push(`<cityObjectMember>${block.replace(/<app:appearance>[\s\S]*?<\/app:appearance>/g, '')}</cityObjectMember>`);
    kept++;
  }
  stats.push({id: increment.id, area: increment.area, bbox: increment.bbox, uniqueReturned: buildings.size, kept, skippedExisting, skippedUnbounded, excludedPlanned, truncatedCells});
}

if (!selected.length) throw new Error('No new Espoo buildings');
const cropped = `<?xml version="1.0"?><CityModel xmlns="http://www.opengis.net/citygml/2.0" xmlns:bldg="http://www.opengis.net/citygml/building/2.0" xmlns:gml="http://www.opengis.net/gml" xmlns:gen="http://www.opengis.net/citygml/generics/2.0" xmlns:core="http://www.opengis.net/citygml/2.0">${selected.join('\n')}</CityModel>`;
await writeFile(`${RAW}increment.gml`, cropped);
await writeFile(`${RAW}expansion-provenance.json`, JSON.stringify({
  area: stats.map(entry => entry.area).join('; '),
  increments: stats,
  crs: 'EPSG:3879',
  citySource: ESPOO_URL,
  citySourceDate: new Date().toISOString().slice(0, 10),
  retrievedAt: new Date().toISOString(),
  requests,
  buildings: selected.length,
  sha256: createHash('sha256').update(cropped).digest('hex'),
  note: 'Official City of Espoo CityGML LOD2 WFS. Envelope centers in the requested increment. WFS 1.1.0 ignores startIndex, so cells are quad-split when a page is full. No inferred years or nearest-building guesses.',
}, null, 2));
console.log(`Wrote ${selected.length} new Espoo buildings.`);
