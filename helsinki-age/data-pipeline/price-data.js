// JSON-stat indexes may be objects or arrays. Never infer dimension order.
export function cell(dataset, coordinates) {
  let index=0;
  for(const [i,id] of dataset.id.entries()) {
    const categories=dataset.dimension[id].category.index;
    const offset=Array.isArray(categories)?categories.indexOf(coordinates[id]):categories[coordinates[id]];
    if(!Number.isInteger(offset)||offset<0)return null;
    index=index*dataset.size[i]+offset;
  }
  const value=dataset.value[index];
  return typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
}
export function changeQoQ(current,previous,quarter,previousQuarter) {
  const serial=q=>/^\d{4}Q[1-4]$/.test(q)?Number(q.slice(0,4))*4+Number(q.at(-1)):NaN;
  return current>0&&previous>0&&serial(quarter)-serial(previousQuarter)===1
    ?Math.round((current/previous-1)*1000)/10:null;
}
