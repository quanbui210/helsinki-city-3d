import * as C from 'cesium';
import {TieredPointRenderer} from './TieredPointRenderer.js';
import {nearbyFor,insideCoverage,TRANSIT_RADIUS,displayDistance} from './nearby.js';
const images=new Map();
const modeIcon=type=>`/icons/hsl/${['bus','tram','metro','train','ferry'].includes(type)?type:'bus'}.svg`;
const modeOrder=['metro','train','tram','bus','ferry'];
export function groupTransitStops(stops){
 const groups=new Map();
 for(const stop of stops){const key=`${stop.name.toLocaleLowerCase('fi')}|${stop.type}`;if(!groups.has(key))groups.set(key,{...stop,lines:[],platforms:0});const group=groups.get(key);group.platforms++;group.distanceM=Math.min(group.distanceM,stop.distanceM);group.lines=[...new Set([...group.lines,...stop.lines])];}
 return [...groups.values()].sort((a,b)=>a.distanceM-b.distanceM||a.name.localeCompare(b.name,'fi'));
}
function renderCluster(button,members){
 const modes=[...new Set(members.filter(point=>point.kind==='transit').map(point=>point.type))].sort((a,b)=>modeOrder.indexOf(a)-modeOrder.indexOf(b));
 if(!modes.length){button.classList.add('landmark-cluster');button.append(text('span','◆'));return;}
 for(const type of modes.slice(0,2)){const img=document.createElement('img');img.src=modeIcon(type);img.alt='';button.append(img);}
}
function clusterTitle(members){
 const modes=[...new Set(members.filter(point=>point.kind==='transit').map(point=>point.type))];
 if(!modes.length)return 'Landmarks nearby · zoom in';
 const names=modes.map(mode=>mode[0].toUpperCase()+mode.slice(1)).join(', '),landmarks=members.some(point=>point.kind==='landmark')?' and landmarks':'';
 return `HSL ${names}${landmarks} nearby · zoom in`;
}
function marker(p){
 const key=p.kind==='landmark'?'landmark':p.type;if(key!=='landmark')return modeIcon(key);if(images.has(key))return images.get(key);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');
 c.lineWidth=4;c.strokeStyle='#173541';c.fillStyle=key==='landmark'?'#eed3a0':'#d8eef3';c.beginPath();
 if(key==='landmark'){c.moveTo(32,3);c.lineTo(61,32);c.lineTo(32,61);c.lineTo(3,32);c.closePath();}else c.roundRect(5,5,54,54,13);
 c.fill();c.stroke();c.fillStyle='#173541';c.textAlign='center';c.textBaseline='middle';c.font='bold 32px sans-serif';c.fillText('◆',32,33);images.set(key,canvas);return canvas;
}
const text=(tag,value,className)=>{const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;};
export class NearbyPlaces{
 constructor(viewer,nav,data,enabled,onNavigate){
  Object.assign(this,{viewer,nav,data,onNavigate});this.byId=new Map([...data.stops,...data.landmarks].map(p=>[p.id,p]));
  const points=[...data.stops.map(p=>({...p,kind:'transit'})),...data.landmarks.map(p=>({...p,kind:'landmark'}))];
  this.renderer=new TieredPointRenderer(viewer,{points,pointImage:marker,countLabel:'nearby stops & landmarks',clusterClass:'nearby-cluster',clusterSize:140,contextual:true,enabled,renderCluster,clusterTitle,onCluster:members=>nav.flyTo([members.reduce((s,p)=>s+p.position[0],0)/members.length,members.reduce((s,p)=>s+p.position[1],0)/members.length],Math.max(350,nav.state.range*.5)),renderDetail:(el,p)=>this.renderDetail(el,p)},()=>nav.state.range);
  this.key=document.createElement('details');this.key.className='nearby-map-key';this.key.append(text('summary','HSL transit · ◆ Landmarks'));
  const modes=document.createElement('div');for(const type of ['bus','tram','metro','train','ferry']){const item=text('span',type),img=document.createElement('img');img.src=modeIcon(type);img.alt='';item.prepend(img);modes.append(item);}this.key.append(modes);viewer.container.append(this.key);
  this.renderer.overlay.classList.add('nearby-map-clusters');this.renderer.detail.classList.add('nearby-map-detail');this.renderer.set(true);viewer.scene.postRender.addEventListener(()=>{this.key.hidden=!enabled()||nav.state.range>=3400;if(this.pending&&!nav.flight){const point=this.pending;this.pending=null;if(enabled())this.renderer.showDetail(point);}});
  viewer.creditDisplay.addStaticCredit(new C.Credit(`Transit © HSL ${data.sources.transit.retrievedAt.slice(0,10)} · <a href="/icons/hsl/source.json">data & icons · CC BY 4.0</a> · Landmarks © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors (ODbL)</a>`,true));
 }
 renderDetail(el,p){
  const close=text('button','×','nearby-close');close.type='button';close.setAttribute('aria-label','Close place details');close.onclick=()=>{el.hidden=true;this.viewer.scene.canvas.focus();};
  el.append(close,text('strong',p.name),text('p',`${p.lines?'HSL ':''}${p.type}${p.code?' · '+p.code:''}`));
  if(p.lines)el.append(text('p',p.lines.join(' · ')),text('small','Scheduled lines in the feed window; not live departures.'));
  const source=document.createElement('a');source.href=p.url||'https://www.hsl.fi/en/travelling/timetables';source.target='_blank';source.rel='noopener';source.textContent=p.url?'OpenStreetMap ↗':'HSL timetables ↗';el.append(source);
 }
 fill(section,record){
  section.replaceChildren(text('h3','Nearby transit'),text('p','HSL stops · straight-line distances','nearby-note'));
  if(!insideCoverage(record.position,this.data.bounds)){section.append(text('p','Nearby coverage is unavailable at this address.'));return;}
  const values=record.nearbyTransit&&record.nearbyLandmarks?record:nearbyFor(record.position,this.data.stops,this.data.landmarks);
  const stops=groupTransitStops(values.nearbyTransit.filter(p=>p.distanceM<=TRANSIT_RADIUS)),landmarks=values.nearbyLandmarks;
  const list=document.createElement('ul');list.className='nearby-list';
  const row=(p,landmark=false)=>{
   const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='nearby-place';
   const icon=text('span',landmark?'◆':'','nearby-icon');icon.setAttribute('aria-hidden','true');if(!landmark){const img=document.createElement('img');img.src=modeIcon(p.type);img.alt='';icon.append(img);}
   const content=document.createElement('span');content.append(text('strong',p.name),text('small',landmark?p.type:`HSL ${p.type} · ${p.lines.slice(0,5).join(' · ')}${p.lines.length>5?` · +${p.lines.length-5} lines`:''}`));
   button.append(icon,content,text('span',displayDistance(p.distanceM),'nearby-distance'));button.title=`Show ${p.name} on map`;button.onclick=()=>{const point=this.byId.get(p.id);if(point){this.onNavigate(point.position,500);this.pending=point;}};li.append(button);return li;
  };
  for(const p of stops)list.append(row(p));section.append(list);
  if(!stops.length)section.append(text('p','No mapped transit stops within 1.5 km.','nearby-empty'));
  if(landmarks.length){section.append(text('h4','Nearby landmarks','nearby-subheading'));const places=document.createElement('ul');places.className='nearby-list';for(const p of landmarks.slice(0,2))places.append(row(p,true));section.append(places);
   if(landmarks.length>2){const more=document.createElement('details');more.append(text('summary',`${landmarks.length-2} more landmarks within 800 m`));const rest=document.createElement('ul');rest.className='nearby-list';for(const p of landmarks.slice(2))rest.append(row(p,true));more.append(rest);section.append(more);}
  }else section.append(text('p','No curated landmarks within 800 m.','nearby-empty'));
  const date=this.data.sources.transit.retrievedAt.slice(0,10),note=text('small',`HSL snapshot ${date} · scheduled lines, not live service.`,'nearby-note');section.append(note);
  const source=text('a','Nearby data & sources ↗','nearby-source');source.href='/nearby.json';source.target='_blank';source.rel='noopener';section.append(source);
 }
}
