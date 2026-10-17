"""Grava em assets/data/prices/<set>.json o preço de mercado (USD) do pacote avulso: campo "pack".

Uso: python tools/prices_tcgplayer/packs.py [setId ...]   (sem setId, todos os sets)

Procura nos produtos selados do set no TCGplayer o "Booster Pack" avulso — sem caixas,
blisters, bundles, sleeved ou 1ª edição — e fica com o de nome mais curto que tem preço (de mercado; sem vendas, mediana ou menor anúncio).
"""
import json, os, re, sys
from mapping import M
from match import REPO
from tcg import search

SKIP = re.compile(r'\b(box|blister|bundle|sleeved|case|display|1st edition|art set|lot|tin|collection)\b', re.I)


def price(p):
    """Preço de mercado; sem vendas recentes, a mediana ou o menor anúncio."""
    return p.get('marketPrice') or p.get('medianPrice') or p.get('lowestPrice')


def sealed(setname):
    out, frm = [], 0
    while True:
        j = search({'productLineName': ['pokemon'], 'setName': [setname], 'productTypeName': ['Sealed Products']}, frm)
        r = j['results'][0]
        out += r['results']
        frm += 50
        if frm >= r['totalResults'] or not r['results']:
            return out


def pack_price(setnames):
    for name in setnames:
        cands = [
            p for p in sealed(name)
            if re.search(r'booster pack', p['productName'], re.I) and not SKIP.search(p['productName']) and price(p)
        ]
        if cands:
            best = min(cands, key=lambda p: len(p['productName']))
            return round(price(best), 2), best['productName']
    return None, None


def main():
    only = set(sys.argv[1:])
    sets = json.load(open(f'{REPO}/assets/data/sets.json'))['sets']
    for s in sets:
        sid = s['id']
        if only and sid not in only:
            continue
        usd, name = pack_price(M[sid])
        path = f'{REPO}/assets/data/prices/{sid}.json'
        d = json.load(open(path))
        if usd is None:
            d.pop('pack', None)
        else:
            d['pack'] = usd
        with open(path, 'w') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{sid:10} {usd!s:>8}  {name}')


if __name__ == '__main__':
    main()
