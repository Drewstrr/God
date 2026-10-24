// Lumânări desenate vectorial (SVG): corp cilindric cu lumină care trece prin ceară,
// margine topită, scurgeri, fitil cu jar, suport de alamă și o flacără animată organic.
// Fiecare lumânare e diferită (înălțime, grosime, culoare, scurgeri, flacără), dar stabilă pentru același nume.

const WAX = [
  ['#efe3cf', '#fff9ee', '#a8936f'], // ivoriu
  ['#e3cf9f', '#f8ecc9', '#9b7f4a'], // ceară veche
  ['#8c0f1d', '#c4303c', '#3e040b'], // roșu
  ['#d9cfc0', '#f3ede4', '#958877'], // os
  ['#2b2526', '#4f4748', '#0b0909'], // negru
  ['#f1e2c2', '#fff6df', '#ad9265'], // smântână
  ['#5c0c17', '#8f1c2c', '#22030a'], // vișiniu
  ['#e8dcc4', '#fbf4e4', '#a3906d'], // lumânare de biserică
];

let uid = 0;

const hash = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function rng(seed) {
  let s = seed || 1;
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822507); s = Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
}

// Returnează HTML-ul unei lumânări. index alege culoarea, ca să existe mereu un amestec.
export function candleSVG(name, { cls = '', label = '', index = null, short = false } = {}) {
  const rand = rng(hash(name));
  const id = `c${uid++}`;
  const wax = WAX[index === null ? Math.floor(rand() * WAX.length) : (index * 5 + 3) % WAX.length];
  rand();
  let W = 26 + rand() * 16;              // grosimea corpului
  let H = 58 + rand() * 62;              // înălțimea corpului
  let flame = 0.85 + rand() * 0.35;      // mărimea flăcării
  let tilt = (rand() - 0.5) * 3;         // înclinare ușoară
  // În ceremonia morții: lumânare scurtă, dreaptă, ca flacăra să fie în centrul ecranului.
  if (short) { W = 34; H = 44; flame = 1.15; tilt = 0; }
  const top = 48;                        // unde începe corpul
  const x0 = 50 - W / 2;
  const x1 = 50 + W / 2;
  const base = top + H;
  const total = base + 16;

  // Marginea topită de sus, neregulată.
  const bumps = 7;
  let rim = `M ${x0} ${top + 3}`;
  for (let i = 1; i <= bumps; i++) {
    const x = x0 + (W * i) / bumps;
    const dip = top + 1 + rand() * 4.5;
    rim += ` Q ${x - W / bumps / 2} ${dip + (rand() - 0.5) * 3} ${x} ${top + 2 + rand() * 2.5}`;
  }
  const body = `${rim} L ${x1} ${base - 2} Q ${x1} ${base} ${x1 - 2} ${base} L ${x0 + 2} ${base} Q ${x0} ${base} ${x0} ${base - 2} Z`;

  // Scurgeri de ceară cu „picătura” îngroșată la capăt.
  const nDrips = 1 + Math.floor(rand() * 4);
  let drips = '';
  for (let i = 0; i < nDrips; i++) {
    const dx = x0 + 2 + rand() * (W - 4);
    const dw = 1.6 + rand() * 2.6;
    const dl = 6 + rand() * Math.min(H * 0.6, 40);
    const y0 = top + 2;
    drips += `<path d="M ${dx - dw / 2} ${y0} L ${dx - dw / 2.4} ${y0 + dl} Q ${dx - dw * 0.75} ${y0 + dl + dw * 1.4} ${dx} ${y0 + dl + dw * 1.5} Q ${dx + dw * 0.75} ${y0 + dl + dw * 1.4} ${dx + dw / 2.4} ${y0 + dl} L ${dx + dw / 2} ${y0} Z" fill="url(#${id}b)"/>`;
    drips += `<path d="M ${dx - dw * 0.15} ${y0 + 1} L ${dx - dw * 0.1} ${y0 + dl}" stroke="rgba(255,255,255,0.35)" stroke-width="${dw * 0.22}" stroke-linecap="round"/>`;
  }

  const flameH = 30 * flame;
  return `
  <div class="candle ${cls}" data-flame="${flame.toFixed(3)}" data-seed="${hash(name) % 1000}">
    <svg class="c-svg" viewBox="14 0 72 ${total.toFixed(1)}" style="width:calc(var(--s) * 10);transform:rotate(${tilt.toFixed(2)}deg)" aria-hidden="true">
      <defs>
        <linearGradient id="${id}b" gradientUnits="userSpaceOnUse" x1="${x0}" x2="${x1}" y1="0" y2="0">
          <stop offset="0" stop-color="${wax[2]}"/>
          <stop offset="0.14" stop-color="${wax[0]}"/>
          <stop offset="0.36" stop-color="${wax[1]}"/>
          <stop offset="0.52" stop-color="${wax[1]}"/>
          <stop offset="0.78" stop-color="${wax[0]}"/>
          <stop offset="1" stop-color="${wax[2]}"/>
        </linearGradient>
        <linearGradient id="${id}s" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity="0"/>
          <stop offset="0.6" stop-color="#000" stop-opacity="0.12"/>
          <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
        </linearGradient>
        <radialGradient id="${id}g" cx="50" cy="${top + 2}" r="${W * 0.95}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ffb357" stop-opacity="0.85"/>
          <stop offset="0.45" stop-color="#ff9a3c" stop-opacity="0.3"/>
          <stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}p" cx="50%" cy="40%" r="60%">
          <stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/>
          <stop offset="0.5" stop-color="${wax[1]}"/>
          <stop offset="1" stop-color="${wax[0]}"/>
        </radialGradient>
        <radialGradient id="${id}h" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#ffc56a" stop-opacity="0.55"/>
          <stop offset="0.35" stop-color="#ff9d3a" stop-opacity="0.18"/>
          <stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}f" cx="50%" cy="78%" r="70%" fx="50%" fy="85%">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.16" stop-color="#fff6d2"/>
          <stop offset="0.34" stop-color="#ffd567"/>
          <stop offset="0.58" stop-color="#ff9a24"/>
          <stop offset="0.8" stop-color="#e5520a" stop-opacity="0.75"/>
          <stop offset="1" stop-color="#b42400" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}c" cx="50%" cy="70%" r="60%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
          <stop offset="0.6" stop-color="#fff3c4" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}u" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#4f7bff" stop-opacity="0.95"/>
          <stop offset="0.7" stop-color="#2f56ff" stop-opacity="0.35"/>
          <stop offset="1" stop-color="#2f56ff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}d" cx="50%" cy="30%" r="65%">
          <stop offset="0" stop-color="#ffe3a0"/>
          <stop offset="0.35" stop-color="#c8932f"/>
          <stop offset="0.75" stop-color="#5d3f10"/>
          <stop offset="1" stop-color="#241605"/>
        </radialGradient>
        <filter id="${id}n" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${hash(name) % 97}"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>
        <filter id="${id}bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.7"/></filter>
        <filter id="${id}gl" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3.5"/></filter>
      </defs>

      <circle class="c-halo" cx="50" cy="${top - flameH * 0.45}" r="48" fill="url(#${id}h)"/>
      <ellipse cx="50" cy="${base + 9}" rx="${W * 0.9 + 12}" ry="5" fill="rgba(0,0,0,0.55)" filter="url(#${id}gl)"/>
      <ellipse cx="50" cy="${base + 5}" rx="${W / 2 + 13}" ry="5.2" fill="url(#${id}d)"/>
      <ellipse cx="50" cy="${base + 3.6}" rx="${W / 2 + 9}" ry="3" fill="rgba(255,230,170,0.25)"/>

      <path d="${body}" fill="url(#${id}b)"/>
      <path d="${body}" fill="url(#${id}s)"/>
      <path d="${body}" fill="#fff" filter="url(#${id}n)" opacity="0.13"/>
      <path class="c-glow" d="${body}" fill="url(#${id}g)"/>
      <rect x="${x0 + W * 0.26}" y="${top + 6}" width="${W * 0.07}" height="${H - 12}" rx="1" fill="rgba(255,255,255,0.28)"/>
      ${drips}
      <ellipse cx="50" cy="${top + 3.2}" rx="${W / 2 - 2.5}" ry="2.6" fill="url(#${id}p)"/>

      <path class="c-wick" d="M 50 ${top + 3} Q 49 ${top - 2} 50.6 ${top - 6}" stroke="#1d1410" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <circle class="c-ember" cx="50.6" cy="${top - 6}" r="1.1" fill="#ff7b2e"/>

      <g class="c-flame" transform="translate(50.5 ${top - 4})" data-h="${flameH.toFixed(2)}">
        <path class="c-outer" fill="url(#${id}f)" filter="url(#${id}bl)"/>
        <path class="c-core" fill="url(#${id}c)"/>
        <ellipse class="c-blue" cx="0" cy="-2" rx="${(3.4 * flame).toFixed(2)}" ry="${(2.6 * flame).toFixed(2)}" fill="url(#${id}u)"/>
      </g>
    </svg>
    ${label !== null ? `<div class="name">${label}</div>` : ''}
  </div>`;
}

// ---------- animația flăcărilor ----------

// Zgomot neted 1D (valori între 0 și 1).
function noise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

function flamePath(h, w, tip) {
  return `M 0 1 C ${-w} 0, ${-w * 0.95} ${-h * 0.42}, ${tip} ${-h} C ${w * 0.95} ${-h * 0.42}, ${w} 0, 0 1 Z`;
}

// Stări speciale pentru ceremonie: data-state = small | flare | dying | dead.
const TARGET = { small: 0.55, normal: 1, flare: 2.2 };

let running = false;
export function animateFlames() {
  if (running) return;
  running = true;
  const t0 = performance.now();
  const frame = (now) => {
    const t = (now - t0) / 1000;
    document.querySelectorAll('.candle').forEach((c) => {
      const g = c.querySelector('.c-flame');
      if (!g) return;
      const lit = !c.classList.contains('out') && !c.classList.contains('waiting');
      const state = c.dataset.state ?? 'normal';
      const seed = Number(c.dataset.seed) || 1;
      const gust = c.classList.contains('gust') ? 2.4 : 1;
      let scale = Number(c.dataset.scale ?? (state === 'small' ? 0.55 : 1));
      if (state === 'dying') scale = Math.max(0.15, scale * 0.985) * (0.6 + noise(t * 22 + seed) * 0.8);
      else if (state === 'dead' || !lit) scale = 0;
      else scale += ((state === 'normal' && document.body.classList.contains('triumph') ? 1.45 : TARGET[state] ?? 1) - scale) * 0.06;
      c.dataset.scale = scale.toFixed(3);

      const H = Number(g.dataset.h) * scale;
      const n1 = noise(t * 1.1 * gust + seed);
      const n2 = noise(t * 3.7 + seed * 1.7);
      const n3 = noise(t * 8.3 + seed * 2.3);
      const h = H * (0.9 + n2 * 0.16 + (n3 - 0.5) * 0.06);
      const w = H * 0.24 * (0.92 + n3 * 0.12);
      const tip = (n1 - 0.5) * H * 0.32 * gust;
      const visible = scale > 0.02;
      g.style.display = visible ? '' : 'none';
      if (visible) {
        g.querySelector('.c-outer').setAttribute('d', flamePath(h, w, tip));
        g.querySelector('.c-core').setAttribute('d', `M 0 0 C ${-w * 0.45} -1, ${-w * 0.42} ${-h * 0.3}, ${tip * 0.45} ${-h * 0.6} C ${w * 0.42} ${-h * 0.3}, ${w * 0.45} -1, 0 0 Z`);
      }
      const glow = visible ? Math.min(1.4, 0.7 + n2 * 0.3 + (scale - 1) * 0.35) : 0;
      const halo = c.querySelector('.c-halo');
      if (halo) { halo.style.opacity = glow.toFixed(3); halo.setAttribute('r', (48 * Math.max(0.6, Math.min(scale, 1.8))).toFixed(1)); }
      const bodyGlow = c.querySelector('.c-glow');
      if (bodyGlow) bodyGlow.style.opacity = (visible ? 0.75 + n2 * 0.25 : 0).toFixed(3);
      const ember = c.querySelector('.c-ember');
      // Jarul fitilului se stinge încet după ce moare flacăra (doar în ceremonie).
      if (ember) ember.style.opacity = visible ? '1' : state === 'dead' ? String(Math.max(0, Number(ember.style.opacity || 1) - 0.006)) : '0';
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
