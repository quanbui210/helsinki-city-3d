// Minimal persistence for the building-panel shortlist toggle. No compare/list
// UI ships here — that is a separate, already-scoped feature.
const PREFIX='helsinki-lens:shortlist:v1:';
export function isShortlisted(key){
  try{return localStorage.getItem(PREFIX+key)==='1';}catch{return false;}
}
export function setShortlisted(key,value){
  try{if(value)localStorage.setItem(PREFIX+key,'1');else localStorage.removeItem(PREFIX+key);}catch{} // Private browsing must not break the toggle.
}
