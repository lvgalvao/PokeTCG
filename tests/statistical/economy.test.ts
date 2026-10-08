import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bucketRank } from '../../src/core/buckets.js';
import { generateBooster } from '../../src/core/booster.js';
import { mulberry32 } from '../../src/core/rng.js';
import { buildCatalog, type Manifest } from '../../src/domain/catalog.js';
import { SELL_RATE } from '../../src/game/career.js';
import { buildPriceBook, packPriceCents, type PackPrices, type PriceSnapshot } from '../../src/game/prices.js';

/**
 * Guarda da economia da Carreira: em nenhuma coleção abrir e vender tudo pode dar lucro
 * esperado (senão vira uma "impressora de dinheiro", como a Victini marcada como Rara).
 * 2.000 pacotes por set com seed fixa; valor de venda médio < preço do pacote.
 */

const root = resolve(__dirname, '../../assets');
const read = <T>(p: string): T => JSON.parse(readFileSync(resolve(root, p), 'utf8')) as T;
const index = read<{ sets: Array<{ id: string }> }>('data/sets.json');
const packPrices = read<PackPrices>('data/pack-prices.json');
const N = 2000;

describe('economia: nenhum pacote é lucro garantido', () => {
  for (const { id } of index.sets) {
    it(id, () => {
      const catalog = buildCatalog(read<Manifest>(`${id}/manifest.json`));
      const book = buildPriceBook(catalog, read<PriceSnapshot>(`data/prices/${id}.json`));
      const price = packPriceCents(packPrices, id);
      expect(price).not.toBeNull();
      const rng = mulberry32(0xbadc0de);
      let total = 0;
      for (let i = 0; i < N; i++) {
        for (const slot of generateBooster(rng, catalog, i).slots) total += book.valueOf(slot.card);
      }
      const sellEv = (total / N) * SELL_RATE;
      expect(sellEv, `${id}: venda esperada R$ ${(sellEv / 100).toFixed(2)}`).toBeLessThan(price!);
    });
  }

  it('cartas comuns/incomuns/raras não valem fortunas (dado errado de raridade)', () => {
    const suspicious: string[] = [];
    for (const { id } of index.sets) {
      const catalog = buildCatalog(read<Manifest>(`${id}/manifest.json`));
      const snap = read<PriceSnapshot>(`data/prices/${id}.json`);
      for (const card of catalog.cards) {
        const usd = snap.cards[card.id];
        // Vintage tem raras caras de verdade; o teto vale para as eras modernas.
        const modern = !/^(base|gym|neo|ecard|ex)\d/.test(id);
        if (modern && bucketRank(card.bucket) <= 3 && !card.subset && usd != null && usd > 150) {
          suspicious.push(`${card.id} ${card.name} (${card.rarityRaw}) US$ ${usd}`);
        }
      }
    }
    expect(suspicious).toEqual([]);
  });
});
