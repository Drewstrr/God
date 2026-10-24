// Legătura cu Firebase. Pagina de test scrie sub /test, cea finală sub /live.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, onValue, set, update, remove, push, get, onChildAdded, onChildChanged,
  onDisconnect, serverTimestamp, goOffline, goOnline,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

export const ENV = 'test';
// Crește la fiecare publicare: telefoanele cu cod vechi se reîncarcă singure.
export const APP_VERSION = 19;
export const ENGINE_EMAIL = 'motor@blackwood.ro';

// Paginile jucătorilor (telefon, iPad) au logarea lor, separată de cea a motorului:
// altfel, deschise în același browser cu proiectorul, ar deloga motorul.
const IS_PLAYER_PAGE = /\/(play|vote)(\.html)?$/.test(location.pathname);

const app = initializeApp({
  apiKey: 'AIzaSyDP6icbBsaOgp8kRcGwW-za3i2bWpyhTks',
  authDomain: 'halloween-blackwood.firebaseapp.com',
  databaseURL: 'https://halloween-blackwood-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'halloween-blackwood',
  storageBucket: 'halloween-blackwood.firebasestorage.app',
  messagingSenderId: '843787028205',
  appId: '1:843787028205:web:8214fee048a3fa1e7b6ee4',
}, IS_PLAYER_PAGE ? 'player' : '[DEFAULT]');

export const auth = getAuth(app);
export const db = getDatabase(app);

// Referință relativă la mediul curent: r('public/phase') -> /test/public/phase
export const r = (path = '') => ref(db, path ? `${ENV}/${path}` : ENV);

export {
  onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut,
  onValue, set, update, remove, push, get, onChildAdded, onChildChanged, onDisconnect, serverTimestamp,
};

// Ora serverului, ca toate ecranele să arate același cronometru.
let serverOffset = 0;
onValue(ref(db, '.info/serverTimeOffset'), (snap) => { serverOffset = snap.val() ?? 0; });
export const serverNow = () => Date.now() + serverOffset;

// Pe telefoane, după blocarea ecranului legătura poate rămâne moartă; o refacem când revii pe pagină.
export function reconnectOnWake() {
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (Date.now() - hiddenAt > 3000) { goOffline(db); goOnline(db); }
  });
  window.addEventListener('online', () => { goOffline(db); goOnline(db); });
}

// Anunță când conexiunea cu Firebase cade sau revine.
export const onConnection = (cb) => onValue(ref(db, '.info/connected'), (snap) => cb(Boolean(snap.val())));

export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => { stop(); resolve(user); });
  });
}

// Pentru paginile MacBook-ului (proiector, panou, urgență): logare cu contul motorului.
// Afișează un formular simplu dacă nu ești logat și întoarce userul când e gata.
export async function requireEngineLogin(mount) {
  const user = await currentUser();
  if (user && user.email === ENGINE_EMAIL) return user;
  if (user) await signOut(auth);
  return new Promise((resolve) => {
    mount.innerHTML = `
      <form class="card login-engine">
        <h2>🔑 Pornește motorul</h2>
        <p class="muted">Parola contului <b>${ENGINE_EMAIL}</b>. O introduci o singură dată pe MacBook.</p>
        <input type="password" name="pw" placeholder="Parola" autocomplete="current-password" required>
        <button class="btn">Intră</button>
        <p class="error" hidden></p>
      </form>`;
    const form = mount.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.error');
      err.hidden = true;
      try {
        const cred = await signInWithEmailAndPassword(auth, ENGINE_EMAIL, form.pw.value);
        mount.innerHTML = '';
        resolve(cred.user);
      } catch {
        err.textContent = 'Parolă greșită.';
        err.hidden = false;
      }
    });
  });
}
