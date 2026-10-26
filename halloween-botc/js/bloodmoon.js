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

// Liliacul: siluetă simplă; aripile bat din .bat-wing (CSS).
const BAT = `<svg viewBox="0 0 100 44" aria-hidden="true"><path class="bat-wing" d="M50 16 C46 10 43 11 42 15 C35 8 22 4 6 8 C13 12 15 17 13 23 C19 20 25 21 29 26 C32 22 37 22 40 26 C43 23 46 24 50 30 C54 24 57 23 60 26 C63 22 68 22 71 26 C75 21 81 20 87 23 C85 17 87 12 94 8 C78 4 65 8 58 15 C57 11 54 10 50 16 Z M47 13 L46 8 L49 12 Z M53 13 L54 8 L51 12 Z" fill="#050102"/></svg>`;

// Un brad din trei etaje de crengi, cu vârful la (x, top) și baza la y.
function pine(x, top, y) {
  const h = y - top, w = h * 0.4;
  const tri = (a, b, k) => `M${x} ${(top + h * a).toFixed(1)} L${(x - w * k).toFixed(1)} ${(top + h * b).toFixed(1)} L${(x + w * k).toFixed(1)} ${(top + h * b).toFixed(1)} Z`;
  return `<path d="${tri(0, 0.42, 0.5)} ${tri(0.22, 0.72, 0.78)} ${tri(0.45, 1, 1)}"/>`;
}
const PINES = [[20, 40], [62, 6], [104, 52], [140, 24], [182, 60], [222, 38], [262, 74], [300, 70], [1300, 72], [1338, 46], [1378, 20], [1416, 56], [1456, 8], [1498, 44], [1540, 18], [1582, 50]]
  .map(([x, top]) => pine(x, top, 150)).join('');

// Pământul negru pe toată lățimea, cu brazi pe margini, în fața castelului.
const GROUND = `
<svg class="bm-ground" viewBox="0 0 1600 220" preserveAspectRatio="none" aria-hidden="true">
  <g fill="#020001">${PINES}</g>
  <path d="M0 220 V128 C140 108 260 100 380 116 C470 128 540 150 640 160 C760 170 840 170 960 160 C1060 150 1130 124 1230 114 C1350 102 1470 110 1600 124 V220 Z" fill="#020001"/>
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
  // Liliecii pornesc din turnul castelului și zboară spre noi, în toate părțile.
  let bats = '';
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    bats += `<i class="bat" style="--tx:${(side * rnd(45, 85)).toFixed(1)}vw;--ty:${rnd(-60, -10).toFixed(1)}vh;--s:${rnd(3, 7).toFixed(2)};--d:${rnd(2.4, 3.6).toFixed(1)}s;--delay:${(4.6 + rnd(0, 1.4)).toFixed(2)}s;--f:${rnd(0.13, 0.2).toFixed(2)}s">${BAT}</i>`;
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
    <img class="bm-castle" src="${new URL('../img/castel-noapte.webp', import.meta.url)}" alt="">
    ${GROUND}
    <div class="bm-fog"><i></i><i></i></div>
    <div class="bm-bats">${bats}</div>
    <div class="bm-embers">${embers}</div>
    <div class="bm-vignette"></div>`;
  document.body.prepend(layer);
  document.body.classList.add('bloodmoon');
}

export function clearBloodMoon() {
  document.querySelector('.bloodmoon-layer')?.remove();
  document.body.classList.remove('bloodmoon');
}
