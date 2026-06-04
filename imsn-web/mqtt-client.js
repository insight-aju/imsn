let mqttClient=null;
let mqttConnected=false;
function normalizeIncomingFont(doc){let f=(doc.font||doc.msg_font||doc.font_style||doc.fontStyle||"normal").toString().toLowerCase();if(f==="itálico")f="italico";if(f==="retrô")f="retro";return ["normal","grande","pequena","negrito","italico","retro"].includes(f)?f:"normal";}

function topicUserBase(userId){return "imsn/bootstrap/u/" + userId}
function topicInbox(userId){return topicUserBase(userId)+"/inbox"}
function topicTyping(userId){return topicUserBase(userId)+"/typing"}
function topicNudge(userId){return topicUserBase(userId)+"/nudge"}
function topicInvite(userId){return topicUserBase(userId)+"/invite"}
function topicInviteResp(userId){return topicUserBase(userId)+"/invite/response"}
function topicDiscoveryResp(userId){return topicUserBase(userId)+"/discovery/response"}
function topicPresence(userId){return topicUserBase(userId)+"/presence"}
function topicDiscoveryRequest(){return "imsn/bootstrap/discovery/request"}

function brokerUrl(){
  const tls = !!state.broker_tls;
  const port = tls ? 8884 : 8000;
  const proto = tls ? "wss" : "ws";
  return `${proto}://${state.broker_host}:${port}${state.broker_path||"/mqtt"}`;
}

function connectMqtt(){
  if(typeof mqtt === "undefined"){
    setMqttStatus("Biblioteca MQTT não carregou. Verifique internet/CDN.");
    return;
  }
  if(mqttClient) try{mqttClient.end(true)}catch(e){}
  const url = brokerUrl();
  setMqttStatus("Conectando em " + url + " ...");
  mqttClient = mqtt.connect(url, {
    clientId: state.user_id + "-" + Math.floor(Math.random()*9999),
    clean:true,
    reconnectPeriod:3000,
    connectTimeout:12000,
    will:{
      topic:topicPresence(state.user_id),
      payload:JSON.stringify({user_id:state.user_id,alias:state.alias,online:false,status:"offline"}),
      qos:0,
      retain:true
    }
  });

  mqttClient.on("connect", ()=>{
    mqttConnected=true;
    setMqttStatus("MQTT conectado");
    subscribeBase();
    publishPresence();
    render();
  });

  mqttClient.on("reconnect", ()=>setMqttStatus("Reconectando MQTT..."));
  mqttClient.on("error", err=>setMqttStatus("MQTT erro: "+err.message));
  mqttClient.on("close", ()=>{mqttConnected=false;setMqttStatus("MQTT desconectado");render();});
  mqttClient.on("message", handleMqttMessage);
}

function disconnectMqtt(){
  if(mqttClient) mqttClient.end(true);
  mqttClient=null;
  mqttConnected=false;
  setMqttStatus("MQTT desconectado manualmente");
  render();
}

function subscribeBase(){
  [
    topicInbox(state.user_id),
    topicTyping(state.user_id),
    topicNudge(state.user_id),
    topicInvite(state.user_id),
    topicInviteResp(state.user_id),
    topicDiscoveryResp(state.user_id),
    topicDiscoveryRequest(),
    "imsn/bootstrap/u/+/presence"
  ].forEach(t=>mqttClient.subscribe(t));
}

function publish(topic,payload,retain=false){
  if(!mqttConnected||!mqttClient)return false;
  console.log("[imsn publish]", topic, payload);
  mqttClient.publish(topic, JSON.stringify(payload), {retain});
  return true;
}

function publishMulti(topics,payload,retain=false){
  let ok=false;
  const sent=new Set();
  (topics||[]).forEach(t=>{
    if(!t||sent.has(t))return;
    sent.add(t);
    if(publish(t,payload,retain))ok=true;
  });
  return ok;
}
function userTopics(topicFn,userId,alias){
  const out=[];
  if(userId)out.push(topicFn(userId));
  if(alias && alias!==userId)out.push(topicFn(alias));
  return out;
}


function publishPresence(){
  if(!mqttConnected)return;
  const eff = state.status;
  publish(topicPresence(state.user_id), {
    user_id:state.user_id,
    alias:state.alias,
    display:state.display,
    status:eff,
    selected_status:state.status,
    message:state.message,
    avatar:state.avatar_data||"",
    device:"imsn-web",
    short:state.short_id,
    online:(eff!=="offline"&&eff!=="invisivel"),
    audio_broker:audioBrokerActive(),
    image_broker:imageBrokerActive(),
    doc_broker:docBrokerActive()
  }, true);
}

function handleMqttMessage(topic, payload){
  let doc;
  try{doc=JSON.parse(payload.toString())}catch(e){return}
  if(topic.endsWith("/presence")) return updatePresence(doc);

  const from = doc.from||"";
  const fromUserId = doc.from_user_id||"";
  const toUserId = doc.to_user_id||"";
  const display = doc.display||from;
  const status = doc.status||"online";

  if(topic===topicDiscoveryRequest()){
    if(doc.to===state.alias && fromUserId && state.status!=="invisivel"){
      publishMulti(userTopics(topicDiscoveryResp,fromUserId,from), {
        from:state.alias, from_user_id:state.user_id, to_user_id:fromUserId,
        display:state.display, status:state.status, message:state.message,
    avatar:state.avatar_data||"",
        device:"imsn-web", short:state.short_id, client_version:IMSN_WEB_VERSION, server_guard:buildServerGuard(), audio_broker:audioBrokerActive(),
    image_broker:imageBrokerActive(),
    doc_broker:docBrokerActive()
      });
    }
    return;
  }

  if(topic===topicDiscoveryResp(state.user_id)){
    // Evita tocar som/travar em loop quando o mesmo contato responde mais de uma vez
    // ou quando o broker entrega respostas repetidas enquanto a busca já está como found.
    if(toUserId===state.user_id && from===state.search_alias && state.search_state==="searching"){
      rememberKnownUser({user_id:fromUserId,alias:from,display:display,status:status});
      state.search_state="found";state.search_user_id=fromUserId;state.search_display=display;state.search_status=status;state.search_avatar=doc.avatar||"";state.search_audio=!!doc.audio_broker;state.search_image=!!doc.image_broker;state.search_doc=!!doc.doc_broker;state.invite_result="contato encontrado";
      saveLocal();render();playInviteSound();
    }
    return;
  }

  if(topic===topicInvite(state.user_id)){
    if(toUserId===state.user_id && from){
      rememberKnownUser({user_id:fromUserId,alias:from,display:display,status:status});
      state.pending_invite_from=from;state.pending_invite_user_id=fromUserId||knownUserIdByAlias(from);state.pending_invite_display=display;state.pending_invite_avatar=doc.avatar||"";state.pending_invite_audio=!!doc.audio_broker;state.pending_invite_image=!!doc.image_broker;state.pending_invite_doc=!!doc.doc_broker;
      saveLocal();render();showToast(display+" quer conversar.",from);playInviteSound();
    }
    return;
  }

  if(topic===topicInviteResp(state.user_id)){
    const answer=doc.answer||"";
    if(toUserId===state.user_id && from){
      if(answer==="accept"){
        upsertContact({user_id:fromUserId,alias:from,display,status,avatar:doc.avatar||"",audio_broker:!!doc.audio_broker,image_broker:!!doc.image_broker,doc_broker:!!doc.doc_broker,saved:true,conversation:true});
        state.active_contact=fromUserId || from;
        try{chatTo.value=state.active_contact;openChatPanel();}catch(e){}
      }
      state.invite_result = answer==="accept" ? `${from} aceitou o convite` : `${from} recusou o convite`;
      saveLocal();render();showToast(state.invite_result,from);playInviteAcceptedSound();
    }
    return;
  }

  if(topic===topicTyping(state.user_id)){
    const c = getContact(fromUserId)||getContact(from);
    state.typing_from = (c && c.alias) ? c.alias : from;
    state.typing_from_user_id = fromUserId || (c && c.user_id) || "";
    const typingKey = state.typing_from_user_id || state.typing_from;
    setTimeout(()=>{
      if((state.typing_from_user_id || state.typing_from) === typingKey){
        state.typing_from="";
        state.typing_from_user_id="";
        render();
      }
    },3000);
    render();
    return;
  }

  if(topic===topicNudge(state.user_id)){
    const c = getContact(fromUserId)||getContact(from);
    if(c && c.blocked){
      sendBlockedNotice(fromUserId, from);
      return;
    }
    state.nudge_from=from;state.nudge_display=display;state.nudge_seq++;
    if(c && c.saved){
      // Se a conversa foi fechada pelo X, um nudge de contato salvo reabre a conversa localmente.
      c.conversation=true;
      addMessage({from:c.alias,to:state.alias,body:`⚡ ${display} chamou sua atenção!`,type:"nudge",incoming:true,msg_id:"nudge-rx-"+Date.now()});
    }
    saveLocal();render();
    // Chamar atenção deve tocar sempre, inclusive quando a conversa está aberta.
    playNudgeSound();
    setTimeout(()=>playNudgeSound(), 900);
    showToast(display+" está chamando sua atenção!",from);
    return;
  }

  if(topic===topicInbox(state.user_id)){
    if(toUserId!==state.user_id)return;
    const c = getContact(fromUserId)||getContact(from);
    if(c && c.blocked){
      sendBlockedNotice(fromUserId, from);
      return;
    }
    if(doc.type==="blocked_notice"){
      addMessage({from, to:state.alias, body:doc.body||"Mensagem não entregue: bloqueio temporário.", type:"system", incoming:true, msg_id:doc.msg_id||"blocked-"+Date.now()});
      saveLocal();render();return;
    }
    if(!c || !c.saved)return;
    // Se a conversa foi fechada pelo X, uma nova mensagem de contato salvo reabre a conversa.
    c.conversation=true;
    addMessage({from:c.alias,to:state.alias,body:doc.body||"",type:doc.type||"text",font:normalizeIncomingFont(doc),incoming:true,msg_id:doc.msg_id||"rx-"+Date.now(),audio_data:doc.audio_data||"",audio_mime:doc.audio_mime||"",duration:doc.duration||0,waveform:doc.waveform||[],media_url:doc.media_url||"",image_data:doc.image_data||"",image_mime:doc.image_mime||"",image_name:doc.image_name||"",image_w:doc.image_w||0,image_h:doc.image_h||0,file_data:doc.file_data||"",file_mime:doc.file_mime||"",file_name:doc.file_name||"",file_size:doc.file_size||0});
    saveLocal();detectIncoming(c);render();
  }
}

function sendBlockedNotice(targetUserId,targetAlias){
  if(!targetUserId)return;
  publishMulti(userTopics(topicInbox,targetUserId,targetAlias), {
    from:state.alias, from_user_id:state.user_id,
    to:targetAlias, to_user_id:targetUserId,
    display:state.display, type:"blocked_notice",
    body:"Sua mensagem não foi entregue. Você está bloqueado temporariamente por este usuário.",
    msg_id:state.user_id+"-blocked-"+Date.now()
  });
}
