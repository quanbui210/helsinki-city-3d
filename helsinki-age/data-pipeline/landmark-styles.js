const R=6371000,rad=value=>value*Math.PI/180;
export function distanceM(a,b){
 const p1=rad(a[1]),p2=rad(b[1]),dp=p2-p1,dl=rad(b[0]-a[0]);
 const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
 return 2*R*Math.asin(Math.sqrt(h));
}
export const landmarkStyleId=style=>style==='stadium'?1:style==='cathedral'?2:0;
export function matchLandmarkStyles(manifest,landmarks){
 const featured=landmarks.filter(place=>place.type==='stadium'||place.name==='Helsinki Cathedral');
 const used=new Set(),matches=[];
 for(const place of featured){
  const style=place.type==='stadium'?'stadium':'cathedral',limit=style==='stadium'?45:20;
  const candidates=manifest.map(building=>({building,distanceM:distanceM(place.position,building.position)})).sort((a,b)=>a.distanceM-b.distanceM);
  const match=candidates.find(candidate=>candidate.distanceM<=limit&&!used.has(candidate.building.buildingId));
  if(!match)throw Error(`No unambiguous modeled building within ${limit} m of ${place.name}`);
  used.add(match.building.buildingId);
  matches.push({buildingId:match.building.buildingId,landmarkId:place.id,landmarkName:place.name,landmarkStyle:style,distanceM:Math.round(match.distanceM*10)/10});
 }
 return matches;
}
