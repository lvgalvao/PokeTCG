import { bucketRank } from '../core/buckets.js';
import type { Card } from '../domain/card.js';
import { el } from '../utils/dom.js';
import { attachFoil } from './motion.js';
import { categoryLabel } from './sets-index.js';

export interface ViewerAction {
  readonly label: string;
  readonly primary?: boolean;
  readonly onClick: () => void;
}

/**
 * Carta ampliada sobre um véu escuro: inclina e brilha com o ponteiro. Fecha tocando fora,
 * no botão ou com Esc, e devolve o foco a quem abriu.
 */
export function openCardViewer(
  card: Card,
  count?: number,
  actions: readonly ViewerAction[] = [],
  note?: string,
): void {
  const opener = document.activeElement as HTMLElement | null;
  const rank = bucketRank(card.bucket);
  const art = el('div', {
    className: `viewer__card rarity-${rank}`,
    children: [el('img', { attrs: { src: card.imageUrl, alt: card.name, draggable: 'false' } })],
  });
  const detachFoil = attachFoil(art, 14);
  if (rank >= 4) art.classList.add('is-foil-active');

  const closeBtn = el('button', {
    className: 'viewer__close btn btn--on-stage',
    attrs: { type: 'button' },
    text: 'Fechar',
  });
  const caption = el('p', {
    className: 'viewer__caption',
    text: `${card.name}, nº ${card.collectionNumber}. ${categoryLabel(card)}${
      count && count > 1 ? `, ${count} cópias` : ''
    }.${note ? ` ${note}` : ''}`,
  });
  const actionBtns = actions.map((a) => {
    const b = el('button', {
      className: `btn ${a.primary ? 'btn--primary' : 'btn--on-stage'}`,
      attrs: { type: 'button' },
      text: a.label,
    });
    b.addEventListener('click', () => {
      close();
      a.onClick();
    });
    return b;
  });
  const viewer = el('div', {
    className: 'viewer',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': card.name },
    children: [
      art,
      caption,
      el('div', { className: 'viewer__actions', children: [...actionBtns, closeBtn] }),
    ],
  });

  const close = () => {
    detachFoil();
    document.removeEventListener('keydown', onKey, true);
    viewer.classList.add('is-leaving');
    window.setTimeout(() => viewer.remove(), 180);
    opener?.focus();
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      close();
    }
  };
  viewer.addEventListener('click', (ev) => {
    if (ev.target === viewer) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  document.body.append(viewer);
  closeBtn.focus();
}
