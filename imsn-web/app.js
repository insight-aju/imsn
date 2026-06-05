const IMSN_WEB_VERSION = "1.0.1-client-onboarding";
let state = loadLocal();
if(state.avatar_data===undefined) state.avatar_data="";
if(state.raw_alias===undefined) state.raw_alias=state.alias||"";
if(state.audio_broker_enabled===undefined) state.audio_broker_enabled=false;
if(state.image_broker_enabled===undefined) state.image_broker_enabled=false;
if(state.doc_broker_enabled===undefined) state.doc_broker_enabled=false;
if(state.backup_enabled===undefined) state.backup_enabled=false;

if(state.server_policy===undefined) state.server_policy={
  mode:0,
  label:"Standalone",
  server_url:"",
  server_seen:false,
  broker_id:"hivemq-public",
  broker_authorized:true,
  policy_id:"",
  min_web_version:"",
  update_url:"",
  require_server:false,
  last_check:null
};

if(state.pending_invite_avatar===undefined) state.pending_invite_avatar="";
if(state.pending_invite_audio===undefined) state.pending_invite_audio=false;
if(state.pending_invite_image===undefined) state.pending_invite_image=false;
if(state.pending_invite_doc===undefined) state.pending_invite_doc=false;
let activeTab = "contacts";
let currentMsgFont = state.current_msg_font || "normal";
let voiceRecorder=null, voiceChunks=[], voiceStream=null, voiceStartMs=0, voiceTimer=null;
let voiceDraftData=null, voiceDraftMime="", voiceDraftDuration=0, voiceDraftWaveform=[];
let voiceDraftAudio=null;let audioPlayers={};
let imageDraftData=null,imageDraftMime="",imageDraftName="",imageDraftW=0,imageDraftH=0;
let docDraftData=null,docDraftMime="",docDraftName="",docDraftSize=0;

function parseAliasForFeatures(raw){
  raw=String(raw||"").trim();
  let audio=false, image=false, doc=false, backup=false;
  let changed=true;
  while(changed){
    changed=false;
    if(/Hz$/i.test(raw) && raw.length>2){audio=true;raw=raw.slice(0,-2);changed=true;}
    if(/Px$/i.test(raw) && raw.length>2){image=true;raw=raw.slice(0,-2);changed=true;}
    if(/Doc$/i.test(raw) && raw.length>3){doc=true;raw=raw.slice(0,-3);changed=true;}
    if(/Bck$/i.test(raw) && raw.length>3){backup=true;raw=raw.slice(0,-3);changed=true;}
  }
  return {alias:raw||"user", audio, image, doc, backup};
}
function audioBrokerActive(){
  return !!state.audio_broker_enabled;
}
function imageBrokerActive(){
  return !!state.image_broker_enabled;
}
function docBrokerActive(){
  return !!state.doc_broker_enabled;
}
function backupActive(){
  return !!state.backup_enabled;
}
function formatDuration(sec){
  sec=Math.max(0,Math.round(Number(sec)||0));
  let m=Math.floor(sec/60),s=sec%60;
  return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}
function makeWaveform(seed){
  let text=String(seed||Date.now());
  let h=0;
  for(let i=0;i<text.length;i++)h=(h*31+text.charCodeAt(i))>>>0;
  let arr=[];
  for(let i=0;i<28;i++){
    h=(1103515245*h+12345)>>>0;
    arr.push(20+(h%80));
  }
  return arr;
}
function waveformHtml(arr){
  arr=(arr&&arr.length)?arr:makeWaveform("default");
  return arr.slice(0,32).map(v=>'<span class="voiceBar" style="height:'+Math.max(12,Math.min(100,Number(v)||30))+'%"></span>').join("");
}
function blobToDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
    r.readAsDataURL(blob);
  });
}

function normalizeFont(f){f=(f||"normal").toString().toLowerCase();if(f==="itálico")f="italico";if(f==="retrô")f="retro";return ["normal","grande","pequena","negrito","italico","retro"].includes(f)?f:"normal";}


function avatarHtml(data, fallback, cls){
  if(data) return '<img class="avatarImg" src="'+data+'" alt="">';
  return (fallback||"?").substring(0,1).toUpperCase();
}
function smallAvatarHtml(c){
  let letter=((c&&c.display)||((c&&c.alias)||"?")).substring(0,1).toUpperCase();
  let inner=(c&&c.avatar)?'<img src="'+c.avatar+'" alt="">':letter;
  return '<span class="contactAvatarSmall">'+inner+'</span>';
}
function setAvatarBox(el, data, fallback){
  if(!el)return;
  if(data) el.innerHTML='<img class="avatarImg" src="'+data+'" alt="">';
  else el.innerText=(fallback||"?").substring(0,1).toUpperCase();
}
function resizeImageToDataUrl(file, maxSize, cb){
  const reader=new FileReader();
  reader.onload=function(ev){
    const img=new Image();
    img.onload=function(){
      const canvas=document.createElement("canvas");
      let w=img.width,h=img.height;
      const scale=Math.min(1,maxSize/Math.max(w,h));
      w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d");
      ctx.drawImage(img,0,0,w,h);
      cb(canvas.toDataURL("image/jpeg",0.82));
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}
function chooseAvatar(){const m=document.getElementById("avatarMenu");if(m)m.classList.add("hidden");const f=document.getElementById("cfgAvatarFile");if(f)f.click();}
function clearAvatar(){const m=document.getElementById("avatarMenu");if(m)m.classList.add("hidden");state.avatar_data="";saveLocal();publishPresence();render();}

function statusLabel(s){return s==="ocupado"?"Ocupado":s==="ausente"?"Ausente":s==="invisivel"?"Invisível":s==="offline"?"Offline":s==="procurando"?"Procurando...":s==="online"?"Online":"Desconhecido"}
function getContact(key){
  key = String(key || '').trim();
  if(!key)return null;
  return (state.contacts||[]).find(c=>String(c.user_id||'')===key || String(c.alias||'')===key);
}
function openChatPanel(){
  activeTab='chat';
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active','notifyBlink'));
  document.getElementById('chat').classList.add('active');
  const tabs=document.querySelectorAll('.tab');
  if(tabs[1])tabs[1].classList.add('active');
}

function rememberKnownUser(u){
  if(!u||!u.user_id||u.user_id===state.user_id)return;
  if(!state.known_users)state.known_users=[];
  let idx=state.known_users.findIndex(x=>x.user_id===u.user_id||x.alias===u.alias);
  let item={user_id:u.user_id,alias:u.alias||u.user_id,display:u.display||u.alias||u.user_id,status:u.status||'offline',message:u.message||'',audio_broker:!!u.audio_broker,image_broker:!!u.image_broker,doc_broker:!!u.doc_broker,ts:Date.now()};
  if(idx<0)state.known_users.push(item); else state.known_users[idx]=Object.assign(state.known_users[idx],item);
}
function knownUserIdByAlias(alias){
  if(!alias)return '';
  let c=getContact(alias);
  if(c&&c.user_id)return c.user_id;
  let k=(state.known_users||[]).find(x=>x.alias===alias||x.user_id===alias);
  return k?k.user_id:'';
}
function knownDisplayByAlias(alias){
  let k=(state.known_users||[]).find(x=>x.alias===alias||x.user_id===alias);
  return k?(k.display||k.alias):alias;
}

function upsertContact(c){
  let idx = state.contacts.findIndex(x=>x.user_id===c.user_id || x.alias===c.alias);
  if(idx<0){state.contacts.push(Object.assign({status:"offline",message:"",saved:false,conversation:false,unread:0,blocked:false,audio_broker:false,image_broker:false,doc_broker:false},c));return}
  state.contacts[idx]=Object.assign(state.contacts[idx],c);
}
function addMessage(m){
  if(state.messages.find(x=>x.msg_id===m.msg_id))return;
  state.messages.push(Object.assign({ms:Date.now(),font:"normal"},m));
  if(state.messages.length>400)state.messages.shift();
  if(typeof saveMessageRecord==="function") saveMessageRecord(m).catch(e=>console.log("[imsn-db] mensagem não salva no IndexedDB",e));
  const other = m.incoming ? m.from : m.to;
  const c=getContact(other);
  if(c && m.incoming && state.active_contact!==c.user_id)c.unread=(c.unread||0)+1;
}
function setMqttStatus(txt){const el=document.getElementById("mqttStatus");if(el)el.innerText=txt}
function showToast(txt, contact){let t=document.getElementById("toast");t.innerHTML="<b>imsn</b><br>"+txt;t.onclick=()=>{if(contact)openChatWith(contact)};t.classList.add("show");setTimeout(()=>t.classList.remove("show"),4200);try{if(document.hidden&&"Notification"in window&&Notification.permission==="granted")new Notification("imsn",{body:txt});}catch(e){}}
function detectIncoming(c){
  const current = document.getElementById("chatTo").value;
  const sameChat = activeTab==="chat" && current && (current===c.user_id || current===c.alias) && document.visibilityState==="visible";
  if(sameChat)return;
  document.querySelectorAll(".tab")[1].classList.add("notifyBlink");
  showToast(c.alias+" enviou uma mensagem.",c.user_id||c.alias);
  playMsgSound();
}
function showTab(id,el){activeTab=id;document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active","notifyBlink"));document.getElementById(id).classList.add("active");if(el)el.classList.add("active");render();}
function toggleStatusMenu(e){if(e)e.stopPropagation();statusMenu.classList.toggle("hidden")}
function setStatus(st){state.status=st;saveLocal();publishPresence();render()}
document.addEventListener("click",e=>{if(statusMenu&&!statusMenu.classList.contains("hidden")&&!e.target.closest(".statusWrap"))statusMenu.classList.add("hidden");if(fontMenu&&!fontMenu.classList.contains("hidden")&&!e.target.closest(".fontWrap"))fontMenu.classList.add("hidden");});

function hexToRgb(hex){hex=(hex||"#2c8df0").replace("#","");let n=parseInt(hex,16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function rgbToHex(r,g,b){return "#"+[r,g,b].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0")).join("")}
function shade(hex,p){let c=hexToRgb(hex);return rgbToHex(c.r+(p*255),c.g+(p*255),c.b+(p*255))}
function applyTheme(hex){hex=hex||"#2c8df0";document.documentElement.style.setProperty("--accent",hex);document.documentElement.style.setProperty("--accentDark",shade(hex,-0.18));document.documentElement.style.setProperty("--accentSoft",shade(hex,0.30));document.documentElement.style.setProperty("--accentPale",shade(hex,0.42));document.documentElement.style.setProperty("--pageBg1",shade(hex,0.46));document.documentElement.style.setProperty("--pageBg2",shade(hex,0.82));document.documentElement.style.setProperty("--windowBg1",shade(hex,0.88));document.documentElement.style.setProperty("--windowBg2",shade(hex,0.79));document.documentElement.style.setProperty("--lineStrong",shade(hex,-0.02));document.documentElement.style.setProperty("--buttonBg2",shade(hex,0.58));document.documentElement.style.setProperty("--tabIdle",shade(hex,0.54))}

function render(){
  applyTheme(state.theme_color);
  shortId.innerText="#"+state.short_id+" / imsn-web";
  setAvatarBox(avatar,state.avatar_data,state.display||"i");
  displayName.innerText=state.display;
  alias.innerText="(@"+state.alias+")";
  statusText.innerText=statusLabel(state.status);
  statusDot.className="statusDot st-"+state.status;
  personalMsg.innerText=state.message||"";
  netState.innerText="MQTT: "+(mqttConnected?"online":"offline")+" | broker: "+state.broker_host;
  cfgUserId.innerText=state.user_id;const dbEl=document.getElementById("dbStatus");if(dbEl)dbEl.innerText=(typeof imsnDbStatus!=="undefined"?imsnDbStatus:"não iniciado");const afl=document.getElementById("activeFeaturesLine");if(afl)afl.innerHTML=activeFeaturePills();const cmn=document.getElementById("clientModeNote");if(cmn)cmn.innerText=policyModeLabel()+" / broker direto";const ab=document.getElementById("audioBrokerStatus");if(ab)ab.classList.toggle("hidden",!audioBrokerActive());const ib=document.getElementById("imageBrokerStatus");if(ib)ib.classList.toggle("hidden",!imageBrokerActive());const dbs=document.getElementById("docBrokerStatus");if(dbs)dbs.classList.toggle("hidden",!docBrokerActive());const bfs=document.getElementById("backupFeatureStatus");if(bfs)bfs.classList.toggle("hidden",!backupActive());const bb=document.getElementById("backupBox");if(bb)bb.classList.toggle("hidden",!backupActive());
  cfgAlias.value=state.raw_alias||state.alias;cfgDisplay.value=state.display;cfgMsg.value=state.message||"";
  cfgBroker.value=state.broker_host;cfgPath.value=state.broker_path||"/mqtt";if(location.protocol==="https:" && state.broker_host==="broker.hivemq.com")state.broker_tls=true;cfgTls.checked=!!state.broker_tls;cfgEnter.checked=!!state.enter_to_send;
  themePicker.value=state.theme_color||"#2c8df0";setAvatarBox(document.getElementById("cfgAvatarPreview"),state.avatar_data,state.display||"i");
  const vb=document.getElementById("voiceBtn");if(vb)vb.classList.toggle("hidden",!audioBrokerActive());const imgb=document.getElementById("imageBtn");if(imgb)imgb.classList.toggle("hidden",!imageBrokerActive());const docb=document.getElementById("docBtn");if(docb)docb.classList.toggle("hidden",!docBrokerActive());renderSearch();renderLists();renderChat();
}

function renderSearch(){
  if(!state.search_alias){foundBox.classList.add("hidden");foundBox.innerHTML="";return}
  foundBox.classList.remove("hidden");
  const saved = state.contacts.find(c=>(c.alias===state.search_alias||c.user_id===state.search_user_id)&&c.saved);
  if(saved){foundBox.innerHTML='<div class="muted">Contato já está adicionado. Use a lista abaixo para abrir a conversa.</div>';return}
  if(state.search_state==="found"){
    foundBox.innerHTML=`<b><span class="statusDot st-${state.search_status}"></span>${state.search_display} (@${state.search_alias})</b><br><span class="muted">Status: ${statusLabel(state.search_status)} | contato encontrado.</span><div class="row"><button onclick="inviteContactFromSearch()">Convidar para conversar</button><button onclick="cancelSearch()">Cancelar busca</button></div>`;
  }else{
    foundBox.innerHTML=`<b><span class="statusDot st-procurando"></span>@${state.search_alias}</b><br><span class="muted">Procurando no bootstrap...</span><div class="row"><button onclick="cancelSearch()">Cancelar busca</button></div>`;
  }
}

function group(title,key,items){
  const open = state.groups_open[key]!==false;
  return `<div class="groupHead" onclick="toggleGroup('${key}')">${title} (${items.length}) ${open?"▾":"▸"}</div>` + (open ? items.map(contactHtml).join("") : "");
}
function contactHtml(c){
  let badge=c.unread>0?`<span class="badge">${c.unread}</span>`:"";
  let lock=c.blocked?` <span class="lockMark" title="Contato bloqueado">🔒</span>`:"";
  let lineClass=c.blocked?"contactLine blockedLine":"contactLine";
  let statusTxt=c.blocked?"Bloqueado":statusLabel(c.status);
  return `<div class="${lineClass}"><div class="clickArea" onclick="openChatWith('${c.user_id||c.alias}')">${smallAvatarHtml(c)}<span class="statusDot st-${c.status}"></span><b>${c.display}</b> (@${c.alias}) ${badge}${lock}<div class="muted">${statusTxt} ${c.message||""}</div></div><button class="xbtn" onclick="deleteContact('${c.user_id||c.alias}')">X</button></div>`;
}
function convHtml(c){
  let badge=c.unread>0?`<span class="badge">${c.unread}</span>`:"";
  let lock=c.blocked?` <span class="lockMark" title="Contato bloqueado">🔒</span>`:"";
  let lineClass=`contactLine ${c.unread>0?"notifyBlink":""} ${c.blocked?"blockedLine":""}`;
  let statusTxt=c.blocked?"Bloqueado":statusLabel(c.status);
  const key=c.user_id||c.alias;
  return `<div class="${lineClass}" onclick="openChatWith('${key}')"><div class="clickArea">${smallAvatarHtml(c)}<span class="statusDot st-${c.status}"></span><b>${c.display}</b> (@${c.alias}) ${badge}${lock}<div class="muted">${statusTxt} ${c.message||""}</div></div><button class="miniBtn trashBtn" title="Limpar histórico" onclick="event.stopPropagation();clearConversationHistory('${key}')">🗑️</button><button class="xbtn" onclick="event.stopPropagation();closeConversation('${key}')">X</button></div>`;
}
function renderLists(){
  const saved=state.contacts.filter(c=>c.saved);
  const blocked=saved.filter(c=>c.blocked);
  const usable=saved.filter(c=>!c.blocked);
  contactList.innerHTML =
    group("Online","online",usable.filter(c=>c.status==="online"))+
    group("Ocupados","ocupado",usable.filter(c=>c.status==="ocupado"))+
    group("Ausentes","ausente",usable.filter(c=>c.status==="ausente"))+
    group("Offline","offline",usable.filter(c=>c.status==="offline"||c.status==="invisivel"||!["online","ocupado","ausente"].includes(c.status)))+
    group("Bloqueados","bloqueados",blocked);
  const f=(chatFilter.value||"").toLowerCase();
  const conv=state.contacts.filter(c=>c.conversation&&(!f||c.alias.toLowerCase().includes(f)||c.display.toLowerCase().includes(f)));
  conversationList.innerHTML=conv.map(convHtml).join("");
  inviteBox.innerHTML=state.pending_invite_from?`<div class="warn"><b>${state.pending_invite_display} (@${state.pending_invite_from})</b> quer conversar.<div class="row"><button class="primary" onclick="answerInvite('accept')">Aceitar</button><button class="danger" onclick="answerInvite('reject')">Recusar</button><button onclick="cancelInvite()">Cancelar</button></div></div>`:"";
}
function toggleGroup(k){state.groups_open[k]=state.groups_open[k]===false;saveLocal();renderLists()}

function msgTime(m){return new Date(m.ms||Date.now()).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
function msgHtml(m,html){return `<div class="msgRow"><div class="msgText">${html}</div><div class="msgTime">${msgTime(m)}</div></div>`}
function renderChat(){
  const box = document.getElementById("msgs");
  const wasNearBottom = !box || (box.scrollTop + box.clientHeight >= box.scrollHeight - 70);
  let current=chatTo.value||state.active_contact||"";let c=current?getContact(current):null;let chatAlias=current;
  if(c){chatAlias=c.alias;current=c.user_id||c.alias;chatTo.value=current;chatListView.classList.add("hidden");chatWindowView.classList.remove("hidden");setAvatarBox(chatAvatar,c.avatar,c.display||c.alias||"?");chatTitle.innerText="Conversa com "+c.display;chatSub.innerText="@"+c.alias+" | "+(c.blocked?"Bloqueado":statusLabel(c.status))+(c.audio_broker?" | áudio":"")+(c.image_broker?" | imagem":"")+(c.doc_broker?" | arquivo":"");blockBtn.innerText=c.blocked?"🔒":"🔓";blockBtn.classList.toggle("locked",!!c.blocked);const vb2=document.getElementById("voiceBtn");if(vb2){vb2.disabled=false;vb2.title=(!c.audio_broker&&audioBrokerActive())?"Áudio não suportado pelo contato":"Gravar áudio";}const ib2=document.getElementById("imageBtn");if(ib2){ib2.disabled=false;ib2.title=(!c.image_broker&&imageBrokerActive())?"Imagem não suportada pelo contato":"Enviar imagem";}const db2=document.getElementById("docBtn");if(db2){db2.disabled=false;db2.title=(!c.doc_broker&&docBrokerActive())?"Arquivo não suportado pelo contato":"Enviar arquivo";}}else{chatListView.classList.remove("hidden");chatWindowView.classList.add("hidden")}
  let h="";
  state.messages.forEach(m=>{
    if(current&&!([m.from,m.to].includes(chatAlias)||[m.from,m.to].includes(current)))return;
    if(m.type==="nudge"){h+=`<div class="msg">${msgHtml(m,'<span class="name">⚡</span> '+m.body)}</div>`;return}
    if(m.type==="audio"){
      h+=`<div class="msg ${m.incoming?"":"me"}">${msgHtml(m,'<span class="name">'+(m.incoming?m.from:"Eu")+':</span> '+audioMessageHtml(m))}</div>`;
      return;
    }
    if(m.type==="image"){
      h+=`<div class="msg ${m.incoming?"":"me"}">${msgHtml(m,'<span class="name">'+(m.incoming?m.from:"Eu")+':</span> '+imageMessageHtml(m))}</div>`;
      return;
    }
    if(m.type==="file"){
      h+=`<div class="msg ${m.incoming?"":"me"}">${msgHtml(m,'<span class="name">'+(m.incoming?m.from:"Eu")+':</span> '+fileMessageHtml(m))}</div>`;
      return;
    }
    if(m.type==="system"||m.type==="blocked_notice"){h+=`<div class="msg">${msgHtml(m,'<span class="name">!</span> '+m.body)}</div>`;return}
    let fcls="font-"+normalizeFont(m.font||m.msg_font||m.fontStyle||"normal");
    h+=`<div class="msg ${m.incoming?"":"me"}">${msgHtml(m,`<span class="name">${m.incoming?m.from:"Eu"}:</span> <span class="${fcls}">${m.body}</span>`)}</div>`;
  });
  msgs.innerHTML=h||'<div class="muted">Nenhuma mensagem nesta conversa.</div>';
  typing.innerText=(state.typing_from&&((state.typing_from===chatAlias)||(state.typing_from===current)||(state.typing_from_user_id&&state.typing_from_user_id===current)))?state.typing_from+" está digitando...":"";
  if(wasNearBottom) setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},20);
}

const emojiList=["😀","😃","😄","😁","😆","😂","😊","😉","😍","😘","😎","😜","🤔","😮","😢","😡","👍","👎","👏","🙏","💪","❤️","💙","🔥","⚡","🎵","🎤","🎧"];
function buildEmojiMenu(){if(emojiMenu.dataset.ready)return;emojiMenu.innerHTML=emojiList.map(e=>`<button class="emojiItem" onclick="insertEmoji('${e}')">${e}</button>`).join("");emojiMenu.dataset.ready="1"}
function toggleEmojiMenu(e){if(e)e.preventDefault();buildEmojiMenu();emojiMenu.classList.toggle("hidden")}
function insertEmoji(e){let b=body;let s=b.selectionStart||0;let t=b.selectionEnd||0;b.value=b.value.substring(0,s)+e+b.value.substring(t);b.focus();b.selectionStart=b.selectionEnd=s+e.length;emojiMenu.classList.add("hidden")}
function toggleFontMenu(e){if(e)e.stopPropagation();fontMenu.classList.toggle("hidden")}
function fontLabel(f){f=normalizeFont(f);return f==="grande"?"Grande":f==="pequena"?"Pequena":f==="negrito"?"Negrito":f==="italico"?"Itálico":f==="retro"?"Retrô":"Normal"}
function updateFontMenuSelection(){
  document.querySelectorAll("#fontMenu button").forEach(b=>{
    const match=(b.getAttribute("onclick")||"").match(/setMsgFont\('([^']+)'\)/);
    const f=match?normalizeFont(match[1]):"";
    b.classList.toggle("selected", f===currentMsgFont);
  });
}
function applyMsgFont(){
  body.classList.remove("font-normal","font-grande","font-pequena","font-negrito","font-italico","font-retro");
  body.classList.add("font-"+currentMsgFont);
  fontBtn.classList.remove("font-normal","font-grande","font-pequena","font-negrito","font-italico","font-retro");
  fontBtn.classList.add("font-"+currentMsgFont);
  fontBtn.title="Fonte da mensagem: "+fontLabel(currentMsgFont);
  updateFontMenuSelection();
}
function setMsgFont(f){currentMsgFont=normalizeFont(f);state.current_msg_font=currentMsgFont;saveLocal();fontMenu.classList.add("hidden");applyMsgFont()}

function saveProfile(e){e.preventDefault();let parsed=parseAliasForFeatures(cfgAlias.value.trim()||state.alias);state.raw_alias=cfgAlias.value.trim()||parsed.alias;state.alias=parsed.alias;state.audio_broker_enabled=parsed.audio;state.image_broker_enabled=parsed.image;state.doc_broker_enabled=parsed.doc;state.backup_enabled=parsed.backup;state.display=cfgDisplay.value.trim()||state.display;state.message=cfgMsg.value.trim();state.broker_host=cfgBroker.value.trim()||state.broker_host;state.broker_path=cfgPath.value.trim()||"/mqtt";state.broker_tls=cfgTls.checked;state.enter_to_send=cfgEnter.checked;saveLocal();publishPresence();render()}
function findContact(){let a=findAlias.value.trim();if(!a)return;state.search_alias=a;state.search_state="searching";state.search_display=a;state.search_status="procurando";let kid=knownUserIdByAlias(a);if(kid){let kd=knownDisplayByAlias(a);state.search_state="found";state.search_user_id=kid;state.search_display=kd;let ku=state.known_users.find(x=>x.user_id===kid)||{};state.search_status=ku.status||"online";state.search_audio=!!ku.audio_broker;state.search_image=!!ku.image_broker;state.search_doc=!!ku.doc_broker;saveLocal();render();return;}publish(topicDiscoveryRequest(),{from:state.alias,from_user_id:state.user_id,to:a,display:state.display,device:"imsn-web",short:state.short_id});saveLocal();render()}
function cancelSearch(){findAlias.value="";state.search_alias="";state.search_state="idle";state.search_user_id="";state.search_display="";state.search_status="offline";state.invite_result="";saveLocal();render()}
function inviteContactFromSearch(){
  let targetId=state.search_user_id||knownUserIdByAlias(state.search_alias);
  if(!targetId){state.invite_result="Contato ainda não resolvido.";render();return;}
  state.search_user_id=targetId;
  const payload={from:state.alias,from_user_id:state.user_id,to:state.search_alias,to_user_id:targetId,display:state.display,status:state.status,device:"imsn-web",short:state.short_id};
  const ok=publishMulti(userTopics(topicInvite,targetId,state.search_alias),payload);
  state.invite_result=ok?("convite enviado para "+state.search_alias):"falha ao enviar convite: MQTT offline";
  saveLocal();render();
}
function answerInvite(ans){
  let target=state.pending_invite_user_id;
  const targetAlias=state.pending_invite_from;
  if(!target)target=knownUserIdByAlias(targetAlias);
  if(target)state.pending_invite_user_id=target;
  if(!target){state.invite_result="Não consegui resolver o user_id do convite. Peça para o contato procurar você novamente.";saveLocal();render();return;}
  if(target||targetAlias){
    const payload={from:state.alias,from_user_id:state.user_id,to:targetAlias,to_user_id:target,answer:ans,display:state.display,status:state.status,device:"imsn-web",short:state.short_id};
    publishMulti(userTopics(topicInviteResp,target,targetAlias),payload);
    if(ans==="accept"){
      upsertContact({user_id:target||targetAlias,alias:targetAlias,display:state.pending_invite_display||targetAlias,status:"online",saved:true,conversation:true});
      state.active_contact=target||targetAlias;chatTo.value=state.active_contact;openChatPanel();
    }
  }
  state.pending_invite_from="";state.pending_invite_user_id="";state.pending_invite_display="";saveLocal();render();setTimeout(()=>{if(msgs)msgs.scrollTop=msgs.scrollHeight},50)
}
function cancelInvite(){state.pending_invite_from="";state.pending_invite_user_id="";state.pending_invite_display="";saveLocal();render()}
function openChatWith(a){
  const c=getContact(a);
  if(!c){showToast("Contato não encontrado ou ainda não carregado.", "");return;}
  if(!c.saved){const el=document.getElementById("sendStatus");if(el)el.innerText="Contato ainda não foi adicionado/aceito.";return;}
  // Clicar em um contato salvo deve reabrir a conversa mesmo que ela tenha sido fechada pelo X.
  c.conversation=true;
  state.active_contact=c.user_id||c.alias;
  c.unread=0;
  chatTo.value=state.active_contact;
  saveLocal();openChatPanel();render();setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},50);
}
function deleteContact(a){if(confirm("Deseja excluir o contato "+a+"?")){state.contacts=state.contacts.filter(c=>c.user_id!==a&&c.alias!==a);saveLocal();render()}}
function clearConversationHistory(a){
  let c=getContact(a);
  if(!c)return;
  if(!confirm("Deseja realmente limpar o histórico da conversa com "+(c.display||c.alias)+"?"))return;
  const keys=[c.user_id,c.alias].filter(Boolean);
  state.messages=state.messages.filter(m=>!keys.includes(m.from)&&!keys.includes(m.to));
  c.unread=0;
  saveLocal();
  render();
}
function closeConversation(a){
  let c=getContact(a);
  if(!c)return;
  c.conversation=false;
  c.unread=0;

  let current=(chatTo&&chatTo.value?chatTo.value.trim():state.active_contact)||'';
  let closingKeys=[c.user_id,c.alias].filter(Boolean);

  if(closingKeys.includes(state.active_contact)||closingKeys.includes(current)){
    state.active_contact='';
    if(chatTo)chatTo.value='';
  }

  saveLocal();
  render();
}
function minimizeChat(){chatTo.value="";state.active_contact="";saveLocal();render()}
function closeChat(){
  let current=(chatTo&&chatTo.value?chatTo.value.trim():state.active_contact)||'';
  let c=getContact(current);
  if(c)closeConversation(c.user_id||c.alias);
  else{chatTo.value='';state.active_contact='';saveLocal();render();}
}
function toggleBlockActive(){let c=getContact(chatTo.value||state.active_contact);if(!c)return;c.blocked=!c.blocked;saveLocal();render()}
function sendMsg(){if(docDraftData){sendDocDraft();return;}if(imageDraftData){sendImageDraft();return;}if(voiceDraftData){sendVoiceDraft();return;}let to=chatTo.value.trim();let txt=body.value.trim();if(!to||!txt){sendStatus.innerText="Preencha contato e mensagem.";return}let c=getContact(to);if(!c){sendStatus.innerText="Contato não encontrado.";return}if(c.blocked){sendStatus.innerText="Contato bloqueado. Desbloqueie para enviar.";return}let selectedFont=normalizeFont(currentMsgFont);let msg={from:state.alias,from_user_id:state.user_id,to:c.alias,to_user_id:c.user_id,display:state.display,type:"text",body:txt,font:selectedFont,msg_font:selectedFont,font_style:selectedFont,msg_id:state.user_id+"-"+Date.now(),device:"imsn-web",short:state.short_id};if(publishMulti(userTopics(topicInbox,c.user_id,c.alias),msg)){addMessage({from:state.alias,to:c.alias,body:txt,type:"text",font:selectedFont,incoming:false,msg_id:msg.msg_id});state.active_contact=c.user_id;c.conversation=true;sendStatus.innerText="Enviado";body.value="";saveLocal();render();setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},50)}else sendStatus.innerText="Falhou ao enviar"}
function nudgeContact(){let c=getContact(chatTo.value||state.active_contact);if(!c){sendStatus.innerText="Abra uma conversa para chamar atenção.";return}if(c.blocked){sendStatus.innerText="Contato bloqueado. Desbloqueie para chamar atenção.";return}if(publishMulti(userTopics(topicNudge,c.user_id,c.alias),{from:state.alias,from_user_id:state.user_id,to:c.alias,to_user_id:c.user_id,display:state.display,status:state.status,device:"imsn-web",short:state.short_id})){addMessage({from:state.alias,to:c.alias,body:"⚡ Você chamou a atenção de "+c.display+"!",type:"nudge",incoming:false,msg_id:"nudge-tx-"+Date.now()});saveLocal();render();sendStatus.innerText="Atenção enviada"}}

function updatePresence(doc){
  if(!doc.user_id||doc.user_id===state.user_id)return;
  rememberKnownUser({user_id:doc.user_id,alias:doc.alias||doc.user_id,display:doc.display||doc.alias,status:(doc.online===false?"offline":(doc.status||"offline")),message:doc.message||"",audio_broker:!!doc.audio_broker,image_broker:!!doc.image_broker,doc_broker:!!doc.doc_broker});
  let c=getContact(doc.user_id)||getContact(doc.alias||"");
  if(c){c.user_id=doc.user_id;c.alias=doc.alias||c.alias;c.display=doc.display||c.display;c.status=doc.online===false?"offline":(doc.status||"offline");c.message=doc.message||"";if(doc.audio_broker!==undefined)c.audio_broker=!!doc.audio_broker;if(doc.image_broker!==undefined)c.image_broker=!!doc.image_broker;if(doc.doc_broker!==undefined)c.doc_broker=!!doc.doc_broker;}
  if(state.pending_invite_from && doc.alias===state.pending_invite_from && !state.pending_invite_user_id) state.pending_invite_user_id=doc.user_id;
  if(state.search_state==="searching"&&doc.alias===state.search_alias&&doc.status!=="offline"){state.search_state="found";state.search_user_id=doc.user_id;state.search_display=doc.display||doc.alias;state.search_status=doc.status;}
  saveLocal();render();
}


function setTextMode(){
  const b=document.getElementById("body");
  const vd=document.getElementById("voiceDraft");
  if(b)b.classList.remove("hidden");
  if(vd)vd.classList.add("hidden");
  const vb=document.getElementById("voiceBtn");
  if(vb){vb.innerText="🎙️";vb.title="Gravar áudio";}
}

function setVoiceDraftMode(recording){
  const b=document.getElementById("body");
  const vd=document.getElementById("voiceDraft");
  if(b)b.classList.add("hidden");
  if(vd){
    vd.classList.remove("hidden");
    vd.classList.toggle("recording",!!recording);
  }
  const label=document.getElementById("voiceDraftLabel");
  if(label)label.innerText=recording?"Gravando... máximo 10s":"Prévia do áudio";
  const play=document.getElementById("voiceDraftPlay");
  if(play)play.innerText=recording?"●":"▶️";
  const vb=document.getElementById("voiceBtn");
  if(vb){vb.innerText=recording?"⏹️":"▶️";vb.title=recording?"Parar gravação":"Ouvir áudio gravado";}
}

function updateVoiceDraftView(recording=false){
  const wave=document.getElementById("voiceDraftWave");
  if(wave)wave.innerHTML=waveformHtml(voiceDraftWaveform.length?voiceDraftWaveform:makeWaveform(Date.now()));
  const dur=document.getElementById("voiceDraftDuration");
  if(dur)dur.innerText=formatDuration(recording?(Date.now()-voiceStartMs)/1000:voiceDraftDuration);
}

async function toggleVoiceRecording(){
  if(!audioBrokerActive()){
    sendStatus.innerText="Áudio via broker não está ativo.";
    return;
  }
  const c=getContact(chatTo.value||state.active_contact);
  if(c && !c.audio_broker){
    sendStatus.innerText="Áudio não suportado pelo contato.";
    return;
  }
  if(voiceRecorder && voiceRecorder.state==="recording"){
    stopVoiceRecording();
    return;
  }
  if(voiceDraftData){
    toggleVoiceDraftPlay();
    return;
  }
  await startVoiceRecording();
}

async function startVoiceRecording(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    sendStatus.innerText="Microfone não suportado neste navegador.";
    return;
  }
  try{
    discardVoiceDraft(false);
    voiceStream=await navigator.mediaDevices.getUserMedia({audio:true});
    let mime="";
    if(window.MediaRecorder&&MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))mime="audio/webm;codecs=opus";
    else if(window.MediaRecorder&&MediaRecorder.isTypeSupported("audio/webm"))mime="audio/webm";
    voiceChunks=[];
    voiceRecorder=new MediaRecorder(voiceStream,mime?{mimeType:mime}:undefined);
    voiceDraftMime=voiceRecorder.mimeType||"audio/webm";
    voiceStartMs=Date.now();
    voiceDraftWaveform=makeWaveform(voiceStartMs);
    setVoiceDraftMode(true);
    updateVoiceDraftView(true);
    voiceTimer=setInterval(()=>{
      updateVoiceDraftView(true);
      if(Date.now()-voiceStartMs>=10000)stopVoiceRecording();
    },250);
    voiceRecorder.ondataavailable=e=>{if(e.data&&e.data.size)voiceChunks.push(e.data);};
    voiceRecorder.onstop=async()=>{
      clearInterval(voiceTimer);voiceTimer=null;
      try{if(voiceStream)voiceStream.getTracks().forEach(t=>t.stop());}catch(e){}
      voiceStream=null;
      const blob=new Blob(voiceChunks,{type:voiceDraftMime});
      voiceDraftDuration=Math.min(10,(Date.now()-voiceStartMs)/1000);
      if(blob.size>260000){
        discardVoiceDraft();
        sendStatus.innerText="Áudio muito grande para envio via broker. Tente uma gravação menor.";
        return;
      }
      voiceDraftData=await blobToDataUrl(blob);
      if(typeof saveMediaItem==="function"){
        saveMediaItem({owner:state.user_id,type:"audio",name:"voice-"+Date.now()+".webm",mime:voiceDraftMime,size:blob.size,data:voiceDraftData,duration:voiceDraftDuration,waveform:voiceDraftWaveform}).catch(e=>console.log("[imsn-db] áudio não salvo",e));
      }
      setVoiceDraftMode(false);
      updateVoiceDraftView(false);
      sendStatus.innerText="Áudio gravado. Use Enviar ou descarte no X.";
    };
    voiceRecorder.start();
    sendStatus.innerText="Gravando áudio...";
  }catch(e){
    sendStatus.innerText="Não foi possível acessar o microfone.";
    console.log("[imsn voice]",e);
    setTextMode();
  }
}

function stopVoiceRecording(){
  if(voiceRecorder&&voiceRecorder.state==="recording")voiceRecorder.stop();
}

function discardVoiceDraft(update=true){
  try{if(voiceRecorder&&voiceRecorder.state==="recording")voiceRecorder.stop();}catch(e){}
  try{if(voiceStream)voiceStream.getTracks().forEach(t=>t.stop());}catch(e){}
  if(voiceTimer)clearInterval(voiceTimer);
  voiceRecorder=null;voiceChunks=[];voiceStream=null;voiceTimer=null;
  voiceDraftData=null;voiceDraftMime="";voiceDraftDuration=0;voiceDraftWaveform=[];
  if(voiceDraftAudio){try{voiceDraftAudio.pause();}catch(e){}}
  voiceDraftAudio=null;
  if(update){setTextMode();sendStatus.innerText="Áudio descartado.";}
}

function toggleVoiceDraftPlay(){
  if(!voiceDraftData)return;
  if(!voiceDraftAudio){
    voiceDraftAudio=new Audio(voiceDraftData);
    voiceDraftAudio.onended=()=>{const p=document.getElementById("voiceDraftPlay");if(p)p.innerText="▶️";const vb=document.getElementById("voiceBtn");if(vb)vb.innerText="▶️";};
  }
  if(voiceDraftAudio.paused){
    voiceDraftAudio.play();
    const p=document.getElementById("voiceDraftPlay");if(p)p.innerText="⏸️";
    const vb=document.getElementById("voiceBtn");if(vb)vb.innerText="⏸️";
  }else{
    voiceDraftAudio.pause();
    const p=document.getElementById("voiceDraftPlay");if(p)p.innerText="▶️";
    const vb=document.getElementById("voiceBtn");if(vb)vb.innerText="▶️";
  }
}

function audioMessageHtml(m){
  if(!m.audio_data){
    let link=m.media_url?` <a href="${m.media_url}" target="_blank">acessar via link</a>`:"";
    return `<span class="audioUnsupported">Mensagem de áudio recebida, mas não suportada nesta versão.${link}</span>`;
  }
  let id=(m.msg_id||"audio-"+Math.random()).replace(/[^a-zA-Z0-9_-]/g,"_");
  return `<div class="audioMsg">
    <div class="audioControls">
      <button onclick="playAudioMsg('${id}','${m.audio_data}')">▶️</button>
      <button onclick="pauseAudioMsg('${id}')">⏸️</button>
      <button onclick="stopAudioMsg('${id}')">⏹️</button>
    </div>
    <div class="voiceWave">${waveformHtml(m.waveform)}</div>
    <span class="voiceDuration">${formatDuration(m.duration||0)}</span>
  </div>`;
}

function getAudioPlayer(id,data){
  if(!audioPlayers[id]){
    audioPlayers[id]=new Audio(data);
  }
  return audioPlayers[id];
}
function playAudioMsg(id,data){
  const a=getAudioPlayer(id,data);
  a.play();
}
function pauseAudioMsg(id){
  const a=audioPlayers[id];if(a)a.pause();
}
function stopAudioMsg(id){
  const a=audioPlayers[id];if(a){a.pause();a.currentTime=0;}
}

function sendVoiceDraft(){
  let to=chatTo.value.trim();
  if(!to||!voiceDraftData){sendStatus.innerText="Abra uma conversa e grave um áudio.";return;}
  let c=getContact(to);
  if(!c){sendStatus.innerText="Contato não encontrado.";return;}
  if(c.blocked){sendStatus.innerText="Contato bloqueado. Desbloqueie para enviar.";return;}
  if(!c.audio_broker){
    sendStatus.innerText="Áudio não suportado pelo contato.";
    return;
  }
  let msg={
    from:state.alias,from_user_id:state.user_id,to:c.alias,to_user_id:c.user_id,display:state.display,
    type:"audio",
    body:"Mensagem de áudio recebida. Recurso disponível no imsn-web.",
    audio_data:voiceDraftData,
    audio_mime:voiceDraftMime||"audio/webm",
    duration:Math.round(voiceDraftDuration),
    waveform:voiceDraftWaveform,
    media_url:"",
    msg_id:state.user_id+"-audio-"+Date.now(),
    device:"imsn-web",short:state.short_id,
    client_type:"web_pwa",client_version:IMSN_WEB_VERSION,server_guard:buildServerGuard()
  };
  if(publishMulti(userTopics(topicInbox,c.user_id,c.alias),msg)){
    addMessage({from:state.alias,to:c.alias,body:msg.body,type:"audio",audio_data:voiceDraftData,audio_mime:msg.audio_mime,duration:msg.duration,waveform:voiceDraftWaveform,incoming:false,msg_id:msg.msg_id});
    state.active_contact=c.user_id;c.conversation=true;
    discardVoiceDraft(false);
    setTextMode();
    sendStatus.innerText="Áudio enviado";
    saveLocal();render();setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},50);
  }else sendStatus.innerText="Falhou ao enviar áudio";
}



function resizeChatImage(file, maxSize, quality){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=function(ev){
      const img=new Image();
      img.onload=function(){
        let w=img.width,h=img.height;
        const scale=Math.min(1,maxSize/Math.max(w,h));
        w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
        const canvas=document.createElement("canvas");
        canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,w,h);
        const data=canvas.toDataURL("image/jpeg",quality);
        resolve({data,mime:"image/jpeg",w,h,size:Math.round(data.length*0.75)});
      };
      img.onerror=()=>reject(new Error("Imagem inválida"));
      img.src=ev.target.result;
    };
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function chooseChatImage(){
  if(!imageBrokerActive()){
    sendStatus.innerText="Imagem via broker não está ativa.";
    return;
  }
  const c=getContact(chatTo.value||state.active_contact);
  if(c && !c.image_broker){
    sendStatus.innerText="Imagem não suportada pelo contato.";
    return;
  }
  const f=document.getElementById("imageFileInput");
  if(f)f.click();
}

function setImageDraftMode(){
  const b=document.getElementById("body");
  const vd=document.getElementById("voiceDraft");
  const id=document.getElementById("imageDraft");
  if(b)b.classList.add("hidden");
  if(vd)vd.classList.add("hidden");
  if(id)id.classList.remove("hidden");
  const prev=document.getElementById("imageDraftPreview");
  if(prev)prev.src=imageDraftData||"";
  const label=document.getElementById("imageDraftLabel");
  if(label)label.innerText="Imagem pronta para envio";
}

function discardImageDraft(update=true){
  imageDraftData=null;imageDraftMime="";imageDraftName="";imageDraftW=0;imageDraftH=0;
  const id=document.getElementById("imageDraft");
  if(id)id.classList.add("hidden");
  const b=document.getElementById("body");
  if(b)b.classList.remove("hidden");
  if(update)sendStatus.innerText="Imagem descartada.";
}

function imageMessageHtml(m){
  if(!m.image_data){
    let link=m.media_url?` <a href="${m.media_url}" target="_blank">acessar via link</a>`:"";
    return `<span class="audioUnsupported">Imagem recebida, mas não suportada nesta versão.${link}</span>`;
  }
  let safe=(m.msg_id||"img").replace(/[^a-zA-Z0-9_-]/g,"_");
  return `<div class="imageMsg">
    <img src="${m.image_data}" alt="Imagem recebida" onclick="openImageOverlay('${safe}')">
    <div class="imageCaption">${m.image_w||""}${m.image_w?"×":""}${m.image_h||""}</div>
    <span id="imgdata-${safe}" class="hidden">${m.image_data}</span>
  </div>`;
}

function openImageOverlay(id){
  const span=document.getElementById("imgdata-"+id);
  if(!span)return;
  let overlay=document.getElementById("imageOverlay");
  if(!overlay){
    overlay=document.createElement("div");
    overlay.id="imageOverlay";
    overlay.className="imageOverlay";
    overlay.innerHTML='<button class="imageOverlayClose" onclick="closeImageOverlay()">X</button><img id="imageOverlayImg" alt="Imagem">';
    document.body.appendChild(overlay);
    overlay.addEventListener("click",e=>{if(e.target.id==="imageOverlay")closeImageOverlay();});
  }
  document.getElementById("imageOverlayImg").src=span.textContent;
  overlay.classList.remove("hidden");
}
function closeImageOverlay(){
  const overlay=document.getElementById("imageOverlay");
  if(overlay)overlay.classList.add("hidden");
}

function sendImageDraft(){
  let to=chatTo.value.trim();
  if(!to||!imageDraftData){sendStatus.innerText="Abra uma conversa e escolha uma imagem.";return;}
  let c=getContact(to);
  if(!c){sendStatus.innerText="Contato não encontrado.";return;}
  if(c.blocked){sendStatus.innerText="Contato bloqueado. Desbloqueie para enviar.";return;}
  if(!c.image_broker){sendStatus.innerText="Imagem não suportada pelo contato.";return;}
  let msg={
    from:state.alias,from_user_id:state.user_id,to:c.alias,to_user_id:c.user_id,display:state.display,
    type:"image",
    body:"Imagem recebida. Recurso disponível no imsn-web.",
    image_data:imageDraftData,
    image_mime:imageDraftMime||"image/jpeg",
    image_name:imageDraftName||"imagem.jpg",
    image_w:imageDraftW,
    image_h:imageDraftH,
    media_url:"",
    msg_id:state.user_id+"-image-"+Date.now(),
    device:"imsn-web",short:state.short_id,
    client_type:"web_pwa",client_version:IMSN_WEB_VERSION,server_guard:buildServerGuard()
  };
  if(publishMulti(userTopics(topicInbox,c.user_id,c.alias),msg)){
    addMessage({from:state.alias,to:c.alias,body:msg.body,type:"image",image_data:imageDraftData,image_mime:msg.image_mime,image_name:msg.image_name,image_w:imageDraftW,image_h:imageDraftH,incoming:false,msg_id:msg.msg_id});
    if(typeof saveMediaItem==="function"){
      saveMediaItem({owner:state.user_id,type:"image",name:msg.image_name,mime:msg.image_mime,size:Math.round(imageDraftData.length*0.75),data:imageDraftData,w:imageDraftW,h:imageDraftH}).catch(e=>console.log("[imsn-db] imagem não salva",e));
    }
    state.active_contact=c.user_id;c.conversation=true;
    discardImageDraft(false);
    sendStatus.innerText="Imagem enviada";
    saveLocal();render();setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},50);
  }else sendStatus.innerText="Falha ao enviar imagem";
}



function formatFileSize(bytes){
  bytes=Number(bytes)||0;
  if(bytes<1024)return bytes+" B";
  if(bytes<1024*1024)return Math.round(bytes/1024)+" KB";
  return (bytes/(1024*1024)).toFixed(1)+" MB";
}
function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
    r.readAsDataURL(file);
  });
}
function allowedDocFile(file){
  const name=(file.name||"").toLowerCase();
  const okExt=[".txt",".pdf",".json",".csv",".log",".ino",".cpp",".h",".html",".css",".js",".md"];
  return okExt.some(ext=>name.endsWith(ext));
}
function chooseChatDoc(){
  if(!docBrokerActive()){
    sendStatus.innerText="Arquivo via broker não está ativo.";
    return;
  }
  const c=getContact(chatTo.value||state.active_contact);
  if(c && !c.doc_broker){
    sendStatus.innerText="Arquivo não suportado pelo contato.";
    return;
  }
  const f=document.getElementById("docFileInput");
  if(f)f.click();
}
function setDocDraftMode(){
  const b=document.getElementById("body");
  const vd=document.getElementById("voiceDraft");
  const id=document.getElementById("imageDraft");
  const dd=document.getElementById("docDraft");
  if(b)b.classList.add("hidden");
  if(vd)vd.classList.add("hidden");
  if(id)id.classList.add("hidden");
  if(dd)dd.classList.remove("hidden");
  const n=document.getElementById("docDraftName");
  const s=document.getElementById("docDraftSize");
  if(n)n.innerText=docDraftName||"arquivo";
  if(s)s.innerText=formatFileSize(docDraftSize);
}
function discardDocDraft(update=true){
  docDraftData=null;docDraftMime="";docDraftName="";docDraftSize=0;
  const dd=document.getElementById("docDraft");
  if(dd)dd.classList.add("hidden");
  const b=document.getElementById("body");
  if(b)b.classList.remove("hidden");
  if(update)sendStatus.innerText="Arquivo descartado.";
}
function fileMessageHtml(m){
  if(!m.file_data){
    let link=m.media_url?` <a href="${m.media_url}" target="_blank">acessar via link</a>`:"";
    return `<span class="audioUnsupported">Arquivo recebido, mas não suportado nesta versão.${link}</span>`;
  }
  let id=(m.msg_id||"file").replace(/[^a-zA-Z0-9_-]/g,"_");
  return `<div class="fileMsg">
    <div class="docIcon">📎</div>
    <div class="fileMsgInfo">
      <div class="fileMsgName">${m.file_name||"arquivo"}</div>
      <div class="fileMsgMeta">${formatFileSize(m.file_size||0)}</div>
      <span id="filedata-${id}" class="hidden">${m.file_data}</span>
    </div>
    <div class="fileMsgActions">
      <button onclick="openFileMsg('${id}','${m.file_name||"arquivo"}')">Abrir</button>
    </div>
  </div>`;
}
function openFileMsg(id,name){
  const span=document.getElementById("filedata-"+id);
  if(!span)return;
  const a=document.createElement("a");
  a.href=span.textContent;
  a.download=name||"arquivo";
  a.target="_blank";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>a.remove(),200);
}
function sendDocDraft(){
  let to=chatTo.value.trim();
  if(!to||!docDraftData){sendStatus.innerText="Abra uma conversa e escolha um arquivo.";return;}
  let c=getContact(to);
  if(!c){sendStatus.innerText="Contato não encontrado.";return;}
  if(c.blocked){sendStatus.innerText="Contato bloqueado. Desbloqueie para enviar.";return;}
  if(!c.doc_broker){sendStatus.innerText="Arquivo não suportado pelo contato.";return;}
  let msg={
    from:state.alias,from_user_id:state.user_id,to:c.alias,to_user_id:c.user_id,display:state.display,
    type:"file",
    body:"Arquivo recebido. Recurso disponível no imsn-web.",
    file_data:docDraftData,
    file_mime:docDraftMime||"application/octet-stream",
    file_name:docDraftName||"arquivo",
    file_size:docDraftSize||0,
    media_url:"",
    msg_id:state.user_id+"-file-"+Date.now(),
    device:"imsn-web",short:state.short_id,
    client_type:"web_pwa",client_version:IMSN_WEB_VERSION,server_guard:buildServerGuard()
  };
  if(publishMulti(userTopics(topicInbox,c.user_id,c.alias),msg)){
    addMessage({from:state.alias,to:c.alias,body:msg.body,type:"file",file_data:docDraftData,file_mime:msg.file_mime,file_name:msg.file_name,file_size:docDraftSize,incoming:false,msg_id:msg.msg_id});
    if(typeof saveMediaItem==="function"){
      saveMediaItem({owner:state.user_id,type:"file",name:msg.file_name,mime:msg.file_mime,size:docDraftSize,data:docDraftData}).catch(e=>console.log("[imsn-db] arquivo não salvo",e));
    }
    state.active_contact=c.user_id;c.conversation=true;
    discardDocDraft(false);
    sendStatus.innerText="Arquivo enviado";
    saveLocal();render();setTimeout(()=>{msgs.scrollTop=msgs.scrollHeight},50);
  }else sendStatus.innerText="Falha ao enviar arquivo";
}



async function exportImsnBackup(){
  const status=document.getElementById("backupStatus");
  if(!backupActive()){if(status)status.innerText="Backup local não está ativo.";return;}
  try{
    if(status)status.innerText="Gerando backup...";
    let dbData=null;
    try{
      if(typeof exportImsnDbData==="function") dbData=await exportImsnDbData();
    }catch(e){
      console.log("[imsn backup] IndexedDB não exportado",e);
    }

    const backup={
      app:"imsn-web",
      backup_version:"0.8.0",
      exported_at:new Date().toISOString(),
      storage_key:(typeof STORAGE_KEY!=="undefined"?STORAGE_KEY:"imsn_web_state_v01"),
      state:state,
      indexeddb:dbData
    };

    const data=JSON.stringify(backup,null,2);
    const blob=new Blob([data],{type:"application/json"});
    const a=document.createElement("a");
    const alias=(state.alias||"imsn").replace(/[^a-zA-Z0-9_-]/g,"_");
    const stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    a.href=URL.createObjectURL(blob);
    a.download="imsn-backup-"+alias+"-"+stamp+".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
    if(status)status.innerText="Backup exportado.";
  }catch(e){
    console.log("[imsn backup]",e);
    if(status)status.innerText="Falha ao exportar backup.";
  }
}

function chooseBackupFile(){
  const status=document.getElementById("backupStatus");
  if(!backupActive()){if(status)status.innerText="Backup local não está ativo.";return;}
  const f=document.getElementById("backupFileInput");
  if(f)f.click();
}

async function importImsnBackupFile(file){
  const status=document.getElementById("backupStatus");
  if(!file)return;
  try{
    if(status)status.innerText="Lendo backup...";
    const text=await file.text();
    const backup=JSON.parse(text);
    if(!backup || backup.app!=="imsn-web" || !backup.state){
      if(status)status.innerText="Arquivo de backup inválido.";
      return;
    }
    const ok=confirm("Importar este backup vai substituir o perfil, contatos e histórico local deste navegador. Continuar?");
    if(!ok){
      if(status)status.innerText="Importação cancelada.";
      return;
    }

    state=backup.state;
    if(state.avatar_data===undefined) state.avatar_data="";
    if(state.raw_alias===undefined) state.raw_alias=state.alias||"";
    if(state.audio_broker_enabled===undefined) state.audio_broker_enabled=false;
    if(state.image_broker_enabled===undefined) state.image_broker_enabled=false;
    if(state.doc_broker_enabled===undefined) state.doc_broker_enabled=false;
if(state.backup_enabled===undefined) state.backup_enabled=false;
    if(state.pending_invite_avatar===undefined) state.pending_invite_avatar="";
    if(state.pending_invite_audio===undefined) state.pending_invite_audio=false;
    if(state.pending_invite_image===undefined) state.pending_invite_image=false;
    if(state.pending_invite_doc===undefined) state.pending_invite_doc=false;
    if(!Array.isArray(state.contacts)) state.contacts=[];
    if(!Array.isArray(state.messages)) state.messages=[];
    if(!Array.isArray(state.known_users)) state.known_users=[];

    saveLocal();

    try{
      if(backup.indexeddb && typeof importImsnDbData==="function") await importImsnDbData(backup.indexeddb);
    }catch(e){
      console.log("[imsn backup] IndexedDB não importado",e);
    }

    if(status)status.innerText="Backup importado. Reconectando...";
    try{disconnectMqtt();}catch(e){}
    render();
    setTimeout(()=>{try{connectMqtt();publishPresence();}catch(e){}},500);
  }catch(e){
    console.log("[imsn backup]",e);
    if(status)status.innerText="Falha ao importar backup.";
  }
}



function formatBytes(bytes){
  bytes=Number(bytes)||0;
  if(bytes<1024)return bytes+" B";
  if(bytes<1024*1024)return Math.round(bytes/1024)+" KB";
  return (bytes/(1024*1024)).toFixed(1)+" MB";
}

function localStateApproxSize(){
  try{
    return new Blob([JSON.stringify(state||{})]).size;
  }catch(e){return 0;}
}

async function refreshStorageStats(){
  const box=document.getElementById("storageStats");
  if(!box)return;
  let dbStats=null;
  try{
    if(typeof getImsnDbStats==="function") dbStats=await getImsnDbStats();
  }catch(e){
    console.log("[imsn storage]",e);
  }

  const encoderSize = value => {
    try{return new Blob([JSON.stringify(value||"")]).size;}catch(e){return 0;}
  };

  const contacts=(state.contacts||[]).filter(c=>c.saved);
  const openConversations=(state.contacts||[]).filter(c=>c.conversation);
  const messages=(state.messages||[]);
  const avatarSize=state.avatar_data ? encoderSize(state.avatar_data) : 0;

  const aliasSize=encoderSize(state.alias||"");
  const displaySize=encoderSize(state.display||"");
  const messageSize=encoderSize(state.message||"");
  const themeSize=encoderSize(state.theme_color||"");
  const fontSize=encoderSize(state.current_msg_font||currentMsgFont||"normal");
  const prefsSize=encoderSize({
    status:state.status,
    enter_to_send:state.enter_to_send,
    broker_host:state.broker_host,
    broker_path:state.broker_path,
    broker_tls:state.broker_tls,
    audio_broker_enabled:state.audio_broker_enabled,
    image_broker_enabled:state.image_broker_enabled,
    doc_broker_enabled:state.doc_broker_enabled,
    backup_enabled:state.backup_enabled
  });

  const contactsSize=encoderSize(contacts);
  const convSize=encoderSize(openConversations.map(c=>({user_id:c.user_id,alias:c.alias,conversation:c.conversation,blocked:c.blocked,unread:c.unread})));
  const loadedMsgSize=encoderSize(messages);

  const mediaTypes=(dbStats&&dbStats.media_by_type)?dbStats.media_by_type:{};
  const mediaSizes=(dbStats&&dbStats.media_size_by_type)?dbStats.media_size_by_type:{};

  function countType(...types){return types.reduce((sum,t)=>sum+(mediaTypes[t]||0),0);}
  function sizeType(...types){return types.reduce((sum,t)=>sum+(mediaSizes[t]||0),0);}

  const audioCount=countType("audio","audio-draft");
  const imageCount=countType("image","image-draft");
  const fileCount=countType("file","file-draft");
  const audioSize=sizeType("audio","audio-draft");
  const imageSize=sizeType("image","image-draft");
  const fileSize=sizeType("file","file-draft");
  const dbMsgCount=dbStats?dbStats.messages_count:0;
  const dbMsgSize=dbStats?dbStats.messages_size:0;

  let standaloneTotal=0;
  let localTotal=0;
  let serverTotal=0;
  let activeTotal=0;

  function envTag(label, size, mode){
    let cls="costEnvItem";
    if(mode==="active") cls+=" active";
    if(mode==="future") cls+=" future";
    return '<span class="'+cls+'">'+label+': '+formatBytes(size)+'</span>';
  }

  function sourceTag(label){
    return '<span class="costActive">'+label+'</span>';
  }

  function costItem(title, qtd, sizes, activeSource, serverFuture){
    const st=sizes.standalone||0;
    const lo=sizes.local||0;
    const sv=sizes.server||0;
    standaloneTotal+=st;
    localTotal+=lo;
    serverTotal+=sv;
    if(activeSource==="Standalone") activeTotal+=st;
    if(activeSource==="Local/PWA") activeTotal+=lo;
    if(activeSource==="Servidor") activeTotal+=sv;

    let env='';
    env+=envTag("Standalone",st,activeSource==="Standalone"?"active":"");
    env+=envTag("Local/PWA",lo,activeSource==="Local/PWA"?"active":"");
    env+=envTag("Servidor",sv,activeSource==="Servidor"?"active":(serverFuture?"future":""));

    const showQty = [
      "Mensagens carregadas na interface",
      "Mensagens arquivadas no banco local",
      "Áudios salvos",
      "Imagens salvas",
      "Arquivos/documentos salvos"
    ].includes(title);

    return '<div class="costItem compactCost">'+
      '<div class="costTitle">'+title+'</div>'+
      (showQty ? '<div class="costGrid"><span>Quantidade</span><span>'+qtd+'</span></div>' : '')+
      '<div class="costEnv">'+env+'</div>'+
    '</div>';
  }

  let html='<div class="costTable">';

  // Dados mínimos existem no cliente standalone e também no armazenamento local/PWA.
  // No modo web/PWA atual, a fonte usada é Local/PWA para evitar depender do ESP/standalone.
  html += costItem("Alias", state.alias?1:0, {standalone:aliasSize, local:aliasSize, server:0}, "Local/PWA", true);
  html += costItem("Nome exibido", state.display?1:0, {standalone:displaySize, local:displaySize, server:0}, "Local/PWA", true);
  html += costItem("Mensagem pessoal/status", state.message?1:0, {standalone:messageSize, local:messageSize, server:0}, "Local/PWA", true);
  html += costItem("Tema visual", state.theme_color?1:0, {standalone:themeSize, local:themeSize, server:0}, "Local/PWA", true);
  html += costItem("Estilo da fonte", 1, {standalone:fontSize, local:fontSize, server:0}, "Local/PWA", true);
  html += costItem("Preferências e recursos ativos", 1, {standalone:prefsSize, local:prefsSize, server:0}, "Local/PWA", true);

  html += costItem("Contatos salvos", contacts.length, {standalone:contactsSize, local:contactsSize, server:0}, "Local/PWA", true);
  html += costItem("Histórico de conversas abertas", openConversations.length, {standalone:convSize, local:convSize, server:0}, "Local/PWA", true);

  // Dados pesados não devem morar no ESP/standalone. Hoje ficam locais; no futuro podem ir para servidor.
  html += costItem("Imagem de perfil", state.avatar_data?1:0, {standalone:0, local:avatarSize, server:0}, "Local/PWA", true);

  html += costItem("Mensagens carregadas na interface", messages.length, {standalone:0, local:loadedMsgSize, server:0}, "Local/PWA", true);
  html += costItem("Mensagens arquivadas no banco local", dbMsgCount, {standalone:0, local:dbMsgSize, server:0}, "Local/PWA", true);

  html += costItem("Áudios salvos", audioCount, {standalone:0, local:audioSize, server:0}, "Local/PWA", true);
  html += costItem("Imagens salvas", imageCount, {standalone:0, local:imageSize, server:0}, "Local/PWA", true);
  html += costItem("Arquivos/documentos salvos", fileCount, {standalone:0, local:fileSize, server:0}, "Local/PWA", true);

  html += '<div class="costSummary"><b>Resumo por local de armazenamento</b>'+
    '<div class="storageLine"><span>Standalone reservado/duplicável</span><span>'+formatBytes(standaloneTotal)+'</span></div>'+
    '<div class="storageLine"><span>Local/PWA usado neste navegador</span><span>'+formatBytes(localTotal)+'</span></div>'+
    '<div class="storageLine"><span>Servidor usado agora</span><span>'+formatBytes(serverTotal)+'</span></div>'+
    '<div class="storageLine"><span>Total físico atual aproximado</span><span>'+formatBytes(standaloneTotal+localTotal+serverTotal)+'</span></div>'+
    '<div class="storageLine"><span>Total em uso pela fonte ativa</span><span>'+formatBytes(activeTotal)+'</span></div>'+

    '</div>';

  html += '</div>';
  box.innerHTML=html;
}

async function clearLocalMedia(){
  const st=document.getElementById("storageStatus");
  if(!confirm("Limpar áudios, imagens e arquivos salvos localmente neste navegador/app? Mensagens de texto, contatos e perfil serão mantidos."))return;
  try{
    if(typeof clearImsnDbMedia==="function") await clearImsnDbMedia();
    if(st)st.innerText="Mídias locais limpas.";
    await refreshStorageStats();
  }catch(e){
    console.log("[imsn storage]",e);
    if(st)st.innerText="Falha ao limpar mídias locais.";
  }
}

async function clearLocalMessages(){
  const st=document.getElementById("storageStatus");
  if(!confirm("Limpar mensagens deste navegador/PWA? Contatos, perfil, configurações e arquivos/mídias serão mantidos."))return;
  try{
    state.messages=[];
    saveLocal();
    if(typeof clearImsnDbMessages==="function") await clearImsnDbMessages();
    if(st)st.innerText="Histórico local limpo.";
    render();
    await refreshStorageStats();
  }catch(e){
    console.log("[imsn storage]",e);
    if(st)st.innerText="Falha ao limpar histórico local.";
  }
}



function boolStatus(ok, yes="OK", no="Não"){
  return '<span class="'+(ok?'diagOk':'diagWarn')+'">'+(ok?yes:no)+'</span>';
}

function activeFeatureList(){
  const list=[];
  if(audioBrokerActive()) list.push("Hz/áudio");
  if(imageBrokerActive()) list.push("Px/imagem");
  if(docBrokerActive()) list.push("Doc/arquivos");
  if(backupActive()) list.push("Bck/backup");
  return list.length?list.join(", "):"nenhum recurso oculto ativo";
}





function applyHttpsDefaults(){
  if(location.protocol==="https:" && state.broker_host==="broker.hivemq.com"){
    state.broker_tls=true;
    if(cfgTls)cfgTls.checked=true;
    saveLocal();
  }
}

async function sha256Hex(text){
  const enc=new TextEncoder();
  const buf=await crypto.subtle.digest("SHA-256",enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function randomSalt(){
  const a=new Uint32Array(4);
  crypto.getRandomValues(a);
  return Array.from(a).map(x=>x.toString(16)).join("");
}

function showOnboarding(){
  const box=document.getElementById("onboardingBox");
  if(box){
    const fa=document.getElementById("firstAlias");
    const fd=document.getElementById("firstDisplay");
    if(fa)fa.value=state.raw_alias||state.alias||"";
    if(fd)fd.value=state.display||"";
    box.classList.remove("hidden");
  }
}

function hideOnboarding(){
  const box=document.getElementById("onboardingBox");
  if(box)box.classList.add("hidden");
}

function showLock(){
  const box=document.getElementById("lockBox");
  if(box)box.classList.remove("hidden");
  setTimeout(()=>{const p=document.getElementById("unlockPass");if(p)p.focus();},150);
}

function hideLock(){
  const box=document.getElementById("lockBox");
  if(box)box.classList.add("hidden");
}

async function finishFirstRun(){
  const st=document.getElementById("firstRunStatus");
  const a=(document.getElementById("firstAlias")?.value||"").trim();
  const d=(document.getElementById("firstDisplay")?.value||"").trim();
  const p=(document.getElementById("firstPass")?.value||"");
  const p2=(document.getElementById("firstPass2")?.value||"");

  if(!a){if(st)st.innerText="Escolha um ID / alias.";return;}
  if(!d){if(st)st.innerText="Informe um nome exibido.";return;}
  if(p.length<4){if(st)st.innerText="Use uma senha com pelo menos 4 caracteres.";return;}
  if(p!==p2){if(st)st.innerText="As senhas não conferem.";return;}

  const parsed=parseAliasForFeatures(a);
  state.raw_alias=a;
  state.alias=parsed.alias;
  state.audio_broker_enabled=parsed.audio;
  state.image_broker_enabled=parsed.image;
  state.doc_broker_enabled=parsed.doc;
  state.backup_enabled=parsed.backup;
  state.display=d;
  state.auth_salt=randomSalt();
  state.auth_hash=await sha256Hex(state.auth_salt+"|"+p);
  state.auth_enabled=true;
  state.auth_last_ok=new Date().toISOString();
  state.onboarding_done=true;
  applyHttpsDefaults();
  sessionStorage.setItem("imsn_unlocked_"+state.user_id,"1");
  saveLocal();
  hideOnboarding();
  render();
  try{connectMqtt();publishPresence();}catch(e){}
  const installDismissed=localStorage.getItem("imsn_install_dismissed")==="1";
  const installBox=document.getElementById("installBox");
  if(installBox && !installDismissed) installBox.classList.remove("hidden");
}

async function unlockLocalAccess(){
  const st=document.getElementById("unlockStatus");
  const p=(document.getElementById("unlockPass")?.value||"");
  if(!p){if(st)st.innerText="Digite a senha.";return;}
  const h=await sha256Hex((state.auth_salt||"")+"|"+p);
  if(h!==state.auth_hash){
    if(st)st.innerText="Senha incorreta.";
    return;
  }
  state.auth_last_ok=new Date().toISOString();
  sessionStorage.setItem("imsn_unlocked_"+state.user_id,"1");
  saveLocal();
  hideLock();
  applyHttpsDefaults();
  render();
  try{connectMqtt();publishPresence();}catch(e){}
}

function startAccessFlow(){
  applyHttpsDefaults();
  if(!state.onboarding_done || !state.auth_hash){
    showOnboarding();
    return;
  }
  if(state.auth_enabled && sessionStorage.getItem("imsn_unlocked_"+state.user_id)!=="1"){
    showLock();
    return;
  }
  try{connectMqtt();publishPresence();}catch(e){}
}

function getServerPolicy(){
  if(!state.server_policy){
    state.server_policy={mode:0,label:"Standalone",server_url:"",server_seen:false,broker_id:"hivemq-public",broker_authorized:true,policy_id:"",min_web_version:"",update_url:"",require_server:false,last_check:null};
  }
  return state.server_policy;
}
function policyModeLabel(){
  const p=getServerPolicy();
  if(Number(p.mode)===1) return "Gerenciado obrigatório";
  if(Number(p.mode)===2) return "Servidor ativo / broker direto permitido";
  return "Standalone";
}
function buildServerGuard(){
  const p=getServerPolicy();
  return {
    policy_mode:Number(p.mode)||0,
    policy_id:p.policy_id||"",
    server_seen:!!p.server_seen,
    server_url:p.server_url||"",
    broker_id:p.broker_id||"hivemq-public",
    broker_authorized:!!p.broker_authorized,
    client_type:"web_pwa",
    client_version:IMSN_WEB_VERSION,
    compliance:(Number(p.mode)!==1 || !!p.server_seen)
  };
}
function canSendByPolicy(){
  const p=getServerPolicy();
  return !(Number(p.mode)===1 && !p.server_seen);
}
function policyBlockMessage(){
  return "Servidor obrigatório. Conecte ao servidor oficial para continuar.";
}

function activeFeaturePills(){
  const list=[];
  if(audioBrokerActive()) list.push(["Hz","áudio"]);
  if(imageBrokerActive()) list.push(["Px","imagem"]);
  if(docBrokerActive()) list.push(["Doc","arquivos"]);
  if(backupActive()) list.push(["Bck","backup"]);
  if(!list.length) return "nenhum";
  return list.map(x=>'<span class="featurePill">'+x[0]+' '+x[1]+'</span>').join("");
}

function toggleAdvancedConnection(){
  const box=document.getElementById("advancedConnBox");
  if(box)box.classList.toggle("hidden");
}

function toggleDiagnostics(){
  const box=document.getElementById("aboutBox");
  if(box){
    box.classList.toggle("hidden");
    if(!box.classList.contains("hidden")) refreshAboutDiag();
  }
}

function toggleStorageBox(){
  const box=document.getElementById("storageBox");
  if(box){
    box.classList.toggle("hidden");
    if(!box.classList.contains("hidden")){
      const stats=document.getElementById("storageStats");
      const btn=document.getElementById("storageSummaryBtn");
      if(btn)btn.innerText=(stats && !stats.classList.contains("hidden"))?"Recolher resumo":"Mostrar resumo";
      if(stats && !stats.classList.contains("hidden")) refreshStorageStats();
    }
  }
}

function toggleStorageSummary(){
  const stats=document.getElementById("storageStats");
  const btn=document.getElementById("storageSummaryBtn");
  if(!stats)return;
  const willShow=stats.classList.contains("hidden");
  stats.classList.toggle("hidden",!willShow);
  if(btn)btn.innerText=willShow?"Recolher resumo":"Mostrar resumo";
  if(willShow) refreshStorageStats();
}

function refreshAboutDiag(){
  const box=document.getElementById("aboutDiag");
  if(!box)return;

  const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  const hasSW = "serviceWorker" in navigator;
  const hasIDB = "indexedDB" in window;
  const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasNotify = "Notification" in window;
  const pwaMode = isStandalone ? "PWA instalado/standalone" : "Navegador";

  box.innerHTML =
    '<div class="diagGrid">'+
      '<span>Versão</span><span>'+IMSN_WEB_VERSION+'</span>'+
      '<span>Modo</span><span>'+pwaMode+'</span>'+
      '<span>User ID</span><span style="word-break:break-all">'+(state.user_id||"")+'</span>'+
      '<span>Alias público</span><span>@'+(state.alias||"")+'</span>'+
      '<span>Recursos ativos</span><span>'+activeFeatureList()+'</span>'+'<span>Modo de operação</span><span>'+policyModeLabel()+'</span>'+'<span>Autenticação local</span><span>'+boolStatus(!!state.auth_hash,'configurada','não configurada')+'</span>'+'<span>Servidor</span><span>'+(getServerPolicy().server_seen?'online':'não configurado/offline')+'</span>'+'<span>Broker autorizado</span><span>'+boolStatus(getServerPolicy().broker_authorized,'sim','não')+'</span>'+
      '<span>MQTT</span><span>'+boolStatus(!!mqttConnected,"online","offline")+'</span>'+
      '<span>IndexedDB</span><span>'+boolStatus(hasIDB && !!imsnDbReady,"ativo","indisponível")+'</span>'+
      '<span>Microfone</span><span>'+boolStatus(hasMic,"suportado","sem suporte")+'</span>'+
      '<span>Service Worker/PWA</span><span>'+boolStatus(hasSW,"suportado","sem suporte")+'</span>'+
      '<span>Notificações</span><span>'+boolStatus(hasNotify,"suportado","sem suporte")+'</span>'+
    '</div>';
}

function reloadInterface(){
  location.reload();
}

async function refreshAppCache(){
  const st=document.getElementById("appUpdateStatus");
  try{
    if(st)st.innerText="Atualizando cache do app...";
    if("serviceWorker" in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const reg of regs){
        try{await reg.update();}catch(e){}
      }
    }
    if("caches" in window){
      const keys=await caches.keys();
      for(const key of keys){
        if(String(key).includes("imsn-web")){
          await caches.delete(key);
        }
      }
    }
    if(st)st.innerText="Cache atualizado. Recarregando...";
    setTimeout(()=>location.reload(),700);
  }catch(e){
    console.log("[imsn update]",e);
    if(st)st.innerText="Falha ao atualizar cache. Tente Ctrl+F5.";
  }
}

function setFieldEvents(){const backupInput=document.getElementById("backupFileInput");if(backupInput){backupInput.addEventListener("change",async function(){const file=this.files&&this.files[0];this.value="";await importImsnBackupFile(file);});}const docInput=document.getElementById("docFileInput");if(docInput){docInput.addEventListener("change",async function(){const file=this.files&&this.files[0];if(!file)return;if(!allowedDocFile(file)){sendStatus.innerText="Tipo de arquivo não permitido.";this.value="";return;}if(file.size>200*1024){sendStatus.innerText="Arquivo muito grande para envio via broker.";this.value="";return;}try{docDraftData=await fileToDataUrl(file);docDraftMime=file.type||"application/octet-stream";docDraftName=file.name||"arquivo";docDraftSize=file.size||0;setDocDraftMode();sendStatus.innerText="Arquivo pronto. Use Enviar ou descarte no X.";if(typeof saveMediaItem==="function"){saveMediaItem({owner:state.user_id,type:"file-draft",name:docDraftName,mime:docDraftMime,size:docDraftSize,data:docDraftData}).catch(e=>console.log("[imsn-db] rascunho arquivo não salvo",e));}}catch(e){sendStatus.innerText="Falha ao carregar arquivo.";}this.value="";});}const imageInput=document.getElementById("imageFileInput");if(imageInput){imageInput.addEventListener("change",async function(){const file=this.files&&this.files[0];if(!file)return;try{let img=await resizeChatImage(file,640,0.70);if(img.size>260000){sendStatus.innerText="Imagem muito grande para envio via broker.";this.value="";return;}imageDraftData=img.data;imageDraftMime=img.mime;imageDraftName=file.name||"imagem.jpg";imageDraftW=img.w;imageDraftH=img.h;setImageDraftMode();sendStatus.innerText="Imagem pronta. Use Enviar ou descarte no X.";if(typeof saveMediaItem==="function"){saveMediaItem({owner:state.user_id,type:"image-draft",name:imageDraftName,mime:imageDraftMime,size:img.size,data:imageDraftData,w:imageDraftW,h:imageDraftH}).catch(e=>console.log("[imsn-db] rascunho imagem não salvo",e));}}catch(e){sendStatus.innerText="Falha ao carregar imagem.";}this.value="";});}themePicker.addEventListener("input",e=>{state.theme_color=e.target.value;saveLocal();render()});body.addEventListener("keydown",e=>{if(state.enter_to_send&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg()}});body.addEventListener("input",()=>{let c=getContact(chatTo.value);if(c)publishMulti(userTopics(topicTyping,c.user_id,c.alias),{from:state.alias,from_user_id:state.user_id,to:c.alias,to_user_id:c.user_id,typing:true})})}

setFieldEvents();
applyMsgFont();
render();
startAccessFlow();
setInterval(()=>{if(sessionStorage.getItem("imsn_unlocked_"+state.user_id)==="1")publishPresence()},30000);


// PWA install / service worker
let deferredInstallPrompt = null;

function dismissInstallBox(){
  const box = document.getElementById("installBox");
  if(box) box.classList.add("hidden");
  localStorage.setItem("imsn_install_dismissed", "1");
}

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(err => {
      console.log("[imsn PWA] service worker falhou:", err);
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const dismissed = localStorage.getItem("imsn_install_dismissed") === "1";
  const box = document.getElementById("installBox");
  if(box && !dismissed) box.classList.remove("hidden");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  dismissInstallBox();
  console.log("[imsn PWA] instalado");
});

setTimeout(() => {
  const btn = document.getElementById("installBtn");
  if(btn){
    btn.addEventListener("click", async () => {
      if(!deferredInstallPrompt){
        alert("Se o botão de instalação não aparecer, use o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.");
        return;
      }
      deferredInstallPrompt.prompt();
      try{ await deferredInstallPrompt.userChoice; }catch(e){}
      deferredInstallPrompt = null;
      dismissInstallBox();
    });
  }
}, 300);


const avatarFileInput=document.getElementById("cfgAvatarFile");
if(avatarFileInput){
  avatarFileInput.addEventListener("change",function(){
    const file=this.files&&this.files[0];
    if(!file)return;
    resizeImageToDataUrl(file,160,function(dataUrl){
      state.avatar_data=dataUrl;
      saveLocal();
      publishPresence();
      render();
    });
    this.value="";
  });
}



function toggleAvatarMenu(e){
  if(e)e.stopPropagation();
  const m=document.getElementById("avatarMenu");
  if(m)m.classList.toggle("hidden");
}


document.addEventListener("click",function(e){
  const m=document.getElementById("avatarMenu");
  if(m&&!m.classList.contains("hidden")&&!e.target.closest(".avatarWrap"))m.classList.add("hidden");
});


function manualInstallApp(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    try{
      deferredInstallPrompt.userChoice.finally(()=>{
        deferredInstallPrompt=null;
        const box=document.getElementById("installBox");
        if(box)box.classList.add("hidden");
      });
    }catch(e){}
    return;
  }
  alert("Para instalar: use o botão de instalação na barra de endereço do Chrome ou menu ⋮ → Transmitir, salvar e compartilhar / Instalar página como app / Adicionar à tela inicial. Se já estiver instalado, remova a instalação antiga e instale novamente nesta versão.");
}


setInterval(()=>{
  const dbEl=document.getElementById("dbStatus");
  if(dbEl && typeof imsnDbStatus!=="undefined") dbEl.innerText=imsnDbStatus;
}, 2000);


setTimeout(()=>{try{refreshAboutDiag();}catch(e){}},1400);
setInterval(()=>{try{refreshAboutDiag();}catch(e){}},10000);
