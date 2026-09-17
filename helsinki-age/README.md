# Helsinki, through time

An interactive Cesium atlas of real Helsinki architecture. Buildings appear by their recorded completion year, surrounded by real coastline, parks, streets and place names. No synthetic buildings, inferred dates, AI calls or runtime backend.

## Run

Node.js 22+ and npm:

```sh
npm ci
npm run dev           # http://localhost:5173
npm run build         # viewer/dist
npm run preview
npm test
npm run test:browser  # Chrome installed; start the dev server first
```

Prepared static data is included in `viewer/public`. No Cesium ion account, API key or runtime map-service connection is needed. Google Fonts is optional; system fonts provide a fallback. The dev server must remain running while using the local preview.

## Explore

- **Drag** to pan; **scroll / pinch** to zoom. Zoom buttons use proportional steps.
- **Shift-drag / right-drag** rotate and tilt. Rotation, north-reset and top-down/3D buttons are also available.
- **Keyboard:** focus the map, use arrows to pan, + / − to zoom, Home to reset. `/` focuses search. Space toggles timeline playback.
- **Search** official full street/place names or building addresses. A dated building search advances the timeline if needed to reveal that building.
- **Neighborhood shortcuts** fly to available geometry. Counts mean modeled buildings, not a complete neighborhood inventory.
- **Dusk / Daylight**, a label toggle, camera orbit, building inspection, and `?year=1900` sharing are included.
- **Unknown years** always stay visible in blue-gray. The timeline starts at the earliest known year unless a URL year is supplied.

## Verified coverage

| Item | Result |
| --- | --- |
| Modeled buildings | 2,674 (previously 689) |
| Matched construction years | 1,710 |
| Unknown years | 964: 931 unmatched, 33 missing dates |
| Neighborhoods with ≥10 modeled buildings | 14 |
| Geometry | 2,674 LOD2 objects, 279,406 triangles |
| Streaming | 18 spatial B3DM tiles; 22.6 MiB total |
| Full official place labels | 1,835, displayed by distance and screen-space collision checks |
| Geometry snapshot | 26 March 2019 |
| Register / reference map retrieved | 16 September 2026 |
| Dated range | 1765–2022; some register completion dates postdate the geometry snapshot |

Partial coverage: **Kruununhaka, Katajanokka, Kallio, Sörnäinen, Hermanni, Vallila, Kulosaari, Mustikkamaa-Korkeasaari, Herttoniemi, Alppiharju, Kumpula, Toukola, Kaartinkaupunki, and Kluuvi**. Place search also includes subareas such as Kalasatama. Availability is constrained by the official archived model; blank areas are not filled with fabricated geometry.

## Rebuild the data

Run commands from this directory:

```sh
npm run data:fetch
npm run data:join
npm run data:convert
npm run data:map:fetch
npm run data:map:build
# or all five stages:
npm run data:prepare
```

Configuration is in `data-pipeline/config.js`. The expanded EPSG:3879 bbox is `[25497000, 6672400, 25500400, 6676900]`. The original archive is cached under `data-pipeline/raw`; raw files are ignored by Git and are not needed to run the frontend.

### Geometry and construction dates

1. Fetch `avoindata:Rakennukset_alue_rekisteritiedot` from [Helsinki WFS](https://kartta.hel.fi/ws/geoserver/avoindata/wfs), using stable `tietopalvelu_id` sorting and pagination. The expanded query returned 27,802 records, with 2,368 unique RATUs. Balcony and outline records without IDs do not create buildings.
2. Crop buildings by envelope center from the official archive. Exclude objects explicitly tagged as planned. Deduplicate GML IDs, keeping the higher LOD: the expanded crop has 2,735 records, 61 duplicate representations, and 245 excluded planned objects.
3. Join **CityGML `Rakennustunnus_(RATU)` → WFS `ratu`**. Completion year is extracted from **`c_valmpvm`**. Keep unmatched/missing years null; contradictory duplicate register dates become unknown. Fail rather than publish a zero-match timeline.
4. Select the highest LOD, triangulate original polygons including holes, transform EPSG:3879 geometry into a local east/north/up frame, and write GLB inside 3D Tiles 1.0 B3DM. Group buildings into 1 km spatial cells. Each manifest record has `buildingId`, `constructionYear`, `tileContentUri`, tile-local `tileFeatureId`, and a georeferenced `position`.

The converter is scoped to Helsinki CityGML 2.0 exports with the `bldg` / `gml` prefixes, inline polygons, and EPSG:3879 east/north metre coordinates. It is not a general CityGML implementation. It uses Earcut and a deterministic binary writer: the suggested experimental `njam/citygml-to-3dtiles` implementation combined LODs and triangulated hole rings independently when inspected.

### Geographic context

The context fetch uses these official WFS layers:

- `Maavesi_maa_alueet_yleistetty`: land / shoreline.
- `Opaskartta_alue`: blocks, parks, water, street areas and plazas.
- `Opaskartta_muuviiva`: piers and above-ground rail context. Planned roads are omitted.
- `Opaskartta_nimisto`: road classification for label priority.
- `Nimisto_piste_rekisteritiedot`: complete Finnish place/street names and positions; only current names (`olotila=1`). Fragmented map text is not displayed.
- `Kaupunginosajako`: district boundaries for assigning modeled-building counts and navigation targets.

`build-map-context.js` generates two 6144px local basemap PNGs from the source polygons. Contemporary building footprints are deliberately omitted. Labels remain crisp HTML anchored to georeferenced positions, with zoom-dependent density and collision filtering. This is **present-day reference geography**, fixed while the construction timeline changes.

The map context is a wider area than the 3D coverage. Browsing/searching outside available geometry still shows the reference map, without claiming 3D completeness. Source endpoints, layer names, bbox, dates, and geometry hashes are recorded in `viewer/public/dataset.json` and `viewer/public/map/context.json`.

### Source availability

The requested [CityGML index](https://3d.hel.ninja/data/citygml/) listed only `Helsinki3D_CityGML_Kalasatama_20190326.zip` at initial setup. Despite its name, its extent includes central/eastern neighborhoods. The [CityGML WFS](https://kartta.hel.fi/3d/citydb-wfs/wfs) returned capabilities but repeatedly timed out on feature requests.

The archive server had an expired certificate. The cached archive was retrieved once with explicit public-data TLS bypass; reusable scripts **do not disable TLS validation**. If the certificate is still invalid, obtain the official archive through a trusted channel and provide an extracted file:

```sh
CITYGML_FILE=/absolute/path/to/export.gml npm run data:fetch
```

`npm run data:fetch -- --live` tries the official CityGML WFS and fails on timeout or declared truncation. It does not silently replace the cached snapshot.

## Validation

`npm test` checks ID normalization, missing/conflicting year joins, year boundaries, courtyard triangulation, **every feature ID/year in all 18 generated binary tiles**, finite geographic positions, and map provenance/coverage.

The browser suite verifies actual pointer dragging, wheel and button zoom, rotation, top-down view, north reset, feature picking, timeline/playback, orbit, loaded-feature visibility against the HUD, labels, themes, neighborhood navigation, search, mobile layout, touch pan, and pinch zoom. Screenshots are saved to `artifacts/atlas-*.png`.

## Limitations

- Geometry is from **2019**, not a present-day complete inventory or a reconstruction of demolished historical buildings. Buildings removed since 2019 may remain; new geometry is absent.
- Current register dates can reflect alterations/reconstruction and can postdate the model. They are retained as official recorded completion dates, not rewritten to fit the snapshot.
- Coverage is partial, including within listed neighborhoods. Neighborhood counts include unknown-year objects.
- N2000 source heights are retained numerically without a geoid-to-ellipsoid correction. The map is flat reference imagery on Cesium’s ellipsoid, not survey-grade terrain.
- Warm materials replace source textures. Binary year reveal is implemented; smooth per-building rise animation remains a stretch goal.

Data: **City of Helsinki, CC BY 4.0**. [Official geographic-data services](https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/make-better-use-of-geospatial-data/open-geographic-data) · [Building-register metadata](https://hri.fi/data/fi/dataset/helsingin-rakennukset).
