import type { Bucket } from '../core/buckets.js';

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly rarityRaw: string;
  readonly bucket: Bucket;
  readonly collectionNumber: number;
  /** Caminho lógico armazenado no manifest, sempre prefixado por `assets/`. */
  readonly imagePath: string;
  /**
   * URL runtime servida pelo Vite (publicDir é mapeado para `/`), ou seja,
   * `imagePath` sem o prefixo `assets/`. Usar em `<img src=...>`.
   */
  readonly imageUrl: string;
}
