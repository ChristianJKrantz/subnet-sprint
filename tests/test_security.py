"""Security checks: tries to inject code through every input and through tampered browser storage, checks the
Content Security Policy, that the page refuses to run inside someone else's frame, and that nothing loads from other sites."""
import os, sys, re, threading, functools, http.server, tempfile, shutil
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
site=tempfile.mkdtemp(); shutil.copytree(ROOT,site,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.git','tests'))
open(os.path.join(site,'evil.html'),'w').write('<iframe id="f" src="index.html" width="800" height="600"></iframe>')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=site)); threading.Thread(target=srv.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{srv.server_address[1]}/'
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
PAYLOADS=['<img src=x onerror="window.__pwned=1">','"><svg onload="window.__pwned=1">',"'><script>window.__pwned=1</script>",
          '<a href="javascript:window.__pwned=1">x</a>','{{7*7}}${7*7}','</s><b id=inj>INJECTED</b>']
html=open(os.path.join(ROOT,'index.html')).read()
csp=re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"',html)
ok(csp and "script-src 'self'" in csp.group(1) and "'unsafe-inline'" not in csp.group(1).split('script-src')[1].split(';')[0],'Content Security Policy only allows this site’s own script file (no inline or outside scripts)')
ok(csp and "object-src 'none'" in csp.group(1) and "base-uri 'none'" in csp.group(1) and "form-action 'none'" in csp.group(1),'CSP blocks plugins, <base> hijacking and form submissions')
ok('<script>' not in html and not re.search(r'<[a-z][^>]*\son[a-z]+=',html),'no inline scripts or inline event handlers in the page')
js=open(os.path.join(ROOT,'app.js')).read()
ok(not re.search(r'\beval\(|new Function|document\.write|setTimeout\([\'"`]',js),'no eval-style code execution (the calculator uses its own parser)')
for m in re.finditer(r'target="_blank"[^>]*',html+js): ok('noopener' in m.group(0),'outside link opened safely: '+m.group(0)[:60])
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(); pg=ctx.new_page(); errs=[]; offsite=[]; csp_viol=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('request',lambda r: offsite.append(r.url) if not r.url.startswith(URL) and not r.url.startswith('data:') else None)
    pg.on('console',lambda m: csp_viol.append(m.text) if 'Content Security Policy' in m.text else None)
    pg.goto(URL); pg.wait_for_timeout(800)
    ok(not offsite,f'page loads nothing from other sites {offsite[:3]}')
    ok(not csp_viol,f'the game itself triggers no CSP violations {csp_viol[:2]}')
    # 1. payloads in every answer box, in every mode
    for mode in ['binary','prefix','anding','detective','formulas']:
        pg.click(f'.tab[data-m="{mode}"]')
        for p in PAYLOADS:
            for inp in pg.locator('#fields input').all(): inp.fill(p)
            if pg.locator('#fields input').count()==0: break
            pg.click('#checkBtn'); pg.wait_for_timeout(30)
            if pg.evaluate("!!window.__pwned||!!document.getElementById('inj')"): ok(False,f'injection in {mode}: {p}'); break
            pg.click('#checkBtn')
    ok(not pg.evaluate("!!window.__pwned||!!document.getElementById('inj')"),'code typed into answer boxes is shown as text, never run (6 payloads × every mode)')
    pg.click('.tab[data-m="detective"]'); pg.fill('#f0',PAYLOADS[0]); pg.click('#checkBtn')
    ok('&lt;img' in pg.inner_html('#work') or '<img src=x' in pg.inner_text('#work'),'the typed text still appears in the feedback, just harmlessly')
    pg.click('#checkBtn'); pg.click('#walkBtn')
    for p in PAYLOADS: pg.fill('#winp',p); pg.press('#winp','Enter')
    ok(not pg.evaluate("!!window.__pwned||!!document.getElementById('inj')"),'code typed into walkthrough steps is never run')
    # calculator + typed scratchpad
    cin=pg.locator('#calcIn') if pg.locator('#calcIn').count() else None
    pg.evaluate("""(()=>{const c=document.querySelector('.tools input[type=text],#cin,.cdisp input');if(c){c.value=`<img src=x onerror="window.__pwned=1">`;c.dispatchEvent(new Event('input',{bubbles:true}));c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}})()""")
    pg.evaluate("""(()=>{const t=document.getElementById('scratchText');t.value='<script>window.__pwned=1</'+'script><img src=x onerror="window.__pwned=1">';t.dispatchEvent(new Event('input',{bubbles:true}));})()""")
    pg.wait_for_timeout(200)
    ok(not pg.evaluate("!!window.__pwned"),'calculator and typed notes never run code')
    # 2. tampered browser storage
    pg.evaluate("""localStorage.setItem('ss_weak',JSON.stringify({round_up:{w:'<img src=x onerror=window.__pwned=1>',n:'<b id=inj>x</b>'},'<img src=x onerror=window.__pwned=1>':{w:5,n:5},__proto__:{w:9,n:9}}));
      localStorage.setItem('ss_best','"<img src=x onerror=window.__pwned=1>"');localStorage.setItem('ss_tbest','"<b id=inj>x</b>"');""")
    pg.reload(); pg.wait_for_timeout(300); pg.click('.tab[data-m="weak"]'); pg.wait_for_timeout(200)
    ok(not pg.evaluate("!!window.__pwned||!!document.getElementById('inj')") and not errs,'tampered saved data is cleaned on load, not run, and doesn’t crash the game')
    pg.evaluate("localStorage.setItem('ss_weak','not json{{'); localStorage.setItem('ss_best','[]')"); pg.reload(); pg.wait_for_timeout(200)
    ok(not errs and pg.locator('#prompt').inner_text()!='','corrupted saved data falls back to a fresh start')
    # 3. a script injected despite everything is still blocked by the CSP
    blocked=pg.evaluate("""(async()=>{const s=document.createElement('script');s.textContent='window.__csp=1';document.body.appendChild(s);
      const x=document.createElement('script');x.src='https://example.com/x.js';document.body.appendChild(x);await new Promise(r=>setTimeout(r,300));return !window.__csp;})()""")
    ok(blocked,'even an injected <script> tag is refused by the CSP')
    # 4. framing
    ev=ctx.new_page(); ev.goto(URL+'evil.html'); ev.wait_for_timeout(600)
    inner=ev.frame_locator('#f').locator('body').inner_text()
    ok('can only be used on its own page' in inner and ev.frame_locator('#f').locator('#checkBtn').count()==0,'inside another site’s frame it refuses to load the game')
    ok(pg.locator('#checkBtn').count()==1,'on its own page it loads normally')
srv.shutdown(); shutil.rmtree(site)
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
