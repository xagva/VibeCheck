// app.js — vanilla PWA main logic with landing gating + collapsible profile panel
const KEY = 'habit-bic-pwa-v1';
const $ = id => document.getElementById(id);
const todayKey = (d=new Date()) => d.toISOString().slice(0,10);
let chart=null, consistencyChartRef=null, habitChartRef=null;

// Load / save local
function loadLocal(){ try{ return JSON.parse(localStorage.getItem(KEY)) || { users: {}, currentUserId: null }; }catch(e){ return { users:{}, currentUserId:null }; } }
function saveLocal(data){ try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){console.warn(e);} }

let app = loadLocal();

// Firebase init (compat) if config provided
let firebaseEnabled=false, auth=null, db=null;
if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseEnabled = true;
    console.log('Firebase enabled');
    auth.onAuthStateChanged(async (user)=> { if(user) await loadRemoteUser(user); else { showLanding(); renderAuth(); } });
  } catch(e){ console.warn('Firebase init failed', e); firebaseEnabled=false; showLanding(); }
} else {
  // no firebase config, show landing and local-only flows
  showLanding();
}

// ---------- Landing helpers ----------
function showLanding(){
  const landing = $('landing-screen');
  const main = $('main-root');
  if (landing) landing.style.display = 'flex';
  if (main) main.style.display = 'none';
}
function hideLanding(){
  const landing = $('landing-screen');
  const main = $('main-root');
  if (landing) landing.style.display = 'none';
  if (main) main.style.display = 'block';
}

// ---------- AUTH UI ----------
function renderAuth(){
  const area = $('auth-area');
  area.innerHTML = '';
  const currentUser = getCurrentUser();
  if (currentUser) {
    if (firebaseEnabled && auth && auth.currentUser) {
      area.innerHTML = `<div>Signed in: ${auth.currentUser.email || auth.currentUser.displayName} <button id="btn-signout">Sign out</button></div>`;
      $('btn-signout').onclick = ()=>auth.signOut();
    } else {
      area.innerHTML = `<div>Using: ${currentUser.displayName} <button id="btn-signout-local">Sign out</button></div>`;
      $('btn-signout-local').onclick = ()=>{ app.currentUserId = null; saveLocal(app); showLanding(); renderAll(); };
    }
    return;
  }

  if (firebaseEnabled) {
    area.innerHTML = `<div class="flexcol">
      <input id="auth-email" placeholder="Email" type="email" />
      <input id="auth-pass" placeholder="Password" type="password" />
      <div class="row" style="margin-top:6px">
        <button id="btn-signup">Sign up</button>
        <button id="btn-signin">Sign in</button>
        <button id="btn-guest">Use guest (local)</button>
      </div>
    </div>`;
    $('btn-signup').onclick = authSignUp;
    $('btn-signin').onclick = authSignIn;
    $('btn-guest').onclick = ()=>{ ensureLocalUser('guest'); hideLanding(); renderAll(); };
  } else {
    area.innerHTML = `<div class="small">Using local-only mode.</div>
      <div style="margin-top:6px"><button id="btn-create-local">Add local user</button></div>`;
    $('btn-create-local').onclick = ()=>{ ensureLocalUser(prompt('username:')||('user_'+Math.random().toString(36).slice(2,5))); hideLanding(); renderAll(); };
  }
}

async function authSignUp(){ const email=$('auth-email').value.trim(), pass=$('auth-pass').value; if(!email||!pass) return alert('email+password required'); try{ const cred = await auth.createUserWithEmailAndPassword(email,pass); await saveRemoteUser(cred.user.uid); }catch(e){ alert('Signup failed: '+e.message); } }
async function authSignIn(){ const email=$('auth-email').value.trim(), pass=$('auth-pass').value; if(!email||!pass) return alert('email+password required'); try{ await auth.signInWithEmailAndPassword(email,pass); }catch(e){ alert('Signin failed: '+e.message); } }

// Remote user mapping for Firebase
async function loadRemoteUser(user){
  if(!db) return;
  const uid = user.uid;
  const id = 'u_'+uid; // deterministic key
  const docRef = db.collection('users').doc(uid);
  try {
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      app.users[id] = { displayName: user.email || user.displayName || 'user', isLocal:false, createdAt:new Date().toISOString(), state: data.appState || { habits:{} } };
      app.currentUserId = id;
      saveLocal(app);
      hideLanding();
      renderAll();
    } else {
      app.users[id] = { displayName: user.email || 'user', isLocal:false, createdAt:new Date().toISOString(), state: { habits:{} } };
      app.currentUserId = id;
      saveLocal(app);
      await docRef.set({ userMeta:{ email: user.email, createdAt:new Date().toISOString() }, appState: app.users[id].state });
      hideLanding();
      renderAll();
    }
  } catch(e){ console.warn('loadRemoteUser failed', e); }
}

async function saveRemoteUser(uid){
  if(!db || !auth || !auth.currentUser) return;
  const docRef = db.collection('users').doc(uid);
  const user = getCurrentUser();
  if (!user) return;
  try { await docRef.set({ userMeta:{ email: auth.currentUser.email, updatedAt: new Date().toISOString() }, appState: user.state }, { merge:true }); } catch(e){ console.warn('sync failed', e); }
}

// ---------- DATA functions ----------
function ensureLocalUser(name){ name = name || ('user_'+Math.random().toString(36).slice(2,5)); const id = 'local_'+name.replace(/\s+/g,'_') + '_' + Math.random().toString(36).slice(2,4); app.users[id] = { displayName: name, isLocal:true, createdAt: new Date().toISOString(), state: { habits: {} } }; app.currentUserId = id; saveLocal(app); hideLanding(); return id; }
function getCurrentUser(){ return app.users[app.currentUserId] || null; }
function addHabit(name){ const user = getCurrentUser(); if(!user) return alert('Select or create a user'); const id = 'h_' + Math.random().toString(36).slice(2,9); user.state.habits[id] = { id, name: name || 'Habit', history: {} }; saveLocal(app); renderAll(); syncIfRemote(); }
function deleteHabit(hid){ const user = getCurrentUser(); if(!user) return; delete user.state.habits[hid]; saveLocal(app); renderAll(); syncIfRemote(); }
function setEntry(hid, dateKey, n){ const user = getCurrentUser(); if(!user) return; const h = user.state.habits[hid]; if(!h) return; h.history = h.history||{}; h.history[dateKey] = { indulgences: Math.max(0, Math.floor(Number(n)||0)), updatedAt: new Date().toISOString() }; saveLocal(app); renderAll(); syncIfRemote(); }
function removeEntry(hid, dateKey){ const user = getCurrentUser(); if(!user) return; const h = user.state.habits[hid]; if(!h) return; delete h.history[dateKey]; saveLocal(app); renderAll(); syncIfRemote(); }

function computeAggregatesForUser(user){
  const days = {}; Object.values(user.state.habits || {}).forEach(h=>{ Object.entries(h.history||{}).forEach(([date,entry])=>{ days[date]=days[date]||{indulgences:0}; days[date].indulgences += entry.indulgences||0; }); }); const totalDays = Object.keys(days).length; let C=0,I=0; Object.values(days).forEach(d=>{ if(d.indulgences===0) C++; else I++; }); const bic = totalDays===0?0:(C - I*(1 - (C/totalDays))); return { totalDays, C, I, bic: Number(bic.toFixed(4)), days };
}

// Habit-level score (same logic but per habit)
function computeHabitScore(h){
  const days = h && h.history ? Object.keys(h.history) : [];
  const total = days.length;
  let C=0,I=0;
  if(h && h.history){
    Object.values(h.history).forEach(e => { if((e.indulgences||0)===0) C++; else I++; });
  }
  const sc = total===0?0:(C - I*(1 - (C/total)));
  return Number(sc.toFixed(3));
}

// Consistency series & charts (unchanged logic)
function buildConsistencySeries(user, mode='30'){
  const days = {}; Object.values(user.state.habits || {}).forEach(h=>{ Object.entries(h.history||{}).forEach(([date,entry])=>{ days[date]=days[date]||{indulgences:0}; days[date].indulgences +=
