import * as C from 'cesium';
import {decodeBuildings,facadePoint,floorDimensions,rayDistance,openness} from './sightlineGeometry.js';
import {solarNoonPosition} from './solarPosition.js';
import {applyPose,localOffset} from './CinematicView.js';
const RAD=Math.PI/180,names=['North','North-east','East','South-east','South','South-west','West','North-west'];
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
export class StepInside {
 constructor({viewer,nav,mapContext,layerManager,switchLayer,cinematic,tileset}){
  Object.assign(this,{viewer,nav,mapContext,layerManager,switchLayer,cinematic,tileset});this.cache=new Map();this.token=0;this.active=false;
  this.panel=document.createElement('section');this.panel.id='step-inside';this.panel.hidden=true;this.panel.setAttribute('aria-label','Floor view and estimated sunlight');
  this.panel.innerHTML=`<div class="step-heading"><div><span class="eyebrow">APPROXIMATE FLOOR VIEW</span><h2 id="step-address"></h2></div><button id="step-exit" type="button">Exit to map ×</button></div><p id="step-status" role="status">Preparing nearby geometry…</p><div class="step-controls"><label>Floor <input id="step-floor" type="number" min="1" value="1" max="8"></label><label>Facade <select id="step-facade">${names.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}</select></label><label>Look direction <input id="step-look" type="range" min="-60" max="60" value="0" step="5"></label><label><span>Month · <output id="step-month-name"></output></span> <input id="step-month" type="range" min="1" max="12" step="1"></label></div><p id="step-floor-note"></p><div class="step-readouts" aria-live="polite"><strong id="step-openness">Checking view…</strong><strong id="step-sun">Checking sunlight…</strong></div><p id="step-date"></p><p class="step-note">Estimated exterior view, not an interior or daylight study. Missing geometry, terrain and trees can affect results.</p>`;
  document.getElementById('app').append(this.panel);this.$=id=>this.panel.querySelector(id);
  this.$('#step-exit').onclick=()=>this.exit();this.$('#step-floor').onchange=()=>this.reframe();this.$('#step-facade').onchange=()=>this.reframe();
  this.$('#step-look').oninput=()=>this.look();this.$('#step-month').value=String(new Date().getMonth()+1);this.$('#step-month').oninput=()=>this.sunlight();
  const canvas=viewer.scene.canvas;let pointer;
  const capture=(type,fn)=>canvas.addEventListener(type,e=>{if(!this.active)return;e.preventDefault();e.stopImmediatePropagation();fn(e);},{capture:true,passive:false});
  capture('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);canvas.focus();});
  capture('pointermove',e=>{if(pointer?.id!==e.pointerId)return;this.$('#step-look').value=String(Math.max(-60,Math.min(60,Number(this.$('#step-look').value)+(e.clientX-pointer.x)*.25)));pointer.x=e.clientX;this.look();});
  capture('pointerup',()=>{pointer=null;});capture('pointercancel',()=>{pointer=null;});capture('wheel',()=>{});
  capture('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){this.$('#step-look').value=String(Math.max(-60,Math.min(60,Number(this.$('#step-look').value)+(e.key==='ArrowLeft'?-5:5))));this.look();}});
  document.addEventListener('keydown',e=>{if(this.active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.exit();}},{capture:true});
 }
 async tile(uri){
  if(!this.cache.has(uri)){const promise=fetch(`/tileset/${uri}`).then(r=>{if(!r.ok)throw Error('Geometry unavailable');return r.arrayBuffer();}).then(decodeBuildings).catch(e=>{this.cache.delete(uri);throw e;});this.cache.set(uri,promise);if(this.cache.size>24)this.cache.delete(this.cache.keys().next().value);}
  return this.cache.get(uri);
 }
 toWorld(p){return C.Matrix4.multiplyByPoint(this.transform,new C.Cartesian3(p[0],-p[2],p[1]),new C.Cartesian3());}
 worldDirection(d){return C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(this.transform,new C.Cartesian3(d[0],-d[2],d[1]),new C.Cartesian3()),new C.Cartesian3());}
 async enter(record,button){
  if(this.active||!record?.buildingId)return;this.returnFocus=button;this.record=record;this.cinematic.cancel();this.nav.cancelFlight();
  this.saved={camera:{destination:C.Cartesian3.clone(this.viewer.camera.positionWC),orientation:{direction:C.Cartesian3.clone(this.viewer.camera.directionWC),up:C.Cartesian3.clone(this.viewer.camera.upWC)}},state:{...this.nav.state},layer:this.layerManager.activeId,light:this.viewer.scene.light,theme:this.mapContext.theme,near:this.viewer.camera.frustum.near,shadows:this.viewer.shadows,tileShadows:this.tileset.shadows};
  this.switchLayer('overview');this.active=true;this.nav.orbit=false;this.token++;const token=this.token;
  document.body.classList.add('step-inside-active');this.panel.hidden=false;this.$('#step-address').textContent=record.address||'Selected building';this.$('#step-exit').focus();this.$('#step-status').textContent='Preparing nearby geometry…';this.$('#step-openness').textContent='Checking view…';this.$('#step-sun').textContent='Checking sunlight…';this.$('#step-date').textContent='';this.facade=null;
  for(const input of this.panel.querySelectorAll('input,select'))input.disabled=true;
  try{
   await this.mapContext.setTheme('day');if(!this.active||token!==this.token)return;
   const tiles=await(await fetch('/tileset/tileset.json')).json();if(!this.active||token!==this.token)return;this.transform=C.Matrix4.fromArray(tiles.root.transform);
   const own=(await this.tile(record.tileContentUri)).find(g=>g.id===record.buildingId);if(!this.active||token!==this.token)return;if(!own)throw Error('No matching modeled facade');this.building=own;this.dim=floorDimensions(own,record.floorCount);
   const centre=[(own.min[0]+own.max[0])/2,(own.min[2]+own.max[2])/2];
   const nearby=tiles.root.children.filter(t=>{const b=t.boundingVolume.box;return Math.hypot(Math.max(0,Math.abs(b[0]-centre[0])-b[3]),Math.max(0,Math.abs(-b[1]-centre[1])-b[7]))<1200;});
   this.buildings=[];this.incomplete=false;
   // Bounded requests, with all loaded triangles used even if off-screen.
   for(let i=0;i<nearby.length;i+=3){const results=await Promise.allSettled(nearby.slice(i,i+3).map(t=>this.tile(t.content.uri)));if(!this.active||token!==this.token)return;for(const r of results)if(r.status==='fulfilled')this.buildings.push(...r.value);else this.incomplete=true;}
   this.dim=floorDimensions(own,record.floorCount,this.buildings);
   this.$('#step-floor').max=String(this.dim.maxFloor);this.$('#step-floor').value='1';this.$('#step-look').value='0';
   const eye=this.dim.ground+1.5;let best=-1,bestIndex=0;
   for(let i=0;i<8;i++){const facade=facadePoint(own,i*Math.PI/4,eye);if(!facade)continue;const d=rayDistance(facade.origin,facade.direction,this.buildings,120).distance;if(d>best){best=d;bestIndex=i;}}
   this.$('#step-facade').value=String(bestIndex);for(const input of this.panel.querySelectorAll('input,select'))input.disabled=false;
   this.viewer.camera.frustum.near=.1;this.viewer.shadows=true;window.__atlas.tileset.shadows=C.ShadowMode.ENABLED;
   this.$('#step-floor-note').title=`${record.floorCount?`${record.floorCount} floors · Helsinki register`:'Floor count unconfirmed · selector range 1–8'}. ${this.dim.perFloor.toFixed(1)} m per floor (${this.dim.derived?'modeled height ÷ floor count, including roof':'standard assumption'}). Eye height 1.5 m.${this.dim.groundEstimated?' Ground estimated from nearby model bases.':' Ground follows model base.'}`;
   this.$('#step-floor-note').textContent=`${record.floorCount?`${record.floorCount} registered floors`:'Floors unconfirmed · range 1–8'} · ~${this.dim.perFloor.toFixed(1)} m/floor · estimated ground.`;
   await this.reframe();
  }catch(error){if(this.active&&token===this.token){this.$('#step-status').textContent='Floor view unavailable: the matching geometry could not be prepared. Exit to map and try another building.';this.$('#step-openness').textContent='View not assessed';this.$('#step-sun').textContent='Sunlight not assessed';}}
 }
 async reframe(){
  if(!this.active||!this.building)return;this.nav.cancelFlight();
  const floor=Math.max(1,Math.min(this.dim.maxFloor,Math.round(Number(this.$('#step-floor').value)||1)));this.$('#step-floor').value=String(floor);
  const height=this.dim.ground+(floor-1)*this.dim.perFloor+1.5;
  this.facade=facadePoint(this.building,Number(this.$('#step-facade').value)*Math.PI/4,height);
  if(!this.facade){this.$('#step-status').textContent='No modeled exterior wall at this floor and direction. Choose another floor or facade.';this.$('#step-openness').textContent='View not assessed';this.$('#step-sun').textContent='Sunlight not assessed';return;}
  this.$('#step-status').textContent='Drag the view or adjust Look direction to turn.';
  const distances=Array.from({length:7},(_,i)=>{const angle=this.facade.angle+(i-3)*20*RAD;return rayDistance(this.facade.origin,[Math.sin(angle),0,-Math.cos(angle)],this.buildings,120).distance;});
  this.distances=distances;this.$('#step-openness').textContent=`${openness(distances)} · approximate${this.incomplete?' / incomplete nearby data':''}`;
  const from=localOffset(this.record.position,this.viewer.camera.positionWC),fromTarget=localOffset(this.record.position,C.Cartesian3.add(this.viewer.camera.positionWC,C.Cartesian3.multiplyByScalar(this.viewer.camera.directionWC,50,new C.Cartesian3()),new C.Cartesian3()));
  const to=localOffset(this.record.position,this.toWorld(this.facade.origin));const target=this.targetOffset();
  this.sunlight();await this.nav.flySteps([{durationMs:950,apply:t=>applyPose(this.viewer,this.nav,this.record.position,mix(from,to,t),mix(fromTarget,target,t))}]);
 }
 targetOffset(){const a=this.facade.angle+Number(this.$('#step-look').value)*RAD,p=this.facade.origin;return localOffset(this.record.position,this.toWorld([p[0]+Math.sin(a)*50,p[1],p[2]-Math.cos(a)*50]));}
 look(){if(!this.active||!this.facade)return;this.nav.cancelFlight();applyPose(this.viewer,this.nav,this.record.position,localOffset(this.record.position,this.toWorld(this.facade.origin)),this.targetOffset());}
 sunlight(){
  if(!this.active||!this.facade)return;
  const month=Number(this.$('#step-month').value),year=new Date().getFullYear(),sun=solarNoonPosition(year,month,this.record.position);
  const localFrame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...this.record.position.slice(0,2)));
  const world=C.Matrix4.multiplyByPointAsVector(localFrame,new C.Cartesian3(...sun.direction),new C.Cartesian3());
  const enu=C.Matrix4.multiplyByPointAsVector(C.Matrix4.inverseTransformation(this.transform,new C.Matrix4()),world,new C.Cartesian3());const d=[enu.x,enu.z,-enu.y];
  this.$('#step-month-name').value=sun.time.toLocaleDateString('en-GB',{month:'short',timeZone:'Europe/Helsinki'});
  const facing=this.facade.direction.reduce((s,x,i)=>s+x*d[i],0);let label;
  if(sun.altitude<=0)label='No direct sun — sun below horizon';
  else if(facing<=0)label='No direct sun — sun behind this facade';
  else {const hit=rayDistance(this.facade.origin,d,this.buildings,1000);this.sunHit=hit;label=hit.hit?'No direct sun — blocked by modeled building':this.incomplete?'Direct sun uncertain — nearby geometry missing':`Direct sun possible${sun.altitude<15*RAD?' — low angle':''} · modeled buildings do not block it`;}
  this.$('#step-sun').textContent=label;this.$('#step-date').textContent=`${sun.time.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Helsinki'})} · solar noon ${sun.time.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Helsinki'})} · sun ${(sun.altitude/RAD).toFixed(1)}° above horizon · estimated`;
  this.viewer.scene.light=new C.DirectionalLight({direction:C.Cartesian3.negate(world,new C.Cartesian3()),color:C.Color.WHITE,intensity:sun.altitude>0?2:0});this.sun=sun;
 }
 exit(){
  if(!this.active)return;this.active=false;this.token++;this.nav.cancelFlight();this.panel.hidden=true;document.body.classList.remove('step-inside-active');
  this.viewer.scene.light=this.saved.light;this.viewer.camera.frustum.near=this.saved.near;this.viewer.shadows=this.saved.shadows;window.__atlas.tileset.shadows=this.saved.tileShadows;
  Object.assign(this.nav.state,this.saved.state);this.nav.apply();this.viewer.camera.setView(this.saved.camera);this.mapContext.setTheme(this.saved.theme).catch(()=>{});this.switchLayer(this.saved.layer);this.returnFocus?.focus();
 }
}
