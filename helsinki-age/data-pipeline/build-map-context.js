import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import proj4 from 'proj4';
import {MAP_BBOX,PROJECTION,RAW,PUBLIC} from './config.js';
const load=async name=>JSON.parse(await readFile(`${RAW}context/${name}.geojson`,'utf8')).features;
const [land,areas,lines,names,districts,registeredNames]=await Promise.all(['Maavesi_maa_alueet_yleistetty','Opaskartta_alue','Opaskartta_muuviiva','Opaskartta_nimisto','Kaupunginosajako','Nimisto_piste_rekisteritiedot'].map(load));
const toLonLat=proj4(PROJECTION,'EPSG:4326');
const sw=toLonLat.forward([MAP_BBOX[0],MAP_BBOX[1]]),ne=toLonLat.forward([MAP_BBOX[2],MAP_BBOX[3]]);
const rectangle=[Math.floor(sw[0]*1000)/1000,Math.floor(sw[1]*1000)/1000,Math.ceil(ne[0]*1000)/1000,Math.ceil(ne[1]*1000)/1000],size=6144;
const xy=([lon,lat])=>[(lon-rectangle[0])/(rectangle[2]-rectangle[0])*size,(rectangle[3]-lat)/(rectangle[3]-rectangle[1])*size];
const path=coordinates=>coordinates.map(r=>r.map((p,i)=>`${i?'L':'M'}${xy(p).map(v=>v.toFixed(2)).join(' ')}`).join(' ')+'Z').join(' ');
const polygons=g=>g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
const themes={dusk:{water:'#102e3c',land:'#34484a',coast:'#799294',block:'#405456',park:'#2b544b',plaza:'#556564',road:'#78847d',edge:'#8c9587',pier:'#738d90'},day:{water:'#89b6bc',land:'#deddd0',coast:'#7b9f9d',block:'#cecfbf',park:'#adbd9d',plaza:'#e4dbbf',road:'#f2e9d6',edge:'#c8bfab',pier:'#8d9e99'}};
await mkdir(`${PUBLIC}map`,{recursive:true});
for(const [theme,c] of Object.entries(themes)){
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${c.water}"/>`;
 const add=(features,fill,stroke='none',width=0)=>{for(const f of features)for(const p of polygons(f.geometry))svg+=`<path d="${path(p)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" fill-rule="evenodd"/>`;};
 add(land,c.land,c.coast,1.4);
 add(areas.filter(f=>f.properties.tyyppi==='rakennuskortteli'),c.block);
 add(areas.filter(f=>['metsä','pelto'].includes(f.properties.luokka)),c.park);
 add(areas.filter(f=>f.properties.luokka==='aukio'),c.plaza);
 add(areas.filter(f=>f.properties.tyyppi==='vesistö'),c.water,c.coast,.8);
 add(areas.filter(f=>f.properties.tyyppi==='tie'),c.road,c.edge,.4);
 // Deliberately omit contemporary building footprints and planned roads from the age map.
 for(const f of lines.filter(f=>['rantalaituri','rautatie','metrorata'].includes(f.properties.luokka))){const ls=f.geometry?.type==='MultiLineString'?f.geometry.coordinates:f.geometry?.type==='LineString'?[f.geometry.coordinates]:[];for(const l of ls)svg+=`<path d="${l.map((p,i)=>`${i?'L':'M'}${xy(p).map(v=>v.toFixed(2)).join(' ')}`).join(' ')}" fill="none" stroke="${c.pier}" stroke-width="${f.properties.luokka==='rantalaituri'?1.2:.7}"/>`;}
 svg+='</svg>';
 await sharp(Buffer.from(svg)).png({palette:true,colours:128}).toFile(`${PUBLIC}map/${theme}.png`);
}
const coordinates=g=>g.type==='Point'?[g.coordinates]:g.coordinates.flat(g.type==='MultiPolygon'?2:g.type==='Polygon'||g.type==='MultiLineString'?1:0);
const center=g=>{const ps=coordinates(g),lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(const p of ps)for(let i=0;i<2;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}return lo.map((v,i)=>(v+hi[i])/2)};
const seen=new Set(),labels=[];
const majorStreets=new Set(names.filter(f=>['päätie','kokoojatie'].includes(f.properties.luokka)).map(f=>f.properties.teksti));
for(const f of registeredNames){
 const p=f.properties,name=p.nimi_suomi,kind=p.laji_selite||'';if(p.olotila!==1||!name||name.length<3||!f.geometry)continue;
 const type=/Kaupunginosa|Osa-alue/.test(kind)?'district':/Katu|väylä, polku|Silta, eritaso/.test(kind)?'street':/Lahti|Selkä|Kanava|Järvi/.test(kind)?'water':/Puisto|Tori|Pysäkki|Kartano/.test(kind)?'place':null;if(!type)continue;
 const point=center(f.geometry);if(point.some(v=>!Number.isFinite(v))||point[0]<rectangle[0]||point[0]>rectangle[2]||point[1]<rectangle[1]||point[1]>rectangle[3])continue;
 const key=`${name}:${type}`;if(seen.has(key))continue;seen.add(key);
 labels.push({name,position:point,type,major:majorStreets.has(name),sourceId:p.id,sourceLayer:'Nimisto_piste_rekisteritiedot'});
}
function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function contains(point,g){return polygons(g).some(p=>inRing(point,p[0])&&!p.slice(1).some(r=>inRing(point,r)));}
const manifest=JSON.parse(await readFile(`${PUBLIC}buildings-manifest.json`,'utf8'));
const neighborhoods=[];
for(const d of districts){const entries=manifest.filter(b=>contains(b.position,d.geometry));if(entries.length<10)continue;
 const name=d.properties.nimi_fi.toLocaleLowerCase('fi').replace(/(^|[- ])\p{L}/gu,c=>c.toLocaleUpperCase('fi'));
 const position=[0,1].map(i=>entries.reduce((sum,b)=>sum+b.position[i],0)/entries.length);
 neighborhoods.push({id:d.properties.tunnus,name,position,count:entries.length,known:entries.filter(b=>b.constructionYear!==null).length,bounds:d.geometry});
}
await writeFile(`${PUBLIC}map/context.json`,JSON.stringify({rectangle,labels,neighborhoods,source:JSON.parse(await readFile(`${RAW}context/source.json`,'utf8')),note:'Present-day reference geography. Partial 3D coverage: 2019 crop plus official citydb increments.'}));
console.log(`Created basemaps, ${labels.length} official labels, ${neighborhoods.length} neighborhoods.`,neighborhoods.map(n=>`${n.name}: ${n.count}`));
