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
      for(let t=0;t<2500;t++)for(const m of ['binary','prefix','anding','detective','formulas','worksheet']){state.level=t%2?'core':'stretch';const q=GEN[m]();
        const k=q.mode+(q.sub!=null?':'+q.sub:'');kinds[k]=(kinds[k]||0)+1;if(!q.walk){bad.push('no walk '+k);continue;}
        const w=startWalk(q),work=w.steps;
        if(work.some(s=>s.ans===undefined||typeof s.bad!=='function'||!s.q)){bad.push('incomplete step '+k);continue;}
        // every answer box is filled by exactly one step, with exactly the box's answer
        q.fields.forEach((f,i)=>{const fin=work.filter(s=>s.f===i);
          const same=fin.length===1&&(f.type==='bits'?fin[0].ans===f.answer:f.type==='numalt'?fin[0].ans===f.answer:fin[0].ans===f.answer);
          if(!same)bad.push(`${k} box “${f.label}”: ${fin.length} final steps`);});
        const order=work.filter(s=>s.f!=null).map(s=>s.f);if(order.some((v,i)=>v!==i))bad.push(k+' questions out of order '+order.join(','));
        // every wrong-answer message is non-empty and never throws
        work.forEach(s=>{for(const raw of ['', '999', '0', '1', '/5', '10.0.0.0', '11111111', 'abc']){let u=null;
          try{const msg=s.bad(s.kind==='ip'?parseIP(raw):s.kind==='num'?(/^\\d+$/.test(raw)?Number(raw):null):null,raw);if(typeof msg!=='string'&&!(msg instanceof String))bad.push('bad() returned '+typeof msg+' '+k);}
          catch(e){bad.push('bad() threw '+k+' '+e);}}});}
      return {bad:bad.slice(0,10),n:bad.length,kinds};}})()""")
    ok(r['n']==0,f"12,500 questions across {len(r['kinds'])} question types: every answer box gets its own steps in order, ending in exactly its answer, and every step handles junk input {r['bad']}")
    print('    types:',', '.join(sorted(r['kinds'])))

    # 1b. no step gives away its own answer, in the question or in the nudge after a wrong try
    hits=pg.evaluate("""(()=>{with(window.SS){const hits=[];
      const fmt=(s)=>{const a=s.ans;if(s.kind==='ip')return [ipStr(a)];if(s.kind==='prefix')return ['/'+a];if(s.kind==='cls')return ['Class '+a];
        if(s.kind==='bits8'||s.kind==='bin32')return [String(a),String(a).replace(/\\./g,'')];if(typeof a==='number'&&a>=10)return [String(a),a.toLocaleString()];return [];};
      const strip=h=>String(h).replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ');
      for(let t=0;t<600;t++)for(const m of ['binary','prefix','anding','detective','formulas','worksheet']){state.level=t%2?'core':'stretch';const q=GEN[m]();
        q.walk().forEach((s,i)=>{if(s.done)return;const needles=fmt(s);if(!needles.length)return;
          const texts=[strip(s.q)];for(const raw of ['','7','999','1.2.3.4','00000000','/3','0','5','100','255.255.255.0','11111111','10.0.0.0'])
            try{const u=s.kind==='ip'?parseIP(raw):s.kind==='num'&&/^\\d+$/.test(raw)?Number(raw):null;texts.push(strip(s.bad(u,raw)))}catch(e){}
          for(const tx of texts)for(const nd of needles){const re=new RegExp('(^|[^0-9./])'+nd.replace(/[.^$*+?()[\\]{}|\\\\]/g,'\\\\$&')+'(?![0-9]|\\\\.[0-9])');
            if(re.test(tx))hits.push(q.mode+': '+tx+' ⇐ '+nd);}});}
      return hits;}})()""")
    # numbers that are part of the problem or of a rule (place values, class ranges, 256 − mask) are not leaks
    RULES=['Class A is 1','A is /8','starting at 128','place values (128','256 means it rolls','256 −','256 minus','32 −','Subtract','(it’s only','go up by your increment','multiple of the increment','Each 255 is 8','Try 1 × 8','first 1 place value','Subtract it from 256','The IP’s octet','Its last octet is','last octet is']
    real=[h for h in hits if not any(r in h for r in RULES)]
    ok(not real,f'no step or nudge states the answer it’s asking for ({len(hits)} matches were problem data or rule text) {real[:3]}')
    # 2. UI: do the walkthrough for real on several questions of each type
    for mode in ['binary','prefix','anding','detective','formulas','worksheet']:
        pg.click(f'.tab[data-m="{mode}"]'); done=0
        for _ in range(8):
            pg.click('#hintBtn'); ok_q=True
            n=pg.evaluate("window.SS.state.walk.steps.length")
            for i in range(n):
                st=pg.evaluate("(()=>{const s=window.SS.state.walk.steps[window.SS.state.walk.i];return {kind:s.kind,ans:s.kind==='ip'?window.SS.ipStr?null:null:s.ans}})()")
                ans=pg.evaluate("(()=>{const s=window.SS.state.walk.steps[window.SS.state.walk.i];const a=s.ans;if(s.kind!=='ip')return (s.kind==='prefix'?'/':'')+a;return [a>>>24,(a>>16)&255,(a>>8)&255,a&255].join('.')})()")
                if st['kind'] in ('role','cls','bin32','pow') and random.random()<.3: ans={'role':ans,'cls':'class '+ans.lower(),'bin32':ans.replace('.',''),'pow':ans}[st['kind']]
                if random.random()<.4:
                    pg.fill('#winp','7.7.7.7' if st['kind']=='ip' else ('00000000' if st['kind']=='bits8' and ans!='00000000' else '987'))
                    pg.press('#winp','Enter')
                    if not pg.inner_text('#wmsg').strip(): ok_q=False
                pg.fill('#winp',ans); pg.press('#winp','Enter')
            if pg.locator('#wcheck').count()!=1 or not pg.is_hidden('#fields'): ok_q=False
            pg.click('#wcheck')
            if not ('good' in pg.get_attribute('#feedback','class') and ('½' in pg.inner_text('#feedback') or 'half' in pg.inner_text('#feedback').lower() or '+5' in pg.inner_text('#feedback'))): ok_q=False
            if not ok_q: ok(False,f'walkthrough in {mode}: {pg.evaluate("window.SS.state.q.prompt")}'); break
            done+=1; pg.click('#checkBtn')
        if done==8: ok(True,f'{mode}: 8 hints walked through on screen (with deliberate wrong steps), then answered for half points')
    ok(pg.is_visible('#hintBtn') and 'step by step' in pg.inner_text('#hintBtn').lower(),'Hint button says it’s step by step')
    ok(not errs,f'no page errors {errs}')
print(f'\n{"all passed" if not fails else str(len(fails))+" failed"}'); sys.exit(1 if fails else 0)
