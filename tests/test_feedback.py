"""Checks that common mistakes get the matching tailored explanation, and fuzzes every question type."""
from playwright.sync_api import sync_playwright
import os
URL=os.environ.get('SUBNET_URL','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html')))
cases=[
 # (js expression, expected substring)
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.65','172.16.62.126','172.16.62.127','62'])", "[null,null,null,null,null]"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.65','172.16.62.127','172.16.62.126','62'])[2]", "swapped"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.128','172.16.62.129','172.16.62.190','172.16.62.191','62'])[0]", "rounded up"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.128','172.16.62.129','172.16.62.190','172.16.62.191','62'])[1]", "Only the network is off"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.128','172.16.62.129','172.16.62.190','172.16.62.191','62'])[3]", "Only the network is off"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.65','172.16.62.126','172.16.62.128','62'])[3]", "next</i> subnet"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.65','172.16.62.126','172.16.62.255','62'])[3]", ".255 for the last"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.65','172.16.62.126','172.16.62.127','64'])[4]", "forgot to subtract 2"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.68','172.16.62.65','172.16.62.126','172.16.62.127','62'])[0]", "IP address you were given"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.0','172.16.62.65','172.16.62.126','172.16.62.127','62'])[0]", "isn’t in it"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.64','172.16.62.126','172.16.62.127','62'])[1]", "goes in the <b>Subnet"),
 ("diagChart(parseIP('172.16.62.68'),26,['','172.16.62.65','172.16.62.126','172.16.62.127','62'])[0]", "left this blank"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.65','172.16.62.126','172.16.62.127','sixty'])[4]", "whole number"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.64','172.16.62.65','172.16.62.125','172.16.62.127','62'])[2]", "Off by one"),
 ("diagChart(parseIP('172.16.62.68'),26,['172.16.62.66','172.16.62.65','172.16.62.126','172.16.62.127','62'])[0]", "isn’t a multiple of 64"),
 ("diagChart(parseIP('10.20.37.5'),20,['10.20.32.0','10.20.32.1','10.20.47.254','10.20.47.0','4094'])[3]", "should be 255"),
 ("diagChart(parseIP('10.20.37.5'),20,['10.20.32.5','10.20.32.1','10.20.47.254','10.20.47.255','4094'])[0]", "must be 0"),
 ("diagChart(parseIP('10.20.37.5'),20,['10.20.36.0','10.20.32.1','10.20.47.254','10.20.47.255','4094'])[0]", "/22"),
 ("diagNet(parseIP('10.103.166.35'),30,parseIP('10.103.166.255'),true)", "ORed"),
 ("diagNet(parseIP('192.168.1.200'),27,parseIP('192.168.1.186'),true)", "255 − 224"),
 ("diagNet(parseIP('192.168.1.100'),27,parseIP('192.168.1.224'),true)", "mask’s octet"),
 ("diagBits(200,'00010011')", "backwards"),
 ("diagBits(200,'11000100')", "4 too low"),
 ("diagBinDec(200,'19')", "right to left"),
 ("diagBinDec(200,'3')", "how many bits"),
 ("diagBinDec(200,'192')", "left out the 8"),
 ("diagMask(26,'255.255.255.64')", "only the value of the last 1 bit"),
 ("diagMask(26,'255.255.255.63')", "can’t appear"),
 ("diagMask(26,'255.255.192.0')", "wrong spot"),
 ("diagMask(26,'255.255.255.224')", "/27"),
 ("diagMask(26,'255.255.255.192')", "null"),
 ("diagPrefix(26,'/6')", "counted the 0s"),
 ("diagPrefix(26,'/24')", "forgot the partial"),
 ("diagPrefix(26,'/27')", "recount"),
 ("diagHosts(6,'64')", "forgot"),
 ("diagHosts(6,'12')", "not 2 ×"),
 ("diagNetworks(3,'6')", "Don’t subtract"),
 ("diagNewPrefix(24,3,'/21')", "bigger"),
 ("diagSizeHosts(62,26,'/26')", "null"),
 ("diagSizeHosts(63,25,'/26')", "only 62 usable"),
 ("diagSizeHosts(30,27,'/25')", "isn’t the smallest"),
 ("diagBits4Nets(5,3,'2')", "fewer than 5"),
 ("diagNewMask(24,3,'255.255.255.192','2')", "bits you borrowed"),
 ("diagIncrement(26,'192')", "mask octet itself"),
 ("diagIncrement(26,'63')", "Use 256"),
]
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(URL)
    bad=0
    for js,exp in cases:
        r=pg.evaluate(f"(()=>{{with(window.SS){{return JSON.stringify({js})}}}})()")
        if exp not in r: bad+=1; print('FAIL',js,'\n   ',r[:300])
    # fuzz every generator with random junk + near answers; must never throw
    n=pg.evaluate("""(()=>{with(window.SS){let n=0;const junk=['','abc','1.2.3.4','0','255.255.255.255','/24','999','10.0.0.0','-5'];
      for(let t=0;t<3000;t++){for(const m of ['binary','prefix','anding','detective','formulas']){state.level=t%2?'core':'full';const q=GEN[m]();
        const vals=q.fields.map(f=>f.type==='bits'?[...Array(8)].map(()=>Math.random()<.5?'1':'0').join(''):Math.random()<.3?show(f):junk[R(0,junk.length-1)]);
        const d=q.diag(vals);if(d.length!==q.fields.length)throw 'len '+m;
        q.fields.forEach((f,i)=>{if(isRight(f,vals[i])!==(d[i]==null))throw 'mismatch '+m+' '+f.label+' '+vals[i];});n++;}}return n;}})()""")
    print('fuzzed',n,'questions; errors:',errs); print('failed cases:',bad,'/',len(cases))
import sys; sys.exit(1 if bad or errs else 0)
