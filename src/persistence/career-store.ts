import type { Collection } from '../domain/collection.js';
import { newCareer, reviveCareer, type CareerState } from '../game/career.js';

const CAREER_KEY = 'pkmn-career-v1';
const MODE_KEY = 'pkmn-mode';

export type GameMode = 'free' | 'career';

/** A Carreira vive só no navegador (localStorage), separada do fichário do modo Livre. */
export function loadCareer(): CareerState {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    return raw ? reviveCareer(JSON.parse(raw)) : newCareer();
  } catch {
    return newCareer();
  }
}

export function saveCareer(state: CareerState): boolean {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function resetCareer(): CareerState {
  const fresh = newCareer();
  saveCareer(fresh);
  return fresh;
}

export function loadMode(): GameMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'career' ? 'career' : 'free';
  } catch {
    return 'free';
  }
}

export function saveMode(mode: GameMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* sem storage: o modo vale só nesta sessão */
  }
}

/** Visão da Carreira no formato que a loja e o fichário já entendem. */
export function careerCollection(state: CareerState): Collection {
  return {
    schemaVersion: 2,
    entries: new Map(Object.entries(state.collection)),
    bySet: new Map(
      Object.entries(state.packsBySet).map(([id, n]) => [id, { boostersOpened: n, cardsOpened: 0 }]),
    ),
  };
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
