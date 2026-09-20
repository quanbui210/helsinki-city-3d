import * as C from 'cesium';

export class BuildingSelection {
  constructor(viewer,tileset){
    this.viewer=viewer;this.record=null;this.features=new Set();this.visited=new WeakSet();
    this.marker=document.createElement('div');this.marker.id='selected-address-marker';this.marker.hidden=true;this.marker.setAttribute('aria-hidden','true');document.getElementById('app').append(this.marker);
    if(C.PostProcessStageLibrary.isSilhouetteSupported(viewer.scene)){
      this.edge=C.PostProcessStageLibrary.createEdgeDetectionStage();this.edge.uniforms.color=C.Color.fromCssColorString('#fff1ae');this.edge.uniforms.length=1.2;this.edge.selected=[];
      this.stage=viewer.scene.postProcessStages.add(C.PostProcessStageLibrary.createSilhouetteStage([this.edge]));this.stage.enabled=false;
    }
    tileset.tileVisible.addEventListener(tile=>this.attach(tile.content));
    tileset.tileUnload.addEventListener(tile=>{const remove=c=>{this.visited.delete(c);for(const inner of c.innerContents??[])remove(inner);for(let i=0;i<(c.featuresLength??0);i++)this.features.delete(c.getFeature(i));};if(tile.content)remove(tile.content);this.sync();});
    viewer.scene.postRender.addEventListener(()=>{
      if(!this.record?.position)return;
      const p=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,C.Cartesian3.fromDegrees(...this.record.position.slice(0,2),2));
      const visible=p&&p.x>0&&p.y>0&&p.x<viewer.scene.canvas.clientWidth&&p.y<viewer.scene.canvas.clientHeight;
      this.marker.hidden=!visible;if(visible)this.marker.style.transform=`translate(${p.x}px,${p.y}px)`;
    });
  }
  attach(content){
    if(!this.record?.buildingId||!content)return;let changed=false;
    const visit=c=>{if(this.visited.has(c))return;this.visited.add(c);for(const inner of c.innerContents??[])visit(inner);for(let i=0;i<(c.featuresLength??0);i++){const f=c.getFeature(i);if(f.getProperty('buildingId')===this.record.buildingId&&!this.features.has(f)){this.features.add(f);changed=true;}}};visit(content);if(changed)this.sync();
  }
  sync(){if(this.edge){this.edge.selected=[...this.features];this.stage.enabled=this.features.size>0;}}
  revealOnMobile(nav,card){
    cancelAnimationFrame(this.revealFrame);
    const reveal=()=>{
      if(document.body.classList.contains('step-inside-active')||!this.record?.position||innerWidth>700)return;
      if(nav.flight){this.revealFrame=requestAnimationFrame(reveal);return;}
      const p=C.SceneTransforms.worldToWindowCoordinates(this.viewer.scene,C.Cartesian3.fromDegrees(...this.record.position.slice(0,2),2));
      const bottom=card.getBoundingClientRect().top;
      if(p&&(p.y>bottom-35||p.y<150))nav.pan(0,Math.max(180,(140+bottom)/2)-p.y);
    };
    this.revealFrame=requestAnimationFrame(reveal);
  }
  show(record,contents){this.clear();this.record=record;for(const content of contents.values())this.attach(content);}
  clear(){cancelAnimationFrame(this.revealFrame);this.record=null;this.features.clear();this.visited=new WeakSet();this.marker.hidden=true;this.sync();}
}
