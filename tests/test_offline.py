"""Install + offline: serves the site over http://localhost, loads it once, cuts the network and plays."""
import os, sys, json, shutil, tempfile, threading, functools, http.server
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
site=tempfile.mkdtemp(); shutil.copytree(ROOT,site,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.git','tests'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=site)); threading.Thread(target=srv.serve_forever,daemon=True).start()
URL=f'http://localhost:{srv.server_address[1]}/'
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
m=json.load(open(os.path.join(ROOT,'manifest.webmanifest')))
ok(m['display']=='standalone' and any(i['sizes']=='512x512' for i in m['icons']) and any(i.get('purpose')=='maskable' for i in m['icons']),'manifest is installable (standalone, 192/512 + maskable icons)')
ok(all(os.path.exists(os.path.join(ROOT,i['src'])) for i in m['icons']),'every manifest icon exists')
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate("navigator.serviceWorker.ready"); pg.reload(); pg.wait_for_timeout(500)
    ok(pg.evaluate("!!navigator.serviceWorker.controller"),'service worker installs and takes control')
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_timeout(500)
    ok(pg.title().startswith('Subnet Sprint'),'page reloads with the network off')
    pg.click('.tab[data-m="detective"]')
    f=pg.evaluate("window.SS.state.q.fields.map(f=>window.SS.show(f))")
    for i,v in enumerate(f): pg.fill(f'#f{i}',v.replace(',',''))
    pg.click('#checkBtn')
    ok('good' in pg.get_attribute('#feedback','class'),'a full subnet chart question works offline')
    pg2=ctx.new_page(); pg2.goto(URL+'?from=homescreen'); ok(pg2.title().startswith('Subnet Sprint'),'opening from the home-screen icon works offline')
    ctx.set_offline(False)
    # a new version on the server is picked up on the next online load
    p=os.path.join(site,'index.html'); s=open(p).read(); open(p,'w').write(s.replace('<title>Subnet Sprint','<title>Subnet Sprint NEW'))
    pg.reload(); pg.wait_for_timeout(300)
    ok('NEW' in pg.title(),'when online, the newest version loads automatically')
    ctx.set_offline(True); pg.reload(); ok('NEW' in pg.title(),'and that newer version is what gets saved for offline')
    ctx.set_offline(False)
    # install button: Chrome/Android path
    pg.evaluate("""(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompted=true};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);})()""")
    ok(pg.is_visible('#installBtn'),'Install app button appears when the browser offers installing')
    pg.click('#installBtn'); pg.wait_for_timeout(200); ok(pg.evaluate("window.__prompted===true"),'button opens the browser’s install prompt')
    # iPhone path
    ip=b.new_context(user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',viewport={'width':390,'height':844}).new_page()
    ip.goto(URL); ok(ip.is_visible('#installBtn'),'iPhone shows the Install app button')
    ip.click('#installBtn'); ok('Add to Home Screen' in ip.inner_text('.iospop'),'iPhone gets Add to Home Screen directions')
    ip.screenshot(path='/tmp/ios_install.png')
    ok(not errs,f'no page errors {errs}')
srv.shutdown(); shutil.rmtree(site)
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
