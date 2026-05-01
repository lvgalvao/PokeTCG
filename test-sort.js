const BUCKETS = [
  '01_comum',
  '02_incomum',
  '03_raras',
  '04_duplo_raras',
  '05_arte_secreta',
  '06_duplo_arte_secreta',
  '07_legendaria',
];

function bucketRank(b) {
  return BUCKETS.indexOf(b) + 1;
}

const drawn = [
  { effectiveBucket: '04_duplo_raras' },
  { effectiveBucket: '06_duplo_arte_secreta' },
  { effectiveBucket: '03_raras' },
];

drawn.sort((a, b) => bucketRank(a.effectiveBucket) - bucketRank(b.effectiveBucket));

console.log(drawn.map(d => d.effectiveBucket));
