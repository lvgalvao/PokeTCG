"""Cliente mínimo da busca do TCGplayer (mp-search-api), com cache local e ~1 req/s."""
import requests, json, time, os, hashlib
UA={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Content-Type':'application/json','Accept':'application/json'}
URL='https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false'
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'.cache')
os.makedirs(D,exist_ok=True)
def search(filters, frm=0, size=50, q=''):
    body={"algorithm":"sales_synonym_v2","from":frm,"size":size,"filters":{"term":filters}}
    if not q: body["sort"]={"field":"product-sorting-name","order":"asc"}
    key=hashlib.md5(json.dumps([body,q],sort_keys=True).encode()).hexdigest()
    p=f'{D}/{key}.json'
    if os.path.exists(p): return json.load(open(p))
    url=URL if not q else URL.replace('q=','q='+requests.utils.quote(q))
    for i in range(4):
        try:
            r=requests.post(url,headers=UA,json=body,timeout=30)
            if r.status_code==200: break
        except Exception as e: print('err',e)
        time.sleep(3*(i+1))
    time.sleep(1)
    j=r.json(); json.dump(j,open(p,'w')); return j
def all_cards(setname):
    out=[]; frm=0
    while True:
        j=search({"productLineName":["pokemon"],"setName":[setname],"productTypeName":["Cards"]},frm)
        r=j['results'][0]; out+=r['results']; frm+=50
        if frm>=r['totalResults'] or not r['results']: break
    return out
