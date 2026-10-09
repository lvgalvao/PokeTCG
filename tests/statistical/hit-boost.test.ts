import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateBooster, type BoosterSlot } from '../../src/core/booster.js';
import { bucketRank } from '../../src/core/buckets.js';
import { boostHits, HIT_BOOST, SET_BOOSTER_PROFILES } from '../../src/core/distributions.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Catalog, type Manifest } from '../../src/domain/catalog.js';

/**
 * Princípio III — "sorte" (HIT_BOOST): com seed fixa, cartas acima de Dupla Rara saem perto
 * de 3× mais que nos pull rates reais (limitado a 100% no slot); Dupla Rara/ex não sobe.
 */

describe('boostHits', () => {
  it('luck 1 não muda nada', () => {
    expect(boostHits([0.7, 0.3], [3, 5], 1)).toEqual([0.7, 0.3]);
  });

  it('triplica os hits e encolhe o resto, somando 100%', () => {
    const ps = boostHits([0.7, 0.2, 0.1], [3, 4, 5], 3);
    expect(ps[2]).toBeCloseTo(0.3, 9);
    expect(ps[0]).toBeCloseTo(0.7 * (0.7 / 0.9), 9);
    expect(ps[1]).toBeCloseTo(0.2 * (0.7 / 0.9), 9);
  });

  it('Rara e Dupla Rara nunca contam como hit', () => {
    expect(boostHits([0.6, 0.4], [3, 4], 3)).toEqual([0.6, 0.4]);
  });

  it('o primeiro resultado do slot é a base, mesmo sendo raro', () => {
    expect(boostHits([0.5, 0.5], [6, 4], 3)).toEqual([0.5, 0.5]);
  });

  it('se os hits não cabem, o slot vira só hits na mesma proporção', () => {
    const ps = boostHits([0.5, 0.3, 0.2], [3, 5, 6], 3);
    expect(ps[0]).toBeCloseTo(0, 9);
    expect(ps[1]! / ps[2]!).toBeCloseTo(0.3 / 0.2, 9);
    expect(ps.reduce((a, p) => a + p, 0)).toBeCloseTo(1, 9);
  });

  it('resultado sem cartas (rank 0) não é hit', () => {
    const ps = boostHits([0.8, 0.1, 0.1], [3, 0, 5], 3);
    expect(ps[2]).toBeCloseTo(0.3, 9);
    expect(ps[0]! + ps[1]!).toBeCloseTo(0.7, 9);
  });
});

const N = 4000;
const SEED = 0x5eed;

function perPack(catalog: Catalog, luck: number, hit: (s: BoosterSlot) => boolean): number {
  const rng = mulberry32(SEED);
  let n = 0;
  for (let i = 0; i < N; i++) n += generateBooster(rng, catalog, SEED, luck).slots.filter(hit).length;
  return n / N;
}

function loadCatalog(setId: string) {
  const path = resolve(__dirname, '../../assets', setId, 'manifest.json');
  return existsSync(path) ? buildCatalog(JSON.parse(readFileSync(path, 'utf8')) as Manifest) : null;
}

const aboveDouble = (s: BoosterSlot) => bucketRank(s.effectiveBucket) >= 5;
const doubleRare = (s: BoosterSlot) => s.card.rarityRaw === 'Double Rare';

describe(`luck ${HIT_BOOST}: mais cartas acima de Dupla Rara`, () => {
  for (const setId of ['me5', 'sv8', 'swsh7']) {
    const catalog = SET_BOOSTER_PROFILES[setId] ? loadCatalog(setId) : null;
    it.skipIf(!catalog)(`${setId}: acima de Dupla Rara saem ~${HIT_BOOST}×`, () => {
      const ratio = perPack(catalog!, HIT_BOOST, aboveDouble) / perPack(catalog!, 1, aboveDouble);
      expect(ratio).toBeGreaterThan(2.5);
      expect(ratio).toBeLessThan(HIT_BOOST * 1.2);
    });
  }

  const sv8 = loadCatalog('sv8');
  it.skipIf(!sv8)('sv8: Dupla Rara (ex) não sobe', () => {
    const ratio = perPack(sv8!, HIT_BOOST, doubleRare) / perPack(sv8!, 1, doubleRare);
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.05);
  });

  const me55 = loadCatalog('me55');
  it.skipIf(!me55)('30 Anos: Clássicas e SAR saem ~3×, ex não sobe', () => {
    const classic = (s: BoosterSlot) => s.card.subset === 'me55c';
    const sar = (s: BoosterSlot) => s.card.rarityRaw === 'Special Illustration Rare';
    const ratio = (hit: (s: BoosterSlot) => boolean) => perPack(me55!, HIT_BOOST, hit) / perPack(me55!, 1, hit);
    expect(ratio(classic)).toBeGreaterThan(2.5);
    expect(ratio(sar)).toBeGreaterThan(2.5);
    expect(ratio(doubleRare)).toBeLessThan(1.05);
  });
});
