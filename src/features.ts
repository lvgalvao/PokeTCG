/**
 * Feature flags. Desligadas por padrão; para ligar num build, defina a variável de ambiente
 * correspondente como "true" (ex.: VITE_FEATURE_BATTLE=true npm run build).
 */
export const FEATURES = {
  /** Modo Batalha (#/batalha) com deck da coleção. */
  battle: import.meta.env.VITE_FEATURE_BATTLE === 'true',
  /** Trocas entre os jogadores da família (#/trocas, aviso e consulta periódica). */
  trades: import.meta.env.VITE_FEATURE_TRADES === 'true',
} as const;
