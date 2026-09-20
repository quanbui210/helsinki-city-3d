import {invokeFoundation} from '../../server/invoke-foundation.js';

export default function handler(req,res){
  return invokeFoundation(req,res,'/api/foundation/config');
}
