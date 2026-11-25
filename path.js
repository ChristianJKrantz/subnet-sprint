/* Subnet Sprint learning path.
   The skills in teaching order. Each unit opens with a short lesson and a quick check, then a practice session of
   questions from the game's own generators. Finishing a session with 80% right on the first try (no hint) raises the
   unit's signal by one bar, and each bar waits longer before the unit comes back for review (1, 3, 7, 16, 35 days).
   A missed question comes back at the end of the session with new numbers. app.js calls SSPath.init() before it
   draws the first question, and asks SSPath.nextQ() for each question while the Path tab is open. */
(function(){
'use strict';
const DAY=864e5;
const WAIT=[0,1,3,7,16,35]; // days before a unit at this many bars is due again
const MAXL=5;
const ex=s=>`<div class="pl-ex mono">${s}</div>`;
const UNITS=[
 {id:'bin',name:'Bits and octets',tag:'Binary',gens:[['binary','d2b'],['binary','b2d']],n:6,guide:'g-bin',
  learn:[
   `<p>An IPv4 address is four <b>octets</b>. Each octet is 8 bits, and each bit has a <b>place value</b>:</p>${ex('128  64  32  16   8   4   2   1')}<p>An octet's value is the sum of the place values whose bit is 1. All eight 1s make 255, the biggest an octet can be.</p>`,
   `<p><b>Decimal → binary.</b> Go left to right. If the place value fits in what's left, write 1 and subtract it. If not, write 0.</p>${ex('200: 128 fits → 1, 72 left<br>64 fits → 1, 8 left<br>32 no · 16 no → 0 0<br>8 fits → 1, 0 left<br>4 2 1 → 0 0 0<br>200 = 11001000')}`,
   `<p><b>Binary → decimal.</b> Add the place values under the 1s.</p>${ex('01100100 = 64 + 32 + 4 = 100')}`],
  check:{q:'Which bits are on in 160?',o:['128 and 32','128 and 16','64 and 32 and 64'],a:0,why:'160 − 128 = 32, and 32 is a place value, so 128 + 32.'}},
 {id:'mask',name:'Prefix and mask',tag:'Prefix ↔ Mask',gens:[['prefix','p2m'],['prefix','m2p'],['prefix','bin']],n:6,guide:'g-mask',
  learn:[
   `<p>A <b>subnet mask</b> is 32 bits: 1s for the network part, then 0s for the host part. The <b>prefix</b> <span class="mono">/n</span> just counts the 1s.</p>${ex('/26 = 11111111.11111111.11111111.11000000<br>    = 255.255.255.192')}`,
   `<p>Every full octet of 1s is <b>255</b>. The octet where the 1s stop can only be one of these, so learn the ladder:</p>${ex('1 bit  128   5 bits 248<br>2 bits 192   6 bits 252<br>3 bits 224   7 bits 254<br>4 bits 240   8 bits 255')}`,
   `<p><b>Mask → prefix:</b> 8 for each 255, plus the bits in the last octet.</p>${ex('255.255.255.240 = 8+8+8+4 = /28')}`],
  check:{q:'What is /27 as a mask?',o:['255.255.255.224','255.255.255.27','255.255.255.240'],a:0,why:'24 bits make three 255s. The 3 leftover bits are 128 + 64 + 32 = 224.'}},
 {id:'inc',name:'The network increment',tag:'Increment',gens:[['formulas',4]],n:5,guide:'g-chart',
  learn:[
   `<p>The <b>interesting octet</b> is the one in the mask that isn't 255 or 0. That's where the subnets change.</p><p>The <b>increment</b> (block size) is how far apart the subnets are:</p>${ex('increment = 256 − mask octet')}`,
   `<p>For <span class="mono">255.255.255.192</span> (/26):</p>${ex('256 − 192 = 64<br>subnets start at .0  .64  .128  .192')}<p>It's also the place value of the last 1 bit in the mask: <span class="mono">11000000</span> ends in the 64s place.</p>`],
  check:{q:'What is the increment for 255.255.255.248?',o:['8','248','7'],a:0,why:'256 − 248 = 8. Subnets start at 0, 8, 16, 24 …'}},
 {id:'and',name:'ANDing to the network',tag:'ANDing',gens:[['anding']],n:5,guide:'g-and',
  learn:[
   `<p>A router finds an address's network by <b>ANDing</b> it with the mask, bit by bit. AND gives 1 only when both bits are 1.</p>${ex('1 AND 1 = 1   1 AND 0 = 0   0 AND 0 = 0')}`,
   `<p>Shortcut: under a <b>255</b>, copy the IP's octet. Under a <b>0</b>, write 0. Only the interesting octet needs binary.</p>${ex('192.168.10.77 /27 (mask .224)<br>  77 = 01001101<br> 224 = 11100000<br> AND = 01000000 = 64<br>network 192.168.10.64')}`,
   `<p>Quicker check: ANDing always rounds the octet <b>down to a multiple of the increment</b>. /27 has increment 32, and 77 rounds down to 64.</p>`],
  check:{q:'What is 10.1.1.130 AND 255.255.255.128?',o:['10.1.1.128','10.1.1.130','10.1.1.0'],a:0,why:'130 = 10000010 and 128 = 10000000, so the AND is 10000000 = 128.'}},
 {id:'role',name:'Network, host or broadcast?',tag:'Address roles',gens:[['detective','role']],n:6,guide:'g-chart',
  learn:[
   `<p>Every subnet is a block of addresses the size of the increment:</p><ul><li>The <b>first</b> address is the <b>network</b> address.</li><li>The <b>last</b> is the <b>broadcast</b>.</li><li>Everything between is a <b>usable host</b>.</li></ul>`,
   `<p>/28 has an increment of 16. The block that starts at .32:</p>${ex('.32       network<br>.33 – .46  usable hosts<br>.47       broadcast (next block .48, minus 1)')}`],
  check:{q:'In a /29, what is 192.168.1.15?',o:['Broadcast','Network','Usable host'],a:0,why:'The increment is 8, so the block is .8 to .15. The last address, .15, is the broadcast.'}},
 {id:'chart',name:'The subnet chart',tag:'Subnet chart',gens:[['detective','chart']],n:4,guide:'g-chart',
  learn:[
   `<p>Now put it together. For any <span class="mono">IP/prefix</span>:</p><ol><li>Mask, then the increment.</li><li><b>Round the IP down</b> to a multiple of the increment: that's the <b>network</b>.</li><li><b>Broadcast</b> = next network − 1.</li><li><b>Gateway</b> (first usable) = network + 1. <b>Last usable</b> = broadcast − 1.</li><li><b>Usable hosts</b> = 2<sup>h</sup> − 2.</li></ol>`,
   `<p>Worked: <span class="mono">172.16.62.68/26</span></p>${ex('mask .192 → increment 64<br>68 rounds down to 64<br>network    172.16.62.64<br>gateway    172.16.62.65<br>last usable 172.16.62.126<br>broadcast  172.16.62.127<br>hosts      2⁶ − 2 = 62')}`],
  check:{q:'For 10.0.0.100/27, what is the network?',o:['10.0.0.96','10.0.0.64','10.0.0.100'],a:0,why:'The increment is 32. Multiples of 32: 64, 96, 128. 100 rounds down to 96.'}},
 {id:'form',name:'Host and network formulas',tag:'Formulas',gens:[['formulas',0],['formulas',1],['formulas',5]],n:6,guide:'g-form',
  learn:[
   `<p><b>Usable hosts</b> per subnet, with h host bits (the 0s in the mask):</p>${ex('2^h − 2')}<p>Minus 2 because the network and broadcast addresses can't go on a device.</p>`,
   `<p><b>Subnets</b> you get from borrowing n bits:</p>${ex('2^n')}<p>No − 2 here. Borrowing 3 bits from a /24 gives 2³ = 8 subnets, and the new prefix is /27.</p>`,
   `<p><b>Total networks</b> for an address counts from its class's default mask: Class A is /8 (1–126), B is /16 (128–191), C is /24 (192–223).</p>${ex('10.4.4.4/20 → Class A /8<br>borrowed 20 − 8 = 12 bits → 2¹² = 4,096')}`],
  check:{q:'How many usable hosts in a /28?',o:['14','16','28'],a:0,why:'h = 32 − 28 = 4 host bits. 2⁴ − 2 = 14.'}},
 {id:'size',name:'Sizing a subnet',tag:'Sizing',gens:[['formulas',2],['formulas',3],['formulas',6]],n:6,guide:'g-form',
  learn:[
   `<p>Going the other way: you know how many hosts you need, and you want the <b>smallest subnet that fits</b>.</p><p>Find the smallest h where 2<sup>h</sup> − 2 covers it. Prefix = 32 − h.</p>${ex('50 hosts: h=5 → 30 ✗   h=6 → 62 ✓<br>prefix /26')}`,
   `<p>Watch the edges: 30 hosts fits in a /27 (30 usable), but 31 needs a /26.</p><p>A <b>router-to-router link</b> only needs 2 addresses, so it's always a <b>/30</b>.</p>`,
   `<p>Need N subnets? Find the smallest n where 2<sup>n</sup> covers N, and borrow n bits.</p>${ex('5 subnets: 2² = 4 ✗   2³ = 8 ✓<br>borrow 3 → /24 becomes /27')}`],
  check:{q:'What is the smallest subnet for 14 hosts?',o:['/28','/29','/27'],a:0,why:'h = 4 gives 2⁴ − 2 = 14, exactly enough. 32 − 4 = 28.'}},
 {id:'sheet',name:'The full worksheet',tag:'Worksheet',gens:[['worksheet']],n:1,guide:'g-ws',
  learn:[
   `<p>The class worksheet strings every skill together. Each answer feeds the next one:</p><ol><li>Mask, and the mask in binary</li><li>Increment</li><li>Hosts per network</li><li>The chart, counting up from .0</li><li>The given IP: its network, broadcast and role</li><li>Total networks</li></ol><p>It comes one question at a time. Use the Scratchpad for the binary.</p>`],
  check:{q:'Which do you need first to build the chart?',o:['The increment','Total networks','The broadcast'],a:0,why:'Each row of the chart starts one increment after the last.'}},
 {id:'plan',name:'Planning subnets for a lab',tag:'Lab sizing',gens:[['formulas',7],['formulas',8],['formulas',6]],n:5,guide:'g-form',
  learn:[
   `<p>Packet Tracer labs give you a topology and ask how to split a /24. Count every network first:</p><ul><li>Each LAN is one subnet.</li><li><b>Each router-to-router link is a subnet too.</b> It's the one people forget.</li></ul>`,
   `<p>When one mask must fit everything, it needs <b>both</b> enough subnets and enough hosts for the biggest LAN. Borrow just enough bits for the subnets, then check the hosts still fit.</p>${ex('3 LANs + 1 link = 4 subnets → borrow 2 → /26<br>/26 gives 62 hosts. Biggest LAN 45 ✓')}`],
  check:{q:'Two LANs on R1, one on R2, R1–R2 joined by a serial link. How many subnets?',o:['4','3','2'],a:0,why:'Three LANs plus the link between the routers.'}},
 {id:'vlsm',name:'VLSM',tag:'VLSM',gens:[['vlsm']],n:1,guide:'g-vlsm',
  learn:[
   `<p><b>Variable-length subnetting</b> gives each LAN a subnet sized for it, instead of one size for all.</p><ol><li>Sort the subnets <b>biggest first</b>.</li><li>Size each one: the smallest h where 2<sup>h</sup> − 2 covers it.</li><li>Its network is the previous broadcast + 1. The first starts at .0.</li><li>Broadcast = network + 2<sup>h</sup> − 1.</li></ol>`,
   `${ex('58 hosts → /26 (block 64)  .0 – .63<br>29 hosts → /27 (block 32)  .64 – .95<br>15 hosts → /27 (block 32)  .96 – .127<br> 7 hosts → /28 (block 16)  .128 – .143')}<p>Watch the edges: 29 fits a /27 (30 usable), but 31 wouldn't. 15 is one too many for a /28 (14 usable), so it takes a /27.</p>`],
  check:{q:'Why go biggest first?',o:['Big blocks stay aligned and leave no gaps','The biggest LAN is the most important','The router needs it'],a:0,why:'Each block has to start on a multiple of its own size. Placing big ones first keeps every later block aligned.'}},
 {id:'stretch',name:'Beyond the last octet',tag:'Stretch',gens:[['anding'],['detective','chart'],['formulas',4]],n:5,level:'stretch',guide:'g-stretch',
  learn:[
   `<p>With prefixes from /16 to /23, the interesting octet is the <b>third</b> one. Everything works the same, just one octet to the left.</p>${ex('172.16.45.9 /20 → mask 255.255.240.0<br>increment 256 − 240 = 16 (in the 3rd octet)<br>45 rounds down to 32<br>network   172.16.32.0<br>broadcast 172.16.47.255')}`,
   `<p>The octets after the interesting one are <b>.0</b> in the network and <b>.255</b> in the broadcast.</p>`],
  check:{q:'What is the network for 10.20.77.5/22?',o:['10.20.76.0','10.20.77.0','10.20.64.0'],a:0,why:'Mask .252 in the 3rd octet, increment 4. 77 rounds down to 76, and the 4th octet becomes 0.'}}
];

let A=null;            // app api, from init()
let P=load();          // saved progress
let view='map';        // map | learn | run | done
let S=null;            // current session
let lessonStep=0,lessonUnit=null,checked=null;

function load(){
  let raw=null;try{raw=JSON.parse(localStorage.getItem('ss_path')||'null');}catch(e){}
  const p={u:{},days:[]};
  if(raw&&typeof raw==='object'){
    const u=raw.u&&typeof raw.u==='object'?raw.u:{};
    UNITS.forEach(x=>{const r=u[x.id];if(r&&typeof r==='object'){const l=Math.floor(Number(r.l)),d=Number(r.d);p.u[x.id]={l:l>=0&&l<=MAXL?l:0,d:Number.isFinite(d)?d:0,s:r.s===true};}});
    if(Array.isArray(raw.days))p.days=raw.days.filter(d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)).slice(-60);
  }
  return p;
}
function save(){try{localStorage.setItem('ss_path',JSON.stringify(P));}catch(e){}}
const U=id=>P.u[id]||(P.u[id]={l:0,d:0,s:false});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function dayStreak(){
  const set=new Set(P.days);let n=0;const d=new Date();
  if(!set.has(today()))d.setDate(d.getDate()-1); // today not done yet: count from yesterday
  for(;;){const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(!set.has(k))break;n++;d.setDate(d.getDate()-1);}
  return n;
}
const unlocked=i=>i===0||U(UNITS[i-1].id).l>=1;
const isDue=x=>{const u=U(x.id);return u.l>=1&&u.d<=Date.now();};
function recommend(){
  const due=UNITS.filter(isDue).sort((a,b)=>U(a.id).d-U(b.id).d);
  const front=UNITS.find((x,i)=>unlocked(i)&&U(x.id).l===0);
  // learning comes first, but don't let more than two reviews pile up
  if(front&&due.length<=2)return {x:front,why:U(front.id).l===0?'new':'grow'};
  if(due.length)return {x:due[0],why:'review'};
  if(front)return {x:front,why:U(front.id).l===0?'new':'grow'};
  const weakest=UNITS.slice().sort((a,b)=>U(a.id).l-U(b.id).l||U(a.id).d-U(b.id).d)[0];
  return {x:weakest,why:'grow'};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bars=l=>`<span class="pl-bars" role="img" aria-label="Signal ${l} of ${MAXL}">${[1,2,3,4,5].map(i=>`<i class="${i<=l?'on':''}" style="height:${4+i*3}px"></i>`).join('')}</span>`;
function dueText(x){const u=U(x.id);if(u.l===0)return '';const days=Math.ceil((u.d-Date.now())/DAY);return days<=0?'Review due':days===1?'Review tomorrow':`Review in ${days} days`;}

const $=s=>document.querySelector(s);
function box(){return $('#pathbox');}
function focus(on){document.body.classList.toggle('pl-focus',on);}
function showCard(on){const c=document.querySelector('.game>.card');if(c)c.hidden=!on;const f=document.querySelector('.game>.foot');if(f)f.hidden=!on;}
function sync(mode){
  const on=mode==='path'&&!(A&&A.state.timed);
  document.body.classList.toggle('pathmode',on);
  box().hidden=!on;
  if(!on){if(S){S=null;}view='map';showCard(true);focus(false);return;}
}

/* ---------- the map ---------- */
function renderMap(){
  view='map';S=null;showCard(false);focus(false);
  const r=recommend(),streak=dayStreak();
  const verb=r.why==='new'?'Learn':r.why==='review'?'Review':'Practice';
  const nextIdx=UNITS.indexOf(r.x);
  box().innerHTML=`<div class="pl-head"><div><div class="pl-kicker">Your path</div><h2>${UNITS.filter(x=>U(x.id).l>=1).length} of ${UNITS.length} skills started</h2></div><div class="pl-streak" title="Days in a row with a finished session"><b>${streak}</b><small>day${streak===1?'':'s'} in a row</small></div></div>
  <button class="btn primary pl-start" id="plStart"><small>${verb} · ${String(nextIdx+1).padStart(2,'0')}</small><span>${esc(r.x.name)} <span aria-hidden="true">→</span></span></button>
  <ol class="pl-map">${UNITS.map((x,i)=>{const u=U(x.id),open=unlocked(i),due=isDue(x);const cls=[open?'':'locked',x===r.x?'next':'',due?'due':'',u.l>=MAXL?'max':''].join(' ');
    return `<li class="pl-node ${cls}"><button data-u="${x.id}" ${open?'':'disabled'} aria-label="${esc(x.name)}${open?'':', locked'}"><span class="pl-num mono">${String(i+1).padStart(2,'0')}</span><span class="pl-txt"><b>${esc(x.name)}</b><small>${open?(u.l?esc(dueText(x)):x===r.x?'Start here':'New'):'Finish the skill above to unlock'}</small></span>${open?bars(u.l):'<span class="pl-lock" aria-hidden="true">🔒</span>'}</button></li>`;}).join('')}</ol>
  <p class="pl-note">Each skill starts with a short lesson. A session with 80% right on the first try (no hint) adds a bar, and the skill comes back for review later so it sticks.</p>
  <div class="pl-free"><div class="pl-kicker">Free practice</div><div class="pl-chips">${[['worksheet','Worksheet'],['vlsm','VLSM'],['binary','Binary'],['prefix','Prefix ↔ Mask'],['anding','ANDing'],['detective','Subnet chart'],['formulas','Formulas'],['mixed','Mixed'],['weak','Weak spots']].map(([m,t])=>`<button class="btn small" data-m="${m}">${t}</button>`).join('')}</div></div>`;
  box().querySelectorAll('.pl-chips button').forEach(b=>b.onclick=()=>{const t=document.querySelector(`#tabs .tab[data-m="${b.dataset.m}"]`);if(t){t.click();document.querySelector('.game>.card').scrollIntoView({block:'start',behavior:'instant'});}});
  $('#plStart').onclick=()=>openUnit(r.x);
  box().querySelectorAll('.pl-node button[data-u]').forEach(b=>b.onclick=()=>openUnit(UNITS.find(x=>x.id===b.dataset.u),true));
}
function openUnit(x,fromMap){
  const u=U(x.id);
  if(!u.s||(fromMap&&u.l===0))return renderLesson(x,0);
  if(fromMap)return renderUnit(x);
  startSession(x);
}
function renderUnit(x){
  view='unit';showCard(false);focus(true);const u=U(x.id),i=UNITS.indexOf(x);
  box().innerHTML=`<button class="pl-back" id="plBack">← Path</button><div class="pl-unit"><div class="pl-kicker">Skill ${String(i+1).padStart(2,'0')} · ${esc(x.tag)}</div><h2>${esc(x.name)}</h2><div class="pl-unitbars">${bars(u.l)}<span>${u.l} of ${MAXL} · ${esc(dueText(x)||'')}</span></div>
  <div class="pl-actions"><button class="btn primary" id="plGo">Practice · ${x.n===1?'1 full problem':x.n+' questions'}</button><button class="btn" id="plLesson">Read the lesson again</button></div></div>`;
  $('#plBack').onclick=renderMap;$('#plGo').onclick=()=>startSession(x);$('#plLesson').onclick=()=>renderLesson(x,0);
}

/* ---------- the lesson ---------- */
function renderLesson(x,step){
  view='learn';showCard(false);focus(true);lessonUnit=x;lessonStep=step;const n=x.learn.length,i=UNITS.indexOf(x);
  const onCheck=step>=n;
  const body=onCheck?`<p class="pl-q">${esc(x.check.q)}</p><div class="pl-opts">${shuffleOpts(x).map(([t,k])=>`<button class="btn pl-opt" data-k="${k}">${esc(t)}</button>`).join('')}</div><div class="pl-why" id="plWhy" role="status"></div>`:x.learn[step];
  box().innerHTML=`<button class="pl-back" id="plBack">← Path</button><div class="pl-lesson"><div class="pl-kicker">Skill ${String(i+1).padStart(2,'0')} · Lesson</div><h2>${esc(x.name)}</h2>
  <div class="pl-steps" aria-hidden="true">${Array.from({length:n+1},(_,k)=>`<i class="${k<step?'done':k===step?'on':''}"></i>`).join('')}</div>
  <div class="pl-body">${onCheck?'<div class="pl-kicker">Quick check</div>':''}${body}</div>
  <div class="pl-actions">${step>0?'<button class="btn" id="plPrev">Back</button>':''}${onCheck?'<button class="btn primary" id="plNext" hidden>Start practice →</button>':`<button class="btn primary" id="plNext">${step===n-1?'Quick check →':'Next →'}</button>`}<button class="btn ghost small" id="plGuide">Open the guide</button></div></div>`;
  $('#plBack').onclick=renderMap;
  if($('#plPrev'))$('#plPrev').onclick=()=>renderLesson(x,step-1);
  $('#plGuide').onclick=()=>A&&A.openGuide(x.guide);
  if(!onCheck){$('#plNext').onclick=()=>renderLesson(x,step+1);$('#plNext').focus({preventScroll:true});}
  else{let tries=0;
    box().querySelectorAll('.pl-opt').forEach(b=>b.onclick=()=>{if(b.disabled)return;tries++;
      const right=Number(b.dataset.k)===x.check.a;
      if(right){box().querySelectorAll('.pl-opt').forEach(o=>o.disabled=true);b.classList.add('ok');$('#plWhy').className='pl-why good';$('#plWhy').textContent=(tries===1?'Right. ':'There it is. ')+x.check.why;U(x.id).s=true;save();const nb=$('#plNext');nb.hidden=false;nb.onclick=()=>startSession(x);nb.focus({preventScroll:true});}
      else{b.disabled=true;b.classList.add('no');$('#plWhy').className='pl-why bad';$('#plWhy').textContent=tries>=2?x.check.why+' Pick it to go on.':'Not that one. Look back at the lesson and try again.';}
    });}
  box().scrollIntoView({block:'start',behavior:'instant'});
}
function shuffleOpts(x){const a=x.check.o.map((t,k)=>[t,k]);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ---------- a practice session ---------- */
function startSession(x){
  const plan=[];for(let i=0;i<x.n;i++)plan.push(x.gens[i%x.gens.length]);
  for(let i=plan.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[plan[i],plan[j]]=[plan[j],plan[i]];}
  S={x,plan,i:0,right:0,scored:0,retry:[],extra:0,cur:null,start:U(x.id).l,answered:false};view='run';
  if(A.state.mode!=='path'){A.state.mode='path';A.renderTabs();}
  A.next();
}
function genQ(spec){
  const st=A.state,keep=st.level;if(S.x.level)st.level=S.x.level;else st.level='core';
  let q;try{q=A.GEN[spec[0]](spec[1]);}finally{st.level=keep;}
  return q;
}
function strip(){
  const total=S.plan.length+S.extra,done=Math.max(0,S.i-(S.answered?0:1));
  box().innerHTML=`<div class="pl-run"><button class="pl-back" id="plQuit" aria-label="End this session">✕</button><div class="pl-runtxt"><b>${esc(S.x.name)}</b><small>${S.cur&&!S.cur.scored?'Fixing one you missed':`Question ${Math.min(S.i,S.plan.length)} of ${S.plan.length}`}</small></div><div class="pl-prog" aria-hidden="true"><i style="width:${Math.round(100*done/Math.max(1,total))}%"></i></div>${bars(U(S.x.id).l)}</div>`;
  $('#plQuit').onclick=()=>{S=null;renderMap();};
}
function nextQ(){
  if(view!=='run'||!S){if(view==='map'||!S)renderMap();return null;}
  if(S.cur&&!S.answered){/* app asked again without an answer (tab re-click): keep the same question */return S.cur.q;}
  let spec,scored=true;
  if(S.i<S.plan.length)spec=S.plan[S.i];
  else if(S.retry.length){spec=S.retry.shift();scored=false;}
  else{finish();return null;}
  S.i++;S.answered=false;S.cur={spec,scored,q:genQ(spec)};
  showCard(true);focus(true);strip();
  return S.cur.q;
}
function onCheck(q,firstTry,parts){
  if(!S||!S.cur||S.answered)return;S.answered=true;
  if(S.x.n===1&&parts&&S.cur.scored){S.scored+=parts.t;S.right+=parts.r;S.parts=true;strip();return;} // a full problem: score its parts
  const again=()=>{if(S.extra<3&&S.x.n>1){S.retry.push(S.cur.spec);S.extra++;}};
  if(S.cur.scored){S.scored++;if(firstTry)S.right++;else again();}
  else if(!firstTry)again();
  strip();
}
function onSkip(){if(S&&S.cur&&!S.answered)onCheck(S.cur.q,false);}
function finish(){
  const x=S.x,u=U(x.id),before=u.l,pct=S.scored?S.right/S.scored:0;
  let msg;
  if(pct>=0.8){u.l=Math.min(MAXL,u.l+1);u.d=Date.now()+WAIT[u.l]*DAY;msg=u.l>before?'Signal up!':'Full signal. Keep it there.';}
  else if(pct>=0.5){u.l=Math.max(u.l,0);u.d=Date.now()+DAY;msg='Getting there. One more session should do it.';}
  else{u.l=Math.max(0,u.l-1);u.d=Date.now();msg='This one needs another pass. Reread the lesson, then try again.';}
  u.s=true;const t=today();if(!P.days.includes(t))P.days.push(t);P.days=P.days.slice(-60);save();
  view='done';showCard(false);focus(true);const idx=UNITS.indexOf(x);const nextUnit=UNITS[idx+1];const opened=before===0&&u.l>=1&&nextUnit;
  box().innerHTML=`<div class="pl-done"><div class="pl-kicker">Session complete</div><h2>${esc(msg)}</h2>
  <div class="pl-score"><b class="mono">${S.right}/${S.scored}</b><span>${S.parts?'parts':''} right on the first try</span></div>
  <div class="pl-unitbars">${bars(before)}<span aria-hidden="true">→</span>${bars(u.l)}<span>${esc(x.name)} · ${esc(dueText(x))}</span></div>
  ${opened?`<p class="pl-unlock">Unlocked: <b>${esc(nextUnit.name)}</b></p>`:''}
  <div class="pl-actions"><button class="btn primary" id="plCont">Continue →</button>${pct<0.5?'<button class="btn" id="plRe">Reread the lesson</button>':'<button class="btn" id="plAgain">Practice again</button>'}<button class="btn ghost" id="plMap">Path</button></div></div>`;
  S=null;
  $('#plCont').onclick=()=>{const r=recommend();openUnit(r.x);};
  if($('#plRe'))$('#plRe').onclick=()=>renderLesson(x,0);
  if($('#plAgain'))$('#plAgain').onclick=()=>startSession(x);
  $('#plMap').onclick=renderMap;
  $('#plCont').focus({preventScroll:true});box().scrollIntoView({block:'start',behavior:'instant'});
}

window.SSPath={
  init(api){A=api;},
  isNew(){return !Object.values(P.u).some(u=>u.l>0||u.s);},
  sync,nextQ,onCheck,onSkip,
  // for tests
  UNITS,get progress(){return P;},get session(){return S;},get view(){return view;},
  reset(){P={u:{},days:[]};save();S=null;view='map';}
};
})();
