// Sânge care curge din partea de sus a ecranului, desenat pe canvas, în spatele textului.
// Fiecare dâră curge neregulat: se oprește, o ia din loc, accelerează, se subțiază și lasă o urmă lucioasă.
let canvas = null;
let ctx = null;
let drips = [];
let start = 0;
let running = false;
let W = 0;
let H = 0;

const rand = (a, b) => a + Math.random() * (b - a);

// Marginea benzii: valuri neregulate și umflături acolo unde pornesc dârele.
function bandY(x, t) {
  const grow = Math.min(1, t / 1.6);
  let y = H * 0.04 + (Math.sin(x * 0.013) * 0.35 + Math.sin(x * 0.041 + 1.3) * 0.25 + Math.sin(x * 0.0071 + 4) * 0.4) * H * 0.014;
  for (const d of drips) {
    const k = (x - d.x) / (d.w * 2.2);
    if (Math.abs(k) < 3) y += Math.exp(-k * k) * d.w * 1.1 * Math.min(1, Math.max(0, t - d.born + 0.8));
  }
  return y * grow;
}

function newDrip(i, n) {
  const x = (i + rand(0.1, 0.9)) * (W / n);
  // Câteva dâre groase, multe medii, câteva subțiri.
  const r = Math.random();
  const w = (r < 0.2 ? rand(0.012, 0.02) : r < 0.75 ? rand(0.006, 0.012) : rand(0.0035, 0.006)) * W;
  return {
    x, w,
    y: 0,
    len: (Math.random() < 0.3 ? rand(0.05, 0.18) : rand(0.18, 0.8)) * H,
    born: rand(0.4, 7.5),
    speed: 0,
    target: rand(40, 140),
    next: 0,
    pts: [],
    wob: rand(0, 1000),
    done: false,
  };
}

export function startBlood() {
  stopBlood();
  canvas = document.createElement('canvas');
  canvas.className = 'blood-canvas';
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round(W / 58);
  drips = Array.from({ length: n }, (_, i) => newDrip(i, n));
  start = performance.now();
  running = true;
  requestAnimationFrame(frame);
}

export function stopBlood() {
  running = false;
  canvas?.remove();
  canvas = null;
}

let last = 0;
function frame(now) {
  if (!running) return;
  const t = (now - start) / 1000;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
  last = now;
  ctx.clearRect(0, 0, W, H);

  // Banda de sus, cu marginea neregulată.
  const grad = ctx.createLinearGradient(0, 0, 0, H * 0.06);
  grad.addColorStop(0, '#2a0004');
  grad.addColorStop(0.6, '#62000b');
  grad.addColorStop(1, '#8e0613');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, bandY(x, t));
  ctx.lineTo(W, 0);
  ctx.closePath();
  ctx.fill();
  // Luciul benzii.
  ctx.strokeStyle = 'rgba(255, 120, 120, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, bandY(x, t) - 3);
  ctx.stroke();

  for (const d of drips) {
    if (t < d.born) continue;
    const top = bandY(d.x, t);
    if (!d.pts.length) { d.y = top; d.pts.push({ x: d.x, y: top }); }

    // Mișcare neregulată: la intervale aleatorii își schimbă viteza sau se oprește.
    if (!d.done) {
      if (t > d.next) {
        const r = Math.random();
        d.target = r < 0.22 ? 0 : r < 0.55 ? rand(15, 50) : rand(60, 190);
        d.next = t + rand(0.25, 1.3);
      }
      const travelled = d.y - top;
      const mass = Math.max(0.25, 1 - travelled / (d.len * 1.15));
      d.speed += (d.target * mass - d.speed) * Math.min(1, dt * 4);
      d.y += d.speed * dt;
      const x = d.x + Math.sin(d.y * 0.02 + d.wob) * d.w * 0.18;
      const lastPt = d.pts[d.pts.length - 1];
      if (d.y - lastPt.y > 3) d.pts.push({ x, y: d.y });
      if (travelled >= d.len) d.done = true;
    }
    drawDrip(d, top);
  }

  requestAnimationFrame(frame);
}

function drawDrip(d, top) {
  const head = d.pts[d.pts.length - 1];
  const travelled = d.y - top;
  const taper = (y) => {
    const k = (y - top) / Math.max(1, travelled);
    return d.w * (0.95 - 0.45 * k) * (0.82 + 0.18 * Math.sin(y * 0.031 + d.wob) * Math.sin(y * 0.007 + d.wob * 2));
  };

  // Corpul dârei, ca un poligon cu lățime variabilă.
  const left = [];
  const right = [];
  for (const p of d.pts) {
    const hw = taper(p.y) / 2;
    left.push([p.x - hw, p.y]);
    right.push([p.x + hw, p.y]);
  }
  const g = ctx.createLinearGradient(d.x - d.w, 0, d.x + d.w, 0);
  g.addColorStop(0, '#3c0006');
  g.addColorStop(0.35, '#86000f');
  g.addColorStop(0.5, '#a5081a');
  g.addColorStop(0.7, '#6d000c');
  g.addColorStop(1, '#2e0004');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(d.x - d.w * 0.9, top - 2);
  left.forEach(([x, y]) => ctx.lineTo(x, y));
  right.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(d.x + d.w * 0.9, top - 2);
  ctx.closePath();
  ctx.fill();

  // Luciul umed de pe dâră.
  ctx.strokeStyle = 'rgba(255, 150, 150, 0.22)';
  ctx.lineWidth = Math.max(0.6, d.w * 0.12);
  ctx.beginPath();
  d.pts.forEach((p, i) => (i ? ctx.lineTo(p.x - d.w * 0.12, p.y) : ctx.moveTo(p.x - d.w * 0.12, p.y)));
  ctx.stroke();

  // Picătura grea din capăt, mai mare cât timp curge.
  const r = d.w * (d.done ? 0.6 : 0.78);
  const hg = ctx.createRadialGradient(head.x - r * 0.35, d.y - r * 0.2, r * 0.1, head.x, d.y + r * 0.3, r * 1.3);
  hg.addColorStop(0, '#d4283a');
  hg.addColorStop(0.45, '#8e0010');
  hg.addColorStop(1, '#3a0005');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(head.x, d.y + r * 0.25, r, r * 1.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 210, 210, 0.45)';
  ctx.beginPath();
  ctx.ellipse(head.x - r * 0.35, d.y - r * 0.05, r * 0.22, r * 0.32, -0.4, 0, Math.PI * 2);
  ctx.fill();
}
