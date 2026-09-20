import {foundationUrl,invokeFoundation} from '../../server/invoke-foundation.js';

export const config={maxDuration:10};

export default function handler(req,res){
  return invokeFoundation(req,res,foundationUrl(req,'/api/foundation/aerial'));
}
