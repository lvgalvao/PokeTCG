import { describe, expect, it } from 'vitest';
import { fairCandidates, pickOpponents, toFighter, type Fighter } from '../../src/battle/fighter.js';
import { mulberry32 } from '../../src/core/rng.js';

/**
 * Princípio III — sorteio do adversário da batalha: com seed fixa, cada carta candidata
 * (HP dentro da faixa da carta do jogador) sai com a mesma chance. Qui-quadrado contra a
 * distribuição uniforme, α = 0,001.
 */

const N = 20_000;
const SEED = 0xba77;

function fighter(id: string, hp: number): Fighter {
  return toFighter(
    { id, name: id, rarityRaw: 'Common', bucket: '01_comum', collectionNumber: 1, imagePath: `assets/x/${id}.jpg`, imageUrl: `x/${id}.jpg` },
    { hp, type: 'Colorless', attacks: [['Tackle', 20]] },
  );
}

describe('pickOpponents — distribuição', () => {
  const mine = fighter('mine', 100);
  // 8 candidatas na faixa de 70 a 130 de HP e 4 fora dela.
  const pool = [70, 80, 90, 100, 100, 110, 120, 130, 40, 60, 140, 300].map((hp, i) => fighter(`c${i}`, hp));
  const candidates = fairCandidates(mine, pool);

  it('só cartas da faixa de HP são candidatas', () => {
    expect(candidates.map((f) => f.card.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
  });

  it(`cada candidata sai com a mesma chance (N=${N}, seed 0x${SEED.toString(16)})`, () => {
    const rng = mulberry32(SEED);
    const counts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const [foe] = pickOpponents(rng, [mine], pool);
      counts.set(foe!.card.id, (counts.get(foe!.card.id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(candidates.map((f) => f.card.id).sort());
    const expected = N / candidates.length;
    let chi2 = 0;
    for (const f of candidates) chi2 += ((counts.get(f.card.id) ?? 0) - expected) ** 2 / expected;
    // Valor crítico de χ² com 7 graus de liberdade e α = 0,001.
    expect(chi2).toBeLessThan(24.32);
  });
});
