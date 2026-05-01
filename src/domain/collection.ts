export interface Collection {
  readonly schemaVersion: 1;
  readonly entries: ReadonlyMap<string, number>;
}

export interface CollectionStore {
  isAvailable(): boolean;
  load(): Collection;
  save(c: Collection): boolean;
  addCards(cardIds: readonly string[]): Collection;
  clear(): void;
}

export const EMPTY_COLLECTION: Collection = {
  schemaVersion: 1,
  entries: new Map(),
};
