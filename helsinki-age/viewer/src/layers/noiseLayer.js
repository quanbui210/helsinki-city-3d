import {Cesium3DTileStyle} from 'cesium';
import {unknown} from './useCategories.js';

export const modes={combined:'All',road:'Road',rail:'Rail',metro:'Metro',tram:'Tram'};

// Official Helsinki source colors zigzag luminance (lime → dark green → yellow)
// and collapse after the 40% stone mix. This scale keeps the quiet→loud story
// with monotonic hue and luminance so adjacent 5 dB bands stay separable.
export const bandColors={
  45:'#14C4D8',
  50:'#22C75A',
  55:'#F0D020',
  60:'#F47A12',
  65:'#E03A18',
  70:'#C40E32',
  75:'#6E18FF',
};

export function selectedBand(record,mode){
  if(mode!=='combined')return record?.noise?.[mode]??null;
  return Object.values(record?.noise??{}).filter(Boolean).sort((a,b)=>b.low-a.low)[0]??null;
}
export const bandLabel=band=>band?`${band.low}${band.high===null?'+':`–${band.high}`} dB`:'No data';
export function createNoiseLayer(metadata){
  const bands=metadata.bands.map(band=>({...band,color:bandColors[band.low]??band.color,label:bandLabel(band)}));
  return {
    id:'noise',label:'Noise',title:'The sound of the city',defaults:{mode:'combined'},presentColors:false,legendLayout:'ramp',
    description:'2022 modeled Lden · building-center sample, not facade exposure. Outside mapped zones means no data, not confirmed quiet.',
    legend:()=>[...bands,unknown],
    coverage:(records,state)=>records.filter(record=>selectedBand(record,state.mode)!==null).length,
    properties(record){return Object.fromEntries(Object.keys(modes).map(mode=>[`noise_${mode}`,selectedBand(record,mode)?.low??-1]));},
    buildStyle({mode='combined'}){
      const field=`noise_${Object.hasOwn(modes,mode)?mode:'combined'}`;
      return new Cesium3DTileStyle({show:true,color:{conditions:[
        ...bands.map(band=>[`${'${'}${field}} === ${band.low}`,`color('${band.color}')`]),
        ['true',`color('${unknown.color}')`],
      ]}});
    },
    ui(container,state,onChange){
      const select=document.createElement('select');
      select.id='noise-mode';select.setAttribute('aria-label','Noise transport source');select.hidden=true;
      for(const [id,name] of Object.entries(modes)){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);}
      select.value=state.mode;select.onchange=()=>onChange({mode:select.value});
      const group=document.createElement('div');group.className='noise-modes';
      const caption=document.createElement('span');caption.className='noise-modes-label';caption.textContent='Transport source';
      const row=document.createElement('div');row.className='noise-mode-row';row.setAttribute('role','radiogroup');row.setAttribute('aria-label','Noise transport source');
      for(const [id,name] of Object.entries(modes)){
        const button=document.createElement('button');button.type='button';button.textContent=name;button.dataset.noiseMode=id;
        button.setAttribute('role','radio');button.setAttribute('aria-checked',String(id===state.mode));
        button.onclick=()=>{select.value=id;select.dispatchEvent(new Event('change'));};
        row.append(button);
      }
      group.append(caption,row,select);container.append(group);
      const note=document.createElement('p');
      note.textContent=state.mode==='combined'?'All = highest available mode band, not a total or an average. Missing modes remain unknown.':'All modeled buildings shown. Noise is independent of the construction timeline.';
      container.append(note);
    },
  };
}
