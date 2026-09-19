import {spatialIndex} from '../areaData.js';
import {parkingLabels} from '../parkingData.js';
export const parkingColors={resident:'#51d6b8',paid:'#c395f5',both:'#69c6ff',unmatched:'#e0c782'};
export function parkingAggregate(points){
  const cells=new Map();
  for(const p of points){const x=Math.floor(p.position[0]/.009),y=Math.floor(p.position[1]/.0045),key=`${x},${y}`;if(!cells.has(key))cells.set(key,{x,y,count:0});cells.get(key).count++;}
  return [...cells.values()].map(({x,y,count})=>({count,metric:Math.min(1,count/80),geometry:{type:'Polygon',coordinates:[[[x*.009,y*.0045],[(x+1)*.009,y*.0045],[(x+1)*.009,(y+1)*.0045],[x*.009,(y+1)*.0045],[x*.009,y*.0045]]]}}));
}
export function createParkingLayer(data,onCluster=()=>{}){
  const resident=spatialIndex(data.residentZones),paid=spatialIndex(data.paidZones);
  const points=data.spots.map(p=>({...p,zone:resident(p.position)?paid(p.position)?'both':'resident':paid(p.position)?'paid':'unmatched'}));
  return {
  id:'parking',label:'Parking',title:'Street parking, in context',defaults:{},presentColors:false,buildStyle:()=>undefined,source:'/parking.json',
  renderMode:'tiered-points',tieredPoints:{points,aggregate:parkingAggregate,pointColor:p=>parkingColors[p.zone],areaColor:metric=>metric<.2?'#c2cbb3':metric<.55?'#97b4ae':'#7395aa',countLabel:'mapped street segments',onCluster,describePoint:p=>`${parkingLabels[p.type]} · ${p.capacity===null?'Capacity unreported':`≈ ${p.capacity} spaces`} · Public street segment, not live availability. Check signs.`},
  description:'Wash: mapped segment density, not parking pressure. Outlined cells contain records; unshaded areas are unverified, not zero parking. Check street signs.',
  coverageLabel:()=>`${data.spots.length.toLocaleString('en-GB')} mapped street segments`,
  legend:()=>[{color:parkingColors.resident,label:'Permit zone'},{color:parkingColors.paid,label:'Paid zone'},{color:parkingColors.both,label:'Both'},{color:parkingColors.unmatched,label:'No zone match'},{color:'#c2cbb3',label:'Low density'},{color:'#7395aa',label:'High density'}],
  ui(container){const p=document.createElement('p');p.className='price-period';p.textContent='City: density per ~500 m cell (1–80+ segments) · District: counts of mapped segments · Street: zone-colored dots. Counts are not individual bays or vacant spaces. Click a cluster to explore.';container.append(p);},
};}
