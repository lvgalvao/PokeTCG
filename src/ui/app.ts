import type { RNG } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection, CollectionStore } from '../domain/collection.js';
import type { FamilyApi, Player } from '../persistence/family-api.js';
import { clearSession, type FamilyCollectionStore, type PlayerSession } from '../persistence/family-store.js';
import { $, $$ } from '../utils/dom.js';
import { renderBinderIndex, SetBinderView } from './binder-view.js';
import { catalogFor, type SetInfo, type SetsIndex } from './sets-index.js';
import { StageView } from './stage-view.js';
import { renderStore } from './store-view.js';
import { TradeView } from './trade-view.js';

/** Jogo em família: dois jogadores no Supabase, com trocas entre eles. */
export interface FamilyContext {
  readonly api: FamilyApi;
  readonly session: PlayerSession;
  readonly players: readonly Player[];
  readonly store: FamilyCollectionStore;
}

export interface AppDeps {
  readonly index: SetsIndex;
  readonly masterRng: RNG;
  readonly store: CollectionStore;
  /** Ausente sem Supabase configurado: aí o fichário fica só neste navegador e não há trocas. */
  readonly family?: FamilyContext;
}

type Route =
  | { readonly name: 'store' }
  | { readonly name: 'open'; readonly setId: string }
  | { readonly name: 'binder' }
  | { readonly name: 'binder-set'; readonly setId: string }
  | { readonly name: 'trades' };

function parseRoute(hash: string): Route {
  const [, a, b] = hash.replace(/^#\/?/, '#/').split('/');
  if (a === 'abrir' && b) return { name: 'open', setId: decodeURIComponent(b) };
  if (a === 'fichario' && b) return { name: 'binder-set', setId: decodeURIComponent(b) };
  if (a === 'fichario') return { name: 'binder' };
  if (a === 'trocas') return { name: 'trades' };
  return { name: 'store' };
}

/** Intervalo da consulta de trocas (ms). */
const TRADE_POLL_MS = 12_000;

/**
 * Loja (#/), palco de abertura (#/abrir/<set>) por cima da página de onde veio, fichário
 * (#/fichario[/<set>]) e trocas (#/trocas).
 */
export class App {
  private collection: Collection;
  private readonly view = $('#view');
  private readonly stageRoot = $('#stage');
  private stage: StageView | null = null;
  private baseCleanup: (() => void) | null = null;
  private trades: TradeView | null = null;
  /** Página por baixo do palco; é para onde fechar o palco volta. */
  private baseHash = '#/';
  private renderedBase: string | null = null;
  /** Assinatura das trocas vistas na última consulta, para saber quando algo mudou. */
  private tradeSignature: string | null = null;

  constructor(private readonly deps: AppDeps) {
    this.collection = deps.store.load();
    if (!deps.store.isAvailable()) $('#banner-no-storage').hidden = false;
    this.renderChrome();
    window.addEventListener('hashchange', () => void this.route());
    void this.route();
    if (deps.family) this.startTradePolling();
  }

  // ── Topo e jogadores ────────────────────────────────────────────────────────────

  private renderChrome(): void {
    const family = this.deps.family;
    const tradesLink = $('[data-nav="trades"]');
    const who = $('.topbar__player');
    tradesLink.hidden = !family;
    who.hidden = !family;
    if (!family) return;
    const me = family.players.find((p) => p.id === family.session.player);
    who.textContent = me?.name ?? '';
    who.setAttribute('aria-label', `Jogando como ${me?.name ?? ''}. Trocar de jogador.`);
    who.addEventListener('click', () => {
      if (!confirm('Trocar de jogador neste aparelho?')) return;
      clearSession();
      location.hash = '#/';
      location.reload();
    });
  }

  private startTradePolling(): void {
    // Com a tela apagada não consulta (bateria); ao voltar, recarrega tudo de uma vez.
    const poll = () => {
      if (document.visibilityState === 'visible') void this.pollTrades();
    };
    void this.pollTrades();
    const timer = window.setInterval(poll, TRADE_POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      void this.pollTrades().then(async (synced) => {
        if (!synced) await this.syncCollection();
      });
    });
    window.addEventListener('pagehide', () => window.clearInterval(timer));
  }

  /** Atualiza o aviso de trocas e, se alguma troca mudou, recarrega o fichário (devolve se recarregou). */
  private async pollTrades(): Promise<boolean> {
    const family = this.deps.family!;
    try {
      const list = await family.api.trades(family.session.pin);
      const incoming = list.filter((t) => t.status === 'pending' && t.to_player === family.session.player).length;
      const badge = $('.topbar__badge');
      badge.hidden = incoming === 0;
      badge.textContent = String(incoming);
      const signature = list.map((t) => `${t.id}:${t.status}`).join(',');
      const changed = this.tradeSignature !== null && signature !== this.tradeSignature;
      this.tradeSignature = signature;
      if (changed) await this.syncCollection();
      return changed;
    } catch (err) {
      console.warn('[trocas] consulta falhou:', err);
      return false;
    }
  }

  /** Recarrega o fichário do servidor e redesenha a página de baixo (fora do palco). */
  private async syncCollection(): Promise<void> {
    const family = this.deps.family;
    if (!family) return;
    this.collection = await family.store.refresh();
    if (this.trades) this.trades.refresh();
    else if (!this.stage) this.renderBase(this.baseHash, false);
  }

  // ── Rotas ───────────────────────────────────────────────────────────────────────

  private setFor(id: string): SetInfo | undefined {
    return this.deps.index.sets.find((s) => s.id === id);
  }

  private async route(): Promise<void> {
    const route = parseRoute(location.hash);
    if (route.name === 'open') {
      if (!this.setFor(route.setId)) return void (location.hash = '#/');
      if (this.renderedBase === null) this.renderBase('#/');
      await this.openStage(route.setId);
      return;
    }
    this.closeStage();
    this.baseHash = location.hash || '#/';
    this.renderBase(this.baseHash);
  }

  private renderBase(hash: string, scrollTop = true): void {
    const route = parseRoute(hash);
    this.baseCleanup?.();
    this.baseCleanup = null;
    this.trades = null;
    this.renderedBase = hash;
    const section = route.name.startsWith('binder') ? 'binder' : route.name === 'trades' ? 'trades' : 'store';
    for (const link of $$('[data-nav]')) {
      if (link.dataset.nav === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (route.name === 'binder') {
      renderBinderIndex(this.view, this.deps.index, this.collection, () => this.clearCollection());
      document.title = 'Fichário · Loja de Boosters';
    } else if (route.name === 'binder-set') {
      const set = this.setFor(route.setId);
      if (!set) return void (location.hash = '#/fichario');
      document.title = `${set.name} · Fichário`;
      if (scrollTop) this.view.replaceChildren();
      void this.mountSetBinder(set, hash);
    } else if (route.name === 'trades' && this.deps.family) {
      const family = this.deps.family;
      document.title = 'Trocas · Loja de Boosters';
      const view = new TradeView(this.view, {
        api: family.api,
        session: family.session,
        players: family.players,
        index: this.deps.index,
        myCollection: () => this.collection,
        onChanged: async () => {
          this.collection = await family.store.refresh();
          await this.pollTrades();
        },
      });
      this.trades = view;
      this.baseCleanup = () => view.destroy();
    } else {
      this.baseCleanup = renderStore(this.view, this.deps.index, this.collection);
      document.title = 'Loja de Boosters';
    }
    if (scrollTop) window.scrollTo({ top: 0 });
  }

  private async mountSetBinder(set: SetInfo, hash: string): Promise<void> {
    try {
      const catalog = await catalogFor(set.id);
      if (this.renderedBase !== hash) return;
      const binder = new SetBinderView(this.view, set, catalog, () => this.collection);
      this.baseCleanup = () => binder.destroy();
    } catch (err) {
      this.showError(err);
    }
  }

  private async openStage(setId: string): Promise<void> {
    const set = this.setFor(setId)!;
    let catalog: Catalog;
    try {
      catalog = await catalogFor(setId);
    } catch (err) {
      this.showError(err);
      return;
    }
    if (parseRoute(location.hash).name !== 'open') return;
    this.stage?.destroy();
    this.stageRoot.hidden = false;
    document.body.classList.add('is-stage-open');
    this.stage = new StageView({
      root: this.stageRoot,
      set,
      catalog,
      masterRng: this.deps.masterRng,
      getCollection: () => this.collection,
      onCardsOpened: (ids) => {
        this.collection = this.deps.store.addCards(ids, setId);
        if (!this.deps.store.isAvailable()) $('#banner-no-storage').hidden = false;
      },
      onClose: () => (location.hash = this.baseHash),
    });
  }

  private closeStage(): void {
    if (!this.stage) return;
    this.stage.destroy();
    this.stage = null;
    this.stageRoot.hidden = true;
    this.stageRoot.replaceChildren();
    document.body.classList.remove('is-stage-open');
    // A página de baixo mostra o progresso atualizado.
    this.renderedBase = null;
  }

  private clearCollection(): void {
    this.deps.store.clear();
    this.collection = this.deps.store.load();
    this.renderBase(this.baseHash);
  }

  private showError(err: unknown): void {
    console.error(err);
    const p = document.createElement('p');
    p.className = 'banner';
    p.textContent =
      'Não foi possível carregar esta coleção. Confira se assets/<set>/manifest.json existe e recarregue a página.';
    this.view.replaceChildren(p);
  }
}
