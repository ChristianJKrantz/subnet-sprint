"""The learning path: a fresh visit opens on it, each skill's lesson and quick check lead into a practice session,
a good session adds a bar and unlocks the next skill, missed questions come back with new numbers, progress survives
a reload, tampered progress can't inject anything, and it fits a phone."""
import os, json, time
from playwright.sync_api import sync_playwright
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
# answer the current question: right=True types the answers, right=False types junk
ANSWER="""(right)=>{const q=SS.state.q;q.fields.forEach((f,i)=>{const el=document.querySelector(`.field[data-i="${i}"]`);if(!el)return;
  if(f.type==='bits'){[...f.answer].forEach((c,k)=>{const b=el.querySelectorAll('.bit')[k];const want=right?c==='1':c!=='1';if(want!==b.classList.contains('on'))b.click();});}
  else if(f.type==='choice'){const want=right?f.answer:Object.keys({network:1,host:1,broadcast:1}).find(k=>k!==f.answer);el.querySelector(`.choice[data-v="${want}"]`).click();}
  else el.querySelector('input').value=right?SS.show(f).replace(/,/g,''):'1';});}"""
def play(pg,right_fn,limit=40):
    n=0
    while pg.evaluate("SSPath.view")=='run' and n<limit:
        flow=pg.evaluate("!!SS.state.flow")
        if flow:   # a full worksheet, one question at a time: answer each one from the app's own answers
            while pg.evaluate("SS.state.flow&&SS.state.flow.k<SS.state.q.fields.length"):
                pg.evaluate("()=>{const F=SS.state.flow;SS.flowAnswer(SS.show(SS.state.q.fields[F.k]).replace(/,/g,''))}")
            pg.click('#checkBtn'); n+=1; continue   # the last answer checks the sheet; this is Next
        pg.evaluate(ANSWER, right_fn(n))
        pg.click('#checkBtn'); pg.click('#checkBtn'); n+=1
    return n
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':950}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(200)
    print('First visit')
    ok(pg.is_visible('#pathbox') and pg.is_hidden('.game>.card'),'a fresh visit opens on the path, not a question')
    ok('learn · 01' in pg.inner_text('#plStart').lower() and 'Bits and octets' in pg.inner_text('#plStart'),'the Start button points at the first skill')
    ok(pg.locator('.pl-node.locked').count()==len(pg.evaluate("SSPath.UNITS"))-1,'every skill after the first starts locked')
    print('Lesson and quick check')
    pg.click('#plStart'); ok(pg.is_visible('.pl-lesson') and 'place value' in pg.inner_text('.pl-body'),'Start opens the lesson first')
    steps=len(pg.evaluate("SSPath.UNITS[0].learn"))
    for _ in range(steps): pg.click('#plNext')
    ok(pg.locator('.pl-opt').count()==3 and pg.is_hidden('#plNext'),'the lesson ends in a quick check, and you can’t skip it')
    a=pg.evaluate("SSPath.UNITS[0].check.a"); wrong=[k for k in range(3) if k!=a][0]
    pg.click(f'.pl-opt[data-k="{wrong}"]'); ok('Not that one' in pg.inner_text('#plWhy') and pg.is_hidden('#plNext'),'a wrong pick sends you back to the lesson without the answer')
    pg.click(f'.pl-opt[data-k="{a}"]'); ok(pg.is_visible('#plNext') and pg.evaluate("SSPath.progress.u.bin.s"),'the right pick explains why and opens practice')
    pg.click('#plNext')
    ok(pg.evaluate("SSPath.view")=='run' and pg.is_visible('.game>.card') and pg.evaluate("SS.state.q.mode")=='binary','practice starts with the skill’s own questions')
    ok('Question 1 of 6' in pg.inner_text('.pl-run'),'the session strip shows how far along you are')
    print('Session: misses come back')
    play(pg,lambda n: n not in (0,1))   # miss the first two
    ok(pg.evaluate("SSPath.view")=='done','the session ends on a summary')
    ok('4/6' in pg.inner_text('.pl-score'),'only first tries count ('+pg.inner_text('.pl-score').replace('\n',' ')+')')
    ok(pg.evaluate("SSPath.progress.u.bin.l")==0 and pg.is_visible('#plAgain'),'4/6 isn’t enough to add a bar')
    pg.click('#plAgain'); n=play(pg,lambda n: True)
    ok(n==6,'a clean session has no extra questions')
    ok(pg.evaluate("SSPath.progress.u.bin.l")==1 and 'Signal up' in pg.inner_text('.pl-done'),'6/6 adds a bar')
    ok('Prefix and mask' in pg.inner_text('.pl-unlock'),'and unlocks the next skill')
    due=pg.evaluate("SSPath.progress.u.bin.d-Date.now()")
    ok(80e6<due<90e6,'one bar comes back for review tomorrow')
    pg.click('#plStart' if pg.locator('#plStart').count() else '#plCont')
    ok(pg.is_visible('.pl-lesson') and 'Prefix and mask' in pg.inner_text('.pl-lesson h2'),'Continue goes on to the next new skill')
    # a miss in the session is re-asked at the end with new numbers
    for _ in range(len(pg.evaluate("SSPath.UNITS[1].learn"))): pg.click('#plNext')
    pg.click(f'.pl-opt[data-k="{pg.evaluate("SSPath.UNITS[1].check.a")}"]'); pg.click('#plNext')
    n=play(pg,lambda n: n!=2)
    ok(n==7,f'a missed question comes back once at the end ({n} questions for 6)')
    print('Saved progress')
    pg.reload(); pg.wait_for_timeout(200)
    ok(pg.is_visible('#pathbox') and pg.evaluate("SSPath.progress.u.bin.l")==1,'progress and the Path tab survive a reload')
    ok(pg.locator('.pl-node:not(.locked)').count()>=3,'unlocked skills stay unlocked')
    pg.click('.pl-node button[data-u="bin"]'); ok(pg.is_visible('.pl-unit') and pg.is_visible('#plLesson'),'a started skill opens its page with practice and the lesson')
    pg.click('#plBack')
    pg.evaluate("localStorage.setItem('ss_path',JSON.stringify({u:{bin:{l:9,d:'<img src=x onerror=window.__p=1>',s:'yes'},__proto__:{l:5},'<b id=inj>':{l:3}},days:['<img src=x onerror=window.__p=1>','2026-01-01']}))")
    pg.reload(); pg.wait_for_timeout(200)
    ok(not pg.evaluate("!!window.__p||!!document.getElementById('inj')") and pg.evaluate("SSPath.progress.u.bin.l")==0 and not errs,'tampered progress is cleaned, not run')
    pg.evaluate("localStorage.setItem('ss_path','not json{')"); pg.reload(); pg.wait_for_timeout(200)
    ok(pg.is_visible('#plStart') and not errs,'corrupt progress starts a fresh path')
    print('Free practice')
    pg.click('.pl-chips button[data-m="anding"]'); pg.wait_for_timeout(100)
    ok(pg.evaluate("SS.state.mode")=='anding' and pg.is_hidden('#pathbox') and pg.is_visible('.game>.card'),'Free practice chips open the classic modes')
    pg.click('.tab[data-m="path"]'); ok(pg.is_visible('#plStart'),'the Path tab brings the path back')
    pg.click('#plStart'); pg.click('.tab[data-m="binary"]'); pg.click('.tab[data-m="path"]')
    ok(pg.is_visible('#plStart') and pg.evaluate("SSPath.session")==None,'leaving mid-lesson goes back to the map')
    print('Every skill')
    pg.evaluate("SSPath.reset()")
    for i,u in enumerate(pg.evaluate("SSPath.UNITS.map(u=>u.id)")):
        pg.evaluate(f"""()=>{{const p=SSPath.progress;SSPath.UNITS.slice(0,{i}).forEach(x=>p.u[x.id]={{l:1,d:Date.now()+9e9,s:true}});p.u['{u}']={{l:0,d:0,s:true}};localStorage.setItem('ss_path',JSON.stringify(p));}}""")
        pg.reload(); pg.wait_for_timeout(100); pg.click(f'.pl-node button[data-u="{u}"]')
        if pg.locator('.pl-lesson').count():
            for _ in range(len(pg.evaluate(f"SSPath.UNITS[{i}].learn"))): pg.click('#plNext')
            pg.click(f'.pl-opt[data-k="{pg.evaluate(f"SSPath.UNITS[{i}].check.a")}"]'); pg.click('#plNext')
        else: pg.click('#plGo')
        n=play(pg,lambda n: True)
        ok(pg.evaluate(f"SSPath.progress.u['{u}'].l")==1 and n==pg.evaluate(f"SSPath.UNITS[{i}].n"),f'skill {i+1} ({u}): lesson, {n} question(s), a bar')
    ok(not errs,'no page errors '+str(errs[:2]))
    print('Phone')
    m=b.new_page(viewport={'width':360,'height':780},is_mobile=True,has_touch=True); merrs=[]; m.on('pageerror',lambda e:merrs.append(str(e)))
    m.goto(URL); m.evaluate('localStorage.clear()'); m.reload(); m.wait_for_timeout(200)
    ok(m.evaluate("document.documentElement.scrollWidth<=360"),'the path fits a 360px phone')
    ok(m.is_hidden('#tabs') and m.locator('.pl-chips button').count()==9,'on a phone the path replaces the mode tabs, with free practice below it')
    top=m.evaluate("document.querySelector('#plStart').getBoundingClientRect().bottom"); ok(top<780,'the Start button is on the first screen')
    m.tap('#plStart'); ok(m.is_hidden('.game>header'),'a lesson hides the header so the lesson is on top')
    for _ in range(3): m.tap('#plNext')
    m.tap(f'.pl-opt[data-k="{m.evaluate("SSPath.UNITS[0].check.a")}"]'); m.tap('#plNext')
    r=m.evaluate("document.querySelector('#checkBtn').getBoundingClientRect().bottom"); ok(r<780,'in a session the question and Check fit the first screen')
    ok(m.evaluate("document.documentElement.scrollWidth<=360") and not merrs,'no overflow or errors on a phone')
    b.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); raise SystemExit(1 if fails else 0)
