import {readFile, writeFile, stat} from 'node:fs/promises';
import proj4 from 'proj4';
import {Cartesian3, Matrix4, Transforms} from 'cesium';
import {INCREMENTS, LEGACY_BBOX, PROJECTION, PUBLIC, RAW, ROOT} from './config.js';
import {parseBuilding, uniqueBuildingBlocks} from './lib.js';
import {buildingTriangles, encodeB3dm} from './geometry.js';

const existing = JSON.parse(await readFile(`${PUBLIC}buildings-manifest.json`, 'utf8'));
const incoming = JSON.parse(await readFile(`${RAW}increment-manifest.json`, 'utf8'));
const byId = new Map(incoming.map(r => [r.buildingId, r]));
const known = new Set(existing.map(r => r.buildingId));
const projection = proj4(PROJECTION, 'EPSG:4326');
const summary = JSON.parse(await readFile(`${PUBLIC}dataset.json`, 'utf8'));
const origin = Cartesian3.fromDegrees(...summary.center, 0);
const inverse = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(origin), new Matrix4());
const xml = await readFile(`${RAW}increment.gml`, 'utf8');
for (const match of xml.matchAll(/srsName="([^"]+)"/g)) if (!match[1].includes('3879')) throw Error('Unsupported source CRS: ' + match[1]);

const groups = new Map();
for (const block of uniqueBuildingBlocks(xml)) {
  const id = block.match(/gml:id="([^"]+)"/)[1];
  if (known.has(id) || !byId.has(id)) continue;
  const lo = block.match(/<gml:lowerCorner>(.*?)<\/gml:lowerCorner>/)[1].trim().split(/\s+/).map(Number);
  const hi = block.match(/<gml:upperCorner>(.*?)<\/gml:upperCorner>/)[1].trim().split(/\s+/).map(Number);
  const point = lo.map((v, i) => (v + hi[i]) / 2);
  const key = `c-${Math.floor((point[0] - LEGACY_BBOX[0]) / 1000)}-${Math.floor((point[1] - LEGACY_BBOX[1]) / 1000)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({block, point, top: hi[2]});
}

const tileset = JSON.parse(await readFile(`${PUBLIC}tileset/tileset.json`, 'utf8'));
const box = (lo, hi) => {
  const mid = lo.map((v, i) => (v + hi[i]) / 2), h = lo.map((v, i) => (hi[i] - v) / 2 + 1);
  return [...mid, h[0], 0, 0, 0, h[1], 0, 0, 0, h[2]];
};
const rootBox = tileset.root.boundingVolume.box;
const allMin = [rootBox[0] - rootBox[3], rootBox[1] - rootBox[7], rootBox[2] - rootBox[11]];
const allMax = [rootBox[0] + rootBox[3], rootBox[1] + rootBox[7], rootBox[2] + rootBox[11]];
const records = [];
let newTriangles = 0;

for (const [key, entries] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  const positions = [], normals = [], batchIds = [], tileRecords = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const local = p => {
    const [lon, lat] = projection.forward(p.slice(0, 2));
    const v = Matrix4.multiplyByPoint(inverse, Cartesian3.fromDegrees(lon, lat, p[2]), new Cartesian3());
    [v.x, v.y, v.z].forEach((a, i) => {
      min[i] = Math.min(min[i], a); max[i] = Math.max(max[i], a);
      allMin[i] = Math.min(allMin[i], a); allMax[i] = Math.max(allMax[i], a);
    });
    return [v.x, v.z, -v.y];
  };
  const tileContentUri = `${key}.b3dm`;
  for (const {block, point, top} of entries) {
    const id = block.match(/gml:id="([^"]+)"/)[1], record = byId.get(id);
    const {triangles, lod} = buildingTriangles(parseBuilding(block));
    if (!triangles.length) throw Error(`No geometry ${id}`);
    const featureId = tileRecords.length;
    for (const triangle of triangles) {
      const p = triangle.map(local);
      const a = p[1].map((v, i) => v - p[0][i]), b = p[2].map((v, i) => v - p[0][i]);
      const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const length = Math.hypot(...n);
      if (length < 1e-10) continue;
      for (const v of p) { positions.push(...v); normals.push(...n.map(v => v / length)); batchIds.push(featureId); }
    }
    tileRecords.push({...record, tileFeatureId: featureId, tileContentUri, lod, position: [...projection.forward(point.slice(0, 2)), top]});
  }
  records.push(...tileRecords);
  newTriangles += positions.length / 9;
  await writeFile(`${PUBLIC}tileset/${tileContentUri}`, encodeB3dm(positions, normals, batchIds, tileRecords));
  tileset.root.children = tileset.root.children.filter(child => child.content?.uri !== tileContentUri);
  tileset.root.children.push({boundingVolume: {box: box(min, max)}, geometricError: 0, content: {uri: tileContentUri}});
  console.log(`Tile ${key}: ${tileRecords.length} buildings`);
}

tileset.root.boundingVolume.box = box(allMin, allMax);
await writeFile(`${PUBLIC}tileset/tileset.json`, JSON.stringify(tileset));
const merged = [...existing.filter(r => !records.some(n => n.buildingId === r.buildingId)), ...records];
await writeFile(`${ROOT}data-pipeline/buildings-manifest.json`, JSON.stringify(merged, null, 2));
await writeFile(`${PUBLIC}buildings-manifest.json`, JSON.stringify(merged));
let tileBytes = 0;
for (const child of tileset.root.children) tileBytes += (await stat(`${PUBLIC}tileset/${child.content.uri}`)).size;
const expansion = JSON.parse(await readFile(`${RAW}expansion-provenance.json`, 'utf8'));
const join = JSON.parse(await readFile(`${RAW}increment-join-report.json`, 'utf8'));
const years = merged.map(b => b.constructionYear).filter(y => y !== null);
const previous = Array.isArray(summary.expansions) ? summary.expansions : summary.expansion ? [summary.expansion] : [];
await writeFile(`${PUBLIC}dataset.json`, JSON.stringify({
  ...summary,
  bbox: [Math.min(summary.bbox[0], ...INCREMENTS.map(i => i.bbox[0])), Math.min(summary.bbox[1], ...INCREMENTS.map(i => i.bbox[1])), Math.max(summary.bbox[2], ...INCREMENTS.map(i => i.bbox[2])), Math.max(summary.bbox[3], ...INCREMENTS.map(i => i.bbox[3]))],
  area: 'Helsinki 3D increments: 2019 central/eastern crop plus official citydb west, south and inner-city strips',
  buildings: merged.length,
  joined: merged.filter(b => b.joinStatus === 'matched').length,
  unknown: merged.filter(b => b.constructionYear === null).length,
  statuses: Object.fromEntries([...new Set(merged.map(b => b.joinStatus))].map(s => [s, merged.filter(b => b.joinStatus === s).length])),
  minYear: Math.min(...years),
  maxYear: Math.max(...years),
  tileBytes,
  tiles: tileset.root.children.length,
  triangles: (summary.triangles || 0) + newTriangles,
  lods: Object.fromEntries([1, 2].map(l => [l, merged.filter(r => r.lod === l).length])),
  expansions: [...previous, expansion],
  expansionJoin: join,
  notes: [
    '2019 Kalasatama CityGML crop retained for the original central/eastern tiles.',
    'Later increments are the official citydb WFS. Already-published GML IDs are never duplicated. No inferred years or nearest-building guesses.',
    'Completion dates from the current building register, joined by RATU.',
    'Unknown-year buildings remain visible; historical demolished buildings are not reconstructed.',
    'Source N2000 heights retained without a geoid conversion; no surveyed terrain or textures.',
  ],
}, null, 2));
console.log(`Merged ${records.length} buildings into ${merged.length} total; tiles ${(tileBytes / 1048576).toFixed(1)} MB.`);
