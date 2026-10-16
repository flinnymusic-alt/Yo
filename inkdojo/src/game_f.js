// ── the game: title, the way you choose, the valley, the town, the dojo, fights, lessons ──
let state = 'title', FIGHT = null, T = 0, slowmo = 0, banner = null, overlay = null, pickWay = null, buttons = [], calm = 0;
// the fighters in this place (the bandits stay hidden until they step out of the trees)
const fighters = () => FOES.filter(f => f.scene === SCENE && !f.hidden);
function setupWorld() {
  player = makeFighter({ isPlayer: true, way: save.way, name: 'You' });
  player.carry = save.q === Q.HOME || save.q === Q.LAST;
  if (save.q === Q.HOME) save.ambush = false;
  const mk = (o, extra) => { const f = makeFighter({ ...o, ...extra }); Object.assign(f, extra); f.scene = extra.scene; return f; };
  FOES = [
    ...ROSTER.map(o => mk(o, { scene: 'dojo' })),
    ...WOLVES.map(o => mk({ ...o, way: 'beast', rank: 0 }, { scene: 'home', beast: true, kit: WOLF_KIT, col: '#b9b2a6', hidden: save.wolves.includes(o.id) || save.q >= Q.HOME })),
    ...BANDITS.map((o, i) => mk({ ...o, way: banditWays()[i], rank: 2, post: [500, 1200] }, { scene: 'home', bandit: true, boss: !!o.boss, hidden: true })),
  ];
  for (const f of FOES) if (save.beaten.includes(f.id) || save.wolves.includes(f.id)) { f.beaten = true; f.mode = 'beaten'; f.pose = 'bow'; }
  NPCS = NPC_LIST.map(makeNpc);
  FX = []; TEXTS = []; GHOSTS = []; DECALS = []; SHOWS = []; clearSpells(); FIGHT = null; slowmo = 0; HELD = null;
  PAD.strokes = []; PAD.shown = null; PAD.pen = null; PAD.guide = null;
  enterScene(save.scene || 'home', save.at || 'door');
  updateCam(0, true);
}
function say(title, sub, life = 2.6, col) { banner = { title, sub, life, max: life, col: col || C.gold }; }
function beginGame(way) { save = newSave(way); writeSave(); setupWorld(); state = 'play'; calm = 1; say(`The Way of ${WAYS[way].name}`, `${WAYS[way].animal} · ${WAYS[way].style}`, 2.4, WAYS[way].color); }
function continueGame() { setupWorld(); state = 'play'; say(SCENES[SCENE].name, goal().text, 3, WAYS[save.way].color); }

// a fighter (or a wolf) sees you coming, walks up, and the fight begins
// (nobody interrupts you while you're writing)
const writing = () => !!(PAD.pen || PAD.judgeAt || (PAD.strokes.length && !PAD.shown) || (player && player.act));
function lookForChallenger() {
  if (FIGHT || state !== 'play' || calm > 0 || overlay || writing() || fighters().some(f => f.mode === 'approach')) return;
  let best = null, bd = Infinity;
  for (const f of fighters()) {
    if (f.beaten || f.mode !== 'post') continue;
    const d = dist(f, player);
    // a fighter who won't fight you waves you off
    if (!mayChallenge(f)) { const w = waveOff(f); if (w && d < 150 && T - (f.nagT ?? -99) > 6) { f.nagT = T; words(f.x, f.y - 42, w, C.muted, 12, 1.4); } continue; }
    const reach = f.beast ? 270 : f.bandit ? 4000 : 215;
    if (d < reach && d < bd) { best = f; bd = d; }
  }
  if (best) {
    best.mode = 'approach';
    say(best.beast ? `A wolf!` : `${best.name} challenges you`, challengeLine(best), 2.2, fcol(best));
    words(best.x, best.y - 40, '!', '#ffe08a', 24, 0.9);
    if (best.beast) noise(0.5, 0.12, 300, 120, 2);
  }
}
function startFight(f) {
  const cx = (player.x + f.x) / 2, cy = (player.y + f.y) / 2;
  FIGHT = { foe: f, on: false, intro: 1.9, t: 0, cx, cy, r: 255, dealt: 0, taken: 0, over: null };
  // how good they are: the wolves are feeble; each white belt you beat makes the next a little better; the bandits fight
  // like brown belts
  f.sk = skillFor(f);
  f.maxHp = Math.round(f.sk.hp * (WAYMOD[f.way] || WAYMOD.master).hp / 100);
  f.mode = 'fight'; resetFighter(f); f.hp = f.maxHp; f.ki = f.maxKi; f.ai.think = rr(0.8, 1.3) * (f.sk.think[0] / 0.95); f.ai.cd = {}; f.ai.range = f.beast ? rr(40, 90) : 0;
  const keepHp = f.bandit && banditsLeft().length < BANDITS.length;
  resetFighter(player); player.pose = 'bow'; player.poseT = 0; f.pose = 'bow'; f.poseT = 0;
  if (!keepHp) player.hp = player.maxHp;
  player.ki = player.maxKi;
  clearSpells();
  PAD.strokes = []; PAD.shown = null;
  SFX.drum(2);
}
function knockedOut(t, src) {
  if (!FIGHT || FIGHT.over) return;
  FIGHT.on = false; FIGHT.over = { winner: src, loser: t, t: 0 };
  t.hp = 0; t.pose = 'down'; t.act = null; t.glyph = null; src.act = null;
  slowmo = 0.9; SFX.gong(); cam.shake = 8;
  burst(t.x, t.y, wcol(moveWay(src)), 30, 220, 0.9, 8); inkSplash(t.x, t.y, 16, 180);
}
function endFight() {
  const O = FIGHT.over, foe = FIGHT.foe;
  calm = 4;
  FIGHT = null; clearSpells();
  resetFighter(player); resetFighter(foe);
  if (O.winner === player) {
    foe.beaten = true; foe.hp = foe.maxHp; foe.pose = 'idle'; save.stats.wins++;
    wonAgainst(foe);
  } else {
    save.stats.falls++; writeSave();
    overlay = { kind: 'fallen', t: 0, foe };
    foe.mode = 'return'; foe.hp = foe.maxHp; foe.pose = 'idle';
  }
}
// the lesson after a win: the moves you've just learned, one after another
function lesson(foe, before, after, o = {}) {
  const moves = MOVES[save.way].filter(m => m.order >= before && m.order < after), move = moves[0] || null;
  return { kind: 'learn', t: 0, foe, move, more: moves.slice(1), demo: move ? writeOut(move, { wobble: 0.006 }) : null, ...o };
}
function afterLearn() {
  const O = overlay; overlay = null;
  if (O && O.more && O.more.length) { const m = O.more[0]; overlay = { ...O, t: 0, move: m, more: O.more.slice(1), demo: writeOut(m, { wobble: 0.006 }), next: true }; return; }
  if (O && O.allWhite) say('All four white belts beaten', save.q === Q.PACKAGE ? 'Go back to the post office for the package.' : 'Now find the post office in town.', 4.5);
  if (O && O.teach) say('Hold an attack', 'End an attack with a little curl to hold it. Tap its red seal by the paper to throw it.', 5);
  resetFighter(player); player.hp = player.maxHp; player.ki = player.maxKi; player.pose = 'idle';
}
function afterFall() {
  const foe = overlay && overlay.foe;
  overlay = null; HELD = null;
  resetFighter(player); player.hp = player.maxHp; player.ki = player.maxKi; player.pose = 'idle';
  fellTo(foe);
  updateCam(0, true);
}

// ── every frame ──
const keys = {};
let stick = null; // { id, x0, y0, x, y }
let BOT = null; // for tests: a bot walks you ({ mx, my })
function update(dt) {
  T += dt;
  stepFx(dt);
  const paused = state !== 'play' || !!overlay; if (TILT.paused && !paused) TILT.relevel = true; TILT.paused = paused;
  tiltTick(dt);
  if (banner && (banner.life -= dt) <= 0) banner = null;
  if (overlay) { overlay.t += dt; return; }
  if (state !== 'play') return;
  const sdt = slowmo > 0 ? dt * 0.35 : dt; slowmo = Math.max(0, slowmo - dt); calm = Math.max(0, calm - dt);
  padTick(dt);
  // you: walk by tilting the phone, or with the stick (drag on the floor), or the keys
  let mx = 0, my = 0;
  if (BOT) { mx = BOT.mx; my = BOT.my; }
  else if (stick) { const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy); if (d > 6) { const k = Math.min(1, d / 50); mx = dx / d * k; my = dy / d * k; } }
  else if (TILT.on) { mx = TILT.x; my = TILT.y; }
  if (keys.ArrowLeft || keys.KeyA) mx -= 1; if (keys.ArrowRight || keys.KeyD) mx += 1; if (keys.ArrowUp || keys.KeyW) my -= 1; if (keys.ArrowDown || keys.KeyS) my += 1;
  const mn = Math.hypot(mx, my); if (mn > 1) { mx /= mn; my /= mn; }
  const PS = player.st;
  const canWalk = player.hp > 0 && PS.stun <= 0 && PS.frozen <= 0 && PS.air <= 0 && PS.root <= 0 && PS.under <= 0 && PS.leap <= 0 && PS.high <= 0 && PS.stance <= 0 && PS.mend <= 0 && PS.statue <= 0 && !player.dash
    && !(FIGHT && (FIGHT.intro > 0 || FIGHT.over)) && !(player.act && (player.act.phase === 'wind' || player.act.chan > 0));
  const sp = player.speed * moveMul(player);
  player.vx = canWalk ? mx * sp : 0; player.vy = canWalk ? my * sp : 0;
  if (FIGHT && FIGHT.foe) player.face = angTo(player, FIGHT.foe); else if (mn > 0.1) player.face = Math.atan2(my, mx);
  // the fight
  if (FIGHT) {
    const F = FIGHT, foe = F.foe;
    if (F.intro > 0) {
      F.intro -= dt; foe.face = angTo(foe, player);
      if (F.intro < 1.1 && !F.said) { F.said = true; say('Begin!', '', 0.9, C.seal); SFX.drum(1); }
      if (F.intro <= 0) { F.on = true; player.pose = 'idle'; foe.pose = 'idle'; }
    } else if (F.over) { F.over.t += dt; if (F.over.t > 1.7) endFight(); }
    else { F.t += sdt; aiFight(foe, player, sdt); }
  }
  // everyone else
  for (const f of fighters()) {
    if (FIGHT && f === FIGHT.foe) continue;
    if (f.mode === 'approach') {
      const d = dist(f, player), a = angTo(f, player); f.face = a;
      if (FIGHT) { f.mode = 'return'; continue; }
      if (d > 140) { f.vx = Math.cos(a) * f.speed * 0.9; f.vy = Math.sin(a) * f.speed * 0.9; } else { f.vx = f.vy = 0; if (!writing()) startFight(f); }
    } else if (f.mode === 'flee') {
      // beaten on the road: off into the trees
      const a = angTo(player, f); f.vx = Math.cos(a) * f.speed * 1.2; f.vy = Math.sin(a) * f.speed * 1.2; f.face = a;
      f.fleeT = (f.fleeT || 0) + dt; if (f.fleeT > 2.2) { f.hidden = true; f.vx = f.vy = 0; smoke(f.x, f.y, 4, { size: 12 }); }
    } else if (f.mode === 'return') {
      const d = dist(f, f.post), a = angTo(f, f.post);
      if (d > 6) { f.vx = Math.cos(a) * f.speed * 0.7; f.vy = Math.sin(a) * f.speed * 0.7; f.face = a; }
      else { f.vx = f.vy = 0; f.mode = f.beaten ? 'beaten' : 'post'; f.pose = f.beaten ? 'bow' : 'idle'; f.face = angTo(f, { x: 800, y: 850 }); }
    } else {
      f.vx = f.vy = 0;
      // practising at their post now and then
      if (f.mode === 'post' && !f.beast && Math.random() < dt * 0.25 && f.poseT >= 1) { f.pose = Math.random() < 0.5 ? 'strike' : 'kick'; f.poseT = 0; }
    }
  }
  if (!FIGHT) storyTick(dt);
  if (overlay) return;
  lookForChallenger();
  // moves in progress, statuses, motion
  const live = FIGHT ? [player, FIGHT.foe] : [player];
  for (const f of live) stepAct(f, sdt);
  for (const f of [player, ...fighters()]) {
    stepStatus(f, sdt);
    const ox = f.x, oy = f.y, moving = Math.hypot(f.vx, f.vy) > 5;
    const dashing = stepDash(f, sdt);
    const pinned = f.st.frozen > 0 || f.st.under > 0 || f.st.leap > 0 || f.st.high > 0 || f.st.statue > 0;
    if (!pinned) { f.x += ((dashing ? 0 : f.vx) + f.kx) * sdt; f.y += ((dashing ? 0 : f.vy) + f.ky) * sdt; }
    const fr = Math.exp(-7 * sdt); f.kx *= fr; f.ky *= fr;
    if (moving && !dashing) f.walk += sdt * 11; else f.walk *= 0.8;
    blocked(f, f.r);
    if (f.st.under <= 0 && f.st.leap <= 0) for (const s of STONES) stoneShove(s, f);
    stepWind(f, sdt, Math.hypot(f.x - ox, f.y - oy));
  }
  if (FIGHT) {
    // the ring holds the two of you (and a gale that drives you into its edge slams you against it)
    for (const f of [player, FIGHT.foe]) { const d = Math.hypot(f.x - FIGHT.cx, f.y - FIGHT.cy), m = FIGHT.r - f.r; if (d > m) { const k = m / d; f.x = FIGHT.cx + (f.x - FIGHT.cx) * k; f.y = FIGHT.cy + (f.y - FIGHT.cy) * k; f.kx *= -0.3; f.ky *= -0.3;
      if (f.st.galeT > 0 && FIGHT.on) { f.st.galeT = 0; const src = foeOf(f); words(f.x, f.y - 46, 'Slammed!', ELC.air.light, 15); hurt(f, src, 8, { power: 1, big: true }); } } }
    const a = FIGHT.foe, d = dist(player, a), m = player.r + a.r;
    if (d < m && d > 0) { const k = (m - d) / d / 2; player.x -= (a.x - player.x) * k; player.y -= (a.y - player.y) * k; a.x += (a.x - player.x) * k; a.y += (a.y - player.y) * k; }
  }
  stepTimers(sdt); stepShots(sdt); stepWaves(sdt); stepZones(sdt); stepEnts(sdt); stepStones(sdt); stepBeams(sdt); stepShows(dt);
  updateCam(dt);
}

// ── drawing a frame ──
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
  if (state === 'title') { drawTitle(); drawOverlay(); placeTiltBtn(); return; }
  ctx.save();
  ctx.beginPath(); ctx.rect(L.arena.x, L.arena.y, L.arena.w, L.arena.h); ctx.clip();
  worldTransform();
  drawFloor();
  if (SCENE === 'dojo') drawPond(T);
  drawExits(T);
  if (FIGHT) { ctx.save(); ctx.strokeStyle = 'rgba(20,14,24,0.55)'; ctx.lineWidth = 9; ctx.setLineDash([28, 10, 6, 10]); ctx.beginPath(); ctx.arc(FIGHT.cx, FIGHT.cy, FIGHT.r, 0, TAU); ctx.stroke(); ctx.restore(); }
  drawDecals();
  drawZones(T);
  drawEnts(T, 'floor');
  drawWaves(T);
  drawProps(T, 'low'); drawScenery(T, 'low');
  drawFx('under');
  drawStones();
  const all = [player, ...fighters(), ...npcsHere()].sort((a, b) => a.y - b.y);
  for (const f of all) drawFighter(f, T);
  for (const f of all) if (!f.isNpc) drawStatus(f, T);
  drawEnts(T, 'up');
  drawShots(T);
  drawBeams(T);
  drawFx('over');
  drawProps(T, 'high'); drawScenery(T, 'high');
  for (const f of [...fighters(), ...npcsHere()]) if (!FIGHT || f !== FIGHT.foe) nameTag(f);
  drawBubbles();
  if (FIGHT) drawAirGlyph(FIGHT.foe);
  drawShows();
  drawTexts();
  ctx.restore();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!FIGHT) pointToNext();
  drawHud();
  drawPanel();
  drawPad();
  drawTiltBubble();
  placeTiltBtn();
  if (stick) { ctx.strokeStyle = 'rgba(236,230,244,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(stick.x0, stick.y0, 50, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(236,230,244,0.35)'; const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.min(50, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); ctx.beginPath(); ctx.arc(stick.x0 + Math.cos(a) * d, stick.y0 + Math.sin(a) * d, 18, 0, TAU); ctx.fill(); }
  drawBanner();
  drawOverlay();
}
function nameTag(f) {
  if (dist(f, player) > 330) return;
  ctx.textAlign = 'center'; ctx.font = `bold 12px ${BODY}`;
  if (f.isNpc && dist(f, player) < 140) return;
  const y = f.y - 30, txt = f.beaten ? `${f.name} ✓` : f.name, later = !f.isNpc && !f.beaten && !mayChallenge(f);
  ctx.globalAlpha = later ? 0.45 : 1;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,16,0.8)'; ctx.strokeText(txt, f.x, y);
  ctx.fillStyle = f.isNpc ? C.paper : f.beaten ? '#bfb8cc' : fcol(f); ctx.fillText(txt, f.x, y);
  ctx.globalAlpha = 1;
}
// an arrow at the edge of the view toward where the story goes next
function pointToNext() {
  const G = goal(), best = G.at;
  if (!best) return;
  const s = toScreen(best.x, best.y), A = L.arena, m = 30;
  if (s.x > A.x + m && s.x < A.x + A.w - m && s.y > A.y + 90 && s.y < A.y + A.h - m) return;
  const cx = A.x + A.w / 2, cy = A.y + A.h * 0.56, a = Math.atan2(s.y - cy, s.x - cx);
  const rx = A.w / 2 - m, ry = A.h * 0.42 - m, k = 1 / Math.max(Math.abs(Math.cos(a)) / rx, Math.abs(Math.sin(a)) / ry);
  const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k, col = best.label ? C.gold : best.isNpc ? C.paper : fcol(best);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.globalAlpha = 0.85 + 0.15 * Math.sin(T * 5);
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.textAlign = 'center'; ctx.font = `bold 11px ${BODY}`; ctx.fillStyle = col; ctx.fillText(best.label || best.name, x - Math.cos(a) * 26, y - Math.sin(a) * 26 + 4);
}
function bar(x, y, w, h, k, col, back = 'rgba(255,255,255,0.12)') { roundRect(x, y, w, h, h / 2); ctx.fillStyle = back; ctx.fill(); if (k > 0) { roundRect(x, y, Math.max(h, w * k), h, h / 2); ctx.fillStyle = col; ctx.fill(); } }
// a fighter's twist, as a short bar and a few words: fire's heat, air's wind, water's puddle, earth's stones
function twistLine(f) {
  const way = moveWay(f);
  if (way === 'fire') return { k: f.heat / 100, col: f.heat >= 75 ? '#ff3a2a' : '#ff9a3a', text: f.heat >= 75 ? `heat ${Math.round(f.heat)} · burning!` : `heat ${Math.round(f.heat)}` };
  if (way === 'air') return { k: f.wind / 100, col: '#fbf6d8', text: `wind ${Math.round(f.wind)}` };
  if (way === 'water') return { k: 0, text: inZone(f, 'puddle') ? 'in water · +25%' : '' };
  if (way === 'earth') { const n = myStones(f).length; return { k: 0, text: n ? `${n} stone${n > 1 ? 's' : ''}` : '' }; }
  return { k: 0, text: '' };
}
function drawHud() {
  const pad = 12, w = Math.min(170, L.arena.w * 0.4), wc = WAYS[save.way].color, tw = twistLine(player);
  ctx.fillStyle = 'rgba(18,15,25,0.72)'; roundRect(pad - 6, pad - 6, w + 12, 56, 10); ctx.fill();
  ctx.textAlign = 'left'; ctx.font = `bold 12px ${BODY}`; ctx.fillStyle = C.fg; ctx.fillText(`You · ${WAYS[save.way].name}`, pad, pad + 8);
  bar(pad, pad + 14, w, 9, player.hp / player.maxHp, C.hp);
  bar(pad, pad + 27, w, 6, player.ki / player.maxKi, wc);
  if (save.way === 'fire' || save.way === 'air') { bar(pad, pad + 36, w, 4, tw.k, tw.col); if (save.way === 'fire') { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(pad + w * 0.75, pad + 35, 1.5, 6); } }
  ctx.font = `10px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(`ki ${Math.floor(player.ki)}${kiFlow(player) > 1 ? ' ↑' : ''}${tw.text ? ' · ' + tw.text : ''}`, pad, pad + 50);
  if (FIGHT && FIGHT.foe) {
    const f = FIGHT.foe, x = L.arena.x + L.arena.w - pad - w, col = fcol(f), ft = twistLine(f), fw = moveWay(f);
    ctx.fillStyle = 'rgba(18,15,25,0.72)'; roundRect(x - 6, pad - 6, w + 12, 56, 10); ctx.fill();
    ctx.textAlign = 'right'; ctx.font = `bold 12px ${BODY}`; ctx.fillStyle = col; ctx.fillText(f.name, x + w, pad + 8);
    bar(x, pad + 14, w, 9, f.hp / f.maxHp, C.hp);
    bar(x, pad + 27, w, 6, f.ki / f.maxKi, f.way === 'master' ? wcol(f.ai.way) : col);
    if (fw === 'fire' || fw === 'air') bar(x, pad + 36, w, 4, ft.k, ft.col);
    ctx.font = `10px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(f.beast ? 'wolf' : f.way === 'master' ? `every way · now ${WAYS[f.ai.way].name}` : `${f.bandit ? (f.boss ? 'bandit boss' : 'bandit') + ' · ' + WAYS[f.way].name : RANKS[f.rank].beltName}${beats(save.way, f.way) ? ' · your way beats theirs' : beats(f.way, save.way) ? ' · their way beats yours' : ''}`, x + w, pad + 50, w);
  } else {
    // what to do next
    const G = goal(), bw = Math.min(196, L.arena.w - w - 44), bx = L.arena.x + L.arena.w - pad - bw;
    ctx.font = `bold 12px ${BODY}`; const ls = wrapLines(G.text, bw).slice(0, 3), bh = 26 + ls.length * 15;
    ctx.fillStyle = 'rgba(18,15,25,0.72)'; roundRect(bx - 6, pad - 6, bw + 12, bh, 10); ctx.fill();
    ctx.textAlign = 'right'; ctx.fillStyle = C.gold; ls.forEach((l, i) => ctx.fillText(l, L.arena.x + L.arena.w - pad, pad + 8 + i * 15));
    ctx.font = `11px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(`${learnedCount()} moves known${HELD ? ' · one held' : ''}`, L.arena.x + L.arena.w - pad, pad + 8 + ls.length * 15 + 2);
  }
}
// round the pad: the line that says what was read, the Moves button, the sound button
function panelButtons() {
  const M = L.pad, y = M.cy - M.r - 30;
  return { moves: { x: L.wide ? L.arena.w + 10 : 12, y: y - 15, w: 84, h: 30 }, sound: { x: W - (L.wide ? 50 : 52), y: y - 15, w: 40, h: 30 } };
}
function drawPanel() {
  const M = L.pad, B = panelButtons(), y = M.cy - M.r - 30;
  if (!L.wide) { const g = ctx.createLinearGradient(0, L.arena.h - 20, 0, H); g.addColorStop(0, 'rgba(18,15,25,0)'); g.addColorStop(0.15, 'rgba(18,15,25,0.92)'); g.addColorStop(1, C.night); ctx.fillStyle = g; ctx.fillRect(0, L.arena.h - 20, W, H - L.arena.h + 20); }
  else { ctx.fillStyle = C.night; ctx.fillRect(L.arena.w, 0, W - L.arena.w, H); }
  pill(B.moves, 'MOVES', C.gold);
  pill(B.sound, soundOn ? '♪' : '–', C.muted);
  // the words sit in the gap between the two buttons: one line, or two if they don't fit
  const sh = PAD.shown, mid = (B.moves.x + B.moves.w + B.sound.x) / 2, maxW = B.sound.x - B.moves.x - B.moves.w - 16;
  const lines = (text, font, col) => {
    ctx.font = font; ctx.fillStyle = col;
    const ls = wrapLines(text, maxW);
    if (ls.length < 2) ctx.fillText(text, mid, y + 5, maxW);
    else { ctx.fillText(ls[0], mid, y - 2, maxW); ctx.fillText(ls.slice(1).join(' '), mid, y + 14, maxW); }
  };
  ctx.textAlign = 'center';
  if (sh) {
    const R = sh.R, took = R.verdict !== 'fizzle' && R.best;
    if (took) {
      ctx.font = `bold 14px ${BODY}`; ctx.fillStyle = R.perfect && sh.ok ? C.gold : sh.ok ? WAYS[R.best.g.way].color : C.rough;
      ctx.fillText(R.best.g.name, mid, y - 2, maxW);
      ctx.font = `12px ${BODY}`; ctx.fillStyle = sh.ok ? C.fg : C.rough;
      ctx.fillText(`${R.perfect ? 'Perfect' : R.verdict === 'clean' ? 'Clean' : 'Rough'} · ${Math.round(R.acc * 100)}% · ×${R.power.toFixed(1)}${sh.msg ? ' · ' + sh.msg : ''}`, mid, y + 14, maxW);
    } else lines(sh.msg, `bold 13px ${BODY}`, C.fizzle);
  } else lines(PAD.guide ? `Trace: ${PAD.guide.name}` : FIGHT && FIGHT.on ? 'Write a move' : TILT.on ? 'Tilt to walk · Write moves on the paper' : TILT.need && !TILT.denied ? 'Tap tilt (by the paper) to walk by leaning the phone' : 'Walk: drag the floor · Write moves on the paper', `italic 13px ${BODY}`, 'rgba(214,208,228,0.6)');
}
function tiltBubble() { const M = L.pad, r = 17, cx = M.cx - M.r + 22, cy = M.cy + M.r - 22; return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, cx, cy, r }; }
const tiltShown = () => TILT.on || TILT.need;
// the tilt button (a real button, for iPhones) sits over the circle whenever the circle shows
let tiltBtnAt = '';
function placeTiltBtn() {
  if (!tiltBtn) return;
  const show = state === 'play' && !overlay && tiltShown();
  let at = 'hidden';
  if (show) { const b = tiltBubble(), m = 10; at = [b.cx - b.r - m, b.cy - b.r - m, 2 * (b.r + m), 2 * (b.r + m) + 8].map(Math.round).join(','); }
  if (at === tiltBtnAt) return;
  tiltBtnAt = at;
  if (!show) { tiltBtn.hidden = true; return; }
  const [x, y, w, h] = at.split(',').map(Number);
  Object.assign(tiltBtn.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  tiltBtn.hidden = false;
}
function drawTiltBubble() {
  if (!tiltShown()) return;
  const b = tiltBubble();
  if (!TILT.on) {
    // not on yet: a little phone, rocking, and a ring that pulses to say "tap me" (or crossed out, if turned down)
    const off = TILT.denied, pulse = 0.5 + 0.5 * Math.sin(T * 4);
    ctx.save();
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, TAU); ctx.fillStyle = 'rgba(30,22,44,0.92)'; ctx.fill();
    ctx.strokeStyle = off ? C.muted : C.gold; ctx.lineWidth = 1.5; ctx.stroke();
    if (!off) { ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r + 3 + pulse * 5, 0, TAU); ctx.strokeStyle = hexA(C.gold, 0.15 + 0.4 * (1 - pulse)); ctx.lineWidth = 2; ctx.stroke(); }
    ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(off ? 0 : Math.sin(T * 2.2) * 0.4);
    roundRect(-5, -8, 10, 16, 2.5); ctx.strokeStyle = off ? C.muted : C.fg; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    if (off) { ctx.beginPath(); ctx.moveTo(b.cx - 9, b.cy + 9); ctx.lineTo(b.cx + 9, b.cy - 9); ctx.strokeStyle = C.hp; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.font = `10px ${BODY}`; ctx.fillStyle = off ? C.muted : C.gold; ctx.fillText(off ? 'tilt off' : 'tilt', b.cx, b.cy + b.r + 11);
    ctx.restore();
    return;
  }
  const lit = TILT.flash > 0, moving = Math.hypot(TILT.x, TILT.y) > 0.01, room = b.r - 5;
  ctx.save();
  ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, TAU); ctx.fillStyle = 'rgba(30,22,44,0.92)'; ctx.fill();
  ctx.strokeStyle = lit ? C.gold : C.muted; ctx.lineWidth = lit ? 2 : 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(b.cx, b.cy, room * TILT.DZ / TILT.FULL, 0, TAU); ctx.strokeStyle = 'rgba(169,159,188,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(b.cx + TILT.lx * room, b.cy + TILT.ly * room, 4.5, 0, TAU); ctx.fillStyle = moving ? C.gold : C.fg; ctx.fill();
  ctx.textAlign = 'center'; ctx.font = `10px ${BODY}`; ctx.fillStyle = lit ? C.gold : C.muted; ctx.fillText(lit ? 'level!' : 'level', b.cx, b.cy + b.r + 11);
  ctx.restore();
}
function pill(b, text, col) { roundRect(b.x, b.y, b.w, b.h, b.h / 2); ctx.fillStyle = 'rgba(30,22,44,0.92)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = `bold 13px ${BODY}`; ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2 + 5); }
const hit = (b, x, y) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
function drawBanner() {
  if (!banner) return;
  const k = banner.life / banner.max, a = Math.min(1, k * 4, (1 - k) * 8 + 0.2), y = L.arena.y + Math.min(150, L.arena.h * 0.3);
  ctx.globalAlpha = a; ctx.textAlign = 'center';
  ctx.font = `${Math.min(34, W / 12)}px ${DISPLAY}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,8,16,0.85)';
  const cx = L.arena.x + L.arena.w / 2;
  ctx.strokeText(banner.title, cx, y); ctx.fillStyle = banner.col; ctx.fillText(banner.title, cx, y);
  if (banner.sub) { ctx.font = `14px ${BODY}`; ctx.lineWidth = 4; wrapLines(banner.sub, L.arena.w - 40).forEach((l, i) => { ctx.strokeText(l, cx, y + 26 + i * 18); ctx.fillStyle = C.fg; ctx.fillText(l, cx, y + 26 + i * 18); }); }
  ctx.globalAlpha = 1;
}
function wrapLines(text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out;
}
function wrapText(text, x, y, maxW, lh) { const ls = wrapLines(text, maxW); ls.forEach((l, i) => ctx.fillText(l, x, y + i * lh)); return y + ls.length * lh; }

