// Same shopper-priority order as the main tab strip: price and noise first.
const lenses=[
  {id:'price',name:'Price',blurb:'Postal-area sale & rent'},
  {id:'noise',name:'Noise',blurb:'2022 modeled street noise'},
  {id:'age',name:'Age',blurb:'Official completion year'},
  {id:'energy',name:'Energy',blurb:'Archived 2013 certificate'},
  {id:'use',name:'Use',blurb:'Register purpose'},
  {id:'parking',name:'Parking',blurb:'Public street parking nearby'},
];

export default {
  id:'overview',label:'Overview',title:'The city, as modeled',
  description:'',
  legend:()=>[],
  buildStyle:()=>undefined,
  ui(container,_state,_update,openLayer){
    const guide=document.createElement('div');guide.className='lens-guide';
    for(const item of lenses){
      const button=document.createElement('button');button.type='button';button.dataset.goto=item.id;
      const name=document.createElement('strong');name.textContent=item.name;
      const blurb=document.createElement('span');blurb.textContent=item.blurb;
      button.append(name,blurb);button.onclick=()=>openLayer(item.id);guide.append(button);
    }
    container.append(guide);
  },
};
