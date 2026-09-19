const PREFIX='helsinki-lens:listings:v1:',TTL=24*60*60*1000,MAX=300;
const memory=new Map(),inFlight=new Map();
const valid=entry=>entry&&Number.isFinite(entry.timestamp)&&Date.now()>=entry.timestamp&&Date.now()-entry.timestamp<TTL&&Array.isArray(entry.results?.portals)&&entry.results.portals.length===5&&entry.results.portals.every(p=>p&&p.status==='ok'&&Array.isArray(p.results)&&p.results.every(r=>r&&typeof r.title==='string'&&typeof r.snippet==='string'&&typeof r.url==='string'));
export function readFromStorage(key){
  try{const name=PREFIX+key,entry=JSON.parse(localStorage.getItem(name));if(valid(entry))return entry;localStorage.removeItem(name);}catch{}
  return null;
}
export function writeToStorage(key,value){
  try{
    const keys=Object.keys(localStorage).filter(k=>k.startsWith(PREFIX));
    if(keys.length>=MAX&&!keys.includes(PREFIX+key)){
      keys.sort((a,b)=>{try{return JSON.parse(localStorage.getItem(a)).timestamp-JSON.parse(localStorage.getItem(b)).timestamp;}catch{return 0;}});
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(PREFIX+key,JSON.stringify(value));
  }catch{} // Private browsing, malformed data and quota limits must not break search.
}
export function cachedListings(key){
  const entry=memory.get(key);
  if(valid(entry))return {...entry.results,cached:true};
  memory.delete(key);const stored=readFromStorage(key);
  if(stored){memory.set(key,stored);return {...stored.results,cached:true};}
  return null;
}
export function requestListings(address){
  const existing=inFlight.get(address.key);if(existing&&!existing.controller.signal.aborted)return existing;
  const controller=new AbortController(),entry={controller};
  entry.promise=(async()=>{
    const response=await fetch('/api/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:address.address,city:address.city,postalCode:address.postalCode}),signal:controller.signal});
    const data=await response.json();
    if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');
    if(response.ok&&Array.isArray(data.portals)&&data.portals.length===5&&data.portals.every(p=>p.status==='ok')){
      const timestamp=new Date(data.checkedAt).getTime();
      const value={timestamp,results:data};
      if(valid(value)){if(memory.size>=MAX)memory.delete(memory.keys().next().value);memory.set(address.key,value);writeToStorage(address.key,value);}
    }
    return {response,data};
  })().finally(()=>{if(inFlight.get(address.key)===entry)inFlight.delete(address.key);});
  inFlight.set(address.key,entry);return entry;
}
