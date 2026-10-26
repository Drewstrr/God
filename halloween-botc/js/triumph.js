// Finalul „Binele a învins”: răsare soarele peste castel. Cerul trece din noapte în zori, soarele urcă de după
// dealuri, iar razele se rotesc încet în două straturi (unul într-un sens, unul în celălalt), ca să lucească.
// Același cod rulează pe proiector (screen.html) și pe pagina de test (final-bine-test.html).

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

// Silueta castelului pe deal (Bran): turnuri, acoperișuri ascuțite, ferestre aprinse.
const CASTLE = `
<svg class="tr-castle" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <path d="M0 300 V210 C120 190 220 170 330 182 C430 192 520 150 610 140 C700 130 760 160 820 168 C900 178 980 150 1060 158 C1170 168 1260 200 1380 190 C1480 182 1550 196 1600 200 V300 Z" fill="#0d0708"/>
  <g fill="#120a0a">
    <rect x="640" y="70" width="60" height="80"/><path d="M632 70 L670 18 L708 70 Z"/>
    <rect x="700" y="96" width="120" height="60"/><path d="M694 96 L760 56 L826 96 Z"/>
    <rect x="820" y="60" width="44" height="96"/><path d="M814 60 L842 6 L870 60 Z"/>
    <rect x="864" y="104" width="70" height="52"/><path d="M858 104 L899 72 L940 104 Z"/>
    <rect x="600" y="118" width="40" height="38"/><path d="M596 118 L620 92 L644 118 Z"/>
  </g>
  <g fill="#ffcf6a" opacity="0.7">
    <rect x="662" y="98" width="8" height="14" rx="4"/><rect x="740" y="118" width="8" height="12" rx="4"/>
    <rect x="836" y="88" width="7" height="13" rx="3.5"/><rect x="896" y="122" width="7" height="11" rx="3.5"/>
  </g>
</svg>`;

export function triumph() {
  document.querySelector('.triumph-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'triumph-layer';
  let motes = '';
  for (let i = 0; i < 60; i++) {
    motes += `<i class="mote" style="left:${(Math.random() * 100).toFixed(1)}%;--sz:${(0.25 + Math.random() * 0.7).toFixed(2)}vw;--dur:${(9 + Math.random() * 10).toFixed(1)}s;--delay:${(2 + Math.random() * 8).toFixed(1)}s;--dx:${(Math.random() * 24 - 12).toFixed(1)}vw"></i>`;
  }
  layer.innerHTML = `
    <div class="tr-sky night"></div>
    <div class="tr-sky dawn"></div>
    <div class="tr-rise">
      <div class="tr-rays a"></div>
      <div class="tr-rays b"></div>
      <div class="tr-glow"></div>
      ${SUN}
    </div>
    <div class="tr-flare">
      <i style="--x:58%;--y:44%;--s:7vmin;--c:rgba(255,220,150,0.18)"></i>
      <i style="--x:66%;--y:56%;--s:3vmin;--c:rgba(180,220,255,0.16)"></i>
      <i style="--x:76%;--y:72%;--s:11vmin;--c:rgba(255,170,90,0.10)"></i>
      <i style="--x:83%;--y:84%;--s:4vmin;--c:rgba(160,255,200,0.12)"></i>
    </div>
    ${CASTLE}
    <div class="tr-motes">${motes}</div>`;
  document.body.prepend(layer);
  document.body.classList.add('triumph');
}

export function clearTriumph() {
  document.querySelector('.triumph-layer')?.remove();
  document.body.classList.remove('triumph');
}
