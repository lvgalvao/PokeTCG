import { BUCKET_LABELS, type Bucket } from '../core/buckets.js';
import type { Card } from '../domain/card.js';
import { loadCatalog, type Catalog } from '../domain/catalog.js';
import type { Collection } from '../domain/collection.js';

export interface SetInfo {
  readonly id: string;
  readonly name: string;
  readonly series: string;
  readonly era: string;
  /** ISO `YYYY-MM-DD`. */
  readonly releaseDate: string;
  readonly packSize: number;
  readonly albumSize: number;
  /** Prefixos de id dos subsets do álbum incorporados ao set (ex.: `me55c`). */
  readonly subsets: readonly string[];
}

export interface EraInfo {
  readonly id: string;
  readonly name: string;
}

export interface SetsIndex {
  readonly eras: readonly EraInfo[];
  /** Mais novo primeiro. */
  readonly sets: readonly SetInfo[];
}

/** Gerado por tools/build_sets_index.py. */
export async function loadSetsIndex(): Promise<SetsIndex> {
  const res = await fetch('./data/sets.json');
  if (!res.ok) throw new Error(`Falha ao carregar data/sets.json: HTTP ${res.status}`);
  return (await res.json()) as SetsIndex;
}

const catalogCache = new Map<string, Promise<Catalog>>();

/** Carrega o manifest de um set uma única vez, sob demanda. */
export function catalogFor(setId: string): Promise<Catalog> {
  let p = catalogCache.get(setId);
  if (!p) {
    p = loadCatalog(`./${setId}/manifest.json`);
    p.catch(() => catalogCache.delete(setId));
    catalogCache.set(setId, p);
  }
  return p;
}

export function coverUrl(setId: string): string {
  return `./${setId}/capa.webp`;
}

/** Cartas distintas do álbum que o jogador tem, sem precisar carregar o manifest. */
export function ownedCount(set: SetInfo, collection: Collection): number {
  const prefixes = [set.id, ...set.subsets].map((p) => `${p}-`);
  let n = 0;
  for (const [id, count] of collection.entries) {
    if (count > 0 && prefixes.some((p) => id.startsWith(p))) n++;
  }
  return Math.min(n, set.albumSize);
}

export function formatReleaseDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function eraYears(sets: readonly SetInfo[]): string {
  const years = sets.map((s) => Number(s.releaseDate.slice(0, 4)));
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** Nome das subcoleções incorporadas ao álbum de um set; elas têm categoria própria. */
const SUBSET_LABELS: Readonly<Record<string, string>> = {
  me55c: 'Clássica',
  cel25c: 'Clássica',
  swsh12pt5gg: 'Galarian Gallery',
  swsh12tg: 'Trainer Gallery',
  swsh11tg: 'Trainer Gallery',
  swsh10tg: 'Trainer Gallery',
  swsh9tg: 'Trainer Gallery',
  swsh45sv: 'Shiny Vault',
  sma: 'Shiny Vault',
  sve: 'Energia',
};

export function subsetLabel(subset: string): string {
  return SUBSET_LABELS[subset] ?? subset;
}

/** Categoria da carta para mostrar: a subcoleção (ex.: Clássica) ou a raridade. */
export function categoryLabel(card: Card, bucket: Bucket = card.bucket): string {
  return card.subset ? subsetLabel(card.subset) : BUCKET_LABELS[bucket];
}

/** Set (do álbum) a que uma carta pertence, pelo prefixo do id (subsets incluídos). */
export function setForCard(index: SetsIndex, id: string): SetInfo | undefined {
  return index.sets.find((s) => [s.id, ...s.subsets].some((p) => id.startsWith(`${p}-`)));
}
