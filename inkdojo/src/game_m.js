// ── the valley and the town ──
// Your home sits at the south end of a green valley; a dirt road winds north past pines and over a stream to the town
// gate. The town is a square with a well, the post office, the calligrapher's house, a few homes and stalls, and the
// dojo's gate at its top. Each place has spots (where you arrive) and exits (where you leave for the next place).
const ROAD = [[500, 2330], [560, 2120], [420, 1860], [600, 1560], [450, 1250], [570, 950], [430, 650], [520, 350], [500, 0]];
function roadDist(x, y) {
  let best = Infinity;
  for (let i = 1; i < ROAD.length; i++) {
    const [ax, ay] = ROAD[i - 1], [bx, by] = ROAD[i], dx = bx - ax, dy = by - ay, k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * k, y - ay - dy * k));
  }
  return best;
}
const STREAM_Y = x => 1480 + 40 * Math.sin(x / 140);
const HOUSE = { x: 500, y: 2420, w: 220, h: 150 };
const SCENES = {
  home: { w: 1000, h: 2600, edge: 30, day: true, name: 'The valley',
    spots: { door: { x: 500, y: 2300 }, north: { x: 500, y: 140 } },
    exits: [{ id: 'town', x: 500, y: 36, r: 90, to: 'town', at: 'gate', label: 'To town' }] },
  town: { w: 1300, h: 1250, edge: 30, day: true, name: 'The town',
    spots: { gate: { x: 650, y: 1110 }, dojoGate: { x: 650, y: 370 } },
    exits: [{ id: 'valley', x: 650, y: 1225, r: 95, to: 'home', at: 'north', label: 'Home' }, { id: 'dojo', x: 650, y: 290, r: 42, to: 'dojo', at: 'gate', label: 'Dojo' }] },
  dojo: { w: 1600, h: 1700, edge: 80, name: 'The dojo',
    spots: { gate: { x: 800, y: 1048 } },
    exits: [{ id: 'town', x: 800, y: 1118, r: 30, to: 'town', at: 'dojoGate', label: 'To town' }] },
};
// what stands in each place
function sceneSolids(name) {
  if (name === 'dojo') return DOJO_SOLIDS;
  const out = [];
  let seed = name === 'home' ? 7 : 19; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (name === 'home') {
    out.push({ ...HOUSE, kind: 'house', roof: '#6b3a2a', door: 'n' });
    for (let i = 0; i < 160 && out.length < 75; i++) {
      const x = 50 + r() * 900, y = 60 + r() * 2480;
      if (roadDist(x, y) < 95 || Math.abs(y - STREAM_Y(x)) < 40 || (Math.abs(x - HOUSE.x) < 200 && Math.abs(y - HOUSE.y) < 180) || out.some(o => Math.hypot(o.x - x, o.y - y) < 70)) continue;
      out.push({ x, y, r: 18 + r() * 6, kind: 'pine' });
    }
    for (let i = 0; i < 40 && out.filter(o => o.kind === 'rock').length < 9; i++) {
      const x = 80 + r() * 840, y = 200 + r() * 2100;
      if (roadDist(x, y) < 75 || out.some(o => Math.hypot(o.x - x, o.y - y) < 60)) continue;
      out.push({ x, y, r: 11 + r() * 7, kind: 'rock' });
    }
  } else {
    out.push({ x: 230, y: 600, w: 220, h: 170, kind: 'house', roof: '#7a3b2e', sign: 'Post', door: 'e' },
             { x: 1070, y: 600, w: 220, h: 170, kind: 'house', roof: '#3b4f7a', sign: 'Calligraphy', door: 'w' },
             { x: 240, y: 300, w: 200, h: 150, kind: 'house', roof: '#5d4a33' }, { x: 1060, y: 300, w: 200, h: 150, kind: 'house', roof: '#4f5a3a' },
             { x: 230, y: 960, w: 200, h: 140, kind: 'house', roof: '#6b4d3a' }, { x: 1070, y: 960, w: 200, h: 140, kind: 'house', roof: '#5a3d4f' },
             { x: 650, y: 170, w: 380, h: 170, kind: 'house', roof: '#2a1a10', sign: 'Dojo', gate: true },
             { x: 470, y: 880, w: 100, h: 54, kind: 'stall', roof: '#c63f2e' }, { x: 830, y: 880, w: 100, h: 54, kind: 'stall', roof: '#2e7a5a' });
    out.push({ x: 650, y: 640, r: 30, kind: 'well' });
    for (const [x, y] of [[90, 120], [1210, 120], [90, 1160], [1210, 1160], [420, 140], [880, 140]]) out.push({ x, y, r: 20, kind: 'tree' });
    for (const [x, y] of [[520, 520], [780, 520], [520, 760], [780, 760]]) out.push({ x, y, r: 12, kind: 'lantern' });
  }
  return out;
}
const FLOORS = {};
function paintScene(name) {
  const S = SCENES[name], cv2 = document.createElement('canvas');
  cv2.width = S.w; cv2.height = S.h;
  const c = cv2.getContext('2d');
  if (name === 'dojo') paintDojo(c); else if (name === 'home') paintValley(c); else paintTown(c);
  return cv2;
}
function grass(c, w, h, seed0) {
  let seed = seed0; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = c.createLinearGradient(0, 0, w * 0.3, h); g.addColorStop(0, '#4f7a3a'); g.addColorStop(1, '#3f6a32');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 900; i++) { c.fillStyle = r() < 0.5 ? 'rgba(120,170,80,0.25)' : 'rgba(30,60,25,0.22)'; c.beginPath(); c.ellipse(r() * w, r() * h, 6 + r() * 16, 3 + r() * 6, r() * 3, 0, TAU); c.fill(); }
  for (let i = 0; i < w * h / 6000; i++) { c.fillStyle = ['#f4efe4', '#f1dc6a', '#ff9ab8', '#bfe6ff'][(r() * 4) | 0]; c.beginPath(); c.arc(r() * w, r() * h, 2.2, 0, TAU); c.fill(); }
}
function paintValley(c) {
  const S = SCENES.home;
  grass(c, S.w, S.h, 5);
  // the stream, east to west, and the bridge where the road crosses it
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, col] of [[46, '#2f5a6a'], [34, '#3f86a8'], [10, 'rgba(220,245,255,0.35)']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let x = 0; x <= S.w; x += 10) (x ? c.lineTo : c.moveTo).call(c, x, STREAM_Y(x)); c.stroke(); }
  // the road
  for (const [w, col] of [[112, '#6e5a3c'], [96, '#9b8461'], [40, 'rgba(180,160,120,0.35)']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); ROAD.forEach(([x, y], i) => (i ? c.lineTo : c.moveTo).call(c, x, y)); c.stroke(); }
  let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 500; i++) { const x = r() * S.w, y = r() * S.h; if (roadDist(x, y) < 44) { c.fillStyle = 'rgba(60,45,30,0.35)'; c.beginPath(); c.arc(x, y, 1.5 + r() * 2, 0, TAU); c.fill(); } }
  const bx = (() => { let best = 0, bd = Infinity; for (let x = 300; x < 700; x += 2) { const d = roadDist(x, STREAM_Y(x)); if (d < bd) { bd = d; best = x; } } return best; })(), by = STREAM_Y(bx);
  c.fillStyle = '#7a5a3a'; c.fillRect(bx - 60, by - 34, 120, 68);
  c.strokeStyle = 'rgba(40,25,12,0.6)'; c.lineWidth = 2; for (let x = bx - 56; x < bx + 60; x += 12) { c.beginPath(); c.moveTo(x, by - 34); c.lineTo(x, by + 34); c.stroke(); }
  c.fillStyle = '#4a321e'; c.fillRect(bx - 64, by - 38, 128, 6); c.fillRect(bx - 64, by + 32, 128, 6);
  // the garden round the house: a vegetable patch and a path to the door
  c.fillStyle = '#5a4026'; c.fillRect(180, 2380, 160, 110);
  c.strokeStyle = '#6f9a3c'; c.lineWidth = 6; for (let y = 2395; y < 2490; y += 18) { c.beginPath(); c.moveTo(190, y); c.lineTo(330, y); c.stroke(); }
  c.fillStyle = '#9b8461'; c.fillRect(470, 2280, 60, 70);
  // a fence round the yard
  c.strokeStyle = '#8a6a44'; c.lineWidth = 4; c.strokeRect(160, 2250, 680, 320);
  c.fillStyle = '#4f7a3a'; c.fillRect(455, 2244, 90, 12);
}
function paintTown(c) {
  const S = SCENES.town;
  grass(c, S.w, S.h, 9);
  // the streets: from the gate up to the dojo, and across past the post office and the calligrapher
  c.fillStyle = '#a89878'; c.fillRect(580, 260, 140, 990); c.fillRect(120, 560, 1060, 140);
  // the square, cobbled, round the well
  c.fillStyle = '#b8ab8c'; c.beginPath(); c.arc(650, 640, 250, 0, TAU); c.fill();
  let seed = 13; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.strokeStyle = 'rgba(80,70,55,0.25)'; c.lineWidth = 1;
  for (let i = 0; i < 900; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 245, x = 650 + Math.cos(a) * d, y = 640 + Math.sin(a) * d; c.beginPath(); c.ellipse(x, y, 7, 5, r() * 3, 0, TAU); c.stroke(); }
  for (let y = 300; y < 1250; y += 22) for (let x = 584; x < 716; x += 26) { if (Math.hypot(x - 650, y - 640) < 250) continue; c.strokeStyle = 'rgba(80,70,55,0.25)'; c.strokeRect(x + (y / 22 % 2) * 13, y, 24, 20); }
  // the town wall, with the gate at the bottom
  c.fillStyle = '#5e5446'; c.fillRect(0, 0, S.w, 22); c.fillRect(0, 0, 22, S.h); c.fillRect(S.w - 22, 0, 22, S.h);
  c.fillRect(0, S.h - 22, 540, 22); c.fillRect(760, S.h - 22, 540, 22);
  c.fillStyle = '#3a2a1a'; c.fillRect(530, S.h - 40, 22, 40); c.fillRect(748, S.h - 40, 22, 40);
}
// standing things that aren't in the dojo: pines, houses, stalls, the well
function drawScenery(t, layer) {
  for (const s of SOLIDS) {
    if (s.kind === 'house' || s.kind === 'stall') {
      if (layer !== 'low') continue;
      const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0 + 8, y0 + 10, s.w, s.h);
      ctx.fillStyle = s.roof; ctx.fillRect(x0, y0, s.w, s.h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, y0, s.w, s.h / 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      for (let x = x0 + 12; x < x0 + s.w; x += 14) { ctx.beginPath(); ctx.moveTo(x, y0 + 2); ctx.lineTo(x, y0 + s.h - 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0, s.y - 3, s.w, 6);
      ctx.strokeStyle = 'rgba(20,12,6,0.8)'; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, s.w, s.h);
      if (s.door) { ctx.fillStyle = '#2a1a10'; const d = s.door; if (d === 'n') ctx.fillRect(s.x - 18, y0 - 4, 36, 8); else if (d === 'e') ctx.fillRect(x0 + s.w - 4, s.y - 18, 8, 36); else ctx.fillRect(x0 - 4, s.y - 18, 8, 36); }
      if (s.gate) { ctx.fillStyle = '#c63f2e'; ctx.fillRect(s.x - 70, y0 + s.h - 6, 12, 22); ctx.fillRect(s.x + 58, y0 + s.h - 6, 12, 22); ctx.fillRect(s.x - 84, y0 + s.h - 10, 168, 9); }
      if (s.sign) { ctx.font = `bold ${s.kind === 'house' && s.gate ? 22 : 15}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = '#efe6d0'; const ty = s.y + 6; const w = ctx.measureText(s.sign).width + 16; ctx.fillStyle = 'rgba(30,20,12,0.85)'; ctx.fillRect(s.x - w / 2, ty - 17, w, 24); ctx.fillStyle = '#efe6d0'; ctx.fillText(s.sign, s.x, ty); }
    } else if (s.kind === 'well') {
      if (layer !== 'low') continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(s.x + 4, s.y + 6, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8f877a'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1d3a4a'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.62, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.x - s.r, s.y); ctx.lineTo(s.x + s.r, s.y); ctx.stroke();
    } else if (s.kind === 'pine') {
      if (layer === 'low') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(s.x + 8, s.y + 10, s.r * 1.5, s.r, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a2f22'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.45, 0, TAU); ctx.fill(); continue; }
      const under = player && [player, ...fighters()].some(f => Math.hypot(f.x - s.x, f.y - s.y + 10) < s.r * 1.6);
      ctx.globalAlpha = under ? 0.35 : 1;
      for (const [k, col] of [[1.7, '#1f4a2a'], [1.25, '#2a5e34'], [0.8, '#367240']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x - (1.7 - k) * 4, s.y - 14 - (1.7 - k) * 8, s.r * k, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
}
// the ways out of a place: a ring on the ground and where it leads
function drawExits(t) {
  for (const e of SCENES[SCENE].exits) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.save(); ctx.strokeStyle = hexA(C.gold, 0.35 + 0.3 * pulse); ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.ellipse(e.x, e.y, Math.min(e.r, 60), Math.min(e.r, 60) * 0.45, 0, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.font = `bold 13px ${BODY}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,16,0.8)';
    const ly = e.y + (e.y > WORLD.h / 2 ? -28 : 34);
    ctx.strokeText(e.label, e.x, ly); ctx.fillStyle = C.gold; ctx.fillText(e.label, e.x, ly);
  }
}
// go to a place, arriving at one of its spots
function enterScene(name, at) {
  const S = SCENES[name];
  SCENE = name; WORLD.w = S.w; WORLD.h = S.h; WORLD.edge = S.edge;
  SOLIDS.length = 0; SOLIDS.push(...sceneSolids(name));
  floor = FLOORS[name] || (FLOORS[name] = paintScene(name));
  const p = S.spots[at] || Object.values(S.spots)[0];
  if (player) { player.x = p.x; player.y = p.y; player.vx = player.vy = 0; player.kx = player.ky = 0; }
  FX = []; TEXTS = []; GHOSTS = []; DECALS = []; SHOWS = []; clearSpells();
  if (save) { save.scene = name; save.at = at; writeSave(); }
}
const exitAt = f => SCENES[SCENE].exits.find(e => Math.hypot(f.x - e.x, (f.y - e.y) * (e.r > 60 ? 1.6 : 1)) < e.r);
