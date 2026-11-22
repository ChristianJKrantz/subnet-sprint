/* Subnet Sprint. If another site loads this page inside a frame, show a link out instead of the game,
   so nobody can overlay or disguise it. */
if(window.top!==window.self){document.body.innerHTML='<p style="font:16px system-ui;padding:24px;color:#e6edf3;background:#0d1117">Subnet Sprint can only be used on its own page. <a style="color:#5aa9ff" href="https://christianjkrantz.github.io/subnet-sprint/" target="_blank" rel="noopener noreferrer">Open Subnet Sprint</a></p>';throw new Error('framed');}
(function(){
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const R=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=a=>a[R(0,a.length-1)];
const maskOf=p=>p===0?0:((0xFFFFFFFF<<(32-p))>>>0);
const oct=(n,i)=>(n>>>(24-8*i))&255;
const ipStr=n=>[0,1,2,3].map(i=>oct(n,i)).join('.');
const bin8=v=>v.toString(2).padStart(8,'0');
function parseIP(s){const m=String(s).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!m)return null;const o=m.slice(1).map(Number);if(o.some(x=>x>255))return null;return((o[0]<<24)|(o[1]<<16)|(o[2]<<8)|o[3])>>>0;}
function randIP(){const t=R(0,2);if(t===0)return parseIP(`192.168.${R(0,255)}.${R(1,254)}`);if(t===1)return parseIP(`10.${R(0,255)}.${R(0,255)}.${R(1,254)}`);return parseIP(`172.${R(16,31)}.${R(0,255)}.${R(1,254)}`);}
const isDesktop=()=>window.matchMedia('(min-width:1100px)').matches;

function binColored(n,p,dimHost){
  let out='';
  for(let i=0;i<32;i++){if(i>0&&i%8===0)out+='.';const b=(n>>>(31-i))&1;out+=`<span class="${i<p?'n':(dimHost?'dim':'h')}">${b}</span>`;}
  return out;
}
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

const MODES=[{id:'worksheet',name:'Worksheet',g:'class'},{id:'vlsm',name:'VLSM',g:'class'},{id:'binary',name:'Binary',g:'drill'},{id:'prefix',name:'Prefix ↔ Mask',g:'drill'},{id:'anding',name:'ANDing',g:'drill'},{id:'detective',name:'Subnet Chart',g:'drill'},{id:'formulas',name:'Formulas',g:'drill'},{id:'mixed',name:'Mixed',g:'drill'},{id:'weak',name:'Weak spots',g:'drill'}];
const TABGROUPS=[['class','Full problems','A whole problem, worked start to finish'],['drill','Quick drills','One skill at a time, fast']];
const GUIDE_FOR={worksheet:'g-ws',vlsm:'g-vlsm',binary:'g-bin',prefix:'g-mask',anding:'g-and',detective:'g-chart',formulas:'g-form'};
const state={mode:'worksheet',level:'core',score:0,streak:0,best:Math.max(0,Math.floor(Number(store.get('ss_best',0)))||0),right:0,tried:0,per:{},q:null,checked:false,hinted:false,timed:null};
MODES.forEach(m=>state.per[m.id]={r:0,t:0});
const randPrefix=()=>state.level==='core'?R(24,30):R(16,30);

/* ---------------- explanations ---------------- */
function explainBin(v){
  const vals=[128,64,32,16,8,4,2,1];const b=bin8(v);const on=vals.filter((x,i)=>b[i]==='1');
  return `<div class="tscroll"><table class="ptable"><tr>${vals.map(x=>`<th>${x}</th>`).join('')}</tr><tr>${[...b].map(c=>`<td class="${c==='1'?'on':''}">${c}</td>`).join('')}</tr></table></div>
  <p>${on.length?`<span class="mono">${on.join(' + ')} = <b class="g">${v}</b></span>`:'No bits on, so the value is <b class="g">0</b>.'}</p>
  <p class="dim">Method: start at 128. If what's left is ≥ the place value, turn that bit on and subtract it; otherwise leave it 0. Move right.</p>`;
}
function explainMask(p){
  const m=maskOf(p);const io=Math.min(3,Math.floor(p/8));
  let s=`<pre class="binblock">${binColored(m,p)}
= ${ipStr(m)}</pre><p><span class="n">${p} network bits (1s)</span> and <span class="h">${32-p} host bits (0s)</span>.</p>`;
  if(p%8!==0){const v=oct(m,io);const on=[128,64,32,16,8,4,2,1].slice(0,p%8);
    s+=`<p>Full octets of 1s are 255. The partial octet has ${p%8} bit${p%8>1?'s':''} on: <span class="mono">${on.join(' + ')} = <b class="g">${v}</b></span>.</p>`;}
  else s+=`<p>The prefix lands exactly on an octet boundary, so every octet is either 255 or 0.</p>`;
  return s;
}
function explainAnd(ip,p){
  const m=maskOf(p),net=(ip&m)>>>0;const io=Math.min(3,Math.floor(p/8));
  let s=`<pre class="binblock">IP   ${binColored(ip,p)}
     ${ipStr(ip)}
Mask ${binColored(m,p)}
     ${ipStr(m)}
     ${'-'.repeat(35)}
AND  ${binColored(net,p,true)}
     <b class="g">${ipStr(net)}</b></pre>
  <p>Wherever the mask has a 0 (host bits), the result is 0. Wherever the mask has a 1, the IP bit passes through unchanged.</p>`;
  if(p%8!==0){const a=oct(ip,io),b=oct(m,io);const inc=256-b;
    s+=`<p><b>Shortcut:</b> octets under a 255 copy straight down, octets under a 0 become 0. Only octet ${io+1} needs real work: <span class="mono">${bin8(a)} (${a}) AND ${bin8(b)} (${b}) = ${bin8(a&b)} (<b class="g">${a&b}</b>)</span>.</p>
    <p><b>Check:</b> increment = 256 − ${b} = ${inc}. ${a} rounds down to the nearest multiple of ${inc} → <b class="g">${a&b}</b>.</p>`;}
  return s;
}
function explainSubnet(ip,p){
  const m=maskOf(p),net=(ip&m)>>>0,size=2**(32-p),bc=(net+size-1)>>>0,h=32-p;
  const io=Math.floor((p-1)/8);const mv=oct(m,io);const inc=256-mv;const ipo=oct(ip,io),neto=oct(net,io);
  let s=`<p><b>1. Mask:</b> /${p} = <span class="mono">${ipStr(m)}</span> → ${p} network bits, ${h} host bits.</p>
  <pre class="binblock">IP   ${binColored(ip,p)}
Mask ${binColored(m,p)}</pre>
  <p><b>2. Interesting octet:</b> octet ${io+1} (mask ${mv}). ${io>0?`Octets before it copy straight down.`:''}</p>
  <p><b>3. Increment:</b> 256 − ${mv} = <b class="mono">${inc}</b>. Subnets in that octet go 0, ${inc}, ${inc*2}${inc*3<256?', '+inc*3:''}…</p>
  <p><b>4. Round down:</b> the IP's octet ${io+1} is ${ipo}, which rounds down to <b class="mono">${neto}</b>${io<3?'; every octet after it becomes 0':''}.</p>
  <p><b>5. Usable hosts:</b> <span class="mono">2<sup>${h}</sup> − 2 = ${(size-2).toLocaleString()}</span></p>`;
  const rows=[];const start=Math.max(0,net-size*2);
  for(let k=0;k<5;k++){const n=start+size*k;if(n>0xFFFFFFFF)break;const pre=(n&maskOf(io*8))>>>0,mine=(net&maskOf(io*8))>>>0;if(io>0&&pre!==mine)continue;rows.push(n>>>0);}
  s+=`<p><b>6. Network chart</b> (around your IP):</p><div class="tscroll"><table><tr><th>Subnet</th><th>Usable range</th><th>Broadcast</th></tr>${rows.map(n=>{const b=(n+size-1)>>>0;return `<tr class="${n===net?'me':''}"><td>${ipStr(n)}</td><td>${ipStr(n+1)} – ${ipStr(b-1)}</td><td>${ipStr(b)}</td></tr>`;}).join('')}</table></div>
  <p><b>Result:</b> Network <b class="g mono">${ipStr(net)}</b>, gateway <b class="g mono">${ipStr(net+1)}</b>, last usable <b class="g mono">${ipStr(bc-1)}</b>, broadcast <b class="g mono">${ipStr(bc)}</b> (next subnet − 1).</p>`;
  return s;
}

/* ---------------- tailored feedback ---------------- */
/* Each diag function gets the raw text the student typed for each field and returns,
   per field, null (correct) or HTML explaining that specific mistake. */
const T=(tag,html)=>Object.assign(new String(html),{tag});
const M=s=>`<span class="mono">${s}</span>`;
const G=s=>`<b class="g mono">${s}</b>`;
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isBlank=v=>String(v).trim()==='';
const toNum=v=>{const s=String(v).replace(/[,\s]/g,'');return /^\d+$/.test(s)?Number(s):null;};
const toPre=v=>{const s=String(v).trim().replace(/^\//,'');return /^\d+$/.test(s)?Number(s):null;};
const popcount=n=>{let c=0;for(let i=0;i<32;i++)c+=(n>>>i)&1;return c;};
const maskPrefix=n=>{const c=popcount(n);return maskOf(c)===n>>>0?c:-1;}; // -1 = not a valid mask
const VALID_OCT='0, 128, 192, 224, 240, 248, 252, 254, 255';
const placeVals=[128,64,32,16,8,4,2,1];
function badEntry(v,kind){
  if(isBlank(v))return 'You left this blank.';
  if(kind==='ip')return `${M(esc(String(v).trim()))} isn’t a valid IPv4 address. It needs four numbers from 0 to 255 separated by dots.`;
  if(kind==='prefix')return `${M(esc(String(v).trim()))} isn’t a prefix. Write it as a number like ${M('/26')}.`;
  return `${M(esc(String(v).trim()))} isn’t a whole number.`;
}

/* --- network address (shared by ANDing and the chart) --- */
function netCtx(ip,p){
  const m=maskOf(p),net=(ip&m)>>>0,size=2**(32-p),bc=(net+size-1)>>>0;
  const io=Math.floor((p-1)/8),mv=oct(m,io),inc=256-mv,ipo=oct(ip,io),neto=oct(net,io);
  return {m,net,size,bc,io,mv,inc,ipo,neto,h:32-p};
}
function blocksAround(c,uo){
  let lo=Math.max(0,Math.min(c.neto,uo)-c.inc),hi=Math.min(256-c.inc,Math.max(c.neto,uo)+c.inc);
  if((hi-lo)/c.inc>6){lo=Math.max(0,c.neto-c.inc);hi=Math.min(256-c.inc,c.neto+2*c.inc);}
  const a=[];for(let x=lo;x<=hi;x+=c.inc)a.push(x===c.neto?`<b>${x}</b>`:x);return (lo>0?'… ':'')+a.join(', ')+(hi<256-c.inc?' …':'');
}
function copyTypo(u,ref,io){
  const bad=[];for(let k=0;k<io;k++)if(oct(u,k)!==oct(ref,k))bad.push(k);if(!bad.length)return null;
  const fix=bad.map(k=>`octet ${k+1} should be ${oct(ref,k)}, not ${oct(u,k)}`).join(', and ');
  const pre=[0,1,2].slice(0,io).map(k=>oct(ref,k)).join('.');
  return T('copy_octets',`Check for a typo: ${fix}. The mask is 255 in ${io>1?'octets 1–'+io:'octet 1'}, so ${io>1?'they':'it'} copy straight down from the IP unchanged (${M(pre+'.')}). Every address in this problem starts that way.`);
}
function diagNet(ip,p,u,isAnd){
  const c=netCtx(ip,p);const o=c.io+1;const later=c.io<3?` Every octet after octet ${o} becomes 0.`:'';
  if(u===ip)return T('copied_ip',`That’s the IP address you were given, not its network. The network address is where the IP’s block starts: round octet ${o} (${c.ipo}) down to a multiple of ${c.inc} → ${c.neto}.${later}`);
  for(let k=0;k<c.io;k++)if(oct(u,k)!==oct(ip,k))
    return T('copy_octets',`Octet ${k+1} should be ${oct(ip,k)}, not ${oct(u,k)}. The mask is 255 there, so that octet copies straight down from the IP unchanged.`);
  const uo=oct(u,c.io);const laterBad=[1,2,3].filter(k=>k>c.io&&oct(u,k)!==0);
  if(uo===c.neto&&laterBad.length)
    return T('zero_octets',`Octet ${o} (${c.neto}) is right, but octet${laterBad.length>1?'s':''} ${laterBad.map(k=>k+1).join(' and ')} must be 0. The mask is 0 in those octets, and anything ANDed with 0 is 0.`);
  const tail=laterBad.length?` Also, octets after octet ${o} should be 0.`:'';
  if(isAnd&&c.mv!==255){
    if(uo===(c.ipo|c.mv))return T('or_and',`It looks like you ORed the octet instead of ANDing it. AND gives 1 only where <i>both</i> bits are 1:<br>${M(`${bin8(c.ipo)} (${c.ipo})<br>${bin8(c.mv)} (${c.mv})<br>${bin8(c.neto)} → ${c.neto}`)}`);
    if(uo===c.mv)return T('or_and',`${uo} is the mask’s octet, copied down. You need ${c.ipo} AND ${c.mv}: ${M(bin8(c.ipo)+' AND '+bin8(c.mv)+' = '+bin8(c.neto))} = ${c.neto}.${tail}`);
  }
  if(uo%c.inc===0){
    if(uo===c.neto+c.inc)return T('round_up',`You rounded up. ${c.ipo} sits in the block ${c.neto}–${c.neto+c.inc-1}; ${uo} is where the <i>next</i> block starts. Always round down: the network is never higher than the IP.${tail}`);
    if(uo>c.ipo)return T('round_up',`${uo} is a real subnet boundary, but it’s above ${c.ipo}, and the network can never be higher than the IP. Count up by ${c.inc}: ${blocksAround(c,uo)}. ${c.ipo} falls in ${c.neto}.${tail}`);
    return T('wrong_block',`${uo} is a real subnet, but ${c.ipo} isn’t in it: that block only runs ${uo}–${uo+c.inc-1}. Keep counting by ${c.inc}: ${blocksAround(c,uo)}. ${c.ipo} falls in ${c.neto}.${tail}`);
  }
  // a different prefix's network
  for(const q of [p-1,p+1,p-2,p+2,p-8,p+8]){if(q<1||q>31)continue;
    if(u===((ip&maskOf(q))>>>0)&&u!==c.net)
      return T('wrong_inc',`That’s the network you’d get with a /${q} mask (${M(ipStr(maskOf(q)))}). This problem is /${p} = ${M(ipStr(c.m))}: the interesting octet is ${o} with mask ${c.mv}, so the increment is 256 − ${c.mv} = ${c.inc}.`);}
  if(c.mv>0&&c.mv<255&&uo===Math.floor(c.ipo/c.mv)*c.mv)return T('wrong_inc',`It looks like you used ${c.mv} (the mask octet) as the increment. Increment = 256 − ${c.mv} = ${c.inc}, so ${c.ipo} rounds down to ${c.neto}.${tail}`);
  const i2=255-c.mv;if(i2>1&&uo===Math.floor(c.ipo/i2)*i2)return T('wrong_inc',`It looks like you used 255 − ${c.mv} = ${i2} as the increment. It’s 256 − ${c.mv} = ${c.inc}, so ${c.ipo} rounds down to ${c.neto}.${tail}`);
  return T('wrong_inc',`${uo} isn’t a multiple of ${c.inc}, so it can’t be a /${p} network address. With mask ${c.mv} in octet ${o}, the increment is 256 − ${c.mv} = ${c.inc}. Subnets go ${blocksAround(c,uo)}, and ${c.ipo} rounds down to ${c.neto}.${tail}`);
}

/* --- subnet chart --- */
function diagChart(ip,p,vals){
  const c=netCtx(ip,p);const ans=[c.net,(c.net+1)>>>0,(c.bc-1)>>>0,c.bc];
  const nm=['Subnet (network)','Default gateway','Last usable','Broadcast'];
  const what=['the subnet (network) address','the default gateway (first usable)','the last usable address','the broadcast address'];
  const u=vals.slice(0,4).map(parseIP);const right=u.map((x,i)=>x===ans[i]);
  const nextNet=(c.net+c.size)>>>0;
  const how=[
    `Round octet ${c.io+1} of the IP (${c.ipo}) down to a multiple of the increment ${c.inc} → ${G(ipStr(c.net))}.`,
    `First usable = network + 1 = ${G(ipStr(ans[1]))}.`,
    `Last usable = broadcast − 1 = ${G(ipStr(ans[2]))}.`,
    `Broadcast = next subnet − 1. The next subnet is ${M(ipStr(nextNet))}, so the broadcast is ${G(ipStr(c.bc))}.`];
  const out=[];
  for(let i=0;i<4;i++){
    if(right[i]){out.push(null);continue;}
    const x=u[i];if(x==null){out.push(badEntry(vals[i],'ip')+' '+how[i]);continue;}
    const j=ans.indexOf(x);
    if(j>=0&&j!==i){
      out.push(u[j]===ans[i]?T('swap',`You swapped the <b>${nm[i]}</b> and <b>${nm[j]}</b> boxes. ${M(ipStr(x))} is ${what[j]}. ${how[i]}`)
        :T('swap',`${M(ipStr(x))} is ${what[j]}, so it goes in the <b>${nm[j]}</b> box. ${how[i]}`));continue;}
    let msg=null;const un=u[0],ub=u[3];
    if(i===0)msg=diagNet(ip,p,x,false);
    else if(!((i===1&&un!=null&&x===((un+1)>>>0))||(i===2&&ub!=null&&x===((ub-1)>>>0))||(i===3&&un!=null&&x===((un+c.size-1)>>>0))))msg=copyTypo(x,ip,c.io);
    if(!msg&&i===1){
      if(un!=null&&!right[0]&&x===((un+1)>>>0))msg=`This is network + 1 for the network you wrote (${M(ipStr(un))}), so your method here is right. Only the network is off. With the correct network, the gateway is ${G(ipStr(ans[1]))}.`;
      else if(x===ip)msg=T('copied_ip',`That’s the IP from the question. The gateway is the first usable address in its subnet: network + 1 = ${G(ipStr(ans[1]))}.`);
      else if(x===((c.net+2)>>>0))msg=T('off_by_one',`Off by one. The gateway is network <b>+ 1</b>: ${M(ipStr(c.net))} + 1 = ${G(ipStr(ans[1]))}.`);
      else if(x===((c.net-1)>>>0))msg=T('off_by_one',`That’s one <i>below</i> the network, which belongs to the previous subnet. The gateway is network + 1 = ${G(ipStr(ans[1]))}.`);
    }
    if(!msg&&i===2){
      if(ub!=null&&!right[3]&&x===((ub-1)>>>0))msg=`This is broadcast − 1 for the broadcast you wrote (${M(ipStr(ub))}), so your method here is right. Only the broadcast is off. With the correct broadcast, the last usable is ${G(ipStr(ans[2]))}.`;
      else if(x===nextNet)msg=T('next_subnet',`That’s the next subnet’s network address. Count back from it: − 1 is the broadcast (${M(ipStr(c.bc))}), − 2 is the last usable, ${G(ipStr(ans[2]))}.`);
      else if(x===((c.bc-2)>>>0))msg=T('off_by_one',`Off by one. The last usable is broadcast <b>− 1</b>: ${M(ipStr(c.bc))} − 1 = ${G(ipStr(ans[2]))}.`);
      else if(oct(x,3)===254)msg=T('assume_255',`The last usable only ends in .254 when the broadcast ends in .255 <i>and</i> the octets before it match. Here the broadcast is ${M(ipStr(c.bc))}, so the last usable is ${G(ipStr(ans[2]))}.`);
    }
    if(!msg&&i===3){
      if(un!=null&&!right[0]&&x===((un+c.size-1)>>>0))msg=`This is the right broadcast for the network you wrote (${M(ipStr(un))}), so your method here is right. Only the network is off. With the correct network, the broadcast is ${G(ipStr(c.bc))}.`;
      else if(x===nextNet)msg=T('next_subnet',`That’s the <i>next</i> subnet’s network address. The broadcast is the address just before it: ${M(ipStr(nextNet))} − 1 = ${G(ipStr(c.bc))}.`);
      else if(x===((c.bc+1)>>>0)||x===((c.bc-2)>>>0))msg=T('off_by_one',`Off by one. Broadcast = next subnet − 1 = ${M(ipStr(nextNet))} − 1 = ${G(ipStr(c.bc))}.`);
      else if(oct(x,3)===255&&c.io===3)msg=T('assume_255',`A broadcast only ends in .255 for the last subnet in the octet. Here the increment is ${c.inc}, so this block ends just before the next subnet, ${M(ipStr(nextNet))}. The broadcast is ${G(ipStr(c.bc))}.`);
      else{for(const q of [p-1,p+1,p-2,p+2]){if(q<1||q>31)continue;const n2=(ip&maskOf(q))>>>0;
        if(x===((n2+2**(32-q)-1)>>>0)){msg=T('wrong_inc',`That’s the broadcast for a /${q}, not a /${p}. With /${p} the block is ${c.size.toLocaleString()} addresses (increment ${c.inc}), so the broadcast is ${G(ipStr(c.bc))}.`);break;}}}
      if(!msg&&c.io<3&&oct(x,c.io)===oct(c.bc,c.io)&&oct(x,3)!==255)msg=T('fill_255',`Octet ${c.io+1} is right, but every octet after it should be 255 in a broadcast (all host bits on): ${G(ipStr(c.bc))}.`);
    }
    out.push(msg||T('chart_misc',`${M(ipStr(x))} isn’t right. ${how[i]}`));
  }
  out.push(diagHosts(32-p,vals[4],true));
  return out;
}
function diagHosts(h,v,inChart){
  const ans=2**h-2;const u=toNum(v);if(u===ans)return null;
  const how=`Host bits h = 32 − ${32-h} = ${h}, so usable hosts = 2<sup>${h}</sup> − 2 = ${G(ans.toLocaleString())}.`;
  if(u==null)return badEntry(v,'num')+' '+how;
  if(u===2**h)return T('minus2',`You forgot to subtract 2. A /${32-h} has ${(2**h).toLocaleString()} addresses, but the first is the network address and the last is the broadcast, so ${G(ans.toLocaleString())} are usable.`);
  if(u===2**h-1)return T('minus2',`Subtract 2, not 1: both the network address <i>and</i> the broadcast are unusable. 2<sup>${h}</sup> − 2 = ${G(ans.toLocaleString())}.`);
  if(u===h)return T('host_bits',`${h} is the number of host <i>bits</i>. The number of hosts is 2<sup>${h}</sup> − 2 = ${G(ans.toLocaleString())}.`);
  if(h>=2&&u===2**(h-1)-2)return T('host_bits',`That’s 2<sup>${h-1}</sup> − 2. You used one host bit too few; h = 32 − ${32-h} = ${h}, so it’s 2<sup>${h}</sup> − 2 = ${G(ans.toLocaleString())}.`);
  if(u===2**(h+1)-2)return T('host_bits',`That’s 2<sup>${h+1}</sup> − 2. You used one host bit too many; h = 32 − ${32-h} = ${h}, so it’s 2<sup>${h}</sup> − 2 = ${G(ans.toLocaleString())}.`);
  if(u===2**(32-h)-2||u===2**(32-h))return T('host_bits',`You used the network bits (${32-h}) as the exponent. Hosts come from the <i>host</i> bits: 32 − ${32-h} = ${h}, so 2<sup>${h}</sup> − 2 = ${G(ans.toLocaleString())}.`);
  if(u===2*h-2||u===2*h)return T('power',`2<sup>${h}</sup> means 2 multiplied by itself ${h} times, not 2 × ${h}. 2<sup>${h}</sup> = ${(2**h).toLocaleString()}, minus 2 = ${G(ans.toLocaleString())}.`);
  if(inChart&&h<=8&&u===2**h-3)return T('minus2',`Usable hosts is 2<sup>h</sup> − 2 = ${G(ans.toLocaleString())}. Don’t also subtract the gateway: it’s a usable host address.`);
  return T('host_formula',`${u.toLocaleString()} isn’t right. ${how}`);
}

/* --- binary --- */
function diagBits(v,ub){
  if(ub===bin8(v))return null;const uval=parseInt(ub,2);
  if([...ub].reverse().join('')===bin8(v))return T('bin_order',`You wrote it backwards. The leftmost bit is worth 128 and the rightmost is worth 1. ${v} = ${G(bin8(v))}.`);
  let rem=v,first=null;const wrong=[];
  placeVals.forEach((pv,k)=>{const should=rem>=pv;const has=ub[k]==='1';
    if(has!==should){wrong.push(`${pv} should be ${should?'on':'off'}`);if(first==null)first=`At the ${pv} bit you had ${rem} left. ${rem} ${should?'≥':'<'} ${pv}, so that bit should be ${should?'<b>on</b>':'<b>off</b>'}.`;}
    if(should)rem-=pv;});
  const on=placeVals.filter((pv,k)=>ub[k]==='1');
  return T('bin_convert',`Your bits add up to ${on.length?on.join(' + ')+' = ':''}${uval}, which is ${uval>v?uval-v+' too high':v-uval+' too low'}. ${first} Fix: ${wrong.join(', ')} → ${G(bin8(v))}.`);
}
function diagBinDec(v,raw){
  const u=toNum(raw);if(u===v)return null;const b=bin8(v);
  const sum=`${placeVals.filter((pv,k)=>b[k]==='1').join(' + ')||'0'} = ${G(v)}`;
  if(u==null)return badEntry(raw,'num')+' Add the place values of the 1 bits: '+sum+'.';
  if(u===parseInt([...b].reverse().join(''),2))return T('bin_order',`You read it right to left. The leftmost bit is worth 128, not 1: ${sum}.`);
  if(u===popcount(v))return T('bin_read',`${u} is how many bits are 1. Add up their place <i>values</i> instead: ${sum}.`);
  const d=u-v,pv=Math.abs(d),k=placeVals.indexOf(pv);
  if(k>=0){if(d<0&&b[k]==='1')return T('bin_read',`You left out the ${pv} bit; it’s a 1. ${sum}.`);
    if(d>0&&b[k]==='0')return T('bin_read',`You added ${pv}, but that bit is 0. ${sum}.`);}
  return T('bin_read',`${u} isn’t right. Line the bits up under 128 64 32 16 8 4 2 1 and add the places with a 1: ${sum}.`);
}

/* --- prefix ↔ mask --- */
function diagMask(p,raw){
  const m=maskOf(p);const u=parseIP(raw);if(u===m)return null;
  const full=Math.floor(p/8),part=p%8,mv=part?oct(m,full):0;
  const build=`/${p} = ${full} octet${full!==1?'s':''} of 255 (${full*8} bits)${part?` plus ${part} more bit${part>1?'s':''} (${placeVals.slice(0,part).join(' + ')} = ${mv})`:''} → ${G(ipStr(m))}.`;
  if(u==null)return badEntry(raw,'ip')+' '+build;
  const q=maskPrefix(u);
  if(q<0){const bad=[0,1,2,3].map(i=>oct(u,i)).find(x=>![0,128,192,224,240,248,252,254,255].includes(x));
    const uo=part&&full<4?oct(u,full):null;
    if(uo!=null&&uo===256-mv)return T('mask_build',`${uo} is only the value of the last 1 bit (that’s the increment). The mask octet is the <i>sum</i> of all ${part} bits: ${placeVals.slice(0,part).join(' + ')} = ${mv}. ${build}`);
    if(bad!=null)return T('mask_build',`${bad} can’t appear in a subnet mask, because a mask is all 1s followed by all 0s. The only valid octets are ${VALID_OCT}. ${build}`);
    return T('mask_build',`That isn’t a valid mask: once an octet is less than 255, every octet after it must be 0. ${build}`);}
  if(q===32-p)return T('host_bits',`That mask has ${q} ones. It looks like you counted the host bits (32 − ${p} = ${32-p}) instead of the network bits. ${build}`);
  if(Math.abs(q-p)===8)return T('mask_build',`Right octet value, wrong spot: that’s a /${q}. With /${p} the first ${full} octet${full!==1?'s are':' is'} 255 and the partial octet comes next. ${build}`);
  return T('mask_build',`${M(ipStr(u))} is a /${q} (${q} ones), but you need ${p} ones. ${build}`);
}
function diagPrefix(p,raw){
  const u=toPre(raw);if(u===p)return null;const m=maskOf(p),full=Math.floor(p/8),part=p%8,mv=part?oct(m,full):0;
  const count=`Count the 1s: ${full} × 255 = ${full*8} bits${part?`, plus ${mv} = ${M(bin8(mv))} = ${part} bits`:''} → ${G('/'+p)}.`;
  if(u==null)return badEntry(raw,'prefix')+' '+count;
  if(u===32-p)return T('host_bits',`You counted the 0s (host bits). The prefix is the number of 1s. ${count}`);
  if(part&&u===full*8)return T('prefix_count',`You counted the 255s but forgot the partial octet. ${mv} = ${M(bin8(mv))} adds ${part} more. ${count}`);
  if(part&&u===part)return T('prefix_count',`You counted only the partial octet. Each 255 adds 8 more. ${count}`);
  if(part&&Math.abs(u-p)<=2&&Math.floor(u/8)===full)return T('prefix_count',`The 255s are right, but recount the bits in ${mv}: ${M(bin8(mv))} has ${part} ones, not ${u-full*8}. ${count}`);
  return T('prefix_count',`/${u} isn’t right. ${count}`);
}

/* --- formulas --- */
function diagNetworks(n,raw){
  const u=toNum(raw);const ans=2**n;if(u===ans)return null;const how=`Networks = 2<sup>n</sup> = 2<sup>${n}</sup> = ${G(ans)}.`;
  if(u==null)return badEntry(raw,'num')+' '+how;
  if(u===ans-2)return T('nets_minus2',`Don’t subtract 2 for networks; that rule is only for hosts. ${how}`);
  if(u===2*n)return T('power',`2<sup>${n}</sup> means 2 multiplied by itself ${n} times, not 2 × ${n}. ${how}`);
  if(u===n)return T('net_formula',`${n} is how many bits you borrowed. ${how}`);
  if(u===2**(n+1)||u===2**(n-1))return T('net_formula',`That’s 2<sup>${Math.log2(u)}</sup>. Use exactly the ${n} borrowed bits: ${how}`);
  return T('net_formula',`${u} isn’t right. ${how}`);
}
function diagNewPrefix(base,n,raw){
  const u=toPre(raw);const ans=base+n;if(u===ans)return null;const how=`Borrowed bits move from the host side to the network side, so the prefix grows: /${base} + ${n} = ${G('/'+ans)}.`;
  if(u==null)return badEntry(raw,'prefix')+' '+how;
  if(u===base-n)return T('prefix_grow',`The prefix gets bigger when you borrow bits, not smaller. ${how}`);
  if(u===base)return T('prefix_grow',`That’s the original prefix. ${how}`);
  if(u===n)return T('prefix_grow',`${n} is just the borrowed bits. ${how}`);
  if(u===32-ans)return T('prefix_grow',`That’s the host bits left over. ${how}`);
  return T('prefix_grow',`/${u} isn’t right. ${how}`);
}
function diagSizeHosts(H,p,raw){
  const u=toPre(raw);if(u===p)return null;const h=32-p;const us=q=>2**(32-q)-2;
  const how=`Find the smallest h where 2<sup>h</sup> − 2 ≥ ${H}: h = ${h} (${us(p)} hosts). Prefix = 32 − ${h} = ${G('/'+p)}.`;
  if(u==null||u<1||u>32)return (u==null?badEntry(raw,'prefix'):`/${u} isn’t a valid prefix.`)+' '+how;
  if(u===h)return T('host_bits',`${h} is the number of host bits. The prefix is 32 − ${h} = ${G('/'+p)}.`);
  if(us(u)<H){if(2**(32-u)>=H)return T('minus2',`/${u} has ${2**(32-u)} addresses but only ${us(u)} usable once you remove the network and broadcast. That’s not enough for ${H}. ${how}`);
    return T('size_hosts',`/${u} only gives ${us(u)} usable hosts, not enough for ${H}. ${how}`);}
  return T('size_hosts',`/${u} fits (${us(u).toLocaleString()} hosts) but isn’t the smallest. /${u+1} gives ${us(u+1).toLocaleString()}, which still covers ${H}. ${how}`);
}
function diagBits4Nets(N,n,raw){
  const u=toNum(raw);if(u===n)return null;const how=`Smallest n where 2<sup>n</sup> ≥ ${N}: 2<sup>${n}</sup> = ${2**n}${n>1?` (2<sup>${n-1}</sup> = ${2**(n-1)} is too few)`:''} → ${G(n)}.`;
  if(u==null)return badEntry(raw,'num')+' '+how;
  if(u===N)return T('size_nets',`${N} is the number of subnets you need, not the bits. ${how}`);
  if(u<n)return T('size_nets',`2<sup>${u}</sup> = ${2**u} subnets, which is fewer than ${N}. ${how}`);
  return T('size_nets',`That works, but it borrows more than you need. ${how}`);
}
function diagNewMask(base,n,raw,userBits){
  const p=base+n,m=maskOf(p);const u=parseIP(raw);if(u===m)return null;
  const how=`/${base} + ${n} borrowed = /${p} = ${G(ipStr(m))}.`;
  if(u==null)return badEntry(raw,'ip')+' '+how;
  const q=maskPrefix(u);const ub=toNum(userBits);
  if(q===base)return T('prefix_grow',`That’s the original /${base} mask. Add the ${n} borrowed bits: ${how}`);
  if(q>0&&ub!=null&&ub!==n&&q===base+ub)return `This is the right mask for the ${ub} bits you borrowed, so only the bits answer is off. ${how}`;
  if(q===base-n)return T('prefix_grow',`Borrowing bits makes the prefix bigger, not smaller. ${how}`);
  return diagMask(p,raw);
}
function diagIncrement(p,raw){
  const m=maskOf(p),io=Math.floor((p-1)/8),mv=oct(m,io),ans=256-mv;const u=toNum(raw);if(u===ans)return null;
  const how=`The interesting octet is octet ${io+1} (${mv}), the one that isn’t 255 or 0. 256 − ${mv} = ${G(ans)}.`;
  if(u==null)return badEntry(raw,'num')+' '+how;
  if(u===mv)return T('wrong_inc',`${mv} is the mask octet itself. Subtract it from 256: ${how}`);
  if(u===255-mv)return T('wrong_inc',`Use 256, not 255: 256 − ${mv} = ${G(ans)}. (Think of it this way: the last 1 bit in ${M(bin8(mv))} is worth ${ans}.)`);
  if(u===256||u===1)return T('wrong_inc',`You used the wrong octet. ${how}`);
  if(u===2**(32-p))return T('wrong_inc',`${u.toLocaleString()} is the total number of addresses per subnet. The increment is counted in octet ${io+1}: ${how}`);
  return T('wrong_inc',`${u} isn’t right. ${how}`);
}

/* ---------------- generators ---------------- */
const GEN={
  binary(sub){
    const v=Math.random()<0.4?pick([128,192,224,240,248,252,254,255,0,168,10,172]):R(0,255);
    if(sub?sub==='d2b':Math.random()<0.5) return {mode:'binary',sub:'d2b',walk:()=>walkD2B(v),title:'Binary · decimal → binary',prompt:`Flip on the bits that make <b class="big">${v}</b>`,
      fields:[{type:'bits',label:'Octet',answer:bin8(v)}],diag:x=>[diagBits(v,x[0])],hint:'Start at 128 and move right: if the value left is ≥ the place value, turn it on and subtract.',explain:explainBin(v)};
    return {mode:'binary',sub:'b2d',walk:()=>walkB2D(v),title:'Binary · binary → decimal',prompt:`What is <b class="big">${bin8(v)}</b> in decimal?`,
      fields:[{type:'num',label:'Decimal value',answer:v}],diag:x=>[diagBinDec(v,x[0])],hint:'Add the place values (128 64 32 16 8 4 2 1) for every bit that is 1.',explain:explainBin(v)};
  },
  prefix(sub){
    const p=state.level==='core'?(Math.random()<0.8?R(24,30):pick([8,16])):R(8,30);const m=maskOf(p);
    if(sub==='bin'||(!sub&&Math.random()<1/3))return genMaskBin();
    if(sub?sub==='p2m':Math.random()<0.5) return {mode:'prefix',sub:'p2m',walk:()=>walkP2M(p),title:'Prefix → mask',prompt:`Write the dotted-decimal subnet mask for <b class="big">/${p}</b>`,
      fields:[{type:'ip',label:'Subnet mask',answer:m}],diag:x=>[diagMask(p,x[0])],hint:`/${p} means ${p} ones followed by ${32-p} zeros. Every full octet of ones is 255.`,explain:explainMask(p)};
    return {mode:'prefix',sub:'m2p',walk:()=>walkM2P(p),title:'Mask → prefix',prompt:`What prefix length is <b class="big">${ipStr(m)}</b>?`,
      fields:[{type:'prefix',label:'Prefix (e.g. /26)',answer:p}],diag:x=>[diagPrefix(p,x[0])],hint:'Count the 1 bits: each 255 is 8 bits, then add the 1s in the last non-zero octet.',explain:explainMask(p)};
  },
  anding(){
    const p=randPrefix(),ip=randIP(),m=maskOf(p);
    return {mode:'anding',walk:()=>walkAnd(ip,p),title:'ANDing',prompt:`IP <b>${ipStr(ip)}</b> with mask <b>${ipStr(m)}</b> (/${p}).<br>What is the network address?`,
      fields:[{type:'ip',label:'Network address',answer:(ip&m)>>>0}],diag:x=>{const u=parseIP(x[0]);if(u===((ip&m)>>>0))return[null];const c=netCtx(ip,p);return[u==null?badEntry(x[0],'ip')+` Copy the octets under 255, AND octet ${c.io+1} (${c.ipo} AND ${c.mv} = ${c.neto}), and zero the rest → ${G(ipStr(c.net))}.`:diagNet(ip,p,u,true)];},
      hint:'Copy the octets under 255. In the octet where the mask isn’t 255 or 0, write both numbers in binary and AND them: 1 only where both are 1.',explain:explainAnd(ip,p)};
  },
  worksheet(){return genSheet();},
  vlsm(){return genVlsm();},
  detective(sub){
    if(sub==='role'||(!sub&&Math.random()<.25))return genRole();
    const p=randPrefix(),ip=randIP(),m=maskOf(p),net=(ip&m)>>>0,size=2**(32-p),bc=(net+size-1)>>>0;
    return {mode:'detective',walk:()=>walkSteps(ip,p),title:'Subnet chart',prompt:`Fill in the network chart for <b class="big">${ipStr(ip)}/${p}</b>`,
      fields:[{type:'ip',label:'Subnet (network)',answer:net},{type:'ip',label:'Broadcast',answer:bc},{type:'ip',label:'Default gateway (1st usable)',answer:(net+1)>>>0},{type:'ip',label:'Last usable',answer:(bc-1)>>>0},{type:'num',label:'Usable hosts',answer:size-2}],
      diag:x=>{const d=diagChart(ip,p,[x[0],x[2],x[3],x[1],x[4]]);return [d[0],d[3],d[1],d[2],d[4]];},
      hint:`Mask is ${ipStr(m)}. Increment = 256 − the octet that isn’t 255 or 0. List the subnets (0, inc, 2×inc…) and round the IP down to one of them.`,explain:explainSubnet(ip,p)};
  },
  formulas(sub){
    const core=state.level==='core';const t=sub!=null?sub:R(0,8);
    if(t===5)return genClassNets();
    if(t===6)return genSizeLan(core);
    if(t===7)return genPlanSubnets();
    if(t===8)return genMeetBoth();
    if(t===0){const p=core?R(24,30):R(16,30),h=32-p;
      return {mode:'formulas',sub:t,walk:()=>walkHosts(p),title:'Host formula',prompt:`How many <u>usable</u> host addresses are in each <b class="big">/${p}</b> subnet?`,
        fields:[{type:'num',label:'Usable hosts',answer:2**h-2}],diag:x=>[diagHosts(h,x[0])],hint:`Host bits h = 32 − ${p}. Usable = 2^h − 2.`,
        explain:`<p>h = 32 − ${p} = <b>${h}</b> host bits.</p><p class="mono">2<sup>${h}</sup> − 2 = ${(2**h).toLocaleString()} − 2 = <b class="g">${(2**h-2).toLocaleString()}</b></p><p class="dim">You subtract 2 because the first address is the network address and the last is the broadcast.</p>`};}
    if(t===1){const n=R(1,6),base=core?24:pick([16,24]),ip=parseIP(base===24?`192.168.${R(0,255)}.0`:`172.${R(16,31)}.0.0`);
      return {mode:'formulas',sub:t,walk:()=>walkNets(base,n),title:'Network formula',prompt:`You take <b>${ipStr(ip)}/${base}</b> and borrow <b class="big">${n}</b> host bit${n>1?'s':''}. How many subnets do you get?`,
        fields:[{type:'num',label:'Subnets',answer:2**n},{type:'prefix',label:'New prefix',answer:base+n}],diag:x=>[diagNetworks(n,x[0]),diagNewPrefix(base,n,x[1])],hint:'Networks = 2^n, where n is bits borrowed. The new prefix grows by n.',
        explain:`<p class="mono">2<sup>${n}</sup> = <b class="g">${2**n}</b> subnets</p><p>New prefix = /${base} + ${n} = <b class="g">/${base+n}</b> (${ipStr(maskOf(base+n))}). More network bits → more networks, fewer hosts each.</p>`};}
    if(t===2){const H=core?R(3,120):R(3,4000);let h=2;while(2**h-2<H)h++;const p=32-h;
      return {mode:'formulas',sub:t,walk:()=>walkSizeHosts(H,h,p),title:'Size for hosts',prompt:`A department needs <b class="big">${H}</b> hosts. What's the smallest subnet that fits? (Give the prefix.)`,
        fields:[{type:'prefix',label:'Prefix',answer:p}],diag:x=>[diagSizeHosts(H,p,x[0])],hint:'Find the smallest h where 2^h − 2 ≥ the hosts needed. Prefix = 32 − h.',
        explain:`<p>Try host-bit counts until 2<sup>h</sup> − 2 covers ${H}:</p><p class="mono">${h>2?`h=${h-1}: 2<sup>${h-1}</sup>−2 = ${2**(h-1)-2} ✗ too small<br>`:''}h=${h}: 2<sup>${h}</sup>−2 = ${2**h-2} ✓</p><p>Prefix = 32 − ${h} = <b class="g">/${p}</b> (mask ${ipStr(maskOf(p))}).</p>`};}
    if(t===3){const N=R(2,core?60:200);let n=1;while(2**n<N)n++;const base=n>6?16:(core?24:pick([16,24]));const p=base+n;
      return {mode:'formulas',sub:t,walk:()=>walkSizeNets(N,n,base),title:'Size for networks',prompt:`You need <b class="big">${N}</b> subnets out of a <b>/${base}</b>. How many bits do you borrow, and what's the new mask?`,
        fields:[{type:'num',label:'Bits borrowed',answer:n},{type:'ip',label:'New subnet mask',answer:maskOf(p)}],diag:x=>[diagBits4Nets(N,n,x[0]),diagNewMask(base,n,x[1],x[0])],hint:'Find the smallest n where 2^n ≥ the networks needed. Add n to the prefix.',
        explain:`<p class="mono">${n>1?`n=${n-1}: 2<sup>${n-1}</sup> = ${2**(n-1)} ✗<br>`:''}n=${n}: 2<sup>${n}</sup> = ${2**n} ✓</p><p>Borrow <b class="g">${n}</b> bits → /${base} + ${n} = /${p} = <b class="g mono">${ipStr(maskOf(p))}</b>.</p>`};}
    let p=core?R(25,30):R(17,30);if(p===24)p=R(25,30);const m=maskOf(p);const io=Math.floor((p-1)/8);const mv=oct(m,io);
    return {mode:'formulas',sub:t,walk:()=>walkInc(p),title:'Network increment',prompt:`What is the network increment for <b class="big">${ipStr(m)}</b>?`,
      fields:[{type:'num',label:'Increment',answer:256-mv}],diag:x=>[diagIncrement(p,x[0])],hint:'256 minus the octet that isn’t 255 or 0.',
      explain:`<p>Interesting octet (octet ${io+1}) = ${mv} = <span class="mono">${bin8(mv)}</span>. The last 1 bit sits in the <b>${256-mv}</b> position.</p><p class="mono">256 − ${mv} = <b class="g">${256-mv}</b></p><p>So subnets go 0, ${256-mv}, ${2*(256-mv)}${3*(256-mv)<256?', '+3*(256-mv):''}… in octet ${io+1}.</p>`};
  }
};




/* ---------------- sizing a LAN (VLSM) and planning the subnets (from the Packet Tracer labs' subnetting parts) ---------------- */
// VLSM: one LAN's host count → the smallest mask that fits, in dotted decimal, and the usable hosts it gives.
// One in five is a point-to-point link between two routers (2 addresses → /30).
function genSizeLan(core){
  const p2p=Math.random()<.2,H=p2p?2:core?R(3,120):R(3,1000);let h=2;while(2**h-2<H)h++;const p=32-h,m=maskOf(p),use=2**h-2,us=q=>Math.max(0,2**(32-q)-2);
  const how=p2p?`A link between two routers needs 2 addresses. h = 2 gives 2<sup>2</sup> − 2 = 2 usable, so it’s a /30: ${G(ipStr(m))}.`
    :`The smallest h with 2<sup>h</sup> − 2 ≥ ${H} is h = ${h} (2<sup>${h}</sup> − 2 = ${use}). Prefix = 32 − ${h} = /${p}, mask ${G(ipStr(m))}.`;
  function dMask(raw){
    const u=parseIP(raw);if(u===m)return null;
    if(u==null){if(/^\s*\/?\s*\d{1,2}\s*$/.test(String(raw)))return T('mask_build',`Write the mask in dotted decimal, like 255.255.255.224, not as a prefix. ${how}`);return badEntry(raw,'ip')+' '+how;}
    const q=maskPrefix(u);if(q<0)return T('mask_build',`That isn’t a valid mask: a mask is 1s followed by 0s, so each octet is 255, 254, 252, 248, 240, 224, 192, 128 or 0. ${how}`);
    if(us(q)<H){if(p2p)return T('p2p_link',`/${q} leaves ${us(q)} usable addresses, but the link needs one for each router. ${how}`);
      if(2**(32-q)>=H)return T('minus2',`/${q} has ${2**(32-q)} addresses, but the network and broadcast take 2, leaving ${us(q)}. That’s fewer than ${H}. ${how}`);
      return T('size_hosts',`/${q} only gives ${us(q).toLocaleString()} usable hosts, not enough for ${H}. ${how}`);}
    if(p2p)return T('p2p_link',`/${q} works, but it wastes addresses. Point-to-point links get the smallest subnet that holds 2. ${how}`);
    return T('vlsm_fit',`/${q} fits ${H} hosts, but it’s bigger than needed. VLSM gives each LAN the <b>smallest</b> subnet that fits, so no addresses are wasted. ${how}`);
  }
  function dUse(raw){
    const u=toNum(raw);if(u===use)return null;const how2=`${h} host bits: 2<sup>${h}</sup> − 2 = ${G(use)}.`;
    if(u==null)return badEntry(raw,'num')+' '+how2;
    if(u===2**h)return T('minus2',`2<sup>${h}</sup> = ${2**h} counts every address, but the network and broadcast can’t go to hosts: subtract 2. ${how2}`);
    if(u===H&&H!==use)return T('host_formula',`${H} is what the LAN needs. The question asks what the subnet supports, usually a bit more. ${how2}`);
    if(u===2**(32-h)||u===32-h||u===h)return T('host_bits',`Usable hosts come from the host bits (h = ${h}), not the prefix. ${how2}`);
    return T('host_formula',how2);
  }
  const what=p2p?'A <b>point-to-point link</b> between two routers needs an address for each end: <b class="big">2</b> host addresses.':`A LAN needs <b class="big">${H}</b> host addresses.`;
  return {mode:'formulas',sub:6,title:p2p?'Size a link (VLSM)':'Size a LAN (VLSM)',
    prompt:`${what} With VLSM it gets its own subnet. Which subnet mask fits it with the fewest wasted addresses, and how many usable hosts does that give?`,
    fields:[{type:'ip',label:'Subnet mask',answer:m},{type:'num',label:'Usable hosts',answer:use}],diag:x=>[dMask(x[0]),dUse(x[1])],
    hint:p2p?'Two routers need 2 addresses: 2² − 2 = 2, so /30.':'Find the smallest h where 2^h − 2 ≥ the hosts. Prefix = 32 − h; write it as a mask.',
    walk:()=>[{q:p2p?'The link needs 2 addresses. Smallest h where 2<sup>h</sup> − 2 ≥ 2?':`Smallest h (host bits) where 2<sup>h</sup> − 2 ≥ ${H}? Try h = 2, 3, 4 …`,kind:'num',ans:h,
        bad:u=>u==null||u<1?'Enter a number of bits.':u<h?`2<sup>${u}</sup> − 2 = ${Math.max(0,2**u-2)}, not enough. Try more bits.`:'That works, but a smaller h might too. Try one less.'},
      {q:'Prefix = 32 − h = ?',kind:'prefix',ans:p,bad:u=>u===h?'That’s the host bits. Prefix = 32 − h.':'Subtract your h from 32.'},
      {f:0,q:`Write /${p} as a dotted-decimal mask.`,kind:'ip',ans:m,bad:(u,raw)=>hMask(p,raw)},
      {f:1,q:`Usable hosts = 2<sup>${h}</sup> − 2 = ?`,kind:'num',ans:use,bad:u=>u===2**h?'Now subtract 2.':`2<sup>${h}</sup> − 2.`},
      {done:true,q:'Those are your two answers.'}],
    explain:`<p class="mono">${h>2?`h=${h-1}: 2<sup>${h-1}</sup>−2 = ${2**(h-1)-2} ✗ too small<br>`:''}h=${h}: 2<sup>${h}</sup>−2 = <b class="g">${use}</b> ✓</p><p>Prefix = 32 − ${h} = /${p} → mask <b class="g mono">${ipStr(m)}</b>.${p2p?' Every router-to-router link in a VLSM plan is a /30.':''}</p>`};
}
// One mask for every subnet (like the Subnetting Scenario lab): count the subnets (LANs + the router link),
// borrow bits, and check the hosts per subnet still cover each LAN.
function genPlanSubnets(){
  const r1=R(1,3),r2=R(1,3),lans=r1+r2,need=lans+1;let n=1;while(2**n<need)n++;const per=2**(8-n)-2,H=R(Math.max(2,2**(7-n)-1),per),m=maskOf(24+n);
  const base=parseIP(Math.random()<.7?`192.168.${R(0,255)}.0`:`10.${R(0,255)}.${R(0,255)}.0`);
  const cnt=`Each LAN is one subnet, and the link between the routers is one more: ${lans} + 1 = ${G(need)}.`;
  function dNeed(raw){const u=toNum(raw);if(u===need)return null;if(u==null)return badEntry(raw,'num')+' '+cnt;
    if(u===lans)return T('plan_count',`You counted the LANs, but the link between the two routers needs its own subnet too. ${cnt}`);
    if(u===lans+2)return T('plan_count',`The router-to-router link is a single subnet, even though it has two ends. ${cnt}`);
    if(u===2)return T('plan_count',`Count networks, not routers. ${cnt}`);
    return T('plan_count',cnt);}
  function dPer(raw,ub){const u=toNum(raw);if(u===per)return null;const how=`Host bits = 8 − ${n} borrowed = ${8-n}, so 2<sup>${8-n}</sup> − 2 = ${G(per)}.`;
    if(u==null)return badEntry(raw,'num')+' '+how;
    if(u===2**(8-n))return T('minus2',`Subtract 2 for the network and broadcast addresses. ${how}`);
    if(u===2**n||u===2**n-2)return T('host_bits',`That uses the borrowed bits. Hosts come from the bits left over. ${how}`);
    if(u===H)return T('plan_fit',`${H} is what each LAN needs. The question is how many each subnet gives, which has to be at least ${H}. ${how}`);
    const b=toNum(ub);if(b!=null&&b!==n&&b>0&&b<8&&u===2**(8-b)-2)return `Right for the ${b} bits you borrowed, so only the bits answer is off. ${how}`;
    return T('host_formula',how);}
  return {mode:'formulas',sub:7,title:'Plan the subnets',
    prompt:`Two routers are joined by a serial link. R1 has <b>${r1}</b> LAN${r1>1?'s':''} and R2 has <b>${r2}</b>. Each LAN needs <b class="big">${H}</b> host addresses. Subnet <b>${ipStr(base)}/24</b> with one mask for every subnet.`,
    fields:[{type:'num',label:'Subnets needed',answer:need},{type:'num',label:'Bits to borrow',answer:n},{type:'num',label:'Usable hosts per subnet',answer:per},{type:'ip',label:'New subnet mask',answer:m}],
    diag:x=>[dNeed(x[0]),diagBits4Nets(need,n,x[1]),dPer(x[2],x[1]),diagNewMask(24,n,x[3],x[1])],
    hint:'Subnets = LANs + 1 for the router link. Borrow the fewest bits n with 2ⁿ ≥ that. Hosts per subnet = 2^(8 − n) − 2; it must cover each LAN.',
    walk:()=>[{f:0,q:`Count the subnets: ${lans} LANs, plus the link between the routers. = ?`,kind:'num',ans:need,bad:u=>u===lans?'Don’t forget the router-to-router link.':`${lans} + 1.`},
      {f:1,q:`Smallest n where 2<sup>n</sup> ≥ ${need}?`,kind:'num',ans:n,bad:u=>u==null||u<1?'Enter a number of bits.':2**u<need?`2<sup>${u}</sup> = ${2**u}, fewer than ${need}.`:'That works, but fewer bits might too.'},
      {q:`Host bits left in the last octet: 8 − ${n} = ?`,kind:'num',ans:8-n,bad:()=>`8 − ${n}.`},
      {f:2,q:`Usable hosts per subnet = 2<sup>${8-n}</sup> − 2 = ? (It has to be at least what each LAN needs.)`,kind:'num',ans:per,bad:u=>u===2**(8-n)?'Now subtract 2.':`2<sup>${8-n}</sup> − 2.`},
      {f:3,q:`/24 + ${n} = /${24+n}. Write the mask.`,kind:'ip',ans:m,bad:(u,raw)=>hMask(24+n,raw)},
      {done:true,q:'That’s the plan.'}],
    explain:`<p>${lans} LANs + 1 router link = <b class="g">${need}</b> subnets. 2<sup>${n}</sup> = ${2**n} ≥ ${need}${n>1?` (2<sup>${n-1}</sup> = ${2**(n-1)} is too few)`:''}, so borrow <b class="g">${n}</b> bits.</p><p class="mono">${8-n} host bits: 2<sup>${8-n}</sup> − 2 = <b class="g">${per}</b> ≥ ${H} ✓</p><p>/24 + ${n} = /${24+n} → <b class="g mono">${ipStr(m)}</b></p>`};
}


// One mask that has to fit the biggest LAN AND leave spare subnets for growth (like the Subnet an IPv4 Network lab):
// exactly one mask meets both, so the answer is unique.
function genMeetBoth(){
  let a,b,spare,n,need,p;
  for(;;){n=R(2,3);need=R(2**(n-1)+1,2**n);spare=need-2;p=24+n;const hi=2**(32-p)-2,lo=2**(32-p-1)-1;a=R(lo,hi);b=R(Math.max(2,Math.floor(a*.5)),a-1);if(spare>=1&&a>=2)break;}
  const m=maskOf(p),per=2**(32-p)-2,base=parseIP(`192.168.${R(0,255)}.0`);
  const hostsOK=q=>2**(32-q)-2>=a,subsOK=q=>2**(q-24)>=need;
  const how=`Subnets: 2 LANs + ${spare} spare = ${need}, so you need 2<sup>n</sup> ≥ ${need}: at least /${p}. Hosts: ${a} needs 2<sup>h</sup> − 2 ≥ ${a}: at most /${p}. Only ${G('/'+p)} does both: ${G(ipStr(m))}.`;
  function dNeed(raw){const u=toNum(raw);if(u===need)return null;const h2=`The 2 LANs you need now, plus ${spare} spare: ${G(need)}.`;
    if(u==null)return badEntry(raw,'num')+' '+h2;if(u===2)return T('plan_count',`Count the spare subnets for future expansion too. ${h2}`);if(u===spare)return T('plan_count',`Add the two LANs you need now. ${h2}`);
    if(u===2**n)return T('plan_count',`That’s how many the mask makes. The question asks for the minimum you need. ${h2}`);return T('plan_count',h2);}
  function dMask(raw){const u=parseIP(raw);if(u===m)return null;if(u==null)return badEntry(raw,'ip')+' '+how;const q=maskPrefix(u);
    if(q<0||q<24)return T('mask_build',`That isn’t a /25–/30 mask. ${how}`);
    if(!subsOK(q))return T('meet_both',`/${q} fits the hosts but makes only ${2**(q-24)} subnets, fewer than ${need}. ${how}`);
    if(!hostsOK(q))return T('meet_both',`/${q} makes enough subnets but gives only ${2**(32-q)-2} hosts each, fewer than ${a}. ${how}`);return T('meet_both',how);}
  function dPer(raw){const u=toNum(raw);if(u===per)return null;const h2=`/${p} leaves ${32-p} host bits: 2<sup>${32-p}</sup> − 2 = ${G(per)}.`;
    if(u==null)return badEntry(raw,'num')+' '+h2;if(u===2**(32-p))return T('minus2',`Subtract 2 for the network and broadcast. ${h2}`);if(u===a)return T('plan_fit',`${a} is what LAN-A needs; the subnet gives at least that. ${h2}`);return T('host_formula',h2);}
  return {mode:'formulas',sub:8,title:'Meet both requirements',
    prompt:`Subnet <b>${ipStr(base)}/24</b> with <b>one mask</b> for every subnet. LAN-A needs at least <b class="big">${a}</b> hosts, LAN-B at least <b>${b}</b>, and you need <b>${spare}</b> more subnet${spare>1?'s':''}, unused, for future expansion.`,
    fields:[{type:'num',label:'Minimum subnets needed',answer:need},{type:'ip',label:'The mask that meets both',answer:m},{type:'num',label:'Usable hosts per subnet',answer:per}],
    diag:x=>[dNeed(x[0]),dMask(x[1]),dPer(x[2])],
    hint:'Subnets = LANs + spares → the mask must be at least that long. The biggest LAN must still fit → it can’t be longer than that. Pick the mask that is both.',
    walk:()=>[{f:0,q:`Count the subnets: 2 LANs now, plus ${spare} spare = ?`,kind:'num',ans:need,bad:u=>u===2?'Add the spare subnets.':`2 + ${spare}.`},
      {q:`Smallest n with 2<sup>n</sup> ≥ ${need}? That’s the fewest bits to borrow, so the mask is at least /24 + n.`,kind:'num',ans:n,bad:u=>u==null||u<1?'Enter a number of bits.':2**u<need?`2<sup>${u}</sup> = ${2**u}, too few.`:'That works, but fewer might too.'},
      {q:`Smallest h with 2<sup>h</sup> − 2 ≥ ${a}? The mask can be at most 32 − h.`,kind:'num',ans:32-p,bad:u=>u==null||u<1?'Enter a number of bits.':2**u-2<a?`2<sup>${u}</sup> − 2 = ${2**u-2}, too few.`:'That works, but fewer might too.'},
      {f:1,q:`At least /${p} and at most /${p}: write /${p} as a mask.`,kind:'ip',ans:m,bad:(u,raw)=>hMask(p,raw)},
      {f:2,q:`Usable hosts = 2<sup>${32-p}</sup> − 2 = ?`,kind:'num',ans:per,bad:u=>u===2**(32-p)?'Now subtract 2.':`2<sup>${32-p}</sup> − 2.`},
      {done:true,q:'That mask meets both.'}],
    explain:`<p>Subnets: 2 + ${spare} = <b class="g">${need}</b> → borrow ${n} bits (2<sup>${n}</sup> = ${2**n}) → at least /${p}.</p><p>Hosts: ${a} needs ${32-p} host bits (2<sup>${32-p}</sup> − 2 = ${per}) → at most /${p}.</p><table class="sol"><tr><th>Mask</th><th>Subnets</th><th>Hosts</th><th></th></tr>${[25,26,27,28,29,30].map(q=>`<tr><td>/${q}</td><td>${2**(q-24)}</td><td>${2**(32-q)-2}</td><td>${q===p?'<b class="g">✓ both</b>':subsOK(q)?'subnets only':hostsOK(q)?'hosts only':''}</td></tr>`).join('')}</table><p>The answer: <b class="g mono">${ipStr(m)}</b> (/${p}), ${per} hosts each.</p>`};
}

/* ---------------- worksheet (the full class worksheet: mask, binary, increment, network, broadcast, role, totals, chart) ---------------- */
const classOf=ip=>{const a=oct(ip,0);return a<128?{c:'A',d:8,range:'1–126'}:a<192?{c:'B',d:16,range:'128–191'}:{c:'C',d:24,range:'192–223'};};
const bin32=m=>[0,1,2,3].map(i=>bin8(oct(m,i))).join('.');
const bits32=raw=>{const s=String(raw).replace(/[.\s]/g,'');return /^[01]{32}$/.test(s)?s.match(/.{8}/g).join('.'):null;};
const ROLES={network:'Network address',host:'Useable host',broadcast:'Broadcast address'};
const toRole=raw=>{const s=String(raw).trim().toLowerCase();if(!s)return null;if(/^n/.test(s))return 'network';if(/^(h|u)/.test(s))return 'host';if(/^b/.test(s))return 'broadcast';return null;};
const pow2=raw=>{const s=String(raw).replace(/[,\s]/g,'');const m=s.match(/^2\^(\d{1,2})$/);if(m)return 2**Number(m[1]);return /^\d+$/.test(s)?Number(s):null;};
const big=n=>Number(n).toLocaleString();

function diagBin32(p,raw){
  const m=maskOf(p),want=bin32(m);if(bits32(raw)===want)return null;
  const s=String(raw).replace(/[.\s]/g,''),how=`/${p} = ${p} ones then ${32-p} zeros: ${G(want)}.`;
  if(isBlank(raw))return 'You left this blank. '+how;
  if(!/^[01]+$/.test(s))return T('mask_binary',`Use only 1s and 0s (dots between octets are optional). ${how}`);
  if(s.length!==32)return T('mask_binary',`That’s ${s.length} bits. A mask is 32 bits: four groups of 8. ${how}`);
  if([...s].reverse().join('')===want.replace(/\./g,''))return T('mask_binary',`You wrote it backwards. The 1s (network bits) come first, on the left. ${how}`);
  if(!/^1*0*$/.test(s))return T('mask_binary',`A mask is all 1s followed by all 0s: once a 0 appears, the rest are 0. ${how}`);
  const q=s.indexOf('0')<0?32:s.indexOf('0');
  if(q===32-p)return T('mask_binary',`You have ${q} ones: that’s the host bits. The 1s are the <i>network</i> bits, ${p} of them. ${how}`);
  return T('mask_binary',`You have ${q} ones (a /${q}), but /${p} needs ${p}: ${Math.floor(p/8)} full octet${p>=16?'s':''} of 1s plus ${p%8} in the next octet. ${how}`);
}
function diagRole(ip,p,role,raw){
  const r=toRole(raw);if(r===role)return null;
  const m=maskOf(p),net=(ip&m)>>>0,bc=(net+2**(32-p)-1)>>>0;
  const why=`${M(ipStr(ip))} is in the block ${M(ipStr(net))} – ${M(ipStr(bc))}. ${role==='network'?'It’s the <b>first</b> address of the block, so it’s the <b>network address</b>.':role==='broadcast'?'It’s the <b>last</b> address of the block, so it’s the <b>broadcast address</b>.':'It’s strictly between the network and broadcast, so it’s a <b>usable host</b>.'}`;
  if(!r)return 'Pick one of the three. '+why;
  const extra=r==='network'&&role==='host'?' Being a multiple of a small number isn’t enough: it has to be a multiple of the increment.':r==='host'&&role!=='host'?' The first and last addresses of every block are reserved.':'';
  return T('ip_role',why+extra);
}
function diagClassNets(ip,p,raw,allowAlt){
  const c=classOf(ip),n=p-c.d,ans=2**n,u=pow2(raw);if(u===ans||(allowAlt&&u===2**(p-24)))return null;
  const how=`First octet ${oct(ip,0)} is Class ${c.c} (${c.range}), so the default mask is /${c.d}. Borrowed bits n = ${p} − ${c.d} = ${n}, and 2<sup>${n}</sup> = ${G(big(ans))}.`;
  if(u==null)return badEntry(raw,'num')+' '+how;
  if(u===2**(32-p)||u===2**(32-p)-2)return T('class_nets',`That’s from the host bits (2<sup>${32-p}</sup>). Total networks come from the <i>borrowed</i> bits. ${how}`);
  if((n>1&&u===ans-2)||(allowAlt&&p-24>1&&u===2**(p-24)-2))return T('class_nets',`Don’t subtract 2 for networks; that’s only for hosts. ${how}`);
  if(u===n)return T('class_nets',`${n} is the number of borrowed bits. Networks = 2<sup>${n}</sup>. ${how}`);
  if(u===2*n&&n!==2)return T('power',`2<sup>${n}</sup> isn’t 2 × ${n}. ${how}`);
  for(const d of [8,16,24])if(d!==c.d&&p>d&&u===2**(p-d))return T('class_nets',`That’s counting from /${d}, the Class ${{8:'A',16:'B',24:'C'}[d]} default. ${how}`);
  if(u===2**p)return T('class_nets',`You used the whole prefix. Only the bits <i>borrowed past the class default</i> count. ${how}`);
  return T('class_nets',`${big(u)} isn’t right. ${how}`);
}
function diagDefault(ip,raw){
  const c=classOf(ip),u=toPre(raw);if(u===c.d)return null;
  const how=`First octet ${oct(ip,0)} is in ${c.range}, so it’s Class ${c.c}: default ${G('/'+c.d)}. (A: 1–126 → /8 · B: 128–191 → /16 · C: 192–223 → /24)`;
  if(u==null)return badEntry(raw,'prefix')+' '+how;
  return T('class_nets',how);
}
function diagCell(rowNet,inc,c,raw,userNet,userBc){
  const rowBc=(rowNet+inc-1)>>>0,want=[rowNet,(rowNet+1)>>>0,(rowBc-1)>>>0,rowBc][c],u=parseIP(raw);if(u===want)return null;
  const r=oct(rowNet,3)/inc+1,nextNet=(rowNet+inc)>>>0;
  const seq=[0,inc,2*inc].filter(x=>x<256).join(', ')+(3*inc<256?'…':'');
  const how=[`Rows count up by the increment from 0 (${seq}), so row ${r} starts at ${G(ipStr(rowNet))}.`,
    `First usable = network + 1 = ${G(ipStr(want))}.`,`Last usable = broadcast − 1 = ${G(ipStr(want))}.`,
    `Broadcast = next row’s network − 1 = ${M(ipStr(nextNet))} − 1 = ${G(ipStr(want))}.`][c];
  if(u==null)return badEntry(raw,'ip')+' '+how;
  if(c===1&&userNet!=null&&userNet!==rowNet&&u===((userNet+1)>>>0))return `Right method for the network you wrote in this row; only that network is off. ${how}`;
  if(c===2&&userBc!=null&&userBc!==rowBc&&u===((userBc-1)>>>0))return `Right method for the broadcast you wrote in this row; only that broadcast is off. ${how}`;
  if(c===3&&userNet!=null&&userNet!==rowNet&&u===((userNet+inc-1)>>>0))return `Right method for the network you wrote in this row; only that network is off. ${how}`;
  {const ty=copyTypo(u,rowNet,3);if(ty)return ty;}
  if(c===0&&oct(u,3)%inc===0)return T('chart_rows',`${M(ipStr(u))} is a real network, but it belongs to a different row. ${how}`);
  if(c===0)return T('chart_rows',`Network addresses are multiples of the increment (${inc}). ${how}`);
  if(c===1&&u===rowNet)return T('chart_rows',`That’s the network address itself, which can’t be used. ${how}`);
  if(c===2&&u===rowBc)return T('chart_rows',`The broadcast can’t be used by a host. ${how}`);
  if((c===2||c===3)&&u===nextNet)return T('chart_rows',`That’s the next row’s network. ${how}`);
  if(c===3&&u===((rowBc-1)>>>0))return T('chart_rows',`That’s the last usable. The broadcast is one more. ${how}`);
  return T('chart_rows',`${M(ipStr(u))} isn’t right. ${how}`);
}
function walkSheet(ip,p,asPrefix,rows){
  const m=maskOf(p),k=p-24,mv=oct(m,3),inc=256-mv,c=classOf(ip),n=p-c.d,h=32-p,ipo=oct(ip,3);
  const net=(ip&m)>>>0,bc=(net+inc-1)>>>0,role=ip===net?'network':ip===bc?'broadcast':'host',P=4+4*rows.length;
  const binStep={q:`Write the mask’s 4th octet (<b>${mv}</b>) in binary.`,kind:'bits8',ans:bin8(mv),bad:(u,raw)=>hBits(mv,raw)};
  const st=[];
  if(asPrefix){
    st.push({q:`<b>/${p}</b>: the first three octets are full (24 ones, 255.255.255). How many 1s go in the 4th octet?`,kind:'num',ans:k,bad:()=>`Subtract 24 from ${p}.`});
    st.push({q:`Add up that many place values, starting at 128 (128, 64, 32 …). That’s the mask’s 4th octet.`,kind:'num',ans:mv,bad:u=>k>1&&u===placeVals[k-1]?'That’s only the last one. Add all of them, starting from 128.':`Add the first ${k} place value${k>1?'s':''}, starting at 128.`});
    st.push({q:`Write the subnet mask in dotted decimal. The first three octets are 255 (already filled in), so type the 4th octet you just added up.`,kind:'ip',ans:m,f:0,bad:(u,raw)=>hMask(p,raw)});
    st.push({...binStep,q:`Write the mask’s 4th octet (the value you added up) in binary.`});
  }else{
    st.push(binStep);
    st.push({q:`Count the 1s: 24 from the three 255s, plus the 1s in your binary. Prefix = ?`,kind:'prefix',ans:p,f:0,bad:()=>'Add 24 to the number of 1s in your binary.'});
  }
  st.push({q:`Now the binary mask. The first three octets are 255 = <span class="mono">11111111</span> each (already filled in), so type the 8 bits of your 4th octet.`,kind:'bin32',ans:bin32(m),f:1,bad:(u,raw)=>hBin32(p,raw)});
  st.push({...incStep(mv),f:2});
  st.push({q:`Host bits h = the number of 0s in the mask (32 − ${p}) = ?`,kind:'num',ans:h,bad:()=>`Count the 0s in your binary mask, or subtract ${p} from 32.`});
  st.push({q:`Hosts per network = 2<sup>h</sup> − 2 = ?`,kind:'num',ans:2**h-2,f:3,bad:u=>hHosts(h,u)});
  rows.forEach((rn,r)=>{const b=4+4*r,nx=(rn+inc)>>>0,rb=(rn+inc-1)>>>0;
    st.push({q:r===0?`The chart always starts at .0. Write row 1’s network address.`:`Add the increment to the row above’s network. Write row ${r+1}’s network address.`,kind:'ip',ans:rn,f:b,
      bad:u=>u==null?IPFMT:r===0?'Copy the first three octets of the IP and end it in .0.':'Take the row above’s last octet and add the increment.'});
    st.push({q:`A row’s broadcast is the next row’s network − 1. Write row ${r+1}’s broadcast.`,kind:'ip',ans:rb,f:b+1,bad:u=>u==null?IPFMT:u===nx?'That’s the next row’s network. Subtract 1.':'One less than the next row’s network.'});
    st.push({q:`First usable = the row’s network + 1. Write row ${r+1}’s first usable address.`,kind:'ip',ans:(rn+1)>>>0,f:b+2,bad:u=>u==null?IPFMT:u===rn?'That’s the network itself. Add 1.':'Add 1 to the row’s network.'});
    st.push({q:`Last usable = the row’s broadcast − 1. Write row ${r+1}’s last usable address.`,kind:'ip',ans:(rb-1)>>>0,f:b+3,bad:u=>u==null?IPFMT:u===rb?'That’s the broadcast. Subtract 1.':'Subtract 1 from the row’s broadcast.'});
  });
  st.push({q:`The IP’s last octet is <b>${ipo}</b>. Which row’s network does it round <b>down</b> to? Type that row’s last octet.`,kind:'num',ans:ipo-ipo%inc,
    bad:u=>u==null?'Enter a number.':u%inc?'Use one of the row networks from your chart (a multiple of the increment).':u>ipo?'Too high: always round down, never up.':'That row ends before the IP. Look one row further down.'});
  st.push({q:`The network address of the IP is that row’s network. Write it.`,kind:'ip',ans:net,f:P,bad:(u,raw)=>hNet(ip,p,3,u,raw)});
  st.push({q:`The broadcast address of the IP is that same row’s broadcast. Write it.`,kind:'ip',ans:bc,f:P+1,bad:(u,raw)=>hBc(ip,3,(net+inc)>>>0,u)});
  st.push({q:`Compare the IP (ends in .${ipo}) with that row’s network and broadcast. Is it the <b>network</b> (first address), the <b>broadcast</b> (last), or a usable <b>host</b> (in between)?`,kind:'role',ans:role,f:P+2,
    bad:()=>'First address of the row = network, last = broadcast, anything in between = usable host.'});
  st.push({q:`Find the IP’s class from its first octet (<b>${oct(ip,0)}</b>). Class A is 1–126, B is 128–191, C is 192–223. Which class?`,kind:'cls',ans:c.c,bad:()=>`Find ${oct(ip,0)} in those three ranges.`});
  st.push({q:`What is the default prefix for that class?`,kind:'prefix',ans:c.d,bad:()=>'Each class has its own default: A is /8, B is /16, C is /24.'});
  st.push({q:`Borrowed bits n = ${p} − your default prefix = ?`,kind:'num',ans:n,bad:()=>`Subtract your default prefix from ${p}.`});
  st.push({q:`Total networks = 2<sup>n</sup> = ? (you can type it as ${M('2^n')} with your n)`,kind:'pow',ans:2**n,f:P+3,bad:u=>u===2**n-2?'No − 2 for networks.':'Double 1, n times, or type 2^ and your n.'});
  return st;
}
function explainSheet(ip,p,rows){
  const m=maskOf(p),mv=oct(m,3),inc=256-mv,net=(ip&m)>>>0,bc=(net+inc-1)>>>0,c=classOf(ip),n=p-c.d,h=32-p,ipo=oct(ip,3);
  const role=ipo===oct(net,3)?'network':ipo===oct(bc,3)?'broadcast':'host';
  return `<table class="sol"><tr><td>Subnet mask</td><td class="mono">${ipStr(m)} = /${p}</td></tr><tr><td>Binary</td><td class="mono">${bin32(m)}</td></tr><tr><td>Increment</td><td class="mono">256 − ${mv} = ${inc}</td></tr><tr><td>Hosts per network</td><td>h = ${h} → 2<sup>${h}</sup> − 2 = <b>${2**h-2}</b></td></tr></table>
  <table class="sol chartsol"><tr><th>Network</th><th>Useable host range</th><th>Broadcast</th></tr>${rows.map(rn=>`<tr class="${rn===net?'hl':''}"><td class="mono">${ipStr(rn)}</td><td class="mono">${ipStr(rn+1)} – ${ipStr(rn+inc-2)}</td><td class="mono">${ipStr(rn+inc-1)}</td></tr>`).join('')}</table>
  <table class="sol"><tr><td>Network of the IP</td><td class="mono">${ipStr(net)}</td></tr><tr><td>Broadcast of the IP</td><td class="mono">${ipStr(bc)}</td></tr><tr><td>The IP is a</td><td>${ROLES[role].toLowerCase()}</td></tr><tr><td>Total networks</td><td>Class ${c.c} default /${c.d} → n = ${p} − ${c.d} = ${n} → 2<sup>${n}</sup> = <b>${big(2**n)}</b>${c.d!==24?` <span class="dim">(2<sup>${p-24}</sup> = ${2**(p-24)} if your class counts from /24)</span>`:''}</td></tr></table>`;
}
function genSheet(fixed){
  const p=fixed?fixed.p:R(25,30),m=maskOf(p),inc=2**(32-p),blocks=256/inc;
  const kind=pick(['a','a','a','a','b','c']);
  const first3=kind==='a'?(Math.random()<.5?[10,10,10]:[10,R(0,255),R(0,255)]):kind==='b'?[172,R(16,31),R(0,255)]:[192,168,R(0,255)];
  const want=pick(['network','host','broadcast']),row=R(0,Math.min(blocks-1,3)),lo=row*inc;
  const last=want==='network'?lo:want==='broadcast'?lo+inc-1:lo+R(1,inc-2);
  const ip=fixed?parseIP(fixed.ip):parseIP(first3.join('.')+'.'+last),net=(ip&m)>>>0,bc=(net+inc-1)>>>0,base=(ip&0xFFFFFF00)>>>0,c=classOf(ip);
  const role=ip===net?'network':ip===bc?'broadcast':'host';
  const asPrefix=fixed?fixed.asPrefix:Math.random()<.5,nRows=Math.min(blocks,Math.max(3,Math.floor(oct(ip,3)/inc)+2));
  const rows=[...Array(nRows)].map((_,r)=>(base+r*inc)>>>0);
  const fields=[asPrefix?{key:'mask',sec:'pre',type:'ip',pre:'255.255.255.',label:'Subnet mask (dotted decimal)',answer:m}:{key:'mask',sec:'pre',type:'prefix',label:'Prefix (CIDR)',answer:p},
    {key:'bin',sec:'pre',type:'bin32',pre:'11111111.11111111.11111111.',label:'Subnet mask (binary)',answer:bin32(m)},
    {key:'inc',sec:'pre',type:'num',label:'Network increment',answer:inc},
    {key:'hosts',sec:'pre',type:'num',label:'Hosts per network (2ʰ − 2)',answer:inc-2}];
  // chart cells in the order you can work them out: network, broadcast (next network − 1), then the usable range
  rows.forEach((rn,r)=>[[0,'network'],[3,'broadcast'],[1,'first usable'],[2,'last usable']].forEach(([col,nm])=>
    fields.push({key:'cell',type:'ip',cell:{r,c:col},pre:ipStr(rn).replace(/\d+$/,''),label:`Row ${r+1} ${nm}`,answer:[rn,rn+1,rn+inc-2,rn+inc-1][col]>>>0})));
  fields.push({key:'net',sec:'post',type:'ip',label:'Network address of the IP',answer:net},
    {key:'bc',sec:'post',type:'ip',label:'Broadcast address of the IP',answer:bc},
    {key:'role',sec:'post',type:'choice',label:'The given IP is a…',answer:role},
    {key:'nets',sec:'end',type:'numalt',label:'Total networks (2ⁿ)',answer:2**(p-c.d),alt:c.d===24?[]:[2**(p-24)]});
  return {mode:'worksheet',layout:'sheet',title:'Worksheet',
    prompt:asPrefix?`<b class="big">${ipStr(ip)}/${p}</b>`:`<b class="big">${ipStr(ip)}</b> <span class="sep">|</span> <b class="big">${ipStr(m)}</b>`,
    fields,
    diag:x=>{const at=k=>x[fields.findIndex(f=>f.key===k)];
      const cellAt=(r,c)=>x[fields.findIndex(f=>f.cell&&f.cell.r===r&&f.cell.c===c)];
      return fields.map((f,i)=>{const v=x[i];switch(f.key){
        case 'mask':return asPrefix?diagMask(p,v):diagPrefix(p,v);
        case 'bin':return diagBin32(p,v);
        case 'inc':return diagIncrement(p,v);
        case 'hosts':return diagHosts(32-p,v);
        case 'nets':return diagClassNets(ip,p,v,true);
        case 'net':{const u=parseIP(v);return u===net?null:u==null?badEntry(v,'ip'):diagNet(ip,p,u,false);}
        case 'bc':return parseIP(v)===bc?null:diagChart(ip,p,[at('net'),'','',v,'0'])[3];
        case 'role':return diagRole(ip,p,role,v);
        case 'cell':{const {r,c:col}=f.cell;return diagCell(rows[r],inc,col,v,parseIP(cellAt(r,0)),parseIP(cellAt(r,3)));}
      }});},
    hint:'Mask → binary → increment (256 − the last mask octet). Count up by the increment from 0 to build the chart, find the IP’s row, then hosts = 2ʰ − 2 and networks = 2ⁿ from the class default.',
    walk:()=>walkSheet(ip,p,asPrefix,rows),explain:explainSheet(ip,p,rows)};
}

/* ---------------- worksheet layout ---------------- */
function expandCell(f,raw){
  if(!f||!f.pre||raw==null)return raw;const t=String(raw).trim();
  if(f.type==='bin32'){const b=t.replace(/\s+/g,'').match(/^\.?([01]{1,9})$/);return b?f.pre+b[1]:raw;}
  const m=t.match(/^\.?(\d{1,3})$/);return m?f.pre+m[1]:raw;
}
function cellHTML(f,i){
  return `<div class="field cell" data-i="${i}"><input id="f${i}" aria-label="${f.label}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric" enterkeyhint="next" placeholder="${['network','first','last','broadcast'][f.cell.c]} .__"><span class="fix"></span></div>`;
}
function sheetHTML(q){
  const sec=k=>q.fields.map((f,i)=>f.sec===k?fieldHTML(f,i):'').join('');
  const byRow={};q.fields.forEach((f,i)=>{if(f.cell)(byRow[f.cell.r]=byRow[f.cell.r]||[])[f.cell.c]=i;});
  const rows=Object.keys(byRow).map(r=>{const ix=byRow[r];return `<div class="crow"><span class="rlab">Row ${Number(r)+1}</span><div class="cc cnet" data-l="Network">${cellHTML(q.fields[ix[0]],ix[0])}</div><div class="cc cbc" data-l="Broadcast">${cellHTML(q.fields[ix[3]],ix[3])}</div><div class="cc rng" data-l="Useable host range">${cellHTML(q.fields[ix[1]],ix[1])}<span class="dash">–</span>${cellHTML(q.fields[ix[2]],ix[2])}</div></div>`;}).join('');
  return `<div class="ws-top">${sec('pre')}</div><div class="ws-chart"><div class="ch-title">Network chart</div>${(()=>{const c=q.fields.find(f=>f.pre&&f.cell);return c?`<div class="ch-note">Every address here starts <b class="mono">${c.pre}</b>, so just type the last octet.</div>`:'';})()}<div class="crow chead"><span class="rlab"></span><span>Network</span><span>Useable host range</span><span>Broadcast</span></div>${rows}</div><div class="ws-top ws-post"><div class="ch-title">The given IP</div>${sec('post')}</div><div class="ws-top ws-post"><div class="ch-title">The whole address space</div>${sec('end')}</div>`;
}

/* ---------------- VLSM: split a /24 into subnets sized for their host counts, biggest first ----------------
   Matches the class VLSM assignment: a bit grid per subnet (1s = network bits, 0s = host bits), then a table of
   network, useable host range, broadcast and subnet mask, plus one extra row for the network after the last subnet. */
const SUBL='ABCDEF';
const hostBitsFor=H=>{let h=2;while(2**h-2<H)h++;return h;};
const PV=[128,64,32,16,8,4,2,1];
function vlsmFrom(hostsRaw,baseRaw){
  const parts=String(hostsRaw||'').split(/[\s,;/]+/).filter(Boolean);
  if(parts.length<2||parts.length>6)return {err:'Enter 2 to 6 host counts separated by commas, like 58, 29, 15, 7.'};
  if(parts.some(p=>!/^\d{1,3}$/.test(p)))return {err:'Host counts must be whole numbers, like 58, 29, 15, 7.'};
  const hosts=parts.map(Number).sort((a,b)=>b-a);
  if(hosts.some(h=>h<2||h>126))return {err:'Each subnet needs between 2 and 126 hosts to fit inside a /24.'};
  const used=hosts.reduce((a,H)=>a+2**hostBitsFor(H),0);
  if(used>256)return {err:`Those subnets need ${used} addresses, more than the 256 in a /24. Use smaller host counts.`};
  let base=parseIP('192.168.0.0');
  if(baseRaw&&String(baseRaw).trim()){const b=parseIP(String(baseRaw).trim().replace(/\/24$/,''));
    if(b==null||oct(b,3)!==0)return {err:'The starting network must be a /24 that ends in .0, like 192.168.0.0.'};
    const a=oct(b,0);if(a===0||a===127||a>=224)return {err:'Use a normal unicast network (first octet 1–223, not 127).'};base=b;}
  return {kind:'vlsm',hosts,base:ipStr(base)};
}
function genVlsm(fixed){
  let hosts;
  if(fixed)hosts=fixed.hosts.slice();
  else for(;;){
    const hs=[...Array(4)].map(()=>R(2,7)).sort((a,b)=>b-a);
    if(hs[0]===2||hs.reduce((a,h)=>a+2**h,0)>=256)continue;
    // host counts that need exactly h host bits, often right at an edge (like 15 or 7, which just miss the smaller block)
    hosts=hs.map(h=>{const lo=Math.max(2,2**(h-1)-1),hi=2**h-2,r=Math.random();return r<.25?hi:r<.5?lo:R(lo,hi);});
    if(hosts.every((x,i)=>i===0||x<hosts[i-1]))break;
  }
  const base=fixed?parseIP(fixed.base):parseIP(Math.random()<.7?'192.168.0.0':`192.168.${R(1,254)}.0`);
  let at=base;
  const S=hosts.map((H,i)=>{const h=hostBitsFor(H),blk=2**h,mv=256-blk,net=at;at=(at+blk)>>>0;
    return {L:SUBL[i],H,h,blk,mv,mask:parseIP('255.255.255.'+mv),net,bc:(net+blk-1)>>>0,first:(net+1)>>>0,last:(net+blk-2)>>>0};});
  const nextNet=at,last=S[S.length-1].L;
  const pre=a=>ipStr(a).replace(/\d+$/,'');
  const fields=[],idx={grid:[],vmask:[],vnet:[],vbc:[],vfirst:[],vlast:[]};
  const add=f=>{idx[f.key]&&(idx[f.key][f.v]=fields.length);fields.push(f);};
  S.forEach((s,i)=>{const w=`Subnet ${s.L} · ${s.H} hosts`;
    add({key:'grid',v:i,type:'bits',label:`Subnet ${s.L} bit grid`,where:w,answer:bin8(s.mv)});
    add({key:'vmask',v:i,type:'ip',pre:'255.255.255.',label:`Subnet ${s.L} subnet mask`,where:w,answer:s.mask});
    add({key:'vnet',v:i,type:'ip',pre:pre(s.net),label:`Subnet ${s.L} network`,where:w,answer:s.net});
    add({key:'vbc',v:i,type:'ip',pre:pre(s.bc),label:`Subnet ${s.L} broadcast`,where:w,answer:s.bc});
    add({key:'vfirst',v:i,type:'ip',pre:pre(s.first),label:`Subnet ${s.L} first useable host`,where:w,answer:s.first});
    add({key:'vlast',v:i,type:'ip',pre:pre(s.last),label:`Subnet ${s.L} last useable host`,where:w,answer:s.last});
  });
  idx.vnet[S.length]=fields.length;
  fields.push({key:'vnet',v:S.length,type:'ip',pre:pre(nextNet),label:`Network after Subnet ${last}`,where:'The extra row',answer:nextNet});
  const at_=(x,k,i)=>idx[k][i]==null?'':x[idx[k][i]];
  const typo=(u,want)=>{if(u==null||want==null)return null;const bad=[0,1,2].filter(k=>oct(u,k)!==oct(want,k));if(!bad.length)return null;
    return T('copy_octets',`Check for a typo: ${bad.map(k=>`octet ${k+1} should be ${oct(want,k)}, not ${oct(u,k)}`).join(', and ')}. Every address in this problem starts ${M(pre(want))}; only the last octet changes.`);};
  const why=s=>`The smallest h with 2<sup>h</sup> − 2 ≥ ${s.H} is h = ${G(s.h)} (2<sup>h</sup> − 2 = ${G(2**s.h-2)}), so its row is ${G(8-s.h)} 1s, then ${G(s.h)} 0s.`;
  function diagGrid(s,raw){
    const t=String(raw||'').replace(/[\s.]/g,'');if(t===bin8(s.mv))return null;
    if(!/^[01]{8}$/.test(t))return `Fill in all 8 boxes with a 1 or a 0. Subnet ${s.L} needs ${s.H} hosts. ${why(s)}`;
    if(!/^1*0*$/.test(t))return T('vlsm_fit',`A grid row is all its 1s on the left (network bits), then all its 0s on the right (host bits), never mixed. ${why(s)}`);
    const u=(t.match(/0/g)||[]).length;
    if(u<s.h&&2**u>=s.H)return T('minus2',`${u} host bits give 2<sup>${u}</sup> = ${2**u} addresses, but the network and broadcast take 2 of them, so only ${2**u-2} hosts fit, fewer than ${s.H}. ${why(s)}`);
    if(u<s.h)return T('vlsm_fit',`${u} host bit${u===1?'':'s'} only give${u===1?'s':''} 2<sup>${u}</sup> − 2 = ${Math.max(0,2**u-2)} hosts, fewer than the ${s.H} Subnet ${s.L} needs. ${why(s)}`);
    return T('vlsm_fit',`${u} host bits fit, but it’s more than needed. VLSM uses the <b>smallest</b> block that fits so no addresses are wasted. ${why(s)}`);
  }
  function diagVMask(s,raw,userGrid){
    const u=parseIP(raw);if(u===s.mask)return null;
    const ones=PV.slice(0,8-s.h);
    const how=`Add the place values above the 1s in Subnet ${s.L}’s row: ${ones.length?ones.join(' + '):'none'} = ${G(s.mv)}. The mask is ${G(ipStr(s.mask))}.`;
    if(u==null)return badEntry(raw,'ip')+' '+how;
    if(oct(u,0)!==255||oct(u,1)!==255||oct(u,2)!==255)return T('vlsm_mask',`The first three octets of every mask here are 255. ${how}`);
    const g=String(userGrid||'').replace(/[\s.]/g,'');
    if(/^[01]{8}$/.test(g)&&/^1*0*$/.test(g)&&g!==bin8(s.mv)&&parseInt(g,2)===oct(u,3))return `Right method for the grid you wrote; only that grid row is off. ${how}`;
    const o=oct(u,3);
    if(o===s.blk)return T('vlsm_mask',`${s.blk} is the block size, not the mask. The mask octet is 256 − the block size. ${how}`);
    if(o===s.H||o===2**s.h-2)return T('vlsm_mask',`That’s a host count, not a mask. ${how}`);
    if([128,192,224,240,248,252,254].includes(o))return T('vlsm_mask',`${o} is a real mask octet, but it doesn’t match Subnet ${s.L}’s grid row. ${how}`);
    return T('vlsm_mask',`${o} can’t be a mask octet (they’re always some 1s followed by 0s: ${VALID_OCT}). ${how}`);
  }
  function diagVNet(i,raw,x){
    const want=i<S.length?S[i].net:nextNet,u=parseIP(raw);if(u===want)return null;
    const p=S[i-1],nm=i<S.length?`Subnet ${S[i].L}`:`the network after Subnet ${last}`;
    const how=i===0?`The first (biggest) subnet starts at the start of the /24: ${G(ipStr(want))}.`
      :`${i<S.length?`Subnet ${S[i].L}`:'The next network'} starts right after Subnet ${p.L} ends: Subnet ${p.L}’s broadcast + 1 = ${G(ipStr(want))}. (Same as Subnet ${p.L}’s network + its block size of ${p.blk}.)`;
    if(u==null)return badEntry(raw,'ip')+' '+how;
    {const ty=typo(u,want);if(ty)return ty;}
    if(i===0)return T('vlsm_block',`Assign from the very start of the range, biggest subnet first. ${how}`);
    const ub=parseIP(at_(x,'vbc',i-1)),un=parseIP(at_(x,'vnet',i-1));
    if(u===p.bc)return T('vlsm_block',`That’s Subnet ${p.L}’s broadcast. ${nm[0].toUpperCase()+nm.slice(1)} starts one address after it. ${how}`);
    if(ub!=null&&ub!==p.bc&&u===((ub+1)>>>0))return `Right method for the broadcast you wrote for Subnet ${p.L}; only that broadcast is off. ${how}`;
    if(un!=null&&un!==p.net&&u===((un+p.blk)>>>0))return `Right method for the network you wrote for Subnet ${p.L}; only that network is off. ${how}`;
    if(u===p.net)return T('vlsm_block',`That’s Subnet ${p.L}’s network. Every subnet needs its own block. ${how}`);
    if(u===((p.net+p.H)>>>0)||u===((p.net+p.H+1)>>>0))return T('vlsm_block',`It looks like you added the hosts Subnet ${p.L} needs (${p.H}). Each subnet takes a whole block of 2<sup>h</sup> addresses, so add its block size instead. ${how}`);
    if(i<S.length&&S[i].blk!==p.blk&&u===((p.net+S[i].blk)>>>0))return T('vlsm_block',`You added this subnet’s block size. Add the <b>previous</b> subnet’s block (Subnet ${p.L}’s). ${how}`);
    return T('vlsm_block',`${M(ipStr(u))} isn’t where ${nm} starts. ${how}`);
  }
  function diagVBc(i,raw,x){
    const s=S[i],u=parseIP(raw);if(u===s.bc)return null;
    const how=`Broadcast = network + block size − 1. Subnet ${s.L}’s block is 2<sup>${s.h}</sup> = ${s.blk}, so ${M(ipStr(s.net))} + ${s.blk} − 1 = ${G(ipStr(s.bc))}.`;
    if(u==null)return badEntry(raw,'ip')+' '+how;
    {const ty=typo(u,s.bc);if(ty)return ty;}
    const un=parseIP(at_(x,'vnet',i));
    if(un!=null&&un!==s.net&&u===((un+s.blk-1)>>>0))return `Right method for the network you wrote; only that network is off. ${how}`;
    if(u===((s.net+s.blk)>>>0))return T('off_by_one',`That’s where the next subnet starts. The broadcast is one before it. ${how}`);
    if(u===s.last)return T('off_by_one',`That’s the last useable host. The broadcast is one more. ${how}`);
    if(u===((s.net+s.H)>>>0)||u===((s.net+s.H+1)>>>0)||u===((s.net+s.H-1)>>>0))return T('vlsm_block',`It looks like you counted the ${s.H} hosts needed. The subnet gets its whole block of 2<sup>h</sup> addresses. ${how}`);
    return T('vlsm_block',`${M(ipStr(u))} isn’t Subnet ${s.L}’s broadcast. ${how}`);
  }
  function diagVEnd(i,raw,x,isFirst){
    const s=S[i],want=isFirst?s.first:s.last,u=parseIP(raw);if(u===want)return null;
    const how=isFirst?`First useable = network + 1 = ${G(ipStr(want))}.`:`Last useable = broadcast − 1 = ${G(ipStr(want))}.`;
    if(u==null)return badEntry(raw,'ip')+' '+how;
    {const ty=typo(u,want);if(ty)return ty;}
    const un=parseIP(at_(x,'vnet',i)),ub=parseIP(at_(x,'vbc',i));
    if(isFirst&&un!=null&&un!==s.net&&u===((un+1)>>>0))return `Right method for the network you wrote; only that network is off. ${how}`;
    if(!isFirst&&ub!=null&&ub!==s.bc&&u===((ub-1)>>>0))return `Right method for the broadcast you wrote; only that broadcast is off. ${how}`;
    if(isFirst&&u===s.net)return T('off_by_one',`That’s the network address itself, which a host can’t use. ${how}`);
    if(!isFirst&&u===s.bc)return T('off_by_one',`The broadcast can’t be used by a host. ${how}`);
    return T('off_by_one',`${M(ipStr(u))} isn’t right. ${how}`);
  }
  const used=nextNet-base;
  const notes=S.filter(s=>s.h>2&&2**(s.h-1)>=s.H).map(s=>`Subnet ${s.L} needs ${s.H} hosts, but 2<sup>${s.h-1}</sup> − 2 = ${2**(s.h-1)-2} is too few, so it uses ${s.h} host bits (${2**s.h-2} hosts).`);
  const explain=`<table class="sol"><tr><th>Subnet</th><th>Hosts needed</th><th>h</th><th>Block (2<sup>h</sup>)</th><th>Bit grid</th><th>Mask</th></tr>${S.map(s=>`<tr><td>${s.L}</td><td>${s.H}</td><td>${s.h} <span class="dim">(2<sup>${s.h}</sup> − 2 = ${2**s.h-2})</span></td><td>${s.blk}</td><td class="mono">${bin8(s.mv)}</td><td class="mono">${ipStr(s.mask)}</td></tr>`).join('')}</table>
    <table class="sol chartsol"><tr><th></th><th>Network</th><th>Useable host range</th><th>Broadcast</th></tr>${S.map(s=>`<tr><td>${s.L}</td><td class="mono">${ipStr(s.net)}</td><td class="mono">${ipStr(s.first)} – ${ipStr(s.last)}</td><td class="mono">${ipStr(s.bc)}</td></tr>`).join('')}<tr><td class="dim">Next</td><td class="mono">${ipStr(nextNet)}</td><td></td><td></td></tr></table>
    ${notes.length?`<p class="dim">${notes.join(' ')}</p>`:''}<p class="dim">The subnets use ${used} of the 256 addresses${used<256?`; ${ipStr(nextNet)} onward is still free for more subnets`:''}.</p>`;
  const walk=()=>{const st=[];
    S.forEach((s,i)=>{const p=S[i-1];
      st.push({q:`Subnet ${s.L} needs <b>${s.H}</b> hosts. Find the smallest h (host bits) where 2<sup>h</sup> − 2 ≥ ${s.H}. h = ?`,kind:'num',ans:s.h,
        tip:'Hosts for each h: h=2 → 2, h=3 → 6, h=4 → 14, h=5 → 30, h=6 → 62, h=7 → 126. Pick the first one that covers the hosts needed.',
        bad:u=>u==null?'Enter a number.':2**u-2<s.H?`2<sup>${u}</sup> − 2 = ${Math.max(0,2**u-2)}, fewer than ${s.H}. Try a bigger h.`:`2<sup>${u}</sup> − 2 = ${2**u-2} fits, but a smaller h also fits. Use the smallest.`});
      st.push({q:`In Subnet ${s.L}’s grid row, the last h boxes are 0s (host bits) and the rest are 1s. Type the 8 bits.`,kind:'bits8',ans:bin8(s.mv),f:idx.grid[i],
        tip:'Count the 0s from the right first, then fill everything to their left with 1s.',
        bad:(u,raw)=>!isBits8(raw)?'Type exactly 8 ones and zeros.':!/^1*0*$/.test(raw.trim())?'All the 1s go on the left and all the 0s on the right.':`Use ${s.h} 0s on the right, and 1s everywhere else.`});
      st.push({q:`Add the place values above the 1s. That’s the last octet of the mask (the first three are 255). Write Subnet ${s.L}’s subnet mask.`,kind:'ip',ans:s.mask,f:idx.vmask[i],
        tip:'The mask ladder: 1 one = 128, 2 = 192, 3 = 224, 4 = 240, 5 = 248, 6 = 252.',
        bad:u=>u==null?IPFMT:`Add ${PV.slice(0,8-s.h).join(' + ')}.`});
      st.push(i===0?{q:`The biggest subnet starts at the very start of the /24 you were given. Write Subnet ${s.L}’s network address.`,kind:'ip',ans:s.net,f:idx.vnet[i],tip:'',
          bad:u=>u==null?IPFMT:'It’s the network in the problem, ending in .0.'}
        :{q:`Subnet ${s.L} starts right after Subnet ${p.L} ends: Subnet ${p.L}’s broadcast + 1. Write Subnet ${s.L}’s network address.`,kind:'ip',ans:s.net,f:idx.vnet[i],
          tip:'In VLSM each network is the previous network plus the previous subnet’s block size, which is the same as its broadcast + 1.',
          bad:u=>u==null?IPFMT:u===p.bc?'That’s Subnet '+p.L+'’s broadcast. Add 1.':'Take Subnet '+p.L+'’s broadcast and add 1.'});
      st.push({q:`Block size = 2<sup>h</sup>, the total addresses in Subnet ${s.L} (hosts plus the network and broadcast). Block size = ?`,kind:'num',ans:s.blk,
        tip:'The block size is also 256 − the mask’s last octet.',
        bad:u=>u==null?'Enter a number.':u===s.blk-2?'That’s the useable hosts. The block also counts the network and broadcast: 2^h.':u===s.H?'That’s the hosts needed. The block is the full power of 2.':'2 multiplied by itself h times.'});
      st.push({q:`Broadcast = network + block size − 1. Write Subnet ${s.L}’s broadcast.`,kind:'ip',ans:s.bc,f:idx.vbc[i],
        tip:'The broadcast is always one before where the next subnet starts.',
        bad:u=>u==null?IPFMT:u===((s.net+s.blk)>>>0)?'That’s where the next subnet starts. Subtract 1.':'Add the block size to the network, then subtract 1.'});
      st.push({q:`First useable host = network + 1. Write it.`,kind:'ip',ans:s.first,f:idx.vfirst[i],tip:'',bad:u=>u==null?IPFMT:u===s.net?'That’s the network itself. Add 1.':'Add 1 to Subnet '+s.L+'’s network.'});
      st.push({q:`Last useable host = broadcast − 1. Write it.`,kind:'ip',ans:s.last,f:idx.vlast[i],tip:'',bad:u=>u==null?IPFMT:u===s.bc?'That’s the broadcast. Subtract 1.':'Subtract 1 from Subnet '+s.L+'’s broadcast.'});
    });
    const p=S[S.length-1];
    st.push({q:`The extra row: the network that comes after Subnet ${p.L} is Subnet ${p.L}’s broadcast + 1. Write it.`,kind:'ip',ans:nextNet,f:idx.vnet[S.length],tip:'',
      bad:u=>u==null?IPFMT:u===p.bc?'That’s Subnet '+p.L+'’s broadcast. Add 1.':'Take Subnet '+p.L+'’s broadcast and add 1.'});
    return st;};
  return {mode:'vlsm',layout:'vlsm',title:'VLSM',S,base,nextNet,
    prompt:`Use VLSM to divide <b class="big">${ipStr(base)}/24</b> into subnets that fit the hosts each one needs.<div class="vreq">${S.map(s=>`<span>Subnet ${s.L} will require</span><b>${s.H}</b><span>host IP addresses</span>`).join('')}</div>`,
    mini:`${ipStr(base)}/24 · ${S.map(s=>`${s.L} ${s.H}`).join(' · ')} hosts`,
    fields,
    diag:x=>fields.map((f,i)=>{const v=x[i],s=S[f.v];switch(f.key){
      case 'grid':return diagGrid(s,v);
      case 'vmask':return diagVMask(s,v,at_(x,'grid',f.v));
      case 'vnet':return diagVNet(f.v,v,x);
      case 'vbc':return diagVBc(f.v,v,x);
      case 'vfirst':return diagVEnd(f.v,v,x,true);
      case 'vlast':return diagVEnd(f.v,v,x,false);}}),
    hint:'Biggest subnet first. For each one: the smallest h with 2ʰ − 2 ≥ the hosts needed gives the grid (h 0s on the right) and the mask. Each network starts right after the previous broadcast; broadcast = network + 2ʰ − 1.',
    walk,explain};
}
function vcellHTML(f,i,ph){
  return `<div class="field cell" data-i="${i}"><input id="f${i}" aria-label="${f.label}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric" enterkeyhint="next" placeholder="${ph} .__"><span class="fix"></span></div>`;
}
function vlsmHTML(q){
  const I={};q.fields.forEach((f,i)=>{(I[f.key]=I[f.key]||[])[f.v]=i;});
  const grid=q.S.map((s,v)=>{const i=I.grid[v];return `<div class="field vg-row" data-i="${i}"><span class="rlab">Subnet ${s.L}<small>${s.H} hosts</small></span>${PV.map((p,k)=>`<button type="button" class="bit" data-k="${k}" aria-label="Subnet ${s.L}, ${p} bit">0</button>`).join('')}<span class="fix"></span></div>`;}).join('');
  const rows=q.S.map((s,v)=>`<div class="crow vrow"><span class="rlab">Subnet ${s.L}</span><div class="cc cnet" data-l="Network">${vcellHTML(q.fields[I.vnet[v]],I.vnet[v],'network')}</div><div class="cc rng" data-l="Useable host range">${vcellHTML(q.fields[I.vfirst[v]],I.vfirst[v],'first')}<span class="dash">–</span>${vcellHTML(q.fields[I.vlast[v]],I.vlast[v],'last')}</div><div class="cc cbc" data-l="Broadcast">${vcellHTML(q.fields[I.vbc[v]],I.vbc[v],'broadcast')}</div><div class="cc cmask" data-l="Subnet mask">${vcellHTML(q.fields[I.vmask[v]],I.vmask[v],'mask')}</div></div>`).join('');
  const nx=I.vnet[q.S.length];
  return `<div class="vg-wrap"><div class="ch-title">Bit grid</div><div class="ch-note">1s for network bits on the left, 0s for host bits on the right. Tap a box to flip it.</div>
    <div class="vg-h"><span></span>${PV.map(p=>`<span>${p}</span>`).join('')}</div>${grid}</div>
    <div class="ws-chart"><div class="ch-title">Address table</div><div class="ch-note">Addresses start <b class="mono">${ipStr(q.base).replace(/\d+$/,'')}</b> and masks start <b class="mono">255.255.255.</b>, so just type the last octet.</div>
    <div class="crow chead vrow"><span class="rlab"></span><span>Network</span><span>Useable host range</span><span>Broadcast</span><span>Subnet mask</span></div>${rows}
    <div class="crow vrow vnext"><span class="rlab">Next</span><div class="cc cnet" data-l="Network">${vcellHTML(q.fields[nx],nx,'network')}</div><span class="vnote">The network after Subnet ${q.S[q.S.length-1].L}, so you can find its broadcast.</span></div></div>`;
}
function flowSheetV(q,F,cur){
  const n=q.fields.length,end=cur<0?n:cur,reach=Math.max(end-1,cur);
  const I={};q.fields.forEach((f,i)=>{(I[f.key]=I[f.key]||[])[f.v]=i;});
  const cls=j=>`${F.miss[j]?' miss':''}${j===F.justDone?' pop':''}`;
  const cell=j=>j<end?`<span class="fs-cv${cls(j)}">${ipCell(q.fields[j].answer)}</span>`:j===cur?'<span class="fs-cur">?</span>':'';
  const gRows=q.S.map((s,v)=>{const j=I.grid[v];if(j>reach)return '';
    if(j<end)return `<tr class="${cls(j).trim()}"><td class="fs-rl">${s.L}</td>${[...q.fields[j].answer].map(b=>`<td class="b${b}">${b}</td>`).join('')}</tr>`;
    return `<tr><td class="fs-rl">${s.L}</td><td colspan="8"><span class="fs-cur">? ? ? ? ? ? ? ?</span></td></tr>`;}).join('');
  const aRows=q.S.map((s,v)=>{if(I.vmask[v]>reach)return '';
    return `<tr><td class="fs-rl">${s.L}</td><td>${cell(I.vnet[v])}</td><td>${cell(I.vfirst[v])}<span class="dim"> – </span>${cell(I.vlast[v])}</td><td>${cell(I.vbc[v])}</td><td>${cell(I.vmask[v])}</td></tr>`;}).join('');
  const nx=I.vnet[q.S.length],nRow=nx<=reach?`<tr><td class="fs-rl">Next</td><td>${cell(nx)}</td><td></td><td></td><td></td></tr>`:'';
  if(!gRows)return '';
  return `<div class="fsheet"><div class="fs-sec">Bit grid</div><table class="fs-chart fs-vg"><tr><th></th>${PV.map(p=>`<th>${p}</th>`).join('')}</tr>${gRows}</table>
    ${aRows?`<div class="fs-sec">Address table</div><table class="fs-chart"><tr><th></th><th><span class="lg">Network</span><span class="sm">Net</span></th><th><span class="lg">Useable host range</span><span class="sm">Useable</span></th><th><span class="lg">Broadcast</span><span class="sm">Bcast</span></th><th>Mask</th></tr>${aRows}${nRow}</table>`:''}</div>`;
}
function mirrorV(q,cell){
  const I={};q.fields.forEach((f,i)=>{(I[f.key]=I[f.key]||[])[f.v]=i;});
  return `<div class="mir"><table class="mchart"><tr><th></th><th>Bit grid</th><th>Mask</th><th>Network</th><th colspan="3">Useable</th><th>Bcast</th></tr>${q.S.map((s,v)=>`<tr><td class="ml">${s.L} <span class="dim">(${s.H})</span></td><td>${cell(I.grid[v])}</td><td>${cell(I.vmask[v])}</td><td>${cell(I.vnet[v])}</td><td>${cell(I.vfirst[v])}</td><td class="dim">–</td><td>${cell(I.vlast[v])}</td><td>${cell(I.vbc[v])}</td></tr>`).join('')}
    <tr><td class="ml">Next</td><td></td><td></td><td>${cell(I.vnet[q.S.length])}</td><td></td><td></td><td></td><td></td></tr></table><div class="dim msub">Addresses show their last octet.</div></div>`;
}
/* VLSM teaching tools: a problem from the handout's host counts, a share link, and printable sheets */
function shareURLV(pr){
  const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('vlsm',pr.hosts.join(','));
  if(pr.base!=='192.168.0.0')u.searchParams.set('net',pr.base);return u.toString();
}
function loadVlsm(pr){
  if(state.timed)return;
  if(state.mode!=='vlsm'){state.mode='vlsm';renderTabs();}
  next(genVlsm(pr));state.custom=pr;
  try{history.replaceState(null,'',shareURLV(pr));}catch(e){}
}
function renderOwnBoxV(){
  const box=$('#ownbox');
  box.innerHTML=`<div class="own-h"><b>Work a specific VLSM problem</b><button class="btn small" id="ownClose" aria-label="Close">✕</button></div>
  <p class="dim">Enter the hosts each subnet needs, for example from your class handout. They’re sorted biggest first, and the link below opens this exact problem on anyone’s device.</p>
  <div class="own-row"><label>Hosts needed<input id="ownHosts" autocomplete="off" spellcheck="false" inputmode="decimal" placeholder="58, 29, 15, 7"></label>
  <label>Starting network<input id="ownBase" autocomplete="off" spellcheck="false" inputmode="decimal" placeholder="192.168.0.0"></label>
  <button class="btn primary" id="ownGo">Load problem</button></div><div class="own-msg" id="ownMsg"></div>
  <div class="own-share" id="ownShare" hidden><span class="dim">Share this problem:</span> <input id="ownLink" readonly> <button class="btn small" id="ownCopy">Copy link</button></div>`;
  const go=()=>{const pr=vlsmFrom($('#ownHosts').value,$('#ownBase').value);
    if(pr.err){$('#ownMsg').textContent=pr.err;$('#ownMsg').className='own-msg bad';return;}
    loadVlsm(pr);$('#ownMsg').textContent=`Loaded ${pr.base}/24 with ${pr.hosts.join(', ')} hosts.`;$('#ownMsg').className='own-msg good';
    $('#ownShare').hidden=false;$('#ownLink').value=shareURLV(pr);};
  $('#ownGo').onclick=go;[$('#ownHosts'),$('#ownBase')].forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();go();}}));
  $('#ownClose').onclick=()=>{box.hidden=true;};
  $('#ownCopy').onclick=async()=>{const l=$('#ownLink');l.select();let ok=false;try{await navigator.clipboard.writeText(l.value);ok=true;}catch(e){try{ok=document.execCommand('copy');}catch(_){}}
    $('#ownCopy').textContent=ok?'Copied ✓':'Select and copy';setTimeout(()=>{$('#ownCopy').textContent='Copy link';},1800);};
}
function printVlsmHTML(q,n,key){
  const I={};q.fields.forEach((f,i)=>{(I[f.key]=I[f.key]||[])[f.v]=i;});
  const v=j=>key?ipStr(q.fields[j].answer):'';
  return `<section class="pp pp-v"><div class="pp-head"><b>Problem ${n}</b><span class="pp-given">${ipStr(q.base)}/24</span></div>
    <div class="pp-req">${q.S.map(s=>`Subnet ${s.L}: <b>${s.H}</b> hosts`).join(' &nbsp;·&nbsp; ')}</div>
    <table class="pp-chart pp-vgrid"><tr><th>Subnet</th>${PV.map(p=>`<th>${p}</th>`).join('')}</tr>${q.S.map((s,k)=>`<tr><td>Subnet ${s.L}</td>${PV.map((p,b)=>`<td>${key?q.fields[I.grid[k]].answer[b]:''}</td>`).join('')}</tr>`).join('')}</table>
    <table class="pp-chart pp-vaddr"><tr><th>Network</th><th>Useable host range</th><th>Broadcast</th><th>Subnet mask</th></tr>${q.S.map((s,k)=>`<tr><td>${v(I.vnet[k])}</td><td>${key?`${v(I.vfirst[k])} – ${v(I.vlast[k])}`:''}</td><td>${v(I.vbc[k])}</td><td>${v(I.vmask[k])}</td></tr>`).join('')}<tr><td>${v(I.vnet[q.S.length])}</td><td></td><td></td><td></td></tr></table></section>`;
}
function buildPrintV(count,withKey,includeCurrent){
  const qs=[];if(includeCurrent&&state.q&&state.q.layout==='vlsm')qs.push(state.custom?genVlsm(state.custom):state.q);
  while(qs.length<count)qs.push(genVlsm());
  const sheet=`<div class="pp-title"><h2>VLSM assignment</h2><div>Name ______________________ &nbsp; Date ____________</div></div>
    <p class="pp-intro">Use variable length subnet masking to divide each /24 into subnets that fit the hosts required, biggest first, starting at the .0 network. For each subnet, find the smallest h where 2<sup>h</sup> − 2 covers the hosts, fill in the bit grid (1s for network bits on the left, 0s for host bits on the right), then add the place values under the 1s for the last octet of the mask. Each network is the previous network plus its block size (2<sup>h</sup>); the broadcast is one before the next network. The last row is the network after the final subnet.</p>
    ${qs.map((q,i)=>printVlsmHTML(q,i+1,false)).join('')}`;
  const key=withKey?`<div class="pp-key"><div class="pp-title"><h2>Answer key</h2></div>${qs.map((q,i)=>printVlsmHTML(q,i+1,true)).join('')}</div>`:'';
  $('#printArea').innerHTML=sheet+key;
}


/* ---------------- drills for the worksheet's extra skills ---------------- */
function genMaskBin(){
  const p=state.level==='core'?R(24,30):R(8,30),m=maskOf(p),asPrefix=Math.random()<.5;
  return {mode:'prefix',sub:'bin',title:'Mask → binary',prompt:`Write ${asPrefix?`<b class="big">/${p}</b>`:`<b class="big">${ipStr(m)}</b>`} as a 32-bit binary mask`,
    fields:[{type:'bin32',label:'Subnet mask (binary)',answer:bin32(m)}],diag:x=>[diagBin32(p,x[0])],
    hint:`${p} ones, then ${32-p} zeros, in four groups of 8.`,explain:explainMask(p),
    walk:()=>{const full=Math.floor(p/8),part=p%8,st=[{q:`/${p} has ${p} ones. How many full groups of eight 1s (11111111) is that?`,kind:'num',ans:full,bad:u=>u!=null&&u*8>p?`${u} × 8 is more than ${p}. Try fewer.`:`Try 1 × 8, 2 × 8, 3 × 8 … and stop before you pass ${p}.`}];
      if(part)st.push({q:`The leftover 1s (${p} − your groups × 8) start the next octet. Write that octet in binary: the leftover 1s, then 0s to make 8 digits.`,kind:'bits8',ans:bin8(oct(m,full)),bad:(u,raw)=>!isBits8(raw)?'Type 8 digits, each 0 or 1.':'Start with the leftover 1s on the left, then fill with 0s.'});
      st.push({q:`Write all 32 bits: your full groups of 1s${part?', your partial octet,':''} then 0s for the rest.`,kind:'bin32',ans:bin32(m),bad:(u,raw)=>hBin32(p,raw)});
      return st.concat({done:true,q:`That’s the binary mask.`});}};
}
function genRole(){
  const p=randPrefix(),m=maskOf(p),size=2**(32-p),role=pick(['network','host','broadcast']);
  const net=(randIP()&m)>>>0,ip=role==='network'?net:role==='broadcast'?(net+size-1)>>>0:(net+R(1,size-2))>>>0,asPrefix=Math.random()<.5;
  return {mode:'detective',sub:'role',title:'Network, host or broadcast?',
    prompt:`Is ${asPrefix?`<b class="big">${ipStr(ip)}/${p}</b>`:`<b class="big">${ipStr(ip)}</b> with mask <b>${ipStr(m)}</b>`} a network address, a usable host, or a broadcast address?`,
    fields:[{type:'choice',label:'The IP is a…',answer:role}],diag:x=>[diagRole(ip,p,role,x[0])],
    hint:'Find the IP’s block (network to broadcast). First address = network, last = broadcast, anything between = host.',explain:explainSubnet(ip,p),
    walk:()=>walkBlock(ip,p).concat({q:`Compare the IP with the network and broadcast you just found. Is it the <b>network</b> (first address), the <b>broadcast</b> (last), or a usable <b>host</b> (in between)?`,kind:'role',ans:role,bad:()=>'First address of the block = network, last = broadcast, anything in between = usable host.'},{done:true,q:`Pick your answer in the answer boxes.`})};
}
function genClassNets(){
  const t=pick(['A','A','B','C']),ip=t==='A'?parseIP(`10.${R(0,255)}.${R(0,255)}.${R(1,254)}`):t==='B'?parseIP(`172.${R(16,31)}.${R(0,255)}.${R(1,254)}`):parseIP(`192.168.${R(0,255)}.${R(1,254)}`);
  const c=classOf(ip),p=R(Math.max(c.d+1,24),30),n=p-c.d;
  return {mode:'formulas',sub:5,title:'Total networks (class default)',
    prompt:`For <b class="big">${ipStr(ip)}/${p}</b>, counting from the IP’s <u>class default</u> mask, how many networks (2ⁿ) are there?`,
    fields:[{type:'prefix',label:'Class default prefix',answer:c.d},{type:'numalt',label:'Total networks (2ⁿ)',answer:2**n,alt:[]}],
    diag:x=>[diagDefault(ip,x[0]),diagClassNets(ip,p,x[1],false)],
    hint:'Class A (1–126) → /8, B (128–191) → /16, C (192–223) → /24. n = prefix − default. Networks = 2ⁿ.',
    explain:`<p>First octet ${oct(ip,0)} → Class ${c.c} → default /${c.d}.</p><p>n = ${p} − ${c.d} = ${n} borrowed bits → 2<sup>${n}</sup> = <b class="g">${big(2**n)}</b> networks.</p>`,
    walk:()=>[{q:`First octet is <b>${oct(ip,0)}</b>. Class A is 1–126, B is 128–191, C is 192–223. Which class?`,kind:'cls',ans:c.c,bad:()=>`Find ${oct(ip,0)} in those three ranges.`},
      {f:0,q:`What is the default prefix for that class?`,kind:'prefix',ans:c.d,bad:()=>'Each class has its own default: A is /8, B is /16, C is /24.'},
      {q:`Borrowed bits n = ${p} − your default prefix = ?`,kind:'num',ans:n,bad:()=>`Subtract your default prefix from ${p}.`},
      {f:1,q:`Total networks = 2<sup>n</sup> = ? (you can type it as ${M('2^n')} with your n)`,kind:'pow',ans:2**n,bad:u=>u===2**n-2?'No − 2 for networks.':'Double 1, n times, or type 2^ and your n.'},
      {done:true,q:`Those are your two answers.`}]};
}

/* ---------------- weak spots ---------------- */
/* Every tagged mistake is logged. "w" is how weak the spot is right now (goes up on a miss, down when you get
   matching questions right); "n" is the lifetime count. The Weak spots tab serves questions for the heaviest spots. */
const WEAK={
  round_up:['Rounding up instead of down',[['detective'],['anding']]],
  wrong_block:['Picking the wrong subnet block',[['detective'],['anding']]],
  copied_ip:['Using the IP instead of its network',[['detective'],['anding']]],
  copy_octets:['Changing octets that should copy down',[['anding','','stretch'],['detective','','stretch']]],
  zero_octets:['Zeroing the octets after the interesting one',[['anding','','stretch'],['detective','','stretch']]],
  wrong_inc:['Finding the increment',[['detective'],['anding'],['formulas',4]]],
  or_and:['ANDing an octet',[['anding']]],
  swap:['Putting chart answers in the wrong box',[['detective']]],
  off_by_one:['Off by one on gateway, last usable or broadcast',[['detective']]],
  next_subnet:['Using the next subnet as the broadcast',[['detective']]],
  assume_255:['Assuming addresses end in .255 or .254',[['detective']]],
  fill_255:['Setting the broadcast’s trailing octets to 255',[['detective','','stretch']]],
  chart_misc:['Other subnet chart mistakes',[['detective']]],
  minus2:['Remembering the − 2 for usable hosts',[['formulas',0],['detective'],['formulas',2]]],
  host_bits:['Mixing up host bits and network bits',[['formulas',0],['formulas',2],['prefix','m2p']]],
  power:['2ⁿ (not 2 × n)',[['formulas',0],['formulas',1]]],
  host_formula:['Host formula (2ʰ − 2)',[['formulas',0]]],
  bin_order:['Binary place order (128 on the left)',[['binary','d2b'],['binary','b2d']]],
  bin_convert:['Decimal → binary',[['binary','d2b']]],
  bin_read:['Binary → decimal',[['binary','b2d']]],
  mask_build:['Writing a mask from a prefix',[['prefix','p2m'],['formulas',3]]],
  prefix_count:['Counting the prefix in a mask',[['prefix','m2p']]],
  nets_minus2:['Not subtracting 2 for networks',[['formulas',1]]],
  net_formula:['Network formula (2ⁿ)',[['formulas',1]]],
  prefix_grow:['Which way the prefix moves when borrowing',[['formulas',1],['formulas',3]]],
  size_hosts:['Picking a subnet size for a host count',[['formulas',2]]],
  size_nets:['Bits to borrow for a subnet count',[['formulas',3]]],
  mask_binary:['Writing the mask in binary',[['prefix','bin'],['worksheet']]],
  ip_role:['Network, host or broadcast?',[['detective','role'],['worksheet']]],
  class_nets:['Total networks from the class default',[['formulas',5],['worksheet']]],
  chart_rows:['Filling in the network chart rows',[['worksheet']]],
  vlsm_fit:['Picking the smallest block that fits (VLSM)',[['vlsm'],['formulas',6],['formulas',2]]],
  vlsm_mask:['Turning a VLSM grid row into a mask',[['vlsm'],['prefix','p2m']]],
  vlsm_block:['Stepping from one VLSM subnet to the next',[['vlsm']]],
  p2p_link:['Sizing a router-to-router link (/30)',[['formulas',6]]],
  plan_count:['Counting the subnets a network needs (router links too)',[['formulas',7]]],
  plan_fit:['Hosts per subnet versus hosts needed',[['formulas',7],['formulas',6]]],
  meet_both:['Picking the one mask that meets the hosts and the subnets',[['formulas',8]]],
};
try{localStorage.removeItem('ss_sheet');localStorage.removeItem('ss_nohelp');}catch(e){}
let weak={};{const raw=store.get('ss_weak',{});if(raw&&typeof raw==='object')for(const t of Object.keys(raw))if(Object.prototype.hasOwnProperty.call(WEAK,t)){const w=Number(raw[t]&&raw[t].w),n=Number(raw[t]&&raw[t].n);weak[t]={w:Number.isFinite(w)?Math.min(6,Math.max(0,w)):0,n:Number.isFinite(n)?Math.max(0,Math.floor(n)):0};}}
const saveWeak=()=>store.set('ss_weak',weak);
function noteMisses(tags){tags.forEach(t=>{if(!WEAK[t])return;const e=weak[t]||(weak[t]={w:0,n:0});e.w=Math.min(e.w+1,6);e.n++;});saveWeak();}
function noteRight(q){
  for(const [t,e] of Object.entries(weak)){if(!e.w||!WEAK[t])continue;
    const d=q.target===t?1:WEAK[t][1].some(g=>g[0]===q.mode&&(!g[1]&&g[1]!==0||g[1]===q.sub))?0.5:0;
    if(d)e.w=Math.max(0,Math.round((e.w-d)*10)/10);}
  saveWeak();}
function pickWeak(){const list=Object.entries(weak).filter(([t,e])=>e.w>0&&WEAK[t]);if(!list.length)return null;
  let r=Math.random()*list.reduce((a,[,e])=>a+e.w,0);for(const [t,e] of list){r-=e.w;if(r<=0)return t;}return list[list.length-1][0];}
function renderWeak(){
  const box=$('#weakbox');if(state.mode!=='weak'||state.timed){box.hidden=true;return;}box.hidden=false;
  const list=Object.entries(weak).filter(([t,e])=>e.w>0&&WEAK[t]).sort((a,b)=>b[1].w-a[1].w);
  const fixed=Object.entries(weak).filter(([t,e])=>!e.w&&e.n&&WEAK[t]).length;
  if(!list.length){box.innerHTML=`<div class="wk-h"><b>Your weak spots</b>${fixed?'<button class="btn small" id="weakReset">Reset</button>':''}</div><p class="dim">${fixed?`Nice: all ${fixed} of your logged weak spots are cleared. `:''}Every mistake you make in any mode gets logged here, and this tab drills the ones you miss most. Until there’s something to drill, you’ll get mixed questions.</p>`;}
  else box.innerHTML=`<div class="wk-h"><b>Your weak spots</b><button class="btn small" id="weakReset">Reset</button></div>`+list.slice(0,6).map(([t,e])=>
    `<div class="wk-row${state.q&&state.q.target===t?' now':''}"><span>${WEAK[t][0]}</span><span class="wk-bar"><i style="width:${Math.round(100*e.w/6)}%"></i></span><small>missed ${e.n}×</small></div>`).join('')+
    (list.length>6?`<p class="dim">+ ${list.length-6} more</p>`:'')+`<p class="dim">Questions are picked from your heaviest spots. Each one shrinks as you get matching questions right.</p>`;
  const r=$('#weakReset');if(r)r.onclick=()=>{weak={};saveWeak();renderWeak();};
}



/* ---------------- step-by-step walkthroughs for every question type ---------------- */
/* Each step: q (the prompt), kind, ans, bad(u,raw) → a nudge. Steps and nudges never state the answer the
   student is being asked for: they only restate numbers the student has already worked out in earlier steps,
   plus the rules (place values, class ranges, 256 − mask …). "Show me" is the only way to reveal a step. */
const isBits8=raw=>/^[01]{8}$/.test(String(raw).replace(/\s/g,''));
const bits8=raw=>String(raw).replace(/\s/g,'');
const pv8=b=>`<span class="mono pv8">${[...b].map((c,i)=>`<span class="pvb"><small>${placeVals[i]}</small>${c}</span>`).join('')}</span>`;
const IPFMT='Four numbers from 0 to 255, separated by dots.';
const hBits=(v,raw)=>{if(!isBits8(raw))return 'Type 8 digits, each 0 or 1.';const b=bits8(raw),u=parseInt(b,2);
  if([...b].reverse().join('')===bin8(v))return 'You wrote it backwards: the 128 bit goes on the left.';
  return `Your bits add up to ${u}, ${u>v?'more':'less'} than ${v}. Go place by place from 128: if the place value fits in what’s left, write 1 and subtract it; if not, write 0.`;};
const hDec=raw=>toNum(raw)==null?'Enter a whole number.':'Add up the place values (128, 64, 32 …) of each bit that’s 1.';
const hMask=(p,raw)=>{const u=parseIP(raw);if(u==null)return IPFMT;const q=maskPrefix(u);
  return q<0?'That isn’t a valid mask: it’s 255s, then one partial octet, then 0s.':`That’s a /${q} mask (${q} ones). You need ${p} ones.`;};
const hBin32=(p,raw)=>{const s=String(raw).replace(/[.\s]/g,'');if(!/^[01]+$/.test(s))return 'Use only 1s and 0s (dots between octets are optional).';
  if(s.length!==32)return `That’s ${s.length} bits. A mask is 32 bits: four groups of 8.`;if(!/^1*0*$/.test(s))return 'A mask is all 1s first, then all 0s: no 1 after a 0.';
  const q=s.indexOf('0')<0?32:s.indexOf('0');return `You have ${q} ones; /${p} needs ${p}.`;};
const hHosts=(h,u)=>u===2**h?'Now subtract 2: the network and broadcast addresses can’t be used.':u===2*h?`2<sup>${h}</sup> means doubling ${h} times, not 2 × ${h}.`:`Work out 2<sup>${h}</sup> (double 1, ${h} times: 2, 4, 8 …), then subtract 2.`;
function hNet(ip,p,io,u,raw){
  if(u==null)return IPFMT;
  for(let j=0;j<io;j++)if(oct(u,j)!==oct(ip,j))return `Octet ${j+1} copies straight down from the IP.`;
  for(let j=io+1;j<4;j++)if(oct(u,j)!==0)return `Every octet after octet ${io+1} is 0 in the network address.`;
  return `Octet ${io+1} should be the round-down value you found in the step before.`;
}
function hBc(ip,io,next,u){
  if(u==null)return IPFMT;
  if(u===next)return 'That’s the next subnet itself. Go back one address.';
  for(let j=0;j<io;j++)if(oct(u,j)!==oct(ip,j))return `Octet ${j+1} copies straight down from the IP.`;
  for(let j=io+1;j<4;j++)if(oct(u,j)!==255)return `Every octet after octet ${io+1} is 255 in a broadcast.`;
  return `Octet ${io+1} is one less than the next subnet’s value from the step before.`;
}
function interestingStep(m,io){
  return {q:`The mask is ${M(ipStr(m))}. Which octet is the <b>interesting</b> one, the first from the left that isn’t 255? (1–4)`,kind:'num',ans:io+1,
    bad:u=>u==null||u<1||u>4?'Enter a number from 1 to 4.':oct(m,u-1)===255?`Octet ${u} is 255: all network bits, so it just copies down. Keep moving right.`:`Octet ${u} isn’t the <i>first</i> one below 255. Read the mask from the left.`};
}
const maskValStep=(m,io)=>({q:`What is the mask’s value in octet ${io+1}?`,kind:'num',ans:oct(m,io),bad:()=>`Read octet ${io+1} of ${M(ipStr(m))}, counting from the left.`});
const incStep=mv=>({q:`Increment = 256 − ${mv} = ?`,kind:'num',ans:256-mv,bad:u=>u===255-mv?'Use 256, not 255.':u===mv?'That’s the mask value. Subtract it from 256.':`256 minus ${mv}.`});
function walkD2B(v){
  const st=[];let rem=v;
  placeVals.forEach((pv,k)=>{const fits=rem>=pv,r=rem;
    st.push({q:`${k===0?`Start with ${v}. `:''}You have <b>${r}</b> left. Does ${pv} fit (is ${r} ≥ ${pv})? Type <b>1</b> for yes or <b>0</b> for no.`,kind:'num',ans:fits?1:0,show:fits?`1 → ${r} − ${pv} = ${r-pv} left`:'0',
      bad:u=>u!==0&&u!==1?'Type 1 or 0.':`Compare the two numbers: is ${r} at least ${pv}? If it is, the bit is 1 and you subtract; if not, it’s 0.`});
    if(fits)rem-=pv;});
  st.push({q:`Now write all 8 bits, reading your 1s and 0s from the top step down.`,kind:'bits8',ans:bin8(v),f:0,bad:(u,raw)=>!isBits8(raw)?'Type 8 digits, each 0 or 1.':'Read your answers from the first step (the 128 bit) to the last (the 1 bit).'});
  return st;
}
function walkB2D(v){
  const b=bin8(v),ones=placeVals.filter((pv,k)=>b[k]==='1');
  const st=[{q:`Write the place values over the bits:<br>${pv8(b)}<br>How many bits are <b>1</b>?`,kind:'num',ans:ones.length,bad:()=>'Count the 1s.'}];
  let tot=0;ones.forEach((pv,i)=>{const prev=tot;tot+=pv;
    st.push({q:i===0?`Look at the leftmost 1. What is its place value? That’s where your running total starts.`:`Now the next 1 to the right. Add its place value to your running total (${prev}). New total?`,kind:'num',ans:tot,
      bad:u=>i===0?'Read the small number above that 1.':u===prev?'You still need to add this bit’s place value.':'Add the place value above this 1 to your running total.'});});
  if(!ones.length)st.push({q:'No bits are 1. So what is the value?',kind:'num',ans:0,bad:()=>'Nothing to add up.'});
  return st.concat({done:true,q:`That last total is the decimal value.`});
}
function walkP2M(p){
  const full=Math.floor(p/8),part=p%8,m=maskOf(p),mv=part?oct(m,full):0;
  const st=[{q:`/${p} means ${p} ones in a row, and each full octet holds 8. How many <b>full octets</b> of 255 is that?`,kind:'num',ans:full,
    bad:u=>u!=null&&u*8>p?`${u} × 8 is more than ${p}. Try fewer.`:`Try 1 × 8, 2 × 8, 3 × 8 … and stop before you pass ${p}.`}];
  if(full<4)st.push({q:`How many ones are <b>left over</b> after those full octets? (${p} − your full octets × 8)`,kind:'num',ans:part,bad:()=>`Multiply your full octets by 8 and subtract that from ${p}.`});
  if(part)st.push({q:`The next octet gets those leftover ones from the left. Add up that many place values, starting at 128 (128, 64, 32 …). Total?`,kind:'num',ans:mv,
    bad:u=>part>1&&u===placeVals[part-1]?`That’s only the last one. Add all of them, starting from 128.`:`Add the first ${part} place value${part>1?'s':''}, starting at 128.`});
  st.push({q:`Write the mask: your full octets as 255, then${part?' the value you just added up, then':''} 0 for the rest.`,kind:'ip',ans:m,bad:(u,raw)=>hMask(p,raw)});
  return st.concat({done:true,q:`That’s the mask.`});
}
function walkM2P(p){
  const full=Math.floor(p/8),part=p%8,m=maskOf(p),mv=part?oct(m,full):0;
  const st=[{q:`The mask is ${M(ipStr(m))}. How many octets are <b>255</b>?`,kind:'num',ans:full,bad:()=>'Count the octets that are exactly 255.'},
    {q:`Each 255 is 8 ones. How many ones is that in total?`,kind:'num',ans:full*8,bad:()=>'Multiply your count of 255s by 8.'}];
  if(part){st.push({q:`The next octet is <b>${mv}</b>. Write it in binary (8 digits).`,kind:'bits8',ans:bin8(mv),bad:(u,raw)=>hBits(mv,raw)});
    st.push({q:`How many 1s are in the binary you just wrote?`,kind:'num',ans:part,bad:()=>'Count the 1s in your binary.'});}
  st.push({q:`Add the ones from the 255s${part?' and the ones in the partial octet':''}. Prefix = ?`,kind:'prefix',ans:p,bad:()=>part?'Add your two counts together.':'That’s your total from the 255s.'});
  return st.concat({done:true,q:`That’s the prefix.`});
}
function walkAnd(ip,p){
  const m=maskOf(p),io=p%8===0?p/8:Math.floor((p-1)/8),k=io+1,mv=oct(m,io),ipo=oct(ip,io),neto=ipo&mv,net=(ip&m)>>>0;
  const st=[interestingStep(m,io),maskValStep(m,io)];
  if(mv===0)st.push({q:`Anything ANDed with 0 is 0. So what is octet ${k} of the network?`,kind:'num',ans:0,bad:()=>'Anything AND 0 = 0.'});
  else{
    st.push({q:`Write the IP’s octet ${k} (<b>${ipo}</b>) in binary.`,kind:'bits8',ans:bin8(ipo),bad:(u,raw)=>hBits(ipo,raw)});
    st.push({q:`Write the mask’s octet (<b>${mv}</b>) in binary.`,kind:'bits8',ans:bin8(mv),bad:(u,raw)=>hBits(mv,raw)});
    st.push({q:`AND your two binary numbers bit by bit: a column is 1 only where <i>both</i> are 1.`,kind:'bits8',ans:bin8(neto),
      bad:(u,raw)=>!isBits8(raw)?'Type 8 digits, each 0 or 1.':bits8(raw)===bin8(ipo|mv)&&(ipo|mv)!==neto?'That’s OR (1 where <i>either</i> is 1). AND needs both.':'Go column by column: 1 only if the IP bit and the mask bit are both 1.'});
    st.push({q:`Convert your AND result to decimal.`,kind:'num',ans:neto,bad:(u,raw)=>hDec(raw)});
  }
  st.push({q:`Write the network address: copy the octets before ${k} from the IP, use your result for octet ${k}${io<3?', and 0 for every octet after it':''}.`,kind:'ip',ans:net,
    bad:(u,raw)=>hNet(ip,p,io,u,raw)});
  return st.concat({done:true,q:`That’s the network address.`});
}
function walkHosts(p){const h=32-p;
  return [{q:`Host bits h = 32 − ${p} = ?`,kind:'num',ans:h,bad:u=>u===p?'That’s the network bits. Subtract the prefix from 32.':`Subtract ${p} from 32.`},
    {q:`2<sup>h</sup> = ? (double 1, h times)`,kind:'num',ans:2**h,bad:u=>u===2*h?`That’s 2 × h. 2<sup>h</sup> means doubling: 2, 4, 8 …`:'Double 1 once for each host bit: 2, 4, 8 …'},
    {q:`Take away the network address and the broadcast: subtract 2.`,kind:'num',ans:2**h-2,bad:()=>'Your 2<sup>h</sup> minus 2.'},
    {done:true,q:`That’s the usable hosts.`}];}
function walkNets(base,n){
  return [{f:0,q:`Networks = 2<sup>n</sup>, where n is the bits you borrowed (${n}). 2<sup>${n}</sup> = ?`,kind:'num',ans:2**n,bad:u=>u===2**n-2?'No − 2 for networks.':u===2*n&&n!==2?`That’s 2 × ${n}. 2<sup>${n}</sup> means doubling.`:`Double 1, ${n} time${n>1?'s':''}: 2, 4, 8 …`},
    {f:1,q:`The borrowed bits join the network side, so the prefix grows. New prefix = ?`,kind:'prefix',ans:base+n,bad:u=>u===base-n?'It grows, it doesn’t shrink.':`Add the ${n} borrowed bits to /${base}.`},
    {done:true,q:`Those are your two answers.`}];}
function walkSizeHosts(H,h,p){
  return [{q:`You need ${H} hosts. Find the smallest number of host bits h where 2<sup>h</sup> − 2 is at least ${H}. Try h = 1, 2, 3 … What’s the smallest h that works?`,kind:'num',ans:h,
      bad:u=>u==null||u<1?'Enter a number of bits.':u<h?`2<sup>${u}</sup> − 2 = ${2**u-2}, not enough for ${H}. Try more bits.`:`That works, but a smaller h might too. Try one less.`},
    {q:`Prefix = 32 − h = ?`,kind:'prefix',ans:p,bad:u=>u===h?'That’s the host bits. Prefix = 32 − h.':'Subtract your h from 32.'},
    {done:true,q:`That’s the smallest subnet.`}];
}
function walkSizeNets(N,n,base){const p=base+n;
  return [{f:0,q:`You need ${N} subnets. Find the smallest number of borrowed bits n where 2<sup>n</sup> is at least ${N}. Try n = 1, 2, 3 … Smallest n?`,kind:'num',ans:n,
      bad:u=>u==null||u<1?'Enter a number of bits.':u===2**n?'That’s how many subnets you’d get. The answer is the exponent, n.':u<n?`2<sup>${u}</sup> = ${2**u}, fewer than ${N}. Try more bits.`:`That works, but fewer bits might too. Try one less.`},
    {q:`New prefix = /${base} + your n = ?`,kind:'prefix',ans:p,bad:()=>`Add your n to ${base}.`},
    {f:1,q:`Write the mask for your new prefix.`,kind:'ip',ans:maskOf(p),bad:(u,raw)=>hMask(p,raw)},
    {done:true,q:`Those are your two answers.`}];}
function walkInc(p){const m=maskOf(p),io=Math.floor((p-1)/8),mv=oct(m,io);
  return [interestingStep(m,io),maskValStep(m,io),incStep(mv),{done:true,q:`That’s the increment.`}];}

/* the first part of the subnet chart method, shared by the chart, the role drill and the worksheet */
function walkBlock(ip,p){
  const m=maskOf(p),io=p%8===0?p/8:Math.floor((p-1)/8),k=io+1,mv=oct(m,io),inc=256-mv,ipo=oct(ip,io),neto=ipo-ipo%inc;
  const net=(ip&m)>>>0,size=2**(32-p),bc=(net+size-1)>>>0,next=(net+size)>>>0;
  return [interestingStep(m,io),maskValStep(m,io),incStep(mv),
    {q:`The IP’s octet ${k} is <b>${ipo}</b>. In that octet, subnets start at 0 and go up by your increment. Which start does ${ipo} round <b>down</b> to?`,kind:'num',ans:neto,
     bad:u=>u==null?'Enter a number.':u%inc?`That isn’t a multiple of the increment (${inc}).`:u>ipo?'Too high: always round down, never up.':`That block ends before ${ipo} (it’s only ${inc} wide). Keep counting up by ${inc}.`},
    {q:`Write the <b>network address</b>: copy the octets before ${k}, use your round-down value for octet ${k}${io<3?', and 0 for every octet after it':''}.`,kind:'ip',ans:net,bad:(u,raw)=>hNet(ip,p,io,u,raw)},
    {q:`The next subnet starts one increment later. What is octet ${k} of the next subnet? (256 means it rolls over into the octet before)`,kind:'num',ans:neto+inc,bad:()=>'Add the increment to your round-down value.'},
    {q:`The <b>broadcast</b> is the last address before the next subnet. Write the broadcast address.`,kind:'ip',ans:bc,bad:(u,raw)=>hBc(ip,io,next,u)}];
}

function walkSteps(ip,p){
  const h=32-p,m=maskOf(p),net=(ip&m)>>>0,bc=(net+2**(32-p)-1)>>>0,b=walkBlock(ip,p);
  b[4]={...b[4],f:0};b[6]={...b[6],f:1};
  return b.concat([
    {q:`The default gateway is the first usable address: your network + 1. Write it.`,kind:'ip',ans:(net+1)>>>0,f:2,bad:u=>u==null?IPFMT:u===net?'That’s the network itself. Add 1.':'Add 1 to your network address.'},
    {q:`The last usable address is your broadcast − 1. Write it.`,kind:'ip',ans:(bc-1)>>>0,f:3,bad:u=>u==null?IPFMT:u===bc?'That’s the broadcast. Subtract 1.':'Subtract 1 from your broadcast address.'},
    {q:`Host bits h = 32 − ${p} = ?`,kind:'num',ans:h,bad:()=>`Subtract ${p} from 32.`},
    {q:`Usable hosts = 2<sup>h</sup> − 2 = ?`,kind:'num',ans:2**h-2,f:4,bad:u=>hHosts(h,u)}]);
}
function startWalk(q){
  const st=q.walk().filter(x=>!x.done);
  if(!st.some(x=>x.f!=null))st[st.length-1]={...st[st.length-1],f:0};
  return {steps:st,i:0,msg:'',filled:{}};
}
function fillField(i,ans){
  const f=state.q.fields[i],el=$(`.field[data-i="${i}"]`);if(!el)return;
  if(f.type==='choice'){el.querySelectorAll('.choice').forEach(b=>b.classList.toggle('on',b.dataset.v===ans));return;}
  if(f.type==='bits'){[...String(ans)].forEach((c,k)=>{const b=el.querySelector(`.bit[data-k="${k}"]`);if(b){b.classList.toggle('on',c==='1');b.textContent=c;}});return;}
  el.querySelector('input').value=f.pre?(f.type==='bin32'?String(ans).split('.').pop():String(oct(ans,3))):f.type==='ip'?ipStr(ans):f.type==='prefix'?'/'+ans:String(ans);
}
const fieldShow=(f,ans)=>f.type==='ip'?ipStr(ans):f.type==='prefix'?'/'+ans:f.type==='choice'?ROLES[ans]:typeof ans==='number'?big(ans):String(ans);
function mirrorHTML(q,w,cur){
  const cell=i=>{const f=q.fields[i],v=w.filled[i];
    const txt=v==null?(i===cur?'?':''):(f.cell||(f.pre&&f.type==='ip')?'.'+oct(v,3):f.type==='bin32'?String(v).replace(/\./g,'.<wbr>'):fieldShow(f,v));
    return `<span class="mv${i===cur?' cur':''}${v!=null?' done':''}">${txt}</span>`;};
  const row=i=>`<div class="mrow${i===cur?' cur':''}"><span class="ml">${q.fields[i].label}</span>${cell(i)}</div>`;
  if(q.layout==='vlsm')return mirrorV(q,cell);
  if(q.layout!=='sheet')return `<div class="mir">${q.fields.map((f,i)=>row(i)).join('')}</div>`;
  const pre=[],post=[],byRow={};
  q.fields.forEach((f,i)=>{if(f.cell)(byRow[f.cell.r]=byRow[f.cell.r]||[])[f.cell.c]=i;else(f.sec==='pre'?pre:post).push(i);});
  return `<div class="mir">${pre.map(row).join('')}
    <table class="mchart"><tr><th></th><th><span class="lg">Network</span><span class="sm">Net</span></th><th colspan="3"><span class="lg">Useable host range</span><span class="sm">Usable</span></th><th><span class="lg">Broadcast</span><span class="sm">Bcast</span></th></tr>${Object.keys(byRow).map(r=>{const x=byRow[r];
      return `<tr><td class="ml">Row ${Number(r)+1}</td><td>${cell(x[0])}</td><td>${cell(x[1])}</td><td class="dim">–</td><td>${cell(x[2])}</td><td>${cell(x[3])}</td></tr>`;}).join('')}</table>
    <div class="dim msub">Chart shows the last octet of each address.</div>${post.map(row).join('')}</div>`;
}

/* A shortcut for the step you're on (not the whole question). A tip is only shown if it doesn't contain
   the answer to that step. */
const PLACE='Place values: <span class="mono">128 64 32 16 8 4 2 1</span>. Going left to right: if it fits in what’s left, write 1 and subtract; if not, write 0.';
function tipFor(st,q){
  const t=st.q,k=st.kind;let tip='';
  const ADD='Add up the place values (<span class="mono">128 64 32 16 8 4 2 1</span>) that sit above each 1.';
  const MASKOCT='A mask octet is always some 1s followed by 0s, never mixed, so you only need to know how many 1s. Each step up the mask ladder (128 → 192 → 224 …) adds one more 1.';
  if('tip' in st)tip=st.tip||'';
  else if(/AND them|AND your two/.test(t))tip='Shortcut for ANDing with a mask: wherever the mask has a 1, copy the IP’s bit; wherever it has a 0, write 0.';
  else if(k==='bits8')tip=/^1*0*$/.test(st.ans)&&/mask|leftover|next octet/i.test(t)?MASKOCT:PLACE;
  else if(k==='bin32')tip='255 is always <span class="mono">11111111</span>, so full octets are easy. The total number of 1s in the whole mask is the prefix.';
  else if(k==='role')tip='A multiple of the increment is a <b>network</b>. One less than a multiple is a <b>broadcast</b>. Anything else is a <b>host</b>.';
  else if(k==='cls')tip='A is 1–126. B starts at <b>128</b> and C starts at <b>192</b>, the first two steps of the mask ladder.';
  else if(k==='pow')tip='Anchor: 2<sup>10</sup> = 1,024. Every 10 more bits multiplies by 1,024 again, or just type it as 2^n.';
  else if(/Borrowed bits n/.test(t))tip='n is only the bits <i>past</i> the class default: prefix − default.';
  else if(/default prefix/.test(t))tip='Each class adds one more octet of 255: A has one, B has two, C has three. Each octet is 8 bits.';
  else if(/Convert your AND result|in decimal|running total|leftmost|How many bits are|No bits are/.test(t))tip=ADD;
  else if(/How many 1s are in the binary/.test(t))tip='Mask octets are 1s then 0s, so count from the left until the first 0.';
  else if(/left over<\/b> after those full octets/.test(t))tip='It’s the remainder when you divide the prefix by 8.';
  else if(/How many <b>full octets|full groups of eight/.test(t))tip='Every 8 ones fills one octet with 255.';
  else if(/interesting/.test(t))tip='It’s the first octet from the left that isn’t 255. Octets before it are 255 and octets after it are 0.';
  else if(/Increment = 256/.test(t))tip='The increment is also the place value of the last 1 bit in the mask. Starting from /25 = 128, it halves for every extra bit.';
  else if(/round <b>down<\/b>/.test(t))tip='Networks always land on multiples of the increment. Round down to one, never up.';
  else if(/next subnet starts one increment later/.test(t))tip='Just add the increment.';
  else if(/How many 1s go in the 4th octet/.test(t))tip='Everything past /24 lives in the 4th octet, so it’s the prefix minus 24.';
  else if(/place value/.test(t)&&k==='num')tip='These sums are the mask ladder: each extra 1 adds the next place value (64, then 32, then 16 …). After a few problems you’ll know them by heart.';
  else if(/Prefix = 32 − h/.test(t))tip='Prefix + host bits always add up to 32.';
  else if(/Count the 1s|Add the ones from the 255s/.test(t))tip='Each 255 is 8 ones. Prefix = 8 for every 255, plus the 1s in the partial octet.';
  else if(/Host bits h/.test(t))tip='h is the number of 0s in the mask: 32 − the prefix.';
  else if(/2<sup>h<\/sup> − 2|Usable hosts|Hosts per network/.test(t))tip=q.layout==='sheet'||/\/(2[5-9]|30)\b/.test(q.prompt)?'When the mask ends in the 4th octet, hosts = <b>increment − 2</b>. Good way to double-check.':'Powers of 2: 2, 4, 8, 16, 32, 64, 128, 256, 512, 1,024.';
  else if(/2<sup>h<\/sup> = \?/.test(t))tip='Powers of 2: 2, 4, 8, 16, 32, 64, 128, 256, 512, 1,024.';
  else if(/subtract 2/i.test(t))tip='The network and broadcast addresses can never be used by a host.';
  else if(/2<sup>n<\/sup>|smallest number of/.test(t))tip='Doubling list: 2, 4, 8, 16, 32, 64, 128 … the position in the list is the number of bits.';
  else if(/first usable|gateway/i.test(t))tip='First usable (the gateway) = network <b>+ 1</b>.';
  else if(/last usable/i.test(t))tip='Last usable = broadcast <b>− 1</b>.';
  else if(/broadcast/i.test(t)&&k==='ip')tip='Broadcast = next network <b>− 1</b>. It’s always one less than a multiple of the increment.';
  else if(q.mode==='anding'&&k==='ip')tip='Under a 255 the IP octet copies straight down; under a 0 it becomes 0. Only the interesting octet needs the AND.';
  else if(/row’s network|row 1’s network|network address/i.test(t)&&k==='ip')tip='Networks are always multiples of the increment. Octets before the interesting one copy from the IP; octets after it are 0.';
  else if(/mask/i.test(t)&&k==='ip')tip='Full octets are 255, then the partial octet, then 0s.';
  else if(/New prefix|prefix grows/.test(t))tip='Borrowed bits always add to the prefix.';
  else if(/Does \d+ fit/.test(t))tip=PLACE;
  if(!tip)return '';
  const plain=String(tip).replace(/<[^>]+>/g,' ');
  const ans=k==='ip'?[ipStr(st.ans)]:k==='prefix'?['/'+st.ans]:typeof st.ans==='number'&&st.ans>=10?[String(st.ans),st.ans.toLocaleString()]:k==='bits8'||k==='bin32'?[String(st.ans)]:[];
  if(ans.some(a=>new RegExp('(^|[^0-9./])'+a.replace(/[.^$*+?()[\]{}|\\]/g,'\\$&')+'(?![0-9]|\\.[0-9])').test(plain)))return '';
  return tip;
}
function setWalkView(on){
  state.walkView=on&&!!state.walk;const v=state.walkView;
  $('#fields').hidden=v;$('#checkBtn').hidden=v;$('#walk').hidden=!v;
  $('#hintBtn').textContent=state.walk?(v?'← Back to the answer boxes':'Show my steps'):'Hint: step by step (½ points)';
  if(v){renderWalk();focusWalk();}
}
function renderWalk(){
  const w=state.walk,box=$('#walk');if(!w){box.hidden=true;box.innerHTML='';return;}box.hidden=!state.walkView;
  const q=state.q,shown=(v,k)=>k==='role'?ROLES[v]:k==='cls'?'Class '+v:typeof v==='number'&&v>255?v.toLocaleString():v;
  const total=w.steps.filter(x=>x.f!=null).length,doneN=w.steps.slice(0,w.i).filter(x=>x.f!=null).length;
  let s0=w.i;while(s0>0&&w.steps[s0-1].f==null)s0--;
  let e=w.i;while(e<w.steps.length&&w.steps[e].f==null)e++;
  const cur=w.i<w.steps.length?w.steps[e].f:-1;
  let body;
  if(cur<0)body=`<div class="wq-done">All ${total} answer${total>1?'s are':' is'} filled in from your steps.<div class="wrow"><button class="btn small primary" id="wcheck">Check my answers</button></div></div>`;
  else body=`<div class="wq"><div class="wq-h"><small>Question ${doneN+1} of ${total}</small><b>${q.fields[cur].label}</b></div><ol>`+w.steps.slice(s0,w.i+1).map((st,n)=>{
      if(s0+n<w.i)return `<li class="wok"><span>${st.q}</span><b class="g mono wans">✓ ${st.show||(st.kind==='ip'?ipStr(st.ans):st.kind==='prefix'?'/'+st.ans:shown(st.ans,st.kind))}</b></li>`;
      return `<li class="wcur${st.f!=null?' wfinal':''}"><span>${st.q}</span><div class="wrow"> <input id="winp" class="winp${st.kind==='bin32'?' wide':''}" autocomplete="off" spellcheck="false" inputmode="${['role','cls'].includes(st.kind)?'text':st.kind==='ip'||st.kind==='bin32'?'decimal':st.kind==='pow'?'text':'numeric'}" placeholder="${{ip:'e.g. 192.168.4.0',prefix:'e.g. /26',bits8:'8 digits, e.g. 01000000',bin32:'32 bits, dots optional',role:'network, host or broadcast',cls:'A, B or C',pow:'number or 2^n'}[st.kind]||'number'}"><button class="btn small primary" id="wchk">${st.f!=null?'Answer':'Check step'}</button><button class="btn small" id="wshow">Show me</button></div><div class="wmsg" id="wmsg">${w.msg||''}</div></li>`;
    }).join('')+`</ol>${tipFor(w.steps[w.i],q)?`<div class="wshort"><b>⚡ Shortcut</b> ${tipFor(w.steps[w.i],q)}</div>`:''}</div>`;
  box.innerHTML=`<div class="wk-title">Step by step <small>· counts as a hint (½ points)</small></div>${mirrorHTML(q,w,cur)}${body}
    <div class="wtip">💡 ${q.hint} <button class="btn small" id="hintGuide">Open the guide →</button></div>`;
  const hg=$('#hintGuide');if(hg)hg.onclick=()=>openTool('guide',GUIDE_FOR[q.mode]);
  const wc=$('#wcheck');if(wc)wc.onclick=()=>{setWalkView(false);check();};
  const inp=$('#winp');if(!inp)return;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();walkCheck();}});
  $('#wchk').onclick=walkCheck;$('#wshow').onclick=()=>walkAdvance();
}
function walkAdvance(){
  const w=state.walk,st=w.steps[w.i];
  if(st.f!=null){fillField(st.f,st.ans);w.filled[st.f]=st.ans;}
  w.i++;w.msg='';renderWalk();focusWalk();
}
function studyScrollBehavior(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';}
function focusWalk(){const i=$('#winp')||$('#wcheck');if(i){if(isDesktop())i.focus();i.scrollIntoView({block:'nearest',behavior:studyScrollBehavior()});}}
function walkCheck(){
  const w=state.walk,st=w.steps[w.i],raw=$('#winp').value;
  const u=parseStep(st,raw);
  if(u===st.ans){walkAdvance();return;}
  w.msg=isBlank(raw)?'Type an answer, or press “Show me”.':st.bad(u,raw);renderWalk();
  const i=$('#winp');i.value=raw;i.classList.add('shake');focusWalk();
}


/* ---------------- one question at a time ("flow") ----------------
   Multi-part questions are asked one box at a time in the order you'd work them out. Each answer is checked on
   the spot: right answers drop into the growing answer sheet above, a wrong try gets a nudge (the answer itself is
   hidden until you ask for it), and Hint walks through just the current box. The finished sheet is scored like
   a normal check, counting what you got right on the first try. */
let layoutPref=store.get('ss_layout','flow');if(layoutPref!=='flow'&&layoutPref!=='sheet')layoutPref='flow';
// a link can choose the layout: ?layout=sheet or ?layout=flow (remembered from then on)
try{const lp=new URLSearchParams(location.search).get('layout');if(lp==='flow'||lp==='sheet'){layoutPref=lp;store.set('ss_layout',lp);}}catch(e){}
const flowOn=q=>(layoutPref==='flow'||q.flowOnly)&&q.fields.length>1&&!state.timed;
const SECNAME={pre:'From the mask',post:'The given IP',end:'Total networks'};
function groupSteps(steps,n){const g=[...Array(n)].map(()=>[]);let cur=[];steps.forEach(st=>{cur.push(st);if(st.f!=null){g[st.f]=cur;cur=[];}});return g;}
function parseStep(st,raw){
  if((st.kind==='ip'||st.kind==='bin32')&&st.f!=null&&state.q)raw=expandCell(state.q.fields[st.f],raw);
  return st.kind==='ip'?parseIP(raw):st.kind==='prefix'?toPre(raw):st.kind==='bits8'?(isBits8(raw)?bits8(raw):null):st.kind==='bin32'?bits32(raw)
    :st.kind==='role'?toRole(raw):st.kind==='cls'?(/^\s*(class\s*)?[abc]\s*$/i.test(raw)?raw.trim().slice(-1).toUpperCase():null):st.kind==='pow'?pow2(raw):toNum(raw);
}
function startFlow(){
  const q=state.q;syncLayoutSeg();
  if(!flowOn(q)){state.flow=null;$('#flow').hidden=true;$('#flow').innerHTML='';$('#fields').hidden=false;$('#checkBtn').hidden=false;$('#hintBtn').hidden=false;return;}
  state.flow={k:0,miss:{},firstVal:{},firstMsg:{},hinted:{},groups:q.walk?groupSteps(startWalk(q).steps,q.fields.length):null,step:null,msg:'',justDone:null};
  $('#fields').hidden=true;$('#flow').hidden=false;$('#checkBtn').hidden=true;$('#hintBtn').hidden=true;
  renderFlow();focusFlow();
}
const ipCell=v=>`<span class="ipf">${ipStr(v)}</span><span class="ips">.${oct(v,3)}</span>`;
function flowSheet(q,F,cur){
  if(q.layout==='vlsm')return flowSheetV(q,F,cur);
  const n=q.fields.length,end=cur<0?n:cur;
  const val=i=>{const f=q.fields[i];return f.cell?ipCell(f.answer):f.type==='bin32'?String(f.answer).replace(/\./g,'.<wbr>'):fieldShow(f,f.answer);};
  const mark=i=>F.miss[i]?'<span class="fs-x" title="Missed on the first try">✗</span>':F.hinted[i]?'<span class="fs-h" title="Answered with the hint">💡</span>':'<span class="fs-c">✓</span>';
  const row=i=>`<div class="fs-row${F.miss[i]?' miss':''}${i===F.justDone?' pop':''}"><span class="fs-l">${q.fields[i].label}</span><span class="fs-vm"><span class="fs-v mono">${val(i)}</span>${mark(i)}</span></div>`;
  if(q.layout!=='sheet'){const done=[...Array(end).keys()];return done.length?`<div class="fsheet">${done.map(row).join('')}</div>`:'';}
  const parts=[];let lastSec=null,chartDone=false;
  for(let i=0;i<n;i++){const f=q.fields[i];
    if(f.cell){if(chartDone)continue;chartDone=true;
      const rows={};q.fields.forEach((g,j)=>{if(g.cell)(rows[g.cell.r]=rows[g.cell.r]||{})[g.cell.c]=j;});
      const first=Math.min(...Object.values(rows).flatMap(o=>Object.values(o)));
      if(first>=end&&first!==cur)continue;
      const cellHTML=j=>j<end?`<span class="fs-cv${F.miss[j]?' miss':''}${j===F.justDone?' pop':''}">${ipCell(q.fields[j].answer)}</span>`:j===cur?'<span class="fs-cur">?</span>':'';
      const trs=Object.keys(rows).filter(r=>Math.min(...Object.values(rows[r]))<=Math.max(end,cur)).map(r=>{const o=rows[r];
        return `<tr><td class="fs-rl">Row ${Number(r)+1}</td><td>${cellHTML(o[0])}</td><td>${cellHTML(o[1])}<span class="dim"> – </span>${cellHTML(o[2])}</td><td>${cellHTML(o[3])}</td></tr>`;}).join('');
      parts.push(`<div class="fs-sec">Network chart</div><table class="fs-chart"><tr><th></th><th><span class="lg">Network</span><span class="sm">Net</span></th><th><span class="lg">Useable host range</span><span class="sm">Usable</span></th><th><span class="lg">Broadcast</span><span class="sm">Bcast</span></th></tr>${trs}</table>`);
      continue;}
    if(i>=end)continue;
    if(f.sec&&f.sec!==lastSec){parts.push(`<div class="fs-sec">${SECNAME[f.sec]}</div>`);lastSec=f.sec;}
    parts.push(row(i));
  }
  return parts.length?`<div class="fsheet">${parts.join('')}</div>`:'';
}
function flowInput(f){
  if(f.type==='bits')return `<div class="fc-row"><input id="fin" class="oct bits8" aria-label="${f.label}: 8 bits" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric" enterkeyhint="go" placeholder="8 bits" maxlength="9"><button class="btn primary" id="fok">Check</button></div><div class="dim fc-note">1s on the left for network bits, 0s on the right for host bits.</div>`;
  if(f.pre)return `<div class="fc-row${f.type==='bin32'?' long':''}"><span class="fc-pre mono" aria-hidden="true">${f.pre}</span><input id="fin" class="oct" aria-label="${f.label}: last ${f.type==='bin32'?'8 bits':'octet'}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric" enterkeyhint="go" placeholder="${f.type==='bin32'?'8 bits':'octet'}"><button class="btn primary" id="fok">Check</button></div>`;
  if(f.type==='choice')return `<div class="choices fc-choices">${Object.entries(ROLES).map(([k,v])=>`<button type="button" class="choice" data-v="${k}">${v}</button>`).join('')}</div>`;
  const ph=f.type==='ip'?'e.g. 192.168.4.0':f.type==='prefix'?'/26':f.type==='bin32'?'32 ones and zeros (dots optional)':f.type==='numalt'?'number or 2^n':'number';
  const im=f.type==='ip'||f.type==='bin32'?'decimal':f.type==='num'?'numeric':'text';
  return `<div class="fc-row"><input id="fin" class="${f.type==='bin32'?'wide':''}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="${im}" enterkeyhint="go" placeholder="${ph}"><button class="btn primary" id="fok">Check</button></div>`;
}
function flowSteps(q,F,i){
  const S=F.step,g=F.groups[i];if(!S||S.i!==i||!g)return '';
  const shown=(st)=>st.show||(st.kind==='ip'?ipStr(st.ans):st.kind==='prefix'?'/'+st.ans:st.kind==='role'?ROLES[st.ans]:st.kind==='cls'?'Class '+st.ans:typeof st.ans==='number'&&st.ans>255?st.ans.toLocaleString():st.ans);
  const st=g[S.j],tip=tipFor(st,q);
  return `<div class="fc-steps"><div class="fc-steps-h">Step by step <small>· ½ points for this question</small></div><ol>${g.slice(0,S.j).map(x=>`<li class="wok"><span>${x.q}</span><b class="g mono wans">✓ ${shown(x)}</b></li>`).join('')}
    <li class="wcur${st.f!=null?' wfinal':''}"><span>${st.q}</span>${st.f!=null?`<div class="dim fc-note">This answers the question above.</div>`:''}<div class="wrow"><input id="wsin" class="winp${st.kind==='bin32'?' wide':''}" autocomplete="off" spellcheck="false" inputmode="${['role','cls','pow','prefix','cmd'].includes(st.kind)?'text':st.kind==='ip'||st.kind==='bin32'?'decimal':'numeric'}" autocapitalize="off" placeholder="${{cmd:'command',ip:'e.g. 192.168.4.0',prefix:'e.g. /26',bits8:'8 digits',bin32:'32 bits, dots optional',role:'network, host or broadcast',cls:'A, B or C',pow:'number or 2^n'}[st.kind]||'number'}"><button class="btn small primary" id="wschk">${st.f!=null?'Answer':'Check step'}</button><button class="btn small" id="wsshow">Show me</button></div><div class="wmsg">${S.msg||''}</div>${tip?`<div class="wshort"><b>⚡ Shortcut</b> ${tip}</div>`:''}</li></ol></div>`;
}
function renderFlow(){
  const q=state.q,F=state.flow,box=$('#flow');if(!F)return;
  const n=q.fields.length,cur=state.checked||F.k>=n?-1:F.k;
  let card='';
  if(cur>=0){const f=q.fields[cur];
    const where=f.where||(f.cell?`Network chart · Row ${f.cell.r+1}`:f.sec?SECNAME[f.sec]:'');
    card=`<div class="fcard" id="fcard" data-i="${cur}"><div class="fc-h"><small>Question ${cur+1} of ${n}${where?` · ${where}`:''}</small><div class="fc-bar"><i style="width:${Math.round(100*cur/n)}%"></i></div></div>
      <label class="fc-q" for="fin">${f.label}</label>${flowInput(f)}<div class="fc-msg${F.msg?' on':''}">${F.msg||''}</div>
      <div class="fc-acts">${F.groups&&F.groups[cur]&&!(F.step&&F.step.i===cur)?'<button class="btn small" id="fhint">💡 Hint: step by step</button>':''}${F.miss[cur]?'<button class="btn small" id="freveal">Show the answer</button>':''}</div>
      ${flowSteps(q,F,cur)}</div>`;}
  box.innerHTML=flowSheet(q,F,cur)+card;
  if(cur<0)return;
  const inp=$('#fin');
  if(inp){inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();flowAnswer(inp.value);}});$('#fok').onclick=()=>flowAnswer(inp.value);}
  $$('#fcard .fc-choices .choice').forEach(b=>b.onclick=()=>flowAnswer(b.dataset.v));
  const h=$('#fhint');if(h)h.onclick=()=>{F.step={i:cur,j:0,msg:''};renderFlow();focusFlow();};
  const rv=$('#freveal');if(rv)rv.onclick=()=>flowAdvance();
  const si=$('#wsin');
  if(si){si.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();flowStep(si.value);}});$('#wschk').onclick=()=>flowStep(si.value);$('#wsshow').onclick=()=>flowStep(null,true);}
}
function focusFlow(){const el=$('#wsin')||$('#fin')||$('#fcard .choice');if(!el)return;if(isDesktop())el.focus({preventScroll:true});$('#fcard').scrollIntoView({block:'nearest',behavior:studyScrollBehavior()});}
function flowAnswer(typed){
  const q=state.q,F=state.flow,i=F.k,f=q.fields[i];if(state.checked||!f)return;
  const raw=expandCell(f,typed);
  if(isBlank(raw)){F.msg='Type an answer first.';renderFlow();focusFlow();return;}
  if(isRight(f,raw)){flowAdvance(true);return;}
  let d=null;try{const vals=q.fields.map((g,j)=>j===i?raw:j<i?show(g):'');d=q.diag(vals)[i];}catch(e){}
  if(!F.miss[i]){F.miss[i]=true;F.firstVal[i]=raw;F.firstMsg[i]=d;if(d&&d.tag)noteMisses([d.tag]);}
  // nudge without giving the answer away: the worked answer stays hidden until "Show the answer"
  F.msg=(d?String(d):'That’s not it.').replace(/<b class="g mono">[^<]*<\/b>/g,'<b class="g mono">?</b>')+' <span class="dim">Try again, or use Hint.</span>';
  renderFlow();const el=$('#fin');if(el){el.value=typed;el.classList.add('shake');}focusFlow();
}
function flowStep(raw,reveal){
  const q=state.q,F=state.flow,S=F.step,st=F.groups[S.i][S.j];
  if(!reveal){if(isBlank(raw)){S.msg='Type an answer, or press “Show me”.';renderFlow();focusFlow();return;}
    const u=parseStep(st,raw);if(u!==st.ans){S.msg=st.bad(u,raw);renderFlow();const el=$('#wsin');if(el){el.value=raw;el.classList.add('shake');}focusFlow();return;}}
  state.hinted=true;F.hinted[S.i]=true;
  if(st.f!=null){F.step=null;flowAdvance(true);return;}
  S.j++;S.msg='';renderFlow();focusFlow();
}
function flowAdvance(){
  const q=state.q,F=state.flow,i=F.k;
  fillField(i,q.fields[i].answer);F.justDone=i;F.k++;F.msg='';F.step=null;
  if(F.k>=q.fields.length){check();return;}
  renderFlow();focusFlow();
}
function syncLayoutSeg(){
  const seg=$('#layoutSeg'),q=state.q,show=q&&q.fields.length>1&&!state.timed&&!q.flowOnly;seg.hidden=!show;
  $$('#layoutSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===layoutPref));
}
$$('#layoutSeg button').forEach(b=>b.onclick=()=>{if(layoutPref===b.dataset.v)return;layoutPref=b.dataset.v;store.set('ss_layout',layoutPref);if(state.q&&!state.checked)next(state.q);else syncLayoutSeg();});


/* ---------------- teaching tools: your own problem, share link, print, present ---------------- */
function parseMaskInput(raw){
  const s=String(raw).trim();if(!s)return null;
  const pm=s.match(/^\/?(\d{1,2})$/);if(pm){const p=Number(pm[1]);return p>=0&&p<=32?{p,asPrefix:true}:null;}
  const u=parseIP(s);if(u==null)return null;const p=maskPrefix(u);return p<0?null:{p,asPrefix:false};
}
function problemFrom(ipRaw,maskRaw){
  const ip=parseIP(String(ipRaw).trim());if(ip==null)return {err:'That IP address isn’t valid: four numbers from 0 to 255, separated by dots.'};
  const mk=parseMaskInput(maskRaw);if(!mk)return {err:'That mask isn’t valid. Use a prefix like /27 or a mask like 255.255.255.224.'};
  if(mk.p<25||mk.p>30)return {err:'The worksheet chart works in the 4th octet, so use a mask from /25 (255.255.255.128) to /30 (255.255.255.252).'};
  const a=oct(ip,0);if(a===0||a===127||a>=224)return {err:'Use a Class A, B or C address (first octet 1–126, 128–191 or 192–223) so total networks can be worked out.'};
  return {ip:ipStr(ip),p:mk.p,asPrefix:mk.asPrefix};
}
function shareURL(pr){
  const u=new URL(location.href);u.search='';u.hash='';
  u.searchParams.set('ip',pr.ip);u.searchParams.set('mask',pr.asPrefix?String(pr.p):ipStr(maskOf(pr.p)));return u.toString();
}
function loadProblem(pr){
  if(state.timed)return;
  if(state.mode!=='worksheet'){state.mode='worksheet';renderTabs();}
  next(genSheet(pr));state.custom=pr;
  try{history.replaceState(null,'',shareURL(pr));}catch(e){}
}
function renderOwnBox(){
  const box=$('#ownbox');
  box.innerHTML=`<div class="own-h"><b>Work a specific problem</b><button class="btn small" id="ownClose" aria-label="Close">✕</button></div>
  <p class="dim">Enter an IP and mask, for example from your class handout. It loads as a worksheet, and the link below opens this exact problem on anyone’s device.</p>
  <div class="own-row"><label>IP address<input id="ownIp" autocomplete="off" spellcheck="false" inputmode="decimal" placeholder="10.10.10.18"></label>
  <label>Mask<input id="ownMask" autocomplete="off" spellcheck="false" placeholder="/29 or 255.255.255.248"></label>
  <button class="btn primary" id="ownGo">Load problem</button></div><div class="own-msg" id="ownMsg"></div>
  <div class="own-share" id="ownShare" hidden><span class="dim">Share this problem:</span> <input id="ownLink" readonly> <button class="btn small" id="ownCopy">Copy link</button></div>`;
  const go=()=>{const pr=problemFrom($('#ownIp').value,$('#ownMask').value);
    if(pr.err){$('#ownMsg').textContent=pr.err;$('#ownMsg').className='own-msg bad';return;}
    loadProblem(pr);$('#ownMsg').textContent=`Loaded ${pr.ip} ${pr.asPrefix?'/'+pr.p:ipStr(maskOf(pr.p))}.`;$('#ownMsg').className='own-msg good';
    $('#ownShare').hidden=false;$('#ownLink').value=shareURL(pr);};
  $('#ownGo').onclick=go;[$('#ownIp'),$('#ownMask')].forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();go();}}));
  $('#ownClose').onclick=()=>{box.hidden=true;};
  $('#ownCopy').onclick=async()=>{const l=$('#ownLink');l.select();let ok=false;try{await navigator.clipboard.writeText(l.value);ok=true;}catch(e){try{ok=document.execCommand('copy');}catch(_){}}
    $('#ownCopy').textContent=ok?'Copied ✓':'Select and copy';setTimeout(()=>{$('#ownCopy').textContent='Copy link';},1800);};
}
/* printable worksheets with a separate answer key */
function printProblemHTML(q,n,key){
  const val=f=>key?(f.type==='choice'?ROLES[f.answer]:fieldShow(f,f.answer)):'';
  const top=q.fields.filter(f=>!f.cell&&f.sec!=='end'&&f.key!=='net'&&f.key!=='bc'&&f.key!=='role');
  const ipf=q.fields.filter(f=>['net','bc','role'].includes(f.key)),endf=q.fields.filter(f=>f.sec==='end');
  const rows={};q.fields.forEach(f=>{if(f.cell)(rows[f.cell.r]=rows[f.cell.r]||{})[f.cell.c]=f;});
  const line=f=>`<tr><td>${f.label}</td><td class="pp-a${f.type==='bin32'?' pp-bin':''}">${f.type==='choice'&&!key?'network &nbsp;/&nbsp; host &nbsp;/&nbsp; broadcast':val(f)}</td></tr>`;
  const extra=key&&endf[0]&&endf[0].alt&&endf[0].alt.length?`<div class="pp-note">Total networks counted from the class default. Counting from /24 instead: ${big(endf[0].alt[0])}.</div>`:'';
  return `<section class="pp"><div class="pp-head"><b>Problem ${n}</b><span class="pp-given">${q.prompt.replace(/<span class="sep">\|<\/span>/,'&nbsp;|&nbsp;').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}</span></div>
    <table class="pp-ws">${top.map(line).join('')}</table>
    <table class="pp-chart"><tr><th></th><th>Network</th><th>Useable host range</th><th>Broadcast</th></tr>${Object.keys(rows).map(r=>{const o=rows[r];
      return `<tr><td>Row ${Number(r)+1}</td><td>${val(o[0])}</td><td>${key?`${val(o[1])} – ${val(o[2])}`:'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;–'}</td><td>${val(o[3])}</td></tr>`;}).join('')}</table>
    <table class="pp-ws">${ipf.concat(endf).map(line).join('')}</table>${extra}</section>`;
}
function buildPrint(count,withKey,includeCurrent){
  const qs=[];if(includeCurrent&&state.q&&state.q.layout==='sheet')qs.push(state.custom?genSheet(state.custom):state.q);
  while(qs.length<count)qs.push(genSheet());
  const sheet=`<div class="pp-title"><h2>Subnetting worksheet</h2><div>Name ______________________ &nbsp; Date ____________</div></div>
    <p class="pp-intro">For each IP and mask, find the subnet mask in dotted decimal or as a prefix, the mask in binary, the network increment, the hosts per network, the network chart (start at .0), the network and broadcast address of the IP, whether the IP is a network, host or broadcast address, and the total networks counted from the IP’s class default mask.</p>
    ${qs.map((q,i)=>printProblemHTML(q,i+1,false)).join('')}`;
  const key=withKey?`<div class="pp-key"><div class="pp-title"><h2>Answer key</h2></div>${qs.map((q,i)=>printProblemHTML(q,i+1,true)).join('')}</div>`:'';
  $('#printArea').innerHTML=sheet+key;
}
function renderPrintBox(){
  const box=$('#printbox');
  box.innerHTML=`<div class="own-h"><b>Print worksheets</b><button class="btn small" id="prClose" aria-label="Close">✕</button></div>
  <p class="dim">${`Random ${state.mode==='vlsm'?'VLSM problems in the class assignment format':'problems in the class worksheet format'}, two to a page, with the answer key on separate pages.`}</p>
  <div class="own-row"><label>Problems<select id="prN">${[2,4,6,8,10].map(n=>`<option${n===4?' selected':''}>${n}</option>`).join('')}</select></label>
  <label class="chk"><input type="checkbox" id="prKey" checked> Answer key</label>
  <label class="chk"><input type="checkbox" id="prCur"> Start with this problem</label>
  <button class="btn primary" id="prGo">Print</button></div>`;
  $('#prClose').onclick=()=>{box.hidden=true;};
  $('#prGo').onclick=()=>{(state.mode==='vlsm'?buildPrintV:buildPrint)(Number($('#prN').value),$('#prKey').checked,$('#prCur').checked);document.body.classList.add('printing');setTimeout(()=>{window.print();},50);};
}
window.addEventListener('afterprint',()=>document.body.classList.remove('printing'));
function syncTeachTools(){
  const ws=(state.mode==='worksheet'||state.mode==='vlsm')&&!state.timed;
  $('#ownBtn').hidden=!ws;$('#printBtn').hidden=!ws;
  if(!ws){$('#ownbox').hidden=true;$('#printbox').hidden=true;}
}
$('#ownBtn').onclick=()=>{const b=$('#ownbox');if(b.hidden&&state.mode==='vlsm'){renderOwnBoxV();b.hidden=false;$('#printbox').hidden=true;if(state.custom&&state.custom.kind==='vlsm'){$('#ownHosts').value=state.custom.hosts.join(', ');$('#ownBase').value=state.custom.base;}$('#ownHosts').focus();}else if(b.hidden){renderOwnBox();b.hidden=false;$('#printbox').hidden=true;if(state.custom&&state.custom.ip){$('#ownIp').value=state.custom.ip;$('#ownMask').value=state.custom.asPrefix?'/'+state.custom.p:ipStr(maskOf(state.custom.p));}$('#ownIp').focus();}else b.hidden=true;};
$('#printBtn').onclick=()=>{const b=$('#printbox');if(b.hidden){renderPrintBox();b.hidden=false;$('#ownbox').hidden=true;}else b.hidden=true;};
$('#presentBtn').onclick=()=>{const on=!document.body.classList.contains('present');document.body.classList.toggle('present',on);$('#presentBtn').classList.toggle('on',on);$('#presentBtn').setAttribute('aria-pressed',on);};
function problemFromURL(){
  try{const sp=new URLSearchParams(location.search);if(sp.has('vlsm')){const pr=vlsmFrom(sp.get('vlsm'),sp.get('net')||'');return pr.err?null:pr;}if(!sp.has('ip'))return null;const pr=problemFrom(sp.get('ip'),sp.get('mask')||'');return pr.err?null:pr;}catch(e){return null;}
}

/* ---------------- game rendering ---------------- */
function renderTabs(){
  const tab=m=>{const c=state.per[m.id];const count=m.id==='weak'?Object.values(weak).filter(e=>e.w>0).length:0;return `<button class="tab ${state.mode===m.id?'on':''}" data-m="${m.id}" aria-pressed="${state.mode===m.id}" ${state.timed?'disabled':''}>${m.name}${count?' · '+count:''}${c.t?`<span class="ct">${c.r}/${c.t}</span>`:''}</button>`;};
  $('#tabs').innerHTML=TABGROUPS.map(([g,name,tip])=>`<div class="tgroup" role="group" aria-label="${name}"><span class="tglab" title="${tip}">${name}</span><div class="trow">${MODES.filter(m=>m.g===g).map(tab).join('')}</div></div>`).join('');
  $$('#tabs .tab').forEach(b=>b.onclick=()=>{state.mode=b.dataset.m;renderTabs();next();});
}
function renderStats(){
  $('#sScore').textContent=state.score;$('#sStreak').textContent=state.streak;$('#sBest').textContent=state.best;
  $('#sAcc').textContent=state.tried?Math.round(100*state.right/state.tried)+'%':'–';
}
function fieldHTML(f,i){
  if(f.type==='bits'){const vals=[128,64,32,16,8,4,2,1];
    return `<div class="field" data-i="${i}"><label>${f.label}</label><div><div class="bits">${vals.map((v,k)=>`<div class="bitcol"><small>${v}</small><button class="bit" data-k="${k}">0</button></div>`).join('')}</div><div class="fix"></div></div></div>`;}
  if(f.type==='choice')return `<div class="field" data-i="${i}"><label>${f.label}</label><div class="inrow"><div class="choices">${Object.entries(ROLES).map(([k,v])=>`<button type="button" class="choice" data-v="${k}">${v}</button>`).join('')}</div><span class="fix"></span></div></div>`;
  const ph=f.type==='ip'?'e.g. 192.168.4.0':f.type==='prefix'?'/26':f.type==='bin32'?'32 ones and zeros (dots optional)':f.type==='numalt'?'number or 2^n':'number';
  const im=f.type==='num'?'numeric':'decimal';
  if(f.pre&&!f.cell)return `<div class="field${f.type==='bin32'?' wide':''}" data-i="${i}"><label for="f${i}">${f.label}</label><div class="inrow"><span class="fpre mono">${f.pre}</span><input id="f${i}" class="oct8" autocomplete="off" spellcheck="false" inputmode="numeric" enterkeyhint="next" placeholder="${f.type==='bin32'?'8 bits':'octet'}"><span class="fix"></span></div></div>`;
  return `<div class="field${f.type==='bin32'?' wide':''}" data-i="${i}"><label for="f${i}">${f.label}</label><div class="inrow"><input id="f${i}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="${im}" enterkeyhint="${i<state.q.fields.length-1?'next':'done'}" placeholder="${ph}"><span class="fix"></span></div></div>`;
}
function next(force){
  let mode=state.timed||state.mode==='mixed'?pick(['binary','prefix','anding','detective','formulas']):state.mode,sub,lvl,target=null;
  if(mode==='weak'){target=pickWeak();if(target){const g=pick(WEAK[target][1]);mode=g[0];sub=g[1]===''?undefined:g[1];lvl=g[2];}else mode=pick(['binary','prefix','anding','detective','formulas']);}
  const keep=state.level;if(lvl)state.level=lvl;const q=force||GEN[mode](sub);state.level=keep;q.target=target;
  state.q=q;state.checked=false;state.hinted=false;
  if(!force){state.custom=null;if(location.search)try{history.replaceState(null,'',location.pathname);}catch(e){}}
  $('#qtype').innerHTML=q.title+(target?` <span class="drill">· drilling: ${WEAK[target][0]}</span>`:'');renderWeak();$('#prompt').innerHTML=q.prompt;$('#miniQ').innerHTML=q.mini||q.prompt.replace(/<br>/g,' ');
  $('#fields').innerHTML=q.layout==='sheet'?sheetHTML(q):q.layout==='vlsm'?vlsmHTML(q):q.fields.map(fieldHTML).join('');
  $('#fields').classList.toggle('sheet',q.layout==='sheet'||q.layout==='vlsm');
  $$('#fields .choices').forEach(g=>g.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{if(state.checked)return;g.querySelectorAll('.choice').forEach(x=>x.classList.toggle('on',x===b));}));
  $('#level').hidden=(state.mode==='worksheet'||state.mode==='vlsm')&&!state.timed;
  $$('#fields .bit').forEach(b=>b.onclick=()=>{if(state.checked)return;b.classList.toggle('on');b.textContent=b.classList.contains('on')?'1':'0';});
  $('#hint').hidden=true;$('#feedback').className='feedback';$('#work').style.display='none';
  $('#checkBtn').innerHTML='Check <span class="kbd">Enter</span>';$('#hintBtn').disabled=false;
  state.walk=null;setWalkView(false);renderWalk();
  if($('#autoClear').checked){strokes=[];redrawInk();$('#scratchText').value='';}
  const first=$('#fields input');if(first&&isDesktop())first.focus();
  startFlow();syncTeachTools();
}
function readField(f,el){if(f.type==='choice'){const b=el.querySelector('.choice.on');return b?b.dataset.v:'';}if(f.type==='bits')return $$(`.field[data-i="${el.dataset.i}"] .bit`).map(b=>b.classList.contains('on')?'1':'0').join('');return expandCell(f,el.querySelector('input').value);}
function isRight(f,v){
  if(f.type==='bits')return String(v).replace(/[\s.]/g,'')===f.answer;
  if(f.type==='choice')return toRole(v)===f.answer;
  if(f.type==='bin32')return bits32(v)===f.answer;
  if(f.type==='numalt'){const u=pow2(v);return u===f.answer||(f.alt||[]).includes(u);}
  if(f.type==='ip')return parseIP(v)===f.answer;
  if(f.type==='prefix'){const m=String(v).trim().replace(/^\//,'');return /^\d+$/.test(m)&&Number(m)===f.answer;}
  const s=String(v).replace(/[,\s]/g,'');return /^\d+$/.test(s)&&Number(s)===f.answer;
}
const show=f=>f.type==='choice'?ROLES[f.answer]:f.type==='bin32'?f.answer:f.type==='numalt'?big(f.answer):f.type==='ip'?ipStr(f.answer):f.type==='prefix'?'/'+f.answer:f.type==='bits'?f.answer:Number(f.answer).toLocaleString();
function check(){
  if(state.walkView&&!state.checked)return;
  if(state.flow&&!state.checked&&state.flow.k<state.q.fields.length)return;
  if(state.checked){next();if(!isDesktop())$('.card').scrollIntoView({block:'start',behavior:studyScrollBehavior()});return;}
  const q=state.q,F=state.flow;let all=true;const vals=q.fields.map((f,i)=>readField(f,$(`.field[data-i="${i}"]`)));const wrong=[];
  q.fields.forEach((f,i)=>{const el=$(`.field[data-i="${i}"]`);const ok=F?!F.miss[i]:isRight(f,vals[i]);if(!ok)wrong.push(i);
    el.classList.add(ok?'ok':'no');if(!ok){all=false;el.querySelector('.fix').textContent='→ '+show(f);}
    el.querySelectorAll('input').forEach(x=>{x.readOnly=true;x.blur();});el.querySelectorAll('.choice').forEach(x=>x.disabled=true);});
  state.checked=true;state.tried++;state.per[q.mode].t++;const agg=state.timed?'mixed':(state.mode==='mixed'||state.mode==='weak')?state.mode:null;if(agg)state.per[agg].t++;
  if(all){const pts=state.hinted?5:10;state.score+=pts;state.right++;state.per[q.mode].r++;if(agg)state.per[agg].r++;noteRight(q);
    state.streak++;if(state.streak>state.best){state.best=state.streak;store.set('ss_best',state.best);}
    $('#feedback').className='feedback good';$('#feedback').textContent=pick(['Correct!','Nailed it.','Clean.','Exactly right.','Yep — that’s it.'])+` +${pts}${state.streak>2?`  ·  🔥 ${state.streak} in a row`:''}`;
    if(state.timed)state.timed.right++;
  } else {state.streak=0;$('#feedback').className='feedback bad';
    $('#feedback').textContent=F?`${q.fields.length-wrong.length} of ${q.fields.length} right on the first try. Here’s what tripped you up:`:wrong.length===q.fields.length?'Not quite. Here’s what went wrong:':`${q.fields.length-wrong.length} of ${q.fields.length} right. Here’s what went wrong:`;}
  if(state.timed)state.timed.tried++;
  let coach='';
  if(!all){let d=[];try{d=F?q.fields.map((f,i)=>F.firstMsg[i]||null):q.diag?q.diag(vals):[];}catch(e){d=[];}
    if(F)wrong.forEach(i=>{vals[i]=F.firstVal[i]??'';});else noteMisses([...new Set(wrong.map(i=>d[i]&&d[i].tag).filter(Boolean))]);
    const chipShown=new Set();
    coach='<div class="coach">'+wrong.map(i=>{const f=q.fields[i];const typed=isBlank(vals[i])?'(blank)':f.type==='choice'?ROLES[vals[i]]:f.type==='bits'?vals[i]:String(vals[i]).trim();
      return `<div class="ci" data-i="${i}"><div class="ch"><b>${f.label}</b><span>you put <s class="mono">${esc(typed)}</s> → <b class="g mono">${show(f)}</b></span></div><p>${d[i]||'Compare with the full walkthrough below.'}</p>${d[i]&&d[i].tag&&WEAK[d[i].tag]&&!chipShown.has(d[i].tag)&&chipShown.add(d[i].tag)?`<span class="wk-chip">Logged to weak spots: ${WEAK[d[i].tag][0]}</span>`:''}</div>`;}).join('')+'</div>';}
  $('#work').innerHTML=coach+`<details class="full"${all?'':''}><summary>${all?'Show the work':'Full walkthrough'}</summary>${q.explain}</details>`;
  $('#work').style.display=all&&state.timed?'none':'block';
  $('#checkBtn').innerHTML='Next <span class="kbd">Enter</span>';$('#hintBtn').disabled=true;if(state.walk){$('#walk').querySelectorAll('input,button').forEach(x=>x.disabled=true);}
  if(F){$('#checkBtn').hidden=false;renderFlow();}
  renderStats();renderTabs();renderWeak();
  if(!isDesktop())$('#feedback').scrollIntoView({block:'nearest',behavior:studyScrollBehavior()});else $('#checkBtn').focus();
}
$('#checkBtn').onclick=check;
$('#hintBtn').onclick=()=>{if(state.checked)return;
  if(state.walk){setWalkView(!state.walkView);if(!state.walkView)$('#fields').scrollIntoView({block:'nearest',behavior:studyScrollBehavior()});return;}
  state.hinted=true;
  if(state.q.walk){state.walk=startWalk(state.q);setWalkView(true);return;}
  const h=$('#hint');h.innerHTML=`💡 ${state.q.hint}<br><button class="btn small" id="hintGuide">Open the guide →</button>`;h.hidden=false;
  $('#hintGuide').onclick=()=>openTool('guide',GUIDE_FOR[state.q.mode]);$('#hintBtn').disabled=true;};
$('#skipBtn').onclick=()=>{if(!state.checked){state.streak=0;renderStats();}next();};
$('#fields').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.classList.contains('bit')){e.preventDefault();check();return;}
  if(/^[1-8]$/.test(e.key)&&e.target.classList.contains('bit')&&!state.checked){e.preventDefault();const b=e.target.closest('.field').querySelector(`.bit[data-k="${Number(e.key)-1}"]`);if(b)b.click();return;}
  if(e.key!=='Enter'||e.target.tagName!=='INPUT')return;e.preventDefault();
  const ins=$$('#fields input');const i=ins.indexOf(e.target);
  if(!state.checked&&!isDesktop()&&i<ins.length-1){ins[i+1].focus();return;}
  check();
});
document.addEventListener('keydown',e=>{
  if($('#overlay').classList.contains('on'))return;
  if(e.target.closest&&(e.target.closest('.tools')||e.target.closest('#fields')||e.target.closest('#flow')))return;
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT')return;
  if(e.key==='Enter'&&!e.target.closest('summary')&&!e.target.closest('button')){e.preventDefault();check();return;}
  if(/^[1-8]$/.test(e.key)&&!state.checked&&state.q&&state.q.mode==='binary'){const b=$(`.bit[data-k="${Number(e.key)-1}"]`);if(b)b.click();}
});
$$('#level button').forEach(b=>b.onclick=()=>{state.level=b.dataset.l;$$('#level button').forEach(x=>x.classList.toggle('on',x===b));next();});

/* ---------------- timed challenge ---------------- */
let tick=null;
function startTimed(){
  state.timed={end:Date.now()+120000,right:0,tried:0,startScore:state.score};$('#overlay').classList.remove('on');
  $('#timedBtn').disabled=true;renderTabs();next();
  clearInterval(tick);tick=setInterval(()=>{const left=Math.max(0,state.timed.end-Date.now());
    $('#timer').textContent=`⏱ ${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')}`;if(left<=0)endTimed();},250);
}
function endTimed(){
  clearInterval(tick);const t=state.timed;state.timed=null;$('#timer').textContent='';$('#timedBtn').disabled=false;
  const pts=state.score-t.startScore;const best=Math.max(0,Math.floor(Number(store.get('ss_tbest',0)))||0);if(pts>best)store.set('ss_tbest',pts);
  $('#tScore').textContent=pts;$('#tLine').innerHTML=`${t.right} correct out of ${t.tried} answered<br>${pts>best?'🏆 New personal best!':`Personal best: ${best}`}`;
  $('#overlay').classList.add('on');renderTabs();
}
$('#timedBtn').onclick=startTimed;$('#tAgain').onclick=startTimed;
$('#tClose').onclick=()=>{$('#overlay').classList.remove('on');next();};

/* ---------------- tools panel ---------------- */
const tools=$('#tools');
function openTool(name,sec){
  $$('.ttab').forEach(b=>b.classList.toggle('on',b.dataset.t===name));
  $$('.tpane').forEach(p=>p.hidden=p.id!=='t-'+name);
  const wasOpen=tools.classList.contains('open');
  tools.classList.add('open');tools.dataset.cur=name;$('#theadTitle').textContent=TOOL_NAMES[name];
  if(!isDesktop()){document.body.classList.add('sheet-open');if(!wasOpen&&!sec)showCard();}
  $$('#dock button').forEach(b=>b.classList.toggle('on',b.dataset.t===name));
  if(name==='scratch')requestAnimationFrame(sizePad);
  if(sec){const d=document.getElementById(sec);if(d){d.open=true;setTimeout(()=>d.scrollIntoView({block:'start',behavior:studyScrollBehavior()}),260);}}
}
const TOOL_NAMES={scratch:'✏️ Scratchpad',calc:'🧮 Calculator',guide:'📋 Guide'};
function setBig(big){tools.classList.toggle('big',big);store.set('ss_big',big);$('#tsizeLbl').textContent=big?'Smaller':'Bigger';
  $('#tsize .ic').textContent=big?'⤡':'⤢';$('#tsize').setAttribute('aria-label',big?'Make panel smaller':'Make panel bigger');
  if(tools.dataset.cur==='scratch')setTimeout(sizePad,240);}
$('#tsize').onclick=()=>setBig(!tools.classList.contains('big'));
$('#grabBtn').onclick=()=>setBig(!tools.classList.contains('big'));
setBig(store.get('ss_big',false));
function showCard(){if(isDesktop())return;const c=$('.card');const y=c.getBoundingClientRect().top+window.scrollY-8;window.scrollTo({top:y,behavior:studyScrollBehavior()});}
function closeTools(){tools.classList.remove('open');document.body.classList.remove('sheet-open');$$('#dock button').forEach(b=>b.classList.remove('on'));if(document.activeElement)document.activeElement.blur();}
$$('.ttab').forEach(b=>b.onclick=()=>openTool(b.dataset.t));

/* Phone/tablet: the panel scrolls its own content by finger. iPhone Safari often hands swipes on a sliding
   fixed panel to the page behind it, so the panel handles vertical swipes itself (with momentum) and never
   lets them scroll the page. Horizontal swipes (wide tables) and drawing on the scratchpad are left alone. */
(function(){
  let pane=null,lastY=0,lastX=0,startX=0,startY=0,mode=null,vel=0,lastT=0,raf=0;
  const stop=()=>{cancelAnimationFrame(raf);raf=0;};
  tools.addEventListener('touchstart',e=>{
    if(isDesktop()||e.touches.length!==1||e.target.closest('#padwrap'))return(mode='skip');
    stop();const t=e.touches[0];startX=lastX=t.clientX;startY=lastY=t.clientY;lastT=performance.now();vel=0;mode=null;
    pane=e.target.closest('.tpane');
  },{passive:true});
  tools.addEventListener('touchmove',e=>{
    if(mode==='skip'||isDesktop())return;
    const t=e.touches[0];
    if(mode===null){const dx=Math.abs(t.clientX-startX),dy=Math.abs(t.clientY-startY);if(dx<6&&dy<6)return;mode=dx>dy?'x':'y';}
    if(mode==='x')return;
    e.preventDefault();
    const dy=lastY-t.clientY,now=performance.now();
    if(pane&&pane.scrollHeight>pane.clientHeight){pane.scrollTop+=dy;vel=0.8*(dy/Math.max(1,now-lastT))+0.2*vel;}
    lastY=t.clientY;lastX=t.clientX;lastT=now;
  },{passive:false});
  tools.addEventListener('touchend',()=>{
    if(mode!=='y'||!pane)return;const p=pane;let v=vel*16;
    if(performance.now()-lastT>80||Math.abs(v)<1)return;
    const step=()=>{p.scrollTop+=v;v*=0.95;if(Math.abs(v)>0.5&&p.scrollTop>0&&p.scrollTop<p.scrollHeight-p.clientHeight)raf=requestAnimationFrame(step);else raf=0;};
    raf=requestAnimationFrame(step);
  },{passive:true});
})();

$$('#dock button').forEach(b=>b.onclick=()=>{if(tools.classList.contains('open')&&tools.dataset.cur===b.dataset.t)closeTools();else openTool(b.dataset.t);});
$('#tclose').onclick=closeTools;
tools.dataset.cur='scratch';

/* ---------------- scratchpad ---------------- */
const ink=$('#ink'),gridC=$('#grid'),ictx=ink.getContext('2d'),gctx=gridC.getContext('2d');
let strokes=[],cur=null,penColor='#e6f0ff',erasing=false,showGrid=store.get('ss_grid',true);
$('#guideToggle').classList.toggle('on',showGrid);
function sizePad(){
  const r=$('#padwrap').getBoundingClientRect();if(!r.width||!r.height)return;const d=window.devicePixelRatio||1;
  [ink,gridC].forEach(c=>{c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);c.getContext('2d').setTransform(d,0,0,d,0,0);});
  drawGrid();redrawInk();
}
function drawGrid(){
  const r=$('#padwrap').getBoundingClientRect();gctx.clearRect(0,0,r.width,r.height);if(!showGrid)return;
  const vals=[128,64,32,16,8,4,2,1];const w=r.width/8;
  gctx.font='600 12px "JetBrains Mono", monospace';gctx.textAlign='center';gctx.textBaseline='top';
  vals.forEach((v,i)=>{gctx.fillStyle='#5d7a8c';gctx.fillText(v,w*i+w/2,8);
    if(i>0){gctx.strokeStyle='#142230';gctx.lineWidth=1;gctx.beginPath();gctx.moveTo(Math.round(w*i)+.5,4);gctx.lineTo(Math.round(w*i)+.5,r.height-4);gctx.stroke();}});
  gctx.strokeStyle='#1d3142';gctx.beginPath();gctx.moveTo(4,28.5);gctx.lineTo(r.width-4,28.5);gctx.stroke();
}
function drawStroke(s,from){
  ictx.globalCompositeOperation=s.erase?'destination-out':'source-over';
  ictx.strokeStyle=s.color;ictx.fillStyle=s.color;ictx.lineWidth=s.w;ictx.lineCap='round';ictx.lineJoin='round';
  const pts=s.pts;if(pts.length===1){ictx.beginPath();ictx.arc(pts[0][0],pts[0][1],s.w/2,0,Math.PI*2);ictx.fill();return;}
  ictx.beginPath();const st=Math.max(0,(from||0)-1);ictx.moveTo(pts[st][0],pts[st][1]);
  for(let i=st+1;i<pts.length;i++)ictx.lineTo(pts[i][0],pts[i][1]);ictx.stroke();
}
function redrawInk(){const r=$('#padwrap').getBoundingClientRect();ictx.globalCompositeOperation='source-over';ictx.clearRect(0,0,r.width,r.height);strokes.forEach(s=>drawStroke(s));}
function pos(e){const r=ink.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
ink.addEventListener('pointerdown',e=>{e.preventDefault();ink.setPointerCapture(e.pointerId);
  cur={color:penColor,w:erasing?22:(e.pointerType==='pen'?2.2:2.8),erase:erasing,pts:[pos(e)]};drawStroke(cur);});
ink.addEventListener('pointermove',e=>{if(!cur)return;const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];const n=cur.pts.length;evs.forEach(ev=>cur.pts.push(pos(ev)));drawStroke(cur,n);});
const endStroke=()=>{if(cur){strokes.push(cur);cur=null;}};
ink.addEventListener('pointerup',endStroke);ink.addEventListener('pointercancel',endStroke);
$$('.swatch').forEach(b=>b.onclick=()=>{penColor=b.dataset.c;erasing=false;$('#eraser').classList.remove('on');$$('.swatch').forEach(x=>x.classList.toggle('on',x===b));});
$('#eraser').onclick=()=>{erasing=!erasing;$('#eraser').classList.toggle('on',erasing);};
$('#undo').onclick=()=>{strokes.pop();redrawInk();};
$('#clearPad').onclick=()=>{strokes=[];redrawInk();};
$('#guideToggle').onclick=()=>{showGrid=!showGrid;store.set('ss_grid',showGrid);$('#guideToggle').classList.toggle('on',showGrid);drawGrid();};
new ResizeObserver(()=>sizePad()).observe($('#padwrap'));
$$('#padMode button').forEach(b=>b.onclick=()=>{const t=b.dataset.p==='type';$$('#padMode button').forEach(x=>x.classList.toggle('on',x===b));
  $('#drawUI').hidden=t;$('#typeUI').hidden=!t;if(!t)requestAnimationFrame(sizePad);});
function insertText(txt){const ta=$('#scratchText');const s=ta.selectionStart??ta.value.length;const pre=ta.value.slice(0,s),post=ta.value.slice(ta.selectionEnd??s);
  const lead=pre&&!pre.endsWith('\n')?'\n':'';ta.value=pre+lead+txt+post;const c=(pre+lead+txt).length;ta.focus();ta.setSelectionRange(c,c);}
$('#insBits').onclick=()=>insertText('128 64 32 16  8  4  2  1\n  _  _  _  _  _  _  _  _\n');
$('#insChart').onclick=()=>insertText('Mask: \nIncrement: 256 − ___ = \nSubnets: 0, \nNetwork: \nGateway: \nLast usable: \nBroadcast: \nHosts: 2^__ − 2 = \n');
$('#clearText').onclick=()=>{$('#scratchText').value='';};

/* ---------------- calculator ---------------- */
let lastAns=0;const hist=[];
function evalExpr(src){
  const s=src.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/Ans/gi,String(lastAns)).replace(/\s+/g,'');
  if(!s)return null;const toks=s.match(/\d+\.?\d*|\.\d+|[-+*/^()]/g);if(!toks||toks.join('')!==s)return NaN;let i=0;
  const peek=()=>toks[i];
  function expr(){let v=term();while(peek()==='+'||peek()==='-'){const o=toks[i++];const r=term();v=o==='+'?v+r:v-r;}return v;}
  function term(){let v=unary();while(peek()==='*'||peek()==='/'||peek()==='('){const o=peek()==='('?'*':toks[i++];const r=unary();v=o==='*'?v*r:v/r;}return v;}
  function unary(){if(peek()==='-'){i++;return -unary();}if(peek()==='+'){i++;return unary();}return power();}
  function power(){const b=prim();if(peek()==='^'){i++;return Math.pow(b,unary());}return b;}
  function prim(){const t=toks[i++];if(t==='('){const v=expr();if(toks[i]===')')i++;return v;}if(t!==undefined&&/^[\d.]/.test(t))return parseFloat(t);throw 0;}
  try{const v=expr();if(i!==toks.length)return NaN;return v;}catch(e){return NaN;}
}
const fmt=v=>Number.isInteger(v)?String(v):String(parseFloat(v.toPrecision(10)));
const cin=$('#cin'),cprev=$('#cprev');
function preview(){const v=evalExpr(cin.value);cprev.textContent=v==null||isNaN(v)||!isFinite(v)?'':'= '+fmt(v);}
function calcEquals(){const v=evalExpr(cin.value);if(v==null)return;if(isNaN(v)||!isFinite(v)){cprev.textContent='Error';return;}
  const r=fmt(v);hist.unshift({e:cin.value,r});if(hist.length>8)hist.pop();lastAns=v;cprev.textContent=cin.value+' =';cin.value=r;renderHist();}
function renderHist(){$('#chist').innerHTML=hist.map((h,i)=>`<div data-i="${i}"><span>${esc(h.e)}</span><b>${esc(h.r)}</b></div>`).join('');
  $$('#chist div').forEach(d=>d.onclick=()=>{cin.value=hist[d.dataset.i].e;preview();});}
function press(k){
  if(k==='C'){cin.value='';cprev.textContent='';return;}
  if(k==='BS'){cin.value=cin.value.slice(0,-1);preview();return;}
  if(k==='='){calcEquals();return;}
  if(k==='ANS'){cin.value+='Ans';preview();return;}
  cin.value+=k;preview();
}
$$('#ckeys button').forEach(b=>b.onclick=()=>press(b.dataset.k));
cin.addEventListener('input',preview);
cin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='='){e.preventDefault();calcEquals();}else if(e.key==='Escape'){press('C');}});

/* ---------------- guide tables ---------------- */
$('#cheatRows').innerHTML=[24,25,26,27,28,29,30].map(p=>{const v=oct(maskOf(p),3);return `<tr><td>/${p}</td><td>${ipStr(maskOf(p))}</td><td>${256-v}</td><td>${2**(32-p)-2}</td><td>${2**(p-24)}</td></tr>`;}).join('');
$('#partRows').innerHTML=[1,2,3,4,5,6,7,8].map(n=>{const v=(0xFF00>>n)&255;return `<tr><td>${n}</td><td>${bin8(v)}</td><td>${v}</td><td>${n===8?'—':256-v}</td></tr>`;}).join('');

const setDockH=()=>{const d=$('#dock');const h=d.offsetHeight;if(h)document.documentElement.style.setProperty('--dock-h',h+'px');};
new ResizeObserver(setDockH).observe($('#dock'),{box:'border-box'});setTimeout(setDockH,500);window.addEventListener('resize',setDockH);setDockH();
renderTabs();renderStats();
{const up=problemFromURL();if(up&&up.kind==='vlsm'){state.mode='vlsm';renderTabs();next(genVlsm(up));state.custom=up;}else if(up){state.mode='worksheet';renderTabs();next(genSheet(up));state.custom=up;}else next();}
if(isDesktop())openTool('scratch');

/* ---------------- install + offline ---------------- */
(function(){
  const btn=$('#installBtn');let deferred=null;
  const standalone=window.matchMedia&&matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const toast=t=>{const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),3200);};
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(!standalone)btn.hidden=false;});
  window.addEventListener('appinstalled',()=>{btn.hidden=true;deferred=null;toast('Installed. Open Subnet Sprint from your home screen or app list.');});
  if(ios&&!standalone)btn.hidden=false;
  btn.onclick=async()=>{
    if(deferred){deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;btn.hidden=true;return;}
    if($('.iospop'))return;
    const p=document.createElement('div');p.className='iospop';
    const other=/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\//.test(navigator.userAgent);
    p.innerHTML=`<div>${other?'You’re in a browser other than Safari, and adding from here usually gives a plain-letter icon. ':''}To install on iPhone or iPad, open this page in <b>Safari</b>, tap the <b>Share</b> button <span aria-hidden="true">(□↑)</span>, then <b>Add to Home Screen</b>.</div><div class="row"><button class="btn small">Got it</button></div>`;
    p.querySelector('button').onclick=()=>p.remove();document.body.appendChild(p);};
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    const first=!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg=>{
      if(first)navigator.serviceWorker.ready.then(()=>{if(!store.get('ss_offline_told',false)){store.set('ss_offline_told',true);toast('Saved for offline use ✓');}});
    }).catch(()=>{});
  }
})();

/* hooks for the automated tests */
window.SS={problemFrom,buildPrint,genVlsm,vlsmFrom,buildPrintV,hostBitsFor,shareURLV,getFlow:()=>state.flow,flowAnswer,setLayout:v=>{layoutPref=v;store.set('ss_layout',v);},startWalk,tipFor,next,genSheet,walkSheet,genMaskBin,genRole,genClassNets,classOf,bin32,bits32,pow2,toRole,ipStr,walkSteps,walkD2B,walkB2D,walkP2M,walkM2P,walkAnd,walkHosts,walkNets,walkSizeHosts,walkSizeNets,walkInc,GEN,state,WEAK,getWeak:()=>weak,pickWeak,next,check,show,isRight,parseIP,R,netCtx,diagNet,diagChart,diagHosts,diagBits,diagBinDec,diagMask,diagPrefix,diagNetworks,diagNewPrefix,diagSizeHosts,diagBits4Nets,diagNewMask,diagIncrement};
})();

/* ---------------- oscilloscope behind the app (decorative) ----------------
   #scope is the scope screen: a 10×8 graticule, and four traces drawn by a sweeping beam onto a persistence layer
   that fades like phosphor. CH1 is a subnet mask as a digital signal (one bit per step), CH3 an IP address, MATH is
   CH1 AND CH3 (the network address), CH2 a sine. Bus-decode labels show each octet; every sweep picks a new
   address and prefix, and the readout strip under the main column shows the same values. Pauses when the tab is
   hidden; reduced motion gets one finished frame. */
(function(){
  const cv=document.getElementById('scope');if(!cv||!cv.getContext)return;
  const ctx=cv.getContext('2d');const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)');
  const C1='#ffd23d',C2='#5ec8ff',C3='#ff6bd6',CM='#6ff0c4',DRAFT='"Barlow Condensed",sans-serif',MONO='"JetBrains Mono",monospace';
  let w=0,h=0,d=1,grat=null,pers=null,pc=null,raf=0,last=0,phase=0,sx=0,hold=0,sig=null,lanes=null,amp=0,X0=0,X1=0,decoded=[];
  const oct=n=>[n>>>24,n>>>16&255,n>>>8&255,n&255];
  function pick(){
    const p=8+Math.floor(Math.random()*23),mask=p?(0xFFFFFFFF<<(32-p))>>>0:0,f=[10,172,192][Math.floor(Math.random()*3)];
    const ip=((f===10?10<<24:f===172?(172<<24|(16+Math.floor(Math.random()*16))<<16):(192<<24|168<<16))|Math.floor(Math.random()*(f===10?1<<24:f===172?1<<16:1<<16)))>>>0;
    sig={p,mask,ip,net:(ip&mask)>>>0,f:pick.f||(pick.f=.8+Math.random()*1.2),ph:pick.ph??(pick.ph=Math.random()*6.28)};decoded=[];
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('roMask',oct(mask).join('.')+' (/'+p+')');set('roIp',oct(ip).join('.'));set('roNet',oct(sig.net).join('.'));
  }
  const bit=(n,k)=>(n>>>(31-k))&1;
  // y of a digital trace at x: one bit per step, with a fast edge and a little ringing after each transition
  function dig(n,x,y0){const bw=(X1-X0)/32;if(x<X0)return y0-amp*bit(n,0);if(x>X1)return y0-amp*bit(n,31);
    const k=Math.min(31,Math.floor((x-X0)/bw)),v=bit(n,k),t=x-X0-k*bw,prev=k?bit(n,k-1):v;let y=y0-amp*v;
    if(prev!==v){const e=Math.min(1,t/3);y=y0-amp*(prev+(v-prev)*e);if(t>=3)y-=(v-prev)*amp*.16*Math.exp(-(t-3)/7)*Math.cos((t-3)/2.6);}
    return y+(Math.random()-.5)*.8;}
  const sine=(x,y0)=>y0-amp*.9*Math.sin(x/w*Math.PI*2*sig.f*3+sig.ph)*(.75+.25*Math.sin(x/w*7))+(Math.random()-.5)*.8;
  function traces(){return [[C1,x=>dig(sig.mask,x,lanes[0])],[C3,x=>dig(sig.ip,x,lanes[1])],[CM,x=>dig(sig.net,x,lanes[2])],[C2,x=>sine(x,lanes[3])]];}
  function graticule(c){
    c.clearRect(0,0,w,h);const dx=w/10,dy=h/8,cx=w/2,cy=h/2;c.lineWidth=1;
    c.strokeStyle='rgba(150,190,210,.13)';c.setLineDash([1,5]);c.beginPath();
    for(let i=1;i<10;i++){if(i===5)continue;const x=Math.round(i*dx)+.5;c.moveTo(x,0);c.lineTo(x,h);}
    for(let i=1;i<8;i++){if(i===4)continue;const y=Math.round(i*dy)+.5;c.moveTo(0,y);c.lineTo(w,y);}c.stroke();c.setLineDash([]);
    c.strokeStyle='rgba(150,190,210,.24)';c.beginPath();c.moveTo(Math.round(cx)+.5,0);c.lineTo(Math.round(cx)+.5,h);c.moveTo(0,Math.round(cy)+.5);c.lineTo(w,Math.round(cy)+.5);
    for(let i=1;i<50;i++){const x=Math.round(i*dx/5)+.5,L=i%5?4:8;c.moveTo(x,cy-L);c.lineTo(x,cy+L);}
    for(let i=1;i<40;i++){const y=Math.round(i*dy/5)+.5,L=i%5?4:8;c.moveTo(cx-L,y);c.lineTo(cx+L,y);}c.stroke();
    // channel ground markers on the left edge, and the trigger level on the right
    [[C1,'1',lanes[0]],[C3,'3',lanes[1]],[CM,'M',lanes[2]],[C2,'2',lanes[3]]].forEach(([col,t,y])=>{c.fillStyle=col;c.beginPath();c.moveTo(10,y-8);c.lineTo(24,y-8);c.lineTo(31,y);c.lineTo(24,y+8);c.lineTo(10,y+8);c.closePath();c.globalAlpha=.85;c.fill();
      c.globalAlpha=1;c.fillStyle='#05090d';c.font=`700 12px ${DRAFT}`;c.textAlign='center';c.textBaseline='middle';c.fillText(t,19,y+.5);});
    const ty=lanes[0]-amp/2;c.fillStyle=C1;c.globalAlpha=.85;c.beginPath();c.moveTo(w-10,ty-7);c.lineTo(w-22,ty);c.lineTo(w-10,ty+7);c.closePath();c.fill();c.globalAlpha=1;
    c.beginPath();c.moveTo(cx-6,10);c.lineTo(cx+6,10);c.lineTo(cx,18);c.closePath();c.fillStyle='#e6eef3b3';c.fill();
    // settings bar along the bottom of the screen
    if(w>=560){c.font=`600 12px ${MONO}`;c.textAlign='left';c.textBaseline='alphabetic';let x=16;const y=h-14;
      [[C1,'1','2.00V/'],[C3,'3','2.00V/'],[CM,'M','AND'],[C2,'2','500mV/'],['#e6eef3','H','400ns/'],[C1,'T','↑ 1.20V']].forEach(([col,k,v])=>{c.fillStyle=col;c.globalAlpha=.9;c.fillRect(x,y-11,16,14);c.globalAlpha=1;
        c.fillStyle='#05090d';c.textAlign='center';c.fillText(k,x+8,y);c.textAlign='left';c.fillStyle='rgba(230,238,243,.75)';c.fillText(v,x+21,y);x+=c.measureText(v).width+40;});}
  }
  function seg(c,col,f,a,b){// one stretch of a trace: a soft halo, then the bright line
    c.beginPath();for(let x=a;x<=b;x+=2){const y=f(x);x===a?c.moveTo(x,y):c.lineTo(x,y);}
    c.strokeStyle=col;c.globalAlpha=.16;c.lineWidth=6;c.stroke();c.globalAlpha=.95;c.lineWidth=1.6;c.stroke();c.globalAlpha=1;}
  function decode(c,upto){// bus-decode labels above each digital trace, drawn once the beam has passed each octet
    const bw=(X1-X0)/32;for(let o=0;o<4;o++){const xe=X0+(o+1)*8*bw;if(xe>upto||decoded.includes(o))continue;decoded.push(o);
      [[C1,sig.mask,0,true],[C3,sig.ip,1,false],[CM,sig.net,2,false]].forEach(([col,n,li,hex])=>{const v=oct(n)[o],t=hex?v.toString(16).toUpperCase().padStart(2,'0')+'h · '+v:String(v);
        const x0=X0+o*8*bw+4,x1=xe-4,y=lanes[li]-amp-16,m=7;c.font=`600 11px ${MONO}`;c.globalAlpha=.9;c.strokeStyle=col;c.lineWidth=1;
        c.beginPath();c.moveTo(x0,y);c.lineTo(x0+m,y-8);c.lineTo(x1-m,y-8);c.lineTo(x1,y);c.lineTo(x1-m,y+8);c.lineTo(x0+m,y+8);c.closePath();c.fillStyle='rgba(5,9,13,.85)';c.fill();c.stroke();
        c.fillStyle=col;c.textAlign='center';c.textBaseline='middle';c.fillText(t,(x0+x1)/2,y+.5);c.globalAlpha=1;});}}
  function setup(){
    d=Math.min(window.devicePixelRatio||1,2);w=innerWidth;h=innerHeight;cv.width=w*d;cv.height=h*d;ctx.setTransform(d,0,0,d,0,0);
    const dy=h/8;lanes=[2.2*dy,3.75*dy,5.3*dy,6.85*dy];amp=Math.min(dy*.42,42);X0=w*.05;X1=w*.95;
    grat=document.createElement('canvas');grat.width=w*d;grat.height=h*d;const g=grat.getContext('2d');g.setTransform(d,0,0,d,0,0);graticule(g);
    pers=document.createElement('canvas');pers.width=w*d;pers.height=h*d;pc=pers.getContext('2d');pc.setTransform(d,0,0,d,0,0);pc.lineJoin='round';
    pick();sx=0;hold=0;
  }
  function frame(now){
    const dt=Math.min(.05,(now-last)/1000||0);last=now;
    // phosphor persistence: everything already drawn fades a little each frame
    pc.globalCompositeOperation='destination-out';pc.fillStyle=`rgba(0,0,0,${Math.min(1,dt*.42)})`;pc.fillRect(0,0,w,h);pc.globalCompositeOperation='source-over';
    if(hold>0){hold-=dt;if(hold<=0){pick();sx=0;}}
    else{const nx=Math.min(w,sx+w*dt/3.4);traces().forEach(([col,f])=>seg(pc,col,f,Math.max(0,sx-2),nx));decode(pc,nx);sx=nx;if(sx>=w)hold=.9;}
    ctx.clearRect(0,0,w,h);ctx.drawImage(grat,0,0,w,h);ctx.drawImage(pers,0,0,w,h);
    if(hold<=0)traces().forEach(([col,f])=>{const y=f(sx);ctx.fillStyle=col;ctx.globalAlpha=.25;ctx.beginPath();ctx.arc(sx,y,8,0,7);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx,y,2.2,0,7);ctx.fill();});
  }
  function still(){traces().forEach(([col,f])=>seg(pc,col,f,0,w));decode(pc,w);ctx.clearRect(0,0,w,h);ctx.drawImage(grat,0,0,w,h);ctx.drawImage(pers,0,0,w,h);}
  function loop(now){raf=requestAnimationFrame(loop);if(now-last<30)return;frame(now);}
  function start(){cancelAnimationFrame(raf);setup();if(reduce&&reduce.matches){still();return;}last=performance.now();raf=requestAnimationFrame(loop);}
  addEventListener('resize',()=>{clearTimeout(start.t);start.t=setTimeout(start,200);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else if(!(reduce&&reduce.matches)){last=performance.now();raf=requestAnimationFrame(loop);}});
  if(reduce&&reduce.addEventListener)reduce.addEventListener('change',start);
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(start);
})();
