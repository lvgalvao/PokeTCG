import type { Bucket } from './buckets.js';

export type BucketDistribution = Partial<Record<Bucket, number>>;

export type SlotIndex = 1 | 2 | 3 | 4 | 5 | 6;

export const SLOT_INDICES: readonly SlotIndex[] = [1, 2, 3, 4, 5, 6] as const;

export const SLOT_DISTRIBUTIONS: Readonly<Record<SlotIndex, BucketDistribution>> = {
  1: { '01_comum': 1.0 },
  2: { '01_comum': 1.0 },
  3: { '01_comum': 1.0 },
  4: {
    '03_raras': 0.6,
    '04_duplo_raras': 0.25,
    '05_arte_secreta': 0.1,
    '06_duplo_arte_secreta': 0.045,
    '07_legendaria': 0.005,
  },
  5: {
    '03_raras': 0.6,
    '04_duplo_raras': 0.25,
    '05_arte_secreta': 0.1,
    '06_duplo_arte_secreta': 0.045,
    '07_legendaria': 0.005,
  },
  6: {
    '03_raras': 0.6,
    '04_duplo_raras': 0.25,
    '05_arte_secreta': 0.1,
    '06_duplo_arte_secreta': 0.045,
    '07_legendaria': 0.005,
  },
};

export const SLOT_DOWNGRADE_FLOOR: Readonly<Record<SlotIndex, Bucket | null>> = {
  1: null,
  2: null,
  3: null,
  4: '03_raras',
  5: '03_raras',
  6: '03_raras',
};
