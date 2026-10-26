// Efecte sonore generate direct în browser (fără fișiere audio).
// Browserul pornește sunetul doar după un click pe pagină: unlock() se cheamă la primul click.
let ctx = null;
let master = null;
let muted = false;
const MUSIC_LEVEL = 0.32;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9 * volume;
    master.connect(ctx.destination);
    ctx.onstatechange = () => stateListeners.forEach((cb) => cb(ready()));
  }
  // Safari poate lăsa sunetul „suspended” sau „interrupted” (după somn); îl repornim în ambele cazuri.
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  loadCrow();
  loadBuffer('airblow');
  ['bell', 'door', 'nightclock', 'stake', 'growl', 'birds'].forEach(loadBuffer);
  // Un sunet mut redat chiar în timpul click-ului: unele browsere pornesc audio doar așa.
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch {}
  return true;
}

const stateListeners = new Set();
// Anunță când sunetul pornește sau se oprește singur (ex. după ce MacBookul a dormit).
export const onSoundState = (cb) => { stateListeners.add(cb); };

export const ready = () => Boolean(ctx && ctx.state === 'running');
export const setMuted = (m) => { muted = m; applyVolume(); };
// Volumul din panoul de comandă: volume = tot sunetul, musicVolume = doar muzica (0–1).
let volume = 1;
let musicVolume = 1;
function applyVolume() {
  if (master) master.gain.value = muted ? 0 : 0.9 * volume;
  if (musicBus) musicBus.gain.value = MUSIC_LEVEL * musicVolume;
}
export const setVolume = (v) => { volume = Math.max(0, Math.min(1, v)); applyVolume(); };
export const setMusicVolume = (v) => { musicVolume = Math.max(0, Math.min(1, v)); applyVolume(); };
export const isMuted = () => muted;

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(t0, attack, peak, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(master);
  return g;
}

// Flacăra care se aprinde puternic: un „vuuuș” de zgomot filtrat care crește.
export function whoosh(delay = 0) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2200, t + 1.1);
  src.connect(f).connect(envGain(t, 0.9, 0.5, 0.8));
  src.start(t);
  src.stop(t + 2);
}

// Flacăra stinsă: un suflu scurt.
export function puff(delay = 0) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.6);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1800, t);
  f.frequency.exponentialRampToValueAtTime(200, t + 0.4);
  src.connect(f).connect(envGain(t, 0.02, 0.8, 0.45));
  src.start(t);
  src.stop(t + 0.6);
}

// Clopot funebru: parțiale neregulate care se sting lent.
export function bell(delay = 0, base = 110, length = 6, volume = 0.5) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  [[1, 1], [2.0, 0.6], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12], [0.5, 0.5]].forEach(([ratio, amp]) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = base * ratio;
    o.connect(envGain(t, 0.01, volume * amp, length / Math.sqrt(ratio)));
    o.start(t);
    o.stop(t + length + 0.5);
  });
}

// Un bubuit grav, pentru final.
export function boom(delay = 0) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 1.6);
  o.connect(envGain(t, 0.02, 0.9, 1.8));
  o.start(t);
  o.stop(t + 2);
}

// Un ton grav, întunecat, care ține câteva secunde (răul a învins).
export function drone(delay = 0, seconds = 9) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  f.connect(envGain(t, 2, 0.35, seconds));
  [55, 55 * 1.5, 55 * 2.02, 58].forEach((freq) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.connect(f);
    o.start(t);
    o.stop(t + seconds + 2.5);
  });
}

// Un „tic” scurt la fiecare vot dezvăluit.
export function tick(delay = 0) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = 880;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2000;
  o.connect(f).connect(envGain(t, 0.005, 0.15, 0.12));
  o.start(t);
  o.stop(t + 0.2);
}

// Moartea: aprindere puternică, stingere, clopot.
// ---------- sunete din fișiere (audio/<nume>.mp3, trecute în audio/list.json) ----------
const buffers = {};
async function loadBuffer(name) {
  if (name in buffers || !ctx) return;
  buffers[name] = null;
  try {
    if (await hasFile(name)) {
      const res = await fetch(new URL(`../audio/${name}.mp3`, import.meta.url));
      buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    }
  } catch { buffers[name] = null; }
}
export const preload = (...names) => names.forEach((n) => loadBuffer(n));
// Pornește fișierul exact peste `lead` secunde, după ceasul audio (foarte precis).
// Întoarce în câte milisecunde se aude de fapt (cu tot cu întârzierea boxelor), ca imaginea să se sincronizeze;
// null dacă fișierul nu e încărcat.
export function playFileAt(name, { lead = 0.08, volume = 1 } = {}) {
  const buf = buffers[name];
  if (!ready() || !buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(master);
  src.start(ctx.currentTime + lead);
  return (lead + (ctx.outputLatency || ctx.baseLatency || 0)) * 1000;
}

// Un clip din fișier, de la o anumită secundă, cu intrare lină; întoarce funcția care îl oprește lin (sau null).
export function playClip(name, { offset = 0, volume = 1, delay = 0, fadeIn = 0 } = {}) {
  const buf = buffers[name];
  if (!ready() || !buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const t = ctx.currentTime + delay;
  if (fadeIn) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(volume, t + fadeIn); } else g.gain.value = volume;
  src.connect(g).connect(master);
  src.start(t, Math.max(0, Math.min(offset, buf.duration - 0.05)));
  return (fade = 0.6) => {
    const n = ctx.currentTime;
    g.gain.cancelScheduledValues(n);
    g.gain.setValueAtTime(g.gain.value, n);
    g.gain.linearRampToValueAtTime(0, n + fade);
    try { src.stop(n + fade + 0.05); } catch {}
  };
}
export const clipLength = (name) => buffers[name]?.duration ?? 0;

// Se lasă noaptea: dangătul de seară (audio/bell.mp3). Fără fișier: clopotul generat.
export function nightFalls() {
  if (playClip('bell', { volume: 0.9 }) === null) sessionBell();
}

// Un suflu puternic, de voce feminină, care stinge lumânarea: aer printr-o gură mică (zgomot cu formanți înalți),
// cu un început ferm, un „fff” susținut și o coadă care se pierde.
export function blow(delay = 0) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const dur = 1.25;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.3);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.75, t + 0.09);
  out.gain.setValueAtTime(0.75, t + 0.25);
  out.gain.exponentialRampToValueAtTime(0.35, t + 0.75);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(master);
  // trei „formanți” ai respirației, mai sus decât la o voce bărbătească
  [[1900, 1.1, 0.9], [3200, 1.6, 0.7], [5200, 2.2, 0.45]].forEach(([f, q, g], i) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f * 0.9, t);
    bp.frequency.linearRampToValueAtTime(f * (i ? 1.05 : 1.12), t + 0.2);
    bp.frequency.linearRampToValueAtTime(f * 0.85, t + dur);
    const gain = ctx.createGain();
    gain.gain.value = g;
    src.connect(bp).connect(gain).connect(out);
  });
  // un pic de „vânt” jos, cât aerul lovește flacăra
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const lg = ctx.createGain();
  lg.gain.value = 0.35;
  src.connect(lp).connect(lg).connect(out);
  src.start(t);
  src.stop(t + dur + 0.3);
}

// Clopot de biserică gotic: parțialele unui clopot adevărat (hum, prime, terța mică, cvinta, nominala…),
// fiecare cu stingerea lui, puțin dezacordate în perechi, ca să „unduiască”; plus lovitura limbii.
export function churchBell(delay = 0, base = 196, volume = 0.5) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const partials = [
    [0.5, 0.55, 11], [1, 0.42, 8], [1.19, 0.32, 6], [1.5, 0.18, 4.5], [2, 0.28, 4],
    [2.51, 0.12, 2.8], [2.66, 0.1, 2.4], [3.01, 0.08, 2], [4.07, 0.05, 1.4], [5.4, 0.03, 0.9],
  ];
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(master);
  for (const [ratio, amp, decay] of partials) {
    for (const detune of [-1.5, 1.5]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * ratio;
      o.detune.value = detune * (ratio < 1 ? 1 : 2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp / 2, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }
  // lovitura metalică a limbii clopotului
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.08);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = base * 6;
  bp.Q.value = 3;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.25, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  src.connect(bp).connect(sg).connect(out);
  src.start(t);
}

export function death() {
  whoosh(0.9);
  puff(3.0);
  boom(3.05);
  bell(3.2, 98, 7, 0.55);
}

// Începutul ședinței: trei bătăi de clopot.
export function sessionBell() {
  bell(0, 196, 3.5, 0.35);
  bell(1.4, 196, 3.5, 0.35);
  bell(2.8, 147, 5, 0.45);
}

// ---------- efecte noi ----------

// Un vot „lovește”: tăietură scurtă + bătaie grea. delay = null pentru abținere (doar un foșnet).
export function voteHit(delay = 0.75) {
  if (!ready()) return;
  const t = ctx.currentTime + (delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.4);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(delay == null ? 900 : 5000, t - 0.25);
  f.frequency.exponentialRampToValueAtTime(delay == null ? 400 : 900, t);
  src.connect(f).connect(envGain(t - 0.25, 0.2, delay == null ? 0.15 : 0.35, 0.15));
  src.start(t - 0.25 > ctx.currentTime ? t - 0.25 : ctx.currentTime);
  src.stop(t + 0.3);
  if (delay == null) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.35);
  o.connect(envGain(t, 0.005, 0.9, 0.45));
  o.start(t);
  o.stop(t + 0.6);
}

// Verdictul votului: o lovitură gravă cu ecou de clopot.
export function verdict() {
  boom(0);
  bell(0.05, 82, 5, 0.4);
}

// O bătaie de inimă (lub-dub): o lovitură grea, joasă, cu un mic „clic” de valvă.
export function heartbeat(delay = 0, volume = 0.9) {
  if (!ready()) return;
  [[0, 1], [0.24, 0.7]].forEach(([dt, amp]) => {
    const t = ctx.currentTime + delay + dt;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    o.connect(envGain(t, 0.008, volume * amp, 0.28));
    o.start(t);
    o.stop(t + 0.4);
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    n.connect(f).connect(envGain(t, 0.004, volume * amp * 0.6, 0.09));
    n.start(t);
    n.stop(t + 0.12);
  });
}

// Lumânarea unui jucător nou care intră în conac.
export function chime(delay = 0) {
  if (!ready()) return;
  [659, 988, 1319].forEach((f, i) => {
    const t = ctx.currentTime + delay + i * 0.09;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(envGain(t, 0.005, 0.12, 1.4));
    o.start(t);
    o.stop(t + 1.6);
  });
}

// Ultimele secunde ale unui cronometru.
// Ticăitul unui ceas mecanic vechi: „tic” și „tac” alternativ (clicul ancorei, cu rezonanța cutiei de lemn).
// La zero bate un gong grav de pendulă.
let tock = false;
function escapementClick(t, freq, peak) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.04);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.05);
}
export function clockTick(final = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (final) { bell(0, 73.4, 6, 0.55); return; }
  tock = !tock;
  // două clicuri foarte apropiate: ancora lovește, apoi roata se așază
  escapementClick(t, tock ? 1700 : 2300, 0.9);
  escapementClick(t + 0.011, tock ? 1200 : 1600, 0.35);
  // rezonanța de lemn a carcasei
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = tock ? 540 : 680;
  o.connect(envGain(t, 0.001, 0.1, 0.07));
  o.start(t);
  o.stop(t + 0.2);
}

// Zorii: un acord luminos, dar trist.
export function dawn() {
  if (!ready()) return;
  [293.66, 349.23, 440, 587.33].forEach((f, i) => {
    const t = ctx.currentTime + i * 0.25;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(envGain(t, 0.4, 0.12, 3.5));
    o.start(t);
    o.stop(t + 4.5);
  });
}

// Un râs malefic sintetizat: silabe „ha” cu formanți, tot mai grave.
export function evilLaugh(delay = 0) {
  if (!ready()) return;
  const start = ctx.currentTime + delay;
  for (let i = 0; i < 9; i++) {
    const t = start + i * 0.21 + (i > 5 ? (i - 5) * 0.05 : 0);
    const pitch = 150 - i * 7;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch * 1.15, t);
    o.frequency.exponentialRampToValueAtTime(pitch, t + 0.14);
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(0.2);
    const mix = ctx.createGain();
    mix.gain.value = 1;
    const out = envGain(t, 0.02, 0.5, 0.16);
    [[750, 6], [1150, 8], [2600, 10]].forEach(([freq, q]) => {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      mix.connect(f).connect(out);
    });
    o.connect(mix);
    const ng = ctx.createGain();
    ng.gain.value = 0.25;
    n.connect(ng).connect(mix);
    o.start(t); o.stop(t + 0.22);
    n.start(t); n.stop(t + 0.2);
  }
}

// O cioară: 2–4 croncănituri aspre. distance: 0 = foarte aproape, 1 = departe. pan: -1 stânga … 1 dreapta.
// Ciorile: dacă există audio/crow.mp3 (trecut în audio/list.json ca "crow"), se folosește înregistrarea reală;
// altfel, croncănitul generat. Același fișier se aude aproape sau departe (mai încet, mai înfundat, în stânga/dreapta).
let crowBuffer = null;
let crowLoading = false;
async function loadCrow() {
  if (crowLoading || !ctx) return;
  crowLoading = true;
  try {
    if (await hasFile('crow')) {
      const res = await fetch(new URL('../audio/crow.mp3', import.meta.url));
      crowBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
    }
  } catch { crowBuffer = null; }
}
function crowFromFile(delay, distance, pan) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = crowBuffer;
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9000 - distance * 7000;
  const g = ctx.createGain();
  g.gain.value = 0.9 * (1 - distance * 0.75);
  let node = src.connect(lp).connect(g);
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(master);
  src.start(t);
}

export function crow(delay = 0, { distance = 0.3, pan = 0 } = {}) {
  if (!ready()) return;
  loadCrow();
  if (crowBuffer) return crowFromFile(delay, distance, pan);
  const out = ctx.createGain();
  out.gain.value = 0.55 * (1 - distance * 0.8);
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6000 - distance * 4800;
  // Ecoul de departe.
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.22 + distance * 0.15;
  const fb = ctx.createGain();
  fb.gain.value = 0.15 + distance * 0.3;
  out.connect(lp);
  lp.connect(echo).connect(fb).connect(echo);
  const dest = panner ?? master;
  if (panner) { panner.pan.value = pan; panner.connect(master); }
  lp.connect(dest);
  echo.connect(dest);

  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 6); }
  shaper.curve = curve;
  const formants = [[1050, 5, 1], [2100, 6, 0.6], [3300, 7, 0.25]].map(([f, q, g]) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * (0.95 + Math.random() * 0.1);
    bp.Q.value = q;
    const gg = ctx.createGain();
    gg.gain.value = g;
    shaper.connect(bp).connect(gg).connect(out);
    return bp;
  });
  void formants;

  const caws = 2 + Math.floor(Math.random() * 3);
  const base = 380 + Math.random() * 160;
  for (let i = 0; i < caws; i++) {
    const t = ctx.currentTime + delay + i * (0.38 + Math.random() * 0.12);
    const len = 0.26 + Math.random() * 0.14;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = base * (1 - i * 0.04);
    o.frequency.setValueAtTime(f0 * 1.12, t);
    o.frequency.linearRampToValueAtTime(f0, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + len);
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(0.5);
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.9, t + 0.025);
    env.gain.setValueAtTime(0.8, t + len * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(env);
    n.connect(ng).connect(env);
    env.connect(shaper);
    o.start(t); o.stop(t + len + 0.05);
    n.start(t); n.stop(t + len + 0.05);
  }
}

// Un stol de ciori, unele aproape, altele departe, timp de câteva secunde.
export function crows(delay = 0, seconds = 14) {
  loadCrow();
  // Cu înregistrarea reală (care are deja mai multe croncănituri): de 2–3 ori, una aproape, restul departe.
  if (crowBuffer) {
    const n = Math.max(2, Math.min(3, Math.round(seconds / 5)));
    for (let i = 0; i < n; i++) crow(delay + (i * seconds) / n + Math.random() * 1.5, { distance: i === 0 ? 0.15 : 0.55 + Math.random() * 0.35, pan: Math.random() * 1.6 - 0.8 });
    return;
  }
  for (let i = 0; i < 9; i++) {
    const far = Math.random() < 0.6;
    crow(delay + Math.random() * seconds, { distance: far ? 0.65 + Math.random() * 0.3 : Math.random() * 0.25, pan: Math.random() * 2 - 1 });
  }
}

// O lovitură cinematică: bubuit, apoi un acord grav, disonant, care crește.
export function doomHit(delay = 0) {
  if (!ready()) return;
  boom(delay);
  boom(delay + 0.05);
  const t = ctx.currentTime + delay;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(180, t);
  f.frequency.exponentialRampToValueAtTime(1400, t + 3);
  f.connect(envGain(t, 1.8, 0.45, 6));
  [36.7, 38.9, 55, 73.4, 77.8].forEach((freq) => {
    ['sawtooth', 'square'].forEach((type, k) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * (k ? 1.004 : 1);
      o.connect(f);
      o.start(t);
      o.stop(t + 8.5);
    });
  });
  bell(delay + 0.1, 55, 9, 0.5);
}

export function evilWins() {
  doomHit(0.2);
  drone(1.5, 14);
  crows(1.2, 16);
  evilLaugh(4.5);
}

export function goodWins() {
  if (!ready()) return;
  // Fanfară: arpegii majore urcătoare, apoi clopote luminoase.
  const chords = [[261.63, 329.63, 392], [293.66, 369.99, 440], [329.63, 415.3, 493.88], [392, 493.88, 587.33, 783.99]];
  chords.forEach((ch, i) => {
    ch.forEach((f, j) => {
      const t = ctx.currentTime + 0.2 + i * 0.55 + j * 0.06;
      ['triangle', 'sawtooth'].forEach((type, k) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * (k ? 1.003 : 1);
        const fl = ctx.createBiquadFilter();
        fl.type = 'lowpass';
        fl.frequency.value = 2600;
        o.connect(fl).connect(envGain(t, 0.03, k ? 0.05 : 0.14, i === 3 ? 4 : 1.1));
        o.start(t);
        o.stop(t + 5);
      });
    });
  });
  bell(2.0, 523, 5, 0.25);
  bell(2.3, 659, 5, 0.22);
  bell(2.6, 784, 6, 0.22);
}

// ---------- muzica de fundal, generată pe loc ----------
// Pentru o fază se poate pune și un fișier real: audio/<temă>.mp3 (ex. audio/night.mp3) are prioritate.

let musicBus = null;
let musicOn = true;
let current = null; // { theme, stop }
const fileCache = {};

export const musicTheme = () => current?.theme ?? null;

export const setMusic = (on) => {
  musicOn = on;
  if (!on) playMusic(null);
};

function bus() {
  if (!musicBus) {
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_LEVEL * musicVolume;
    musicBus.connect(master);
  }
  return musicBus;
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function note(out, t, freq, { type = 'sine', attack = 0.01, peak = 0.2, decay = 1, partials = [1], detune = 0, filter = null } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  let dest = g;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    g.connect(f);
    f.connect(out);
  } else g.connect(out);
  partials.forEach((p, i) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * p;
    o.detune.value = detune * (i % 2 ? 1 : -1);
    const pg = ctx.createGain();
    pg.gain.value = 1 / (i + 1);
    o.connect(pg).connect(dest);
    o.start(t);
    o.stop(t + attack + decay + 0.1);
  });
}

function windNode(out, level = 0.08) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(4);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.8;
  f.frequency.value = 500;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(f.frequency);
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(f).connect(g).connect(out);
  src.start();
  lfo.start();
  return () => { try { src.stop(); lfo.stop(); } catch {} };
}

function droneNode(out, freqs, level = 0.06, cutoff = 400) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = level;
  f.connect(g).connect(out);
  const oscs = freqs.map((fr) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = fr;
    o.connect(f);
    o.start();
    return o;
  });
  return () => oscs.forEach((o) => { try { o.stop(); } catch {} });
}

// Fiecare temă: secvențe programate cu puțin timp înainte (look-ahead).
const THEMES = {
  // Petrecere / așteptare: o cutie muzicală în la minor, vals lent.
  waltz(out) {
    const mel = [69, 72, 76, 74, 72, 71, 72, 69, 64, 68, 71, 69, 72, 76, 81, 79, 77, 76, 74, 72, 71, 68, 69, null];
    const bass = [45, 52, 52, 45, 52, 52, 40, 47, 47, 45, 52, 52, 41, 48, 48, 40, 47, 47, 45, 52, 52, 40, 45, 45];
    const beat = 0.5;
    return (t, i) => {
      const k = i % mel.length;
      if (mel[k]) note(out, t, midi(mel[k]), { peak: 0.16, decay: 1.6, partials: [1, 2.01, 3.98], attack: 0.005 });
      note(out, t, midi(bass[k]), { peak: k % 3 === 0 ? 0.1 : 0.05, decay: 0.9, partials: [1, 2] });
      return beat;
    };
  },
  // Introducerea: orgă, acorduri lente.
  organ(out) {
    const chords = [[57, 60, 64, 45], [53, 57, 60, 41], [50, 53, 57, 38], [52, 56, 59, 40]];
    return (t, i) => {
      chords[i % chords.length].forEach((n) => note(out, t, midi(n), { type: 'sine', attack: 0.6, peak: 0.07, decay: 3.6, partials: [1, 2, 3, 4, 6], detune: 4 }));
      return 4;
    };
  },
  // Noaptea: vânt, dronă joasă, note rare de pian și o inimă îndepărtată.
  night(out) {
    const stops = [windNode(out, 0.1), droneNode(out, [55, 55.4, 82.4], 0.05, 260)];
    const scale = [57, 60, 62, 63, 64, 67, 69, 72];
    const fn = (t, i) => {
      if (i % 2 === 0) note(out, t, midi(scale[Math.floor(Math.random() * scale.length)] - 12), { peak: 0.1, decay: 3.5, partials: [1, 2, 3.01], attack: 0.01, filter: 1400 });
      if (i % 4 === 1) heartbeatAt(out, t, 0.25);
      return 1.5 + Math.random();
    };
    fn.stop = () => stops.forEach((s) => s());
    return fn;
  },
  // Dimineața / eliminarea: acorduri triste, ca de coarde.
  somber(out) {
    const chords = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 55, 58, 62], [45, 52, 57, 61]];
    return (t, i) => {
      chords[i % chords.length].forEach((n) => note(out, t, midi(n), { type: 'sawtooth', attack: 1.2, peak: 0.035, decay: 3.8, partials: [1], detune: 6, filter: 900 }));
      return 4.5;
    };
  },
  // Doliul: coarde lente, triste, și câteva note rare de cutie muzicală.
  mourning(out) {
    const chords = [[50, 53, 57, 62], [46, 50, 53, 58], [48, 52, 55, 60], [45, 49, 52, 57]];
    const mel = [74, 72, 70, 69, 70, 69, 67, 65];
    return (t, i) => {
      chords[i % chords.length].forEach((n, k) => note(out, t, midi(n), { type: 'sawtooth', attack: 2, peak: k ? 0.022 : 0.03, decay: 5.5, partials: [1], detune: 8, filter: 700 }));
      note(out, t + 1.2, midi(mel[i % mel.length]), { type: 'sine', peak: 0.06, decay: 3.2, attack: 0.01, partials: [1, 3] });
      note(out, t + 3.4, midi(mel[(i + 3) % mel.length] - 12), { type: 'sine', peak: 0.035, decay: 2.5, attack: 0.01, partials: [1, 3] });
      return 5.6;
    };
  },
  // Discuția: un ceas care ticăie și o dronă discretă.
  ticking(out) {
    const stop = droneNode(out, [73.4, 110], 0.025, 300);
    const fn = (t, i) => {
      note(out, t, i % 2 ? 1800 : 2400, { type: 'triangle', peak: 0.05, decay: 0.05, attack: 0.002 });
      return 1;
    };
    fn.stop = stop;
    return fn;
  },
  // Votul: ostinato tensionat (la – si bemol), tremolo sus.
  tension(out) {
    const pattern = [45, 45, 46, 45, 45, 45, 46, 48];
    const fn = (t, i) => {
      note(out, t, midi(pattern[i % 8]), { type: 'sawtooth', peak: 0.09, decay: 0.22, attack: 0.005, filter: 700 });
      if (i % 8 === 0) note(out, t, midi(81), { type: 'sawtooth', peak: 0.02, decay: 2, attack: 0.5, filter: 3000, detune: 12 });
      if (i % 16 === 0) heartbeatAt(out, t, 0.4);
      return 0.27;
    };
    return fn;
  },
  // Cele 15 secunde: doar o inimă care bate tot mai repede.
  heartbeat(out) {
    let gap = 1.0;
    return (t) => {
      heartbeatAt(out, t, 0.9);
      gap = Math.max(0.42, gap * 0.94);
      return gap;
    };
  },
  // Binele a învins: progresie majoră luminoasă, clopoței.
  glory(out) {
    const chords = [[60, 64, 67, 48], [55, 59, 62, 43], [57, 60, 64, 45], [53, 57, 60, 41]];
    return (t, i) => {
      chords[i % 4].forEach((n) => note(out, t, midi(n), { type: 'triangle', attack: 0.3, peak: 0.06, decay: 2.2, partials: [1, 2] }));
      [0, 0.5, 1, 1.5].forEach((d, j) => note(out, t + d, midi(chords[i % 4][j % 3] + 24), { peak: 0.06, decay: 1.2, partials: [1, 2.76], attack: 0.003 }));
      return 2;
    };
  },
  // Răul a învins: cor întunecat, grav.
  doom(out) {
    const stop = droneNode(out, [41.2, 41.5, 61.7], 0.06, 300);
    const chords = [[45, 48, 52], [44, 48, 51], [41, 45, 48], [40, 44, 47]];
    const fn = (t, i) => {
      chords[i % 4].forEach((n) => note(out, t, midi(n + 12), { type: 'sawtooth', attack: 1.5, peak: 0.03, decay: 4, filter: 700, detune: 9 }));
      // Din când în când, ciori în depărtare.
      if (Math.random() < (crowBuffer ? 0.18 : 0.6)) crow(Math.max(0, t - ctx.currentTime) + Math.random() * 4, { distance: 0.6 + Math.random() * 0.35, pan: Math.random() * 2 - 1 });
      return 5;
    };
    fn.stop = stop;
    return fn;
  },
};

function heartbeatAt(out, t, volume) {
  [[0, 60], [0.22, 50]].forEach(([dt, f]) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.6, t + dt);
    o.frequency.exponentialRampToValueAtTime(f, t + dt + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.exponentialRampToValueAtTime(volume * (dt ? 0.7 : 1), t + dt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.25);
    o.connect(g).connect(out);
    o.start(t + dt);
    o.stop(t + dt + 0.35);
  });
}

// Lista fișierelor MP3 puse în audio/ (audio/list.json), ca să nu căutăm fișiere care nu există.
let fileList = null;
async function hasFile(theme) {
  if (theme in fileCache) return fileCache[theme];
  if (!fileList) {
    try { fileList = await (await fetch(new URL('../audio/list.json', import.meta.url), { cache: 'no-cache' })).json(); } catch { fileList = []; }
  }
  fileCache[theme] = Array.isArray(fileList) && fileList.includes(theme);
  return fileCache[theme];
}

// ---------- melodii de pe YouTube (playerul oficial, ascuns) ----------
const YT_VOLUME = 60;
let ytApi = null;
let ytPlayer = null;
let ytDuck = 1;
function loadYouTube() {
  ytApi ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { s.remove(); reject(new Error('YouTube indisponibil')); };
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('YouTube nu răspunde')), 20000);
  }).catch((e) => { ytApi = null; throw e; });  // la eșec, data viitoare încercăm din nou
  return ytApi;
}
function youtubePlayer(YT) {
  if (ytPlayer) return ytPlayer;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:0;bottom:0;width:200px;height:200px;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden';
  box.innerHTML = '<div id="yt-music"></div>';
  document.body.appendChild(box);
  ytPlayer = new Promise((resolve, reject) => {
    let ready = false;
    const p = new YT.Player('yt-music', {
      width: 200, height: 200,
      playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, autoplay: 1 },
      events: {
        onReady: () => { ready = true; resolve(p); },
        onError: (e) => { if (ready) p.failed?.(e.data); else reject(new Error(`YouTube eroare ${e.data}`)); },
        onStateChange: (e) => p.stateChanged?.(e.data),
      },
    });
    setTimeout(() => { if (!ready) reject(new Error('Playerul YouTube nu pornește')); }, 20000);
  }).catch((e) => { box.remove(); ytPlayer = null; throw e; });
  return ytPlayer;
}
const ytTarget = () => (muted ? 0 : Math.round(YT_VOLUME * ytDuck * volume * musicVolume));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Melodia de pe YouTube. Cât timp nu se aude (YouTube încă se încarcă, reclamă, internet căzut, browserul a blocat
// pornirea), cântă muzica generată a jocului; YouTube se reîncearcă singur și preia când merge.
async function playYouTube(mine, song, fallback) {
  let filler = null;
  const fill = (on) => {
    if (on && !filler && fallback && current === mine) filler = startSynth(fallback);
    if (!on && filler) { filler(); filler = null; }
  };
  let loop = null;
  mine.stop = () => { clearInterval(loop); fill(false); };

  let YT = null;
  let p = null;
  for (let attempt = 0; current === mine && !p; attempt++) {
    try {
      YT = await loadYouTube();
      p = await youtubePlayer(YT);
    } catch {
      fill(true);
      await sleep(attempt < 3 ? 8000 : 20000);
    }
  }
  if (current !== mine) return;

  let vol = 0;
  const load = () => {
    p.setVolume(0);
    p.loadVideoById({ videoId: song.id, startSeconds: song.start, ...(song.end ? { endSeconds: song.end } : {}), suggestedQuality: 'small' });
  };
  load();
  // Bucla: când ajunge la final, o ia din nou de la minutul ales.
  p.stateChanged = (state) => { if (current === mine && state === YT.PlayerState.ENDED) { p.seekTo(song.start, true); p.playVideo(); } };
  let failedAt = 0;
  p.failed = () => { failedAt = performance.now(); };

  // Reclamele: YouTube nu le anunță, dar se recunosc după faptul că melodia noastră nu înaintează
  // (sau timpul e înainte de minutul ales). Atunci punem YouTube pe mut și cântă muzica jocului.
  let lastT = -1;
  let movedAt = 0;
  let stalledSince = performance.now();
  let nudgedAt = 0;
  loop = setInterval(() => {
    if (current !== mine) return;
    const now = performance.now();
    const t = p.getCurrentTime?.() ?? 0;
    const state = p.getPlayerState?.();
    if (song.end && t >= song.end - 0.4) p.seekTo(song.start, true);
    if (t > lastT + 0.05 && lastT >= 0) movedAt = now;
    lastT = t;
    const inSong = t >= song.start - 1 && (!song.end || t <= song.end + 1);
    const playing = state === YT.PlayerState.PLAYING && inSong && now - movedAt < 900;
    if (playing) {
      stalledSince = now;
      fill(false);
      if (p.isMuted?.()) p.unMute();
      vol = vol < ytTarget() ? Math.min(ytTarget(), vol + 6) : ytTarget();  // intră încet, apoi urmează volumul cerut
    } else {
      vol = 0;  // reclamă sau încărcare: fără sunet de la YouTube
      if (!p.isMuted?.()) p.mute();
      if (now - stalledSince > 1500) fill(true);
      // Oprită de tot (pornire blocată, eroare, pauză): o împingem din nou la câteva secunde.
      if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING && now - stalledSince > 4000 && now - nudgedAt > 5000) {
        nudgedAt = now;
        if (failedAt && now - failedAt > 15000) { failedAt = 0; load(); } else p.playVideo();
      }
    }
    p.setVolume(vol);
  }, 250);
  mine.resume = () => { if (p.getPlayerState?.() !== YT.PlayerState.PLAYING) p.playVideo(); };
  mine.stop = () => {
    clearInterval(loop);
    fill(false);
    let v = p.getVolume?.() ?? 0;
    const fade = setInterval(() => {
      v = Math.max(0, v - 5);
      if (current?.youtube) { clearInterval(fade); return; }  // a pornit altă melodie YouTube, nu o oprim
      p.setVolume(v);
      if (!v) { clearInterval(fade); p.pauseVideo(); }
    }, 80);
  };
}
// Apelat la fiecare click pe proiector: dacă browserul a blocat pornirea melodiei, o pornim acum.
export const resumeMusic = () => current?.resume?.();

// options.youtube: { id, start, end } cântă de pe YouTube; options.fallback: tema generată dacă YouTube nu merge.
export async function playMusic(theme, options = {}) {
  if (current?.theme === theme) return;
  const old = current;
  current = theme ? { theme, stop: () => {}, youtube: Boolean(options.youtube) } : null;
  old?.stop();
  if (!theme || !musicOn || !ready()) { if (current) current = null; return; }
  const mine = current;

  if (options.youtube) return playYouTube(mine, options.youtube, options.fallback);

  if (await hasFile(theme)) {
    if (current !== mine) return;
    playFile(mine, theme);
    return;
  }
  if (options.fallback && !THEMES[theme]) theme = options.fallback;

  mine.stop = startSynth(theme);
}

// Melodie din fișier, trecută prin magistrala muzicii (volumul din panou, „duck” la ceremonii).
// Intră lin, iese lin, iar când revine continuă de unde a rămas (petrecerea nu o ia de la capăt).
const FILE_LEVEL = 1.6;
const fileTracks = {};
function playFile(mine, theme) {
  let t = fileTracks[theme];
  if (!t) {
    const audio = new Audio(new URL(`../audio/${theme}.mp3`, import.meta.url));
    audio.loop = true;
    audio.preload = 'auto';
    const out = ctx.createGain();
    out.gain.value = 0;
    ctx.createMediaElementSource(audio).connect(out).connect(bus());
    t = fileTracks[theme] = { audio, out, pauseTimer: null };
  }
  clearTimeout(t.pauseTimer);
  const g = t.out.gain, now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(FILE_LEVEL, now + 4);
  t.audio.play().catch(() => {});
  mine.resume = () => t.audio.play().catch(() => {});
  mine.stop = () => {
    const n = ctx.currentTime;
    g.cancelScheduledValues(n);
    g.setValueAtTime(g.value, n);
    g.linearRampToValueAtTime(0, n + 2);
    t.pauseTimer = setTimeout(() => t.audio.pause(), 2100);
  };
}

// Pornește o temă generată și întoarce funcția care o stinge.
function startSynth(theme) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2);
  out.connect(bus());
  const step = THEMES[theme](out);
  let next = ctx.currentTime + 0.1;
  let i = 0;
  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.6) {
      next += step(next, i++);
    }
  }, 150);
  return () => {
    clearInterval(timer);
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    setTimeout(() => { step.stop?.(); out.disconnect(); }, 1700);
  };
}

// Muzica scade cât timp rulează un efect important (ceremonia morții).
export function duckMusic(seconds = 8) {
  ytDuck = 0.2;
  setTimeout(() => { ytDuck = 1; }, seconds * 1000);
  if (!musicBus) return;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(0.06 * musicVolume, t + 0.6);
  musicBus.gain.setValueAtTime(0.06 * musicVolume, t + seconds);
  musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL * musicVolume, t + seconds + 2);
}
