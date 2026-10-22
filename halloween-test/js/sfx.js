// Efecte sonore generate direct în browser (fără fișiere audio).
// Browserul pornește sunetul doar după un click pe pagină: unlock() se cheamă la primul click.
let ctx = null;
let master = null;
let muted = false;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

export const ready = () => Boolean(ctx && ctx.state === 'running');
export const setMuted = (m) => { muted = m; if (master) master.gain.value = m ? 0 : 0.9; };
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
