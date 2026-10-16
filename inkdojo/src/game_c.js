// ── the fighters ──
// each rank: how tough, how hard they hit, how long their telegraph, how often they think, how often they see a blow coming,
// how many of their way's spells they know, and how well they write them (their spells' strength)
const RANKS = {
  0: { belt: '#f2efe6', beltName: 'first day', hp: 45, dmg: 0.4, windup: 0.95, think: [2.4, 3.4], react: 0, spells: 2, power: 0.6 },
  1: { belt: '#f2efe6', beltName: 'white belt', hp: 70, dmg: 0.8, windup: 0.62, think: [1.2, 1.9], react: 0.1, spells: 6, power: 0.8 },
  2: { belt: '#8a5a2b', beltName: 'brown belt', hp: 100, dmg: 0.75, windup: 0.52, think: [1.0, 1.6], react: 0.25, spells: 11, power: 0.9 },
  3: { belt: '#16131b', beltName: 'black belt', hp: 125, dmg: 0.76, windup: 0.46, think: [0.95, 1.5], react: 0.38, spells: 19, power: 0.95 },
  4: { belt: '#c63f2e', beltName: 'red belt', hp: 165, dmg: 0.72, windup: 0.44, think: [0.9, 1.4], react: 0.4, spells: 20, power: 1.0 },
};
const GI = { water: '#d9ebf7', fire: '#f8ddd2', earth: '#eee0c2', air: '#f5efcd', master: '#2b2531' };
const SKIN = ['#f1c9a5', '#e0ac85', '#c98d64', '#a8714c', '#f5d6bd', '#8d5a3b'];
const HAIR = ['#1d1a20', '#3a2618', '#5a3a22', '#2b2b33', '#7a7064', '#151217'];
const ROSTER = [
  { id: 'w1', name: 'Mei', way: 'water', rank: 1, post: [205, 640] }, { id: 'w2', name: 'Ryo', way: 'water', rank: 2, post: [335, 850] }, { id: 'w3', name: 'Sensei Nami', way: 'water', rank: 3, post: [205, 1060] },
  { id: 'f1', name: 'Kai', way: 'fire', rank: 1, post: [560, 1455] }, { id: 'f2', name: 'Bo', way: 'fire', rank: 2, post: [800, 1360] }, { id: 'f3', name: 'Sensei Homura', way: 'fire', rank: 3, post: [1040, 1455] },
  { id: 'e1', name: 'Tomo', way: 'earth', rank: 1, post: [1395, 640] }, { id: 'e2', name: 'Gan', way: 'earth', rank: 2, post: [1265, 850] }, { id: 'e3', name: 'Sensei Iwao', way: 'earth', rank: 3, post: [1395, 1060] },
  { id: 'a1', name: 'Sora', way: 'air', rank: 1, post: [560, 245] }, { id: 'a2', name: 'Fei', way: 'air', rank: 2, post: [800, 330] }, { id: 'a3', name: 'Sensei Kaze', way: 'air', rank: 3, post: [1040, 245] },
];
// how good a fighter is depends on how far through the dojo you are: your first sparring partner (k = 0) is feeble, and each
// fighter after is a little better than the one before (k = how many you've beaten, plus one), up to the twelfth; then the
// Grandmaster. Everything grows smoothly with k: their health, how hard they hit, how quick their telegraph, how often they
// think, how often they see a blow coming, how many spells they know (about as many as you do by then) and how well they write them; and a beginner's spells
// sometimes fizzle or go wide, and they walk a little slower.
function skillAt(k) {
  if (k >= 13) return { k, hp: 160, dmg: 0.74, windup: 0.44, think: [0.9, 1.4], react: 0.42, spells: 20, power: 1, fizzle: 0, aim: 0, move: 1 };
  const u = clamp(k / 12, 0, 1), think = 2.4 - 1.48 * u ** 0.7;
  return { k, hp: 45 + 81 * u ** 1.1, dmg: 0.42 + 0.32 * u ** 0.9, windup: 0.95 - 0.5 * u ** 0.8, think: [think, think * 1.55], react: 0.4 * u ** 1.2,
           spells: k < 1 ? 2 : Math.min(20, 5 + Math.min(8, k - 1) + 2 * Math.max(0, k - 9)), power: 0.6 + 0.36 * u ** 0.8, fizzle: 0.3 * (1 - u) ** 3, aim: 0.35 * (1 - u) ** 3, move: 0.75 + 0.25 * Math.min(1, u * 2) };
}
const skillOf = f => f.sk || RANKS[f.rank];
// what each way is: water hits softly but heals best; fire hits hardest and heals least; earth is the toughest and slowest
// (and hard to knock about); air is the fastest, the frailest, and throws foes furthest
const WAYMOD = {
  water:  { dmg: 1.14, heal: 1.5, speed: 1.0, hp: 100 },
  fire:   { dmg: 1.02, heal: 0.7, speed: 1.05, hp: 95 },
  earth:  { dmg: 1.08, heal: 1.0, speed: 0.84, hp: 130, steady: 0.5 },
  air:    { dmg: 1.05, heal: 1.0, speed: 1.24, hp: 90, knock: 1.4 },
  master: { dmg: 1.0, heal: 1.0, speed: 1.1, hp: 100 },
  beast:  { dmg: 1.0, heal: 1.0, speed: 1.2, hp: 80 },
};
// a fighter's colour: their way's, the Grandmaster's red, or a beast's grey
const fcol = f => (f.way === 'master' ? C.seal : WAYS[f.way] ? WAYS[f.way].color : f.col || '#b9b2a6');
// how hard each hall's fighters hit: the ways are even with each other, but against you (who writes in an instant, with no
// warning) some ways' fighters would be far easier to beat than others; this evens out the four halls
const HALL = { water: 1.1, fire: 0.92, earth: 1.18, air: 1.3 };
// and how hard you hit with each way: a person writes slower than a fighter thinks, and at that pace some ways pay off less;
// this keeps all four as good a choice as each other
const YOU = { water: 0.92, fire: 1, earth: 1.15, air: 1.08 };
const freshStatus = () => ({ stun: 0, slow: 0, soak: 0, frozen: 0, burn: 0, air: 0, airMax: 0, root: 0, blind: 0, armor: 0, armorK: 0, armorKind: '', shield: 0, shieldT: 0, shieldKind: '',
  veil: 0, veilK: 0, veilKind: '', haste: 0, invuln: 0, reflect: 0, thorns: 0, deflect: 0, regen: 0, regenRate: 0, stance: 0, high: 0, under: 0, leap: 0, mend: 0, flash: 0, galeT: 0, lavaSlow: 0, sandSlow: 0,
  counter: 0, statue: 0, heavy: 0, silence: 0, crosswind: 0, brand: 0, fury: 0, free: 0 });
function resetFighter(f) { f.st = freshStatus(); f.heat = 0; f.heatT = 9; f.wind = 0; f.dash = null; f.lift = 0; f.act = null; f.glyph = null; f.spinT = 0; f.burrowTo = null; f.lastSpell = null; f.brandBy = null; f.statueHeal = 0; f.stillT = 0; }
function makeFighter(o) {
  const k = o.isPlayer ? null : RANKS[o.rank || 0], mod = WAYMOD[o.way] || WAYMOD.master, n = (o.id || 'p').charCodeAt(0) + (o.id || 'p').charCodeAt(1 % (o.id || 'p').length);
  const maxHp = o.isPlayer ? mod.hp : Math.round(k.hp * mod.hp / 100);
  return {
    id: o.id || 'you', name: o.name || 'You', way: o.way, rank: o.rank || 0, isPlayer: !!o.isPlayer,
    x: o.post ? o.post[0] : START.x, y: o.post ? o.post[1] : START.y, r: 15, face: o.isPlayer ? -Math.PI / 2 : angTo({ x: o.post[0], y: o.post[1] }, { x: 800, y: 850 }),
    vx: 0, vy: 0, kx: 0, ky: 0, lift: 0,
    hp: maxHp, maxHp, ki: 100, maxKi: 100, kiRegen: o.isPlayer ? 15 : 13,
    speed: 150 * mod.speed, act: null, queue: [], heat: 0, heatT: 9, wind: 0, dash: null,
    st: freshStatus(),
    pose: 'idle', poseT: 0, walk: 0,
    post: o.post ? { x: o.post[0], y: o.post[1] } : null, mode: 'post', beaten: false,
    glyph: null, ai: { think: rr(0.6, 1.2), cd: {}, strafe: Math.random() < 0.5 ? 1 : -1, way: o.way === 'master' ? 'water' : o.way },
    gi: o.isPlayer ? '#f6f1e6' : GI[o.way] || '#d8d0c4', trim: o.way === 'master' ? '#c63f2e' : WAYS[o.way] ? WAYS[o.way].color : '#8a7a66',
    belt: o.isPlayer ? '#16131b' : k.belt, skin: o.isPlayer ? '#e9bf98' : SKIN[n % SKIN.length], hair: o.isPlayer ? '#1d1a20' : HAIR[(n * 7) % HAIR.length],
    ...(o.look || {}),
  };
}
let player = null, FOES = [];
function moveWay(f) { return f.way === 'master' ? f.ai.way : f.way; }

// a fighter, seen from above: shadow, feet, gi and belt, arms (in the pose of the moment), head
function drawFighter(f, t) {
  const down = f.hp <= 0 || f.pose === 'down', lift = f.lift || 0;
  // underground: only a mound of earth moving through the floor
  if (f.beast) { drawWolf(f, t); return; }
  if (f.st.under > 0) { ctx.save(); ctx.fillStyle = '#6e5a40'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, 16, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#9a8060'; ctx.beginPath(); ctx.ellipse(f.x - 2, f.y + 1, 10, 5, 0, 0, TAU); ctx.fill(); ctx.restore(); return; }
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(2, 9, Math.max(5, 16 - lift * 0.08), Math.max(2.5, 7 - lift * 0.03), 0, 0, TAU); ctx.fill();
  ctx.translate(0, -lift);
  if (f.st.leap > 0) { const k = 1 + lift / 320; ctx.scale(k, k); }
  if (f.st.veil > 0) ctx.globalAlpha = 0.45;
  if (f.spinT > 0) ctx.rotate(t * 30);
  if (f.st.flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; }
  if (down) {
    // lying on the mat
    ctx.rotate(f.face + Math.PI / 2);
    ctx.fillStyle = f.gi; ctx.beginPath(); ctx.ellipse(0, 4, 11, 19, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = f.trim; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = f.belt; ctx.fillRect(-11, 4, 22, 3.5);
    ctx.fillStyle = f.skin; ctx.beginPath(); ctx.arc(0, -16, 7.5, 0, TAU); ctx.fill();
    ctx.fillStyle = f.hair; ctx.beginPath(); ctx.arc(0, -17.5, 7.5, Math.PI, TAU); ctx.fill();
    ctx.restore(); return;
  }
  ctx.rotate(f.face);
  const p = f.pose, k = clamp(f.poseT, 0, 1), stride = Math.sin(f.walk) * 5;
  // feet
  ctx.fillStyle = '#2a2026';
  const kick = p === 'kick' ? Math.sin(k * Math.PI) : 0;
  ctx.beginPath(); ctx.ellipse(stride - 2, -7, 5, 3.4, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-stride - 2 + kick * 26, 7 - kick * 5, 5, 3.4, 0, 0, TAU); ctx.fill();
  if (kick > 0.05) { ctx.strokeStyle = f.gi; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(kick * 24, 6 - kick * 4); ctx.stroke(); }
  // arms
  const sh = [{ x: 1, y: -11 }, { x: 1, y: 11 }];
  let fists = [{ x: 11, y: -7 }, { x: 13, y: 6 }];
  if (p === 'strike') { const e = Math.sin(k * Math.PI); fists = [{ x: 11 - 2 * e, y: -8 }, { x: 13 + 14 * e, y: 5 - 4 * e }]; }
  else if (p === 'strike2') { const e = Math.sin(k * Math.PI); fists = [{ x: 13 + 14 * e, y: -6 + 4 * e }, { x: 11 - 2 * e, y: 8 }]; }
  else if (p === 'guard') fists = [{ x: 12, y: -3 }, { x: 13, y: 3 }];
  else if (p === 'cast') { const e = Math.sin(k * Math.PI); fists = [{ x: 4 + 6 * e, y: -14 - 3 * e }, { x: 4 + 6 * e, y: 14 + 3 * e }]; }
  else if (p === 'bow') fists = [{ x: 6, y: -9 }, { x: 6, y: 9 }];
  else if (p === 'hurt') fists = [{ x: 6, y: -12 }, { x: 4, y: 12 }];
  ctx.strokeStyle = f.gi; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(sh[i].x, sh[i].y); ctx.lineTo(fists[i].x, fists[i].y); ctx.stroke(); }
  // body: the gi, its trim, the belt
  ctx.fillStyle = f.gi; ctx.beginPath(); ctx.ellipse(-1, 0, 10, 13.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = f.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-1, 0, 10, 13.5, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = f.trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(2, 0); ctx.lineTo(8, 6); ctx.stroke();
  ctx.fillStyle = f.belt; ctx.fillRect(-4.5, -13, 3.5, 26);
  if (f.belt === '#f2efe6') { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8; ctx.strokeRect(-4.5, -13, 3.5, 26); }
  // fists
  ctx.fillStyle = f.skin; for (const q of fists) { ctx.beginPath(); ctx.arc(q.x, q.y, 3.6, 0, TAU); ctx.fill(); }
  // head
  ctx.fillStyle = f.skin; ctx.beginPath(); ctx.arc(1, 0, 7.6, 0, TAU); ctx.fill();
  ctx.fillStyle = f.hair; ctx.beginPath(); ctx.arc(-0.5, 0, 7.8, Math.PI * 0.55, Math.PI * 1.45); ctx.lineTo(1, 0); ctx.fill();
  if (f.way === 'master' && !f.isPlayer) { ctx.fillStyle = '#e8e2d8'; ctx.beginPath(); ctx.arc(-2, 0, 4.5, 0, TAU); ctx.fill(); }
  if (f.isPlayer) { ctx.fillStyle = WAYS[f.way].color; ctx.fillRect(-3, -7.5, 2.5, 15); }
  // a bandit's mask; a headscarf; something carried on the back
  if (f.mask) { ctx.fillStyle = f.mask; ctx.fillRect(3, -7, 3.2, 14); }
  if (f.scarf) { ctx.fillStyle = f.scarf; ctx.beginPath(); ctx.arc(-0.5, 0, 8, Math.PI * 0.5, Math.PI * 1.5); ctx.fill(); }
  if (f.isPlayer && f.carry) { ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-17, -7, 9, 14); ctx.strokeStyle = '#e9bb52'; ctx.lineWidth = 1.2; ctx.strokeRect(-17, -7, 9, 14); ctx.beginPath(); ctx.moveTo(-12.5, -7); ctx.lineTo(-12.5, 7); ctx.stroke(); }
  ctx.restore();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}
// what's on a fighter right now: shields, armour, water, ice, fire, sand, wind
function drawStatus(f, t) {
  const S = f.st, y = f.y - (f.lift || 0);
  if (S.under > 0) return;
  if (S.shield > 0) {
    ctx.save(); const r = 26 + Math.sin(t * 5) * 1.2;
    const g = ctx.createRadialGradient(f.x - 8, y - 10, 2, f.x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.7, 'rgba(120,200,255,0.12)'); g.addColorStop(1, 'rgba(120,200,255,0.4)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,240,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, y, r - 5, -2.4, -1.6); ctx.stroke(); ctx.restore();
  }
  if (S.armor > 0) {
    ctx.save(); const k = Math.min(1, S.armor * 2);
    if (S.armorKind === 'ice') { ctx.globalAlpha = 0.85 * k; ctx.strokeStyle = '#dff6ff'; ctx.fillStyle = 'rgba(200,240,255,0.2)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.lineTo(f.x + Math.cos(a + 0.25) * 22, y + Math.sin(a + 0.25) * 22); ctx.lineTo(f.x + Math.cos(a + 0.5) * 12, y + Math.sin(a + 0.5) * 12); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
    else if (S.armorKind === 'stone') { ctx.globalAlpha = 0.9 * k; for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + 0.2; ctx.save(); ctx.translate(f.x + Math.cos(a) * 15, y + Math.sin(a) * 15); ctx.rotate(a); ctx.fillStyle = i % 2 ? '#8a7356' : '#a99070'; ctx.fillRect(-4, -5, 8, 10); ctx.strokeStyle = 'rgba(40,28,18,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(-4, -5, 8, 10); ctx.restore(); } }
    else if (S.armorKind === 'wind' || S.deflect > 0) { ctx.globalAlpha = 0.8 * k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = t * 7 + i * TAU / 3; ctx.beginPath(); ctx.arc(f.x, y, 24 + i * 3, a, a + 1.6); ctx.stroke(); } }
    ctx.restore();
  }
  if (S.thorns > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 10; i++) { const a = t * 3 + i * TAU / 10, h = 8 + 5 * Math.sin(t * 11 + i * 2); ctx.globalAlpha = 0.8; ctx.drawImage(sprite(i % 2 ? '#ff7a2a' : '#ffb04a'), f.x + Math.cos(a) * 24 - 5, y + Math.sin(a) * 24 - h, 10, h * 1.6); } ctx.restore(); }
  if (S.reflect > 0) { ctx.save(); ctx.globalAlpha = 0.75; const g = ctx.createLinearGradient(f.x - 24, f.y, f.x + 24, f.y); g.addColorStop(0, 'rgba(120,200,255,0.4)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(120,200,255,0.4)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, 24, 9, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  if (S.stance > 0) { ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#c9a35c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, 22, 9, 0, 0, TAU); ctx.stroke(); for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.fillStyle = '#8a7356'; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 22, f.y + 6 + Math.sin(a) * 9, 3, 0, TAU); ctx.fill(); } ctx.restore(); }
  if (S.veil > 0 && Math.random() < 0.3) { if (S.veilKind === 'mist') mist(f.x, f.y, 1, { r: 24, size: 18, life: 1 }); else flames(f.x + rr(-14, 14), f.y + rr(-6, 6), 1, { sp: 6, rise: 40, size: 5, life: 0.7 }); }
  if (S.haste > 0 && Math.hypot(f.vx, f.vy) > 30 && Math.random() < 0.6) streaks(f.x, f.y, Math.atan2(f.vy, f.vx) + Math.PI, 1, { sp: 160, len: 18, w: 8 });
  if (S.soak > 0 && S.frozen <= 0) { ctx.fillStyle = 'rgba(150,215,255,0.9)'; for (let i = 0; i < 3; i++) { const ph = (t * 1.4 + i / 3) % 1; ctx.beginPath(); ctx.ellipse(f.x - 10 + i * 10, y - 6 + ph * 20, 1.8, 2.6, 0, 0, TAU); ctx.fill(); } }
  if (S.frozen > 0) {
    ctx.save(); ctx.globalAlpha = 0.75; const g = ctx.createLinearGradient(f.x - 18, y - 22, f.x + 18, y + 16); g.addColorStop(0, 'rgba(240,252,255,0.85)'); g.addColorStop(1, 'rgba(130,205,255,0.55)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(f.x - 17, y + 14); ctx.lineTo(f.x - 20, y - 12); ctx.lineTo(f.x - 6, y - 24); ctx.lineTo(f.x + 12, y - 21); ctx.lineTo(f.x + 20, y - 4); ctx.lineTo(f.x + 16, y + 15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.beginPath(); ctx.moveTo(f.x - 10, y - 16); ctx.lineTo(f.x - 2, y - 2); ctx.moveTo(f.x + 6, y - 18); ctx.lineTo(f.x + 12, y - 8); ctx.stroke(); ctx.restore();
  }
  if (S.stun > 0 && f.hp > 0 && S.frozen <= 0) { for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; star5(f.x + Math.cos(a) * 12, y - 22 + Math.sin(a) * 4, 3.5, '#ffe58a'); } }
  if (S.blind > 0) { ctx.save(); for (let i = 0; i < 8; i++) { const a = t * 4 + i * TAU / 8; ctx.fillStyle = i % 2 ? '#d9bf86' : '#b8955a'; ctx.fillRect(f.x + Math.cos(a) * 12 - 1.5, y - 16 + Math.sin(a) * 5 - 1.5, 3, 3); } ctx.restore(); }
  if (S.root > 0 && !ENTS.some(e => e.kind === 'hands' && e.target === f)) { ctx.save(); ctx.fillStyle = '#7d6748'; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 13, f.y + 7 + Math.sin(a) * 6, 4, 0, TAU); ctx.fill(); } ctx.restore(); }
  if (S.slow > 0 && S.soak <= 0 && S.frozen <= 0) { ctx.fillStyle = hexA('#7cc7ff', 0.6); for (let i = 0; i < 2; i++) { const ph = (t * 1.2 + i / 2) % 1; ctx.beginPath(); ctx.arc(f.x - 6 + i * 12, f.y + 8 - ph * 6, 2, 0, TAU); ctx.fill(); } }
  if (S.burn > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const ph = (t * 2 + i / 4) % 1; ctx.fillStyle = `rgba(255,${120 + i * 20},40,${0.7 * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(f.x - 9 + i * 6, y - 4 - ph * 22, 3 * (1 - ph) + 1, 5 * (1 - ph) + 1, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
  if (S.regen > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const ph = (t * 0.9 + i / 5) % 1; ctx.fillStyle = `rgba(150,255,190,${0.6 * (1 - ph)})`; ctx.beginPath(); ctx.arc(f.x + Math.cos(i * 2.4) * 14, y + 6 - ph * 34, 2.4, 0, TAU); ctx.fill(); } ctx.restore(); }
  // jade: a green stone sheen over them
  if (S.statue > 0) {
    ctx.save(); const k = Math.min(1, S.statue * 5);
    const g = ctx.createLinearGradient(f.x - 16, y - 20, f.x + 16, y + 16); g.addColorStop(0, 'rgba(210,255,225,0.9)'); g.addColorStop(0.5, 'rgba(90,190,130,0.75)'); g.addColorStop(1, 'rgba(40,120,80,0.8)');
    ctx.globalAlpha = k; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, y, 15, 17, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(220,255,230,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, y, 11, -2.5, -1.7); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * (0.5 + 0.5 * Math.sin(t * 7)); ctx.drawImage(sprite('#9fe0b8'), f.x + 4, y - 14, 10, 10); ctx.restore();
  }
  // ready to turn a blow: two currents circling the other way round each other
  if (S.counter > 0) { ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, S.counter * 4); for (let i = 0; i < 2; i++) { const a = (i ? -1 : 1) * t * 6 + i * Math.PI; ctx.strokeStyle = i ? '#bfe6ff' : '#4ab4ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, y, 22 + i * 4, a, a + 2.2); ctx.stroke(); } ctx.restore(); }
  // weights of stone hung on them
  if (S.heavy > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, S.heavy * 3); ctx.strokeStyle = 'rgba(60,44,28,0.8)'; ctx.lineWidth = 1.2; for (const sx of [-9, 9]) { const bob = Math.sin(t * 3 + sx) * 1.5; ctx.beginPath(); ctx.moveTo(f.x + sx * 0.6, f.y + 2); ctx.lineTo(f.x + sx, f.y + 10 + bob); ctx.stroke(); ctx.save(); ctx.translate(f.x + sx, f.y + 14 + bob); rockPath(5, 40 + sx); ctx.fillStyle = '#6e5a40'; ctx.fill(); ctx.restore(); } ctx.restore(); }
  // silenced: the breath gone, a pale ring with a bar through it
  if (S.silence > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, S.silence * 4) * 0.9; ctx.strokeStyle = '#fbf6d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, y - 30, 6, 0, TAU); ctx.moveTo(f.x - 5, y - 26); ctx.lineTo(f.x + 5, y - 34); ctx.stroke(); ctx.restore(); }
  // a crosswind round their head
  if (S.crosswind > 0) { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#fbf6d8'; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.85; for (let i = 0; i < 2; i++) { const a = t * 8 + i * Math.PI; ctx.beginPath(); ctx.ellipse(f.x, y - 22, 16, 6, 0, a, a + 1.8); ctx.stroke(); } ctx.restore(); }
  // the fire brand: a burning star over them
  if (S.brand > 0) { ctx.save(); const k = 0.6 + 0.4 * Math.sin(t * 6), r = 7; ctx.globalAlpha = Math.min(1, S.brand * 2) * k; ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 1.8; for (const s of [1, -1]) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 * s + i * TAU / 3; ctx[i ? 'lineTo' : 'moveTo'](f.x + Math.cos(a) * r, y - 34 + Math.sin(a) * r); } ctx.closePath(); ctx.stroke(); } ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.6; ctx.drawImage(sprite('#ff8a3a'), f.x - 10, y - 44, 20, 20); ctx.restore(); }
  // fury: a red blaze round them
  if (S.fury > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, S.fury * 2) * (0.35 + 0.15 * Math.sin(t * 14)); ctx.drawImage(sprite('#ff4a2a'), f.x - 30, y - 34, 60, 60); ctx.restore(); if (Math.random() < 0.5) flames(f.x + rr(-12, 12), f.y + rr(-4, 8), 1, { sp: 10, rise: 60, size: 7, life: 0.45 }); }
  // weightless: a little wind under them
  if (S.free > 0) { ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = 1.6; ctx.globalAlpha = Math.min(1, S.free * 2) * 0.7; for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; ctx.beginPath(); ctx.ellipse(f.x, f.y + 8, 18, 6, 0, a, a + 1.4); ctx.stroke(); } ctx.restore(); }
  if (S.mend > 0) { ctx.save(); ctx.fillStyle = 'rgba(150,110,70,0.75)'; for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.5; ctx.beginPath(); ctx.ellipse(f.x + Math.cos(a) * 8, y + Math.sin(a) * 8, 4, 3, a, 0, TAU); ctx.fill(); } ctx.restore(); }
}
// a wolf, from above: a long grey body, legs at a trot, a tail, a narrow head with ears
function drawWolf(f, t) {
  const down = f.hp <= 0 || f.pose === 'down', lift = f.lift || 0, run = Math.sin(f.walk * 1.3);
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(2, 8, 22, 8, 0, 0, TAU); ctx.fill();
  ctx.translate(0, -lift); ctx.rotate(f.face);
  if (f.st.flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; }
  if (down) ctx.scale(1, 0.75);
  const fur = f.fur || '#8d8a86', dark = f.furDark || '#5e5b58';
  // legs
  ctx.fillStyle = dark;
  for (const [lx, ly, ph] of [[10, -7, 1], [10, 7, -1], [-10, -7, -1], [-10, 7, 1]]) { ctx.beginPath(); ctx.ellipse(lx + (down ? 0 : run * 4 * ph), ly * 1.15, 4, 2.6, 0, 0, TAU); ctx.fill(); }
  // tail
  ctx.strokeStyle = fur; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.quadraticCurveTo(-24, Math.sin(t * 8 + f.x) * 5, -30, Math.sin(t * 8 + f.x) * 8); ctx.stroke();
  // body
  ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-2, 0, 12, 3.5, 0, 0, TAU); ctx.fill();
  // head, snout and ears
  ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(19, 0, 8, 7, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(24, -4); ctx.lineTo(33, 0); ctx.lineTo(24, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1d1a20'; ctx.beginPath(); ctx.arc(33, 0, 1.8, 0, TAU); ctx.fill();
  ctx.fillStyle = dark; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(15, s * 4); ctx.lineTo(13, s * 10); ctx.lineTo(19, s * 6); ctx.closePath(); ctx.fill(); }
  if (!down) { ctx.fillStyle = '#ffd36a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(23, s * 3, 1.3, 0, TAU); ctx.fill(); } }
  ctx.restore(); ctx.shadowBlur = 0;
}
function star5(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); }
// the move a fighter is about to make, written in the air above them as it winds up (so you can see it coming)
function drawAirGlyph(f) {
  const G = f.glyph;
  if (!G) return;
  // a beast doesn't write: it gathers itself to spring, and you can see it coming
  if (f.beast) {
    const k = clamp(G.t / G.dur, 0, 1), x = f.x, y = f.y - 34;
    ctx.save(); ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    ctx.font = `bold 14px ${BODY}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd0c0'; ctx.fillText('!', x, y + 5); ctx.restore();
    return;
  }
  const k = clamp(G.t / G.dur, 0, 1), col = WAYS[G.move.way].color, R = 22, x = f.x, y = f.y - 46 - (f.lift || 0);
  ctx.save();
  ctx.fillStyle = 'rgba(239,230,208,0.78)'; ctx.beginPath(); ctx.arc(x, y, R + 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const total = G.move.strokes.reduce((a, s) => a + s.length, 0);
  let left = Math.floor(total * Math.min(1, k * 1.25));
  for (const s of G.move.strokes) { if (left <= 1) break; ctx.beginPath(); for (let i = 0; i < Math.min(s.length, left); i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + s[i].x * R, y + s[i].y * R); ctx.stroke(); left -= s.length; }
  ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R + 5, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  ctx.restore();
}

