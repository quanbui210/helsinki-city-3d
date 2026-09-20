import {ParkingAreas} from './ParkingAreas.js';
import {createParkingLayer} from './layers/parkingLayer.js';
import {BuildingPanel} from './ui/BuildingPanel.js';
import {BuildingSelection} from './BuildingSelection.js';
import overviewLayer from './layers/overviewLayer.js';
import {createPriceLayer} from './layers/priceLayer.js';
import {PriceAreas} from './PriceAreas.js';
import {setupLocation} from './ui/LocationControl.js';
import {ListingSearch} from './ui/ListingSearch.js';
import {presentLayer} from './layers/palette.js';
import {setupAppearance} from './SceneAppearance.js';
import {AddressSearch} from './ui/AddressSearch.js';
import buildingUseLayer from './layers/buildingUseLayer.js';
import energyLayer from './layers/energyLayer.js';
import {createNoiseLayer,selectedBand,bandLabel,modes} from './layers/noiseLayer.js';
import {LayerSwitcher} from './ui/LayerSwitcher.js';
import {useCategories} from './layers/useCategories.js';
import ageLayer from './layers/ageLayer.js';
import {LayerManager} from './LayerManager.js';
import * as C from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import './lens.css';
import {YearSlider,visibleAt,initialYear} from './YearSlider';
import {MapNavigation} from './MapNavigation';
import {MapContext} from './MapContext';
const svg=(path)=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const icons={home:svg('<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8"/>'),search:svg('<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>'),layers:svg('<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>'),sun:svg('<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'),moon:svg('<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>')};
document.querySelector('#app').innerHTML=`
<div id="scene"></div><div class="vignette"></div><div id="map-labels" aria-hidden="true"></div>
<header><a class="brand" href="/" aria-label="Helsinki Lens home"><span class="brand-mark">H<span>↗</span></span><span>Helsinki Lens<span class="brand-sub">SEE WHAT THE LISTING WON’T TELL YOU</span></span></a>
<div class="search-wrap"><span>${icons.search}</span><label class="sr-only" for="map-search">Find a street, building or neighborhood</label><input id="map-search" placeholder="Find a street, building or neighborhood" autocomplete="off" aria-controls="search-results" aria-expanded="false"><kbd>/</kbd><div id="search-results" hidden></div></div>
<button id="about" class="text-button">About Lens <span>↗</span></button></header>
<section id="data-layers" class="data-layers" aria-label="Explore data layers"></section>
<main class="intro"><div class="eyebrow"><span class="short-rule"></span> BEFORE YOUR NEXT VIEWING</div><h1>A city. Centuries<br>in the making.</h1><p>Explore Helsinki and eastern Espoo’s surviving architecture,<br>one year and one neighborhood at a time.</p></main>
<aside class="explore-panel"><div class="panel-heading"><span class="eyebrow">EXPLORE NEIGHBORHOODS</span><span id="district-count" class="small-pill">—</span></div><div id="districts" class="districts"></div><p class="coverage-note">Partial 3D coverage · Helsinki + Espoo official models</p><div class="panel-divider"></div><div class="layer-heading"><span>${icons.layers} Map appearance</span><button id="labels-toggle" aria-pressed="true">Labels <span>ON</span></button></div><div class="theme-switch"><button data-theme="dusk" aria-pressed="true">${icons.moon} Dusk</button><button data-theme="day" aria-pressed="false">${icons.sun} Daylight</button></div><div class="location"><span class="location-dot">⌖</span><span id="area">Kruununhaka</span></div></aside>
<aside class="era-card"><div class="eyebrow">HELSINKI IN</div><div class="era-year" id="era-year">—</div><div id="era-name">Loading timeline</div><div class="era-divider"></div><div class="metric"><strong id="visible-count">—</strong><span>buildings revealed</span></div><div class="coverage"><span id="coverage-bar"></span></div><small id="count-detail">Loading verified city data…</small></aside>
<nav class="map-tools" aria-label="Map controls"><button id="home" title="Reset camera" aria-label="Reset camera">${icons.home}</button><span></span><button id="zoom-in" title="Zoom in (+)" aria-label="Zoom in">+</button><button id="zoom-out" title="Zoom out (−)" aria-label="Zoom out">−</button><span></span><button id="perspective" aria-label="Toggle top-down view" title="Switch 2D / 3D view">2D</button><button id="rotate-left" aria-label="Rotate left" title="Rotate left">↶</button><button id="rotate-right" aria-label="Rotate right" title="Rotate right">↷</button><button id="orbit" aria-label="Automatic camera orbit" title="Automatic orbit" aria-pressed="false">↻</button></nav>
<div class="north"><button id="north" aria-label="Face north" title="Face north"><span>N</span><svg id="compass-arrow" width="24" height="34" viewBox="0 0 24 38" aria-hidden="true"><path d="M12 0 21 30 12 23Z" fill="#e2c4a0"/><path d="M12 0 3 30 12 23Z" fill="#687e83"/></svg></button></div>
<div class="map-caption"><span class="scale-line"></span><span id="map-scale">200 m</span><span class="map-instructions">Drag to explore <i>·</i> Scroll to zoom <i>·</i> Shift + drag to rotate</span></div>
<section class="timeline" aria-label="Construction year timeline"><div class="timeline-top"><div><span class="eyebrow">WATCH THE CITY GROW</span><span class="timeline-hint">Drag the timeline to reveal its history</span></div><div class="legend"><span><i class="warm"></i>Built by <b id="legend-year">—</b></span><span><i class="gray"></i>Year unknown</span></div></div>
<div class="timeline-main"><button id="play" class="play" aria-label="Play timeline" aria-pressed="false" disabled>▶</button><div class="year-current"><strong id="year-current">—</strong><span>SELECTED YEAR</span></div><div class="scrubber"><div id="histogram" class="histogram" aria-hidden="true"></div><label class="sr-only" for="year">Construction year</label><input id="year" type="range" min="1765" max="2026" value="2026" disabled><div id="ticks" class="ticks"></div></div><label class="speed"><span>PLAYBACK</span><select id="speed" aria-label="Playback speed"><option value="5">5 yr / sec</option><option value="12" selected>12 yr / sec</option><option value="30">30 yr / sec</option></select></label></div>
<div class="timeline-bottom"><span><span class="tiny-dot"></span> REAL BUILDINGS. REAL CONSTRUCTION YEARS.</span><button class="text-button" id="share">Share this year <span>↗</span></button></div></section>
<footer><span>Official building geometry · Present-day reference map · Not a historical reconstruction</span><button id="sources" class="text-button">© Helsinki and Espoo · CC BY 4.0 <span>↗</span></button></footer>
<div id="loading" class="loading"><div class="loader"></div><strong>Helsinki Lens</strong><span>Finding the city behind the listing</span></div>
<aside id="building-card" class="building-card" hidden><button id="close-building" class="close" aria-label="Close building details">×</button><div class="eyebrow">BUILDING RECORD</div><h2 id="building-address"></h2><div id="building-year"></div><dl><dt>Building type</dt><dd id="building-purpose"></dd><dt>Register ID · RATU</dt><dd id="building-ratu"></dd><dt>Geometry detail</dt><dd id="building-lod"></dd></dl><p id="building-layer-value"></p><p id="building-status"></p><button id="building-prompt" class="lens-prompt" hidden>See how loud this street is →</button></aside>
<dialog id="about-dialog"><button class="close" id="close-about" aria-label="Close about dialog">×</button><div class="eyebrow">ABOUT HELSINKI LENS</div><h2>A clearer view.<br>Before the viewing.</h2><p>Explore real CityGML buildings from Helsinki and eastern Espoo. Helsinki dates join the building register by RATU; Espoo years come from the CityGML record. No buildings or dates are invented.</p><div class="dialog-stats" id="data-stats"></div><h3>More of the city, honestly represented</h3><p>Central and eastern Helsinki tiles are the <strong>26 March 2019</strong> Kalasatama CityGML crop. Later inner-city strips (Kamppi, Töölö, Ruoholahti, Lauttasaari, Ullanlinna, Pasila and neighbours) come from the official Helsinki city information model WFS. Otaniemi, Keilaniemi and Westend come from the official City of Espoo CityGML LOD2 WFS. Neighborhood shortcuts use Helsinki districts only. Vantaa LOD2 is not openly available, so it is not extruded from 2D footprints. Planned objects are excluded; demolished buildings may remain in the 2019 tiles.</p><p>Land, water, parks, streets and names come from Helsinki’s <strong>present-day reference map</strong>. These layers stay fixed as the building timeline changes. Modern building footprints are omitted from the basemap to keep the year reveal clear.</p><p>This is <strong>not a reconstruction of historical Helsinki</strong>. Buildings demolished before the geometry snapshot are absent. Unknown completion years always remain visible in gray. Source N2000 heights are retained without geoid correction or a surveyed terrain model.</p><h3>Explore with mouse, touch or keyboard</h3><p>Drag to pan. Scroll or pinch to zoom. Shift-drag or right-drag to rotate and tilt. Focus the map and use arrow keys to pan, + / − to zoom, or Home to reset. Press Space to play the timeline. Use the search to find a building, street or neighborhood.</p><h3>Sources</h3><ul><li><a href="https://3d.hel.ninja/data/citygml/" target="_blank" rel="noopener">Helsinki 3D City Model ↗</a></li><li><a href="https://hri.fi/data/fi/dataset/helsingin-rakennukset" target="_blank" rel="noopener">Helsinki building register ↗</a></li><li><a href="https://kartat.espoo.fi/teklaogcweb/wfs.ashx" target="_blank" rel="noopener">Espoo CityGML LOD2 WFS ↗</a></li><li><a href="/dataset.json" target="_blank" rel="noopener">Geometry and join provenance ↗</a></li><li><a href="/map/context.json" target="_blank" rel="noopener">Map labels and geographic provenance ↗</a></li></ul><p class="fine-print">Cities of Helsinki and Espoo · CC BY 4.0. Real CityGML geometry with neutral stone materials. Original facade textures are not included. Data lenses add a soft tint; these are not measured facade appearances.</p></dialog><div id="toast" role="status"></div>`;
const $=s=>document.querySelector(s);
let viewer,tileset,manifest,slider,summary,nav,mapContext,selected,layerManager,layerSwitcher,appearance,selectionRecord,priceAreas,parkingAreas;
const locationButton=document.createElement('button');locationButton.id='use-location';locationButton.type='button';locationButton.title='Use my location';locationButton.setAttribute('aria-label','Use my location');locationButton.textContent='⌖';locationButton.disabled=true;$('.search-wrap').insertBefore(locationButton,$('#search-results'));
const locationCard=document.createElement('aside');locationCard.id='location-card';locationCard.className='context-card';locationCard.hidden=true;locationCard.setAttribute('aria-live','polite');$('#app').append(locationCard);
const areaCard=document.createElement('aside');areaCard.id='price-area-card';areaCard.className='context-card';areaCard.hidden=true;areaCard.setAttribute('aria-label','Postal area prices');$('#app').append(areaCard);
const priceContext=document.createElement('section');priceContext.id='building-price-context';$('#building-status').before(priceContext);
const listingContext=document.createElement('section');listingContext.id='building-listings';$('#building-status').after(listingContext);const parkingContext=document.createElement('section');parkingContext.id='building-parking-context';priceContext.after(parkingContext);
const buildingPanel=new BuildingPanel($('#building-card'));const listingSearch=new ListingSearch(listingContext,(state,count)=>buildingPanel.status(state,count));buildingPanel.requestSearch=()=>listingSearch.search();
let buildingSelection,mobileDrawerWasOpen;
function compactForSelection(){if(selectionRecord&&innerWidth<=700&&mobileDrawerWasOpen===undefined&&layerSwitcher){mobileDrawerWasOpen=layerSwitcher.open;layerSwitcher.open=false;layerSwitcher.syncOpen();}}
window.addEventListener('resize',()=>{compactForSelection();if(selectionRecord)buildingSelection?.revealOnMobile(nav,$('#building-card'));});
const fitRecordCard=()=>document.documentElement.style.setProperty('--lens-top',`${$('#data-layers').getBoundingClientRect().top}px`);
new ResizeObserver(fitRecordCard).observe($('#data-layers'));window.addEventListener('resize',fitRecordCard);
let areaPinned=false;
const loadedContents=new Map();const now=new Date().getFullYear();
const era=year=>year<1800?'The earliest surviving layers':year<1850?'An emerging capital':year<1900?'A city taking shape':year<1940?'A new urban century':year<1970?'The post-war city':year<2000?'A modern capital':'The contemporary city';
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function closeSelection(preserveSearch=false){if(preserveSearch!==true){listingSearch.close();if(mobileDrawerWasOpen!==undefined&&layerSwitcher){layerSwitcher.open=mobileDrawerWasOpen;layerSwitcher.syncOpen();mobileDrawerWasOpen=undefined;}}if(selected){try{selected.color=C.Color.WHITE;}catch{/* A streamed tile may have been evicted. */}selected=undefined;tileset?.makeStyleDirty();}selectionRecord=null;buildingSelection?.clear();$('#building-card').hidden=true;$('#building-prompt').hidden=true;}
function styleBuildings(){if(!layerManager||!slider)return;layerManager.update({year:slider.year,day:mapContext?.theme==='day'});layerSwitcher?.render();}
function update(year){closeSelection();const visible=manifest.filter(b=>visibleAt(b,year)).length;for(const id of ['era-year','year-current','legend-year'])$(`#${id}`).textContent=year;$('#era-name').textContent=era(year);$('#visible-count').textContent=visible.toLocaleString();$('#count-detail').textContent=`of ${manifest.length.toLocaleString()} in the model · ${summary.unknown} unknown years`;
 $('#coverage-bar').style.width=`${visible/manifest.length*100}%`;$('#year').style.setProperty('--progress',`${(year-slider.min)/(slider.max-slider.min)*100}%`);document.querySelectorAll('.histogram i').forEach(bar=>bar.classList.toggle('active',Number(bar.dataset.year)<=year));styleBuildings();const url=new URL(location.href);url.searchParams.set('year',year);history.replaceState(null,'',url);
}
function showBuilding(record,feature){
 closeSelection(true);if(!record){listingSearch.close();return;}selectionRecord=record;nav.orbit=false;
 if(feature){selected=feature;feature.color=C.Color.fromCssColorString('#f8efc7');}
 $('#building-card').hidden=false;buildingPanel.open(record);compactForSelection();buildingSelection?.show(record,loadedContents);$('#building-address').textContent=record.address||'An unnamed building';
 $('#building-year').textContent=record.constructionYear??'Year unknown';
 const category=useCategories.find(c=>c.id===record.useCategory);
 $('#building-purpose').textContent=category?category.label+' · '+record.useCode:'Not recorded';
 $('#building-ratu').textContent=record.ratu||'Not matched';$('#building-lod').textContent=record.lod?'LOD'+record.lod+' · CityGML':'No modeled geometry';
 const noiseMode=layerManager.activeId==='noise'?layerManager.state.mode:'combined';
 $('#building-layer-value').textContent='Modeled noise · '+modes[noiseMode]+' · '+bandLabel(selectedBand(record,noiseMode))+' · 2022 Lden'+(noiseMode==='combined'?' (highest available transport band, not total exposure)':' (building-center sample)')+'. '+(record.energy?'Archived class '+record.energy.class+' (2013 scheme) · issued '+(record.energy.issued??'unknown')+' · expires '+(record.energy.expires??'unknown'):'No archived energy certificate matched.');
 priceAreas?.buildingContext(priceContext,record.position);parkingAreas?.buildingContext(parkingContext,record.position,()=>switchLayer('parking'));areaCard.hidden=true;areaPinned=false;locationCard.hidden=true;
 listingSearch.show({address:record.address,city:record.geometrySource==='espoo-wfs'?'Espoo':'Helsinki',postalCode:record.postcode??''});
 requestAnimationFrame(()=>{fitRecordCard();buildingSelection?.revealOnMobile(nav,$('#building-card'));});
 $('#building-status').textContent=record.buildingId?`Geometry: ${record.geometrySource==='espoo-wfs'?'official Espoo CityGML':record.geometrySource==='citydb-wfs'?'official Helsinki city information model':'2019 snapshot'}. Register and modeled noise are context for a viewing, not a current building inspection.`:'Official Helsinki address point. No 3D building record is matched at this address; no age, noise or energy value is inferred.';
 const [west,south,east,north]=mapContext.data.rectangle;
 if(record.position&&(record.position[0]<west||record.position[0]>east||record.position[1]<south||record.position[1]>north))$('#building-status').textContent+=' This address is outside the prepared reference map; the blank background does not describe its actual surroundings.';
 $('#building-prompt').hidden=!record.buildingId;
}
function featureFor(record){for(const content of loadedContents.values())for(let i=0;i<content.featuresLength;i++){const f=content.getFeature(i);if(f.getProperty('buildingId')===record.buildingId)return f;}}
function selectSearchResult(item){
 nav.orbit=false;
 if(item.place){navigate(item.position,item.range);return;}
 const record=item.buildingId?layerManager.records.get(item.buildingId):{address:item.name,position:item.position,postcode:item.postcode};
 if(layerManager.activeId==='age'&&record.constructionYear>slider.year)slider.set(record.constructionYear);
 nav.flyTo(item.position,item.range);showBuilding(record,featureFor(record));
}
function switchLayer(id,patch={}){
 if(!layerManager.layers.has(id))id='overview';
 const retained=selectionRecord;closeSelection(Boolean(retained));slider.pause();nav.orbit=false;layerManager.activate(id);layerManager.update({...patch,year:slider.year,day:mapContext?.theme==='day'});
 document.body.dataset.layer=id;
 $('.intro h1').innerHTML=id==='age'?'Every building<br>has a past.':'See beyond<br>the listing.';
 $('.intro p').textContent=id==='overview'?'Find an address. Get to know the place before you walk through the door.':'One place, a different perspective. Official records, with the gaps made visible.';
 $('.timeline').hidden=id!=='age';$('.era-card').hidden=id!=='age';
 // Cesium restyles visible tiles lazily. Clear cached feature overrides as well
 // so returning to either neutral view never keeps a previous lens tint.
 if(id==='overview'||id==='price'||id==='parking'){
   const reset=content=>{for(const inner of content.innerContents??[])reset(inner);for(let i=0;i<(content.featuresLength??0);i++){const f=content.getFeature(i);f.show=true;f.color=C.Color.WHITE;}};
   for(const content of loadedContents.values())reset(content);
 }
 layerSwitcher?.render();appearance?.refresh(loadedContents,id);if(retained)showBuilding(retained,featureFor(retained));
 priceAreas?.set(id==='price',layerManager.state.metric);parkingAreas?.set(id==='parking');areaCard.hidden=true;areaPinned=false;
 const url=new URL(location.href);url.searchParams.set('layer',id);if(id==='noise')url.searchParams.set('mode',layerManager.state.mode);else url.searchParams.delete('mode');if(id==='price')url.searchParams.set('metric',layerManager.state.metric);else url.searchParams.delete('metric');history.replaceState(null,'',url);
}
function nearestArea(lon,lat){const areas=mapContext?.data.neighborhoods||[];return areas.reduce((best,n)=>{const distance=Math.hypot((n.position[0]-lon)*.5,n.position[1]-lat);return !best||distance<best.distance?{...n,distance}:best;},null);}
function navigate(position,range=1800){closeSelection();areaCard.hidden=true;areaPinned=false;locationCard.hidden=true;nav.flyTo(position,range);}
async function init(){
 const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`Could not load ${url} (${r.status})`);return r.json();};
 let context,layerData,priceData,parkingData;[manifest,summary,context,layerData,priceData,parkingData]=await Promise.all([get('/buildings-manifest.json'),get('/dataset.json'),get('/map/context.json'),get('/layers.json'),get('/price-by-area.json'),get('/parking.json')]);
 viewer=new C.Viewer('scene',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,skyBox:false,skyAtmosphere:false,scene3DOnly:true,requestRenderMode:false,contextOptions:{webgl:{alpha:false}}});
 viewer.scene.backgroundColor=C.Color.fromCssColorString('#102c38');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#102e3c');viewer.scene.globe.showGroundAtmosphere=false;viewer.scene.globe.enableLighting=false;viewer.scene.globe.depthTestAgainstTerrain=false;viewer.scene.fog.enabled=false;
 if(viewer.scene.sun)viewer.scene.sun.show=false;if(viewer.scene.moon)viewer.scene.moon.show=false;
 const frame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...summary.center));const direction=C.Matrix4.multiplyByPointAsVector(frame,new C.Cartesian3(.5,.3,-.8),new C.Cartesian3());
 viewer.scene.light=new C.DirectionalLight({direction:C.Cartesian3.normalize(direction,direction),intensity:2.3});viewer.scene.postProcessStages.fxaa.enabled=true;viewer.resolutionScale=Math.min(devicePixelRatio,1.5);
 mapContext=new MapContext(viewer,context);
 nav=new MapNavigation(viewer,state=>{const area=nearestArea(state.lon,state.lat);$('#area').textContent=area&&area.distance<.012?area.name:'Helsinki · reference map';$('#orbit').setAttribute('aria-pressed',String(nav?.orbit||false));$('#compass-arrow').style.transform=`rotate(${-state.heading}deg)`;$('#perspective').textContent=state.pitch<-75?'3D':'2D';if(nav){const m=nav.metersPerPixel()*70;$('#map-scale').textContent=m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m/10)*10} m`;}});
 tileset=await C.Cesium3DTileset.fromUrl('/tileset/tileset.json',{maximumScreenSpaceError:8,cacheBytes:128*1024*1024});viewer.scene.primitives.add(tileset);appearance=setupAppearance(viewer,tileset,summary.center);buildingSelection=new BuildingSelection(viewer,tileset);
 let edgesDirty=false;tileset.tileVisible.addEventListener(tile=>{if(tile.content?.featuresLength&&!loadedContents.has(tile.content.url)){loadedContents.set(tile.content.url,tile.content);edgesDirty=true;}});tileset.tileUnload.addEventListener(tile=>{loadedContents.delete(tile.content.url);edgesDirty=true;});viewer.scene.postRender.addEventListener(()=>{if(edgesDirty&&layerManager){edgesDirty=false;appearance.refresh(loadedContents,layerManager.activeId);}});tileset.tileFailed.addEventListener(error=>toast(`A city tile could not load. ${error.message}`));
 priceAreas=new PriceAreas(viewer,priceData);parkingAreas=new ParkingAreas(viewer,parkingData);
 layerManager=new LayerManager({tileset,viewer,getRange:()=>nav.state.range,layers:[overviewLayer,ageLayer,createNoiseLayer(layerData),energyLayer,buildingUseLayer,createPriceLayer(priceData),createParkingLayer(parkingData,points=>{const lon=points.reduce((s,p)=>s+p.position[0],0)/points.length,lat=points.reduce((s,p)=>s+p.position[1],0)/points.length;nav.flyTo([lon,lat],Math.max(350,nav.state.range*.5));})].map(presentLayer),manifest});
 const min=summary.minYear,max=now,binCount=80,counts=Array(binCount).fill(0);manifest.forEach(b=>{if(b.constructionYear!==null)counts[Math.min(binCount-1,Math.floor((b.constructionYear-min)/(max-min)*binCount))]++;});const peak=Math.max(...counts);
 $('#histogram').innerHTML=counts.map((n,i)=>`<i data-year="${min+(i+1)*(max-min)/binCount}" style="height:${n?Math.max(6,n/peak*100):2}%"></i>`).join('');$('#ticks').innerHTML=[min,...[1800,1850,1900,1950,2000].filter(y=>y>min+10&&y<max-12),max].map(y=>`<span style="left:${(y-min)/(max-min)*100}%">${y}</span>`).join('');
 slider=new YearSlider({input:$('#year'),play:$('#play'),speed:$('#speed'),min,max,onChange:update});slider.set(initialYear(location.search,min,max));$('#play').disabled=false;$('#year').disabled=false;$('#data-stats').textContent=`${manifest.length.toLocaleString()} buildings · ${summary.joined.toLocaleString()} known years · ${context.neighborhoods.length} neighborhoods`;
 const order=['Kruununhaka','Katajanokka','Kamppi','Punavuori','Etu-Töölö','Taka-Töölö','Ullanlinna','Kaivopuisto','Länsisatama','Lauttasaari','Meilahti','Pasila','Kallio','Sörnäinen','Hermanni','Vallila'];context.neighborhoods.sort((a,b)=>(order.indexOf(a.name)<0?100:order.indexOf(a.name))-(order.indexOf(b.name)<0?100:order.indexOf(b.name))||b.count-a.count);
 $('#district-count').textContent=context.neighborhoods.length;
 for(const n of context.neighborhoods){const button=document.createElement('button');button.className='district-button';const name=document.createElement('span'),count=document.createElement('small');name.textContent=n.name;count.textContent=n.count;button.append(name,count);button.title=`Explore ${n.name}: ${n.count} modeled buildings, partial coverage`;button.onclick=()=>{document.querySelectorAll('.district-button').forEach(b=>b.classList.remove('active'));button.classList.add('active');navigate(n.position,1900);};$('#districts').append(button);}
 layerSwitcher=new LayerSwitcher({container:$('#data-layers'),manager:layerManager,onChange:switchLayer});
 const params=new URLSearchParams(location.search);const mode=params.get('mode');switchLayer(params.get('layer')||'overview',{...(Object.hasOwn(modes,mode)?{mode}:{}),metric:params.get('metric')==='rent'?'rent':'sale'});
 new AddressSearch({input:$('#map-search'),results:$('#search-results'),manifest,context,onSelect:selectSearchResult,onFocus:()=>{nav.orbit=false;}});
 const showArea=entity=>{priceAreas.describe(areaCard,entity.priceArea,entity.priceMetric);const note=document.createElement('p');note.textContent='Postal-area average, not an individual building value. Mix of homes can affect quarterly changes.';areaCard.append(note);areaCard.hidden=false;};
 const handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);handler.setInputAction(e=>{if(nav.dragged)return;areaPinned=false;const feature=viewer.scene.pick(e.position);if(feature instanceof C.Cesium3DTileFeature)showBuilding(layerManager.records.get(feature.getProperty('buildingId')),feature);else{closeSelection();if(layerManager.activeId==='price'&&feature?.id?.priceArea){showArea(feature.id);areaPinned=true;}else areaCard.hidden=true;}},C.ScreenSpaceEventType.LEFT_CLICK);
 let lastHover=0;handler.setInputAction(e=>{if(layerManager.activeId!=='price'||areaPinned||selectionRecord||nav.pointers.size||performance.now()-lastHover<100)return;lastHover=performance.now();const entity=viewer.scene.pick(e.endPosition)?.id;if(entity?.priceArea)showArea(entity);else areaCard.hidden=true;},C.ScreenSpaceEventType.MOUSE_MOVE);
 viewer.scene.canvas.addEventListener('pointerleave',()=>{if(!areaPinned)areaCard.hidden=true;});
 setupLocation({button:locationButton,card:locationCard,onLocate:position=>navigate(position,1500),onExplore:switchLayer});locationButton.disabled=false;
 await Promise.all([priceAreas.ready,parkingAreas.ready,layerManager.ready]);
 await Promise.all([mapContext.ready,new Promise((resolve,reject)=>{let stop;const timeout=setTimeout(()=>{stop?.();reject(Error('City tiles did not finish loading. Please reload.'));},60000);stop=viewer.scene.postRender.addEventListener(()=>{if(loadedContents.size&&tileset.tilesLoaded){stop();clearTimeout(timeout);resolve();}});})]);
 $('#loading').remove();nav.orbit=layerManager.activeId==='overview'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;window.__atlas={viewer,tileset,manifest,slider,nav,mapContext,loadedContents,layerManager,layerSwitcher,switchLayer,appearance,showBuilding,selectSearchResult,priceAreas,parkingAreas,buildingSelection,buildingPanel,listingSearch};
}
$('#home').onclick=()=>nav?.reset();$('#zoom-in').onclick=()=>nav?.zoom(.78);$('#zoom-out').onclick=()=>nav?.zoom(1.28);$('#rotate-left').onclick=()=>nav?.rotate(-25);$('#rotate-right').onclick=()=>nav?.rotate(25);$('#north').onclick=()=>nav&&nav.rotate(-nav.state.heading);$('#perspective').onclick=()=>nav?.togglePerspective();$('#orbit').onclick=()=>{if(nav){nav.orbit=!nav.orbit;nav.apply();}};
$('#labels-toggle').onclick=()=>{if(mapContext){mapContext.enabled=!mapContext.enabled;$('#labels-toggle').setAttribute('aria-pressed',String(mapContext.enabled));$('#labels-toggle span').textContent=mapContext.enabled?'ON':'OFF';mapContext.layout();}};
for(const button of document.querySelectorAll('.theme-switch button'))button.onclick=async()=>{if(!mapContext)return;try{await mapContext.setTheme(button.dataset.theme);document.querySelectorAll('.theme-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));styleBuildings();}catch(error){toast(`Map appearance could not load: ${error.message}`);}};
$('#building-prompt').onclick=()=>switchLayer('noise');
$('#close-building').onclick=closeSelection;for(const id of ['about','sources'])$(`#${id}`).onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();$('#about-dialog').addEventListener('click',e=>{if(e.target===$('#about-dialog'))$('#about-dialog').close();});
$('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copied — this year is ready to share.');}catch{toast('Copy the URL in your address bar to share this year.');}};
document.addEventListener('keydown',e=>{const editing=['INPUT','SELECT','BUTTON','A'].includes(document.activeElement.tagName);if(e.key==='/'&&!editing){e.preventDefault();$('#map-search').focus();}if(e.code==='Space'&&!editing&&!$('#about-dialog').open&&slider&&layerManager.activeId==='age'){e.preventDefault();slider.playing?slider.pause():slider.start();}if(e.code==='Escape')closeSelection();});
document.addEventListener('pointerdown',event=>{if(nav&&!event.target.closest('#orbit')&&!event.target.closest('#scene'))nav.orbit=false;},true);
init().catch(error=>{console.error(error);const loading=$('#loading');if(!loading)return;loading.replaceChildren();const title=document.createElement('strong'),message=document.createElement('span'),retry=document.createElement('button');title.textContent='The city couldn’t load';message.textContent=error.message;retry.className='text-button';retry.textContent='Try again ↻';retry.onclick=()=>location.reload();loading.append(title,message,retry);});
