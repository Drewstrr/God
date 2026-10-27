// Legătura cu Firebase. Pagina de test scrie sub /test, cea finală sub /live.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, onValue, set, update, remove, push, get, onChildAdded, onChildChanged,
  onDisconnect, serverTimestamp, goOffline, goOnline,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

export const ENV = 'botc';
// Crește la fiecare publicare: telefoanele cu cod vechi se reîncarcă singure.
export const APP_VERSION = 56;
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

// ---------- versiuni noi ----------
// GitHub Pages ține fișierele în cache câteva minute, așa că un simplu refresh poate aduce codul vechi.
// Înainte de reîncărcare cerem din nou de la server toate fișierele jocului (cache: 'reload'),
// ca pagina să pornească sigur cu versiunea nouă.
const ASSETS = [
  'audio/crow.mp3',
  'audio/airblow.mp3',
  'index.html', 'screen.html', 'control.html', 'play.html', 'vote.html', 'admin.html', 'css/style.css',
  'js/fb.js', 'js/engine.js', 'js/game-host.js', 'js/pin-service.js', 'js/sfx.js', 'js/music.js',
  'js/candles.js', 'js/smoke.js', 'js/blood.js', 'js/heart.js', 'js/vendor/qrcode.js', 'audio/list.json',
];
export async function refreshAndReload() {
  const base = new URL('../', import.meta.url);
  const urls = [location.href, ...ASSETS.map((f) => new URL(f, base).href)];
  await Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).catch(() => {})));
  location.reload();
}

// Reîncărcare automată (telefoane, iPad): cel mult o dată pe minut pentru aceeași versiune, ca să nu intre în buclă.
export function reloadForVersion(version) {
  const key = `blackwood-reload-${version}`;
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {}
  refreshAndReload();
  return true;
}

// Verifică la fiecare minut dacă pe server e o versiune mai nouă decât cea încărcată.
export function watchForUpdates(onNew) {
  const check = async () => {
    try {
      const text = await (await fetch(new URL('./fb.js', import.meta.url), { cache: 'no-store' })).text();
      const v = Number(text.match(/APP_VERSION = (\d+)/)?.[1]);
      if (v > APP_VERSION) onNew(v);
    } catch {}
  };
  setTimeout(check, 5000);
  setInterval(check, 60000);
}

// Banda „Versiune nouă” pentru paginile MacBook-ului (proiector, panou, urgență): nu se reîncarcă singure
// în mijlocul jocului; apeși tu când vrei.
export function showUpdateBanner() {
  watchForUpdates(() => {
    if (document.getElementById('update-banner')) return;
    const b = document.createElement('button');
    b.id = 'update-banner';
    b.className = 'update-banner';
    b.textContent = '✨ Versiune nouă a jocului: apasă aici ca să o încarci';
    b.addEventListener('click', () => { b.textContent = 'Se încarcă…'; refreshAndReload(); });
    document.body.appendChild(b);
  });
}
