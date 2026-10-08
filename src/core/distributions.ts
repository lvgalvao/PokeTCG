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
