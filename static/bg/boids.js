// bg/boids.js — Boids flocking background
//
// Standalone:  open bg/demo.html and select "Boids"
// Import:      import BoidsBG from './bg/boids.js';
//              new BoidsBG().mount(document.body);
//
// Options (all optional):
//   count      {number}   number of birds (default 40)
//   color      {number[]} [r, g, b] (default SG green)
//   opacity    {number}   0–1 (default 0.13)
//   speed      {number}   px/frame base speed (default 0.7)
//   size       {number}   chevron half-length px (default 4.5)
//   perception {number}   alignment/cohesion radius px (default 75)
//   separation {number}   repulsion radius px (default 24)

export default class BoidsBG {
  constructor(opts = {}) {
    this._o = {
      count:      80,
      color:      [154, 200, 138],
      opacity:    0.22,
      speed:      0.8,
      size:       9,
      perception: 120,
      separation: 28,
      ...opts,
    };
    this._birds   = [];
    this._canvas  = null;
    this._running = false;
    this._raf     = null;
    this.W = 0; this.H = 0;
  }

  // ── public ────────────────────────────────────────────────────────────────

  mount(container = document.body) {
    this._canvas = _mkCanvas();
    container.prepend(this._canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._spawnBirds();
    this._running = true;
    this._loop();
    return this;
  }

  destroy() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    this._canvas?.remove();
    this._canvas = null;
  }

  // ── private ───────────────────────────────────────────────────────────────

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.W = this._canvas.clientWidth  || window.innerWidth;
    this.H = this._canvas.clientHeight || window.innerHeight;
    this._canvas.width  = Math.round(this.W * dpr);
    this._canvas.height = Math.round(this.H * dpr);
    const ctx = this._canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    // re-scatter birds on resize so they don't pile up in corners
    if (this._birds.length) this._spawnBirds();
  }

  _spawnBirds() {
    const { count, speed } = this._o;
    // Shared heading so birds coalesce into a flock quickly
    const ang0 = Math.random() * Math.PI * 2;
    // Loose starting cluster (±20% of screen dimensions)
    const cx = this.W * (0.25 + Math.random() * 0.5);
    const cy = this.H * (0.25 + Math.random() * 0.5);
    this._birds = Array.from({ length: count }, () => {
      const ang = ang0 + (Math.random() - 0.5) * 1.2;
      const spd = speed * (0.6 + Math.random() * 0.8);
      return {
        x:  cx + (Math.random() - 0.5) * this.W * 0.4,
        y:  cy + (Math.random() - 0.5) * this.H * 0.4,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
      };
    });
  }

  _loop() {
    if (!this._running) return;
    this._update();
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _update() {
    const { speed, perception, separation } = this._o;
    const maxSpd = speed;
    const minSpd = speed * 0.35;
    const SEP_F = 0.06, ALI_F = 0.06, COH_F = 0.04;
    const sep2 = separation * separation;
    const per2 = perception * perception;

    for (const b of this._birds) {
      let sx = 0, sy = 0;   // separation force
      let ax = 0, ay = 0;   // alignment accumulator
      let cx = 0, cy = 0;   // cohesion accumulator
      let ns = 0, na = 0;

      for (const o of this._birds) {
        if (o === b) continue;
        const dx = o.x - b.x, dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < sep2) {
          const d = Math.sqrt(d2) || 0.001;
          sx -= dx / d; sy -= dy / d;
          ns++;
        }
        if (d2 < per2) {
          ax += o.vx; ay += o.vy;
          cx += o.x;  cy += o.y;
          na++;
        }
      }

      if (ns) { b.vx += (sx / ns) * SEP_F; b.vy += (sy / ns) * SEP_F; }
      if (na) {
        b.vx += (ax / na - b.vx) * ALI_F;
        b.vy += (ay / na - b.vy) * ALI_F;
        b.vx += (cx / na - b.x)  * COH_F;
        b.vy += (cy / na - b.y)  * COH_F;
      }

      // clamp speed
      const mag = Math.hypot(b.vx, b.vy) || 0.001;
      const spd = Math.max(minSpd, Math.min(maxSpd, mag));
      b.vx = (b.vx / mag) * spd;
      b.vy = (b.vy / mag) * spd;

      b.x += b.vx; b.y += b.vy;

      // wraparound
      const P = 14;
      if (b.x < -P)         b.x = this.W + P;
      else if (b.x > this.W + P) b.x = -P;
      if (b.y < -P)         b.y = this.H + P;
      else if (b.y > this.H + P) b.y = -P;
    }
  }

  _draw() {
    const { color, opacity, size } = this._o;
    const ctx = this._canvas.getContext('2d');
    const [r, g, b_] = color;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.strokeStyle = `rgba(${r},${g},${b_},${opacity})`;
    ctx.lineWidth = 1.8;
    ctx.lineCap  = 'round';

    for (const bird of this._birds) {
      const ang = Math.atan2(bird.vy, bird.vx);
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(ang);
      // two-line chevron pointing right
      ctx.beginPath();
      ctx.moveTo( size,  0);
      ctx.lineTo(-size * 0.55, -size * 0.52);
      ctx.moveTo( size,  0);
      ctx.lineTo(-size * 0.55,  size * 0.52);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── helper ──────────────────────────────────────────────────────────────────

function _mkCanvas() {
  const c = document.createElement('canvas');
  Object.assign(c.style, {
    position:      'fixed',
    inset:         '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none',
    zIndex:        '0',
  });
  return c;
}
