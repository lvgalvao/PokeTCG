import { autoSeed, mulberry32 } from './core/rng.js';
import { createLocalStorageCollectionStore } from './persistence/collection-store.js';
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
  const index = await loadSetsIndex();
  const seed = parseSeedFromUrl() ?? autoSeed();
  const masterRng = mulberry32(seed);

  // Expose seed in dev for bug reports (FR-012)
  (window as unknown as Record<string, unknown>).__pkmnSeed = seed;

  new App({ index, masterRng, store: createLocalStorageCollectionStore() });
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap app:', err);
  const main = document.querySelector('#view');
  if (main) {
    main.innerHTML = `
      <div class="banner banner--warning">
        <strong>A loja não abriu.</strong>
        Confira a internet e recarregue a página.
      </div>
    `;
  }
});
