"""Worksheet mode: the five problems from the class solutions guide must produce exactly the guide's answers,
common mistakes get the matching explanation, and No-help mode / exam readiness behave correctly."""
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
def fill(pg,g,overrides={}):
    vals=['/'+str(g['p']) if not g['asPrefix'] else g['mask'],g['bin'],str(g['inc']),g['net'],g['bc'],None,str(g['nets']),str(g['hosts'])]+[c for r in g['rows'] for c in r]
    for i,v in enumerate(vals):
        v=overrides.get(i,v)
        if i==5: pg.click(f'.field[data-i="5"] .choice[data-v="{overrides.get(5,g["role"])}"]')
        else: pg.fill(f'#f{i}',v)
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':1100}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300)
    ok(pg.evaluate("window.SS.state.mode")=='worksheet','Worksheet is the default mode')
    print('The five problems from the solutions guide')
    for n,g in enumerate(GUIDE,1):
        load(pg,g)
        q=pg.evaluate("window.SS.state.q.fields.map(f=>[f.label,f.type==='ip'?window.SS.ipStr(f.answer):f.answer,f.alt||null])")
        want=['/'+str(g['p']) if not g['asPrefix'] else g['mask'],g['bin'],g['inc'],g['net'],g['bc'],g['role'],g['nets'],g['hosts']]+[c for r in g['rows'] for c in r]
        got=[x[1] for x in q]; got[0]=('/'+str(got[0])) if not g['asPrefix'] else got[0]
        ok(got==want and q[6][2]==[g['alt']],f'Problem {n} ({g["ip"]} {"/"+str(g["p"]) if g["asPrefix"] else g["mask"]}): every worksheet answer and all {len(g["rows"])} chart rows match the guide')
        fill(pg,g); pg.click('#checkBtn')
        ok('good' in pg.get_attribute('#feedback','class'),f'Problem {n}: entering the guide’s answers scores as correct')
        pg.click('#checkBtn')
    load(pg,GUIDE[2]); fill(pg,GUIDE[2],{6:'2^20'}); pg.click('#checkBtn'); ok('good' in pg.get_attribute('#feedback','class'),'total networks accepts “2^20”'); pg.click('#checkBtn')
    load(pg,GUIDE[2]); fill(pg,GUIDE[2],{6:'16'}); pg.click('#checkBtn'); ok('good' in pg.get_attribute('#feedback','class'),'total networks also accepts the /24-baseline answer (16)'); pg.click('#checkBtn')
    print('Mistakes get matching explanations')
    cases=[({5:'host'},5,'last</b> address'),({5:'network'},5,'broadcast address'),({1:'11111111.11111111.11111111.00001111'},1,'all 1s followed by all 0s'),
           ({1:'00001111.11111111.11111111.11111111'},1,'backwards'),({1:'11111111.11111111.11111111.1111000'},1,'31 bits'),({6:str(2**20-2)},6,'subtract 2'),({6:str(2**28)},6,'whole prefix'),
           ({7:'16'},7,'subtract 2'),({2:'240'},2,'mask octet itself'),({4:'10.10.10.16'},4,'next'),({3:'10.10.10.16'},3,'rounded up'),
           ({11:'10.10.10.16'},11,'next row'),({9:'10.10.10.0'},9,'network address itself'),({10:'10.10.10.15'},10,'broadcast can’t be used'),({12:'10.10.10.48'},12,'different row')]
    for ov,idx,expect in cases:
        load(pg,GUIDE[2]); fill(pg,GUIDE[2],ov); pg.click('#checkBtn')
        txt=pg.inner_html(f'.ci[data-i="{idx}"]') if pg.locator(f'.ci[data-i="{idx}"]').count() else ''
        others=pg.locator('.ci').count()
        ok(expect.lower() in txt.lower() and others==1,f'{list(ov.values())[0]} in box {idx} → “{expect}”')
        pg.click('#checkBtn')
    load(pg,GUIDE[3]); fill(pg,GUIDE[3],{16:'10.10.10.66',17:'10.10.10.67'}); pg.click('#checkBtn')
    ok('Right method for the network you wrote' in pg.inner_text('.ci[data-i="17"]'),'a chart cell that follows from an earlier wrong cell is recognised')
    pg.click('#checkBtn')
    print('No-help mode and exam readiness')
    pg.check('#noHelpSw'); pg.wait_for_timeout(100)
    ok(pg.is_hidden('#hintBtn'),'No-help hides the Hint button')
    ok(pg.is_disabled('#dock button[data-t="guide"], .ttab[data-t="guide"]') if pg.locator('.ttab[data-t="guide"]').is_visible() else True,'No-help disables the Guide')
    pg.evaluate("window.SS.state&&0"); ok(pg.evaluate("document.body.classList.contains('nohelp')"),'No-help is on')
    for k in range(5):
        g=GUIDE[k%5]; load(pg,g); fill(pg,g); pg.click('#checkBtn'); pg.click('#checkBtn')
    ok(pg.evaluate("window.SS.getSheet().streak")==5 and 'in a row' in pg.inner_text('#sheetbox'),'5 perfect no-help worksheets → readiness complete')
    load(pg,GUIDE[0]); fill(pg,GUIDE[0],{2:'5'}); pg.click('#checkBtn'); pg.click('#checkBtn')
    ok(pg.evaluate("window.SS.getSheet().streak")==0 and pg.evaluate("window.SS.getSheet().best")==5,'a mistake resets the run but keeps the best')
    pg.reload(); pg.wait_for_timeout(300)
    ok(pg.evaluate("window.SS.getSheet().best")==5 and pg.is_checked('#noHelpSw'),'readiness and No-help survive a reload')
    pg.uncheck('#noHelpSw'); ok(pg.is_visible('#hintBtn'),'turning No-help off brings the Hint back')
    load(pg,GUIDE[1]); pg.click('#hintBtn'); n=pg.evaluate("window.SS.state.walk.steps.length")
    ok(n>20,f'worksheet Hint walks through every part ({n-1} steps)')
    print('Phone')
    m=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True); m.goto(URL); m.wait_for_timeout(300)
    ok(m.evaluate("document.documentElement.scrollWidth<=innerWidth"),'worksheet fits a phone with no sideways scrolling')
    m.screenshot(path='/tmp/ws_phone.png',full_page=True)
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
