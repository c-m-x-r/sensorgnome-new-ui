// Live pulse stream — DOM rendering of the scrolling feed panel

const feed      = document.getElementById('stream-feed');
const MAX_LINES = 28;
let   lineCount = 0;

function fmtTime(ts) {
  return new Date(ts * 1000).toISOString().slice(11, 19);
}

function snrClass(snr) {
  if (snr >= 15) return 'snr-hi';
  if (snr >= 8)  return 'snr-mid';
  return 'snr-lo';
}

function appendLine(div) {
  feed.appendChild(div);
  lineCount++;

  if (lineCount > 6) {
    const all = feed.querySelectorAll('.pline');
    for (let i = 0; i < all.length - 6; i++) all[i].classList.add('aging');
  }

  if (lineCount > MAX_LINES) {
    const old = feed.querySelector('.pline');
    if (old) { old.remove(); lineCount--; }
  }
}

export function pushPulseLine(p) {
  const cls = snrClass(p.snr);
  const div = document.createElement('div');
  div.className = 'pline';
  div.innerHTML =
    `<span class="f-port">p${p.port}</span>` +
    `<span class="f-time"> ${fmtTime(p.ts)}</span>` +
    `<span class="f-freq"> ${p.freq >= 0 ? '+' : ''}${p.freq.toFixed(2)}kHz</span>` +
    `<span class="f-snr ${cls}"> snr:${p.snr.toFixed(1)}dB</span>` +
    `<span class="f-levels"> (${p.sig.toFixed(1)}/${p.noise.toFixed(1)})</span>`;
  appendLine(div);
}

export function pushTagLine(t) {
  const div = document.createElement('div');
  div.className = 'pline tag-line';
  const run = t.run ? ` run:${t.run}` : '';
  div.innerHTML =
    `<span class="f-tag">▶ TAG </span>` +
    `<span class="f-time">${fmtTime(t.ts)}</span>` +
    `<span style="color:var(--amber)"> id:${t.tag_id}</span>` +
    `<span class="f-snr snr-hi"> snr:${t.snr ? t.snr.toFixed(1) : '—'}dB</span>` +
    `<span class="f-levels">${run}</span>`;
  appendLine(div);
}
