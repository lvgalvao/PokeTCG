import { BUCKETS, BUCKET_LABELS, bucketRank, type Bucket } from '../core/buckets.js';
import type { Card } from '../domain/card.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection } from '../domain/collection.js';
import { el } from '../utils/dom.js';
import { openCardViewer } from './card-viewer.js';
import { project, rubberband, spring, VelocityTracker } from './motion.js';
import { progressRing } from './store-view.js';
import { coverUrl, eraYears, ownedCount, type SetInfo, type SetsIndex } from './sets-index.js';

const POCKETS = 9;

/** Lista de coleções com o progresso de cada uma. */
export function renderBinderIndex(
  root: HTMLElement,
  index: SetsIndex,
  collection: Collection,
  onClear: () => void,
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

  if (totalOwned > 0) {
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

type Filter = 'all' | Bucket;

/** Fichário de uma coleção: páginas de 9 bolsos, folheáveis por swipe, setas ou teclado. */
export class SetBinderView {
  private filter: Filter = 'all';
  private page = 0;
  private readonly cleanups: Array<() => void> = [];
  private spread!: HTMLElement;
  private pagesLabel!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly set: SetInfo,
    private readonly catalog: Catalog,
    private readonly getCollection: () => Collection,
  ) {
    this.render();
    const onKey = (ev: KeyboardEvent) => {
      if (document.querySelector('.viewer, .stage:not([hidden])')) return;
      if (ev.key === 'ArrowRight') this.go(1);
      if (ev.key === 'ArrowLeft') this.go(-1);
    };
    const onResize = () => this.renderPages();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    this.cleanups.push(
      () => document.removeEventListener('keydown', onKey),
      () => window.removeEventListener('resize', onResize),
    );
  }

  destroy(): void {
    this.cleanups.forEach((c) => c());
  }

  private cards(): Card[] {
    return this.filter === 'all'
      ? [...this.catalog.cards]
      : this.catalog.cards.filter((c) => c.bucket === this.filter);
  }

  /** Duas páginas lado a lado em telas largas, como um fichário aberto. */
  private pagesPerSpread(): number {
    return window.matchMedia('(min-width: 900px)').matches ? 2 : 1;
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.cards().length / POCKETS));
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
    for (const b of BUCKETS) {
      const all = this.catalog.byBucket[b];
      if (!all.length) continue;
      const have = all.filter((c) => (collection.entries.get(c.id) ?? 0) > 0).length;
      const seg = el('span', { className: `rarity-bar__seg rarity-${bucketRank(b)}` });
      seg.style.flexGrow = String(all.length);
      seg.style.setProperty('--pct', String(have / all.length));
      segments.append(seg);
      chips.append(this.chip(BUCKET_LABELS[b], b, have, all.length));
    }

    this.prevBtn = el('button', {
      className: 'binder__arrow',
      attrs: { type: 'button', 'aria-label': 'Página anterior' },
      text: '‹',
    });
    this.nextBtn = el('button', {
      className: 'binder__arrow',
      attrs: { type: 'button', 'aria-label': 'Próxima página' },
      text: '›',
    });
    this.prevBtn.addEventListener('click', () => this.go(-1));
    this.nextBtn.addEventListener('click', () => this.go(1));
    this.pagesLabel = el('p', { className: 'binder__pages', attrs: { 'aria-live': 'polite' } });
    this.spread = el('div', { className: 'binder__spread' });
    this.bindSwipe();

    this.root.replaceChildren(
      el('div', {
        className: 'binder',
        children: [
          el('a', { className: 'binder__back', attrs: { href: '#/fichario' }, text: 'Fichário' }),
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
                  el('a', {
                    className: 'btn btn--primary binder__open',
                    attrs: { href: `#/abrir/${this.set.id}` },
                    text: 'Abrir pacote',
                  }),
                ],
              }),
            ],
          }),
          segments,
          chips,
          el('div', {
            className: 'binder__book',
            children: [this.prevBtn, this.spread, this.nextBtn],
          }),
          this.pagesLabel,
        ],
      }),
    );
    this.renderPages();
  }

  private chip(label: string, value: Filter, have: number, total: number): HTMLElement {
    const btn = el('button', {
      className: 'chip',
      attrs: { type: 'button', 'aria-pressed': String(this.filter === value) },
      children: [label, el('span', { className: 'chip__count', text: `${have}/${total}` })],
    });
    btn.addEventListener('click', () => {
      this.filter = value;
      this.page = 0;
      this.render();
    });
    return btn;
  }

  private renderPages(): void {
    const per = this.pagesPerSpread();
    const total = this.pageCount();
    this.page = Math.min(this.page, Math.max(0, total - per));
    const cards = this.cards();
    const counts = this.getCollection().entries;
    const pages: HTMLElement[] = [];
    for (let p = this.page; p < Math.min(this.page + per, total); p++) {
      const pocketList = el('ol', { className: 'binder__page', attrs: { start: String(p * POCKETS + 1) } });
      for (let i = 0; i < POCKETS; i++) {
        const card = cards[p * POCKETS + i];
        pocketList.append(this.pocket(card, card ? counts.get(card.id) ?? 0 : 0));
      }
      pages.push(pocketList);
    }
    this.spread.replaceChildren(...pages);
    this.spread.style.transform = '';
    const last = Math.min(this.page + per, total);
    this.pagesLabel.textContent =
      per === 2 && last > this.page + 1
        ? `Páginas ${this.page + 1} e ${last} de ${total}`
        : `Página ${this.page + 1} de ${total}`;
    this.prevBtn.disabled = this.page === 0;
    this.nextBtn.disabled = this.page + per >= total;
  }

  private pocket(card: Card | undefined, count: number): HTMLElement {
    if (!card) return el('li', { className: 'pocket is-blank', attrs: { 'aria-hidden': 'true' } });
    const rank = bucketRank(card.bucket);
    if (count === 0) {
      return el('li', {
        className: `pocket is-missing rarity-${rank}`,
        attrs: { 'aria-label': `Nº ${card.collectionNumber}, ${BUCKET_LABELS[card.bucket]}, ainda não tem` },
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
    btn.addEventListener('click', () => openCardViewer(card, count));
    return el('li', { className: `pocket rarity-${rank}`, children: [btn] });
  }

  private go(dir: number): void {
    const per = this.pagesPerSpread();
    const next = this.page + dir * per;
    if (next < 0 || next >= this.pageCount()) return;
    this.page = next;
    this.renderPages();
    this.spread.animate(
      [{ transform: `translateX(${dir * 24}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
      { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }

  /** Folhear com o dedo: acompanha 1:1, resiste nas pontas e decide pela projeção. */
  private bindSwipe(): void {
    const tracker = new VelocityTracker();
    let startX = 0;
    let dx = 0;
    let active = false;
    let horizontal: boolean | null = null;
    let startY = 0;
    this.spread.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse') return;
      active = true;
      horizontal = null;
      startX = ev.clientX;
      startY = ev.clientY;
      dx = 0;
      tracker.reset();
      tracker.add(ev.clientX, ev.clientY);
    });
    this.spread.addEventListener('pointermove', (ev) => {
      if (!active) return;
      const mx = ev.clientX - startX;
      const my = ev.clientY - startY;
      if (horizontal === null && Math.hypot(mx, my) > 10) {
        horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal) this.spread.setPointerCapture(ev.pointerId);
      }
      if (!horizontal) return;
      tracker.add(ev.clientX, ev.clientY);
      const atEdge = (mx > 0 && this.page === 0) || (mx < 0 && this.prevNextDisabled(mx));
      dx = atEdge ? rubberband(mx, this.spread.clientWidth) : mx;
      this.spread.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
      if (!active) return;
      active = false;
      if (!horizontal) return;
      const { vx } = tracker.velocity();
      const projected = dx + project(vx);
      const w = this.spread.clientWidth;
      const dir = projected < -w * 0.3 ? 1 : projected > w * 0.3 ? -1 : 0;
      if (dir !== 0 && !(dir === -1 && this.page === 0) && !this.prevNextDisabled(-dir)) {
        this.go(dir);
      } else {
        const from = dx;
        spring(from, 0, (v) => (this.spread.style.transform = `translateX(${v}px)`), {
          damping: 0.85,
          response: 0.3,
          velocity: vx,
        });
      }
    };
    this.spread.addEventListener('pointerup', end);
    this.spread.addEventListener('pointercancel', end);
  }

  private prevNextDisabled(mx: number): boolean {
    return mx < 0 ? this.nextBtn.disabled : this.prevBtn.disabled;
  }
}
