"""Phone/tablet panels: finger swipes scroll the open panel (with momentum) and never the page behind it,
while taps on panel buttons and drawing on the scratchpad still work."""
import os, sys
from playwright.sync_api import sync_playwright
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
def swipe(pg,cdp,x,y,dx,dy,steps=12,end_pause=0):
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for i in range(1,steps+1):
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*i/steps,'y':y+dy*i/steps}]}); pg.wait_for_timeout(16)
    if end_pause: pg.wait_for_timeout(end_pause)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); pg.wait_for_timeout(700)
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for name,vp in [('phone',(390,844)),('tablet',(820,1180))]:
        print(name)
        ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]},is_mobile=True,has_touch=True); pg=ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(300); cdp=ctx.new_cdp_session(pg)
        pg.locator('.dock button:has-text("Guide")').first.click(); pg.wait_for_timeout(600)
        g="document.getElementById('t-guide').scrollTop"; y0=pg.evaluate("scrollY")
        box=pg.locator('#t-guide').bounding_box(); x=box['x']+box['width']/2; y=box['y']+box['height']*0.75
        swipe(pg,cdp,x,y,0,-120,end_pause=150); a=pg.evaluate(g)
        ok(a>=100,f'slow drag scrolls the Guide ({a}px)')
        swipe(pg,cdp,x,y,0,-120,steps=5); f=pg.evaluate(g)
        ok(f-a>150,f'a flick keeps scrolling with momentum ({f-a}px for a 120px flick)')
        swipe(pg,cdp,x,y,0,600); ok(pg.evaluate(g)==0,'swiping down scrolls back to the top')
        ok(pg.evaluate("scrollY")==y0,'the page behind the panel never moves')
        pg.locator('.dock button:has-text("Calculator")').first.click(); pg.wait_for_timeout(400)
        pg.evaluate("document.getElementById('t-calc').scrollTop=9999"); pg.wait_for_timeout(100)
        bb=pg.locator('#ckeys button[data-k="7"]').bounding_box(); pg.touchscreen.tap(bb['x']+bb['width']/2,bb['y']+bb['height']/2); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.getElementById('cin').value")=='7','tapping calculator keys still works')
        pg.locator('.dock button:has-text("Scratchpad")').first.click(); pg.wait_for_timeout(500)
        pb=pg.locator('#ink').bounding_box(); swipe(pg,cdp,pb['x']+40,pb['y']+40,120,60)
        ok(pg.evaluate("(()=>{const c=document.getElementById('ink');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n>50})()"),'drawing on the scratchpad still works')
        ctx.close()
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
