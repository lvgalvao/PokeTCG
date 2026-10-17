import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SetsIndex } from '../../src/ui/sets-index.js';

const index = JSON.parse(readFileSync('assets/data/sets.json', 'utf8')) as SetsIndex;
const manifest = (setId: string) =>
  JSON.parse(readFileSync(`assets/${setId}/manifest.json`, 'utf8')) as {
    cards: { id: string; name: string; imagePath: string; packOnly?: boolean }[];
  };

describe('Clássicas do 30 anos', () => {
  const classics = index.classics ?? [];
  const me55c = manifest('me55').cards.filter((c) => c.id.startsWith('me55c-'));

  it('toda carta da Classic Collection tem a original numa coleção da loja', () => {
    expect(classics.map((c) => c.id).sort()).toEqual(me55c.map((c) => c.id).sort());
  });

  it('a original existe no álbum da coleção indicada, com o mesmo nome e a imagem certa', () => {
    for (const c of classics) {
      expect(index.sets.some((s) => s.id === c.set), c.id).toBe(true);
      const origin = manifest(c.set).cards.find((o) => o.id === c.origin);
      expect(origin, c.id).toBeDefined();
      expect(origin!.packOnly, c.id).toBeFalsy();
      expect(origin!.name.replace(/\s/g, '').toLowerCase()).toBe(c.name.replace(/\s/g, '').toLowerCase());
      expect(origin!.imagePath).toBe(c.originImage);
    }
  });

  it('o ano é o do lançamento da coleção de origem', () => {
    for (const c of classics) {
      const set = index.sets.find((s) => s.id === c.set)!;
      expect(c.year).toBe(Number(set.releaseDate.slice(0, 4)));
    }
  });
});
