const STORAGE_KEY = "imsn_web_state_v01";

function makeId(prefix="imsn-web"){
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  return prefix + "-" + Array.from(a).map(x=>x.toString(16).padStart(8,"0")).join("");
}

function loadLocal(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{return JSON.parse(raw)}catch(e){}
  }
  const userId = makeId();
  const short = userId.slice(-4).toUpperCase();
  return {
    user_id:userId,
    short_id:short,
    alias:"web"+short,
    raw_alias:"web"+short,
    audio_broker_enabled:false,
    image_broker_enabled:false,
    doc_broker_enabled:false,
    backup_enabled:false,
    display:"Usuário Web "+short,
    status:"online",
    message:"Disponível no imsn-web",
    theme_color:"#2c8df0",
    avatar_data:"",
    enter_to_send:true,
    current_msg_font:"normal",
    broker_host:"broker.hivemq.com",
    broker_path:"/mqtt",
    broker_tls:false,
    onboarding_done:false,
    auth_enabled:false,
    auth_salt:"",
    auth_hash:"",
    auth_last_ok:"",
    contacts:[],
    messages:[],
    active_contact:"",
    search_alias:"",
    search_state:"idle",
    search_user_id:"",
    search_display:"",
    search_status:"offline",
    pending_invite_from:"",
    pending_invite_user_id:"",
    pending_invite_display:"",
    invite_result:"",
    nudge_seq:0,
    nudge_from:"",
    nudge_display:"",
    typing_from:"",
    typing_from_user_id:"",
    groups_open:{online:true,ocupado:true,ausente:true,offline:true,bloqueados:true},
    known_users:[]
  };
}

function saveLocal(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
