import type { Collection, CollectionStore, SetStats } from '../domain/collection.js';
import { EMPTY_COLLECTION } from '../domain/collection.js';

const DEFAULT_KEY = 'pkmn-booster:collection:v1';
const PROBE_KEY = 'pkmn-booster:probe';

interface SerializedSetStats {
  boostersOpened: number;
  cardsOpened: number;
}

interface SerializedCollectionV2 {
  schemaVersion: 2;
  entries: Record<string, number>;
  bySet: Record<string, SerializedSetStats>;
}

function serialize(c: Collection): string {
  const entries: Record<string, number> = {};
  for (const [id, count] of c.entries) {
    if (Number.isInteger(count) && count > 0) {
      entries[id] = count;
    }
  }
  const bySet: Record<string, SerializedSetStats> = {};
  for (const [setId, stats] of c.bySet) {
    if (
      Number.isInteger(stats.boostersOpened) &&
      Number.isInteger(stats.cardsOpened) &&
      (stats.boostersOpened > 0 || stats.cardsOpened > 0)
    ) {
      bySet[setId] = {
        boostersOpened: stats.boostersOpened,
        cardsOpened: stats.cardsOpened,
      };
    }
  }
  const out: SerializedCollectionV2 = { schemaVersion: 2, entries, bySet };
  return JSON.stringify(out);
}

function deserialize(raw: string): Collection {
  const data = JSON.parse(raw) as unknown;
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

export function createLocalStorageCollectionStore(
  key: string = DEFAULT_KEY,
  storage?: Storage,
): CollectionStore {
  const ls = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);

  let availabilityCache: boolean | undefined;

  function probe(): boolean {
    if (!ls) return false;
    try {
      ls.setItem(PROBE_KEY, '1');
      const got = ls.getItem(PROBE_KEY);
      ls.removeItem(PROBE_KEY);
      return got === '1';
    } catch {
      return false;
    }
  }

  function ensureAvailable(): boolean {
    if (availabilityCache === undefined) {
      availabilityCache = probe();
    }
    return availabilityCache;
  }

  function load(): Collection {
    if (!ensureAvailable() || !ls) return EMPTY_COLLECTION;
    const raw = ls.getItem(key);
    if (!raw) return EMPTY_COLLECTION;
    try {
      return deserialize(raw);
    } catch {
      try {
        const backupKey = `${key}:backup-${Date.now()}`;
        ls.setItem(backupKey, raw);
      } catch {
        /* ignore */
      }
      return EMPTY_COLLECTION;
    }
  }

  function save(c: Collection): boolean {
    if (!ensureAvailable() || !ls) return false;
    try {
      ls.setItem(key, serialize(c));
      return true;
    } catch {
      availabilityCache = false;
      return false;
    }
  }

  function addCards(cardIds: readonly string[], setId: string): Collection {
    const current = load();
    const nextEntries = new Map(current.entries);
    for (const id of cardIds) {
      nextEntries.set(id, (nextEntries.get(id) ?? 0) + 1);
    }
    const nextBySet = new Map(current.bySet);
    const prev = nextBySet.get(setId) ?? { boostersOpened: 0, cardsOpened: 0 };
    nextBySet.set(setId, {
      boostersOpened: prev.boostersOpened + 1,
      cardsOpened: prev.cardsOpened + cardIds.length,
    });
    const updated: Collection = {
      schemaVersion: 2,
      entries: nextEntries,
      bySet: nextBySet,
    };
    save(updated);
    return updated;
  }

  function clear(): void {
    if (!ensureAvailable() || !ls) return;
    try {
      ls.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  return {
    isAvailable: ensureAvailable,
    load,
    save,
    addCards,
    clear,
  };
}
