// Sigiliul de ceară al Contelui (același ca în teaser), ca SVG. Fiecare apel are id-uri proprii,
// ca mai multe sigilii pe aceeași pagină să nu-și încurce filtrele.
let n = 0;
export function sealSVG() {
  const k = `s${n++}`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<defs>
<filter id="wax-edge-${k}" x="-20%" y="-20%" width="140%" height="140%">
<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="wax-gloss-${k}" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/>
<feSpecularLighting in="b" surfaceScale="6" specularConstant="0.9" specularExponent="28" lighting-color="#ffd0c8" result="s">
<fePointLight x="40" y="20" z="140"/>
</feSpecularLighting>
<feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
<feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3="0.32" k4="0"/>
</filter>
<filter id="pressed-${k}" x="-10%" y="-10%" width="120%" height="120%">
<feOffset dx="3" dy="4" in="SourceAlpha" result="o"/>
<feGaussianBlur in="o" stdDeviation="3" result="ob"/>
<feComposite in="SourceAlpha" in2="ob" operator="out" result="inner"/>
<feFlood flood-color="#1a0004" flood-opacity="0.85"/>
<feComposite in2="inner" operator="in" result="shadow"/>
<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shadow"/></feMerge>
</filter>
<filter id="emboss-${k}" x="-20%" y="-20%" width="140%" height="140%">
<feOffset dx="-1" dy="-1.2" in="SourceAlpha" result="hl"/>
<feFlood flood-color="#ff9c92" flood-opacity="0.55"/><feComposite in2="hl" operator="in" result="hlc"/>
<feOffset dx="1.4" dy="1.8" in="SourceAlpha" result="sh"/>
<feFlood flood-color="#160003" flood-opacity="0.9"/><feComposite in2="sh" operator="in" result="shc"/>
<feMerge><feMergeNode in="shc"/><feMergeNode in="hlc"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<radialGradient id="wax-${k}" cx="0.38" cy="0.34" r="0.75">
<stop offset="0" stop-color="#b81f30"/><stop offset="0.45" stop-color="#8a0f1e"/><stop offset="0.85" stop-color="#52050f"/><stop offset="1" stop-color="#2e0207"/>
</radialGradient>
<radialGradient id="well-${k}" cx="0.62" cy="0.66" r="0.8">
<stop offset="0" stop-color="#a31727"/><stop offset="0.7" stop-color="#7a0c1b"/><stop offset="1" stop-color="#4e0510"/>
</radialGradient>
<linearGradient id="rim-${k}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#e2505e"/><stop offset="0.5" stop-color="#8e1222"/><stop offset="1" stop-color="#3a0309"/>
</linearGradient>
<path id="ring-text-${k}" d="M100 100 m-47 0 a47 47 0 1 1 94 0 a47 47 0 1 1 -94 0"/>
</defs>
<g filter="url(#wax-gloss-${k})">
<g filter="url(#wax-edge-${k})" fill="url(#wax-${k})">
<circle cx="100" cy="100" r="84"/>
<circle cx="160" cy="146" r="17"/><circle cx="38" cy="58" r="13"/><circle cx="58" cy="168" r="11"/><circle cx="174" cy="82" r="9"/>
</g>
</g>
<circle cx="100" cy="100" r="64" fill="none" stroke="url(#rim-${k})" stroke-width="5" opacity="0.9"/>
<g filter="url(#pressed-${k})">
<circle cx="100" cy="100" r="61" fill="url(#well-${k})"/>
</g>
<g filter="url(#emboss-${k})" fill="#8f1424">
<circle cx="100" cy="100" r="56" fill="none" stroke="#8f1424" stroke-width="1.6"/>
<circle cx="100" cy="100" r="38" fill="none" stroke="#8f1424" stroke-width="1.2"/>
<text font-family="'EB Garamond', Georgia, serif" font-size="8.6" font-weight="700" letter-spacing="1.2">
<textPath href="#ring-text-${k}" startOffset="0" textLength="288" lengthAdjust="spacing">BALUL CONTELUI ✠ CASTELUL BRAN ✠ MMXXVI ✠</textPath>
</text>
<text x="100" y="121" text-anchor="middle" font-family="'Blackwood Gothic', Georgia, serif" font-weight="800" font-size="62">C</text>
<path d="M100 66 l2.4 4.2 h-4.8z M88 72 l1.2 2.4 l-2.6 .4z M112 72 l-1.2 2.4 l2.6 .4z"/>
<path d="M80 130 q20 8 40 0" fill="none" stroke="#8f1424" stroke-width="1.2"/>
<circle cx="100" cy="133.5" r="1.6"/>
</g>
<ellipse cx="70" cy="56" rx="20" ry="8" transform="rotate(-32 70 56)" fill="#fff" opacity="0.10"/>
</svg>`;
}
