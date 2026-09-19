// One visual treatment for every data lens. Source values and bins are untouched.
// Reduce HSV saturation by 18% and value by 8%; Cesium blends this tint with
// the opaque stone material at 40%, retaining correct depth and shadows.
export function restrainedColor(hex){
  const rgb=hex.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16)/255);
  const max=Math.max(...rgb);
  return '#'+rgb.map(v=>Math.round((max+(v-max)*.82)*.92*255).toString(16).padStart(2,'0')).join('');
}
export function presentLayer(layer){
  if(layer.id==='overview'||layer.presentColors===false)return layer;
  return {...layer,
    legend(state){return layer.legend(state).map(item=>({...item,color:restrainedColor(item.color)}));},
    buildStyle(state){
      const style=layer.buildStyle(state);
      const conditions=style.style.color.conditions.map(([condition,color])=>[condition,color.replace(/#[\da-f]{6}/gi,restrainedColor)]);
      style.color={conditions};return style;
    },
  };
}
