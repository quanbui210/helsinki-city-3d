import {readFile, writeFile} from 'node:fs/promises';
import {MAP_BBOX, PUBLIC, REGISTER_URL} from './config.js';

const context = JSON.parse(await readFile(`${PUBLIC}map/context.json`, 'utf8'));
const manifest = JSON.parse(await readFile(`${PUBLIC}buildings-manifest.json`, 'utf8'));
const bbox = MAP_BBOX;
const districts = [];
const seen = new Set();
for (let startIndex = 0; ;) {
  const url = new URL(REGISTER_URL);
  url.search = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'avoindata:Kaupunginosajako',
    outputFormat: 'application/json', srsName: 'EPSG:4326', bbox: `${bbox.join(',')},EPSG:3879`,
    count: '2000', startIndex: String(startIndex), sortBy: 'id',
  });
  const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw Error(`Kaupunginosajako: ${response.status}`);
  const data = await response.json();
  if (!data.features) throw Error('Invalid district response');
  for (const feature of data.features) {
    const id = feature.properties.id ?? feature.properties.tietopalvelu_id;
    if (seen.has(id)) continue;
    seen.add(id);
    districts.push(feature);
  }
  startIndex += data.features.length;
  if (!data.features.length || startIndex >= Number(data.numberMatched)) break;
}

const polygons = g => g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function contains(point, g) {
  return polygons(g).some(p => inRing(point, p[0]) && !p.slice(1).some(r => inRing(point, r)));
}

const neighborhoods = [];
for (const district of districts) {
  const entries = manifest.filter(b => contains(b.position, district.geometry));
  if (entries.length < 10) continue;
  const name = district.properties.nimi_fi.toLocaleLowerCase('fi').replace(/(^|[- ])\p{L}/gu, c => c.toLocaleUpperCase('fi'));
  const position = [0, 1].map(i => entries.reduce((sum, b) => sum + b.position[i], 0) / entries.length);
  neighborhoods.push({id: district.properties.tunnus, name, position, count: entries.length, known: entries.filter(b => b.constructionYear !== null).length, bounds: district.geometry});
}
context.neighborhoods = neighborhoods;
context.note = 'Present-day reference geography. Partial 3D coverage: 2019 crop plus official citydb increments.';
await writeFile(`${PUBLIC}map/context.json`, JSON.stringify(context));
console.log(`Neighborhoods: ${neighborhoods.length}`, neighborhoods.map(n => `${n.name}: ${n.count}`));
