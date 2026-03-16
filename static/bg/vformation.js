// bg/vformation.js — Periodic V-formation flyovers
//
// Standalone:  open bg/demo.html and select "V-Formation"
// Import:      import VFormationBG from './bg/vformation.js';
//              new VFormationBG().mount(document.body);
//
// Options (all optional):
//   color      {number[]} [r, g, b] (default SG green)
//   opacity    {number}   0–1 (default 0.12)
//   minBirds   {number}   birds per formation (default 9)
//   maxBirds   {number}   birds per formation (default 17)
//   minDelay   {number}   ms between formations (default 20000)
//   maxDelay   {number}   ms between formations (default 55000)
//   speed      {number}   px/frame (default 0.9)
//   birdSize   {number}   wingspan radius px (default 8)

export default class VFormationBG {
  constructor(opts = {}) {
    this._o = {
      color:    [154, 200, 138],
      opacity:  0.28,
      minBirds: 9,
      maxBirds: 17,
      minDelay: 6000,
      maxDelay: 20000,
      speed:    1.4,
      birdSize: 18,
      ...opts,
    };
    this._formations = [];   // active formations crossing the screen
    this._canvas     = null;
    this._running    = false;
    this._raf        = null;
    this._spawnTimer = null;
    this.W = 0; this.H = 0;
  }

  // ── public ────────────────────────────────────────────────────────────────

  mount(container = document.body) {
    this._canvas = _mkCanvas();
    container.prepend(this._canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._running = true;
    this._scheduleNext(3000 + Math.random() * 5000); // first formation soon
    this._loop();
    return this;
  }

  destroy() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    clearTimeout(this._spawnTimer);
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

  _scheduleNext(delay) {
    if (!this._running) return;
    this._spawnTimer = setTimeout(() => {
      if (this._running) {
        this._spawnFormation();
        const next = this._o.minDelay + Math.random() * (this._o.maxDelay - this._o.minDelay);
        this._scheduleNext(next);
      }
    }, delay);
  }

  _spawnFormation() {
    const { minBirds, maxBirds, speed, birdSize } = this._o;

    // randomise direction: mostly left-to-right with a small downward drift
    // occasionally reverse (right-to-left)
    const rtl  = Math.random() < 0.3;           // right-to-left
    const dirX = rtl ? -1 : 1;
    const dirY = (Math.random() - 0.3) * 0.25;  // slight diagonal
    const heading = Math.atan2(dirY, dirX);

    const count   = this._o.minBirds + Math.floor(Math.random() * (maxBirds - minBirds + 1));
    const spacing = birdSize * 3.5;             // distance between birds in V
    const startX  = rtl ? this.W + 60 : -60;
    const startY  = this.H * (0.1 + Math.random() * 0.55); // top 65% of screen

    // Build V-formation offsets relative to leader (index 0)
    // Birds alternate left/right arms of the V trailing behind the leader
    const offsets = [{ dx: 0, dy: 0 }]; // leader
    for (let i = 1; i <= Math.floor((count - 1) / 2); i++) {
      const trail = i * spacing;             // how far back
      const spread = i * spacing * 0.65;    // how far out to each side
      offsets.push({ dx: -trail, dy: -spread }); // left arm
      offsets.push({ dx: -trail, dy:  spread }); // right arm
    }
    // trim to exact count
    const slots = offsets.slice(0, count);

    // Rotate offsets to match heading
    const cos = Math.cos(heading), sin = Math.sin(heading);
    const birds = slots.map((slot, i) => {
      const rx = slot.dx * cos - slot.dy * sin;
      const ry = slot.dx * sin + slot.dy * cos;
      return {
        ox: rx, oy: ry,      // formation offset (constant)
        phase: Math.random() * Math.PI * 2, // wing beat phase offset
        phaseSpd: (2.0 + Math.random() * 1.5) * (Math.PI * 2) / 60, // ~2-3.5 Hz at 60fps
        isLeader: i === 0,
      };
    });

    const spd = speed * (0.85 + Math.random() * 0.3);

    this._formations.push({
      x: startX, y: startY,
      vx: Math.cos(heading) * spd,
      vy: Math.sin(heading) * spd,
      heading,
      birds,
      done: false,
    });
  }

  _loop() {
    if (!this._running) return;
    this._update();
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _update() {
    const margin = 300;
    for (const f of this._formations) {
      f.x += f.vx; f.y += f.vy;
      for (const b of f.birds) b.phase += b.phaseSpd;
      // mark done when leader is well off-screen
      if (f.x < -margin || f.x > this.W + margin ||
          f.y < -margin || f.y > this.H + margin) {
        f.done = true;
      }
    }
    // prune finished formations
    this._formations = this._formations.filter(f => !f.done);
  }

  _draw() {
    const { color, opacity, birdSize } = this._o;
    const ctx = this._canvas.getContext('2d');
    const [r, g, b_] = color;
    ctx.clearRect(0, 0, this.W, this.H);

    for (const f of this._formations) {
      for (const bird of f.birds) {
        const bx = f.x + bird.ox;
        const by = f.y + bird.oy;

        // fade birds slightly near screen edges for softer entry/exit
        const edgeFade = _edgeFade(bx, by, this.W, this.H, 80);
        if (edgeFade <= 0) continue;

        ctx.save();
        ctx.globalAlpha = opacity * edgeFade;
        ctx.strokeStyle = `rgb(${r},${g},${b_})`;
        ctx.lineWidth   = 1.8;
        ctx.lineCap     = 'round';

        ctx.translate(bx, by);
        ctx.rotate(f.heading);

        // Wing beat: sinusoidal up/down arc
        const wSpread = birdSize * 2.4;
        const wBend   = -birdSize * 0.28;                        // fixed dihedral — gliding posture

        ctx.beginPath();
        // Left wing
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-wSpread * 0.45, wBend, -wSpread, wBend * 0.35);
        // Right wing
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo( wSpread * 0.45, wBend,  wSpread, wBend * 0.35);
        // Body line
        ctx.moveTo(-birdSize * 0.5, 0);
        ctx.lineTo( birdSize * 0.7, 0);
        ctx.stroke();

        ctx.restore();
      }
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function _edgeFade(x, y, W, H, margin) {
  const left   = Math.min(1, x / margin);
  const right  = Math.min(1, (W - x) / margin);
  const top    = Math.min(1, y / margin);
  const bottom = Math.min(1, (H - y) / margin);
  return Math.max(0, Math.min(left, right, top, bottom));
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
