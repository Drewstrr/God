// Fum de lumânare stinsă: un fir subțire care urcă, se răsucește și se risipește.
let canvas = null;
let ctx = null;
const parts = [];
let emitters = [];
let running = false;

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'smoke-canvas';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
}

// x, y în pixeli de ecran (vârful fitilului).
export function smokeAt(x, y, { seconds = 3, scale = 1 } = {}) {
  ensure();
  emitters.push({ x, y, until: performance.now() + seconds * 1000, start: performance.now(), scale, acc: 0 });
  if (!running) { running = true; requestAnimationFrame(loop); }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  emitters = emitters.filter((e) => now < e.until);
  for (const e of emitters) {
    const age = (now - e.start) / 1000;
    const rate = 70 * Math.max(0.15, 1 - age / 3.2);
    e.acc += rate * dt;
    while (e.acc >= 1) {
      e.acc -= 1;
      parts.push({
        x: e.x, y: e.y, age: 0,
        life: 2.6 + Math.random() * 1.8,
        vy: -(34 + Math.random() * 22) * e.scale,
        phase: age * 2.2 + Math.random() * 0.4,
        drift: (Math.random() - 0.5) * 4 * e.scale,
        r0: (1.2 + Math.random() * 0.8) * e.scale,
        s: e.scale,
      });
    }
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age > p.life) { parts.splice(i, 1); continue; }
    const k = p.age / p.life;
    p.y += p.vy * dt * (1 - k * 0.5);
    const swirl = Math.sin(p.age * 2.3 + p.phase) * (2 + p.age * 16) * p.s;
    const x = p.x + swirl + p.drift * p.age;
    const r = p.r0 + p.age * 9 * p.s;
    const a = 0.22 * (1 - k) ** 1.4 * Math.min(1, p.age * 6);
    const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, r);
    g.addColorStop(0, `rgba(205, 205, 215, ${a})`);
    g.addColorStop(1, 'rgba(205, 205, 215, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (parts.length || emitters.length) requestAnimationFrame(loop);
  else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
}
