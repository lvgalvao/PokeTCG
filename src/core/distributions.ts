import { RESEARCHED_PROFILES } from './set-profiles.js';
import type { Bucket } from './buckets.js';

export type BucketDistribution = Partial<Record<Bucket, number>>;

export type SlotIndex = 1 | 2 | 3 | 4 | 5 | 6;

export const SLOT_INDICES: readonly SlotIndex[] = [1, 2, 3, 4, 5, 6] as const;

export const SLOT_DISTRIBUTIONS: Readonly<Record<SlotIndex, BucketDistribution>> = {
  1: { '01_comum': 1.0 },
  2: { '01_comum': 1.0 },
  3: { '02_incomum': 1.0 },
  4: { '02_incomum': 0.7, '03_raras': 0.3 },
  5: {
    '03_raras': 0.6,
    '04_duplo_raras': 0.25,
    '05_arte_secreta': 0.1,
    '06_duplo_arte_secreta': 0.045,
    '07_legendaria': 0.005,
  },
  6: {
    '03_raras': 0.6,
    '04_duplo_raras': 0.25,
    '05_arte_secreta': 0.1,
    '06_duplo_arte_secreta': 0.045,
    '07_legendaria': 0.005,
  },
};

export const SLOT_DOWNGRADE_FLOOR: Readonly<Record<SlotIndex, Bucket | null>> = {
  1: null,
  2: null,
  3: null,
  4: '02_incomum',
  5: '03_raras',
  6: '03_raras',
};

/**
 * Resultado possível de um slot num perfil por set: cartas do `subset` (set principal, se
 * omitido) filtradas por `rarities` (rarityRaw da fonte, sem diferenciar maiúsculas) ou,
 * na ausência delas, por `bucket`. Sem nenhum dos dois, vale qualquer carta do subset.
 */
export interface SlotOutcome {
  readonly p: number;
  readonly bucket?: Bucket;
  readonly rarities?: readonly string[];
  readonly subset?: string;
}

/**
 * Estrutura de pacote própria de um set, substituindo SLOT_DISTRIBUTIONS. O primeiro
 * resultado de cada slot é o fallback quando o resultado sorteado está esgotado.
 */
export interface BoosterProfile {
  /** Um item por carta do pacote real em inglês, na ordem do envelope. */
  readonly slots: readonly (readonly SlotOutcome[])[];
  /** Exibe as cartas na ordem dos slots (ordem real do envelope) em vez de por raridade. */
  readonly keepOrder?: boolean;
}

export const SET_BOOSTER_PROFILES: Readonly<Record<string, BoosterProfile>> = {
  ...RESEARCHED_PROFILES,
};

/** Quantas vezes mais as cartas raras saem do que nos pull rates reais (modo família). */
export const HIT_BOOST = 5;

/** Rank mínimo de um hit: Rara ou melhor (Holo, Dupla Rara/ex, IR, SAR, Secretas, Clássicas…). */
export const HIT_MIN_RANK = 3;

/**
 * Multiplica por `luck` a chance dos "hits" de um slot: os resultados de rank HIT_MIN_RANK ou
 * maior que não são o primeiro do slot (o primeiro é a carta normal daquela posição — num
 * slot de Rara, a Rara comum; os hits são Holo, ex, SAR…). Os demais encolhem na mesma
 * proporção. Se os hits não cabem (luck × soma > 1), o slot vira só hits, mantendo a
 * proporção entre eles. `ranks[i]` é o rank (1–7) do resultado i; 0 = sem cartas.
 */
export function boostHits(ps: readonly number[], ranks: readonly number[], luck: number): number[] {
  if (luck === 1) return [...ps];
  const isHit = ranks.map((r, i) => i > 0 && r >= HIT_MIN_RANK);
  const total = ps.reduce((a, p) => a + p, 0);
  const hits = ps.reduce((a, p, i) => a + (isHit[i] ? p : 0), 0);
  if (hits === 0 || hits === total) return [...ps];
  const boosted = Math.min(total, hits * luck);
  const hitScale = boosted / hits;
  const restScale = (total - boosted) / (total - hits);
  return ps.map((p, i) => p * (isHit[i] ? hitScale : restScale));
}

/**
 * Tabelas do modo família escritas à mão para sets em que o HIT_BOOST genérico desequilibra
 * (no 30 Anos, a Clássica e a IR disputam o mesmo slot, e as ex engolem a SAR). Com luck > 1
 * o gerador usa a tabela daqui no lugar de aplicar boostHits ao perfil real.
 */
export const FAMILY_PROFILES: Readonly<Record<string, BoosterProfile>> = {
  me55: {
    keepOrder: true,
    slots: [
      [{ p: 1, rarities: ['Common'] }],
      [{ p: 1, rarities: ['Common'] }],
      [
        { p: 0.45, rarities: ['Common'] },
        { p: 0.4, rarities: ['Illustration Rare'] },
        // Clássica: ~1 a cada 7 pacotes (real: 1 a cada 10).
        { p: 0.15, subset: 'me55c' },
      ],
      [
        { p: 0.25, rarities: ['Rare'] },
        { p: 0.42, rarities: ['Double Rare'] },
        // SAR: ~1 a cada 3–4 pacotes (real: 1 a cada 20).
        { p: 0.28, rarities: ['Special Illustration Rare'] },
        { p: 0.04, rarities: ['Futuristic Rare'] },
        { p: 0.01, rarities: ['RGB Rare'] },
      ],
      [{ p: 1, rarities: ['Pikachu Rare'] }],
      [{ p: 1, subset: 'sve' }],
    ],
  },
};
