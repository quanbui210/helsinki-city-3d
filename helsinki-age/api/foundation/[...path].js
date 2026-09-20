import {foundationMiddleware} from '../../server/foundation.js';

const middleware=foundationMiddleware({apiKey:process.env.NLS_API_KEY});

function pathOf(req){
  const raw=(req.url??'').split('?')[0];
  if(raw.startsWith('/api/foundation'))return raw;
  const parts=req.query?.path;
  const suffix=Array.isArray(parts)?parts.join('/'):parts??'';
  return `/api/foundation/${suffix}`;
}

export default function handler(req,res){
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
    middleware({...req,url:pathOf(req),method:req.method},nodeRes,()=>{
      res.statusCode=404;res.setHeader('Content-Type','application/json');res.end('{}');resolve();
    });
  });
}
