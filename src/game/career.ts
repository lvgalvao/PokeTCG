import { mulberry32 } from '../core/rng.js';
import type { Cents } from './money.js';

/**
 * Modo Carreira: carteira em reais fictícios, pacotes ao preço de mercado, venda de cartas,
 * fama, missões diárias e conquistas. Tudo aqui é lógica pura (sem DOM nem storage), para ser
 * testável; a UI só chama estas funções e persiste o estado devolvido.
 */

export const STARTING_WALLET: Cents = 200_00;
/** ≈ 3 pacotes modernos por dia (simulação: nível 5 na primeira semana, nunca trava). */
export const DAILY_BONUS: Cents = 90_00;
/** Vender rende o valor de mercado menos as taxas de uma venda real. */
export const SELL_RATE = 0.85;
/** Máximo de espaços de exposição; o disponível cresce com o nível (ver exhibitionSlots). */
export const EXHIBITION_SLOTS = 9;
const HISTORY_SIZE = 30;

/** Fama por carta puxada, pela raridade (rank 1 = comum … 7 = lendária). */
const FAME_BY_RANK = [0, 0, 0, 1, 5, 10, 25, 60] as const;
const FAME_PER_NEW_CARD = 1;
/** Fama por abrir um pacote: 1 a cada R$ 20 do preço — abrir um vintage é um evento. */
const FAME_PER_PACK_CENTS = 20_00;
/** Fama diária de cada carta exposta, pela raridade (recebida junto com o bônus do dia). */
const EXHIBIT_FAME_BY_RANK = [0, 0, 0, 1, 2, 4, 8, 15] as const;
/** Eras com pacotes acessíveis no dia a dia (missões de era e "Viagem no tempo"). */
const MODERN_ERAS = ['mega', 'sv', 'swsh', 'sm', 'xy'] as const;
const MISSION_ERAS = ['mega', 'sv', 'swsh'] as const;
/** Holo das eras WOTC/e-Card/EX conta como Dupla Rara para fama e missões. */
const VINTAGE_ERAS = ['wotc', 'ex'];

export interface GameSet {
  readonly id: string;
  readonly era: string;
  readonly albumSize: number;
  /** Prefixos de id dos subsets do álbum (ex.: `me55c`). */
  readonly subsets: readonly string[];
}

export interface PackRecord {
  readonly setId: string;
  readonly at: string;
  readonly costCents: Cents;
  readonly valueCents: Cents;
  readonly bestCardId: string;
}

export interface MissionState {
  readonly id: string;
  readonly progress: number;
  readonly claimed: boolean;
}

export interface CareerState {
  readonly schemaVersion: 1;
  readonly walletCents: Cents;
  readonly fame: number;
  /** Cartas da Carreira (fichário próprio, separado do modo Livre). */
  readonly collection: Readonly<Record<string, number>>;
  readonly packsBySet: Readonly<Record<string, number>>;
  readonly stats: {
    readonly packsOpened: number;
    readonly spentCents: Cents;
    readonly pulledValueCents: Cents;
    readonly soldCents: Cents;
    readonly cardsSold: number;
    readonly rewardsCents: Cents;
    readonly bestProfitCents: Cents;
  };
  readonly achievements: Readonly<Record<string, string>>;
  readonly missions: { readonly day: string; readonly items: readonly MissionState[] };
  readonly lastBonusDay: string | null;
  readonly exhibition: readonly string[];
  readonly history: readonly PackRecord[];
}

export function newCareer(): CareerState {
  return {
    schemaVersion: 1,
    walletCents: STARTING_WALLET,
    fame: 0,
    collection: {},
    packsBySet: {},
    stats: {
      packsOpened: 0,
      spentCents: 0,
      pulledValueCents: 0,
      soldCents: 0,
      cardsSold: 0,
      rewardsCents: 0,
      // Sentinela serializável (JSON não guarda -Infinity).
      bestProfitCents: Number.MIN_SAFE_INTEGER,
    },
    achievements: {},
    missions: { day: '', items: [] },
    lastBonusDay: null,
    exhibition: [],
    history: [],
  };
}

// ── Fama ────────────────────────────────────────────────────────────────────────────

export const FAME_LEVELS: ReadonlyArray<{ readonly min: number; readonly title: string }> = [
  { min: 0, title: 'Novato' },
  { min: 50, title: 'Treinador' },
  { min: 150, title: 'Colecionador' },
  { min: 300, title: 'Caçador de holos' },
  { min: 500, title: 'Especialista' },
  { min: 1_000, title: 'Líder de Ginásio' },
  { min: 2_000, title: 'Elite Four' },
  { min: 4_000, title: 'Campeão' },
  { min: 8_000, title: 'Lenda' },
];

export function fameLevel(fame: number): {
  readonly level: number;
  readonly title: string;
  readonly current: number;
  readonly next: number | null;
} {
  let i = 0;
  while (i + 1 < FAME_LEVELS.length && fame >= FAME_LEVELS[i + 1]!.min) i++;
  return {
    level: i + 1,
    title: FAME_LEVELS[i]!.title,
    current: FAME_LEVELS[i]!.min,
    next: FAME_LEVELS[i + 1]?.min ?? null,
  };
}

/** Espaços de exposição liberados pelo nível: 3, 6 no nível 4 e 9 no nível 7. */
export function exhibitionSlots(fame: number): number {
  const { level } = fameLevel(fame);
  return level >= 7 ? 9 : level >= 4 ? 6 : 3;
}

/** Fama que a exposição rende por dia, dados os ranks efetivos das cartas expostas. */
export function exhibitionFame(ranks: readonly number[]): number {
  return ranks.reduce((sum, r) => sum + (EXHIBIT_FAME_BY_RANK[r] ?? 0), 0);
}

/** Rank para fama e missões: holo vintage vale como Dupla Rara. */
export function effectiveRank(rank: number, rarityRaw: string | undefined, era: string | undefined): number {
  return era && VINTAGE_ERAS.includes(era) && /holo/i.test(rarityRaw ?? '') ? Math.max(rank, 4) : rank;
}

// ── Missões diárias ─────────────────────────────────────────────────────────────────

export type MissionKind = 'packs' | 'era-packs' | 'hit' | 'big-pull' | 'new-cards' | 'sell';

export interface Mission {
  readonly id: string;
  readonly kind: MissionKind;
  readonly title: string;
  readonly goal: number;
  readonly era?: string;
  readonly minRank?: number;
  readonly minValueCents?: Cents;
  readonly rewardCents: Cents;
  readonly rewardFame: number;
}

export const ERA_NAMES: Readonly<Record<string, string>> = {
  mega: 'Mega Evolution',
  sv: 'Scarlet & Violet',
  swsh: 'Sword & Shield',
  sm: 'Sun & Moon',
  xy: 'XY',
  ex: 'e-Card & EX',
  wotc: 'Wizards of the Coast',
};

const RANK_NAMES: Readonly<Record<number, string>> = {
  4: 'Dupla Rara',
  5: 'Arte Secreta',
  6: 'Dupla Arte Secreta',
};

/** Semente estável a partir do dia (FNV-1a): todo mundo vê as mesmas missões no mesmo dia. */
export function daySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const MISSION_KINDS: readonly MissionKind[] = ['packs', 'era-packs', 'hit', 'big-pull', 'new-cards', 'sell'];

/** Três missões distintas por dia, sorteadas deterministicamente pela data. */
export function missionsForDay(day: string, eras: readonly string[]): Mission[] {
  const rng = mulberry32(daySeed(day));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)]!;
  const kinds = [...MISSION_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  return kinds.slice(0, 3).map((kind, i): Mission => {
    const id = `${day}#${i}`;
    switch (kind) {
      case 'packs': {
        const goal = pick([2, 3, 4]);
        return { id, kind, goal, title: `Abra ${goal} pacotes`, rewardCents: goal * 8_00, rewardFame: goal * 8 };
      }
      case 'era-packs': {
        const pool = MISSION_ERAS.filter((e) => eras.includes(e));
        const era = pick(pool.length ? pool : eras);
        return {
          id, kind, era, goal: 2,
          title: `Abra 2 pacotes da era ${ERA_NAMES[era] ?? era}`,
          rewardCents: 20_00, rewardFame: 20,
        };
      }
      case 'hit': {
        const minRank = pick([4, 4, 5]);
        return {
          id, kind, minRank, goal: 1,
          title: `Puxe uma ${RANK_NAMES[minRank]} ou melhor`,
          rewardCents: minRank * 8_00, rewardFame: minRank * 8,
        };
      }
      case 'big-pull':
        return {
          id, kind, goal: 1, minValueCents: 15_00,
          title: 'Puxe uma carta que valha R$ 15 ou mais',
          rewardCents: 25_00, rewardFame: 25,
        };
      case 'new-cards': {
        const goal = pick([5, 10, 15]);
        return { id, kind, goal, title: `Guarde ${goal} cartas novas no fichário`, rewardCents: goal * 2_00, rewardFame: goal * 2 };
      }
      case 'sell': {
        const goal = pick([5, 10]);
        return { id, kind, goal, title: `Venda ${goal} cartas repetidas`, rewardCents: goal * 1_50, rewardFame: goal };
      }
    }
  });
}

/** Garante que o estado tem as missões de hoje (as de ontem expiram). */
export function ensureMissions(state: CareerState, day: string, eras: readonly string[]): CareerState {
  // Só avança: voltar o relógio do aparelho não renova (nem libera de novo) as missões.
  if (state.missions.day && day <= state.missions.day) return state;
  return {
    ...state,
    missions: {
      day,
      items: missionsForDay(day, eras).map((m) => ({ id: m.id, progress: 0, claimed: false })),
    },
  };
}

// ── Eventos ─────────────────────────────────────────────────────────────────────────

export interface PulledCard {
  readonly id: string;
  readonly rank: number;
  readonly valueCents: Cents;
  /** Raridade original da fonte (ex.: "Rare Holo"). */
  readonly rarityRaw?: string;
  /** Carta só-de-pacote (Energia básica): não entra no fichário. */
  readonly packOnly?: boolean;
}

export interface PackResult {
  readonly costCents: Cents;
  readonly valueCents: Cents;
  readonly profitCents: Cents;
  readonly fameGained: number;
  readonly newCardIds: readonly string[];
  readonly unlocked: readonly Achievement[];
}

type Progress = (m: Mission) => number;

function advanceMissions(state: CareerState, eras: readonly string[], progress: Progress): CareerState {
  const missions = missionsForDay(state.missions.day, eras);
  return {
    ...state,
    missions: {
      ...state.missions,
      items: state.missions.items.map((item, i) => {
        const m = missions[i];
        if (!m || item.claimed) return item;
        return { ...item, progress: Math.min(m.goal, item.progress + progress(m)) };
      }),
    },
  };
}

export class InsufficientFundsError extends Error {
  constructor(public readonly missingCents: Cents) {
    super('Saldo insuficiente');
    this.name = 'InsufficientFundsError';
  }
}

/** Paga o pacote, guarda as cartas, soma fama e avança missões e conquistas. */
export function applyPack(
  state: CareerState,
  ctx: GameContext,
  setId: string,
  priceCents: Cents,
  cards: readonly PulledCard[],
  now: Date,
): { state: CareerState; result: PackResult } {
  if (state.walletCents < priceCents) throw new InsufficientFundsError(priceCents - state.walletCents);
  const set = ctx.sets.find((s) => s.id === setId);
  const collection = { ...state.collection };
  const newCardIds: string[] = [];
  let valueCents = 0;
  let fame = Math.round(priceCents / FAME_PER_PACK_CENTS);
  const rankOf = (c: PulledCard) => effectiveRank(c.rank, c.rarityRaw, set?.era);
  for (const c of cards) {
    valueCents += c.valueCents;
    fame += FAME_BY_RANK[rankOf(c)] ?? 0;
    if (c.packOnly) continue;
    if (!collection[c.id]) {
      newCardIds.push(c.id);
      fame += FAME_PER_NEW_CARD;
    }
    collection[c.id] = (collection[c.id] ?? 0) + 1;
  }
  const profitCents = valueCents - priceCents;
  const best = [...cards].sort((a, b) => b.valueCents - a.valueCents)[0];
  let next: CareerState = {
    ...state,
    walletCents: state.walletCents - priceCents,
    fame: state.fame + fame,
    collection,
    packsBySet: { ...state.packsBySet, [setId]: (state.packsBySet[setId] ?? 0) + 1 },
    stats: {
      ...state.stats,
      packsOpened: state.stats.packsOpened + 1,
      spentCents: state.stats.spentCents + priceCents,
      pulledValueCents: state.stats.pulledValueCents + valueCents,
      bestProfitCents: Math.max(state.stats.bestProfitCents, profitCents),
    },
    history: [
      { setId, at: now.toISOString(), costCents: priceCents, valueCents, bestCardId: best?.id ?? '' },
      ...state.history,
    ].slice(0, HISTORY_SIZE),
  };
  const bestRank = Math.max(0, ...cards.map(rankOf));
  const bestValue = Math.max(0, ...cards.map((c) => c.valueCents));
  next = advanceMissions(next, ctx.eras, (m) => {
    switch (m.kind) {
      case 'packs':
        return 1;
      case 'era-packs':
        return set?.era === m.era ? 1 : 0;
      case 'hit':
        return bestRank >= (m.minRank ?? 99) ? 1 : 0;
      case 'big-pull':
        return bestValue >= (m.minValueCents ?? Infinity) ? 1 : 0;
      case 'new-cards':
        return newCardIds.length;
      default:
        return 0;
    }
  });
  const unlocked = newAchievements(next, ctx, { lastPack: { setId, cards, profitCents } });
  next = grantAchievements(next, unlocked, now);
  return {
    state: next,
    result: {
      costCents: priceCents,
      valueCents,
      profitCents,
      fameGained: fame + unlocked.reduce((a, u) => a + u.fame, 0),
      newCardIds,
      unlocked,
    },
  };
}

/** Vende cópias pelo valor de mercado menos taxas. `ids` pode repetir para vender várias. */
export function applySale(
  state: CareerState,
  ctx: GameContext,
  ids: readonly string[],
  valueOf: (id: string) => Cents,
  now: Date,
): { state: CareerState; earnedCents: Cents; unlocked: readonly Achievement[] } {
  const collection = { ...state.collection };
  let earned = 0;
  let sold = 0;
  for (const id of ids) {
    if (!collection[id]) continue;
    collection[id]! -= 1;
    if (collection[id] === 0) delete collection[id];
    earned += Math.round(valueOf(id) * SELL_RATE);
    sold++;
  }
  let next: CareerState = {
    ...state,
    walletCents: state.walletCents + earned,
    collection,
    exhibition: state.exhibition.filter((id) => collection[id]),
    stats: { ...state.stats, soldCents: state.stats.soldCents + earned, cardsSold: state.stats.cardsSold + sold },
  };
  next = advanceMissions(next, ctx.eras, (m) => (m.kind === 'sell' ? sold : 0));
  const unlocked = newAchievements(next, ctx, {});
  return { state: grantAchievements(next, unlocked, now), earnedCents: earned, unlocked };
}

/** Cópias excedentes (mantém 1 de cada) de um conjunto de cartas. */
export function duplicatesOf(state: CareerState, cardIds: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of cardIds) {
    for (let n = (state.collection[id] ?? 0) - 1; n > 0; n--) out.push(id);
  }
  return out;
}

export function claimMission(state: CareerState, ctx: GameContext, index: number, now: Date): CareerState {
  const item = state.missions.items[index];
  const mission = missionsForDay(state.missions.day, ctx.eras)[index];
  if (!item || !mission || item.claimed || item.progress < mission.goal) return state;
  const items = state.missions.items.map((m, i) => (i === index ? { ...m, claimed: true } : m));
  const next: CareerState = {
    ...state,
    walletCents: state.walletCents + mission.rewardCents,
    fame: state.fame + mission.rewardFame,
    missions: { ...state.missions, items },
    stats: { ...state.stats, rewardsCents: state.stats.rewardsCents + mission.rewardCents },
  };
  return grantAchievements(next, newAchievements(next, ctx, {}), now);
}

/** Uma vez por dia, e só para frente (mudar a data do aparelho não paga de novo). */
export function canClaimBonus(state: CareerState, day: string): boolean {
  return state.lastBonusDay === null || day > state.lastBonusDay;
}

/** Bônus do dia + a fama que a exposição rendeu (`exhibitFame`, de exhibitionFame). */
export function claimDailyBonus(state: CareerState, day: string, exhibitFame = 0): CareerState {
  if (!canClaimBonus(state, day)) return state;
  return {
    ...state,
    walletCents: state.walletCents + DAILY_BONUS,
    fame: state.fame + exhibitFame,
    lastBonusDay: day,
    stats: { ...state.stats, rewardsCents: state.stats.rewardsCents + DAILY_BONUS },
  };
}

export function toggleExhibit(state: CareerState, ctx: GameContext, cardId: string, now: Date): CareerState {
  if (state.exhibition.includes(cardId)) {
    return { ...state, exhibition: state.exhibition.filter((id) => id !== cardId) };
  }
  if (!state.collection[cardId] || state.exhibition.length >= exhibitionSlots(state.fame)) return state;
  const next = { ...state, exhibition: [...state.exhibition, cardId] };
  return grantAchievements(next, newAchievements(next, ctx, {}), now);
}

/** Patrimônio = carteira + valor de mercado das cartas guardadas. */
export function netWorth(state: CareerState, valueOf: (id: string) => Cents | undefined): Cents {
  let total = state.walletCents;
  for (const [id, n] of Object.entries(state.collection)) total += (valueOf(id) ?? 0) * n;
  return total;
}

// ── Conquistas ──────────────────────────────────────────────────────────────────────

export interface GameContext {
  readonly sets: readonly GameSet[];
  readonly eras: readonly string[];
  /** Valor conhecido de uma carta (para conquistas de patrimônio); pode ser parcial. */
  readonly cardValue?: (id: string) => Cents | undefined;
}

interface AchievementEvent {
  readonly lastPack?: { readonly setId: string; readonly cards: readonly PulledCard[]; readonly profitCents: Cents };
}

export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly fame: number;
  readonly rewardCents: Cents;
  readonly test: (s: CareerState, ctx: GameContext, ev: AchievementEvent) => boolean;
  /** Para conquistas de contagem: [atual, meta]. */
  readonly progress?: (s: CareerState) => readonly [number, number];
}

function ownedInSet(s: CareerState, set: GameSet): number {
  const prefixes = [set.id, ...set.subsets].map((p) => `${p}-`);
  return Object.keys(s.collection).filter((id) => prefixes.some((p) => id.startsWith(p))).length;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-pack', title: 'Primeiro pacote', description: 'Abra seu primeiro pacote.', fame: 5, rewardCents: 0,
    test: (s) => s.stats.packsOpened >= 1 },
  { id: 'packs-10', title: 'Freguês', description: 'Abra 10 pacotes.', fame: 20, rewardCents: 20_00,
    progress: (s) => [Math.min(s.stats.packsOpened, 10), 10],
    test: (s) => s.stats.packsOpened >= 10 },
  { id: 'packs-100', title: 'Cliente da casa', description: 'Abra 100 pacotes.', fame: 150, rewardCents: 100_00,
    progress: (s) => [Math.min(s.stats.packsOpened, 100), 100],
    test: (s) => s.stats.packsOpened >= 100 },
  { id: 'packs-500', title: 'Dono da loja', description: 'Abra 500 pacotes.', fame: 600, rewardCents: 300_00,
    progress: (s) => [Math.min(s.stats.packsOpened, 500), 500],
    test: (s) => s.stats.packsOpened >= 500 },
  { id: 'first-hit', title: 'Brilhou!', description: 'Puxe uma Dupla Rara ou melhor.', fame: 15, rewardCents: 10_00,
    test: (_s, _c, ev) => !!ev.lastPack?.cards.some((c) => c.rank >= 4) },
  { id: 'secret-art', title: 'Obra de arte', description: 'Puxe uma Dupla Arte Secreta ou melhor.', fame: 60, rewardCents: 30_00,
    test: (_s, _c, ev) => !!ev.lastPack?.cards.some((c) => c.rank >= 6) },
  { id: 'legend', title: 'Lendário', description: 'Puxe uma carta Lendária.', fame: 200, rewardCents: 80_00,
    test: (_s, _c, ev) => !!ev.lastPack?.cards.some((c) => c.rank >= 7) },
  { id: 'vintage-holo', title: 'Holo de 1999', description: 'Puxe uma holo de uma coleção da Wizards of the Coast.', fame: 80, rewardCents: 0,
    test: (_s, ctx, ev) =>
      !!ev.lastPack &&
      ctx.sets.find((x) => x.id === ev.lastPack!.setId)?.era === 'wotc' &&
      ev.lastPack.cards.some((c) => /holo/i.test(c.rarityRaw ?? '')),
  },
  { id: 'profit-50', title: 'Bom negócio', description: 'Lucre R$ 50 em um único pacote.', fame: 40, rewardCents: 0,
    test: (s) => s.stats.bestProfitCents >= 50_00 },
  { id: 'profit-500', title: 'Bilhete premiado', description: 'Lucre R$ 500 em um único pacote.', fame: 250, rewardCents: 0,
    test: (s) => s.stats.bestProfitCents >= 500_00 },
  { id: 'seller-20', title: 'Comerciante', description: 'Venda 20 cartas.', fame: 30, rewardCents: 0,
    progress: (s) => [Math.min(s.stats.cardsSold, 20), 20],
    test: (s) => s.stats.cardsSold >= 20 },
  { id: 'seller-200', title: 'Banca na feira', description: 'Venda 200 cartas.', fame: 150, rewardCents: 0,
    progress: (s) => [Math.min(s.stats.cardsSold, 200), 200],
    test: (s) => s.stats.cardsSold >= 200 },
  { id: 'curator', title: 'Curador', description: 'Preencha todos os espaços de exposição do seu nível.', fame: 20, rewardCents: 0,
    test: (s) => s.exhibition.length >= exhibitionSlots(s.fame) },
  { id: 'half-set', title: 'Meio caminho', description: 'Tenha metade de uma coleção.', fame: 100, rewardCents: 50_00,
    test: (s, ctx) => ctx.sets.some((set) => ownedInSet(s, set) * 2 >= set.albumSize) },
  { id: 'full-set', title: 'Mestre da coleção', description: 'Complete uma coleção inteira.', fame: 1_000, rewardCents: 500_00,
    test: (s, ctx) => ctx.sets.some((set) => ownedInSet(s, set) >= set.albumSize) },
  { id: 'era-tour', title: 'Viagem no tempo', description: 'Abra um pacote de cada era moderna, de XY a Mega Evolution.', fame: 120, rewardCents: 60_00,
    test: (s, ctx) =>
      MODERN_ERAS.filter((era) => ctx.eras.includes(era)).every((era) =>
        ctx.sets.some((set) => set.era === era && (s.packsBySet[set.id] ?? 0) > 0)) },
  { id: 'thirty-sets', title: '30 anos', description: 'Abra pacotes de 30 coleções diferentes.', fame: 300, rewardCents: 150_00,
    progress: (s) => [Math.min(Object.keys(s.packsBySet).length, 30), 30],
    test: (s) => Object.keys(s.packsBySet).length >= 30 },
  { id: 'rich', title: 'Patrimônio de respeito', description: 'Chegue a R$ 2.000 de patrimônio.', fame: 200, rewardCents: 0,
    test: (s, ctx) => !!ctx.cardValue && netWorth(s, ctx.cardValue) >= 2_000_00 },
];

function newAchievements(s: CareerState, ctx: GameContext, ev: AchievementEvent): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && a.test(s, ctx, ev));
}

function grantAchievements(s: CareerState, list: readonly Achievement[], now: Date): CareerState {
  if (!list.length) return s;
  const achievements = { ...s.achievements };
  let wallet = s.walletCents;
  let fame = s.fame;
  let rewards = s.stats.rewardsCents;
  for (const a of list) {
    achievements[a.id] = now.toISOString();
    wallet += a.rewardCents;
    rewards += a.rewardCents;
    fame += a.fame;
  }
  return { ...s, achievements, walletCents: wallet, fame, stats: { ...s.stats, rewardsCents: rewards } };
}

/** Garante campos novos em estados salvos por versões anteriores. */
export function reviveCareer(raw: unknown): CareerState {
  const base = newCareer();
  if (!raw || typeof raw !== 'object' || (raw as CareerState).schemaVersion !== 1) return base;
  const s = raw as CareerState;
  return { ...base, ...s, stats: { ...base.stats, ...s.stats } };
}
