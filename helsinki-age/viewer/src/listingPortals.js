export const listingPortals=[
  {id:'oikotie',name:'Oikotie',domain:'oikotie.fi',search:'https://asunnot.oikotie.fi/'},
  {id:'etuovi',name:'Etuovi',domain:'etuovi.com',search:'https://www.etuovi.com/myytavat-asunnot'},
  {id:'sato',name:'SATO',domain:'sato.fi',search:'https://www.sato.fi/fi/vuokra-asunnot'},
  {id:'lumo',name:'Lumo',domain:'lumo.fi',search:'https://lumo.fi/vuokra-asunnot/'},
  {id:'vuokraovi',name:'Vuokraovi',domain:'vuokraovi.com',search:'https://www.vuokraovi.com/vuokra-asunnot'},
];
export function safeListingUrl(value,domain){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname===domain||u.hostname.endsWith('.'+domain))?u.href:null;}catch{return null;}
}
export function listingAddress(input){
  if(typeof input?.address!=='string'||!['Helsinki','Espoo'].includes(input.city))return null;
  const address=input.address.normalize('NFC').replace(/\s+/gu,' ').trim();
  if(address.length<3||address.length>140||!/[\p{L}]/u.test(address)||!/[0-9]/.test(address)||!/^[\p{L}\p{N} .,'’/()\-–]+$/u.test(address))return null;
  const postalCode=/^\d{5}$/.test(input.postalCode)?input.postalCode:'';
  const label=`${address}, ${postalCode?postalCode+' ':''}${input.city}`;
  return {address,city:input.city,postalCode,label,key:label.toLocaleLowerCase('fi')};
}
export const listingQuery=(address,portal)=>`"${address.label}" site:${portal.domain}`;
