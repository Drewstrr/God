// Finalul „Răul a învins”: răsare o lună sângerie de după castel. Cerul se înroșește încet, norii trec prin fața
// lunii, iar când râde Contele, ciorile pornesc din turn spre noi.
// Același cod rulează pe proiector (screen.html) și pe pagina de test (final-rau-test.html).

import { forest } from './forest.js';

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

// Pământul negru pe toată lățimea, cu pădurea pe margini, în fața castelului.
// Brazii sunt negri, iar marginile lor sunt atinse de lumina roșie a lunii, ca să se vadă fiecare brad.
const GROUND = `
<svg class="bm-ground" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <g fill="#000" stroke="rgba(190, 30, 25, 0.5)" stroke-width="0.8">${forest()}</g>
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
