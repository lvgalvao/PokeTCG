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
