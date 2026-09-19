import {spatialIndex} from './areaData.js';
export const parkingLabels={permitPaid:'Permit or metered',permitTimed:'Permit or time-limited',metered:'Metered',timed:'Free, time-limited',free:'Free, long-stay',conditional:'Conditional hours',shared:'Car sharing',loading:'Loading',accessible:'Accessible',special:'Special-use / reserved',unknown:'Type unreported'};
export function parkingType(p){
  const type=(p.tyyppi??'').toLowerCase();
  if(/kielto|polkupyörä|potkulauta|parklet/.test(type))return null;
  if(type.includes('kuormaus'))return 'loading';
  if(type.includes('inva'))return 'accessible';
  if(type&&!/^\d+$/.test(type)&&!['henkilöauto, pakettiauto'].includes(type))return 'special';
  return ({1:'timed',2:'free',3:'metered',4:'metered',5:'metered',6:'permitPaid',7:'permitPaid',8:'permitTimed',9:'conditional',10:'metered',11:'shared'})[p.luokka]??'unknown';
}
export function distance(a,b){const r=Math.PI/180,dlat=(b[1]-a[1])*r,dlon=(b[0]-a[0])*r;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlon/2)**2)));}
export function parkingLookup(data){
  const resident=spatialIndex(data.residentZones),paid=spatialIndex(data.paidZones),bins=new Map();
  const cell=p=>[Math.floor(p[0]/.01),Math.floor(p[1]/.005)];
  for(const s of data.spots){const key=cell(s.position).join(',');if(!bins.has(key))bins.set(key,[]);bins.get(key).push(s);}
  return position=>{
    const result={nearbyParkingSpots:0,parkingSpotBreakdown:{},residentZoneId:resident(position)?.id??null,paidZoneId:paid(position)?.id??null,parkingMappedSegments:0,parkingUnknownCapacity:0};
    if(!position||!position.slice(0,2).every(Number.isFinite))return result;
    const [x,y]=cell(position);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const s of bins.get(`${x+dx},${y+dy}`)??[]){
      if(distance(position,s.position)>200)continue;
      result.parkingMappedSegments++;
      if(s.capacity===null)result.parkingUnknownCapacity++;
      result.nearbyParkingSpots+=s.capacity??0;
      result.parkingSpotBreakdown[s.type]=(result.parkingSpotBreakdown[s.type]??0)+(s.capacity??0);
    }
    return result;
  };
}
