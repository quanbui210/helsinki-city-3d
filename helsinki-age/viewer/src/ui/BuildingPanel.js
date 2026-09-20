import {isShortlisted,setShortlisted} from '../shortlist.js';
// Order matches real shopper priority (see main.js layer order comment):
// price and noise land first, age/energy/use are supporting context, parking last.
const METRICS=[
  ['price','Price'],['noise','Noise'],['age','Age'],
  ['energy','Energy'],['use','Use'],['parking','Parking'],
];
export class BuildingPanel {
  constructor(card){
    this.card=card;this.key=null;
    const header=document.createElement('div');header.className='record-header';
    for(const id of ['close-building','building-address'])header.append(document.getElementById(id));
    this.expand=document.createElement('button');this.expand.id='expand-building';this.expand.className='record-expand';this.expand.type='button';
    this.expand.onclick=()=>this.syncExpand(!this.card.classList.contains('is-expanded'));
    header.append(this.expand);
    let stored=null;try{stored=sessionStorage.getItem('lens-record-wide');}catch{/* private mode */}
    // No prior choice this session: default open on desktop, where there's room to spare.
    this.syncExpand(stored===null?innerWidth>1024:stored==='1');
    this.summary=document.createElement('button');this.summary.className='record-listing-summary';this.summary.type='button';this.summary.setAttribute('aria-live','polite');
    this.summary.onclick=()=>{this.select('listings');if(this.summary.dataset.state==='idle')this.requestSearch?.();};
    header.append(this.summary);
    this.shortlist=document.createElement('button');this.shortlist.className='record-shortlist';this.shortlist.type='button';
    this.shortlist.onclick=()=>{const saved=!isShortlisted(this.key);setShortlisted(this.key,saved);this.syncShortlist(saved);};
    // Ships later with a list/compare view. Persistence stays in shortlist.js —
    // hide the control so localStorage-only save is not a dead-end in the panel.
    // Restore: remove hidden=true (keep the append). Do not hide #step-inside-button.
    this.shortlist.hidden=true;
    header.append(this.shortlist);
    const tabs=document.createElement('div');tabs.className='record-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Building information');
    this.buttons={};this.panels={};
    for(const [id,label] of [['context','Building & area'],['listings','Listings']]){
      const button=document.createElement('button');button.id=`record-tab-${id}`;button.type='button';button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',`record-panel-${id}`);button.onclick=()=>this.select(id);tabs.append(button);this.buttons[id]=button;
      button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'context':e.key==='End'?'listings':id==='context'?'listings':'context';this.select(next);this.buttons[next].focus();}};
      const panel=document.createElement('div');panel.id=`record-panel-${id}`;panel.className='record-body';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);this.panels[id]=panel;
    }
    header.append(tabs);
    // Compact glanceable grid only: label + one-line value, no per-card
    // expand. Everything that used to grow inline (methodology, trend
    // breakdowns, street context, sources) now lives in one dialog — see
    // buildDetailDialog() — reached through this.detailTrigger below.
    const grid=document.createElement('div');grid.className='record-metrics';
    this.metrics={};
    this.buildDetailDialog();
    for(const [id,label] of METRICS){
      const metric=document.createElement('div');metric.className='record-metric';metric.dataset.metric=id;
      const labelEl=document.createElement('span');labelEl.className='metric-label';labelEl.textContent=label;
      const valueEl=document.createElement('span');valueEl.className='metric-value';valueEl.textContent='—';
      metric.append(labelEl,valueEl);grid.append(metric);
      const section=this.detailDialog.querySelector(`[data-detail="${id}"]`);
      this.metrics[id]={card:metric,value:valueEl,detailValue:section.querySelector('.detail-value'),body:section.querySelector('.detail-body')};
    }
    this.detailTrigger=document.createElement('button');this.detailTrigger.type='button';this.detailTrigger.id='open-building-detail';this.detailTrigger.className='record-detail-trigger';this.detailTrigger.setAttribute('aria-haspopup','dialog');
    const triggerLabel=document.createElement('span');triggerLabel.textContent='Full details & sources';
    const triggerArrow=document.createElement('span');triggerArrow.setAttribute('aria-hidden','true');triggerArrow.textContent='→';
    this.detailTrigger.append(triggerLabel,triggerArrow);
    this.detailTrigger.onclick=()=>this.detailDialog.showModal();
    document.getElementById('building-status').className='record-status';
    // building-prompt/cinematic-view are detail-oriented secondary actions
    // now, not part of the compact default view — route them straight into
    // the dialog's action row instead of the context tab.
    for(const child of [...card.children]){
      if(child.id==='building-listings')this.panels.listings.append(child);
      else if(child.id==='building-prompt'||child.id==='cinematic-view')this.detailActions.append(child);
      else this.panels.context.append(child);
    }
    this.panels.context.prepend(grid,this.detailTrigger);
    card.replaceChildren(header,this.panels.context,this.panels.listings);this.select('context');this.status('idle');
  }
  // Builds the centered <dialog> holding every metric's full detail plus
  // the relocated noise/cinematic prompts. Reuses the app's existing
  // native <dialog>/showModal glass styling (lens.css/style.css `dialog{}`)
  // for visual consistency rather than a bespoke modal, and matches the
  // existing about-dialog's backdrop-click-to-close convention.
  buildDetailDialog(){
    const dialog=document.createElement('dialog');dialog.id='building-detail-dialog';
    const close=document.createElement('button');close.type='button';close.className='close';close.id='close-building-detail';close.setAttribute('aria-label','Close full details');close.textContent='×';close.onclick=()=>dialog.close();
    const eyebrow=document.createElement('div');eyebrow.className='eyebrow';eyebrow.textContent='FULL DETAIL';
    const heading=document.createElement('h2');heading.textContent='Everything on record';
    this.detailAddress=document.createElement('p');this.detailAddress.className='detail-subhead';
    const sections=document.createElement('div');sections.className='detail-sections';
    for(const [id,label] of METRICS){
      const section=document.createElement('section');section.className='detail-section';section.dataset.detail=id;
      const h3=document.createElement('h3');h3.textContent=label;
      const value=document.createElement('strong');value.className='detail-value';
      const body=document.createElement('div');body.className='detail-body';
      section.append(h3,value,body);sections.append(section);
    }
    this.detailActions=document.createElement('div');this.detailActions.className='detail-actions';
    dialog.append(close,eyebrow,heading,this.detailAddress,sections,this.detailActions);
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    document.body.append(dialog);
    this.detailDialog=dialog;
  }
  syncExpand(wide){
    this.card.classList.toggle('is-expanded',wide);
    this.expand.setAttribute('aria-expanded',String(wide));
    this.expand.title=wide?'Compact panel':'Expand panel';
    this.expand.setAttribute('aria-label',this.expand.title);
    this.expand.textContent=wide?'⤡':'⤢';
    try{sessionStorage.setItem('lens-record-wide',wide?'1':'0');}catch{/* private mode */}
  }
  syncShortlist(saved){
    this.shortlist.classList.toggle('is-saved',saved);
    this.shortlist.textContent=saved?'Saved ✓':'+ Save to shortlist';
    this.shortlist.setAttribute('aria-pressed',String(saved));
  }
  select(id){this.active=id;for(const key of Object.keys(this.buttons)){const active=key===id;this.buttons[key].setAttribute('aria-selected',String(active));this.buttons[key].tabIndex=active?0:-1;this.panels[key].hidden=!active;}}
  open(record){
    const key=record.buildingId??record.address;
    if(this.key!==key){this.key=key;this.select('context');for(const panel of Object.values(this.panels))panel.scrollTop=0;}
    this.syncShortlist(isShortlisted(this.key));
    this.detailAddress.textContent=record.address||'This building';
  }
  status(state,count=0){
    this.summary.dataset.state=state;
    this.summary.textContent=state==='idle'?'View current listings →':state==='loading'?'Looking up…':state==='found'?`${count} listing${count===1?'':'s'} found →`:state==='empty'?'None found →':'Could not check listings →';
    this.buttons.listings.textContent=state==='found'?`Listings (${count})`:'Listings';
  }
  // Sets a metric's compact one-line value and its matching dialog section.
  // `body` is either plain detail text (age/noise/energy/use) or a
  // render(container) callback for metrics whose detail is already built
  // from a structured helper (price/parking's buildingContext()), which
  // supplies its own headings and source link. `source` adds the shared
  // "Data sources & methodology" link used elsewhere (LayerSwitcher) for
  // metrics that don't already embed one.
  setMetric(id,value,body,source){
    const m=this.metrics[id];
    m.value.textContent=value;
    m.detailValue.textContent=value;
    m.body.replaceChildren();
    if(typeof body==='function')body(m.body);
    else{
      const p=document.createElement('p');p.textContent=body;m.body.append(p);
      if(source){const a=document.createElement('a');a.className='detail-source';a.href=source;a.target='_blank';a.rel='noopener';a.textContent='Data sources & methodology ↗';m.body.append(a);}
    }
  }
  closeDetail(){this.detailDialog.close();}
}
