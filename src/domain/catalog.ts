import { BUCKETS, isBucket, type Bucket } from '../core/buckets.js';
import type { Card } from './card.js';

export interface Catalog {
  readonly setId: string;
  readonly setName: string;
  readonly cards: readonly Card[];
  readonly byId: ReadonlyMap<string, Card>;
  readonly byBucket: Readonly<Record<Bucket, readonly Card[]>>;
  readonly totalSet: number;
  readonly totalsByBucket: Readonly<Record<Bucket, number>>;
}

export interface ManifestCard {
  id: string;
  name: string;
  rarityRaw: string;
  bucket: string;
  collectionNumber: number;
  imagePath: string;
}

export interface Manifest {
  setId: string;
  setName: string;
  generatedAt: string;
  downloaderVersion: string;
  totalSet: number;
  cards: ManifestCard[];
  totalsByBucket: Record<string, number>;
  unmapped?: Array<{ id: string; name: string; rarityRaw: string }>;
}

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

export async function loadCatalog(manifestUrl: string): Promise<Catalog> {
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new CatalogValidationError(
      `Failed to fetch manifest at ${manifestUrl}: HTTP ${res.status}`,
    );
  }
  const data = (await res.json()) as Manifest;
  return buildCatalog(data);
}

export function buildCatalog(manifest: Manifest): Catalog {
  const cards: Card[] = [];
  for (const raw of manifest.cards) {
    if (!raw.id) throw new CatalogValidationError(`Card missing id: ${JSON.stringify(raw)}`);
    if (!isBucket(raw.bucket)) {
      throw new CatalogValidationError(`Card ${raw.id} has unknown bucket "${raw.bucket}"`);
    }
    if (!Number.isInteger(raw.collectionNumber) || raw.collectionNumber < 0) {
      throw new CatalogValidationError(`Card ${raw.id} has invalid collectionNumber`);
    }
    if (!raw.imagePath.includes(`/${raw.bucket}/`)) {
      throw new CatalogValidationError(
        `Card ${raw.id}: imagePath ${raw.imagePath} does not match its bucket`,
      );
    }
    cards.push({
      id: raw.id,
      name: raw.name,
      rarityRaw: raw.rarityRaw,
      bucket: raw.bucket,
      collectionNumber: raw.collectionNumber,
      imagePath: raw.imagePath,
      imageUrl: raw.imagePath,
    });
  }
  cards.sort((a, b) => a.collectionNumber - b.collectionNumber);

  const byId = new Map<string, Card>();
  for (const c of cards) {
    if (byId.has(c.id)) {
      throw new CatalogValidationError(`Duplicate card id ${c.id}`);
    }
    byId.set(c.id, c);
  }

  const byBucket = Object.fromEntries(BUCKETS.map((b) => [b, [] as Card[]])) as Record<
    Bucket,
    Card[]
  >;
  for (const c of cards) {
    byBucket[c.bucket].push(c);
  }

  const totalsByBucket = Object.fromEntries(
    BUCKETS.map((b) => [b, byBucket[b].length]),
  ) as Record<Bucket, number>;

  const totalSet = cards.length;

  return {
    setId: manifest.setId,
    setName: manifest.setName,
    cards,
    byId,
    byBucket,
    totalSet,
    totalsByBucket,
  };
}
