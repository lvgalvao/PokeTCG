import { generateBooster, type Booster, type BoosterSlot } from '../core/booster.js';
import { bucketRank, BUCKET_LABELS } from '../core/buckets.js';
import { mulberry32, type RNG } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection } from '../domain/collection.js';
import { playCelebrationSound, playFlipSound, playTearSound } from '../utils/audio.js';
import { el } from '../utils/dom.js';
import { openCardViewer } from './card-viewer.js';
import { attachFoil, prefersReducedMotion, project, spring, VelocityTracker } from './motion.js';
import { coverUrl, ownedCount, type SetInfo } from './sets-index.js';

export interface StageDeps {
  readonly root: HTMLElement;
  readonly set: SetInfo;
  readonly catalog: Catalog;
  readonly masterRng: RNG;
  readonly getCollection: () => Collection;
  /** Chamado assim que o pacote é rasgado: as cartas já são do jogador. */
  readonly onCardsOpened: (cardIds: readonly string[]) => void;
  readonly onClose: () => void;
}

type Phase = 'sealed' | 'reveal' | 'summary';

/** Distância (fração da largura) a partir da qual soltar o lacre completa o rasgo. */
const TEAR_COMMIT = 0.5;
const TEAR_FLICK_VELOCITY = 900;
const FLING_DISTANCE = 0.35;
const FLING_VELOCITY = 700;

/**
 * Palco de abertura: rasgar o lacre com o dedo, passar as cartas uma a uma (comuns na
 * frente, hits no fundo, como no pacote real) e ver o resumo.
 */
export class StageView {
  private phase: Phase = 'sealed';
  private booster: Booster | null = null;
  private ownedBefore: ReadonlySet<string> = new Set();
  private revealed = 0;
  private readonly cleanups: Array<() => void> = [];
  private body!: HTMLElement;
  private counter!: HTMLElement;

  constructor(private readonly deps: StageDeps) {
    // O listener de teclado é sempre cleanups[0]: restart() preserva só ele.
    const onKey = (ev: KeyboardEvent) => this.onKey(ev);
    document.addEventListener('keydown', onKey);
    this.cleanups.push(() => document.removeEventListener('keydown', onKey));
    this.renderShell();
    this.renderSealed();
  }

  destroy(): void {
    this.cleanups.forEach((c) => c());
    this.cleanups.length = 0;
  }

  private onKey(ev: KeyboardEvent): void {
    if (document.querySelector('.viewer')) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.deps.onClose();
      return;
    }
    if (ev.code !== 'Space' && ev.key !== 'Enter' && ev.key !== 'ArrowRight') return;
    // Em botões e links, Espaço/Enter já disparam o clique nativo.
    if (ev.target instanceof Element && ev.target.closest('button, a')) return;
    ev.preventDefault();
    if (this.phase === 'sealed') this.autoTear();
    else if (this.phase === 'reveal') this.flingTop(1, 0);
    else if (ev.code === 'Space') this.restart();
  }

  private renderShell(): void {
    const close = el('button', {
      className: 'stage__close',
      attrs: { type: 'button', 'aria-label': 'Voltar à loja' },
      text: 'Loja',
    });
    close.addEventListener('click', () => this.deps.onClose());
    this.counter = el('p', { className: 'stage__counter', attrs: { 'aria-live': 'polite' } });
    const bar = el('div', {
      className: 'stage__bar',
      children: [
        close,
        el('p', { className: 'stage__title', text: this.deps.set.name }),
        this.counter,
      ],
    });
    this.body = el('div', { className: 'stage__body' });
    this.deps.root.replaceChildren(bar, this.body);
  }

  // ── 1. Pacote lacrado ────────────────────────────────────────────────────────────

  private tearProgress = 0;
  private tearDir = 1;
  private strip!: HTMLElement;
  private packBody!: HTMLElement;
  private pack!: HTMLElement;
  private cancelTearSpring: (() => void) | null = null;

  private renderSealed(): void {
    this.phase = 'sealed';
    this.counter.textContent = `${this.deps.set.packSize} cartas`;
    const src = coverUrl(this.deps.set.id);
    const img = (cls: string) =>
      el('img', { className: cls, attrs: { src, alt: '', draggable: 'false' } });
    this.packBody = img('tear__body');
    this.strip = img('tear__strip');
    this.pack = el('div', {
      className: 'tear',
      attrs: {
        role: 'button',
        tabindex: '0',
        'aria-label': `Rasgar o pacote de ${this.deps.set.name}`,
      },
      children: [
        this.packBody,
        this.strip,
        el('span', { className: 'tear__line', attrs: { 'aria-hidden': 'true' } }),
      ],
    });
    this.cleanups.push(attachFoil(this.pack, 6));
    this.bindTear();

    const openBtn = el('button', {
      className: 'btn btn--on-stage',
      attrs: { type: 'button' },
      text: 'Rasgar para mim',
    });
    openBtn.addEventListener('click', () => this.autoTear());

    this.body.replaceChildren(
      el('div', { className: 'stage__pack', children: [this.pack] }),
      el('p', {
        className: 'stage__hint',
        text: 'Arraste para abrir',
      }),
      openBtn,
    );
    this.pack.focus({ preventScroll: true });
    // Affordance: o lacre se ergue um pouco sozinho, mostrando o gesto.
    window.setTimeout(() => {
      if (this.phase !== 'sealed' || this.tearProgress !== 0) return;
      this.cancelTearSpring = spring(0.22, 0, (v) => {
        this.tearProgress = v;
        this.renderTear();
      }, { damping: 0.45, response: 0.5 });
    }, 650);
  }

  private renderTear(): void {
    const p = this.tearProgress;
    const w = this.pack.clientWidth;
    const lift = Math.min(p, 1.6);
    this.strip.style.transformOrigin = this.tearDir > 0 ? '0% 100%' : '100% 100%';
    this.strip.style.transform = `translate(${this.tearDir * lift * w * 0.32}px, ${-lift * 18}px) rotate(${-this.tearDir * lift * 14}deg)`;
    this.strip.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 1) * 1.6));
    this.pack.style.setProperty('--tear', String(Math.min(p, 1)));
  }

  private bindTear(): void {
    const tracker = new VelocityTracker();
    let startX = 0;
    let dragging = false;
    let moved = false;

    this.pack.addEventListener('pointerdown', (ev) => {
      if (this.phase !== 'sealed') return;
      this.cancelTearSpring?.();
      this.pack.setPointerCapture(ev.pointerId);
      dragging = true;
      moved = false;
      startX = ev.clientX - (this.tearProgress * this.pack.clientWidth * 0.9 * this.tearDir);
      tracker.reset();
      tracker.add(ev.clientX, ev.clientY);
    });
    this.pack.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      tracker.add(ev.clientX, ev.clientY);
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 8) return;
      moved = true;
      this.tearDir = dx >= 0 ? 1 : -1;
      this.tearProgress = Math.abs(dx) / (this.pack.clientWidth * 0.9);
      this.renderTear();
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        this.nudgeHint();
        return;
      }
      const { vx } = tracker.velocity();
      const towards = Math.sign(vx) === this.tearDir;
      if (this.tearProgress >= TEAR_COMMIT || (towards && Math.abs(vx) > TEAR_FLICK_VELOCITY)) {
        const w = this.pack.clientWidth * 0.9;
        this.completeTear(Math.abs(vx) / w);
      } else {
        this.cancelTearSpring = spring(
          this.tearProgress,
          0,
          (v) => {
            this.tearProgress = v;
            this.renderTear();
          },
          { damping: 0.8, response: 0.3 },
        );
      }
    };
    this.pack.addEventListener('pointerup', end);
    this.pack.addEventListener('pointercancel', end);
  }

  private nudgeHint(): void {
    const hint = this.body.querySelector('.stage__hint');
    hint?.classList.remove('is-nudged');
    void (hint as HTMLElement | null)?.offsetWidth;
    hint?.classList.add('is-nudged');
    this.cancelTearSpring?.();
    this.cancelTearSpring = spring(
      0.18,
      0,
      (v) => {
        this.tearProgress = v;
        this.renderTear();
      },
      { damping: 0.5, response: 0.35 },
    );
  }

  /** Rasgo pelo botão/teclado: o estado avança na hora; a animação só acompanha. */
  private autoTear(): void {
    if (this.phase !== 'sealed') return;
    this.tearDir = 1;
    this.completeTear(2);
  }

  /** O lacre sai voando com a velocidade do dedo e as cartas sobem do pacote. */
  private completeTear(velocity: number): void {
    if (this.phase !== 'sealed') return;
    this.phase = 'reveal';
    playTearSound();
    navigator.vibrate?.(12);
    this.pack.classList.add('is-torn');
    this.cancelTearSpring?.();
    spring(
      this.tearProgress,
      2.2,
      (v) => {
        this.tearProgress = v;
        this.renderTear();
      },
      { damping: 1, response: 0.4, velocity: Math.max(velocity, 1.5) },
    );
    this.openBooster();
    window.setTimeout(() => this.renderReveal(), prefersReducedMotion() ? 0 : 380);
  }

  private openBooster(): void {
    const seed = Math.floor(this.deps.masterRng.next() * 0x100000000);
    (window as unknown as Record<string, unknown>).__pkmnLastBoosterSeed = seed;
    this.ownedBefore = new Set(this.deps.getCollection().entries.keys());
    this.booster = generateBooster(mulberry32(seed), this.deps.catalog, seed);
    this.revealed = 0;
    this.deps.onCardsOpened(this.booster.slots.map((s) => s.card.id));
  }

  // ── 2. Cartas, uma a uma ────────────────────────────────────────────────────────

  private deck!: HTMLElement;
  private tray!: HTMLElement;
  private cardEls: HTMLElement[] = [];

  private isPackOnly(slot: BoosterSlot): boolean {
    return this.deps.catalog.packOnly.includes(slot.card);
  }

  /** Nova para o fichário; cartas só-de-pacote (Energia básica) não contam. */
  private isNew(slot: BoosterSlot): boolean {
    return !this.ownedBefore.has(slot.card.id) && !this.isPackOnly(slot);
  }

  /** Avança `revealed` por cima das cartas só-de-pacote, que já estão na bandeja. */
  private skipPackOnly(): void {
    const slots = this.booster?.slots ?? [];
    while (this.revealed < slots.length && this.isPackOnly(slots[this.revealed]!)) this.revealed++;
  }

  private renderReveal(): void {
    const booster = this.booster;
    if (!booster) return;
    this.deck = el('div', { className: 'deck', attrs: { 'aria-live': 'polite' } });
    this.cardEls = booster.slots.map((slot, i) => {
      const rank = bucketRank(slot.effectiveBucket);
      const card = el('div', {
        className: `deck__card rarity-${rank}${rank >= 4 ? ' is-hit' : ''}`,
        attrs: {
          role: 'button',
          tabindex: '-1',
          'aria-label': `${slot.card.name}, ${BUCKET_LABELS[slot.effectiveBucket]}${this.isNew(slot) ? ', nova' : ''}. Toque para a próxima.`,
        },
        children: [
          el('img', {
            attrs: { src: slot.card.imageUrl, alt: '', draggable: 'false', decoding: 'async' },
          }),
          ...(this.isNew(slot)
            ? [el('span', { className: 'deck__new', text: 'Nova' })]
            : []),
        ],
      });
      card.style.zIndex = String(booster.slots.length - i);
      card.style.setProperty('--depth', String(i));
      return card;
    });
    this.tray = el('div', { className: 'tray', attrs: { 'aria-hidden': 'true' } });
    // Cartas só-de-pacote (Energia básica) não são do fichário: vão direto para a bandeja.
    booster.slots.forEach((slot, i) => {
      if (this.isPackOnly(slot)) {
        this.cardEls[i]!.remove();
        this.addToTray(slot);
      }
    });
    this.deck.append(...this.cardEls.filter((_, i) => !this.isPackOnly(booster.slots[i]!)));
    this.skipPackOnly();

    const skip = el('button', {
      className: 'btn btn--on-stage',
      attrs: { type: 'button' },
      text: 'Ver todas',
    });
    skip.addEventListener('click', () => this.renderSummary());

    this.body.replaceChildren(
      el('div', { className: 'stage__deck', children: [this.deck] }),
      el('div', { className: 'stage__actions', children: [skip] }),
      this.tray,
    );
    this.body.classList.add('is-revealing');
    this.focusTop();
  }

  private focusTop(): void {
    const booster = this.booster;
    if (!booster) return;
    const deckSlots = booster.slots.filter((s) => !this.isPackOnly(s));
    const seen = booster.slots.slice(0, this.revealed).filter((s) => !this.isPackOnly(s)).length;
    this.counter.textContent = `${Math.min(seen + 1, deckSlots.length)} de ${deckSlots.length}`;
    const top = this.cardEls[this.revealed];
    if (!top) return;
    this.cardEls.forEach((c, i) => c.style.setProperty('--depth', String(Math.max(0, i - this.revealed))));
    top.tabIndex = 0;
    top.focus({ preventScroll: true });
    this.cleanups.push(attachFoil(top, 8));
    this.bindFling(top);
    const slot = booster.slots[this.revealed]!;
    if (bucketRank(slot.effectiveBucket) >= 4) {
      top.classList.add('is-foil-active', 'is-celebrating');
      playCelebrationSound();
      navigator.vibrate?.([10, 40, 18]);
    }
  }

  private bindFling(card: HTMLElement): void {
    const tracker = new VelocityTracker();
    let start = { x: 0, y: 0 };
    let offset = { x: 0, y: 0 };
    let dragging = false;
    let moved = false;
    const render = () => {
      card.style.transform = `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x * 0.06}deg)`;
    };
    card.addEventListener('pointerdown', (ev) => {
      if (card !== this.cardEls[this.revealed]) return;
      card.setPointerCapture(ev.pointerId);
      dragging = true;
      moved = false;
      start = { x: ev.clientX - offset.x, y: ev.clientY - offset.y };
      tracker.reset();
      tracker.add(ev.clientX, ev.clientY);
    });
    card.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      tracker.add(ev.clientX, ev.clientY);
      offset = { x: ev.clientX - start.x, y: ev.clientY - start.y };
      if (Math.hypot(offset.x, offset.y) > 6) moved = true;
      if (moved) render();
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        this.flingTop(-1, 0);
        return;
      }
      const { vx, vy } = tracker.velocity();
      const w = card.clientWidth;
      const projected = offset.x + project(vx);
      if (Math.abs(projected) > w * FLING_DISTANCE || Math.abs(vx) > FLING_VELOCITY) {
        this.flingTop(Math.sign(projected) || 1, vy, vx, offset);
      } else {
        const from = { ...offset };
        spring(1, 0, (t) => {
          offset = { x: from.x * t, y: from.y * t };
          render();
        }, { damping: 0.8, response: 0.3 });
      }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  /** Joga a carta do topo para o lado (herdando a velocidade) e mostra a próxima. */
  private flingTop(dir: number, vy: number, vx = 0, from = { x: 0, y: 0 }): void {
    const booster = this.booster;
    if (!booster || this.phase !== 'reveal') return;
    const card = this.cardEls[this.revealed];
    if (!card) return;
    playFlipSound();
    const slot = booster.slots[this.revealed]!;
    const travel = window.innerWidth * 0.75 * dir;
    card.classList.add('is-gone');
    card.tabIndex = -1;
    spring(
      0,
      1,
      (t) => {
        const x = from.x + (travel - from.x) * t;
        const y = from.y + (vy / 6) * t;
        card.style.transform = `translate(${x}px, ${y}px) rotate(${x * 0.06}deg)`;
        card.style.opacity = String(1 - t * 0.9);
      },
      { response: 0.35, velocity: Math.abs(vx) / Math.max(Math.abs(travel - from.x), 1) },
      () => card.remove(),
    );
    this.addToTray(slot);
    this.revealed++;
    this.skipPackOnly();
    if (this.revealed >= booster.slots.length) {
      window.setTimeout(() => this.renderSummary(), prefersReducedMotion() ? 0 : 320);
    } else {
      this.focusTop();
    }
  }

  private addToTray(slot: BoosterSlot): void {
    const rank = bucketRank(slot.effectiveBucket);
    this.tray.append(
      el('img', {
        className: `tray__card rarity-${rank}`,
        attrs: { src: slot.card.imageUrl, alt: '' },
      }),
    );
  }

  // ── 3. Resumo ───────────────────────────────────────────────────────────────────

  private renderSummary(): void {
    const booster = this.booster;
    if (!booster || this.phase === 'summary') return;
    this.phase = 'summary';
    this.body.classList.remove('is-revealing');
    const fresh = booster.slots.filter((s) => this.isNew(s)).length;
    const owned = ownedCount(this.deps.set, this.deps.getCollection());
    this.counter.textContent = `${booster.slots.length} de ${booster.slots.length}`;

    const grid = el('ul', { className: 'summary__grid' });
    for (const slot of booster.slots) {
      const rank = bucketRank(slot.effectiveBucket);
      const isNew = this.isNew(slot);
      const btn = el('button', {
        className: `summary__card rarity-${rank}${rank >= 4 ? ' is-hit' : ''}`,
        attrs: {
          type: 'button',
          'aria-label': `${slot.card.name}, ${BUCKET_LABELS[slot.effectiveBucket]}${isNew ? ', nova' : ''}. Ampliar.`,
        },
        children: [
          el('img', { attrs: { src: slot.card.imageUrl, alt: '', loading: 'lazy' } }),
          ...(isNew ? [el('span', { className: 'deck__new', text: 'Nova' })] : []),
        ],
      });
      btn.addEventListener('click', () => openCardViewer(slot.card));
      grid.append(el('li', { children: [btn] }));
    }

    const again = el('button', {
      className: 'btn btn--primary',
      attrs: { type: 'button' },
      text: 'Abrir outro pacote',
    });
    again.addEventListener('click', () => this.restart());
    const binder = el('a', {
      className: 'btn btn--on-stage',
      attrs: { href: `#/fichario/${this.deps.set.id}` },
      text: 'Ver no fichário',
    });

    this.body.replaceChildren(
      el('div', {
        className: 'summary',
        children: [
          el('h2', {
            className: 'summary__title',
            text:
              fresh === 0
                ? 'Nenhuma carta nova desta vez'
                : fresh === 1
                  ? '1 carta nova'
                  : `${fresh} cartas novas`,
          }),
          el('p', {
            className: 'summary__meta',
            text: `Agora você tem ${owned} de ${this.deps.set.albumSize} cartas de ${this.deps.set.name}.`,
          }),
          grid,
          el('div', { className: 'summary__actions', children: [again, binder] }),
        ],
      }),
    );
    again.focus({ preventScroll: true });
  }

  private restart(): void {
    this.cleanups.splice(1).forEach((c) => c());
    this.booster = null;
    this.tearProgress = 0;
    this.renderSealed();
  }
}
