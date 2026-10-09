import type { Card } from '../domain/card.js';
import { playCelebrationSound, playTradeSound } from '../utils/audio.js';
import { el } from '../utils/dom.js';
import { prefersReducedMotion } from './motion.js';

const CONFETTI_COLORS = ['#e3350d', '#f2c94c', '#3a7bd5', '#4f9d69', '#ec4899', '#8b5cf6'];

function cardImgs(cards: readonly Card[], cls: string): HTMLElement {
  const stack = el('div', { className: `celebrate__stack ${cls}` });
  cards.slice(0, 6).forEach((c, i) => {
    const img = el('img', { className: 'celebrate__card', attrs: { src: c.imageUrl, alt: c.name } });
    img.style.setProperty('--i', String(i));
    img.style.setProperty('--n', String(Math.min(cards.length, 6)));
    stack.append(img);
  });
  if (cards.length > 6) stack.append(el('span', { className: 'celebrate__more', text: `+${cards.length - 6}` }));
  return stack;
}

function confetti(): HTMLElement {
  const layer = el('div', { className: 'celebrate__confetti', attrs: { 'aria-hidden': 'true' } });
  if (prefersReducedMotion()) return layer;
  for (let i = 0; i < 80; i++) {
    const piece = el('span');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
    piece.style.animationDelay = `${0.5 + Math.random() * 0.8}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
    layer.append(piece);
  }
  return layer;
}

/**
 * Festa da troca: as cartas que você deu saem por um lado, as que você ganhou entram pelo
 * outro, confete, som e vibração. Fecha com o botão, Esc ou tocando fora.
 */
export function celebrateTrade(given: readonly Card[], received: readonly Card[], partnerName: string): void {
  document.querySelector('.celebrate')?.remove();
  const close = el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, text: 'Oba!' });
  const binder = el('a', { className: 'btn btn--on-stage', attrs: { href: '#/fichario' }, text: 'Ver no fichário' });
  const overlay = el('div', {
    className: 'celebrate',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Troca feita' },
    children: [
      confetti(),
      el('div', {
        className: 'celebrate__table',
        children: [
          el('div', {
            className: 'celebrate__side is-out',
            children: [el('p', { className: 'celebrate__label', text: `Foi para ${partnerName}` }), cardImgs(given, 'is-out')],
          }),
          el('div', { className: 'celebrate__swap', attrs: { 'aria-hidden': 'true' }, text: '⇄' }),
          el('div', {
            className: 'celebrate__side is-in',
            children: [el('p', { className: 'celebrate__label', text: 'Chegou para você' }), cardImgs(received, 'is-in')],
          }),
        ],
      }),
      el('h2', { className: 'celebrate__title', text: 'Troca feita!' }),
      el('p', {
        className: 'celebrate__meta',
        text: received.length
          ? `${received.length === 1 ? 'Uma carta nova chegou' : `${received.length} cartas novas chegaram`} no seu fichário.`
          : `Você deu ${given.length === 1 ? 'uma carta' : `${given.length} cartas`} de presente para ${partnerName}.`,
      }),
      el('div', { className: 'celebrate__actions', children: [close, binder] }),
    ],
  });

  const dismiss = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.classList.add('is-leaving');
    window.setTimeout(() => overlay.remove(), 220);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      dismiss();
    }
  };
  close.addEventListener('click', dismiss);
  binder.addEventListener('click', dismiss);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) dismiss();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  close.focus({ preventScroll: true });

  playTradeSound();
  window.setTimeout(playCelebrationSound, 900);
  navigator.vibrate?.([20, 60, 20, 60, 120]);
}
