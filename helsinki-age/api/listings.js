import {createListingSearch} from '../server/listing-search.js';

const service=createListingSearch({
  apiKey:process.env.BRAVE_SEARCH_API_KEY,
  storageAllowed:process.env.BRAVE_STORAGE_ALLOWED==='true',
  dailyLimit:Number(process.env.LISTING_DAILY_LIMIT)||100,
});

async function readJson(req){
  if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body))return req.body;
  if(typeof req.body==='string')return JSON.parse(req.body);
  const chunks=[];
  for await(const chunk of req){
    chunks.push(chunk);
    if(Buffer.concat(chunks).byteLength>2048){
      const error=new Error('request_too_large');error.status=413;throw error;
    }
  }
  return JSON.parse(Buffer.concat(chunks).toString()||'{}');
}

export default async function handler(req,res){
  const send=(status,body)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(status===429)res.setHeader('Retry-After','60');
    res.status(status).json(body);
  };
  try{
    if(req.method!=='POST'){send(405,{error:'method_not_allowed'});return;}
    if(req.headers.origin){
      try{if(new URL(req.headers.origin).host!==req.headers.host){send(403,{error:'origin_rejected'});return;}}
      catch{send(403,{error:'origin_rejected'});return;}
    }
    if(req.headers['content-type']&&!req.headers['content-type'].startsWith('application/json')){send(415,{error:'json_required'});return;}
    const input=await readJson(req);
    const result=await service.search(input,req.socket?.remoteAddress??'local');
    send(result.status,result.body);
  }catch(error){
    send(error.status??(error instanceof SyntaxError?400:502),{error:error.status===413?'request_too_large':error instanceof SyntaxError?'invalid_json':'search_unavailable'});
  }
}
