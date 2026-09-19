import { DOMParser } from '@xmldom/xmldom';
export const NS = {gml:'http://www.opengis.net/gml', bldg:'http://www.opengis.net/citygml/building/2.0', gen:'http://www.opengis.net/citygml/generics/2.0'};
export const nodes = (node,ns,tag) => Array.from(node.getElementsByTagNameNS(NS[ns],tag));
export function parseBuilding(xml) {
  const doc = new DOMParser({errorHandler:{warning(){},error(e){throw Error(e)},fatalError(e){throw Error(e)}}}).parseFromString(`<root xmlns:bldg="${NS.bldg}" xmlns:gml="${NS.gml}" xmlns:gen="${NS.gen}">${xml}</root>`,'application/xml');
  return nodes(doc,'bldg','Building')[0];
}
export function* buildingBlocks(xml) { for (const match of xml.matchAll(/<bldg:Building\b[\s\S]*?<\/bldg:Building>/g)) yield match[0]; }
export function attributes(building) {
  return Object.fromEntries(Array.from(building.childNodes).filter(n=>n.namespaceURI===NS.gen && n.hasAttribute('name')).map(n=>[n.getAttribute('name'),nodes(n,'gen','value')[0]?.textContent.trim()]));
}
export function normalizeRatu(value) {
  const s = String(value ?? '').trim();
  if (!/^\d+(?:\.0+)?$/.test(s) || Number(s) <= 0) return null;
  return String(Number(s));
}
export function parseYear(value, currentYear = new Date().getFullYear()) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const match = String(value).match(/^(\d{4})(?:$|-\d{2}-\d{2}(?:T.*)?$)/);
  const year = match ? Number(match[1]) : 0;
  return year >= 1000 && year <= currentYear ? year : null;
}
export function buildRegisterIndex(features) {
  const index = new Map();
  for (const {properties:p} of features) {
    const id = normalizeRatu(p.ratu); if (!id) continue;
    if (!index.has(id)) index.set(id, []);
    index.get(id).push(p);
  }
  return index;
}
export function extractRatu(block) {
  return normalizeRatu(block.match(/name="(?:Rakennustunnus_\(RATU\)|RATU)"[^>]*>\s*<gen:value>([^<]*)/)?.[1]);
}
export function envelopeCenter(block) {
  const lo = block.match(/<gml:lowerCorner>(.*?)<\/gml:lowerCorner>/)?.[1]?.trim().split(/\s+/).map(Number);
  const hi = block.match(/<gml:upperCorner>(.*?)<\/gml:upperCorner>/)?.[1]?.trim().split(/\s+/).map(Number);
  if (!lo || !hi || lo.length < 2 || hi.length < 2 || [...lo, ...hi].some(n => !Number.isFinite(n))) return null;
  return lo.map((v, i) => (v + hi[i]) / 2);
}
export function insideBbox([x, y], [minX, minY, maxX, maxY]) {
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}
export function joinBuilding(buildingId, ratu, index) {
  const matches = index.get(normalizeRatu(ratu)) || [];
  const years = new Set(matches.map(p=>parseYear(p.c_valmpvm)).filter(y=>y!==null));
  const conflict = years.size > 1;
  const record = matches.find(p=>parseYear(p.c_valmpvm)!==null) || matches[0];
  return {buildingId, ratu:normalizeRatu(ratu), constructionYear:years.size===1?[...years][0]:null, joinStatus:conflict?'conflicting-years':!matches.length?'unmatched':!years.size?'missing-year':'matched', address:record?[record.katunimi_suomi,record.osoitenumero].filter(Boolean).join(' '):'', purpose:record?.tyyppi || '', useCode:record?.c_kayttark || '', registerId:record?.tietopalvelu_id ?? null};
}
// The official archive repeats 29 IDs as separate LOD1 / LOD2 exports.
// Keep the highest LOD per ID, with source order breaking equal-LOD ties.
export function uniqueBuildingBlocks(xml) {
  const map = new Map();
  for (const block of buildingBlocks(xml)) {
    const id = block.match(/gml:id="([^"]+)"/)[1];
    const previous = map.get(id);
    const lod = s => /<bldg:lod2/.test(s) ? 2 : 1;
    if (!previous || lod(block)>lod(previous)) map.set(id,block);
  }
  return map.values();
}
