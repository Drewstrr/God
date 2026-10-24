// Sânge împroșcat pe ecran, desenat pe loc (fără imagini): pata lovește, stropii zboară, apoi se prelinge.
// Fiecare apel arată altfel; variantele schimbă forma: impact, tăietură, ploaie, mușcătură, cortină.

export const VARIANTS = {
  impact: 'Impact',
  slash: 'Tăietură',
  rain: 'Ploaie de picături',
  bite: 'Mușcătura',
  curtain: 'Cortina de sânge',
};

const rand = (a, b) => a + Math.random() * (b - a);
const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// O pată cu margine neregulată: puncte pe un cerc, cu raza „zgâriată”, unite prin curbe.
function makeBlob(x, y, r, { jag = 0.28, points = 18, stretch = 1, angle = 0 } = {}) {
  const radii = Array.from({ length: points }, () => 1 + rand(-jag, jag));
  return { x, y, r, radii, stretch, angle };
}
function drawBlob(ctx, b, k = 1, fresh = true) {
  const n = b.radii.length;
  const pts = b.radii.map((m, i) => {
    const a = (i / n) * Math.PI * 2;
    const px = Math.cos(a) * b.r * m * k * b.stretch;
    const py = Math.sin(a) * b.r * m * k;
    return [b.x + px * Math.cos(b.angle) - py * Math.sin(b.angle), b.y + px * Math.sin(b.angle) + py * Math.cos(b.angle)];
  });
  if (fresh) ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [x0, y0] = pts[i % n];
    const [x1, y1] = pts[(i + 1) % n];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(x0, y0, mx, my);
  }
  ctx.closePath();
}

// Culoarea sângelui: centru roșu-viu, margine închisă, cu un luciu umed.
// Sângele e plat pe ecran: o singură culoare, ușor mai închisă spre margini.
function bloodFill(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.6);
  g.addColorStop(0, '#8a0712');
  g.addColorStop(0.7, '#6a030c');
  g.addColorStop(1, '#4a0207');
  return g;
}

// Pata mare și bucățile lipite de ea, umplute deodată, ca o singură formă.
function paintBlobs(ctx, blobs, k, main) {
  if (k <= 0) return;
  ctx.beginPath();
  for (const b of blobs) drawBlob(ctx, b, k, false);
  ctx.fillStyle = bloodFill(ctx, main.x, main.y, main.r * k);
  ctx.fill('nonzero');
}

// Țepii unei pete: triunghiuri subțiri care ies din centru, cu o picătură la capăt.
function makeSpike(x, y, r, angle, len) {
  return { x, y, r, angle, len, w: rand(0.12, 0.3) * r, tip: rand(2, 6) };
}
function paintSpike(ctx, s, k) {
  if (k <= 0) return;
  const L = s.r * 0.7 + s.len * k;
  const ex = s.x + Math.cos(s.angle) * L, ey = s.y + Math.sin(s.angle) * L;
  const nx = -Math.sin(s.angle) * s.w, ny = Math.cos(s.angle) * s.w;
  ctx.beginPath();
  ctx.moveTo(s.x + nx, s.y + ny);
  ctx.quadraticCurveTo((s.x + ex) / 2 + nx * 0.3, (s.y + ey) / 2 + ny * 0.3, ex, ey);
  ctx.quadraticCurveTo((s.x + ex) / 2 - nx * 0.3, (s.y + ey) / 2 - ny * 0.3, s.x - nx, s.y - ny);
  ctx.closePath();
  ctx.fillStyle = '#5e020a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex, ey, s.tip * Math.min(1, k * 1.5), 0, Math.PI * 2);
  ctx.fill();
}

// Stropii: picături care zboară din centru și se lungesc pe direcția mișcării.
function makeDrop(x, y, angle, dist, size, delay = 0) {
  return { x, y, angle, dist, size, delay, stretch: rand(1, 2.2) };
}
function paintDrop(ctx, d, t) {
  const k = easeOut(clamp01((t - d.delay) / 0.32));
  if (k <= 0) return;
  const px = d.x + Math.cos(d.angle) * d.dist * k, py = d.y + Math.sin(d.angle) * d.dist * k;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(d.angle);
  ctx.fillStyle = '#640209';
  ctx.beginPath();
  ctx.ellipse(0, 0, d.size * (k < 1 ? 1.8 : d.stretch), d.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Prelingerile: dâre care curg încet în jos, mai subțiri spre capăt, cu o picătură umflată la vârf.
function makeDrip(x, y, w, len, start = 0.45) {
  return { x, y, w, len, start, speed: rand(0.6, 1.4), wobble: rand(-0.04, 0.04) };
}
function paintDrip(ctx, d, t) {
  const k = clamp01((t - d.start) / (3.2 / d.speed));
  if (k <= 0) return;
  const L = d.len * easeOut(k);
  const x2 = d.x + L * d.wobble * 6;
  ctx.fillStyle = '#5a0209';
  ctx.beginPath();
  ctx.moveTo(d.x - d.w / 2, d.y);
  ctx.quadraticCurveTo(d.x - d.w * 0.35, d.y + L * 0.6, x2 - d.w * 0.25, d.y + L);
  ctx.lineTo(x2 + d.w * 0.25, d.y + L);
  ctx.quadraticCurveTo(d.x + d.w * 0.35, d.y + L * 0.6, d.x + d.w / 2, d.y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x2, d.y + L, d.w * 0.42, d.w * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

// O pată completă: pata mare, țepii, stropii și prelingerile ei.
function splat(x, y, R, opts = {}) {
  const { spikes = 16, drops = 36, drips = 5, delay = 0, dir = null, spread = Math.PI * 2 } = opts;
  const angleFor = () => (dir === null ? rand(0, Math.PI * 2) : dir + rand(-spread / 2, spread / 2));
  return {
    delay,
    main: makeBlob(x, y, R, { jag: 0.32, points: 30 }),
    extra: Array.from({ length: 5 }, () => makeBlob(x + rand(-0.75, 0.75) * R, y + rand(-0.75, 0.75) * R, R * rand(0.25, 0.5), { jag: 0.35, points: 16 })),
    spikes: Array.from({ length: spikes }, () => makeSpike(x, y, R, angleFor(), R * rand(0.5, 1.8))),
    drops: Array.from({ length: drops }, () => makeDrop(x, y, angleFor(), R * rand(1.2, 4.2), rand(1.5, 6) * (R / 60), rand(0, 0.12))),
    drips: Array.from({ length: drips }, () => makeDrip(x + rand(-0.75, 0.75) * R, y + R * rand(0.3, 0.7), rand(5, 13) * (R / 70), R * rand(1.5, 5))),
  };
}
function paintSplat(ctx, s, t) {
  const tt = t - s.delay;
  if (tt <= 0) return;
  const k = easeOut(clamp01(tt / 0.18));
  for (const sp of s.spikes) paintSpike(ctx, sp, easeOut(clamp01(tt / 0.25)));
  for (const d of s.drips) paintDrip(ctx, d, tt);
  paintBlobs(ctx, [s.main, ...s.extra], k, s.main);
  for (const d of s.drops) paintDrop(ctx, d, tt);
}

// Compoziția fiecărei variante, pe ecranul de lățime W și înălțime H.
function compose(variant, W, H) {
  const U = Math.min(W, H);
  switch (variant) {
    case 'slash': {
      // o dâră pe diagonală, ca după o tăietură, cu stropi pe direcția loviturii
      const n = 9, out = [];
      const x0 = W * rand(0.05, 0.15), y0 = H * rand(0.06, 0.16), x1 = W * rand(0.85, 0.95), y1 = H * rand(0.3, 0.42);
      const dir = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const R = U * (0.05 + 0.05 * Math.sin(f * Math.PI)) * rand(0.7, 1.2);
        out.push(splat(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + Math.sin(f * 6) * U * 0.02, R,
          { spikes: 6, drops: 14, drips: i % 2 ? 2 : 1, delay: f * 0.25, dir, spread: 0.9 }));
      }
      return out;
    }
    case 'rain':
      // picături mari care cad una după alta în locuri diferite
      return Array.from({ length: 8 }, (_, i) => splat(W * rand(0.08, 0.92), H * rand(0.1, 0.75), U * rand(0.035, 0.085),
        { spikes: 9, drops: 16, drips: 2, delay: i * 0.18 + rand(0, 0.1) }));
    case 'bite': {
      // două urme de colți, apoi un jet împroșcat în jos și două dâre lungi
      const cx = W * (Math.random() < 0.5 ? rand(0.18, 0.3) : rand(0.7, 0.82)), cy = H * rand(0.14, 0.26), gap = U * 0.09;
      return [
        splat(cx - gap / 2, cy, U * 0.045, { spikes: 8, drops: 22, drips: 2, dir: Math.PI / 2, spread: 1.8 }),
        splat(cx + gap / 2, cy + U * 0.01, U * 0.045, { spikes: 8, drops: 22, drips: 2, delay: 0.08, dir: Math.PI / 2, spread: 1.8 }),
        splat(cx, cy + U * 0.12, U * 0.11, { spikes: 18, drops: 50, drips: 6, delay: 0.25, dir: Math.PI / 2, spread: 2.6 }),
      ];
    }
    case 'curtain':
      // o pată lungă care cade din marginea de sus, ca o cortină, cu multe prelingeri
      return Array.from({ length: 7 }, (_, i) => {
        const s = splat(W * ((i + 0.5) / 7) + rand(-0.04, 0.04) * W, -U * 0.02, U * rand(0.08, 0.13),
          { spikes: 7, drops: 10, drips: 4, delay: i * 0.05, dir: Math.PI / 2, spread: 2 });
        for (const d of s.drips) { d.len *= 2.2; d.start = rand(0.2, 0.7); }
        return s;
      });
    default:
      // impact: o pată mare în centru, cu țepi și stropi în toate direcțiile
      return [splat(W * (Math.random() < 0.5 ? rand(0.2, 0.32) : rand(0.68, 0.8)), H * rand(0.22, 0.34), U * 0.15, { spikes: 22, drops: 60, drips: 7 })];
  }
}

// Arată sângele peste tot ecranul. Întoarce o promisiune care se rezolvă când dispare.
export function splatter(variant = null, { hold = 6.5, fade = 1.4, zIndex = 70 } = {}) {
  const keys = Object.keys(VARIANTS);
  const v = variant && VARIANTS[variant] ? variant : keys[Math.floor(Math.random() * keys.length)];
  const canvas = document.createElement('canvas');
  canvas.className = 'splatter';
  canvas.style.cssText = `position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:${zIndex};transition:opacity ${fade}s ease`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = compose(v, innerWidth, innerHeight);
  const t0 = performance.now();
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      for (const p of parts) paintSplat(ctx, p, t);
      if (t < hold) requestAnimationFrame(frame);
      else {
        canvas.style.opacity = '0';
        setTimeout(() => { canvas.remove(); resolve(v); }, fade * 1000);
      }
    };
    requestAnimationFrame(frame);
  });
}
