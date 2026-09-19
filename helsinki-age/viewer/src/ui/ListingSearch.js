import {cachedListings,requestListings} from '../listingCache.js';
import {listingAddress,listingPortals,safeListingUrl} from '../listingPortals.js';

const text=(tag,value)=>Object.assign(document.createElement(tag),{textContent:value});
const link=(label,url)=>Object.assign(text('a',label),{href:url,target:'_blank',rel:'noopener noreferrer'});
export class ListingSearch {
  constructor(container,onStatus=()=>{}){this.container=container;this.onStatus=onStatus;this.version=0;this.key=null;this.started=[];}
  close(){clearTimeout(this.timer);this.version++;this.key=null;this.controller?.abort();}
  show(input){
    const address=listingAddress(input);
    // A lens change for the same open card retains its displayed search snapshot.
    if(address?.key===this.key)return;
    this.close();this.key=address?.key??null;const version=this.version;
    this.onStatus('loading');const root=this.container;root.replaceChildren(text('h3','Currently listed?'));
    root.append(text('p','Search matches only. Availability and the exact apartment must be checked on the portal.'));
    if(!address){this.onStatus('unavailable');root.append(text('p','A street address and city are needed to search.'));return;}
    const status=text('p','Checking indexed search results…');status.className='listing-status';status.setAttribute('role','status');
    const results=document.createElement('div');results.className='listing-results';root.append(status,results);
    const manual=document.createElement('details'),summary=text('summary','Search the portals manually');manual.append(summary);
    manual.append(text('p','Copy the address, then paste it into a portal’s search.'));
    const copy=text('button',`Copy ${address.label}`);copy.type='button';copy.className='listing-copy';copy.onclick=async()=>{try{await navigator.clipboard.writeText(address.label);copy.textContent='Address copied';}catch{copy.textContent=address.label;}};
    manual.append(copy);
    const links=document.createElement('div');links.className='listing-manual-links';
    // These portals do not expose a verified stable street-address prefill URL.
    // Never invent query parameters or scrape their search forms/backends.
    for(const portal of listingPortals)links.append(link(`${portal.name} ↗`,portal.search));manual.append(links);root.append(manual);
    const render=data=>{
        let found=0,unavailable=0;
        for(const portal of listingPortals){
          const group=data.portals.find(p=>p.portal===portal.id);if(!group||group.status!=='ok'){unavailable++;continue;}
          const section=document.createElement('section');section.append(text('h4',portal.name));let count=0;
          for(const item of group.results??[]){
            const url=safeListingUrl(item.url,portal.domain);if(!url||typeof item.title!=='string'||typeof item.snippet!=='string')continue;
            const article=document.createElement('article');article.append(text('strong',item.title));
            const snippet=text('p',item.snippet);snippet.className='listing-snippet';article.append(snippet,link('View listing →',url));section.append(article);found++;count++;
          }
          if(count)results.append(section);
        }
        status.textContent=found?`${found} search ${found===1?'match':'matches'}${unavailable?` · ${unavailable} portals unavailable`:''}.`:unavailable?'Search was incomplete; no matches returned from available portals.':'No indexed matches found. This does not mean the address is unlisted.';
        this.onStatus(found?'found':unavailable?'unavailable':'empty',found);if(!found||unavailable)manual.open=true;
        const checked=new Date(data.checkedAt);if(Number.isFinite(checked.getTime()))root.append(text('small',`${data.cached?'Cached search':'Search checked'} ${checked.toLocaleString()} · Results from Brave Search`));
    };
    // Cache hits render synchronously, before any timer or rate-limit accounting.
    const cached=cachedListings(address.key);if(cached){render(cached);return;}
    this.timer=setTimeout(async()=>{
      this.started=this.started.filter(t=>Date.now()-t<60000);
      if(this.started.length>=6){status.textContent='Search limit reached. Try again shortly or use the portal links.';manual.open=true;this.onStatus('unavailable');return;}
      this.started.push(Date.now());
      try{
        const request=requestListings(address);this.controller=request.controller;
        const {response,data}=await request.promise;if(version!==this.version)return;
        if(!response.ok){status.textContent=response.status===429?'Search limit reached. Try again shortly or use the portal links.':data.error==='not_configured'?'Listing search is not connected yet. Search the portals manually below.':'Search is temporarily unavailable. Search the portals manually below.';manual.open=true;this.onStatus('unavailable');return;}
        if(!Array.isArray(data.portals))throw Error('Invalid response');
        render(data);
      }catch(error){if(version!==this.version||error.name==='AbortError')return;status.textContent='Search is temporarily unavailable. Search the portals manually below.';manual.open=true;this.onStatus('unavailable');}
    },500);
  }
}
