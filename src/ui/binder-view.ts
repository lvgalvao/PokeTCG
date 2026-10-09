import { BUCKETS, BUCKET_LABELS, bucketRank, type Bucket } from '../core/buckets.js';
import type { Card } from '../domain/card.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection } from '../domain/collection.js';
import { el } from '../utils/dom.js';
import { formatBRL, type Cents } from '../game/money.js';
import type { PriceBook } from '../game/prices.js';
import { openCardViewer, type ViewerAction } from './card-viewer.js';
import { progressRing } from './store-view.js';
import {
  categoryLabel,
  coverUrl,
  eraYears,
  ownedCount,
  subsetLabel,
  type SetInfo,
  type SetsIndex,
} from './sets-index.js';

/** Lista de coleções com o progresso de cada uma. */
export function renderBinderIndex(
  root: HTMLElement,
  index: SetsIndex,
  collection: Collection,
  onClear?: () => void,
): void {
  let totalOwned = 0;
  let started = 0;
  for (const s of index.sets) {
    const n = ownedCount(s, collection);
    totalOwned += n;
    if (n > 0) started++;
  }

  const page = el('div', { className: 'binder-index' });
  page.append(
    el('h1', { className: 'binder-index__title', text: 'Fichário' }),
    el('p', {
      className: 'binder-index__meta',
      text:
        totalOwned === 0
          ? 'Seu fichário está vazio. Abra um pacote na loja para guardar as primeiras cartas.'
          : `${totalOwned} cartas guardadas em ${started} ${started === 1 ? 'coleção' : 'coleções'}.`,
    }),
  );

  for (const era of index.eras) {
    const sets = index.sets.filter((s) => s.era === era.id);
    if (!sets.length) continue;
    const list = el('ul', { className: 'binder-list' });
    for (const set of sets) {
      const owned = ownedCount(set, collection);
      const pct = set.albumSize ? owned / set.albumSize : 0;
      const bar = el('span', { className: 'binder-list__bar' });
      bar.style.setProperty('--pct', String(pct));
      list.append(
        el('li', {
          children: [
            el('a', {
              className: `binder-list__row${owned === 0 ? ' is-empty' : ''}`,
              attrs: { href: `#/fichario/${set.id}` },
              children: [
                el('img', {
                  className: 'binder-list__cover',
                  attrs: { src: coverUrl(set.id), alt: '', loading: 'lazy' },
                }),
                el('span', { className: 'binder-list__name', text: set.name }),
                bar,
                el('span', {
                  className: 'binder-list__count',
                  text: `${owned}/${set.albumSize}`,
                }),
              ],
            }),
          ],
        }),
      );
    }
    page.append(
      el('section', {
        className: 'binder-era',
        children: [
          el('h2', {
            className: 'binder-era__title',
            children: [
              el('span', { className: 'binder-era__years', text: eraYears(sets) }),
              ` ${era.name}`,
            ],
          }),
          list,
        ],
      }),
    );
  }

  if (totalOwned > 0 && onClear) {
    const clear = el('button', {
      className: 'btn btn--link binder-index__clear',
      attrs: { type: 'button' },
      text: 'Apagar todas as cartas do fichário',
    });
    clear.addEventListener('click', () => {
      if (confirm('Apagar todas as cartas do fichário? Não dá para desfazer.')) onClear();
    });
    page.append(clear);
  }
  root.replaceChildren(page);
}

/** Todas, uma raridade do set principal ou uma subcoleção (ex.: `sub:me55c`, Clássicas). */
type Filter = 'all' | Bucket | `sub:${string}`;

/** Ações do fichário que só existem no modo Carreira. */
export interface BinderCareer {
  readonly priceBook: PriceBook;
  readonly sellRate: number;
  /** Vende as cópias indicadas (ids podem repetir) e devolve quanto entrou. */
  readonly sell: (ids: readonly string[]) => Cents;
  readonly isExhibited: (id: string) => boolean;
  readonly canExhibitMore: () => boolean;
  readonly toggleExhibit: (id: string) => void;
}

export interface BinderOptions {
  readonly career?: BinderCareer;
  /** Aberto de dentro do palco de abertura: sem "voltar" nem "Abrir pacote". */
  readonly embedded?: boolean;
}

/** Fichário de uma coleção: todas as cartas numa grade só, é só ir descendo. */
export class SetBinderView {
  private filter: Filter = 'all';
  private readonly career?: BinderCareer;
  private readonly embedded: boolean;

  constructor(
    private readonly root: HTMLElement,
    private readonly set: SetInfo,
    private readonly catalog: Catalog,
    private readonly getCollection: () => Collection,
    options: BinderOptions = {},
  ) {
    this.career = options.career;
    this.embedded = options.embedded ?? false;
    this.render();
  }

  destroy(): void {}

  private cards(): Card[] {
    const f = this.filter;
    if (f === 'all') return [...this.catalog.cards];
    if (f.startsWith('sub:')) return this.catalog.cards.filter((c) => c.subset === f.slice(4));
    return this.catalog.cards.filter((c) => !c.subset && c.bucket === f);
  }

  private render(): void {
    const collection = this.getCollection();
    const owned = ownedCount(this.set, collection);

    const segments = el('div', {
      className: 'rarity-bar',
      attrs: { role: 'img', 'aria-label': 'Progresso por raridade' },
    });
    const chips = el('div', {
      className: 'binder__filters',
      attrs: { role: 'group', 'aria-label': 'Mostrar raridade' },
    });
    chips.append(this.chip('Todas', 'all', owned, this.catalog.totalSet));
    const has = (c: Card) => (collection.entries.get(c.id) ?? 0) > 0;
    const addGroup = (label: string, value: Filter, all: readonly Card[], rank: number) => {
      if (!all.length) return;
      const have = all.filter(has).length;
      const seg = el('span', { className: `rarity-bar__seg rarity-${rank}` });
      seg.style.flexGrow = String(all.length);
      seg.style.setProperty('--pct', String(have / all.length));
      segments.append(seg);
      chips.append(this.chip(label, value, have, all.length));
    };
    for (const b of BUCKETS) {
      addGroup(BUCKET_LABELS[b], b, this.catalog.byBucket[b].filter((c) => !c.subset), bucketRank(b));
    }
    // Subcoleções (Clássicas, Trainer Gallery…) têm grupo próprio, fora das raridades.
    for (const sub of new Set(this.catalog.cards.flatMap((c) => (c.subset ? [c.subset] : [])))) {
      const label = subsetLabel(sub);
      addGroup(label.endsWith('a') ? `${label}s` : label, `sub:${sub}`, this.catalog.cards.filter((c) => c.subset === sub), 7);
    }

    const grid = el('ol', { className: 'binder__grid' });
    for (const card of this.cards()) grid.append(this.pocket(card, collection.entries.get(card.id) ?? 0));

    this.root.replaceChildren(
      el('div', {
        className: `binder${this.embedded ? ' is-embedded' : ''}`,
        children: [
          ...(this.embedded
            ? []
            : [el('a', { className: 'binder__back', attrs: { href: '#/fichario' }, text: 'Fichário' })]),
          el('header', {
            className: 'binder__head',
            children: [
              el('img', {
                className: 'binder__cover',
                attrs: { src: coverUrl(this.set.id), alt: '' },
              }),
              el('div', {
                children: [
                  el('h1', { className: 'binder__title', text: this.set.name }),
                  el('p', {
                    className: 'binder__meta',
                    children: [
                      progressRing(owned, this.catalog.totalSet, 18),
                      `${owned} de ${this.catalog.totalSet} cartas`,
                    ],
                  }),
                  el('div', {
                    className: 'binder__actions',
                    children: [
                      ...(this.embedded
                        ? []
                        : [
                            el('a', {
                              className: 'btn btn--primary binder__open',
                              attrs: { href: `#/abrir/${this.set.id}` },
                              text: 'Abrir pacote',
                            }),
                          ]),
                      ...this.careerHeader(collection),
                    ],
                  }),
                ],
              }),
            ],
          }),
          segments,
          chips,
          grid,
        ],
      }),
    );
  }

  private careerHeader(collection: Collection): HTMLElement[] {
    const c = this.career;
    if (!c) return [];
    let value = 0;
    const dups: string[] = [];
    let dupValue = 0;
    for (const card of this.catalog.cards) {
      const n = collection.entries.get(card.id) ?? 0;
      const v = c.priceBook.valueOf(card);
      value += v * n;
      for (let i = 1; i < n; i++) {
        dups.push(card.id);
        dupValue += Math.round(v * c.sellRate);
      }
    }
    const out: HTMLElement[] = [
      el('p', { className: 'binder__value', text: `Suas cartas desta coleção valem ${formatBRL(value)}.` }),
    ];
    if (dups.length) {
      const sell = el('button', {
        className: 'btn btn--quiet',
        attrs: { type: 'button' },
        text: `Vender ${dups.length} repetidas por ${formatBRL(dupValue)}`,
      });
      sell.addEventListener('click', () => {
        c.sell(dups);
        this.render();
      });
      out.push(sell);
    }
    return out;
  }

  private chip(label: string, value: Filter, have: number, total: number): HTMLElement {
    const btn = el('button', {
      className: 'chip',
      attrs: { type: 'button', 'aria-pressed': String(this.filter === value) },
      children: [label, el('span', { className: 'chip__count', text: `${have}/${total}` })],
    });
    btn.addEventListener('click', () => {
      this.filter = value;
      this.render();
    });
    return btn;
  }

  private pocket(card: Card, count: number): HTMLElement {
    const rank = bucketRank(card.bucket);
    if (count === 0) {
      return el('li', {
        className: `pocket is-missing rarity-${rank}`,
        attrs: { 'aria-label': `Nº ${card.collectionNumber}, ${categoryLabel(card)}, ainda não tem` },
        children: [el('span', { className: 'pocket__num', text: String(card.collectionNumber || '★') })],
      });
    }
    const btn = el('button', {
      className: 'pocket__card',
      attrs: {
        type: 'button',
        'aria-label': `${card.name}, nº ${card.collectionNumber}${count > 1 ? `, ${count} cópias` : ''}. Ampliar.`,
      },
      children: [
        el('img', { attrs: { src: card.imageUrl, alt: '', loading: 'lazy', decoding: 'async' } }),
        ...(count > 1 ? [el('span', { className: 'pocket__count', text: `×${count}` })] : []),
      ],
    });
    btn.addEventListener('click', () => this.openViewer(card, count));
    return el('li', { className: `pocket rarity-${rank}`, children: [btn] });
  }

  private openViewer(card: Card, count: number): void {
    const c = this.career;
    if (!c) return openCardViewer(card, count);
    const value = c.priceBook.valueOf(card);
    const actions: ViewerAction[] = [];
    if (c.isExhibited(card.id)) {
      actions.push({ label: 'Tirar da exposição', onClick: () => { c.toggleExhibit(card.id); this.render(); } });
    } else if (c.canExhibitMore()) {
      actions.push({ label: 'Expor', onClick: () => { c.toggleExhibit(card.id); this.render(); } });
    }
    actions.push({
      label: `Vender ${count > 1 ? 'uma ' : ''}por ${formatBRL(Math.round(value * c.sellRate))}`,
      primary: count > 1,
      onClick: () => { c.sell([card.id]); this.render(); },
    });
    const estimated = c.priceBook.isEstimated(card) ? ' (estimado pela raridade)' : '';
    openCardViewer(card, count, actions, `Vale ${formatBRL(value)} no mercado${estimated}.`);
  }
}
