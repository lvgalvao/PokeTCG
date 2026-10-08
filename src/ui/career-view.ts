import {
  ACHIEVEMENTS,
  canClaimBonus,
  DAILY_BONUS,
  EXHIBITION_SLOTS,
  fameLevel,
  missionsForDay,
  type CareerState,
  type GameContext,
} from '../game/career.js';
import { formatBRL, formatSigned, type Cents } from '../game/money.js';
import { el } from '../utils/dom.js';
import type { SetsIndex } from './sets-index.js';

export interface CareerViewDeps {
  readonly index: SetsIndex;
  readonly ctx: GameContext;
  readonly today: string;
  /** Patrimônio calculado de forma assíncrona (precisa dos preços de cada set). */
  readonly netWorth: () => Promise<Cents>;
  /** URL da imagem de uma carta pelo id (carrega o manifest do set). */
  readonly imageOf: (cardId: string) => Promise<string | null>;
  readonly onClaimBonus: () => void;
  readonly onClaimMission: (index: number) => void;
  readonly onReset: () => void;
}

export function renderCareer(root: HTMLElement, state: CareerState, deps: CareerViewDeps): void {
  const lvl = fameLevel(state.fame);
  const toNext = lvl.next === null ? 1 : (state.fame - lvl.current) / (lvl.next - lvl.current);
  const fameBar = el('span', { className: 'meter' });
  fameBar.style.setProperty('--pct', String(Math.min(1, toNext)));

  const worth = el('strong', { className: 'stat__value', text: '…' });
  void deps.netWorth().then((v) => (worth.textContent = formatBRL(v)));

  const result = state.stats.pulledValueCents + state.stats.soldCents - state.stats.spentCents;

  const page = el('div', { className: 'career' });
  page.append(
    el('header', {
      className: 'career__head',
      children: [
        el('p', { className: 'career__level', text: `Nível ${lvl.level}` }),
        el('h1', { className: 'career__title', text: lvl.title }),
        fameBar,
        el('p', {
          className: 'career__fame',
          text:
            lvl.next === null
              ? `${state.fame} de fama. Você chegou ao topo.`
              : `${state.fame} de fama. Faltam ${lvl.next - state.fame} para o próximo nível.`,
        }),
      ],
    }),
    el('section', {
      className: 'stats',
      attrs: { 'aria-label': 'Dinheiro' },
      children: [
        stat('Saldo', el('strong', { className: 'stat__value', text: formatBRL(state.walletCents) })),
        stat('Patrimônio', worth, 'Saldo mais o valor de mercado das suas cartas.'),
        stat(
          'Resultado das aberturas',
          el('strong', {
            className: `stat__value ${result >= 0 ? 'is-up' : 'is-down'}`,
            text: formatSigned(result),
          }),
          `${state.stats.packsOpened} pacotes por ${formatBRL(state.stats.spentCents)}.`,
        ),
      ],
    }),
  );

  if (canClaimBonus(state, deps.today)) {
    const bonus = el('button', {
      className: 'btn btn--primary career__bonus',
      attrs: { type: 'button' },
      text: `Pegar ${formatBRL(DAILY_BONUS)} de hoje`,
    });
    bonus.addEventListener('click', deps.onClaimBonus);
    page.append(bonus);
  }

  // Missões
  const missions = missionsForDay(state.missions.day || deps.today, deps.ctx.eras);
  const list = el('ul', { className: 'missions' });
  missions.forEach((m, i) => {
    const item = state.missions.items[i];
    const progress = item?.progress ?? 0;
    const done = progress >= m.goal;
    const meter = el('span', { className: 'meter meter--small' });
    meter.style.setProperty('--pct', String(progress / m.goal));
    const action = item?.claimed
      ? el('span', { className: 'missions__done', text: 'Resgatada' })
      : done
        ? el('button', { className: 'btn btn--primary btn--small', attrs: { type: 'button' }, text: 'Resgatar' })
        : el('span', { className: 'missions__count', text: `${progress}/${m.goal}` });
    if (action.tagName === 'BUTTON') action.addEventListener('click', () => deps.onClaimMission(i));
    list.append(
      el('li', {
        className: `missions__item${item?.claimed ? ' is-claimed' : ''}`,
        children: [
          el('div', {
            className: 'missions__text',
            children: [
              el('p', { className: 'missions__title', text: m.title }),
              el('p', {
                className: 'missions__reward',
                text: `${formatBRL(m.rewardCents)} e ${m.rewardFame} de fama`,
              }),
              meter,
            ],
          }),
          action,
        ],
      }),
    );
  });
  page.append(section('Missões de hoje', list, 'Novas missões todo dia.'));

  // Exposição
  const shelf = el('ul', { className: 'exhibit' });
  for (let i = 0; i < EXHIBITION_SLOTS; i++) {
    const id = state.exhibition[i];
    const slot = el('li', { className: `exhibit__slot${id ? '' : ' is-empty'}` });
    if (id) {
      void deps.imageOf(id).then((src) => {
        if (src) slot.append(el('img', { attrs: { src, alt: '', loading: 'lazy' } }));
      });
    }
    shelf.append(slot);
  }
  page.append(
    section(
      'Sua exposição',
      shelf,
      state.exhibition.length
        ? 'Para trocar uma carta, abra-a no fichário.'
        : 'Escolha até 6 cartas no fichário para mostrar aqui.',
    ),
  );

  // Conquistas
  const grid = el('ul', { className: 'achievements' });
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  for (const a of ACHIEVEMENTS) {
    const got = !!state.achievements[a.id];
    grid.append(
      el('li', {
        className: `achievement${got ? ' is-unlocked' : ''}`,
        attrs: { 'aria-label': `${a.title}: ${a.description}${got ? ' Conquistada.' : ''}` },
        children: [
          el('span', { className: 'achievement__mark', attrs: { 'aria-hidden': 'true' }, text: got ? '★' : '' }),
          el('p', { className: 'achievement__title', text: a.title }),
          el('p', { className: 'achievement__desc', text: a.description }),
        ],
      }),
    );
  }
  page.append(section(`Conquistas, ${unlocked} de ${ACHIEVEMENTS.length}`, grid));

  // Histórico
  if (state.history.length) {
    const rows = el('ul', { className: 'history' });
    for (const h of state.history.slice(0, 10)) {
      const name = deps.index.sets.find((s) => s.id === h.setId)?.name ?? h.setId;
      const profit = h.valueCents - h.costCents;
      rows.append(
        el('li', {
          className: 'history__row',
          children: [
            el('span', { className: 'history__name', text: name }),
            el('span', { className: 'history__cost', text: `pagou ${formatBRL(h.costCents)}` }),
            el('span', {
              className: `history__profit ${profit >= 0 ? 'is-up' : 'is-down'}`,
              text: formatSigned(profit),
            }),
          ],
        }),
      );
    }
    page.append(section('Últimos pacotes', rows));
  }

  const reset = el('button', {
    className: 'btn btn--link career__reset',
    attrs: { type: 'button' },
    text: 'Recomeçar a carreira do zero',
  });
  reset.addEventListener('click', () => {
    if (confirm('Recomeçar a carreira? Saldo, cartas da carreira, fama e conquistas voltam ao início.')) deps.onReset();
  });
  page.append(reset);

  root.replaceChildren(page);
}

function stat(label: string, value: HTMLElement, note?: string): HTMLElement {
  return el('div', {
    className: 'stat',
    children: [
      el('p', { className: 'stat__label', text: label }),
      value,
      ...(note ? [el('p', { className: 'stat__note', text: note })] : []),
    ],
  });
}

function section(title: string, body: HTMLElement, note?: string): HTMLElement {
  return el('section', {
    className: 'career__section',
    children: [
      el('h2', { className: 'career__h2', text: title }),
      ...(note ? [el('p', { className: 'career__note', text: note })] : []),
      body,
    ],
  });
}
