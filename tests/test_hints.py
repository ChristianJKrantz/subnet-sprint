"""Step-by-step hints: every question type gets a walkthrough whose steps lead to the real answer, every step
accepts the right input and explains a wrong one, and finishing a question after the hint scores half points."""
import os, sys, random
from playwright.sync_api import sync_playwright
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
fails=[]
def ok(c,msg):
    print(('  ✓ ' if c else '  ✗ ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(URL)
    # 1. logic: for thousands of generated questions, the steps' answers lead to the field answers
    r=pg.evaluate("""(()=>{with(window.SS){const bad=[];const kinds={};
      for(let t=0;t<2500;t++)for(const m of ['binary','prefix','anding','detective','formulas']){state.level=t%2?'core':'stretch';const q=GEN[m]();
        const k=q.mode+(q.sub!=null?':'+q.sub:'');kinds[k]=(kinds[k]||0)+1;if(!q.walk){bad.push('no walk '+k);continue;}
        const st=q.walk();const last=st[st.length-1];if(!last.done){bad.push('no final step '+k);continue;}
        const work=st.filter(s=>!s.done);if(work.some(s=>s.ans===undefined||typeof s.bad!=='function'||!s.q)){bad.push('incomplete step '+k);continue;}
        const answers=work.map(s=>s.ans);
        q.fields.forEach(f=>{const a=f.answer;
          const hit=f.type==='bits'?work.map(s=>s.ans).join('')===a:answers.includes(a)||(q.mode==='detective'&&(a===((answers[4]+1)>>>0)||a===((answers[5]-1)>>>0)));
          if(!hit)bad.push(`${k} field ${f.label} (${a}) not reached by the steps`);});
        // every wrong-answer message is non-empty and never throws
        work.forEach(s=>{for(const raw of ['', '999', '0', '1', '/5', '10.0.0.0', '11111111', 'abc']){let u=null;
          try{const msg=s.bad(s.kind==='ip'?parseIP(raw):s.kind==='num'?(/^\\d+$/.test(raw)?Number(raw):null):null,raw);if(typeof msg!=='string'&&!(msg instanceof String))bad.push('bad() returned '+typeof msg+' '+k);}
          catch(e){bad.push('bad() threw '+k+' '+e);}}});}
      return {bad:bad.slice(0,10),n:bad.length,kinds};}})()""")
    ok(r['n']==0,f"12,500 questions across {len(r['kinds'])} question types: every step leads to the real answer and handles junk input {r['bad']}")
    print('    types:',', '.join(sorted(r['kinds'])))
    # 2. UI: do the walkthrough for real on several questions of each type
    for mode in ['binary','prefix','anding','detective','formulas']:
        pg.click(f'.tab[data-m="{mode}"]'); done=0
        for _ in range(8):
            pg.click('#hintBtn'); ok_q=True
            n=pg.evaluate("window.SS.state.walk.steps.length")
            for i in range(n-1):
                st=pg.evaluate("(()=>{const s=window.SS.state.walk.steps[window.SS.state.walk.i];return {kind:s.kind,ans:s.kind==='ip'?window.SS.ipStr?null:null:s.ans}})()")
                ans=pg.evaluate("(()=>{const s=window.SS.state.walk.steps[window.SS.state.walk.i];const a=s.ans;if(s.kind!=='ip')return (s.kind==='prefix'?'/':'')+a;return [a>>>24,(a>>16)&255,(a>>8)&255,a&255].join('.')})()")
                if random.random()<.4:
                    pg.fill('#winp','7.7.7.7' if st['kind']=='ip' else ('00000000' if st['kind']=='bits8' and ans!='00000000' else '987'))
                    pg.press('#winp','Enter')
                    if not pg.inner_text('#wmsg').strip(): ok_q=False
                pg.fill('#winp',ans); pg.press('#winp','Enter')
            if pg.locator('.wdone-all').count()!=1: ok_q=False
            f=pg.evaluate("window.SS.state.q.fields.map(f=>f.type==='bits'?f.answer:window.SS.show(f))")
            for i,(v,t) in enumerate(zip(f,pg.evaluate("window.SS.state.q.fields.map(f=>f.type)"))):
                if t=='bits':
                    for k,c in enumerate(v):
                        if c=='1': pg.click(f'.bit[data-k="{k}"]')
                else: pg.fill(f'#f{i}',v.replace(',',''))
            pg.click('#checkBtn')
            if not ('good' in pg.get_attribute('#feedback','class') and ('½' in pg.inner_text('#feedback') or 'half' in pg.inner_text('#feedback').lower() or '+5' in pg.inner_text('#feedback'))): ok_q=False
            if not ok_q: ok(False,f'walkthrough in {mode}: {pg.evaluate("window.SS.state.q.prompt")}'); break
            done+=1; pg.click('#checkBtn')
        if done==8: ok(True,f'{mode}: 8 hints walked through on screen (with deliberate wrong steps), then answered for half points')
    ok(pg.is_visible('#hintBtn') and 'step by step' in pg.inner_text('#hintBtn').lower(),'Hint button says it’s step by step')
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
