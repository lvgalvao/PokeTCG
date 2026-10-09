import type { Collection, CollectionStore, SetStats } from '../domain/collection.js';
import { EMPTY_COLLECTION } from '../domain/collection.js';
import type { FamilyApi, PlayerId } from './family-api.js';

/** Quem está jogando neste aparelho. Guardado só aqui (localStorage). */
export interface PlayerSession {
  readonly player: PlayerId;
  readonly pin: string;
}

const SESSION_KEY = 'pkmn-booster:player:v1';

export function loadSession(): PlayerSession | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<PlayerSession> | null;
    if (raw && (raw.player === 'p1' || raw.player === 'p2') && typeof raw.pin === 'string') {
      return { player: raw.player, pin: raw.pin };
    }
  } catch {
    /* sem sessão */
  }
  return null;
}

export function saveSession(s: PlayerSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* sem localStorage: vale só nesta aba */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nada a limpar */
  }
}

function deserialize(data: unknown): Collection {
  const entries = new Map<string, number>();
  const bySet = new Map<string, SetStats>();
  if (data && typeof data === 'object') {
    const obj = data as { entries?: unknown; bySet?: unknown };
    if (obj.entries && typeof obj.entries === 'object') {
      for (const [id, count] of Object.entries(obj.entries as Record<string, unknown>)) {
        if (typeof count === 'number' && Number.isInteger(count) && count > 0) {
          entries.set(id, count);
        }
      }
    }
    if (obj.bySet && typeof obj.bySet === 'object') {
      for (const [setId, stats] of Object.entries(obj.bySet as Record<string, unknown>)) {
        if (stats && typeof stats === 'object') {
          const s = stats as { boostersOpened?: unknown; cardsOpened?: unknown };
          if (
            typeof s.boostersOpened === 'number' &&
            typeof s.cardsOpened === 'number' &&
            Number.isInteger(s.boostersOpened) &&
            Number.isInteger(s.cardsOpened) &&
            s.boostersOpened >= 0 &&
            s.cardsOpened >= 0
          ) {
            bySet.set(setId, {
              boostersOpened: s.boostersOpened,
              cardsOpened: s.cardsOpened,
            });
          }
        }
      }
    }
  }
  return { schemaVersion: 2, entries, bySet };
}

/** Fichário que também pode recarregar do servidor (depois de uma troca, por exemplo). */
export interface FamilyCollectionStore extends CollectionStore {
  refresh(): Promise<Collection>;
}

/**
 * Fichário do jogador no Supabase. A leitura é síncrona (estado em memória); cada pacote
 * aberto soma as cartas no servidor, que é quem decide a contagem — assim uma troca aceita
 * no outro aparelho nunca é sobrescrita.
 */
export async function createFamilyStore(api: FamilyApi, session: PlayerSession): Promise<FamilyCollectionStore> {
  let state = deserialize(await api.load(session.pin, session.player));
  let queue: Promise<unknown> = Promise.resolve();
  let failed = false;
  const enqueue = (op: () => Promise<void>) => {
    queue = queue.then(op).catch((err: unknown) => {
      failed = true;
      console.error('[família] falha ao salvar no servidor:', err);
    });
  };

  return {
    isAvailable: () => !failed,
    load: () => state,
    save: (c) => {
      state = c;
      return true;
    },
    addCards: (ids, setId) => {
      const entries = new Map(state.entries);
      for (const id of ids) entries.set(id, (entries.get(id) ?? 0) + 1);
      const bySet = new Map(state.bySet);
      const prev = bySet.get(setId) ?? { boostersOpened: 0, cardsOpened: 0 };
      bySet.set(setId, { boostersOpened: prev.boostersOpened + 1, cardsOpened: prev.cardsOpened + ids.length });
      state = { schemaVersion: 2, entries, bySet };
      enqueue(() => api.addCards(session.pin, session.player, ids, setId));
      return state;
    },
    clear: () => {
      state = EMPTY_COLLECTION;
      enqueue(() => api.clear(session.pin, session.player));
    },
    refresh: async () => {
      await queue;
      state = deserialize(await api.load(session.pin, session.player));
      failed = false;
      return state;
    },
  };
}

export { deserialize as deserializeCollection };
