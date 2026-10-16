import type { Collection } from '../domain/collection.js';
import { catalogFor, type SetInfo, type SetsIndex } from '../ui/sets-index.js';
import { toFighter, type BattleStats, type Fighter } from './fighter.js';

type BattleFile = Readonly<Record<string, BattleStats>>;

const cache = new Map<string, Promise<BattleFile>>();

/** Gerado por tools/build_battle_data.py; carregado uma única vez por set. */
function battleFileFor(setId: string): Promise<BattleFile> {
  let p = cache.get(setId);
  if (!p) {
    p = fetch(`./${setId}/battle.json`).then((res) => {
      if (!res.ok) throw new Error(`Falha ao carregar ${setId}/battle.json: HTTP ${res.status}`);
      return res.json() as Promise<BattleFile>;
    });
    p.catch(() => cache.delete(setId));
    cache.set(setId, p);
  }
  return p;
}

/** Todos os Pokémon de um set prontos para lutar (Treinadores e Energias ficam de fora). */
async function fightersOfSet(set: SetInfo): Promise<Fighter[]> {
  const [catalog, stats] = await Promise.all([catalogFor(set.id), battleFileFor(set.id)]);
  const out: Fighter[] = [];
  for (const card of catalog.cards) {
    const s = stats[card.id];
    if (s) out.push(toFighter(card, s));
  }
  return out;
}

export interface BattleRoster {
  /** Pokémon que o jogador tem no fichário. */
  readonly mine: readonly Fighter[];
  /** Todos os Pokémon dos sets em que o jogador tem cartas: de onde sai o adversário. */
  readonly pool: readonly Fighter[];
}

/** Carrega os Pokémon dos sets em que o jogador tem pelo menos uma carta. */
export async function loadRoster(index: SetsIndex, collection: Collection): Promise<BattleRoster> {
  const owned = (id: string) => (collection.entries.get(id) ?? 0) > 0;
  const sets = index.sets.filter((set) => {
    const prefixes = [set.id, ...set.subsets].map((p) => `${p}-`);
    for (const id of collection.entries.keys()) {
      if (owned(id) && prefixes.some((p) => id.startsWith(p))) return true;
    }
    return false;
  });
  const pool = (await Promise.all(sets.map(fightersOfSet))).flat();
  return { mine: pool.filter((f) => owned(f.card.id)), pool };
}
