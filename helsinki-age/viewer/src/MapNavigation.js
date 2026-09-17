import {Cartesian3,HeadingPitchRange,Matrix4,Math as CesiumMath} from 'cesium';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
/** Map-like pointer navigation, independent of browser-specific Cesium mouse mappings. */
export class MapNavigation {
 constructor(viewer,onChange){
  this.viewer=viewer;this.canvas=viewer.scene.canvas;this.onChange=onChange;
  this.state={lon:24.955,lat:60.173,heading:-24,pitch:-48,range:2550};this.home={...this.state};this.pointers=new Map();this.dragged=false;this.orbit=false;
  viewer.scene.screenSpaceCameraController.enableInputs=false;
  this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','Helsinki map. Drag to pan, scroll to zoom, Shift-drag to rotate. Arrow keys pan; plus and minus zoom.');
  this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  this.canvas.addEventListener('pointerdown',e=>{this.cancelFlight();this.orbit=false;this.dragged=false;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.canvas.classList.add('dragging');});
  this.canvas.addEventListener('pointermove',e=>{
   const old=this.pointers.get(e.pointerId);if(!old)return;
   const next={x:e.clientX,y:e.clientY},dx=next.x-old.x,dy=next.y-old.y;
   if(Math.abs(dx)+Math.abs(dy)>2)this.dragged=true;
   if(this.pointers.size===2){const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)[1],before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(after>5)this.state.range=clamp(this.state.range*before/after,180,12000);this.pan(dx/2,dy/2);}
   else if(e.shiftKey||e.buttons===2){this.state.heading-=dx*.28;this.state.pitch=clamp(this.state.pitch+dy*.2,-88,-20);this.apply();}
   else this.pan(dx,dy);
   this.pointers.set(e.pointerId,next);
  });
  const end=e=>{this.pointers.delete(e.pointerId);if(!this.pointers.size)this.canvas.classList.remove('dragging');};
  this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);this.canvas.addEventListener('lostpointercapture',end);
  this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.cancelFlight();this.orbit=false;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.canvas.clientHeight:1);this.zoom(Math.exp(clamp(delta*.0012,-.3,.3)));},{passive:false});
  this.canvas.addEventListener('keydown',e=>{const keys={ArrowLeft:[70,0],ArrowRight:[-70,0],ArrowUp:[0,70],ArrowDown:[0,-70]};if(keys[e.key]){e.preventDefault();this.cancelFlight();this.pan(...keys[e.key]);}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();e.key==='Home'?this.reset():this.zoom(e.key==='-'?1.25:.8);}});
  let previous=performance.now();viewer.scene.preRender.addEventListener(()=>{const t=performance.now(),dt=Math.min((t-previous)/1000,.1);previous=t;if(this.orbit&&!this.flight){this.state.heading+=dt*1.8;this.apply();}});
  this.apply();
 }
 metersPerPixel(){return 2*this.state.range*Math.tan(this.viewer.camera.frustum.fovy/2)/this.canvas.clientHeight;}
 pan(dx,dy){const h=this.state.heading*Math.PI/180,m=this.metersPerPixel(),y=dy/Math.sin(-this.state.pitch*Math.PI/180),east=(-dx*Math.cos(h)+y*Math.sin(h))*m,north=(dx*Math.sin(h)+y*Math.cos(h))*m;this.state.lon=clamp(this.state.lon+east/(111320*Math.cos(this.state.lat*Math.PI/180)),24.89,25.075);this.state.lat=clamp(this.state.lat+north/111320,60.155,60.223);this.apply();}
 zoom(factor){this.cancelFlight();this.state.range=clamp(this.state.range*factor,180,12000);this.apply();}
 apply(){const s=this.state;this.viewer.camera.lookAt(Cartesian3.fromDegrees(s.lon,s.lat,0),new HeadingPitchRange(CesiumMath.toRadians(s.heading),CesiumMath.toRadians(s.pitch),s.range));this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);this.onChange?.(s);}
 cancelFlight(){cancelAnimationFrame(this.flight);this.flight=null;}
 flyTo(position,range=1800){this.orbit=false;this.cancelFlight();const start={...this.state},end={...start,lon:position[0],lat:position[1],range},begin=performance.now();const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:950;const tick=t=>{const p=duration?Math.min((t-begin)/duration,1):1,e=p*p*(3-2*p);for(const k of ['lon','lat','range'])this.state[k]=start[k]+(end[k]-start[k])*e;this.apply();if(p<1)this.flight=requestAnimationFrame(tick);else this.flight=null;};this.flight=requestAnimationFrame(tick);}
 reset(){this.state.heading=this.home.heading;this.state.pitch=this.home.pitch;this.flyTo([this.home.lon,this.home.lat],this.home.range);}
 rotate(degrees){this.cancelFlight();this.state.heading+=degrees;this.apply();}
 togglePerspective(){this.state.pitch=this.state.pitch<-75?-48:-88;this.apply();}
}
