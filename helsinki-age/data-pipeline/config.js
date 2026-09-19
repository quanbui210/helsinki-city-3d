import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const RAW = `${ROOT}data-pipeline/raw/`;
export const PUBLIC = `${ROOT}viewer/public/`;
export const LEGACY_BBOX = [25497000, 6672400, 25500400, 6676900]; // 2019 Kalasatama crop / existing tile ENU origin
export const INCREMENTS = [
  {id: 'west', area: 'Kamppi, Punavuori, Etu-Töölö', bbox: [25495500, 6672000, 25497000, 6674200]},
  {id: 'south', area: 'Ullanlinna, Kaivopuisto', bbox: [25495500, 6670800, 25501000, 6672000]},
  {id: 'ruoholahti', area: 'Ruoholahti, Jätkäsaari', bbox: [25492800, 6671600, 25495500, 6673800]},
  {id: 'northwest', area: 'Meilahti, Taka-Töölö, Pasila', bbox: [25494000, 6674200, 25497000, 6677200]},
  {id: 'lauttasaari', area: 'Lauttasaari', bbox: [25490000, 6672000, 25492800, 6674200]},
  {id: 'north', area: 'Käpylä, Koskela, Kumpula north', bbox: [25494000, 6677200, 25501000, 6678500]},
  {id: 'east_south', area: 'Kulosaari south, Herttoniemi shore', bbox: [25501000, 6670800, 25505000, 6672400]},
  {id: 'east_mid', area: 'Kulosaari, Herttoniemi', bbox: [25501000, 6672400, 25504000, 6674600]},
  {id: 'suomenlinna', area: 'Suomenlinna', bbox: [25500000, 6669600, 25504000, 6670800]},
];
export function unionBox(boxes) {
  return [
    Math.min(...boxes.map(b => b[0])),
    Math.min(...boxes.map(b => b[1])),
    Math.max(...boxes.map(b => b[2])),
    Math.max(...boxes.map(b => b[3])),
  ];
}
export const ESPOO_INCREMENTS = [
  {id: 'espoo_east', area: 'Otaniemi, Keilaniemi, Westend', bbox: [25483000, 6671600, 25490000, 6675200]},
];
export const ESPOO_URL = 'https://kartat.espoo.fi/teklaogcweb/wfs.ashx';
export const BBOX = unionBox([LEGACY_BBOX, ...INCREMENTS.map(i => i.bbox)]);
export const MAP_BBOX = [25480000, 6668800, 25507000, 6679800];
export const REGISTER_URL = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
export const CITY_URL = 'https://kartta.hel.fi/3d/citydb-wfs/wfs';
export const ARCHIVE_URL = 'https://3d.hel.ninja/data/citygml/Helsinki3D_CityGML_Kalasatama_20190326.zip';
export const ARCHIVE_GML = 'Helsinki3D_CityGML_Kalasatama_20190326.gml';
export const PROJECTION = '+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
export const SRS = 'urn:ogc:drf:crs:EPSG::3879';
