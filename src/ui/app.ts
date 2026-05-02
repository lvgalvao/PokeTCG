import type { RNG } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection, CollectionStore } from '../domain/collection.js';
import { $, $$, on } from '../utils/dom.js';
import { BoosterView } from './booster-view.js';
import { CollectionView } from './collection-view.js';
import { HomeView } from './home-view.js';

export interface AppDeps {
  readonly catalogs: Record<string, Catalog>;
  readonly defaultSetId: string;
  readonly masterRng: RNG;
  readonly store: CollectionStore;
}

export class App {
  private collection: Collection;
  private homeView!: HomeView;
  private boosterView!: BoosterView;
  private collectionView!: CollectionView;

  private activeSetId: string;

  constructor(private readonly deps: AppDeps) {
    this.activeSetId = deps.defaultSetId;
    this.collection = deps.store.load();
    this.bindTabs();
    this.bindSetSelector();
    this.maybeShowNoStorageBanner();
    this.syncSetSelector();
    this.mountViews();
  }

  private syncSetSelector(): void {
    const select = $('#active-set') as HTMLSelectElement | null;
    if (select && select.value !== this.activeSetId) {
      select.value = this.activeSetId;
    }
  }

  private bindSetSelector(): void {
    const select = $('#active-set') as HTMLSelectElement;
    if (select) {
      on(select, 'change', () => this.changeActiveSet(select.value));
    }
  }

  private changeActiveSet(setId: string): void {
    if (setId === this.activeSetId) return;
    this.activeSetId = setId;
    this.syncSetSelector();
    this.mountViews();
    const activeTab = document.querySelector(
      '[role="tab"][aria-selected="true"]',
    ) as HTMLElement | null;
    if (activeTab && activeTab.dataset.section === 'collection') {
      this.collectionView.refresh();
    }
  }

  private openFromHome(setId: string): void {
    if (setId !== this.activeSetId) {
      this.activeSetId = setId;
      this.syncSetSelector();
      this.mountViews();
    }
    this.activateTab('booster');
    this.boosterView.openBooster();
  }

  private bindTabs(): void {
    const tabs = $$('[role="tab"]');
    for (const tab of tabs) {
      on(tab, 'click', () => this.activateTab(tab.dataset.section ?? 'booster'));
      on(tab, 'keydown', (ev) => {
        const tabsArr = $$('[role="tab"]');
        const cur = tabsArr.indexOf(tab);
        if (ev.code === 'ArrowRight') {
          ev.preventDefault();
          tabsArr[(cur + 1) % tabsArr.length]?.focus();
        }
        if (ev.code === 'ArrowLeft') {
          ev.preventDefault();
          tabsArr[(cur - 1 + tabsArr.length) % tabsArr.length]?.focus();
        }
        if (ev.code === 'Enter' || ev.code === 'Space') {
          ev.preventDefault();
          this.activateTab(tab.dataset.section ?? 'booster');
        }
      });
    }
  }

  private activateTab(section: string): void {
    const tabs = $$('[role="tab"]');
    const panels = $$('[role="tabpanel"]');
    for (const tab of tabs) {
      const isActive = tab.dataset.section === section;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    for (const panel of panels) {
      const isActive = panel.id === `panel-${section}`;
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    }
    if (section === 'collection') {
      this.collectionView.refresh();
    } else if (section === 'home') {
      this.homeView.refresh();
    }
  }

  private maybeShowNoStorageBanner(): void {
    if (!this.deps.store.isAvailable()) {
      const banner = document.getElementById('banner-no-storage');
      if (banner) banner.removeAttribute('hidden');
    }
  }

  private mountViews(): void {
    const homePanel = $('#panel-home');
    const boosterPanel = $('#panel-booster');
    const collectionPanel = $('#panel-collection');

    if (this.boosterView) this.boosterView.destroy();

    const activeCatalog = this.deps.catalogs[this.activeSetId];
    if (!activeCatalog) return;

    const availableSets = Object.entries(this.deps.catalogs).map(([id, cat]) => ({
      id,
      name: cat.setName,
    }));

    this.homeView = new HomeView({
      mountPoint: homePanel,
      availableSets,
      getActiveSetId: () => this.activeSetId,
      onSelectSet: (id) => this.openFromHome(id),
    });

    this.boosterView = new BoosterView({
      mountPoint: boosterPanel,
      catalog: activeCatalog,
      setId: this.activeSetId,
      masterRng: this.deps.masterRng,
      getCollection: () => this.collection,
      onBoosterRevealed: (cardIds) => this.onBoosterRevealed(cardIds),
    });

    this.collectionView = new CollectionView({
      mountPoint: collectionPanel,
      catalog: activeCatalog,
      store: this.deps.store,
      getCollection: () => this.collection,
      onClearCollection: () => this.onClearCollection(),
    });
  }

  private onBoosterRevealed(cardIds: readonly string[]): void {
    this.collection = this.deps.store.addCards(cardIds, this.activeSetId);
    if (!this.deps.store.isAvailable()) {
      this.maybeShowNoStorageBanner();
    }
  }

  private onClearCollection(): void {
    this.deps.store.clear();
    this.collection = this.deps.store.load();
  }
}
