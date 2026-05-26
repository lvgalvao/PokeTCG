import { autoSeed, mulberry32 } from './core/rng.js';
import { loadCatalog } from './domain/catalog.js';
import { createLocalStorageCollectionStore } from './persistence/collection-store.js';
import { getSupabaseClient } from './persistence/supabase-client.js';
import { createSupabaseCollectionStore } from './persistence/supabase-collection-store.js';
import type { CollectionStore } from './domain/collection.js';
import { App } from './ui/app.js';

function parseSeedFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  if (!raw) return null;
  const trimmed = raw.trim();
  const n = trimmed.startsWith('0x') ? parseInt(trimmed.slice(2), 16) : Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n >>> 0;
}

// Newest first. Order is reflected in the <select> dropdown.
const SET_IDS = [
  'me4',
  'me3',
  'me2pt5',
  'me2',
  'me1',
  'zsv10pt5',
  'rsv10pt5',
  'sv10',
  'sv9',
  'sv8pt5',
  'sv8',
  'sv3pt5',
  'pgo',
  'base3',
  'base2',
  'base1',
] as const;

async function bootstrap(): Promise<void> {
  const loaded = await Promise.all(
    SET_IDS.map(async (id) => [id, await loadCatalog(`./${id}/manifest.json`)] as const),
  );
  const catalogs: Record<string, Awaited<ReturnType<typeof loadCatalog>>> = {};
  for (const [id, cat] of loaded) catalogs[id] = cat;

  const select = document.getElementById('active-set') as HTMLSelectElement | null;
  if (select) {
    select.innerHTML = '';
    for (const [id, cat] of loaded) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = cat.setName;
      select.append(opt);
    }
  }

  const seed = parseSeedFromUrl() ?? autoSeed();
  const masterRng = mulberry32(seed);
  const store = await initStore();

  // Expose seed in dev for bug reports (FR-012)
  (window as unknown as Record<string, unknown>).__pkmnSeed = seed;

  new App({ catalogs, defaultSetId: SET_IDS[0], masterRng, store });
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
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <div class="banner banner--warning">
        <strong>Erro ao iniciar o jogo.</strong>
        Verifique se você rodou <code>python tools/download_cards.py --latest 10</code>
        e se <code>assets/&lt;setId&gt;/manifest.json</code> existe para cada coleção.
      </div>
    `;
  }
});
