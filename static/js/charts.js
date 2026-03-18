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
  ctx.fillStyle = C('--canvas-dot');
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
  const PAD = { t: 14, b: 36, l: 52, r: 10 };
  const cw  = w - PAD.l - PAD.r;
  const ch  = h - PAD.t - PAD.b;

  const yMin = -65, yMax = -20;
  const yScale = ch / (yMax - yMin);

  function yp(val) { return PAD.t + (yMax - val) * yScale; }
  function xp(i)   { return PAD.l + (i / (SIG_WINDOW - 1)) * cw; }

  // Y-axis label
  ctx.save();
  ctx.translate(12, PAD.t + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.fillText('dBFS', 0, 0);
  ctx.restore();

  // Y-axis ticks + gridlines
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'right';
  for (const v of [-60, -50, -40, -30]) {
    const y = yp(v);
    ctx.fillText(v, PAD.l - 4, y + 4);
    ctx.strokeStyle = C('--canvas-grid');
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
  }

  // X-axis labels
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'left';
  ctx.fillText('−120s', PAD.l, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('now', w - PAD.r, h - 4);
  ctx.textAlign = 'center';
  ctx.fillText('time →', PAD.l + cw / 2, h - 4);

  // Legend
  ctx.font = '22px ' + C('--mono');
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 12, C('--accent'),   'signal', false);
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 26, C('--text-dim'), 'noise',  false);

  if (pts.length < 2) return;

  // noise fill
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(SIG_WINDOW - pts.length + i), y = yp(p.noise);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xp(SIG_WINDOW - 1), PAD.t + ch);
  ctx.lineTo(xp(SIG_WINDOW - pts.length), PAD.t + ch);
  ctx.closePath();
  ctx.fillStyle = C('--canvas-noise-fill');
  ctx.fill();

  // noise line
  ctx.strokeStyle = C('--text-dim');
  ctx.lineWidth = 1;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(SIG_WINDOW - pts.length + i), y = yp(p.noise);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // signal fill
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(SIG_WINDOW - pts.length + i), y = yp(p.sig);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xp(SIG_WINDOW - 1), PAD.t + ch);
  ctx.lineTo(xp(SIG_WINDOW - pts.length), PAD.t + ch);
  ctx.closePath();
  ctx.fillStyle = C('--canvas-sig-fill');
  ctx.fill();

  // signal line
  ctx.strokeStyle = C('--accent');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = xp(SIG_WINDOW - pts.length + i), y = yp(p.sig);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // current SNR readout
  const last = pts[pts.length - 1];
  if (last) {
    ctx.textAlign = 'right';
    ctx.font = '24px ' + C('--mono');
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
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.fillText('pulses', 0, 0);
  ctx.restore();

  // Y-axis ticks
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'right';
  [Math.round(maxV * 0.5), maxV].forEach(v => {
    const y = PAD.t + ch - (v / maxV) * ch;
    ctx.fillText(v, PAD.l - 4, y + 4);
    ctx.strokeStyle = C('--canvas-grid');
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
    ctx.fillStyle = `rgba(${C('--bar-rgb')},${alpha})`;
    ctx.fillRect(x + 1, y, bw - 2, bh);
  });

  // X-axis labels
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'left';
  ctx.fillText('−5 min', PAD.l, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('now', w - PAD.r, h - 4);
  ctx.textAlign = 'center';
  ctx.fillText('time →', PAD.l + cw / 2, h - 4);

  // Legend
  ctx.font = '22px ' + C('--mono');
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 12, `rgba(${C('--bar-rgb')},0.85)`, 'pulse count', true);

  document.getElementById('ph-rate').textContent = bins[BIN_COUNT - 1] + '/10s';
}

// ── Noise Floor trend line ──────────────────────────────────────────────────

const noiseCanvas = document.getElementById('noise-canvas');

export function drawNoiseChart() {
  if (!noiseCanvas) return;
  const { w, h } = resizeCanvas(noiseCanvas);
  const ctx = noiseCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  drawDotGrid(ctx, w, h);

  const PAD = { t: 14, b: 36, l: 52, r: 10 };
  const cw  = w - PAD.l - PAD.r;
  const ch  = h - PAD.t - PAD.b;

  // Y-axis label
  ctx.save();
  ctx.translate(12, PAD.t + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.fillText('dBFS', 0, 0);
  ctx.restore();

  // X-axis labels
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'left';
  ctx.fillText('−5 min', PAD.l, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('now', w - PAD.r, h - 4);
  ctx.textAlign = 'center';
  ctx.fillText('time →', PAD.l + cw / 2, h - 4);

  // Legend
  ctx.font = '22px ' + C('--mono');
  drawLegendItem(ctx, PAD.l + 4, PAD.t + 12, C('--text-mid'), 'noise floor', false);

  const validPts = state.noiseBins
    .map((v, i) => v !== null ? { i, v } : null)
    .filter(Boolean);
  if (validPts.length < 2) return;

  const vals = validPts.map(p => p.v);
  const yMin = Math.min(...vals) - 3;
  const yMax = Math.max(...vals) + 3;

  function xp(i)   { return PAD.l + (i / (BIN_COUNT - 1)) * cw; }
  function yp(val) { return PAD.t + (1 - (val - yMin) / (yMax - yMin)) * ch; }

  // Y-axis ticks
  ctx.font = '22px ' + C('--mono');
  ctx.fillStyle = C('--text-dim');
  ctx.textAlign = 'right';
  const mid = (yMin + yMax) / 2;
  [yMin + 1, mid, yMax - 1].forEach(v => {
    const y = yp(v);
    ctx.fillText(Math.round(v), PAD.l - 4, y + 4);
    ctx.strokeStyle = C('--canvas-grid');
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
  });

  // fill
  ctx.beginPath();
  validPts.forEach((p, j) => {
    const x = xp(p.i), y = yp(p.v);
    j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xp(validPts[validPts.length - 1].i), PAD.t + ch);
  ctx.lineTo(xp(validPts[0].i), PAD.t + ch);
  ctx.closePath();
  ctx.fillStyle = C('--canvas-noise2');
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

  const last = validPts[validPts.length - 1];
  if (last) document.getElementById('ph-noise').textContent = last.v.toFixed(1) + 'dB';
}
