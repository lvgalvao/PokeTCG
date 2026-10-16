import { describe, expect, it } from 'vitest';
import {
  basicCooldown,
  fairCandidates,
  hitFor,
  MIN_DAMAGE,
  movesFor,
  pickOpponents,
  specialCooldown,
  toFighter,
  type BattleStats,
  type Fighter,
} from '../../src/battle/fighter.js';
import { mulberry32 } from '../../src/core/rng.js';
import type { Card } from '../../src/domain/card.js';

function card(id: string): Card {
  return {
    id,
    name: id,
    rarityRaw: 'Common',
    bucket: '01_comum',
    collectionNumber: 1,
    imagePath: `assets/x/${id}.jpg`,
    imageUrl: `x/${id}.jpg`,
  };
}

function fighter(id: string, stats: Partial<BattleStats> = {}): Fighter {
  return toFighter(card(id), { hp: 100, type: 'Fire', attacks: [['Brasa', 30]], ...stats });
}

describe('movesFor', () => {
  it('usa o ataque mais fraco como comum e o mais forte como especial', () => {
    const { basic, special } = movesFor({ hp: 120, type: 'Fire', attacks: [['Fire Spin', 100], ['Scratch', 20]] });
    expect(basic).toMatchObject({ name: 'Scratch', damage: 20, special: false });
    expect(special).toMatchObject({ name: 'Fire Spin', damage: 100, special: true });
  });

  it('não cria especial quando a carta tem um ataque só', () => {
    const { basic, special } = movesFor({ hp: 60, type: 'Water', attacks: [['Bubble', 10]] });
    expect(basic.name).toBe('Bubble');
    expect(special).toBeNull();
  });

  it('dá o dano mínimo a ataques só de efeito e a cartas sem ataque', () => {
    expect(movesFor({ hp: 60, type: 'Grass', attacks: [['Sleep Powder', 0]] }).basic.damage).toBe(MIN_DAMAGE);
    expect(movesFor({ hp: 60, type: 'Grass', attacks: [] }).basic).toMatchObject({ name: 'Investida', damage: MIN_DAMAGE });
  });

  it('golpe mais forte recarrega mais devagar, dentro dos limites', () => {
    expect(basicCooldown(20)).toBeLessThan(basicCooldown(120));
    expect(basicCooldown(10)).toBeGreaterThanOrEqual(0.5);
    expect(basicCooldown(9999)).toBe(3);
    expect(specialCooldown(100)).toBeGreaterThan(basicCooldown(100));
    expect(specialCooldown(9999)).toBe(8);
  });
});

describe('hitFor', () => {
  const ember = movesFor({ hp: 60, type: 'Fire', attacks: [['Ember', 30]] }).basic;

  it('causa o dano impresso na carta', () => {
    expect(hitFor(ember, 'Fire', fighter('a', { type: 'Water' }))).toEqual({ amount: 30, superEffective: false });
  });

  it('bate mais forte na fraqueza do alvo, em múltiplos de 10', () => {
    const hit = hitFor(ember, 'Fire', fighter('a', { type: 'Grass', weak: 'Fire' }));
    expect(hit.superEffective).toBe(true);
    expect(hit.amount).toBe(50);
    expect(hit.amount % 10).toBe(0);
  });
});

describe('pickOpponents', () => {
  const team = [fighter('m1', { hp: 60 }), fighter('m2', { hp: 120 }), fighter('m3', { hp: 300 })];
  const pool = [
    ...team,
    ...[50, 60, 70, 110, 120, 130, 280, 300, 330, 30, 200].map((hp, i) => fighter(`p${i}`, { hp })),
  ];

  it('sorteia um adversário de HP parecido para cada carta, sem repetir nem usar as do jogador', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const foes = pickOpponents(mulberry32(seed), team, pool);
      expect(foes).toHaveLength(3);
      expect(new Set(foes.map((f) => f.card.id)).size).toBe(3);
      foes.forEach((foe, i) => {
        expect(foe.card.id.startsWith('p')).toBe(true);
        expect(foe.hp).toBeGreaterThanOrEqual(team[i]!.hp * 0.7);
        expect(foe.hp).toBeLessThanOrEqual(team[i]!.hp * 1.3);
      });
    }
  });

  it('é determinístico para a mesma seed', () => {
    const ids = (seed: number) => pickOpponents(mulberry32(seed), team, pool).map((f) => f.card.id);
    expect(ids(42)).toEqual(ids(42));
  });

  it('sem ninguém na faixa de HP, usa os mais próximos', () => {
    const far = [fighter('f1', { hp: 30 }), fighter('f2', { hp: 40 }), fighter('f3', { hp: 340 })];
    const near = fairCandidates(fighter('me', { hp: 150 }), far);
    expect(near.map((f) => f.card.id)).toEqual(['f2', 'f1', 'f3']);
  });

  it('devolve menos adversários quando o pool acaba', () => {
    expect(pickOpponents(mulberry32(1), team, [...team, fighter('only')])).toHaveLength(1);
  });
});
