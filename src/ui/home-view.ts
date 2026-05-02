import type { AvailableSet } from './booster-view.js';
import { clear, el, on } from '../utils/dom.js';

const COVER_VERSION = '2';

export interface HomeViewDeps {
  readonly mountPoint: HTMLElement;
  readonly availableSets: readonly AvailableSet[];
  readonly getActiveSetId: () => string;
  readonly onSelectSet: (setId: string) => void;
}

export class HomeView {
  constructor(private readonly deps: HomeViewDeps) {
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    clear(this.deps.mountPoint);
    const wrap = el('div', { className: 'home' });
    const intro = el('p', {
      className: 'home__intro',
      text: 'Escolha uma coleção para abrir um booster.',
    });
    const grid = el('div', {
      className: 'set-picker set-picker--grid',
      attrs: { role: 'group', 'aria-label': 'Selecionar coleção' },
    });
    const activeId = this.deps.getActiveSetId();
    for (const s of this.deps.availableSets) {
      const isActive = s.id === activeId;
      const btn = el('button', {
        className: `set-picker__item${isActive ? ' is-active' : ''}`,
        attrs: {
          type: 'button',
          'aria-pressed': isActive ? 'true' : 'false',
          'aria-label': s.name,
          'data-set-id': s.id,
        },
      });
      btn.style.backgroundImage = `url('/${s.id}/capa.png?v=${COVER_VERSION}')`;
      const label = el('span', { className: 'set-picker__name', text: s.name });
      btn.append(label);
      on(btn, 'click', () => this.deps.onSelectSet(s.id));
      grid.append(btn);
    }
    wrap.append(intro, grid);
    this.deps.mountPoint.append(wrap);
  }
}
