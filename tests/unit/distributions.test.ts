import { describe, expect, it } from 'vitest';
import { BUCKETS } from '../../src/core/buckets.js';
import {
  SLOT_DISTRIBUTIONS,
  SLOT_DOWNGRADE_FLOOR,
  SLOT_INDICES,
} from '../../src/core/distributions.js';

describe('SLOT_DISTRIBUTIONS', () => {
  it.each(SLOT_INDICES.map((s) => [s] as const))(
    'slot %i probabilities sum to 1.0',
    (slot) => {
      const dist = SLOT_DISTRIBUTIONS[slot];
      const sum = Object.values(dist).reduce((acc, v) => acc + (v ?? 0), 0);
      expect(sum).toBeCloseTo(1.0, 9);
    },
  );

  it.each(SLOT_INDICES.map((s) => [s] as const))(
    'slot %i probabilities are non-negative',
    (slot) => {
      const dist = SLOT_DISTRIBUTIONS[slot];
      for (const p of Object.values(dist)) {
        expect(p ?? 0).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it.each(SLOT_INDICES.map((s) => [s] as const))(
    'slot %i only references known buckets',
    (slot) => {
      const dist = SLOT_DISTRIBUTIONS[slot];
      for (const key of Object.keys(dist)) {
        expect((BUCKETS as readonly string[]).includes(key)).toBe(true);
      }
    },
  );

  it('slots 1-2 are 100% common', () => {
    for (const slot of [1, 2] as const) {
      expect(SLOT_DISTRIBUTIONS[slot]).toEqual({ '01_comum': 1.0 });
    }
  });

  it('slot 3 is 100% incomum', () => {
    expect(SLOT_DISTRIBUTIONS[3]).toEqual({ '02_incomum': 1.0 });
  });

  it('slot 4 is 70/30 incomum/rara', () => {
    expect(SLOT_DISTRIBUTIONS[4]).toEqual({ '02_incomum': 0.7, '03_raras': 0.3 });
  });

  const RARES_DIST = {
    '03_raras': 0.6,
    '04_duplo_raras': 0.25,
    '05_arte_secreta': 0.1,
    '06_duplo_arte_secreta': 0.045,
    '07_legendaria': 0.005,
  };

  it('slot 5 matches the rares distribution exactly', () => {
    expect(SLOT_DISTRIBUTIONS[5]).toEqual(RARES_DIST);
  });

  it('slot 6 matches the rares distribution exactly', () => {
    expect(SLOT_DISTRIBUTIONS[6]).toEqual(RARES_DIST);
  });
});

describe('SLOT_DOWNGRADE_FLOOR', () => {
  it('slots 1-3 have no fallback', () => {
    for (const slot of [1, 2, 3] as const) {
      expect(SLOT_DOWNGRADE_FLOOR[slot]).toBeNull();
    }
  });

  it('slot 4 floor is incomum', () => {
    expect(SLOT_DOWNGRADE_FLOOR[4]).toBe('02_incomum');
  });

  it('slot 5 floor is rara', () => {
    expect(SLOT_DOWNGRADE_FLOOR[5]).toBe('03_raras');
  });

  it('slot 6 floor is rara', () => {
    expect(SLOT_DOWNGRADE_FLOOR[6]).toBe('03_raras');
  });
});
