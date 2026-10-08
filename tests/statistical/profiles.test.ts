import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateBooster } from '../../src/core/booster.js';
import { SET_BOOSTER_PROFILES, type SlotOutcome } from '../../src/core/distributions.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Manifest } from '../../src/domain/catalog.js';
import type { Card } from '../../src/domain/card.js';

/**
 * Princípio III (NON-NEGOTIABLE) — perfis de pacote por set (SET_BOOSTER_PROFILES).
 * Para cada perfil, 10.000 boosters com seed fixa sobre o manifest real do set: o pacote
 * tem o tamanho real do perfil e a frequência de cada resultado de cada slot fica dentro
 * de max(1 p.p., 4σ binomial) da probabilidade declarada — com centenas de resultados
 * testados, ±1 p.p. fixo (≈2σ quando p≈0,5) falharia por acaso.
 */

const FIXED_SEED = 0xc0ffee;
const N = 10000;
const tolerance = (p: number) => Math.max(0.01, 4 * Math.sqrt((p * (1 - p)) / N));

function matches(card: Card, o: SlotOutcome): boolean {
  if (card.subset !== o.subset) return false;
  if (o.rarities) {
    return o.rarities.some((r) => r.toLowerCase() === card.rarityRaw.toLowerCase());
  }
  return !o.bucket || card.bucket === o.bucket;
}

function loadCatalog(setId: string) {
  const path = resolve(__dirname, '../../assets', setId, 'manifest.json');
  if (!existsSync(path)) return null;
  return buildCatalog(JSON.parse(readFileSync(path, 'utf8')) as Manifest);
}

for (const [setId, profile] of Object.entries(SET_BOOSTER_PROFILES)) {
  describe(`perfil de pacote ${setId}`, () => {
    it('probabilidades de cada slot somam 100%', () => {
      for (const outcomes of profile.slots) {
        expect(outcomes.reduce((acc, o) => acc + o.p, 0)).toBeCloseTo(1, 9);
      }
    });

    const catalog = loadCatalog(setId);
    it.skipIf(!catalog)('cada resultado tem cartas no manifest', () => {
      profile.slots.forEach((outcomes, i) => {
        for (const o of outcomes) {
          expect([...catalog!.cards, ...catalog!.packOnly].some((c) => matches(c, o)), `${setId} slot ${i + 1} ${JSON.stringify(o)}`).toBe(true);
        }
      });
    });

    it.skipIf(!catalog)('frequências observadas dentro da tolerância binomial', () => {
      const counts = profile.slots.map((outcomes) => outcomes.map(() => 0));
      const rng = mulberry32(FIXED_SEED);
      for (let i = 0; i < N; i++) {
        const booster = generateBooster(rng, catalog!, FIXED_SEED);
        expect(booster.slots).toHaveLength(profile.slots.length);
        expect(new Set(booster.slots.map((s) => s.card.id)).size).toBe(profile.slots.length);
        expect(booster.downgrades).toHaveLength(0);
        for (const slot of booster.slots) {
          const outcomes = profile.slots[slot.drawIndex - 1]!;
          const idx = outcomes.findIndex((o) => matches(slot.card, o));
          expect(idx).toBeGreaterThanOrEqual(0);
          counts[slot.drawIndex - 1]![idx]!++;
        }
      }
      profile.slots.forEach((outcomes, s) => {
        outcomes.forEach((o, i) => {
          const observed = counts[s]![i]! / N;
          expect(Math.abs(observed - o.p), `${setId} slot ${s + 1} ${JSON.stringify(o)}: ${observed}`).toBeLessThanOrEqual(tolerance(o.p));
        });
      });
    });
  });
}

describe('30th Celebration (me55)', () => {
  const catalog = loadCatalog('me55');
  it.skipIf(!catalog)('exatamente 1 Pikachu e no máximo 1 Classic Collection por pacote', () => {
    const rng = mulberry32(FIXED_SEED);
    for (let i = 0; i < N; i++) {
      const cards = generateBooster(rng, catalog!, FIXED_SEED).slots.map((s) => s.card);
      expect(cards.filter((c) => c.rarityRaw === 'Pikachu Rare')).toHaveLength(1);
      expect(cards.filter((c) => c.subset === 'me55c').length).toBeLessThanOrEqual(1);
    }
  });
});
