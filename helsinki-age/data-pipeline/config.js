import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const RAW = `${ROOT}data-pipeline/raw/`;
export const PUBLIC = `${ROOT}viewer/public/`;
export const BBOX = [25497000, 6672400, 25500400, 6676900]; // EPSG:3879; full available central/eastern snapshot
export const REGISTER_URL = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
export const CITY_URL = 'https://kartta.hel.fi/3d/citydb-wfs/wfs';
export const ARCHIVE_URL = 'https://3d.hel.ninja/data/citygml/Helsinki3D_CityGML_Kalasatama_20190326.zip';
export const ARCHIVE_GML = 'Helsinki3D_CityGML_Kalasatama_20190326.gml';
export const PROJECTION = '+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
export const SRS = 'urn:ogc:drf:crs:EPSG::3879';
