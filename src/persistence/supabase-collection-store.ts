import type { SupabaseClient } from '@supabase/supabase-js';
import type { Collection, CollectionStore, SetStats } from '../domain/collection.js';
import { EMPTY_COLLECTION } from '../domain/collection.js';

const TABLE = 'collections';

interface SerializedSetStats {
  boostersOpened: number;
  cardsOpened: number;
}

interface SerializedCollectionPayload {
  schemaVersion: 2;
  entries: Record<string, number>;
  bySet: Record<string, SerializedSetStats>;
}

function serialize(c: Collection): SerializedCollectionPayload {
  const entries: Record<string, number> = {};
  for (const [id, count] of c.entries) {
    if (Number.isInteger(count) && count > 0) entries[id] = count;
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
  return { schemaVersion: 2, entries, bySet };
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

async function ensureUser(client: SupabaseClient): Promise<string> {
  const session = await client.auth.getSession();
  let user = session.data.session?.user ?? null;
  if (!user) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
      throw new Error(`Supabase anonymous sign-in failed: ${error?.message ?? 'no user'}`);
    }
    user = data.user;
  }
  return user.id;
}

export async function createSupabaseCollectionStore(
  client: SupabaseClient,
): Promise<CollectionStore> {
  const userId = await ensureUser(client);
  const { data, error } = await client
    .from(TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase load failed: ${error.message}`);
  }
  let state: Collection = data?.data ? deserialize(data.data) : EMPTY_COLLECTION;

  let writeQueue: Promise<unknown> = Promise.resolve();
  function enqueueWrite(snapshot: Collection): void {
    const payload = serialize(snapshot);
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(async () => {
        const { error: writeError } = await client
          .from(TABLE)
          .upsert(
            { user_id: userId, data: payload, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );
        if (writeError) {
          console.error('[supabase] persist failed:', writeError.message);
        }
      });
  }

  function load(): Collection {
    return state;
  }

  function save(c: Collection): boolean {
    state = c;
    enqueueWrite(c);
    return true;
  }

  function addCards(cardIds: readonly string[], setId: string): Collection {
    const nextEntries = new Map(state.entries);
    for (const id of cardIds) {
      nextEntries.set(id, (nextEntries.get(id) ?? 0) + 1);
    }
    const nextBySet = new Map(state.bySet);
    const prev = nextBySet.get(setId) ?? { boostersOpened: 0, cardsOpened: 0 };
    nextBySet.set(setId, {
      boostersOpened: prev.boostersOpened + 1,
      cardsOpened: prev.cardsOpened + cardIds.length,
    });
    state = { schemaVersion: 2, entries: nextEntries, bySet: nextBySet };
    enqueueWrite(state);
    return state;
  }

  function clear(): void {
    state = EMPTY_COLLECTION;
    enqueueWrite(EMPTY_COLLECTION);
  }

  return {
    isAvailable: () => true,
    load,
    save,
    addCards,
    clear,
  };
}
