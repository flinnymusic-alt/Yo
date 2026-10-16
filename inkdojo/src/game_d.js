// ── spells: how each of the eighty works ──
// A spell's strength (P) is how well it was written; the caster's twist multiplies it (fire's heat, air's wind,
// water standing in a puddle). Size and reach grow with P, and so does the amount of element it throws out.
const beats = (a, b) => WAYS[a] && WAYS[a].beats === b;
// the way that beats another hits it a little harder, and takes a little less from it
const ADV = { up: 1.05, down: 0.95, damp: 0.88 };
const advMul = (a, b) => (beats(a, b) ? ADV.up : beats(b, a) ? ADV.down : 1);
const wcol = way => (WAYS[way] ? WAYS[way].color : '#fff');
let SHOTS = [], WAVES = [], ZONES = [], ENTS = [], STONES = [], TIMERS = [], BEAMS = [];

// how long after it's written a spell comes out (wind), how long you're busy after (rec), and how long a fighter's
// telegraph lasts for it (aiWind, times their rank's windup)
const TIMING = {
  // reaching out to hit
  Strike: [0.05, 0.18, 1.0], Shot: [0.06, 0.2, 1.0], Volley: [0.08, 0.25, 1.1], Chill: [0.06, 0.2, 1.0], Homing: [0.06, 0.2, 1.0], Pierce: [0.08, 0.25, 1.1], Break: [0.06, 0.25, 1.05],
  Flurry: [0.05, 0.2, 1.0], Throw: [0.05, 0.25, 0.9], Grapple: [0.06, 0.22, 1.0], Cone: [0.06, 0.2, 1.05], Push: [0.06, 0.22, 1.0], Yank: [0.06, 0.25, 1.0], Interrupt: [0.02, 0.15, 0.55],
  // at a place, or all round
  Pool: [0.06, 0.2, 0.9], Burst: [0.08, 0.25, 1.1], Trap: [0.08, 0.25, 1.1], Freeze: [0.06, 0.2, 1.0], Wash: [0.1, 0.3, 1.15], Summon: [0.08, 0.3, 1.1], Sweep: [0.08, 0.3, 1.1],
  Barrier: [0.04, 0.15, 0.7], Release: [0.06, 0.25, 1.0], Bomb: [0.06, 0.2, 1.0], Zone: [0.08, 0.25, 1.1], Detonate: [0.06, 0.22, 1.0], Blast: [0.08, 0.3, 1.15], Lob: [0.08, 0.25, 1.1],
  Spike: [0.08, 0.25, 1.1], Stun: [0.08, 0.28, 1.1], Roll: [0.08, 0.28, 1.1], Sink: [0.08, 0.25, 1.1], Blind: [0.06, 0.22, 1.0], Root: [0.06, 0.22, 1.0], Rockfall: [0.08, 0.3, 1.15], Ground: [0.06, 0.22, 1.0],
  Launch: [0.08, 0.3, 1.15], Storm: [0.08, 0.25, 1.1], Slam: [0.08, 0.28, 1.1], Wave: [0.1, 0.3, 1.15], Silence: [0.06, 0.2, 0.9], Misdirect: [0.04, 0.15, 0.7], Mark: [0.04, 0.15, 0.7],
  // on yourself
  Absorb: [0, 0.05, 0.4], Reflect: [0, 0.05, 0.4], Counter: [0, 0.05, 0.35], Conceal: [0, 0.05, 0.4], Thorns: [0, 0.05, 0.45], Armor: [0, 0.05, 0.45], Deflect: [0, 0.05, 0.4], Statue: [0, 0.05, 0.35],
  Decoy: [0, 0.08, 0.35], Dodge: [0, 0.1, 0.3], Glide: [0, 0.1, 0.35], Dash: [0.02, 0.15, 0.6], Swap: [0.04, 0.15, 0.6], Tunnel: [0.04, 0.2, 0.8], Leap: [0.04, 0.2, 0.8], Lift: [0.04, 0.2, 0.7],
  Wall: [0.04, 0.15, 0.6], Stance: [0.04, 0.15, 0.6], Free: [0.02, 0.1, 0.45], Fury: [0.02, 0.1, 0.5], Haste: [0.02, 0.1, 0.5], Cleanse: [0.04, 0.15, 0.6], Echo: [0.02, 0.1, 0.5],
  Heal: [0.08, 0.25, 1.0], Ki: [0.06, 0.2, 0.9], Ultimate: [0.2, 0.5, 1.6],
};
const timing = m => TIMING[m.tag] || [0.06, 0.22, 1.0];
// fire's heat: what each spell adds
const HEAT = { jab: 6, fireball: 10, breath: 14, rocket: 8, flameshield: 8, roundhouse: 12, firewall: 12, embers: 10, charge: 14, knee: 10, whip: 10, lava: 14, ignite: 6, meteor: 20, firework: 12, brand: 6, inferno: 30 };

// ── where things are ──
const foeOf = f => (FIGHT ? (f === player ? FIGHT.foe : f === FIGHT.foe ? player : null) : null);
const inFight = f => !!FIGHT && FIGHT.on && (f === player || f === FIGHT.foe);
const gone = f => f.st.under > 0 || f.st.leap > 0;
const aloft = f => f.st.air > 0 || f.st.leap > 0 || f.st.high > 0;
function inZone(f, kind, owner) { return ZONES.some(z => z.kind === kind && (!owner || z.owner === owner) && Math.hypot(f.x - z.x, f.y - z.y) < z.r + f.r * 0.4); }
function zoneUnder(f, kind) { return ZONES.find(z => z.kind === kind && Math.hypot(f.x - z.x, f.y - z.y) < z.r + f.r * 0.4); }
const myStones = f => STONES.filter(s => s.owner === f);
function nearestStone(f, from, within) { let best = null, bd = within; for (const s of myStones(f)) { const d = Math.hypot(s.x - from.x, s.y - from.y); if (d < bd) { bd = d; best = s; } } return best; }
function closeIn(f, t, reach, lunge) {
  if (!t || gone(t)) return false;
  const gap = dist(f, t) - f.r - t.r;
  if (gap > reach + lunge) return false;
  const step = Math.max(0, Math.min(lunge, gap - 6)), a = angTo(f, t);
  if (step > 2 && f.st.root <= 0 && f.st.high <= 0) { ghostOf(f); f.x += Math.cos(a) * step; f.y += Math.sin(a) * step; }
  return gap - (f.st.root > 0 || f.st.high > 0 ? 0 : step) <= reach && !(t.st.high > 0 && f.st.high <= 0) && t.st.air <= 0.5;
}
const later = (t, fn) => TIMERS.push({ t, fn });
// (for testing: which spell each bit of damage came from)
let DMGLOG = null, CUR = null;
function stamp(key) { if (!DMGLOG) return; for (const L of [SHOTS, WAVES, ZONES, ENTS, TIMERS]) for (const o of L) if (o.spell === undefined) o.spell = key; for (const f of [player, FIGHT && FIGHT.foe]) if (f && f.dash && f.dash.spell === undefined) f.dash.spell = key; }
// what a spell goes at: the foe, or a water double of them standing in for them
const decoyOf = g => (g ? ENTS.find(e => e.kind === 'double' && e.owner === g && e.life > 0) : null);
const aimOf = f => { const t = foeOf(f); return decoyOf(t) || t; };
function popDecoy(e, quiet) {
  if (e.popped) return;
  e.popped = true; e.life = 0;
  splash(e.x, e.y, 22, { r: 40, up: 220 }); ripple(e.x, e.y, 40);
  if (!quiet) { words(e.x, e.y - 40, 'Only water!', ELC.water.light, 14); SFX.block(); }
  ZONES.push({ kind: 'puddle', owner: e.owner, way: 'water', x: e.x, y: e.y, r: 50, grow: 0, life: 7, max: 7, tick: 0, P: 1 });
}
function hitDecoy(owner, x, y, r) { const d = decoyOf(foeOf(owner)); if (d && Math.hypot(d.x - x, d.y - y) < r + d.r) { popDecoy(d); return true; } return false; }
// rooted like a mountain, turned to jade, weightless or cased in stone: nothing shoves them about
const unmoved = t => t.st.stance > 0 || t.st.statue > 0 || t.st.free > 0 || (t.st.armorKind === 'stone' && t.st.armor > 0);
function mark(x, y, r, life, way) { ZONES.push({ kind: 'mark', owner: null, way, x, y, r, life, max: life, tick: 0 }); }

// ── a spell, from the moment it's written (or a fighter starts writing it in the air) to its end ──
// stunned, frozen, thrown up, underground, mid-leap or turned to jade: can't do a thing. Silenced: can walk, can't write.
const held = f => { const S = f.st; return S.stun > 0 || S.frozen > 0 || S.air > 0 || S.under > 0 || S.leap > 0 || S.mend > 0 || S.statue > 0; };
function canCast(f) { return f.hp > 0 && !held(f) && f.st.silence <= 0; }
// what a heavy fighter can't do
const LIGHT = new Set(['Glide', 'Dash', 'Tunnel', 'Dodge', 'Leap', 'Swap', 'Grapple']);
function startMove(f, move, power, target) {
  const cost = move.cost;
  if (f.st.heavy > 0 && LIGHT.has(move.tag)) { if (f.isPlayer) { words(f.x, f.y - 34, 'Too heavy!', ELC.earth.light, 14); SFX.fizzle(); } return false; }
  if (f.ki < cost) { if (f.isPlayer) { words(f.x, f.y - 34, 'Not enough ki', '#9fd0ff', 14); SFX.fizzle(); } return false; }
  if (!canCast(f)) return false;
  f.ki -= cost;
  const [w, , aw] = timing(move), slowCast = move.way === 'earth' ? 0.1 : 0, fury = f.st.fury > 0 ? 0.5 : 1;
  const wind = (f.isPlayer ? w + slowCast : skillOf(f).windup * aw * (move.way === 'earth' ? 1.15 : 1) * [0.9, 1, 1.15][move.tier || 0]) * fury;
  f.act = { move, power, target, phase: 'wind', t: wind, wind, hits: 0, next: 0 };
  if (!f.isPlayer) f.glyph = { move, t: 0, dur: wind };
  f.pose = 'cast'; f.poseT = 0;
  if (f.isPlayer) SFX.cast(move.way);
  return true;
}
function stepAct(f, dt) {
  const A = f.act;
  if (!A) return;
  if (!canCast(f) && A.phase === 'wind') { f.act = null; f.glyph = null; return; } // (a stun breaks a spell in the making)
  A.t -= dt;
  if (f.glyph) f.glyph.t += dt;
  if (A.phase === 'wind' && A.t <= 0) { f.glyph = null; A.phase = 'go'; A.t = timing(A.move)[1] * (f.st.fury > 0 ? 0.5 : 1); cast(f, A); }
  else if (A.phase === 'go') {
    if (A.tick) { CUR = A.move.key; A.tick(dt); CUR = null; }
    if (A.t <= 0 && !(A.chan > 0)) f.act = null;
  }
}
function castMult(f, m) {
  let k = 1;
  if (m.way === 'fire') k *= (1 + 0.5 * f.heat / 100) * (f.st.soak > 0 ? ADV.damp : 1);
  if (m.way === 'air') k *= 0.75 + 0.6 * f.wind / 100;
  if (m.way === 'water' && inZone(f, 'puddle')) k *= 1.25;
  if (f.st.blind > 0) k *= 0.6;
  if (m.tier === 2) k *= 1.12;
  return k;
}
// spells that act on the caster, or all round them, rather than going at the foe
const SELF = new Set(['Absorb', 'Heal', 'Glide', 'Conceal', 'Reflect', 'Counter', 'Ki', 'Decoy', 'Thorns', 'Dash', 'Release', 'Sweep', 'Fury', 'Armor', 'Statue', 'Lift', 'Stance', 'Dodge', 'Deflect', 'Cleanse', 'Haste', 'Echo', 'Free', 'Wall', 'Barrier', 'Stun']);
function cast(f, A) {
  const m = A.move, foe = foeOf(f), P = A.power;
  // a beginner's spell sometimes comes to nothing
  if (f.sk && f.sk.fizzle && !A.echo && Math.random() < f.sk.fizzle) { smoke(f.x, f.y - 8, 3, { size: 9 }); words(f.x, f.y - 44, 'fizzles', '#a99fbc', 12, 0.9); SFX.fizzle(); return; }
  let t = A.target || foe;
  if (t && t === foe && !SELF.has(m.tag)) {
    const dec = decoyOf(foe);
    if (dec) t = dec;
    else if (f.st.crosswind > 0 && !gone(t)) {
      // the wind blows it wide of them
      f.st.crosswind = 0;
      const o = rr(0, TAU), dd = rr(120, 160); let px = t.x + Math.cos(o) * dd, py = t.y + Math.sin(o) * dd;
      if (FIGHT) { const q = Math.hypot(px - FIGHT.cx, py - FIGHT.cy), mr = FIGHT.r - 20; if (q > mr) { px = FIGHT.cx + (px - FIGHT.cx) * mr / q; py = FIGHT.cy + (py - FIGHT.cy) * mr / q; } }
      t = { isPhantom: true, x: px, y: py, r: 15, hp: 1, kx: 0, ky: 0, st: freshStatus() };
      swirl(f.x, f.y, 26, 8, { spin: 9, vr: 0, life: 0.5 }); words(f.x, f.y - 46, 'Blown wide!', ELC.air.light, 13);
    }
  }
  const a = t && !gone(t) ? angTo(f, t) + (f.sk && f.sk.aim ? rr(-f.sk.aim, f.sk.aim) : 0) + (f.st.blind > 0 ? rr(-0.5, 0.5) : 0) + (t.st.veil > 0 && !f.isPlayer ? rr(-0.35, 0.35) : 0) : f.face;
  f.face = a;
  const c = { f, t: t && t.hp > 0 ? t : null, m, A, way: m.way, P, pw: P * castMult(f, m), sz: 0.45 + 0.55 * Math.min(P, 1.05), am: Math.pow(clamp(P, 0.4, 1.05), 1.6), a };
  if (m.way === 'fire' && f.st.soak > 0) { smoke(f.x, f.y - 6, 3, { size: 10 }); if (f.isPlayer) words(f.x, f.y - 58, 'Damp', '#bfe6ff', 11, 0.8); }
  if (m.way === 'fire' && HEAT[m.key]) { f.heat = Math.min(100, f.heat + HEAT[m.key] * (f.st.soak > 0 ? 0.5 : 1)); f.heatT = 0; }
  f.lastCast = m;
  if (m.tag !== 'Echo') f.lastSpell = m;
  if (!A.echo) flourish(f, m, P, a);
  const fn = SPELL[m.id];
  if (DMGLOG) { const k = '#' + m.id; DMGLOG[k] = (DMGLOG[k] || 0) + 1; }
  CUR = m.key; if (fn) fn(c); stamp(m.key); CUR = null;
}

// ── the building blocks ──
function melee(c, o) {
  const { f, t, a } = c;
  f.pose = o.pose || (Math.random() < 0.5 ? 'strike' : 'strike2'); f.poseT = 0;
  let mult = 1;
  if (f.st.stance > 0) { mult = 1.6; f.st.stance = 0; words(f.x, f.y - 36, 'Mountain!', wcol('earth'), 13); }
  const hit = closeIn(f, t, o.reach * (o.reachSz ? c.sz : 1), o.lunge ?? 30);
  const hx = f.x + Math.cos(a) * (o.fxd ?? 32), hy = f.y + Math.sin(a) * (o.fxd ?? 32);
  if (o.fx) o.fx(hx, hy, hit);
  if (hit) return hurt(t, f, o.dmg * mult, { ...(o.hit || {}), power: c.pw, ang: a, melee: true, am: c.am });
  return false;
}
function bolt(c, o) {
  const { f } = c, n = o.n || 1;
  for (let i = 0; i < n; i++) {
    const aa = c.a + (n > 1 ? (i - (n - 1) / 2) * (o.spread || 0.2) : 0) + (o.aimOff || 0);
    const sx = o.from ? o.from.x : f.x + Math.cos(aa) * 20, sy = o.from ? o.from.y : f.y + Math.sin(aa) * 20;
    SHOTS.push({ owner: f, way: c.way, kind: o.kind, x: sx, y: sy, vx: Math.cos(aa) * o.speed, vy: Math.sin(aa) * o.speed, r: o.r * c.sz, dmg: o.dmg, P: c.pw, am: c.am, life: o.life || 1.6, max: o.life || 1.6,
      trail: [], spin: rr(0, TAU), hit: o.hit || {}, explode: o.explode ? o.explode * c.sz : 0, through: !!o.through, home: o.home || 0, target: c.t, t: 0, curve: o.curve ? o.curve * (i ? -1 : 1) : 0, seed: (Math.random() * 999) | 0 });
  }
}
// a cone in front of the caster: does it reach them?
function inCone(c, len, half) { const { f, t } = c; if (!t || gone(t)) return false; const d = dist(f, t), da = Math.abs(((angTo(f, t) - c.a + 3 * Math.PI) % TAU) - Math.PI); return d - t.r <= len && da <= half + Math.atan2(t.r, Math.max(1, d)); }
// a blast at a point: whoever stands in it is hit
function blastAt(owner, x, y, r, dmg, o = {}) {
  hitDecoy(owner, x, y, r);
  const t = foeOf(owner);
  if (t && !gone(t) && Math.hypot(t.x - x, t.y - y) < r + t.r && !(o.ground && aloft(t))) return hurt(t, owner, dmg, { ang: Math.atan2(t.y - y, t.x - x), ...o });
  return false;
}
function dashTo(f, x, y, dur, o = {}) {
  const dx = x - f.x, dy = y - f.y;
  f.dash = { vx: dx / dur, vy: dy / dur, t: dur, trail: o.trail || null, way: o.way, hitOnce: o.hit || null, done: false };
  if (o.invuln) f.st.invuln = Math.max(f.st.invuln, o.invuln);
}
function stoneAt(owner, kind, x, y, o = {}) {
  const mine = myStones(owner);
  if (mine.length >= 6) removeStone(mine[0], true);
  const s = { owner, kind, x, y, r: o.r || (kind === 'pillar' ? 20 : 15), a: o.a || 0, len: o.len || 0, hp: o.hp || 28, maxHp: o.hp || 28, life: o.life || 13, born: 0, seed: (Math.random() * 999) | 0 };
  STONES.push(s);
  dust(x, y, 5, { sp: 60 }); rocks(x, y, 3, { sp: 60, up: 120, size: 3 });
  return s;
}
function removeStone(s, quiet) {
  STONES = STONES.filter(q => q !== s);
  if (!quiet) { rocks(s.x, s.y, s.kind === 'wall' ? 10 : 6, { sp: 120, up: 160, size: 4 }); dust(s.x, s.y, 5); }
}
// a wall is a short thick line; the rest are round
function stoneHit(s, x, y, r) {
  if (s.kind !== 'wall') return Math.hypot(x - s.x, y - s.y) < s.r + r;
  const ux = Math.cos(s.a), uy = Math.sin(s.a), dx = x - s.x, dy = y - s.y, along = clamp(dx * ux + dy * uy, -s.len / 2, s.len / 2);
  return Math.hypot(dx - ux * along, dy - uy * along) < 11 + r;
}
function stoneShove(s, f) {
  if (s.kind === 'pillar' && s.owner === f && f.st.high > 0) return;
  if (s.kind !== 'wall') { const d = Math.hypot(f.x - s.x, f.y - s.y), m = s.r + f.r; if (d < m && d > 0) { f.x = s.x + (f.x - s.x) / d * m; f.y = s.y + (f.y - s.y) / d * m; } return; }
  const ux = Math.cos(s.a), uy = Math.sin(s.a), dx = f.x - s.x, dy = f.y - s.y, along = clamp(dx * ux + dy * uy, -s.len / 2, s.len / 2);
  const px = s.x + ux * along, py = s.y + uy * along, d = Math.hypot(f.x - px, f.y - py), m = 11 + f.r;
  if (d < m && d > 0) { f.x = px + (f.x - px) / d * m; f.y = py + (f.y - py) / d * m; }
}

// ── the eighty ──
const SPELL = {
  // ═══ WATER ═══
  'water:lash'(c) {
    const { f, a } = c, reach = 132 * c.sz;
    const hit = melee(c, { reach, lunge: 26, dmg: 8, fxd: 30, hit: { soak: 3, knock: 70 } });
    const tip = c.t && hit ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(a) * (reach + 30), y: f.y + Math.sin(a) * (reach + 30) };
    BEAMS.push({ kind: 'lash', way: 'water', owner: f, x1: f.x, y1: f.y, x2: tip.x, y2: tip.y, life: 0.3, max: 0.3, w: 5 * c.sz, bend: rr(-0.5, 0.5) });
    splash(tip.x, tip.y, amt(10, c.am), { r: 20 });
    if (!hit) decal('wet', tip.x, tip.y, 16, { life: 5 });
  },
  'water:bullet'(c) { bolt(c, { kind: 'drop', speed: 560, r: 7, dmg: 9, hit: { soak: 3, knock: 60 } }); drops(c.f.x, c.f.y, amt(5, c.am), { a: c.a, spread: 0.4, sp: 140, up: 60 }); },
  'water:bubble'(c) {
    const f = c.f; f.st.shield = 22 * c.pw; f.st.shieldT = 5; f.st.shieldKind = 'bubble'; f.pose = 'guard'; f.poseT = 0;
    drops(f.x, f.y, amt(12, c.am), { sp: 60, up: 140 }); ripple(f.x, f.y, 40);
  },
  'water:puddle'(c) {
    const f = c.f, at = c.t && dist(f, c.t) < 340 ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 130, y: f.y + Math.sin(c.a) * 130 };
    SHOTS.push({ owner: f, way: 'water', kind: 'glob', x: f.x, y: f.y, x0: f.x, y0: f.y, tx: at.x, ty: at.y, t: 0, dur: 0.35, life: 0.35, max: 0.35, r: 8, trail: [], P: c.pw, am: c.am, lob: true,
      land(s) { ZONES.push({ kind: 'puddle', owner: f, way: 'water', x: s.tx, y: s.ty, r: 64 * c.sz, grow: 0, life: 10, max: 10, tick: 0, P: c.pw }); splash(s.tx, s.ty, amt(14, c.am), { r: 50 }); } });
  },
  'water:rain'(c) {
    const f = c.f, inW = inZone(f, 'puddle');
    f.st.regen = 4; f.st.regenRate = 24 * c.pw * WAYMOD.water.heal * (inW ? 1.3 : 1) / 4; f.st.burn = 0; SFX.heal();
    ENTS.push({ kind: 'cloud', owner: f, way: 'water', x: f.x, y: f.y, life: 4, max: 4, am: c.am, rain: true });
    ZONES.push({ kind: 'puddle', owner: f, way: 'water', x: f.x, y: f.y, r: 50 * c.sz, grow: 0, life: 8, max: 8, tick: 0, P: c.pw });
  },
  'water:glide'(c) {
    const f = c.f, t = c.t, mv = Math.hypot(f.vx, f.vy) > 20 ? Math.atan2(f.vy, f.vx) : t ? angTo(f, t) + (Math.random() < 0.5 ? 1.4 : -1.4) : f.face;
    const d = 200 * c.sz; dashTo(f, f.x + Math.cos(mv) * d, f.y + Math.sin(mv) * d, 0.26, { invuln: 0.2, trail: 'water', way: 'water' });
    drops(f.x, f.y, amt(12, c.am), { a: mv + Math.PI, spread: 0.8, sp: 160, up: 80 });
  },
  'water:geyser'(c) {
    const f = c.f, at = c.t ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 170, y: f.y + Math.sin(c.a) * 170 };
    mark(at.x, at.y, 44 * c.sz, 0.45, 'water'); drops(at.x, at.y, amt(6, c.am), { sp: 40, up: 90 });
    later(0.45, () => {
      const pz = ZONES.find(z => z.kind === 'puddle' && Math.hypot(z.x - at.x, z.y - at.y) < z.r), big = !!pz;
      if (pz) pz.life = Math.min(pz.life, 0.4);
      const r = (big ? 70 : 46) * c.sz;
      ENTS.push({ kind: 'geyser', owner: f, way: 'water', x: at.x, y: at.y, r, life: 0.7, max: 0.7, am: c.am * (big ? 1.5 : 1) });
      splash(at.x, at.y, amt(big ? 30 : 18, c.am), { up: 320, sp: 160, r: r });
      decal('wet', at.x, at.y, r, { life: 8 });
      if (big) { cam.shake = Math.max(cam.shake, 5); words(at.x, at.y - 50, 'From the puddle!', ELC.water.light, 13); }
      blastAt(f, at.x, at.y, r, big ? 18 : 12, { power: c.pw, soak: 6, slow: big ? 2.5 : 1.5, knock: 60, big, am: c.am });
    });
  },
  'water:shards'(c) { bolt(c, { kind: 'ice', n: 3, spread: 0.18, speed: 600, r: 6, dmg: 6, hit: { chill: 2, knock: 40 } }); iceBurst(c.f.x + Math.cos(c.a) * 20, c.f.y + Math.sin(c.a) * 20, amt(5, c.am), { a: c.a, spread: 0.5 }); },
  'water:whirlpool'(c) {
    const f = c.f, at = c.t && dist(f, c.t) < 360 ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 160, y: f.y + Math.sin(c.a) * 160 };
    ZONES.push({ kind: 'whirlpool', owner: f, way: 'water', x: at.x, y: at.y, r: 82 * c.sz, life: 3.5, max: 3.5, tick: 0, P: c.pw, am: c.am });
    splash(at.x, at.y, amt(16, c.am), { r: 60 });
  },
  'water:freeze'(c) {
    const f = c.f, t = c.t;
    ring(f.x, f.y, 10, 260, '#dff6ff', 0.6, 5); iceBurst(f.x, f.y, amt(8, c.am)); SFX.block();
    for (const z of ZONES) if (z.kind === 'puddle') { z.kind = 'ice'; z.life = 5; z.max = 5; z.hits = new Set(); iceBurst(z.x, z.y, amt(6, c.am), { sp: 80 }); decal('frost', z.x, z.y, z.r, { life: 6 }); }
    if (t && dist(f, t) < 520 && !gone(t)) {
      if (t.st.soak > 0) { hurt(t, f, 8, { power: c.pw, freeze: 1.6 * (0.6 + 0.4 * Math.min(1, c.P)), quiet: false, am: c.am }); words(t.x, t.y - 44, 'Frozen!', '#dff6ff', 16); }
      else { hurt(t, f, 3, { power: c.pw, slow: 2.5, am: c.am }); words(t.x, t.y - 44, 'Chilled', '#bfe6ff', 13); }
      decal('frost', t.x, t.y, 40, { life: 6 }); iceBurst(t.x, t.y, amt(10, c.am));
    }
  },
  'water:tidal'(c) { WAVES.push({ kind: 'tidal', owner: c.f, way: 'water', x: c.f.x + Math.cos(c.a) * 24, y: c.f.y + Math.sin(c.a) * 24, a: c.a, speed: 360, travel: 0, max: 500, width: 170 * c.sz, dmg: 12, P: c.pw, am: c.am, hit: false, wash: true, washed: new Set(), opts: { soak: 4, knock: 160 } }); splash(c.f.x, c.f.y, amt(16, c.am), { r: 40 }); },
  'water:mist'(c) { const f = c.f; f.st.veil = 4.5; f.st.veilK = 0.7; f.st.veilKind = 'mist'; mist(f.x, f.y, amt(16, c.am), { r: 30, size: 26 }); },
  'water:undertow'(c) {
    const { f, t } = c;
    if (t && dist(f, t) < 420 && !gone(t) && !(t.st.high > 0)) {
      BEAMS.push({ kind: 'current', way: 'water', owner: f, x1: t.x, y1: t.y, x2: f.x, y2: f.y, life: 0.45, max: 0.45, w: 10 * c.sz });
      if (hurt(t, f, 5, { power: c.pw, soak: 3, slow: 2, am: c.am })) pullTo(t, f, 64, 7);
      drops(t.x, t.y, amt(10, c.am), { a: angTo(t, f), spread: 0.5, sp: 200, up: 60 });
    } else BEAMS.push({ kind: 'current', way: 'water', owner: f, x1: f.x + Math.cos(c.a) * 300, y1: f.y + Math.sin(c.a) * 300, x2: f.x, y2: f.y, life: 0.4, max: 0.4, w: 8 });
  },
  'water:mirror'(c) { const f = c.f; f.st.reflect = 3; ripple(f.x, f.y, 34); ripple(f.x, f.y, 48); drops(f.x, f.y, amt(8, c.am), { up: 100, sp: 50 }); f.pose = 'guard'; f.poseT = 0; },
  'water:dragon'(c) {
    const f = c.f, segs = Array.from({ length: 12 }, () => ({ x: f.x, y: f.y }));
    ENTS.push({ kind: 'dragon', owner: f, way: 'water', x: f.x + Math.cos(c.a) * 20, y: f.y + Math.sin(c.a) * 20, a: c.a, speed: 270, life: 3, max: 3, bites: 3, cool: 0, segs, P: c.pw, am: c.am, sz: c.sz });
    splash(f.x, f.y, amt(16, c.am), { r: 40 });
  },
  'water:pushhands'(c) { const f = c.f; f.st.counter = 1.1; f.counterPow = c.pw; f.pose = 'guard'; f.poseT = 0; ripple(f.x, f.y, 30); swirl(f.x, f.y, 26, amt(10, c.am), { col: 'rgba(170,220,255,0.95)', spin: 6, vr: 0, life: 0.9 }); },
  'water:ebb'(c) {
    const { f, t } = c;
    if (!t || t.isPhantom || gone(t) || dist(f, t) > 460 || t.st.high > 0 || t.st.statue > 0) { splash(f.x, f.y, 6); words(f.x, f.y - 40, 'Nothing to flow past', C.muted, 12); return; }
    if (t.isDecoy) { BEAMS.push({ kind: 'current', way: 'water', owner: f, x1: f.x, y1: f.y, x2: t.x, y2: t.y, life: 0.4, max: 0.4, w: 8 }); hurt(t, f, 0); return; }
    const x0 = f.x, y0 = f.y;
    splash(f.x, f.y, amt(12, c.am), { r: 30 }); splash(t.x, t.y, amt(12, c.am), { r: 30 });
    BEAMS.push({ kind: 'current', way: 'water', owner: f, x1: f.x, y1: f.y, x2: t.x, y2: t.y, life: 0.4, max: 0.4, w: 8 });
    ghostOf(f, ELC.water.main); ghostOf(t, ELC.water.main);
    f.x = t.x; f.y = t.y; t.x = x0; t.y = y0; f.kx = f.ky = t.kx = t.ky = 0; f.dash = t.dash = null;
    t.st.soak = Math.max(t.st.soak, 3); words(f.x, f.y - 44, 'Ebb and flow', ELC.water.light, 13);
  },
  'water:draw'(c) {
    const f = c.f, pz = zoneUnder(f, 'puddle');
    f.ki = Math.min(f.maxKi, f.ki + 40 * (0.6 + 0.4 * Math.min(1, c.P)) + (pz ? 30 : 0));
    if (pz) { pz.life = Math.min(pz.life, 0.5); words(f.x, f.y - 44, 'The pond answers', ELC.water.light, 12); }
    for (let i = 0; i < amt(14, c.am); i++) { const aa = rr(0, TAU), d = rr(30, 70); fx({ k: 'drop', x: f.x + Math.cos(aa) * d, y: f.y + Math.sin(aa) * d, z: 2, vx: -Math.cos(aa) * d * 2, vy: -Math.sin(aa) * d * 2, vz: 120, g: 120, life: 0.5, max: 0.5, size: 2.4, drag: 0 }); }
    ripple(f.x, f.y, 50);
  },
  'water:double'(c) {
    const f = c.f, t = c.t, side = (t ? angTo(f, t) : f.face) + (Math.random() < 0.5 ? 1.5708 : -1.5708);
    ENTS.push({ kind: 'double', owner: f, way: 'water', x: f.x, y: f.y, face: f.face, life: 4.5, max: 4.5, gi: f.gi, trim: f.trim, skin: f.skin, hair: f.hair, belt: f.belt, isDecoy: true, r: 15, hp: 1, kx: 0, ky: 0, st: freshStatus() });
    dashTo(f, f.x + Math.cos(side) * 85, f.y + Math.sin(side) * 85, 0.2, { invuln: 0.2 });
    splash(f.x, f.y, amt(10, c.am), { r: 26 });
  },
  'water:flood'(c) {
    const f = c.f, t = c.t, F = FIGHT || { cx: f.x, cy: f.y, r: 255 }, P = c.pw;
    cam.shake = Math.max(cam.shake, 8); SFX.gong();
    ZONES.push({ kind: 'flood', owner: f, way: 'water', x: F.cx, y: F.cy, r: F.r, life: 3.2, max: 3.2, tick: 0, P });
    if (t) t.st.soak = Math.max(t.st.soak, 6);
    later(0.6, () => { WAVES.push({ kind: 'tidal', owner: f, way: 'water', x: f.x, y: f.y, a: c.a, speed: 520, travel: 0, max: 560, width: 420, dmg: 26, P, am: c.am * 1.4, hit: false, big: true, wash: true, washed: new Set(), opts: { soak: 6, knock: 280 } }); });
    later(1.5, () => {
      ring(F.cx, F.cy, 20, F.r, '#e8fbff', 0.8, 8); SFX.block();
      for (let i = 0; i < 10; i++) { const aa = rr(0, TAU), d = rr(0, F.r); iceBurst(F.cx + Math.cos(aa) * d, F.cy + Math.sin(aa) * d, 4, { sp: 60 }); }
      const tt = foeOf(f); if (tt && !gone(tt)) { hurt(tt, f, 6, { power: P, freeze: 1.8 }); words(tt.x, tt.y - 44, 'Frozen!', '#dff6ff', 16); }
      decal('frost', F.cx, F.cy, F.r * 0.8, { life: 8 });
    });
  },

  // ═══ FIRE ═══
  'fire:jab'(c) { melee(c, { reach: 55, lunge: 40, dmg: 7, hit: { burn: 2.5, knock: 70 }, fx: (x, y) => { flames(x, y, amt(9, c.am), { a: c.a, spread: 0.6, sp: 120, rise: 20, size: 8 }); slash(x, y, c.a, '#ff9a4a', 22); embers(x, y, amt(5, c.am), { a: c.a }); } }); },
  'fire:fireball'(c) { bolt(c, { kind: 'fireball', speed: 440, r: 9, dmg: 11, explode: 46, hit: { burn: 3, knock: 110 } }); flames(c.f.x + Math.cos(c.a) * 20, c.f.y + Math.sin(c.a) * 20, amt(6, c.am), { sp: 50 }); },
  'fire:breath'(c) {
    const { f, A } = c, len = 165 * c.sz, half = 0.38;
    f.pose = 'cast'; f.poseT = 0; A.chan = 0.7; let tick = 0;
    A.tick = dt => {
      A.chan -= dt; tick -= dt; const a = f.face, ox = f.x + Math.cos(a) * 18, oy = f.y + Math.sin(a) * 18;
      for (let i = 0; i < amt(5, c.am); i++) { const aa = a + rr(-half, half), v = rr(220, 340) * c.sz; fx({ k: 'flame', x: ox, y: oy, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: len / v * 1.1, max: len / v * 1.1, size: rr(7, 12), drag: 0.5, grow: 2.2 }); }
      if (Math.random() < 0.3) smoke(ox + Math.cos(a) * len * 0.8, oy + Math.sin(a) * len * 0.8, 1, { size: 12 });
      if (tick <= 0) { tick = 0.1; const t = aimOf(f); if (t && inCone({ f, t, a }, len, half)) hurt(t, f, 2.2, { power: c.pw, burn: 2, quiet: true, shot: true, am: c.am }); }
      if (A.chan <= 0) { decal('scorch', f.x + Math.cos(a) * len * 0.6, f.y + Math.sin(a) * len * 0.6, 40 * c.sz, { life: 6 }); }
    };
  },
  'fire:rocket'(c) {
    const { f, t } = c, moving = Math.hypot(f.vx, f.vy) > 20, a = moving ? Math.atan2(f.vy, f.vx) : t ? angTo(t, f) + rr(-0.4, 0.4) : f.face + Math.PI, d = 230 * c.sz;
    dashTo(f, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 0.22, { invuln: 0.18, trail: 'fire', way: 'fire' });
    flames(f.x, f.y, amt(14, c.am), { a: a + Math.PI, spread: 0.5, sp: 160, size: 10 }); smoke(f.x, f.y, amt(3, c.am));
  },
  'fire:flameshield'(c) { const f = c.f; f.st.thorns = 3.5; f.st.armor = Math.max(f.st.armor, 3.5); f.st.armorK = 0.35; f.st.armorKind = 'flame'; f.pose = 'guard'; f.poseT = 0; ring(f.x, f.y, 10, 34, '#ff8a3a', 0.4, 4); flames(f.x, f.y, amt(16, c.am), { sp: 60, jit: 20 }); },
  'fire:roundhouse'(c) {
    const f = c.f, r = 108 * c.sz; f.pose = 'kick'; f.poseT = 0;
    ring(f.x, f.y, 20, r, '#ff8a3a', 0.4, 8); ring(f.x, f.y, 10, r * 0.8, '#ffd27a', 0.35, 4);
    for (let i = 0; i < amt(28, c.am); i++) { const aa = i / 28 * TAU, v = r * 2.2; fx({ k: 'flame', x: f.x + Math.cos(aa) * 20, y: f.y + Math.sin(aa) * 20, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.4, max: 0.4, size: 10, drag: 3, grow: 1 }); }
    blastAt(f, f.x, f.y, r, 10, { power: c.pw, knock: 220, burn: 2, am: c.am });
    decal('scorch', f.x, f.y, r * 0.8, { life: 6 });
  },
  'fire:firewall'(c) {
    const f = c.f, a = c.t ? angTo(f, c.t) : f.face, d = c.t ? Math.min(100, dist(f, c.t) * 0.5) : 100, cx = f.x + Math.cos(a) * d, cy = f.y + Math.sin(a) * d, L = 175 * c.sz;
    ZONES.push({ kind: 'firewall', owner: f, way: 'fire', x: cx, y: cy, a: a + Math.PI / 2, len: L, r: L / 2, life: 4.5, max: 4.5, tick: 0, P: c.pw, am: c.am, hits: new Map() });
    for (let i = 0; i < 8; i++) { const u = i / 7 - 0.5; flames(cx + Math.cos(a + Math.PI / 2) * L * u, cy + Math.sin(a + Math.PI / 2) * L * u, amt(3, c.am), { sp: 30, size: 11 }); }
  },
  'fire:vent'(c) {
    const f = c.f, h = f.heat, r = 70 + h * 1.15, P = c.P;
    f.heat = 0; f.heatT = 9;
    if (h < 12) { smoke(f.x, f.y, 4); words(f.x, f.y - 40, 'Only a puff', C.muted, 12); return; }
    cam.shake = Math.max(cam.shake, 3 + h / 14); SFX.hit(true);
    ring(f.x, f.y, 10, r, '#fff1c4', 0.45, 10); ring(f.x, f.y, 10, r * 0.75, '#ff6a2a', 0.55, 6);
    for (let i = 0; i < amt(18 + h * 0.4, c.am); i++) { const aa = rr(0, TAU), v = rr(0.6, 1) * r * 2.6; fx({ k: 'flame', x: f.x, y: f.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.45, max: 0.45, size: rr(9, 15), drag: 3.5, grow: 1.4 }); }
    embers(f.x, f.y, amt(20, c.am), { sp: 260 }); smoke(f.x, f.y, amt(6, c.am), { size: 20 });
    decal('scorch', f.x, f.y, r * 0.7, { life: 8 });
    blastAt(f, f.x, f.y, r, 5 + h * 0.24, { power: P, knock: 150 + h * 2, burn: 2, big: h > 50, am: c.am });
  },
  'fire:embers'(c) { bolt(c, { kind: 'ember', n: 6, spread: 0.18, speed: 470, r: 4, dmg: 2.6, life: 1.1, hit: { burn: 2, knock: 20 } }); embers(c.f.x, c.f.y, amt(10, c.am), { a: c.a, spread: 0.5, sp: 200 }); },
  'fire:charge'(c) {
    const { f, t } = c;
    if (!t || gone(t) || dist(f, t) > 440) { sparks(f.x + Math.cos(c.a) * 40, f.y + Math.sin(c.a) * 40, 6); words(f.x, f.y - 40, 'Out of reach', C.muted, 12); return; }
    ENTS.push({ kind: 'charge', owner: f, way: 'fire', x: f.x, y: f.y, x0: f.x, y0: f.y, target: t, stuck: false, fly: 0.25, t: 0, life: 1.65, max: 1.65, P: c.pw, am: c.am, sz: c.sz, px: t.x, py: t.y });
    sparks(f.x, f.y, amt(6, c.am), { a: c.a, spread: 0.4, sp: 160 });
  },
  'fire:knee'(c) { melee(c, { reach: 55, lunge: 50, dmg: 11, pose: 'kick', hit: { burn: 2, knock: 140, big: true, breakGuard: true }, fx: (x, y) => { flames(x, y, amt(16, c.am), { a: -Math.PI / 2, spread: 0.6, sp: 160, rise: 90, size: 11 }); embers(x, y, amt(10, c.am), { a: -Math.PI / 2 }); } }); },
  'fire:whip'(c) {
    const { f, t } = c;
    if (t && !t.isPhantom && dist(f, t) < 340 && !gone(t) && !(t.st.high > 0)) {
      BEAMS.push({ kind: 'firewhip', way: 'fire', owner: f, x1: f.x, y1: f.y, x2: t.x, y2: t.y, life: 0.3, max: 0.3, w: 6 * c.sz, bend: rr(-0.5, 0.5) });
      if (t.isDecoy) hurt(t, f, 0);
      const a = angTo(f, t), d = Math.max(0, dist(f, t) - 34);
      dashTo(f, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 0.2, { hit: { dmg: 7, power: c.pw, knock: 90, am: c.am, burn: 3, melee: true } });
      flames(f.x, f.y, amt(8, c.am), { a: a + Math.PI, spread: 0.5, sp: 120 });
    } else BEAMS.push({ kind: 'firewhip', way: 'fire', owner: f, x1: f.x, y1: f.y, x2: f.x + Math.cos(c.a) * 300, y2: f.y + Math.sin(c.a) * 300, life: 0.3, max: 0.3, w: 5, bend: 0.4 });
  },
  'fire:lava'(c) {
    const f = c.f, at = c.t && dist(f, c.t) < 380 ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 160, y: f.y + Math.sin(c.a) * 160 };
    ZONES.push({ kind: 'lava', owner: f, way: 'fire', x: at.x, y: at.y, r: 66 * c.sz, life: 4.5, max: 4.5, tick: 0, P: c.pw, am: c.am, seed: (Math.random() * 999) | 0 });
    flames(at.x, at.y, amt(14, c.am), { sp: 70, jit: 30 }); smoke(at.x, at.y, amt(4, c.am)); decal('scorch', at.x, at.y, 74 * c.sz, { life: 12 });
  },
  'fire:ignite'(c) {
    const { f, t } = c;
    if (!t || dist(f, t) > 460 || gone(t)) { flames(f.x + Math.cos(c.a) * 60, f.y + Math.sin(c.a) * 60, 6); return; }
    const b = Math.min(5, t.st.burn);
    for (let i = 0; i < amt(14 + b * 4, c.am); i++) { const aa = -Math.PI / 2 + rr(-0.5, 0.5), v = rr(100, 260); fx({ k: 'flame', x: t.x + rr(-10, 10), y: t.y + rr(-6, 6), vx: Math.cos(aa) * v * 0.3, vy: Math.sin(aa) * v, life: 0.55, max: 0.55, size: rr(9, 14), drag: 1.5, grow: 1 }); }
    ring(t.x, t.y, 6, 50 + b * 8, '#ffd27a', 0.4, 5); embers(t.x, t.y, amt(12, c.am), { sp: 180, rise: 80 });
    if (b > 0) { hurt(t, f, 4 + 4 * b, { power: c.pw, big: b > 2.5, am: c.am }); t.st.burn = 0; words(t.x, t.y - 46, 'Ignite!', '#ffd27a', 15); }
    else hurt(t, f, 4, { power: c.pw, burn: 2, am: c.am });
  },
  'fire:fury'(c) { const f = c.f; f.st.fury = 5; f.heat = Math.min(100, f.heat + 10); f.heatT = 0; ring(f.x, f.y, 10, 54, '#ff6a2a', 0.45, 5); flames(f.x, f.y + 4, amt(16, c.am), { sp: 70, rise: 80, jit: 14, size: 10 }); words(f.x, f.y - 46, 'Fury!', '#ff8a3a', 15); SFX.drum(1); },
  'fire:meteor'(c) {
    const f = c.f, at = c.t ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 200, y: f.y + Math.sin(c.a) * 200 }, r = 88 * c.sz;
    mark(at.x, at.y, r, 1.1, 'fire');
    ENTS.push({ kind: 'meteor', owner: f, way: 'fire', x: at.x, y: at.y, life: 1.1, max: 1.1, am: c.am, sz: c.sz, from: rr(-1, 1) });
    later(1.1, () => {
      cam.shake = Math.max(cam.shake, 10); SFX.hit(true); SFX.drum(1);
      ring(at.x, at.y, 10, r * 1.4, '#fff1c4', 0.5, 12); ring(at.x, at.y, 10, r, '#ff6a2a', 0.6, 8);
      for (let i = 0; i < amt(30, c.am); i++) { const aa = rr(0, TAU), v = rr(0.3, 1) * r * 3; fx({ k: 'flame', x: at.x, y: at.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.6, max: 0.6, size: rr(11, 18), drag: 4, grow: 1.4 }); }
      rocks(at.x, at.y, amt(12, c.am), { sp: 220, up: 260, size: 5 }); smoke(at.x, at.y, amt(10, c.am), { size: 26, life: 1.8 }); embers(at.x, at.y, amt(20, c.am), { sp: 300 });
      decal('scorch', at.x, at.y, r * 1.2, { life: 14 }); decal('crack', at.x, at.y, r, { life: 14 });
      ZONES.push({ kind: 'lava', owner: f, way: 'fire', x: at.x, y: at.y, r: 40 * c.sz, life: 3, max: 3, tick: 0, P: c.pw, am: c.am * 0.6, seed: 7 });
      blastAt(f, at.x, at.y, r, 24, { power: c.pw, knock: 230, stun: 0.8, burn: 3, big: true, am: c.am });
    });
  },
  'fire:firework'(c) {
    const f = c.f, at = c.t ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 220, y: f.y + Math.sin(c.a) * 220 };
    ENTS.push({ kind: 'firework', owner: f, way: 'fire', x: f.x, y: f.y, x0: f.x, y0: f.y, tx: at.x, ty: at.y, t: 0, dur: 0.75, life: 0.75, max: 0.75, am: c.am, P: c.pw, r: 96 * c.sz });
    sparks(f.x, f.y, amt(8, c.am), { a: -Math.PI / 2, spread: 0.6, sp: 160 });
  },
  'fire:phoenix'(c) {
    const f = c.f, h = f.heat, heal = (8 + h * 0.35) * Math.min(1.05, c.P) * WAYMOD.fire.heal;
    f.hp = Math.min(f.maxHp, f.hp + heal); f.st.burn = 0; f.heat = 0; f.heatT = 9; SFX.heal();
    words(f.x, f.y - 40, '+' + Math.round(heal), '#9dffc2', 15);
    for (const side of [-1, 1]) for (let i = 0; i < amt(14, c.am); i++) { const u = i / 14, aa = -Math.PI / 2 + side * (0.6 + u * 1.2), v = 120 + u * 120; fx({ k: 'flame', x: f.x + side * u * 20, y: f.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v - 40, life: 0.7, max: 0.7, size: 10 - u * 4, drag: 2, grow: 0.5 }); }
    embers(f.x, f.y, amt(16, c.am), { sp: 100, rise: 90 }); ring(f.x, f.y, 10, 60, '#ffd27a', 0.6, 4);
  },
  'fire:brand'(c) {
    const { f, t } = c;
    if (!t || t.isPhantom || gone(t) || dist(f, t) > 460) { flames(f.x + Math.cos(c.a) * 50, f.y + Math.sin(c.a) * 50, 5); return; }
    if (t.isDecoy) { hurt(t, f, 0); return; }
    t.st.brand = 5; t.brandBy = f; ring(t.x, t.y, 34, 6, '#ffb04a', 0.45, 4); flames(t.x, t.y - 18, amt(8, c.am), { sp: 30, rise: 40, size: 7 }); words(t.x, t.y - 48, 'Branded', '#ffb04a', 14);
  },
  'fire:inferno'(c) {
    const f = c.f, R = 215, P = c.pw;
    cam.shake = Math.max(cam.shake, 9); SFX.gong();
    for (let i = 0; i < 5; i++) { const aa = -Math.PI / 2 + i * TAU / 5; for (let k = 0; k < amt(12, c.am); k++) { const v = 200 + k * 30; fx({ k: 'flame', x: f.x, y: f.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: R / v, max: R / v, size: 13, drag: 0.4, grow: 1.2 }); } }
    ring(f.x, f.y, 20, R, '#ff6a2a', 0.6, 10); ring(f.x, f.y, 10, R * 0.7, '#ffd27a', 0.5, 6); decal('scorch', f.x, f.y, R * 0.8, { life: 12 });
    blastAt(f, f.x, f.y, R, 26, { power: P, knock: 160, burn: 5, big: true, am: c.am });
    later(0.6, () => { ring(f.x, f.y, 10, 160, '#fff1c4', 0.45, 9); for (let i = 0; i < amt(24, c.am); i++) { const aa = rr(0, TAU), v = rr(200, 420); fx({ k: 'flame', x: f.x, y: f.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.4, max: 0.4, size: 14, drag: 4, grow: 1.4 }); } smoke(f.x, f.y, 8, { size: 24 }); blastAt(f, f.x, f.y, 160, 8, { power: P, knock: 120, am: c.am }); });
  },

  // ═══ EARTH ═══
  'earth:fist'(c) { melee(c, { reach: 58, lunge: 32, dmg: 10, hit: { knock: 170 }, fx: (x, y, hit) => { rocks(x, y, amt(6, c.am), { a: c.a, spread: 0.8, sp: 130, up: 120, size: 3.5 }); dust(x, y, amt(4, c.am), { size: 10 }); slash(x, y, c.a, '#d8b878', 24); if (hit) decal('crack', x, y, 22, { life: 5 }); } }); },
  'earth:rock'(c) {
    const f = c.f, s = nearestStone(f, f, 130), high = f.st.high > 0 ? 1.3 : 1;
    if (s) { removeStone(s, true); dust(s.x, s.y, 6); rocks(s.x, s.y, 4, { up: 160 }); bolt(c, { kind: 'boulder', speed: 420, r: 14, dmg: 17 * high, from: { x: s.x, y: s.y }, hit: { stun: 0.4, knock: 220, big: true } }); words(f.x, f.y - 44, 'Stone thrown', ELC.earth.light, 12); }
    else { bolt(c, { kind: 'rock', speed: 430, r: 9, dmg: 12 * high, hit: { stun: 0.3, knock: 130 } }); rocks(f.x, f.y, amt(4, c.am), { up: 140, sp: 50, size: 3 }); dust(f.x, f.y, amt(3, c.am)); decal('crack', f.x + Math.cos(c.a) * 14, f.y + Math.sin(c.a) * 14, 16, { life: 5 }); }
  },
  'earth:wall'(c) {
    const f = c.f, a = c.t ? angTo(f, c.t) : f.face, d = c.t ? Math.min(75, dist(f, c.t) * 0.45) : 75;
    stoneAt(f, 'wall', f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, { a: a + Math.PI / 2, len: 118 * c.sz, hp: 44 * c.sz, life: 12 });
    rocks(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, amt(8, c.am), { up: 200 }); dust(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, amt(8, c.am), { sp: 80 }); cam.shake = Math.max(cam.shake, 2);
  },
  'earth:spike'(c) {
    const f = c.f, at = c.t ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 160, y: f.y + Math.sin(c.a) * 160 }, r = 38 * c.sz;
    mark(at.x, at.y, r, 0.35, 'earth'); decal('crack', at.x, at.y, 30, { life: 8 });
    later(0.35, () => {
      ENTS.push({ kind: 'spike', owner: f, way: 'earth', x: at.x, y: at.y, life: 0.6, max: 0.6, sz: c.sz });
      rocks(at.x, at.y, amt(10, c.am), { sp: 140, up: 260 }); dust(at.x, at.y, amt(6, c.am));
      blastAt(f, at.x, at.y, r, 13, { power: c.pw, knock: 90, ground: true, big: true, am: c.am });
      later(0.4, () => stoneAt(f, 'rock', at.x, at.y, { r: 15, hp: 24, life: 10 }));
    });
  },
  'earth:skin'(c) { const f = c.f; f.st.armor = 5; f.st.armorK = 0.5; f.st.armorKind = 'stone'; dust(f.x, f.y, amt(8, c.am), { sp: 60 }); rocks(f.x, f.y, amt(6, c.am), { sp: 40, up: 100, size: 3 }); f.pose = 'guard'; f.poseT = 0; },
  'earth:quake'(c) {
    const f = c.f; f.pose = 'kick'; f.poseT = 0; cam.shake = Math.max(cam.shake, 5); SFX.drum(1);
    ENTS.push({ kind: 'quake', owner: f, way: 'earth', x: f.x, y: f.y, r: 10, max: 178 * c.sz, speed: 400, life: 0.6, hit: false, P: c.pw, am: c.am });
    decal('crack', f.x, f.y, 70 * c.sz, { life: 9 });
  },
  'earth:statue'(c) { const f = c.f; f.st.statue = 1.6; f.dash = null; f.kx = f.ky = 0; f.statueHeal = 8 * Math.min(1.05, c.P); dust(f.x, f.y, amt(6, c.am), { sp: 50 }); burst(f.x, f.y, '#9fe0b8', amt(10, c.am), 80, 0.6, 6); words(f.x, f.y - 46, 'Jade', '#9fe0b8', 14); f.pose = 'guard'; f.poseT = 0; },
  'earth:shatter'(c) {
    const f = c.f, t = c.t, mine = myStones(f); let n = 0;
    if (!mine.length) { words(f.x, f.y - 40, 'No stones to break', C.muted, 12); dust(f.x, f.y, 3); return; }
    cam.shake = Math.max(cam.shake, 4 + mine.length);
    for (const s of mine) {
      rocks(s.x, s.y, amt(14, c.am), { sp: 260, up: 220, size: 4 }); dust(s.x, s.y, amt(6, c.am), { sp: 90 }); ring(s.x, s.y, 6, 110, '#e6cf9c', 0.35, 4);
      if (t && !gone(t) && Math.hypot(t.x - s.x, t.y - s.y) < 115 + (s.len || 0) / 2) n++;
      removeStone(s, true);
    }
    n = Math.min(3, n);
    if (n && t) { hurt(t, f, 9 * n, { power: c.pw, knock: 160, ang: angTo(f, t), big: n > 1, am: c.am }); words(t.x, t.y - 46, n > 1 ? `${n} stones!` : 'Shards!', ELC.earth.light, 14); }
  },
  'earth:boulder'(c) {
    const f = c.f, s = nearestStone(f, f, 220), from = s ? { x: s.x, y: s.y } : { x: f.x + Math.cos(c.a) * 24, y: f.y + Math.sin(c.a) * 24 };
    if (s) removeStone(s, true);
    const a = c.t ? Math.atan2(c.t.y - from.y, c.t.x - from.x) : c.a;
    ENTS.push({ kind: 'boulder', owner: f, way: 'earth', x: from.x, y: from.y, a, speed: 310, travel: 0, max: 540, r: 17 * c.sz, rot: 0, life: 3, max2: 3, P: c.pw, am: c.am, hit: false, seed: (Math.random() * 999) | 0 });
    dust(from.x, from.y, amt(6, c.am), { sp: 80 });
  },
  'earth:quicksand'(c) {
    const f = c.f, at = c.t && dist(f, c.t) < 380 ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 160, y: f.y + Math.sin(c.a) * 160 };
    ZONES.push({ kind: 'quicksand', owner: f, way: 'earth', x: at.x, y: at.y, r: 70 * c.sz, life: 4, max: 4, tick: 0, P: c.pw, am: c.am, caught: false });
    dust(at.x, at.y, amt(10, c.am), { sp: 80 }); decal('swirl', at.x, at.y, 70 * c.sz, { life: 8 });
  },
  'earth:sand'(c) {
    const f = c.f, len = 175 * c.sz, half = 0.45;
    sand(f.x + Math.cos(c.a) * 16, f.y + Math.sin(c.a) * 16, c.a, half, amt(60, c.am), len * 2.4); dust(f.x + Math.cos(c.a) * len * 0.6, f.y + Math.sin(c.a) * len * 0.6, amt(6, c.am), { a: c.a, spread: 0.5, sp: 90 });
    if (c.t && inCone(c, len, half)) { hurt(c.t, f, 5, { power: c.pw, blind: 3, shot: true, am: c.am }); words(c.t.x, c.t.y - 44, 'Blinded', ELC.earth.light, 13); }
  },
  'earth:pillar'(c) {
    const f = c.f; stoneAt(f, 'pillar', f.x, f.y, { r: 21, hp: 50, life: 12 }); f.st.high = 3.5;
    rocks(f.x, f.y, amt(10, c.am), { sp: 110, up: 220 }); dust(f.x, f.y, amt(8, c.am), { sp: 90 }); cam.shake = Math.max(cam.shake, 3);
  },
  'earth:grip'(c) {
    const { f, t } = c;
    if (!t || dist(f, t) > 330 || gone(t) || aloft(t)) { dust(f.x + Math.cos(c.a) * 80, f.y + Math.sin(c.a) * 80, 4); return; }
    hurt(t, f, 4, { power: c.pw, root: 1.6 * (0.6 + 0.4 * Math.min(1, c.P)), am: c.am }); ENTS.push({ kind: 'hands', owner: f, way: 'earth', x: t.x, y: t.y, life: 1.6, max: 1.6, target: t });
    rocks(t.x, t.y, amt(6, c.am), { sp: 50, up: 140, size: 3 }); dust(t.x, t.y, amt(4, c.am));
  },
  'earth:landslide'(c) {
    const f = c.f, at = c.t && dist(f, c.t) < 400 ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 170, y: f.y + Math.sin(c.a) * 170 }, R = 90 * c.sz;
    mark(at.x, at.y, R, 1.1, 'earth');
    for (let i = 0; i < 6; i++) later(0.15 + i * 0.16, () => {
      const tt = aimOf(f), aim = tt && Math.random() < 0.6 ? { x: tt.x + rr(-14, 14), y: tt.y + rr(-14, 14) } : { x: at.x + rr(-R, R) * 0.8, y: at.y + rr(-R, R) * 0.8 };
      ENTS.push({ kind: 'fall', owner: f, way: 'earth', x: aim.x, y: aim.y, life: 0.25, max: 0.25, size: rr(9, 14) * c.sz, seed: (Math.random() * 999) | 0 });
      later(0.25, () => { rocks(aim.x, aim.y, amt(5, c.am), { sp: 120, up: 160 }); dust(aim.x, aim.y, amt(3, c.am)); cam.shake = Math.max(cam.shake, 2.5); blastAt(f, aim.x, aim.y, 30, 3.6, { power: c.pw, knock: 90, am: c.am }); if (i === 2 || i === 5) stoneAt(f, 'rock', aim.x, aim.y, { r: 14, hp: 20, life: 9 }); });
    });
  },
  'earth:burrow'(c) {
    const { f, t } = c; f.st.under = 0.6; dust(f.x, f.y, amt(10, c.am), { sp: 90 }); rocks(f.x, f.y, amt(6, c.am), { up: 180 }); decal('crack', f.x, f.y, 26, { life: 6 });
    const dest = t && !gone(t) ? { x: t.x - Math.cos(angTo(f, t)) * 30, y: t.y - Math.sin(angTo(f, t)) * 30 } : { x: f.x + Math.cos(c.a) * 220, y: f.y + Math.sin(c.a) * 220 };
    f.burrowTo = dest;
    later(0.6, () => {
      f.x = dest.x; f.y = dest.y; f.st.under = 0; f.burrowTo = null; cam.shake = Math.max(cam.shake, 4);
      rocks(f.x, f.y, amt(12, c.am), { sp: 160, up: 240 }); dust(f.x, f.y, amt(8, c.am), { sp: 100 }); decal('crack', f.x, f.y, 34, { life: 7 });
      blastAt(f, f.x, f.y, 52, 8, { power: c.pw, launch: 0.5, knock: 140, am: c.am });
    });
  },
  'earth:crystal'(c) { bolt(c, { kind: 'crystal', speed: 680, r: 7, dmg: 15, through: true, hit: { knock: 160 } }); sparks(c.f.x, c.f.y, amt(6, c.am), { a: c.a, spread: 0.4, col: '#e7d8ff' }); },
  'earth:stance'(c) { const f = c.f; f.st.stance = 3.5; f.st.regen = 3.5; f.st.regenRate = 4 * Math.min(1.05, c.P); dust(f.x, f.y, amt(8, c.am), { sp: 50 }); ring(f.x, f.y, 10, 44, '#c9a35c', 0.5, 4); decal('crack', f.x, f.y, 30, { life: 5 }); },
  'earth:weight'(c) {
    const { f, t } = c;
    if (!t || gone(t) || dist(f, t) > 420) { dust(f.x + Math.cos(c.a) * 60, f.y + Math.sin(c.a) * 60, 4); return; }
    if (hurt(t, f, 3, { power: c.pw, heavy: 4, am: c.am }) && !t.isDecoy && !t.isPhantom && t.st.heavy > 0) { words(t.x, t.y - 48, 'Heavy!', ELC.earth.light, 14); rocks(t.x, t.y, amt(6, c.am), { sp: 40, up: 120, size: 3 }); }
  },
  'earth:toss'(c) {
    const { f, t } = c; f.pose = 'strike2'; f.poseT = 0;
    if (!closeIn(f, t, 60, 40) || t.isDecoy || t.isPhantom) { slash(f.x + Math.cos(c.a) * 30, f.y + Math.sin(c.a) * 30, c.a, '#d8b878', 24); if (t && (t.isDecoy || t.isPhantom)) hurt(t, f, 0); return; }
    const a = angTo(t, f), steady = t.st.stance > 0 || (t.st.armor > 0 && t.st.armorKind === 'stone') || t.st.free > 0;
    const land = { x: f.x + Math.cos(a) * 105, y: f.y + Math.sin(a) * 105 }, into = STONES.some(st => stoneHit(st, land.x, land.y, t.r + 8)) || SOLIDS.some(so => Math.hypot(so.x - land.x, so.y - land.y) < so.r + t.r + 6);
    const from = { x: t.x, y: t.y };
    if (!hurt(t, f, into && !steady ? 19 : 11, { power: c.pw, stun: 0.6, big: true, melee: true, am: c.am, ang: a })) return;
    const at = steady ? from : land;
    if (!steady) { t.kx = t.ky = 0; dashTo(t, land.x, land.y, 0.28); t.st.air = Math.max(t.st.air, 0.28); t.st.airMax = 0.28; }
    later(steady ? 0 : 0.28, () => { dust(at.x, at.y, amt(8, c.am), { sp: 90 }); rocks(at.x, at.y, amt(5, c.am), { up: 140 }); decal('crack', at.x, at.y, 26, { life: 6 }); cam.shake = Math.max(cam.shake, into && !steady ? 7 : 4); if (into && !steady) words(at.x, at.y - 48, 'Into the stone!', ELC.earth.light, 14); });
  },
  'earth:mountain'(c) {
    const f = c.f, at = c.t ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 200, y: f.y + Math.sin(c.a) * 200 }, R = 122;
    SFX.gong(); mark(at.x, at.y, R, 0.9, 'earth'); decal('crack', at.x, at.y, R, { life: 12 });
    ENTS.push({ kind: 'mountain', owner: f, way: 'earth', x: at.x, y: at.y, life: 0.9, max: 0.9, am: c.am });
    later(0.9, () => {
      cam.shake = Math.max(cam.shake, 12); SFX.drum(2);
      rocks(at.x, at.y, amt(26, c.am), { sp: 260, up: 280, size: 6 }); dust(at.x, at.y, amt(16, c.am), { sp: 160, size: 18 }); ring(at.x, at.y, 20, R * 1.3, '#e6cf9c', 0.6, 10);
      blastAt(f, at.x, at.y, R, 30, { power: c.pw, stun: 2, knock: 60, big: true, am: c.am });
      for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + 0.4; stoneAt(f, 'rock', at.x + Math.cos(aa) * 92, at.y + Math.sin(aa) * 92, { r: 16, hp: 26, life: 10 }); }
    });
  },

  // ═══ AIR ═══
  'air:blade'(c) { bolt(c, { kind: 'blade', speed: 600, r: 8, dmg: 7, life: 1.2, hit: { knock: 80, airHit: true } }); streaks(c.f.x, c.f.y, c.a, amt(4, c.am), { spread: 0.3 }); },
  'air:gust'(c) {
    const f = c.f, len = 215 * c.sz, half = 0.5;
    streaks(f.x + Math.cos(c.a) * 18, f.y + Math.sin(c.a) * 18, c.a, amt(24, c.am), { spread: half, sp: 520, len: 34, life: 0.45, w: 14 }); leaves(f.x, f.y, amt(6, c.am), { a: c.a, spread: half, sp: 300 }); dust(f.x + Math.cos(c.a) * 40, f.y + Math.sin(c.a) * 40, amt(4, c.am), { a: c.a, spread: 0.4, sp: 160 });
    if (c.t && inCone(c, len, half)) hurt(c.t, f, 4, { power: c.pw, knock: 340, ang: c.a, shot: true, am: c.am, airHit: true });
  },
  'air:feather'(c) {
    const { f, t } = c, away = t ? angTo(t, f) + rr(-0.7, 0.7) : f.face + Math.PI, d = 170 * (0.8 + 0.2 * c.sz);
    for (let i = 1; i <= 3; i++) GHOSTS.push({ x: f.x + Math.cos(away) * d * i / 4, y: f.y + Math.sin(away) * d * i / 4, face: f.face, gi: f.gi, col: '#fbf6d8', life: 0.35, max: 0.4 });
    dashTo(f, f.x + Math.cos(away) * d, f.y + Math.sin(away) * d, 0.18, { invuln: 0.45 });
    f.wind = Math.min(100, f.wind + 20); leaves(f.x, f.y, amt(8, c.am), { a: away + Math.PI, spread: 0.8 }); streaks(f.x, f.y, away, amt(8, c.am)); SFX.dodge();
  },
  'air:meialua'(c) {
    const f = c.f, reach = 98 * c.sz; f.pose = 'kick'; f.poseT = 0;
    for (let i = 0; i < amt(14, c.am); i++) { const aa = c.a - 1 + 2 * i / 14; streaks(f.x + Math.cos(aa) * 30, f.y + Math.sin(aa) * 30, aa + Math.PI / 2, 1, { sp: 200, len: 22, spread: 0.1 }); }
    slash(f.x + Math.cos(c.a) * 30, f.y + Math.sin(c.a) * 30, c.a, '#fbf6d8', 52, 0.32); leaves(f.x, f.y, amt(5, c.am), { a: c.a, spread: 1 });
    const t = c.t;
    if (t && !gone(t) && !(t.st.high > 0) && dist(f, t) - t.r < reach && Math.abs(((angTo(f, t) - c.a + 3 * Math.PI) % TAU) - Math.PI) < 1.05) hurt(t, f, 9, { power: c.pw, knock: 230, ang: c.a, melee: true, am: c.am, airHit: true });
  },
  'air:updraft'(c) {
    const f = c.f, at = c.t && dist(f, c.t) < 340 ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 150, y: f.y + Math.sin(c.a) * 150 };
    mark(at.x, at.y, 46 * c.sz, 0.25, 'air');
    later(0.25, () => { ENTS.push({ kind: 'column', owner: f, way: 'air', x: at.x, y: at.y, life: 0.9, max: 0.9, am: c.am, sz: c.sz }); dust(at.x, at.y, amt(6, c.am), { sp: 90 }); leaves(at.x, at.y, amt(6, c.am)); blastAt(f, at.x, at.y, 50 * c.sz, 5, { power: c.pw, launch: 1.1, am: c.am }); });
  },
  'air:airshield'(c) { const f = c.f; f.st.deflect = 3; f.st.armor = Math.max(f.st.armor, 3); f.st.armorK = 0.3; f.st.armorKind = 'wind'; swirl(f.x, f.y, 34, amt(16, c.am), { spin: 10, vr: 0, life: 0.8 }); f.pose = 'guard'; f.poseT = 0; },
  'air:breath'(c) {
    const f = c.f, heal = 12 * Math.min(1.05, c.P) * WAYMOD.air.heal;
    f.hp = Math.min(f.maxHp, f.hp + heal); for (const k of ['burn', 'soak', 'slow', 'blind', 'root', 'heavy', 'brand', 'silence', 'crosswind']) f.st[k] = 0; SFX.heal();
    words(f.x, f.y - 40, 'Cleansed', '#bff0b0', 14); swirl(f.x, f.y, 36, amt(16, c.am), { col: 'rgba(190,255,200,0.9)', spin: 7, vr: 30 }); leaves(f.x, f.y, amt(10, c.am), { col: '#bff0b0' });
  },
  'air:tornado'(c) { const f = c.f; ENTS.push({ kind: 'tornado', owner: f, way: 'air', x: f.x + Math.cos(c.a) * 30, y: f.y + Math.sin(c.a) * 30, a: c.a, straight: true, speed: 150, life: 3 * (0.8 + 0.2 * c.sz), max: 3, tick: 0, r: 42 * c.sz, P: c.pw, am: c.am, spin: 0 }); dust(f.x, f.y, amt(6, c.am)); },
  'air:flurry'(c) {
    const { f, A } = c; A.chan = 0.6; let n = 0, next = 0;
    A.tick = dt => { A.chan -= dt; next -= dt; if (next <= 0 && n < 5) { next = 0.11; n++; const t = aimOf(f), a = t ? angTo(f, t) : f.face; f.face = a; f.pose = n % 2 ? 'strike' : 'strike2'; f.poseT = 0;
      const hx = f.x + Math.cos(a) * 30, hy = f.y + Math.sin(a) * 30; slash(hx, hy, a + (n % 2 ? 0.5 : -0.5), '#fbf6d8', 20, 0.2); streaks(hx, hy, a, amt(3, c.am), { sp: 300, len: 18 });
      if (closeIn(f, t, 62, 22)) hurt(t, f, 3, { power: c.pw, knock: 40, ang: a, melee: true, am: c.am, airHit: true }); } };
  },
  'air:vacuum'(c) {
    const { f, t } = c;
    if (!t || gone(t) || dist(f, t) > 400) { streaks(f.x, f.y, c.a, 6); return; }
    for (let i = 0; i < amt(18, c.am); i++) { const aa = rr(0, TAU), d = rr(50, 120); fx({ k: 'streak', x: t.x + Math.cos(aa) * d, y: t.y + Math.sin(aa) * d, vx: -Math.cos(aa) * d * 3, vy: -Math.sin(aa) * d * 3, life: 0.32, max: 0.32, len: 20, curl: 0.3, drag: 0, col: 'rgba(255,255,255,0.9)' }); }
    if (hurt(t, f, 4, { power: c.pw, silence: 1.6, am: c.am }) && !t.isDecoy && !t.isPhantom) words(t.x, t.y - 48, 'Silenced', '#fbf6d8', 14);
  },
  'air:twin'(c) { bolt(c, { kind: 'blade', n: 2, spread: 0.9, speed: 520, r: 7, dmg: 6, life: 1.3, home: 7.5, hit: { knock: 70, airHit: true } }); },
  'air:walk'(c) { const f = c.f; f.st.haste = 5; streaks(f.x, f.y, f.face + Math.PI, amt(12, c.am), { spread: 0.6 }); leaves(f.x, f.y, amt(6, c.am)); },
  'air:downdraft'(c) {
    const f = c.f, at = c.t ? { x: c.t.x, y: c.t.y } : { x: f.x + Math.cos(c.a) * 160, y: f.y + Math.sin(c.a) * 160 };
    mark(at.x, at.y, 50 * c.sz, 0.3, 'air');
    later(0.3, () => {
      ENTS.push({ kind: 'press', owner: f, way: 'air', x: at.x, y: at.y, life: 0.4, max: 0.4, sz: c.sz }); dust(at.x, at.y, amt(10, c.am), { sp: 150 }); ring(at.x, at.y, 60, 8, '#ffffff', 0.3, 5);
      const t = foeOf(f), wasUp = t && t.st.air > 0;
      if (blastAt(f, at.x, at.y, 50 * c.sz, wasUp ? 18 : 9, { power: c.pw, stun: wasUp ? 0.9 : 0, big: wasUp, am: c.am, airHit: true }) && wasUp) { t.st.air = 0; words(t.x, t.y - 46, 'Slammed!', '#fbf6d8', 15); cam.shake = Math.max(cam.shake, 6); decal('crack', t.x, t.y, 30, { life: 6 }); }
    });
  },
  'air:crosswind'(c) {
    const { f, t } = c;
    if (!t || gone(t) || t.isDecoy || t.isPhantom) { swirl(f.x + Math.cos(c.a) * 60, f.y + Math.sin(c.a) * 60, 30, 6); return; }
    if (t.st.free > 0) { words(t.x, t.y - 44, 'Weightless', '#fbf6d8', 12); return; }
    t.st.crosswind = 5; swirl(t.x, t.y, 30, amt(12, c.am), { spin: 9, vr: 0, life: 0.7 }); words(t.x, t.y - 48, 'Crosswind', '#fbf6d8', 13);
  },
  'air:crane'(c) {
    const f = c.f; f.st.leap = 0.7; f.leapFrom = { x: f.x, y: f.y }; dust(f.x, f.y, amt(8, c.am), { sp: 90 }); leaves(f.x, f.y, amt(8, c.am)); f.wind = Math.min(100, f.wind + 15);
    later(0.7, () => {
      const t = aimOf(f); if (t && !gone(t)) { const a = angTo(t, f); f.x = t.x + Math.cos(a) * 20; f.y = t.y + Math.sin(a) * 20; }
      f.st.leap = 0; cam.shake = Math.max(cam.shake, 5); ring(f.x, f.y, 8, 70 * c.sz, '#ffffff', 0.4, 6); dust(f.x, f.y, amt(10, c.am), { sp: 140 }); leaves(f.x, f.y, amt(10, c.am), { sp: 200 });
      blastAt(f, f.x, f.y, 64 * c.sz, 15, { power: c.pw, knock: 210, stun: 0.4, big: true, am: c.am, airHit: true });
    });
  },
  'air:whistle'(c) {
    const { f, t } = c;
    for (let i = 0; i < 3; i++) later(i * 0.06, () => ring(f.x + Math.cos(c.a) * (40 + i * 60), f.y + Math.sin(c.a) * (40 + i * 60), 4, 26, '#ffffff', 0.25, 3));
    if (!t || dist(f, t) > 400 || gone(t)) return;
    if (t.act && t.act.phase === 'wind') { t.act = null; t.glyph = null; hurt(t, f, 4, { power: c.pw, stun: 0.3, am: c.am }); words(t.x, t.y - 46, 'Interrupted!', '#fbf6d8', 15); }
    else hurt(t, f, 4, { power: c.pw, am: c.am });
  },
  'air:gale'(c) { WAVES.push({ kind: 'gale', owner: c.f, way: 'air', x: c.f.x + Math.cos(c.a) * 24, y: c.f.y + Math.sin(c.a) * 24, a: c.a, speed: 380, travel: 0, max: 560, width: 230 * c.sz, dmg: 6, P: c.pw, am: c.am, hit: false, opts: { knock: 120 } }); },
  'air:echo'(c) {
    const f = c.f, last = f.lastSpell;
    if (!last || last.tag === 'Ultimate') { words(f.x, f.y - 40, 'Nothing to echo', C.muted, 12); return; }
    words(f.x, f.y - 50, 'Echo: ' + last.name, '#fbf6d8', 13); swirl(f.x, f.y, 30, amt(8, c.am), { spin: 6, vr: 0 });
    later(0.15, () => { if (f.hp <= 0 || !canCast(f)) return; f.act = { move: last, power: c.P * 0.7, target: c.A.target, phase: 'go', t: timing(last)[1], wind: 0, hits: 0, next: 0, echo: true }; cast(f, f.act); });
  },
  'air:weightless'(c) { const f = c.f; f.st.free = 4; for (const k of ['slow', 'root', 'heavy', 'stun', 'lavaSlow', 'sandSlow']) f.st[k] = 0; leaves(f.x, f.y, amt(12, c.am), { sp: 90 }); swirl(f.x, f.y, 30, amt(12, c.am), { spin: 7, vr: 20 }); words(f.x, f.y - 46, 'Weightless', '#fbf6d8', 14); },
  'air:typhoon'(c) {
    const f = c.f, t = c.t, w = f.wind, P = c.pw * (1 + w / 400);
    f.wind = 0; cam.shake = Math.max(cam.shake, 8); SFX.gong();
    const at = t ? { x: t.x, y: t.y } : { x: f.x + Math.cos(c.a) * 180, y: f.y + Math.sin(c.a) * 180 };
    ENTS.push({ kind: 'typhoon', owner: f, way: 'air', x: at.x, y: at.y, life: 2.3, max: 2.3, tick: 0, P, am: c.am, r: 120, caught: false });
  },
};
// drag a fighter toward a point, stopping short by `keep`
function pullTo(t, to, keep, k) { const a = Math.atan2(to.y - t.y, to.x - t.x), d = Math.max(0, Math.hypot(to.x - t.x, to.y - t.y) - keep); if (t.isDecoy || t.isPhantom || unmoved(t)) return; t.kx += Math.cos(a) * d * k; t.ky += Math.sin(a) * d * k; }

// ── things in flight, on the floor, and on the move ──
function stepTimers(dt) { const due = []; for (const q of TIMERS) { q.t -= dt; if (q.t <= 0) due.push(q); } TIMERS = TIMERS.filter(q => q.t > 0); for (const q of due) if (!FIGHT || FIGHT.on || FIGHT.over) { CUR = q.spell; q.fn(); stamp(q.spell); CUR = null; } }
function shotHits(s, t) {
  if (!t || t.hp <= 0 || gone(t)) return false;
  if (s.missed === t) return false;
  if (Math.hypot(s.x - t.x, s.y - t.y) > t.r + s.r) return false;
  if (t.st.high > 0 && !(s.owner.st && s.owner.st.high > 0)) { if (!s.under) { s.under = true; words(t.x, t.y - 40, 'Below you', ELC.earth.light, 11); } return false; }
  if (t.st.veil > 0 && Math.random() < t.st.veilK) { s.missed = t; words(t.x, t.y - 34, 'Missed', '#e8e2f2', 12); return false; }
  return true;
}
function stepShots(dt) {
  for (const s of SHOTS) {
    CUR = s.spell;
    s.t += dt; s.life -= dt;
    if (s.kind === 'glob') { const k = Math.min(1, s.t / s.dur); s.x = lerp(s.x0, s.tx, k); s.y = lerp(s.y0, s.ty, k); s.z = Math.sin(k * Math.PI) * 50; if (k >= 1) { s.life = 0; s.land(s); } continue; }
    s.trail.unshift({ x: s.x, y: s.y }); if (s.trail.length > 10) s.trail.pop();
    if (s.home && s.target && s.target.hp > 0 && s.t > 0.08) { const want = Math.atan2(s.target.y - s.y, s.target.x - s.x), cur = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy); let d = ((want - cur + 3 * Math.PI) % TAU) - Math.PI; d = clamp(d, -s.home * dt, s.home * dt); s.vx = Math.cos(cur + d) * sp; s.vy = Math.sin(cur + d) * sp; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.spin += dt * 10;
    // what it trails
    const am = s.am ?? 1;
    if (s.kind === 'fireball' && Math.random() < 0.9 * am + 0.1) { flames(s.x, s.y, 1, { sp: 20, rise: 20, size: s.r * 1.1, life: 0.35 }); if (Math.random() < 0.2) smoke(s.x, s.y, 1, { size: 8, life: 0.6 }); }
    else if (s.kind === 'ember' && Math.random() < 0.5) embers(s.x, s.y, 1, { sp: 30, life: 0.4 });
    else if (s.kind === 'drop' && Math.random() < 0.5 * am) drops(s.x, s.y, 1, { sp: 30, up: 30, z: 6, size: 2 });
    else if (s.kind === 'ice' && Math.random() < 0.35) burst(s.x, s.y, '#cfefff', 1, 30, 0.3, 4);
    else if ((s.kind === 'rock' || s.kind === 'boulder') && Math.random() < 0.3) dust(s.x, s.y, 1, { size: 7, sp: 10, life: 0.5 });
    else if (s.kind === 'blade' && Math.random() < 0.5) streaks(s.x, s.y, Math.atan2(s.vy, s.vx) + Math.PI, 1, { sp: 80, len: 14 });
    else if (s.kind === 'crystal' && Math.random() < 0.5) sparks(s.x, s.y, 1, { sp: 40, col: '#e7d8ff', life: 0.3 });
    const t = foeOf(s.owner);
    if (s.harmless) continue;
    if (t && shotHits(s, t)) {
      if (t.st.reflect > 0 && !s.reflected) { t.st.reflect = 0; s.owner = t; s.vx = -s.vx * 1.1; s.vy = -s.vy * 1.1; s.dmg *= 1.2; s.reflected = true; s.target = foeOf(t); s.life = 1.4; s.way = s.way; splash(s.x, s.y, 10); words(t.x, t.y - 36, 'Turned back', ELC.water.light, 13); continue; }
      if (t.st.deflect > 0 && Math.random() < 0.8) { const a = Math.atan2(s.vy, s.vx) + (Math.random() < 0.5 ? 1 : -1) * rr(1.1, 1.8), sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.harmless = true; s.life = 0.5; streaks(s.x, s.y, a, 5); words(t.x, t.y - 34, 'Turned aside', ELC.air.light, 12); continue; }
      s.life = 0; shotLand(s, t);
      continue;
    }
    if (hitDecoy(s.owner, s.x, s.y, s.r)) { s.life = 0; if (s.explode) shotLand(s, null); continue; }
    if (!s.through) for (const st of STONES) if (stoneHit(st, s.x, s.y, s.r)) { s.life = 0; st.hp -= s.dmg * (s.way === 'air' ? 2 : 1); shotFizz(s); if (st.hp <= 0) removeStone(st); break; }
    if (s.life <= 0) continue;
    for (const sol of SOLIDS) if (Math.hypot(s.x - sol.x, s.y - sol.y) < sol.r + s.r) { s.life = 0; shotFizz(s); }
    if (s.life <= 0 && s.explode) shotLand(s, null);
  }
  CUR = null;
  SHOTS = SHOTS.filter(s => s.life > 0);
}
function shotFizz(s) { if (s.way === 'water') splash(s.x, s.y, 6, { r: 14 }); else if (s.way === 'fire') { flames(s.x, s.y, 4, { sp: 60 }); smoke(s.x, s.y, 1); } else if (s.way === 'earth') rocks(s.x, s.y, 4, { up: 120, sp: 90, size: 3 }); else streaks(s.x, s.y, rr(0, TAU), 4, { spread: 3 }); }
function shotLand(s, t) {
  const o = { ...s.hit, power: s.P, ang: Math.atan2(s.vy, s.vx), shot: true, am: s.am };
  if (s.explode) {
    const r = s.explode;
    if (s.kind === 'fireball') { ring(s.x, s.y, 6, r, '#ffd27a', 0.35, 6); for (let i = 0; i < amt(16, s.am); i++) { const aa = rr(0, TAU), v = rr(0.3, 1) * r * 3; fx({ k: 'flame', x: s.x, y: s.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.4, max: 0.4, size: rr(8, 13), drag: 4, grow: 1.4 }); } smoke(s.x, s.y, amt(4, s.am), { size: 16 }); embers(s.x, s.y, amt(8, s.am)); decal('scorch', s.x, s.y, r * 0.9, { life: 7 }); }
    else { ring(s.x, s.y, 6, r * 1.3, '#ffffff', 0.35, 6); ring(s.x, s.y, 4, r, '#fbf6d8', 0.3, 3); streaks(s.x, s.y, 0, amt(14, s.am), { spread: 3.2, sp: 320 }); dust(s.x, s.y, amt(4, s.am), { sp: 120 }); }
    blastAt(s.owner, s.x, s.y, r, s.dmg, o);
    return;
  }
  if (t) hurt(t, s.owner, s.dmg, o);
}
function segDist(x, y, z) { const ux = Math.cos(z.a), uy = Math.sin(z.a), dx = x - z.x, dy = y - z.y, along = clamp(dx * ux + dy * uy, -z.len / 2, z.len / 2); return Math.hypot(dx - ux * along, dy - uy * along); }
const inBand = (w, x, y, r) => { const dx = x - w.x, dy = y - w.y, along = dx * Math.cos(w.a) + dy * Math.sin(w.a), across = -dx * Math.sin(w.a) + dy * Math.cos(w.a); return Math.abs(along) < 24 + r && Math.abs(across) < w.width / 2 + r; };
function stepWaves(dt) {
  for (const w of WAVES) {
    CUR = w.spell;
    const d = w.speed * dt; w.x += Math.cos(w.a) * d; w.y += Math.sin(w.a) * d; w.travel += d;
    const t = foeOf(w.owner), dec = decoyOf(t);
    if (dec && inBand(w, dec.x, dec.y, dec.r)) popDecoy(dec);
    if (t && t.hp > 0 && !gone(t) && !(w.ground && aloft(t)) && !(t.st.high > 0 && w.kind !== 'tidal')) {
      const over = inBand(w, t.x, t.y, t.r);
      if (over && !w.hit) { w.hit = true; hurt(t, w.owner, w.dmg, { ...w.opts, power: w.P, ang: w.a, big: !!w.big, wave: true, am: w.am, airHit: w.way === 'air' }); if (w.kind === 'gale' && !unmoved(t)) t.st.galeT = 1.2; }
      if (over && w.kind === 'gale' && !unmoved(t)) { t.kx += Math.cos(w.a) * 2600 * dt; t.ky += Math.sin(w.a) * 2600 * dt; }
    }
    if (w.wash && t) {
      for (const z of ZONES) if (z.owner === t && z.life > 0.3 && (z.kind === 'lava' || z.kind === 'firewall' || (z.kind === 'trail' && z.way === 'fire')) && inBand(w, z.x, z.y, z.kind === 'firewall' ? z.len / 2 : z.r * 0.5)) {
        z.life = 0.3; smoke(z.x, z.y, 4, { size: 14 }); if (!w.saidOut) { w.saidOut = true; words(z.x, z.y - 30, 'Put out', ELC.water.light, 13); }
      }
      for (const s of STONES) if (s.owner === t && !w.washed.has(s) && inBand(w, s.x, s.y, s.kind === 'wall' ? s.len / 2 : s.r)) { w.washed.add(s); s.hp -= 22; splash(s.x, s.y, 8, { r: 20 }); if (s.hp <= 0) removeStone(s); }
    }
    const am = w.am ?? 1;
    if (w.kind === 'tidal') { for (let i = 0; i < amt(3, am); i++) { const off = rr(-0.5, 0.5) * w.width; drops(w.x - Math.sin(w.a) * off, w.y + Math.cos(w.a) * off, 1, { a: w.a, spread: 0.6, sp: 80, up: 140, size: 2.4 }); } if (!w.lastMark || w.travel - w.lastMark > 80) { w.lastMark = w.travel; decal('wet', w.x, w.y, w.width * 0.3, { life: 6 }); } }
    else if (w.kind === 'gale') { for (let i = 0; i < amt(3, am); i++) { const off = rr(-0.5, 0.5) * w.width; streaks(w.x - Math.sin(w.a) * off, w.y + Math.cos(w.a) * off, w.a, 1, { sp: 480, len: 30 }); } if (Math.random() < 0.3) leaves(w.x, w.y, 1, { a: w.a, spread: 0.4, sp: 380 }); }
  }
  CUR = null;
  WAVES = WAVES.filter(w => w.travel < w.max);
}
function stepZones(dt) {
  for (const z of ZONES) {
    CUR = z.spell;
    z.life -= dt; z.tick -= dt;
    if (z.grow != null) z.grow = Math.min(1, z.grow + dt * 4);
    const t = z.owner ? foeOf(z.owner) : null, am = z.am ?? 1;
    if (z.kind === 'mark') continue;
    const inside = t && t.hp > 0 && !gone(t) && (z.kind === 'firewall' ? segDist(t.x, t.y, z) < 14 + t.r : Math.hypot(t.x - z.x, t.y - z.y) < z.r + t.r * 0.4);
    const grounded = t && !aloft(t);
    switch (z.kind) {
      case 'puddle': if (inside && grounded) { t.st.soak = Math.max(t.st.soak, 2); t.st.slow = Math.max(t.st.slow, 0.3); if (Math.random() < 0.1) ripple(t.x, t.y, 18); } if (Math.random() < 0.04) ripple(z.x + rr(-z.r, z.r) * 0.6, z.y + rr(-z.r, z.r) * 0.4, 14); break;
      case 'ice': if (inside && grounded && t.st.free <= 0) { t.st.slow = Math.max(t.st.slow, 0.5); if (!z.hits.has(t)) { z.hits.add(t); t.st.root = Math.max(t.st.root, 0.8); iceBurst(t.x, t.y, 5, { sp: 60 }); words(t.x, t.y - 40, 'Stuck in ice', '#dff6ff', 12); } } break;
      case 'whirlpool': if (inside && grounded) { const a = Math.atan2(z.y - t.y, z.x - t.x); if (!unmoved(t)) { t.kx += (Math.cos(a) * 520 - Math.sin(a) * 260) * dt * 3.4; t.ky += (Math.sin(a) * 520 + Math.cos(a) * 260) * dt * 3.4; } t.st.soak = Math.max(t.st.soak, 2); t.st.slow = Math.max(t.st.slow, 0.4); if (z.tick <= 0) { z.tick = 0.5; hurt(t, z.owner, 1.4, { power: z.P, quiet: true }); } }
        if (Math.random() < 0.5 * am + 0.2) { const a = rr(0, TAU), r = rr(0.3, 1) * z.r; fx({ k: 'foam', x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r * 0.75, vx: -Math.sin(a) * 90, vy: Math.cos(a) * 70, life: 0.5, max: 0.5, size: rr(2, 4), drag: 0.5 }); } break;
      case 'lava': if (inside && grounded) { t.st.slow = Math.max(t.st.slow, 0.4); t.st.lavaSlow = 0.3; if (z.tick <= 0) { z.tick = 0.5; hurt(t, z.owner, 2.2, { power: z.P, burn: 2, quiet: true }); } }
        if (Math.random() < 0.25 * am + 0.1) { const a = rr(0, TAU), r = rr(0, 0.8) * z.r; flames(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.75, 1, { sp: 10, rise: 40, size: 7, life: 0.5 }); } if (Math.random() < 0.08) smoke(z.x + rr(-z.r, z.r) * 0.5, z.y, 1, { size: 10 }); break;
      case 'firewall': if (inside && grounded) { const last = z.hits.get(t) || 0; if (T - last > 0.6) { z.hits.set(t, T); hurt(t, z.owner, 4, { power: z.P, burn: 3, slow: 1.2 }); } }
        for (let i = 0; i < amt(3, am); i++) { const u = rr(-0.5, 0.5); flames(z.x + Math.cos(z.a) * z.len * u, z.y + Math.sin(z.a) * z.len * u, 1, { sp: 14, rise: 70, size: rr(9, 13), life: 0.55, jit: 3 }); } break;
      case 'trail': if (inside && grounded) { const last = z.hits.get(t) || 0; if (T - last > 0.5) { z.hits.set(t, T); hurt(t, z.owner, z.way === 'fire' ? 3 : 1, { power: z.P, burn: z.way === 'fire' ? 2 : 0, soak: z.way === 'water' ? 3 : 0, quiet: true }); } }
        if (z.way === 'fire' && Math.random() < 0.35) flames(z.x, z.y, 1, { sp: 10, rise: 40, size: 7, life: 0.45 }); break;
      case 'quicksand': if (inside && grounded) { if (!z.caught) { z.caught = true; words(t.x, t.y - 40, 'Sinking!', ELC.earth.light, 13); } t.st.slow = Math.max(t.st.slow, 0.4); t.st.sandSlow = 0.3; if (z.tick <= 0) { z.tick = 0.5; hurt(t, z.owner, 1.3, { power: z.P, quiet: true }); } if (Math.random() < 0.3) sand(t.x, t.y, rr(0, TAU), 3, 2, 40); } break;
      case 'flood': if (t && !gone(t) && !(t.st.high > 0)) t.st.soak = Math.max(t.st.soak, 2); break;
    }
  }
  CUR = null;
  ZONES = ZONES.filter(z => z.life > 0);
}
function stepEnts(dt) {
  for (const e of ENTS) {
    CUR = e.spell;
    e.life -= dt;
    const t = e.owner ? foeOf(e.owner) : null, am = e.am ?? 1;
    switch (e.kind) {
      case 'cloud': if (!e.fixed && e.owner) { e.x = e.owner.x; e.y = e.owner.y; } if (e.rain && Math.random() < 0.8) fx({ k: 'drop', x: e.x + rr(-16, 16), y: e.y + rr(-8, 8), z: 60, vx: 0, vy: 0, vz: -200, g: 200, life: 0.4, max: 0.4, size: 1.7, drag: 0 }); break;
      case 'dragon': {
        const tg = aimOf(e.owner);
        if (tg && tg.hp > 0 && !gone(tg)) { const want = angTo(e, tg); let d = ((want - e.a + 3 * Math.PI) % TAU) - Math.PI; e.a += clamp(d, -5 * dt, 5 * dt); }
        else e.a += Math.sin(T * 3) * dt * 2;
        e.x += Math.cos(e.a) * e.speed * dt; e.y += Math.sin(e.a) * e.speed * dt; e.cool -= dt;
        e.segs.unshift({ x: e.x, y: e.y }); if (e.segs.length > 14) e.segs.length = 14;
        if (Math.random() < 0.5 * am + 0.2) drops(e.x, e.y, 1, { sp: 40, up: 60, z: 8, size: 2.2 });
        if (tg && tg.isDecoy && dist(e, tg) < 26 + tg.r) { popDecoy(tg); e.a += Math.PI * 0.7; }
        else if (t && e.bites > 0 && e.cool <= 0 && !gone(t) && !(t.st.high > 0) && dist(e, t) < 26 + t.r) { e.bites--; e.cool = 0.5; hurt(t, e.owner, 6, { power: e.P, soak: 3, knock: 90, ang: e.a, am }); splash(t.x, t.y, amt(10, am)); e.a += Math.PI * 0.7; }
        if (e.bites <= 0 && e.life > 0.3) e.life = 0.3;
        if (e.life <= 0) splash(e.x, e.y, amt(14, am), { r: 30 });
        break;
      }
      case 'geyser': if (Math.random() < 0.9) drops(e.x + rr(-8, 8), e.y, 2, { sp: 60, up: 360, z: 30, size: 2.6 }); break;
      case 'tornado': {
        // it sets off in a straight line and throws up whoever it passes, carrying them a little way
        const tg = aimOf(e.owner);
        if (e.straight) { e.x += Math.cos(e.a) * e.speed * dt; e.y += Math.sin(e.a) * e.speed * dt; if (FIGHT && Math.hypot(e.x - FIGHT.cx, e.y - FIGHT.cy) > FIGHT.r + 10) e.life = Math.min(e.life, 0.25); }
        else if (tg && tg.hp > 0 && !gone(tg)) { const a = angTo(e, tg); e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
        e.spin += dt * 9;
        if (Math.random() < 0.5 * am + 0.2) dust(e.x + rr(-10, 10), e.y + rr(-4, 4), 1, { size: 9, sp: 30 });
        if (Math.random() < 0.3 * am) leaves(e.x, e.y, 1, { sp: 120 });
        if (tg && tg.isDecoy && dist(e, tg) < e.r + tg.r) popDecoy(tg);
        if (t && !gone(t) && !(t.st.high > 0) && dist(e, t) < e.r + t.r) {
          if (!e.caught) { e.caught = true; hurt(t, e.owner, 7, { power: e.P, launch: 0.9, knock: 40, ang: e.a, am, airHit: true }); }
          if (t.st.air > 0 && !unmoved(t)) { t.x += (e.x - t.x) * Math.min(1, dt * 5); t.y += (e.y - t.y) * Math.min(1, dt * 5); }
        }
        if (e.life <= 0) { dust(e.x, e.y, 8, { sp: 120 }); if (t && e.caught && t.st.air > 0 && dist(e, t) < e.r + t.r + 10 && !unmoved(t)) { const a = e.a + rr(-0.8, 0.8); t.kx += Math.cos(a) * 500; t.ky += Math.sin(a) * 500; } }
        break;
      }
      case 'typhoon': {
        e.tick -= dt;
        if (Math.random() < 0.9) streaks(e.x + rr(-e.r, e.r), e.y + rr(-e.r, e.r) * 0.7, rr(0, TAU), 1, { sp: 300, len: 30 });
        if (Math.random() < 0.4 * am + 0.2) leaves(e.x, e.y, 1, { sp: 260 });
        hitDecoy(e.owner, e.x, e.y, e.r);
        if (t && !gone(t) && dist(e, t) < e.r + 40) {
          e.caught = true;
          if (!unmoved(t)) {
            t.st.stun = Math.max(t.st.stun, 0.3); t.st.air = Math.max(t.st.air, 0.4); t.st.airMax = Math.max(t.st.airMax || 0, 0.4);
            const k = (e.max - e.life) * 6, rr2 = 34; t.x += (e.x + Math.cos(k) * rr2 - t.x) * Math.min(1, dt * 6); t.y += (e.y + Math.sin(k) * rr2 * 0.7 - t.y) * Math.min(1, dt * 6);
          }
          if (e.tick <= 0) { e.tick = 0.25; hurt(t, e.owner, 16 * 0.25 / e.max, { power: e.P, quiet: true, airHit: true }); }
        }
        if (e.life <= 0 && t && e.caught && !gone(t)) { const a = rr(0, TAU); if (!unmoved(t)) { t.kx += Math.cos(a) * 900; t.ky += Math.sin(a) * 900; } hurt(t, e.owner, 4, { power: e.P, big: true }); ring(e.x, e.y, 10, 160, '#ffffff', 0.5, 8); }
        break;
      }
      case 'firework': {
        e.t += dt; const k = Math.min(1, e.t / e.dur); e.x = lerp(e.x0, e.tx, k); e.y = lerp(e.y0, e.ty, k); e.z = Math.sin(k * Math.PI) * 130;
        if (Math.random() < 0.9) sparks(e.x, e.y - e.z, 1, { sp: 60, col: '#ffe0a0', life: 0.4 });
        if (k >= 1 && !e.done) {
          e.done = true; e.life = 0; cam.shake = Math.max(cam.shake, 3); SFX.hit(false);
          const cols = ['#ffd27a', '#ff6a3a', '#fff4c2', '#ff9ad0'];
          for (let i = 0; i < amt(40, am); i++) { const a = rr(0, TAU), v = rr(80, 260); fx({ k: 'spark', x: e.x, y: e.y - 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(0.6, 1.1), max: 1.1, size: rr(1.6, 2.8), col: cols[i % 4], drag: 1.6, grav: 120 }); }
          ring(e.x, e.y - 40, 6, e.r, '#ffe0a0', 0.4, 3);
          blastAt(e.owner, e.x, e.y, e.r, 10, { power: e.P, burn: 2, knock: 60, am });
          decal('scorch', e.x, e.y, e.r * 0.6, { life: 6 });
        }
        break;
      }
      case 'boulder': {
        const d = e.speed * dt; e.x += Math.cos(e.a) * d; e.y += Math.sin(e.a) * d; e.travel += d; e.rot += d / e.r;
        if (Math.random() < 0.6 * am + 0.2) dust(e.x - Math.cos(e.a) * e.r, e.y - Math.sin(e.a) * e.r, 1, { size: 10, sp: 20 });
        let stop = e.travel > e.max;
        if (t && !e.hit && !gone(t) && !(t.st.high > 0) && t.st.air <= 0 && dist(e, t) < e.r + t.r) { e.hit = true; hurt(t, e.owner, 16, { power: e.P, knock: 330, ang: e.a, big: true, am }); stop = true; }
        if (hitDecoy(e.owner, e.x, e.y, e.r)) stop = true;
        for (const sol of SOLIDS) if (Math.hypot(e.x - sol.x, e.y - sol.y) < sol.r + e.r) stop = true;
        for (const st of STONES) if (st.owner !== e.owner && stoneHit(st, e.x, e.y, e.r)) { stop = true; removeStone(st); }
        if (FIGHT && Math.hypot(e.x - FIGHT.cx, e.y - FIGHT.cy) > FIGHT.r) stop = true;
        if (stop) { e.life = 0; rocks(e.x, e.y, amt(12, am), { sp: 200, up: 220, size: 5 }); dust(e.x, e.y, amt(6, am), { sp: 100 }); cam.shake = Math.max(cam.shake, 4); }
        break;
      }
      case 'quake': {
        const r0 = e.r; e.r = Math.min(e.max, e.r + e.speed * dt);
        for (let i = 0; i < amt(4, am); i++) { const a = rr(0, TAU); dust(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, 1, { size: 9, sp: 30 }); if (Math.random() < 0.3) rocks(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, 1, { sp: 40, up: 120, size: 3 }); }
        const dq = decoyOf(t); if (dq && !e.dhit) { const d = dist(e, dq); if (d >= r0 - dq.r && d <= e.r + dq.r) { e.dhit = true; popDecoy(dq); } }
        if (t && !e.hit && !gone(t) && !aloft(t)) { const d = dist(e, t); if (d >= r0 - t.r && d <= e.r + t.r) { e.hit = true; hurt(t, e.owner, 9, { power: e.P, stun: 0.8, knock: 60, ang: angTo(e, t), am }); } }
        if (e.r >= e.max) e.life = Math.min(e.life, 0.15);
        break;
      }
      case 'charge': {
        // it flies to them and sticks; a dodge or a dash shakes it off (it goes off where it falls); otherwise it blows
        e.t += dt; const tg = e.target;
        if (!e.stuck && !e.loose) {
          const k = Math.min(1, e.t / e.fly), tx = tg ? tg.x : e.px, ty = tg ? tg.y : e.py;
          e.x = lerp(e.x0, tx, k); e.y = lerp(e.y0, ty, k); e.z = Math.sin(k * Math.PI) * 40;
          if (Math.random() < 0.8) sparks(e.x, e.y - e.z, 1, { sp: 40, col: '#ffe0a0', life: 0.3 });
          if (k >= 1) {
            e.z = 0;
            if (tg && tg.isDecoy) { popDecoy(tg); e.loose = true; e.life = Math.min(e.life, 0.05); }
            else if (tg && tg.hp > 0 && !gone(tg) && !(tg.st.invuln > 0) && !tg.dash) { e.stuck = true; words(tg.x, tg.y - 46, 'Stuck on!', '#ffb04a', 14); sparks(tg.x, tg.y, 6, { sp: 120 }); }
            else { e.loose = true; e.life = Math.min(e.life, 0.3); }
          }
        } else if (e.stuck) {
          e.x = tg.x; e.y = tg.y;
          if (tg.dash || tg.st.under > 0 || tg.st.leap > 0 || tg.hp <= 0) { e.stuck = false; e.loose = true; e.life = Math.min(e.life, 0.35); words(tg.x, tg.y - 46, 'Shaken off', '#e8e2f2', 13); }
          else if (Math.random() < 0.6 + 0.4 * (1 - e.life / e.max)) sparks(e.x, e.y - 22, 1, { sp: 70, col: '#ffe0a0', life: 0.25 });
        }
        if (e.life <= 0) {
          const r = 62 * (e.sz || 1);
          cam.shake = Math.max(cam.shake, 5); SFX.hit(true); ring(e.x, e.y, 6, r, '#ffd27a', 0.4, 6);
          for (let i = 0; i < amt(18, am); i++) { const aa = rr(0, TAU), v = rr(0.3, 1) * r * 3; fx({ k: 'flame', x: e.x, y: e.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.4, max: 0.4, size: rr(8, 13), drag: 4, grow: 1.4 }); }
          smoke(e.x, e.y, amt(4, am), { size: 16 }); decal('scorch', e.x, e.y, r * 0.8, { life: 7 });
          blastAt(e.owner, e.x, e.y, r, 18, { power: e.P, burn: 3, knock: 180, big: true, am });
        }
        break;
      }
      case 'double': if (e.life <= 0) popDecoy(e, true); break;
      case 'hands': if (e.target) { e.x = e.target.x; e.y = e.target.y; } if (e.target && e.target.st.root <= 0) e.life = Math.min(e.life, 0.2); break;
    }
  }
  CUR = null;
  ENTS = ENTS.filter(e => e.life > 0);
}
function stepStones(dt) {
  for (const s of STONES) { s.life -= dt; s.born = Math.min(1, s.born + dt * 4); }
  for (const s of STONES.filter(s => s.life <= 0)) removeStone(s);
}

// ── hits ──
function hurt(t, src, base, o = {}) {
  if (t.isDecoy) { popDecoy(t); return true; }
  if (t.isPhantom) return false;
  if (!inFight(t) || !inFight(src) || t.hp <= 0 || !FIGHT.on) return false;
  if (gone(t)) return false;
  const sw = moveWay(src), tw = moveWay(t), am = o.am ?? 1, S = t.st;
  if (S.invuln > 0) { words(t.x, t.y - 30, 'Dodged', '#e8e2f2', 13); SFX.dodge(); return false; }
  if (o.melee && S.high > 0 && src.st.high <= 0) { words(t.x, t.y - 30, 'Out of reach', ELC.earth.light, 12); return false; }
  // jade: nothing gets through
  if (S.statue > 0) { if (!o.quiet) { words(t.x, t.y - 34, 'Jade', '#9fe0b8', 12); sparks(t.x, t.y, 4, { col: '#d8ffe6', sp: 90 }); SFX.block(); } return false; }
  // a breaking blow smashes every guard before it lands
  if (o.breakGuard) {
    const had = S.shield > 0 || S.armor > 0 || S.deflect > 0 || S.reflect > 0 || S.counter > 0 || S.stance > 0 || S.thorns > 0;
    S.shield = S.shieldT = S.armor = S.deflect = S.reflect = S.counter = S.stance = S.thorns = 0;
    if (had) { words(t.x, t.y - 50, 'Guard broken!', '#ffd27a', 15); burst(t.x, t.y, '#ffe0a0', 12, 160, 0.5, 5); cam.shake = Math.max(cam.shake, 4); }
  }
  // push hands: a blow up close is caught and turned aside, and the striker is thrown, soaked
  if (o.melee && S.counter > 0 && src.hp > 0 && !gone(src)) {
    S.counter = 0; const a = angTo(t, src);
    t.pose = 'strike'; t.poseT = 0; swirl(t.x, t.y, 28, 14, { col: 'rgba(170,220,255,0.95)', spin: 9, vr: 40, life: 0.6 }); splash(src.x, src.y, 14, { r: 30 });
    words(t.x, t.y - 50, 'Turned aside!', ELC.water.light, 15);
    hurt(src, t, 6, { power: t.counterPow || 1, stun: 0.6, soak: 3, knock: 260, ang: a, big: true });
    return false;
  }
  let dmg = base * (o.power ?? 1) * WAYMOD[sw].dmg * advMul(sw, tw) * (src.isPlayer ? YOU[sw] || 1 : skillOf(src).dmg * (HALL[sw] || 1));
  if (S.brand > 0 && t.brandBy === src) dmg *= 1.3;
  if (src.st.fury > 0) dmg *= 1.2;
  if (o.airHit && t.st.air > 0) dmg *= 1.3;
  if (sw === 'fire' && t.st.soak > 0) { dmg *= 0.75; t.st.soak = 0; o = { ...o, burn: 0 }; smoke(t.x, t.y, 3, { size: 10 }); words(t.x, t.y - 44, 'Sizzle', '#bfe6ff', 11); }
  if (t.st.frozen > 0 && !o.freeze) { dmg *= 1.4; t.st.frozen = 0; iceBurst(t.x, t.y, 12, { sp: 180 }); words(t.x, t.y - 46, 'Shattered!', '#dff6ff', 14); }
  if (t.st.armor > 0) dmg *= 1 - (t.st.armorK || 0);
  // the bubble takes it first
  if (t.st.shield > 0 && !o.quiet) {
    const take = Math.min(t.st.shield, dmg); t.st.shield -= take; dmg -= take;
    if (t.st.shield <= 0.01) { popShield(t); } else { ripple(t.x, t.y, 30); words(t.x, t.y - 30, 'Bubble', ELC.water.light, 12); }
    if (dmg <= 0.3) { SFX.block(); return true; }
  }
  // striking a flame shield burns you; striking ice armour chills you
  if (o.melee && t.st.thorns > 0) { src.st.burn = Math.max(src.st.burn, 2); src.hp = Math.max(0, src.hp - 4); flames(src.x, src.y, 6, { sp: 60 }); words(src.x, src.y - 30, 'Burned', '#ffb07a', 12); if (src.hp <= 0) knockedOut(src, t); }
  if (o.melee && t.st.armor > 0 && t.st.armorKind === 'ice') { src.st.slow = Math.max(src.st.slow, 1.5); iceBurst(src.x, src.y, 4, { sp: 60 }); }
  dmg = Math.max(0.5, dmg);
  if (DMGLOG) { const k = sw + ':' + (CUR || '?'); DMGLOG[k] = (DMGLOG[k] || 0) + Math.min(dmg, t.hp); }
  t.hp = Math.max(0, t.hp - dmg);
  t.st.flash = 0.12; if (!o.quiet) { t.pose = 'hurt'; t.poseT = 0; }
  words(t.x + rr(-8, 8), t.y - 26, String(Math.round(dmg)), t.isPlayer ? '#ff8a7a' : '#ffe08a', o.big ? 20 : o.quiet ? 12 : 15);
  if (!o.quiet) { SFX.hit(!!o.big); hitFx(sw, t.x, t.y, !!o.big, am); if (o.big) { inkSplash(t.x, t.y, 10, 150); cam.shake = Math.max(cam.shake, 6); } }
  // weightless: nothing slows, holds, stuns or throws them
  const steady = unmoved(t), free = S.free > 0;
  const kn = steady ? 0 : (o.knock || 0) * (sw === 'air' ? WAYMOD.air.knock : 1) * (tw === 'earth' ? WAYMOD.earth.steady : 1);
  if (kn && o.ang != null) { t.kx += Math.cos(o.ang) * kn * 3.2; t.ky += Math.sin(o.ang) * kn * 3.2; }
  if (o.stun && S.air <= 0 && !free) S.stun = Math.max(S.stun, o.stun * (o.power ? Math.min(1, 0.6 + 0.4 * o.power) : 1));
  if (o.launch && !steady && S.high <= 0) { S.air = Math.max(S.air, o.launch); S.airMax = Math.max(S.air, o.launch); if (t.act && t.act.phase === 'wind') { t.act = null; t.glyph = null; } }
  if (o.soak && S.high <= 0) S.soak = Math.max(S.soak, o.soak);
  if (o.freeze && !free && (S.soak > 0 || o.freezeAny)) { S.frozen = Math.max(S.frozen, o.freeze * (o.power ? Math.min(1, 0.6 + 0.4 * o.power) : 1)); S.soak = 0; if (t.act && t.act.phase === 'wind') { t.act = null; t.glyph = null; } iceBurst(t.x, t.y, 10); words(t.x, t.y - 46, 'Frozen!', '#dff6ff', 15); }
  if (o.chill && !free) S.slow = Math.max(S.slow, o.chill * (S.soak > 0 ? 1.6 : 1));
  if (o.slow && !free) S.slow = Math.max(S.slow, o.slow);
  if (o.burn && S.soak <= 0 && !(S.armorKind === 'stone' && S.armor > 0)) S.burn = Math.max(S.burn, o.burn);
  if (o.root && !free) S.root = Math.max(S.root, o.root);
  if (o.blind) S.blind = Math.max(S.blind, o.blind);
  if (o.heavy && !free) S.heavy = Math.max(S.heavy, o.heavy);
  if (o.silence) { S.silence = Math.max(S.silence, o.silence); if (t.act && t.act.phase === 'wind') { t.act = null; t.glyph = null; } }
  if (t.isPlayer) FIGHT.taken += dmg; else FIGHT.dealt += dmg;
  if (t.hp <= 0) knockedOut(t, src);
  return true;
}
function popShield(t) { t.st.shield = 0; t.st.shieldT = 0; splash(t.x, t.y, 18, { r: 46, up: 200 }); words(t.x, t.y - 34, 'Pop!', ELC.water.light, 13); const s = foeOf(t); if (s && dist(s, t) < 110 && !gone(s)) { s.st.soak = Math.max(s.st.soak, 3); hurt(s, t, 3, { power: 1, quiet: true }); } }

// statuses wear off; burns burn; heals heal; ki comes back; heat cools; wind dies down
function stepStatus(f, dt) {
  const S = f.st;
  for (const k of ['stun', 'slow', 'soak', 'frozen', 'air', 'root', 'blind', 'armor', 'veil', 'haste', 'invuln', 'reflect', 'thorns', 'deflect', 'stance', 'high', 'mend', 'flash', 'galeT', 'lavaSlow', 'sandSlow',
    'counter', 'heavy', 'silence', 'crosswind', 'brand', 'fury', 'free']) if (S[k] > 0) S[k] = Math.max(0, S[k] - dt);
  // out of the jade, mended a little
  if (S.statue > 0) { S.statue = Math.max(0, S.statue - dt); if (S.statue <= 0) { const h = (f.statueHeal || 0) * WAYMOD.earth.heal; f.hp = Math.min(f.maxHp, f.hp + h); if (h > 0.5) words(f.x, f.y - 40, '+' + Math.round(h), '#9dffc2', 14); burst(f.x, f.y, '#9fe0b8', 12, 140, 0.5, 5); } }
  if (S.fury > 0 && inFight(f)) { f.heat = Math.min(100, (f.heat || 0) + 6 * dt); f.heatT = 0; }
  if (S.shieldT > 0) { S.shieldT = Math.max(0, S.shieldT - dt); if (S.shieldT <= 0 && S.shield > 0) { S.shield = 0; splash(f.x, f.y, 8, { r: 30 }); } }
  if (S.burn > 0) { S.burn = Math.max(0, S.burn - dt); if (S.soak > 0 || (S.armorKind === 'stone' && S.armor > 0)) S.burn = 0; if (inFight(f) && f.hp > 0 && S.statue <= 0) { if (DMGLOG) { const k = (foeOf(f) ? moveWay(foeOf(f)) : '?') + ':burn'; DMGLOG[k] = (DMGLOG[k] || 0) + Math.min(2 * dt, f.hp); } f.hp = Math.max(0, f.hp - 2 * dt); if (f.hp <= 0) knockedOut(f, foeOf(f)); } }
  if (S.regen > 0) { S.regen = Math.max(0, S.regen - dt); f.hp = Math.min(f.maxHp, f.hp + S.regenRate * dt); }
  const kf = kiFlow(f); f.ki = Math.min(f.maxKi, f.ki + f.kiRegen * kf * dt);
  if (DMGLOG && inFight(f) && FIGHT.on) { const w = moveWay(f); DMGLOG['kf:' + w] = (DMGLOG['kf:' + w] || 0) + kf * dt; DMGLOG['t:' + w] = (DMGLOG['t:' + w] || 0) + dt; DMGLOG['hp:' + w] = (DMGLOG['hp:' + w] || 0) + f.hp / f.maxHp * dt; }
  if (f.way === 'fire' || f.way === 'master') {
    f.heatT = (f.heatT || 0) + dt;
    if (f.heatT > 1.5) f.heat = Math.max(0, f.heat - 6 * dt);
    if (f.heat >= 75 && inFight(f) && f.hp > 1) { f.hp = Math.max(1, f.hp - 1.8 * dt); if (Math.random() < dt * 6) flames(f.x + rr(-8, 8), f.y, 1, { sp: 10, rise: 40, size: 6 }); }
  }
  if (S.air > 0) f.lift = 26 * Math.sin(Math.PI * clamp(S.air / Math.max(0.01, S.airMax || S.air), 0, 1));
  else if (S.leap > 0) f.lift = 160 * Math.sin(Math.PI * clamp(1 - S.leap / 0.7, 0, 1) * 0.5 + Math.PI * 0.5 * clamp(1 - S.leap / 0.7, 0, 1));
  else if (S.high > 0) f.lift = 24;
  else if (S.free > 0) f.lift = 7 + 2 * Math.sin(T * 4);
  else f.lift = Math.max(0, (f.lift || 0) - dt * 120);
  if (S.air <= 0 && f.wasAir) { dust(f.x, f.y, 4, { sp: 60 }); }
  f.wasAir = S.air > 0;
  f.poseT += dt * 3.2; if (f.poseT >= 1 && f.pose !== 'down' && f.pose !== 'bow') f.pose = S.shield > 0 || S.armor > 0 ? 'guard' : 'idle';
}
// each way draws its ki its own way: water from standing in water, fire from running hot, earth from standing its ground,
// air from staying on the move
function kiFlow(f) {
  const w = moveWay(f);
  if (w === 'water') return inZone(f, 'puddle') || inZone(f, 'flood') ? 1.6 : 1;
  if (w === 'fire') return f.heat >= 50 ? 1.5 : 1;
  if (w === 'earth') return (f.stillT || 0) > 0.6 ? 1.5 : 1;
  if (w === 'air') return (f.stillT || 0) < 0.2 && f.wind > 10 ? 1.25 : 1;
  return 1;
}
// moving through a dash (a glide, a rocket step, a cartwheel): carried along, maybe leaving a trail
function stepDash(f, dt) {
  const D = f.dash;
  if (!D) return false;
  CUR = D.spell;
  f.x += D.vx * dt; f.y += D.vy * dt; D.t -= dt;
  if (D.trail && Math.random() < 0.7) { if (D.trail === 'fire') flames(f.x, f.y, 2, { sp: 30, rise: 30, size: 9 }); else drops(f.x, f.y, 2, { sp: 50, up: 70 }); }
  if (D.trail && (!D.lastTrail || Math.hypot(f.x - D.lastTrail.x, f.y - D.lastTrail.y) > 26)) { D.lastTrail = { x: f.x, y: f.y }; ZONES.push({ kind: 'trail', owner: f, way: D.way, x: f.x, y: f.y, r: 16, life: D.way === 'fire' ? 2.5 : 3, max: 3, tick: 0, P: 1, hits: new Map() }); if (D.way === 'fire') decal('scorch', f.x, f.y, 14, { life: 4 }); else decal('wet', f.x, f.y, 14, { life: 4 }); }
  if (D.hitOnce && !D.done) { const t = foeOf(f); if (t && !gone(t) && dist(f, t) < f.r + t.r + 12) { D.done = true; hurt(t, f, D.hitOnce.dmg, { ...D.hitOnce, ang: Math.atan2(D.vy, D.vx) }); } }
  if (f.spinT > 0) { f.spinT -= dt; if (Math.random() < 0.8) streaks(f.x, f.y, rr(0, TAU), 1, { sp: 120, len: 16 }); }
  if (D.t <= 0) f.dash = null;
  CUR = null;
  return true;
}
// how fast a fighter can walk right now
function moveMul(f) {
  const S = f.st;
  if (S.free > 0) return 1.15 * (S.haste > 0 ? 1.45 : 1);
  return (S.heavy > 0 ? 0.7 : 1) * (S.slow > 0 ? 0.6 : 1) * (S.lavaSlow > 0 || S.sandSlow > 0 ? 0.55 : 1) * (S.haste > 0 ? 1.45 : 1) * (S.armor > 0 && (S.armorKind === 'ice' || S.armorKind === 'stone') ? 0.82 : 1) * (S.soak > 0 && moveWay(f) !== 'water' ? 0.9 : 1);
}
const clearSpells = () => { SHOTS = []; WAVES = []; ZONES = []; ENTS = []; STONES = []; TIMERS = []; BEAMS = []; };
// air builds wind by moving; standing still lets it die away
function stepWind(f, dt, moved) {
  if (moved > 0.6) f.stillT = 0; else f.stillT = (f.stillT || 0) + dt;
  if (moveWay(f) !== 'air') return;
  if (moved > 0.6) f.wind = Math.min(100, f.wind + moved * 0.17 * (f.st.haste > 0 ? 2 : 1));
  else if (f.stillT > 0.35) f.wind = Math.max(0, f.wind - 18 * dt);
}

// ── the fighters' minds ──
// when each spell is a good idea: a range of distance it's for, how keen they are, and any condition
const guarded = t => t.st.shield > 0 || t.st.armor > 0 || t.st.counter > 0 || t.st.stance > 0 || t.st.deflect > 0 || t.st.reflect > 0 || t.st.thorns > 0;
const troubles = f => ['burn', 'slow', 'blind', 'root', 'heavy', 'brand', 'silence', 'crosswind'].filter(k => f.st[k] > 0.5).length + (f.st.soak > 0.5 && moveWay(f) !== 'water' ? 1 : 0);
const hostileUnder = f => ZONES.some(z => z.owner && z.owner !== f && ['lava', 'whirlpool', 'quicksand', 'ice', 'puddle'].includes(z.kind) && Math.hypot(f.x - z.x, f.y - z.y) < z.r);
const AIH = {
  // water: reach, soak, hold, slip away
  'water:lash': { r: [0, 140], w: 3 }, 'water:bullet': { r: [90, 600], w: 3 }, 'water:bubble': { def: 1, w: 0.4 }, 'water:puddle': { r: [40, 330], w: 1.2, ok: (f, t) => (inZone(t, 'puddle') ? 0 : 1) },
  'water:rain': { heal: 1 }, 'water:glide': { evade: 1, move: 1 }, 'water:geyser': { r: [40, 380], w: 1.8, ok: (f, t) => (inZone(t, 'puddle') ? 2.5 : 1) }, 'water:shards': { r: [80, 520], w: 1.8, ok: (f, t) => (t.st.soak > 0 ? 2 : 1) },
  'water:whirlpool': { r: [80, 360], w: 1.4 }, 'water:freeze': { r: [0, 520], w: 0.5, ok: (f, t) => (t.st.soak > 0 ? 5 : ZONES.some(z => z.kind === 'puddle') ? 0.6 : 0) },
  'water:tidal': { r: [60, 420], w: 1.3, ok: (f, t) => 1 + Math.min(3, ZONES.filter(z => z.owner === t && (z.kind === 'lava' || z.kind === 'firewall')).length + STONES.filter(s => s.owner === t).length * 0.6) },
  'water:mist': { def: 1, w: 0.3 }, 'water:undertow': { r: [180, 420], w: 1.4 }, 'water:mirror': { def: 1, shot: 1, w: 0.2 }, 'water:dragon': { r: [100, 500], w: 1.3 },
  'water:pushhands': { vsClose: 1, r: [0, 110], w: 0.5 }, 'water:ebb': { r: [40, 320], w: 0.3, ok: (f, t) => (hostileUnder(f) ? 6 : inZone(f, 'puddle') && !inZone(t, 'puddle') ? 2 : 0.5) },
  'water:draw': { ki: 1 }, 'water:double': { evade: 1, w: 0.3 }, 'water:flood': { ult: 1, r: [0, 500], w: 1 },
  // fire: hit, burn, run hot
  'fire:jab': { r: [0, 95], w: 3 }, 'fire:fireball': { r: [90, 520], w: 3 }, 'fire:breath': { r: [0, 170], w: 2.2 }, 'fire:rocket': { move: 1, evade: 0.3, r: [180, 600], w: 0.8 }, 'fire:flameshield': { def: 1, w: 0.4 },
  'fire:roundhouse': { r: [0, 110], w: 2 }, 'fire:firewall': { r: [90, 380], w: 0.8 }, 'fire:vent': { r: [0, 140], w: 0.4, ok: (f) => (f.heat > 60 ? 6 : f.heat > 35 ? 1.5 : 0) }, 'fire:embers': { r: [80, 420], w: 1.8 },
  'fire:charge': { r: [0, 440], w: 1.1 }, 'fire:knee': { r: [0, 100], w: 1.4, ok: (f, t) => (guarded(t) ? 4 : 1) }, 'fire:whip': { r: [160, 340], w: 1.4 }, 'fire:lava': { r: [60, 380], w: 1.3 },
  'fire:ignite': { r: [0, 460], w: 0.4, ok: (f, t) => (t.st.burn > 2 ? 5 : t.st.burn > 0.8 ? 1.5 : 0) }, 'fire:fury': { r: [0, 400], w: 0.5, ok: (f) => (f.heat < 50 ? 1.5 : 0.3) },
  'fire:meteor': { r: [100, 500], w: 1.2 }, 'fire:firework': { r: [100, 500], w: 1.3, ok: (f, t) => (STONES.some(s => s.owner === t) ? 2 : 1) }, 'fire:phoenix': { heal: 1, ok: (f) => (f.heat > 40 ? 2 : 0.4) },
  'fire:brand': { r: [0, 460], w: 0.6, ok: (f, t) => (t.st.brand > 0 ? 0 : 1) }, 'fire:inferno': { ult: 1, r: [0, 200], w: 1 },
  // earth: stand, build, crush
  'earth:fist': { r: [0, 95], w: 3 }, 'earth:rock': { r: [80, 520], w: 3 }, 'earth:wall': { def: 1, shot: 1, w: 0.5, r: [120, 600] }, 'earth:spike': { r: [40, 400], w: 2 }, 'earth:skin': { def: 1, w: 0.5, ok: (f) => (f.st.burn > 0 ? 3 : 1) },
  'earth:quake': { r: [0, 160], w: 2 }, 'earth:statue': { def: 1, w: 0.2, ok: (f) => (f.hp < f.maxHp * 0.5 ? 2 : 1) },
  'earth:shatter': { r: [0, 600], w: 0.3, ok: (f, t) => STONES.filter(s => s.owner === f && Math.hypot(s.x - t.x, s.y - t.y) < 120).length * 2.5 },
  'earth:boulder': { r: [100, 520], w: 1.4 }, 'earth:quicksand': { r: [60, 380], w: 1.3 }, 'earth:sand': { r: [0, 180], w: 1.4 }, 'earth:pillar': { def: 1, shot: 1, w: 0.3 }, 'earth:grip': { r: [100, 330], w: 1.3 },
  'earth:landslide': { r: [80, 400], w: 1.3 }, 'earth:burrow': { move: 1, evade: 0.6, r: [160, 600], w: 0.8 }, 'earth:crystal': { r: [100, 600], w: 1.6 }, 'earth:stance': { r: [0, 110], w: 0.6 },
  'earth:weight': { r: [0, 420], w: 0.8, ok: (f, t) => (t.st.heavy > 0 ? 0 : moveWay(t) === 'air' || moveWay(t) === 'water' ? 1.6 : 1) },
  'earth:toss': { r: [0, 100], w: 1.6, ok: (f, t) => (STONES.some(s => s.owner === f && dist(s, f) < 160) ? 2 : 1) }, 'earth:mountain': { ult: 1, r: [60, 500], w: 1 },
  // air: move, toss them about, unsettle
  'air:blade': { r: [80, 560], w: 3 }, 'air:gust': { r: [0, 210], w: 2 }, 'air:feather': { evade: 1, w: 0.4 }, 'air:meialua': { r: [0, 100], w: 2.4 }, 'air:updraft': { r: [60, 340], w: 1.8 }, 'air:airshield': { def: 1, shot: 1, w: 0.4 },
  'air:breath': { heal: 1, cleanse: 1 }, 'air:tornado': { r: [80, 460], w: 1.5 }, 'air:flurry': { r: [0, 90], w: 2 }, 'air:vacuum': { vsWind: 1, r: [0, 400], w: 0.6 }, 'air:twin': { r: [100, 520], w: 1.6, ok: (f, t) => (STONES.some(s => s.owner === t) ? 2 : 1) },
  'air:walk': { w: 0.4, ok: (f) => (f.st.haste > 0 ? 0 : 1) }, 'air:downdraft': { r: [40, 420], w: 0.8, ok: (f, t) => (t.st.air > 0 ? 6 : 0.7) }, 'air:crosswind': { r: [0, 500], w: 0.5, ok: (f, t) => (t.st.crosswind > 0 || t.st.free > 0 ? 0 : 1) },
  'air:crane': { r: [100, 500], w: 1.1 }, 'air:whistle': { vsWind: 1, r: [0, 400], w: 0.2, ok: (f, t) => (t.act && t.act.phase === 'wind' ? 7 : 0.4) }, 'air:gale': { r: [60, 420], w: 1.3 },
  'air:echo': { r: [0, 500], w: 0.6, ok: (f) => (f.lastSpell && !SELF.has(f.lastSpell.tag) && f.lastSpell.tag !== 'Ultimate' ? 1.5 : 0) }, 'air:weightless': { def: 1, w: 0.3, ok: (f) => (troubles(f) ? 3 : 1) }, 'air:typhoon': { ult: 1, r: [0, 500], w: 1 },
};
const allowedFor = f => { const way = moveWay(f), n = skillOf(f).spells; return MOVES[way].filter(m => m.order < n); };
// where to walk: the distance this fighter likes, circling; air never stands still, earth hardly strolls; out of their pools
function aiWalk(f, foe, dt) {
  const ai = f.ai, way = moveWay(f), d = dist(f, foe), a = angTo(f, foe);
  const want = ai.range || (ai.range = way === 'air' ? rr(120, 220) : way === 'earth' ? rr(60, 140) : f.rank >= 3 ? rr(80, 190) : rr(70, 160));
  let mx = 0, my = 0;
  if (d > want + 25) { mx += Math.cos(a); my += Math.sin(a); } else if (d < want - 25) { mx -= Math.cos(a); my -= Math.sin(a); }
  const strafe = way === 'air' ? 1.1 : 0.6;
  mx += -Math.sin(a) * strafe * ai.strafe; my += Math.cos(a) * strafe * ai.strafe;
  if (Math.random() < dt * 0.5) ai.strafe *= -1;
  if (way === 'water') { const pool = ZONES.find(z => z.owner === f && z.kind === 'puddle' && z.life > 1.5 && Math.hypot(f.x - z.x, f.y - z.y) < 170); if (pool) { const dp = Math.hypot(pool.x - f.x, pool.y - f.y); if (dp > pool.r * 0.5) { mx += (pool.x - f.x) / dp * 1.4; my += (pool.y - f.y) / dp * 1.4; } else { mx *= 0.3; my *= 0.3; } } }
  const bad = ZONES.find(z => z.owner === foe && ['puddle', 'lava', 'whirlpool', 'quicksand', 'mark', 'ice'].includes(z.kind) && Math.hypot(f.x - z.x, f.y - z.y) < z.r + 10);
  if (bad && (f.rank >= 2 || f.isPlayer)) { const a2 = Math.atan2(f.y - bad.y, f.x - bad.x); mx += Math.cos(a2) * 1.6; my += Math.sin(a2) * 1.6; }
  const n = Math.hypot(mx, my) || 1;
  return { mx: mx / n, my: my / n };
}
// what to cast: first, a shield or a dodge if a blow or a shot is coming (if they see it); otherwise, now and then,
// the spell that suits the distance, their health and ki, and the state of the fight (a soaked foe, stones by them...)
// what they'd want to answer: a big spell coming, or a blow up close
const BIG = new Set(['Blast', 'Launch', 'Wave', 'Wash', 'Ultimate', 'Sweep', 'Slam', 'Summon', 'Roll', 'Leap', 'Burst', 'Spike', 'Stun', 'Break', 'Throw', 'Rockfall', 'Storm', 'Bomb', 'Lob', 'Trap', 'Freeze', 'Sink', 'Root', 'Grapple']);
const CLOSE = new Set(['Strike', 'Break', 'Throw', 'Flurry', 'Sweep']);
function aiChoose(f, foe, spells, dt, K) {
  const ai = f.ai, d = dist(f, foe);
  for (const k in ai.cd) ai.cd[k] = Math.max(0, ai.cd[k] - dt);
  const can = m => !ai.cd[m.id] && f.ki >= m.cost && !(f.st.heavy > 0 && LIGHT.has(m.tag));
  const wind = foe.act && foe.act.phase === 'wind' ? foe.act.move : null;
  const big = wind && BIG.has(wind.tag), close = wind && CLOSE.has(wind.tag) && d < 140;
  const shotIn = SHOTS.some(s => s.owner === foe && !s.harmless && dist(s, f) < 140) || WAVES.some(w => w.owner === foe && dist(w, f) < 180);
  const markUnder = ZONES.some(z => z.kind === 'mark' && Math.hypot(f.x - z.x, f.y - z.y) < z.r + 14);
  if (ai.reactT > 0) { ai.reactT -= dt; if (ai.reactT <= 0) ai.reacted = false; }
  if ((big || close || shotIn || markUnder) && !ai.reacted) {
    ai.reacted = true; ai.reactT = 0.9;
    if (Math.random() < K.react) {
      const opts = spells.filter(m => {
        const h = AIH[m.id]; if (!h || !can(m)) return false;
        if (h.vsClose) return close;
        if (h.vsWind) return !!wind && !markUnder;
        if (!(h.def || h.evade)) return false;
        if (markUnder && !h.evade) return false;
        return !h.shot || shotIn;
      });
      if (opts.length) return { move: opts[(Math.random() * opts.length) | 0], quick: true };
    }
  }
  ai.think -= dt;
  if (ai.think > 0) return null;
  ai.think = rr(K.think[0], K.think[1]);
  const w = new Map();
  for (const m of spells) {
    const h = AIH[m.id]; if (!h || !can(m)) continue;
    let v = 0;
    if (h.heal) v = f.hp < f.maxHp * 0.45 ? 3 : 0;
    else if (h.ki) v = f.ki < 35 ? 2.5 : 0;
    else if (h.ult) v = (f.isPlayer || f.rank >= 3) && f.ki >= m.cost ? 0.8 : 0;
    else if (h.def) v = h.w * 0.5;
    else if (h.r) v = d >= h.r[0] && d <= h.r[1] ? h.w : 0;
    else v = h.w || 0;
    if (h.cleanse) v = Math.max(v, troubles(f) * 1.2);
    if (h.move && d > 260) v += 1.2;
    if (v > 0 && h.ok) v *= h.ok(f, foe);
    if (v > 0) w.set(m, v);
  }
  if (!w.size) return null;
  let pick = Math.random() * [...w.values()].reduce((a, b) => a + b, 0);
  for (const [m, v] of w) { pick -= v; if (pick <= 0) return { move: m }; }
  return { move: [...w.keys()][0] };
}
function aiFight(f, foe, dt) {
  if (f.hp <= 0 || held(f) && !(f.st.mend > 0)) { if (f.st.air <= 0 && !f.dash) { f.vx = 0; f.vy = 0; } return; }
  f.face = angTo(f, foe);
  const stuck = f.st.root > 0 || f.st.high > 0 || f.st.stance > 0 || f.st.mend > 0 || (f.act && f.act.chan > 0);
  if (!f.act && !stuck) { const dir = aiWalk(f, foe, dt), sp = f.speed * moveMul(f) * 0.85 * (skillOf(f).move || 1); f.vx = dir.mx * sp; f.vy = dir.my * sp; }
  else { f.vx = 0; f.vy = 0; }
  if (f.act || !canCast(f)) return;
  if (f.way === 'master' && Math.random() < dt * 0.12) f.ai.way = WAY_ORDER[(Math.random() * 4) | 0];
  const c = aiChoose(f, foe, allowedFor(f), dt, skillOf(f));
  if (c) useAi(f, c.move, foe, c.quick);
}
function useAi(f, move, foe, quick) {
  if (!move) return;
  const P = skillOf(f).power;
  if (startMove(f, move, P, foe)) {
    const h = AIH[move.id] || {};
    f.ai.cd[move.id] = h.ult ? 16 : h.heal ? 10 : h.ki ? 6 : h.def || h.vsClose || h.vsWind ? 4 : h.evade ? 3 : (move.cost >= 18 ? 6 : move.cost >= 12 ? 3.5 : 1.6);
    if (quick && f.act) { f.act.t *= 0.5; f.act.wind *= 0.5; if (f.glyph) f.glyph.dur *= 0.5; }
  }
}
