// bg/flapping-birds.js — Birds crossing the screen with animated flapping wings
//
// Birds are rendered as minimalist wing arcs (no sprites needed).
// Varying sizes and speeds create a parallax depth illusion.
//
// Standalone:  open bg/demo.html and select "Flapping Birds"
// Import:      import FlappingBirdsBG from './bg/flapping-birds.js';
//              new FlappingBirdsBG().mount(document.body);
//
// Options (all optional):
//   color      {number[]} [r, g, b] (default SG green)
//   opacity    {number}   0–1 (default 0.14)
//   count      {number}   max simultaneous birds (default 8)
//   minSize    {number}   min wingspan radius px — far birds (default 4)
//   maxSize    {number}   max wingspan radius px — near birds (default 18)

export default class FlappingBirdsBG {
  constructor(opts = {}) {
    this._o = {
      color:   [154, 200, 138],
      opacity: 0.28,
      count:   10,
      minSize: 10,
      maxSize: 32,
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
    // seed initial birds scattered across the screen
    for (let i = 0; i < this._o.count; i++) {
      this._spawnBird(true);
    }
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
  }

  /**
   * Spawn a new bird.
   * @param {boolean} scattered — if true, start at a random x (seeding); otherwise start off-edge.
   */
  _spawnBird(scattered = false) {
    const { minSize, maxSize } = this._o;
    // Size drives everything: big = close = fast; small = far = slow
    const t    = Math.random();               // 0 = smallest/slowest, 1 = largest/fastest
    const size = minSize + t * (maxSize - minSize);
    // Speed proportional to size for parallax feel
    const speed = 0.5 + t * 2.0;
    const rtl   = Math.random() < 0.35;      // minority go right-to-left
    const dir   = rtl ? -1 : 1;

    // Slight vertical drift (like gliding or updraft wobble)
    const vy = (Math.random() - 0.5) * 0.12;

    // Wing beat frequency: smaller birds flap faster (higher Hz)
    // 1.5–3.5 Hz; phase increment per frame at 60fps
    const freqHz     = 1.5 + (1 - t) * 2.0;
    const phaseSpeed = (freqHz * Math.PI * 2) / 60;

    const x = scattered
      ? Math.random() * this.W
      : (dir > 0 ? -size * 3 : this.W + size * 3);

    // Vertical range: avoid very top/bottom edges
    const y = this.H * (0.06 + Math.random() * 0.82);

    this._birds.push({
      x, y, vx: speed * dir, vy,
      size, dir,
      phase:      Math.random() * Math.PI * 2,
      phaseSpeed,
      // slight sinusoidal drift in y over time
      driftAmp:   this.H * (0.003 + Math.random() * 0.007),
      driftFreq:  0.005 + Math.random() * 0.008,
      driftPhase: Math.random() * Math.PI * 2,
      done:       false,
    });
  }

  _loop() {
    if (!this._running) return;
    this._update();
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _update() {
    const margin = 30;
    for (const b of this._birds) {
      b.x += b.vx;
      // gentle vertical drift using independent sine
      b.y += b.vy + Math.sin(b.driftPhase) * b.driftAmp;
      b.driftPhase += b.driftFreq;
      b.phase      += b.phaseSpeed;
      // mark done when off-screen
      if ((b.dir > 0 && b.x > this.W + margin) ||
          (b.dir < 0 && b.x < -margin)) {
        b.done = true;
      }
    }

    // Remove finished birds and replenish
    const before = this._birds.length;
    this._birds = this._birds.filter(b => !b.done);
    const removed = before - this._birds.length;
    for (let i = 0; i < removed; i++) {
      // short pause before next bird: stagger arrivals
      const delay = 800 + Math.random() * 4000;
      setTimeout(() => { if (this._running) this._spawnBird(false); }, delay);
    }
  }

  _draw() {
    const { color, opacity } = this._o;
    const ctx = this._canvas.getContext('2d');
    const [r, g, b_] = color;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.lineCap = 'round';

    for (const bird of this._birds) {
      // Fade near edges
      const edgeFade = _edgeFade(bird.x, bird.y, this.W, this.H, bird.size * 4 + 20);
      if (edgeFade <= 0) continue;

      // Size-based opacity: bigger/closer birds are slightly more opaque
      const sizeT  = (bird.size - this._o.minSize) / (this._o.maxSize - this._o.minSize);
      const alpha  = opacity * (0.6 + 0.4 * sizeT) * edgeFade;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgb(${r},${g},${b_})`;
      ctx.lineWidth   = Math.max(1.5, bird.size * 0.18);

      ctx.translate(bird.x, bird.y);
      // flip horizontally if going right-to-left
      if (bird.dir < 0) ctx.scale(-1, 1);

      _drawFlyingBird(ctx, bird.size, bird.phase);

      ctx.restore();
    }
  }
}

// ── bird rendering ────────────────────────────────────────────────────────────

/**
 * Draw a single flying bird centred at (0,0), heading right.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size   wingspan radius
 * @param {number} phase  current wing beat phase (radians)
 */
function _drawFlyingBird(ctx, size, phase) {
  const wSpan  = size * 2.6;                        // total half-wingspan
  const wBend  = -size * 0.28;                       // fixed dihedral — gliding posture
  const bodyL  = size * 0.65;                       // body half-length

  // Wings: two quadratic bezier arcs from body centre
  ctx.beginPath();
  // Left wing (negative x in bird-space)
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-wSpan * 0.42, wBend, -wSpan, wBend * 0.3);
  // Right wing
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo( wSpan * 0.42, wBend,  wSpan, wBend * 0.3);
  ctx.stroke();

  // Body: short line from tail to head
  ctx.beginPath();
  ctx.moveTo(-bodyL, 0);
  ctx.lineTo( bodyL * 1.1, 0);
  ctx.stroke();

  // Tail: small V
  ctx.beginPath();
  ctx.moveTo(-bodyL, 0);
  ctx.lineTo(-bodyL - size * 0.45, -size * 0.22);
  ctx.moveTo(-bodyL, 0);
  ctx.lineTo(-bodyL - size * 0.45,  size * 0.22);
  ctx.stroke();
}

// ── helpers ──────────────────────────────────────────────────────────────────

function _edgeFade(x, y, W, H, margin) {
  const l = Math.min(1, x / margin);
  const r = Math.min(1, (W - x) / margin);
  const t = Math.min(1, y / margin);
  const b = Math.min(1, (H - y) / margin);
  return Math.max(0, Math.min(l, r, t, b));
}

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
