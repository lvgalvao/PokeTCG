import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateBooster, type BoosterSlot } from '../../src/core/booster.js';
import { bucketRank } from '../../src/core/buckets.js';
import { boostHits, FAMILY_PROFILES, HIT_BOOST, SET_BOOSTER_PROFILES } from '../../src/core/distributions.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Catalog, type Manifest } from '../../src/domain/catalog.js';

/**
 * Princípio III — "sorte" (HIT_BOOST): com seed fixa, as cartas raras acima da carta normal
 * de cada slot saem perto de HIT_BOOST× mais que nos pull rates reais (limitado a 100% no
 * slot, quando o slot vira só hits).
 */

describe('boostHits', () => {
  it('luck 1 não muda nada', () => {
    expect(boostHits([0.7, 0.3], [2, 3], 1)).toEqual([0.7, 0.3]);
  });

  it('multiplica os hits e encolhe o resto, somando 100%', () => {
    const ps = boostHits([0.9, 0.06, 0.04], [3, 4, 6], 5);
    expect(ps[1]).toBeCloseTo(0.3, 9);
    expect(ps[2]).toBeCloseTo(0.2, 9);
    expect(ps[0]).toBeCloseTo(0.5, 9);
  });

  it('comum e incomum nunca contam como hit', () => {
    expect(boostHits([0.6, 0.4], [1, 2], 5)).toEqual([0.6, 0.4]);
  });

  it('o primeiro resultado do slot é a base, mesmo com o mesmo rank (Rara × Rara Holo)', () => {
    const ps = boostHits([2 / 3, 1 / 3], [3, 3], 5);
    expect(ps[0]).toBeCloseTo(0, 9);
    expect(ps[1]).toBeCloseTo(1, 9);
  });

  it('se os hits não cabem, o slot vira só hits na mesma proporção', () => {
    const ps = boostHits([0.6, 0.25, 0.15], [3, 4, 5], 5);
    expect(ps[0]).toBeCloseTo(0, 9);
    expect(ps[1]! / ps[2]!).toBeCloseTo(0.25 / 0.15, 9);
    expect(ps.reduce((a, p) => a + p, 0)).toBeCloseTo(1, 9);
  });

  it('resultado sem cartas (rank 0) não é hit', () => {
    const ps = boostHits([0.9, 0.05, 0.05], [3, 0, 5], 5);
    expect(ps[2]).toBeCloseTo(0.25, 9);
    expect(ps[0]! + ps[1]!).toBeCloseTo(0.75, 9);
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

const ratio = (catalog: Catalog, hit: (s: BoosterSlot) => boolean) =>
  perPack(catalog, HIT_BOOST, hit) / perPack(catalog, 1, hit);

describe(`luck ${HIT_BOOST}: muito mais cartas raras`, () => {
  const sv8 = loadCatalog('sv8');
  it.skipIf(!sv8)('sv8: SAR/IR/Hyper saem bem mais (slot de rara fica só hits)', () => {
    expect(ratio(sv8!, (s) => bucketRank(s.effectiveBucket) >= 5)).toBeGreaterThan(2.5);
  });
  it.skipIf(!sv8)('sv8: Dupla Rara (ex) também sobe', () => {
    expect(ratio(sv8!, (s) => s.card.rarityRaw === 'Double Rare')).toBeGreaterThan(2);
  });

  const base1 = loadCatalog('base1');
  it.skipIf(!base1 || !SET_BOOSTER_PROFILES.base1)('base1: Holo vem em todo pacote', () => {
    expect(perPack(base1!, HIT_BOOST, (s) => s.card.rarityRaw === 'Rare Holo')).toBe(1);
  });

  const me5 = loadCatalog('me5');
  it.skipIf(!me5)(`me5: IR/SIR saem ~${HIT_BOOST}×`, () => {
    const r = ratio(me5!, (s) => ['Illustration Rare', 'Special Illustration Rare'].includes(s.card.rarityRaw));
    expect(r).toBeGreaterThan(HIT_BOOST * 0.8);
    expect(r).toBeLessThan(HIT_BOOST * 1.2);
  });

  const me55 = loadCatalog('me55');
  it.skipIf(!me55)('30 Anos: tabela da família — SAR ~28%, Clássica ~15% por pacote', () => {
    const sar = perPack(me55!, HIT_BOOST, (s) => s.card.rarityRaw === 'Special Illustration Rare');
    const classic = perPack(me55!, HIT_BOOST, (s) => s.card.subset === 'me55c');
    expect(sar).toBeCloseTo(0.28, 1);
    expect(classic).toBeCloseTo(0.15, 1);
    expect(sar).toBeGreaterThan(classic);
  });
});

describe('FAMILY_PROFILES', () => {
  for (const [setId, profile] of Object.entries(FAMILY_PROFILES)) {
    it(`${setId}: mesmo tamanho do pacote real e cada slot soma 100%`, () => {
      expect(profile.slots).toHaveLength(SET_BOOSTER_PROFILES[setId]!.slots.length);
      for (const outcomes of profile.slots) {
        expect(outcomes.reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 9);
      }
    });

    const catalog = loadCatalog(setId);
    it.skipIf(!catalog)(`${setId}: frequências observadas batem com a tabela (±4σ)`, () => {
      const counts = profile.slots.map((o) => o.map(() => 0));
      const rng = mulberry32(SEED);
      for (let i = 0; i < N; i++) {
        const b = generateBooster(rng, catalog!, SEED, HIT_BOOST);
        b.slots.forEach((s, slot) => {
          const k = profile.slots[slot]!.findIndex((o) =>
            o.subset ? s.card.subset === o.subset : !s.card.subset && o.rarities!.includes(s.card.rarityRaw),
          );
          if (k >= 0) counts[slot]![k]!++;
        });
      }
      profile.slots.forEach((outcomes, slot) =>
        outcomes.forEach((o, k) => {
          const tol = Math.max(0.01, 4 * Math.sqrt((o.p * (1 - o.p)) / N));
          expect(Math.abs(counts[slot]![k]! / N - o.p), `${setId} slot ${slot + 1} ${JSON.stringify(o)}`).toBeLessThan(tol);
        }),
      );
    });
  }
});
