"""Worksheet mode: the five problems from the class solutions guide must produce exactly the guide's answers,
and common mistakes get the matching explanation."""
import os, sys
from playwright.sync_api import sync_playwright
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
# answers copied from the IPv4 Subnetting Practice & Solutions Guide
GUIDE=[
 dict(ip='10.10.10.4',p=30,asPrefix=False,mask='255.255.255.252',bin='11111111.11111111.11111111.11111100',inc=4,net='10.10.10.4',bc='10.10.10.7',role='network',nets=2**22,alt=2**6,hosts=2,
      rows=[('10.10.10.0','10.10.10.1','10.10.10.2','10.10.10.3'),('10.10.10.4','10.10.10.5','10.10.10.6','10.10.10.7'),('10.10.10.8','10.10.10.9','10.10.10.10','10.10.10.11')]),
 dict(ip='10.10.10.18',p=29,asPrefix=True,mask='255.255.255.248',bin='11111111.11111111.11111111.11111000',inc=8,net='10.10.10.16',bc='10.10.10.23',role='host',nets=2**21,alt=2**5,hosts=6,
      rows=[('10.10.10.0','10.10.10.1','10.10.10.6','10.10.10.7'),('10.10.10.8','10.10.10.9','10.10.10.14','10.10.10.15'),('10.10.10.16','10.10.10.17','10.10.10.22','10.10.10.23'),('10.10.10.24','10.10.10.25','10.10.10.30','10.10.10.31')]),
 dict(ip='10.10.10.15',p=28,asPrefix=False,mask='255.255.255.240',bin='11111111.11111111.11111111.11110000',inc=16,net='10.10.10.0',bc='10.10.10.15',role='broadcast',nets=2**20,alt=2**4,hosts=14,
      rows=[('10.10.10.0','10.10.10.1','10.10.10.14','10.10.10.15'),('10.10.10.16','10.10.10.17','10.10.10.30','10.10.10.31'),('10.10.10.32','10.10.10.33','10.10.10.46','10.10.10.47')]),
 dict(ip='10.10.10.64',p=27,asPrefix=True,mask='255.255.255.224',bin='11111111.11111111.11111111.11100000',inc=32,net='10.10.10.64',bc='10.10.10.95',role='network',nets=2**19,alt=2**3,hosts=30,
      rows=[('10.10.10.0','10.10.10.1','10.10.10.30','10.10.10.31'),('10.10.10.32','10.10.10.33','10.10.10.62','10.10.10.63'),('10.10.10.64','10.10.10.65','10.10.10.94','10.10.10.95'),('10.10.10.96','10.10.10.97','10.10.10.126','10.10.10.127')]),
 dict(ip='10.10.10.255',p=25,asPrefix=False,mask='255.255.255.128',bin='11111111.11111111.11111111.10000000',inc=128,net='10.10.10.128',bc='10.10.10.255',role='broadcast',nets=2**17,alt=2**1,hosts=126,
      rows=[('10.10.10.0','10.10.10.1','10.10.10.126','10.10.10.127'),('10.10.10.128','10.10.10.129','10.10.10.254','10.10.10.255')]),
]
def load(pg,g):
    pg.evaluate(f"window.SS.next(window.SS.genSheet({{ip:'{g['ip']}',p:{g['p']},asPrefix:{'true' if g['asPrefix'] else 'false'}}}))")
def answers(g):
    """correct value for each box, keyed by its label"""
    a={'Prefix (CIDR)':'/'+str(g['p']),'Subnet mask (dotted decimal)':g['mask'],'Subnet mask (binary)':g['bin'],'Network increment':str(g['inc']),
       'Hosts per network (2ʰ − 2)':str(g['hosts']),'Total networks (2ⁿ)':str(g['nets']),'Network address of the IP':g['net'],
       'Broadcast address of the IP':g['bc'],'The given IP is a…':g['role']}
    for r,(n,f,l,b) in enumerate(g['rows'],1): a.update({f'Row {r} network':n,f'Row {r} first usable':f,f'Row {r} last usable':l,f'Row {r} broadcast':b})
    return a
def labels(pg): return pg.evaluate("window.SS.state.q.fields.map(f=>f.label)")
def idx(pg,label): return labels(pg).index(label)
def fill(pg,g,overrides={}):
    a=answers(g); a.update(overrides)
    for i,lab in enumerate(labels(pg)):
        if lab=='The given IP is a…': pg.click(f'.field[data-i="{i}"] .choice[data-v="{a[lab]}"]')
        else: pg.fill(f'#f{i}',a[lab])
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':1100}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300)
    ok(pg.evaluate("window.SS.state.mode")=='worksheet','Worksheet is the default mode')
    print('The five problems from the solutions guide')
    for n,g in enumerate(GUIDE,1):
        load(pg,g)
        q=pg.evaluate("window.SS.state.q.fields.map(f=>[f.label,f.type==='ip'?window.SS.ipStr(f.answer):f.type==='prefix'?'/'+f.answer:String(f.answer),f.alt||null])")
        want=answers(g); bad=[(l,v,want.get(l)) for l,v,_ in q if want.get(l)!=v]
        alt=[x[2] for x in q if x[0]=='Total networks (2ⁿ)'][0]
        if bad: print('   mismatches',bad[:4])
        ok(not bad and len(q)==8+4*len(g['rows']) and alt==[g['alt']],f'Problem {n} ({g["ip"]} {"/"+str(g["p"]) if g["asPrefix"] else g["mask"]}): every worksheet answer and all {len(g["rows"])} chart rows match the guide')
        fill(pg,g); pg.click('#checkBtn')
        ok('good' in pg.get_attribute('#feedback','class'),f'Problem {n}: entering the guide’s answers scores as correct')
        pg.click('#checkBtn')
    load(pg,GUIDE[2]); fill(pg,GUIDE[2],{'Total networks (2ⁿ)':'2^20'}); pg.click('#checkBtn'); ok('good' in pg.get_attribute('#feedback','class'),'total networks accepts “2^20”'); pg.click('#checkBtn')
    load(pg,GUIDE[2]); fill(pg,GUIDE[2],{'Total networks (2ⁿ)':'16'}); pg.click('#checkBtn'); ok('good' in pg.get_attribute('#feedback','class'),'total networks also accepts the /24-baseline answer (16)'); pg.click('#checkBtn')
    print('Mistakes get matching explanations')
    R,B,N,H,I='The given IP is a…','Subnet mask (binary)','Total networks (2ⁿ)','Hosts per network (2ʰ − 2)','Network increment'
    cases=[({R:'host'},'last</b> address'),({R:'network'},'broadcast address'),({B:'11111111.11111111.11111111.00001111'},'all 1s followed by all 0s'),
           ({B:'00001111.11111111.11111111.11111111'},'backwards'),({B:'11111111.11111111.11111111.1111000'},'31 bits'),({N:str(2**20-2)},'subtract 2'),({N:str(2**28)},'whole prefix'),
           ({H:'16'},'subtract 2'),({I:'240'},'mask octet itself'),({'Broadcast address of the IP':'10.10.10.16'},'next'),({'Network address of the IP':'10.10.10.16'},'rounded up'),
           ({'Row 1 broadcast':'10.10.10.16'},'next row'),({'Row 1 first usable':'10.10.10.0'},'network address itself'),({'Row 1 last usable':'10.10.10.15'},'broadcast can’t be used'),({'Row 2 network':'10.10.10.48'},'different row')]
    for ov,expect in cases:
        load(pg,GUIDE[2]); fill(pg,GUIDE[2],ov); pg.click('#checkBtn'); i=idx(pg,list(ov)[0])
        txt=pg.inner_html(f'.ci[data-i="{i}"]') if pg.locator(f'.ci[data-i="{i}"]').count() else ''
        others=pg.locator('.ci').count()
        ok(expect.lower() in txt.lower() and others==1,f'{list(ov.values())[0]} in “{list(ov)[0]}” → “{expect}”')
        pg.click('#checkBtn')
    load(pg,GUIDE[3]); fill(pg,GUIDE[3],{'Row 3 network':'10.10.10.66','Row 3 first usable':'10.10.10.67'}); pg.click('#checkBtn')
    ok('Right method for the network you wrote' in pg.inner_text(f'.ci[data-i="{idx(pg,"Row 3 first usable")}"]'),'a chart cell that follows from an earlier wrong cell is recognised')
    pg.click('#checkBtn')
    load(pg,GUIDE[1]); order=labels(pg)
    ok(order[:5]==['Subnet mask (dotted decimal)','Subnet mask (binary)','Network increment','Hosts per network (2ʰ − 2)','Total networks (2ⁿ)']
       and order[5:9]==['Row 1 network','Row 1 broadcast','Row 1 first usable','Row 1 last usable'] and order[-3:]==['Network address of the IP','Broadcast address of the IP','The given IP is a…'],
       'questions come in the order you work them out: mask answers, then the chart, then the given IP')
    tab=pg.evaluate("[...document.querySelectorAll('#fields input, #fields .choice')].map(e=>e.closest('.field').dataset.i).filter((v,i,a)=>a.indexOf(v)===i).map(Number)")
    ok(tab==sorted(tab),'Tab order follows that same order')
    ok(pg.locator('#sheetbox').count()==0 and 'readiness' not in pg.inner_text('body').lower(),'no Exam readiness panel or No-help toggle')
    load(pg,GUIDE[1]); pg.click('#hintBtn'); n=pg.evaluate("window.SS.state.walk.steps.length")
    ok(n>20,f'worksheet Hint walks through every part ({n-1} steps)')
    print('Phone')
    m=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True); m.goto(URL); m.wait_for_timeout(300)
    ok(m.evaluate("document.documentElement.scrollWidth<=innerWidth"),'worksheet fits a phone with no sideways scrolling')
    m.screenshot(path='/tmp/ws_phone.png',full_page=True)
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
