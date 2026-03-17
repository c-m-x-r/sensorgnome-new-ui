// Canvas charts — SNR line, Pulse Rate bars, Noise Floor trend
// Shared helpers kept here to avoid a separate helpers module for 3 functions.

import { state, SIG_WINDOW, BIN_COUNT } from './state.js';

const CSS = getComputedStyle(document.documentElement);
const C   = (v) => CSS.getPropertyValue(v).trim();

// ── Shared helpers ──────────────────────────────────────────────────────────

function resizeCanvas(canvas) {
  const r   = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width  !== Math.round(r.width  * dpr) ||
      canvas.height !== Math.round(r.height * dpr)) {
    canvas.width  = Math.round(r.width  * dpr);
    canvas.height = Math.round(r.height * dpr);
    canvas.getContext('2d').scale(dpr, dpr);
  }
  return { w: r.width, h: r.height };
}

function drawDotGrid(ctx, w, h) {
  ctx.fillStyle = '#142014';
  const step = 18;
  for (let x = 4; x < w; x += step)
    for (let y = 4; y < h; y += step)
      ctx.fillRect(x, y, 1, 1);
}

function drawLegendItem(ctx, x, y, color, label, isFill) {
  ctx.save();
  if (isFill) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 7, 14, 9);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + 14, y - 2); ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 18, y);
  ctx.restore();
}

// ── Signal + Noise (rolling line) ──────────────────────────────────────────

const snrCanvas = document.getElementById('snr-canvas');

export function drawSNRChart() {
  const { w, h } = resizeCanvas(snrCanvas);
  const ctx = snrCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  drawDotGrid(ctx, w, h);

  const pts = state.signals;
  const PAD = { t: 14, b: 30, l: 46, r: 10 };
  const cw  = w - PAD.l - PAD.r;
  const ch  = h - PAD.t - PAD.b;

  const yMin = -65, yMax = -20;
  const yScale = ch / (yMax - yMin);

  // Time-based x: oldest point anchored to left edge, nowS to right edge.
  // p.t is Unix seconds (Python time.time()).
  const nowS   = Date.now() / 1000;
  const t0     = pts.length > 0 ? pts[0].t : nowS - SIG_WINDOW;
  const tSpan  = Math.max(nowS - t0, 1);

  function yp(val) { return PAD.t + (yMax - val) * yScale; }
  function xp(t)   { return PAD.l + ((t - t0) / tSpan) * cw; }

  // Y-axis label
  ctx.save();
  ctx.translate(12, PAD.t + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.fillText('dBFS', 0, 0);
  ctx.restore();

  // Y-axis ticks + gridlines
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'right';
  for (const v of [-60, -50, -40, -30]) {
    const y = yp(v);
    ctx.fillText(v, PAD.l - 4, y + 4);
    ctx.strokeStyle = '#1a281a';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
  }

  // X-axis labels
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  const spanLabel = tSpan >= 60 ? `−${Math.round(tSpan / 60)}m` : `−${Math.round(tSpan)}s`;
  ctx.textAlign = 'left';
  ctx.fillText(spanLabel, PAD.l, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('now', w - PAD.r, h - 4);
  ctx.textAlign = 'center';
  ctx.fillText('time →', PAD.l + cw / 2, h - 4);

  // Legend
  ctx.font = '11px ' + C('--mono');
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 12, C('--accent'),   'signal', false);
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 26, C('--text-dim'), 'noise',  false);

  if (pts.length < 2) return;

  // Clip to plot area so time-scrolled lines don't bleed outside
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, PAD.t, cw, ch);
  ctx.clip();

  // noise fill
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(p.t), y = yp(p.noise);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xp(pts[pts.length - 1].t), PAD.t + ch);
  ctx.lineTo(xp(pts[0].t), PAD.t + ch);
  ctx.closePath();
  ctx.fillStyle = 'rgba(58,85,53,0.18)';
  ctx.fill();

  // noise line
  ctx.strokeStyle = C('--text-dim');
  ctx.lineWidth = 1;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(p.t), y = yp(p.noise);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // signal fill
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(p.t), y = yp(p.sig);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xp(pts[pts.length - 1].t), PAD.t + ch);
  ctx.lineTo(xp(pts[0].t), PAD.t + ch);
  ctx.closePath();
  ctx.fillStyle = 'rgba(154,200,138,0.10)';
  ctx.fill();

  // signal line
  ctx.strokeStyle = C('--accent');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(p.t), y = yp(p.sig);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.restore(); // end clip

  // current SNR readout
  const last = pts[pts.length - 1];
  if (last) {
    ctx.textAlign = 'right';
    ctx.font = '12px ' + C('--mono');
    ctx.fillStyle = last.snr >= 15 ? C('--snr-hi') : last.snr >= 8 ? C('--snr-mid') : C('--snr-lo');
    ctx.fillText('snr ' + last.snr.toFixed(1) + 'dB', w - PAD.r, PAD.t + 14);
  }
}

// ── Pulse Rate bar chart ────────────────────────────────────────────────────

const detCanvas = document.getElementById('det-canvas');

export function drawDetChart() {
  const { w, h } = resizeCanvas(detCanvas);
  const ctx = detCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  drawDotGrid(ctx, w, h);

  const bins = state.pulseBins;
  const maxV = Math.max(...bins, 1);
  const PAD  = { t: 14, b: 30, l: 46, r: 10 };
  const cw   = w - PAD.l - PAD.r;
  const ch   = h - PAD.t - PAD.b;
  const bw   = cw / BIN_COUNT;

  // Y-axis label
  ctx.save();
  ctx.translate(12, PAD.t + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.fillText('pulses', 0, 0);
  ctx.restore();

  // Y-axis ticks
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'right';
  [Math.round(maxV * 0.5), maxV].forEach(v => {
    const y = PAD.t + ch - (v / maxV) * ch;
    ctx.fillText(v, PAD.l - 4, y + 4);
    ctx.strokeStyle = '#1a281a';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
  });

  // bars
  bins.forEach((v, i) => {
    if (v === 0) return;
    const bh    = (v / maxV) * ch;
    const x     = PAD.l + i * bw;
    const y     = PAD.t + ch - bh;
    const alpha = 0.35 + 0.65 * (i / BIN_COUNT);
    ctx.fillStyle = `rgba(154,200,138,${alpha})`;
    ctx.fillRect(x + 1, y, bw - 2, bh);
  });

  // X-axis labels
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'left';
  ctx.fillText('−5 min', PAD.l, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('now', w - PAD.r, h - 4);
  ctx.textAlign = 'center';
  ctx.fillText('time →', PAD.l + cw / 2, h - 4);

  // Legend
  ctx.font = '11px ' + C('--mono');
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 12, 'rgba(154,200,138,0.85)', 'pulse count', true);

  document.getElementById('ph-rate').textContent = bins[BIN_COUNT - 1] + '/10s';
}

// ── Noise Floor trend line ──────────────────────────────────────────────────

const noiseCanvas = document.getElementById('noise-canvas');

export function drawNoiseChart() {
  const { w, h } = resizeCanvas(noiseCanvas);
  const ctx = noiseCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  drawDotGrid(ctx, w, h);

  const PAD = { t: 14, b: 30, l: 46, r: 10 };
  const cw  = w - PAD.l - PAD.r;
  const ch  = h - PAD.t - PAD.b;

  // Time-based x positioning for smooth continuous scroll.
  // state.binStart is a JS timestamp (ms); WINDOW is 5 min in ms.
  const now       = Date.now();
  const WINDOW_MS = BIN_COUNT * 10000; // 5 min in ms

  function xp(i) {
    const slotsFromEnd = BIN_COUNT - 1 - i;
    const ageMs = slotsFromEnd * 10000 + (now - state.binStart);
    return PAD.l + Math.max(0, 1 - ageMs / WINDOW_MS) * cw;
  }

  // Y-axis label
  ctx.save();
  ctx.translate(12, PAD.t + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.fillText('dBFS', 0, 0);
  ctx.restore();

  // X-axis labels
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'left';
  ctx.fillText('−5 min', PAD.l, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('now', w - PAD.r, h - 4);
  ctx.textAlign = 'center';
  ctx.fillText('time →', PAD.l + cw / 2, h - 4);

  // Legend
  ctx.font = '11px ' + C('--mono');
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 12, C('--text-mid'), 'noise floor', false);

  const validPts = state.noiseBins
    .map((v, i) => v !== null ? { i, v } : null)
    .filter(Boolean);
  if (validPts.length < 2) return;

  const vals = validPts.map(p => p.v);
  const yMin = Math.min(...vals) - 3;
  const yMax = Math.max(...vals) + 3;

  function yp(val) { return PAD.t + (1 - (val - yMin) / (yMax - yMin)) * ch; }

  // Y-axis ticks
  ctx.font = '11px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'right';
  const mid = (yMin + yMax) / 2;
  [yMin + 1, mid, yMax - 1].forEach(v => {
    const y = yp(v);
    ctx.fillText(Math.round(v), PAD.l - 4, y + 4);
    ctx.strokeStyle = '#1a281a';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
  });

  // Clip to plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, PAD.t, cw, ch);
  ctx.clip();

  // fill
  ctx.beginPath();
  validPts.forEach((p, j) => {
    const x = xp(p.i), y = yp(p.v);
    j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xp(validPts[validPts.length - 1].i), PAD.t + ch);
  ctx.lineTo(xp(validPts[0].i), PAD.t + ch);
  ctx.closePath();
  ctx.fillStyle = 'rgba(58,85,53,0.22)';
  ctx.fill();

  // line
  ctx.strokeStyle = C('--text-mid');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  validPts.forEach((p, j) => {
    const x = xp(p.i), y = yp(p.v);
    j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.restore(); // end clip

  const last = validPts[validPts.length - 1];
  if (last) document.getElementById('ph-noise').textContent = last.v.toFixed(1) + 'dB';
}

// ── Continuous animation loops ───────────────────────────────────────────────

export function startChartAnimations() {
  function snrLoop() {
    drawSNRChart();
    requestAnimationFrame(snrLoop);
  }
  function noiseLoop() {
    drawNoiseChart();
    requestAnimationFrame(noiseLoop);
  }
  snrLoop();
  noiseLoop();
}
