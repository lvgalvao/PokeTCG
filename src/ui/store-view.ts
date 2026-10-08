import type { Collection } from '../domain/collection.js';
import { DAILY_BONUS } from '../game/career.js';
import { formatBRL, type Cents } from '../game/money.js';
import { el } from '../utils/dom.js';
import { attachFoil } from './motion.js';
import {
  coverUrl,
  eraYears,
  formatReleaseDate,
  ownedCount,
  type SetInfo,
  type SetsIndex,
} from './sets-index.js';

/** Anel SVG de progresso (dono/total). */
export function progressRing(owned: number, total: number, size = 28): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const r = 10;
  const c = 2 * Math.PI * r;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ring');
  if (total > 0 && owned >= total) svg.classList.add('is-complete');
  svg.style.setProperty('--size', `${size}px`);
  for (const cls of ['ring__track', 'ring__value']) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', String(r));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', '3');
    circle.classList.add(cls);
    if (cls === 'ring__value') {
      circle.setAttribute('stroke-dasharray', String(c));
      circle.setAttribute('stroke-dashoffset', String(c * (1 - (total ? owned / total : 0))));
    }
    svg.append(circle);
  }
  return svg;
}

function packImage(set: SetInfo, eager = false): HTMLImageElement {
  return el('img', {
    className: 'pack__img',
    attrs: {
      src: coverUrl(set.id),
      alt: '',
      loading: eager ? 'eager' : 'lazy',
      decoding: 'async',
      draggable: 'false',
    },
  });
}

/** Na Carreira, cada pacote mostra o preço e se o saldo alcança. */
export interface StorePricing {
  readonly priceOf: (setId: string) => Cents | null;
  readonly walletCents: Cents;
}

function priceTag(set: SetInfo, pricing: StorePricing | undefined): HTMLElement[] {
  const price = pricing?.priceOf(set.id);
  if (!pricing || price == null) return [];
  const missing = price - pricing.walletCents;
  if (missing <= 0) return [el('span', { className: 'price-tag', text: formatBRL(price) })];
  // Fora do alcance: vira meta de economia, não um "não" vermelho.
  const days = Math.ceil(missing / DAILY_BONUS);
  const pct = Math.max(0.02, pricing.walletCents / price);
  const meter = el('span', { className: 'goal-meter', attrs: { 'aria-hidden': 'true' } });
  meter.style.setProperty('--pct', String(pct));
  return [
    el('span', { className: 'price-tag is-short', text: formatBRL(price) }),
    meter,
    el('span', {
      className: 'price-goal',
      text: days <= 1 ? 'amanhã dá' : `faltam ~${days} dias`,
    }),
  ];
}

export function renderStore(
  root: HTMLElement,
  index: SetsIndex,
  collection: Collection,
  pricing?: StorePricing,
): () => void {
  const cleanups: Array<() => void> = [];
  const store = el('div', { className: 'store' });

  const hero = index.sets[0];
  if (hero) store.append(renderHero(hero, collection, cleanups, pricing));

  for (const era of index.eras) {
    const sets = index.sets.filter((s) => s.era === era.id);
    if (sets.length === 0) continue;
    const headingId = `aisle-${era.id}`;
    const aisle = el('section', {
      className: 'aisle',
      attrs: { 'aria-labelledby': headingId },
    });
    aisle.append(
      el('header', {
        className: 'aisle__head',
        children: [
          el('h2', { className: 'aisle__years', attrs: { id: headingId }, text: eraYears(sets) }),
          el('p', {
            className: 'aisle__name',
            text: `${era.name}, ${sets.length} ${sets.length === 1 ? 'coleção' : 'coleções'}`,
          }),
        ],
      }),
    );
    const shelf = el('div', { className: 'shelf', attrs: { role: 'list' } });
    for (const set of sets) {
      const owned = ownedCount(set, collection);
      const pack = el('span', { className: 'pack' });
      pack.append(packImage(set));
      cleanups.push(attachFoil(pack, 8));
      const item = el('a', {
        className: 'shelf__item',
        attrs: {
          role: 'listitem',
          href: `#/abrir/${set.id}`,
          'aria-label': `${set.name}: abrir pacote. ${owned} de ${set.albumSize} cartas no fichário.`,
          'data-set-id': set.id,
        },
        children: [
          pack,
          el('span', { className: 'shelf__name', text: set.name }),
          el('span', {
            className: 'shelf__progress',
            children: [progressRing(owned, set.albumSize, 16), `${owned}/${set.albumSize}`],
          }),
          ...priceTag(set, pricing),
        ],
      });
      shelf.append(item);
    }
    aisle.append(shelf);
    store.append(aisle);
  }

  root.replaceChildren(store);
  return () => cleanups.forEach((c) => c());
}

function renderHero(
  set: SetInfo,
  collection: Collection,
  cleanups: Array<() => void>,
  pricing?: StorePricing,
): HTMLElement {
  const price = pricing?.priceOf(set.id);
  const owned = ownedCount(set, collection);
  const pack = el('a', {
    className: 'pack pack--hero',
    attrs: { href: `#/abrir/${set.id}`, 'aria-hidden': 'true', tabindex: '-1', 'data-set-id': set.id },
  });
  pack.append(packImage(set, true));
  cleanups.push(attachFoil(pack, 12));

  return el('section', {
    className: 'hero',
    attrs: { 'aria-labelledby': 'hero-title' },
    children: [
      el('div', { className: 'hero__stage', children: [pack] }),
      el('div', {
        className: 'hero__copy',
        children: [
          el('p', { className: 'hero__new', text: 'Coleção mais nova' }),
          el('h1', { className: 'hero__title', attrs: { id: 'hero-title' }, text: set.name }),
          el('p', {
            className: 'hero__meta',
            text:
              `Lançada em ${formatReleaseDate(set.releaseDate)}. Cada pacote traz ${set.packSize} cartas` +
              (price != null ? ` e custa ${formatBRL(price)}.` : '.'),
          }),
          el('a', {
            className: 'btn btn--primary hero__cta',
            attrs: { href: `#/abrir/${set.id}`, 'data-set-id': set.id },
            text: 'Abrir pacote',
          }),
          el('a', {
            className: 'hero__progress',
            attrs: { href: `#/fichario/${set.id}` },
            children: [
              progressRing(owned, set.albumSize, 22),
              `${owned} de ${set.albumSize} cartas no fichário`,
            ],
          }),
        ],
      }),
    ],
  });
}
