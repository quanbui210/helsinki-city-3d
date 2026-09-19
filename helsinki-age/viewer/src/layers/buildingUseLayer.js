import {Cesium3DTileStyle} from 'cesium';
import {useCategories,unknown,useCategory} from './useCategories.js';
export default {
  id:'use',label:'Use',title:'What the city is made of',presentColors:false,
  description:'Register purpose · five atlas groups from Helsinki’s RA_KAYTTARK codes. All modeled buildings shown.',
  legend:()=>[...useCategories,unknown],
  coverage:records=>records.filter(record=>record.useCategory!=null).length,
  properties:record=>({useCategory:record?.useCategory??useCategory(record?.useCode)??'unknown'}),
  buildStyle(){return new Cesium3DTileStyle({show:true,color:{conditions:[
    ...useCategories.map(c=>[`${'${useCategory}'} === '${c.id}'`,`color('${c.color}')`]),
    ['true',`color('${unknown.color}')`],
  ]}});},
};
