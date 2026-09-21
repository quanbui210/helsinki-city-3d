export const TRANSIT_RADIUS=1500,LANDMARK_RADIUS=800;
export function distanceM(a,b){
 const rad=Math.PI/180,dl=(b[0]-a[0])*rad,dp=(b[1]-a[1])*rad;
 const h=Math.sin(dp/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dl/2)**2;
 return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
// Straight-line ordering, not walking-route accuracy. Distinct GTFS boarding
// platforms remain distinct; stop codes distinguish opposite directions.
export function nearbyFor(position,stops,landmarks){
 const nearest=[];
 for(const stop of stops){const distance=distanceM(position,stop.position);if(nearest.length===3&&distance>=nearest[2].distance)continue;nearest.push({stop,distance});nearest.sort((a,b)=>a.distance-b.distance||a.stop.id.localeCompare(b.stop.id));if(nearest.length>3)nearest.pop();}
 const nearbyTransit=nearest.map(({stop,distance})=>({id:stop.id,name:stop.name,type:stop.type,code:stop.code,distanceM:Math.round(distance),lines:stop.lines}));
 const nearbyLandmarks=landmarks.map(p=>({id:p.id,name:p.name,type:p.type,distanceM:Math.round(distanceM(position,p.position))})).filter(p=>p.distanceM<=LANDMARK_RADIUS).sort((a,b)=>a.distanceM-b.distanceM||a.id.localeCompare(b.id));
 return {nearbyTransit,nearbyLandmarks};
}
export function insideCoverage(position,bounds){return Boolean(position&&bounds&&position[0]>=bounds[0]&&position[0]<=bounds[2]&&position[1]>=bounds[1]&&position[1]<=bounds[3]);}
export function displayDistance(m){return m<1000?`${Math.round(m/10)*10} m`:`${(m/1000).toFixed(1)} km`;}
