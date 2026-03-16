// Shared data state — single source of truth imported by all modules

export const SIG_WINDOW = 120;  // rolling signal window (points)
export const BIN_COUNT  = 30;   // 10-second bins (5 min)

export const state = {
  signals:     [],           // [{t, sig, noise, snr}]  max SIG_WINDOW
  pulseBins:   new Array(BIN_COUNT).fill(0),
  noiseBins:   new Array(BIN_COUNT).fill(null),
  noiseAcc:    { sum: 0, n: 0 },
  binStart:    Date.now(),
  totalPulses: 0,
  totalTags:   0,
  stationId:   'SG-189DRPZ20169',
  boot:        233,
  gpsState:    '—',
};

export function advanceBins() {
  const now     = Date.now();
  const elapsed = now - state.binStart;
  if (elapsed < 10000) return;

  const steps = Math.min(BIN_COUNT, Math.floor(elapsed / 10000));
  for (let i = 0; i < steps; i++) {
    state.pulseBins.shift();
    state.pulseBins.push(0);
    state.noiseBins.shift();
    state.noiseBins.push(state.noiseAcc.n > 0
      ? state.noiseAcc.sum / state.noiseAcc.n
      : null);
    state.noiseAcc = { sum: 0, n: 0 };
  }
  state.binStart += steps * 10000;
}

export function updateCounts() {
  const p = state.totalPulses, t = state.totalTags;
  document.getElementById('ph-counts').textContent = `${p} pulses · ${t} tags`;
  document.getElementById('b-pulses').textContent  = p;
  document.getElementById('b-tags').textContent    = t;
}
