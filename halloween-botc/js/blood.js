// Sânge care curge din partea de sus a ecranului, desenat pe canvas, în spatele textului.
// Fiecare dâră curge neregulat: se oprește, o ia din loc, accelerează și se subțiază ușor.
let canvas = null;
let ctx = null;
let drips = [];
let start = 0;
let running = false;
let last = 0;
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
  const w = (r < 0.25 ? rand(0.014, 0.022) : r < 0.8 ? rand(0.008, 0.014) : rand(0.005, 0.008)) * W;
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
  const n = Math.round(W / 70);
  drips = Array.from({ length: n }, (_, i) => newDrip(i, n));
  start = performance.now();
  last = 0;
  running = true;
  requestAnimationFrame(frame);
}

export function stopBlood() {
  running = false;
  canvas?.remove();
  canvas = null;
}

function frame(now) {
  if (!running) return;
  const t = (now - start) / 1000;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
  last = now;
  ctx.clearRect(0, 0, W, H);

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
      if (d.y - d.pts[d.pts.length - 1].y > 3) d.pts.push({ x, y: d.y });
      if (travelled >= d.len) d.done = true;
    }
    drawDrip(d, top);
  }

  // Banda se desenează peste începutul dârelor, ca îmbinarea să fie curată.
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
  ctx.strokeStyle = 'rgba(255, 120, 120, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, bandY(x, t) - 3);
  ctx.stroke();

  requestAnimationFrame(frame);
}

// O dâră e o coloană vâscoasă: lățită acolo unde se desprinde din bandă,
// aproape la fel de groasă pe toată lungimea și rotunjită la capăt (fără „cap” umflat).
function drawDrip(d, top) {
  const travelled = Math.max(1, d.y - top);
  const width = (y) => {
    const along = (y - top) / travelled;
    const fillet = 1 + 1.3 * Math.exp(-(y - top) / (d.w * 1.4));
    const wobble = 1 + 0.06 * Math.sin(y * 0.045 + d.wob) + 0.04 * Math.sin(y * 0.013 + d.wob * 3);
    return d.w * fillet * (1 - 0.18 * along) * wobble;
  };

  const left = [];
  const right = [];
  for (const p of d.pts) {
    const hw = width(p.y) / 2;
    left.push([p.x - hw, p.y]);
    right.push([p.x + hw, p.y]);
  }
  const end = d.pts[d.pts.length - 1];
  const rEnd = width(d.y) / 2;

  const g = ctx.createLinearGradient(end.x - d.w * 1.2, 0, end.x + d.w * 1.2, 0);
  g.addColorStop(0, '#2a0003');
  g.addColorStop(0.22, '#6e000b');
  g.addColorStop(0.42, '#9a0614');
  g.addColorStop(0.58, '#7c0010');
  g.addColorStop(0.85, '#45000a');
  g.addColorStop(1, '#220002');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(left[0][0], top - d.w * 2);
  left.forEach(([x, y]) => ctx.lineTo(x, y));
  // Capătul rotunjit: o jumătate de elipsă puțin alungită.
  ctx.ellipse(end.x, d.y, rEnd, rEnd * 1.25, 0, Math.PI, 0, true);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.lineTo(right[0][0], top - d.w * 2);
  ctx.closePath();
  ctx.fill();

  // Luciul umed: o dungă subțire pe partea luminată.
  const hl = ctx.createLinearGradient(0, top, 0, d.y + rEnd);
  hl.addColorStop(0, 'rgba(255, 140, 140, 0.05)');
  hl.addColorStop(0.5, 'rgba(255, 150, 150, 0.22)');
  hl.addColorStop(1, 'rgba(255, 190, 190, 0.32)');
  ctx.strokeStyle = hl;
  ctx.lineWidth = Math.max(0.8, d.w * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  d.pts.forEach((p, i) => {
    const x = p.x - width(p.y) * 0.22;
    if (i) ctx.lineTo(x, p.y); else ctx.moveTo(x, p.y + d.w);
  });
  ctx.stroke();

  // O reflexie mică pe capăt.
  ctx.fillStyle = 'rgba(255, 200, 200, 0.28)';
  ctx.beginPath();
  ctx.ellipse(end.x - rEnd * 0.35, d.y + rEnd * 0.2, rEnd * 0.18, rEnd * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();
}
