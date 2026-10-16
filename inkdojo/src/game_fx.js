// ── the look of the four elements: particles, marks on the floor, and the bodies of spells ──
// Every spell is drawn from three layers, all scaled by how well it was written (its power P):
//   the part that hits (its size and reach), the amount of element it throws out (how many flames, drops,
//   stones or gusts), and the extra show that doesn't change the fight (the glyph lit in the air, swirls, marks, shake).
let FX = [], TEXTS = [], GHOSTS = [], DECALS = [];
const FX_MAX = 950;
const fxRoom = () => FX.length < FX_MAX;
const amt = (n, am = 1) => Math.max(0, Math.round(n * am + Math.random() - 0.5));
const ELC = {
  water: { main: '#4ab4ff', light: '#bfe6ff', deep: '#1d5f9a', foam: '#eef9ff' },
  fire: { main: '#ff6a3a', light: '#ffd27a', deep: '#a8260f', foam: '#fff1c4' },
  earth: { main: '#c9a35c', light: '#e6cf9c', deep: '#5e4628', foam: '#d8c7a3' },
  air: { main: '#f1dc6a', light: '#fbf6d8', deep: '#9a8a3a', foam: '#ffffff' },
};
// soft round sprites, made once per colour
const SPR = {};
function softSprite(key, inner, outer, hard = 0.2) {
  if (SPR[key]) return SPR[key];
  const s = document.createElement('canvas'); s.width = s.height = 64;
  const c = s.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(hard, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return (SPR[key] = s);
}
function sprite(col) {
  if (SPR['g' + col]) return SPR['g' + col];
  const s = document.createElement('canvas'); s.width = s.height = 64;
  const c = s.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32), n = parseInt(col.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, `rgba(${r},${gg},${b},0.95)`); g.addColorStop(0.5, `rgba(${r},${gg},${b},0.32)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return (SPR['g' + col] = s);
}
const smokeSpr = () => softSprite('smoke', 'rgba(60,54,62,0.55)', 'rgba(60,54,62,0)', 0.15);
const mistSpr = () => softSprite('mist', 'rgba(235,245,255,0.5)', 'rgba(235,245,255,0)', 0.1);
const dustSpr = () => softSprite('dust', 'rgba(196,170,120,0.55)', 'rgba(196,170,120,0)', 0.12);
const waterSpr = () => softSprite('water', 'rgba(150,215,255,0.75)', 'rgba(80,170,255,0)', 0.35);
// a flame's colour as it lives: white-yellow, orange, red, then gone
function flameCol(k) { return k > 0.75 ? '#fff4c2' : k > 0.5 ? '#ffc04a' : k > 0.28 ? '#ff7a2a' : '#c8321a'; }

function fx(p) { if (fxRoom()) FX.push(p); return p; }
// ── spawners: n is scaled by the amount the spell throws out (am) ──
function burst(x, y, col, n, sp = 140, life = 0.6, size = 7, o = {}) {
  for (let i = 0; i < n; i++) { const a = o.a != null ? o.a + rr(-o.spread, o.spread) : rr(0, TAU), v = sp * rr(0.35, 1);
    fx({ k: 'glow', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), life: life * rr(0.6, 1), max: life, size: size * rr(0.6, 1.2), col, drag: o.drag ?? 2.5, grav: o.grav || 0 }); }
}
function flames(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.a != null ? o.a + rr(-(o.spread ?? 0.4), o.spread ?? 0.4) : rr(0, TAU), v = (o.sp ?? 60) * rr(0.3, 1), life = (o.life ?? 0.6) * rr(0.6, 1.1);
    fx({ k: 'flame', x: x + rr(-(o.jit || 4), o.jit || 4), y: y + rr(-(o.jit || 4), o.jit || 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.rise ?? 40), life, max: life, size: (o.size ?? 9) * rr(0.7, 1.25), drag: o.drag ?? 1.6, grow: o.grow ?? 0.6 });
  }
}
function embers(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) { const a = o.a != null ? o.a + rr(-(o.spread ?? 1), o.spread ?? 1) : rr(0, TAU), v = (o.sp ?? 120) * rr(0.3, 1), life = (o.life ?? 0.9) * rr(0.5, 1);
    fx({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.rise ?? 30), life, max: life, size: rr(1.2, 2.4), col: Math.random() < 0.5 ? '#ffd27a' : '#ff8a3a', drag: 1.2, grav: -(o.float ?? 20) }); }
}
function smoke(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) { const life = (o.life ?? 1.1) * rr(0.6, 1.1);
    fx({ k: 'smoke', x: x + rr(-6, 6), y: y + rr(-6, 6), vx: rr(-20, 20) + (o.vx || 0), vy: rr(-30, -8) + (o.vy || 0), life, max: life, size: (o.size ?? 14) * rr(0.7, 1.3), drag: 1.2, grow: 1.4 }); }
}
function drops(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.a != null ? o.a + rr(-(o.spread ?? 0.6), o.spread ?? 0.6) : rr(0, TAU), v = (o.sp ?? 110) * rr(0.3, 1), life = (o.life ?? 0.9) * rr(0.6, 1);
    fx({ k: 'drop', x, y, z: o.z ?? 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (o.up ?? 120) * rr(0.4, 1), g: 520, life, max: life, size: (o.size ?? 2.6) * rr(0.7, 1.3), drag: 0.6 });
  }
}
function splash(x, y, n, o = {}) {
  drops(x, y, n, { sp: o.sp ?? 130, up: o.up ?? 160, size: o.size, life: 0.8 });
  for (let i = 0; i < Math.ceil(n / 3); i++) { const a = rr(0, TAU), v = rr(20, 70); fx({ k: 'foam', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.5, size: rr(3, 6), drag: 3 }); }
  ripple(x, y, o.r ?? 26);
}
function ripple(x, y, r = 30, col = 'rgba(200,235,255,0.7)') { fx({ k: 'ripple', x, y, r0: 4, r1: r, life: 0.7, max: 0.7, col }); }
function mist(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), d = rr(0, o.r ?? 20), life = (o.life ?? 1.4) * rr(0.6, 1);
    fx({ k: 'mist', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rr(-15, 15), vy: rr(-15, 6), life, max: life, size: (o.size ?? 22) * rr(0.7, 1.3), drag: 0.8, grow: 0.5 }); }
}
function iceBurst(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) { const a = o.a != null ? o.a + rr(-(o.spread ?? 1), o.spread ?? 1) : rr(0, TAU), v = (o.sp ?? 140) * rr(0.3, 1), life = rr(0.5, 0.9);
    fx({ k: 'ice', x, y, z: 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rr(40, 160), g: 480, life, max: life, size: (o.size ?? 4) * rr(0.6, 1.3), rot: rr(0, TAU), vr: rr(-9, 9), drag: 1 }); }
  burst(x, y, '#cfefff', Math.ceil(n / 2), 90, 0.4, 5);
}
function rocks(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.a != null ? o.a + rr(-(o.spread ?? 1), o.spread ?? 1) : rr(0, TAU), v = (o.sp ?? 120) * rr(0.3, 1), life = (o.life ?? 1.1) * rr(0.7, 1.1);
    fx({ k: 'rock', x, y, z: o.z ?? 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (o.up ?? 180) * rr(0.4, 1), g: 620, life, max: life, size: (o.size ?? 4.5) * rr(0.6, 1.4), rot: rr(0, TAU), vr: rr(-8, 8), drag: 0.8, shade: rr(0.75, 1.1), seed: (Math.random() * 999) | 0 });
  }
}
function dust(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) { const a = o.a != null ? o.a + rr(-(o.spread ?? 1.2), o.spread ?? 1.2) : rr(0, TAU), v = (o.sp ?? 60) * rr(0.3, 1), life = (o.life ?? 1.0) * rr(0.6, 1.1);
    fx({ k: 'dust', x: x + rr(-5, 5), y: y + rr(-5, 5), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, life, max: life, size: (o.size ?? 13) * rr(0.7, 1.3), drag: 2, grow: 1.1 }); }
}
function sand(x, y, a, spread, n, sp = 360) {
  for (let i = 0; i < n; i++) { const aa = a + rr(-spread, spread), v = sp * rr(0.5, 1), life = rr(0.35, 0.6);
    fx({ k: 'sand', x, y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life, max: life, size: rr(1.2, 2.4), drag: 2.2, col: Math.random() < 0.5 ? '#d9bf86' : '#b8955a' }); }
}
function streaks(x, y, a, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const aa = a + rr(-(o.spread ?? 0.3), o.spread ?? 0.3), v = (o.sp ?? 380) * rr(0.6, 1), life = (o.life ?? 0.4) * rr(0.6, 1), off = rr(-(o.w ?? 10), o.w ?? 10);
    fx({ k: 'streak', x: x - Math.sin(aa) * off, y: y + Math.cos(aa) * off, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life, max: life, len: (o.len ?? 26) * rr(0.6, 1.3), curl: o.curl ?? rr(-0.6, 0.6), drag: 1.2, col: o.col || 'rgba(255,255,255,0.8)' });
  }
}
function swirl(x, y, r, n, o = {}) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), rad = r * rr(0.5, 1), life = (o.life ?? 0.6) * rr(0.6, 1);
    fx({ k: 'orbit', cx: x, cy: y, a, r: rad, va: (o.spin ?? 7) * (o.dir || 1), vr: o.vr ?? -rad * 0.8, life, max: life, len: rr(0.5, 1.1), col: o.col || 'rgba(255,255,255,0.85)', x, y }); }
}
function leaves(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) { const a = o.a != null ? o.a + rr(-(o.spread ?? 1), o.spread ?? 1) : rr(0, TAU), v = (o.sp ?? 140) * rr(0.4, 1), life = rr(0.8, 1.4);
    fx({ k: 'leaf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: rr(2.5, 4), rot: rr(0, TAU), vr: rr(-10, 10), drag: 1.6, col: o.col || (Math.random() < 0.5 ? '#f6f2e0' : '#cfe8b0') }); }
}
function sparks(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) { const a = o.a != null ? o.a + rr(-(o.spread ?? 3), o.spread ?? 3) : rr(0, TAU), v = (o.sp ?? 260) * rr(0.4, 1), life = (o.life ?? 0.5) * rr(0.6, 1);
    fx({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: rr(1.4, 2.6), col: o.col || '#ffe0a0', drag: 2, grav: o.grav || 0 }); }
}
function ring(x, y, r0, r1, col, life = 0.5, w = 4) { fx({ k: 'ring', x, y, r0, r1, col, life, max: life, w }); }
function slash(x, y, a, col, size = 26, life = 0.28) { fx({ k: 'slash', x, y, a, col, size, life, max: life }); }
function inkSplash(x, y, n = 8, sp = 120) { for (let i = 0; i < n; i++) { const a = rr(0, TAU), v = sp * rr(0.3, 1); fx({ k: 'ink', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(0.5, 0.9), max: 0.9, size: rr(2, 5), drag: 6 }); } }
function words(x, y, text, col, size = 15, life = 0.9) { TEXTS.push({ x, y, text, col, size, life, max: life }); }
function ghostOf(f, col) { GHOSTS.push({ x: f.x, y: f.y, face: f.face, gi: f.gi, col: col || wcol(moveWay(f)), life: 0.35, max: 0.35 }); }
// marks on the floor: scorch, wet, cracks, frost, swirls in the dust; they fade
function decal(kind, x, y, r, o = {}) {
  if (DECALS.length > 60) DECALS.shift();
  const life = o.life ?? 9;
  DECALS.push({ kind, x, y, r, life, max: life, a: o.a ?? rr(0, TAU), seed: (Math.random() * 9999) | 0, len: o.len || 0 });
}
// a hit, in the element of whoever struck
function hitFx(way, x, y, big, am = 1) {
  const n = big ? 1.6 : 1;
  if (way === 'fire') { flames(x, y, amt(8 * n, am), { sp: 90, rise: 30, size: 10 }); embers(x, y, amt(8 * n, am)); smoke(x, y, amt(2 * n, am)); }
  else if (way === 'water') { splash(x, y, amt(10 * n, am), { r: 22 }); }
  else if (way === 'earth') { rocks(x, y, amt(5 * n, am), { sp: 110, up: 140, size: 3.5 }); dust(x, y, amt(4 * n, am), { size: 10 }); }
  else if (way === 'air') { streaks(x, y, rr(0, TAU), amt(6 * n, am), { spread: 3.2, sp: 260, len: 18 }); leaves(x, y, amt(3 * n, am)); }
  else burst(x, y, '#e8e2f2', amt(8 * n, am), 150, 0.4, 6);
}

function stepFx(dt) {
  for (const p of FX) {
    p.life -= dt;
    if (p.k === 'orbit') { p.a += p.va * dt; p.r = Math.max(2, p.r + p.vr * dt); p.x = p.cx + Math.cos(p.a) * p.r; p.y = p.cy + Math.sin(p.a) * p.r; continue; }
    if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; } if (p.grav) p.vy += p.grav * dt; }
    if (p.z != null) {
      p.z += p.vz * dt; p.vz -= (p.g || 400) * dt;
      if (p.z < 0) {
        p.z = 0;
        if (p.k === 'drop') { p.life = 0; if (Math.random() < 0.3) ripple(p.x, p.y, 10); }
        else if (Math.abs(p.vz) > 60) { p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; } else { p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; }
      }
    }
    if (p.vr) p.rot += p.vr * dt;
    if (p.grow) p.size *= 1 + p.grow * dt;
  }
  FX = FX.filter(p => p.life > 0);
  for (const p of TEXTS) { p.life -= dt; p.y -= 34 * dt; }
  TEXTS = TEXTS.filter(p => p.life > 0);
  for (const g of GHOSTS) g.life -= dt;
  GHOSTS = GHOSTS.filter(g => g.life > 0);
  for (const d of DECALS) d.life -= dt;
  DECALS = DECALS.filter(d => d.life > 0);
}
const srand = s => { let x = s; return () => (x = (x * 16807 + 11) % 2147483647) / 2147483647; };
function drawDecals() {
  for (const d of DECALS) {
    const k = Math.min(1, d.life / (d.max * 0.4)), rnd = srand(d.seed);
    ctx.save(); ctx.globalAlpha = k;
    if (d.kind === 'scorch') { const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, 'rgba(20,10,8,0.55)'); g.addColorStop(0.6, 'rgba(40,18,10,0.3)'); g.addColorStop(1, 'rgba(40,18,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      if (d.life > d.max - 2.5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (d.life - (d.max - 2.5)) / 2.5 * 0.6; for (let i = 0; i < 6; i++) { const a = rnd() * TAU, r = rnd() * d.r * 0.7; ctx.drawImage(sprite('#ff6a2a'), d.x + Math.cos(a) * r - 4, d.y + Math.sin(a) * r - 4, 8, 8); } } }
    else if (d.kind === 'wet') { ctx.fillStyle = 'rgba(40,90,150,0.16)'; ctx.beginPath(); for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU, r = d.r * (0.75 + 0.3 * rnd()); ctx.lineTo(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r * 0.7); } ctx.fill(); }
    else if (d.kind === 'crack') { ctx.strokeStyle = 'rgba(46,32,20,0.42)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const n = 3 + ((rnd() * 3) | 0);
      for (let i = 0; i < n; i++) { let a = d.a + i * TAU / n + rnd() * 0.8, x = d.x + Math.cos(a) * 4, y = d.y + Math.sin(a) * 3; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x, y); const L = d.r * (0.6 + rnd() * 0.5);
        for (let s = 0; s < 5; s++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * L / 5; y += Math.sin(a) * L / 5 * 0.8; ctx.lineTo(x, y); ctx.lineWidth = 1.8 - s * 0.25;
          if (s === 2 && rnd() < 0.6) { const b = a + (rnd() < 0.5 ? 0.9 : -0.9); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * L * 0.25, y + Math.sin(b) * L * 0.2); ctx.moveTo(x, y); } } ctx.stroke(); } }
    else if (d.kind === 'line') { ctx.strokeStyle = 'rgba(40,28,18,0.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); let x = d.x, y = d.y; ctx.moveTo(x, y); const n = Math.max(4, d.len / 18 | 0); for (let s = 1; s <= n; s++) { x = d.x + Math.cos(d.a) * d.len * s / n + (rnd() - 0.5) * 12; y = d.y + Math.sin(d.a) * d.len * s / n + (rnd() - 0.5) * 12; ctx.lineTo(x, y); } ctx.stroke(); }
    else if (d.kind === 'frost') { ctx.strokeStyle = 'rgba(220,245,255,0.65)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = d.a + i * TAU / 6; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r * 0.7); ctx.stroke(); for (const t of [0.4, 0.7]) { const bx = d.x + Math.cos(a) * d.r * t, by = d.y + Math.sin(a) * d.r * t * 0.7; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a + 0.8) * 7, by + Math.sin(a + 0.8) * 5); ctx.lineTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.8) * 7, by + Math.sin(a - 0.8) * 5); ctx.stroke(); } } }
    else if (d.kind === 'swirl') { ctx.strokeStyle = 'rgba(80,70,50,0.28)'; ctx.lineWidth = 2; for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let i = 0; i <= 30; i++) { const u = i / 30, a = d.a + j * TAU / 3 + u * 3, r = d.r * u; ctx.lineTo(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r * 0.75); } ctx.stroke(); } }
    ctx.restore();
  }
}
// particles: under the fighters (ripples, ink, shadows), then over them (smoke, water, stone, wind, then light)
function drawFx(layer) {
  if (layer === 'under') {
    for (const g of GHOSTS) { ctx.save(); ctx.globalAlpha = 0.35 * g.life / g.max; ctx.translate(g.x, g.y); ctx.rotate(g.face); ctx.fillStyle = g.col; ctx.beginPath(); ctx.ellipse(0, 0, 12, 15, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const p of FX) {
      if (p.k === 'ink') { ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = C.sumi; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); }
      else if (p.k === 'ripple') { const k = p.life / p.max, r = p.r0 + (p.r1 - p.r0) * (1 - k); ctx.globalAlpha = k * 0.8; ctx.strokeStyle = p.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.65, 0, 0, TAU); ctx.stroke(); }
      else if (p.z > 3 && (p.k === 'rock' || p.k === 'ice' || p.k === 'drop')) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * 0.5, 0, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    return;
  }
  // normal-blended matter
  for (const p of FX) {
    const k = p.life / p.max;
    if (p.k === 'smoke') { ctx.globalAlpha = Math.min(1, k * 1.6) * 0.8; const s = p.size; ctx.drawImage(smokeSpr(), p.x - s, p.y - s, 2 * s, 2 * s); }
    else if (p.k === 'mist') { ctx.globalAlpha = Math.min(1, k * 2, (1 - k) * 4); const s = p.size; ctx.drawImage(mistSpr(), p.x - s, p.y - s, 2 * s, 2 * s); }
    else if (p.k === 'dust') { ctx.globalAlpha = Math.min(1, k * 1.5) * 0.9; const s = p.size; ctx.drawImage(dustSpr(), p.x - s, p.y - s, 2 * s, 2 * s); }
    else if (p.k === 'drop') { ctx.globalAlpha = 0.95; ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.ellipse(p.x, p.y - p.z, p.size * 0.8, p.size * 1.1, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - p.size * 0.25, p.y - p.z - p.size * 0.35, p.size * 0.3, 0, TAU); ctx.fill(); }
    else if (p.k === 'foam') { ctx.globalAlpha = k; ctx.fillStyle = '#f2fbff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * k), 0, TAU); ctx.fill(); }
    else if (p.k === 'ice') { ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot); ctx.fillStyle = '#e4f7ff'; ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -p.size * 1.6); ctx.lineTo(p.size * 0.6, 0); ctx.lineTo(0, p.size * 1.6); ctx.lineTo(-p.size * 0.6, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    else if (p.k === 'rock') { ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot); rockPath(p.size, p.seed); ctx.fillStyle = shadeHex('#8a7356', p.shade); ctx.fill(); ctx.strokeStyle = 'rgba(30,22,14,0.6)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
    else if (p.k === 'sand') { ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    else if (p.k === 'leaf') { ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (p.k === 'streak') { const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp, a0 = Math.min(1, k * 2.2) * 0.85; ctx.lineCap = 'round';
      for (const [dx, dy, col, w, al] of [[1.2, 1.8, 'rgba(70,64,96,1)', 2.4, 0.22], [0, 0, p.col, 1.6, 1]]) { ctx.globalAlpha = a0 * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p.x + dx, p.y + dy); ctx.quadraticCurveTo(p.x + dx - ux * p.len * 0.5 - uy * p.curl * 10, p.y + dy - uy * p.len * 0.5 + ux * p.curl * 10, p.x + dx - ux * p.len, p.y + dy - uy * p.len); ctx.stroke(); } }
    else if (p.k === 'orbit') { const a0 = Math.min(1, k * 2) * 0.85; ctx.lineCap = 'round';
      for (const [dy, col, w, al] of [[2, 'rgba(70,64,96,1)', 2.4, 0.22], [0, p.col, 1.6, 1]]) { ctx.globalAlpha = a0 * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p.cx, p.cy + dy, p.r, p.a - p.len * Math.sign(p.va), p.a, p.va < 0); ctx.stroke(); } }
  }
  ctx.globalAlpha = 1;
  // light
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of FX) {
    const k = p.life / p.max;
    if (p.k === 'glow') { const s = p.size * (0.5 + 0.5 * k); ctx.globalAlpha = Math.min(1, k * 1.4); ctx.drawImage(sprite(p.col), p.x - s, p.y - s, 2 * s, 2 * s); }
    else if (p.k === 'flame') { const s = p.size * (0.35 + 0.65 * k); ctx.globalAlpha = Math.min(1, k * 2.2); ctx.drawImage(sprite(flameCol(k)), p.x - s, p.y - s * 1.25, 2 * s, 2.5 * s); }
    else if (p.k === 'spark') { const sp = Math.hypot(p.vx, p.vy), L = Math.min(14, sp * 0.03) + 1; ctx.globalAlpha = Math.min(1, k * 2) * (0.6 + 0.4 * Math.sin(p.life * 40)); ctx.strokeStyle = p.col; ctx.lineWidth = p.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / (sp || 1) * L, p.y - p.vy / (sp || 1) * L); ctx.stroke(); }
    else if (p.k === 'ring') { const e = 1 - k, r = p.r0 + (p.r1 - p.r0) * (1 - (1 - e) * (1 - e)); ctx.globalAlpha = k; ctx.strokeStyle = p.col; ctx.lineWidth = p.w * k + 1; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, r), 0, TAU); ctx.stroke(); }
    else if (p.k === 'slash') {
      const e = 1 - k, sweep = 2.2 * Math.min(1, e * 3);
      ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.col; ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const u = i / 12, a = p.a - 1.1 + sweep * u, w = Math.sin(u * Math.PI) * p.size * 0.28; ctx.lineTo(p.x + Math.cos(a) * (p.size + w), p.y + Math.sin(a) * (p.size + w)); }
      for (let i = 12; i >= 0; i--) { const u = i / 12, a = p.a - 1.1 + sweep * u; ctx.lineTo(p.x + Math.cos(a) * p.size, p.y + Math.sin(a) * p.size); }
      ctx.fill();
    }
  }
  ctx.restore();
}
function drawTexts() {
  ctx.textAlign = 'center';
  for (const p of TEXTS) {
    const k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 2.5); ctx.font = `bold ${p.size}px ${BODY}`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,16,0.85)'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}
// a lumpy stone outline, the same every time for the same seed
function rockPath(r, seed = 1) { const rnd = srand(seed + 3); ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, rr2 = r * (0.75 + 0.35 * rnd()); ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.closePath(); }
// a colour washed part of the way to another
function mixHex(a, b, k) { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), m = (x, y) => Math.round(x + (y - x) * k); return `rgb(${m(p >> 16, q >> 16)},${m((p >> 8) & 255, (q >> 8) & 255)},${m(p & 255, q & 255)})`; }
function shadeHex(hex, k) { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

// ── the extra show when a spell is written well: the glyph lit in the air, dissolving into its element ──
// fl 0: written roughly, it sputters. fl 1: clean, the glyph flares and an aura bursts. fl 2: near perfect, a golden seal too.
let SHOWS = [];
// (a player's power runs from 0.4 to about 2, a fighter's from 0.6 to 1: the gold flourish is for a perfect glyph, or a master's)
const flourishLevel = (P, f) => (P >= 1.8 || (f && !f.isPlayer && P >= 0.95) ? 2 : P >= 0.82 ? 1 : 0);
function flourish(f, m, P, a) {
  const way = m.way, fl = flourishLevel(P, f), E = ELC[way], x = f.x, y = f.y;
  if (fl === 0) { smoke(x + Math.cos(a) * 14, y + Math.sin(a) * 14 - 6, P < 0.6 ? 3 : 1, { size: 9, life: 0.6 }); if (P < 0.6) words(x, y - 44, 'sputters', '#a99fbc', 11, 0.7); return; }
  SHOWS.push({ m, x, y: y - 48, life: 0.75, max: 0.75, fl, way });
  if (way === 'fire') { flames(x, y + 6, amt(10 * fl), { sp: 70, rise: 60, size: 8, jit: 14 }); embers(x, y, amt(10 * fl), { sp: 90, rise: 50 }); }
  else if (way === 'water') { ripple(x, y + 4, 36); ripple(x, y + 4, 52); drops(x, y, amt(10 * fl), { sp: 70, up: 200, size: 2.2 }); }
  else if (way === 'earth') { dust(x, y + 8, amt(5 * fl), { sp: 70 }); rocks(x, y + 6, amt(5 * fl), { sp: 50, up: 230, size: 3 }); }
  else { swirl(x, y, 34, amt(8 * fl), { spin: 8, vr: 10 }); leaves(x, y, amt(5 * fl), { sp: 90 }); }
  if (fl === 2) {
    ring(x, y, 14, 64, C.gold, 0.6, 4); burst(x, y, '#ffe9a8', 14, 160, 0.6, 6); slowmo = Math.max(slowmo, 0.12); cam.shake = Math.max(cam.shake, 3);
    decal(way === 'fire' ? 'scorch' : way === 'water' ? 'wet' : way === 'earth' ? 'crack' : 'swirl', x, y + 4, 40, { life: 7 });
  }
}
function stepShows(dt) { for (const s of SHOWS) s.life -= dt; SHOWS = SHOWS.filter(s => s.life > 0); }
function drawShows() {
  for (const s of SHOWS) {
    const k = s.life / s.max, R = 20 + (1 - k) * 10, col = s.fl === 2 ? C.gold : ELC[s.way].light;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, k * 1.8) * (s.fl === 2 ? 1 : 0.8);
    ctx.strokeStyle = col; ctx.lineWidth = 2.6 * k + 0.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const st of s.m.strokes) { ctx.beginPath(); st.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, s.x + p.x * R, s.y + p.y * R - (1 - k) * 10)); ctx.stroke(); }
    ctx.restore();
    // as it fades, the glyph's ink turns to its element
    if (Math.random() < 0.6 && fxRoom()) { const st = s.m.strokes[0], p = st[(Math.random() * st.length) | 0], px = s.x + p.x * R, py = s.y + p.y * R;
      if (s.way === 'fire') flames(px, py, 1, { sp: 20, rise: 50, size: 5 }); else if (s.way === 'water') drops(px, py, 1, { sp: 30, up: 40, z: 40, size: 2 }); else if (s.way === 'earth') dust(px, py, 1, { size: 6, sp: 20 }); else streaks(px, py, rr(0, TAU), 1, { sp: 120, len: 12 }); }
  }
}

// ── the bodies of spells ──
function stepBeams(dt) { for (const b of BEAMS) b.life -= dt; BEAMS = BEAMS.filter(b => b.life > 0); }
// on the floor: telegraphs, puddles, ice, whirlpools, lava, sand, fire walls and trails, the flood
function drawZones(t) {
  for (const z of ZONES) {
    const fadeIn = Math.min(1, (z.max - z.life) / 0.25 + 0.15), fadeOut = Math.min(1, z.life / 0.5), k = fadeIn * fadeOut, r = z.r * (z.grow != null ? 0.3 + 0.7 * ease(z.grow) : 1);
    ctx.save();
    switch (z.kind) {
      case 'mark': {
        const col = ELC[z.way] ? ELC[z.way].main : '#fff', prog = 1 - z.life / z.max;
        ctx.globalAlpha = 0.14 + 0.1 * Math.sin(t * 20); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.8, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.8; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.8, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * prog, z.r * 0.8 * prog, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'puddle': case 'trail': {
        if (z.kind === 'trail' && z.way === 'fire') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * k; ctx.drawImage(sprite('#ff6a2a'), z.x - 14, z.y - 10, 28, 20); break; }
        const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, r); g.addColorStop(0, 'rgba(30,110,190,0.5)'); g.addColorStop(0.75, 'rgba(70,160,235,0.42)'); g.addColorStop(1, 'rgba(120,200,255,0.0)');
        ctx.globalAlpha = k; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, r, r * 0.72, 0, 0, TAU); ctx.fill();
        if (z.kind === 'puddle') { ctx.strokeStyle = 'rgba(220,245,255,0.55)'; ctx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const a = t * 0.8 + i * 2.6; ctx.beginPath(); ctx.ellipse(z.x, z.y, r * 0.6, r * 0.42, 0, a, a + 0.9); ctx.stroke(); } }
        break;
      }
      case 'ice': {
        ctx.globalAlpha = 0.75 * k; const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r); g.addColorStop(0, 'rgba(235,250,255,0.75)'); g.addColorStop(1, 'rgba(170,225,255,0.35)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.72, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4; ctx.beginPath(); ctx.moveTo(z.x + Math.cos(a) * z.r * 0.2, z.y + Math.sin(a) * z.r * 0.15); ctx.lineTo(z.x + Math.cos(a) * z.r * 0.85, z.y + Math.sin(a) * z.r * 0.6); ctx.stroke(); }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6 + z.x); ctx.drawImage(sprite('#cfefff'), z.x + z.r * 0.3 - 5, z.y - z.r * 0.2 - 5, 10, 10);
        break;
      }
      case 'whirlpool': {
        ctx.globalAlpha = 0.85 * k; const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, r); g.addColorStop(0, 'rgba(8,40,80,0.85)'); g.addColorStop(0.6, 'rgba(30,110,190,0.6)'); g.addColorStop(1, 'rgba(90,180,250,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, r, r * 0.75, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(230,248,255,0.8)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let j = 0; j <= 24; j++) { const u = j / 24, a = t * 4 + i * TAU / 4 + u * 3.4, rr2 = r * (1 - u * 0.85); ctx.lineTo(z.x + Math.cos(a) * rr2, z.y + Math.sin(a) * rr2 * 0.75); } ctx.stroke(); }
        break;
      }
      case 'lava': {
        ctx.globalAlpha = k; const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r); g.addColorStop(0, '#ffd27a'); g.addColorStop(0.45, '#ff7a2a'); g.addColorStop(0.85, '#a8260f'); g.addColorStop(1, 'rgba(60,20,10,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.fill();
        const rnd = srand(z.seed || 3); ctx.fillStyle = 'rgba(40,14,8,0.55)';
        for (let i = 0; i < 6; i++) { const a = rnd() * TAU + t * 0.15, d = rnd() * z.r * 0.7, s = 5 + rnd() * 9; ctx.beginPath(); ctx.ellipse(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d * 0.75, s, s * 0.6, a, 0, TAU); ctx.fill(); }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * k * (0.8 + 0.2 * Math.sin(t * 7)); ctx.drawImage(sprite('#ff6a2a'), z.x - z.r * 1.2, z.y - z.r, z.r * 2.4, z.r * 2);
        break;
      }
      case 'firewall': {
        const ux = Math.cos(z.a), uy = Math.sin(z.a);
        ctx.globalAlpha = 0.7 * k; ctx.strokeStyle = 'rgba(40,14,8,0.8)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(z.x - ux * z.len / 2, z.y - uy * z.len / 2); ctx.lineTo(z.x + ux * z.len / 2, z.y + uy * z.len / 2); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 6; ctx.globalAlpha = 0.8 * k; ctx.stroke();
        break;
      }
      case 'quicksand': {
        ctx.globalAlpha = 0.8 * k; const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r); g.addColorStop(0, '#6b5230'); g.addColorStop(0.7, '#b8955a'); g.addColorStop(1, 'rgba(200,170,110,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(90,66,36,0.6)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let j = 0; j <= 24; j++) { const u = j / 24, a = t * 1.2 + i * TAU / 3 + u * 3, rr2 = z.r * (1 - u * 0.9); ctx.lineTo(z.x + Math.cos(a) * rr2, z.y + Math.sin(a) * rr2 * 0.75); } ctx.stroke(); }
        break;
      }
      case 'flood': {
        const e = Math.min(1, (z.max - z.life) / 0.6), out = Math.min(1, z.life / 0.8);
        ctx.globalAlpha = 0.3 * e * out; ctx.fillStyle = '#2e88d8'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.5 * e * out; ctx.strokeStyle = 'rgba(220,245,255,0.7)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const rr2 = ((t * 60 + i * 60) % z.r); ctx.beginPath(); ctx.arc(z.x, z.y, rr2, 0, TAU); ctx.stroke(); }
        break;
      }
    }
    ctx.restore();
  }
}
// waves rolling over the floor
function drawWaves(t) {
  for (const w of WAVES) {
    const k = Math.min(1, (w.max - w.travel) / 120, w.travel / 40 + 0.2);
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a); ctx.globalAlpha = k;
    const W2 = w.width / 2;
    if (w.kind === 'tidal') {
      // a body of water with a white crest on its leading edge
      const g = ctx.createLinearGradient(-50, 0, 14, 0); g.addColorStop(0, 'rgba(30,110,190,0)'); g.addColorStop(0.6, 'rgba(50,140,220,0.55)'); g.addColorStop(1, 'rgba(120,200,255,0.85)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-50, -W2); for (let i = 0; i <= 16; i++) { const u = i / 16 - 0.5; ctx.lineTo(10 + Math.cos(u * Math.PI) * 8 + Math.sin(t * 12 + i) * 2, u * w.width); } ctx.lineTo(-50, W2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f2fbff'; ctx.lineWidth = w.big ? 7 : 5; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 16; i++) { const u = i / 16 - 0.5; ctx.lineTo(12 + Math.cos(u * Math.PI) * 8 + Math.sin(t * 12 + i) * 2, u * w.width); } ctx.stroke();
    } else if (w.kind === 'gale') {
      ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const u = i / 8 - 0.5, y = u * w.width, x = Math.cos(u * Math.PI) * 14 + Math.sin(t * 14 + i * 1.7) * 6, al = k * (0.5 + 0.4 * ((i * 7) % 3) / 2);
        ctx.lineWidth = 3 + (i % 3); ctx.strokeStyle = '#46405e'; ctx.globalAlpha = al * 0.25; ctx.beginPath(); ctx.moveTo(x - 46, y + 2); ctx.quadraticCurveTo(x - 18, y - 4, x, y + 2); ctx.stroke();
        ctx.lineWidth = 2 + (i % 3); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(x - 46, y); ctx.quadraticCurveTo(x - 18, y - 6, x, y); ctx.stroke(); }
    }
    ctx.restore();
  }
}
// stones on the floor: rocks, walls, pillars, rising as they're raised
function drawStones() {
  for (const s of STONES) {
    const h = (s.kind === 'pillar' ? 26 : s.kind === 'wall' ? 22 : 12) * ease(s.born), dmg = 1 - s.hp / s.maxHp, fade = Math.min(1, s.life / 0.6);
    ctx.save(); ctx.globalAlpha = fade;
    if (s.kind === 'wall') {
      ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-s.len / 2 + 3, -8, s.len, 18);
      ctx.fillStyle = '#6e5a40'; ctx.fillRect(-s.len / 2, -9 - h + 9, s.len, h);
      ctx.fillStyle = '#a58a62'; ctx.fillRect(-s.len / 2, -9 - h, s.len, 12);
      ctx.strokeStyle = 'rgba(40,28,18,0.6)'; ctx.lineWidth = 1; for (let x = -s.len / 2 + 14; x < s.len / 2; x += 18) { ctx.beginPath(); ctx.moveTo(x, -9 - h + 12); ctx.lineTo(x, 0); ctx.stroke(); }
      ctx.strokeRect(-s.len / 2, -9 - h, s.len, h + 9);
      if (dmg > 0.3) { ctx.strokeStyle = 'rgba(30,20,12,0.8)'; ctx.beginPath(); ctx.moveTo(-8, -9 - h); ctx.lineTo(2, -h * 0.5); ctx.lineTo(-4, 0); ctx.stroke(); }
    } else if (s.kind === 'pillar') {
      ctx.translate(s.x, s.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 4, s.r, s.r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6e5a40'; ctx.fillRect(-s.r, -h, s.r * 2, h); ctx.beginPath(); ctx.ellipse(0, 0, s.r, s.r * 0.55, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#b39670'; ctx.beginPath(); ctx.ellipse(0, -h, s.r, s.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(40,28,18,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.translate(s.x, s.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 3, s.r, s.r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(0, -h * 0.4); rockPath(s.r, s.seed); ctx.fillStyle = '#7d6748'; ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(0, -h); ctx.scale(0.86, 0.8); rockPath(s.r, s.seed); ctx.fillStyle = '#a99070'; ctx.fill(); ctx.strokeStyle = 'rgba(40,28,18,0.55)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      if (dmg > 0.3) { ctx.strokeStyle = 'rgba(30,20,12,0.8)'; ctx.beginPath(); ctx.moveTo(-s.r * 0.4, -h - s.r * 0.3); ctx.lineTo(0, -h); ctx.lineTo(s.r * 0.2, -h + s.r * 0.4); ctx.stroke(); }
    }
    ctx.restore();
  }
}
// things that stand up or fly: clouds, dragons, columns of water and wind, tornadoes, meteors, falling rock
function drawEnts(t, layer) {
  for (const e of ENTS) {
    const k = Math.min(1, e.life / 0.25, (e.max - e.life) / 0.12 + 0.2);
    ctx.save();
    if (layer === 'floor') {
      if (e.kind === 'quake') { ctx.globalAlpha = 0.7 * Math.min(1, e.life * 4); ctx.strokeStyle = '#5e4628'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r, e.r * 0.8, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(230,207,156,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      else if (e.kind === 'hands') { ctx.globalAlpha = k; ctx.fillStyle = '#7d6748'; ctx.strokeStyle = 'rgba(40,28,18,0.7)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3, x = e.x + Math.cos(a) * 15, y = e.y + Math.sin(a) * 11 + 4; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x - Math.cos(a) * 4, y - 14, x - Math.cos(a) * 7, y - 16); ctx.lineTo(x + 3, y); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
      else if (e.kind === 'meteor' || e.kind === 'mountain' || e.kind === 'fall') { const p = 1 - e.life / e.max, s = (e.kind === 'mountain' ? 110 : e.kind === 'fall' ? e.size : 34) * (0.3 + 0.7 * p); ctx.globalAlpha = 0.35 * p + 0.1; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x, e.y, s, s * 0.6, 0, 0, TAU); ctx.fill(); }
      else if (e.kind === 'press') { const p = 1 - e.life / e.max; ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { const r = (60 - i * 16) * (1 - p * 0.6) * (e.sz || 1); ctx.beginPath(); ctx.ellipse(e.x, e.y, r, r * 0.7, 0, 0, TAU); ctx.stroke(); } }
      ctx.restore(); continue;
    }
    switch (e.kind) {
      case 'cloud': {
        const y = e.y - 62, sc = e.dark ? 1.5 : 1;
        ctx.globalAlpha = 0.18 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 4, 26 * sc, 10 * sc, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.92 * k; for (const [dx, dy, r] of [[-14, 2, 13], [0, -6, 17], [15, 1, 12], [5, 5, 12], [-6, 6, 11]]) { const g = ctx.createRadialGradient(e.x + dx * sc - 4, y + dy * sc - 5, 2, e.x + dx * sc, y + dy * sc, r * sc); g.addColorStop(0, e.dark ? '#c6ccd8' : '#ffffff'); g.addColorStop(1, e.dark ? '#7d8698' : '#c9d6e6'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x + dx * sc, y + dy * sc, r * sc, 0, TAU); ctx.fill(); }
        break;
      }
      case 'dragon': {
        const S = e.segs, sz = e.sz || 1;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = k;
        for (let i = S.length - 1; i > 0; i--) { const u = i / S.length, w = (4 + 10 * (1 - u)) * sz; ctx.strokeStyle = `rgba(${40 + 80 * (1 - u)},${130 + 70 * (1 - u)},${220 + 30 * (1 - u)},0.9)`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(S[i].x, S[i].y - 10); ctx.lineTo(S[i - 1].x, S[i - 1].y - 10); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(240,250,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); S.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x, p.y - 13)); ctx.stroke();
        ctx.translate(e.x, e.y - 10); ctx.rotate(e.a); ctx.fillStyle = '#5cc0ff'; ctx.beginPath(); ctx.ellipse(4, 0, 13 * sz, 9 * sz, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a7fc8'; ctx.beginPath(); ctx.moveTo(14 * sz, -4 * sz); ctx.lineTo(22 * sz, 0); ctx.lineTo(14 * sz, 4 * sz); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8 * sz, -5 * sz, 2.4, 0, TAU); ctx.arc(8 * sz, 5 * sz, 2.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -8 * sz); ctx.quadraticCurveTo(-10, -18 * sz, -16, -14 * sz); ctx.moveTo(0, 8 * sz); ctx.quadraticCurveTo(-10, 18 * sz, -16, 14 * sz); ctx.stroke();
        break;
      }
      case 'geyser': {
        const p = 1 - e.life / e.max, hgt = (e.r * 2.4) * Math.sin(Math.min(1, p * 2.2) * Math.PI * 0.5) * (1 - Math.max(0, p - 0.7) / 0.3), w = e.r * 0.55;
        const g = ctx.createLinearGradient(0, e.y - hgt, 0, e.y); g.addColorStop(0, 'rgba(230,248,255,0.95)'); g.addColorStop(1, 'rgba(60,150,230,0.85)');
        ctx.globalAlpha = k; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(e.x - w, e.y); ctx.quadraticCurveTo(e.x - w * 0.7, e.y - hgt * 0.6, e.x - w * 0.5, e.y - hgt); ctx.lineTo(e.x + w * 0.5, e.y - hgt); ctx.quadraticCurveTo(e.x + w * 0.7, e.y - hgt * 0.6, e.x + w, e.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(e.x + i * w * 0.4, e.y - 4); ctx.lineTo(e.x + i * w * 0.3 + Math.sin(t * 20 + i) * 3, e.y - hgt + 6); ctx.stroke(); }
        ctx.fillStyle = '#f2fbff'; for (let i = 0; i < 5; i++) { const a = t * 6 + i * 1.3; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * w * 0.8, e.y - hgt + Math.sin(a) * 4, 4, 0, TAU); ctx.fill(); }
        break;
      }
      case 'column': {
        const p = 1 - e.life / e.max, hgt = 110 * (e.sz || 1);
        ctx.globalAlpha = k * 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let j = 0; j <= 20; j++) { const u = j / 20, a = t * 9 + i * TAU / 4 + u * 6, r = 18 + 10 * u; ctx.lineTo(e.x + Math.cos(a) * r, e.y - u * hgt * Math.min(1, p * 3) + Math.sin(a) * r * 0.35); } ctx.stroke(); }
        break;
      }
      case 'tornado': {
        const hgt = 100, rb = 10, rt = e.r * 1.2;
        ctx.globalAlpha = 0.18 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, rt * 0.7, rt * 0.3, 0, 0, TAU); ctx.fill();
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) { const u = i / 8, r = rb + (rt - rb) * u, y = e.y - u * hgt, off = Math.sin(t * 5 + u * 4) * 8 * u;
          ctx.globalAlpha = k * 0.25; ctx.strokeStyle = '#46405e'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(e.x + off + 1.5, y + 2, r, r * 0.32, 0, e.spin + i, e.spin + i + 4.4); ctx.stroke();
          ctx.globalAlpha = k * (0.45 + 0.4 * u); ctx.strokeStyle = i % 2 ? '#e8e2d8' : '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(e.x + off, y, r, r * 0.32, 0, e.spin + i, e.spin + i + 4.4); ctx.stroke(); }
        break;
      }
      case 'typhoon': {
        const p = 1 - e.life / e.max, R = e.r * Math.min(1, p * 4);
        ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#2b2a3a'; ctx.beginPath(); ctx.ellipse(e.x, e.y, R * 1.2, R * 0.9, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.8 * k; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) { ctx.lineWidth = 3; ctx.beginPath(); for (let j = 0; j <= 30; j++) { const u = j / 30, a = t * 5 + i * TAU / 5 + u * 4.2, r = R * (0.15 + 0.85 * u); ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.75 - 20 * (1 - u)); } ctx.stroke(); }
        if (Math.random() < 0.05) { ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 2; ctx.beginPath(); let x = e.x + rr(-R, R) * 0.6, y = e.y - 120; ctx.moveTo(x, y); for (let s = 0; s < 5; s++) { x += rr(-14, 14); y += 24; ctx.lineTo(x, y); } ctx.stroke(); }
        break;
      }
      case 'firework': { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.drawImage(sprite('#ffd27a'), e.x - 9, e.y - e.z - 9, 18, 18); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 6, 3, 0, 0, TAU); ctx.fill(); break; }
      case 'meteor': {
        const p = 1 - e.life / e.max, sx = e.x + e.from * 240 * (1 - p), sy = e.y - 460 * (1 - p) * (1 - p) - 20 * (1 - p), s = 16 * (e.sz || 1);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 8; i++) { const q = i / 8, x = sx + e.from * 40 * q * 2, y = sy - 70 * q; ctx.globalAlpha = 0.5 * (1 - q); ctx.drawImage(sprite(q < 0.4 ? '#ffd27a' : '#ff6a2a'), x - s * (1.4 - q * 0.6), y - s * (1.4 - q * 0.6), s * 2 * (1.4 - q * 0.6), s * 2 * (1.4 - q * 0.6)); }
        ctx.globalAlpha = 1; ctx.drawImage(sprite('#ffd27a'), sx - s * 1.6, sy - s * 1.6, s * 3.2, s * 3.2);
        ctx.globalCompositeOperation = 'source-over'; ctx.translate(sx, sy); ctx.rotate(t * 4); rockPath(s * 0.8, 17); ctx.fillStyle = '#5a2a14'; ctx.fill();
        break;
      }
      case 'mountain': {
        const p = 1 - e.life / e.max, y = e.y - 520 * (1 - p) * (1 - p), s = 70;
        ctx.globalAlpha = Math.min(1, p * 3); ctx.translate(e.x, y - 30); rockPath(s, 33); ctx.fillStyle = '#7d6748'; ctx.fill(); ctx.strokeStyle = 'rgba(40,28,18,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.scale(0.7, 0.55); ctx.translate(-8, -22); rockPath(s, 34); ctx.fillStyle = '#a99070'; ctx.fill();
        break;
      }
      case 'fall': { const p = 1 - e.life / e.max, y = e.y - 220 * (1 - p) * (1 - p); ctx.translate(e.x, y); ctx.rotate(t * 5); rockPath(e.size, e.seed); ctx.fillStyle = '#8a7356'; ctx.fill(); ctx.strokeStyle = 'rgba(40,28,18,0.7)'; ctx.lineWidth = 1; ctx.stroke(); break; }
      case 'spike': {
        const p = 1 - e.life / e.max, hgt = 54 * (e.sz || 1) * Math.min(1, p * 4) * (p > 0.7 ? (1 - (p - 0.7) / 0.3) : 1), w = 15 * (e.sz || 1);
        ctx.fillStyle = '#8a7356'; ctx.beginPath(); ctx.moveTo(e.x - w, e.y); ctx.lineTo(e.x - 2, e.y - hgt); ctx.lineTo(e.x + w, e.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b39670'; ctx.beginPath(); ctx.moveTo(e.x - 2, e.y - hgt); ctx.lineTo(e.x + w, e.y); ctx.lineTo(e.x + w * 0.3, e.y); ctx.closePath(); ctx.fill();
        break;
      }
      case 'double': {
        // a copy of them made of water: their colours washed blue, a sheen, drips
        const o = e.owner, w = '#5cb8ff', bob = Math.sin(t * 3 + e.x) * 1.2;
        const fake = { x: e.x, y: e.y + bob, face: e.face, hp: 1, pose: 'guard', poseT: 1, walk: 0, lift: 0, st: e.st, spinT: 0, isPlayer: o.isPlayer, way: o.way,
          gi: mixHex(e.gi, w, 0.35), trim: mixHex(e.trim, w, 0.4), belt: mixHex(e.belt, w, 0.3), skin: mixHex(e.skin, w, 0.3), hair: mixHex(e.hair, w, 0.3) };
        ctx.globalAlpha = 0.82 * k; drawFighter(fake, t);
        ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.ellipse(e.x - 3, e.y - 4 + bob, 7, 10, -0.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.8 * k; ctx.fillStyle = 'rgba(150,215,255,0.9)'; for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i / 3) % 1; ctx.beginPath(); ctx.ellipse(e.x - 8 + i * 8, e.y - 2 + ph * 14, 1.6, 2.4, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'charge': {
        // a burning charge: in flight, or stuck on them and blinking faster as it's about to go
        const z = e.stuck ? 20 : (e.z || 0) + 8, left = e.life / e.max, blink = e.stuck || e.loose ? (Math.sin((e.max - e.life) * (12 + 40 * (1 - left))) > 0 ? 1 : 0.5) : 1;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = blink; ctx.drawImage(sprite('#ff6a2a'), e.x - 13, e.y - z - 13, 26, 26);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#3a1a10'; ctx.beginPath(); ctx.arc(e.x, e.y - z, 5.5, 0, TAU); ctx.fill();
        ctx.fillStyle = blink > 0.9 ? '#ffe08a' : '#ff8a3a'; ctx.beginPath(); ctx.arc(e.x, e.y - z, 2.6, 0, TAU); ctx.fill();
        break;
      }
      case 'boulder': { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x + 3, e.y + 4, e.r, e.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.translate(e.x, e.y - e.r * 0.6); ctx.rotate(e.rot); rockPath(e.r, e.seed); ctx.fillStyle = '#8a7356'; ctx.fill(); ctx.strokeStyle = 'rgba(40,28,18,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.strokeStyle = 'rgba(40,28,18,0.4)'; ctx.beginPath(); ctx.moveTo(-e.r * 0.5, 0); ctx.lineTo(e.r * 0.5, 0); ctx.stroke(); break; }
    }
    ctx.restore();
  }
}
// spells in flight
function drawShots(t) {
  for (const s of SHOTS) {
    const a = Math.atan2(s.vy || 0, s.vx || 1);
    ctx.save();
    if (s.kind === 'glob') { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 7, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#5cc0ff'; ctx.beginPath(); ctx.arc(s.x, s.y - s.z, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.arc(s.x - 3, s.y - s.z - 3, 2.5, 0, TAU); ctx.fill(); ctx.restore(); continue; }
    if (s.kind === 'fireball' || s.kind === 'ember') {
      ctx.globalCompositeOperation = 'lighter';
      s.trail.forEach((p, i) => { const q = 1 - i / s.trail.length, sz = s.r * 1.8 * q; ctx.globalAlpha = 0.45 * q; ctx.drawImage(sprite(i < 3 ? '#ffb04a' : '#ff5a2a'), p.x - sz, p.y - sz, sz * 2, sz * 2); });
      ctx.globalAlpha = 1; const sz = s.r * (s.kind === 'ember' ? 2 : 2.6); ctx.drawImage(sprite('#ffd27a'), s.x - sz, s.y - sz, sz * 2, sz * 2);
      ctx.restore(); continue;
    }
    // trails of the rest
    if (s.kind === 'drop' || s.kind === 'ice' || s.kind === 'blade' || s.kind === 'crystal') { const col = s.kind === 'drop' ? 'rgba(150,215,255,' : s.kind === 'ice' ? 'rgba(220,245,255,' : s.kind === 'crystal' ? 'rgba(220,200,255,' : 'rgba(255,255,255,'; s.trail.forEach((p, i) => { const q = 1 - i / s.trail.length; ctx.fillStyle = col + (0.35 * q) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, s.r * 0.7 * q, 0, TAU); ctx.fill(); }); }
    if (s.kind === 'rock' || s.kind === 'boulder') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(s.x + 2, s.y + 10, s.r, s.r * 0.5, 0, 0, TAU); ctx.fill(); ctx.translate(s.x, s.y - 4); ctx.rotate(s.spin); rockPath(s.r, s.seed); ctx.fillStyle = '#8a7356'; ctx.fill(); ctx.strokeStyle = 'rgba(40,28,18,0.7)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); continue; }
    ctx.translate(s.x, s.y); ctx.rotate(a);
    if (s.kind === 'drop') { ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.moveTo(s.r * 1.3, 0); ctx.quadraticCurveTo(-s.r * 0.2, s.r * 1.1, -s.r, 0); ctx.quadraticCurveTo(-s.r * 0.2, -s.r * 1.1, s.r * 1.3, 0); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-s.r * 0.2, -s.r * 0.35, s.r * 0.3, 0, TAU); ctx.fill(); }
    else if (s.kind === 'ice') { ctx.fillStyle = '#e8f9ff'; ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s.r * 1.8, 0); ctx.lineTo(0, s.r * 0.55); ctx.lineTo(-s.r * 1.3, 0); ctx.lineTo(0, -s.r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (s.kind === 'crystal') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(sprite('#c8a8ff'), -s.r * 3, -s.r * 1.5, s.r * 6, s.r * 3); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.95; ctx.fillStyle = '#efe6ff'; ctx.strokeStyle = '#9a7ad8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s.r * 3, 0); ctx.lineTo(s.r * 1.6, s.r * 0.6); ctx.lineTo(-s.r * 2.2, s.r * 0.6); ctx.lineTo(-s.r * 3, 0); ctx.lineTo(-s.r * 2.2, -s.r * 0.6); ctx.lineTo(s.r * 1.6, -s.r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (s.kind === 'blade') { ctx.rotate(Math.sin(s.spin) * 0.25); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(sprite('#fbf6d8'), -s.r * 2, -s.r * 2, s.r * 4, s.r * 4); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.95; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(70,64,96,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-s.r * 0.6, 0, s.r * 1.5, -1.25, 1.25); ctx.arc(-s.r * 1.4, 0, s.r * 1.35, 1.05, -1.05, true); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
}
// whips, currents and jets: drawn for a moment between two points
function drawBeams(t) {
  for (const b of BEAMS) {
    const k = b.life / b.max, mx = (b.x1 + b.x2) / 2, my = (b.y1 + b.y2) / 2, dx = b.x2 - b.x1, dy = b.y2 - b.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const cx = mx + nx * (b.bend || 0) * L * 0.3, cy = my + ny * (b.bend || 0) * L * 0.3;
    ctx.save(); ctx.lineCap = 'round';
    if (b.kind === 'lash' || b.kind === 'current') {
      const reach = b.kind === 'lash' ? Math.min(1, (1 - k) * 4) : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.strokeStyle = '#2a8ae0'; ctx.lineWidth = b.w * 1.8; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.quadraticCurveTo(cx, cy, lerp(b.x1, b.x2, reach), lerp(b.y1, b.y2, reach)); ctx.stroke();
      ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = b.w * 0.7; ctx.stroke();
      if (b.kind === 'current') { ctx.setLineDash([10, 14]); ctx.lineDashOffset = t * 120; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
    } else if (b.kind === 'firewhip') {
      const reach = Math.min(1, (1 - k) * 4);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = b.w * 2.2; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.quadraticCurveTo(cx, cy, lerp(b.x1, b.x2, reach), lerp(b.y1, b.y2, reach)); ctx.stroke();
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = b.w * 0.8; ctx.stroke();
    }
    ctx.restore();
  }
}
