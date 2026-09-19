import {Cesium3DTileStyle} from 'cesium';

export default {
  id: 'age', label: 'Age', title: 'Construction years',
  description: 'Recorded completion years · unknown years stay visible.',
  legend: ({day}) => [
    {label:'Before 1900', color:day?'#e7d8bd':'#ebcca3'},
    {label:'1900–1939', color:day?'#d2b895':'#dabb91'},
    {label:'1940 onward', color:day?'#bc9879':'#bc9477'},
    {label:'Year unknown', color:day?'#829d9e':'#68848c'},
  ],
  buildStyle(state) {
    const colors=this.legend(state);
    return new Cesium3DTileStyle({
      show:`${'${constructionYear}'} === undefined || ${'${constructionYear}'} === null || ${'${constructionYear}'} <= ${state.year}`,
      color:{conditions:[
        ['${constructionYear} === null || ${constructionYear} === undefined',`color('${colors[3].color}')`],
        ['${constructionYear} < 1900',`color('${colors[0].color}')`],
        ['${constructionYear} < 1940',`color('${colors[1].color}')`],
        ['true',`color('${colors[2].color}')`],
      ]},
    });
  },
};
