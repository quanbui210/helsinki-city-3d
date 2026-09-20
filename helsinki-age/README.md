# Helsinki Lens

A 3D first stop before an apartment viewing: **see what the listing won’t tell you**. Search official Helsinki addresses, inspect a building, and switch between recorded age, modeled noise, building use, archived energy certificates and postal-area prices. Real geometry from official Helsinki and Espoo CityGML, with missing coverage made explicit. No synthetic buildings, inferred dates or AI calls. Optional listing discovery uses a small server-side search endpoint. Vantaa LOD2 is not openly available and is not extruded from 2D footprints.

## Run

### Optional listing discovery

A building card does **not** search listings until you click **View current listings**. Five address-and-site queries then cover Oikotie, Etuovi, SATO, Lumo and Vuokraovi. A 24-hour cache hit for that address still renders immediately, with no new request. Only search-provided titles, snippets and direct links are displayed, grouped by portal. Matches are **indexed search results**, not confirmed current listings or a match to a specific apartment. No portal pages, backends, images, prices or availability are scraped or parsed. Empty and failed searches are distinct states; existing building data renders immediately.

Add your key to the ignored **`.env.local` in the project root** (a blank template is provided in `.env.example`):

```dotenv
BRAVE_SEARCH_API_KEY=your-key-here
BRAVE_STORAGE_ALLOWED=true
LISTING_DAILY_LIMIT=100
```

Set `BRAVE_STORAGE_ALLOWED=true` **only if your Brave subscription grants storage rights**. Otherwise keep it `false`; searches still work but responses are not cached after completion. Brave documents the required [title, description and URL fields](https://api-dashboard.search.brave.com/api-reference/web/search/get) and its [search-result storage requirement](https://brave.com/search/api/). Never prefix the key with `VITE_`, put it in public files, or commit `.env.local`. Restart the dev/preview server after changing configuration.

With storage enabled, a bounded server-memory cache retains only title/snippet/URL/portal fields and check time for 24 hours, keyed by normalized full address. Restarting the server clears it. Errors/partial failures are not cached as empty results. Concurrent identical requests share one lookup. Changing lenses retains the open card's results. Limits are six address lookups per minute per client and per remote IP, at most three pending lookups globally, and 100 address lookups per server per day by default. Each address costs up to five search requests, paced at one per 1.1 seconds. Limits and cache are process-local; multiple production replicas need a shared quota/cache. No persistent browser cache or tracking identifiers are added.

`npm run dev` and `npm run preview` include the server endpoint. For production run **`npm run build` then `npm start`** (default port 3000). `server/start.js` serves both the built app and `/api/listings`; an HTTPS reverse proxy should preserve the Host header. A static-only host (CDN, GitHub Pages, Vercel without a function) still serves the map but `POST /api/listings` 404s and the card shows “Search is temporarily unavailable.” On Vercel, keep Root Directory as this app, deploy `api/listings.js`, and set `BRAVE_SEARCH_API_KEY` / `LISTING_DAILY_LIMIT` / `BRAVE_STORAGE_ALLOWED` on Production (exact names; `LISTING_DAILLY_LIMITIT` is ignored). Unconfigured keys, outages and rate limits show manual search links without blocking the record card. The address is sent only to this endpoint and Brave when you click View current listings, never on hover, map load, or record open. Helsinki and Espoo use their own city names; a postal code is included only when supplied by an official address result, not inferred from historical price polygons.

The manual fallback opens each portal's search page and offers a **Copy address** button. Stable address-prefill routes were not verified; no opaque search IDs or guessed URL parameters are generated. No shortlist/compare feature exists in this checkout, so this phase adds no shortlist indicator.

Validate with `npm run test:listings` and `npm run test:listings:browser`. Automated tests inject search responses to verify snippets, domain restrictions, expiry, deduplication, rate limits, cancellation and mobile UI without paid requests or portal fetching. A live search requires your locally configured key.

### Local map development

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
npm run test:prices   # postal polygons, building context and opt-in geolocation
```

Prepared static data is included in `viewer/public`. The map needs no Cesium ion account, API key or runtime map-service connection. Optional listing discovery requires its own server-side search key. Fonts use local system fallbacks, so the viewer makes no external font requests. The dev server must remain running while using the local preview.

## Data lenses

The atlas opens in **Overview**, with no data style, the full modeled city, and a slow orbit. Interaction stops the orbit, and reduced-motion preferences disable automatic motion. Overview is the default because Age would hide most buildings and the other lenses immediately assert a data claim. The bottom panel is a drawer: open by default with a five-lens chooser, collapsible to the tab bar when you want the map back. **Hide / Show** keeps that preference across tab changes. **Age** retains its original timeline filtering. **Use** groups official register purpose codes into five categories. **Noise** shows the 2022 study’s modeled Lden bands; **All** (default) is the highest available transport-mode band. Road, Rail, Metro and Tram isolate a single source. **Energy** shows 345 matched archived Helsinki certificate classes. Switching lenses preserves the camera, pauses timeline playback, and remembers each layer’s controls. Other lenses show all modeled buildings, independently of the stored Age year. Links preserve `year`, `layer`, and noise `mode`; use `?layer=age&year=1900` to open the timeline explicitly.

### Presentation and search

The building card now keeps its address, close button and live search-match summary in a fixed header. **Building & area** contains age, use, noise and price context; **Listings** opens search results directly and carries a result count. Incoming results never switch tabs or move focus. Selecting a different address resets the card; changing a data lens retains its tab and search. Source IDs and geometry metadata are under **Sources & record details**. Tabs support arrow keys, Home and End.

Selection adds a warm outline to the exact matched 3D feature and a small map marker. The outline attaches when a searched building streams in and clears when selection closes or changes. An unmatched address gets an explicitly labeled point, without outlining a nearby building. On mobile, the card is a bottom sheet; the layer drawer temporarily collapses and the address is reframed into the map above it. Closing restores the drawer. Run `npm run test:selection` for these interactions with mocked listing results.

Buildings retain neutral stone materials. Age keeps the original 40% blend and restrained palette. Noise, Energy and Use skip that desaturation and mix at 74% so adjacent classes stay separable on the stone. A depth-based screen-space pass adds brighter tinted architectural edges. Low-angle warm directional lighting, soft shadows cast onto the ground, and ambient occlusion add depth. The archive’s double-sided shells cast shadows but do not receive self-shadows to avoid acne. Terrain shadow depth bias uses a guarded Cesium 1.145 internal setting; verify it when upgrading Cesium.

Original facade textures and surveyed terrain are **not** included in this model. The neutral architectural material is a visual treatment, not a claim about actual facade material. Existing official coastline, water, streets, parks and block imagery provide the ground reference. It remains contemporary reference geography.

The prominent search uses a prepared, lazy-loaded offline geocoder containing **58,283 official** `Helsinki_osoiteluettelo` **address points**. Queries are debounced 180 ms and support Finnish/Swedish names and accent-insensitive matching. Search does not send addresses to an external service. Exact normalized address matches surface modeled building records; addresses without a modeled record get an explicit coverage message, never a nearest-building guess. Search and map clicks share the same record-rendering path. The card is docked inside the viewport, wraps long fields and scrolls vertically on small screens.

Every layer has a persistent legend. Gray means missing data, never verified quiet or efficient. Building inspection includes the use category/code or selected noise band. Layer coverage counts refer to the full modeled inventory, not just the viewport.

Noise uses Helsinki’s exact `db_lo` / `db_hi` ranges: 45–50 through 70–75 dB, plus the open-ended 75+ band. Official source colors stay in `layers.json` provenance. The viewer uses a sequential presentation scale and a stronger tile-color mix so adjacent bands stay separable on the stone material. **All means the highest available transport-mode band, not summed acoustic exposure or an average.** The official combined NPM layer uses LAeq, so it is not mixed with these Lden datasets.

The join samples the **CityGML envelope center**, using Turf point-in-polygon with a bounding-box prefilter, polygon holes respected, and the highest band winning overlaps/boundary ties. It is an approximate building-location sample, not a footprint intersection, facade measurement, or an indoor noise estimate. No nearest-zone inference is made. Road matches 5,516 buildings, tram 1,891, metro 263 and rail 339 of the 16,251 modeled buildings. Helsinki noise polygons do not cover Espoo; those buildings stay unknown. Use codes are available for 5,284 Helsinki-register buildings.

Use mappings follow Helsinki’s [RA_KAYTTARK code list, pages 8–9](https://kartta.hel.fi/avoindata/dokumentit/Rakennusrekisteri_avoindata_metatiedot_20160601.pdf), using the 1994 classification rather than assuming the newer 2018 classification. The five groups are an atlas presentation choice; “civic” does not imply public ownership. Undocumented codes remain unknown, separately from documented “Other” codes.

### Postal-area price and rent context

**Price** adds translucent ground polygons while buildings retain their neutral materials. Switch between **Sale price** and **Rent**; hover or tap a polygon for its postal name, value and quarter-over-quarter change. `?layer=price&metric=rent` opens the rent view directly. Building cards always include age, use, modeled noise, archived energy and both area-price metrics, even when another lens is selected. A building's purpose does not establish tenure, so neither metric is silently preferred.

The benchmark is explicitly **two-room flats**, because the postal tables publish separate room categories and no all-room average. Sale covers old dwellings in blocks of flats; rent covers non-subsidised two-room dwellings. These are area averages, not individual valuations. QoQ is calculated from adjacent published quarterly averages, not a quality-adjusted index; the mix of homes can change.

The 19 September 2026 refresh verified the [live StatFin API](https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin) listings before selecting tables. Sale table **13mt** reaches **Q1 2026 (provisional)**. The current rent tables contain larger regions, not postal areas; the latest postal rent table **13eb** is in **StatFin_Passiivi**, ending **Q4 2025**. This archived period is labeled in the UI. It is never replaced with a city-level average or represented as a 2026 rent figure.

`viewer/public/price-by-area.json` contains 130 Helsinki/Espoo postal areas, 48 reported sale values and 51 reported rent values, with source URLs, release dates, selections and methodology. Suppressed/unavailable observations remain null and display **Insufficient data**; missing adjacent observations produce **QoQ unavailable**. Raw queries and JSON-stat responses are cached under `data-pipeline/raw/prices-*.json`. Leading-zero postal codes remain strings.

Geometry comes from [Statistics Finland's postal-area WFS](https://geo.stat.fi/geoserver/postialue/wfs?service=WFS&version=2.0.0&request=GetCapabilities). Each metric uses the classification named in its source metadata: `pno_2022` for sale (`geometry`) and `pno_2018` for rent (`rentGeometry`). Each building position is joined separately against those polygons, respecting holes and multipart areas. A changed postal boundary can therefore yield different sale and rent area labels. Attribution: **Statistics Finland, CC BY 4.0**.

The secondary **Use my location** control next to search requests browser location only on click. Denial, unavailability, timeout and positions outside Helsinki silently leave the view alone. A rough Helsinki bounding box is followed by a polygon check against 60 official `avoindata:Kaupunginosajako` districts, prepared in `map/district-boundaries.json`. Successful lookup flies to the position and shows a dismissible district card. Coordinates are neither stored nor sent to a geocoder or included in sharing URLs. Browser geolocation requires localhost or HTTPS. Location does not imply complete 3D coverage.

Refresh these assets independently of the geometry with `npm run data:prices`; it discovers the live tables, retains source boundary vintages, and refreshes the district polygons. `data:prepare` includes this step. The frontend uses only prepared local files; no API keys or runtime statistics requests are needed.

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
| Modeled buildings                        | 16,251 (8,456 Helsinki + 7,795 Espoo east)                               |
| Matched construction years               | 13,142                                                                   |
| Unknown years                            | 3,109                                                                    |
| Neighborhoods with ≥10 modeled buildings | 30 Helsinki districts                                                    |
| Geometry                                 | 15,922 LOD2 + 329 LOD1 objects, 1,751,045 triangles                      |
| Streaming                                | 87 spatial B3DM tiles; 141.8 MiB total                                   |
| Full official place labels               | 3,449, displayed by distance and screen-space collision checks           |
| Geometry snapshot                        | 26 March 2019 crop + 19 September 2026 Helsinki citydb + Espoo LOD2 WFS  |
| Register / reference map retrieved       | 16 September 2026; Espoo years from CityGML 19 September 2026            |
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
# official City of Espoo LOD2 WFS (Otaniemi / Keilaniemi / Westend):
npm run data:expand:espoo
```

Configuration is in `data-pipeline/config.js`. The 2019 crop / ENU origin is `LEGACY_BBOX` `[25497000, 6672400, 25500400, 6676900]`. Helsinki strips are `INCREMENTS`. Espoo strips are `ESPOO_INCREMENTS`. `BBOX` is the Helsinki union; `MAP_BBOX` is a wider basemap rectangle so uncovered water stays clipped to official imagery (west edge `25480000` to include Otaniemi). Espoo WFS 1.1.0 ignores `startIndex`, so fetch tiles by quad-split. Espoo buildings have no `gml:Envelope`; centers come from solid coordinates. The original archive and WFS page cache stay under `data-pipeline/raw`; raw files are ignored by Git and are not needed to run the frontend. Default expand scripts skip increments already recorded in `dataset.json`.

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

- Central/eastern geometry is from **2019**; later Helsinki strips are the current official citydb WFS; eastern Espoo is the official City of Espoo LOD2 WFS. None of these is a complete inventory or a reconstruction of demolished historical buildings. Buildings removed since 2019 may remain in the older tiles. Vantaa 3D CityGML is sold (LOD2 on the city hinnasto); the public HRI/WFS building layer is 2D and is not extruded.
- Current register dates can reflect alterations/reconstruction and can postdate the model. They are retained as official recorded completion dates, not rewritten to fit the snapshot.
- Coverage is partial, including within listed neighborhoods. Neighborhood counts include unknown-year objects.
- N2000 source heights are retained numerically without a geoid-to-ellipsoid correction. The map is flat reference imagery on Cesium’s ellipsoid, not survey-grade terrain.
- Warm materials replace source textures. Binary year reveal is implemented; smooth per-building rise animation remains a stretch goal.

Data: **Cities of Helsinki and Espoo, CC BY 4.0**. [Official geographic-data services](https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/make-better-use-of-geospatial-data/open-geographic-data) · [Building-register metadata](https://hri.fi/data/fi/dataset/helsingin-rakennukset) · [Espoo CityGML WFS](https://kartat.espoo.fi/teklaogcweb/wfs.ashx).

## Public street parking

The Parking lens uses City of Helsinki WFS layers Pysakointipaikat_alue, Pysakoinnin_maksuvyohykkeet_alue and the separate Asukas_ja_yrityspysakointivyohykkeet_alue. Source: https://kartta.hel.fi/paikkatietohakemisto/pth/?id=436 (CC BY 4.0). Run npm run data:parking to refresh; append -- --offline to reuse the raw cache. Request URLs and retrieval times are retained in viewer/public/parking.json.

Counts sum the source's area-derived integer capacity (paikat_ala), not polygon counts. A segment is included when its bounding-box centre lies within 200 metres straight-line distance of the building/address point. This is an approximation, not a walking route. Zero/missing source capacities are unreported, not verified empty segments. Restricted uses are separate categories; bicycle/scooter areas, parklets and explicit parking prohibitions are excluded. Permit-or-metered and permit-or-timed classes remain distinct; no resident-only assumption is made. Data is scoped to the map rectangle with a margin exceeding the radius. Both manifests receive nearbyParkingSpots, parkingSpotBreakdown, residentZoneId, paidZoneId and coverage counters. Polygon holes are respected.

Ground washes show paid/resident zones; overlapping translucent colors indicate both. Street-segment dots fade between 400 and 1,800 metres camera distance. Buildings stay neutral. The Building & area tab provides estimates, restriction breakdown, zone membership, a map shortcut and a permanent disclaimer about dedicated building parking. Missing data outside central Helsinki is a coverage gap. Check signs; zone membership does not establish permit eligibility.

The public Parkkiopas root and parking-area endpoint were reachable during implementation (https://pubapi.parkkiopas.fi/public/v1/; docs https://api.parkkiopas.fi/docs/public/). Capacity can be null, and the statistics request timed out. Complete live free-space availability was not verified, so no live indicator is shown and payment activity is not converted into free-space claims.

Validation: npm test, npm run build, npm run test:parking. Browser tests mock listing search to avoid paid API calls.

Listing request control: uncached records stay idle until View current listings. Closing the card aborts an active browser fetch. Complete search results use a bounded 300-address memory/localStorage cache with a 24-hour TTL measured from checkedAt, so server-cached responses do not receive an extended lifetime. Cache hits render before any request. localStorage access tolerates blocked storage, quota errors and malformed JSON. Keys use normalized addresses including city/postcode. In-flight promises deduplicate by key; aborted promises are not reused, and guarded cleanup cannot remove a replacement request. The server continues deduplicating upstream work after browser cancellation; cancellation does not refund already dispatched searches. Client persistence follows the listing-search addendum; server-side retention remains controlled by BRAVE_STORAGE_ALLOWED. Run npm run test:listings:cache for mocked cost-control checks.

### Tiered point layers

LayerManager owns a shared TieredPointRenderer for modules opting into renderMode: tiered-points. Supply tieredPoints.points (id/position), aggregate(points) (GeoJSON polygons plus metric), areaColor(metric), pointColor(point), countLabel, onCluster and optional describePoint. A future permits or recreation layer supplies data/metrics/colors, not a new clustering implementation. Camera range comes from MapNavigation. Smoothstep weights crossfade areas/clusters over 2,200–3,400 m and clusters/points over 650–1,100 m. Screen-space 96 px bins rebuild on camera/viewport changes; each point belongs to exactly one visible cluster. Cluster counts mean source records, not estimated bay capacities. Clicking clusters zooms in; clicking street dots gives record details.

Parking overview aggregates mapped segment counts in approximately 500 m cells (0.009° longitude × 0.0045° latitude at Helsinki). Color scale caps at 80 segments per cell. It is mapped-record density, not demand, availability or a parking-pressure estimate. Outlined occupied cells show the observed record footprint at all zoom levels; unshaded areas are unverified. No complete-survey boundary or confirmed zero-parking area can be inferred from this source. This supersedes the earlier always-on permit/paid ground wash; permit/paid/both colors now belong to street points. Buildings remain neutral. Test with npm run test:parking:tiers.
