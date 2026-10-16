// ── the pad: rice paper, a brush, and the reader ──
// strokes are kept in pad units (the pad is a circle of radius 1); the ink thickens the longer the brush is down,
// thins the faster it moves, splits into dry streaks when very fast, and pools where it's held still
const PAD = { strokes: [], pen: null, judgeAt: 0, shown: null, guide: null, prs: { ok: false, vals: new Set() } };
// every move is one stroke, so a glyph is read the moment the brush lifts
const pf = p => (p == null ? 1 : 0.45 + 1.1 * p);
function padPressure(e) {
  const v = e && e.pressure;
  if (typeof v !== 'number' || v <= 0 || e.pointerType === 'mouse') return null;
  if (e.pointerType === 'pen') { PAD.prs.ok = true; return v; }
  PAD.prs.vals.add(Math.round(v * 100));
  if (PAD.prs.vals.size >= 4) PAD.prs.ok = true;
  return PAD.prs.ok ? v : null;
}
const evTime = e => { const t = e.timeStamp, n = performance.now(); return t > 0 && Math.abs(t - n) < 4000 ? t : n; };
const padAt = (x, y) => ({ x: (x - L.pad.cx) / L.pad.r, y: (y - L.pad.cy) / L.pad.r });
const inPad = (x, y) => Math.hypot(x - L.pad.cx, y - L.pad.cy) < L.pad.r * 1.05;
function penDown(x, y, e) {
  if (PAD.shown) { PAD.shown = null; PAD.strokes = []; }
  PAD.judgeAt = 0;
  const u = padAt(x, y), t = evTime(e), p = padPressure(e);
  const pt = { x: u.x, y: u.y, t, w: INKP.MIN * 2 * pf(p), p, seed: (Math.random() * 997) | 0 };
  const s = { pts: [pt], pools: [], len: 0, livePools: [] };
  PAD.strokes.push(s);
  PAD.pen = { s, t0: t, lastMove: performance.now(), v: 0, w: pt.w, dwell: 0, poolW: pt.w };
  SFX.stroke();
}
function penMove(x, y, t, p) {
  const pen = PAD.pen;
  if (!pen) return;
  const u = padAt(x, y), s = pen.s, last = s.pts[s.pts.length - 1], d = Math.hypot(u.x - last.x, u.y - last.y);
  if (d < 0.004) return;
  if (pen.dwell >= INKP.POOLT) { s.pools.push({ s: s.len, dwell: pen.dwell, w: pen.poolW }); s.livePools.push({ p: { ...last }, w: pen.poolW }); }
  pen.dwell = 0;
  const dt = Math.max(1, t - last.t) / 1000;
  pen.v = pen.v * 0.55 + (d / dt) * 0.45;
  const v = pen.v * L.pad.r / 180, load = Math.min(1, (t - pen.t0) / 800);
  const target = INKP.MIN + (INKP.MAX - INKP.MIN) * (0.25 + 0.75 * load) * clamp(1 - v / INKP.VTHIN, 0.06, 1) * pf(p);
  pen.w += (target - pen.w) * Math.min(1, dt * 16);
  const n = Math.min(10, Math.ceil(d / 0.012));
  for (let i = 1; i <= n; i++) { const k = i / n; s.pts.push({ x: last.x + (u.x - last.x) * k, y: last.y + (u.y - last.y) * k, t: last.t + (t - last.t) * k, w: last.w + (pen.w - last.w) * k, p, dry: v > INKP.VDRY && s.len > 0.08, seed: (Math.random() * 997) | 0 }); }
  s.len += d;
  pen.lastMove = performance.now(); pen.poolW = pen.w;
}
function penUp() {
  const pen = PAD.pen;
  if (!pen) return;
  const s = pen.s, last = s.pts[s.pts.length - 1];
  if (pen.dwell >= INKP.POOLT) { s.pools.push({ s: s.len, dwell: pen.dwell, w: pen.poolW }); s.livePools.push({ p: { ...last }, w: pen.poolW }); }
  PAD.pen = null;
  padJudge();
}
function padTick(dt) {
  const pen = PAD.pen, now = performance.now();
  if (pen && now - pen.lastMove > 60) { pen.dwell += dt; pen.poolW += (INKP.POOL * pf(pen.s.pts[pen.s.pts.length - 1].p) - pen.poolW) * Math.min(1, dt * 1.9); }
  if (!pen && PAD.judgeAt && now >= PAD.judgeAt) padJudge();
  if (PAD.shown && now - PAD.shown.t > 1200) { PAD.shown = null; PAD.strokes = []; }
}
// read it: the closest of your moves, how well it was written; cast it at that strength
function padJudge(strokes) {
  PAD.judgeAt = 0;
  const S = strokes || PAD.strokes;
  const R = S.length ? recognize(S, myMoves()) : null;
  if (!R) { PAD.strokes = []; return null; }
  if (strokes) PAD.strokes = strokes;
  const sh = PAD.shown = { R, t: performance.now(), ok: false, msg: '' };
  if (R.verdict === 'fizzle') {
    const all = recognize(S, MOVES[save.way]), locked = all && all.verdict !== 'fizzle' && all.best.g.order >= learnedCount();
    sh.msg = locked ? 'A move of your way, but no one has taught it to you yet' : R.best && R.best.q > 0.15 ? `The ink doesn’t take · closest: ${R.best.g.name}` : 'The ink doesn’t take';
    SFX.fizzle();
  }
  else {
    const m = R.best.g;
    const ST = player.st;
    if (player.hp <= 0) sh.msg = '';
    else if (ST.frozen > 0) sh.msg = 'Frozen solid!';
    else if (ST.air > 0) sh.msg = 'Thrown in the air!';
    else if (ST.stun > 0) sh.msg = 'Stunned!';
    else if (ST.under > 0 || ST.leap > 0) sh.msg = 'Not yet…';
    else if (ST.mend > 0) sh.msg = 'Still mending…';
    else if (ST.statue > 0) sh.msg = 'Still jade…';
    else if (ST.silence > 0) sh.msg = 'Silenced! No breath to write with';
    else if (ST.heavy > 0 && LIGHT.has(m.tag)) sh.msg = 'Too heavy to move like that';
    else if (player.act) sh.msg = 'Still moving…';
    else if (startMove(player, m, R.power, FIGHT && FIGHT.on ? FIGHT.foe : null)) {
      sh.ok = true;
      words(player.x, player.y - 44, m.name, WAYS[m.way].color, 15, 1.1);
      if (save) { save.stats.casts++; if (R.verdict === 'clean') save.stats.clean++; }
      if (PAD.guide && PAD.guide.role === m.role) PAD.guide = null;
    } else sh.msg = player.ki < m.cost ? 'Not enough ki' : '';
  }
  return R;
}
// drawing the ink, as on the dojo page
function seg(c, M, a, b, color) {
  const ax = M.cx + a.x * M.r, ay = M.cy + a.y * M.r, bx = M.cx + b.x * M.r, by = M.cy + b.y * M.r;
  const wa = Math.max(0.6, a.w * M.r), wb = Math.max(0.6, b.w * M.r);
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-6, nx = -dy / d, ny = dx / d;
  c.fillStyle = color;
  if (b.dry) {
    const lanes = [-0.36, -0.13, 0.1, 0.33];
    for (let k = 0; k < 4; k++) {
      if ((b.seed + k * 3) % 7 === 0) continue;
      const o = lanes[k], h = 0.085;
      c.beginPath(); c.moveTo(ax + nx * wa * (o - h), ay + ny * wa * (o - h)); c.lineTo(bx + nx * wb * (o - h), by + ny * wb * (o - h));
      c.lineTo(bx + nx * wb * (o + h), by + ny * wb * (o + h)); c.lineTo(ax + nx * wa * (o + h), ay + ny * wa * (o + h)); c.closePath(); c.fill();
    }
    return;
  }
  c.beginPath(); c.arc(bx, by, wb / 2, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(ax + nx * wa / 2, ay + ny * wa / 2); c.lineTo(bx + nx * wb / 2, by + ny * wb / 2); c.lineTo(bx - nx * wb / 2, by - ny * wb / 2); c.lineTo(ax - nx * wa / 2, ay - ny * wa / 2); c.closePath(); c.fill();
}
function blot(c, M, p, w, color) {
  const x = M.cx + p.x * M.r, y = M.cy + p.y * M.r, r = w * M.r / 2;
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + (p.seed || 0) * 0.37, r2 = r * (0.28 + 0.12 * (((p.seed || 0) + k * 5) % 4)); c.beginPath(); c.arc(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, r2, 0, TAU); c.fill(); }
}
function inkStroke(c, M, s, color = C.sumi, upto = Infinity) {
  const P = s.pts;
  if (!P.length) return;
  blot(c, M, P[0], P[0].w, color);
  for (let i = 1; i < P.length && P[i].t <= upto; i++) seg(c, M, P[i - 1], P[i], color);
  for (const d of s.dwells || []) { if (upto < d.t0) continue; const k = clamp((upto - d.t0) / (d.t1 - d.t0), 0, 1), p = P[Math.min(d.i, P.length - 1)]; blot(c, M, p, INKP.POOL * (0.5 + 0.5 * k), color); }
  for (const pl of s.livePools || []) blot(c, M, pl.p, pl.w, color);
}
function paper(c, M, faint) {
  const g = c.createRadialGradient(M.cx - M.r * 0.3, M.cy - M.r * 0.35, M.r * 0.1, M.cx, M.cy, M.r);
  g.addColorStop(0, '#f6efdc'); g.addColorStop(1, '#e4d6b4');
  c.fillStyle = g; c.beginPath(); c.arc(M.cx, M.cy, M.r, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(80,60,40,0.55)'; c.lineWidth = Math.max(1, M.r * 0.008); c.stroke();
  c.strokeStyle = `rgba(80,60,40,${faint ? 0.1 : 0.16})`; c.lineWidth = 1;
  for (const k of [1 / 3, 2 / 3]) { c.beginPath(); c.arc(M.cx, M.cy, M.r * k, 0, TAU); c.stroke(); }
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(M.cx + Math.cos(a) * M.r * 0.06, M.cy + Math.sin(a) * M.r * 0.06); c.lineTo(M.cx + Math.cos(a) * M.r, M.cy + Math.sin(a) * M.r); c.stroke(); }
}
// a move's glyph as a guide or a ghost: its path, its start (a dot) and its pools (rings)
function glyphGuide(c, M, g, color, alpha, dashed = true, lw) {
  c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw || Math.max(1.5, M.r * 0.014); c.lineCap = 'round'; c.lineJoin = 'round';
  if (dashed) c.setLineDash([M.r * 0.045, M.r * 0.03]);
  g.strokes.forEach((s, si) => {
    c.beginPath(); s.forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, M.cx + p.x * M.r, M.cy + p.y * M.r)); c.stroke();
    c.setLineDash([]);
    c.beginPath(); c.arc(M.cx + s[0].x * M.r, M.cy + s[0].y * M.r, Math.max(2.5, M.r * 0.035), 0, TAU); c.fill();
    for (const tp of g.pools[si]) { const p = s[Math.round(tp * (s.length - 1))]; c.beginPath(); c.arc(M.cx + p.x * M.r, M.cy + p.y * M.r, Math.max(4, M.r * 0.08), 0, TAU); c.stroke(); }
    if (dashed) c.setLineDash([M.r * 0.045, M.r * 0.03]);
  });
  c.restore();
}
function drawPad() {
  const M = L.pad, now = performance.now(), sh = PAD.shown;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(M.cx + 3, M.cy + 6, M.r + 4, 0, TAU); ctx.fill();
  paper(ctx, M);
  if (PAD.guide && !sh) glyphGuide(ctx, M, PAD.guide, '#5a4630', 0.5);
  if (sh && sh.R.best && (sh.R.verdict !== 'fizzle' || sh.R.best.q > 0.15)) { const took = sh.R.verdict !== 'fizzle'; glyphGuide(ctx, M, sh.R.best.g, took ? WAYS[sh.R.best.g.way].color : '#5a4630', took ? 0.75 : 0.35); }
  ctx.globalAlpha = sh ? clamp(1 - (now - sh.t - 600) / 600, 0, 1) : 1;
  ctx.beginPath(); ctx.arc(M.cx, M.cy, M.r, 0, TAU); ctx.clip();
  for (const s of PAD.strokes) inkStroke(ctx, M, s);
  if (PAD.pen && PAD.pen.dwell > 0) blot(ctx, M, PAD.pen.s.pts[PAD.pen.s.pts.length - 1], PAD.pen.poolW, C.sumi);
  ctx.restore();
  if (sh && sh.ok) {
    const sz = Math.max(26, M.r * 0.22), k = clamp((now - sh.t) / 220, 0, 1), grow = 1 + 0.5 * (1 - ease(k));
    ctx.save(); ctx.translate(M.cx + M.r * 0.68, M.cy + M.r * 0.68); ctx.scale(grow, grow); ctx.globalAlpha = Math.min(1, 0.3 + k);
    ctx.fillStyle = C.seal; roundRect(-sz / 2, -sz / 2, sz, sz, sz * 0.16); ctx.fill();
    ctx.strokeStyle = '#fbeee0'; ctx.lineWidth = Math.max(2, sz * 0.08); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; wayMark(ctx, sh.R.best.g.way, 0, 1, sz * 0.3);
    ctx.restore();
  }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

