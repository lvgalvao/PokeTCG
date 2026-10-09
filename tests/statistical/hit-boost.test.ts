import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateBooster } from '../../src/core/booster.js';
import { bucketRank } from '../../src/core/buckets.js';
import { boostHits, HIT_BOOST, SET_BOOSTER_PROFILES } from '../../src/core/distributions.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Manifest } from '../../src/domain/catalog.js';

/**
 * Princípio III — "sorte" (HIT_BOOST): com seed fixa, a frequência de hits por pacote com
 * luck = 3 fica perto de 3× a frequência com os pull rates reais (limitada a 100% no slot).
 */

describe('boostHits', () => {
  it('luck 1 não muda nada', () => {
    expect(boostHits([0.7, 0.3], [2, 3], 1)).toEqual([0.7, 0.3]);
  });

  it('triplica os hits e encolhe o resto, somando 100%', () => {
    const ps = boostHits([0.7, 0.2, 0.1], [3, 4, 5], 3);
    expect(ps[1]).toBeCloseTo(0.6, 9);
    expect(ps[2]).toBeCloseTo(0.3, 9);
    expect(ps[0]).toBeCloseTo(0.1, 9);
  });

  it('comum e incomum nunca contam como hit', () => {
    expect(boostHits([0.6, 0.4], [1, 2], 3)).toEqual([0.6, 0.4]);
  });

  it('o primeiro resultado do slot é a base, mesmo com o mesmo rank (Rara × Rara Holo)', () => {
    const ps = boostHits([2 / 3, 1 / 3], [3, 3], 3);
    expect(ps[0]).toBeCloseTo(0, 9);
    expect(ps[1]).toBeCloseTo(1, 9);
  });

  it('se os hits não cabem, o slot vira só hits na mesma proporção', () => {
    const ps = boostHits([0.6, 0.25, 0.15], [3, 4, 5], 3);
    expect(ps[0]).toBeCloseTo(0, 9);
    expect(ps[1]! / ps[2]!).toBeCloseTo(0.25 / 0.15, 9);
    expect(ps.reduce((a, p) => a + p, 0)).toBeCloseTo(1, 9);
  });

  it('resultado sem cartas (rank 0) não é hit', () => {
    const ps = boostHits([0.8, 0.1, 0.1], [3, 0, 4], 3);
    expect(ps[2]).toBeCloseTo(0.3, 9);
    expect(ps[0]! + ps[1]!).toBeCloseTo(0.7, 9);
  });
});

const N = 4000;
const SEED = 0x5eed;

/** Hits por pacote: acima de Rara, ou Rara Holo. */
function hitsPerPack(catalog: ReturnType<typeof buildCatalog>, luck: number): number {
  const rng = mulberry32(SEED);
  let hits = 0;
  for (let i = 0; i < N; i++) {
    for (const s of generateBooster(rng, catalog, SEED, luck).slots) {
      if (bucketRank(s.effectiveBucket) >= 4 || /holo/i.test(s.card.rarityRaw)) hits++;
    }
  }
  return hits / N;
}

function loadCatalog(setId: string) {
  const path = resolve(__dirname, '../../assets', setId, 'manifest.json');
  return existsSync(path) ? buildCatalog(JSON.parse(readFileSync(path, 'utf8')) as Manifest) : null;
}

describe(`luck ${HIT_BOOST}: mais hits em todas as coleções`, () => {
  for (const setId of ['me5', 'sv8', 'swsh7', 'base1']) {
    const catalog = SET_BOOSTER_PROFILES[setId] ? loadCatalog(setId) : null;
    it.skipIf(!catalog)(`${setId}: cartas acima de Rara saem ~${HIT_BOOST}× mais (mín. 2×)`, () => {
      const real = hitsPerPack(catalog!, 1);
      const lucky = hitsPerPack(catalog!, HIT_BOOST);
      expect(real).toBeGreaterThan(0);
      expect(lucky / real).toBeGreaterThan(2);
      expect(lucky / real).toBeLessThan(HIT_BOOST * 1.25);
    });
  }

  it.skipIf(!loadCatalog('me55'))('30 Anos: Clássicas e SAR também saem ~3× mais', () => {
    const catalog = loadCatalog('me55')!;
    const rate = (luck: number, hit: (s: { card: { subset?: string; rarityRaw: string } }) => boolean) => {
      const rng = mulberry32(SEED);
      let n = 0;
      for (let i = 0; i < N; i++) n += generateBooster(rng, catalog, SEED, luck).slots.filter(hit).length;
      return n / N;
    };
    const classic = (s: { card: { subset?: string } }) => s.card.subset === 'me55c';
    const sar = (s: { card: { rarityRaw: string } }) => s.card.rarityRaw === 'Special Illustration Rare';
    expect(rate(HIT_BOOST, classic) / rate(1, classic)).toBeGreaterThan(2.5);
    expect(rate(HIT_BOOST, sar) / rate(1, sar)).toBeGreaterThan(2.5);
  });
});
