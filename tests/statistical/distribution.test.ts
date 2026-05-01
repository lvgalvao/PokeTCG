import { describe, expect, it } from 'vitest';
import { BUCKETS, type Bucket } from '../../src/core/buckets.js';
import { generateBooster } from '../../src/core/booster.js';
import { SLOT_DISTRIBUTIONS, type SlotIndex } from '../../src/core/distributions.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Manifest, type ManifestCard } from '../../src/domain/catalog.js';

/**
 * Princípio III (NON-NEGOTIABLE) — testes estatísticos para a distribuição
 * de boosters. 10.000 boosters com seed fixa, dois critérios em conjunto:
 *   1. Frequência observada por bucket dentro de ±1 p.p. da probabilidade
 *      declarada (alargado para 07_legendaria, cuja variância binomial é alta
 *      em N=10.000 com p=0,005).
 *   2. Chi-quadrado de aderência aceito a α = 0,01 (df = k - 1).
 */

const FIXED_SEED = 0xc0ffee; // 12648430

const N = 10000;

const PER_BUCKET: Record<Bucket, number> = {
  '01_comum': 60,
  '02_incomum': 25,
  '03_raras': 15,
  '04_duplo_raras': 12,
  '05_arte_secreta': 10,
  '06_duplo_arte_secreta': 8,
  '07_legendaria': 4,
};

function makeManifest(): Manifest {
  const cards: ManifestCard[] = [];
  let n = 1;
  for (const bucket of BUCKETS) {
    for (let i = 0; i < PER_BUCKET[bucket]; i++) {
      cards.push({
        id: `${bucket}-${n}`,
        name: `Card ${n}`,
        rarityRaw: 'Test',
        bucket,
        collectionNumber: n,
        imagePath: `assets/${bucket}/${bucket}-${n}.jpg`,
      });
      n++;
    }
  }
  return {
    setId: 'test',
    setName: 'Test',
    generatedAt: '2026-05-01T00:00:00Z',
    downloaderVersion: '0.0.0',
    totalSet: cards.length,
    cards,
    totalsByBucket: Object.fromEntries(
      BUCKETS.map((b) => [b, PER_BUCKET[b]]),
    ) as Record<Bucket, number>,
  };
}

// Critical values for chi-squared distribution at α = 0.01 (upper tail).
// Standard tabulated values; df = k - 1 where k is the number of buckets.
const CHI2_CRIT_001: Record<number, number> = {
  1: 6.635,
  2: 9.21,
  3: 11.345,
  4: 13.277,
  5: 15.086,
  6: 16.812,
};

function chiSquare(observed: Record<string, number>, expectedProb: Record<string, number>, total: number): number {
  let chi = 0;
  for (const key of Object.keys(expectedProb)) {
    const p = expectedProb[key]!;
    const exp = p * total;
    if (exp === 0) continue;
    const obs = observed[key] ?? 0;
    chi += (obs - exp) ** 2 / exp;
  }
  return chi;
}

interface SlotStats {
  observedBuckets: Record<string, number>;
  total: number;
}

function runSimulation(): { perDrawSlot: Record<SlotIndex, SlotStats> } {
  const catalog = buildCatalog(makeManifest());
  const masterRng = mulberry32(FIXED_SEED);

  const perDrawSlot: Record<SlotIndex, SlotStats> = {
    1: { observedBuckets: {}, total: 0 },
    2: { observedBuckets: {}, total: 0 },
    3: { observedBuckets: {}, total: 0 },
    4: { observedBuckets: {}, total: 0 },
    5: { observedBuckets: {}, total: 0 },
    6: { observedBuckets: {}, total: 0 },
  };

  for (let i = 0; i < N; i++) {
    const boosterSeed = Math.floor(masterRng.next() * 0x100000000);
    const booster = generateBooster(mulberry32(boosterSeed), catalog, boosterSeed);
    for (const slot of booster.slots) {
      const stats = perDrawSlot[slot.drawIndex];
      stats.observedBuckets[slot.drawnBucket] = (stats.observedBuckets[slot.drawnBucket] ?? 0) + 1;
      stats.total++;
    }
  }

  return { perDrawSlot };
}

describe('Statistical distribution — slot frequencies (NON-NEGOTIABLE)', () => {
  const { perDrawSlot } = runSimulation();

  it.each([1, 2] as const)('slot %i is 100%% comum', (slot) => {
    const stats = perDrawSlot[slot];
    expect(stats.total).toBe(N);
    expect(stats.observedBuckets['01_comum']).toBe(N);
  });

  it('slot 3 is 100% incomum', () => {
    const stats = perDrawSlot[3];
    expect(stats.total).toBe(N);
    expect(stats.observedBuckets['02_incomum']).toBe(N);
  });

  it('slot 4: incomum 70% ± 1 p.p. and rara 30% ± 1 p.p.', () => {
    const stats = perDrawSlot[4];
    const incomumPct = (stats.observedBuckets['02_incomum'] ?? 0) / N;
    const raraPct = (stats.observedBuckets['03_raras'] ?? 0) / N;
    expect(incomumPct).toBeGreaterThanOrEqual(0.69);
    expect(incomumPct).toBeLessThanOrEqual(0.71);
    expect(raraPct).toBeGreaterThanOrEqual(0.29);
    expect(raraPct).toBeLessThanOrEqual(0.31);
  });

  it('slot 4: chi-squared aderência aceito a α = 0,01', () => {
    const stats = perDrawSlot[4];
    const expected = SLOT_DISTRIBUTIONS[4] as Record<string, number>;
    const chi = chiSquare(stats.observedBuckets, expected, stats.total);
    const df = Object.keys(expected).length - 1;
    expect(chi).toBeLessThan(CHI2_CRIT_001[df]!);
  });

  it.each([5, 6] as const)(
    'slot %i: bound observed within ±1 p.p. (legendaria gets a wider 0..1.5%%)',
    (slot) => {
      const stats = perDrawSlot[slot];
      const prob = (key: string) => (stats.observedBuckets[key] ?? 0) / N;

      expect(prob('03_raras')).toBeGreaterThanOrEqual(0.59);
      expect(prob('03_raras')).toBeLessThanOrEqual(0.61);

      expect(prob('04_duplo_raras')).toBeGreaterThanOrEqual(0.24);
      expect(prob('04_duplo_raras')).toBeLessThanOrEqual(0.26);

      expect(prob('05_arte_secreta')).toBeGreaterThanOrEqual(0.09);
      expect(prob('05_arte_secreta')).toBeLessThanOrEqual(0.11);

      expect(prob('06_duplo_arte_secreta')).toBeGreaterThanOrEqual(0.035);
      expect(prob('06_duplo_arte_secreta')).toBeLessThanOrEqual(0.055);

      expect(prob('07_legendaria')).toBeGreaterThanOrEqual(0);
      expect(prob('07_legendaria')).toBeLessThanOrEqual(0.015);

      expect(prob('01_comum')).toBe(0);
      expect(prob('02_incomum')).toBe(0);
    },
  );

  it.each([5, 6] as const)('slot %i: chi-squared aderência aceito a α = 0,01', (slot) => {
    const stats = perDrawSlot[slot];
    const expected = SLOT_DISTRIBUTIONS[slot] as Record<string, number>;
    const chi = chiSquare(stats.observedBuckets, expected, stats.total);
    const df = Object.keys(expected).length - 1;
    expect(chi).toBeLessThan(CHI2_CRIT_001[df]!);
  });
});
