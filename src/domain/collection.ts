export interface SetStats {
  readonly boostersOpened: number;
  readonly cardsOpened: number;
}

export interface Collection {
  readonly schemaVersion: 2;
  readonly entries: ReadonlyMap<string, number>;
  readonly bySet: ReadonlyMap<string, SetStats>;
}

export interface CollectionStore {
  isAvailable(): boolean;
  load(): Collection;
  save(c: Collection): boolean;
  addCards(cardIds: readonly string[], setId: string): Collection;
  clear(): void;
}

export const EMPTY_COLLECTION: Collection = {
  schemaVersion: 2,
  entries: new Map(),
  bySet: new Map(),
};
