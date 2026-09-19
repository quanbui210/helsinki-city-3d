import {Cesium3DTileStyle} from 'cesium';
import {unknown} from './useCategories.js';

export const energyColors=['#1B9E4B','#4CAF50','#9CCC65','#F5D000','#FB8C00','#E53935','#8E1414'];

export default {
  id:'energy',label:'Energy',title:'Energy certificates · archived',
  presentColors:false,legendLayout:'ramp',legendEnds:['More efficient','Less efficient'],
  description:'2013 certificate scheme · A = more efficient, G = less efficient within a building category. Historical Atlas records, not current ratings or measured consumption. Certificate dates are available on click.',
  legend:()=>[...energyColors.map((color,i)=>({color,label:'ABCDEFG'[i],tick:'ABCDEFG'[i]})),unknown],
  coverage:records=>records.filter(record=>record.energy!=null).length,
  properties:record=>({energyClass:record?.energy?.class??'unknown'}),
  buildStyle(){return new Cesium3DTileStyle({show:true,color:{conditions:[
    ...energyColors.map((color,i)=>[`${'${energyClass}'} === '${'ABCDEFG'[i]}'`,`color('${color}')`]),
    ['true',`color('${unknown.color}')`],
  ]}});},
};
