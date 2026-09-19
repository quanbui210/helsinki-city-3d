import {spatialIndex} from '../areaData.js';

export function setupLocation({button,card,onLocate,onExplore}){
  let pending=false,districts;
  button.onclick=()=>{
    if(pending||!navigator.geolocation)return;
    pending=true;button.disabled=true;button.setAttribute('aria-busy','true');
    const finish=()=>{pending=false;button.disabled=false;button.removeAttribute('aria-busy');};
    try{navigator.geolocation.getCurrentPosition(async result=>{
      try{
        const position=[result.coords.longitude,result.coords.latitude];
        // Reject distant positions before loading the local boundary data.
        if(position[0]<24.8||position[0]>25.3||position[1]<60.08||position[1]>60.32)return;
        if(!districts){const r=await fetch('/map/district-boundaries.json');if(!r.ok)return;districts=spatialIndex((await r.json()).features);}
        const district=districts(position);if(!district)return;
        onLocate(position);card.replaceChildren();
        const close=document.createElement('button');close.className='close';close.textContent='×';close.setAttribute('aria-label','Dismiss location card');close.onclick=()=>card.hidden=true;
        const title=document.createElement('h3');title.textContent=`You’re in ${district.properties.name}`;
        const prompt=document.createElement('p');prompt.textContent='Get to know this corner of the city: its buildings, sound and local prices.';
        const links=document.createElement('div');links.className='location-lenses';
        for(const [id,label] of [['age','Age'],['noise','Noise'],['use','Use'],['price','Price']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{onExplore(id);card.hidden=true;};links.append(b);}
        card.append(close,title,prompt,links);card.hidden=false;
      }catch{/* Location is optional; failed lookup leaves the map alone. */}finally{finish();}
    },finish,{enableHighAccuracy:false,timeout:10000,maximumAge:0});}catch{finish();}
  };
}
