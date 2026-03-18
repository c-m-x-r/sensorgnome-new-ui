// SSE connection — connects to /stream, parses events, calls back into main.js
// Callbacks: { onPulse, onTag, onStatus, onGPS }

import { state, advanceBins, updateCounts } from './state.js';

export function connectSSE({ onPulse, onTag, onStatus, onGPS } = {}) {
  const es = new EventSource(new URL('stream', window.location.href).href);

  es.onmessage = (e) => {
    const evt = JSON.parse(e.data);
    switch (evt.type) {
      case 'status': handleStatus(evt); onStatus?.(evt); break;
      case 'pulse':  handlePulse(evt);  onPulse?.(evt);  break;
      case 'tag':    handleTag(evt);    onTag?.(evt);    break;
      case 'gps':    handleGPS(evt);    onGPS?.(evt);    break;
    }
  };

  es.onerror = () => console.warn('SSE disconnected, retrying...');
}

function handleStatus(s) {
  state.stationId = s.id;
  state.boot = s.boot;
  document.getElementById('b-id').textContent    = s.id;
  document.getElementById('b-boot').textContent  = s.boot;
  document.getElementById('ph-freq').textContent = s.freq.toFixed(3) + ' MHz';
}

function handleGPS(g) {
  state.gpsState = g.state || '3D-fix';
  document.getElementById('b-gps').textContent = state.gpsState;
}

function handlePulse(p) {
  state.totalPulses++;
  advanceBins();

  state.signals.push({ t: p.ts, sig: p.sig, noise: p.noise, snr: p.snr });
  if (state.signals.length > 120) state.signals.shift();

  state.pulseBins[state.pulseBins.length - 1]++;
  state.noiseAcc.sum += p.noise;
  state.noiseAcc.n++;

  updateCounts();
}

function handleTag(t) {
  state.totalTags++;
  updateCounts();
}
