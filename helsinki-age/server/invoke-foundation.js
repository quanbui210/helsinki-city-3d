import {foundationMiddleware} from './foundation.js';

const middleware=foundationMiddleware({apiKey:process.env.NLS_API_KEY});

export function foundationUrl(req,pathname){
  const raw=req.url??'/';
  const incoming=raw.includes('?')?raw.slice(raw.indexOf('?')+1):'';
  const params=new URLSearchParams(incoming);
  for(const key of ['z','x','y'])if(req.query?.[key]!=null&&!params.has(key))params.set(key,String(req.query[key]));
  const search=params.toString();
  return `${pathname}${search?`?${search}`:''}`;
}

export function invokeFoundation(req,res,url){
  return new Promise(resolve=>{
    const nodeRes={
      writeHead(status,headers={}){
        res.statusCode=status;
        for(const [key,value] of Object.entries(headers))res.setHeader(key,value);
      },
      end(body){
        if(body!=null)res.end(body);else res.end();
        resolve();
      }
    };
    middleware({...req,url,method:req.method},nodeRes,()=>{
      res.statusCode=404;
      res.setHeader('Content-Type','application/json');
      res.end('{}');
      resolve();
    });
  });
}
