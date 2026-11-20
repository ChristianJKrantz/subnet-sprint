"""Packet Tracer lab mode: Part 1 of the Cisco "Subnetting Scenario" lab (11.7.5). Checks the class lab's answers, hundreds
of random networks, feedback for common mistakes, hints, the part picker, the link to No Shutdown for Part 2,
your-own-lab and share links, printing, and phones. (Part 2, the IOS commands, is tested in No Shutdown.)"""
import os, sys, re
from playwright.sync_api import sync_playwright
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
CLASS='?lab=192.168.100.0&hosts=25&r1=2&r2=2'
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
def answers(pg): return pg.evaluate("window.SS.state.q.fields.map(f=>window.SS.show(f))")
def labels(pg): return pg.evaluate("window.SS.state.q.fields.map(f=>f.label)")
def short(a): return a.split('.')[-1] if re.match(r'^\d+\.\d+\.\d+\.\d+$',a) else a
def answer(pg,a): pg.fill('#fin',a); pg.press('#fin','Enter'); pg.wait_for_timeout(10)
def upto(pg,label):
    for a,l in zip(answers(pg),labels(pg)):
        if l==label: return
        answer(pg,short(a))
    raise Exception('no field '+label)
def msg(pg): return pg.inner_text('.fc-msg')
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':1000}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.goto(URL+CLASS); pg.wait_for_timeout(400)
    print('The class lab (11.7.5: 192.168.100.0/24, 25 hosts per LAN)')
    A=dict(zip(labels(pg),answers(pg)))
    ok([A[k] for k in ['a. Based on the topology, how many subnets are needed?','b. How many bits must be borrowed to support that many subnets?','c. How many subnets does this create?','d. How many usable hosts does this create per subnet?']]==['5','3','8','30'],'Step 1 a–d: 5 subnets, 3 bits, 8 subnets, 30 hosts')
    ok([A[f'e. Subnet {k} last octet in binary'] for k in (2,3,4)]==['01000000','01100000','10000000'] and A['f. New subnet mask in decimal']=='255.255.255.224','binary subnet values and the /27 mask')
    ok([(A[f'Subnet {k} subnet address'],A[f'Subnet {k} last usable host'],A[f'Subnet {k} broadcast address']) for k in (0,4,7)]==[('192.168.100.0','192.168.100.30','192.168.100.31'),('192.168.100.128','192.168.100.158','192.168.100.159'),('192.168.100.224','192.168.100.254','192.168.100.255')],'subnet table rows (0, 4 and 7 spot-checked) match')
    exp={'R1 G0/0':'.1','R1 G0/1':'.33','R1 S0/0/0':'.129','R2 G0/0':'.65','R2 G0/1':'.97','R2 S0/0/0':'.158','S1 VLAN 1':'.2','S2 VLAN 1':'.34','S3 VLAN 1':'.66','S4 VLAN 1':'.98','PC1 NIC':'.30','PC2 NIC':'.62','PC3 NIC':'.94','PC4 NIC':'.126'}
    ok(all(A[f'{k} IP address']=='192.168.100'+v for k,v in exp.items()),'Addressing Table IPs match the filled-in lab')
    ok([A[f'{d} default gateway'] for d in ('S1','S3','PC2','PC4')]==['192.168.100.1','192.168.100.65','192.168.100.33','192.168.100.97'],'switch and PC gateways match')
    ok(len(labels(pg))==72 and not any(l.startswith(('Get into','Enter global')) for l in labels(pg)),'Part 1 only (72 questions): the IOS commands moved to No Shutdown')
    link=pg.get_attribute('.lab-p2 a','href')
    ok(link=='https://christianjkrantz.github.io/no-shutdown/?task=scenario&lab=192.168.100.0&hosts=25&r1=2&r2=2' and pg.get_attribute('.lab-p2 a','rel')=='noopener','links to No Shutdown for Part 2 with this exact network')
    ok(pg.locator('#prompt svg.topo').count()==1 and pg.locator('#prompt svg.topo text').filter(has_text='PC4').count()==1,'the topology diagram is drawn')
    print('Random networks')
    bad=pg.evaluate("""(()=>{const out=[];for(let i=0;i<300;i++){const q=window.SS.genLab(null,'all'),L=q.L,ip=window.SS.ipStr;
      if(L.need!==L.lans.length+1)out.push('need');if(2**L.n<L.need||2**(L.n-1)>=L.need)out.push('bits');
      if(L.hosts>L.per||L.hosts<2)out.push('hosts');
      const seen=new Set();L.rows.forEach(r=>{if(seen.has(r.ip))out.push('dup');seen.add(r.ip);const s=r.link.sub;
        if(r.ip<=s.net||r.ip>=s.bc)out.push('range');
        if(r.role==='sw'&&r.ip!==s.first+1)out.push('sw');if(r.role==='pc'&&r.ip!==s.last)out.push('pc');if(r.role==='r2wan'&&r.ip!==s.last)out.push('wan');
        if(r.gw!=null&&r.gw!==s.first)out.push('gw');});
      if(L.subs.some((s,k)=>s.net!==L.base+k*L.blk))out.push('align');}
      return [...new Set(out)];})()""")
    ok(bad==[],f'300 random networks: right subnet count and bits, hosts fit, table rules followed, no duplicate addresses {bad}')
    print('Feedback (one at a time)')
    pg.goto(URL+CLASS); pg.wait_for_timeout(300)
    answer(pg,'4'); ok('serial link between R1 and R2' in msg(pg) and '5' not in msg(pg).split('Try again')[0],'forgetting the WAN link: says count it, without giving 5')
    answer(pg,'6'); ok('single subnet' in msg(pg),'counting the WAN link twice is caught')
    answer(pg,'5'); answer(pg,'5'); ok('number of subnets' in msg(pg),'typing the subnet count as the bits borrowed is caught')
    answer(pg,'2'); ok('fewer than 5' in msg(pg),'too few bits borrowed is caught')
    answer(pg,'4'); ok('borrowed too many' in msg(pg),'too many bits (14 hosts < 25) is caught')
    answer(pg,'3'); answer(pg,'5'); ok('full power of 2' in msg(pg),'subnets created = subnets needed is caught')
    answer(pg,'8'); answer(pg,'32'); ok('subtract 2' in msg(pg),'forgetting the − 2 for hosts is caught')
    answer(pg,'30'); answer(pg,'64'); answer(pg,'00000010'); ok('borrowed' in msg(pg) and 'leftmost' in msg(pg),'subnet 2 written as 00000010 gets “the subnet number sits in the borrowed bits”')
    upto(pg,'f. New subnet mask, 4th octet in binary'); answer(pg,'11000000'); ok('borrowed bits are the 1s' in msg(pg),'a mask with the wrong number of 1s is caught')
    upto(pg,'R1 G0/1 IP address'); answer(pg,'1'); ok('subnet 0' in msg(pg) and 'subnet 1' in msg(pg),'an address from the wrong subnet names both subnets')
    upto(pg,'R2 S0/0/0 IP address'); answer(pg,'129'); ok('clash' in msg(pg),'R2 taking the WAN link’s first address (R1’s) is caught')
    upto(pg,'S1 VLAN 1 IP address'); answer(pg,'1'); ok('first usable' in msg(pg) and 'second usable' in msg(pg),'a switch given the router’s address gets the switch rule')
    upto(pg,'PC1 default gateway'); answer(pg,'2'); ok('That’s the switch' in msg(pg),'a PC gateway set to the switch is caught')
    w=pg.evaluate("window.SS.getWeak()"); ok(all(t in w for t in ['lab_count','lab_borrow','lab_assign']),f'mistakes are logged to weak spots ({sorted(t for t in w if t.startswith("lab"))})')
    print('Hints')
    upto(pg,'R2 S0/0/0 IP address'); pg.click('#fhint')
    ok('Which subnet number' in pg.inner_text('.fc-steps'),'an Addressing Table hint first asks which subnet the device is on')
    tips=pg.evaluate("(()=>{const q=window.SS.state.q;return q.walk().map(s=>window.SS.tipFor(s,q)).filter(Boolean);})()")
    ok(all(not re.search(r'\d+\.\d+\.\d+\.\d+',t) or '192.168' not in t for t in tips),'no shortcut tip contains an address from the problem')
    pg.click('#freveal') if pg.is_visible('#freveal') else None
    print('A perfect run')
    pg.goto(URL+CLASS); pg.wait_for_timeout(300)
    for a in answers(pg): answer(pg,short(a))
    fb=pg.inner_text('#feedback'); ok('+10' in fb and 'good' in pg.get_attribute('#feedback','class'),f'all 72 answers right scores +10 ({fb[:20]})')
    ok('No Shutdown' in pg.evaluate("window.SS.state.q.explain"),'the worked answer points to No Shutdown for Part 2')
    pg.click('#checkBtn')
    print('Parts')
    pg.goto(URL+CLASS); pg.wait_for_timeout(300)
    ok(pg.locator('#labPart button').count()==3,'the part picker has Part 1, Step 1 and Steps 2–3')
    for p,first,n in [('subnet','a. Based on the topology, how many subnets are needed?',44),('table','Assign Subnet 0 to the LAN on R1 G0/0: its subnet address',28)]:
        pg.click(f'#labPart button[data-p="{p}"]'); pg.wait_for_timeout(150)
        ok(pg.inner_text('.fc-q')==first and len(labels(pg))==n and pg.evaluate("window.SS.state.custom&&window.SS.state.custom.hosts")==25,f'“{p}” part: {n} questions, starting at the right step, same network')
    ok(pg.locator('.fs-ref').count()==1,'later parts show the earlier results as a reference')
    pg.click('#labPart button[data-p="all"]')
    ok(pg.is_hidden('#layoutSeg') and pg.is_hidden('#level') and pg.is_visible('#labPart'),'the lab hides the layout and level switches and shows the part picker')
    print('Your own lab and share links')
    pg.click('#ownBtn'); pg.click('#ownClass'); pg.wait_for_timeout(100)
    ok('192.168.100.0' in pg.inner_text('#ownMsg') and 'lab=192.168.100.0' in pg.input_value('#ownLink'),'the 11.7.5 button loads the class lab and gives a link')
    for net,h,r1,r2,expect in [('192.168.100.5','25','2','2','ends in .0'),('127.0.0.0','25','2','2','not 127'),('10.0.0.0','x','2','2','whole number'),('10.0.0.0','40','2','2','fewer than 40')]:
        pg.fill('#ownNet',net); pg.fill('#ownHosts',h); pg.select_option('#ownR1',r1); pg.select_option('#ownR2',r2); pg.click('#ownGo'); ok(expect in pg.inner_text('#ownMsg'),f'rejects {net} with {h} hosts')
    pg.fill('#ownNet','10.20.30.0'); pg.fill('#ownHosts','50'); pg.select_option('#ownR1','1'); pg.select_option('#ownR2','1'); pg.click('#ownGo'); pg.wait_for_timeout(100)
    ok(pg.evaluate("[window.SS.state.q.L.n,window.SS.state.q.L.per]")==[2,62],'a 1 + 1 LAN network borrows 2 bits (62 hosts each)')
    p2=b.new_page(); e2=[]; p2.on('pageerror',lambda e:e2.append(str(e))); p2.goto(pg.input_value('#ownLink')); p2.wait_for_timeout(300)
    ok(p2.evaluate("window.SS.state.mode")=='lab' and p2.evaluate("window.SS.ipStr(window.SS.state.q.L.base)")=='10.20.30.0','opening the share link loads that lab')
    p2.goto(URL+'?lab=%3Cimg%20src%3Dx%20onerror%3Dwindow.__p%3D1%3E&hosts=%3Cscript%3E&r1=9'); p2.wait_for_timeout(300)
    ok(not p2.evaluate("!!window.__p") and not e2,'a malformed or malicious lab link is ignored safely')
    pg.fill('#ownHosts','1'); pg.click('#ownClose')
    print('Printing')
    pg.evaluate("window.SS.buildPrintL(2,true,false)")
    ok(pg.locator('#printArea .pp-lab').count()==4 and pg.locator('#printArea .pp-key .pp-lab').count()==2,'2 labs plus a 2-lab answer key')
    pg.evaluate("document.body.classList.add('printing')"); pg.emulate_media(media='print'); pg.pdf(path='/tmp/lab_print.pdf',format='Letter'); pg.emulate_media(media='screen'); pg.evaluate("document.body.classList.remove('printing')")
    import fitz
    d=fitz.open('/tmp/lab_print.pdf'); starts=[k for k in range(len(d)) if any(x[4].startswith('Lab ') for x in d[k].get_text('blocks'))]
    ok(len(starts)==4 and starts==sorted(set(starts)) and len(d)<=10,f'each lab starts on its own page ({len(d)} pages, labs start on {[s+1 for s in starts]})')
    txt=''.join(d[k].get_text() for k in range(len(d)))
    ok('Addressing Table' in txt and 'no-shutdown' in txt,'the printout has the Addressing Table, and points to No Shutdown for Part 2')
    print('Phone')
    m=b.new_page(viewport={'width':360,'height':800},is_mobile=True,has_touch=True); m.goto(URL+CLASS); m.wait_for_timeout(300); widest=0
    for a in answers(m):
        answer(m,short(a)); widest=max(widest,m.evaluate("document.documentElement.scrollWidth"))
    ok(widest<=360,f'the whole lab fits a 360px phone ({widest}px)')
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
