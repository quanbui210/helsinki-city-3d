import * as C from 'cesium';
import {tierWeights,clusterPoints} from './tieredPoints.js';
export class TieredPointRenderer {
  constructor(viewer,config,getRange){
    this.viewer=viewer;this.config=config;this.getRange=getRange;this.active=false;this.sources=[];this.lastSignature='';
    this.points=viewer.scene.primitives.add(config.pointImage?new C.BillboardCollection():new C.PointPrimitiveCollection());
    this.entries=config.points.map(p=>({data:p,position:C.Cartesian3.fromDegrees(...p.position,2),primitive:this.points.add({id:{renderer:this,point:p},position:C.Cartesian3.fromDegrees(...p.position,2),...(config.pointImage?{image:config.pointImage(p),width:26,height:26,disableDepthTestDistance:Number.POSITIVE_INFINITY,color:C.Color.WHITE}:{pixelSize:7,color:C.Color.fromCssColorString(config.pointColor(p)),outlineColor:C.Color.fromCssColorString('#18343b'),outlineWidth:1})})}));this.points.show=false;
    this.overlay=document.createElement('div');this.overlay.className='tiered-clusters';this.overlay.hidden=true;viewer.container.append(this.overlay);
    this.detail=document.createElement('div');this.detail.className='tiered-point-detail';this.detail.hidden=true;this.detail.setAttribute('role','status');viewer.container.append(this.detail);
    this.handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);this.handler.setInputAction(e=>{const picked=viewer.scene.pick(e.position)?.id;this.detail.hidden=true;if(this.active&&config.enabled?.()!==false&&picked?.renderer===this){this.showDetail(picked.point);}},C.ScreenSpaceEventType.LEFT_CLICK);
    this.ready=(async()=>{
      if(!config.aggregate)return; // Orientation POIs have no density wash.
      const areas=config.aggregate(config.points);
      const source=await C.GeoJsonDataSource.load({type:'FeatureCollection',features:areas.map((a,i)=>({type:'Feature',id:String(i),geometry:a.geometry,properties:{}}))},{clampToGround:true});
      for(const e of source.entities.values){const a=areas[Number(e.id)];if(!a||!e.polygon)continue;e.polygon.material=C.Color.fromCssColorString(config.areaColor(a.metric)).withAlpha(.62);e.polygon.classificationType=C.ClassificationType.TERRAIN;e.polygon.outline=false;}
      // Transparent inactive geometry prepares on the GPU before a user selects
      // the layer, avoiding a blank interval on the first switch.
      source.show=true;for(const e of source.entities.values)if(e.polygon)e.polygon.material.color=e.polygon.material.color.getValue().withAlpha(0);
      await viewer.dataSources.add(source);this.sources.push(source);
      // Outlines mark only occupied aggregation cells, not an invented surveyed boundary.
      this.boundaries=new C.CustomDataSource('Mapped records footprint');
      for(const a of areas)this.boundaries.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArray(a.geometry.coordinates[0].flat()),width:1,clampToGround:true,material:C.Color.fromCssColorString('#b8c9bf').withAlpha(.32)}});
      this.boundaries.show=this.active;await viewer.dataSources.add(this.boundaries);this.lastSignature='';this.update();
    })();
    this.removeListener=viewer.scene.postRender.addEventListener(()=>this.update());
  }
  showDetail(point){if(this.config.renderDetail){this.detail.replaceChildren();this.config.renderDetail(this.detail,point);this.detail.hidden=false;}else if(this.config.describePoint){this.detail.textContent=this.config.describePoint(point);this.detail.hidden=false;}}
  set(active){if(this.active===active)return;this.active=active;this.detail.hidden=true;this.overlay.hidden=!active;this.points.show=active;if(!active)for(const s of this.sources)for(const e of s.entities.values)if(e.polygon)e.polygon.material.color=e.polygon.material.color.getValue().withAlpha(0);if(this.boundaries)this.boundaries.show=active;this.lastSignature='';if(active)this.update();}
  update(){
    if(!this.active)return;
    if(this.config.enabled?.()===false){this.points.show=false;this.overlay.hidden=true;this.detail.hidden=true;this.lastSignature='';return;}
    this.overlay.hidden=false;
    const camera=this.viewer.camera,canvas=this.viewer.scene.canvas,range=this.getRange();
    const signature=[...C.Matrix4.toArray(camera.viewMatrix).map(v=>v.toFixed(4)),canvas.clientWidth,canvas.clientHeight,range.toFixed(2)].join(',');
    if(signature===this.lastSignature)return;this.lastSignature=signature;this.detail.hidden=true;
    const weights=tierWeights(range);this.weights=weights;
    for(const source of this.sources){for(const entity of source.entities.values){const material=entity.polygon?.material;if(material){const color=material.color.getValue();material.color=color.withAlpha(.62*weights.area);}}}
    this.points.show=weights.point>0;
    if(weights.point>0)for(const e of this.entries){e.primitive.color=(this.config.pointImage?C.Color.WHITE:C.Color.fromCssColorString(this.config.pointColor(e.data))).withAlpha(weights.point);if(!this.config.pointImage)e.primitive.outlineColor=C.Color.fromCssColorString('#18343b').withAlpha(weights.point);}
    this.overlay.style.opacity=String(weights.cluster);this.clusters=[];
    if(weights.cluster<=0){this.overlay.replaceChildren();return;}
    const projected=[];
    for(const entry of this.entries){const point=C.SceneTransforms.worldToWindowCoordinates(this.viewer.scene,entry.position);if(point&&point.x>=0&&point.y>=0&&point.x<=canvas.clientWidth&&point.y<=canvas.clientHeight)projected.push({...point,entry});}
    this.clusters=clusterPoints(projected,this.config.clusterSize??96);
    while(this.overlay.children.length>this.clusters.length)this.overlay.lastChild.remove();
    this.clusters.forEach((cluster,i)=>{const button=this.overlay.children[i]??document.createElement('button'),members=cluster.members.map(m=>m.entry.data);button.className=`tiered-cluster ${this.config.clusterClass??''}`;button.replaceChildren();if(this.config.renderCluster)this.config.renderCluster(button,members);else button.textContent=String(cluster.count);button.style.left=`${cluster.x}px`;button.style.top=`${cluster.y}px`;button.title=this.config.clusterTitle?.(members)??`${cluster.count} ${this.config.countLabel} · zoom in`;button.setAttribute('aria-label',button.title);button.onclick=()=>this.config.onCluster(members);if(!button.parentNode)this.overlay.append(button);});
  }
  destroy(){this.removeListener();this.handler.destroy();this.overlay.remove();this.detail.remove();this.viewer.scene.primitives.remove(this.points);for(const source of this.sources)this.viewer.dataSources.remove(source,true);if(this.boundaries)this.viewer.dataSources.remove(this.boundaries,true);}
}
