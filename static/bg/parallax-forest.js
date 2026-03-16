// bg/parallax-forest.js — Endless parallax forest camera pan
//
// No birds. The camera drifts sideways through layered tree silhouettes,
// giving a "moving through forest" feeling without any animal rendering.
//
// Standalone:  open bg/demo.html and select "Parallax Forest"
// Import:      import ParallaxForestBG from './bg/parallax-forest.js';
//              new ParallaxForestBG().mount(document.body);
//
// Options (all optional):
//   speed      {number}  base scroll speed px/frame for nearest layer (default 0.55)
//   layerCount {number}  depth layers (default 4)
//   treeColors {string[]} hex colors per layer, near→far order
//   treeOpacity{number}  overall alpha (default 1, tune via colors instead)

export default class ParallaxForestBG {
  constructor(opts = {}) {
    this._o = {
      speed:       0.55,
      layerCount:  4,
      // near → far; very subtle contrast against #0b120b background
      treeColors: ['#162216', '#131d13', '#101810', '#0d140d'],
      ...opts,
    };
    this._layers  = [];
    this._canvas  = null;
    this._running = false;
    this._raf     = null;
    this.W = 0; this.H = 0;
    // stable seeded RNG so trees look the same per layer on rebuild
    this._rng = _seededRNG(42);
  }

  // ── public ────────────────────────────────────────────────────────────────

  mount(container = document.body) {
    this._canvas = _mkCanvas();
    container.prepend(this._canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());
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
    this._buildLayers();
  }

  _buildLayers() {
    const { layerCount, treeColors, speed } = this._o;
    const rng  = this._rng;
    // Reset RNG so rebuild is deterministic
    this._rng = _seededRNG(42);

    this._layers = [];
    // layer 0 = nearest, highest speed; layer n-1 = farthest, slowest
    for (let li = 0; li < layerCount; li++) {
      const depth    = li / (layerCount - 1);        // 0 = near, 1 = far
      const invDepth = 1 - depth;

      // scroll speed falls off with depth (parallax)
      const scrollSpd = speed * (0.15 + 0.85 * invDepth);

      // tree height range (near = taller)
      const minH = this.H * (0.05 + 0.22 * depth);  // far trees shorter
      const maxH = this.H * (0.12 + 0.52 * invDepth);

      const color   = treeColors[li] || '#0d140d';
      const tileW   = Math.round(this.W * 2.2);      // tile width
      const density = 6 + Math.round(8 * invDepth);  // more trees near front

      const trees = _generateTrees(this._rng, tileW, minH, maxH, density);

      this._layers.push({
        scrollSpd,
        offset:  Math.random() * tileW,  // stagger starts
        tileW,
        trees,
        color,
        baseY: this.H,
      });
    }
  }

  _loop() {
    if (!this._running) return;
    this._update();
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _update() {
    for (const layer of this._layers) {
      layer.offset = (layer.offset + layer.scrollSpd) % layer.tileW;
    }
  }

  _draw() {
    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, this.W, this.H);

    // Draw layers back-to-front (farthest first so near layers occlude)
    for (let li = this._layers.length - 1; li >= 0; li--) {
      const layer = this._layers[li];
      ctx.fillStyle = layer.color;

      for (const tree of layer.trees) {
        // draw at two x positions to cover the seam
        for (const rep of [0, 1]) {
          const tx = tree.x - layer.offset + rep * layer.tileW;
          // cull trees fully outside viewport
          if (tx + tree.w < -20 || tx - tree.w > this.W + 20) continue;
          _drawTree(ctx, tx, layer.baseY, tree);
        }
      }
    }
  }
}

// ── tree generation ──────────────────────────────────────────────────────────

/**
 * Generate a list of tree descriptors placed in a tile of width `tileW`.
 * Each tree is { x, w, h, type: 'conifer'|'deciduous', subtype }
 */
function _generateTrees(rng, tileW, minH, maxH, density) {
  const trees = [];
  // Place trees across the tile; some clustering, some gaps
  let x = rng() * 40;
  while (x < tileW) {
    const h = minH + rng() * (maxH - minH);
    const w = h * (0.35 + rng() * 0.45);    // width roughly proportional to height
    const type = rng() < 0.55 ? 'conifer' : 'deciduous';
    trees.push({ x, w, h, type });
    // gap between trees
    const gap = w * (0.15 + rng() * 0.6);
    x += w + gap;
  }
  return trees;
}

/**
 * Draw a single tree silhouette.
 * `baseX` is the trunk centre; `baseY` is the ground line.
 */
function _drawTree(ctx, baseX, baseY, tree) {
  if (tree.type === 'conifer') {
    _drawConifer(ctx, baseX, baseY, tree.w, tree.h);
  } else {
    _drawDeciduous(ctx, baseX, baseY, tree.w, tree.h);
  }
}

function _drawConifer(ctx, x, base, w, h) {
  // Stack 3 overlapping triangular tiers
  const tiers = 3;
  const trunkW = Math.max(1.5, w * 0.08);
  const trunkH = h * 0.18;

  // Trunk
  ctx.fillRect(x - trunkW / 2, base - trunkH, trunkW, trunkH);

  // Tiers from bottom to top
  for (let t = 0; t < tiers; t++) {
    const frac  = t / tiers;
    const tierH = h * (0.5 - frac * 0.15);    // tiers get taller toward top
    const tierW = w * (1 - frac * 0.45);       // tiers get narrower toward top
    const topY  = base - trunkH - t * h * 0.28 - tierH;
    const botY  = base - trunkH - t * h * 0.18;

    ctx.beginPath();
    ctx.moveTo(x,             topY);
    ctx.lineTo(x + tierW / 2, botY);
    ctx.lineTo(x - tierW / 2, botY);
    ctx.closePath();
    ctx.fill();
  }
}

function _drawDeciduous(ctx, x, base, w, h) {
  const trunkW = Math.max(1.5, w * 0.10);
  const trunkH = h * 0.28;
  const canopyR = h * 0.42;
  const canopyY = base - trunkH - canopyR * 0.85;

  // Trunk
  ctx.fillRect(x - trunkW / 2, base - trunkH, trunkW, trunkH);

  // Canopy — slightly irregular oval using bezier
  const rx = w * 0.52;
  const ry = canopyR;
  ctx.beginPath();
  ctx.ellipse(x, canopyY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Small secondary lobe to one side for irregularity
  const lobeR = canopyR * 0.55;
  const lobeX = x + rx * 0.55;
  ctx.beginPath();
  ctx.ellipse(lobeX, canopyY + ry * 0.2, lobeR * 0.9, lobeR, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Simple mulberry32 seeded PRNG — returns a function that yields [0,1) */
function _seededRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
