import * as C from 'cesium';
function treeImage(index){
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#685540';ctx.fillRect(44,62,8,66);
  const palettes=[['#415b3a','#5f7849','#78915a'],['#3f5a42','#607b51','#7f9664'],['#394f3e','#54714d','#6c8658']];
  for(const [i,x,y,r] of [[0,48,55,35],[1,30,46,25],[1,65,48,26],[2,48,28,24]]){ctx.fillStyle=palettes[index][i];ctx.beginPath();for(let k=0;k<9;k++){const a=k/9*Math.PI*2;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();}
  return canvas.toDataURL();
}
export class StreetTrees {
  constructor(viewer,data,nav){
    this.viewer=viewer;this.nav=nav;this.data=data;this.cells=new Map();this.loaded=new Map();this.images=[0,1,2].map(treeImage);
    for(const tree of data.trees){const key=[Math.floor(tree.position[0]/.01),Math.floor(tree.position[1]/.005)].join(',');if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(tree);}
    let previous=0;this.remove=viewer.scene.postRender.addEventListener(()=>{if(performance.now()-previous<350)return;previous=performance.now();this.update();});
  }
  update(){
    const {lon,lat,range}=this.nav.state,key=`${Math.floor(lon/.005)},${Math.floor(lat/.0025)},${range<3500}`;if(key===this.key)return;this.key=key;
    const wanted=new Set();if(range<3500)for(const [cell,trees] of this.cells){const p=trees[0].position;if(Math.hypot((p[0]-lon)*55500,(p[1]-lat)*111000)<2200)wanted.add(cell);}
    for(const [cell,collection] of this.loaded)if(!wanted.has(cell)){this.viewer.scene.primitives.remove(collection);this.loaded.delete(cell);}
    for(const cell of wanted)if(!this.loaded.has(cell)){
      const collection=this.viewer.scene.primitives.add(new C.BillboardCollection({scene:this.viewer.scene}));
      for(const tree of this.cells.get(cell)){const i=tree.id%3;collection.add({position:C.Cartesian3.fromDegrees(...tree.position,0),image:this.images[i],width:6+i,height:9+i*1.5,sizeInMeters:true,verticalOrigin:C.VerticalOrigin.BOTTOM,distanceDisplayCondition:new C.DistanceDisplayCondition(0,3500),translucencyByDistance:new C.NearFarScalar(1800,1,3500,0)});}
      this.loaded.set(cell,collection);
    }
  }
}
