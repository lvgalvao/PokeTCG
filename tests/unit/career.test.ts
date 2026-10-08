import { describe, expect, it } from 'vitest';
import {
  applyPack,
  applySale,
  claimDailyBonus,
  claimMission,
  DAILY_BONUS,
  duplicatesOf,
  ensureMissions,
  effectiveRank,
  exhibitionFame,
  exhibitionSlots,
  fameLevel,
  InsufficientFundsError,
  MISSION_KINDS,
  missionsForDay,
  netWorth,
  newCareer,
  reviveCareer,
  SELL_RATE,
  STARTING_WALLET,
  toggleExhibit,
  type GameContext,
  type PulledCard,
} from '../../src/game/career.js';

const ctx: GameContext = {
  eras: ['sv', 'wotc'],
  sets: [
    { id: 'sv1', era: 'sv', albumSize: 4, subsets: [] },
    { id: 'base1', era: 'wotc', albumSize: 3, subsets: [] },
  ],
};
const now = new Date('2026-10-08T12:00:00Z');
const DAY = '2026-10-08';

const card = (id: string, rank: number, valueCents: number, extra: Partial<PulledCard> = {}): PulledCard => ({
  id,
  rank,
  valueCents,
  ...extra,
});

describe('carteira e pacotes', () => {
  it('começa com a carteira inicial', () => {
    expect(newCareer().walletCents).toBe(STARTING_WALLET);
  });

  it('cobra o pacote, guarda as cartas e calcula lucro', () => {
    const s0 = ensureMissions(newCareer(), DAY, ctx.eras);
    const { state, result } = applyPack(s0, ctx, 'sv1', 25_00, [card('sv1-1', 1, 10), card('sv1-2', 4, 40_00)], now);
    const rewards = result.unlocked.reduce((a, u) => a + u.rewardCents, 0);
    expect(state.walletCents).toBe(STARTING_WALLET - 25_00 + rewards);
    expect(result.valueCents).toBe(40_10);
    expect(result.profitCents).toBe(15_10);
    expect(state.collection).toEqual({ 'sv1-1': 1, 'sv1-2': 1 });
    expect(result.newCardIds).toEqual(['sv1-1', 'sv1-2']);
    expect(state.achievements['first-pack']).toBeDefined();
    expect(state.achievements['first-hit']).toBeDefined();
  });

  it('não deixa abrir sem saldo', () => {
    const poor = { ...newCareer(), walletCents: 10_00 };
    expect(() => applyPack(poor, ctx, 'sv1', 25_00, [], now)).toThrow(InsufficientFundsError);
  });

  it('Energia só-de-pacote não entra no fichário', () => {
    const { state } = applyPack(newCareer(), ctx, 'sv1', 1_00, [card('sve-1', 1, 0, { packOnly: true })], now);
    expect(state.collection).toEqual({});
  });

  it('holo de coleção da WOTC desbloqueia "Holo de 1999"', () => {
    const { state } = applyPack(newCareer(), ctx, 'base1', 1_00, [card('base1-4', 3, 500_00, { rarityRaw: 'Rare Holo' })], now);
    expect(state.achievements['vintage-holo']).toBeDefined();
  });
});

describe('venda', () => {
  it('vende repetidas com taxa e mantém uma cópia', () => {
    let s = newCareer();
    for (let i = 0; i < 3; i++) s = applyPack(s, ctx, 'sv1', 0, [card('sv1-1', 1, 10_00)], now).state;
    const dups = duplicatesOf(s, ['sv1-1']);
    expect(dups).toEqual(['sv1-1', 'sv1-1']);
    const before = s.walletCents;
    const sale = applySale(s, ctx, dups, () => 10_00, now);
    expect(sale.state.collection['sv1-1']).toBe(1);
    expect(sale.earnedCents).toBe(Math.round(10_00 * SELL_RATE) * 2);
    expect(sale.state.walletCents).toBe(before + sale.earnedCents);
  });

  it('vender a última cópia tira a carta da exposição', () => {
    let s = applyPack(newCareer(), ctx, 'sv1', 0, [card('sv1-1', 1, 1)], now).state;
    s = toggleExhibit(s, ctx, 'sv1-1', now);
    expect(s.exhibition).toEqual(['sv1-1']);
    s = applySale(s, ctx, ['sv1-1'], () => 1, now).state;
    expect(s.exhibition).toEqual([]);
  });
});

describe('exposição', () => {
  it('libera espaços pelo nível e só aceita cartas que você tem', () => {
    let s = newCareer();
    const ids = Array.from({ length: 8 }, (_, i) => `sv1-${i + 1}`);
    s = applyPack(s, ctx, 'sv1', 0, ids.map((id) => card(id, 1, 1)), now).state;
    expect(toggleExhibit(s, ctx, 'sv1-99', now).exhibition).toEqual([]);
    const slots = exhibitionSlots(s.fame);
    for (const id of ids) s = toggleExhibit(s, ctx, id, now);
    expect(s.exhibition).toHaveLength(slots);
    expect(s.achievements.curator).toBeDefined();
    expect(exhibitionSlots(0)).toBe(3);
    expect(exhibitionSlots(500)).toBe(6);
    expect(exhibitionSlots(2_000)).toBe(9);
  });

  it('cartas expostas rendem fama junto com o bônus do dia', () => {
    expect(exhibitionFame([1, 4, 7])).toBe(0 + 2 + 15);
    const s = claimDailyBonus(newCareer(), DAY, 17);
    expect(s.fame).toBe(17);
  });
});

describe('bônus diário e patrimônio', () => {
  it('bônus só uma vez por dia', () => {
    const s1 = claimDailyBonus(newCareer(), DAY);
    expect(s1.walletCents).toBe(STARTING_WALLET + DAILY_BONUS);
    expect(claimDailyBonus(s1, DAY)).toBe(s1);
    expect(claimDailyBonus(s1, '2026-10-09').walletCents).toBe(STARTING_WALLET + 2 * DAILY_BONUS);
  });

  it('voltar o relógio não paga o bônus nem renova missões', () => {
    const s = claimDailyBonus(newCareer(), '2026-10-09');
    expect(claimDailyBonus(s, DAY)).toBe(s);
    const m = ensureMissions(newCareer(), '2026-10-09', ctx.eras);
    expect(ensureMissions(m, DAY, ctx.eras)).toBe(m);
    expect(ensureMissions(m, '2026-10-10', ctx.eras).missions.day).toBe('2026-10-10');
  });

  it('patrimônio soma carteira e cartas', () => {
    const s = applyPack(newCareer(), ctx, 'sv1', 0, [card('sv1-1', 1, 5_00)], now).state;
    expect(netWorth(s, () => 5_00)).toBe(s.walletCents + 5_00);
  });

  it('estado salvo sobrevive ao JSON', () => {
    const s = applyPack(newCareer(), ctx, 'sv1', 1_00, [card('sv1-1', 1, 5_00)], now).state;
    expect(reviveCareer(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(reviveCareer(JSON.parse(JSON.stringify(newCareer())))).toEqual(newCareer());
  });
});

describe('fama', () => {
  it('holo vintage conta como Dupla Rara; abrir pacote caro rende fama', () => {
    expect(effectiveRank(3, 'Rare Holo', 'wotc')).toBe(4);
    expect(effectiveRank(3, 'Rare Holo', 'sv')).toBe(3);
    const { result } = applyPack(newCareer(), ctx, 'sv1', 100_00, [card('sv1-1', 1, 0)], now);
    expect(result.fameGained).toBeGreaterThanOrEqual(5);
  });

  it('sobe de nível nos limites', () => {
    expect(fameLevel(0).title).toBe('Novato');
    expect(fameLevel(49).level).toBe(1);
    expect(fameLevel(50).level).toBe(2);
    expect(fameLevel(1_000_000).next).toBeNull();
  });
});

describe('missões', () => {
  it('são determinísticas por dia, distintas entre si e válidas', () => {
    const a = missionsForDay(DAY, ctx.eras);
    expect(missionsForDay(DAY, ctx.eras)).toEqual(a);
    expect(new Set(a.map((m) => m.kind)).size).toBe(3);
    for (const m of a) {
      expect(m.goal).toBeGreaterThan(0);
      expect(m.rewardCents).toBeGreaterThan(0);
    }
  });

  it('progresso e resgate: missão "abra N pacotes"', () => {
    // Procura um dia cuja lista tenha a missão de pacotes.
    let day = '';
    for (let d = 1; d <= 60 && !day; d++) {
      const iso = `2026-11-${String((d % 28) + 1).padStart(2, '0')}`;
      if (missionsForDay(iso, ctx.eras).some((m) => m.kind === 'packs')) day = iso;
    }
    const idx = missionsForDay(day, ctx.eras).findIndex((m) => m.kind === 'packs');
    const goal = missionsForDay(day, ctx.eras)[idx]!.goal;
    let s = ensureMissions(newCareer(), day, ctx.eras);
    for (let i = 0; i < goal; i++) s = applyPack(s, ctx, 'sv1', 0, [card(`sv1-${i}`, 1, 0)], now).state;
    expect(s.missions.items[idx]!.progress).toBe(goal);
    const claimed = claimMission(s, ctx, idx, now);
    expect(claimed.walletCents).toBeGreaterThan(s.walletCents);
    expect(claimMission(claimed, ctx, idx, now)).toBe(claimed);
  });

  /**
   * Princípio III: sorteio das missões. Em 6.000 dias, cada tipo deve aparecer em ~3/6 = 50%
   * dos dias (3 de 6 tipos por dia). Tolerância de ±3 p.p. (≈6σ com N=6.000).
   */
  it('cada tipo aparece em ~50% dos dias', () => {
    const counts = Object.fromEntries(MISSION_KINDS.map((k) => [k, 0])) as Record<string, number>;
    const N = 6000;
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < N; i++) {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      for (const m of missionsForDay(day, ctx.eras)) counts[m.kind]!++;
    }
    for (const k of MISSION_KINDS) expect(Math.abs(counts[k]! / N - 0.5)).toBeLessThan(0.03);
  });
});
