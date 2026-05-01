import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng.js';

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rng = mulberry32(0xc0ffee);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let diffs = 0;
    for (let i = 0; i < 1000; i++) {
      if (a.next() !== b.next()) diffs++;
    }
    expect(diffs).toBeGreaterThan(990);
  });

  it('produces approximately uniform distribution over a large sample', () => {
    const rng = mulberry32(0xdeadbeef);
    const buckets: number[] = new Array(10).fill(0);
    const N = 100000;
    for (let i = 0; i < N; i++) {
      const idx = Math.floor(rng.next() * 10);
      buckets[idx] = (buckets[idx] ?? 0) + 1;
    }
    const expected = N / 10;
    for (const c of buckets) {
      expect(c).toBeGreaterThan(expected * 0.95);
      expect(c).toBeLessThan(expected * 1.05);
    }
  });
});
