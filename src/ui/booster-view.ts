import { generateBooster, type Booster, type BoosterSlot } from '../core/booster.js';
import { bucketRank, BUCKET_LABELS } from '../core/buckets.js';
import type { RNG } from '../core/rng.js';
import { mulberry32 } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection } from '../domain/collection.js';
import { playCelebrationSound, playFlipSound } from '../utils/audio.js';
import { clear, el, on, setText } from '../utils/dom.js';

const REVEAL_ANIMATION_MS = 600;

export interface AvailableSet {
  readonly id: string;
  readonly name: string;
}

export interface BoosterViewDeps {
  readonly mountPoint: HTMLElement;
  readonly catalog: Catalog;
  readonly setId: string;
  readonly masterRng: RNG;
  readonly getCollection: () => Collection;
  readonly onBoosterRevealed: (cardIds: readonly string[]) => void;
}

interface State {
  booster: Booster | null;
  revealedCount: number;
  animating: boolean;
  ownedBefore: ReadonlySet<string>;
}

export class BoosterView {
  private readonly state: State = {
    booster: null,
    revealedCount: 0,
    animating: false,
    ownedBefore: new Set<string>(),
  };
  private readonly disposers: Array<() => void> = [];

  constructor(private readonly deps: BoosterViewDeps) {
    this.renderClosed();
    this.bindKeyboard();
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
  }

  private bindKeyboard(): void {
    const off = on(document, 'keydown', (ev) => {
      if (ev.code !== 'Space') return;
      const target = ev.target as HTMLElement | null;
      // Ignore when focus is in an editable element.
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      // Only handle when booster section is visible.
      if (this.deps.mountPoint.closest('[role="tabpanel"]')?.hasAttribute('hidden')) return;
      ev.preventDefault();
      if (!this.state.booster || (this.state.revealedCount >= 6 && !this.state.animating)) {
        this.openNewBooster();
      } else {
        this.advance();
      }
    });
    this.disposers.push(off);
  }

  private renderClosed(): void {
    clear(this.deps.mountPoint);
    const wrap = el('div', { className: 'booster booster--closed' });
    wrap.append(this.renderStatsPanel());
    const pack = el('div', {
      className: 'booster-pack-big',
      attrs: { 'aria-hidden': 'true' },
    });
    pack.style.backgroundImage = `url('/${this.deps.setId}/capa.png?v=2')`;
    const openBtn = el('button', {
      className: 'btn btn--primary booster-open-btn',
      text: `Abrir ${this.deps.catalog.setName} (Espaço)`,
      attrs: { type: 'button' },
    });
    on(openBtn, 'click', () => this.openNewBooster());
    wrap.append(pack, openBtn);
    this.deps.mountPoint.append(wrap);
    openBtn.focus();
  }

  openBooster(): void {
    this.openNewBooster();
  }

  private renderStatsPanel(): HTMLElement {
    const collection = this.deps.getCollection();
    const stats = collection.bySet.get(this.deps.setId) ?? {
      boostersOpened: 0,
      cardsOpened: 0,
    };
    const total = this.deps.catalog.totalSet;
    let owned = 0;
    for (const card of this.deps.catalog.cards) {
      if (collection.entries.has(card.id)) owned++;
    }
    const missing = total - owned;
    return el('div', {
      className: 'booster-stats',
      attrs: { role: 'status', 'aria-live': 'polite' },
      children: [
        el('div', {
          className: 'booster-stats__item',
          children: [
            el('span', { className: 'booster-stats__label', text: 'Boosters abertos' }),
            el('strong', {
              className: 'booster-stats__value',
              text: String(stats.boostersOpened),
            }),
          ],
        }),
        el('div', {
          className: 'booster-stats__item',
          children: [
            el('span', { className: 'booster-stats__label', text: 'Coleção do set' }),
            el('strong', {
              className: 'booster-stats__value',
              text: `${owned}/${total}`,
            }),
          ],
        }),
        el('div', {
          className: 'booster-stats__item booster-stats__item--missing',
          children: [
            el('span', { className: 'booster-stats__label', text: 'Faltam' }),
            el('strong', {
              className: 'booster-stats__value',
              text: String(missing),
            }),
          ],
        }),
      ],
    });
  }

  private openNewBooster(): void {
    const seed = Math.floor(this.deps.masterRng.next() * 0x100000000);
    const booster = generateBooster(mulberry32(seed), this.deps.catalog, seed);
    this.state.booster = booster;
    this.state.revealedCount = 0;
    this.state.animating = false;
    this.state.ownedBefore = new Set(this.deps.getCollection().entries.keys());
    this.renderRevealing();
  }

  private renderRevealing(): void {
    const booster = this.state.booster;
    if (!booster) return;

    clear(this.deps.mountPoint);

    const wrap = el('div', { className: 'booster booster--open' });
    wrap.append(this.renderStatsPanel());

    const cards = el('div', { className: 'booster-cards' });
    booster.slots.forEach((slot, idx) => {
      cards.append(this.renderCard(slot, idx));
    });
    wrap.append(cards);

    const controls = el('div', { className: 'booster-controls' });
    const progress = el('span', {
      className: 'booster-controls__progress',
      attrs: { 'aria-live': 'polite' },
      text: this.progressText(),
    });
    const nextBtn = el('button', {
      className: 'btn btn--primary',
      text: 'Próxima (Espaço)',
      attrs: { type: 'button', 'data-action': 'next' },
    });
    const skipBtn = el('button', {
      className: 'btn btn--ghost',
      text: 'Pular tudo',
      attrs: { type: 'button', 'data-action': 'skip' },
    });
    on(nextBtn, 'click', () => this.advance());
    on(skipBtn, 'click', () => this.skipAll());
    controls.append(progress, nextBtn, skipBtn);
    wrap.append(controls);

    this.deps.mountPoint.append(wrap);
    nextBtn.focus();
  }

  private renderCard(slot: BoosterSlot, idx: number): HTMLElement {
    const rank = bucketRank(slot.effectiveBucket);
    const isNew = !this.state.ownedBefore.has(slot.card.id);
    const card = el('div', {
      className: `card rarity-${String(rank).padStart(2, '0')}${isNew ? ' is-new' : ''}`,
      dataset: { slotIndex: String(idx + 1), bucket: slot.effectiveBucket },
      attrs: {
        role: 'button',
        tabindex: '0',
        'aria-label': `Slot ${idx + 1}: ${slot.card.name} — ${BUCKET_LABELS[slot.effectiveBucket]}${isNew ? ' (nova!)' : ''}`,
      },
    });
    // Set z-index to ensure the first unrevealed card is on top
    card.style.zIndex = String(10 - idx);
    card.style.setProperty('--idx', String(idx));

    const inner = el('div', { className: 'card__inner' });
    const back = el('div', {
      className: 'card__face card__face--back',
      attrs: { 'aria-hidden': 'true' },
    });
    const front = el('div', { className: 'card__face card__face--front' });
    const img = el('img', {
      attrs: {
        src: slot.card.imageUrl,
        alt: slot.card.name,
        loading: 'lazy',
        decoding: 'async',
      },
    });
    front.append(img);
    if (isNew) {
      const badge = el('span', {
        className: 'card__new-badge',
        text: 'NEW',
        attrs: { 'aria-hidden': 'true' },
      });
      front.append(badge);
    }
    inner.append(back, front);
    card.append(inner);

    on(card, 'click', () => this.tryAdvanceFor(idx));
    on(card, 'keydown', (ev) => {
      if (ev.code === 'Enter') this.tryAdvanceFor(idx);
    });

    return card;
  }

  private tryAdvanceFor(idx: number): void {
    if (idx === this.state.revealedCount) this.advance();
  }

  private advance(): void {
    const booster = this.state.booster;
    if (!booster) return;
    if (this.state.animating) return;
    if (this.state.revealedCount >= 6) return;

    const idx = this.state.revealedCount;
    const cardEl = this.deps.mountPoint.querySelector(
      `.card[data-slot-index="${idx + 1}"]`,
    ) as HTMLElement | null;
    if (!cardEl) return;

    this.state.animating = true;
    cardEl.classList.add('is-revealed');
    this.state.revealedCount = idx + 1;

    // Check if the card is rare enough for celebration (04, 05, 06, 07 corresponds to buckets > 3)
    const slot = booster.slots[idx];
    if (slot) {
      const rank = bucketRank(slot.effectiveBucket);
      const isRare = rank >= 4;

      if (isRare) {
        cardEl.classList.add('is-celebration');
        playCelebrationSound();
      } else {
        playFlipSound();
      }
    } else {
      playFlipSound();
    }

    const progressEl = this.deps.mountPoint.querySelector(
      '.booster-controls__progress',
    ) as HTMLElement | null;
    if (progressEl) setText(progressEl, this.progressText());

    const isNew = !!slot && !this.state.ownedBefore.has(slot.card.id);
    const delay = isNew ? 800 : REVEAL_ANIMATION_MS;
    setTimeout(() => {
      this.state.animating = false;
      if (this.state.revealedCount === 6) {
        this.onAllRevealed();
      }
    }, delay);
  }

  private skipAll(): void {
    const booster = this.state.booster;
    if (!booster) return;
    const cards = this.deps.mountPoint.querySelectorAll('.card');
    cards.forEach((c, i) => {
      if (!c.classList.contains('is-revealed')) {
        c.classList.add('is-revealed');
        const slot = booster.slots[i];
        if (slot) {
          const rank = bucketRank(slot.effectiveBucket);
          if (rank >= 4) {
            c.classList.add('is-celebration');
          }
        }
      }
    });
    this.state.revealedCount = 6;
    playFlipSound(); // Play a generic flip when skipping all
    this.state.animating = false;
    const progressEl = this.deps.mountPoint.querySelector(
      '.booster-controls__progress',
    ) as HTMLElement | null;
    if (progressEl) setText(progressEl, this.progressText());
    this.onAllRevealed();
  }

  private onAllRevealed(): void {
    const booster = this.state.booster;
    if (!booster) return;

    this.deps.onBoosterRevealed(booster.slots.map((s) => s.card.id));

    const oldStats = this.deps.mountPoint.querySelector('.booster-stats');
    if (oldStats && oldStats.parentElement) {
      oldStats.parentElement.replaceChild(this.renderStatsPanel(), oldStats);
    }

    const controls = this.deps.mountPoint.querySelector('.booster-controls');
    if (!controls) return;
    clear(controls as HTMLElement);
    const newBoosterBtn = el('button', {
      className: 'btn btn--primary',
      text: 'Abrir outro booster (Espaço)',
      attrs: { type: 'button' },
    });
    on(newBoosterBtn, 'click', () => this.openNewBooster());
    (controls as HTMLElement).append(newBoosterBtn);
    newBoosterBtn.focus();
  }

  private progressText(): string {
    return `${this.state.revealedCount}/6 cartas reveladas`;
  }
}
