let audioReady=false;let audioCtx=null;
function enableAudio(){if(!audioReady){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();audioReady=true;}catch(e){}}}
document.addEventListener("click",enableAudio,{once:true});document.addEventListener("touchstart",enableAudio,{once:true});
function beep(freq=880,dur=120){if(!audioReady||!audioCtx)return;let o=audioCtx.createOscillator();let g=audioCtx.createGain();o.frequency.value=freq;o.type="sine";g.gain.value=.07;o.connect(g);g.connect(audioCtx.destination);o.start();setTimeout(()=>{try{o.stop()}catch(e){}},dur)}
function playMsgSound(){enableAudio();beep(784,80);setTimeout(()=>beep(988,80),95);setTimeout(()=>beep(1175,100),190)}
function playInviteSound(){enableAudio();beep(660,120);setTimeout(()=>beep(880,120),160)}
function playInviteAcceptedSound(){enableAudio();beep(660,80);setTimeout(()=>beep(880,80),100);setTimeout(()=>beep(1175,120),210)}
function playNudgeSound(){enableAudio();beep(440,90);setTimeout(()=>beep(880,90),120);setTimeout(()=>beep(440,90),240);setTimeout(()=>beep(880,90),360);setTimeout(()=>beep(440,90),480);setTimeout(()=>beep(880,150),620)}
