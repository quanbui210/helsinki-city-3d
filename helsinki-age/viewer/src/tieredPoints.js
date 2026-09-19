export function tierWeights(range){
  const smooth=(a,b)=>{const t=Math.max(0,Math.min(1,(range-a)/(b-a)));return t*t*(3-2*t);};
  const far=smooth(2200,3400),near=1-smooth(650,1100);
  return {area:far,cluster:(1-far)*(1-near),point:near};
}
// Screen-space bins are rebuilt from projected points whenever the camera moves.
export function clusterPoints(points,size=64){
  const bins=new Map();
  for(const p of points){const key=`${Math.floor(p.x/size)},${Math.floor(p.y/size)}`;let b=bins.get(key);if(!b){b={x:0,y:0,count:0,members:[]};bins.set(key,b);}b.x+=p.x;b.y+=p.y;b.count++;b.members.push(p);}
  return [...bins.values()].map(b=>({...b,x:b.x/b.count,y:b.y/b.count}));
}
