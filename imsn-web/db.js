/*
  imsn-web local database v0.4.0
  ------------------------------------------------------------
  Camada IndexedDB preparada para dados maiores:
  - media: avatar, áudio, imagens e arquivos futuros
  - messages: histórico futuro mais parrudo
  - meta: flags e informações internas

  Nesta versão, a lógica atual continua compatível com localStorage.
  O IndexedDB entra como base segura para as próximas fases de mídia.
*/

const IMSN_DB_NAME = "imsn_web_db";
const IMSN_DB_VERSION = 1;

let imsnDb = null;
let imsnDbReady = false;
let imsnDbStatus = "iniciando";

function openImsnDb(){
  return new Promise((resolve, reject)=>{
    if(!("indexedDB" in window)){
      imsnDbStatus = "IndexedDB indisponível neste navegador";
      reject(new Error(imsnDbStatus));
      return;
    }

    const req = indexedDB.open(IMSN_DB_NAME, IMSN_DB_VERSION);

    req.onupgradeneeded = function(event){
      const db = event.target.result;

      if(!db.objectStoreNames.contains("meta")){
        db.createObjectStore("meta", {keyPath:"key"});
      }

      if(!db.objectStoreNames.contains("media")){
        const media = db.createObjectStore("media", {keyPath:"id"});
        media.createIndex("owner", "owner", {unique:false});
        media.createIndex("type", "type", {unique:false});
        media.createIndex("created_at", "created_at", {unique:false});
      }

      if(!db.objectStoreNames.contains("messages")){
        const messages = db.createObjectStore("messages", {keyPath:"msg_id"});
        messages.createIndex("contact", "contact", {unique:false});
        messages.createIndex("created_at", "created_at", {unique:false});
        messages.createIndex("type", "type", {unique:false});
      }
    };

    req.onsuccess = function(event){
      imsnDb = event.target.result;
      imsnDbReady = true;
      imsnDbStatus = "IndexedDB ativo";
      resolve(imsnDb);
    };

    req.onerror = function(){
      imsnDbStatus = "Falha ao abrir IndexedDB";
      reject(req.error);
    };
  });
}

function dbTx(storeName, mode="readonly"){
  if(!imsnDb) throw new Error("IndexedDB ainda não abriu");
  return imsnDb.transaction(storeName, mode).objectStore(storeName);
}

function dbPut(storeName, value){
  return new Promise((resolve, reject)=>{
    try{
      const req = dbTx(storeName, "readwrite").put(value);
      req.onsuccess = ()=>resolve(value);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
}

function dbGet(storeName, key){
  return new Promise((resolve, reject)=>{
    try{
      const req = dbTx(storeName, "readonly").get(key);
      req.onsuccess = ()=>resolve(req.result || null);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
}

function dbDelete(storeName, key){
  return new Promise((resolve, reject)=>{
    try{
      const req = dbTx(storeName, "readwrite").delete(key);
      req.onsuccess = ()=>resolve(true);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
}

function dbGetAllByIndex(storeName, indexName, value){
  return new Promise((resolve, reject)=>{
    try{
      const req = dbTx(storeName, "readonly").index(indexName).getAll(value);
      req.onsuccess = ()=>resolve(req.result || []);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
}

async function saveMediaItem(item){
  if(!imsnDbReady) await openImsnDb();
  const now = Date.now();
  const full = Object.assign({
    id: "media-" + now + "-" + Math.floor(Math.random()*999999),
    owner: "local",
    type: "generic",
    name: "",
    mime: "",
    size: 0,
    created_at: now
  }, item || {});
  await dbPut("media", full);
  return full;
}

async function getMediaItem(id){
  if(!imsnDbReady) await openImsnDb();
  return await dbGet("media", id);
}

async function deleteMediaItem(id){
  if(!imsnDbReady) await openImsnDb();
  return await dbDelete("media", id);
}

async function saveMessageRecord(message){
  if(!imsnDbReady) await openImsnDb();
  if(!message || !message.msg_id) return null;
  const record = Object.assign({}, message, {
    created_at: message.ms || Date.now(),
    contact: message.incoming ? message.from : message.to
  });
  await dbPut("messages", record);
  return record;
}

async function getMessagesForContact(contact){
  if(!imsnDbReady) await openImsnDb();
  return await dbGetAllByIndex("messages", "contact", contact);
}

openImsnDb()
  .then(()=>console.log("[imsn-db]", imsnDbStatus))
  .catch(err=>console.log("[imsn-db]", imsnDbStatus, err));


function dbGetAll(storeName){
  return new Promise((resolve, reject)=>{
    try{
      const req = dbTx(storeName, "readonly").getAll();
      req.onsuccess = ()=>resolve(req.result || []);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
}

async function exportImsnDbData(){
  if(!imsnDbReady) await openImsnDb();
  return {
    meta: await dbGetAll("meta"),
    media: await dbGetAll("media"),
    messages: await dbGetAll("messages")
  };
}

async function importImsnDbData(data){
  if(!data) return false;
  if(!imsnDbReady) await openImsnDb();

  async function putMany(storeName, items){
    if(!Array.isArray(items)) return;
    for(const item of items){
      if(item) await dbPut(storeName, item);
    }
  }

  await putMany("meta", data.meta);
  await putMany("media", data.media);
  await putMany("messages", data.messages);
  return true;
}


function dbClearStore(storeName){
  return new Promise((resolve, reject)=>{
    try{
      const req = dbTx(storeName, "readwrite").clear();
      req.onsuccess = ()=>resolve(true);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
}

async function getImsnDbStats(){
  if(!imsnDbReady) await openImsnDb();

  async function all(store){
    try{return await dbGetAll(store);}catch(e){return [];}
  }

  const media = await all("media");
  const messages = await all("messages");
  const meta = await all("meta");

  function approxSize(items){
    try{return new Blob([JSON.stringify(items||[])]).size;}catch(e){return 0;}
  }

  const mediaByType = {};
  const mediaSizeByType = {};
  for(const item of media){
    const t = item && item.type ? item.type : "outros";
    mediaByType[t] = (mediaByType[t] || 0) + 1;
    mediaSizeByType[t] = (mediaSizeByType[t] || 0) + approxSize([item]);
  }

  return {
    media_count: media.length,
    messages_count: messages.length,
    meta_count: meta.length,
    media_size: approxSize(media),
    messages_size: approxSize(messages),
    meta_size: approxSize(meta),
    media_by_type: mediaByType,
    media_size_by_type: mediaSizeByType
  };
}

async function clearImsnDbMedia(){
  if(!imsnDbReady) await openImsnDb();
  await dbClearStore("media");
  return true;
}

async function clearImsnDbMessages(){
  if(!imsnDbReady) await openImsnDb();
  await dbClearStore("messages");
  return true;
}
