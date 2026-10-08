import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateBooster } from '../../src/core/booster.js';
import {
  SET_BOOSTER_PROFILES,
  SLOT_INDICES,
  type SlotOutcome,
} from '../../src/core/distributions.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Manifest } from '../../src/domain/catalog.js';
import type { Card } from '../../src/domain/card.js';

/**
 * Princípio III (NON-NEGOTIABLE) — perfis de pacote por set (SET_BOOSTER_PROFILES).
 * Para cada perfil, 10.000 boosters com seed fixa sobre o manifest real do set; a
 * frequência de cada resultado de cada slot deve ficar a ±1 p.p. da probabilidade
 * declarada.
 */

const FIXED_SEED = 0xc0ffee;
const N = 10000;
const TOLERANCE = 0.01;

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
      for (const slot of SLOT_INDICES) {
        const sum = profile.slots[slot].reduce((acc, o) => acc + o.p, 0);
        expect(sum).toBeCloseTo(1, 9);
      }
    });

    const catalog = loadCatalog(setId);
    it.skipIf(!catalog)('cada resultado tem cartas no manifest', () => {
      for (const slot of SLOT_INDICES) {
        for (const o of profile.slots[slot]) {
          expect([...catalog!.cards, ...catalog!.packOnly].some((c) => matches(c, o)), `${setId} slot ${slot} ${JSON.stringify(o)}`).toBe(true);
        }
      }
    });

    it.skipIf(!catalog)('frequências observadas a ±1 p.p. do declarado', () => {
      const counts = SLOT_INDICES.map((s) => profile.slots[s].map(() => 0));
      const rng = mulberry32(FIXED_SEED);
      for (let i = 0; i < N; i++) {
        const booster = generateBooster(rng, catalog!, FIXED_SEED);
        expect(new Set(booster.slots.map((s) => s.card.id)).size).toBe(6);
        expect(booster.downgrades).toHaveLength(0);
        for (const slot of booster.slots) {
          const outcomes = profile.slots[slot.drawIndex];
          const idx = outcomes.findIndex((o) => matches(slot.card, o));
          expect(idx).toBeGreaterThanOrEqual(0);
          counts[slot.drawIndex - 1]![idx]!++;
        }
      }
      for (const slot of SLOT_INDICES) {
        profile.slots[slot].forEach((o, i) => {
          const observed = counts[slot - 1]![i]! / N;
          expect(Math.abs(observed - o.p), `${setId} slot ${slot} ${JSON.stringify(o)}: ${observed}`).toBeLessThanOrEqual(TOLERANCE);
        });
      }
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
