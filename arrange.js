(function(){
/* Song → Piano: listen to any song and build a rough two-hand "dueling piano" version.
   Left hand turns the drums into a stride bass (root on the kick, chord on the snare),
   right hand plays the melody it can hear, or chord stabs when the melody is buried. */
const $=id=>document.getElementById(id),H=window.HZ;
const CN=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const TPL=[];for(let r=0;r<12;r++){TPL.push({r:r,q:'',v:[0,4,7].map(i=>(r+i)%12)});TPL.push({r:r,q:'m',v:[0,3,7].map(i=>(r+i)%12)});}
let A=null;

function matchChord(ch,bass){let tot=0;for(let i=0;i<12;i++)tot+=ch[i];if(tot<=0)return null;const n=ch.map(x=>x/tot);
 let best=null;TPL.forEach(t=>{let s=t.v.reduce((a,p)=>a+n[p],0);let bmax=0,bp=-1;for(let i=0;i<12;i++)if(bass[i]>bmax){bmax=bass[i];bp=i;}if(bp===t.r)s+=0.12;
  s-=0.25*n[(t.r+(t.q?4:3))%12];if(!best||s>best.s)best={r:t.r,q:t.q,s:s};});return best;}
const cname=c=>c?CN[c.r]+c.q:'';

async function toggle(){if(A){finish();return;}H.stopAll();window.HZ_stopLesson&&HZ_stopLesson();if(!(await H.ensureMic()))return;H.pauseTuner();
 analyser.smoothingTimeConstant=0.2;A={t0:performance.now(),frames:[],prev:null,fd:new Float32Array(analyser.frequencyBinCount),timer:setInterval(capture,20)};
 $('arrBtn').textContent='Stop & arrange';$('arrBtn').classList.add('rec');$('pNow').textContent='Listening';
 H.status('Play the song out loud near your phone. Give it at least 20–30 seconds, then tap Stop & arrange.');}
function capture(){const now=performance.now()-A.t0,sr=ctx.sampleRate,N=analyser.fftSize,fd=A.fd;analyser.getFloatFrequencyData(fd);
 const mag=new Float32Array(fd.length);for(let i=0;i<fd.length;i++)mag[i]=Math.pow(10,fd[i]/20);
 let flux=0,lo=0,hi=0;if(A.prev){for(let i=1;i<fd.length;i++){const d=Math.log1p(mag[i]*1000)-Math.log1p(A.prev[i]*1000);if(d>0){const f=i*sr/N;flux+=d;if(f<150)lo+=d;else if(f>2000&&f<8000)hi+=d;}}}A.prev=mag;
 const fr={t:now,flux:flux,lo:lo,hi:hi,mel:-1};
 if(A.frames.length%5===0){const ch=new Array(12).fill(0),bass=new Array(12).fill(0);
  for(let i=2;i<fd.length;i++){const f=i*sr/N;if(f<40)continue;if(f>2500)break;const p=((Math.round(69+12*Math.log2(f/440))%12)+12)%12,w=mag[i]*mag[i];if(f<250)bass[p]+=w;else ch[p]+=w;}
  fr.ch=ch;fr.bass=bass;}
 if(A.frames.length%3===0){analyser.getFloatTimeDomainData(buf);const b=buf.subarray(buf.length-2048);let r=0;for(let i=0;i<b.length;i++)r+=b[i]*b[i];r=Math.sqrt(r/b.length);
  if(r>0.015){const f=yin(b,sr);if(f>150&&f<1100)fr.mel=Math.round(69+12*Math.log2(f/440));}}
 A.frames.push(fr);
 if(A.frames.length%25===0){const ch=new Array(12).fill(0),bass=new Array(12).fill(0);A.frames.slice(-50).forEach(x=>{if(x.ch)for(let i=0;i<12;i++){ch[i]+=x.ch[i];bass[i]+=x.bass[i];}});
  const c=matchChord(ch,bass),s=Math.round(now/1000);$('pNow').textContent=c?cname(c):'…';H.status('Listening… '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+'  ·  hearing '+(c?cname(c):'—')+'  ·  tap Stop & arrange when ready');}
 if(now>90000)finish();}

function finish(silent){if(!A)return;clearInterval(A.timer);const F=A.frames;A=null;analyser.smoothingTimeConstant=0.8;
 $('arrBtn').textContent='Song → Piano';$('arrBtn').classList.remove('rec');if(silent)return;
 if(F.length<250){H.status('I need a longer listen, at least 10 seconds of the song. Try again.');$('pNow').textContent='Tap the keys to play';return;}
 const song=arrange(F);if(!song){H.status("I couldn't find a clear beat or chords. Turn the song up, move closer, and try again.");return;}
 const recs=H.loadRecs();recs.unshift(song);H.saveRecs(recs);H.selectSong(song.name);
 const prog=[];song.chords.forEach(c=>{if(prog[prog.length-1]!==c.name)prog.push(c.name);});
 H.status('Piano version ready · about '+song.bpm+' BPM · chords '+prog.slice(0,8).join(' ')+(prog.length>8?' …':'')+'. Gold keys = right hand, tan = left hand. Tap Play song or Follow along.');
 $('pNow').textContent='Arranged!';}
window.HZ_stopArrange=finish;

function arrange(F){const n=F.length,dt=(F[n-1].t-F[0].t)/(n-1),t0=F[0].t;
 const on=F.map(f=>f.flux),mean=on.reduce((a,b)=>a+b,0)/n;const o=on.map(x=>Math.max(0,x-mean));
 // tempo by autocorrelation, nudged toward common tempos
 const lmin=Math.max(2,Math.round(60000/180/dt)),lmax=Math.round(60000/65/dt);let best=null;
 for(let lag=lmin;lag<=lmax;lag++){let s=0;for(let i=0;i+lag<n;i++)s+=o[i]*o[i+lag];s/=(n-lag);const bpm=60000/(lag*dt),w=Math.exp(-0.5*Math.pow(Math.log2(bpm/115)/0.8,2));if(!best||s*w>best.s)best={lag:lag,s:s*w,bpm:bpm};}
 if(!best||best.s<=0)return null;const lag=best.lag,beatMs=lag*dt;
 let off=0,bs=-1;for(let k=0;k<lag;k++){let s=0;for(let i=k;i<n;i+=lag)s+=o[i];if(s>bs){bs=s;off=k;}}
 const beats=[];for(let i=off;i<n;i+=lag)beats.push(F[i].t-t0);
 if(beats.length<6)return null;
 const near=(t,key)=>{let m=0;F.forEach(f=>{if(Math.abs(f.t-t0-t)<=dt*2.5&&f[key]>m)m=f[key];});return m;};
 const kick=beats.map(t=>near(t,'lo')),snare=beats.map(t=>near(t,'hi'));
 let down=0,ds=-1;for(let p=0;p<4;p++){let s=0;for(let j=p;j<beats.length;j+=4)s+=kick[j];if(s>ds){ds=s;down=p;}}
 // chords every 2 beats
 const chords=[];let prev=null;
 for(let j=down%2;j<beats.length;j+=2){const a=beats[j],b=beats[j+2]||a+beatMs*2,ch=new Array(12).fill(0),bass=new Array(12).fill(0);
  F.forEach(f=>{const t=f.t-t0;if(f.ch&&t>=a&&t<b)for(let i=0;i<12;i++){ch[i]+=f.ch[i];bass[i]+=f.bass[i];}});
  let c=matchChord(ch,bass);if(prev&&c){const keepScore=TPL.find(x=>x.r===prev.r&&x.q===prev.q);if(c.s-0.04<scoreOf(ch,bass,keepScore))c=prev;}
  if(!c)c=prev;if(!c)continue;prev=c;chords.push({t:Math.round(a),name:cname(c),r:c.r,q:c.q,j:j});}
 if(!chords.length)return null;
 const chordAtBeat=j=>{let c=chords[0];chords.forEach(x=>{if(x.j<=j)c=x;});return c;};
 const notes=[],ks=kick.slice().sort((a,b)=>a-b)[Math.floor(kick.length*0.6)]||0,hiAvg=snare.reduce((a,b)=>a+b,0)/snare.length;
 const bassNote=r=>{let m=36+r;if(m<40)m+=12;return m;},lhChord=c=>{const v=[c.r,(c.r+(c.q?3:4))%12,(c.r+7)%12].map(p=>48+p).map(m=>m<50?m+12:m);return v.sort((a,b)=>a-b);};
 const rhChord=c=>{const v=[c.r,(c.r+(c.q?3:4))%12,(c.r+7)%12].map(p=>60+p).map(m=>m<62?m+12:m);return v.sort((a,b)=>a-b);};
 const B=Math.round(beatMs);
 beats.forEach((t,j)=>{if(j<down)return;const q=(j-down)%4,c=chordAtBeat(j),T=Math.round(t);
  if(q===0)notes.push([bassNote(c.r),T,B,'L']);
  else if(q===2)notes.push([kick[j]>=ks?bassNote(c.r):bassNote((c.r+7)%12),T,B,'L']);
  else lhChord(c).forEach(m=>notes.push([m,T,Math.round(B*0.6),'L']));});
 // right hand: melody on an eighth-note grid
 const half=beatMs/2,slots=[];for(let s=beats[down];s<beats[beats.length-1]+beatMs;s+=half)slots.push({t:s,v:[]});
 F.forEach(f=>{if(f.mel<0)return;const k=Math.floor((f.t-t0-beats[down])/half);if(k>=0&&k<slots.length)slots[k].v.push(f.mel);});
 const mel=[];let cover=0;slots.forEach(s=>{if(s.v.length>=2){const cnt={};s.v.forEach(m=>cnt[m]=(cnt[m]||0)+1);let m=+Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];while(m<60)m+=12;while(m>84)m-=12;cover++;
   const last=mel[mel.length-1];if(last&&last[0]===m&&Math.abs(last[1]+last[2]-s.t)<half*0.6)last[2]+=half;else mel.push([m,Math.round(s.t),Math.round(half),'R']);}});
 if(cover/slots.length>=0.3)mel.forEach(n=>notes.push(n));
 else beats.forEach((t,j)=>{if(j<down)return;const q=(j-down)%4,c=chordAtBeat(j);
  if(q===0||q===2)rhChord(c).forEach(m=>notes.push([m,Math.round(t),Math.round(B*0.5),'R']));
  if(hiAvg>0&&(q===1||q===3))rhChord(c).forEach(m=>notes.push([m,Math.round(t+half),Math.round(B*0.4),'R']));});
 const st=Math.min(...notes.map(x=>x[1]));notes.forEach(x=>x[1]-=st);chords.forEach(c=>c.t-=st);
 const d=new Date();return {name:'Piano version '+d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}),bpm:Math.round(60000/beatMs),
  chords:chords.map(c=>({t:Math.max(0,c.t),name:c.name})),notes:notes.sort((a,b)=>a[1]-b[1]),melody:cover/slots.length>=0.3};}
function scoreOf(ch,bass,t){if(!t)return -9;let tot=0;for(let i=0;i<12;i++)tot+=ch[i];if(!tot)return -9;let s=t.v.reduce((a,p)=>a+ch[p]/tot,0);let bmax=0,bp=-1;for(let i=0;i<12;i++)if(bass[i]>bmax){bmax=bass[i];bp=i;}if(bp===t.r)s+=0.12;s-=0.25*ch[(t.r+(t.q?4:3))%12]/tot;return s;}
$('arrBtn').onclick=toggle;
window.HZ_arranger={arrange:arrange,matchChord:matchChord};
})();
