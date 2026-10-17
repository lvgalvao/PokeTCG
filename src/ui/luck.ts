import { HIT_BOOST } from '../core/distributions.js';

/** Pull rate: 1 = real; os outros multiplicam a chance das cartas raras (ver boostHits). */
export const LUCK_OPTIONS = [1, 2, 3, 5, 10] as const;
export type Luck = (typeof LUCK_OPTIONS)[number];

const KEY = 'pkmn.luck';

export function luckLabel(luck: Luck): string {
  return luck === 1 ? 'Real' : `${luck}×`;
}

/** A escolha deste aparelho; sem nada salvo, o modo de sempre (HIT_BOOST). */
export function loadLuck(): Luck {
  try {
    const n = Number(localStorage.getItem(KEY));
    if ((LUCK_OPTIONS as readonly number[]).includes(n)) return n as Luck;
  } catch {
    // armazenamento bloqueado: usa o padrão
  }
  return HIT_BOOST as Luck;
}

export function saveLuck(luck: Luck): void {
  try {
    localStorage.setItem(KEY, String(luck));
  } catch {
    // armazenamento bloqueado: vale só nesta sessão
  }
}
