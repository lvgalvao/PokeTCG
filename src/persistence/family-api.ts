import type { SupabaseClient } from '@supabase/supabase-js';

/** Os dois jogadores da família (ids fixos no banco). */
export type PlayerId = 'p1' | 'p2';

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
}

export interface FamilyStatus {
  readonly configured: boolean;
  readonly players: readonly Player[];
}

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'failed';

export interface Trade {
  readonly id: number;
  readonly from_player: PlayerId;
  readonly to_player: PlayerId;
  /** Cartas que saem de quem propôs (ids podem repetir). */
  readonly offer: readonly string[];
  /** Cartas que saem de quem recebeu. */
  readonly request: readonly string[];
  readonly status: TradeStatus;
  readonly note: string | null;
  readonly created_at: string;
  readonly resolved_at: string | null;
}

/** Erro já em português, pronto para mostrar ao jogador. */
export class FamilyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FamilyError';
  }
}

/**
 * Funções poketcg_* do Supabase (supabase/migrations/0002_poketcg_family.sql). Todas, menos
 * status e setup, exigem o PIN da família; o banco não aceita acesso direto às tabelas.
 */
export class FamilyApi {
  constructor(private readonly client: SupabaseClient) {}

  private async call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new FamilyError(error.message.replace(/^poketcg:\s*/, ''));
    if (data && typeof data === 'object' && 'error' in data) {
      throw new FamilyError(String((data as { error: unknown }).error));
    }
    return data as T;
  }

  status(): Promise<FamilyStatus> {
    return this.call('poketcg_status');
  }

  setup(pin: string, name1: string, name2: string): Promise<void> {
    return this.call('poketcg_setup', { p_pin: pin, p_name1: name1, p_name2: name2 });
  }

  async checkPin(pin: string): Promise<void> {
    await this.call('poketcg_check_pin', { p_pin: pin });
  }

  /** JSON da coleção: `{ schemaVersion, entries, bySet }`. */
  load(pin: string, player: PlayerId): Promise<unknown> {
    return this.call('poketcg_load', { p_pin: pin, p_player: player });
  }

  async addCards(pin: string, player: PlayerId, ids: readonly string[], setId: string): Promise<void> {
    await this.call('poketcg_add_cards', { p_pin: pin, p_player: player, p_ids: ids, p_set: setId });
  }

  async clear(pin: string, player: PlayerId): Promise<void> {
    await this.call('poketcg_clear', { p_pin: pin, p_player: player });
  }

  async propose(pin: string, from: PlayerId, offer: readonly string[], request: readonly string[]): Promise<number> {
    const r = await this.call<{ id: number }>('poketcg_propose', {
      p_pin: pin,
      p_from: from,
      p_offer: offer,
      p_request: request,
    });
    return r.id;
  }

  trades(pin: string): Promise<Trade[]> {
    return this.call('poketcg_trades_list', { p_pin: pin });
  }

  async respond(pin: string, player: PlayerId, trade: number, accept: boolean): Promise<TradeStatus> {
    const r = await this.call<{ status: TradeStatus }>('poketcg_respond', {
      p_pin: pin,
      p_player: player,
      p_trade: trade,
      p_accept: accept,
    });
    return r.status;
  }

  async cancel(pin: string, player: PlayerId, trade: number): Promise<void> {
    await this.call('poketcg_cancel', { p_pin: pin, p_player: player, p_trade: trade });
  }
}
