import type { Collection, CollectionStore } from '../domain/collection.js';
import { EMPTY_COLLECTION } from '../domain/collection.js';

const DEFAULT_KEY = 'pkmn-booster:collection:v1';
const PROBE_KEY = 'pkmn-booster:probe';

interface SerializedCollection {
  schemaVersion: number;
  entries: Record<string, number>;
}

function serialize(c: Collection): string {
  const entries: Record<string, number> = {};
  for (const [id, count] of c.entries) {
    if (Number.isInteger(count) && count > 0) {
      entries[id] = count;
    }
  }
  return JSON.stringify({ schemaVersion: c.schemaVersion, entries });
}

function deserialize(raw: string): Collection {
  const data = JSON.parse(raw) as SerializedCollection;
  const entries = new Map<string, number>();
  if (data && typeof data === 'object' && data.entries) {
    for (const [id, count] of Object.entries(data.entries)) {
      if (typeof count === 'number' && Number.isInteger(count) && count > 0) {
        entries.set(id, count);
      }
    }
  }
  return { schemaVersion: 1, entries };
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

  function addCards(cardIds: readonly string[]): Collection {
    const current = load();
    const next = new Map(current.entries);
    for (const id of cardIds) {
      next.set(id, (next.get(id) ?? 0) + 1);
    }
    const updated: Collection = { schemaVersion: 1, entries: next };
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
