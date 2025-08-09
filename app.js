// Habit Tracker PWA — Vanilla JS with Firebase compat integration (optional)
// Data model per user:
// { displayName, isLocal, createdAt, state: { habits: { id: { id, name, history: { '2025-08-09': { indulgences: 1 } } } } } }

const KEY = 'habit-bic-pwa-v1';

// Utilities
const $ = (id) => document.getElementById(id);
const todayKey = (d=new Date()) => d.toISOString().slice(0,10);
let chart = null;

// Load/Save local
function loadLocal(){
  try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, currentUserId: null } } catch(e){ return { users:{}, currentUserId:null } }
}
function saveLocal(data){ try{ localStorage.setItem(KEY, JSON.stringify(data)) }catch(e){console.warn(e)} }

let app = loadLocal();

// Firebase init if config provided
let firebaseEnabled = false;
let db = null;
let auth = null;
if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseEnabled = true;
    console.log('Firebase enabled');
    // auth listener
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        // load or create user doc
        await loadRemoteUser(user);
      } else {
        renderAuth();
      }
    });
  } catch(e){ console.warn('Firebase init failed', e); firebaseEnabled=false }
}

// --- Auth UI and functions ---
function renderAuth(){
  const area = $('auth-area');
  area.innerHTML = '';
  const currentUser = getCurrentUser();

  // If a user is selected locally (or a firebase user is mapped) => hide the full signin form
  if (currentUser) {
    // show small info and "Sign out" only if firebase auth exists, otherwise just show user display name
    if (firebaseEnabled && auth && auth.currentUser) {
      area.innerHTML = `<div>Signed in: ${auth.currentUser.email || auth.currentUser.displayName} <button id="btn-signout">Sign out</button></div>`;
      $('btn-signout').onclick = ()=>auth.signOut();
    } else {
      area.innerHTML = `<div>Using: ${currentUser.displayName} <button id="btn-signout-local">Sign out</button></div>`;
      $('btn-signout-local').onclick = ()=>{ app.currentUserId = null; saveLocal(app); renderAll(); };
    }
    return;
  }

  // No current user: show auth or local options
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
    $('btn-guest').onclick = ()=>{ ensureLocalUser('guest'); renderAll(); };
  } else {
    area.innerHTML = `<div class="small">Firebase not configured. Using local-only mode. You can add local users or paste your Firebase config in <code>firebase-config.js</code>.</div>
      <div style="margin-top:6px"><button id="btn-create-local">Add local user</button></div>`;
    $('btn-create-local').onclick = ()=>{ ensureLocalUser(prompt('username:')||('user_'+Math.random().toString(36).slice(2,5))); renderAll(); };
  }
}
async function authSignUp(){
  const email = $('auth-email').value.trim(), pass = $('auth-pass').value;
  if(!email||!pass) return alert('email+password required');
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    // create user doc
    await saveRemoteUser(cred.user.uid);
  }catch(e){ alert('Signup failed: '+e.message) }
}
async function authSignIn(){
  const email = $('auth-email').value.trim(), pass = $('auth-pass').value;
  if(!email||!pass) return alert('email+password required');
  try{ await auth.signInWithEmailAndPassword(email, pass); }catch(e){ alert('Signin failed: '+e.message) }
}

async function saveRemoteUser(uid){
  if(!db||!auth) return;
  const docRef = db.collection('users').doc(uid);
  const existing = await docRef.get();
  if(!existing.exists){
    const local = app.users[app.currentUserId] || { displayName: auth.currentUser.email || 'user', isLocal:false, createdAt:new Date().toISOString(), state:{ habits:{} } };
    await docRef.set({ userMeta: { email: auth.currentUser.email, createdAt: new Date().toISOString() }, appState: local.state });
  }
}

async function loadRemoteUser(user){
  if(!db) return;
  const docRef = db.collection('users').doc(user.uid);
  const snap = await docRef.get();
  if(snap.exists){
    const data = snap.data();
    // merge remote into local under a new local user id
    const id = 'u_'+user.uid.slice(0,8);
    app.users[id] = { displayName: user.email, isLocal:false, createdAt:new Date().toISOString(), state: data.appState || { habits:{} } };
    app.currentUserId = id;
    saveLocal(app);
    renderAll();
  } else {
    // create doc using local guest state if present
    const id = 'u_'+user.uid.slice(0,8);
    app.users[id] = { displayName: user.email, isLocal:false, createdAt:new Date().toISOString(), state: { habits:{} } };
    app.currentUserId = id;
    saveLocal(app);
    await docRef.set({ userMeta: { email: user.email, createdAt: new Date().toISOString() }, appState: app.users[id].state });
    renderAll();
  }
}

// --- App data functions ---
function ensureLocalUser(name){
  name = name || ('user_'+Math.random().toString(36).slice(2,5));
  const id = 'local_'+name.replace(/\s+/g,'_') + '_' + Math.random().toString(36).slice(2,4);
  app.users[id] = { displayName: name, isLocal:true, createdAt: new Date().toISOString(), state: { habits: {} } };
  app.currentUserId = id;
  saveLocal(app);
  return id;
}

function getCurrentUser(){
  return app.users[app.currentUserId] || null;
}

function addHabit(name){
  const user = getCurrentUser();
  if(!user) return alert('Select or create a user');
  const id = 'h_' + Math.random().toString(36).slice(2,9);
  user.state.habits[id] = { id, name: name || 'Habit', history: {} };
  saveLocal(app); renderAll();
  syncIfRemote();
}

function deleteHabit(hid){
  const user = getCurrentUser();
  if(!user) return;
  delete user.state.habits[hid];
  saveLocal(app); renderAll(); syncIfRemote();
}

function setEntry(hid, dateKey, n){
  const user = getCurrentUser(); if(!user) return;
  const h = user.state.habits[hid];
  if(!h) return;
  h.history = h.history || {};
  h.history[dateKey] = { indulgences: Math.max(0, Math.floor(Number(n)||0)), updatedAt: new Date().toISOString() };
  saveLocal(app); renderAll(); syncIfRemote();
}

function removeEntry(hid, dateKey){
  const user = getCurrentUser(); if(!user) return;
  const h = user.state.habits[hid]; if(!h) return;
  delete h.history[dateKey]; saveLocal(app); renderAll(); syncIfRemote();
}

function computeAggregatesForUser(user){
  // aggregate across habits
  const days = {};
  Object.values(user.state.habits || {}).forEach(h => {
    Object.entries(h.history || {}).forEach(([date, entry]) => {
      days[date] = days[date] || { indulgences: 0 };
      days[date].indulgences += entry.indulgences || 0;
    });
  });
  const totalDays = Object.keys(days).length;
  let C=0,I=0;
  Object.values(days).forEach(d => { if(d.indulgences === 0) C++; else I++; });
  const bic = totalDays === 0 ? 0 : (C - I*(1 - (C/totalDays)));
  return { totalDays, C, I, bic: Number(bic.toFixed(4)), days };
}

// Return sorted array of unique dates across all habits for the user
function getAllDatesForUser(user) {
  const set = new Set();
  Object.values(user.state.habits || {}).forEach(h => {
    Object.keys(h.history || {}).forEach(d => set.add(d));
  });
  return Array.from(set).sort();
}

// Build time series of cumulative BIC (consistency) score per day (chronological)
function buildConsistencySeries(user, mode = '30') {
  // collect all dates (if mode === '30' we will focus last 30 days)
  // we need dates in chronological order
  const days = {};
  Object.values(user.state.habits || {}).forEach(h => {
    Object.entries(h.history || {}).forEach(([date, entry]) => {
      days[date] = days[date] || { indulgences: 0 };
      days[date].indulgences += entry.indulgences || 0;
    });
  });

  const allDates = Object.keys(days).sort(); // chronological asc
  if (allDates.length === 0) return { dates: [], scores: [] };

  // If mode is '30', create a rolling window of last 30 calendar days up to today
  let targetDates = allDates;
  if (mode === '30') {
    const today = new Date();
    const cutoff = new Date(); cutoff.setDate(today.getDate() - 29); // include today
    targetDates = allDates.filter(d => new Date(d) >= cutoff);
    // Ensure we include days with 0 entries in the last 30 days (fill in missing dates)
    const filled = [];
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      filled.push(dt.toISOString().slice(0,10));
    }
    targetDates = filled;
  }

  const datesChron = targetDates.sort();
  const scores = [];
  // cumulative: for each date up to current, compute C & I up to that date and score
  for (let i = 0; i < datesChron.length; i++) {
    const subDates = datesChron.slice(0, i + 1);
    let C = 0, I = 0;
    subDates.forEach(d => {
      const totalInd = (days[d] && days[d].indulgences) ? days[d].indulgences : 0;
      if (totalInd === 0) C++; else I++;
    });
    const totalDays = C + I;
    const sc = totalDays === 0 ? 0 : (C - I * (1 - (C / totalDays)));
    scores.push(Number(sc.toFixed(4)));
  }
  return { dates: datesChron, scores };
}

let consistencyChartRef = null;
function renderConsistencyChart(mode = '30') {
  const user = getCurrentUser();
  if (!user || Object.keys(user.state.habits || {}).length === 0) {
    $('consistency-card').style.display = 'none';
    return;
  }
  const { dates, scores } = buildConsistencySeries(user, mode);
  const ctx = document.getElementById('consistency-chart').getContext('2d');
  if (consistencyChartRef) consistencyChartRef.destroy();
  consistencyChartRef = new Chart(ctx, {
    type: 'line',
    data: { labels: dates, datasets: [{ label: 'Consistency Score', data: scores, fill: false, tension: 0.2 }]},
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:false } } }
  });
  $('consistency-card').style.display = 'block';
}

// --- Rendering ---
function renderAll(){
  renderAuth();
  renderUsers();
  renderHabits();
  renderSummary();
  renderChart();
}

function renderUsers(){
  const ul = $('user-list'); ul.innerHTML='';
  Object.entries(app.users).forEach(([id,u]) => {
    const div = document.createElement('div'); div.className='row';
    const btn = document.createElement('button'); btn.textContent=u.displayName; btn.onclick=()=>{ app.currentUserId=id; saveLocal(app); renderAll(); };
    if(app.currentUserId === id) btn.style.outline='3px solid #e6eefc';
    div.appendChild(btn);
    const del = document.createElement('button'); del.textContent='X'; del.className='danger'; del.onclick=()=>{ if(confirm('Delete user?')){ delete app.users[id]; if(app.currentUserId===id) app.currentUserId=null; saveLocal(app); renderAll(); } };
    div.appendChild(del);
    ul.appendChild(div);
  });
  $('btn-add-local').onclick = ()=>{ const v = $('new-username').value.trim(); if(!v) return alert('enter name'); ensureLocalUser(v); $('new-username').value=''; renderAll(); }
}

function renderHabits(){
  const list = $('habit-list'); list.innerHTML='';
  const user = getCurrentUser();
  const nhBtn = $('btn-add-habit'); nhBtn.onclick = ()=>{ const name = $('new-habit').value.trim(); if(!name) return alert('enter habit name'); addHabit(name); $('new-habit').value=''; };
  if(!user){ list.innerHTML='<div class="small">No user selected</div>'; return; }
  const habits = Object.values(user.state.habits || {});
  if(habits.length===0) list.innerHTML='<div class="small">No habits yet</div>';
  habits.forEach(h => {
    const div = document.createElement('div'); div.className='habit-item';
    const left = document.createElement('div'); left.textContent=h.name; left.style.cursor='pointer'; left.onclick=()=>{ selectHabit(h.id); };
    div.appendChild(left);
    const controls = document.createElement('div');
    const open = document.createElement('button'); open.textContent='Open'; open.onclick=()=>selectHabit(h.id);
    const del = document.createElement('button'); del.textContent='Delete'; del.className='danger'; del.onclick=()=>{ if(confirm('Delete habit?')) deleteHabit(h.id); };
    controls.appendChild(open); controls.appendChild(del);
    div.appendChild(controls);
    list.appendChild(div);
  });
}

let selectedHabitId = null;
function selectHabit(hid){
  selectedHabitId = hid;
  const user = getCurrentUser(); if(!user) return;
  const h = user.state.habits[hid];
  $('current-habit-title').textContent = h.name;
  $('habit-controls').style.display = 'block';
  $('summary-card').style.display = 'block';
  $('chart-card').style.display = 'block';
  // set date default
  $('entry-date').value = todayKey();
  const todayEntry = h.history && h.history[todayKey()] ? h.history[todayKey()].indulgences : '-';
  $('today-summary').textContent = todayEntry;
  // wire buttons
  $('btn-save-entry').onclick = ()=>{ const dk = $('entry-date').value; const n = Number($('entry-indulgences').value||0); setEntry(hid, dk, n); $('entry-indulgences').value='0'; };
  $('btn-mark-clean').onclick = ()=>{ setEntry(hid, $('entry-date').value, 0); };
  $('btn-export-json').onclick = ()=>{ const data = JSON.stringify(h, null, 2); const blob = new Blob([data], { type:'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download = `${h.name.replace(/\s+/g,'_')}_habit.json`; a.click(); URL.revokeObjectURL(url); };
  $('btn-import-json').onclick = ()=>{ const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json'; inp.onchange = e => { const f = e.target.files[0]; const r = new FileReader(); r.onload = ev => { try{ const parsed = JSON.parse(ev.target.result); user.state.habits[hid] = parsed; saveLocal(app); renderAll(); }catch(err){ alert('Invalid JSON'); } }; r.readAsText(f); }; inp.click(); };
  renderSummary();
  renderChart();
}

function renderSummary(){
  const user = getCurrentUser(); if(!user) return;
  const agg = computeAggregatesForUser(user);
  $('total-days').textContent = agg.totalDays;
  $('clean-days').textContent = agg.C;
  $('indulge-days').textContent = agg.I;
  $('Consistency-score').textContent = agg.bic;
  $('summary-card').style.display = 'block';
}

function renderChart(){
  const user = getCurrentUser(); if(!user || !selectedHabitId) return;
  const h = user.state.habits[selectedHabitId];
  const labels=[]; const data=[];
  for(let i=29;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0,10);
    labels.push(k);
    const v = h.history && h.history[k] ? (h.history[k].indulgences>0 ? -h.history[k].indulgences : 1) : 0;
    data.push(v);
  }
  const ctx = document.getElementById('habit-chart').getContext('2d');
  if(chart) chart.destroy();
  chart = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Daily (clean=+1, indulgence=-n)', data }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } });
  $('chart-card').style.display='block';
}

// --- Sync to Firestore ---
async function syncIfRemote(){
  if(!firebaseEnabled || !auth || !auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const docRef = db.collection('users').doc(uid);
  const user = getCurrentUser();
  if(!user) return;
  try{
    await docRef.set({ userMeta:{ email: auth.currentUser.email, updatedAt: new Date().toISOString() }, appState: user.state }, { merge:true });
  }catch(e){ console.warn('sync failed', e) }
}

// --- Initialization ---
function init(){
  if(!app.users || Object.keys(app.users).length===0){
    const id = ensureLocalUser('you');
    app.currentUserId = id;
    saveLocal(app);
  }
  renderAll();
  // wire import drag-drop? skip for now
  // service worker registration
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').then(()=>console.log('sw registered')).catch(()=>{});
  }
}

init();
