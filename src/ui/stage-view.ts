import { generateBooster, type Booster, type BoosterSlot } from '../core/booster.js';
import { bucketRank } from '../core/buckets.js';
import { HIT_BOOST } from '../core/distributions.js';
import { mulberry32, type RNG } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection } from '../domain/collection.js';
import type { PackResult, PulledCard } from '../game/career.js';
import { formatBRL, formatSigned, type Cents } from '../game/money.js';
import type { PriceBook } from '../game/prices.js';
import { playCelebrationSound, playFlipSound, playTearSound } from '../utils/audio.js';
import { el } from '../utils/dom.js';
import { SetBinderView } from './binder-view.js';
import { attachFoil, prefersReducedMotion, project, spring, VelocityTracker } from './motion.js';
import { categoryLabel, coverUrl, ownedCount, type SetInfo } from './sets-index.js';

export interface StageDeps {
  readonly root: HTMLElement;
  readonly set: SetInfo;
  readonly catalog: Catalog;
  readonly masterRng: RNG;
  readonly getCollection: () => Collection;
  /** Chamado assim que o pacote é rasgado: as cartas já são do jogador. */
  readonly onCardsOpened: (cardIds: readonly string[]) => void;
  readonly onClose: () => void;
  /** Presente só no modo Carreira. */
  readonly career?: StageCareer;
}

export interface StageCareer {
  /** Preço do pacote; null quando não há preço conhecido (não dá para comprar). */
  readonly priceCents: Cents | null;
  readonly priceBook: PriceBook;
  readonly walletCents: () => Cents;
  /** Paga o pacote e guarda as cartas na Carreira; devolve lucro, fama e conquistas. */
  readonly onPack: (cards: readonly PulledCard[]) => PackResult;
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
    if (this.sheet) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.closeBinder();
      }
      return;
    }
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
    this.binderBtn = el('button', {
      className: 'stage__close stage__binder',
      attrs: { type: 'button', 'aria-label': `Ver o fichário de ${this.deps.set.name}` },
      text: 'Fichário',
    });
    this.binderBtn.addEventListener('click', () => this.openBinder());
    const bar = el('div', {
      className: 'stage__bar',
      children: [
        close,
        el('p', { className: 'stage__title', text: this.deps.set.name }),
        el('div', { className: 'stage__end', children: [this.counter, this.binderBtn] }),
      ],
    });
    this.body = el('div', { className: 'stage__body' });
    // Toque em qualquer lugar (fora de botões e links): passa a carta ou abre outro pacote.
    this.body.addEventListener('click', (ev) => {
      if (ev.target instanceof Element && ev.target.closest('button, a, .tear')) return;
      if (this.phase === 'reveal') this.flingTop(-1, 0);
      else if (this.phase === 'summary' && performance.now() - this.summaryAt > 600) this.restart();
    });
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

    this.body.replaceChildren(
      el('div', { className: 'stage__pack', children: [this.pack] }),
      ...this.priceLine(),
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

  private priceLine(): HTMLElement[] {
    const c = this.deps.career;
    if (!c) return [el('p', { className: 'stage__hint', text: 'Toque para abrir' })];
    if (c.priceCents === null) {
      return [el('p', { className: 'stage__price is-short', text: 'Esta coleção ainda não tem preço de pacote.' })];
    }
    const wallet = c.walletCents();
    if (wallet < c.priceCents) {
      this.pack.setAttribute('aria-disabled', 'true');
      return [
        el('p', {
          className: 'stage__price is-short',
          text: `Custa ${formatBRL(c.priceCents)} e você tem ${formatBRL(wallet)}. Venda repetidas ou complete missões.`,
        }),
        el('a', { className: 'btn btn--on-stage', attrs: { href: '#/carreira' }, text: 'Ver missões' }),
      ];
    }
    return [
      el('p', {
        className: 'stage__price',
        text: `Custa ${formatBRL(c.priceCents)}. Seu saldo: ${formatBRL(wallet)}.`,
      }),
      el('p', { className: 'stage__hint', text: 'Toque para abrir' }),
    ];
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
      if (this.phase !== 'sealed' || !this.canOpen()) return;
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
        this.autoTear();
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

  /** No modo Carreira, só abre com saldo para pagar o pacote. */
  private canOpen(): boolean {
    const c = this.deps.career;
    return !c || (c.priceCents !== null && c.walletCents() >= c.priceCents);
  }

  /** Rasgo pelo botão/teclado: o estado avança na hora; a animação só acompanha. */
  private autoTear(): void {
    if (this.phase !== 'sealed' || !this.canOpen()) return;
    this.tearDir = 1;
    this.completeTear(2);
  }

  /** O lacre sai voando com a velocidade do dedo e as cartas sobem do pacote. */
  private completeTear(velocity: number): void {
    if (this.phase !== 'sealed' || !this.canOpen()) return;
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
    this.booster = generateBooster(mulberry32(seed), this.deps.catalog, seed, HIT_BOOST);
    this.revealed = 0;
    const career = this.deps.career;
    if (career) {
      this.packResult = career.onPack(
        this.booster.slots.map((s) => ({
          id: s.card.id,
          rank: bucketRank(s.effectiveBucket),
          rarityRaw: s.card.rarityRaw,
          valueCents: career.priceBook.valueOf(s.card),
          packOnly: this.isPackOnly(s),
        })),
      );
    } else {
      this.deps.onCardsOpened(this.booster.slots.map((s) => s.card.id));
    }
  }

  private packResult: PackResult | null = null;

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
          'aria-label': `${slot.card.name}, ${categoryLabel(slot.card, slot.effectiveBucket)}${this.isNew(slot) ? ', nova' : ''}. Toque para a próxima.`,
        },
        children: [
          el('img', {
            attrs: { src: slot.card.imageUrl, alt: '', draggable: 'false', decoding: 'async' },
          }),
          ...(this.isNew(slot)
            ? [el('span', { className: 'deck__new', text: 'Nova' })]
            : []),
          ...this.subsetTag(slot),
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
      if (!moved) return; // o clique no palco avança
      const { vx, vy } = tracker.velocity();
      const w = card.clientWidth;
      const projected = offset.x + project(vx);
      if (Math.abs(projected) > w * FLING_DISTANCE || Math.abs(vx) > FLING_VELOCITY) {
        this.suppressClick();
        this.flingTop(Math.sign(projected) || 1, vy, vx, offset);
      } else {
        this.suppressClick();
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

  /** Engole o próximo clique (o que o navegador dispara ao soltar um arrasto). */
  private suppressClick(): void {
    const stop = (ev: Event) => ev.stopPropagation();
    this.body.addEventListener('click', stop, { capture: true, once: true });
    window.setTimeout(() => this.body.removeEventListener('click', stop, { capture: true }), 0);
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

  /** Selo da subcoleção (ex.: Clássica), para não confundir com a raridade da carta. */
  private subsetTag(slot: BoosterSlot): HTMLElement[] {
    return slot.card.subset && !this.isPackOnly(slot)
      ? [el('span', { className: 'deck__subset', text: categoryLabel(slot.card) })]
      : [];
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

  /** Momento em que o resumo apareceu: um toque a mais logo depois não o pula. */
  private summaryAt = 0;

  private renderSummary(): void {
    const booster = this.booster;
    if (!booster || this.phase === 'summary') return;
    this.phase = 'summary';
    this.summaryAt = performance.now();
    this.body.classList.remove('is-revealing');
    const fresh = booster.slots.filter((s) => this.isNew(s)).length;
    const owned = ownedCount(this.deps.set, this.deps.getCollection());
    this.counter.textContent = `${booster.slots.length} de ${booster.slots.length}`;

    const grid = el('ul', { className: 'summary__grid' });
    for (const slot of booster.slots) {
      const rank = bucketRank(slot.effectiveBucket);
      const isNew = this.isNew(slot);
      const btn = el('div', {
        className: `summary__card rarity-${rank}${rank >= 4 ? ' is-hit' : ''}`,
        attrs: {
          role: 'img',
          'aria-label': `${slot.card.name}, ${categoryLabel(slot.card, slot.effectiveBucket)}${isNew ? ', nova' : ''}`,
        },
        children: [
          el('img', { attrs: { src: slot.card.imageUrl, alt: '', loading: 'lazy' } }),
          ...(isNew ? [el('span', { className: 'deck__new', text: 'Nova' })] : []),
          ...this.subsetTag(slot),
          ...(this.deps.career && !this.isPackOnly(slot)
            ? [el('span', { className: 'value-tag', text: formatBRL(this.deps.career.priceBook.valueOf(slot.card)) })]
            : []),
        ],
      });
      grid.append(el('li', { children: [btn] }));
    }

    const again = el('button', {
      className: 'btn btn--primary',
      attrs: { type: 'button' },
      text: 'Abrir outro pacote',
    });
    again.addEventListener('click', () => this.restart());
    const binder = el('button', {
      className: 'btn btn--on-stage',
      attrs: { type: 'button' },
      text: 'Ver no fichário',
    });
    binder.addEventListener('click', () => this.openBinder());

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
          ...this.careerSummary(),
          grid,
          el('div', { className: 'summary__actions', children: [again, binder] }),
          el('p', { className: 'stage__hint', text: 'Toque em qualquer lugar para abrir outro' }),
        ],
      }),
    );
    again.focus({ preventScroll: true });
  }

  private careerSummary(): HTMLElement[] {
    const r = this.packResult;
    if (!this.deps.career || !r) return [];
    const cell = (label: string, value: string, cls = '') => [
      el('span', { className: 'pnl__label', text: label }),
      el('span', { className: `pnl__value ${cls}`, text: value }),
    ];
    // A melhor carta é a notícia; o lucro só aparece quando existe (prejuízo é a regra).
    const best = [...(this.booster?.slots ?? [])]
      .filter((s) => !this.isPackOnly(s))
      .sort((a, b) => this.deps.career!.priceBook.valueOf(b.card) - this.deps.career!.priceBook.valueOf(a.card))[0];
    const columns: HTMLElement[][] = [];
    if (best) columns.push(cell('Melhor carta', `${best.card.name}, ${formatBRL(this.deps.career.priceBook.valueOf(best.card))}`));
    columns.push(cell('Cartas valem', formatBRL(r.valueCents)));
    if (r.profitCents > 0) columns.push(cell('Lucro', formatSigned(r.profitCents), 'is-up'));
    // Grade: rótulos na primeira linha, valores na segunda.
    const pnl = el('div', {
      className: 'pnl',
      children: [...columns.map((c) => c[0]!), ...columns.map((c) => c[1]!)],
    });
    pnl.style.gridTemplateColumns = `repeat(${columns.length}, auto)`;
    const toasts = el('ul', { className: 'toasts' });
    toasts.append(el('li', { className: 'toast', text: `+${r.fameGained} de fama` }));
    r.unlocked.forEach((a, i) => {
      const t = el('li', { className: 'toast', text: `Conquista: ${a.title}` });
      t.style.animationDelay = `${(i + 1) * 120}ms`;
      toasts.append(t);
    });
    return [pnl, toasts];
  }

  // ── Fichário desta coleção, por cima do palco ─────────────────────────────────

  private binderBtn!: HTMLButtonElement;
  private sheet: HTMLElement | null = null;

  /** Abre o fichário só desta coleção sem sair do palco; fechar volta ao mesmo ponto. */
  private openBinder(): void {
    if (this.sheet) return;
    const back = el('button', {
      className: 'btn btn--quiet',
      attrs: { type: 'button' },
      text: 'Voltar ao pacote',
    });
    back.addEventListener('click', () => this.closeBinder());
    const content = el('div', { className: 'stage-sheet__content' });
    this.sheet = el('div', {
      className: 'stage-sheet',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': `Fichário de ${this.deps.set.name}` },
      children: [el('div', { className: 'stage-sheet__bar', children: [back] }), content],
    });
    new SetBinderView(content, this.deps.set, this.deps.catalog, this.deps.getCollection, { embedded: true });
    this.deps.root.append(this.sheet);
    back.focus({ preventScroll: true });
  }

  private closeBinder(): void {
    const sheet = this.sheet;
    if (!sheet) return;
    this.sheet = null;
    sheet.classList.add('is-leaving');
    window.setTimeout(() => sheet.remove(), 200);
    if (this.phase === 'reveal') this.cardEls[this.revealed]?.focus({ preventScroll: true });
    else this.binderBtn.focus({ preventScroll: true });
  }

  private restart(): void {
    this.cleanups.splice(1).forEach((c) => c());
    this.booster = null;
    this.packResult = null;
    this.tearProgress = 0;
    this.renderSealed();
  }
}
