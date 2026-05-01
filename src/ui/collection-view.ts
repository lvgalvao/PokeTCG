import { BUCKETS, BUCKET_LABELS, type Bucket } from '../core/buckets.js';
import type { Card } from '../domain/card.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection, CollectionStore } from '../domain/collection.js';
import { $, clear, el, on, setText } from '../utils/dom.js';

export type CollectionFilter = 'all' | Bucket;

export interface CollectionViewDeps {
  readonly mountPoint: HTMLElement;
  readonly catalog: Catalog;
  readonly store: CollectionStore;
  readonly getCollection: () => Collection;
  readonly onClearCollection: () => void;
}

interface BucketProgress {
  readonly owned: number;
  readonly total: number;
}

interface ViewModel {
  readonly slots: ReadonlyArray<{ card: Card; count: number }>;
  readonly progress: {
    readonly owned: number;
    readonly total: number;
    readonly byBucket: Readonly<Record<Bucket, BucketProgress>>;
  };
}

export function buildCollectionView(
  catalog: Catalog,
  collection: Collection,
  filter: CollectionFilter,
): ViewModel {
  const counts = collection.entries;

  const filtered: Card[] =
    filter === 'all' ? [...catalog.cards] : catalog.cards.filter((c) => c.bucket === filter);

  const slots = filtered.map((card) => ({
    card,
    count: counts.get(card.id) ?? 0,
  }));

  const byBucket: Record<Bucket, BucketProgress> = Object.fromEntries(
    BUCKETS.map((b) => [
      b,
      {
        owned: catalog.byBucket[b].filter((c) => (counts.get(c.id) ?? 0) > 0).length,
        total: catalog.byBucket[b].length,
      },
    ]),
  ) as Record<Bucket, BucketProgress>;

  const progress =
    filter === 'all'
      ? {
          owned: Array.from(counts.keys()).filter((id) => catalog.byId.has(id)).length,
          total: catalog.totalSet,
          byBucket,
        }
      : {
          owned: byBucket[filter].owned,
          total: byBucket[filter].total,
          byBucket,
        };

  return { slots, progress };
}

export class CollectionView {
  private currentFilter: CollectionFilter = 'all';

  constructor(private readonly deps: CollectionViewDeps) {
    this.render();
  }

  setFilter(f: CollectionFilter): void {
    this.currentFilter = f;
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    const collection = this.deps.getCollection();
    const view = buildCollectionView(this.deps.catalog, collection, this.currentFilter);

    clear(this.deps.mountPoint);

    const header = this.renderHeader(view);
    const filters = this.renderFilters(view);
    const grid = this.renderGrid(view);

    this.deps.mountPoint.append(header, filters, grid);
  }

  private renderHeader(view: ViewModel): HTMLElement {
    const wrap = el('div', { className: 'collection-header' });

    const totalLabel =
      this.currentFilter === 'all'
        ? 'Total do set'
        : `Filtro: ${BUCKET_LABELS[this.currentFilter]}`;
    const total = el('div', {
      className: 'collection-header__total',
      children: [
        el('span', { className: 'collection-header__total-label', text: totalLabel }),
        el('strong', {
          className: 'collection-header__total-count',
          text: `${view.progress.owned}/${view.progress.total}`,
        }),
      ],
    });

    const breakdown = el('div', { className: 'collection-header__breakdown' });
    for (const b of BUCKETS) {
      const p = view.progress.byBucket[b];
      const chip = el('span', {
        className: `chip chip--rarity-${String(BUCKETS.indexOf(b) + 1).padStart(2, '0')}`,
        text: `${BUCKET_LABELS[b]} ${p.owned}/${p.total}`,
        attrs: { 'aria-label': `${BUCKET_LABELS[b]}: ${p.owned} de ${p.total}` },
      });
      breakdown.append(chip);
    }

    const actions = el('div', { className: 'collection-header__actions' });
    const clearBtn = el('button', {
      className: 'btn btn--ghost',
      text: 'Limpar coleção',
      attrs: { type: 'button' },
    });
    on(clearBtn, 'click', () => {
      const ok = confirm('Apagar toda a coleção? Esta ação não pode ser desfeita.');
      if (ok) {
        this.deps.onClearCollection();
        this.refresh();
      }
    });
    actions.append(clearBtn);

    wrap.append(total, breakdown, actions);
    return wrap;
  }

  private renderFilters(_view: ViewModel): HTMLElement {
    const wrap = el('div', { className: 'collection-filters', attrs: { role: 'group', 'aria-label': 'Filtrar por raridade' } });

    const allBtn = this.makeFilterButton('Todas', 'all');
    wrap.append(allBtn);

    for (const b of BUCKETS) {
      wrap.append(this.makeFilterButton(BUCKET_LABELS[b], b));
    }

    return wrap;
  }

  private makeFilterButton(label: string, value: CollectionFilter): HTMLButtonElement {
    const isActive = this.currentFilter === value;
    const btn = el('button', {
      className: `chip chip--filter ${isActive ? 'is-active' : ''}`.trim(),
      text: label,
      attrs: {
        type: 'button',
        'aria-pressed': isActive ? 'true' : 'false',
        'data-filter': value,
      },
    });
    on(btn, 'click', () => this.setFilter(value));
    return btn;
  }

  private renderGrid(view: ViewModel): HTMLElement {
    const grid = el('div', { className: 'collection-grid', attrs: { role: 'list' } });

    if (view.slots.length === 0) {
      const empty = el('p', {
        className: 'collection-empty',
        text: 'Nenhuma carta nesta raridade ainda.',
      });
      grid.append(empty);
      return grid;
    }

    for (const slot of view.slots) {
      grid.append(this.renderSlot(slot));
    }
    return grid;
  }

  private renderSlot(slot: { card: Card; count: number }): HTMLElement {
    const owned = slot.count > 0;
    const rank = BUCKETS.indexOf(slot.card.bucket) + 1;
    const wrap = el('div', {
      className: `coll-slot rarity-${String(rank).padStart(2, '0')} ${owned ? 'is-owned' : 'is-locked'}`,
      attrs: {
        role: 'listitem',
        'aria-label': owned
          ? `${slot.card.name} (#${slot.card.collectionNumber}) — ${slot.count} cópias`
          : `${slot.card.collectionNumber}: carta ainda não obtida`,
      },
    });

    if (owned) {
      const img = el('img', {
        attrs: {
          src: slot.card.imageUrl,
          alt: slot.card.name,
          loading: 'lazy',
          decoding: 'async',
        },
      });
      const badge = el('span', {
        className: 'coll-slot__badge',
        text: `×${slot.count}`,
      });
      const num = el('span', {
        className: 'coll-slot__num',
        text: `#${slot.card.collectionNumber}`,
      });
      wrap.append(img, num, badge);
    } else {
      const placeholder = el('div', { className: 'coll-slot__placeholder', text: '?' });
      const num = el('span', {
        className: 'coll-slot__num',
        text: `#${slot.card.collectionNumber}`,
      });
      wrap.append(placeholder, num);
    }

    return wrap;
  }
}
