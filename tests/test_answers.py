import re, ipaddress, math, sys
from playwright.sync_api import sync_playwright
import os
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
def mask(p): return str(ipaddress.IPv4Network(f'0.0.0.0/{p}').netmask)
def expected(qtype, prompt):
    t=prompt
    if qtype.startswith('Subnet chart'):
        ip,p=re.search(r'(\d+\.\d+\.\d+\.\d+)/(\d+)',t).groups(); n=ipaddress.IPv4Network(f'{ip}/{p}',strict=False)
        return [str(n.network_address),str(n.network_address+1),str(n.broadcast_address-1),str(n.broadcast_address),str(n.num_addresses-2)]
    if qtype=='ANDing':
        ip,m=re.findall(r'\d+\.\d+\.\d+\.\d+',t)[:2]; return [str(ipaddress.IPv4Network(f'{ip}/{m}',strict=False).network_address)]
    if qtype=='Prefix → mask':
        p=int(re.search(r'/(\d+)',t).group(1)); return [mask(p)]
    if qtype=='Mask → prefix':
        m=re.search(r'\d+\.\d+\.\d+\.\d+',t).group(0); return ['/'+str(ipaddress.IPv4Network(f'0.0.0.0/{m}').prefixlen)]
    if qtype=='Binary · decimal → binary':
        v=int(re.search(r'make\s+(\d+)',t).group(1)); return ['BITS:'+format(v,'08b')]
    if qtype=='Binary · binary → decimal':
        b=re.search(r'([01]{8})',t).group(1); return [str(int(b,2))]
    if qtype=='Host formula':
        p=int(re.search(r'/(\d+)',t).group(1)); return [str(2**(32-p)-2)]
    if qtype=='Network formula':
        base=int(re.search(r'/(\d+)',t).group(1)); n=int(re.search(r'borrow\s+(\d+)',t).group(1)); return [str(2**n),'/'+str(base+n)]
    if qtype=='Size for hosts':
        H=int(re.search(r'needs\s+(\d+)',t).group(1)); h=next(h for h in range(2,33) if 2**h-2>=H); return ['/'+str(32-h)]
    if qtype=='Size for networks':
        N=int(re.search(r'need\s+(\d+)',t).group(1)); base=int(re.search(r'a\s+/(\d+)',t).group(1)); n=max(1,math.ceil(math.log2(N))); return [str(n),mask(base+n)]
    if qtype=='Network increment':
        m=re.search(r'\d+\.\d+\.\d+\.\d+',t).group(0); o=[int(x) for x in m.split('.')]; v=next(x for x in o if x not in (255,)) if any(x not in (255,0) for x in o) else None
        v=next(x for x in o if x!=255); return [str(256-v)]
    raise Exception('unknown '+qtype)
fails=[];counts={};bad_text=0
with sync_playwright() as pw:
    b=pw.chromium.launch(**({'executable_path':os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}))
    pg=b.new_page(viewport={'width':1400,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL)
    for lvl in ['core','stretch']:
        pg.click(f'#level button[data-l="{lvl}"]')
        for mode in ['binary','prefix','anding','detective','formulas']:
            pg.click(f'.tab[data-m="{mode}"]')
            for i in range(int(os.environ.get('N','80'))):
                qt=pg.text_content('#qtype'); pr=pg.inner_text('#prompt')
                exp=expected(qt,pr); counts[qt]=counts.get(qt,0)+1
                for j,a in enumerate(exp):
                    if a.startswith('BITS:'):
                        for k,c in enumerate(a[5:]):
                            if c=='1': pg.click(f'.bit[data-k="{k}"]')
                    else: pg.fill(f'#f{j}',a)
                score0=int(pg.inner_text('#sScore'))
                pg.click('#checkBtn')
                cls=pg.get_attribute('#feedback','class'); score1=int(pg.inner_text('#sScore'))
                work=pg.inner_text('#work')
                if 'undefined' in work or 'NaN' in work: bad_text+=1; fails.append(('text',qt,pr))
                if 'good' not in cls or score1!=score0+10:
                    fixes=pg.eval_on_selector_all('.fix','e=>e.map(x=>x.textContent)')
                    fails.append((lvl,qt,pr,exp,fixes))
                pg.click('#checkBtn')
    print('questions checked:',sum(counts.values())); print(counts)
    print('failures:',len(fails)); [print(f) for f in fails[:10]]
    print('page errors:',errs[:5])
    b.close()
