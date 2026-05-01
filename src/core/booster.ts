import type { Card } from '../domain/card.js';
import type { Catalog } from '../domain/catalog.js';
import { BUCKETS, bucketRank, type Bucket } from './buckets.js';
import {
  SLOT_DISTRIBUTIONS,
  SLOT_DOWNGRADE_FLOOR,
  SLOT_INDICES,
  type BucketDistribution,
  type SlotIndex,
} from './distributions.js';
import type { RNG } from './rng.js';

export interface BoosterSlot {
  readonly slotIndex: SlotIndex;
  readonly drawIndex: SlotIndex;
  readonly drawnBucket: Bucket;
  readonly effectiveBucket: Bucket;
  readonly card: Card;
}

export interface DowngradeRecord {
  readonly slot: SlotIndex;
  readonly from: Bucket;
  readonly to: Bucket;
}

export interface Booster {
  readonly slots: readonly [
    BoosterSlot,
    BoosterSlot,
    BoosterSlot,
    BoosterSlot,
    BoosterSlot,
    BoosterSlot,
  ];
  readonly seed: number;
  readonly generatedAt: number;
  readonly downgrades: readonly DowngradeRecord[];
}

export class EmptyBaseBucketError extends Error {
  constructor() {
    super('Bucket 01_comum is empty in the catalog');
    this.name = 'EmptyBaseBucketError';
  }
}

export class EmptyMandatorySlotError extends Error {
  constructor(public readonly slot: SlotIndex, public readonly drawnBucket: Bucket) {
    super(`Slot ${slot} could not be filled (drawn ${drawnBucket}, no fallback in floor)`);
    this.name = 'EmptyMandatorySlotError';
  }
}

export class InsufficientCardsError extends Error {
  constructor(public readonly slot: SlotIndex, public readonly bucket: Bucket) {
    super(`Slot ${slot}: not enough unique cards available in ${bucket}`);
    this.name = 'InsufficientCardsError';
  }
}

export function sampleBucket(rng: RNG, dist: BucketDistribution): Bucket {
  const r = rng.next();
  let cum = 0;
  for (const bucket of BUCKETS) {
    const p = dist[bucket] ?? 0;
    if (p === 0) continue;
    cum += p;
    if (r < cum) return bucket;
  }
  for (let i = BUCKETS.length - 1; i >= 0; i--) {
    const b = BUCKETS[i]!;
    if ((dist[b] ?? 0) > 0) return b;
  }
  throw new Error('Empty distribution');
}

function pickIndex(rng: RNG, length: number): number {
  return Math.floor(rng.next() * length);
}

export function generateBooster(rng: RNG, catalog: Catalog, seed: number): Booster {
  if (catalog.byBucket['01_comum'].length === 0) {
    throw new EmptyBaseBucketError();
  }

  const used = new Set<string>();
  const drawn: BoosterSlot[] = [];
  const downgrades: DowngradeRecord[] = [];

  for (const drawIdx of SLOT_INDICES) {
    const drawnBucket = sampleBucket(rng, SLOT_DISTRIBUTIONS[drawIdx]);
    const floor = SLOT_DOWNGRADE_FLOOR[drawIdx];

    let effectiveBucket: Bucket;

    if (floor === null) {
      const available = catalog.byBucket[drawnBucket].filter((c) => !used.has(c.id));
      if (available.length === 0) {
        throw new InsufficientCardsError(drawIdx, drawnBucket);
      }
      effectiveBucket = drawnBucket;
    } else {
      let cur: Bucket = drawnBucket;
      while (true) {
        const available = catalog.byBucket[cur].filter((c) => !used.has(c.id));
        if (available.length > 0) {
          effectiveBucket = cur;
          break;
        }
        const nextIdx = BUCKETS.indexOf(cur) - 1;
        const next = nextIdx >= 0 ? BUCKETS[nextIdx]! : null;
        if (next === null || bucketRank(next) < bucketRank(floor)) {
          throw new EmptyMandatorySlotError(drawIdx, drawnBucket);
        }
        cur = next;
      }
    }

    if (effectiveBucket !== drawnBucket) {
      downgrades.push({ slot: drawIdx, from: drawnBucket, to: effectiveBucket });
    }

    const available = catalog.byBucket[effectiveBucket].filter((c) => !used.has(c.id));
    const card = available[pickIndex(rng, available.length)]!;
    used.add(card.id);

    drawn.push({
      slotIndex: drawIdx,
      drawIndex: drawIdx,
      drawnBucket,
      effectiveBucket,
      card,
    });
  }

  drawn.sort((a, b) => {
    const rankA = bucketRank(a.effectiveBucket);
    const rankB = bucketRank(b.effectiveBucket);
    if (rankA !== rankB) {
      return rankA - rankB; // Ascending order: lowest rank first, highest last.
    }
    // Secondary sort: if they are in the same bucket, sort alphabetically by name
    return a.card.name.localeCompare(b.card.name);
  });

  const slots = drawn.map((s, i) => ({
    ...s,
    slotIndex: (i + 1) as SlotIndex,
  })) as unknown as Booster['slots'];

  return {
    slots,
    seed,
    generatedAt: Date.now(),
    downgrades,
  };
}
