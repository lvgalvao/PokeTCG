import type { RNG } from '../core/rng.js';
import type { Card } from '../domain/card.js';

/** Números de batalha de uma carta, como saem de `assets/<set>/battle.json`. */
export interface BattleStats {
  readonly hp: number;
  readonly type: string;
  readonly weak?: string;
  /** `[nome, dano]` de cada ataque impresso na carta (dano 0 = ataque só de efeito). */
  readonly attacks: readonly (readonly [string, number])[];
}

export interface Move {
  readonly name: string;
  readonly damage: number;
  /** Segundos até poder usar de novo. */
  readonly cooldown: number;
  readonly special: boolean;
}

/** Uma carta pronta para lutar: HP e ataques são os impressos nela. */
export interface Fighter {
  readonly card: Card;
  readonly hp: number;
  readonly type: string;
  readonly weak: string | null;
  readonly basic: Move;
  /** O ataque mais forte da carta, quando ela tem dois ataques de danos diferentes. */
  readonly special: Move | null;
}

/** Dano de um ataque que na carta só tem efeito (ou de uma carta sem ataques). */
export const MIN_DAMAGE = 10;
/** Fraqueza: o golpe do tipo certo bate mais forte. */
export const WEAKNESS_MULTIPLIER = 1.5;

/** Golpe forte demora mais: 30 de dano ≈ 0,7 s; 100 ≈ 1,3 s; 300 ≈ 3 s. */
export function basicCooldown(damage: number): number {
  return Math.min(3, Math.max(0.5, 0.45 + damage / 120));
}

/** O especial bate mais e por isso recarrega bem mais devagar que o ataque comum. */
export function specialCooldown(damage: number): number {
  return Math.min(8, 2.5 + damage / 60);
}

export function movesFor(stats: BattleStats): { basic: Move; special: Move | null } {
  const attacks = stats.attacks
    .map(([name, damage]) => ({ name, damage: Math.max(MIN_DAMAGE, damage) }))
    .sort((a, b) => a.damage - b.damage);
  const weakest = attacks[0] ?? { name: 'Investida', damage: MIN_DAMAGE };
  const strongest = attacks[attacks.length - 1] ?? weakest;
  const basic: Move = { ...weakest, cooldown: basicCooldown(weakest.damage), special: false };
  const special: Move | null =
    strongest.damage > weakest.damage
      ? { ...strongest, cooldown: specialCooldown(strongest.damage), special: true }
      : null;
  return { basic, special };
}

export function toFighter(card: Card, stats: BattleStats): Fighter {
  return { card, hp: stats.hp, type: stats.type, weak: stats.weak ?? null, ...movesFor(stats) };
}

export interface Hit {
  readonly amount: number;
  readonly superEffective: boolean;
}

/** Dano de um golpe: o da carta, maior se o tipo do atacante é a fraqueza do alvo. */
export function hitFor(move: Move, attackerType: string, defender: Fighter): Hit {
  const superEffective = defender.weak === attackerType;
  const raw = superEffective ? move.damage * WEAKNESS_MULTIPLIER : move.damage;
  return { amount: Math.round(raw / 10) * 10, superEffective };
}

/** Faixa de HP em que um adversário é considerado páreo para a carta do jogador. */
export const FAIR_HP_BAND = 0.3;

/** Adversários à altura de `mine`: HP dentro da faixa; sem ninguém na faixa, os 10 mais próximos. */
export function fairCandidates(mine: Fighter, pool: readonly Fighter[]): Fighter[] {
  const lo = mine.hp * (1 - FAIR_HP_BAND);
  const hi = mine.hp * (1 + FAIR_HP_BAND);
  const inBand = pool.filter((f) => f.hp >= lo && f.hp <= hi);
  if (inBand.length) return inBand;
  return [...pool].sort((a, b) => Math.abs(a.hp - mine.hp) - Math.abs(b.hp - mine.hp)).slice(0, 10);
}

/**
 * Sorteia o time adversário: para cada carta do jogador, uma carta de HP parecido, com
 * chance igual entre as candidatas, sem repetir e sem usar as cartas do próprio jogador.
 */
export function pickOpponents(rng: RNG, team: readonly Fighter[], pool: readonly Fighter[]): Fighter[] {
  const taken = new Set(team.map((f) => f.card.id));
  const picked: Fighter[] = [];
  for (const mine of team) {
    const candidates = fairCandidates(
      mine,
      pool.filter((f) => !taken.has(f.card.id)),
    );
    if (!candidates.length) break;
    const choice = candidates[Math.floor(rng.next() * candidates.length)]!;
    taken.add(choice.card.id);
    picked.push(choice);
  }
  return picked;
}
