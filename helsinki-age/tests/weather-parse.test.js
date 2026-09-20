import assert from 'node:assert/strict';
import {isFoggy,formatTemperature} from '../viewer/src/LiveWeather.js';
import test from 'node:test';

test('temperature HUD uses the specified minus and city label',()=>{
  assert.equal(formatTemperature(-4.2),'−4°C · Helsinki');
  assert.equal(formatTemperature(16.3),'16°C · Helsinki');
  assert.equal(formatTemperature(0),'0°C · Helsinki');
});

test('fog only from mist/fog present-weather or visibility under 1 km',()=>{
  assert.equal(isFoggy({wawa:45}),true);
  assert.equal(isFoggy({wawa:10}),true);
  assert.equal(isFoggy({visibility:800}),true);
  assert.equal(isFoggy({wawa:0,visibility:20000}),false);
  assert.equal(isFoggy({wawa:81,visibility:5000}),false);
});
