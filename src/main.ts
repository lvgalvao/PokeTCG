import { autoSeed, mulberry32 } from './core/rng.js';
import { loadCatalog } from './domain/catalog.js';
import { createLocalStorageCollectionStore } from './persistence/collection-store.js';
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

async function bootstrap(): Promise<void> {
  const catalog151 = await loadCatalog('./sv3pt5/manifest.json');
  const catalogPrismatic = await loadCatalog('./sv8pt5/manifest.json');
  const seed = parseSeedFromUrl() ?? autoSeed();
  const masterRng = mulberry32(seed);
  const store = createLocalStorageCollectionStore();

  // Expose seed in dev for bug reports (FR-012)
  (window as unknown as Record<string, unknown>).__pkmnSeed = seed;

  new App({ catalogs: { sv3pt5: catalog151, sv8pt5: catalogPrismatic }, masterRng, store });
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap app:', err);
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <div class="banner banner--warning">
        <strong>Erro ao iniciar o jogo.</strong>
        Verifique se você rodou <code>python tools/download_cards.py</code> para ambas as coleções e
        se <code>assets/sv3pt5/manifest.json</code> e <code>assets/sv8pt5/manifest.json</code> existem.
      </div>
    `;
  }
});
