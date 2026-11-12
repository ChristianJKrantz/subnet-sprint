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

const MODES=[{id:'mixed',name:'Mixed'},{id:'binary',name:'Binary'},{id:'prefix',name:'Prefix ↔ Mask'},{id:'anding',name:'ANDing'},{id:'detective',name:'Subnet Chart'},{id:'formulas',name:'Formulas'},{id:'weak',name:'Weak spots'}];
const GUIDE_FOR={binary:'g-bin',prefix:'g-mask',anding:'g-and',detective:'g-chart',formulas:'g-form'};
const state={mode:'mixed',level:'core',score:0,streak:0,best:Math.max(0,Math.floor(Number(store.get('ss_best',0)))||0),right:0,tried:0,per:{},q:null,checked:false,hinted:false,timed:null};
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
    if(i===1){
      if(un!=null&&!right[0]&&x===((un+1)>>>0))msg=`This is network + 1 for the network you wrote (${M(ipStr(un))}), so your method here is right. Only the network is off. With the correct network, the gateway is ${G(ipStr(ans[1]))}.`;
      else if(x===ip)msg=T('copied_ip',`That’s the IP from the question. The gateway is the first usable address in its subnet: network + 1 = ${G(ipStr(ans[1]))}.`);
      else if(x===((c.net+2)>>>0))msg=T('off_by_one',`Off by one. The gateway is network <b>+ 1</b>: ${M(ipStr(c.net))} + 1 = ${G(ipStr(ans[1]))}.`);
      else if(x===((c.net-1)>>>0))msg=T('off_by_one',`That’s one <i>below</i> the network, which belongs to the previous subnet. The gateway is network + 1 = ${G(ipStr(ans[1]))}.`);
    }
    if(i===2){
      if(ub!=null&&!right[3]&&x===((ub-1)>>>0))msg=`This is broadcast − 1 for the broadcast you wrote (${M(ipStr(ub))}), so your method here is right. Only the broadcast is off. With the correct broadcast, the last usable is ${G(ipStr(ans[2]))}.`;
      else if(x===nextNet)msg=T('next_subnet',`That’s the next subnet’s network address. Count back from it: − 1 is the broadcast (${M(ipStr(c.bc))}), − 2 is the last usable, ${G(ipStr(ans[2]))}.`);
      else if(x===((c.bc-2)>>>0))msg=T('off_by_one',`Off by one. The last usable is broadcast <b>− 1</b>: ${M(ipStr(c.bc))} − 1 = ${G(ipStr(ans[2]))}.`);
      else if(oct(x,3)===254)msg=T('assume_255',`The last usable only ends in .254 when the broadcast ends in .255 <i>and</i> the octets before it match. Here the broadcast is ${M(ipStr(c.bc))}, so the last usable is ${G(ipStr(ans[2]))}.`);
    }
    if(i===3){
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
    if(sub?sub==='d2b':Math.random()<0.5) return {mode:'binary',sub:'d2b',title:'Binary · decimal → binary',prompt:`Flip on the bits that make <b class="big">${v}</b>`,
      fields:[{type:'bits',label:'Octet',answer:bin8(v)}],diag:x=>[diagBits(v,x[0])],hint:'Start at 128 and move right: if the value left is ≥ the place value, turn it on and subtract.',explain:explainBin(v)};
    return {mode:'binary',sub:'b2d',title:'Binary · binary → decimal',prompt:`What is <b class="big">${bin8(v)}</b> in decimal?`,
      fields:[{type:'num',label:'Decimal value',answer:v}],diag:x=>[diagBinDec(v,x[0])],hint:'Add the place values (128 64 32 16 8 4 2 1) for every bit that is 1.',explain:explainBin(v)};
  },
  prefix(sub){
    const p=state.level==='core'?(Math.random()<0.8?R(24,30):pick([8,16])):R(8,30);const m=maskOf(p);
    if(sub?sub==='p2m':Math.random()<0.5) return {mode:'prefix',sub:'p2m',title:'Prefix → mask',prompt:`Write the dotted-decimal subnet mask for <b class="big">/${p}</b>`,
      fields:[{type:'ip',label:'Subnet mask',answer:m}],diag:x=>[diagMask(p,x[0])],hint:`/${p} means ${p} ones followed by ${32-p} zeros. Every full octet of ones is 255.`,explain:explainMask(p)};
    return {mode:'prefix',sub:'m2p',title:'Mask → prefix',prompt:`What prefix length is <b class="big">${ipStr(m)}</b>?`,
      fields:[{type:'prefix',label:'Prefix (e.g. /26)',answer:p}],diag:x=>[diagPrefix(p,x[0])],hint:'Count the 1 bits: each 255 is 8 bits, then add the 1s in the last non-zero octet.',explain:explainMask(p)};
  },
  anding(){
    const p=randPrefix(),ip=randIP(),m=maskOf(p);
    return {mode:'anding',title:'ANDing',prompt:`IP <b>${ipStr(ip)}</b> with mask <b>${ipStr(m)}</b> (/${p}).<br>What is the network address?`,
      fields:[{type:'ip',label:'Network address',answer:(ip&m)>>>0}],diag:x=>{const u=parseIP(x[0]);if(u===((ip&m)>>>0))return[null];const c=netCtx(ip,p);return[u==null?badEntry(x[0],'ip')+` Copy the octets under 255, AND octet ${c.io+1} (${c.ipo} AND ${c.mv} = ${c.neto}), and zero the rest → ${G(ipStr(c.net))}.`:diagNet(ip,p,u,true)];},
      hint:'Copy the octets under 255. In the octet where the mask isn’t 255 or 0, write both numbers in binary and AND them: 1 only where both are 1.',explain:explainAnd(ip,p)};
  },
  detective(){
    const p=randPrefix(),ip=randIP(),m=maskOf(p),net=(ip&m)>>>0,size=2**(32-p),bc=(net+size-1)>>>0;
    return {mode:'detective',title:'Subnet chart',prompt:`Fill in the network chart for <b class="big">${ipStr(ip)}/${p}</b>`,
      fields:[{type:'ip',label:'Subnet (network)',answer:net},{type:'ip',label:'Default gateway (1st usable)',answer:(net+1)>>>0},{type:'ip',label:'Last usable',answer:(bc-1)>>>0},{type:'ip',label:'Broadcast',answer:bc},{type:'num',label:'Usable hosts',answer:size-2}],diag:x=>diagChart(ip,p,x),
      hint:`Mask is ${ipStr(m)}. Increment = 256 − the octet that isn’t 255 or 0. List the subnets (0, inc, 2×inc…) and round the IP down to one of them.`,explain:explainSubnet(ip,p)};
  },
  formulas(sub){
    const core=state.level==='core';const t=sub!=null?sub:R(0,4);
    if(t===0){const p=core?R(24,30):R(16,30),h=32-p;
      return {mode:'formulas',sub:t,title:'Host formula',prompt:`How many <u>usable</u> host addresses are in each <b class="big">/${p}</b> subnet?`,
        fields:[{type:'num',label:'Usable hosts',answer:2**h-2}],diag:x=>[diagHosts(h,x[0])],hint:`Host bits h = 32 − ${p}. Usable = 2^h − 2.`,
        explain:`<p>h = 32 − ${p} = <b>${h}</b> host bits.</p><p class="mono">2<sup>${h}</sup> − 2 = ${(2**h).toLocaleString()} − 2 = <b class="g">${(2**h-2).toLocaleString()}</b></p><p class="dim">You subtract 2 because the first address is the network address and the last is the broadcast.</p>`};}
    if(t===1){const n=R(1,6),base=core?24:pick([16,24]),ip=parseIP(base===24?`192.168.${R(0,255)}.0`:`172.${R(16,31)}.0.0`);
      return {mode:'formulas',sub:t,title:'Network formula',prompt:`You take <b>${ipStr(ip)}/${base}</b> and borrow <b class="big">${n}</b> host bit${n>1?'s':''}. How many subnets do you get?`,
        fields:[{type:'num',label:'Subnets',answer:2**n},{type:'prefix',label:'New prefix',answer:base+n}],diag:x=>[diagNetworks(n,x[0]),diagNewPrefix(base,n,x[1])],hint:'Networks = 2^n, where n is bits borrowed. The new prefix grows by n.',
        explain:`<p class="mono">2<sup>${n}</sup> = <b class="g">${2**n}</b> subnets</p><p>New prefix = /${base} + ${n} = <b class="g">/${base+n}</b> (${ipStr(maskOf(base+n))}). More network bits → more networks, fewer hosts each.</p>`};}
    if(t===2){const H=core?R(3,120):R(3,4000);let h=2;while(2**h-2<H)h++;const p=32-h;
      return {mode:'formulas',sub:t,title:'Size for hosts',prompt:`A department needs <b class="big">${H}</b> hosts. What's the smallest subnet that fits? (Give the prefix.)`,
        fields:[{type:'prefix',label:'Prefix',answer:p}],diag:x=>[diagSizeHosts(H,p,x[0])],hint:'Find the smallest h where 2^h − 2 ≥ the hosts needed. Prefix = 32 − h.',
        explain:`<p>Try host-bit counts until 2<sup>h</sup> − 2 covers ${H}:</p><p class="mono">${h>2?`h=${h-1}: 2<sup>${h-1}</sup>−2 = ${2**(h-1)-2} ✗ too small<br>`:''}h=${h}: 2<sup>${h}</sup>−2 = ${2**h-2} ✓</p><p>Prefix = 32 − ${h} = <b class="g">/${p}</b> (mask ${ipStr(maskOf(p))}).</p>`};}
    if(t===3){const N=R(2,core?60:200);let n=1;while(2**n<N)n++;const base=n>6?16:(core?24:pick([16,24]));const p=base+n;
      return {mode:'formulas',sub:t,title:'Size for networks',prompt:`You need <b class="big">${N}</b> subnets out of a <b>/${base}</b>. How many bits do you borrow, and what's the new mask?`,
        fields:[{type:'num',label:'Bits borrowed',answer:n},{type:'ip',label:'New subnet mask',answer:maskOf(p)}],diag:x=>[diagBits4Nets(N,n,x[0]),diagNewMask(base,n,x[1],x[0])],hint:'Find the smallest n where 2^n ≥ the networks needed. Add n to the prefix.',
        explain:`<p class="mono">${n>1?`n=${n-1}: 2<sup>${n-1}</sup> = ${2**(n-1)} ✗<br>`:''}n=${n}: 2<sup>${n}</sup> = ${2**n} ✓</p><p>Borrow <b class="g">${n}</b> bits → /${base} + ${n} = /${p} = <b class="g mono">${ipStr(maskOf(p))}</b>.</p>`};}
    let p=core?R(25,30):R(17,30);if(p===24)p=R(25,30);const m=maskOf(p);const io=Math.floor((p-1)/8);const mv=oct(m,io);
    return {mode:'formulas',sub:t,title:'Network increment',prompt:`What is the network increment for <b class="big">${ipStr(m)}</b>?`,
      fields:[{type:'num',label:'Increment',answer:256-mv}],diag:x=>[diagIncrement(p,x[0])],hint:'256 minus the octet that isn’t 255 or 0.',
      explain:`<p>Interesting octet (octet ${io+1}) = ${mv} = <span class="mono">${bin8(mv)}</span>. The last 1 bit sits in the <b>${256-mv}</b> position.</p><p class="mono">256 − ${mv} = <b class="g">${256-mv}</b></p><p>So subnets go 0, ${256-mv}, ${2*(256-mv)}${3*(256-mv)<256?', '+3*(256-mv):''}… in octet ${io+1}.</p>`};
  }
};


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
};
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


/* ---------------- walk me through it (subnet chart) ---------------- */
function walkSteps(ip,p){
  const m=maskOf(p),io=p%8===0?p/8:Math.floor((p-1)/8),k=io+1,mv=oct(m,io),inc=256-mv,ipo=oct(ip,io),neto=Math.floor(ipo/inc)*inc;
  const net=(ip&m)>>>0,size=2**(32-p),bc=(net+size-1)>>>0,nextNet=(net+size)>>>0,h=32-p;
  const hl=x=>[0,1,2,3].map(j=>j===io?`<b>${oct(x,j)}</b>`:oct(x,j)).join('.');
  const around=()=>{const lo=Math.max(0,neto-inc),hi=Math.min(256-inc,neto+2*inc),a=[];for(let x=lo;x<=hi;x+=inc)a.push(x);return (lo>0?'… ':'')+a.join(', ')+(hi<256-inc?' …':'');};
  return [
    {q:`/${p} as a mask is ${M(ipStr(m))}. Which octet is the <b>interesting</b> one, the first from the left that isn’t 255? (1–4)`,kind:'num',ans:k,
     bad:u=>u==null||u<1||u>4?'Enter a number from 1 to 4.':oct(m,u-1)===255?`Octet ${u} of the mask is 255: all network bits, so it just copies down from the IP. Keep moving right.`:`Octet ${u} isn’t the <i>first</i> one that’s below 255. Read the mask left to right: ${M(ipStr(m))}.`},
    {q:`What is the mask’s value in octet ${k}?`,kind:'num',ans:mv,
     bad:u=>u===ipo?`That’s the IP’s octet ${k}. I want the <i>mask’s</i>: ${M(hl(m))}.`:`Look at octet ${k} of the mask: ${M(hl(m))}.`},
    {q:`The increment is 256 − ${mv}. What is it?`,kind:'num',ans:inc,
     bad:u=>u===255-mv?'Use 256, not 255.':u===mv?`That’s the mask value. Subtract it from 256.`:`256 − ${mv} = ?`},
    {q:`The IP is ${M(hl(ip))}. In octet ${k}, subnets start at 0, ${inc}${2*inc<256?', '+2*inc:''}${3*inc<256?', '+3*inc:''}${4*inc<256?'…':''} Which start does ${ipo} round <b>down</b> to?`,kind:'num',ans:neto,
     bad:u=>u==null?'Enter a number.':u%inc!==0?`${u} isn’t a multiple of ${inc}, so it isn’t a subnet start. Count by ${inc}: ${around(u)}.`:u>ipo?`${u} is above ${ipo}. Always round down: the network is never higher than the IP.`:`The block starting at ${u} only runs to ${u+inc-1}, which doesn’t reach ${ipo}. Keep counting: ${around(u)}.`},
    {q:`Write the <b>network address</b>: octets before ${k} copy from the IP, octet ${k} is ${neto}${io<3?', and every octet after it is 0':''}.`,kind:'ip',ans:net,
     bad:(u,raw)=>u==null?badEntry(raw,'ip'):String(diagNet(ip,p,u,false))},
    {q:`The next subnet starts at ${neto+inc} in octet ${k}${neto+inc===256?' (256 means it rolls over into the octet before)':''}, so it’s ${M(ipStr(nextNet))}. The <b>broadcast</b> is the address right before that${io<3?': octet '+k+' is '+(neto+inc-1)+' and every octet after it is 255':''}. Write the broadcast.`,kind:'ip',ans:bc,
     bad:(u,raw)=>u==null?badEntry(raw,'ip'):u===nextNet?`That’s the next subnet itself. Go back one address.`:u===((bc-1)>>>0)?'That’s one too low; it’s the last usable. The broadcast is the very last address in the block.':`Next subnet ${M(ipStr(nextNet))} minus 1.`},
    {q:`Host bits = 32 − ${p} = ${h}. How many <b>usable hosts</b> is 2<sup>${h}</sup> − 2?`,kind:'num',ans:2**h-2,
     bad:(u,raw)=>String(diagHosts(h,raw)||'')},
  ].concat([{done:true,q:`You have everything for the chart. Network = ${M(ipStr(net))}. Gateway = network + 1. Last usable = broadcast − 1. Broadcast = ${M(ipStr(bc))}. Hosts = ${(2**h-2).toLocaleString()}. Fill them in above and press <b>Check</b>.`}]);
}
function renderWalk(){
  const w=state.walk,box=$('#walk');if(!w){box.hidden=true;box.innerHTML='';return;}box.hidden=false;
  const shown=v=>typeof v==='number'&&v>255?v.toLocaleString():v;
  box.innerHTML=`<div class="wk-title">Step by step <small>(counts as a hint: ½ points)</small></div><ol>`+w.steps.slice(0,w.i+1).map((st,n)=>{
    if(st.done)return `<li class="wdone-all">${st.q}</li>`;
    if(n<w.i)return `<li class="wok"><span>${st.q}</span><b class="g mono wans">✓ ${st.kind==='ip'?ipStr(st.ans):shown(st.ans)}</b></li>`;
    return `<li class="wcur"><span>${st.q}</span><div class="wrow"><input id="winp" class="winp" autocomplete="off" spellcheck="false" inputmode="${st.kind==='ip'?'decimal':'numeric'}" placeholder="${st.kind==='ip'?'e.g. 192.168.4.0':'number'}"><button class="btn small primary" id="wchk">Check step</button><button class="btn small" id="wshow">Show me</button></div><div class="wmsg" id="wmsg">${w.msg||''}</div></li>`;
  }).join('')+`</ol>`;
  const inp=$('#winp');if(!inp)return;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();walkCheck();}});
  $('#wchk').onclick=walkCheck;$('#wshow').onclick=()=>{w.i++;w.msg='';renderWalk();focusWalk();};
}
function focusWalk(){const i=$('#winp');if(i){if(isDesktop())i.focus();i.scrollIntoView({block:'nearest',behavior:'smooth'});}}
function walkCheck(){
  const w=state.walk,st=w.steps[w.i],raw=$('#winp').value;
  const u=st.kind==='ip'?parseIP(raw):toNum(raw);
  if(u===st.ans){w.i++;w.msg='';renderWalk();focusWalk();return;}
  w.msg=isBlank(raw)?'Type an answer, or press “Show me”.':st.bad(u,raw);renderWalk();
  const i=$('#winp');i.value=raw;i.classList.add('shake');focusWalk();
}

/* ---------------- game rendering ---------------- */
function renderTabs(){
  $('#tabs').innerHTML=MODES.map(m=>{const c=state.per[m.id];return `<button class="tab ${state.mode===m.id?'on':''}" data-m="${m.id}" ${state.timed?'disabled':''}>${m.name}${c.t?`<span class="ct">${c.r}/${c.t}</span>`:''}</button>`;}).join('');
  $$('#tabs .tab').forEach(b=>b.onclick=()=>{state.mode=b.dataset.m;renderTabs();next();});
}
function renderStats(){
  $('#sScore').textContent=state.score;$('#sStreak').textContent=state.streak;$('#sBest').textContent=state.best;
  $('#sAcc').textContent=state.tried?Math.round(100*state.right/state.tried)+'%':'–';
}
function fieldHTML(f,i){
  if(f.type==='bits'){const vals=[128,64,32,16,8,4,2,1];
    return `<div class="field" data-i="${i}"><label>${f.label}</label><div><div class="bits">${vals.map((v,k)=>`<div class="bitcol"><small>${v}</small><button class="bit" data-k="${k}">0</button></div>`).join('')}</div><div class="fix"></div></div></div>`;}
  const ph=f.type==='ip'?'e.g. 192.168.4.0':f.type==='prefix'?'/26':'number';
  const im=f.type==='num'?'numeric':'decimal';
  return `<div class="field" data-i="${i}"><label for="f${i}">${f.label}</label><div class="inrow"><input id="f${i}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="${im}" enterkeyhint="${i<state.q.fields.length-1?'next':'done'}" placeholder="${ph}"><span class="fix"></span></div></div>`;
}
function next(){
  let mode=state.timed||state.mode==='mixed'?pick(['binary','prefix','anding','detective','formulas']):state.mode,sub,lvl,target=null;
  if(mode==='weak'){target=pickWeak();if(target){const g=pick(WEAK[target][1]);mode=g[0];sub=g[1]===''?undefined:g[1];lvl=g[2];}else mode=pick(['binary','prefix','anding','detective','formulas']);}
  const keep=state.level;if(lvl)state.level=lvl;const q=GEN[mode](sub);state.level=keep;q.target=target;
  state.q=q;state.checked=false;state.hinted=false;
  $('#qtype').innerHTML=q.title+(target?` <span class="drill">· drilling: ${WEAK[target][0]}</span>`:'');renderWeak();$('#prompt').innerHTML=q.prompt;$('#miniQ').innerHTML=q.prompt.replace(/<br>/g,' ');
  $('#fields').innerHTML=q.fields.map(fieldHTML).join('');
  $$('#fields .bit').forEach(b=>b.onclick=()=>{if(state.checked)return;b.classList.toggle('on');b.textContent=b.classList.contains('on')?'1':'0';});
  $('#hint').hidden=true;$('#feedback').className='feedback';$('#work').style.display='none';
  $('#checkBtn').innerHTML='Check <span class="kbd">Enter</span>';$('#hintBtn').disabled=false;
  state.walk=null;renderWalk();$('#walkBtn').hidden=q.mode!=='detective';$('#walkBtn').disabled=false;
  if($('#autoClear').checked){strokes=[];redrawInk();$('#scratchText').value='';}
  const first=$('#fields input');if(first&&isDesktop())first.focus();
}
function readField(f,el){if(f.type==='bits')return $$(`.field[data-i="${el.dataset.i}"] .bit`).map(b=>b.classList.contains('on')?'1':'0').join('');return el.querySelector('input').value;}
function isRight(f,v){
  if(f.type==='bits')return v===f.answer;
  if(f.type==='ip')return parseIP(v)===f.answer;
  if(f.type==='prefix'){const m=String(v).trim().replace(/^\//,'');return /^\d+$/.test(m)&&Number(m)===f.answer;}
  const s=String(v).replace(/[,\s]/g,'');return /^\d+$/.test(s)&&Number(s)===f.answer;
}
const show=f=>f.type==='ip'?ipStr(f.answer):f.type==='prefix'?'/'+f.answer:f.type==='bits'?f.answer:Number(f.answer).toLocaleString();
function check(){
  if(state.checked){next();if(!isDesktop())$('.card').scrollIntoView({block:'start',behavior:'smooth'});return;}
  const q=state.q;let all=true;const vals=q.fields.map((f,i)=>readField(f,$(`.field[data-i="${i}"]`)));const wrong=[];
  q.fields.forEach((f,i)=>{const el=$(`.field[data-i="${i}"]`);const ok=isRight(f,vals[i]);if(!ok)wrong.push(i);
    el.classList.add(ok?'ok':'no');if(!ok){all=false;el.querySelector('.fix').textContent='→ '+show(f);}
    el.querySelectorAll('input').forEach(x=>{x.readOnly=true;x.blur();});});
  state.checked=true;state.tried++;state.per[q.mode].t++;const agg=state.timed?'mixed':(state.mode==='mixed'||state.mode==='weak')?state.mode:null;if(agg)state.per[agg].t++;
  if(all){const pts=state.hinted?5:10;state.score+=pts;state.right++;state.per[q.mode].r++;if(agg)state.per[agg].r++;noteRight(q);
    state.streak++;if(state.streak>state.best){state.best=state.streak;store.set('ss_best',state.best);}
    $('#feedback').className='feedback good';$('#feedback').textContent=pick(['Correct!','Nailed it.','Clean.','Exactly right.','Yep — that’s it.'])+` +${pts}${state.streak>2?`  ·  🔥 ${state.streak} in a row`:''}`;
    if(state.timed)state.timed.right++;
  } else {state.streak=0;$('#feedback').className='feedback bad';
    $('#feedback').textContent=wrong.length===q.fields.length?'Not quite. Here’s what went wrong:':`${q.fields.length-wrong.length} of ${q.fields.length} right. Here’s what went wrong:`;}
  if(state.timed)state.timed.tried++;
  let coach='';
  if(!all){let d=[];try{d=q.diag?q.diag(vals):[];}catch(e){d=[];}
    noteMisses([...new Set(wrong.map(i=>d[i]&&d[i].tag).filter(Boolean))]);
    const chipShown=new Set();
    coach='<div class="coach">'+wrong.map(i=>{const f=q.fields[i];const typed=isBlank(vals[i])?'(blank)':f.type==='bits'?vals[i]:String(vals[i]).trim();
      return `<div class="ci" data-i="${i}"><div class="ch"><b>${f.label}</b><span>you put <s class="mono">${esc(typed)}</s> → <b class="g mono">${show(f)}</b></span></div><p>${d[i]||'Compare with the full walkthrough below.'}</p>${d[i]&&d[i].tag&&WEAK[d[i].tag]&&!chipShown.has(d[i].tag)&&chipShown.add(d[i].tag)?`<span class="wk-chip">Logged to weak spots: ${WEAK[d[i].tag][0]}</span>`:''}</div>`;}).join('')+'</div>';}
  $('#work').innerHTML=coach+`<details class="full"${all?'':''}><summary>${all?'Show the work':'Full walkthrough'}</summary>${q.explain}</details>`;
  $('#work').style.display=all&&state.timed?'none':'block';
  $('#checkBtn').innerHTML='Next <span class="kbd">Enter</span>';$('#hintBtn').disabled=true;$('#walkBtn').disabled=true;if(state.walk){$('#walk').querySelectorAll('input,button').forEach(x=>x.disabled=true);}
  renderStats();renderTabs();renderWeak();
  if(!isDesktop())$('#feedback').scrollIntoView({block:'nearest',behavior:'smooth'});else $('#checkBtn').focus();
}
$('#checkBtn').onclick=check;
$('#hintBtn').onclick=()=>{if(state.checked)return;state.hinted=true;
  const h=$('#hint');h.innerHTML=`💡 ${state.q.hint}<br><button class="btn small" id="hintGuide">Open the step-by-step guide →</button>`;h.hidden=false;
  $('#hintGuide').onclick=()=>openTool('guide',GUIDE_FOR[state.q.mode]);};
$('#walkBtn').onclick=()=>{if(state.checked||state.walk)return;const q=state.q;state.hinted=true;
  const m=q.prompt.match(/([\d.]+)\/(\d+)/);state.walk={steps:walkSteps(parseIP(m[1]),Number(m[2])),i:0,msg:''};$('#walkBtn').disabled=true;renderWalk();focusWalk();};
$('#skipBtn').onclick=()=>{if(!state.checked){state.streak=0;renderStats();}next();};
$('#fields').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.classList.contains('bit')){e.preventDefault();check();return;}
  if(/^[1-8]$/.test(e.key)&&e.target.classList.contains('bit')&&!state.checked){e.preventDefault();const b=$(`.bit[data-k="${Number(e.key)-1}"]`);if(b)b.click();return;}
  if(e.key!=='Enter'||e.target.tagName!=='INPUT')return;e.preventDefault();
  const ins=$$('#fields input');const i=ins.indexOf(e.target);
  if(!state.checked&&!isDesktop()&&i<ins.length-1){ins[i+1].focus();return;}
  check();
});
document.addEventListener('keydown',e=>{
  if($('#overlay').classList.contains('on'))return;
  if(e.target.closest&&(e.target.closest('.tools')||e.target.closest('#fields')))return;
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT')return;
  if(e.key==='Enter'&&!e.target.closest('summary')&&!e.target.closest('button')){e.preventDefault();check();return;}
  if(/^[1-8]$/.test(e.key)&&!state.checked){const b=$(`.bit[data-k="${Number(e.key)-1}"]`);if(b)b.click();}
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
  if(sec){const d=document.getElementById(sec);if(d){d.open=true;setTimeout(()=>d.scrollIntoView({block:'start',behavior:'smooth'}),260);}}
}
const TOOL_NAMES={scratch:'✏️ Scratchpad',calc:'🧮 Calculator',guide:'📋 Guide'};
function setBig(big){tools.classList.toggle('big',big);store.set('ss_big',big);$('#tsizeLbl').textContent=big?'Smaller':'Bigger';
  $('#tsize .ic').textContent=big?'⤡':'⤢';$('#tsize').setAttribute('aria-label',big?'Make panel smaller':'Make panel bigger');
  if(tools.dataset.cur==='scratch')setTimeout(sizePad,240);}
$('#tsize').onclick=()=>setBig(!tools.classList.contains('big'));
$('#grabBtn').onclick=()=>setBig(!tools.classList.contains('big'));
setBig(store.get('ss_big',false));
function showCard(){if(isDesktop())return;const c=$('.card');const y=c.getBoundingClientRect().top+window.scrollY-8;window.scrollTo({top:y,behavior:'smooth'});}
function closeTools(){tools.classList.remove('open');document.body.classList.remove('sheet-open');$$('#dock button').forEach(b=>b.classList.remove('on'));if(document.activeElement)document.activeElement.blur();}
$$('.ttab').forEach(b=>b.onclick=()=>openTool(b.dataset.t));
$$('#dock button').forEach(b=>b.onclick=()=>{if(tools.classList.contains('open')&&tools.dataset.cur===b.dataset.t)closeTools();else openTool(b.dataset.t);});
$('#tclose').onclick=closeTools;
tools.dataset.cur='scratch';

/* ---------------- scratchpad ---------------- */
const ink=$('#ink'),gridC=$('#grid'),ictx=ink.getContext('2d'),gctx=gridC.getContext('2d');
let strokes=[],cur=null,penColor='#e6edf3',erasing=false,showGrid=store.get('ss_grid',true);
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
  vals.forEach((v,i)=>{gctx.fillStyle='#4b5869';gctx.fillText(v,w*i+w/2,8);
    if(i>0){gctx.strokeStyle='#1f2835';gctx.lineWidth=1;gctx.beginPath();gctx.moveTo(Math.round(w*i)+.5,4);gctx.lineTo(Math.round(w*i)+.5,r.height-4);gctx.stroke();}});
  gctx.strokeStyle='#26303e';gctx.beginPath();gctx.moveTo(4,28.5);gctx.lineTo(r.width-4,28.5);gctx.stroke();
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
renderTabs();renderStats();next();
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
    p.innerHTML=`<div>To install on iPhone or iPad, open this page in <b>Safari</b>, tap the <b>Share</b> button <span aria-hidden="true">(□↑)</span>, then <b>Add to Home Screen</b>.</div><div class="row"><button class="btn small">Got it</button></div>`;
    p.querySelector('button').onclick=()=>p.remove();document.body.appendChild(p);};
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    const first=!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg=>{
      if(first)navigator.serviceWorker.ready.then(()=>{if(!store.get('ss_offline_told',false)){store.set('ss_offline_told',true);toast('Saved for offline use ✓');}});
    }).catch(()=>{});
  }
})();

/* hooks for the automated tests */
window.SS={walkSteps,GEN,state,WEAK,getWeak:()=>weak,pickWeak,next,check,show,isRight,parseIP,R,netCtx,diagNet,diagChart,diagHosts,diagBits,diagBinDec,diagMask,diagPrefix,diagNetworks,diagNewPrefix,diagSizeHosts,diagBits4Nets,diagNewMask,diagIncrement};
})();
