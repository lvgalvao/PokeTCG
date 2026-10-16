import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/domain/card.js';
import { formatBrl, topPriced } from '../../src/ui/chase-cards.js';

function card(id: string, collectionNumber: number): Card {
  return { id, name: id, rarityRaw: 'Rare', bucket: '03_raras', collectionNumber, imagePath: `assets/x/${id}.jpg`, imageUrl: `x/${id}.jpg` };
}

describe('topPriced', () => {
  const cards = [card('a', 1), card('b', 2), card('c', 3), card('d', 4), card('e', 5)];

  it('devolve as 3 mais caras, da mais cara para a mais barata, com o valor em reais', () => {
    const top = topPriced(cards, { a: 1.5, b: 900, c: null, d: 20, e: 310.25 }, 5);
    expect(top.map((t) => t.card.id)).toEqual(['b', 'e', 'd']);
    expect(top[0]).toMatchObject({ usd: 900, brl: 4500 });
  });

  it('ignora cartas sem preço e preços de cartas fora do catálogo', () => {
    const top = topPriced(cards, { a: null, b: 0, zzz: 9999, d: 2 }, 5);
    expect(top.map((t) => t.card.id)).toEqual(['d']);
  });

  it('empate de preço sai na ordem do álbum', () => {
    expect(topPriced(cards, { c: 10, a: 10, b: 10 }, 5, 2).map((t) => t.card.id)).toEqual(['a', 'b']);
  });
});

describe('formatBrl', () => {
  it('mostra reais sem centavos', () => {
    expect(formatBrl(4612.4).replace(/\s/g, ' ')).toBe('R$ 4.612');
  });
});
