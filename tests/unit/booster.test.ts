import { describe, expect, it } from 'vitest';
import { BUCKETS, bucketRank, type Bucket } from '../../src/core/buckets.js';
import {
  EmptyBaseBucketError,
  EmptyMandatorySlotError,
  generateBooster,
} from '../../src/core/booster.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Manifest } from '../../src/domain/catalog.js';
import type { ManifestCard } from '../../src/domain/catalog.js';

function makeCard(idx: number, bucket: Bucket): ManifestCard {
  return {
    id: `${bucket}-${idx}`,
    name: `Card ${bucket} ${idx}`,
    rarityRaw: 'Test',
    bucket,
    collectionNumber: idx,
    imagePath: `assets/${bucket}/${bucket}-${idx}.jpg`,
  };
}

function makeManifest(perBucket: Record<Bucket, number>): Manifest {
  const cards: ManifestCard[] = [];
  let n = 1;
  for (const bucket of BUCKETS) {
    for (let i = 0; i < perBucket[bucket]; i++) {
      cards.push(makeCard(n++, bucket));
    }
  }
  const totalsByBucket = Object.fromEntries(
    BUCKETS.map((b) => [b, perBucket[b]]),
  ) as Record<Bucket, number>;
  return {
    setId: 'test',
    setName: 'Test set',
    generatedAt: '2026-05-01T00:00:00Z',
    downloaderVersion: '0.0.0',
    totalSet: cards.length,
    cards,
    totalsByBucket,
  };
}

const FULL: Record<Bucket, number> = {
  '01_comum': 60,
  '02_incomum': 25,
  '03_raras': 15,
  '04_duplo_raras': 12,
  '05_arte_secreta': 10,
  '06_duplo_arte_secreta': 8,
  '07_legendaria': 4,
};

const fullCatalog = () => buildCatalog(makeManifest(FULL));

describe('generateBooster — invariants', () => {
  it('I1: returns exactly 6 slots', () => {
    const b = generateBooster(mulberry32(1), fullCatalog(), 1);
    expect(b.slots).toHaveLength(6);
  });

  it('I2: all 6 cards are unique by id', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const b = generateBooster(mulberry32(seed), fullCatalog(), seed);
      const ids = new Set(b.slots.map((s) => s.card.id));
      expect(ids.size).toBe(6);
    }
  });

  it('I3: post-sort, the first 4 slots have drawnBucket 01_comum', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const b = generateBooster(mulberry32(seed), fullCatalog(), seed);
      for (let i = 0; i < 4; i++) {
        expect(b.slots[i]!.drawnBucket).toBe('01_comum');
      }
    }
  });

  it('I4: slot 5 (drawIndex) only draws 02_incomum or 03_raras', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const b = generateBooster(mulberry32(seed), fullCatalog(), seed);
      const slot5 = b.slots.find((s) => s.drawIndex === 5)!;
      expect(['02_incomum', '03_raras']).toContain(slot5.drawnBucket);
    }
  });

  it('I5: slot 6 (drawIndex) only draws 03 through 07', () => {
    const allowed: Bucket[] = [
      '03_raras',
      '04_duplo_raras',
      '05_arte_secreta',
      '06_duplo_arte_secreta',
      '07_legendaria',
    ];
    for (let seed = 1; seed <= 500; seed++) {
      const b = generateBooster(mulberry32(seed), fullCatalog(), seed);
      const slot6 = b.slots.find((s) => s.drawIndex === 6)!;
      expect(allowed).toContain(slot6.drawnBucket);
    }
  });

  it('I6: slots are ordered by effective bucket rank ascending', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const b = generateBooster(mulberry32(seed), fullCatalog(), seed);
      for (let i = 0; i < 5; i++) {
        expect(bucketRank(b.slots[i]!.effectiveBucket)).toBeLessThanOrEqual(
          bucketRank(b.slots[i + 1]!.effectiveBucket),
        );
      }
    }
  });

  it('I8: deterministic — same seed produces identical booster', () => {
    const a = generateBooster(mulberry32(0xc0ffee), fullCatalog(), 0xc0ffee);
    const b = generateBooster(mulberry32(0xc0ffee), fullCatalog(), 0xc0ffee);
    expect(a.slots.map((s) => s.card.id)).toEqual(b.slots.map((s) => s.card.id));
  });

  it('I9: cross-slot uniqueness even when buckets coincide', () => {
    // Slots 5 (rara) + 6 (rara) — must still pick distinct cards.
    const small = buildCatalog(
      makeManifest({
        '01_comum': 10,
        '02_incomum': 1, // force slot 5 frequently to fall through to rara via downgrade? No — slot 5 has floor incomum, can't downgrade above incomum.
        '03_raras': 5,
        '04_duplo_raras': 3,
        '05_arte_secreta': 2,
        '06_duplo_arte_secreta': 1,
        '07_legendaria': 0,
      }),
    );
    for (let seed = 1; seed <= 50; seed++) {
      const b = generateBooster(mulberry32(seed), small, seed);
      const ids = new Set(b.slots.map((s) => s.card.id));
      expect(ids.size).toBe(6);
    }
  });
});

describe('generateBooster — downgrade with floor (FR-014a/b)', () => {
  it('slot 6 with empty 07_legendaria still produces a booster (downgrade)', () => {
    const cat = buildCatalog(
      makeManifest({
        '01_comum': 50,
        '02_incomum': 25,
        '03_raras': 15,
        '04_duplo_raras': 12,
        '05_arte_secreta': 10,
        '06_duplo_arte_secreta': 8,
        '07_legendaria': 0,
      }),
    );
    for (let seed = 1; seed <= 200; seed++) {
      const b = generateBooster(mulberry32(seed), cat, seed);
      expect(b.slots).toHaveLength(6);
      // No slot ends up with 07_legendaria
      expect(b.slots.every((s) => s.effectiveBucket !== '07_legendaria')).toBe(true);
    }
  });

  it('downgrade is recorded when applied', () => {
    const cat = buildCatalog(
      makeManifest({
        '01_comum': 50,
        '02_incomum': 25,
        '03_raras': 15,
        '04_duplo_raras': 12,
        '05_arte_secreta': 10,
        '06_duplo_arte_secreta': 8,
        '07_legendaria': 0,
      }),
    );
    let foundDowngrade = false;
    for (let seed = 1; seed <= 5000; seed++) {
      const b = generateBooster(mulberry32(seed), cat, seed);
      if (b.downgrades.length > 0) {
        foundDowngrade = true;
        for (const dg of b.downgrades) {
          expect(dg.from).not.toBe(dg.to);
          expect(bucketRank(dg.to)).toBeLessThan(bucketRank(dg.from));
        }
        break;
      }
    }
    expect(foundDowngrade).toBe(true);
  });

  it('throws EmptyBaseBucketError when 01_comum is empty', () => {
    const cat = buildCatalog(
      makeManifest({
        '01_comum': 0,
        '02_incomum': 25,
        '03_raras': 15,
        '04_duplo_raras': 12,
        '05_arte_secreta': 10,
        '06_duplo_arte_secreta': 8,
        '07_legendaria': 4,
      }),
    );
    expect(() => generateBooster(mulberry32(1), cat, 1)).toThrow(EmptyBaseBucketError);
  });

  it('throws EmptyMandatorySlotError when slot 6 cannot be filled (all 03+ empty)', () => {
    const cat = buildCatalog(
      makeManifest({
        '01_comum': 50,
        '02_incomum': 25,
        '03_raras': 0,
        '04_duplo_raras': 0,
        '05_arte_secreta': 0,
        '06_duplo_arte_secreta': 0,
        '07_legendaria': 0,
      }),
    );
    expect(() => generateBooster(mulberry32(1), cat, 1)).toThrow(EmptyMandatorySlotError);
  });
});
