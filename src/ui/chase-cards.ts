import type { Card } from '../domain/card.js';
import type { Catalog } from '../domain/catalog.js';

/** `assets/data/prices/<set>.json`, gerado por tools/prices_tcgplayer (preço de mercado do TCGplayer). */
interface PriceFile {
  readonly asOf: string;
  readonly usdBrl: number;
  /** Preço em dólar por id de carta; `null` quando o TCGplayer não tem preço. */
  readonly cards: Readonly<Record<string, number | null>>;
  /** Preço em dólar do pacote avulso (ausente se o TCGplayer não tem anúncio). */
  readonly pack?: number;
}

/** Preços de um set em reais: por carta e do pacote. */
export interface SetPrices {
  readonly cardBrl: (cardId: string) => number;
  /** null se o pacote não tem preço. */
  readonly packBrl: number | null;
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

const files = new Map<string, Promise<PriceFile | null>>();

function priceFile(setId: string): Promise<PriceFile | null> {
  let p = files.get(setId);
  if (!p) {
    p = fetch(`./data/prices/${setId}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<PriceFile>) : null))
      .catch(() => null);
    files.set(setId, p);
  }
  return p;
}

/** As 3 cartas mais valiosas do set; lista vazia se o set não tem arquivo de preços. */
export async function chaseCardsFor(setId: string, catalog: Catalog): Promise<ChaseCard[]> {
  const file = await priceFile(setId);
  return file ? topPriced(catalog.cards, file.cards, file.usdBrl) : [];
}

/** Preços em reais do set; null se o set não tem arquivo de preços. */
export async function setPricesFor(setId: string): Promise<SetPrices | null> {
  const file = await priceFile(setId);
  if (!file) return null;
  return {
    cardBrl: (id) => (file.cards[id] ?? 0) * file.usdBrl,
    packBrl: typeof file.pack === 'number' && file.pack > 0 ? file.pack * file.usdBrl : null,
  };
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function formatBrl(value: number): string {
  return BRL.format(value);
}
