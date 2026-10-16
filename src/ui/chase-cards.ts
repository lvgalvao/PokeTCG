import type { Card } from '../domain/card.js';
import type { Catalog } from '../domain/catalog.js';

/** `assets/data/prices/<set>.json`, gerado por tools/prices_tcgplayer (preço de mercado do TCGplayer). */
interface PriceFile {
  readonly asOf: string;
  readonly usdBrl: number;
  /** Preço em dólar por id de carta; `null` quando o TCGplayer não tem preço. */
  readonly cards: Readonly<Record<string, number | null>>;
}

export interface ChaseCard {
  readonly card: Card;
  readonly usd: number;
  readonly brl: number;
}

/** As `n` cartas mais caras entre as do catálogo, da mais cara para a mais barata. */
export function topPriced(
  cards: readonly Card[],
  prices: Readonly<Record<string, number | null>>,
  usdBrl: number,
  n = 3,
): ChaseCard[] {
  return cards
    .flatMap((card) => {
      const usd = prices[card.id];
      return typeof usd === 'number' && usd > 0 ? [{ card, usd, brl: usd * usdBrl }] : [];
    })
    .sort((a, b) => b.usd - a.usd || a.card.collectionNumber - b.card.collectionNumber)
    .slice(0, n);
}

const cache = new Map<string, Promise<ChaseCard[]>>();

/** As 3 cartas mais valiosas do set; lista vazia se o set não tem arquivo de preços. */
export function chaseCardsFor(setId: string, catalog: Catalog): Promise<ChaseCard[]> {
  let p = cache.get(setId);
  if (!p) {
    p = fetch(`./data/prices/${setId}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<PriceFile>) : null))
      .then((file) => (file ? topPriced(catalog.cards, file.cards, file.usdBrl) : []))
      .catch(() => []);
    cache.set(setId, p);
  }
  return p;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function formatBrl(value: number): string {
  return BRL.format(value);
}
