# Data Model — Abridor de Boosters Pokémon TCG

**Feature**: 001-pokemon-booster-opener
**Phase**: 1 (Design)
**Date**: 2026-05-01
**Source**: tipos derivados das entidades em `spec.md` + decisões de `research.md`.

Os tipos abaixo são em pseudo-TypeScript e refletem a forma como serão expostos pelos módulos em `src/`. Tipos de runtime (validação) são responsabilidade do consumidor (ex.: `loadCatalog` valida o JSON contra o schema do contrato).

---

## 1. Bucket (`src/core/buckets.ts`)

```ts
export const BUCKETS = [
  '01_comum',
  '02_incomum',
  '03_raras',
  '04_duplo_raras',
  '05_arte_secreta',
  '06_duplo_arte_secreta',
  '07_legendaria',
] as const;

export type Bucket = typeof BUCKETS[number];

/** Índice numérico crescente (1 = mais comum, 7 = mais rara). */
export function bucketRank(b: Bucket): number;

/** Próximo bucket inferior na ordem de raridade, ou null se já é '01_comum'. */
export function bucketDowngrade(b: Bucket): Bucket | null;
```

**Invariantes**:
- `BUCKETS` é a única fonte da ordem canônica de raridade. Não duplicar em outros módulos.
- Comparações de raridade fazem sempre via `bucketRank`, nunca por ordem alfabética dos identificadores.

---

## 2. Card (`src/domain/card.ts`)

```ts
export interface Card {
  /** Identificador estável da fonte (ex.: "sv3pt5-25"). Chave de identidade (Q2 da clarificação). */
  readonly id: string;

  /** Nome do Pokémon como vem da fonte (ex.: "Pikachu"). Não é chave. */
  readonly name: string;

  /** String literal da raridade-fonte (ex.: "Illustration Rare"). Para diagnóstico. */
  readonly rarityRaw: string;

  /** Bucket local mapeado a partir de rarityRaw. */
  readonly bucket: Bucket;

  /** Número da coleção no set (ex.: 25 para Pikachu no set 151). Inteiro positivo. */
  readonly collectionNumber: number;

  /** Caminho relativo do JPG sob assets/ (ex.: "assets/05_arte_secreta/sv3pt5-172.jpg"). */
  readonly imagePath: string;
}
```

**Validation rules** (aplicadas em `loadCatalog`):
- `id` MUST ser não-vazio.
- `bucket` MUST ser um dos valores de `BUCKETS`.
- `collectionNumber` MUST ser inteiro ≥ 1.
- `imagePath` MUST começar com `assets/` + `bucket/` (caminhos divergentes são rejeitados).

---

## 3. Catalog (`src/domain/catalog.ts`)

```ts
export interface Catalog {
  /** Todas as cartas conhecidas do set, ordenadas por collectionNumber. */
  readonly cards: readonly Card[];

  /** Index por id, para lookup O(1). */
  readonly byId: ReadonlyMap<string, Card>;

  /** Index por bucket, para sorteio. */
  readonly byBucket: Readonly<Record<Bucket, readonly Card[]>>;

  /** Total de cartas únicas no set inteiro. */
  readonly totalSet: number;

  /** Total por bucket (consumido por FR-021a — contadores de progresso). */
  readonly totalsByBucket: Readonly<Record<Bucket, number>>;
}

export async function loadCatalog(manifestUrl: string): Promise<Catalog>;
```

**Invariantes**:
- `byId.size === cards.length` (sem duplicatas).
- Para cada bucket B, `byBucket[B]` contém exatamente as cartas com `card.bucket === B`.
- `totalSet === sum(totalsByBucket)`.
- `cards` MUST estar ordenado por `collectionNumber` ascendente (consumido pela vista álbum, FR-021).

---

## 4. SlotDistribution (`src/core/distributions.ts`)

```ts
/** Mapa de bucket → probabilidade no intervalo [0, 1]. Chaves omitidas equivalem a 0. */
export type BucketDistribution = Partial<Record<Bucket, number>>;

/** Indexado de 1 a 6 (slot 1-based como na spec). */
export type SlotIndex = 1 | 2 | 3 | 4 | 5 | 6;

/** Configuração canônica — única fonte da verdade (FR-011 exige um ponto único). */
export const SLOT_DISTRIBUTIONS: Readonly<Record<SlotIndex, BucketDistribution>> = {
  1: { '01_comum': 1.0 },
  2: { '01_comum': 1.0 },
  3: { '01_comum': 1.0 },
  4: { '01_comum': 1.0 },
  5: { '02_incomum': 0.90, '03_raras': 0.10 },
  6: {
    '03_raras': 0.60,
    '04_duplo_raras': 0.25,
    '05_arte_secreta': 0.10,
    '06_duplo_arte_secreta': 0.045,
    '07_legendaria': 0.005,
  },
};

/** Piso de downgrade por slot (FR-014a). null = sem fallback (slots 1–4). */
export const SLOT_DOWNGRADE_FLOOR: Readonly<Record<SlotIndex, Bucket | null>> = {
  1: null, 2: null, 3: null, 4: null,
  5: '02_incomum',
  6: '03_raras',
};
```

**Invariantes** (validadas em `tests/unit/distributions.test.ts`):
- Para cada slot, `sum(values) === 1.0` com tolerância 1e-9.
- Probabilidades são todas ≥ 0.

---

## 5. RNG (`src/core/rng.ts`)

```ts
export interface RNG {
  /** Próximo valor pseudo-aleatório em [0, 1). Determinístico dado o estado interno. */
  next(): number;
}

/** Cria um RNG Mulberry32 a partir de uma seed inteira (32 bits). */
export function mulberry32(seed: number): RNG;

/** Cria seed automática (timestamp + Math.random) quando não fornecida. */
export function autoSeed(): number;
```

**Invariantes**:
- Para a mesma seed, duas instâncias produzem **exatamente** a mesma sequência.
- `next()` retorna valor em [0, 1) — testado.

---

## 6. Booster (`src/core/booster.ts`)

```ts
export interface BoosterSlot {
  /** Posição 1..6 dentro do booster, ordenada por raridade crescente. */
  readonly slotIndex: SlotIndex;

  /** Bucket teoricamente sorteado pela distribuição (antes do downgrade). */
  readonly drawnBucket: Bucket;

  /** Bucket de onde a carta veio efetivamente (após downgrade, se aplicável). */
  readonly effectiveBucket: Bucket;

  /** Carta que ocupou o slot. */
  readonly card: Card;
}

export interface Booster {
  readonly slots: readonly [BoosterSlot, BoosterSlot, BoosterSlot, BoosterSlot, BoosterSlot, BoosterSlot];
  readonly seed: number;        // seed inicial usada — para reprodução de bug reports
  readonly generatedAt: number; // epoch ms
  readonly downgrades: ReadonlyArray<{ slot: SlotIndex; from: Bucket; to: Bucket }>; // FR-014b
}

export function generateBooster(rng: RNG, catalog: Catalog, seed: number): Booster;
```

**Invariantes** (testadas em `tests/unit/booster.test.ts` — contrato em `contracts/booster-engine.md`):
- `slots.length === 6`.
- `new Set(slots.map(s => s.card.id)).size === 6` — sem repetição por id (FR-008, Q2).
- `slots[i].slotIndex === i + 1`.
- `slots[i].effectiveBucket` ordenado por `bucketRank` ascendente entre slots adjacentes (FR-015).
- Slots 1–4: `drawnBucket === '01_comum'` (FR-009).
- Downgrades respeitam o piso por slot (FR-014a).
- `seed` é o que foi recebido; `rng` é avançado em sequência determinística.

---

## 7. Collection (`src/persistence/collection-store.ts`)

```ts
export interface CollectionEntry {
  readonly cardId: string;
  readonly count: number; // ≥ 1
}

export interface Collection {
  readonly schemaVersion: 1;
  readonly entries: ReadonlyMap<string, number>; // cardId → count
}

export interface CollectionStore {
  /** True se o backing store está disponível (não bloqueado, com quota). */
  isAvailable(): boolean;

  /** Carrega a coleção persistida ou retorna estado vazio. Aplica migrações se necessário. */
  load(): Collection;

  /** Salva a coleção. No-op se isAvailable() === false. Retorna true se persistiu. */
  save(c: Collection): boolean;

  /** Atomicamente incrementa as contagens das cartas dadas em 1 cada (com idempotência por cardId duplicado no array). */
  addCards(cardIds: readonly string[]): Collection;

  /** Apaga toda a coleção do backing store. Exige que o caller já tenha confirmado com o usuário. */
  clear(): void;
}

export function createLocalStorageCollectionStore(key?: string): CollectionStore;
```

**Storage layout**:
- Key: `pkmn-booster:collection:v1`
- Value (JSON):
  ```json
  {
    "schemaVersion": 1,
    "entries": { "sv3pt5-25": 4, "sv3pt5-172": 1 }
  }
  ```

**State transitions**:
1. **Initial**: nenhum dado salvo → `load()` retorna `{ schemaVersion: 1, entries: new Map() }`.
2. **After booster**: `addCards(boosterCardIds)` → entries incrementadas → `save()` persiste.
3. **Schema migration** (futura): se ler `schemaVersion: 0` → migra para 1 → re-save antes de retornar. Nunca destrói dados ausentes do schema novo.
4. **Clear**: `clear()` apaga a key. `load()` subsequente retorna estado inicial.
5. **Unavailable**: `isAvailable()` falso → `save()` é no-op silencioso, `load()` retorna estado vazio, UI mostra banner (FR-025).

**Validation rules**:
- `count` armazenado MUST ser ≥ 1; entradas com count 0 são removidas em `save()`.
- Card IDs desconhecidos pelo catálogo são preservados em `load()` mas a UI só renderiza os que cruzam com o catálogo atual (defensivo contra trocas de set futuras).

---

## 8. Manifest (artefato em `assets/manifest.json`)

Schema completo em `contracts/manifest.schema.json`. Forma:

```json
{
  "setId": "sv3pt5",
  "setName": "Scarlet & Violet—151",
  "generatedAt": "2026-05-01T12:34:56Z",
  "downloaderVersion": "0.1.0",
  "totalSet": 207,
  "cards": [
    {
      "id": "sv3pt5-25",
      "name": "Pikachu",
      "rarityRaw": "Common",
      "bucket": "01_comum",
      "collectionNumber": 25,
      "imagePath": "assets/01_comum/sv3pt5-25.jpg"
    }
  ],
  "totalsByBucket": {
    "01_comum": 41,
    "02_incomum": 22,
    "03_raras": 14,
    "04_duplo_raras": 17,
    "05_arte_secreta": 13,
    "06_duplo_arte_secreta": 9,
    "07_legendaria": 4
  },
  "unmapped": [
    { "id": "sv3pt5-???", "name": "Carta X", "rarityRaw": "Some New Rarity" }
  ]
}
```

**Notas**:
- `totalsByBucket` é redundante com `cards` mas pré-computado para evitar varredura no client em runtime.
- `unmapped` lista cartas cuja raridade não bate com a tabela do FR-003 — não são incluídas em `cards`, mas ficam visíveis para o operador atualizar o mapeamento.
- `downloaderVersion` permite ao client detectar incompatibilidades e exibir aviso ao operador.

---

## 9. UI Models (efêmeros, não persistidos)

```ts
/** Estado de revelação progressiva do booster atual. */
export interface BoosterRevealState {
  readonly booster: Booster;
  readonly revealedCount: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly skipped: boolean;
}

/** Filtro ativo na seção Coleção. */
export type CollectionFilter = 'all' | Bucket;

/** Vista da coleção computada a partir de Catalog + Collection + filter. */
export interface CollectionView {
  readonly slots: ReadonlyArray<{
    readonly card: Card;
    readonly count: number; // 0 se não puxada
  }>;
  readonly progress: {
    readonly owned: number;
    readonly total: number;
    readonly byBucket: Readonly<Record<Bucket, { owned: number; total: number }>>;
  };
}

export function buildCollectionView(catalog: Catalog, collection: Collection, filter: CollectionFilter): CollectionView;
```

`BoosterRevealState` e `CollectionView` são puros (sem identidade persistente). Calculados a cada render — SC-009 (<200 ms para 1.000 entradas) é folgado dado o tamanho do dataset.
