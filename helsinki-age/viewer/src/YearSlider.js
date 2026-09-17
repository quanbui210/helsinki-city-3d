export const visibleAt = (building,year) => building.constructionYear === null || building.constructionYear <= year;
export function initialYear(search,min,max) {
  const raw = new URLSearchParams(search).get('year');
  return raw!==null && /^\d{4}$/.test(raw) ? Math.max(min,Math.min(max,Number(raw))) : min;
}
export class YearSlider {
  constructor({input,play,speed,min,max,onChange,onPlay}) {
    Object.assign(this,{input,play,speed,min,max,onChange,onPlay});
    this.year=min;this.playing=false;this.fraction=0;this.previous=0;
    input.min=min;input.max=max;
    input.addEventListener('input',()=>{this.pause();this.set(Number(input.value));});
    play.addEventListener('click',()=>this.playing?this.pause():this.start());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
    this.tick=this.tick.bind(this);
  }
  set(year) {this.year=Math.max(this.min,Math.min(this.max,Math.round(year)));this.input.value=this.year;this.onChange(this.year);}
  start() {if(this.year>=this.max)this.set(this.min);this.playing=true;this.previous=0;this.fraction=0;this.update();this.frame=requestAnimationFrame(this.tick);}
  pause(){this.playing=false;cancelAnimationFrame(this.frame);this.update();}
  update(){this.play.setAttribute('aria-label',this.playing?'Pause timeline':'Play timeline');this.play.setAttribute('aria-pressed',String(this.playing));this.play.innerHTML=this.playing?'Ⅱ':'▶';this.onPlay?.(this.playing);}
  tick(time){if(!this.playing)return;if(this.previous){this.fraction+=Math.min((time-this.previous)/1000,.2)*Number(this.speed.value);const step=Math.floor(this.fraction);if(step){this.fraction-=step;this.set(this.year+step);if(this.year>=this.max){this.pause();return;}}}this.previous=time;this.frame=requestAnimationFrame(this.tick);}
}
