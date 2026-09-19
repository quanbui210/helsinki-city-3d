import {booleanPointInPolygon} from '@turf/boolean-point-in-polygon';
import {bbox} from '@turf/bbox';

export const noiseSources={
  road:'Meluselvitys_2022_Helsinki_kadut_ja_maantiet_Lden',
  rail:'Meluselvitys_2022_Helsinki_rautatiet_Lden',
  metro:'Meluselvitys_2022_Helsinki_metro_Lden',
  tram:'Meluselvitys_2022_Helsinki_raitiotie_Lden',
};
export function indexZones(features){
  return features.map(feature=>{
    const {db_lo:low,db_hi:high}=feature.properties;
    if(!Number.isFinite(low)||(high!==null&&(!Number.isFinite(high)||high<=low)))throw Error('Invalid noise band');
    if(!['Polygon','MultiPolygon'].includes(feature.geometry?.type))throw Error('Invalid noise geometry');
    return {feature,bounds:bbox(feature),low,high};
  });
}
export function noiseAt(position,zones){
  let band=null;
  for(const {feature,bounds:[x0,y0,x1,y1],low,high} of zones){
    if(position[0]<x0||position[0]>x1||position[1]<y0||position[1]>y1)continue;
    // Boundary ties and overlaps select the highest band; never average decibels.
    if(booleanPointInPolygon(position.slice(0,2),feature)&&(!band||low>band.low||low===band.low&&(high??Infinity)>(band.high??Infinity)))band={low,high};
  }
  return band;
}
