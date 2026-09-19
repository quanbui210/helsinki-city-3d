import {TieredPointRenderer} from './TieredPointRenderer.js';
// A manifest lookup is joined once per streamed content, never once per frame.
// No camera operations belong here: switching lenses preserves the view.
export class LayerManager {
  constructor({tileset, layers, manifest,viewer,getRange}) {
    this.tileset=tileset;
    this.layers=new Map(layers.map(layer=>[layer.id,layer]));
    this.records=new Map(manifest.map(record=>[record.buildingId,record]));
    this.states=Object.fromEntries(layers.map(layer=>[layer.id,{...layer.defaults}]));
    this.activeId=this.layers.has('overview')?'overview':'age';
    this.hydrated=new WeakSet();
    this.renderers=new Map(layers.filter(l=>l.renderMode==='tiered-points').map(l=>[l.id,new TieredPointRenderer(viewer,l.tieredPoints,getRange)]));
    this.ready=Promise.all([...this.renderers.values()].map(r=>r.ready));
    tileset.tileVisible.addEventListener(tile=>this.hydrate(tile.content));
  }
  get active(){return this.layers.get(this.activeId);}
  get state(){return this.states[this.activeId];}
  activate(id){if(!this.layers.has(id))return false;this.activeId=id;this.apply();return true;}
  update(state){Object.assign(this.state,state);this.apply();}
  apply(){this.tileset.style=this.active.buildStyle(this.state);for(const [id,renderer] of this.renderers)renderer.set(id===this.activeId);}
  hydrate(content){
    if(!content||this.hydrated.has(content))return;
    for(let i=0;i<(content.innerContents?.length||0);i++)this.hydrate(content.innerContents[i]);
    for(let i=0;i<(content.featuresLength||0);i++){
      const feature=content.getFeature(i), record=this.records.get(feature.getProperty('buildingId'));
      for(const layer of this.layers.values())for(const [name,value] of Object.entries(layer.properties?.(record)||{}))feature.setProperty(name,value);
    }
    this.hydrated.add(content);
  }
}
