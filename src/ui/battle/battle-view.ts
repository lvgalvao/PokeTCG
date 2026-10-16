import { loadRoster, type BattleRoster } from '../../battle/battle-data.js';
import { pickOpponents, type Fighter } from '../../battle/fighter.js';
import { mulberry32, type RNG } from '../../core/rng.js';
import type { Collection } from '../../domain/collection.js';
import { el } from '../../utils/dom.js';
import type { SetsIndex } from '../sets-index.js';
import type { BattleArena } from './arena.js';
import { typeColor, typeLabel } from './type-colors.js';

export interface BattleViewDeps {
  readonly index: SetsIndex;
  readonly collection: () => Collection;
  readonly masterRng: RNG;
}

const TEAM_SIZE = 3;
const TEAM_KEY = 'pkmn-booster:battle-team:v1';

function loadSavedTeam(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TEAM_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveTeam(ids: readonly string[]): void {
  try {
    localStorage.setItem(TEAM_KEY, JSON.stringify(ids));
  } catch {
    // Sem armazenamento: o time só não fica lembrado para a próxima vez.
  }
}

function movesLine(f: Fighter): string {
  const basic = `${f.basic.name} ${f.basic.damage}`;
  return f.special ? `${basic} · ${f.special.name} ${f.special.damage}` : basic;
}

/** Batalha (#/batalha): escolha de 3 Pokémon do fichário e, por cima, a arena 3D. */
export class BattleView {
  private alive = true;
  private roster: BattleRoster | null = null;
  private team: Fighter[] = [];
  private filter = '';
  private arena: BattleArena | null = null;
  private arenaRoot: HTMLElement | null = null;
  private readonly grid = el('div', { className: 'battle__grid' });
  private readonly tray = el('div', { className: 'battle__tray' });

  constructor(
    private readonly view: HTMLElement,
    private readonly deps: BattleViewDeps,
  ) {
    view.replaceChildren(
      el('div', {
        className: 'battle',
        children: [el('h1', { className: 'binder-index__title', text: 'Batalha' }), el('p', { className: 'battle__lead', text: 'Carregando seus Pokémon…' })],
      }),
    );
    void this.load();
  }

  destroy(): void {
    this.alive = false;
    this.closeArena();
  }

  private async load(): Promise<void> {
    try {
      this.roster = await loadRoster(this.deps.index, this.deps.collection());
    } catch (err) {
      console.error(err);
      if (this.alive) this.renderMessage('Não foi possível carregar os dados de batalha. Recarregue a página.');
      return;
    }
    if (!this.alive) return;
    if (this.roster.mine.length < TEAM_SIZE) {
      this.renderMessage(
        `Você precisa de ${TEAM_SIZE} Pokémon no fichário para batalhar. Abra alguns boosters na Loja e volte aqui.`,
      );
      return;
    }
    const byId = new Map(this.roster.mine.map((f) => [f.card.id, f]));
    this.team = loadSavedTeam()
      .map((id) => byId.get(id))
      .filter((f): f is Fighter => !!f)
      .slice(0, TEAM_SIZE);
    this.renderPicker();
  }

  private renderMessage(text: string): void {
    this.view.replaceChildren(
      el('div', {
        className: 'battle',
        children: [
          el('h1', { className: 'binder-index__title', text: 'Batalha' }),
          el('p', { className: 'battle__lead', text }),
          el('a', { className: 'battle__go', attrs: { href: '#/' }, text: 'Ir para a Loja' }),
        ],
      }),
    );
  }

  private renderPicker(): void {
    const search = el('input', {
      className: 'battle__search',
      attrs: { type: 'search', placeholder: 'Procurar pelo nome', 'aria-label': 'Procurar Pokémon pelo nome' },
    });
    search.addEventListener('input', () => {
      this.filter = search.value.trim().toLowerCase();
      this.renderGrid();
    });
    this.view.replaceChildren(
      el('div', {
        className: 'battle',
        children: [
          el('h1', { className: 'binder-index__title', text: 'Batalha' }),
          el('p', {
            className: 'battle__lead',
            text: `Escolha ${TEAM_SIZE} Pokémon do seu fichário. Na arena, a vida e os golpes são os da carta.`,
          }),
          search,
          this.grid,
          this.tray,
        ],
      }),
    );
    this.renderGrid();
    this.renderTray();
  }

  private renderGrid(): void {
    const mine = [...this.roster!.mine]
      .filter((f) => !this.filter || f.card.name.toLowerCase().includes(this.filter))
      .sort((a, b) => b.hp - a.hp || a.card.name.localeCompare(b.card.name));
    if (!mine.length) {
      this.grid.replaceChildren(el('p', { className: 'battle__lead', text: 'Nenhum Pokémon com esse nome.' }));
      return;
    }
    this.grid.replaceChildren(
      ...mine.map((f) => {
        const order = this.team.indexOf(f);
        const tile = el('button', {
          className: `battle-card${order >= 0 ? ' is-picked' : ''}`,
          attrs: {
            type: 'button',
            'aria-pressed': String(order >= 0),
            'aria-label': `${f.card.name}, ${f.hp} de vida, ${typeLabel(f.type)}. ${movesLine(f)}`,
          },
          children: [
            el('img', { attrs: { src: f.card.imageUrl, alt: '', loading: 'lazy', decoding: 'async' } }),
            el('span', { className: 'battle-card__hp', text: `${f.hp} HP` }),
            ...(order >= 0 ? [el('span', { className: 'battle-card__order', text: String(order + 1) })] : []),
          ],
        });
        tile.style.setProperty('--type', typeColor(f.type));
        tile.addEventListener('click', () => this.toggle(f));
        return tile;
      }),
    );
  }

  private toggle(f: Fighter): void {
    const at = this.team.indexOf(f);
    if (at >= 0) this.team.splice(at, 1);
    else if (this.team.length < TEAM_SIZE) this.team.push(f);
    else return;
    this.renderGrid();
    this.renderTray();
  }

  private renderTray(): void {
    const slots = Array.from({ length: TEAM_SIZE }, (_, i) => {
      const f = this.team[i];
      if (!f) return el('div', { className: 'battle__slot is-empty', text: String(i + 1) });
      const slot = el('button', {
        className: 'battle__slot',
        attrs: { type: 'button', 'aria-label': `Tirar ${f.card.name} do time` },
        children: [
          el('img', { attrs: { src: f.card.imageUrl, alt: '' } }),
          el('span', {
            children: [el('strong', { text: f.card.name }), el('small', { text: `${f.hp} HP · ${movesLine(f)}` })],
          }),
        ],
      });
      slot.style.setProperty('--type', typeColor(f.type));
      slot.addEventListener('click', () => this.toggle(f));
      return slot;
    });
    const missing = TEAM_SIZE - this.team.length;
    const start = el('button', {
      className: 'battle__start',
      attrs: { type: 'button' },
      text: missing ? `Faltam ${missing}` : 'Batalhar!',
    });
    start.disabled = missing > 0;
    start.addEventListener('click', () => void this.startBattle());
    this.tray.replaceChildren(el('div', { className: 'battle__slots', children: slots }), start);
  }

  // ── Arena ───────────────────────────────────────────────────────────────────────

  private async startBattle(): Promise<void> {
    if (this.arenaRoot || this.team.length < TEAM_SIZE) return;
    saveTeam(this.team.map((f) => f.card.id));
    const root = el('div', { className: 'arena', children: [el('p', { className: 'arena__loading', text: 'Preparando a arena…' })] });
    this.arenaRoot = root;
    document.body.append(root);
    document.body.classList.add('is-battle');
    // Tela cheia e deitada onde o navegador deixa (precisa ser dentro do toque do botão).
    void (async () => {
      try {
        await root.requestFullscreen?.({ navigationUI: 'hide' });
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
      } catch {
        // iPhone e alguns navegadores não deixam: a arena avisa para virar o celular.
      }
    })();
    try {
      const { BattleArena } = await import('./arena.js');
      if (!this.alive || this.arenaRoot !== root) return;
      this.mountArena(BattleArena);
    } catch (err) {
      console.error(err);
      this.closeArena();
    }
  }

  private mountArena(Arena: typeof BattleArena): void {
    const root = this.arenaRoot!;
    this.arena?.destroy();
    // Cada luta tem a própria seed, tirada do RNG do jogo (?seed= na URL reproduz tudo).
    const seed = Math.floor(this.deps.masterRng.next() * 0x100000000) >>> 0;
    const rng = mulberry32(seed);
    this.arena = new Arena({
      root,
      team: this.team,
      opponents: pickOpponents(rng, this.team, this.roster!.pool),
      rng,
      seed,
      onExit: () => this.closeArena(),
      onRematch: () => this.mountArena(Arena),
    });
  }

  private closeArena(): void {
    this.arena?.destroy();
    this.arena = null;
    this.arenaRoot?.remove();
    this.arenaRoot = null;
    document.body.classList.remove('is-battle');
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    try {
      screen.orientation.unlock?.();
    } catch {
      // Nada travado.
    }
  }
}
