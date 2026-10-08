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
  readonly slots: Readonly<Record<SlotIndex, readonly SlotOutcome[]>>;
  /** Exibe as cartas na ordem dos slots (ordem real do envelope) em vez de por raridade. */
  readonly keepOrder?: boolean;
}

export const SET_BOOSTER_PROFILES: Readonly<Record<string, BoosterProfile>> = {
  ...RESEARCHED_PROFILES,
  // 30th Celebration, na ordem real do envelope: 3 comuns (a 3ª pode ser hit: IR 1/5,2 ou
  // Classic Collection 1/9,8), slot de rara (DR 1/4, SIR 1/18, Futuristic 1/99, RGB ~1/1.000),
  // 1 Pikachu e 1 Energia básica foil no final. Amostra: 4.063 pacotes.
  me55: {
    keepOrder: true,
    slots: {
      1: [{ p: 1, rarities: ['Common'] }],
      2: [{ p: 1, rarities: ['Common'] }],
      3: [
        { p: 0.71, rarities: ['Common'] },
        { p: 0.19, rarities: ['Illustration Rare'] },
        { p: 0.1, subset: 'me55c' },
      ],
      4: [
        { p: 0.689, rarities: ['Rare'] },
        { p: 0.25, rarities: ['Double Rare'] },
        { p: 0.05, rarities: ['Special Illustration Rare'] },
        { p: 0.01, rarities: ['Futuristic Rare'] },
        // Os 3 Mew RGB (me55-R/G/B): ~1 em 1.000 pacotes.
        { p: 0.001, rarities: ['RGB Rare'] },
      ],
      5: [{ p: 1, rarities: ['Pikachu Rare'] }],
      6: [{ p: 1, subset: 'sve' }],
    },
  },
};
