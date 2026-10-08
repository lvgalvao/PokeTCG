import { bucketRank, BUCKET_LABELS } from '../core/buckets.js';
import type { Card } from '../domain/card.js';
import { el } from '../utils/dom.js';
import { attachFoil } from './motion.js';

/**
 * Carta ampliada sobre um véu escuro: inclina e brilha com o ponteiro. Fecha tocando fora,
 * no botão ou com Esc, e devolve o foco a quem abriu.
 */
export function openCardViewer(card: Card, count?: number): void {
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
    text: `${card.name}, nº ${card.collectionNumber}. ${BUCKET_LABELS[card.bucket]}${
      count && count > 1 ? `, ${count} cópias` : ''
    }.`,
  });
  const viewer = el('div', {
    className: 'viewer',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': card.name },
    children: [art, caption, closeBtn],
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
