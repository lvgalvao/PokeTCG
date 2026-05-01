import type { RNG } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection, CollectionStore } from '../domain/collection.js';
import { $, $$, on } from '../utils/dom.js';
import { BoosterView } from './booster-view.js';
import { CollectionView } from './collection-view.js';

export interface AppDeps {
  readonly catalogs: Record<string, Catalog>;
  readonly masterRng: RNG;
  readonly store: CollectionStore;
}

export class App {
  private collection: Collection;
  private boosterView!: BoosterView;
  private collectionView!: CollectionView;

  private activeSetId: string = 'sv3pt5';

  constructor(private readonly deps: AppDeps) {
    this.collection = deps.store.load();
    this.bindTabs();
    this.bindSetSelector();
    this.maybeShowNoStorageBanner();
    this.mountViews();
  }

  private bindSetSelector(): void {
    const select = $('#active-set') as HTMLSelectElement;
    if (select) {
      on(select, 'change', () => {
        this.activeSetId = select.value;
        this.mountViews();
        const activeTab = document.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
        if (activeTab && activeTab.dataset.section === 'collection') {
          this.collectionView.refresh();
        }
      });
    }
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
    }
  }

  private maybeShowNoStorageBanner(): void {
    if (!this.deps.store.isAvailable()) {
      const banner = document.getElementById('banner-no-storage');
      if (banner) banner.removeAttribute('hidden');
    }
  }

  private mountViews(): void {
    const boosterPanel = $('#panel-booster');
    const collectionPanel = $('#panel-collection');

    if (this.boosterView) this.boosterView.destroy();
    
    const activeCatalog = this.deps.catalogs[this.activeSetId];
    if (!activeCatalog) return;

    this.boosterView = new BoosterView({
      mountPoint: boosterPanel,
      catalog: activeCatalog,
      setId: this.activeSetId,
      masterRng: this.deps.masterRng,
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
    this.collection = this.deps.store.addCards(cardIds);
    if (!this.deps.store.isAvailable()) {
      this.maybeShowNoStorageBanner();
    }
  }

  private onClearCollection(): void {
    this.deps.store.clear();
    this.collection = this.deps.store.load();
  }
}
