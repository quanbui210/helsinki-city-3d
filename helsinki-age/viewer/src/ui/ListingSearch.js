import {cachedListings,requestListings} from '../listingCache.js';
import {listingAddress,listingPortals,safeListingUrl} from '../listingPortals.js';

const text=(tag,value)=>Object.assign(document.createElement(tag),{textContent:value});
const link=(label,url)=>Object.assign(text('a',label),{href:url,target:'_blank',rel:'noopener noreferrer'});
export class ListingSearch {
  constructor(container,onStatus=()=>{}){this.container=container;this.onStatus=onStatus;this.version=0;this.key=null;this.started=[];}
  close(){this.version++;this.key=null;this.address=null;this.busy=false;this.controller?.abort();}
  show(input){
    const address=listingAddress(input);
    if(address?.key===this.key)return;
    this.close();this.key=address?.key??null;this.address=address;const version=this.version;
    const root=this.container;root.replaceChildren(text('h3','Interested?'));
    if(!address){this.onStatus('unavailable');root.append(text('p','Need an address to look up listings.'));return;}
    this.action=document.createElement('div');this.action.className='listing-search-action';
    const go=document.createElement('button');go.type='button';go.className='listing-search-go';go.textContent='View current listings';go.onclick=()=>this.search();
    this.action.append(text('p',`Ads for ${address.address} on Oikotie, Etuovi and other listing sites.`),go);
    this.status=text('p','');this.status.className='listing-status';this.status.setAttribute('role','status');this.status.hidden=true;
    this.results=document.createElement('div');this.results.className='listing-results';
    const manual=document.createElement('details');manual.hidden=true;
    manual.append(text('summary','Search the sites yourself'));
    const copy=text('button','Copy address');copy.type='button';copy.className='listing-copy';copy.onclick=async()=>{try{await navigator.clipboard.writeText(address.label);copy.textContent='Copied';}catch{copy.textContent=address.label;}};
    const links=document.createElement('div');links.className='listing-manual-links';
    for(const portal of listingPortals)links.append(link(`${portal.name} ↗`,portal.search));
    manual.append(copy,links);this.manual=manual;root.append(this.action,this.status,this.results,manual);
    const cached=cachedListings(address.key);if(cached){this.paint(cached,version);return;}
    this.onStatus('idle');
  }
  search(){
    if(!this.address||this.busy)return;
    const version=this.version,cached=cachedListings(this.address.key);
    if(cached){this.paint(cached,version);return;}
    this.started=this.started.filter(t=>Date.now()-t<60000);
    if(this.started.length>=6){this.fail('Try again in a minute.');return;}
    this.started.push(Date.now());this.busy=true;this.action.hidden=true;this.status.hidden=false;this.status.textContent='Looking up listings…';this.onStatus('loading');
    const request=requestListings(this.address);this.controller=request.controller;
    request.promise.then(({response,data})=>{
      if(version!==this.version)return;this.busy=false;
      if(!response.ok){this.fail(response.status===429?'Try again in a minute.':'Could not check listings.');return;}
      if(!Array.isArray(data.portals))throw Error('Invalid response');
      this.paint(data,version);
    }).catch(error=>{if(version!==this.version||error.name==='AbortError')return;this.busy=false;this.fail('Could not check listings.');});
  }
  fail(message){this.busy=false;this.action.hidden=true;this.status.hidden=false;this.status.textContent=message;this.manual.hidden=false;this.manual.open=true;this.onStatus('unavailable');}
  paint(data,version){
    if(version!==this.version)return;
    this.action.hidden=true;this.status.hidden=false;this.results.replaceChildren();
    let found=0,unavailable=0;
    for(const portal of listingPortals){
      const group=data.portals.find(p=>p.portal===portal.id);if(!group||group.status!=='ok'){unavailable++;continue;}
      const section=document.createElement('section');section.append(text('h4',portal.name));let count=0;
      for(const item of group.results??[]){
        const url=safeListingUrl(item.url,portal.domain);if(!url||typeof item.title!=='string'||typeof item.snippet!=='string')continue;
        const article=document.createElement('article');article.append(text('strong',item.title));
        const snippet=text('p',item.snippet);snippet.className='listing-snippet';article.append(snippet,link('View listing →',url));section.append(article);found++;count++;
      }
      if(count)this.results.append(section);
    }
    this.status.textContent=found?`${found} listing${found===1?'':'s'} found`:unavailable?'Could not check listings.':'None found';
    this.onStatus(found?'found':unavailable?'unavailable':'empty',found);if(!found){this.manual.hidden=false;this.manual.open=true;}
  }
}
