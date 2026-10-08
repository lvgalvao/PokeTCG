import { autoSeed, mulberry32 } from './core/rng.js';
import { createLocalStorageCollectionStore } from './persistence/collection-store.js';
import { getSupabaseClient } from './persistence/supabase-client.js';
import { createSupabaseCollectionStore } from './persistence/supabase-collection-store.js';
import type { CollectionStore } from './domain/collection.js';
import { App } from './ui/app.js';
import { loadSetsIndex } from './ui/sets-index.js';

function parseSeedFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  if (!raw) return null;
  const trimmed = raw.trim();
  const n = trimmed.startsWith('0x') ? parseInt(trimmed.slice(2), 16) : Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n >>> 0;
}

async function bootstrap(): Promise<void> {
  const [index, store] = await Promise.all([loadSetsIndex(), initStore()]);
  const seed = parseSeedFromUrl() ?? autoSeed();
  const masterRng = mulberry32(seed);

  // Expose seed in dev for bug reports (FR-012)
  (window as unknown as Record<string, unknown>).__pkmnSeed = seed;

  new App({ index, masterRng, store });
}

async function initStore(): Promise<CollectionStore> {
  const client = getSupabaseClient();
  if (!client) {
    console.info('[persistence] Supabase env not set — using localStorage');
    return createLocalStorageCollectionStore();
  }
  try {
    const store = await createSupabaseCollectionStore(client);
    console.info('[persistence] Supabase store ready');
    return store;
  } catch (err) {
    console.warn('[persistence] Supabase unavailable, falling back to localStorage:', err);
    return createLocalStorageCollectionStore();
  }
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap app:', err);
  const main = document.querySelector('#view');
  if (main) {
    main.innerHTML = `
      <div class="banner banner--warning">
        <strong>Erro ao iniciar o jogo.</strong>
        Rode <code>python tools/build_sets_index.py</code> para gerar
        <code>assets/data/sets.json</code> e recarregue a página.
      </div>
    `;
  }
});
