// A ramp legend's single "tick" for a band: its explicit label, or a derived
// one from its numeric bounds. Shared by the full ramp ticks and the
// condensed mini-legend ends so the two never drift apart.
function tickLabel(item){
  return item.tick??(item.high===null?`${item.low}+`:item.low!=null?String(item.low):item.label);
}

export class LayerSwitcher {
  constructor({container,manager,onChange}){
    Object.assign(this,{container,manager,onChange});
    // Drawer expand state is tracked per layer, in memory only (never
    // sessionStorage): every layer other than Overview always starts — and
    // returns to, on every tab switch — collapsed; only an explicit click on
    // the expand control opens it, and it's remembered per layer for the
    // rest of the session. Overview keeps its previous always-open guide.
    this.expanded=new Map([['overview',true]]);
    this.previousActiveId=null;
    container.innerHTML='<div class="lens-chrome"><div class="lens-tabs" role="group" aria-label="Data layer"></div></div><div class="lens-dock-row"><div class="lens-mini-legend" aria-label="Layer legend summary"></div><div class="lens-dock-action"><button type="button" class="lens-toggle" aria-controls="lens-content"></button></div></div><div class="lens-content" id="lens-content"><div class="lens-drawer-bar"></div><div class="lens-heading"><h2></h2><span class="lens-count"></span></div><div class="lens-controls"></div><div class="lens-legend" aria-label="Layer legend"></div><p class="lens-description"></p><a class="lens-source" href="/layers.json" target="_blank" rel="noopener">Data sources & methodology ↗</a></div>';
    for(const layer of manager.layers.values()){
      const button=document.createElement('button');button.textContent=layer.label;button.dataset.layer=layer.id;button.onclick=()=>onChange(layer.id);container.querySelector('.lens-tabs').append(button);
    }
    container.querySelector('.lens-toggle').onclick=()=>this.toggle();
    this.render();
  }
  // Proxies to whichever layer is currently active, so the mobile
  // compacting logic already in main.js (capture/restore around a
  // selection) keeps working unchanged against a single boolean-looking
  // property instead of needing to know about per-layer state.
  get open(){return this.expanded.get(this.manager.active.id)??false;}
  set open(value){this.expanded.set(this.manager.active.id,value);}
  toggle(){this.open=!this.open;this.syncOpen();}
  // The building panel's own card grid already repeats every layer's value
  // for the selected building, so an expanded bottom drawer at the same
  // time is redundant screen space. Called once when a building opens; the
  // expand icon still works normally afterward — this is not a lockout.
  collapse(){if(this.open){this.open=false;this.syncOpen();}}
  syncOpen(){
    this.container.classList.toggle('is-collapsed',!this.open);
    document.body.dataset.lenses=this.open?'open':'collapsed';
    const toggle=this.container.querySelector('.lens-toggle');
    toggle.setAttribute('aria-expanded',String(this.open));
    toggle.title=this.open?'Hide lens details':'Show more details for this layer';
    toggle.setAttribute('aria-label',toggle.title);
    toggle.textContent=this.open?'Hide details':'Details';
    // Stable chrome position: opening the drawer never moves its control.
    this.container.querySelector('.lens-chrome').append(toggle);
  }
  render(){
    const {active,state}=this.manager;
    // A genuine tab switch (as opposed to a same-tab patch such as a noise
    // transport-source or price-metric toggle, which also re-renders) just
    // re-syncs the toggle/collapsed class for whichever per-layer state is
    // already on record — switching tabs never opens the drawer on its own.
    if(active.id!==this.previousActiveId){
      this.previousActiveId=active.id;
      this.syncOpen();
    }
    for(const button of this.container.querySelectorAll('[data-layer]'))button.setAttribute('aria-pressed',String(button.dataset.layer===active.id));
    this.container.querySelector('h2').textContent=active.title;
    const records=[...this.manager.records.values()];
    const known=active.coverage?.(records,state);
    this.container.querySelector('.lens-count').textContent=active.coverageLabel?.(records,state)??(known===undefined?'':`${known.toLocaleString()} / ${records.length.toLocaleString()} with data`);
    this.container.querySelector('.lens-source').href=active.source??'/layers.json';
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
        tick.textContent=tickLabel(item);
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
    this.renderMiniLegend(active,items);
  }
  // Condensed rendering of the exact same legend(state) data every layer
  // already exposes for its full drawer above — never a second,
  // separately maintained legend definition that could drift out of sync.
  // Ramp layers (Noise/Price/Energy) collapse to a bar with only the two
  // end labels; every other layout (Age's year bands, Use's register
  // categories, Parking's zone key) stays dots-and-labels so bucketed or
  // categorical data is never misrepresented as a continuous gradient.
  renderMiniLegend(active,items){
    const mini=this.container.querySelector('.lens-mini-legend');mini.replaceChildren();
    mini.classList.toggle('is-ramp',active.legendLayout==='ramp');
    if(active.id==='overview')return;
    if(active.legendLayout==='ramp'){
      const bands=items.filter(item=>item.id!=='unknown');
      const [start,end]=active.legendEnds??['Quieter','Louder'];
      const ramp=document.createElement('div');ramp.className='mini-ramp';
      const bar=document.createElement('div');bar.className='mini-ramp-bar';
      bar.style.background=`linear-gradient(90deg,${bands.map(item=>item.color).join(',')})`;
      const low=document.createElement('span');low.className='mini-ramp-end';low.textContent=`${tickLabel(bands[0])} · ${start}`;
      const high=document.createElement('span');high.className='mini-ramp-end';high.textContent=`${tickLabel(bands[bands.length-1])} · ${end}`;
      ramp.append(low,bar,high);mini.append(ramp);
    }else for(const item of items){
      const entry=document.createElement('span');entry.className='mini-swatch';
      const swatch=document.createElement('i');swatch.style.background=item.color;
      entry.append(swatch,document.createTextNode(item.label));mini.append(entry);
    }
  }
}
