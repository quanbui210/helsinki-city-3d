import {listingAddress,listingPortals,listingQuery,safeListingUrl} from '../viewer/src/listingPortals.js';

// Non-goals: no portal page/API fetching, price/availability extraction, images,
// unit matching, or access-control workarounds. Only Brave's search snippets.
const DAY=24*60*60*1000;
export function createListingSearch({apiKey=process.env.BRAVE_SEARCH_API_KEY,storageAllowed=process.env.BRAVE_STORAGE_ALLOWED==='true',fetchImpl=fetch,now=Date.now,spacing=1100,dailyLimit=Number(process.env.LISTING_DAILY_LIMIT)||100}={}){
  const cache=new Map(),inflight=new Map(),clients=new Map();let dayStart=now(),daily=0,pending=0,tail=Promise.resolve(),lastRequest=-Infinity;
  const failure=(status,code)=>({status,body:{error:code}});
  async function search(input,client){
    const address=listingAddress(input);if(!address)return failure(400,'invalid_address');
    if(!apiKey)return failure(503,'not_configured');
    const time=now();
    for(const [key,item] of cache)if(time-item.checkedAt>=DAY)cache.delete(key);
    const cached=cache.get(address.key);if(cached)return {status:200,body:{...cached,cached:true}};
    if(inflight.has(address.key))return inflight.get(address.key);
    for(const [key,entry] of clients)if(time-entry.start>=60000)clients.delete(key);
    const usage=clients.get(client)??{start:time,count:0};
    if(time-dayStart>=DAY){dayStart=time;daily=0;}
    if(usage.count>=6||daily>=dailyLimit||pending>=3)return failure(429,'rate_limited');
    usage.count++;clients.set(client,usage);daily++;pending++;
    // One provider request at a time, including across simultaneous addresses.
    const task=tail.then(async()=>{
      const portals=[];let stop=false;
      for(const portal of listingPortals){
        if(stop){portals.push({portal:portal.id,status:'unavailable',results:[]});continue;}
        try{
          const wait=spacing-(now()-lastRequest);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
          const url=new URL('https://api.search.brave.com/res/v1/web/search');
          url.search=new URLSearchParams({q:listingQuery(address,portal),count:'3',country:'FI',search_lang:'fi',text_decorations:'false',spellcheck:'false'});
          lastRequest=now();
          const response=await fetchImpl(url,{headers:{Accept:'application/json','X-Subscription-Token':apiKey},signal:AbortSignal.timeout(8000),redirect:'error'});
          if(!response.ok){stop=[401,403,429].includes(response.status);throw Error('Search unavailable');}
          const data=await response.json();
          if(!data||(data.type!=='search'&&!data.web)||data.type==='ErrorResponse'||(data.web?.results!==undefined&&!Array.isArray(data.web.results)))throw Error('Invalid search response');
          const seen=new Set(),results=[];
          for(const result of (data.web?.results??[]).slice(0,3)){
            const link=safeListingUrl(result.url,portal.domain);
            if(!link||seen.has(link)||typeof result.title!=='string'||typeof result.description!=='string'||!result.description.trim())continue;
            seen.add(link);results.push({title:result.title,snippet:result.description,url:link,portal:portal.id});
          }
          portals.push({portal:portal.id,status:'ok',results});
        }catch{portals.push({portal:portal.id,status:'unavailable',results:[]});}
      }
      const body={checkedAt:now(),portals,cached:false};
      // Retain only the displayed fields, never rich results, page content or images.
      // Only complete responses are cached; an outage must not become "no matches".
      if(storageAllowed&&portals.every(p=>p.status==='ok')){
        if(cache.size>=500)cache.delete(cache.keys().next().value);
        cache.set(address.key,body);
      }
      return {status:200,body};
    }).finally(()=>{pending--;inflight.delete(address.key);});
    inflight.set(address.key,task);tail=task.catch(()=>{});return task;
  }
  return {search};
}

export function listingMiddleware(service=createListingSearch()){
  return async(req,res,next)=>{
    if(req.url?.split('?')[0]!=='/api/listings'){next?.();return;}
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(status===429?{'Retry-After':'60'}:{})});res.end(JSON.stringify(body));};
    if(req.method!=='POST'){send(405,{error:'method_not_allowed'});return;}
    // No cross-origin proxy and no user-supplied upstream URLs. Proxy deployments
    // must preserve Host; do not trust arbitrary X-Forwarded-For for cost caps.
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){send(403,{error:'origin_rejected'});return;}}catch{send(403,{error:'origin_rejected'});return;}}
    if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'json_required'});return;}
    let raw='';
    try{
      for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2048){send(413,{error:'request_too_large'});return;}}
      let input;try{input=JSON.parse(raw);}catch{send(400,{error:'invalid_json'});return;}
      const result=await service.search(input,req.socket.remoteAddress??'local');send(result.status,result.body);
    }catch{if(!res.headersSent)send(502,{error:'search_unavailable'});}
  };
}
