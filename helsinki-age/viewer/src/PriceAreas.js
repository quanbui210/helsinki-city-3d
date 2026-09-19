import * as C from 'cesium';
import {createAreaLookup,priceValue,priceTrend,formatPrice,formatTrend,quarterLabel} from './areaData.js';
import {priceScale} from './layers/priceLayer.js';

export class PriceAreas {
  constructor(viewer,data){
    this.viewer=viewer;this.data=data;this.lookup=createAreaLookup(data);this.sources={};this.active=false;this.metric='sale';
    this.ready=Promise.all(['sale','rent'].map(async metric=>{
      const features=data.areas.filter(a=>metric==='sale'?a.geometry:a.rentGeometry).map(a=>({type:'Feature',id:a.postalCode,geometry:metric==='sale'?a.geometry:a.rentGeometry,properties:{}}));
      const source=await C.GeoJsonDataSource.load({type:'FeatureCollection',features},{clampToGround:true,credit:'Postal areas and housing statistics © Statistics Finland · CC BY 4.0'});
      const scale=priceScale(data,metric),areas=new Map(data.areas.map(a=>[a.postalCode,a]));
      for(const entity of source.entities.values){
        // GeoJsonDataSource suffixes IDs for multi-part geometries.
        const area=areas.get(entity.id.split('_')[0]);
        if(!entity.polygon||!area)continue;
        const value=priceValue(area,metric),t=value===null?0:Math.max(0,Math.min(1,(value-scale.min)/(scale.max-scale.min)))*(scale.colors.length-1);
        const color=value===null?C.Color.fromCssColorString('#869397'):C.Color.lerp(C.Color.fromCssColorString(scale.colors[Math.floor(t)]),C.Color.fromCssColorString(scale.colors[Math.ceil(t)]),t%1,new C.Color());
        entity.polygon.material=color.withAlpha(.43);entity.polygon.outline=false;entity.polygon.classificationType=C.ClassificationType.TERRAIN;
        entity.priceArea=area;entity.priceMetric=metric;
      }
      source.show=false;await viewer.dataSources.add(source);this.sources[metric]=source;this.sync();
    }));
  }
  set(active,metric='sale'){this.active=active;this.metric=metric;this.sync();}
  sync(){for(const [metric,source] of Object.entries(this.sources))source.show=this.active&&metric===this.metric;}
  describe(container,area,metric){
    container.replaceChildren();
    const title=document.createElement('h3');title.textContent=area?`${area.postalCode} · ${metric==='rent'?(area.rentName??area.name):area.name}`:'Outside prepared postal areas';
    const value=document.createElement('strong');value.textContent=formatPrice(priceValue(area,metric),metric);
    const period=document.createElement('p');period.textContent=`${metric==='sale'?'Sale price':'Monthly rent'} · ${quarterLabel(this.data.metadata[metric].quarter)} · two-room flats`;
    const trend=document.createElement('p');trend.textContent=formatTrend(priceTrend(area,metric));
    container.append(title,value,period,trend);
  }
  buildingContext(container,position){
    container.replaceChildren();
    const heading=document.createElement('h3');heading.textContent='Around this address';container.append(heading);
    for(const metric of ['sale','rent']){
      const row=document.createElement('section');row.className=`area-metric area-${metric}`;
      this.describe(row,this.lookup[metric](position),metric);container.append(row);
    }
    const note=document.createElement('p');note.className='area-disclaimer';note.textContent='Postal-area averages for two-room flats, not a valuation of this building. '+(this.data.metadata.sale.quarterLabel.endsWith('*')?'Sale is provisional. ':'')+(this.data.metadata.rent.archived?'Rent is the latest archived postal release. ':'')+'QoQ is a change in the unadjusted average; the mix of homes can change. Other room sizes and tenure types may differ.';
    const link=document.createElement('a');link.href='/price-by-area.json';link.target='_blank';link.rel='noopener';link.textContent='Statistics Finland · sources & methodology ↗';container.append(note,link);
  }
}
