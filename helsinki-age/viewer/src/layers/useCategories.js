// Helsinki RA_KAYTTARK (1994 classification), official code list pp. 8–9:
// https://kartta.hel.fi/avoindata/dokumentit/Rakennusrekisteri_avoindata_metatiedot_20160601.pdf
// These are atlas groupings, not claims about ownership or public access.
export const useCategories = [
  {id:'residential',label:'Residential',color:'#E8B84A',codes:'011 012 013 021 022 032 039 041'},
  {id:'commercial',label:'Commerce & offices',color:'#1EC8D8',codes:'111 112 119 121 123 124 129 131 139 141 151'},
  {id:'civic',label:'Civic, education & care',color:'#7A6BFF',codes:'211 213 214 215 219 221 222 223 229 231 239 241 311 312 322 323 324 331 341 342 349 351 352 353 354 359 369 511 521 531 532 541 549 721 722 729'},
  {id:'industrial',label:'Industry & storage',color:'#E24B3C',codes:'611 613 691 692 699 711 712 719'},
  {id:'other',label:'Transport & other',color:'#6BBF3C',codes:'161 162 163 164 169 811 819 891 892 893 899 931 941 999'},
];
const byCode=new Map(useCategories.flatMap(category=>category.codes.split(' ').map(code=>[code,category.id])));
export function useCategory(code){return byCode.get(String(code??'').trim().padStart(3,'0'))??null;}
export const unknown={id:'unknown',label:'No data',color:'#7d8992'};
