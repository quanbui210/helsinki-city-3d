export class LayerSwitcher {
  constructor({container,manager,onChange}){
    Object.assign(this,{container,manager,onChange,open:true});
    container.innerHTML='<div class="lens-chrome"><div class="lens-tabs" role="group" aria-label="Data layer"></div><button type="button" class="lens-toggle" aria-controls="lens-content"></button></div><div class="lens-content" id="lens-content"><div class="lens-heading"><h2></h2><span class="lens-count"></span></div><div class="lens-controls"></div><div class="lens-legend" aria-label="Layer legend"></div><p class="lens-description"></p><a class="lens-source" href="/layers.json" target="_blank" rel="noopener">Data sources & methodology ↗</a></div>';
    for(const layer of manager.layers.values()){
      const button=document.createElement('button');button.textContent=layer.label;button.dataset.layer=layer.id;button.onclick=()=>onChange(layer.id);container.querySelector('.lens-tabs').append(button);
    }
    container.querySelector('.lens-toggle').onclick=()=>this.toggle();
    this.syncOpen();
    this.render();
  }
  toggle(){this.open=!this.open;this.syncOpen();}
  syncOpen(){
    this.container.classList.toggle('is-collapsed',!this.open);
    document.body.dataset.lenses=this.open?'open':'collapsed';
    const toggle=this.container.querySelector('.lens-toggle');
    toggle.setAttribute('aria-expanded',String(this.open));
    toggle.title=this.open?'Hide lens details':'Show lens details';
    toggle.setAttribute('aria-label',toggle.title);
    toggle.textContent=this.open?'Hide':'Show';
  }
  render(){
    const {active,state}=this.manager;
    for(const button of this.container.querySelectorAll('[data-layer]'))button.setAttribute('aria-pressed',String(button.dataset.layer===active.id));
    this.container.querySelector('h2').textContent=active.title;
    const records=[...this.manager.records.values()];
    const known=active.coverage?.(records,state);
    this.container.querySelector('.lens-count').textContent=known===undefined?'':`${known.toLocaleString()} / ${records.length.toLocaleString()} with data`;
    this.container.querySelector('.lens-description').textContent=active.description;
    const controls=this.container.querySelector('.lens-controls');controls.replaceChildren();
    active.ui?.(controls,state,patch=>this.onChange(active.id,patch),id=>this.onChange(id));
    const legend=this.container.querySelector('.lens-legend');legend.replaceChildren();
    legend.classList.toggle('is-ramp',active.legendLayout==='ramp');
    const items=active.legend(state);
    if(active.legendLayout==='ramp'){
      const bands=items.filter(item=>item.id!=='unknown');
      const missing=items.find(item=>item.id==='unknown');
      const ramp=document.createElement('div');ramp.className='lens-ramp';
      const bar=document.createElement('div');bar.className='lens-ramp-bar';
      bar.style.background=`linear-gradient(90deg,${bands.map(item=>item.color).join(',')})`;
      const ticks=document.createElement('div');ticks.className='lens-ramp-ticks';
      for(const item of bands){
        const tick=document.createElement('span');
        tick.textContent=item.tick??(item.high===null?`${item.low}+`:item.low!=null?String(item.low):item.label);
        ticks.append(tick);
      }
      const [start,end]=active.legendEnds??['Quieter','Louder'];
      const ends=document.createElement('div');ends.className='lens-ramp-ends';
      ends.append(Object.assign(document.createElement('span'),{textContent:start}),Object.assign(document.createElement('span'),{textContent:end}));
      ramp.append(bar,ticks,ends);legend.append(ramp);
      if(missing){const entry=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=missing.color;entry.append(swatch,document.createTextNode(missing.label));legend.append(entry);}
    }else for(const item of items){
      const entry=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=item.color;entry.append(swatch,document.createTextNode(item.label));legend.append(entry);
    }
  }
}
