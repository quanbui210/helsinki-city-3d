import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {isFoggy} from '../viewer/src/LiveWeather.js';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__atlas?.weather,null,{timeout:90000});
  await page.waitForFunction(()=>!document.getElementById('weather-hud').hidden,null,{timeout:20000});
  const live=await page.evaluate(()=>({text:document.getElementById('weather-hud').textContent,temp:__atlas.weather.last.temperature,wawa:__atlas.weather.last.wawa,visibility:__atlas.weather.last.visibility,fog:__atlas.viewer.scene.fog.enabled}));
  assert.match(live.text,/^(−)?\d+°C · Helsinki$/);
  assert.ok(Number.isFinite(live.temp)&&live.temp>-40&&live.temp<40);
  assert.equal(live.fog,isFoggy(live));
  const foggy=await page.evaluate(()=>{__atlas.weather.apply({temperature:-4,wawa:45});return {text:document.getElementById('weather-hud').textContent,fog:__atlas.viewer.scene.fog.enabled,hidden:document.getElementById('weather-hud').hidden};});
  assert.equal(foggy.text,'−4°C · Helsinki');
  assert.equal(foggy.fog,true);
  assert.equal(foggy.hidden,false);
  const clear=await page.evaluate(()=>{__atlas.weather.apply({temperature:16,wawa:0,visibility:20000});return __atlas.viewer.scene.fog.enabled;});
  assert.equal(clear,false);
  const failed=await page.evaluate(async()=>{await __atlas.weather.refresh('https://example.invalid/weather');return {hidden:document.getElementById('weather-hud').hidden,text:document.getElementById('weather-hud').textContent,fog:__atlas.viewer.scene.fog.enabled};});
  assert.equal(failed.hidden,true);
  assert.equal(failed.text,'');
  assert.equal(failed.fog,false);
  await page.evaluate(()=>__atlas.weather.refresh());
  await page.waitForFunction(()=>!document.getElementById('weather-hud').hidden,null,{timeout:20000});
  assert.deepEqual(errors,[]);
  console.log(`PASS: live weather HUD ${live.text}, fog only on foggy apply, failure hides HUD.`);
}finally{await browser.close();}
