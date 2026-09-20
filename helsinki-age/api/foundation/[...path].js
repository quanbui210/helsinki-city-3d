import {foundationUrl,invokeFoundation} from '../../server/invoke-foundation.js';

function pathnameOf(req){
  const raw=(req.url??'/').split('?')[0];
  try{if(raw.startsWith('http'))return new URL(raw).pathname;}catch{}
  return raw;
}

function pathOf(req){
  const pathname=pathnameOf(req);
  if(pathname.startsWith('/api/foundation'))return foundationUrl(req,pathname);
  const parts=req.query?.path;
  const suffix=Array.isArray(parts)?parts.join('/'):parts??'';
  return foundationUrl(req,`/api/foundation/${suffix}`);
}

export default function handler(req,res){
  return invokeFoundation(req,res,pathOf(req));
}
