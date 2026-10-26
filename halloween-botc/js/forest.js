// Pădurea de brazi de pe marginile ecranului de final (aceeași la finalul Binelui și al Răului).
// Brazii seamănă cu cei din poza castelului: vârf subțire, crengi care atârnă, ace zimțate pe margine.

// Numere „la întâmplare”, dar aceleași de fiecare dată (pădurea arată la fel la fiecare final).
export function seeded(seed) {
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
export function forest() {
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

