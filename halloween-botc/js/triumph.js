// Finalul „Binele a învins”, opusul nopții cu lună sângerie: castelul se ridică încet din spatele dealului,
// iar după ce s-a așezat răsare soarele de după el. Cerul trece din noapte în dimineață, razele se rotesc,
// porumbeii albi zboară spre lumină, iar praful auriu plutește în aer.
// Același cod rulează pe proiector (screen.html) și pe pagina de test (final-bine-test.html).

import { forest, seeded } from './forest.js';

const SUN = `
<svg class="sun-svg" viewBox="-200 -200 400 400" aria-hidden="true">
  <defs>
    <!-- discul: alb în centru, mai cald spre margine (ca la soarele adevărat, marginea e puțin mai întunecată) -->
    <radialGradient id="sun-core" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.6" stop-color="#fffdf2"/>
      <stop offset="0.86" stop-color="#fff0bf"/>
      <stop offset="1" stop-color="#ffd877"/>
    </radialGradient>
    <radialGradient id="sun-corona" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.3" stop-color="#fff2c2" stop-opacity="0.95"/>
      <stop offset="0.5" stop-color="#ffcf5e" stop-opacity="0.55"/>
      <stop offset="0.72" stop-color="#ff9d2e" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/>
    </radialGradient>
    <!-- coroana „fierbe” încet: zgomot animat care deformează marginea luminii -->
    <filter id="sun-boil" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="4" result="n">
        <animate attributeName="baseFrequency" dur="14s" values="0.018;0.026;0.018" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="16"/>
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>
  <circle r="190" fill="url(#sun-corona)" filter="url(#sun-boil)"/>
  <circle r="66" fill="url(#sun-core)"/>
</svg>`;

// Porumbelul alb în zbor, văzut de dedesubt: aripi rotunjite, coada rotundă. Jumătatea stângă, oglindită.
const DOVE_HALF = 'M60 12 C57.5 12 56 14 56 16.5 C56 18.5 56.5 20 57 21.5 C48 17 34 11 20 12 C12 12.5 6 15 3 19 C8 21 14 22 20 23 C12 25 7 28 5 31 C14 31 22 30 30 29 C38 31 47 33 55 33 C55 37 54 40 53 43 C50 46 49 50 51 53 C54 54.5 57 55 60 55 Z';
const DOVE = `<svg viewBox="0 0 120 60" aria-hidden="true"><g fill="#fffdf6"><path d="${DOVE_HALF}"/><path d="${DOVE_HALF}" transform="matrix(-1 0 0 1 120 0)"/></g></svg>`;

// Dealul luminat de soare pe toată lățimea, cu pădurea pe margini, în fața castelului.
// Aceeași pădure ca noaptea, dar în umbra caldă a dimineții, cu marginile aurite de lumină.
const GROUND = `
<svg class="tr-ground" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="tr-hill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8a7656"/>
      <stop offset="0.25" stop-color="#4a4258"/>
      <stop offset="1" stop-color="#26222f"/>
    </linearGradient>
    <linearGradient id="tr-tree" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b3752"/>
      <stop offset="1" stop-color="#25222f"/>
    </linearGradient>
  </defs>
  <g fill="url(#tr-tree)" stroke="rgba(255, 214, 140, 0.45)" stroke-width="0.8">${forest()}</g>
  <path d="M-200 300 V262 C0 250 160 246 320 254 C440 258 540 264 640 266 C760 268 840 268 960 266 C1060 264 1160 258 1280 252 C1420 246 1560 250 1800 262 V300 Z" fill="url(#tr-hill)"/>
</svg>`;

// Munții de departe, în ceața albăstruie a dimineții (soarele răsare din spatele lor).
// Creasta: vârfuri mari, pe care se adaugă tot mai multe zimțuri mici, ca la munții adevărați.
function ridge(seed, base, amp) {
  const r = seeded(seed);
  let pts = [];
  for (let x = -100; x <= 1700; x += 160 + r() * 120) pts.push([x, base - amp * (0.25 + 0.75 * r())]);
  for (let k = 0, spread = amp * 0.4; k < 6; k++, spread *= 0.5) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      next.push(pts[i], [(x1 + x2) / 2, (y1 + y2) / 2 + (r() - 0.55) * spread]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return `M-100 300 ${pts.map(([x, y]) => `L${x.toFixed(1)} ${Math.min(base + 20, y).toFixed(1)}`).join(' ')} L1700 300 Z`;
}
const HILLS = `
<svg class="tr-hills" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <path d="${ridge(5, 175, 130)}" fill="#8b9cc0" opacity="0.5"/>
  <path d="${ridge(12, 225, 70)}" fill="#66749a" opacity="0.65"/>
</svg>`;

const rnd = (a, b) => a + Math.random() * (b - a);

export function triumph() {
  document.querySelector('.triumph-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'triumph-layer';
  let stars = '';
  for (let i = 0; i < 70; i++) {
    stars += `<i style="left:${rnd(0, 100).toFixed(1)}%;top:${rnd(0, 55).toFixed(1)}%;--sz:${rnd(1, 2.4).toFixed(1)}px;--tw:${rnd(2, 6).toFixed(1)}s;--o:${rnd(0.3, 0.9).toFixed(2)}"></i>`;
  }
  // Porumbeii pornesc de jos, de lângă noi, și zboară spre soare, tot mai mici, până se pierd în lumină.
  let doves = '';
  for (let i = 0; i < 11; i++) {
    const x = rnd(5, 95);
    doves += `<i class="dove" style="left:${x.toFixed(1)}%;--tx:${((50 - x) * rnd(0.7, 0.95)).toFixed(1)}vw;--ty:${rnd(-92, -78).toFixed(1)}vh;--s0:${rnd(3, 5.5).toFixed(2)};--d:${rnd(4.5, 6.5).toFixed(1)}s;--delay:${(5.6 + rnd(0, 1.8)).toFixed(2)}s;--f:${rnd(0.16, 0.24).toFixed(2)}s"><b>${DOVE}</b></i>`;
  }
  let motes = '';
  for (let i = 0; i < 60; i++) {
    motes += `<i class="mote" style="left:${rnd(0, 100).toFixed(1)}%;--sz:${rnd(0.25, 0.95).toFixed(2)}vw;--dur:${rnd(9, 19).toFixed(1)}s;--delay:${rnd(5, 13).toFixed(1)}s;--dx:${rnd(-12, 12).toFixed(1)}vw"></i>`;
  }
  layer.innerHTML = `
    <div class="tr-sky night"></div>
    <div class="tr-stars">${stars}</div>
    <div class="tr-sky dawn"></div>
    <div class="tr-sky day"></div>
    <div class="tr-rise">
      <div class="tr-rays a"></div>
      <div class="tr-rays b"></div>
      <div class="tr-glow"></div>
      ${SUN}
    </div>
    ${HILLS}
    <div class="tr-clouds"><i class="c1"></i><i class="c2"></i><i class="c3"></i></div>
    <img class="tr-castle" src="${new URL('../img/castel-zi.webp', import.meta.url)}" alt="">
    ${GROUND}
    <div class="tr-flare">
      <i style="--x:58%;--y:48%;--s:7vmin;--c:rgba(255,220,150,0.18)"></i>
      <i style="--x:66%;--y:58%;--s:3vmin;--c:rgba(180,220,255,0.16)"></i>
      <i style="--x:76%;--y:72%;--s:11vmin;--c:rgba(255,170,90,0.10)"></i>
      <i style="--x:83%;--y:84%;--s:4vmin;--c:rgba(160,255,200,0.12)"></i>
    </div>
    <div class="tr-doves">${doves}</div>
    <div class="tr-motes">${motes}</div>`;
  document.body.prepend(layer);
  document.body.classList.add('triumph');
}

export function clearTriumph() {
  document.querySelector('.triumph-layer')?.remove();
  document.body.classList.remove('triumph');
}
