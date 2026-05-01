export const BUCKETS = [
  '01_comum',
  '02_incomum',
  '03_raras',
  '04_duplo_raras',
  '05_arte_secreta',
  '06_duplo_arte_secreta',
  '07_legendaria',
] as const;

export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABELS: Readonly<Record<Bucket, string>> = {
  '01_comum': 'Comum',
  '02_incomum': 'Incomum',
  '03_raras': 'Rara',
  '04_duplo_raras': 'Dupla Rara',
  '05_arte_secreta': 'Arte Secreta',
  '06_duplo_arte_secreta': 'Dupla Arte Secreta',
  '07_legendaria': 'Legendária',
};

export function isBucket(value: unknown): value is Bucket {
  return typeof value === 'string' && (BUCKETS as readonly string[]).includes(value);
}

export function bucketRank(b: Bucket): number {
  return BUCKETS.indexOf(b) + 1;
}

export function bucketDowngrade(b: Bucket): Bucket | null {
  const idx = BUCKETS.indexOf(b);
  if (idx <= 0) return null;
  return BUCKETS[idx - 1] ?? null;
}
