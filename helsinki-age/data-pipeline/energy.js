export function readBatchTable(buffer){
  if(buffer.length<28||buffer.toString('ascii',0,4)!=='b3dm'||buffer.readUInt32LE(4)!==1||buffer.readUInt32LE(8)!==buffer.length)throw Error('Invalid B3DM');
  const offset=28+buffer.readUInt32LE(12)+buffer.readUInt32LE(16),length=buffer.readUInt32LE(20);
  if(!length||offset+length>buffer.length)throw Error('Invalid batch table bounds');
  const table=JSON.parse(buffer.toString('utf8',offset,offset+length).trim());
  if(!Array.isArray(table.id)||!Array.isArray(table.attributes)||table.id.length!==table.attributes.length)throw Error('Unexpected Atlas attribute schema');
  return table;
}
export function certificate(attributes){
  const grade=attributes?.energiatod_luokka;
  if(typeof grade!=='string'||! /^[A-G]$/.test(grade.trim()))return null;
  const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null;
  return {class:grade.trim(),scheme:'2013',issued:date(attributes.energiatod_laatimispaiva),expires:date(attributes.energiatod_viimeinen_voimassaolopaiva)};
}
export function energyIndex(tables){
  const index=new Map();
  for(const table of tables)for(let i=0;i<table.id.length;i++){
    const value=certificate(table.attributes[i]);if(!value)continue;
    const id=table.id[i];
    if(!index.has(id))index.set(id,value);
    else if(JSON.stringify(index.get(id))!==JSON.stringify(value))index.set(id,null);
  }
  return index;
}
