"""Casa cada carta do manifest com o produto do TCGplayer (set + número; nome desempata)."""
import json, re, sys, unicodedata
from tcg import all_cards
from mapping import M
import os
REPO=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def nnum(s):
    if not s: return None
    s=s.split('/')[0].strip().upper()
    m=re.match(r'^([A-Z]*)0*(\d+)([A-Z]*)$',s)
    return (m.group(1)+m.group(2)+m.group(3)) if m else s
def ournum(cid, subset):
    n=cid.split('-',1)[1]
    n=n.split('_')[0]
    n=re.sub(r'^(\d+)[a-z]+$',r'\1',n)
    return nnum(n)
def nname(s):
    for a,b in [('♀',' f'),('♂',' m'),('◇',' prism star'),('★',' star'),('α',' alpha'),('β',' beta'),('γ',' gamma'),('δ',' delta')]: s=s.replace(a,b)
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    s=re.sub(r'\s+-\s+[a-z]*\d+/\S+$','',s)   # " - 025/165"
    s=re.sub(r'\s+-\s+[a-z]/rgb$','',s)
    s=re.sub(r'[\[\(].*?[\]\)]','',s)
    s=re.sub(r'\s+-?\s*[a-z]*\d+(/\d+)?$','',s.strip())
    s=s.replace('-',' ').replace("'",'').replace('.','').replace('&',' and ')
    s=re.sub(r'\b(prime|star|legend)\b','',s)
    return ' '.join(s.split())
BAD=re.compile(r'code card|jumbo|prerelease|staff|stamp|error|1st edition|cosmos|league|pattern|oversized|misprint',re.I)
def pick(cands, name):
    def score(p):
        pn=p['productName']; sc=0
        if nname(pn)!=nname(name): sc+=10
        if BAD.search(pn): sc+=5
        if '(' in pn or '[' in pn: sc+=1
        if p.get('marketPrice') is None: sc+=3
        return (sc,len(pn))
    return sorted(cands,key=score)[0]
cache={}
def products(setnames):
    out=[]
    for n in setnames:
        if n not in cache: cache[n]=[p for p in all_cards(n) if p.get('rarityName')!='Code Card' and 'Code Card' not in p['productName']]
        out+=cache[n]
    return out
def run(verbose=False):
    sets=json.load(open(f'{REPO}/assets/data/sets.json'))['sets']
    res={}
    for s in sets:
        sid=s['id']; man=json.load(open(f'{REPO}/assets/{sid}/manifest.json'))
        prices={}; miss=[]; info=[]
        for c in man['cards']:
            if c.get('packOnly'): continue
            key=c.get('subset') or sid
            prods=products(M[key])
            num=ournum(c['id'],c.get('subset'))
            cands=[p for p in prods if nnum(p['customAttributes'].get('number'))==num]
            if not cands:
                for suf in 'AB':
                    cands=[p for p in prods if nnum(p['customAttributes'].get('number'))==num+suf]
                    if cands: break
            if not cands:
                # fallback: name-only unique match within set (no number)
                cands=[p for p in prods if not p['customAttributes'].get('number') and nname(p['productName'])==nname(c['name'])]
            if cands:
                p=pick(cands,c['name'])
                mp=p.get('marketPrice')
                prices[c['id']]=round(mp,2) if mp is not None else None
                info.append((c['id'],c['name'],p['productName'],p['customAttributes'].get('number'),mp,len(cands)))
                if mp is None: miss.append((c['id'],c['name'],'noprice',p['productName']))
                elif nname(p['productName'])!=nname(c['name']): miss.append((c['id'],c['name'],'NAMEDIFF',p['productName']))
            else:
                prices[c['id']]=None; miss.append((c['id'],c['name'],'nomatch',''))
        res[sid]=(prices,miss,info)
    return res
