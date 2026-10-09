import type { Card } from '../domain/card.js';
import type { Collection } from '../domain/collection.js';
import { FamilyError, type FamilyApi, type Player, type Trade } from '../persistence/family-api.js';
import { deserializeCollection, type PlayerSession } from '../persistence/family-store.js';
import { el } from '../utils/dom.js';
import { openCardViewer } from './card-viewer.js';
import { catalogFor, setForCard, type SetInfo, type SetsIndex } from './sets-index.js';
import { celebrateTrade } from './trade-celebration.js';

export interface TradeDeps {
  readonly api: FamilyApi;
  readonly session: PlayerSession;
  readonly players: readonly Player[];
  readonly index: SetsIndex;
  readonly myCollection: () => Collection;
  /** Recarrega o fichário e o aviso de trocas depois que algo mudou no servidor. */
  readonly onChanged: () => Promise<void>;
}

/** Cartas dos ids dados (carrega os catálogos das coleções envolvidas). */
export async function resolveCards(index: SetsIndex, ids: Iterable<string>): Promise<Map<string, Card>> {
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

/** Mesa de troca: o que você recebe ⇄ o que você dá. */
function table(get: readonly string[], give: readonly string[], cards: Map<string, Card>, big = false): HTMLElement {
  return el('div', {
    className: `trade-table${big ? ' is-big' : ''}`,
    children: [
      el('div', {
        className: 'trade-table__side is-get',
        children: [el('p', { className: 'trade__label', text: 'Você recebe' }), cardRow(get, cards, 'nada')],
      }),
      el('span', { className: 'trade-table__swap', attrs: { 'aria-hidden': 'true' }, text: '⇄' }),
      el('div', {
        className: 'trade-table__side is-give',
        children: [el('p', { className: 'trade__label', text: 'Você dá' }), cardRow(give, cards, 'nada (presente!)')],
      }),
    ],
  });
}

type Step = 'want' | 'give' | 'review';

/** Página de trocas: propostas recebidas, enviadas, histórico e "Nova troca". */
export class TradeView {
  private alive = true;
  private readonly partner: Player;

  constructor(private readonly root: HTMLElement, private readonly deps: TradeDeps) {
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

    const create = el('button', {
      className: 'trades__new',
      attrs: { type: 'button' },
      children: [
        el('span', { className: 'trades__new-icon', attrs: { 'aria-hidden': 'true' }, text: '⇄' }),
        el('span', { children: [el('strong', { text: 'Nova troca' }), el('small', { text: `Escolha cartas de ${this.partner.name} e ofereça as suas` })] }),
      ],
    });
    create.addEventListener('click', () => void this.renderComposer());

    const page = el('div', {
      className: 'trades',
      children: [
        el('h1', { className: 'binder-index__title', text: 'Trocas' }),
        ...(flash ? [el('p', { className: 'trades__flash', attrs: { role: 'status' }, text: flash })] : []),
      ],
    });

    if (incoming.length) {
      page.append(el('h2', { className: 'trades__h is-hot', text: `${this.partner.name} quer trocar com você!` }));
      for (const t of incoming) page.append(this.tradeCard(t, cards, 'incoming'));
    }
    page.append(create);
    if (outgoing.length) {
      page.append(el('h2', { className: 'trades__h', text: `Esperando ${this.partner.name} responder` }));
      for (const t of outgoing) page.append(this.tradeCard(t, cards, 'outgoing'));
    }
    if (history.length) {
      page.append(el('h2', { className: 'trades__h', text: 'Últimas trocas' }));
      for (const t of history) page.append(this.tradeCard(t, cards, 'history'));
    }
    this.root.replaceChildren(page);
  }

  private tradeCard(t: Trade, cards: Map<string, Card>, kind: 'incoming' | 'outgoing' | 'history'): HTMLElement {
    const mine = t.from_player === this.deps.session.player;
    // Sempre do ponto de vista de quem olha: o que eu recebo e o que eu dou.
    const give = mine ? t.offer : t.request;
    const get = mine ? t.request : t.offer;
    const status: Record<Trade['status'], string> = {
      pending: '',
      accepted: 'Troca feita',
      rejected: 'Recusada',
      cancelled: 'Cancelada',
      failed: 'Não deu certo: alguém não tinha mais uma das cartas',
    };
    const when = new Date(t.resolved_at ?? t.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    const head =
      kind === 'incoming'
        ? `Proposta de ${this.name(t.from_player)}`
        : kind === 'outgoing'
          ? `Você propôs a ${this.name(t.to_player)}`
          : `${status[t.status]} · ${when}`;

    const actions = el('div', { className: 'trade__actions' });
    if (kind === 'incoming') {
      const accept = el('button', { className: 'btn btn--primary trade__accept', attrs: { type: 'button' }, text: 'Aceitar troca' });
      const reject = el('button', { className: 'btn btn--quiet', attrs: { type: 'button' }, text: 'Não, obrigado' });
      accept.addEventListener('click', () => void this.respond(t, true, [accept, reject], cards));
      reject.addEventListener('click', () => void this.respond(t, false, [accept, reject], cards));
      actions.append(accept, reject);
    } else if (kind === 'outgoing') {
      const cancel = el('button', { className: 'btn btn--quiet', attrs: { type: 'button' }, text: 'Desistir' });
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
      children: [el('p', { className: 'trade__head', text: head }), table(get, give, cards, kind === 'incoming'), actions],
    });
  }

  private async respond(t: Trade, accept: boolean, buttons: HTMLButtonElement[], cards: Map<string, Card>): Promise<void> {
    buttons.forEach((b) => (b.disabled = true));
    try {
      const status = await this.deps.api.respond(this.deps.session.pin, this.deps.session.player, t.id, accept);
      await this.deps.onChanged();
      if (status === 'accepted') {
        // Quem aceitou recebe a oferta e dá o pedido.
        const pick = (ids: readonly string[]) => ids.map((id) => cards.get(id)).filter((c): c is Card => !!c);
        celebrateTrade(pick(t.request), pick(t.offer), this.name(t.from_player));
      }
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

  // ── Montar uma proposta: 1. o que você quer · 2. o que você dá · 3. conferir ─────

  private async renderComposer(): Promise<void> {
    const { api, session } = this.deps;
    let theirs: Collection;
    try {
      theirs = deserializeCollection(await api.load(session.pin, this.partner.id));
    } catch (e) {
      return this.showError(e);
    }
    const mine = this.deps.myCollection();
    const cards = await resolveCards(this.deps.index, [...mine.entries.keys(), ...theirs.entries.keys()]);
    if (!this.alive) return;

    const want = new Set<string>();
    const give = new Set<string>();
    let step: Step = 'want';
    let onlyMissing = true;

    const head = el('div', { className: 'composer__head' });
    const tray = el('div', { className: 'composer__tray' });
    const body = el('div', { className: 'composer__body' });
    const back = el('button', { className: 'btn btn--quiet', attrs: { type: 'button' } });
    const next = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } });
    const err = el('p', { className: 'login__error', attrs: { role: 'alert' } });

    const owned = (c: Collection) =>
      [...c.entries]
        .filter(([id, n]) => n > 0 && cards.has(id))
        .map(([id, n]) => ({ card: cards.get(id)!, n }));

    /** Cartas escolhidas, em miniatura; tocar tira da troca. */
    const miniRow = (ids: Set<string>, label: string, emptyText: string) => {
      const row = el('div', { className: 'composer__mini' });
      row.append(el('span', { className: 'composer__mini-label', text: `${label} (${ids.size})` }));
      if (!ids.size) row.append(el('span', { className: 'composer__mini-empty', text: emptyText }));
      for (const id of ids) {
        const card = cards.get(id);
        if (!card) continue;
        const b = el('button', {
          className: 'composer__mini-card',
          attrs: { type: 'button', 'aria-label': `Tirar ${card.name}` },
          children: [el('img', { attrs: { src: card.imageUrl, alt: '' } })],
        });
        b.addEventListener('click', () => {
          ids.delete(id);
          draw();
        });
        row.append(b);
      }
      return row;
    };

    /** Grade de escolha, agrupada por coleção. */
    const picker = (list: { card: Card; n: number }[], sel: Set<string>, tag: (c: Card, n: number) => string | null) => {
      const wrap = el('div');
      const bySet = new Map<string, { set: SetInfo; items: { card: Card; n: number }[] }>();
      for (const item of list) {
        const set = setForCard(this.deps.index, item.card.id);
        if (!set) continue;
        const g = bySet.get(set.id) ?? { set, items: [] };
        g.items.push(item);
        bySet.set(set.id, g);
      }
      for (const set of this.deps.index.sets) {
        const g = bySet.get(set.id);
        if (!g) continue;
        const grid = el('ol', { className: 'binder__grid composer__grid' });
        for (const { card, n } of g.items) {
          const on = sel.has(card.id);
          const label = tag(card, n);
          const btn = el('button', {
            className: 'pocket__card',
            attrs: { type: 'button', 'aria-pressed': String(on), 'aria-label': `${card.name}${on ? ', escolhida' : ''}` },
            children: [
              el('img', { attrs: { src: card.imageUrl, alt: '', loading: 'lazy' } }),
              ...(label ? [el('span', { className: 'composer__tag', text: label })] : []),
              ...(on ? [el('span', { className: 'composer__check', attrs: { 'aria-hidden': 'true' }, text: '✓' })] : []),
            ],
          });
          btn.addEventListener('click', () => {
            if (sel.has(card.id)) sel.delete(card.id);
            else sel.add(card.id);
            draw();
          });
          grid.append(el('li', { className: `pocket${on ? ' is-picked' : ''}`, children: [btn] }));
        }
        wrap.append(el('h3', { className: 'composer__set', text: g.set.name }), grid);
      }
      return wrap;
    };

    const draw = () => {
      const n = step === 'want' ? 1 : step === 'give' ? 2 : 3;
      const title =
        step === 'want'
          ? `O que você quer de ${this.partner.name}?`
          : step === 'give'
            ? `O que você dá em troca?`
            : 'Confere a troca';
      const hint =
        step === 'want'
          ? 'Toque nas cartas que você quer. Pode pular se for só dar um presente.'
          : step === 'give'
            ? `Toque nas suas cartas que vão para ${this.partner.name}. As repetidas aparecem primeiro.`
            : `Se ${this.partner.name} aceitar, as cartas trocam de fichário na hora.`;
      head.replaceChildren(
        el('ol', {
          className: 'composer__steps',
          attrs: { 'aria-label': `Passo ${n} de 3` },
          children: [1, 2, 3].map((i) => el('li', { className: i === n ? 'is-on' : i < n ? 'is-done' : '' })),
        }),
        el('h1', { className: 'composer__title', text: title }),
        el('p', { className: 'binder-index__meta', text: hint }),
      );

      if (step === 'review') {
        tray.replaceChildren();
        body.replaceChildren(table([...want], [...give], cards, true));
      } else {
        tray.replaceChildren(
          miniRow(want, 'Você recebe', 'nada ainda'),
          miniRow(give, 'Você dá', 'nada ainda'),
        );
        if (step === 'want') {
          const toggle = el('button', {
            className: 'chip',
            attrs: { type: 'button', 'aria-pressed': String(onlyMissing) },
            text: 'Só as que eu não tenho',
          });
          toggle.addEventListener('click', () => {
            onlyMissing = !onlyMissing;
            draw();
          });
          const list = owned(theirs).filter(({ card }) => !onlyMissing || !mine.entries.get(card.id));
          body.replaceChildren(
            el('div', { className: 'binder__filters', children: [toggle] }),
            list.length
              ? picker(list, want, (c) => (mine.entries.get(c.id) ? null : 'Nova!'))
              : el('p', {
                  className: 'trades__empty',
                  text: onlyMissing
                    ? `${this.partner.name} não tem nenhuma carta que falta para você. Desligue o filtro para ver todas.`
                    : `${this.partner.name} ainda não tem cartas.`,
                }),
          );
        } else {
          const list = owned(mine).sort((a, b) => Number(b.n > 1) - Number(a.n > 1));
          body.replaceChildren(
            list.length
              ? picker(list, give, (_c, count) => (count > 1 ? `Repetida ×${count}` : null))
              : el('p', { className: 'trades__empty', text: 'Você ainda não tem cartas. Abra uns pacotes!' }),
          );
        }
      }

      back.textContent = step === 'want' ? 'Cancelar' : 'Voltar';
      next.textContent =
        step === 'want'
          ? want.size ? 'Próximo' : 'Pular'
          : step === 'give'
            ? 'Conferir'
            : `Propor troca a ${this.partner.name}`;
      next.disabled = step === 'review' && want.size + give.size === 0;
      if (step === 'give') next.disabled = want.size + give.size === 0;
      err.textContent = '';
    };

    back.addEventListener('click', () => {
      if (step === 'want') return void this.renderList();
      step = step === 'review' ? 'give' : 'want';
      draw();
      window.scrollTo({ top: 0 });
    });
    next.addEventListener('click', () => {
      if (step !== 'review') {
        step = step === 'want' ? 'give' : 'review';
        draw();
        window.scrollTo({ top: 0 });
        return;
      }
      next.disabled = true;
      api
        .propose(session.pin, session.player, [...give], [...want])
        .then(() => this.renderList(`Proposta enviada! Agora é com ${this.partner.name}.`))
        .catch((e: unknown) => {
          err.textContent = e instanceof FamilyError ? e.message : 'Não deu para enviar.';
          next.disabled = false;
        });
    });

    this.root.replaceChildren(
      el('div', {
        className: 'trades trade-composer',
        children: [head, tray, body, el('div', { className: 'trade-composer__bar', children: [err, back, next] })],
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
