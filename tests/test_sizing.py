"""Formulas: "Size a LAN (VLSM)" and "Plan the subnets", the subnetting parts of the Packet Tracer labs
(11.9.3 VLSM Design, 11.7.5 Subnetting Scenario). Right answers pass, common mistakes get named, the UI runs them,
and weak spots link back. python3 tests/test_sizing.py"""
import os, sys
from playwright.sync_api import sync_playwright
URL=os.environ.get('SS_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.goto(URL); pg.wait_for_timeout(300)
    def find(t,pred):  # a generated question matching pred (JS expression on q)
        return pg.evaluate(f"(()=>{{for(let i=0;i<4000;i++){{const q=SS.GEN.formulas({t});if({pred})return {{prompt:q.prompt,fields:q.fields.map(f=>SS.show(f)),i}};}}return null;}})()")
    def d(t,pred,vals):
        return pg.evaluate(f"(()=>{{for(let i=0;i<4000;i++){{const q=SS.GEN.formulas({t});if({pred}){{const r=q.diag({vals!r});return r.map(x=>x?String(x).replace(/<[^>]+>/g,''):x);}}}}return null;}})()")
    print('Size a LAN (VLSM)')
    r=pg.evaluate("""(()=>{let bad=0,p2p=0;for(let i=0;i<500;i++){const q=SS.GEN.formulas(6);const v=q.fields.map(f=>SS.show(f));
      if(q.diag(v).some(Boolean))bad++;const m=q.fields[0].answer,u=q.fields[1].answer;if(/point-to-point/.test(q.prompt)){p2p++;if(SS.ipStr(m)!=='255.255.255.252'||u!==2)bad++;}}return [bad,p2p];})()""")
    ok(r[0]==0,'500 questions: right answers pass, and links are always 255.255.255.252 with 2 usable')
    ok(60<r[1]<180,f'about one in five is a router-to-router link ({r[1]} of 500)')
    m=d(6,"q.fields[1].answer===62&&!/point/.test(q.prompt)&&/\\b50\\b/.test(q.prompt)",['255.255.255.224','62'])
    ok(m and 'not enough' in m[0] or (m and 'fewer than' in m[0]),'50 hosts with a /27: “not enough”')
    m=d(6,"q.fields[1].answer===62&&!/point/.test(q.prompt)",['255.255.255.128','64'])
    ok(m and 'bigger than needed' in m[0] and 'subtract 2' in m[1],'a /25 where /26 fits: “bigger than needed”; 64 usable: “subtract 2”')
    m=d(6,"q.fields[1].answer===30&&!/point/.test(q.prompt)",['/27','25'])
    ok(m and 'dotted decimal' in m[0],'a /prefix typed as the mask is caught')
    m=d(6,"q.fields[1].answer===30&&!/point/.test(q.prompt)&&!/\\b30\\b/.test(q.prompt)",['255.255.255.224',"q.prompt.match(/big\">(\\d+)/)[1]"])
    m=pg.evaluate("""(()=>{for(let i=0;i<4000;i++){const q=SS.GEN.formulas(6);const H=Number((q.prompt.match(/big">(\\d+)/)||[])[1]);if(!/point/.test(q.prompt)&&H&&H!==q.fields[1].answer)return String(q.diag([SS.show(q.fields[0]),String(H)])[1]).replace(/<[^>]+>/g,'');}})()""")
    ok('what the LAN needs' in m,'typing the hosts needed as the usable count is caught')
    m=d(6,"/point-to-point/.test(q.prompt)",['255.255.255.248','6'])
    ok(m and 'wastes' in m[0],'a /29 for a router link: “wastes addresses”')
    m=d(6,"/point-to-point/.test(q.prompt)",['255.255.255.254','0'])
    ok(m and 'one for each router' in m[0],'a /31 for a router link: not enough usable addresses')
    m=d(6,"q.fields[1].answer===14",['255.255.255.230','14'])
    ok(m and 'valid mask' in m[0],'a non-mask octet (230) is caught')
    print('Plan the subnets')
    r=pg.evaluate("""(()=>{let bad=0;for(let i=0;i<500;i++){const q=SS.GEN.formulas(7);const [need,n,per]=q.fields.map(f=>f.answer);const H=Number(q.prompt.match(/big">(\\d+)/)[1]);
      if(2**n<need||2**(n-1)>=need||per<H||per!==2**(8-n)-2)bad++;if(q.diag(q.fields.map(f=>SS.show(f))).some(Boolean))bad++;}return bad;})()""")
    ok(r==0,'500 plans: fewest bits that cover LANs + 1, and the hosts per subnet always fit')
    m=pg.evaluate("""(()=>{for(let i=0;i<4000;i++){const q=SS.GEN.formulas(7);const need=q.fields[0].answer;if(need===5){const v=q.fields.map(f=>SS.show(f));
      const a=q.diag(['4',v[1],v[2],v[3]])[0],b=q.diag(['6',v[1],v[2],v[3]])[0],c=q.diag([v[0],'5',v[2],v[3]])[1],dd=q.diag([v[0],v[1],'32',v[3]])[2],e=q.diag([v[0],v[1],'8',v[3]])[2];
      return [a,b,c,dd,e].map(x=>String(x).replace(/<[^>]+>/g,''));}}})()""")
    ok('link between the two routers' in m[0],'forgetting the router link: “needs its own subnet too”')
    ok('single subnet' in m[1],'counting the link twice is caught')
    ok('number of subnets you need' in m[2],'typing the subnet count as the bits is caught')
    ok('Subtract 2' in m[3],'hosts per subnet without the − 2 is caught')
    ok('borrowed bits' in m[4],'hosts from the borrowed bits (2³ = 8) is caught')
    print('In the app')
    pg.click('.tab[data-m="formulas"]'); pg.wait_for_timeout(200)
    seen=set()
    for _ in range(80):
        t=pg.evaluate("SS.state.q.title"); seen.add(t)
        pg.click('#skipBtn') if pg.locator('#skipBtn').count() else pg.keyboard.press('Escape'); pg.wait_for_timeout(15)
    ok(any('Size a' in x for x in seen) and 'Plan the subnets' in seen,f'Formulas mixes in the new types ({len(seen)} kinds seen)')
    pg.evaluate("SS.next(SS.GEN.formulas(7))"); pg.wait_for_timeout(100)
    ok(pg.locator('.qfields input, #fin').count()>=1 and 'serial link' in pg.inner_text('#prompt'),'“Plan the subnets” renders and can be answered')
    pg.evaluate("localStorage.setItem('ss_weak',JSON.stringify({plan_count:{w:3,n:3},p2p_link:{w:2,n:2}}))"); pg.goto(URL); pg.wait_for_timeout(300)
    pg.click('.tab[data-m="weak"]'); pg.wait_for_timeout(300)
    txt=pg.inner_text('main')
    ok('Counting the subnets a network needs' in txt and 'router-to-router link (/30)' in txt,'the new weak spots are listed by name')
    ok('Size a LAN' in pg.text_content('#g-form') and 'Plan the subnets' in pg.text_content('#g-form'),'the Formulas guide explains both')
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
