// The project's generated b3dm files contain unindexed float32 triangles in
// glTF's Y-up coordinates. Reject other encodings rather than guessing.
export function decodeBuildings(buffer){
 const v=new DataView(buffer),decoder=new TextDecoder(),str=(o,n)=>decoder.decode(new Uint8Array(buffer,o,n));
 if(str(0,4)!=='b3dm')throw Error('Unsupported building tile');
 const ft=v.getUint32(12,true),fb=v.getUint32(16,true),bt=v.getUint32(20,true),bb=v.getUint32(24,true),batch=JSON.parse(str(28+ft+fb,bt)),glb=28+ft+fb+bt+bb;
 if(str(glb,4)!=='glTF'||v.getUint32(glb+4,true)!==2)throw Error('Unsupported model');
 const jsonLength=v.getUint32(glb+12,true),gltf=JSON.parse(str(glb+20,jsonLength)),binary=glb+28+jsonLength,primitive=gltf.meshes[0].primitives[0];
 if(primitive.indices!==undefined||gltf.meshes.length!==1)throw Error('Unsupported triangle encoding');
 const read=index=>{const a=gltf.accessors[index],b=gltf.bufferViews[a.bufferView];if(a.componentType!==5126||b.byteStride)throw Error('Unsupported accessor');return new Float32Array(buffer,binary+(b.byteOffset??0)+(a.byteOffset??0),a.count*(a.type==='VEC3'?3:1));};
 const positions=read(primitive.attributes.POSITION),ids=read(primitive.attributes._BATCHID),groups=new Map();
 for(let i=0;i<positions.length;i+=9){const id=batch.buildingId[ids[i/3]];if(!id)continue;let g=groups.get(id);if(!g){g={id,triangles:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};groups.set(id,g);}for(let j=0;j<9;j++){const x=positions[i+j],a=j%3;g.triangles.push(x);g.min[a]=Math.min(g.min[a],x);g.max[a]=Math.max(g.max[a],x);}}
 return [...groups.values()].map(g=>({...g,triangles:Float32Array.from(g.triangles)}));
}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function rayTriangle(origin,direction,a,b,c){
 const e1=sub(b,a),e2=sub(c,a),p=cross(direction,e2),det=dot(e1,p);if(Math.abs(det)<1e-8)return null;
 const t=sub(origin,a),u=dot(t,p)/det;if(u<0||u>1)return null;const q=cross(t,e1),w=dot(direction,q)/det;if(w<0||u+w>1)return null;const d=dot(e2,q)/det;return d>0.05?d:null;
}
function hitsBox(o,d,g,max){let lo=0,hi=max;for(let a=0;a<3;a++){if(Math.abs(d[a])<1e-9){if(o[a]<g.min[a]||o[a]>g.max[a])return false;continue;}let t1=(g.min[a]-o[a])/d[a],t2=(g.max[a]-o[a])/d[a];if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;}return true;}
export function rayDistance(origin,direction,buildings,max=1000){
 let closest=max,hit=null;
 for(const g of buildings){if(!hitsBox(origin,direction,g,closest))continue;const t=g.triangles;for(let i=0;i<t.length;i+=9){const d=rayTriangle(origin,direction,t.subarray(i,i+3),t.subarray(i+3,i+6),t.subarray(i+6,i+9));if(d!==null&&d<closest){closest=d;hit=g.id;}}}
 return {distance:closest,hit};
}
export function facadePoint(building,angle,height){
 const direction=[Math.sin(angle),0,-Math.cos(angle)],origin=[(building.min[0]+building.max[0])/2,height,(building.min[2]+building.max[2])/2];
 let last=null,normal;const t=building.triangles;
 for(let i=0;i<t.length;i+=9){const a=t.subarray(i,i+3),b=t.subarray(i+3,i+6),c=t.subarray(i+6,i+9),d=rayTriangle(origin,direction,a,b,c);if(d!==null&&(last===null||d>last)){last=d;normal=cross(sub(b,a),sub(c,a));}}
 if(last===null||Math.abs(normal[1]/Math.hypot(...normal))>.3){
  // Upper floors of stepped buildings may not cross the footprint centre.
  // Find an exterior wall segment at this height, on the requested side.
  let best=null,score=-Infinity;
  for(let i=0;i<t.length;i+=9){const vertices=[...Array(3)].map((_,j)=>Array.from(t.subarray(i+j*3,i+j*3+3))),n=cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])),len=Math.hypot(...n);if(!len||Math.abs(n[1]/len)>.3)continue;
   const points=[];for(let j=0;j<3;j++){const a=vertices[j],b=vertices[(j+1)%3];if((a[1]<=height&&b[1]>height)||(b[1]<=height&&a[1]>height)){const f=(height-a[1])/(b[1]-a[1]);points.push(a.map((v,k)=>v+(b[k]-v)*f));}}
   if(points.length!==2)continue;const p=points[0].map((v,k)=>(v+points[1][k])/2);let out=n.map(v=>v/len);if(dot(out,direction)<0)out=out.map(v=>-v);if(dot(out,direction)<.35)continue;
   const projection=dot(sub(p,origin),direction);if(projection>score){score=projection;best={p,out};}
  }
  if(!best)return null;const {p,out}=best,h=Math.hypot(out[0],out[2]),d=[out[0]/h,0,out[2]/h];return {origin:p.map((v,k)=>v+d[k]*.5),direction:d,angle:Math.atan2(d[0],-d[2])};
 }
 const length=Math.hypot(...normal);if(!length)return null;
 normal=normal.map(x=>x/length);if(dot(normal,direction)<0)normal=normal.map(x=>-x);
 const horizontal=Math.hypot(normal[0],normal[2]),out=[normal[0]/horizontal,0,normal[2]/horizontal];
 return {origin:origin.map((x,i)=>x+direction[i]*last+out[i]*.5),direction:out,angle:Math.atan2(out[0],-out[2])};
}
export function openness(distances){const mean=distances.reduce((s,d)=>s+Math.min(d,120),0)/distances.length;return mean<25?'Faces another building closely':mean<70?'Partially blocked':'Mostly open';}
export function floorDimensions(building,count,nearby=[]){
 // Negative model bases can be basement slabs. With no surveyed terrain,
 // use the median of the nearest above-datum model bases and disclose it.
 let ground=building.min[1],groundEstimated=ground<0;
 if(groundEstimated){const x=(building.min[0]+building.max[0])/2,z=(building.min[2]+building.max[2])/2;
  const bases=nearby.filter(g=>g.id!==building.id&&g.min[1]>=0).map(g=>({height:g.min[1],distance:Math.hypot((g.min[0]+g.max[0])/2-x,(g.min[2]+g.max[2])/2-z)})).filter(g=>g.distance<200).sort((a,b)=>a.distance-b.distance).slice(0,8).map(g=>g.height).sort((a,b)=>a-b);
  ground=bases.length?bases[Math.floor(bases.length/2)]:0;
 }
 const known=Number.isInteger(count)&&count>0&&count<=100?count:null,height=building.max[1]-ground,derived=known?height/known:null;
 return {ground,groundEstimated,height,perFloor:derived&&derived>=2&&derived<=5?derived:3,derived:Boolean(derived&&derived>=2&&derived<=5),maxFloor:known??8};
}
