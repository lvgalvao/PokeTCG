import { generateBooster } from './src/core/booster.js';
import { loadCatalog } from './src/domain/catalog.js';
import { mulberry32 } from './src/core/rng.js';

async function main() {
  const catalog = await loadCatalog('./assets/sv8pt5/manifest.json');
  for (let i = 0; i < 100; i++) {
    const booster = generateBooster(mulberry32(i), catalog, i);
    const buckets = booster.slots.map(s => s.effectiveBucket);
    // check if it's sorted
    for (let j = 0; j < buckets.length - 1; j++) {
      if (buckets[j] > buckets[j+1]) { // wait string comparison!
         // Wait, string comparison of '04_...' and '06_...'
         // '04_duplo_raras' < '06_duplo_arte_secreta' is true.
      }
    }
    console.log(buckets.map(b => b.substring(0, 2)).join(', '));
  }
}
main();
