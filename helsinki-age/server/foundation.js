const CONTEXT='https://kartta.hel.fi/3d/datasource-data/28b3e52b-761b-4211-aff8-682c11648c3e/';
export function foundationMiddleware({apiKey=process.env.NLS_API_KEY,fetchImpl=fetch}={}){
  const cache=new Map(),pending=new Map();let cacheBytes=0;
  return async(req,res,next)=>{
    const path=req.url?.split('?')[0];if(!path?.startsWith('/api/foundation/'))return next?.();
    const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':status===200?'public, max-age=86400':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);};
    if(req.method!=='GET')return send(405,'{}');
    if(path==='/api/foundation/config')return send(200,JSON.stringify({aerial:Boolean(apiKey)}));
    let url,type;
    const tile=path.match(/^\/api\/foundation\/aerial\/(\d{1,2})\/(\d+)\/(\d+)\.jpg$/);
    const context=path.match(/^\/api\/foundation\/context\/(tileset\.json|\d+\/\d+\/\d+\.b3dm)$/);
    if(tile){
      const [z,x,y]=tile.slice(1).map(Number);if(!apiKey)return send(503,'{}');
      if(z>18||x>=2**z||y>=2**z)return send(400,'{}');
      // Limit this key-backed service to tiles intersecting metropolitan Helsinki.
      const lon=(x+.5)/2**z*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+.5)/2**z)))*180/Math.PI;
      const margin=360/2**z;if(lon<24.4-margin||lon>25.5+margin||lat<59.9-margin||lat>60.5+margin)return send(404,'{}');
      url=new URL(`https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/ortokuva/default/WGS84_Pseudo-Mercator/${z}/${y}/${x}.jpg`);url.searchParams.set('api-key',apiKey);type='image/jpeg';
    }else if(context){url=new URL(context[1],CONTEXT);type=context[1].endsWith('.json')?'application/json':'application/octet-stream';}
    else return send(404,'{}');
    try{
      let bytes=cache.get(path);if(!bytes){let task=pending.get(path);if(!task){task=(async()=>{const response=await fetchImpl(url,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!response.ok)throw Error('Upstream unavailable');const result=Buffer.from(await response.arrayBuffer());if(result.length>16*1024*1024)throw Error('Oversized tile');while(cache.size&&(cache.size>=256||cacheBytes+result.length>64*1024*1024)){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).length;cache.delete(oldest);}cache.set(path,result);cacheBytes+=result.length;return result;})().finally(()=>pending.delete(path));pending.set(path,task);}bytes=await task;}
      send(200,bytes,type);
    }catch{send(502,'{}');} // Never return credential-bearing upstream URLs.
  };
}
