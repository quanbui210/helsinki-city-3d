import {parkingLookup,parkingLabels} from './parkingData.js';
export class ParkingAreas {
  constructor(viewer,data){
    this.data=data;this.lookup=parkingLookup(data);this.sources=[];this.active=false;
    this.ready=Promise.resolve();
  }
  set(active){this.active=active;}
  buildingContext(container,position,onOpen){
    container.replaceChildren();const result=this.lookup(position);
    const add=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;container.append(el);return el;};
    add('h3','Street parking nearby');
    add('p','This shows public street parking in the surrounding area — not whether this specific building has its own parking. Check the listing or housing company for dedicated parking, garage access, or EV charging.','area-disclaimer');
    if(!result.parkingMappedSegments&&!result.residentZoneId&&!result.paidZoneId)add('p','No digitized data for this area. Coverage is limited; this does not mean there is no parking.');
    else{
      add('strong',result.nearbyParkingSpots?`≈ ${result.nearbyParkingSpots} mapped spaces within 200 m`:'No capacity estimate nearby');
      add('p','Straight-line radius · estimated street capacity, including restricted uses. Not currently vacant spaces.');
      const list=add('dl','','parking-breakdown');for(const [type,count] of Object.entries(result.parkingSpotBreakdown)){const term=document.createElement('dt'),value=document.createElement('dd');term.textContent=parkingLabels[type];value.textContent=count?`≈ ${count}`:'Unreported';list.append(term,value);}
      if(result.parkingUnknownCapacity)add('p',`${result.parkingUnknownCapacity} mapped segments have no capacity estimate.`);
      const resident=this.data.residentZones.find(z=>z.id===result.residentZoneId);
      add('p',`Resident permit zone: ${resident?`${resident.id} · ${resident.name}`:'No mapped match'}. Paid zone: ${result.paidZoneId??'No mapped match'}.`);
      add('p','Zone boundaries are approximate. Permit eligibility and permitted hours depend on local rules and street signs.');
    }
    const actions=add('div','','parking-actions');
    const button=document.createElement('button');button.type='button';button.className='parking-map-link';button.textContent='View parking on map →';button.onclick=onOpen;
    const link=document.createElement('a');link.className='parking-source-link';link.textContent='Sources & methodology ↗';link.href='/parking.json';link.target='_blank';link.rel='noopener';
    actions.append(button,link);
  }
}
