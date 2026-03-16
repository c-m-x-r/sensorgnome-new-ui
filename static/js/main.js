// Entry point — wires all modules together

import { connectSSE }                        from './sse.js';
import { pushPulseLine, pushTagLine }        from './stream.js';
import { drawSNRChart, drawDetChart, drawNoiseChart } from './charts.js';
import { resizeMapCanvas, startMapAnimation } from './map.js';

// Clock
function updateClock() {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ') + 'Z';
  document.getElementById('b-time').textContent = ts;
}
setInterval(updateClock, 1000);
updateClock();

// SSE — callbacks redraw charts and update the stream feed
connectSSE({
  onPulse(p) {
    pushPulseLine(p);
    drawSNRChart();
    drawDetChart();
    drawNoiseChart();
  },
  onTag(t) {
    pushTagLine(t);
  },
});

// Resize
window.addEventListener('resize', () => {
  drawSNRChart();
  drawDetChart();
  drawNoiseChart();
  resizeMapCanvas();
});

// Initial draws
drawSNRChart();
drawDetChart();
drawNoiseChart();
resizeMapCanvas();
startMapAnimation();

// Panel opacity — reduce to let background show through, e.g. ?opacity=0.6
const _opacityParam = parseFloat(new URLSearchParams(location.search).get('opacity'));
if (!isNaN(_opacityParam)) {
  const clamped = Math.max(0, Math.min(1, _opacityParam));
  document.documentElement.style.setProperty('--panel-alpha', clamped);
}

// Background animation — activate with ?bg=boids|vformation|parallax-forest|flapping-birds
const _BG_VALID = new Set(['boids', 'vformation', 'parallax-forest', 'flapping-birds']);
const _bgParam  = new URLSearchParams(location.search).get('bg');
if (_bgParam && _BG_VALID.has(_bgParam)) {
  import(`/static/bg/${_bgParam}.js`)
    .then(({ default: Bg }) => new Bg().mount(document.body))
    .catch(e => console.warn('bg:', e));
}
