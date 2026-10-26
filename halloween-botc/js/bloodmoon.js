// Finalul „Răul a învins”: răsare o lună sângerie de după castel. Cerul se înroșește încet, norii trec prin fața
// lunii, iar când râde Contele, liliecii pornesc din turn spre noi.
// Același cod rulează pe proiector (screen.html) și pe pagina de test (final-rau-test.html).

const MOON = `
<svg class="moon-svg" viewBox="-100 -100 200 200" aria-hidden="true">
  <defs>
    <!-- luna eclipsată: roșu-cupru, puțin mai luminoasă pe o margine, întunecată spre cealaltă -->
    <radialGradient id="bm-base" cx="0.36" cy="0.66" r="0.78">
      <stop offset="0" stop-color="#ff8a55"/>
      <stop offset="0.35" stop-color="#d9431f"/>
      <stop offset="0.7" stop-color="#8f160a"/>
      <stop offset="1" stop-color="#3c0403"/>
    </radialGradient>
    <radialGradient id="bm-limb" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.62" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.9" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.7"/>
    </radialGradient>
    <clipPath id="bm-clip"><circle r="100"/></clipPath>
    <!-- textura: zgomot fin, ca praful și craterele mici de pe suprafață -->
    <filter id="bm-grain" x="-100" y="-100" width="200" height="200" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="5" seed="7"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.25"/>
    </filter>
    <filter id="bm-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="bm-softer" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
  </defs>
  <g clip-path="url(#bm-clip)">
    <circle r="100" fill="url(#bm-base)"/>
    <!-- mările lunii, ca pe fața adevărată: Imbrium, Serenitatis, Tranquillitatis, Crisium, Procellarum, Nubium… -->
    <g fill="#2a0202" opacity="0.5" filter="url(#bm-soft)">
      <ellipse cx="-30" cy="-36" rx="27" ry="22"/>
      <ellipse cx="10" cy="-32" rx="15" ry="14"/>
      <ellipse cx="22" cy="-6" rx="19" ry="15"/>
      <ellipse cx="60" cy="-18" rx="10" ry="9"/>
      <ellipse cx="-58" cy="2" rx="22" ry="40"/>
      <ellipse cx="46" cy="16" rx="10" ry="15"/>
      <ellipse cx="-14" cy="30" rx="16" ry="12"/>
      <ellipse cx="30" cy="27" rx="8" ry="8"/>
      <ellipse cx="-40" cy="-62" rx="24" ry="8"/>
    </g>
    <rect x="-100" y="-100" width="200" height="200" filter="url(#bm-grain)" opacity="0.32"/>
    <!-- craterul Tycho, cu razele lui palide -->
    <g filter="url(#bm-softer)" opacity="0.5">
      <circle cx="-10" cy="64" r="4" fill="#ffb08a"/>
      <path d="M-10 64 L-60 20 M-10 64 L30 10 M-10 64 L-20 -10 M-10 64 L40 90 M-10 64 L-70 90" stroke="#ff9a70" stroke-width="1.2" opacity="0.5"/>
    </g>
    <g fill="#ff9c74" opacity="0.28" filter="url(#bm-softer)">
      <circle cx="-62" cy="-8" r="2.6"/><circle cx="-38" cy="-14" r="2"/><circle cx="18" cy="-48" r="1.8"/><circle cx="54" cy="40" r="2.2"/>
    </g>
    <circle r="100" fill="url(#bm-limb)"/>
  </g>
</svg>`;

// Cioara în zbor, văzută de dedesubt: cap mic, aripi largi cu penele de la vârf desfăcute ca degetele, coada în evantai.
// Se desenează jumătatea stângă și se oglindește; aripile bat din CSS.
const CROW_HALF = 'M60 10 C57 10 55 12 55 15 C55 17 56 19 56 21 C48 18 36 13 22 13 C15 13 9 15 4 18 L1 21 L9 21.5 L3 25 L11 25 L6 29 L14 28 L10 33 L18 31 L15 36 L24 33 C34 35 46 35 54 33 C54 37 53 40 52 42 L49 52 C53 54 57 54.5 60 54.5 Z';
const CROW = `<svg viewBox="0 0 120 60" aria-hidden="true"><g fill="#000"><path d="${CROW_HALF}"/><path d="${CROW_HALF}" transform="matrix(-1 0 0 1 120 0)"/></g></svg>`;

// Numere „la întâmplare”, dar aceleași de fiecare dată (pădurea arată la fel la fiecare final).
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un brad ca cei din poza castelului: vârf subțire, crengi care atârnă, cu ace zimțate pe margine.
// x = trunchiul, base = unde intră în pământ, h = înălțimea, w = jumătate din lățimea de la bază.
function spruce(r, x, base, h, w) {
  const top = base - h;
  const side = (dir) => {
    const pts = [[x, top]];
    const n = Math.round(h / 9 + 6 + r() * 4);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const env = w * (0.08 + 0.92 * t ** 0.95);               // conul bradului
      const y0 = top + h * (0.04 + 0.86 * (i - 1) / n);
      const step = (h * 0.86) / n;
      const out = env * (0.7 + r() * 0.45);
      const inner = out * (0.25 + r() * 0.3);
      const droop = step * (0.7 + r() * 0.9);
      pts.push([x + dir * inner, y0]);
      // marginea de sus a crengii, cu câteva ace
      pts.push([x + dir * out * 0.55, y0 + droop * 0.35 - r() * step * 0.3]);
      pts.push([x + dir * out * (0.92 + r() * 0.1), y0 + droop * 0.85]);
      pts.push([x + dir * out, y0 + droop]);
      // dedesubtul crengii, zimțat (acele care atârnă)
      const k = 2 + Math.floor(r() * 3);
      for (let j = 1; j <= k; j++) {
        const f = j / (k + 1);
        const px = x + dir * out * (1 - f * 0.75);
        const py = y0 + droop * (1 - f * 0.3) + step * 0.15;
        pts.push([px + dir * r() * step * 0.25, py + r() * step * 0.35]);
        pts.push([px - dir * step * 0.12, py - step * 0.12]);
      }
    }
    pts.push([x + dir * w * 0.05, base]);
    return pts;
  };
  const left = side(-1), right = side(1).reverse();
  const lean = (r() - 0.5) * h * 0.03;  // unii brazi stau ușor strâmb
  const d = [...left, ...right].map(([px, py], k) => `${k ? 'L' : 'M'}${(px + lean * (base - py) / h).toFixed(1)} ${py.toFixed(1)}`).join('') + 'Z';
  return `<path d="${d}"/>`;
}

// Pădurea de pe margini: înălțimi și forme diferite, cei înalți mai în spate, cei mici în față.
function forest() {
  const r = seeded(31);
  const trees = [];
  for (const [from, to] of [[-20, 560], [1040, 1620]]) {
    for (let x = from; x < to; x += 16 + r() * 26) {
      const nearCastle = from < 0 ? x / 560 : 1 - (x - 1040) / 580;    // 0 la margine, 1 lângă castel
      const h = 40 + r() * 190 * (1 - nearCastle * 0.6) + (r() < 0.12 ? 70 : 0);
      trees.push({ x, h, w: h * (0.2 + r() * 0.14) });
    }
  }
  trees.sort((a, b) => b.h - a.h);
  return trees.map((t) => spruce(r, t.x, 292 - r() * 10, t.h, t.w)).join('');
}

// Pământul negru pe toată lățimea, cu pădurea pe margini, în fața castelului.
const GROUND = `
<svg class="bm-ground" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <g fill="#000">${forest()}</g>
  <path d="M-200 300 V262 C0 250 160 246 320 254 C440 258 540 264 640 266 C760 268 840 268 960 266 C1060 264 1160 258 1280 252 C1420 246 1560 250 1800 262 V300 Z" fill="#000"/>
</svg>`;

const rnd = (a, b) => a + Math.random() * (b - a);

export function bloodMoon() {
  document.querySelector('.bloodmoon-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'bloodmoon-layer';
  let stars = '';
  for (let i = 0; i < 90; i++) {
    stars += `<i style="left:${rnd(0, 100).toFixed(1)}%;top:${rnd(0, 60).toFixed(1)}%;--sz:${rnd(1, 2.6).toFixed(1)}px;--tw:${rnd(2, 6).toFixed(1)}s;--o:${rnd(0.3, 0.9).toFixed(2)}"></i>`;
  }
  // Ciorile pornesc din turnul castelului când râde Contele și zboară spre noi, în toate părțile.
  let crows = '';
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    crows += `<i class="crow" style="--tx:${(side * rnd(45, 85)).toFixed(1)}vw;--ty:${rnd(-60, -10).toFixed(1)}vh;--s:${rnd(3, 7).toFixed(2)};--d:${rnd(2.6, 3.8).toFixed(1)}s;--delay:${(4.6 + rnd(0, 1.4)).toFixed(2)}s;--f:${rnd(0.2, 0.3).toFixed(2)}s">${CROW}</i>`;
  }
  let embers = '';
  for (let i = 0; i < 40; i++) {
    embers += `<i class="ember" style="left:${rnd(0, 100).toFixed(1)}%;--sz:${rnd(0.15, 0.45).toFixed(2)}vw;--dur:${rnd(10, 18).toFixed(1)}s;--delay:${rnd(3, 12).toFixed(1)}s;--dx:${rnd(-14, 14).toFixed(1)}vw"></i>`;
  }
  layer.innerHTML = `
    <div class="bm-sky night"></div>
    <div class="bm-stars">${stars}</div>
    <div class="bm-sky blood"></div>
    <div class="bm-rise">
      <div class="bm-glow"></div>
      ${MOON}
    </div>
    <div class="bm-clouds"><i class="c1"></i><i class="c2"></i><i class="c3"></i></div>
    <div class="bm-fog"><i></i><i></i></div>
    <img class="bm-castle" src="${new URL('../img/castel-noapte.webp', import.meta.url)}" alt="">
    ${GROUND}
    <div class="bm-crows">${crows}</div>
    <div class="bm-embers">${embers}</div>
    <div class="bm-vignette"></div>`;
  document.body.prepend(layer);
  document.body.classList.add('bloodmoon');
}

export function clearBloodMoon() {
  document.querySelector('.bloodmoon-layer')?.remove();
  document.body.classList.remove('bloodmoon');
}
