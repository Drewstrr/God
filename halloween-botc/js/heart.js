// Inima roșie care bate, pentru cele 15 secunde de suspans dinaintea eliminării.
export const heartSVG = `
  <svg class="heart" viewBox="0 0 120 110" aria-hidden="true">
    <defs>
      <radialGradient id="hg" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="#ff8a95"/>
        <stop offset="0.25" stop-color="#e3172f"/>
        <stop offset="0.65" stop-color="#a1000f"/>
        <stop offset="1" stop-color="#4a0006"/>
      </radialGradient>
      <filter id="hglow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path filter="url(#hglow)" fill="url(#hg)" d="M60 104 C 22 78, 4 56, 4 34 C 4 16, 18 4, 34 4 C 46 4, 55 11, 60 21 C 65 11, 74 4, 86 4 C 102 4, 116 16, 116 34 C 116 56, 98 78, 60 104 Z"/>
    <path fill="rgba(255,255,255,0.35)" d="M24 22 C 30 14, 42 13, 47 20 C 38 18, 30 22, 26 30 Z"/>
  </svg>`;

// O bătaie vizuală (lub-dub). Se sincronizează cu sunetul de pe proiector.
export function beat(el) {
  if (!el) return;
  el.classList.remove('beat');
  void el.getBoundingClientRect();
  el.classList.add('beat');
}
