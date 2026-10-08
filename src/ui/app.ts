import type { RNG } from '../core/rng.js';
import type { Collection, CollectionStore } from '../domain/collection.js';
import { $, $$ } from '../utils/dom.js';
import { renderBinderIndex, SetBinderView } from './binder-view.js';
import { catalogFor, type SetsIndex } from './sets-index.js';
import { StageView } from './stage-view.js';
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
  | { readonly name: 'binder-set'; readonly setId: string };

function parseRoute(hash: string): Route {
  const [, a, b] = hash.replace(/^#\/?/, '#/').split('/');
  if (a === 'abrir' && b) return { name: 'open', setId: decodeURIComponent(b) };
  if (a === 'fichario' && b) return { name: 'binder-set', setId: decodeURIComponent(b) };
  if (a === 'fichario') return { name: 'binder' };
  return { name: 'store' };
}

/**
 * Loja (#/), palco de abertura (#/abrir/<set>) por cima da página de onde veio, fichário
 * (#/fichario) e fichário de uma coleção (#/fichario/<set>). O botão voltar funciona.
 */
export class App {
  private collection: Collection;
  private readonly view = $('#view');
  private readonly stageRoot = $('#stage');
  private stage: StageView | null = null;
  private baseCleanup: (() => void) | null = null;
  /** Página por baixo do palco; é para onde fechar o palco volta. */
  private baseHash = '#/';
  private renderedBase: string | null = null;

  constructor(private readonly deps: AppDeps) {
    this.collection = deps.store.load();
    if (!deps.store.isAvailable()) $('#banner-no-storage').hidden = false;
    window.addEventListener('hashchange', () => void this.route());
    void this.route();
  }

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
    for (const link of $$('[data-nav]')) {
      const section = route.name.startsWith('binder') ? 'binder' : 'store';
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
      this.view.replaceChildren();
      catalogFor(set.id)
        .then((catalog) => {
          if (this.renderedBase !== hash) return;
          const binder = new SetBinderView(this.view, set, catalog, () => this.collection);
          this.baseCleanup = () => binder.destroy();
        })
        .catch((err) => this.showError(err));
    } else {
      this.baseCleanup = renderStore(this.view, this.deps.index, this.collection);
      document.title = 'Loja de Boosters';
    }
    window.scrollTo({ top: 0 });
  }

  private async openStage(setId: string): Promise<void> {
    const set = this.setFor(setId)!;
    let catalog;
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
