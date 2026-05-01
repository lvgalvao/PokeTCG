import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorageCollectionStore } from '../../src/persistence/collection-store.js';
import { EMPTY_COLLECTION, type Collection } from '../../src/domain/collection.js';

class MemStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('LocalStorageCollectionStore', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('isAvailable() returns true when storage works', () => {
    const store = createLocalStorageCollectionStore('test-key', storage);
    expect(store.isAvailable()).toBe(true);
  });

  it('load() returns empty when nothing persisted', () => {
    const store = createLocalStorageCollectionStore('test-key', storage);
    const col = store.load();
    expect(col.schemaVersion).toBe(2);
    expect(col.entries.size).toBe(0);
    expect(col.bySet.size).toBe(0);
  });

  it('save() + load() round-trips the collection', () => {
    const store = createLocalStorageCollectionStore('test-key', storage);
    const c: Collection = {
      schemaVersion: 2,
      entries: new Map([
        ['sv3pt5-25', 4],
        ['sv3pt5-172', 1],
      ]),
      bySet: new Map([['sv3pt5', { boostersOpened: 3, cardsOpened: 18 }]]),
    };
    expect(store.save(c)).toBe(true);
    const loaded = store.load();
    expect(loaded.entries.get('sv3pt5-25')).toBe(4);
    expect(loaded.entries.get('sv3pt5-172')).toBe(1);
    expect(loaded.entries.size).toBe(2);
    expect(loaded.bySet.get('sv3pt5')).toEqual({ boostersOpened: 3, cardsOpened: 18 });
  });

  it('addCards() accumulates counts including duplicates within the same call', () => {
    const store = createLocalStorageCollectionStore('test-key', storage);
    store.addCards(['a', 'b', 'a'], 'sv3pt5');
    store.addCards(['a', 'c'], 'sv3pt5');
    const c = store.load();
    expect(c.entries.get('a')).toBe(3);
    expect(c.entries.get('b')).toBe(1);
    expect(c.entries.get('c')).toBe(1);
  });

  it('addCards() tracks boostersOpened and cardsOpened per set', () => {
    const store = createLocalStorageCollectionStore('test-key', storage);
    store.addCards(['a', 'b', 'c', 'd', 'e', 'f'], 'sv3pt5');
    store.addCards(['x', 'y', 'z', 'w', 'v', 'u'], 'sv3pt5');
    store.addCards(['p', 'q', 'r', 's', 't', 'a'], 'me1');
    const c = store.load();
    expect(c.bySet.get('sv3pt5')).toEqual({ boostersOpened: 2, cardsOpened: 12 });
    expect(c.bySet.get('me1')).toEqual({ boostersOpened: 1, cardsOpened: 6 });
  });

  it('migrates v1 payload (no bySet) to v2 by preserving entries', () => {
    storage.setItem(
      'test-key',
      JSON.stringify({ schemaVersion: 1, entries: { a: 2, b: 1 } }),
    );
    const store = createLocalStorageCollectionStore('test-key', storage);
    const loaded = store.load();
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.entries.get('a')).toBe(2);
    expect(loaded.entries.get('b')).toBe(1);
    expect(loaded.bySet.size).toBe(0);
  });

  it('save() drops entries with count <= 0', () => {
    const store = createLocalStorageCollectionStore('test-key', storage);
    const c: Collection = {
      schemaVersion: 2,
      entries: new Map([
        ['ok', 2],
        ['zero', 0],
        ['neg', -3],
      ]),
      bySet: new Map(),
    };
    store.save(c);
    const loaded = store.load();
    expect(loaded.entries.has('ok')).toBe(true);
    expect(loaded.entries.has('zero')).toBe(false);
    expect(loaded.entries.has('neg')).toBe(false);
  });

  it('clear() removes the persisted collection', () => {
    const store = createLocalStorageCollectionStore('test-key', storage);
    store.addCards(['a', 'b'], 'sv3pt5');
    store.clear();
    expect(store.load().entries.size).toBe(0);
    expect(store.load().bySet.size).toBe(0);
  });

  it('returns empty + isAvailable=false when storage throws on writes', () => {
    const broken: Storage = {
      length: 0,
      clear() {},
      getItem() {
        return null;
      },
      key() {
        return null;
      },
      removeItem() {},
      setItem() {
        throw new Error('quota');
      },
    };
    const store = createLocalStorageCollectionStore('test-key', broken);
    expect(store.isAvailable()).toBe(false);
    expect(store.load()).toEqual(EMPTY_COLLECTION);
    expect(
      store.save({
        schemaVersion: 2,
        entries: new Map([['a', 1]]),
        bySet: new Map(),
      }),
    ).toBe(false);
  });

  it('survives corrupted JSON without throwing', () => {
    storage.setItem('test-key', '{not valid json');
    const store = createLocalStorageCollectionStore('test-key', storage);
    const c = store.load();
    expect(c.entries.size).toBe(0);
  });

  afterEach(() => {
    storage.clear();
  });
});
