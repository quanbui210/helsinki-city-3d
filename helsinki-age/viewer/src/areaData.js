import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import bbox from '@turf/bbox';

export function spatialIndex(items,geometry=item=>item.geometry){
  const entries=items.filter(item=>geometry(item)).map(item=>({item,geometry:geometry(item),bounds:bbox(geometry(item))}));
  return position=>{
    if(!position||!Number.isFinite(position[0])||!Number.isFinite(position[1]))return null;
    const [x,y]=position;
    return entries.find(e=>x>=e.bounds[0]&&x<=e.bounds[2]&&y>=e.bounds[1]&&y<=e.bounds[3]&&booleanPointInPolygon([x,y],e.geometry))?.item??null;
  };
}
export const quarterLabel=q=>q?.replace(/(\d{4})Q([1-4])/, 'Q$2 $1')??'Period unavailable';
export const priceValue=(area,metric)=>area?.[metric==='rent'?'avgRentPerSqm':'avgSalePricePerSqm']??null;
export const priceTrend=(area,metric)=>area?.[metric==='rent'?'rentChangeQoQ':'priceChangeQoQ']??null;
export const formatPrice=(value,metric)=>value===null?'Insufficient data':`€${value.toLocaleString('en-GB',{minimumFractionDigits:metric==='rent'?2:0,maximumFractionDigits:metric==='rent'?2:0})}/m²${metric==='rent'?' / month':''}`;
export const formatTrend=value=>value===null?'QoQ unavailable':`${value>0?'↑':value<0?'↓':'→'} ${Math.abs(value).toFixed(1)}% vs previous quarter`;
export function createAreaLookup(data){
  return {sale:spatialIndex(data.areas),rent:spatialIndex(data.areas,a=>a.rentGeometry)};
}
