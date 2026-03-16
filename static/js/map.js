// Globe map — equirectangular projection, animated station rings, responsive sizing

const MAP = { latMin: 41.5, latMax: 46.8, lonMin: -84.5, lonMax: -74.0 };
let MAP_SIZE = 480;

const mapCanvas = document.getElementById('map-canvas');

// Great Lakes polygons  [lon, lat]
const LAKES = [
  // Lake Ontario
  [[-79.85,43.25],[-79.4,42.9],[-78.8,43.2],[-77.8,43.45],[-77.3,43.6],
   [-76.7,43.7],[-76.2,43.75],[-76.45,43.95],[-76.8,44.25],[-77.2,44.3],
   [-78.5,44.15],[-79.2,43.95],[-79.55,43.8],[-79.75,43.6],[-79.85,43.4],
   [-79.85,43.25]],
  // Lake Erie
  [[-83.1,42.3],[-83.35,41.95],[-83.0,41.7],[-82.5,41.65],[-82.0,41.6],
   [-81.3,41.65],[-80.5,41.85],[-80.0,42.1],[-79.35,42.7],[-79.05,42.85],
   [-79.5,42.75],[-80.2,42.55],[-80.8,42.4],[-81.8,42.35],[-82.6,42.2],
   [-83.1,42.3]],
  // Lake Huron (southeastern / Georgian Bay)
  [[-79.9,44.0],[-80.1,44.2],[-80.5,44.9],[-80.8,45.5],[-81.3,45.6],
   [-82.0,45.4],[-82.5,45.0],[-83.0,44.5],[-83.1,44.0],[-82.7,43.8],
   [-82.3,43.55],[-81.5,43.4],[-81.0,43.5],[-80.5,43.7],[-79.9,44.0]],
];

// Notable locations
const PLACES = [
  { lon: -80.40, lat: 42.57, label: 'Long Point', type: 'motus' },
  { lon: -82.52, lat: 41.97, label: 'Pt. Pelee',  type: 'motus' },
  { lon: -79.38, lat: 43.65, label: 'Toronto',    type: 'city'  },
  { lon: -79.87, lat: 43.26, label: 'Hamilton',   type: 'motus' },
  { lon: -76.48, lat: 44.23, label: 'Kingston',   type: 'motus' },
  { lon: -80.47, lat: 43.15, label: 'Brant',      type: 'motus' },
  { lon: -81.22, lat: 42.98, label: 'Woodstock',  type: 'motus' },
];

function project(lon, lat) {
  const x = (lon - MAP.lonMin) / (MAP.lonMax - MAP.lonMin) * MAP_SIZE;
  const y = (MAP.latMax - lat) / (MAP.latMax - MAP.latMin) * MAP_SIZE;
  return [x, y];
}

let offMap = null;

function buildStaticMap(size) {
  MAP_SIZE = size;
  offMap   = new OffscreenCanvas(size, size);
  const ctx = offMap.getContext('2d');

  // Land — matches bar chart green palette
  ctx.fillStyle = 'rgba(154,200,138,0.18)';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(154,200,138,0.06)';
  for (let x = 6; x < size; x += 20)
    for (let y = 6; y < size; y += 20)
      ctx.fillRect(x, y, 1, 1);

  // Water (dark, contrasts with green land)
  LAKES.forEach(poly => {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle   = '#070e07';
    ctx.fill();
    ctx.strokeStyle = 'rgba(154,200,138,0.35)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  });

  // Canada/US border
  ctx.strokeStyle = 'rgba(154,200,138,0.15)';
  ctx.lineWidth   = 0.8;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  [[-84.0,42.35],[-83.1,42.05],[-82.7,41.7],[-79.05,42.85],[-78.95,43.0]]
    .forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
  ctx.stroke();
  ctx.setLineDash([]);

  // Place markers + labels
  const fontSize = Math.round(size / 48);
  const ms       = Math.max(3, size / 100);
  PLACES.forEach(p => {
    const [x, y] = project(p.lon, p.lat);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = p.type === 'motus' ? 'rgba(154,200,138,0.7)' : 'rgba(154,200,138,0.35)';
    ctx.fillRect(-ms / 2, -ms / 2, ms, ms);
    ctx.restore();
    ctx.font      = `${fontSize}px Courier New, monospace`;
    ctx.fillStyle = 'rgba(154,200,138,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(p.label, x + fontSize * 0.8, y + fontSize * 0.4);
  });
}

let mapT0 = Date.now();

function drawFrame() {
  if (!offMap) { requestAnimationFrame(drawFrame); return; }

  const ctx = mapCanvas.getContext('2d');
  const S   = MAP_SIZE;
  ctx.clearRect(0, 0, S, S);

  const R = S / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(offMap, 0, 0);

  // Station pulsing rings
  const [sx, sy] = project(-80.52, 43.46);
  const ringR    = S / 27;
  const t        = ((Date.now() - mapT0) % 2400) / 2400;
  const t2       = ((Date.now() - mapT0 + 1200) % 2400) / 2400;

  [t, t2].forEach(tt => {
    ctx.beginPath();
    ctx.arc(sx, sy, ringR * tt, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(200,168,64,${0.8 * (1 - tt)})`;
    ctx.lineWidth   = 2;
    ctx.stroke();
  });

  // Station dot
  const dotR = Math.max(3, S / 110);
  ctx.beginPath();
  ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
  ctx.fillStyle   = '#c8a840';
  ctx.fill();
  ctx.strokeStyle = '#070e07';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Station label
  const lfs = Math.round(S / 40);
  ctx.font      = `bold ${lfs}px Courier New, monospace`;
  ctx.fillStyle = '#c8a840';
  ctx.textAlign = 'left';
  ctx.fillText('Waterloo', sx + dotR + 3, sy - dotR - 2);

  ctx.restore();

  // Circle border
  ctx.beginPath();
  ctx.arc(R, R, R - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(154,200,138,0.25)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  requestAnimationFrame(drawFrame);
}

export function resizeMapCanvas() {
  const body = document.querySelector('.globe-body');
  const size = Math.min(body.clientWidth, body.clientHeight) - 12;
  if (size < 50) return;
  mapCanvas.width  = size;
  mapCanvas.height = size;
  buildStaticMap(size);
}

export function startMapAnimation() {
  requestAnimationFrame(drawFrame);
}
