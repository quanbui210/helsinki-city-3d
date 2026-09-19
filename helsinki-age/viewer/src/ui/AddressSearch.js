export const normalizeAddress=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fi').replace(/\s+/g,' ').trim();
export function searchPlaces(items,query){
 const q=normalizeAddress(query);if(q.length<2)return [];
 return items.filter(item=>item.key.includes(q)||item.aliasKey?.includes(q)).sort((a,b)=>
   Number(b.key===q)-Number(a.key===q)||Number(b.key.startsWith(q))-Number(a.key.startsWith(q))||Number(Boolean(b.buildingId))-Number(Boolean(a.buildingId))||a.name.localeCompare(b.name,'fi',{numeric:true})
 ).slice(0,8);
}
export function addressItems(addresses,manifest,context){
 const modeledNames=new Set(manifest.filter(b=>b.address).map(b=>normalizeAddress(b.address)));
 const officialByName=new Map(addresses.map(address=>[normalizeAddress(address.name),address]));
 const items=[...manifest.filter(b=>b.address).map(b=>({name:b.address,alias:officialByName.get(normalizeAddress(b.address))?.alias,buildingId:b.buildingId,position:b.position,detail:`Modeled building · ${b.constructionYear??'year unknown'}`,range:450})),
 ...context.neighborhoods.map(n=>({name:n.name,position:n.position,detail:`Neighborhood · ${n.count} modeled buildings`,range:1900,place:true})),
 ...addresses.filter(a=>!modeledNames.has(normalizeAddress(a.name))).map(a=>({...a,detail:`Official address · ${a.postcode} · no matched 3D record`,range:600}))];
 const names=new Set(items.map(item=>normalizeAddress(item.name)));
 for(const label of context.labels.filter(l=>['street','district','place'].includes(l.type))){const key=normalizeAddress(label.name);if(names.has(key))continue;names.add(key);items.push({name:label.name,position:label.position,detail:'Official place name · reference map',range:1100,place:true});}
 return items.map(item=>({...item,key:normalizeAddress(item.name),aliasKey:item.alias?normalizeAddress(item.alias):''}));
}
export class AddressSearch {
 constructor({input,results,manifest,context,onSelect,onFocus}){
  let items,pending,timer,version=0;
  const hide=()=>{version++;clearTimeout(timer);results.hidden=true;input.setAttribute('aria-expanded','false');};
  const message=text=>{results.replaceChildren();const p=document.createElement('p');p.setAttribute('role','status');p.textContent=text;results.append(p);results.hidden=false;input.setAttribute('aria-expanded','true');};
  const load=()=>pending??=(async()=>{try{const response=await fetch('/search/addresses.json');if(!response.ok)throw Error('Address index unavailable');items=addressItems(await response.json(),manifest,context);return items;}catch(error){pending=null;throw error;}})();
  input.addEventListener('focus',()=>{onFocus();load().catch(()=>{});});
  input.addEventListener('input',()=>{
   clearTimeout(timer);results.replaceChildren();results.hidden=true;input.setAttribute('aria-expanded','false');
   const request=++version;if(input.value.trim().length<2){hide();return;}
   timer=setTimeout(async()=>{
    if(!items)message('Loading official Helsinki addresses…');
    try{await load();if(request!==version)return;
     const matches=searchPlaces(items,input.value);results.replaceChildren();
     if(!matches.length){message('No matching address. Try a street name and house number, in Finnish or Swedish.');return;}
     results.hidden=false;input.setAttribute('aria-expanded','true');
     for(const item of matches){const button=document.createElement('button'),name=document.createElement('strong'),detail=document.createElement('span');name.textContent=item.name;detail.textContent=item.detail;button.append(name,detail);button.onclick=()=>{input.value=item.name;hide();onSelect(item);};results.append(button);}
    }catch{if(request===version)message('Address search could not load. Edit your search to retry; you can still select buildings on the map.');}
   },180);
  });
  input.addEventListener('keydown',event=>{if(event.key==='Escape')hide();if(event.key==='ArrowDown'){event.preventDefault();results.querySelector('button')?.focus();}if(event.key==='Enter')results.querySelector('button')?.click();});
  results.addEventListener('keydown',event=>{const buttons=[...results.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(event.key==='Escape'){hide();input.focus();}});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.search-wrap'))hide();});
 }
}
