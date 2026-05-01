# Contract: Collection Store

**Module**: `src/persistence/collection-store.ts`
**Interface**: `CollectionStore`
**Default implementation**: `createLocalStorageCollectionStore(key?: string): CollectionStore`

## Surface (TypeScript)

```ts
interface CollectionStore {
  isAvailable(): boolean;
  load(): Collection;
  save(c: Collection): boolean;
  addCards(cardIds: readonly string[]): Collection;
  clear(): void;
}
```

## Storage layout (LocalStorage)

- **Key**: `pkmn-booster:collection:v1` (configurable via parâmetro opcional do factory).
- **Value** (JSON serializado):
  ```json
  {
    "schemaVersion": 1,
    "entries": { "<cardId>": <count>, ... }
  }
  ```

## Behavior contract

### isAvailable

- Retorna `true` se uma sequência `setItem` + `getItem` + `removeItem` em uma chave de probe (`pkmn-booster:probe`) executa sem lançar exceção e sem retornar `null` no `getItem`.
- Cacheia o resultado por instância (não re-faz probe a cada chamada).
- Retorna `false` em: privacy mode com LocalStorage desabilitado, quota atingida, environments não-browser (Node.js no caminho de testes não browser-like — usar adapter).

### load

- Se `isAvailable() === false` ou a key não existe, retorna `{ schemaVersion: 1, entries: new Map() }`.
- Se o JSON existe mas está corrompido (parse falha) ou `schemaVersion` é desconhecido (futuro), faz fallback para estado vazio **e** preserva o conteúdo original em uma key backup `pkmn-booster:collection:backup-<timestamp>` antes de prosseguir.
- Se `schemaVersion: 0` (futuro hipotético), aplica `migrateV0toV1` antes de retornar; persiste o resultado migrado de volta.
- Counts ≤ 0 ou não-inteiros encontrados em entries são descartados silenciosamente em `load()` (defensivo).

### save

- No-op silencioso se `isAvailable() === false`. Retorna `false`.
- Caso contrário, serializa `{ schemaVersion, entries: Object.fromEntries(map) }` e persiste. Retorna `true`.
- Entradas com `count <= 0` são removidas durante a serialização.
- Se `setItem` lançar `QuotaExceededError`, captura, marca a instância como `isAvailable() === false` daqui em diante e retorna `false`. UI MUST consultar `isAvailable()` após `save()` falso para decidir mostrar o banner (FR-025).

### addCards

- Recebe array de cardIds (pode conter duplicatas). Carrega o estado atual (via `load()` se cache miss), incrementa `entries[cardId]` em 1 para cada ocorrência no array.
- Persiste via `save()` e retorna a `Collection` atualizada.
- Se `save()` retorna `false`, ainda devolve a `Collection` em memória — a UI atualiza a vista, e o banner de "progresso não salvo" é exibido.

### clear

- Remove a key principal do LocalStorage. Não toca nas backups.
- Caller é responsável por confirmar com o usuário (FR-023). `clear()` não pergunta.
- Após `clear()`, `load()` retorna estado vazio.

## Invariantes

| ID | Regra |
|----|-------|
| C1 | `entries` nunca contém valores ≤ 0 nem não-inteiros após `save()`. |
| C2 | Idempotência: chamar `addCards([])` retorna a coleção inalterada. |
| C3 | Comutatividade aproximada: `addCards([a, b])` resulta no mesmo estado que `addCards([a]); addCards([b])` quando `a !== b`. |
| C4 | Acumulação: `addCards([x, x])` incrementa o count de `x` em 2. |
| C5 | Persistência: `save(c); load()` retorna `c` (modulo entries com count 0 que foram filtradas). |
| C6 | Resiliência a corrupção: dados inválidos no LocalStorage não derrubam o app. |

## Substitubilidade (Princípio II)

`CollectionStore` é interface. O Princípio II exige que a camada seja substituível. Plano de troca para IndexedDB no futuro:

1. Implementar `createIndexedDbCollectionStore()` retornando o mesmo shape (com versões assíncronas internamente, mas a API pública pode ser `Promise`-ificada em uma interface `CollectionStoreAsync` paralela).
2. Migração: na primeira execução pós-troca, `load()` da nova implementação detecta a key v1 do LocalStorage, migra para IndexedDB, deleta a key antiga.

Esse plano não é escopo desta feature — é só prova de que o desenho honra o princípio.

## Testes (`tests/unit/collection-store.test.ts`)

- Mocka `localStorage` via `happy-dom` ou stub global.
- Cobre: load vazio, save+load round-trip, addCards (acumulação e idempotência), clear, indisponibilidade (probe falha), corrupção, migração futura (smoke).
