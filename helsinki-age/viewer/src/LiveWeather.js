const FMI_NS='http://xml.fmi.fi/schema/wfs/2.0';
const POLL_MS=15*60*1000;
const LIGHT_FOG_DENSITY=0.0004;

export function weatherUrl(now=new Date()){
  const end=now.toISOString();
  const start=new Date(now.getTime()-2*60*60*1000).toISOString();
  const url=new URL('https://opendata.fmi.fi/wfs');
  url.search=new URLSearchParams({
    service:'WFS',version:'2.0.0',request:'GetFeature',
    storedquery_id:'fmi::observations::weather::simple',
    place:'Helsinki',parameters:'t2m,vis,wawa',timestep:'10',maxlocations:'1',
    starttime:start,endtime:end
  });
  return url.toString();
}

export function parseWeatherXml(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))return null;
  const latest={};
  for(const el of doc.getElementsByTagNameNS(FMI_NS,'BsWfsElement')){
    const name=el.getElementsByTagNameNS(FMI_NS,'ParameterName')[0]?.textContent;
    const raw=el.getElementsByTagNameNS(FMI_NS,'ParameterValue')[0]?.textContent;
    const time=el.getElementsByTagNameNS(FMI_NS,'Time')[0]?.textContent??'';
    const value=Number(raw);
    if(!name||!Number.isFinite(value))continue;
    if(!latest[name]||time>latest[name].time)latest[name]={value,time};
  }
  if(!latest.t2m)return null;
  return {temperature:latest.t2m.value,visibility:latest.vis?.value,wawa:latest.wawa?.value};
}

export function isFoggy({visibility,wawa}={}){
  if(wawa!=null){
    const code=Math.round(wawa);
    if(code===10||code===11||code===12||code===28||(code>=40&&code<=49))return true;
  }
  return visibility!=null&&visibility<1000;
}

export function formatTemperature(value){
  const n=Math.round(value);
  return `${n<0?'−':''}${Math.abs(n)}°C · Helsinki`;
}

export class LiveWeather {
  constructor(viewer,hud){
    this.viewer=viewer;this.hud=hud;this.timer=null;this.last=null;
  }
  start(){
    this.refresh();
    this.timer=setInterval(()=>this.refresh(),POLL_MS);
  }
  apply(data){
    if(!data||!Number.isFinite(data.temperature)){this.hide();return;}
    this.last=data;
    this.hud.hidden=false;
    this.hud.textContent=formatTemperature(data.temperature);
    const fog=isFoggy(data);
    this.viewer.scene.fog.enabled=fog;
    if(fog)this.viewer.scene.fog.density=LIGHT_FOG_DENSITY;
  }
  hide(){
    this.last=null;this.hud.hidden=true;this.hud.textContent='';this.viewer.scene.fog.enabled=false;
  }
  async refresh(url=weatherUrl()){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error(String(response.status));
      const data=parseWeatherXml(await response.text());
      if(!data)throw Error('empty');
      this.apply(data);
    }catch{this.hide();}
  }
}
