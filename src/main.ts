import { autoSeed, mulberry32 } from './core/rng.js';
import { createLocalStorageCollectionStore } from './persistence/collection-store.js';
import { FamilyApi, FamilyError } from './persistence/family-api.js';
import { clearSession, createFamilyStore, loadSession, saveSession } from './persistence/family-store.js';
import { getSupabaseClient } from './persistence/supabase-client.js';
import { App, type FamilyContext } from './ui/app.js';
import { renderLogin } from './ui/login-view.js';
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
  const [index, family] = await Promise.all([loadSetsIndex(), initFamily()]);
  const seed = parseSeedFromUrl() ?? autoSeed();
  const masterRng = mulberry32(seed);

  // Expose seed in dev for bug reports (FR-012)
  (window as unknown as Record<string, unknown>).__pkmnSeed = seed;

  const store = family?.store ?? createLocalStorageCollectionStore();
  new App({ index, masterRng, store, ...(family ? { family } : {}) });
}

/**
 * Com Supabase configurado: escolhe o jogador (e o PIN) uma vez por aparelho e carrega o
 * fichário dele. Sem Supabase, ou se o servidor não responde, joga só neste navegador.
 */
async function initFamily(): Promise<FamilyContext | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const api = new FamilyApi(client);
  try {
    const status = await api.status();
    const view = document.querySelector<HTMLElement>('#view')!;
    for (;;) {
      let session = loadSession();
      if (!session) {
        document.body.classList.add('is-login');
        session = await renderLogin(view, api, status);
        document.body.classList.remove('is-login');
        saveSession(session);
      }
      try {
        const store = await createFamilyStore(api, session);
        const players = status.players.length ? status.players : (await api.status()).players;
        return { api, session, players, store };
      } catch (err) {
        // PIN trocado ou sessão inválida: volta para a escolha do jogador.
        if (!(err instanceof FamilyError)) throw err;
        console.warn('[família] sessão inválida:', err.message);
        clearSession();
        if (!status.configured) Object.assign(status, await api.status());
      }
    }
  } catch (err) {
    console.warn('[família] servidor indisponível, jogando só neste navegador:', err);
    const banner = document.querySelector<HTMLElement>('#banner-no-storage');
    if (banner) {
      banner.textContent = 'Sem conexão com o servidor: as cartas desta sessão ficam só neste aparelho.';
      banner.hidden = false;
    }
    return null;
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
