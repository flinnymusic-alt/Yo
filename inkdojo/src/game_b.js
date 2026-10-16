// ── the dojo: four halls round a gravel courtyard with a pond, a cherry tree and the Grandmaster's dais ──
const WORLD = { w: 1600, h: 1700 };
const HALLS = {
  air:   { x: 400, y: 90, w: 800, h: 440, label: 'Hall of Air', sign: { x: 800, y: 120 } },
  water: { x: 90, y: 470, w: 400, h: 760, label: 'Hall of Water', sign: { x: 120, y: 850 } },
  earth: { x: 1110, y: 470, w: 400, h: 760, label: 'Hall of Earth', sign: { x: 1480, y: 850 } },
  fire:  { x: 400, y: 1170, w: 800, h: 440, label: 'Hall of Fire', sign: { x: 800, y: 1580 } },
};
const YARD = { x: 520, y: 560, w: 560, h: 580 };
const POND = { x: 830, y: 905, rx: 120, ry: 72 };
const DAIS = { x: 800, y: 612, w: 230, h: 64 };
const START = { x: 800, y: 1065 };
// things you can't walk through: pillars, the tree, lanterns and rocks (circles), the pond (an oval), the outer walls
const SOLIDS = [];
for (const [x, y] of [[400, 90], [1200, 90], [400, 530], [1200, 530], [90, 470], [490, 470], [90, 1230], [490, 1230], [1110, 470], [1510, 470], [1110, 1230], [1510, 1230],
                      [400, 1170], [1200, 1170], [400, 1610], [1200, 1610], [520, 560], [1080, 560], [520, 1140], [1080, 1140]]) SOLIDS.push({ x, y, r: 17, kind: 'pillar' });
SOLIDS.push({ x: 625, y: 690, r: 20, kind: 'tree' });
for (const [x, y] of [[560, 1100], [1040, 1100], [1040, 600], [560, 600]]) SOLIDS.push({ x, y, r: 13, kind: 'lantern' });
for (const [x, y, r] of [[700, 980, 16], [940, 1040, 12], [985, 760, 18]]) SOLIDS.push({ x, y, r, kind: 'rock' });
function blocked(p, r) {
  // the walls
  p.x = clamp(p.x, 80 + r, WORLD.w - 80 - r); p.y = clamp(p.y, 80 + r, WORLD.h - 80 - r);
  for (const s of SOLIDS) { const d = Math.hypot(p.x - s.x, p.y - s.y), m = s.r + r; if (d < m) { const k = (m - d) / (d || 1); p.x += (p.x - s.x) * k; p.y += (p.y - s.y) * k; } }
  // the pond: pushed back out along its oval
  const ex = (p.x - POND.x) / (POND.rx + r), ey = (p.y - POND.y) / (POND.ry + r), e = Math.hypot(ex, ey);
  if (e < 1) { const k = 1 / (e || 1e-6); p.x = POND.x + ex * k * (POND.rx + r); p.y = POND.y + ey * k * (POND.ry + r); }
}

// the floor is painted once, onto its own canvas, and the visible part copied each frame
const floor = document.createElement('canvas');
floor.width = WORLD.w; floor.height = WORLD.h;
(function paintFloor() {
  const c = floor.getContext('2d');
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.fillStyle = '#0d0b12'; c.fillRect(0, 0, WORLD.w, WORLD.h);
  // wooden planks everywhere inside the walls
  const PL = 34, tones = ['#6d4529', '#77502f', '#6a4327', '#7c5534', '#714a2c'];
  for (let y = 70, row = 0; y < WORLD.h - 70; y += PL, row++) {
    let x = 70 - r() * 160;
    while (x < WORLD.w - 70) {
      const len = 160 + r() * 220;
      c.fillStyle = tones[(row * 3 + Math.floor(x / 97)) % tones.length];
      c.fillRect(Math.max(70, x), y, Math.min(len, WORLD.w - 70 - x), PL - 1);
      c.strokeStyle = 'rgba(255,220,170,0.06)'; c.lineWidth = 1;
      for (let g = 0; g < 3; g++) { const gy = y + 6 + g * 9 + r() * 3; c.beginPath(); c.moveTo(Math.max(70, x + 6), gy); c.bezierCurveTo(x + len * 0.3, gy - 2, x + len * 0.6, gy + 2, Math.min(WORLD.w - 70, x + len - 6), gy); c.stroke(); }
      c.fillStyle = 'rgba(20,10,4,0.55)'; c.fillRect(Math.min(WORLD.w - 70, x + len) - 1, y, 2, PL - 1);
      x += len;
    }
    c.fillStyle = 'rgba(20,10,4,0.5)'; c.fillRect(70, y + PL - 1, WORLD.w - 140, 1);
  }
  // tatami in the halls: straw mats with dark cloth edges, laid in the old pattern
  for (const [way, h] of Object.entries(HALLS)) {
    c.fillStyle = '#3a2a1a'; c.fillRect(h.x - 4, h.y - 4, h.w + 8, h.h + 8);
    const mw = 120, mh = 60;
    for (let y = h.y, j = 0; y < h.y + h.h - 1; y += mh, j++) for (let x = h.x, i = 0; x < h.x + h.w - 1; x += mw, i++) {
      const rot = (i + j) % 3 === 0, w = rot ? mh : mw, hh = rot ? mw : mh;
      if (rot && y + hh > h.y + h.h) continue;
      const g = c.createLinearGradient(x, y, x + w, y + hh);
      g.addColorStop(0, '#c7b67a'); g.addColorStop(1, '#b9a76a');
      c.fillStyle = g; c.fillRect(x + 1, y + 1, Math.min(w, h.x + h.w - x) - 2, Math.min(hh, h.y + h.h - y) - 2);
      c.strokeStyle = 'rgba(90,80,40,0.22)'; c.lineWidth = 1;
      for (let k = 3; k < (rot ? w : hh) - 2; k += 3) { c.beginPath(); if (rot) { c.moveTo(x + k, y + 2); c.lineTo(x + k, y + Math.min(hh, h.y + h.h - y) - 2); } else { c.moveTo(x + 2, y + k); c.lineTo(x + Math.min(w, h.x + h.w - x) - 2, y + k); } c.stroke(); }
      c.strokeStyle = '#2b3a22'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, Math.min(w, h.x + h.w - x) - 3, Math.min(hh, h.y + h.h - y) - 3);
    }
    // the way's sign painted large on the mats, in faint ink
    const cxh = h.x + h.w / 2, cyh = h.y + h.h / 2, R = Math.min(h.w, h.h) * 0.3;
    c.save(); c.globalAlpha = 0.16; c.strokeStyle = WAYS[way].color; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round';
    wayMark(c, way, cxh, cyh, R); c.restore();
  }
  // the courtyard: raked gravel, rings round the rocks, a stone path, the pond
  const Y = YARD;
  c.fillStyle = '#d5cfc1'; c.fillRect(Y.x, Y.y, Y.w, Y.h);
  c.strokeStyle = 'rgba(120,110,95,0.35)'; c.lineWidth = 1.5;
  for (let y = Y.y + 8; y < Y.y + Y.h; y += 9) { c.beginPath(); c.moveTo(Y.x, y); c.lineTo(Y.x + Y.w, y); c.stroke(); }
  for (const s of SOLIDS.filter(s => s.kind === 'rock')) for (let k = 1; k <= 4; k++) { c.fillStyle = '#d5cfc1'; c.beginPath(); c.arc(s.x, s.y, s.r + k * 11, 0, TAU); c.fill(); }
  for (const s of SOLIDS.filter(s => s.kind === 'rock')) for (let k = 1; k <= 4; k++) { c.beginPath(); c.arc(s.x, s.y, s.r + k * 11, 0, TAU); c.stroke(); }
  c.strokeStyle = '#6b5f50'; c.lineWidth = 6; c.strokeRect(Y.x - 3, Y.y - 3, Y.w + 6, Y.h + 6);
  // stepping stones from the south door to the dais
  for (let i = 0; i < 9; i++) { const y = 1130 - i * 58, x = 800 + (i % 2 ? 46 : -46) * (i > 1 && i < 7 ? 1.6 : 0.5); c.fillStyle = '#8f877a'; c.beginPath(); c.ellipse(x, y, 26, 17, 0.2 * (i % 3), 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.ellipse(x - 5, y - 4, 16, 9, 0.2, 0, TAU); c.fill(); }
  const pg = c.createRadialGradient(POND.x - 30, POND.y - 20, 10, POND.x, POND.y, POND.rx);
  pg.addColorStop(0, '#2b6f8f'); pg.addColorStop(1, '#173a52');
  c.fillStyle = '#6b6457'; c.beginPath(); c.ellipse(POND.x, POND.y, POND.rx + 9, POND.ry + 9, 0, 0, TAU); c.fill();
  c.fillStyle = pg; c.beginPath(); c.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU); c.fill();
  for (const [x, y, rr2] of [[POND.x - 70, POND.y - 20, 14], [POND.x + 50, POND.y + 30, 11], [POND.x + 20, POND.y - 40, 9]]) { c.fillStyle = '#3f7d4a'; c.beginPath(); c.arc(x, y, rr2, 0.3, TAU - 0.2); c.lineTo(x, y); c.fill(); }
  // the dais
  c.fillStyle = '#3c2416'; c.fillRect(DAIS.x - DAIS.w / 2 - 6, DAIS.y - DAIS.h / 2 - 6, DAIS.w + 12, DAIS.h + 12);
  c.fillStyle = '#8a4b2a'; c.fillRect(DAIS.x - DAIS.w / 2, DAIS.y - DAIS.h / 2, DAIS.w, DAIS.h);
  c.strokeStyle = 'rgba(255,200,150,0.25)'; c.lineWidth = 1; for (let x = DAIS.x - DAIS.w / 2 + 12; x < DAIS.x + DAIS.w / 2; x += 23) { c.beginPath(); c.moveTo(x, DAIS.y - DAIS.h / 2 + 2); c.lineTo(x, DAIS.y + DAIS.h / 2 - 2); c.stroke(); }
  // the outer walls: dark beams with paper screens
  c.fillStyle = '#2a1a10'; c.fillRect(56, 56, WORLD.w - 112, 18); c.fillRect(56, WORLD.h - 74, WORLD.w - 112, 18); c.fillRect(56, 56, 18, WORLD.h - 112); c.fillRect(WORLD.w - 74, 56, 18, WORLD.h - 112);
  c.fillStyle = '#e8dfc8';
  for (let x = 90; x < WORLD.w - 90; x += 64) { c.fillRect(x, 60, 56, 10); c.fillRect(x, WORLD.h - 70, 56, 10); }
  for (let y = 90; y < WORLD.h - 90; y += 64) { c.fillRect(60, y, 10, 56); c.fillRect(WORLD.w - 70, y, 10, 56); }
})();
// a way's mark, in the shape its guard takes: water a circle, fire a triangle, earth a square, air an open sweep
function wayMark(c, way, x, y, R) {
  c.beginPath();
  if (way === 'water') c.arc(x, y, R, 0, TAU);
  else if (way === 'fire') { c.moveTo(x, y - R); c.lineTo(x + R * 0.88, y + R * 0.6); c.lineTo(x - R * 0.88, y + R * 0.6); c.closePath(); }
  else if (way === 'earth') c.rect(x - R * 0.8, y - R * 0.8, R * 1.6, R * 1.6);
  else { c.arc(x, y, R, Math.PI * 0.75, Math.PI * 2.45); }
  c.stroke();
}

// ── the camera: it follows you, and in a fight it frames both of you ──
const cam = { x: START.x, y: START.y, s: 1, shake: 0 };
function camTarget() {
  const A = L.arena, base = clamp(Math.min(A.w / 400, A.h / 440), 0.62, 1.8);
  if (FIGHT && FIGHT.foe) {
    const f = FIGHT.foe, mx = (player.x * 0.6 + f.x * 0.4), my = (player.y * 0.6 + f.y * 0.4);
    const need = Math.max(Math.abs(player.x - f.x) + 160, (Math.abs(player.y - f.y) + 200) * A.w / A.h);
    return { x: mx, y: my, s: clamp(A.w / need, 0.5, base * 1.3) };
  }
  return { x: player.x, y: player.y, s: base };
}
function updateCam(dt, snap) {
  const T = camTarget(), k = snap ? 1 : Math.min(1, dt * 5);
  cam.x = lerp(cam.x, T.x, k); cam.y = lerp(cam.y, T.y, k); cam.s = lerp(cam.s, T.s, snap ? 1 : Math.min(1, dt * 2.5));
  cam.shake = Math.max(0, cam.shake - dt * 30);
}
const toScreen = (x, y) => ({ x: L.arena.x + L.arena.w / 2 + (x - cam.x) * cam.s, y: L.arena.y + L.arena.h * 0.56 + (y - cam.y) * cam.s });
function worldTransform() {
  const sx = cam.shake ? rr(-cam.shake, cam.shake) : 0, sy = cam.shake ? rr(-cam.shake, cam.shake) : 0;
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * (L.arena.x + L.arena.w / 2 - cam.x * cam.s + sx), DPR * (L.arena.y + L.arena.h * 0.56 - cam.y * cam.s + sy));
}
function drawFloor() {
  // only the part of the floor in view
  const s = cam.s, x0 = cam.x - (L.arena.w / 2) / s - 4, y0 = cam.y - (L.arena.h * 0.56) / s - 4, w = L.arena.w / s + 8, h = L.arena.h / s + 8;
  const sx = clamp(x0, 0, WORLD.w), sy = clamp(y0, 0, WORLD.h), ex = clamp(x0 + w, 0, WORLD.w), ey = clamp(y0 + h, 0, WORLD.h);
  if (ex > sx && ey > sy) ctx.drawImage(floor, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
}
// the koi, the petals and the things that stand up off the floor
const KOI = Array.from({ length: 5 }, (_, i) => ({ a: i * 1.3, r: 0.4 + (i % 3) * 0.18, sp: 0.25 + (i % 2) * 0.12, c: i % 2 ? '#f08a3c' : '#f4efe4' }));
function drawPond(t) {
  for (const k of KOI) {
    const a = k.a + t * k.sp, x = POND.x + Math.cos(a) * POND.rx * k.r * 0.9, y = POND.y + Math.sin(a) * POND.ry * k.r * 0.9, d = a + Math.PI / 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(d);
    ctx.fillStyle = k.c; ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -4 * Math.sin(t * 6 + k.a)); ctx.lineTo(-14, 4); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i / 3) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(POND.x - 40 + i * 40, POND.y + (i - 1) * 18, 6 + ph * 26, 3 + ph * 14, 0, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawProps(t, layer) {
  for (const s of SOLIDS) {
    if (layer === 'low') {
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(s.x + 4, s.y + 6, s.r * 1.1, s.r * 0.7, 0, 0, TAU); ctx.fill();
      if (s.kind === 'pillar') { ctx.fillStyle = '#7a2418'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#a3382a'; ctx.beginPath(); ctx.arc(s.x - 4, s.y - 4, s.r * 0.55, 0, TAU); ctx.fill(); }
      else if (s.kind === 'lantern') { ctx.fillStyle = '#8b857a'; ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); ctx.fillStyle = `rgba(255,200,120,${0.55 + 0.15 * Math.sin(t * 3 + s.x)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.55, 0, TAU); ctx.fill(); }
      else if (s.kind === 'rock') { ctx.fillStyle = '#6e695f'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.82, 0.4, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(s.x - 3, s.y - 4, s.r * 0.5, s.r * 0.3, 0.4, 0, TAU); ctx.fill(); }
      else if (s.kind === 'tree') { ctx.fillStyle = '#4a2f22'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    } else if (s.kind === 'tree') {
      // the blossom, over everyone's heads (see-through when someone is under it)
      const under = player && [player, ...fighters()].some(f => Math.hypot(f.x - s.x, f.y - s.y) < 110);
      ctx.globalAlpha = under ? 0.3 : 0.86;
      for (const [dx, dy, r] of [[0, -20, 62], [-48, 6, 46], [46, 0, 50], [-12, 40, 44], [30, -54, 40]]) {
        const g = ctx.createRadialGradient(s.x + dx - 10, s.y + dy - 12, 4, s.x + dx, s.y + dy, r);
        g.addColorStop(0, '#ffd3e2'); g.addColorStop(1, 'rgba(232,140,170,0.75)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x + dx, s.y + dy, r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  if (layer !== 'low') {
    // falling petals
    ctx.fillStyle = '#ffc6d9';
    for (let i = 0; i < 16; i++) { const ph = (t * 0.07 + i * 0.137) % 1, x = 560 + ((i * 97) % 180) + Math.sin(t + i) * 20, y = 600 + ph * 260; ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9; ctx.beginPath(); ctx.ellipse(x, y, 3, 1.7, t + i, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // the halls' banners
    for (const [way, h] of Object.entries(HALLS)) {
      const s = h.sign, col = WAYS[way].color;
      ctx.fillStyle = '#efe6d0'; ctx.fillRect(s.x - 24, s.y - 30, 48, 60);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; wayMark(ctx, way, s.x, s.y - 2, 14);
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(s.x - 28, s.y - 34, 56, 5);
    }
  }
}

