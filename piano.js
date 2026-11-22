(function(){
const $=id=>document.getElementById(id);
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],BLK=[1,3,6,8,10];
const LOW=48,HIGH=84,W=40,BEAT=480;
const mf=m=>440*Math.pow(2,(m-69)/12),nn=m=>NAMES[m%12]+(Math.floor(m/12)-1);
const kb=$('kb'),kbs=$('kbs'),keyEl={};
let mode='free',song=null,idx=0,playTimers=[],listenTimer=null,rec=[],cand=-1,candN=0,cur=null,env=0,quietN=0,listenStart=0;

function A(){ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();if(ctx.state!=='running')ctx.resume();return ctx;}
function status(t){$('pStat').textContent=t;}

/* ---------- keyboard ---------- */
function buildKb(){kb.innerHTML='';const whites=[];for(let m=LOW;m<=HIGH;m++)if(!BLK.includes(m%12))whites.push(m);
 kb.style.width=(whites.length*W)+'px';
 whites.forEach((m,k)=>{const d=document.createElement('div');d.className='wk';d.style.left=(k*W)+'px';d.style.width=W+'px';d.dataset.m=m;
  d.innerHTML='<span>'+NAMES[m%12]+(m%12===0?'<sub>'+(Math.floor(m/12)-1)+'</sub>':'')+'</span>';kb.appendChild(d);keyEl[m]=d;});
 for(let m=LOW;m<=HIGH;m++)if(BLK.includes(m%12)){const k=whites.indexOf(m-1),d=document.createElement('div');d.className='bk';d.style.left=((k+1)*W-13)+'px';d.dataset.m=m;d.innerHTML='<span>'+NAMES[m%12]+'</span>';kb.appendChild(d);keyEl[m]=d;}}
function scrollToKey(m,left){const k=keyEl[m];if(!k)return;const x=k.offsetLeft,vw=kbs.clientWidth,sl=kbs.scrollLeft;
 if(left){kbs.scrollLeft=x-8;return;}if(x<sl+10||x+W>sl+vw-10)kbs.scrollTo({left:x-vw/2+W/2,behavior:'smooth'});}
function flash(m,cls,ms){const k=keyEl[m];if(!k)return;k.classList.add(cls);setTimeout(()=>k.classList.remove(cls),ms);}
function clearKeys(){Object.values(keyEl).forEach(k=>k.classList.remove('next','play','hear','good','bad','hit'));}

/* ---------- piano sound ---------- */
function playNote(m,dur){const c=A(),t=c.currentTime+0.005,f=mf(m);dur=dur||Math.max(0.9,2.4-(m-48)*0.03);
 const out=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';
 lp.frequency.setValueAtTime(Math.min(9000,f*14),t);lp.frequency.exponentialRampToValueAtTime(Math.max(f*2.5,500),t+dur);
 lp.connect(out);out.connect(c.destination);const v=0.42;
 out.gain.setValueAtTime(0.0001,t);out.gain.exponentialRampToValueAtTime(v,t+0.006);out.gain.exponentialRampToValueAtTime(v*0.32,t+0.28);out.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 [[1,1],[2,.5],[3,.28],[4,.14],[5,.08],[6,.05],[7,.03]].forEach(([h,a],j)=>{const o=c.createOscillator(),g=c.createGain();
  o.type=j?'sine':'triangle';o.frequency.value=f*h*(1+0.00035*h*h);o.detune.value=j%2?2.5:-2.5;g.gain.value=a;o.connect(g);g.connect(lp);o.start(t);o.stop(t+dur+0.05);});}

/* ---------- songs (public domain) ---------- */
function toMidi(n){const mm=n.match(/^([A-G]#?)(\d)$/);return NAMES.indexOf(mm[1])+12*(+mm[2]+1);}
function mk(name,str){let t=0;const notes=str.trim().split(/\s+/).map(x=>{const [n,b]=x.split(':'),d=parseFloat(b||1)*BEAT,r=[toMidi(n),t,d];t+=d;return r;});return {name:name,notes:notes};}
const SONGS=[
 mk('Twinkle Twinkle Little Star','C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'),
 mk('Ode to Joy','E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2'),
 mk('Mary Had a Little Lamb','E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'),
 mk('Happy Birthday','G3:0.75 G3:0.25 A3 G3 C4 B3:2 G3:0.75 G3:0.25 A3 G3 D4 C4:2 G3:0.75 G3:0.25 G4 E4 C4 B3 A3:2 F4:0.75 F4:0.25 E4 C4 D4 C4:2')
];
function loadRecs(){try{return JSON.parse(localStorage.getItem('hazelPianoRecs')||'[]');}catch(e){return [];}}
function saveRecs(r){try{localStorage.setItem('hazelPianoRecs',JSON.stringify(r.slice(0,5)));}catch(e){}}
function fillSongs(selectName){const s=$('songSel');s.innerHTML='<option value="free">Free play</option>';
 const g1=document.createElement('optgroup');g1.label='Songs';SONGS.forEach((x,i)=>{const o=new Option(x.name,'s'+i);g1.appendChild(o);});s.appendChild(g1);
 const recs=loadRecs();if(recs.length){const g2=document.createElement('optgroup');g2.label='Learned by ear';recs.forEach((x,i)=>g2.appendChild(new Option(x.name,'r'+i)));s.appendChild(g2);}
 if(selectName){const o=[...s.options].find(o=>o.text===selectName);if(o)s.value=o.value;}}
function pickSong(){stopAll();const v=$('songSel').value;
 song=v==='free'?null:v[0]==='s'?SONGS[+v.slice(1)]:loadRecs()[+v.slice(1)];idx=0;renderStrip();
 status(song?song.notes.length+' notes. Tap Play song to hear it, or Practice to play it yourself.':'Tap the keys to play, or pick a song.');
 if(song)scrollToKey(song.notes[0][0]);}

/* ---------- note strip ---------- */
function renderStrip(list){const el=$('strip');el.innerHTML='';(list||(song?song.notes:[])).forEach((n,k)=>{const c=document.createElement('span');c.className='chip';c.textContent=nn(n[0]);el.appendChild(c);});markStrip();}
function markStrip(){const ch=$('strip').children;for(let k=0;k<ch.length;k++){ch[k].classList.toggle('ok',k<idx);ch[k].classList.toggle('cur',k===idx&&mode!=='free');}
 const c=ch[idx];if(c&&mode!=='free'){const el=$('strip');if(c.offsetTop<el.scrollTop||c.offsetTop>el.scrollTop+el.clientHeight-30)el.scrollTop=c.offsetTop-8;}}

/* ---------- playing ---------- */
function press(m){playNote(m);flash(m,'hit',220);$('pNow').textContent=nn(m);
 if(mode==='practice'&&song){const t=song.notes[idx][0];
  if(m===t){keyEl[t].classList.remove('next');flash(m,'good',380);idx++;markStrip();if(idx>=song.notes.length)finish();else cue();}
  else{flash(m,'bad',380);status('Not quite. Find the glowing key: '+nn(t));}}}
kb.addEventListener('pointerdown',e=>{const k=e.target.closest('[data-m]');if(!k)return;e.preventDefault();press(+k.dataset.m);});

function cue(){clearKeys();const t=song.notes[idx][0];keyEl[t].classList.add('next');scrollToKey(t);
 status('Play '+nn(t)+'  ·  note '+(idx+1)+' of '+song.notes.length);}
function finish(){mode='free';clearKeys();markStrip();status('You played the whole song! Tap Practice to go again.');$('pNow').textContent='Nice!';try{typeof ding==='function'&&ding();}catch(e){}}

function playSong(){stopAll();if(!song){status('Pick a song first, or tap Listen to learn one by ear.');return;}
 mode='play';idx=0;renderStrip();A();const n=song.notes;status('Playing '+song.name+'…');
 n.forEach(([m,st,du],k)=>playTimers.push(setTimeout(()=>{playNote(m,Math.max(0.6,du/1000*1.4));flash(m,'play',Math.max(160,du*0.85));idx=k;markStrip();scrollToKey(m);$('pNow').textContent=nn(m);},st+120)));
 const e=n[n.length-1];playTimers.push(setTimeout(()=>{mode='free';idx=n.length;markStrip();status('Done. Tap Practice to play it yourself.');},e[1]+e[2]+500));}
function practice(){stopAll();if(!song){status('Pick a song first, or tap Listen to learn one by ear.');return;}mode='practice';idx=0;renderStrip();cue();$('pNow').textContent='Your turn';}
function stopAll(){playTimers.forEach(clearTimeout);playTimers=[];if(listenTimer)stopListen();mode='free';clearKeys();markStrip();}

/* ---------- listen & learn ---------- */
async function listen(){if(listenTimer){stopListen();return;}stopAll();A();
 if(!analyser){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){status('The mic is blocked here. Open Hazel Tune in Safari or Chrome to use Listen.');return;}
  try{const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   const src=ctx.createMediaStreamSource(st);analyser=ctx.createAnalyser();analyser.fftSize=4096;src.connect(analyser);buf=new Float32Array(analyser.fftSize);}
  catch(e){status('Allow the microphone to use Listen (Settings → Safari → Microphone).');return;}}
 if(timer){clearInterval(timer);timer=null;$('startBtn').textContent='Start tuning';}
 rec=[];cand=-1;candN=0;cur=null;env=0;quietN=0;mode='listen';listenStart=performance.now();$('strip').innerHTML='';
 listenTimer=setInterval(lTick,30);$('listenBtn').textContent='Stop listening';$('listenBtn').classList.add('rec');
 status('Listening… play the song or hum the tune near your phone, then tap Stop listening.');$('pNow').textContent='Listening';}
function lTick(){analyser.getFloatTimeDomainData(buf);const b=buf.subarray(buf.length-2048);let r=0;for(let i=0;i<b.length;i++)r+=b[i]*b[i];r=Math.sqrt(r/b.length);
 const now=performance.now(),onset=r>0.02&&r>env*1.5;env=env*0.85+r*0.15;
 if(r<0.008){quietN++;if(quietN>=2&&cur)cur.gap=true;if(quietN>3)endCur(now);return;}quietN=0;
 const f=yin(b,ctx.sampleRate);if(f<60||f>1100)return;
 let m=Math.round(69+12*Math.log2(f/440));while(m<LOW)m+=12;while(m>HIGH)m-=12;
 if(m===cand)candN++;else{cand=m;candN=1;}
 if(cur&&cur.m===m&&(cur.gap||onset)&&now-cur.t>120)endCur(now);
 if(candN>=3&&(!cur||cur.m!==m)){endCur(now);cur={m:m,t:now};keyEl[m]&&keyEl[m].classList.add('hear');scrollToKey(m);$('pNow').textContent=nn(m);}}
function endCur(now){if(!cur)return;keyEl[cur.m]&&keyEl[cur.m].classList.remove('hear');const d=now-cur.t;
 if(d>=70){rec.push([cur.m,cur.t-listenStart,d]);const c=document.createElement('span');c.className='chip';c.textContent=nn(cur.m);$('strip').appendChild(c);$('strip').scrollTop=1e6;}cur=null;}
function stopListen(){clearInterval(listenTimer);listenTimer=null;endCur(performance.now());$('listenBtn').textContent='Listen';$('listenBtn').classList.remove('rec');mode='free';clearKeys();
 if(rec.length<2){status("I didn't catch a clear melody. Try again closer to the sound, or hum it.");$('pNow').textContent='Tap the keys to play';return;}
 const t0=rec[0][1],d=new Date(),name='Learned '+d.toLocaleDateString([], {month:'short',day:'numeric'})+' '+d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
 const s={name:name,notes:rec.map(([m,st,du])=>[m,Math.round(st-t0),Math.round(du)])};
 const recs=loadRecs();recs.unshift(s);saveRecs(recs);fillSongs(name);song=s;idx=0;renderStrip();
 status('Got '+s.notes.length+' notes. Tap Practice to learn it, or Play song to hear it back.');$('pNow').textContent='Learned!';}

/* ---------- view switching ---------- */
function view(v){$('tunerView').style.display=v==='tuner'?'':'none';$('pianoView').style.display=v==='piano'?'':'none';
 document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.v===v));
 $('autoBtn').style.visibility=v==='tuner'?'visible':'hidden';$('foot').textContent=v==='piano'?'Hazel Management · Piano · v1.4':(twelve?'Hazel Management · 12-string standard tuning · v1.4':'Hazel Management · Standard tuning E A D G B E · v1.4');$('brandSub').textContent=v==='tuner'?'Tune · Guitar tuner':'Keys · Piano';
 if(v==='piano'){if(timer){clearInterval(timer);timer=null;$('startBtn').textContent='Start tuning';$('status').textContent='Paused';}setTimeout(()=>scrollToKey(song?song.notes[0][0]:60,!song),30);}
 else stopAll();try{localStorage.setItem('hazelView',v);}catch(e){}}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>view(t.dataset.v));
$('listenBtn').onclick=listen;$('playSongBtn').onclick=playSong;$('practiceBtn').onclick=practice;$('stopBtn').onclick=()=>{stopAll();status('Stopped.');};
$('songSel').onchange=pickSong;$('namesChk').onchange=e=>kb.classList.toggle('nonames',!e.target.checked);
$('octL').onclick=()=>kbs.scrollBy({left:-7*W,behavior:'smooth'});$('octR').onclick=()=>kbs.scrollBy({left:7*W,behavior:'smooth'});
buildKb();fillSongs();let v0='tuner';try{v0=localStorage.getItem('hazelView')||'tuner';}catch(e){}view(v0);
})();
