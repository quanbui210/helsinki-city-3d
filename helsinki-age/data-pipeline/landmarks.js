// Deliberate MVP curation. Names are source names, not inferred importance.
// Exact categories prevent similarly named cafes, stops and bicycle rentals
// from being mistaken for the actual landmark.
const malls=/^(Mall of Tripla|Kampin keskus|Forum|Citycenter|Kauppakeskus Kluuvi|Kämp Galleria|Redi|Kauppakeskus Ainoa|Iso Omena|Sello|Kauppakeskus Ruoholahti|Kauppakeskus Arabia|Lähipalvelukeskus Hertsi|Lauttis|Kaari|Kauppakeskus Itis|Easton Helsinki|A Bloc)$/i;
const churches=/^(Helsingin tuomiokirkko|Uspenskin katedraali|Temppeliaukion kirkko)$/i;
const stadiums=/^(Helsingin olympiastadion|Bolt Arena|Veikkaus Arena|Helsingin jäähalli|Espoo Metro Areena)$/i;
export function landmarkType(t){
 if(t.shop==='mall'&&malls.test(t.name))return 'shopping';
 if(t.amenity==='place_of_worship'&&churches.test(t.name))return 'church';
 if(t.leisure==='stadium'&&stadiums.test(t.name))return 'stadium';
 if(t.railway==='station'&&/^(Helsinki|Helsingin päärautatieasema|Pasila|Leppävaara)$/.test(t.name))return 'station';
 if(t.amenity==='library'&&t.wikidata==='Q18659999')return 'library';
 if(['gallery','museum'].includes(t.tourism)&&['Ateneum','Kiasma'].includes(t.name))return 'museum';
 if(t.historic==='monument'&&t.wikidata==='Q2584017')return 'monument';
 if(t.historic==='castle'&&t.wikidata==='Q1292442')return 'fortress';
 return null;
}
export function curateLandmarks(elements,bounds){
 const result=[],seen=new Set();
 // Prefer a tagged relation to a duplicate tagged building/node.
 for(const e of [...elements].sort((a,b)=>({relation:0,way:1,node:2}[a.type]-{relation:0,way:1,node:2}[b.type]))){
  const t=e.tags??{},type=landmarkType(t),p=e.center??e;if(!type||!Number.isFinite(p.lon)||!Number.isFinite(p.lat))continue;
  if(p.lon<bounds[0]||p.lon>bounds[2]||p.lat<bounds[1]||p.lat>bounds[3])continue;
  const key=t.wikidata??`${type}:${t.name.toLowerCase()}`;if(seen.has(key))continue;seen.add(key);
  result.push({id:`osm:${e.type}/${e.id}`,name:t['name:en']||t.name,sourceName:t.name,type,position:[p.lon,p.lat],url:`https://www.openstreetmap.org/${e.type}/${e.id}`});
 }
 return result.sort((a,b)=>a.id.localeCompare(b.id));
}
