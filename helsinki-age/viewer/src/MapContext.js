import * as C from 'cesium';
const rank={district:4,water:3,place:1,street:0};
// A manual toggle wins for the rest of the tab session; otherwise default by
// local hour, since dusk styling reads worse against a bright midday sky.
function initialTheme(){
 try{const stored=sessionStorage.getItem('lens-theme');if(stored==='day'||stored==='dusk')return stored;}catch{/* private mode */}
 const hour=new Date().getHours();
 return hour>=7&&hour<18?'day':'dusk';
}
export class MapContext {
 constructor(viewer,data){
  this.viewer=viewer;this.data=data;this.enabled=true;this.theme=initialTheme();this.elements=[];this.container=document.querySelector('#map-labels');
  // The prepared basemap is the only honest ground. Outside it the ellipsoid
  // shows tessellation/shadow cascade strips, which got worse as the tileset AABB grew.
  viewer.scene.globe.cartographicLimitRectangle=C.Rectangle.fromDegrees(...data.rectangle);
  this.config=fetch('/api/foundation/config').then(r=>r.ok?r.json():{}).catch(()=>({}));
  this.ready=this.setTheme(this.theme);
  this.labels=data.labels.map(label=>({...label,world:C.Cartesian3.fromDegrees(...label.position,3)})).sort((a,b)=>(rank[b.type]+(b.major?2:0))-(rank[a.type]+(a.major?2:0)));
  let previous=0;viewer.scene.postRender.addEventListener(()=>{const now=performance.now();if(now-previous<100)return;previous=now;this.layout();});
 }
 async preparedMap(theme){
  return C.SingleTileImageryProvider.fromUrl(`/map/${theme}.png`,{rectangle:C.Rectangle.fromDegrees(...this.data.rectangle),credit:'Map data © City of Helsinki · CC BY 4.0'});
 }
 async setTheme(theme){
  this.theme=theme;
  const water=theme==='day'?'#89b6bc':'#102e3c';
  const aerial=Boolean((await this.config).aerial);
  if(this.theme!==theme)return;
  if(aerial&&this.aerial&&this.layer){
   // Floor view temporarily uses daylight; retain downloaded imagery tiles.
   this.layer.brightness=theme==='day'?1:.72;this.layer.saturation=theme==='day'?.9:.65;
   this.viewer.scene.globe.baseColor=C.Color.fromCssColorString(water);
   this.viewer.scene.backgroundColor=C.Color.fromCssColorString(water);
   document.body.dataset.theme=theme;return;
  }
  // Vercel catch-all does not see /aerial/{z}/{x}/{y} (platform 404). Query hits /api/foundation/aerial.
  const provider=aerial?new C.UrlTemplateImageryProvider({url:'/api/foundation/aerial?z={z}&x={x}&y={y}',maximumLevel:18,rectangle:C.Rectangle.fromDegrees(24.6,60.09,25.27,60.32),credit:'Orthophotos © National Land Survey of Finland · CC BY 4.0'}):await this.preparedMap(theme);
  if(this.theme!==theme)return;
  if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);
  this.layer=this.viewer.imageryLayers.addImageryProvider(provider);this.aerial=aerial;
  this.viewer.scene.globe.cartographicLimitRectangle=C.Rectangle.fromDegrees(...(aerial?[24.6,60.09,25.27,60.32]:this.data.rectangle));
  if(aerial){this.layer.brightness=theme==='day'?1:.72;this.layer.saturation=theme==='day'?.9:.65;}
  this.viewer.scene.globe.baseColor=C.Color.fromCssColorString(water);
  this.viewer.scene.backgroundColor=C.Color.fromCssColorString(water);
  document.body.dataset.theme=theme;
 }
 layout(){
  const canvas=this.viewer.scene.canvas,w=canvas.clientWidth,h=canvas.clientHeight,height=this.viewer.camera.positionCartographic.height;
  const camera=this.viewer.camera;const key=[camera.positionWC.x.toFixed(1),camera.positionWC.y.toFixed(1),camera.positionWC.z.toFixed(1),camera.heading.toFixed(4),camera.pitch.toFixed(4),w,h,this.enabled].join(':');if(key===this.lastKey)return;this.lastKey=key;
  const occupied=[],visible=[];
  if(this.enabled)for(const label of this.labels){
   if(label.type==='street'&&height>(label.major?2700:1300))continue;
   if(label.type==='place'&&height>1600)continue;
   if(label.type==='district'&&height<350)continue;
   const point=C.SceneTransforms.worldToWindowCoordinates(this.viewer.scene,label.world);if(!point||point.x<35||point.x>w-55||point.y<100||point.y>h-210)continue;
   if(w>700&&point.x<310&&point.y<730)continue;
   if(w>700&&point.x>w-240&&point.y<380)continue;
   if(w<700&&(point.y<265||(point.x<155&&point.y<445)))continue;
   const width=Math.min(label.name.length*(label.type==='district'?10.8:7)+18,250),b={x:point.x-width/2,y:point.y-12,w:width,h:24};
   if(b.x<20||b.x+b.w>w-100)continue;
   if(occupied.some(a=>a.x<b.x+b.w+8&&a.x+a.w+8>b.x&&a.y<b.y+b.h+7&&a.y+a.h+7>b.y))continue;
   occupied.push(b);visible.push({label,point});if(visible.length>=70)break;
  }
  visible.forEach(({label,point},i)=>{let el=this.elements[i];if(!el){el=document.createElement('span');this.container.append(el);this.elements.push(el);}el.hidden=false;el.className=`map-label ${label.type}`;el.textContent=label.name;el.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;});
  this.elements.slice(visible.length).forEach(el=>el.hidden=true);
 }
}
