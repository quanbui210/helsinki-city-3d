# Helsinki Lens

A 3D first stop before an apartment viewing: **see what the listing won’t tell you**. Search official Helsinki addresses, inspect a building, and switch between recorded age, modeled noise, building use and archived energy certificates. Real geometry and official data, with missing coverage made explicit. No synthetic buildings, inferred dates, AI calls or runtime backend.

## Run

Node.js 22+ and npm:

```sh
npm ci
npm run dev           # http://localhost:5173
npm run build         # viewer/dist
npm run preview
npm test
npm run test:browser  # Chrome installed; start the dev server first
npm run test:layers   # streamed properties, lens colors, camera and deep links
npm run test:lens     # Overview, official search, records, mobile and reduced motion
```

Prepared static data is included in `viewer/public`. No Cesium ion account, API key or runtime map-service connection is needed. Fonts use local system fallbacks, so the viewer makes no external font requests. The dev server must remain running while using the local preview.

## Data lenses

The atlas opens in **Overview**, with no data style, the full modeled city, and a slow orbit. Interaction stops the orbit, and reduced-motion preferences disable automatic motion. Overview is the default because Age would hide most buildings and the other lenses immediately assert a data claim. The bottom panel is a drawer: open by default with a four-lens chooser, collapsible to the tab bar when you want the map back. **Hide / Show** keeps that preference across tab changes. **Age** retains its original timeline filtering. **Use** groups official register purpose codes into five categories. **Noise** shows the 2022 study’s modeled Lden bands; **All** (default) is the highest available transport-mode band. Road, Rail, Metro and Tram isolate a single source. **Energy** shows 345 matched archived certificate classes. Switching lenses preserves the camera, pauses timeline playback, and remembers each layer’s controls. Other lenses show all modeled buildings, independently of the stored Age year. Links preserve `year`, `layer`, and noise `mode`; use `?layer=age&year=1900` to open the timeline explicitly.

### Presentation and search

Buildings retain neutral stone materials. Age keeps the original 40% blend and restrained palette. Noise, Energy and Use skip that desaturation and mix at 74% so adjacent classes stay separable on the stone. A depth-based screen-space pass adds brighter tinted architectural edges. Low-angle warm directional lighting, soft shadows cast onto the ground, and ambient occlusion add depth. The archive’s double-sided shells cast shadows but do not receive self-shadows to avoid acne. Terrain shadow depth bias uses a guarded Cesium 1.145 internal setting; verify it when upgrading Cesium.

Original facade textures and surveyed terrain are **not** included in this model. The neutral architectural material is a visual treatment, not a claim about actual facade material. Existing official coastline, water, streets, parks and block imagery provide the ground reference. It remains contemporary reference geography.

The prominent search uses a prepared, lazy-loaded offline geocoder containing **58,283 official** `Helsinki_osoiteluettelo` **address points**. Queries are debounced 180 ms and support Finnish/Swedish names and accent-insensitive matching. Search does not send addresses to an external service. Exact normalized address matches surface modeled building records; addresses without a modeled record get an explicit coverage message, never a nearest-building guess. Search and map clicks share the same record-rendering path. The card is docked inside the viewport, wraps long fields and scrolls vertically on small screens.

Every layer has a persistent legend. Gray means missing data, never verified quiet or efficient. Building inspection includes the use category/code or selected noise band. Layer coverage counts refer to the full modeled inventory, not just the viewport.

Noise uses Helsinki’s exact `db_lo` / `db_hi` ranges: 45–50 through 70–75 dB, plus the open-ended 75+ band. Official source colors stay in `layers.json` provenance. The viewer uses a sequential presentation scale and a stronger tile-color mix so adjacent bands stay separable on the stone material. **All means the highest available transport-mode band, not summed acoustic exposure or an average.** The official combined NPM layer uses LAeq, so it is not mixed with these Lden datasets.

The join samples the **CityGML envelope center**, using Turf point-in-polygon with a bounding-box prefilter, polygon holes respected, and the highest band winning overlaps/boundary ties. It is an approximate building-location sample, not a footprint intersection, facade measurement, or an indoor noise estimate. No nearest-zone inference is made. Road matches 5,516 buildings, tram 1,891, metro 263 and rail 339 of the 8,456 modeled buildings. These counts reflect this archive’s limited geography. Use codes are available for 5,284 buildings.

Use mappings follow Helsinki’s [RA_KAYTTARK code list, pages 8–9](https://kartta.hel.fi/avoindata/dokumentit/Rakennusrekisteri_avoindata_metatiedot_20160601.pdf), using the 1994 classification rather than assuming the newer 2018 classification. The five groups are an atlas presentation choice; “civic” does not imply public ownership. Undocumented codes remain unknown, separately from documented “Other” codes.

### Reproduce layer data

```sh
npm run data:layers             # fetch official WFS noise zones and enrich existing prepared geometry
npm run data:layers -- --offline # repeat the join from data-pipeline/raw/noise-*.json
npm run data:energy             # extract certificates from the official Atlas tiles
npm run data:energy -- --offline # repeat from cached Atlas configuration and tiles
npm run data:addresses          # refresh official address points and provenance
npm run test:layers             # start the dev server first
```

`data:prepare` runs noise/use enrichment, energy and address preparation after geometry and context generation. WFS requests use stable `id` pagination, verify declared totals, and fail on duplicate or truncated responses. Exact URLs, retrieval times, feature hashes, band colors and coverage are recorded in `viewer/public/layers.json`; geocoder provenance is in `viewer/public/search/source.json`.

Energy feasibility was verified against the [official Atlas configuration](https://kartta.hel.fi/3d/atlas/config.json). Its `Energy Buildings` layer serves B3DM attribute tables, not a separate WFS. Spatially relevant Atlas tiles are downloaded at build time; `attributes.energiatod_luokka` is joined by exact CityGML ID. The Atlas identifies this as the 2013 certificate scheme. Issued/expiry dates are retained; older `energiatehokkuusluokka` fields are deliberately not mixed in. Conflicting duplicate certificates become unknown. These 345 records are **archived certificates**, some expired, not current assessments or measured consumption. No network requests to the Atlas occur in the viewer.

All per-building data stays in the shared `buildings-manifest.json`. Its existing array format is retained for compatibility, with unique `buildingId` keys indexed into a `Map` at runtime. `LayerManager` hydrates properties once for each streamed content object, including tiles reloaded after eviction. The binary tiles remain unchanged; the enriched manifest is approximately 3.61 MiB uncompressed. Tests compare actual feature visibility and colors, verify camera continuity and deep links, and exercise desktop/mobile layouts. A local headless Chrome check at 1440×1000 with Noise active, the full manifest and eight streamed tiles measured 34.8 ms median / 39.5 ms p95 frame intervals (about 29 fps). This is not a cross-device frame-rate guarantee. The Cesium production bundle is still about 1.15 MB gzipped; the 7.26 MB uncompressed address index is loaded only when search is focused.

## Explore

- **Drag** to pan; **scroll / pinch** to zoom. Zoom buttons use proportional steps.
- **Shift-drag / right-drag** rotate and tilt. Rotation, north-reset and top-down/3D buttons are also available.
- **Keyboard:** focus the map, use arrows to pan, + / − to zoom, Home to reset. `/` focuses search. Space toggles timeline playback.
- **Search** official full street/place names or building addresses. A dated building search advances the timeline if needed to reveal that building.
- **Neighborhood shortcuts** fly to available geometry. Counts mean modeled buildings, not a complete neighborhood inventory.
- **Dusk / Daylight**, a label toggle, camera orbit, building inspection, and `?year=1900` sharing are included.
- **Unknown years** always stay visible in blue-gray in Age. Overview is the default; entering Age uses the earliest known year unless a URL year is supplied.



## Verified coverage


| Item                                     | Result                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Modeled buildings                        | 8,456 (2,674 from the 2019 crop + 1,407 west + 4,375 south/inner-city)   |
| Matched construction years               | 5,625                                                                    |
| Unknown years                            | 2,831: 2,724 unmatched, 107 missing dates                                |
| Neighborhoods with ≥10 modeled buildings | 30                                                                       |
| Geometry                                 | 8,456 LOD2 objects, 963,997 triangles                                    |
| Streaming                                | 59 spatial B3DM tiles; 78.0 MiB total                                    |
| Full official place labels               | 2,512, displayed by distance and screen-space collision checks           |
| Geometry snapshot                        | 26 March 2019 crop + 19 September 2026 citydb WFS increments             |
| Register / reference map retrieved       | 16 September 2026; increment register join 19 September 2026             |
| Dated range                              | 1765–2026; some register completion dates postdate the geometry snapshot |


Partial coverage: **Kruununhaka, Katajanokka, Kamppi, Punavuori, Etu-Töölö, Taka-Töölö, Ullanlinna, Kaivopuisto, Eira, Länsisatama, Lauttasaari, Meilahti, Pasila, Ruskeasuo, Kallio, Sörnäinen, Hermanni, Vallila, Kulosaari, Mustikkamaa-Korkeasaari, Herttoniemi, Alppiharju, Kumpula, Toukola, Kaartinkaupunki, Kluuvi, Laakso, Haaga, Munkkiniemi, and Suomenlinna**. Place search also includes subareas such as Kalasatama and Ruoholahti. Availability is constrained by the official models; blank areas are not filled with fabricated geometry. Next rings are north of Pasila and the remaining east. Citywide citydb hits remain 90,781.

## Rebuild the data

Run commands from this directory:

```sh
npm run data:fetch
npm run data:join
npm run data:convert
npm run data:map:fetch
npm run data:map:build
# or the full geometry, map, lens and address pipeline:
npm run data:prepare
# add unpublished INCREMENTS from the official citydb WFS, then rebuild the basemap and lenses:
npm run data:expand
```

Configuration is in `data-pipeline/config.js`. The 2019 crop / ENU origin is `LEGACY_BBOX` `[25497000, 6672400, 25500400, 6676900]`. Later strips are `INCREMENTS` (west, south, ruoholahti, northwest, lauttasaari). `BBOX` is their union; `MAP_BBOX` is a wider basemap rectangle so uncovered water stays clipped to official imagery. The original archive and WFS page cache stay under `data-pipeline/raw`; raw files are ignored by Git and are not needed to run the frontend. Default `data:expand` skips increments already recorded in `dataset.json`.

### Geometry and construction dates

1. Fetch `avoindata:Rakennukset_alue_rekisteritiedot` from [Helsinki WFS](https://kartta.hel.fi/ws/geoserver/avoindata/wfs), using stable `tietopalvelu_id` sorting and pagination. The current increment bbox returned 101,364 records, with 8,337 unique RATUs. Balcony and outline records without IDs do not create buildings.
2. Crop buildings by envelope center from the official archive. Exclude objects explicitly tagged as planned. Deduplicate GML IDs, keeping the higher LOD: the expanded crop has 2,735 records, 61 duplicate representations, and 245 excluded planned objects.
3. Join **CityGML** `Rakennustunnus_(RATU)` **→ WFS** `ratu`. Completion year is extracted from `c_valmpvm`. Keep unmatched/missing years null; contradictory duplicate register dates become unknown. Fail rather than publish a zero-match timeline.
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

The requested [CityGML index](https://3d.hel.ninja/data/citygml/) listed only `Helsinki3D_CityGML_Kalasatama_20190326.zip` at initial setup. Despite its name, its extent includes central/eastern neighborhoods. The [CityGML WFS](https://kartta.hel.fi/3d/citydb-wfs/wfs) returned capabilities but timed out on unpaged 10,000-feature requests. Paged `count=8` requests succeed and are used for each increment. Citywide `resultType=hits` reports 90,781 buildings; this increment does not ingest them all.

The archive server had an expired certificate. The cached archive was retrieved once with explicit public-data TLS bypass; reusable scripts **do not disable TLS validation**. If the certificate is still invalid, obtain the official archive through a trusted channel and provide an extracted file:

```sh
CITYGML_FILE=/absolute/path/to/export.gml npm run data:fetch
```

`npm run data:fetch -- --live` tries the official CityGML WFS and fails on timeout or declared truncation. It does not silently replace the cached snapshot.

## Validation

`npm test` checks ID normalization, missing/conflicting year joins, year boundaries, courtyard triangulation, **every feature ID/year in all generated binary tiles**, finite geographic positions, and map provenance/coverage.

The browser suite verifies actual pointer dragging, wheel and button zoom, rotation, top-down view, north reset, feature picking, timeline/playback, orbit, loaded-feature visibility against the HUD, labels, themes, neighborhood navigation, search, mobile layout, touch pan, and pinch zoom. Screenshots are saved to `artifacts/atlas-*.png`.

## Limitations

- Central/eastern geometry is from **2019**; later strips are the current official citydb WFS. Neither is a complete inventory or a reconstruction of demolished historical buildings. Buildings removed since 2019 may remain in the older tiles.
- Current register dates can reflect alterations/reconstruction and can postdate the model. They are retained as official recorded completion dates, not rewritten to fit the snapshot.
- Coverage is partial, including within listed neighborhoods. Neighborhood counts include unknown-year objects.
- N2000 source heights are retained numerically without a geoid-to-ellipsoid correction. The map is flat reference imagery on Cesium’s ellipsoid, not survey-grade terrain.
- Warm materials replace source textures. Binary year reveal is implemented; smooth per-building rise animation remains a stretch goal.

Data: **City of Helsinki, CC BY 4.0**. [Official geographic-data services](https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/make-better-use-of-geospatial-data/open-geographic-data) · [Building-register metadata](https://hri.fi/data/fi/dataset/helsingin-rakennukset).