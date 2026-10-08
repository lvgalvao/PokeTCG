import type { RNG } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection, CollectionStore } from '../domain/collection.js';
import {
  applyPack,
  applySale,
  claimDailyBonus,
  claimMission,
  ensureMissions,
  EXHIBITION_SLOTS,
  netWorth,
  SELL_RATE,
  toggleExhibit,
  type CareerState,
  type GameContext,
} from '../game/career.js';
import { formatBRL } from '../game/money.js';
import {
  buildPriceBook,
  loadPackPrices,
  loadPriceSnapshot,
  packPriceCents,
  type PackPrices,
  type PriceBook,
} from '../game/prices.js';
import {
  careerCollection,
  loadCareer,
  loadMode,
  resetCareer,
  saveCareer,
  saveMode,
  todayISO,
  type GameMode,
} from '../persistence/career-store.js';
import { $, $$ } from '../utils/dom.js';
import { renderBinderIndex, SetBinderView, type BinderCareer } from './binder-view.js';
import { renderCareer } from './career-view.js';
import { catalogFor, type SetInfo, type SetsIndex } from './sets-index.js';
import { StageView, type StageCareer } from './stage-view.js';
import { renderStore } from './store-view.js';

export interface AppDeps {
  readonly index: SetsIndex;
  readonly masterRng: RNG;
  readonly store: CollectionStore;
}

type Route =
  | { readonly name: 'store' }
  | { readonly name: 'open'; readonly setId: string }
  | { readonly name: 'binder' }
  | { readonly name: 'binder-set'; readonly setId: string }
  | { readonly name: 'career' };

function parseRoute(hash: string): Route {
  const [, a, b] = hash.replace(/^#\/?/, '#/').split('/');
  if (a === 'abrir' && b) return { name: 'open', setId: decodeURIComponent(b) };
  if (a === 'fichario' && b) return { name: 'binder-set', setId: decodeURIComponent(b) };
  if (a === 'fichario') return { name: 'binder' };
  if (a === 'carreira') return { name: 'career' };
  return { name: 'store' };
}

/**
 * Loja (#/), palco de abertura (#/abrir/<set>) por cima da página de onde veio, fichário
 * (#/fichario[/<set>]) e Carreira (#/carreira). Dois modos: Livre (abrir à vontade) e
 * Carreira (carteira, preços reais, missões, fama), cada um com seu próprio fichário.
 */
export class App {
  private freeCollection: Collection;
  private career: CareerState;
  private mode: GameMode;
  private packPrices: PackPrices | null = null;
  private readonly priceBooks = new Map<string, PriceBook>();
  private readonly view = $('#view');
  private readonly stageRoot = $('#stage');
  private stage: StageView | null = null;
  private baseCleanup: (() => void) | null = null;
  /** Página por baixo do palco; é para onde fechar o palco volta. */
  private baseHash = '#/';
  private renderedBase: string | null = null;

  constructor(private readonly deps: AppDeps) {
    this.freeCollection = deps.store.load();
    this.career = loadCareer();
    this.mode = loadMode();
    if (!deps.store.isAvailable()) $('#banner-no-storage').hidden = false;
    this.bindModeSwitch();
    this.updateChrome();
    window.addEventListener('hashchange', () => void this.route());
    void loadPackPrices().then((p) => {
      this.packPrices = p;
      if (this.mode === 'career' && this.renderedBase !== null) this.renderBase(this.baseHash);
    });
    void this.route();
  }

  // ── Modo e Carreira ─────────────────────────────────────────────────────────────

  private get ctx(): GameContext {
    return {
      sets: this.deps.index.sets,
      eras: this.deps.index.eras.map((e) => e.id),
      cardValue: (id) => this.knownValue(id),
    };
  }

  private collection(): Collection {
    return this.mode === 'career' ? careerCollection(this.career) : this.freeCollection;
  }

  private bindModeSwitch(): void {
    for (const btn of $$('[data-mode]')) {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode === 'career' ? 'career' : 'free';
        if (mode === this.mode) return;
        this.mode = mode;
        saveMode(mode);
        this.updateChrome();
        if (mode === 'free' && parseRoute(location.hash).name === 'career') location.hash = '#/';
        else this.renderBase(this.baseHash);
      });
    }
  }

  private updateChrome(): void {
    for (const btn of $$('[data-mode]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === this.mode));
    }
    const wallet = $('.topbar__wallet');
    wallet.hidden = this.mode !== 'career';
    wallet.textContent = formatBRL(this.career.walletCents);
    wallet.setAttribute('aria-label', `Carreira, saldo ${formatBRL(this.career.walletCents)}`);
  }

  private setCareer(next: CareerState): void {
    this.career = next;
    saveCareer(next);
    this.updateChrome();
  }

  private withMissions(): void {
    const next = ensureMissions(this.career, todayISO(), this.ctx.eras);
    if (next !== this.career) this.setCareer(next);
  }

  private async priceBookFor(setId: string, catalog?: Catalog): Promise<PriceBook> {
    const cached = this.priceBooks.get(setId);
    if (cached) return cached;
    const [cat, snapshot] = await Promise.all([catalog ?? catalogFor(setId), loadPriceSnapshot(setId)]);
    const book = buildPriceBook(cat, snapshot);
    this.priceBooks.set(setId, book);
    return book;
  }

  private setForCard(id: string): SetInfo | undefined {
    return this.deps.index.sets.find((s) => [s.id, ...s.subsets].some((p) => id.startsWith(`${p}-`)));
  }

  /** Valor de uma carta se o preço do set dela já foi carregado. */
  private knownValue(id: string): number | undefined {
    const set = this.setForCard(id);
    const book = set && this.priceBooks.get(set.id);
    if (!book || !set) return undefined;
    const card = this.catalogs.get(set.id)?.byId.get(id);
    return card ? book.valueOf(card) : undefined;
  }

  private readonly catalogs = new Map<string, Catalog>();

  private async catalog(setId: string): Promise<Catalog> {
    const c = await catalogFor(setId);
    this.catalogs.set(setId, c);
    return c;
  }

  /** Carrega catálogos e preços de todos os sets em que a Carreira tem cartas. */
  private async loadOwnedPrices(): Promise<void> {
    const ids = new Set<string>();
    for (const id of Object.keys(this.career.collection)) {
      const set = this.setForCard(id);
      if (set) ids.add(set.id);
    }
    await Promise.all(
      [...ids].map(async (id) => this.priceBookFor(id, await this.catalog(id))),
    );
  }

  // ── Rotas ───────────────────────────────────────────────────────────────────────

  private setFor(id: string) {
    return this.deps.index.sets.find((s) => s.id === id);
  }

  private async route(): Promise<void> {
    const route = parseRoute(location.hash);
    if (route.name === 'open') {
      const set = this.setFor(route.setId);
      if (!set) return void (location.hash = '#/');
      if (this.renderedBase === null) this.renderBase('#/');
      await this.openStage(route.setId);
      return;
    }
    this.closeStage();
    this.baseHash = location.hash || '#/';
    this.renderBase(this.baseHash);
  }

  private renderBase(hash: string): void {
    const route = parseRoute(hash);
    this.baseCleanup?.();
    this.baseCleanup = null;
    this.renderedBase = hash;
    const section = route.name.startsWith('binder') ? 'binder' : route.name === 'career' ? 'career' : 'store';
    for (const link of $$('[data-nav]')) {
      if (link.dataset.nav === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (route.name === 'career') {
      if (this.mode !== 'career') {
        this.mode = 'career';
        saveMode('career');
        this.updateChrome();
      }
      this.renderCareerPage();
    } else if (route.name === 'binder') {
      renderBinderIndex(
        this.view,
        this.deps.index,
        this.collection(),
        this.mode === 'free' ? () => this.clearFreeCollection() : undefined,
      );
      document.title = 'Fichário · Loja de Boosters';
    } else if (route.name === 'binder-set') {
      const set = this.setFor(route.setId);
      if (!set) return void (location.hash = '#/fichario');
      document.title = `${set.name} · Fichário`;
      this.view.replaceChildren();
      void this.mountSetBinder(set, hash);
    } else {
      const pricing =
        this.mode === 'career' && this.packPrices
          ? {
              priceOf: (id: string) => packPriceCents(this.packPrices!, id),
              walletCents: this.career.walletCents,
            }
          : undefined;
      this.baseCleanup = renderStore(this.view, this.deps.index, this.collection(), pricing);
      document.title = 'Loja de Boosters';
    }
    window.scrollTo({ top: 0 });
  }

  private async mountSetBinder(set: SetInfo, hash: string): Promise<void> {
    try {
      const catalog = await this.catalog(set.id);
      const career = this.mode === 'career' ? await this.binderCareer(set.id, catalog) : undefined;
      if (this.renderedBase !== hash) return;
      const binder = new SetBinderView(this.view, set, catalog, () => this.collection(), career);
      this.baseCleanup = () => binder.destroy();
    } catch (err) {
      this.showError(err);
    }
  }

  private async binderCareer(setId: string, catalog: Catalog): Promise<BinderCareer> {
    const priceBook = await this.priceBookFor(setId, catalog);
    const valueOfId = (id: string) => {
      const card = catalog.byId.get(id);
      return card ? priceBook.valueOf(card) : 0;
    };
    return {
      priceBook,
      sellRate: SELL_RATE,
      sell: (ids) => {
        this.withMissions();
        const r = applySale(this.career, this.ctx, ids, valueOfId, new Date());
        this.setCareer(r.state);
        return r.earnedCents;
      },
      isExhibited: (id) => this.career.exhibition.includes(id),
      canExhibitMore: () => this.career.exhibition.length < EXHIBITION_SLOTS,
      toggleExhibit: (id) => this.setCareer(toggleExhibit(this.career, this.ctx, id, new Date())),
    };
  }

  private renderCareerPage(): void {
    this.withMissions();
    document.title = 'Carreira · Loja de Boosters';
    const rerender = () => this.renderBase(this.baseHash);
    renderCareer(this.view, this.career, {
      index: this.deps.index,
      ctx: this.ctx,
      today: todayISO(),
      netWorth: async () => {
        await this.loadOwnedPrices();
        return netWorth(this.career, (id) => this.knownValue(id));
      },
      imageOf: async (id) => {
        const set = this.setForCard(id);
        if (!set) return null;
        return (await this.catalog(set.id)).byId.get(id)?.imageUrl ?? null;
      },
      onClaimBonus: () => {
        this.setCareer(claimDailyBonus(this.career, todayISO()));
        rerender();
      },
      onClaimMission: (i) => {
        this.setCareer(claimMission(this.career, this.ctx, i, new Date()));
        rerender();
      },
      onReset: () => {
        this.career = resetCareer();
        this.updateChrome();
        rerender();
      },
    });
  }

  private async openStage(setId: string): Promise<void> {
    const set = this.setFor(setId)!;
    let catalog: Catalog;
    let career: StageCareer | undefined;
    try {
      catalog = await this.catalog(setId);
      if (this.mode === 'career') {
        const prices = this.packPrices ?? (this.packPrices = await loadPackPrices());
        career = {
          priceCents: prices ? packPriceCents(prices, setId) : null,
          priceBook: await this.priceBookFor(setId, catalog),
          walletCents: () => this.career.walletCents,
          onPack: (cards) => {
            this.withMissions();
            const r = applyPack(this.career, this.ctx, setId, career!.priceCents ?? 0, cards, new Date());
            this.setCareer(r.state);
            return r.result;
          },
        };
      }
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
      getCollection: () => this.collection(),
      onCardsOpened: (ids) => {
        this.freeCollection = this.deps.store.addCards(ids, setId);
        if (!this.deps.store.isAvailable()) $('#banner-no-storage').hidden = false;
      },
      onClose: () => (location.hash = this.baseHash),
      career,
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

  private clearFreeCollection(): void {
    this.deps.store.clear();
    this.freeCollection = this.deps.store.load();
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
