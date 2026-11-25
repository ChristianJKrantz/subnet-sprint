"""VLSM mode: the class VLSM assignment (a /24 split biggest-first into subnets sized for their hosts, with a bit grid
and an address table). Checks the handout example, hundreds of random problems, feedback for common mistakes, hints,
both layouts, your-own-problem and share links, printing, and phones."""
import worksheet_mode  # noqa: F401  (fresh pages open in Worksheet mode, not on the Path)
import os, sys, re
from playwright.sync_api import sync_playwright
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
def answers(pg): return pg.evaluate("window.SS.state.q.fields.map(f=>window.SS.show(f))")
def short(a): return a.split('.')[-1] if re.match(r'^\d+\.\d+\.\d+\.\d+$',a) else a
def answer(pg,a): pg.fill('#fin',a); pg.press('#fin','Enter'); pg.wait_for_timeout(15)
def load(pg,hosts,base='192.168.0.0'): pg.evaluate(f"window.SS.next(window.SS.genVlsm({{hosts:{hosts},base:'{base}'}}))")
def goto_field(pg,label):
    A=answers(pg); L=pg.evaluate("window.SS.state.q.fields.map(f=>f.label)")
    for a,l in zip(A,L):
        if l==label: return
        answer(pg,short(a))
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':1000}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300)
    print('The handout example (192.168.0.0/24: 58, 29, 15, 7 hosts)')
    pg.click('.tab[data-m="vlsm"]'); load(pg,[58,29,15,7])
    A=dict(zip(pg.evaluate("window.SS.state.q.fields.map(f=>f.label)"),answers(pg)))
    ok([A[f'Subnet {s} bit grid'] for s in 'ABCD']==['11000000','11100000','11100000','11110000'],'bit grid rows match the handout')
    ok([A[f'Subnet {s} subnet mask'] for s in 'ABCD']==['255.255.255.192','255.255.255.224','255.255.255.224','255.255.255.240'],'subnet masks match')
    ok([A[f'Subnet {s} network'] for s in 'ABCD']+[A['Network after Subnet D']]==[f'192.168.0.{x}' for x in (0,64,96,128,144)],'networks .0, .64, .96, .128 and the extra row .144 match')
    ok([A[f'Subnet {s} broadcast'] for s in 'ABCD']==[f'192.168.0.{x}' for x in (63,95,127,143)],'broadcasts match')
    ok([(A[f'Subnet {s} first useable host'],A[f'Subnet {s} last useable host']) for s in 'ABCD']==[('192.168.0.1','192.168.0.62'),('192.168.0.65','192.168.0.94'),('192.168.0.97','192.168.0.126'),('192.168.0.129','192.168.0.142')],'useable host ranges match')
    ex=pg.evaluate("window.SS.state.q.explain")
    ok('Subnet C needs 15 hosts, but 2<sup>4</sup> − 2 = 14 is too few, so it uses 5 host bits (30 hosts)' in ex and 'Subnet D needs 7 hosts' in ex,'the worked solution explains the 15 and 7 edge cases, like the handout note')
    print('Random problems')
    bad=pg.evaluate("""(()=>{const out=[];for(let k=0;k<400;k++){const q=window.SS.genVlsm(),S=q.S,ip=window.SS.ipStr;
      if(S.length!==4)out.push('count');
      S.forEach((s,i)=>{const h=window.SS.hostBitsFor(s.H);
        if(s.h!==h||2**h-2<s.H||(h>2&&2**(h-1)-2>=s.H))out.push('h '+s.H);
        if(i&&!(s.H<S[i-1].H))out.push('order');
        if((s.net-q.base)%s.blk)out.push('align');
        if(i&&s.net!==S[i-1].bc+1)out.push('gap');
        if(s.bc!==s.net+s.blk-1||s.first!==s.net+1||s.last!==s.bc-1)out.push('range');});
      if(q.nextNet!==S[3].bc+1||q.nextNet-q.base>=256)out.push('next');
      if(S[0].net!==q.base)out.push('start');}
      return [...new Set(out)];})()""")
    ok(bad==[],f'400 random problems: biggest first, smallest block that fits, aligned, no gaps, all inside the /24 {bad}')
    edge=pg.evaluate("(()=>{let n=0,t=0;for(let k=0;k<300;k++)window.SS.genVlsm().S.forEach(s=>{t++;if(s.h>2&&(s.H===2**(s.h-1)-1||s.H===2**(s.h-1)))n++;});return n/t;})()")
    ok(edge>0.15,f'edge cases like 15 or 7 hosts (just too big for the smaller block) come up often ({edge:.0%})')
    print('One at a time')
    load(pg,[58,29,15,7])
    ok(pg.inner_text('.fc-q')=='Subnet A bit grid' and 'Subnet A · 58 hosts' in pg.inner_text('.fc-h'),'starts with Subnet A’s bit grid, showing how many hosts it needs')
    order=pg.evaluate("window.SS.state.q.fields.map(f=>f.label)")
    ok(order[:6]==['Subnet A bit grid','Subnet A subnet mask','Subnet A network','Subnet A broadcast','Subnet A first useable host','Subnet A last useable host'] and order[-1]=='Network after Subnet D' and len(order)==25,'works each subnet in order: grid, mask, network, broadcast, useable range; the extra row last')
    answer(pg,'11110000'); m=pg.inner_text('.fc-msg')
    ok('fewer than the 58' in m and '11000000' not in m and 'h = ?' in m,f'too few host bits: explains why without giving the row away: “{m[:80]}…”')
    answer(pg,'10000000'); ok('smallest' in pg.inner_text('.fc-msg'),'too many host bits: says to use the smallest block that fits')
    answer(pg,'10100000'); ok('never mixed' in pg.inner_text('.fc-msg'),'1s and 0s mixed up: says 1s go on the left')
    answer(pg,'1100 0000'); ok(pg.inner_text('.fc-q')=='Subnet A subnet mask','the right row (typed with a space) moves on')
    answer(pg,'64'); ok('block size, not the mask' in pg.inner_text('.fc-msg'),'typing the block size as the mask is caught')
    answer(pg,'58'); ok('host count, not a mask' in pg.inner_text('.fc-msg'),'typing the host count as the mask is caught')
    answer(pg,'192'); answer(pg,'.0')
    ok(pg.inner_text('.fc-q')=='Subnet A broadcast','a mask or address can be typed as just the last octet, with or without the dot')
    answer(pg,'58'); ok('counted the 58 hosts' in pg.inner_text('.fc-msg'),'a broadcast counted from the hosts needed (not the block) is caught')
    answer(pg,'64'); ok('one before it' in pg.inner_text('.fc-msg'),'using the next subnet’s start as the broadcast is caught')
    answer(pg,'192.168.0.63'); answer(pg,'1'); answer(pg,'62'); answer(pg,'11100000'); answer(pg,'224')
    answer(pg,'63'); ok('That’s Subnet A’s broadcast' in pg.inner_text('.fc-msg'),'Subnet B starting on A’s broadcast is caught')
    answer(pg,'58'); ok('added the hosts Subnet A needs' in pg.inner_text('.fc-msg'),'adding A’s host count instead of its block size is caught')
    answer(pg,'10.1.1.64'); ok('typo' in pg.inner_text('.fc-msg'),'a typo in the copied octets is called a typo')
    pg.click('#freveal'); ok(pg.inner_text('.fc-q')=='Subnet B broadcast','Show the answer fills it in')
    weak=pg.evaluate("window.SS.getWeak()")
    ok(all(t in weak for t in ['vlsm_fit','vlsm_mask','vlsm_block']),f'mistakes are logged to weak spots ({sorted(weak)})')
    print('Hints')
    pg.click('#fhint'); steps=pg.evaluate("window.SS.getFlow().groups[window.SS.getFlow().k].map(s=>s.kind==='ip'?String(s.ans%256):String(s.ans))")
    ok(len(steps)==2 and 'Block size' in pg.inner_text('.fc-steps'),'the broadcast hint first asks for the block size (2ʰ)')
    pg.fill('#wsin','30'); pg.press('#wsin','Enter'); ok('useable hosts' in pg.inner_text('.wmsg'),'a block size of 2ʰ − 2 gets “that’s the useable hosts”')
    for t in steps: pg.fill('#wsin',t); pg.press('#wsin','Enter'); pg.wait_for_timeout(20)
    ok(pg.inner_text('.fc-q')=='Subnet B first useable host','the hint’s last step takes just the last octet and moves on')
    tips=pg.evaluate("""(()=>{const q=window.SS.state.q;return q.walk().map(s=>[s.q,window.SS.tipFor(s,q)]);})()""")
    ok(all(t=='' or 'h=' in t or 'ladder' in t or 'block' in t.lower() or 'broadcast' in t.lower() or 'Count the 0s' in t for _,t in tips),'every shortcut tip is about VLSM')
    load(pg,[100,50,20,10])
    for s in pg.evaluate("window.SS.state.q.walk()"):
        pass
    leak=pg.evaluate("""(()=>{const q=window.SS.state.q,bad=[];q.walk().forEach(s=>{const t=window.SS.tipFor(s,q);if(t&&s.kind==='ip'&&t.includes(window.SS.ipStr(s.ans)))bad.push(s.q);});return bad;})()""")
    ok(leak==[],'no tip contains its step’s answer')
    print('Finishing')
    load(pg,[58,29,15,7])
    for a in answers(pg): answer(pg,short(a))
    fb=pg.inner_text('#feedback'); ok('good' in pg.get_attribute('#feedback','class') and '+10' in fb,f'a perfect run scores +10 ({fb[:30]})')
    ok(pg.locator('.fs-vg tr').count()==5 and '192.168.0.144' in pg.inner_text('.fsheet'),'the finished sheet shows the whole grid, table and extra row')
    pg.click('#checkBtn')
    print('Full sheet')
    pg.click('#layoutSeg button[data-v="sheet"]'); load(pg,[58,29,15,7])
    ok(pg.locator('.vg-row').count()==4 and pg.locator('.crow.vrow:not(.chead)').count()==5,'shows the bit grid (4 rows) and the address table (4 rows + the extra row)')
    fs=pg.evaluate("window.SS.state.q.fields.map((f,i)=>[i,f.type,window.SS.show(f)])")
    for i,t,v in fs:
        if t=='bits':
            for k,c in enumerate(v):
                if c=='1': pg.click(f'.field[data-i="{i}"] .bit[data-k="{k}"]')
        else: pg.fill(f'#f{i}',short(v))
    pg.locator('.vg-row').first.locator('.bit').nth(2).focus(); pg.keyboard.press('3'); pg.keyboard.press('3')
    ok(pg.evaluate("[...document.querySelectorAll('.vg-row')].map(r=>[...r.querySelectorAll('.bit')].map(b=>b.textContent).join(''))")==['11000000','11100000','11100000','11110000'],'clicking boxes builds each row, and number keys only flip bits in the row you’re in')
    pg.click('#checkBtn'); pg.wait_for_timeout(80)
    ok('good' in pg.get_attribute('#feedback','class'),'last octets and clicked bits score as right')
    pg.click('#checkBtn'); load(pg,[58,29,15,7])
    pg.click('#hintBtn'); pg.wait_for_timeout(50)
    ok(pg.locator('#walk .mchart').count()==1 and 'Subnet A bit grid' in pg.inner_text('#walk'),'Hint in Full sheet shows the steps with a mini grid and table')
    pg.fill('#winp','6'); pg.press('#winp','Enter'); pg.fill('#winp','11000000'); pg.press('#winp','Enter'); pg.wait_for_timeout(50)
    ok(pg.evaluate("[...document.querySelectorAll('.vg-row')][0].querySelectorAll('.bit.on').length")==2,'answering the hint’s grid step fills in the row')
    pg.click('#layoutSeg button[data-v="flow"]')
    print('Your own problem and share links')
    pg.click('#ownBtn'); ok(pg.is_visible('#ownHosts'),'Your own problem asks for host counts in VLSM mode')
    pg.fill('#ownHosts','7, 15 58,29'); pg.click('#ownGo'); pg.wait_for_timeout(100)
    ok(pg.evaluate("window.SS.state.q.S.map(s=>s.H)")==[58,29,15,7],'host counts in any order are sorted biggest first')
    link=pg.input_value('#ownLink'); ok('vlsm=58%2C29%2C15%2C7' in link or 'vlsm=58,29,15,7' in link,'gives a share link')
    for h,base,expect in [('58','','2 to 6'),('58,abc','','whole numbers'),('200,10','','between 2 and 126'),('100,100,10','','more than the 256'),('58,29','10.0.0.5','ends in .0'),('58,29','127.0.0.0','not 127')]:
        pg.fill('#ownHosts',h); pg.fill('#ownBase',base); pg.click('#ownGo'); ok(expect in pg.inner_text('#ownMsg'),f'rejects {h!r} {base!r}')
    pg.fill('#ownHosts','40,20'); pg.fill('#ownBase','10.5.6.0'); pg.click('#ownGo'); pg.wait_for_timeout(80)
    ok(pg.evaluate("window.SS.ipStr(window.SS.state.q.S[1].net)")=='10.5.6.64' and 'net=10.5.6.0' in pg.input_value('#ownLink'),'a different starting network works and is in the link')
    p2=b.new_page(); e2=[]; p2.on('pageerror',lambda e:e2.append(str(e))); p2.goto(link); p2.wait_for_timeout(300)
    ok(p2.evaluate("window.SS.state.mode")=='vlsm' and p2.evaluate("window.SS.state.q.S.map(s=>s.H)")==[58,29,15,7],'opening the share link loads that VLSM problem')
    p2.goto(URL+'?vlsm=%3Cimg%20src%3Dx%20onerror%3Dwindow.__p%3D1%3E&net=%3Cscript%3E'); p2.wait_for_timeout(300)
    ok(not p2.evaluate("!!window.__p") and not e2,'a malformed or malicious VLSM link is ignored safely')
    print('Printing')
    pg.evaluate("window.SS.buildPrintV(4,true,false)")
    ok(pg.locator('#printArea .pp-v').count()==8 and pg.locator('#printArea .pp-key .pp-v').count()==4,'4 VLSM problems plus a 4-problem answer key')
    blank=pg.evaluate("[...document.querySelectorAll('#printArea > section.pp-v td')].every(td=>!/[01.]/.test(td.textContent)||/^Subnet/.test(td.textContent))")
    ok(blank and '192.168' in pg.inner_text('#printArea .pp-key'),'problem pages are blank, the key is filled in')
    pg.evaluate("document.body.classList.add('printing')"); pg.emulate_media(media='print'); pg.pdf(path='/tmp/vlsm_print.pdf',format='Letter'); pg.emulate_media(media='screen'); pg.evaluate("document.body.classList.remove('printing')")
    import fitz
    d=fitz.open('/tmp/vlsm_print.pdf'); per=[len([x for x in d[k].get_text('blocks') if x[4].startswith('Problem')]) for k in range(len(d))]
    ok(all(n==2 for n in per) and len(d)==4,f'prints two VLSM problems per page ({len(d)} pages: {per})')
    print('Elsewhere')
    ok(pg.evaluate("(()=>{window.SS.state.mode='mixed';for(let i=0;i<60;i++){window.SS.next();if(window.SS.state.q.mode==='vlsm')return false;}return true;})()"),'Mixed mode never throws a long VLSM sheet at you')
    ok(pg.evaluate("window.SS.WEAK.vlsm_block[1][0][0]")=='vlsm' and pg.evaluate("!!window.SS.GEN.vlsm()"),'Weak spots can drill VLSM')
    print('Phone')
    m=b.new_page(viewport={'width':360,'height':800},is_mobile=True,has_touch=True); m.goto(URL); m.wait_for_timeout(300)
    m.click('.tab[data-m="vlsm"]'); load(m,[100,50,20,10]); widest=0
    for a in answers(m): answer(m,short(a)); widest=max(widest,m.evaluate("document.documentElement.scrollWidth"))
    ok(widest<=360,f'a whole VLSM problem fits a 360px phone one at a time ({widest}px)')
    m.goto(URL+'?vlsm=100,50,20,10&layout=sheet'); m.wait_for_timeout(300)
    ok(m.evaluate("document.documentElement.scrollWidth")<=360,'the Full sheet fits a 360px phone too')
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
