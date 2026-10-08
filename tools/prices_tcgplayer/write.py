"""Gera assets/data/prices/<set>.json com o marketPrice (USD) do TCGplayer de cada carta.

Uso: python tools/prices_tcgplayer/write.py   (a cotação USD→BRL fica registrada em cada arquivo)
"""
import json, os
from match import run, REPO
from tcg import search
res=run()
# base1-8 Machamp (1st Ed. only) is listed under TCGplayer 'Deck Exclusives'
j=search({'productLineName':['pokemon'],'productTypeName':['Cards']},0,50,q='Machamp 8/102')
for p in j['results'][0]['results']:
    if p['setName']=='Deck Exclusives' and p['productName']=='Machamp - 8/102' and p.get('marketPrice'):
        res['base1'][0]['base1-8']=round(p['marketPrice'],2)
out=f'{REPO}/assets/data/prices'; os.makedirs(out,exist_ok=True)
for sid,(p,miss,info) in res.items():
    d={"asOf":"2026-10-08","usdBrl":5.0212,"rateDate":"2026-10-08 05:46:42","source":"TCGplayer marketPrice via mp-search-api","cards":p}
    with open(f'{out}/{sid}.json','w') as f: json.dump(d,f,ensure_ascii=False,separators=(',',':'))
    n=len(p); ok=sum(v is not None for v in p.values()); print(f'{sid} {ok}/{n} {100*ok/n:.1f}%')
