import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BBOX, RAW, REGISTER_URL, CITY_URL, ARCHIVE_URL, ARCHIVE_GML } from './config.js';
const exists = p => access(p).then(() => true, () => false);
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
await mkdir(RAW, { recursive: true });
// Stable pagination prevents the register's many balcony/outline records from truncating the sample.
const features = new Map();
const requests = [];
for (let startIndex = 0; ; ) {
  const url = new URL(REGISTER_URL);
  url.search = new URLSearchParams({service:'WFS', version:'2.0.0', request:'GetFeature', typeNames:'avoindata:Rakennukset_alue_rekisteritiedot', outputFormat:'application/json', srsName:'EPSG:3879', bbox:`${BBOX.join(',')},EPSG:3879`, count:'2000', startIndex:String(startIndex), sortBy:'tietopalvelu_id'});
  const page = JSON.parse(await get(url));
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
if (!features.size) throw new Error('Empty register response; check bbox/axis order');
await writeFile(`${RAW}buildings.geojson`, JSON.stringify({type:'FeatureCollection', features:[...features.values()]}));
let path = process.env.CITYGML_FILE || `${RAW}${ARCHIVE_GML}`;
let source = ARCHIVE_URL;
let sourceDate = '2019-03-26';
if (process.argv.includes('--live')) {
  const url = new URL(CITY_URL);
  url.search = new URLSearchParams({service:'WFS', version:'2.0.0', request:'GetFeature', typeNames:'bldg:Building', bbox:BBOX.join(','), count:'10000'});
  const xml = await get(url);
  if (!xml.includes('bldg:Building') || xml.includes('ExceptionReport')) throw new Error('CityGML WFS returned no buildings');
  // Do not silently publish truncated WFS data.
  const matched = Number(xml.match(/numberMatched="(\d+)"/)?.[1]);
  const returned = Number(xml.match(/numberReturned="(\d+)"/)?.[1]);
  if (matched > returned) throw new Error('CityGML WFS response is truncated; use a smaller bbox or a complete local export');
  path = `${RAW}live.gml`; source = url.href; sourceDate = new Date().toISOString().slice(0,10);
  await writeFile(path, xml);
} else if (!await exists(path)) {
  console.log('Downloading official CityGML archive (23.5 MB)…');
  // TLS verification remains enabled; supply CITYGML_FILE if the archive server certificate is invalid.
  execFileSync('curl', ['--fail','--location','--max-time','180',ARCHIVE_URL,'-o',`${RAW}source.zip`], {stdio:'inherit'});
  execFileSync('unzip', ['-o',`${RAW}source.zip`, '-d', RAW], {stdio:'inherit'});
}
const xml = await readFile(path, 'utf8');
const root = xml.match(/<(?:\w+:)?(?:CityModel|FeatureCollection)\b[^>]*>/)?.[0];
if (!root) throw new Error('Not a CityGML document');
const namespaces = [...root.matchAll(/xmlns(?::\w+)?="[^"]*"/g)].map(m=>m[0]).filter(s=>!s.startsWith('xmlns="')).join(' ');
let selected = [], excluded = 0;
for (const match of xml.matchAll(/<bldg:Building\b[\s\S]*?<\/bldg:Building>/g)) {
  const building = match[0];
  const lower = building.match(/<gml:lowerCorner>(.*?)<\/gml:lowerCorner>/)?.[1]?.trim().split(/\s+/).map(Number);
  const upper = building.match(/<gml:upperCorner>(.*?)<\/gml:upperCorner>/)?.[1]?.trim().split(/\s+/).map(Number);
  if (!lower || !upper) throw new Error('A building has no bounds');
  const [x,y] = lower.map((v,i)=>(v+upper[i])/2);
  if (x < BBOX[0] || x > BBOX[2] || y < BBOX[1] || y > BBOX[3]) continue;
  // Snapshot includes planned objects: they are not part of the standing-building timeline.
  if (/<gen:value>suunnitteilla<\/gen:value>|name="SUUNNITELMA_ALUE"/i.test(building)) { excluded++; continue; }
  // Appearance references missing JPEGs; geometries and identifiers remain unmodified.
  selected.push(`<cityObjectMember>${building.replace(/<app:appearance>[\s\S]*?<\/app:appearance>/g,'')}</cityObjectMember>`);
}
if (!selected.length) throw new Error('No buildings inside target bbox');
const cropped = `<?xml version="1.0"?><CityModel xmlns="http://www.opengis.net/citygml/2.0" ${namespaces}>${selected.join('\n')}</CityModel>`;
await writeFile(`${RAW}central.gml`,cropped);
await writeFile(`${RAW}provenance.json`,JSON.stringify({area:'Central & eastern Helsinki', bbox:BBOX, crs:'EPSG:3879', citySource:source, citySourceDate:sourceDate, registerSource:REGISTER_URL, registerRequests:requests, retrievedAt:new Date().toISOString(), sourceSha256:createHash('sha256').update(xml).digest('hex'), croppedSha256:createHash('sha256').update(cropped).digest('hex'), buildings:selected.length, excludedPlanned:excluded},null,2));
console.log(`Cropped ${selected.length} official buildings; excluded ${excluded} planned objects.`);
