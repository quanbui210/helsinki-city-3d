import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {listingMiddleware} from './listing-search.js';
try{process.loadEnvFile(fileURLToPath(new URL('../.env.local',import.meta.url)));}catch(error){if(error.code!=='ENOENT')throw error;}
const root=fileURLToPath(new URL('../viewer/dist/',import.meta.url)),api=listingMiddleware();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.b3dm':'application/octet-stream'};
await stat(path.join(root,'index.html'));
createServer((req,res)=>api(req,res,async()=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root)||pathname.includes('\\')){res.writeHead(403);res.end();return;}
    const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]??'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end('Not found');}
})).listen(Number(process.env.PORT)||3000,()=>console.log('Helsinki Lens listening on port '+(process.env.PORT||3000)));
