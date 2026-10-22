// Partea de motor care verifică PIN-urile. Rulează doar pe MacBook, logat ca motor.
import { PLAYERS } from './engine.js';
import {
  r, get, set, update, remove, onChildAdded, onChildChanged, onDisconnect, serverTimestamp, onConnection, APP_VERSION,
} from './fb.js';

const MAX_FAILS = 5;
const LOCK_MS = 60_000;

export async function hashPin(player, pin) {
  const data = new TextEncoder().encode(`blackwood:${player}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Lista publică a jucătorilor (nume + dacă și-au ales PIN-ul).
export async function ensurePlayers() {
  const snap = await get(r('public/players'));
  const current = snap.val() ?? {};
  const patch = {};
  for (const p of PLAYERS) {
    patch[p.id] = { name: p.name, hasPin: Boolean(current[p.id]?.hasPin) };
  }
  await set(r('public/players'), patch);
}

// Semnal pentru telefoane că motorul e pornit; se reface singur după o pană de internet.
export function announceEngine(onChange = () => {}) {
  const engineRef = r('public/engine');
  return onConnection(async (connected) => {
    onChange(connected);
    if (!connected) return;
    await onDisconnect(engineRef).remove();
    await set(engineRef, { online: true, at: serverTimestamp() });
    await set(r('public/appVersion'), APP_VERSION);
  });
}

async function answer(uid, status, nonce) {
  await set(r(`pinStatus/${uid}`), { nonce: nonce ?? null, ...status, at: serverTimestamp() });
  await remove(r(`pinRequests/${uid}`));
}

async function handleRequest(uid, req) {
  const reply = (status) => answer(uid, status, req?.nonce);
  const player = req?.player;
  const pin = String(req?.pin ?? '');
  if (!PLAYERS.some((p) => p.id === player) || !/^\d{4}$/.test(pin)) {
    return reply({ ok: false, error: 'Cerere invalidă.' });
  }

  const failsRef = r(`secret/pinFails/${player}`);
  const fails = (await get(failsRef)).val() ?? { count: 0, until: 0 };
  if (fails.until > Date.now()) {
    return reply({ ok: false, error: 'Prea multe încercări. Mai așteaptă un minut.' });
  }

  const stored = (await get(r(`secret/pins/${player}`))).val();
  const hash = await hashPin(player, pin);

  if (req.mode === 'set') {
    if (stored) return reply({ ok: false, error: 'Jucătorul are deja un PIN. Introdu-l pe acela.', hasPin: true });
    await set(r(`secret/pins/${player}`), hash);
    await set(r(`public/players/${player}/hasPin`), true);
  } else {
    if (!stored) return reply({ ok: false, error: 'Încă nu ai ales un PIN.', hasPin: false });
    if (stored !== hash) {
      const count = fails.count + 1;
      await set(failsRef, count >= MAX_FAILS ? { count: 0, until: Date.now() + LOCK_MS } : { count, until: 0 });
      return reply({ ok: false, error: 'PIN greșit.' });
    }
  }

  await remove(failsRef);
  await set(r(`bindings/${player}/${uid}`), true);
  await update(r(`private/${player}`), { name: PLAYERS.find((p) => p.id === player).name });
  return reply({ ok: true, player });
}

// Ascultă cererile de logare de pe telefoane și le răspunde.
export function startPinService() {
  const handle = (snap) => handleRequest(snap.key, snap.val()).catch((e) => console.error('PIN', e));
  const stops = [onChildAdded(r('pinRequests'), handle), onChildChanged(r('pinRequests'), handle)];
  return () => stops.forEach((stop) => stop());
}

// Din panou: șterge PIN-ul unui jucător și îl deloghează de pe toate dispozitivele.
export async function resetPin(player) {
  const bound = (await get(r(`bindings/${player}`))).val() ?? {};
  const patch = {};
  for (const uid of Object.keys(bound)) patch[`pinStatus/${uid}`] = { ok: false, reset: true, at: serverTimestamp() };
  patch[`bindings/${player}`] = null;
  patch[`secret/pins/${player}`] = null;
  patch[`secret/pinFails/${player}`] = null;
  patch[`public/players/${player}/hasPin`] = false;
  await update(r(), patch);
}
