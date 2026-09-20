import {Cartesian3,Cartographic,Matrix4,Math as CesiumMath,Transforms} from 'cesium';

export const FLYTHROUGH_KEYFRAMES = [
  { offset: { x: 0, y: 120, z: 180 }, lookAtOffset: { x: 0, y: 20, z: 0 }, durationMs: 0 },
  { offset: { x: 60, y: 60, z: 60 }, lookAtOffset: { x: 0, y: 15, z: 0 }, durationMs: 2200 },
  { offset: { x: -40, y: 40, z: 90 }, lookAtOffset: { x: 0, y: 10, z: 0 }, durationMs: 1800 },
];

const mix=(a,b,e)=>({x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,z:a.z+(b.z-a.z)*e});
const APPROACH_MS=950;

function originOf(position){return Cartesian3.fromDegrees(position[0],position[1],0);}
function frameOf(position){return Transforms.eastNorthUpToFixedFrame(originOf(position));}

export function worldFromOffset(position,offset){
  return Matrix4.multiplyByPoint(frameOf(position),new Cartesian3(offset.x,offset.y,offset.z),new Cartesian3());
}

export function localOffset(position,world){
  const local=Matrix4.multiplyByPoint(Matrix4.inverse(frameOf(position),new Matrix4()),world,new Cartesian3());
  return {x:local.x,y:local.y,z:local.z};
}

export function applyPose(viewer,nav,position,offset,lookAtOffset){
  const camera=worldFromOffset(position,offset),target=worldFromOffset(position,lookAtOffset);
  const direction=Cartesian3.normalize(Cartesian3.subtract(target,camera,new Cartesian3()),new Cartesian3());
  const upGuess=Matrix4.multiplyByPointAsVector(frameOf(position),Cartesian3.UNIT_Z,new Cartesian3());
  const right=Cartesian3.normalize(Cartesian3.cross(direction,upGuess,new Cartesian3()),new Cartesian3());
  const up=Cartesian3.normalize(Cartesian3.cross(right,direction,new Cartesian3()),new Cartesian3());
  viewer.camera.position=camera;viewer.camera.direction=direction;viewer.camera.up=up;viewer.camera.right=right;
  viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  const look=Cartographic.fromCartesian(target);
  nav.state.lon=CesiumMath.toDegrees(look.longitude);nav.state.lat=CesiumMath.toDegrees(look.latitude);
  nav.state.heading=CesiumMath.toDegrees(viewer.camera.heading);nav.state.pitch=CesiumMath.toDegrees(viewer.camera.pitch);
  nav.state.range=Cartesian3.distance(camera,target);nav.onChange?.(nav.state);
}

function currentLookOffset(nav,position){
  return localOffset(position,Cartesian3.fromDegrees(nav.state.lon,nav.state.lat,0));
}

async function compositeWatermark(dataUrl){
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=dataUrl;});
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Could not composite snapshot');
  ctx.drawImage(image,0,0);
  const label='Helsinki Lens',size=Math.max(18,Math.round(canvas.width*.016));
  ctx.font=`600 ${size}px "Segoe UI",sans-serif`;
  const pad=Math.round(size*.45),textW=ctx.measureText(label).width,boxW=textW+pad*2,boxH=size+pad*2;
  const x=canvas.width-boxW-Math.round(size*1.1),y=canvas.height-boxH-Math.round(size*.9);
  ctx.fillStyle='rgba(16,35,43,0.65)';ctx.fillRect(x,y,boxW,boxH);
  ctx.fillStyle='rgba(246,236,214,0.95)';ctx.textBaseline='middle';ctx.fillText(label,x+pad,y+boxH/2);
  return canvas.toDataURL('image/png');
}

function triggerDownload(dataUrl){
  const a=document.createElement('a');a.href=dataUrl;a.download='helsinki-lens.png';document.body.append(a);a.click();a.remove();
}

export class CinematicView {
  constructor(){this.token=0;this.button=null;this.running=false;}
  cancel(){
    const active=this.running;this.token++;this.running=false;this.resetButton();
    if(active)this.nav?.cancelFlight();
  }
  resetButton(){
    if(!this.button)return;
    this.button.disabled=false;this.button.removeAttribute('aria-busy');this.button.textContent='Cinematic view';
  }
  localCameraOffset(viewer,position){return localOffset(position,viewer.camera.positionWC);}
  async start({viewer,nav,record,button}){
    this.nav=nav;this.button=button;
    const token=++this.token;this.running=true;
    if(!record?.position){this.running=false;return;}
    nav.cancelFlight();
    button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Framing view…';
    const position=record.position;
    const start={offset:localOffset(position,viewer.camera.positionWC),lookAtOffset:currentLookOffset(nav,position)};
    const path=[{...start,durationMs:APPROACH_MS},...FLYTHROUGH_KEYFRAMES.map((frame,i)=>({...frame,durationMs:i===0?APPROACH_MS:frame.durationMs}))];
    const finished=await nav.flySteps(path.slice(1).map((to,i)=>({durationMs:to.durationMs,apply:e=>{
      const from=path[i];applyPose(viewer,nav,position,mix(from.offset,to.offset,e),mix(from.lookAtOffset,to.lookAtOffset,e));
    }})));
    if(token!==this.token||!finished){if(token===this.token){this.running=false;this.resetButton();}return;}
    await new Promise(resolve=>setTimeout(resolve,300));
    if(token!==this.token)return;
    try{
      viewer.render();
      triggerDownload(await compositeWatermark(viewer.scene.canvas.toDataURL('image/png')));
    }finally{if(token===this.token){this.running=false;this.resetButton();}}
  }
}
