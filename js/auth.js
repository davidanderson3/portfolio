// js/auth.js

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function initAuth({ loginBtn, logoutBtn, userEmail }, onLogin) {
  const safeSet = (el, key, value) => {
    if (el) el[key] = value;
  };

  loginBtn.onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await auth.signInWithPopup(provider, undefined, firebase.auth.browserPopupRedirectResolver);
      currentUser = result.user;
      safeSet(userEmail, 'textContent', currentUser.email);
      onLogin(currentUser);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  logoutBtn.onclick = async () => {
    await auth.signOut();
    currentUser = null;
    safeSet(userEmail, 'textContent', '');
    safeSet(loginBtn, 'style', 'display: inline-block');
    safeSet(logoutBtn, 'style', 'display: none');
    onLogin(null);
  };

  auth.onAuthStateChanged(user => {
    currentUser = user;
    safeSet(userEmail, 'textContent', user?.email || '');
    safeSet(loginBtn, 'style', user ? 'display: none' : 'display: inline-block');
    safeSet(logoutBtn, 'style', user ? 'display: inline-block' : 'display: none');
    onLogin(user);
  });
}
