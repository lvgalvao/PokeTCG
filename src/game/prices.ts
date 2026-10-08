import type { Card } from '../domain/card.js';
import type { Catalog } from '../domain/catalog.js';
import { usdToCents, type Cents } from './money.js';

/** Snapshot gerado por tools/fetch_prices.py (assets/data/prices/<set>.json). */
export interface PriceSnapshot {
  readonly asOf: string;
  readonly usdBrl: number;
  readonly rateDate: string;
  readonly cards: Readonly<Record<string, number | null>>;
}

/** Gerado a partir da pesquisa de preço do pacote lacrado (assets/data/pack-prices.json). */
export interface PackPrices {
  readonly asOf: string;
  readonly usdBrl: number;
  readonly packs: Readonly<Record<string, { readonly usd: number; readonly estimate?: boolean }>>;
}

export interface PriceBook {
  readonly asOf: string;
  /** Valor de mercado da carta em centavos. Cartas só-de-pacote valem 0. */
  valueOf(card: Card): Cents;
  /** Verdadeiro quando o valor veio de outra carta da mesma raridade (sem preço próprio). */
  isEstimated(card: Card): boolean;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Preço de cada carta; quando a fonte não tem preço, usa a mediana da mesma raridade no set
 * (melhor estimativa honesta que um zero).
 */
export function buildPriceBook(catalog: Catalog, snapshot: PriceSnapshot | null): PriceBook {
  const own = new Map<string, Cents>();
  const byRarity = new Map<string, number[]>();
  if (snapshot) {
    for (const card of catalog.cards) {
      const usd = snapshot.cards[card.id];
      if (usd == null) continue;
      const cents = usdToCents(usd, snapshot.usdBrl);
      own.set(card.id, cents);
      const list = byRarity.get(card.rarityRaw) ?? [];
      list.push(cents);
      byRarity.set(card.rarityRaw, list);
    }
  }
  const fallback = new Map<string, Cents>();
  for (const [rarity, list] of byRarity) fallback.set(rarity, Math.round(median(list)));
  const packOnly = new Set(catalog.packOnly.map((c) => c.id));
  return {
    asOf: snapshot?.asOf ?? '',
    valueOf: (card) =>
      packOnly.has(card.id) ? 0 : own.get(card.id) ?? fallback.get(card.rarityRaw) ?? 0,
    isEstimated: (card) => !packOnly.has(card.id) && !own.has(card.id),
  };
}

export function packPriceCents(prices: PackPrices, setId: string): Cents | null {
  const p = prices.packs[setId];
  return p ? usdToCents(p.usd, prices.usdBrl) : null;
}

const snapshotCache = new Map<string, Promise<PriceSnapshot | null>>();

export function loadPriceSnapshot(setId: string): Promise<PriceSnapshot | null> {
  let p = snapshotCache.get(setId);
  if (!p) {
    p = fetch(`./data/prices/${setId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<PriceSnapshot>) : null))
      .catch(() => null);
    snapshotCache.set(setId, p);
  }
  return p;
}

let packPricesPromise: Promise<PackPrices | null> | null = null;

export function loadPackPrices(): Promise<PackPrices | null> {
  packPricesPromise ??= fetch('./data/pack-prices.json')
    .then((r) => (r.ok ? (r.json() as Promise<PackPrices>) : null))
    .catch(() => null);
  return packPricesPromise;
}
