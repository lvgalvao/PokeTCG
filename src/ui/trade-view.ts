import type { Card } from '../domain/card.js';
import type { Collection } from '../domain/collection.js';
import { FamilyError, type FamilyApi, type Player, type Trade } from '../persistence/family-api.js';
import { deserializeCollection, type PlayerSession } from '../persistence/family-store.js';
import { el } from '../utils/dom.js';
import { openCardViewer } from './card-viewer.js';
import { catalogFor, setForCard, type SetInfo, type SetsIndex } from './sets-index.js';

export interface TradeDeps {
  readonly api: FamilyApi;
  readonly session: PlayerSession;
  readonly players: readonly Player[];
  readonly index: SetsIndex;
  readonly myCollection: () => Collection;
  /** Recarrega o fichário e o aviso de trocas depois que algo mudou no servidor. */
  readonly onChanged: () => Promise<void>;
}

async function resolveCards(index: SetsIndex, ids: Iterable<string>): Promise<Map<string, Card>> {
  const sets = new Map<string, SetInfo>();
  for (const id of ids) {
    const set = setForCard(index, id);
    if (set) sets.set(set.id, set);
  }
  const out = new Map<string, Card>();
  await Promise.all(
    [...sets.values()].map(async (set) => {
      const catalog = await catalogFor(set.id);
      for (const c of catalog.cards) out.set(c.id, c);
    }),
  );
  return out;
}

function countIds(ids: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

/** Fileira de cartas pequenas (toque amplia). */
function cardRow(ids: readonly string[], cards: Map<string, Card>, empty: string): HTMLElement {
  const row = el('ul', { className: 'trade-row' });
  if (!ids.length) {
    row.append(el('li', { className: 'trade-row__empty', text: empty }));
    return row;
  }
  for (const [id, n] of countIds(ids)) {
    const card = cards.get(id);
    const btn = el('button', {
      className: 'trade-row__card',
      attrs: { type: 'button', 'aria-label': card ? `${card.name}${n > 1 ? `, ${n} cópias` : ''}` : id },
      children: [
        card ? el('img', { attrs: { src: card.imageUrl, alt: '', loading: 'lazy' } }) : el('span', { text: id }),
        ...(n > 1 ? [el('span', { className: 'pocket__count', text: `×${n}` })] : []),
      ],
    });
    if (card) btn.addEventListener('click', () => openCardViewer(card, n));
    row.append(el('li', { children: [btn] }));
  }
  return row;
}

/** Página de trocas: propostas recebidas, enviadas, histórico e "Nova troca". */
export class TradeView {
  private alive = true;
  private readonly me: Player;
  private readonly partner: Player;

  constructor(private readonly root: HTMLElement, private readonly deps: TradeDeps) {
    this.me = deps.players.find((p) => p.id === deps.session.player)!;
    this.partner = deps.players.find((p) => p.id !== deps.session.player)!;
    void this.renderList();
  }

  destroy(): void {
    this.alive = false;
  }

  /** Chamado pelo App quando a consulta periódica vê mudanças. */
  refresh(): void {
    if (!this.root.querySelector('.trade-composer')) void this.renderList();
  }

  private name(id: string): string {
    return this.deps.players.find((p) => p.id === id)?.name ?? id;
  }

  private async renderList(flash?: string): Promise<void> {
    const { api, session } = this.deps;
    let trades: Trade[];
    try {
      trades = await api.trades(session.pin);
    } catch (e) {
      return this.showError(e);
    }
    const cards = await resolveCards(this.deps.index, trades.flatMap((t) => [...t.offer, ...t.request]));
    if (!this.alive) return;

    const incoming = trades.filter((t) => t.status === 'pending' && t.to_player === session.player);
    const outgoing = trades.filter((t) => t.status === 'pending' && t.from_player === session.player);
    const history = trades.filter((t) => t.status !== 'pending');

    const create = el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, text: 'Nova troca' });
    create.addEventListener('click', () => void this.renderComposer());

    const page = el('div', {
      className: 'trades',
      children: [
        el('h1', { className: 'binder-index__title', text: 'Trocas' }),
        el('p', {
          className: 'binder-index__meta',
          text: `Escolha cartas suas para dar e cartas de ${this.partner.name} para pedir. ${this.partner.name} aceita ou recusa.`,
        }),
        ...(flash ? [el('p', { className: 'trades__flash', attrs: { role: 'status' }, text: flash })] : []),
        create,
      ],
    });

    if (incoming.length) {
      page.append(el('h2', { className: 'trades__h', text: 'Para você responder' }));
      for (const t of incoming) page.append(this.tradeCard(t, cards, 'incoming'));
    }
    if (outgoing.length) {
      page.append(el('h2', { className: 'trades__h', text: `Esperando ${this.partner.name}` }));
      for (const t of outgoing) page.append(this.tradeCard(t, cards, 'outgoing'));
    }
    if (history.length) {
      page.append(el('h2', { className: 'trades__h', text: 'Últimas trocas' }));
      for (const t of history) page.append(this.tradeCard(t, cards, 'history'));
    }
    if (!trades.length) {
      page.append(el('p', { className: 'trades__empty', text: 'Nenhuma troca ainda.' }));
    }
    this.root.replaceChildren(page);
  }

  private tradeCard(t: Trade, cards: Map<string, Card>, kind: 'incoming' | 'outgoing' | 'history'): HTMLElement {
    const mine = t.from_player === this.deps.session.player;
    // Sempre do ponto de vista de quem olha: o que eu dou e o que eu recebo.
    const give = mine ? t.offer : t.request;
    const get = mine ? t.request : t.offer;
    const status: Record<Trade['status'], string> = {
      pending: '',
      accepted: 'Troca feita',
      rejected: 'Recusada',
      cancelled: 'Cancelada',
      failed: 'Não deu certo: alguém não tinha mais uma das cartas',
    };
    const head =
      kind === 'incoming'
        ? `${this.name(t.from_player)} quer trocar com você`
        : kind === 'outgoing'
          ? `Você propôs a ${this.name(t.to_player)}`
          : `${mine ? 'Você' : this.name(t.from_player)} → ${mine ? this.name(t.to_player) : 'você'} · ${status[t.status]}`;

    const actions = el('div', { className: 'trade__actions' });
    if (kind === 'incoming') {
      const accept = el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, text: 'Aceitar' });
      const reject = el('button', { className: 'btn btn--quiet', attrs: { type: 'button' }, text: 'Recusar' });
      accept.addEventListener('click', () => void this.respond(t, true, [accept, reject]));
      reject.addEventListener('click', () => void this.respond(t, false, [accept, reject]));
      actions.append(accept, reject);
    } else if (kind === 'outgoing') {
      const cancel = el('button', { className: 'btn btn--quiet', attrs: { type: 'button' }, text: 'Cancelar' });
      cancel.addEventListener('click', () => {
        cancel.disabled = true;
        this.deps.api
          .cancel(this.deps.session.pin, this.deps.session.player, t.id)
          .then(() => this.renderList('Proposta cancelada.'))
          .catch((e) => this.showError(e));
      });
      actions.append(cancel);
    }

    return el('article', {
      className: `trade trade--${kind}${t.status === 'accepted' ? ' is-done' : ''}`,
      children: [
        el('p', { className: 'trade__head', text: head }),
        el('div', {
          className: 'trade__sides',
          children: [
            el('div', { children: [el('p', { className: 'trade__label', text: 'Você dá' }), cardRow(give, cards, 'nada')] }),
            el('div', { children: [el('p', { className: 'trade__label', text: 'Você recebe' }), cardRow(get, cards, 'nada')] }),
          ],
        }),
        actions,
      ],
    });
  }

  private async respond(t: Trade, accept: boolean, buttons: HTMLButtonElement[]): Promise<void> {
    buttons.forEach((b) => (b.disabled = true));
    try {
      const status = await this.deps.api.respond(this.deps.session.pin, this.deps.session.player, t.id, accept);
      await this.deps.onChanged();
      await this.renderList(
        status === 'accepted'
          ? 'Troca feita! As cartas já estão no seu fichário.'
          : status === 'failed'
            ? 'A troca não deu certo: alguém não tinha mais uma das cartas.'
            : 'Troca recusada.',
      );
    } catch (e) {
      this.showError(e);
    }
  }

  // ── Montar uma proposta ────────────────────────────────────────────────────────

  private async renderComposer(): Promise<void> {
    const { api, session } = this.deps;
    let partnerCollection: Collection;
    try {
      partnerCollection = deserializeCollection(await api.load(session.pin, this.partner.id));
    } catch (e) {
      return this.showError(e);
    }
    const mine = this.deps.myCollection();
    const cards = await resolveCards(this.deps.index, [...mine.entries.keys(), ...partnerCollection.entries.keys()]);
    if (!this.alive) return;

    const give = new Set<string>();
    const ask = new Set<string>();
    let side: 'give' | 'ask' = 'give';
    const setFilter: Record<'give' | 'ask', string | null> = { give: null, ask: null };

    const tabs = el('div', { className: 'binder__filters', attrs: { role: 'tablist' } });
    const sets = el('div', { className: 'binder__filters trade-composer__sets' });
    const grid = el('ol', { className: 'binder__grid' });
    const summary = el('p', { className: 'trade-composer__summary' });
    const send = el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, text: 'Enviar proposta' });
    const cancel = el('button', { className: 'btn btn--quiet', attrs: { type: 'button' }, text: 'Voltar' });
    const err = el('p', { className: 'login__error', attrs: { role: 'alert' } });
    cancel.addEventListener('click', () => void this.renderList());

    const collectionOf = (s: 'give' | 'ask') => (s === 'give' ? mine : partnerCollection);
    const selected = (s: 'give' | 'ask') => (s === 'give' ? give : ask);

    const draw = () => {
      tabs.replaceChildren(
        ...(['give', 'ask'] as const).map((s) => {
          const b = el('button', {
            className: 'chip',
            attrs: { type: 'button', role: 'tab', 'aria-pressed': String(side === s) },
            children: [
              s === 'give' ? 'Você dá' : `Você pede a ${this.partner.name}`,
              el('span', { className: 'chip__count', text: String(selected(s).size) }),
            ],
          });
          b.addEventListener('click', () => {
            side = s;
            draw();
          });
          return b;
        }),
      );

      const owned = [...collectionOf(side).entries]
        .filter(([id, n]) => n > 0 && cards.has(id))
        .map(([id, n]) => ({ card: cards.get(id)!, n }));
      const bySet = new Map<string, SetInfo>();
      for (const { card } of owned) {
        const set = setForCard(this.deps.index, card.id);
        if (set) bySet.set(set.id, set);
      }
      const setList = this.deps.index.sets.filter((s) => bySet.has(s.id));
      if (!setFilter[side] || !bySet.has(setFilter[side]!)) setFilter[side] = setList[0]?.id ?? null;
      sets.replaceChildren(
        ...setList.map((s) => {
          const b = el('button', {
            className: 'chip',
            attrs: { type: 'button', 'aria-pressed': String(setFilter[side] === s.id) },
            text: s.name,
          });
          b.addEventListener('click', () => {
            setFilter[side] = s.id;
            draw();
          });
          return b;
        }),
      );

      const sel = selected(side);
      grid.replaceChildren(
        ...owned
          .filter(({ card }) => setForCard(this.deps.index, card.id)?.id === setFilter[side])
          .map(({ card, n }) => {
            const on = sel.has(card.id);
            const btn = el('button', {
              className: 'pocket__card',
              attrs: { type: 'button', 'aria-pressed': String(on), 'aria-label': `${card.name}${on ? ', escolhida' : ''}` },
              children: [
                el('img', { attrs: { src: card.imageUrl, alt: '', loading: 'lazy' } }),
                ...(n > 1 ? [el('span', { className: 'pocket__count', text: `×${n}` })] : []),
              ],
            });
            btn.addEventListener('click', () => {
              if (sel.has(card.id)) sel.delete(card.id);
              else sel.add(card.id);
              draw();
            });
            return el('li', { className: `pocket${on ? ' is-picked' : ''}`, children: [btn] });
          }),
      );
      if (!owned.length) {
        grid.replaceChildren(
          el('li', {
            className: 'trades__empty',
            text: side === 'give' ? 'Você ainda não tem cartas.' : `${this.partner.name} ainda não tem cartas.`,
          }),
        );
      }
      summary.textContent = `Você dá ${give.size} · Você recebe ${ask.size}`;
      send.disabled = give.size + ask.size === 0;
    };

    send.addEventListener('click', () => {
      send.disabled = true;
      api
        .propose(session.pin, session.player, [...give], [...ask])
        .then(() => this.renderList(`Proposta enviada! Agora é com ${this.partner.name}.`))
        .catch((e: unknown) => {
          err.textContent = e instanceof FamilyError ? e.message : 'Não deu para enviar.';
          send.disabled = false;
        });
    });

    this.root.replaceChildren(
      el('div', {
        className: 'trades trade-composer',
        children: [
          el('h1', { className: 'binder-index__title', text: `Troca com ${this.partner.name}` }),
          el('p', { className: 'binder-index__meta', text: 'Toque nas cartas para escolher. Toque de novo para tirar.' }),
          tabs,
          sets,
          grid,
          el('div', { className: 'trade-composer__bar', children: [summary, err, cancel, send] }),
        ],
      }),
    );
    draw();
  }

  private showError(e: unknown): void {
    if (!this.alive) return;
    console.error(e);
    this.root.replaceChildren(
      el('p', {
        className: 'banner',
        text: e instanceof FamilyError ? e.message : 'Não deu para falar com o servidor. Confira a internet.',
      }),
    );
  }
}
