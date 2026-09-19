import {readdir, readFile} from 'node:fs/promises';
import {RAW} from './config.js';
import {buildingBlocks, envelopeCenter, insideBbox} from './lib.js';

const increment = [25483000, 6671600, 25490000, 6675200];
const dir = `${RAW}expansion-pages/espoo_east`;
const files = await readdir(dir);
const samples = [];
let bounded = 0, unbounded = 0, inside = 0;
const xs = [], ys = [];
for (const file of files.slice(0, 80)) {
  const xml = await readFile(`${dir}/${file}`, 'utf8');
  for (const block of buildingBlocks(xml)) {
    const center = envelopeCenter(block);
    if (!center) {
      unbounded++;
      if (samples.length < 3) samples.push({file, id: block.match(/gml:id="([^"]+)"/)?.[1], env: block.match(/boundedBy[\s\S]{0,400}/)?.[0]});
      continue;
    }
    bounded++;
    xs.push(center[0]); ys.push(center[1]);
    if (insideBbox(center, increment)) inside++;
    if (samples.length < 8) samples.push({file, id: block.match(/gml:id="([^"]+)"/)?.[1], center, lo: block.match(/<gml:lowerCorner>(.*?)<\/gml:lowerCorner>/)?.[1]});
  }
}
console.log({files: files.length, bounded, unbounded, inside, x: xs.length ? [Math.min(...xs), Math.max(...xs)] : null, y: ys.length ? [Math.min(...ys), Math.max(...ys)] : null});
console.log(JSON.stringify(samples, null, 2));
