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
