import { generateBooster, type Booster, type BoosterSlot } from '../core/booster.js';
import { bucketRank } from '../core/buckets.js';
import { mulberry32, type RNG } from '../core/rng.js';
import type { Catalog } from '../domain/catalog.js';
import type { Collection } from '../domain/collection.js';
import { playCelebrationSound, playChaseSound, playFlipSound, playTearSound } from '../utils/audio.js';
import { el } from '../utils/dom.js';
import { SetBinderView } from './binder-view.js';
import { openCardViewer } from './card-viewer.js';
import { chaseCardsFor, formatBrl, setPricesFor, type ChaseCard, type SetPrices } from './chase-cards.js';
import { loadLuck, LUCK_OPTIONS, luckLabel, saveLuck, type Luck } from './luck.js';
import { attachFoil, prefersReducedMotion, project, spring, VelocityTracker } from './motion.js';
import { categoryLabel, coverUrl, fanPosition, ownedCount, type ClassicInfo, type SetInfo } from './sets-index.js';

export interface StageDeps {
  readonly root: HTMLElement;
  readonly set: SetInfo;
  readonly catalog: Catalog;
  /** Todas as Clássicas do 30 anos, com a coleção e o ano da original. */
  readonly classics: readonly ClassicInfo[];
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
/** Quanto esperar as imagens do pacote carregarem antes de mostrar a primeira carta. */
const PRELOAD_MAX_MS = 1500;
/** Por quanto tempo uma das 3 mais valiosas segura o palco antes de deixar passar. */
const CHASE_HOLD_MS = 2800;
const CHASE_PLACES = ['A mais valiosa!', 'A 2ª mais valiosa!', 'A 3ª mais valiosa!'];
const CONFETTI_COLORS = ['#f2c94c', '#ffe08a', '#e3350d', '#ffffff', '#f59e0b'];

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
  /** As 3 mais valiosas do set (vazio se o set não tem preços). */
  private chase: ChaseCard[] = [];
  /** Até quando a carta do topo não pode ser passada (mais valiosa em destaque). */
  private lockedUntil = 0;
  private chaseFx: HTMLElement | null = null;
  /** Pull rate escolhido (1 = real). */
  private luck: Luck = loadLuck();
  private prices: SetPrices | null = null;

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
    this.counter.textContent = '';
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

    const sealed = el('div', { className: 'stage__pack', children: [this.pack] });
    const price = el('p', { className: 'stage__price', attrs: { 'aria-live': 'polite' } });
    this.body.replaceChildren(
      sealed,
      el('div', {
        className: 'stage__below',
        children: [price, el('p', { className: 'stage__hint', text: 'Toque no pacote para abrir' })],
      }),
      this.luckPicker(),
    );
    void this.showChase(sealed);
    this.showClassic(sealed);
    void setPricesFor(this.deps.set.id).then((prices) => {
      this.prices = prices;
      if (prices?.packBrl != null && price.isConnected) price.textContent = `${formatBrl(prices.packBrl)} o pacote`;
    });
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

  /** Pull rate: real ou acelerado (2×, 3×, 5×, 10× mais cartas raras). Vale para todas as coleções. */
  private luckPicker(): HTMLElement {
    const group = el('div', {
      className: 'luck',
      attrs: { role: 'radiogroup', 'aria-label': 'Chance de cartas raras' },
    });
    const buttons = LUCK_OPTIONS.map((luck) => {
      const btn = el('button', {
        className: 'luck__opt',
        attrs: { type: 'button', role: 'radio', 'aria-checked': String(luck === this.luck) },
        text: luckLabel(luck),
      });
      btn.addEventListener('click', () => {
        this.luck = luck;
        saveLuck(luck);
        buttons.forEach((b, i) => b.setAttribute('aria-checked', String(LUCK_OPTIONS[i] === luck)));
      });
      return btn;
    });
    group.append(...buttons);
    return el('div', {
      className: 'luck__wrap',
      children: [el('span', { className: 'luck__label', text: 'Cartas raras' }), group],
    });
  }

  /**
   * Coleção de onde saiu uma Clássica do 30 anos: a carta original espia por trás do pacote,
   * com o selo "Coleção 30 anos" e o ano. Tocar amplia e conta a história.
   */
  private showClassic(sealed: HTMLElement): void {
    const { set, catalog, classics } = this.deps;
    const mine = classics.filter((c) => c.set === set.id).slice(0, 3);
    const cards = mine.flatMap((c) => catalog.cards.find((card) => card.id === c.origin) ?? []);
    if (!cards.length) return;
    const names = [...new Set(mine.map((c) => c.name))];
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0]!;
    const note =
      `${list} ${names.length > 1 ? 'viraram Clássicas' : 'virou Clássica'} na coleção 30 anos ` +
      `(30th Celebration, 2026). ${names.length > 1 ? 'As originais saíram' : 'A original saiu'} ` +
      `em ${mine[0]!.year}, neste pacote.`;
    // No selo, nomes curtos por extenso; senão, a contagem (os nomes aparecem ao ampliar).
    const short = list.length <= 24 ? list : `${cards.length} Clássicas`;
    // As cartas saem por cima do pacote em leque e inclinam junto com ele; tocá-las não rasga
    // o lacre. O selo vai na da frente (a mais icônica).
    const peeks = cards.map((card, i) => {
      const peek = el('button', {
        className: 'classic-peek',
        attrs: { type: 'button', 'aria-label': `${card.name}: ${note} Ampliar.` },
        children: [
          el('img', { attrs: { src: card.imageUrl, alt: '', draggable: 'false' } }),
          ...(i === 0
            ? [
                el('span', {
                  className: 'classic-peek__tag',
                  children: [el('strong', { text: 'Coleção 30 anos' }), el('small', { text: `${short} · ${mine[0]!.year}` })],
                }),
              ]
            : []),
        ],
      });
      peek.style.setProperty('--fan', String(fanPosition(i, cards.length)));
      peek.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      peek.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openCardViewer(card, undefined, [], note);
      });
      return peek;
    });
    sealed.classList.add('has-classic');
    this.pack.prepend(...peeks.reverse());
  }

  /** Todo pacote lacrado: ao lado do booster, as 3 cartas mais valiosas e quanto valem. */
  private async showChase(sealed: HTMLElement): Promise<void> {
    const { set, catalog } = this.deps;
    const chase = await chaseCardsFor(set.id, catalog);
    if (!chase.length || this.phase !== 'sealed' || !sealed.isConnected) return;
    const items = chase.map(({ card, brl }) => {
      const price = formatBrl(brl);
      const item = el('button', {
        className: 'chase__card',
        attrs: { type: 'button', 'aria-label': `${card.name}, vale cerca de ${price}. Ampliar.` },
        children: [
          el('img', { attrs: { src: card.imageUrl, alt: '', draggable: 'false' } }),
          el('span', { children: [el('small', { text: card.name }), el('strong', { text: price })] }),
        ],
      });
      item.addEventListener('click', () => openCardViewer(card, undefined, [], `Vale cerca de ${price} (TCGplayer).`));
      return item;
    });
    sealed.classList.add('has-chase');
    sealed.append(
      el('aside', {
        className: 'chase',
        attrs: { 'aria-label': `As 3 cartas mais valiosas de ${set.name}` },
        children: [el('p', { className: 'chase__title', text: 'As 3 mais valiosas' }), ...items],
      }),
    );
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
    const chase = chaseCardsFor(this.deps.set.id, this.deps.catalog);
    // As imagens do pacote carregam enquanto o lacre voa; a primeira carta só aparece
    // com elas prontas (até PRELOAD_MAX_MS), para nenhuma surgir fora de ordem.
    const images = this.preloadImages();
    window.setTimeout(async () => {
      this.chase = await chase;
      await images;
      if (this.phase === 'reveal' && this.deps.root.isConnected) this.renderReveal();
    }, prefersReducedMotion() ? 0 : 380);
  }

  /** Baixa e decodifica as imagens do pacote; resolve quando prontas ou após PRELOAD_MAX_MS. */
  private preloadImages(): Promise<void> {
    const slots = this.booster?.slots ?? [];
    const ready = Promise.all(
      slots.map((s) => {
        const img = new Image();
        img.src = s.card.imageUrl;
        return img.decode().catch(() => undefined);
      }),
    ).then(() => undefined);
    const timeout = new Promise<void>((r) => window.setTimeout(r, PRELOAD_MAX_MS));
    return Promise.race([ready, timeout]);
  }

  private openBooster(): void {
    const seed = Math.floor(this.deps.masterRng.next() * 0x100000000);
    (window as unknown as Record<string, unknown>).__pkmnLastBoosterSeed = seed;
    this.ownedBefore = new Set(this.deps.getCollection().entries.keys());
    this.booster = generateBooster(mulberry32(seed), this.deps.catalog, seed, this.luck);
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
    skip.addEventListener('click', () => this.skipAhead());

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
    const place = this.chaseRank(slot);
    if (place >= 0) {
      this.celebrateChase(top, place);
    } else if (bucketRank(slot.effectiveBucket) >= 4) {
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
    const springBack = () => {
      const from = { ...offset };
      spring(1, 0, (t) => {
        offset = { x: from.x * t, y: from.y * t };
        render();
      }, { damping: 0.8, response: 0.3 });
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return; // o clique no palco avança
      const { vx, vy } = tracker.velocity();
      const w = card.clientWidth;
      const projected = offset.x + project(vx);
      this.suppressClick();
      const flung =
        (Math.abs(projected) > w * FLING_DISTANCE || Math.abs(vx) > FLING_VELOCITY) &&
        this.flingTop(Math.sign(projected) || 1, vy, vx, offset);
      if (!flung) springBack();
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

  /**
   * Joga a carta do topo para o lado (herdando a velocidade) e mostra a próxima. Devolve
   * `false` se a carta não pôde sair (uma das mais valiosas ainda em destaque).
   */
  private flingTop(dir: number, vy: number, vx = 0, from = { x: 0, y: 0 }): boolean {
    const booster = this.booster;
    if (!booster || this.phase !== 'reveal') return false;
    const card = this.cardEls[this.revealed];
    if (!card) return false;
    if (this.isLocked()) return false;
    this.clearChaseFx();
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
    return true;
  }

  // ── As 3 mais valiosas: efeito próprio e não passam rápido ─────────────────────

  /** 0, 1 ou 2 se a carta é a 1ª/2ª/3ª mais valiosa do set; -1 caso contrário. */
  private chaseRank(slot: BoosterSlot): number {
    if (this.isPackOnly(slot)) return -1;
    return this.chase.findIndex((c) => c.card.id === slot.card.id);
  }

  private isLocked(): boolean {
    if (performance.now() >= this.lockedUntil) return false;
    // Tentou passar cedo demais: a carta balança e o selo pisca, "olha bem essa!".
    const top = this.cardEls[this.revealed];
    top?.classList.remove('is-chase-nudge');
    void top?.offsetWidth;
    top?.classList.add('is-chase-nudge');
    return true;
  }

  private celebrateChase(top: HTMLElement, place: number): void {
    const { brl } = this.chase[place]!;
    const hold = prefersReducedMotion() ? CHASE_HOLD_MS / 2 : CHASE_HOLD_MS;
    this.lockedUntil = performance.now() + hold;
    top.classList.add('is-foil-active', 'is-celebrating', 'is-chase', `is-chase-${place + 1}`);
    playChaseSound(place);
    navigator.vibrate?.([30, 60, 30, 60, 120]);

    const hint = el('p', { className: 'chase-fx__hint', text: 'Toque para continuar' });
    const fx = el('div', {
      className: `chase-fx is-place-${place + 1}`,
      attrs: { 'aria-live': 'assertive' },
      children: [
        el('div', { className: 'chase-fx__rays', attrs: { 'aria-hidden': 'true' } }),
        this.chaseConfetti(),
        el('div', {
          className: 'chase-fx__banner',
          children: [
            el('strong', { className: 'chase-fx__place', text: CHASE_PLACES[place]! }),
            el('span', { className: 'chase-fx__price', text: `Essa vale ${formatBrl(brl)}` }),
          ],
        }),
        hint,
      ],
    });
    this.deck.parentElement?.append(fx);
    this.chaseFx = fx;
    window.setTimeout(() => fx.classList.add('is-unlocked'), hold);
  }

  private chaseConfetti(): HTMLElement {
    const layer = el('div', { className: 'chase-fx__confetti', attrs: { 'aria-hidden': 'true' } });
    if (prefersReducedMotion()) return layer;
    for (let i = 0; i < 70; i++) {
      const piece = el('span');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
      piece.style.animationDelay = `${0.2 + Math.random() * 0.9}s`;
      piece.style.animationDuration = `${2 + Math.random() * 1.6}s`;
      piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
      piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
      layer.append(piece);
    }
    return layer;
  }

  private clearChaseFx(): void {
    this.chaseFx?.remove();
    this.chaseFx = null;
  }

  /** "Ver todas": pula até a próxima das mais valiosas, se houver; senão vai ao resumo. */
  private skipAhead(): void {
    const booster = this.booster;
    if (!booster || this.phase !== 'reveal' || this.isLocked()) return;
    const slots = booster.slots;
    let next = -1;
    for (let i = this.revealed + 1; i < slots.length; i++) {
      if (this.chaseRank(slots[i]!) >= 0) {
        next = i;
        break;
      }
    }
    if (next < 0) {
      this.clearChaseFx();
      this.renderSummary();
      return;
    }
    this.clearChaseFx();
    for (let i = this.revealed; i < next; i++) {
      if (this.isPackOnly(slots[i]!)) continue;
      this.cardEls[i]!.remove();
      this.addToTray(slots[i]!);
    }
    this.revealed = next;
    this.focusTop();
  }

  /** No resumo: as mais valiosas levam o preço. */
  private chaseTag(slot: BoosterSlot): HTMLElement[] {
    const place = this.chaseRank(slot);
    return place >= 0
      ? [el('span', { className: 'summary__price', text: formatBrl(this.chase[place]!.brl) })]
      : [];
  }

  /**
   * Selo da subcoleção (ex.: Clássica, com o ano da original), para não confundir com a
   * raridade; e "30 anos" na carta original que virou Clássica.
   */
  private subsetTag(slot: BoosterSlot): HTMLElement[] {
    if (this.isPackOnly(slot)) return [];
    const classic = this.deps.classics.find((c) => c.id === slot.card.id);
    if (classic) return [el('span', { className: 'deck__subset', text: `Clássica · ${classic.year}` })];
    if (this.deps.classics.some((c) => c.origin === slot.card.id)) {
      return [el('span', { className: 'deck__subset', text: '30 anos' })];
    }
    return slot.card.subset ? [el('span', { className: 'deck__subset', text: categoryLabel(slot.card) })] : [];
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
          ...this.chaseTag(slot),
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

    const freshText =
      fresh === 0 ? 'Nenhuma carta nova' : fresh === 1 ? '1 carta nova' : `${fresh} cartas novas`;
    const progress = `${owned} de ${this.deps.set.albumSize} no fichário`;
    this.body.replaceChildren(
      el('div', {
        className: 'summary',
        children: [
          ...this.moneyLine(booster, `${freshText} · ${progress}`),
          grid,
          el('div', { className: 'summary__actions', children: [again, binder] }),
        ],
      }),
    );
    again.focus({ preventScroll: true });
  }

  /**
   * Topo do resumo: lucro ou prejuízo (valor das cartas menos o preço do pacote), quando o
   * set tem preços; senão, só as cartas novas.
   */
  private moneyLine(booster: Booster, detail: string): HTMLElement[] {
    const prices = this.prices;
    const pack = prices?.packBrl;
    if (!prices || pack == null) {
      const [first, ...rest] = detail.split(' · ');
      return [
        el('h2', { className: 'summary__title', text: first! }),
        el('p', { className: 'summary__meta', text: rest.join(' · ') }),
      ];
    }
    const value = booster.slots.reduce((sum, s) => sum + prices.cardBrl(s.card.id), 0);
    const diff = value - pack;
    const even = Math.abs(diff) < 0.5;
    const tone = even ? 'is-even' : diff > 0 ? 'is-gain' : 'is-loss';
    const amount = even ? 'Empatou' : `${diff > 0 ? '+' : '−'}${formatBrl(Math.abs(diff))}`;
    const label = even ? 'as cartas valem o pacote' : diff > 0 ? 'de lucro' : 'de prejuízo';
    return [
      el('h2', {
        className: `summary__money ${tone}`,
        children: [el('strong', { text: amount }), el('span', { text: label })],
      }),
      el('p', {
        className: 'summary__meta',
        text: `Cartas ${formatBrl(value)} · pacote ${formatBrl(pack)}`,
      }),
      el('p', { className: 'summary__meta summary__meta--quiet', text: detail }),
    ];
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
    this.tearProgress = 0;
    this.lockedUntil = 0;
    this.chaseFx = null;
    this.renderSealed();
  }
}
