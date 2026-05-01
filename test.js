import { readFileSync } from 'fs';
import { generateBooster } from './src/core/booster.js';
import { buildCatalog } from './src/domain/catalog.js';

// a simple RNG
function mulberry32(a) {
  return {
    next() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  };
}

const manifest = JSON.parse(readFileSync('./assets/sv8pt5/manifest.json', 'utf8'));
const catalog = buildCatalog(manifest);

for (let i = 0; i < 100; i++) {
  const booster = generateBooster(mulberry32(i), catalog, i);
  const buckets = booster.slots.map(s => s.effectiveBucket);
  for (let j = 0; j < buckets.length - 1; j++) {
    if (buckets[j] > buckets[j+1]) {
      console.log(`Out of order at seed ${i}:`, buckets);
      process.exit(1);
    }
  }
}
console.log("All sorted!");
