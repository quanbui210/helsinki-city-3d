export class BuildingPanel {
  constructor(card){
    this.card=card;this.key=null;
    // Keep source identifiers available without placing them before useful context.
    const provenance=document.createElement('details');provenance.className='record-provenance';
    const disclosure=document.createElement('summary');disclosure.textContent='Sources & record details';provenance.append(disclosure);
    const fields=document.createElement('dl');
    for(const id of ['building-ratu','building-lod']){const value=document.getElementById(id);fields.append(value.previousElementSibling,value);}
    provenance.append(fields,document.getElementById('building-status'));document.getElementById('building-prompt').before(provenance);
    const header=document.createElement('div');header.className='record-header';
    for(const id of ['close-building','building-address'])header.append(document.getElementById(id));
    this.summary=document.createElement('button');this.summary.className='record-listing-summary';this.summary.type='button';this.summary.setAttribute('aria-live','polite');this.summary.onclick=()=>this.select('listings');header.append(this.summary);
    const tabs=document.createElement('div');tabs.className='record-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Building information');
    this.buttons={};this.panels={};
    for(const [id,label] of [['context','Building & area'],['listings','Listings']]){
      const button=document.createElement('button');button.id=`record-tab-${id}`;button.type='button';button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',`record-panel-${id}`);button.onclick=()=>this.select(id);tabs.append(button);this.buttons[id]=button;
      button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'context':e.key==='End'?'listings':id==='context'?'listings':'context';this.select(next);this.buttons[next].focus();}};
      const panel=document.createElement('div');panel.id=`record-panel-${id}`;panel.className='record-body';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);this.panels[id]=panel;
    }
    header.append(tabs);
    for(const child of [...card.children])if(child.id==='building-listings')this.panels.listings.append(child);else this.panels.context.append(child);
    card.replaceChildren(header,this.panels.context,this.panels.listings);this.select('context');this.status('loading');
  }
  select(id){this.active=id;for(const key of Object.keys(this.buttons)){const active=key===id;this.buttons[key].setAttribute('aria-selected',String(active));this.buttons[key].tabIndex=active?0:-1;this.panels[key].hidden=!active;}}
  open(record){const key=record.buildingId??record.address;if(this.key!==key){this.key=key;this.select('context');for(const panel of Object.values(this.panels))panel.scrollTop=0;}}
  status(state,count=0){
    this.summary.dataset.state=state;
    this.summary.textContent=state==='loading'?'Checking listing sites…':state==='found'?`${count} search ${count===1?'match':'matches'} · View results →`:state==='empty'?'No indexed matches · Search manually →':'Listing search unavailable · Options →';
    this.buttons.listings.textContent=state==='found'?`Listings (${count})`:'Listings';
  }
}
