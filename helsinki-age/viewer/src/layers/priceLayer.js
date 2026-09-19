import {priceValue,quarterLabel} from '../areaData.js';

const colors=['#57b8ae','#8fceb1','#d6d6a2','#e8b579','#ce7f69'];
export function priceScale(data,metric){
  const values=data.areas.map(a=>priceValue(a,metric)).filter(v=>v!==null);
  const min=Math.floor(Math.min(...values)),max=Math.ceil(Math.max(...values));
  return {min,max,colors};
}
export function createPriceLayer(data){
  return {
    id:'price',label:'Price',title:'The neighborhood benchmark',defaults:{metric:'sale'},presentColors:false,
    source:'/price-by-area.json',legendLayout:'ramp',legendEnds:['Lower area average','Higher area average'],
    description:'Two-room flats · area averages, not a building valuation. Sale: old flats. Rent: non-subsidised homes. Missing values are never estimated.',
    coverageLabel:(_records,state)=>`${data.areas.filter(a=>priceValue(a,state.metric)!==null).length} postal areas with data`,
    buildStyle:()=>undefined,
    legend(state){const {min,max}=priceScale(data,state.metric);return [...colors.map((color,i)=>({color,tick:(min+(max-min)*i/4).toLocaleString('en-GB',{maximumFractionDigits:state.metric==='rent'?1:0})})),{id:'unknown',color:'#869397',label:'Insufficient data'}];},
    ui(container,state,onChange){
      const group=document.createElement('div');group.className='noise-mode-row price-metrics';group.setAttribute('role','group');group.setAttribute('aria-label','Price metric');
      for(const [metric,label] of [['sale','Sale price'],['rent','Rent']]){
        const button=document.createElement('button');button.textContent=label;button.dataset.priceMetric=metric;button.setAttribute('aria-pressed',String(state.metric===metric));button.onclick=()=>onChange({metric});group.append(button);
      }
      const source=data.metadata[state.metric],period=document.createElement('p');period.className='price-period';
      period.textContent=`${quarterLabel(source.quarter)}${source.quarterLabel.endsWith('*')?' · provisional':''} · ${state.metric==='rent'?'€/m²/month · rent':'€/m² · sale price'}${source.archived?' · latest postal-area release (archived)':''}`;
      container.append(group,period);
    },
  };
}
