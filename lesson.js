/* Hazel Tune™ · Copyright © 2026 Hazel Management LLC. All rights reserved. Proprietary — see LICENSE. */
(function(){
/* Follow-along "sheet music" mode for piano and guitar, plus Send a tune. */
const $=id=>document.getElementById(id),H=window.HZ;
const pc=m=>((Math.round(m)%12)+12)%12;
const OPEN=[64,59,55,50,45,40],SNAME=['high E','B','G','D','A','low E'],SLAB=['e','B','G','D','A','E'];
const LOOK=3000;
let L=null;

function groupsOf(notes){const s=[...notes].sort((a,b)=>a[1]-b[1]),g=[];
 s.forEach(n=>{const last=g[g.length-1];if(last&&n[1]-last.t<45)last.notes.push(n);else g.push({t:n[1],notes:[n],state:0});});
 g.forEach(x=>x.end=Math.max(...x.notes.map(n=>n[1]+n[2])));return g;}
function hasHands(song){return song.notes.some(n=>n[3]==='R');}

/* ---------- guitar mapping ---------- */
function place(m,prev){let best=null;while(m<40)m+=12;while(m>79)m-=12;
 OPEN.forEach((o,s)=>{const f=m-o;if(f<0||f>15)return;const cost=Math.abs(f-prev)*0.6+f*0.12+(f===0?-0.4:0);if(!best||cost<best.cost)best={s:s,f:f,m:m,cost:cost};});return best;}
function guitarGroups(song){let src=song.notes;if(hasHands(song))src=src.filter(n=>n[3]==='R');
 const g=groupsOf(src);let prev=3;g.forEach(x=>{const top=x.notes.reduce((a,b)=>b[0]>a[0]?b:a);const p=place(top[0],prev);x.gs=p;prev=p?p.f:prev;x.notes=[[p?p.m:top[0],top[1],top[2]]];});return g.filter(x=>x.gs);}

/* ---------- microphone ---------- */
function micPitch(){if(!analyser)return -1;analyser.getFloatTimeDomainData(buf);const b=buf.subarray(buf.length-2048);let r=0;
 for(let i=0;i<b.length;i++)r+=b[i]*b[i];r=Math.sqrt(r/b.length);if(r<0.01)return -1;const f=yin(b,ctx.sampleRate);
 if(f<60||f>1300)return -1;return Math.round(69+12*Math.log2(f/440));}

/* ---------- engine ---------- */
async function start(kind){stop();H.stopAll();window.HZ_stopArrange&&HZ_stopArrange(true);
 const song=kind==='piano'?H.getSong():H.songByValue($('gSel').value),say=kind==='piano'?H.status:gStatus;
 if(!song){say('Pick a song first, or teach it one with Listen or Song → Piano.');return;}
 const micOk=await H.ensureMic(say);H.pauseTuner();
 const groups=kind==='piano'?groupsOf(song.notes):guitarGroups(song);if(!groups.length){say('That song has no notes to follow.');return;}
 const modeSel=kind==='piano'?$('fMode'):$('gMode'),spdSel=kind==='piano'?$('fSpeed'):$('gSpeed');
 L={kind:kind,song:song,groups:groups,gi:0,t:-2500,last:performance.now(),mode:modeSel.value,speed:+spdSel.value,hits:0,misses:0,micOk:micOk,stable:-1,stableN:0,lastHeard:-1,frame:0,lit:[],litGi:-1,
  endT:groups[groups.length-1].end};
 if(kind==='piano'){const kb=$('kb'),cv=$('roll');cv.style.display='block';sizeCanvas(cv,kb.offsetWidth,230);$('kbs').classList.add('following');$('followBtn').textContent='Stop following';$('followBtn').classList.add('rec');}
 else{sizeCanvas($('tab'),$('tab').parentElement.clientWidth-2,210);$('gStart').textContent='Stop';$('gStart').classList.add('rec');}
 say(L.mode==='wait'?'Get ready… the app waits for you to play each note.':'Get ready… play along in time.'+(micOk?'':' (Mic is off, so tap the keys instead.)'));
 L.raf=requestAnimationFrame(loop);}
function sizeCanvas(cv,w,h){const d=window.devicePixelRatio||1;cv.width=Math.round(w*d);cv.height=Math.round(h*d);cv.style.width=w+'px';cv.style.height=h+'px';cv.getContext('2d').setTransform(d,0,0,d,0,0);}
function loop(now){if(!L)return;let dt=(now-L.last)*L.speed;L.last=now;if(dt>120)dt=120;const g=L.groups[L.gi];
 if(L.mode==='wait'){if(g&&L.t+dt>=g.t)L.t=g.t;else L.t+=dt;}
 else{L.t+=dt;while(L.groups[L.gi]&&L.t>L.groups[L.gi].t+380){const x=L.groups[L.gi];if(x.state===0){x.state=2;L.misses++;}L.gi++;}}
 if(L.micOk&&(++L.frame%2===0)){const m=micPitch();if(m>=0&&m===L.stable)L.stableN++;else{L.stable=m;L.stableN=1;if(m<0)L.lastHeard=-1;}
  if(m>=0&&L.stableN===2&&m!==L.lastHeard){L.lastHeard=m;heard(m);}}
 updateTargets();draw();
 if(L.gi>=L.groups.length&&L.t>L.endT+600){finish();return;}
 L.raf=requestAnimationFrame(loop);}
function current(){if(!L)return null;if(L.mode==='wait')return L.groups[L.gi];
 for(let k=L.gi;k<L.groups.length;k++){const x=L.groups[k];if(x.t-L.t>320)break;if(x.state===0&&Math.abs(x.t-L.t)<=320)return x;}return null;}
function heard(m,tap){const g=current();if(!g)return false;
 const ok=g.notes.some(n=>pc(n[0])===pc(m));
 if(ok){g.state=1;L.hits++;if(L.kind==='piano')g.notes.forEach(n=>H.flash(n[0],'good',350));
  const k=L.groups.indexOf(g);if(k>=L.gi)L.gi=k+1;L.lastHeard=m;return true;}
 if(tap&&L.kind==='piano')H.flash(m,'bad',300);return false;}
window.HZ_onKey=m=>{if(!L||L.kind!=='piano')return false;heard(m,true);return true;};

function names(g){return g.notes.map(n=>H.nn(n[0])).join(' + ');}
function updateTargets(){const g=L.groups[L.gi];if(L.litGi===L.gi)return;L.litGi=L.gi;
 if(L.kind==='piano'){L.lit.forEach(m=>H.keyEl[m]&&H.keyEl[m].classList.remove('next'));L.lit=[];
  if(g){g.notes.forEach(n=>{if(H.keyEl[n[0]]){H.keyEl[n[0]].classList.add('next');L.lit.push(n[0]);}});H.scrollToKey(g.notes[0][0]);
   $('pNow').textContent=names(g);H.status((L.mode==='wait'?'Play ':'Next: ')+names(g)+'  ·  '+(L.gi+1)+' of '+L.groups.length+'  ·  '+L.hits+' hit');
   if(L.song.chords)H.markChordAt(g.t);}}
 else if(g){const s=g.gs;$('gNow').textContent='Fret '+s.f+' · '+SNAME[s.s]+' string';
  gStatus((L.mode==='wait'?'Play ':'Next: ')+H.nn(g.notes[0][0])+' ('+(s.f===0?'open string':'fret '+s.f)+')  ·  '+(L.gi+1)+' of '+L.groups.length+'  ·  '+L.hits+' hit');
  const ch=chordAt(L.song,g.t);$('gChord').textContent=ch?'Chord: '+ch:'';}}
function chordAt(song,t){if(!song.chords)return '';let c='';song.chords.forEach(x=>{if(x.t<=t)c=x.name;});return c;}

/* ---------- drawing ---------- */
function rr(c,x,y,w,h,r){r=Math.min(r,h/2,w/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function col(g,n){return g.state===1?'#5fcf80':g.state===2?'#e2614b':(n[3]==='L'?'#b98a4e':'#d4a94f');}
function draw(){if(L.kind==='piano')drawRoll();else drawTab();}
function drawRoll(){const cv=$('roll'),c=cv.getContext('2d'),w=parseFloat(cv.style.width),h=parseFloat(cv.style.height),pp=h/LOOK;
 c.clearRect(0,0,w,h);
 for(let m=H.LOW;m<=H.HIGH;m++){if(m%12===0){const k=H.keyEl[m];c.fillStyle='rgba(244,236,220,.06)';c.fillRect(k.offsetLeft,0,1,h);}}
 L.groups.forEach(g=>{if(g.t-L.t>LOOK+50||g.end-L.t<-400)return;g.notes.forEach(n=>{const k=H.keyEl[n[0]];if(!k)return;
  const y2=h-(n[1]-L.t)*pp,y1=h-(n[1]+n[2]-L.t)*pp,top=Math.max(y1,y2-Math.max(n[2]*pp,12));
  c.fillStyle=col(g,n);c.globalAlpha=g.state===0?1:.75;rr(c,k.offsetLeft+3,top,k.offsetWidth-6,Math.max(12,y2-top)-1,5);c.fill();c.globalAlpha=1;
  if(k.offsetWidth>30&&y2-top>16){c.fillStyle='#1b140b';c.font='600 11px Outfit,system-ui,sans-serif';c.textAlign='center';c.fillText(H.nn(n[0]).replace(/\d/,''),k.offsetLeft+k.offsetWidth/2,y2-6);}});});
 c.fillStyle='#d4a94f';c.fillRect(0,h-2,w,2);}
function drawTab(){const cv=$('tab'),c=cv.getContext('2d'),w=parseFloat(cv.style.width),h=parseFloat(cv.style.height),x0=50,top=34,gap=(h-top-18)/5,pp=(w-x0-10)/3500;
 c.clearRect(0,0,w,h);c.font='500 12px Outfit,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';
 for(let s=0;s<6;s++){const y=top+s*gap;c.strokeStyle='#b9ab90';c.lineWidth=0.8+s*0.35;c.beginPath();c.moveTo(x0-8,y);c.lineTo(w,y);c.stroke();c.fillStyle='#a89a84';c.fillText(SLAB[s],16,y);}
 if(L.song.chords)L.song.chords.forEach(ch=>{const x=x0+(ch.t-L.t)*pp;if(x<x0-20||x>w)return;c.fillStyle='#a89a84';c.fillText(ch.name,x,12);c.fillStyle='rgba(244,236,220,.08)';c.fillRect(x,20,1,h-26);});
 L.groups.forEach(g=>{const x=x0+(g.t-L.t)*pp;if(x<x0-30||x>w+20)return;const s=g.gs,y=top+s.s*gap;
  c.fillStyle=col(g,g.notes[0]);c.beginPath();c.arc(x,y,12,0,7);c.fill();c.fillStyle='#1b140b';c.font='600 13px Outfit,system-ui,sans-serif';c.fillText(String(s.f),x,y+0.5);c.font='500 12px Outfit,system-ui,sans-serif';});
 c.fillStyle='#d4a94f';c.fillRect(x0-1,22,3,h-26);}

/* ---------- finish / stop ---------- */
function finish(){const total=L.groups.length,hit=L.hits,pct=Math.round(hit/total*100),kind=L.kind;stop();
 const msg='Done! You hit '+hit+' of '+total+' notes ('+pct+'%). '+(pct>=90?'Excellent.':pct>=60?'Nice work, run it again to lock it in.':'Try a slower speed and build up.');
 if(kind==='piano'){H.status(msg);$('pNow').textContent=pct+'%';}else{gStatus(msg);$('gNow').textContent=pct+'%';}try{typeof ding==='function'&&ding();}catch(e){}}
function stop(){if(!L)return;cancelAnimationFrame(L.raf);if(L.kind==='piano'){L.lit.forEach(m=>H.keyEl[m]&&H.keyEl[m].classList.remove('next'));$('roll').style.display='none';$('kbs').classList.remove('following');$('followBtn').textContent='Follow along';$('followBtn').classList.remove('rec');}
 else{$('gStart').textContent='Start';$('gStart').classList.remove('rec');}L=null;}
window.HZ_stopLesson=stop;

/* ---------- guitar view ---------- */
function gStatus(t){$('gStat').textContent=t;}
function fillG(){const keep=$('gSel').value,src=$('songSel');$('gSel').innerHTML=src.innerHTML;$('gSel').querySelector('option[value="free"]')?.remove();
 if([...$('gSel').options].some(o=>o.value===keep))$('gSel').value=keep;else{const s=H.getSel();if(s!=='free')$('gSel').value=s;}}
window.HZ_onSongsChanged=fillG;
function previewTab(){if(L)return;const song=H.songByValue($('gSel').value);if(!song)return;const groups=guitarGroups(song);
 L={kind:'guitar',song:song,groups:groups,gi:0,t:-600,mode:'wait'};sizeCanvas($('tab'),$('tab').parentElement.clientWidth-2,210);drawTab();L=null;
 $('gNow').textContent=song.name;gStatus(groups.length+' notes on the guitar. Tap Start, then play each note as it reaches the gold line.');$('gChord').textContent='';}
$('gSel').onchange=previewTab;$('gStart').onclick=()=>{if(L&&L.kind==='guitar'){stop();gStatus('Stopped.');}else start('guitar');};
$('followBtn').onclick=()=>{if(L&&L.kind==='piano'){stop();H.status('Stopped.');}else start('piano');};
[$('fMode'),$('fSpeed'),$('gMode'),$('gSpeed')].forEach(s=>s.onchange=()=>{if(L){L.mode=(L.kind==='piano'?$('fMode'):$('gMode')).value;L.speed=+(L.kind==='piano'?$('fSpeed'):$('gSpeed')).value;}});
document.querySelector('.tab[data-v="guitar"]').addEventListener('click',()=>setTimeout(previewTab,40));

/* ---------- Send a tune ---------- */
function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unb64(t){t=t.replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';const s=atob(t),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}
function encode(song){const name=new TextEncoder().encode((song.name||'A tune').slice(0,40)),ns=[...song.notes].sort((a,b)=>a[1]-b[1]).slice(0,400),bytes=[1,name.length,...name];let prev=0;
 ns.forEach(n=>{const d=Math.min(65535,Math.max(0,Math.round((n[1]-prev)/10))),du=Math.min(65535,Math.max(1,Math.round(n[2]/10)));prev+=d*10;bytes.push((n[0]&127)|(n[3]==='L'?128:0),d>>8,d&255,du>>8,du&255);});return b64(bytes);}
function decode(code){const a=unb64(code);if(a[0]!==1)throw 0;const nl=a[1],name=new TextDecoder().decode(a.slice(2,2+nl)),notes=[];let t=0;
 for(let i=2+nl;i+4<a.length;i+=5){t+=((a[i+1]<<8)|a[i+2])*10;const m=a[i]&127,n=[m,t,((a[i+3]<<8)|a[i+4])*10];if(a[i]&128)n.push('L');else n.push('R');notes.push(n);}
 if(!notes.some(n=>n[3]==='L'))notes.forEach(n=>n.pop());return {name:name,notes:notes};}
async function share(){const song=H.getSong();if(!song){H.status('Pick a song, or record one with Listen, then tap Send a tune.');return;}
 const url=location.origin+location.pathname+'#t='+encode(song),text='I sent you a tune on Hazel Tune: "'+song.name+'". Open it to hear it and learn to play it.';
 try{if(navigator.share){await navigator.share({title:'Hazel Tune',text:text,url:url});H.status('Tune sent.');return;}}catch(e){if(e&&e.name==='AbortError')return;}
 try{await navigator.clipboard.writeText(url);H.status('Link copied. Paste it in a text to send this tune.');}catch(e){H.status('Copy this link to send the tune: '+url);}}
$('shareBtn').onclick=share;
window.HZ_afterInit=()=>{fillG();const h=location.hash;if(h.startsWith('#t=')){try{const s=decode(h.slice(3));s.name='From a friend: '+s.name;const recs=H.loadRecs();recs.unshift(s);H.saveRecs(recs);
  history.replaceState(null,'',location.pathname);H.view('piano');H.selectSong(s.name);H.status('Someone sent you a tune! Tap Play song to hear it, or Follow along to learn it.');$('pNow').textContent='New tune';}
 catch(e){H.status('That tune link looks broken.');}}};
window.HZ_tune={encode:encode,decode:decode,groupsOf:groupsOf,guitarGroups:guitarGroups};
})();
