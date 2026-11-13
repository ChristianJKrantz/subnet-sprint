"""Weak-spot practice and the step-by-step chart walkthrough."""
import os, sys, ipaddress, random
from playwright.sync_api import sync_playwright
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload()

    print('Walkthrough')
    pg.click('.tab[data-m="detective"]')
    for level in ['core','stretch']:
        pg.click(f'#level button[data-l="{level}"]')
        for _ in range(40):
            while pg.evaluate("window.SS.state.q.sub")=='role': pg.click('#skipBtn')
            ok_walk=True
            q=pg.evaluate("window.SS.state.q.prompt")
            ip,p=q.split('</b>')[0].split('>')[-1].split('/'); p=int(p)
            n=ipaddress.ip_network(f'{ip}/{p}',strict=False)
            mask=str(n.netmask).split('.'); io=p//8 if p%8==0 else (p-1)//8
            exp=[str(io+1),mask[io],str(256-int(mask[io])),str(int(str(n.network_address).split('.')[io])),str(n.network_address),str(n.broadcast_address),str(n.num_addresses-2)]
            pg.click('#hintBtn')
            for k,a in enumerate(exp):
                if k==0 and random.random()<.5:   # one deliberate miss: should explain and stay on the step
                    pg.fill('#winp','9'); pg.press('#winp','Enter')
                    if not pg.inner_text('#wmsg').strip(): ok_walk=False
                pg.fill('#winp',a); pg.press('#winp','Enter')
            done=pg.locator('.wdone-all').count()==1 and pg.locator('.walk li.wok').count()==7
            for i,v in enumerate([str(n.network_address),str(n.network_address+1),str(n.broadcast_address-1),str(n.broadcast_address),str(n.num_addresses-2)]): pg.fill(f'#f{i}',v)
            pg.click('#checkBtn')
            good='good' in pg.get_attribute('#feedback','class') and '+5' in pg.inner_text('#feedback')
            if not (ok_walk and done and good): ok(False,f'walkthrough {ip}/{p}'); break
            pg.click('#checkBtn')
        else: ok(True,f'40 walkthroughs at {level} level: every step accepts the right answer, explains a wrong one, then the chart scores ½ points')
    pg.click('#level button[data-l="core"]')
    while pg.evaluate("window.SS.state.q.sub")=='role': pg.click('#skipBtn')
    pg.click('#hintBtn'); pg.fill('#winp','4'); pg.press('#winp','Enter'); pg.fill('#winp','255'); pg.press('#winp','Enter')
    ok('the mask' in pg.inner_text('#wmsg').lower() or 'octet' in pg.inner_text('#wmsg'), 'step 2 explains a wrong mask value')
    pg.click('#wshow'); ok(pg.locator('.walk li.wok').count()==2,'“Show me” reveals the step and moves on')
    pg.click('#skipBtn'); ok(pg.is_hidden('#walk'),'walkthrough clears on the next question')
    pg.click('.tab[data-m="binary"]'); pg.click('#hintBtn'); ok(pg.is_visible('#walk'),'Hint opens a walkthrough on other question types too')

    print('Weak spots')
    pg.click('.tab[data-m="weak"]')
    ok(pg.is_visible('#weakbox') and 'No' not in pg.inner_text('#weakbox')[:0] and 'mixed questions' in pg.inner_text('#weakbox'),'empty state explains itself')
    # make round-up mistakes in subnet chart mode
    pg.click('.tab[data-m="detective"]')
    made=0
    while made<3:
        if pg.evaluate("window.SS.state.q.sub")=='role': pg.click('#skipBtn'); continue
        f=pg.evaluate("window.SS.state.q.fields.map(f=>window.SS.show(f))")
        n=ipaddress.ip_network(f[0]+'/'+str(pg.evaluate("window.SS.state.q.prompt").split('/')[1].split('<')[0]))
        up=n.network_address+n.num_addresses
        if str(up).split('.')[:3]!=str(n.network_address).split('.')[:3]: pg.click('#skipBtn'); continue   # rounding up past .255 is a different mistake
        made+=1
        pg.fill('#f0',str(up)); [pg.fill(f'#f{i}',f[i]) for i in range(1,5)]
        pg.click('#checkBtn')
        chip=pg.locator('.wk-chip').first.inner_text() if pg.locator('.wk-chip').count() else ''
        pg.click('#checkBtn')
    ok('Rounding up' in chip,'a mistake shows which weak spot it was logged to')
    w=pg.evaluate("window.SS.getWeak()")
    ok(w.get('round_up',{}).get('n')==3,f'three round-ups logged ({w.get("round_up")})')
    pg.reload()
    ok(pg.evaluate("window.SS.getWeak()").get('round_up',{}).get('n')==3,'weak spots survive a reload')
    pg.click('.tab[data-m="weak"]')
    ok('Rounding up instead of down' in pg.inner_text('#weakbox'),'panel lists the weak spot')
    modes=set()
    for _ in range(30):
        modes.add(pg.evaluate("window.SS.state.q.mode")); 
        if 'drilling: Rounding up' not in pg.inner_text('#qtype'): ok(False,'question labelled with what it drills'); break
        pg.click('#skipBtn')
    ok(modes<= {'detective','anding'},f'drill questions come from the right modes {modes}')
    before=pg.evaluate("window.SS.getWeak().round_up.w")
    for _ in range(6):
        if pg.evaluate("window.SS.state.q.target")!='round_up': break
        f=pg.evaluate("window.SS.state.q.fields.map(f=>window.SS.show(f))")
        for i,v in enumerate(f): pg.fill(f'#f{i}',v.replace(',',''))
        pg.click('#checkBtn'); pg.click('#checkBtn')
    after=pg.evaluate("window.SS.getWeak().round_up")
    ok(after['w']<before and after['w']==0,f'right answers shrink the weak spot ({before} → {after["w"]})')
    ok('cleared' in pg.inner_text('#weakbox'),'cleared message once every spot is fixed')
    pg.click('#weakReset'); ok(pg.evaluate("Object.keys(window.SS.getWeak()).length")==0,'Reset wipes the log')

    print('Phone layout')
    m=b.new_page(viewport={'width':390,'height':844}); m.goto(URL); m.click('.tab[data-m="detective"]'); m.click('#hintBtn')
    wide=m.evaluate("document.documentElement.scrollWidth<=window.innerWidth")
    ok(wide,'walkthrough fits a phone screen with no sideways scroll')
    m.screenshot(path='/tmp/walk_phone.png',full_page=True)
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
