# Contract: Booster Engine

**Module**: `src/core/booster.ts`
**Public function**: `generateBooster(rng: RNG, catalog: Catalog, seed: number): Booster`

## Inputs

| Parâmetro | Tipo | Restrições |
|-----------|------|-----------|
| `rng`     | `RNG`     | MUST ser determinístico para uma seed dada. |
| `catalog` | `Catalog` | MUST ter `byBucket['01_comum'].length >= 1` (caso contrário, o engine LANÇA `EmptyBaseBucketError`, FR-014a). |
| `seed`    | `number`  | Inteiro de 32 bits. Apenas ecoado em `Booster.seed` para reprodução; o RNG já chega seedado. |

## Output: `Booster`

Forma definida em `data-model.md §6`. Resumo:

```ts
{
  slots: [BoosterSlot × 6],
  seed,
  generatedAt,
  downgrades: Array<{ slot, from, to }>
}
```

## Invariantes (testadas em `tests/unit/booster.test.ts` e `tests/statistical/`)

### I1 — Tamanho fixo
`booster.slots.length === 6` sempre.

### I2 — Unicidade por id (FR-008, Q2)
`new Set(booster.slots.map(s => s.card.id)).size === 6`. **Mesma carta nunca aparece duas vezes**, mesmo que slots diferentes apontem para o mesmo bucket.

### I3 — Slots fixos (FR-009)
Para `i ∈ {1,2,3,4}`: `slots[i-1].drawnBucket === '01_comum'` e `effectiveBucket === '01_comum'` (sem downgrade — slots 1–4 não têm fallback).

### I4 — Distribuição do slot 5 (FR-010)
`slots[4].drawnBucket ∈ {'02_incomum', '03_raras'}`. Sobre N boosters com seed variada, a frequência relativa converge para `{ '02_incomum': 0.90, '03_raras': 0.10 }` com tolerância ±1 p.p. para N=10.000 (SC-002).

### I5 — Distribuição do slot 6 (FR-011)
`slots[5].drawnBucket ∈ {'03_raras', '04_duplo_raras', '05_arte_secreta', '06_duplo_arte_secreta', '07_legendaria'}`. Frequência relativa converge para `{ rara: 0.60, dupla: 0.25, arte: 0.10, dupla_arte: 0.045, legendaria: 0.005 }` com tolerância ±1 p.p. para N=10.000 (SC-002) **e** chi-quadrado de aderência aceito a α=0,01.

### I6 — Ordem por raridade (FR-015)
Para todo `i < j`: `bucketRank(slots[i].effectiveBucket) <= bucketRank(slots[j].effectiveBucket)`. Slots com mesmo bucket mantêm a ordem em que foram sorteados (estável).

### I7 — Downgrade com piso (FR-014a)
Se o bucket sorteado pela distribuição está vazio em `catalog.byBucket`, o engine aplica downgrade na sequência `07 → 06 → 05 → 04 → 03 → 02 → 01`, parando no piso do slot:
- Slot 6: piso `03_raras`. Se `03_raras` está vazio também, lança `EmptyMandatorySlotError`.
- Slot 5: piso `02_incomum`. Se `02_incomum` está vazio, lança `EmptyMandatorySlotError`.
- Slots 1–4: sem fallback — se `01_comum` está vazio, lança `EmptyBaseBucketError` (validado já na entrada).

Cada downgrade aplicado MUST aparecer em `booster.downgrades`. Boosters sem downgrade têm `downgrades.length === 0`.

### I8 — Determinismo
Para a mesma `seed` e o mesmo `catalog` (mesmas cartas, mesmos buckets), `generateBooster` retorna **exatamente o mesmo** `Booster` (mesmas cartas, mesma ordem). Validado em `tests/unit/booster.test.ts` por igualdade estrutural.

### I9 — Não-repetição cross-slot
A unicidade I2 vale **mesmo quando dois slots compartilham o bucket** (ex.: slot 5 cai em Rara e slot 6 também cai em Rara). O engine MUST escolher cartas distintas dentro do mesmo bucket via amostragem sem reposição local ao booster.

## Erros públicos

| Classe | Quando |
|--------|--------|
| `EmptyBaseBucketError` | `catalog.byBucket['01_comum']` vazio na entrada. |
| `EmptyMandatorySlotError` | Após cadeia de downgrades, slot 5 ou 6 ainda sem bucket disponível (acima do piso). |
| `InsufficientCardsError` | Bucket tem cartas, mas após excluir as já usadas no booster, restam zero — e nenhum bucket de downgrade tem carta nova. |

Erros são exceções típicas, não retorno. UI captura e mostra mensagem amigável (FR-025-style).

## Não-objetivos

- O engine **não** persiste o booster gerado.
- O engine **não** atualiza a coleção do jogador — isso é responsabilidade do orquestrador (`src/ui/app.ts`) após a revelação.
- O engine **não** depende de DOM, fetch, nem timers — é função pura sobre `RNG` e `Catalog`.
