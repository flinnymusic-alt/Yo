// ── the title: your way ──
const SIGNATURE = { water: 'whirlpool', fire: 'inferno', earth: 'mountain', air: 'typhoon' };
let titleT = 0, choosing = false;
const STAGE_NAME = ['at home', 'on the road to town', 'at the dojo', 'the package waits', 'carrying the package home', 'nearly home'];
function drawTitle() {
  titleT += 1 / 60;
  buttons = [];
  const cx = W / 2, top = Math.max(26, H * 0.05);
  // a great ensō behind the name
  ctx.save(); ctx.strokeStyle = 'rgba(233,187,82,0.12)'; ctx.lineWidth = Math.min(W, H) * 0.035; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, top + Math.min(W, H) * 0.2, Math.min(W, H) * 0.19, 2.4, 2.4 + TAU * 0.86); ctx.stroke(); ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = `${Math.min(64, W / 6)}px ${DISPLAY}`; ctx.fillStyle = C.paper; ctx.fillText('Ink Dojo', cx, top + Math.min(W, H) * 0.2 + 18);
  ctx.font = `14px ${BODY}`; ctx.fillStyle = C.muted;
  let y = wrapText('Write your moves with a brush. Fetch the package from town, and bring it home.', cx, top + Math.min(W, H) * 0.2 + 52, Math.min(W - 40, 420), 19) + 10;
  const saved = loadSave();
  if (saved && !choosing) {
    const wcol2 = WAYS[saved.way].color, bw = Math.min(W - 40, 360);
    y += 10;
    const b1 = { x: cx - bw / 2, y, w: bw, h: 64, go: () => { save = saved; continueGame(); } };
    roundRect(b1.x, b1.y, b1.w, b1.h, 14); ctx.fillStyle = C.night2; ctx.fill(); ctx.strokeStyle = wcol2; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `22px ${DISPLAY}`; ctx.fillStyle = wcol2; ctx.fillText(saved.q >= Q.DONE ? 'Walk the valley again' : 'Carry on', cx, y + 28);
    ctx.font = `13px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(`The Way of ${WAYS[saved.way].name} · ${saved.q >= Q.DONE ? 'chapter one done' : STAGE_NAME[saved.q]}`, cx, y + 49, bw - 16);
    buttons.push(b1);
    y += 84;
    const b2 = { x: cx - bw / 2, y, w: bw, h: 48, go: () => { choosing = true; pickWay = null; } };
    roundRect(b2.x, b2.y, b2.w, b2.h, 12); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `15px ${BODY}`; ctx.fillStyle = C.fg; ctx.fillText('Choose a new way', cx, y + 30);
    buttons.push(b2);
    return;
  }
  // the four ways
  ctx.font = `20px ${DISPLAY}`; ctx.fillStyle = C.gold; ctx.fillText('Choose your way', cx, y + 14); y += 30;
  const cols = W > 760 ? 4 : 2, gap = 12, cw = Math.min(220, (Math.min(W, 960) - 32 - gap * (cols - 1)) / cols), x0 = cx - (cw * cols + gap * (cols - 1)) / 2;
  const rows = 4 / cols, availH = H - y - 92, ch = Math.min(250, Math.max(170, availH / rows - gap));
  WAY_ORDER.forEach((w, i) => {
    const X = x0 + (i % cols) * (cw + gap), Y = y + Math.floor(i / cols) * (ch + gap), Wy = WAYS[w], sel = pickWay === w;
    roundRect(X, Y, cw, ch, 14); ctx.fillStyle = sel ? 'rgba(39,33,54,0.98)' : C.night2; ctx.fill(); ctx.strokeStyle = sel ? Wy.color : C.line; ctx.lineWidth = sel ? 2.5 : 1.2; ctx.stroke();
    const r = Math.min(cw * 0.24, ch * 0.2), M = { cx: X + cw / 2, cy: Y + 12 + r, r };
    paper(ctx, M, true);
    const g = MOVES[w].find(m => m.key === SIGNATURE[w]);
    glyphGuide(ctx, M, g, Wy.color, 0.95, false, Math.max(2, r * 0.07));
    ctx.textAlign = 'center'; ctx.font = `${Math.min(24, cw / 6)}px ${DISPLAY}`; ctx.fillStyle = Wy.color; ctx.fillText(Wy.name, X + cw / 2, Y + 2 * r + 42);
    ctx.font = `12px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(`${Wy.animal} · ${Wy.style}`, X + cw / 2, Y + 2 * r + 60);
    ctx.font = `11.5px ${BODY}`; ctx.fillStyle = C.fg;
    let ly = wrapText(Wy.blurb, X + cw / 2, Y + 2 * r + 78, cw - 14, 14);
    ctx.font = `bold 11px ${BODY}`; ctx.fillStyle = C.gold; if (ly + 4 < Y + ch) { ctx.fillText(`Twist: ${Wy.twist}`, X + cw / 2, ly + 4); ly += 15; }
    ctx.font = `11px ${BODY}`; ctx.fillStyle = C.muted; if (ly + 4 < Y + ch) ctx.fillText(`Beats ${WAYS[Wy.beats].name}`, X + cw / 2, ly + 4);
    buttons.push({ x: X, y: Y, w: cw, h: ch, go: () => { pickWay = w; SFX.tap(); } });
  });
  y += rows * (ch + gap) + 6;
  const bw = Math.min(W - 40, 320), b = { x: cx - bw / 2, y, w: bw, h: 52, go: () => { if (pickWay) { choosing = false; beginGame(pickWay); } } };
  roundRect(b.x, b.y, b.w, b.h, 26); ctx.fillStyle = pickWay ? WAYS[pickWay].color : 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.textAlign = 'center'; ctx.font = `17px ${BODY}`; ctx.fillStyle = pickWay ? C.night : C.muted;
  ctx.fillText(pickWay ? `Begin · ${WAYS[pickWay].name}` : 'Pick a way above', cx, y + 32);
  buttons.push(b);
  if (saved) { const bb = { x: cx - 60, y: y + 60, w: 120, h: 30, go: () => { choosing = false; } }; ctx.font = `13px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText('Back', cx, y + 80); buttons.push(bb); }
}

// ── overlays: your moves, a lesson, a fall, the end ──
function drawOverlay() {
  const O = overlay;
  if (!O) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(10,8,16,0.88)'; ctx.fillRect(0, 0, W, H);
  buttons = [];
  const cx = W / 2;
  ctx.textAlign = 'center';
  if (O.kind === 'scroll') {
    const way = save.way, Wy = WAYS[way];
    ctx.font = `${Math.min(28, W / 13)}px ${DISPLAY}`; ctx.fillStyle = Wy.color; ctx.fillText(`The Way of ${Wy.name}`, cx, 40);
    ctx.font = `bold 12px ${BODY}`; ctx.fillStyle = C.gold; const tl = wrapLines(`${Wy.twist}: ${Wy.twistWhat}`, Math.min(W - 24, 560));
    ctx.font = `12px ${BODY}`; tl.slice(0, 3).forEach((l, i) => { ctx.fillStyle = i ? C.fg : C.fg; ctx.fillText(l, cx, 60 + i * 15); });
    ctx.font = `11px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(save.scribe ? 'Tap one to see it and trace it. End an attack with a little curl to hold it.' : '● basic · ●● skilled · ●●● master. Tap one to see it and trace it.', cx, 64 + Math.min(3, tl.length) * 15, W - 24);
    const cols = W > 700 ? 5 : 4, cw = Math.min(170, (W - 16) / cols), rows = 5, top = 74 + Math.min(3, tl.length) * 15 + 8, ch = Math.min(150, (H - top - 56) / rows), r = Math.min(cw * 0.3, (ch - 40) / 2.1);
    const x0 = cx - cw * cols / 2;
    MOVES[way].forEach((m, i) => {
      const X = x0 + (i % cols) * cw, Y = top + Math.floor(i / cols) * ch, known = m.order < learnedCount(), M = { cx: X + cw / 2, cy: Y + r + 4, r };
      paper(ctx, M, true);
      if (known) glyphGuide(ctx, M, m, '#2e2216', 0.95, false, 2);
      else { ctx.fillStyle = 'rgba(18,15,25,0.55)'; ctx.beginPath(); ctx.arc(M.cx, M.cy, r, 0, TAU); ctx.fill(); ctx.font = `${r * 0.8}px ${DISPLAY}`; ctx.fillStyle = C.muted; ctx.fillText('?', M.cx, M.cy + r * 0.28); }
      ctx.font = `bold 11px ${BODY}`; ctx.fillStyle = known ? Wy.color : C.fizzle; ctx.fillText(known ? m.name : '—', X + cw / 2, Y + 2 * r + 18, cw - 6);
      ctx.font = `10px ${BODY}`; ctx.fillStyle = known ? C.muted : '#5d566a'; ctx.fillText(`${'●'.repeat(m.tier + 1)} ${m.tag}${known ? ' · ' + m.cost + ' ki' : ''}`, X + cw / 2, Y + 2 * r + 31, cw - 6);
      if (known) buttons.push({ x: X, y: Y, w: cw, h: ch, go: () => { O.pick = m; } });
    });
    if (O.pick) {
      // a move's card: what it does and how to write it
      const m = O.pick, bw = Math.min(W - 32, 380), bh = 270, bx = cx - bw / 2, by = H / 2 - bh / 2;
      roundRect(bx, by, bw, bh, 16); ctx.fillStyle = C.night2; ctx.fill(); ctx.strokeStyle = Wy.color; ctx.lineWidth = 2; ctx.stroke();
      const M = { cx: bx + 70, cy: by + 80, r: 52 }; paper(ctx, M); glyphGuide(ctx, M, m, '#2e2216', 0.95, false, 2.5);
      ctx.textAlign = 'left'; ctx.font = `22px ${DISPLAY}`; ctx.fillStyle = Wy.color; ctx.fillText(m.name, bx + 136, by + 52, bw - 150);
      ctx.font = `12px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(`${TIERS[m.tier]} · ${m.tag} · ${m.cost} ki`, bx + 136, by + 72);
      ctx.font = `13px ${BODY}`; ctx.fillStyle = C.fg; const wy = wrapText(m.what, bx + 136, by + 94, bw - 150, 17);
      ctx.fillStyle = C.paper; ctx.font = `13px ${BODY}`; wrapText('How: ' + m.how, bx + 20, Math.max(by + 160, wy + 6), bw - 40, 17);
      ctx.textAlign = 'center';
      const tb = { x: bx + 20, y: by + bh - 50, w: bw / 2 - 26, h: 36, go: () => { PAD.guide = m; overlay = null; } }, cb = { x: cx + 6, y: by + bh - 50, w: bw / 2 - 26, h: 36, go: () => { O.pick = null; } };
      pill(tb, 'Trace it', Wy.color); pill(cb, 'Back', C.muted);
      buttons = [tb, cb];
      return;
    }
    const close = { x: cx - 60, y: H - 46, w: 120, h: 34, go: () => { overlay = null; } };
    pill(close, 'Close', C.muted); buttons.push(close);
    return;
  }
  if (O.kind === 'learn') {
    const f = O.foe, m = O.move, Wy = WAYS[save.way];
    ctx.font = `${Math.min(30, W / 12)}px ${DISPLAY}`; ctx.fillStyle = C.gold; ctx.fillText(`${f.name} bows`, cx, H * 0.14);
    ctx.font = `14px ${BODY}`; ctx.fillStyle = C.fg; ctx.fillText(O.next ? 'and another:' : m ? (O.warm ? 'Well fought. You learn a move of your way:' : 'and shows you a move of your way:') : 'You already know all twenty moves.', cx, H * 0.14 + 28);
    if (m) {
      const r = Math.min(W * 0.3, H * 0.18), M = { cx, cy: H * 0.14 + 60 + r, r }, cyc = O.demo.reduce((a, s) => a + s.dur, 0) + 0.2 * (O.demo.length - 1) + 1.4;
      paper(ctx, M);
      let tt = O.t % cyc; for (const s of O.demo) { inkStroke(ctx, M, s, C.sumi, tt); tt -= s.dur + 0.2; if (tt < 0) break; }
      glyphGuide(ctx, M, m, Wy.color, 0.35);
      let y = M.cy + r + 38;
      ctx.font = `${Math.min(28, W / 13)}px ${DISPLAY}`; ctx.fillStyle = Wy.color; ctx.fillText(m.name, cx, y);
      ctx.font = `13px ${BODY}`; ctx.fillStyle = C.muted; ctx.fillText(`${TIERS[m.tier]} move · ${m.tag} · ${m.cost} ki`, cx, y + 22);
      ctx.fillStyle = C.fg; ctx.font = `14px ${BODY}`; y = wrapText(m.what, cx, y + 46, Math.min(W - 40, 420), 19);
      ctx.fillStyle = C.paper; y = wrapText('How: ' + m.how, cx, y + 8, Math.min(W - 40, 420), 19);
    }
    if (O.t > 0.8) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 4); ctx.font = `14px ${BODY}`; ctx.fillStyle = C.gold; ctx.fillText(O.more && O.more.length ? 'Tap for the next move' : 'Tap to carry on', cx, H - 30); ctx.globalAlpha = 1; buttons.push({ x: 0, y: 0, w: W, h: H, go: afterLearn }); }
    return;
  }
  if (O.kind === 'fallen') {
    const f = O.foe;
    ctx.font = `${Math.min(34, W / 11)}px ${DISPLAY}`; ctx.fillStyle = C.hp; ctx.fillText(`${f.name} wins this bout`, cx, H * 0.36);
    ctx.font = `15px ${BODY}`; ctx.fillStyle = C.fg;
    const TWIST_TIP = { water: 'Soak them first (a puddle, a lash, a bullet), then write Freeze: a soaked foe freezes solid, and a frozen foe takes a heavy hit.',
                        fire: 'Watch your heat: past the red line you burn yourself. Let it out at them with Vent. And stay dry: soaked, your fire comes out damp.',
                        earth: 'Raise stones with Stone Wall and Earth Spike, then throw them with Rock Throw or burst them with Shatter.',
                        air: 'Keep moving while you write: wind makes every air spell stronger, and standing still lets it die away.' };
    const tips = ['Watch what they write in the air above them: when a big spell is coming, shield, dodge or wall it off.', TWIST_TIP[save.way],
                  'Rough glyphs still work, but only just. Every bit neater hits harder, and a perfect one twice as hard: open MOVES and trace one to practise.', `Your way beats ${WAYS[WAYS[save.way].beats].name}: its fighters are the easiest for you.`];
    wrapText(tips[(save.stats.falls - 1) % tips.length], cx, H * 0.36 + 34, Math.min(W - 40, 420), 21);
    if (O.t > 0.8) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 4); ctx.font = `14px ${BODY}`; ctx.fillStyle = C.gold; ctx.fillText('Tap to try again', cx, H - 30); ctx.globalAlpha = 1; buttons.push({ x: 0, y: 0, w: W, h: H, go: afterFall }); }
    return;
  }
  if (O.kind === 'talk') {
    // someone talking: their name, their words, a tap to go on
    const [who, text] = O.pages[O.i] || ['', ''], bw = Math.min(W - 24, 460), x0 = cx - bw / 2;
    ctx.font = `16px ${BODY}`; const ls = wrapLines(text, bw - 36), bh = 64 + ls.length * 22, y0 = Math.min(H - bh - 24, Math.max(H * 0.3, L.wide ? H / 2 - bh / 2 : L.pad.cy - L.pad.r - bh - 4));
    roundRect(x0, y0, bw, bh, 16); ctx.fillStyle = C.night2; ctx.fill(); ctx.strokeStyle = who ? C.gold : C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'left';
    if (who) { ctx.font = `${Math.min(22, W / 17)}px ${DISPLAY}`; ctx.fillStyle = C.gold; ctx.fillText(who, x0 + 18, y0 + 32); }
    ctx.font = who ? `16px ${BODY}` : `italic 16px ${BODY}`; ctx.fillStyle = who ? C.fg : C.paper;
    ls.forEach((l, i) => ctx.fillText(l, x0 + 18, y0 + (who ? 60 : 40) + i * 22));
    ctx.textAlign = 'center';
    if (O.t > 0.25) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 4); ctx.font = `13px ${BODY}`; ctx.fillStyle = C.gold; ctx.fillText(O.i < O.pages.length - 1 ? 'Tap to go on' : 'Tap', cx, Math.min(H - 12, y0 + bh + 22)); ctx.globalAlpha = 1; }
    buttons.push({ x: 0, y: 0, w: W, h: H, go: talkNext });
    return;
  }
  if (O.kind === 'end') {
    const Wy = WAYS[save.way], S = save.stats, mins = Math.max(1, Math.round(((S.t1 || Date.now()) - S.t0) / 60000));
    ctx.save(); ctx.strokeStyle = hexA(C.gold, 0.25); ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, H * 0.28, Math.min(W, H) * 0.2, 2.4, 2.4 + TAU * 0.86 * Math.min(1, O.t / 1.5)); ctx.stroke(); ctx.restore();
    ctx.font = `${Math.min(34, W / 11)}px ${DISPLAY}`; ctx.fillStyle = C.gold; ctx.fillText('The Golden Crane', cx, H * 0.28 - 4);
    ctx.font = `${Math.min(20, W / 17)}px ${DISPLAY}`; ctx.fillStyle = Wy.color; ctx.fillText('End of chapter one', cx, H * 0.28 + 26);
    ctx.font = `15px ${BODY}`; ctx.fillStyle = C.fg;
    let y = wrapText('The package was your grandfather’s golden crane, and a buyer waits in the far city of Kyōsei. The road there is long. To be continued.', cx, H * 0.5, Math.min(W - 40, 420), 21);
    ctx.fillStyle = C.muted; ctx.font = `13px ${BODY}`;
    ctx.fillText(`${mins} minute${mins === 1 ? '' : 's'} · ${S.wins} fights won · ${S.falls} fall${S.falls === 1 ? '' : 's'} · ${S.casts ? Math.round(100 * S.clean / S.casts) : 0}% clean`, cx, y + 16, W - 30);
    const b = { x: cx - 120, y: y + 50, w: 240, h: 48, go: () => { overlay = null; state = 'title'; choosing = true; pickWay = null; } };
    pill(b, 'Play again', C.gold); buttons.push(b);
    const c2 = { x: cx - 120, y: y + 108, w: 240, h: 40, go: () => { overlay = null; } };
    pill(c2, 'Stay in the valley', C.muted); buttons.push(c2);
    return;
  }
}

// ── touch, mouse and keys ──
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audio();
  const x = e.clientX, y = e.clientY;
  if (overlay || state === 'title') { const b = [...buttons].reverse().find(b => hit(b, x, y)); if (b) { SFX.tap(); b.go(); } return; }
  const B = panelButtons();
  if (hit(B.moves, x, y)) { overlay = { kind: 'scroll', t: 0 }; SFX.tap(); return; }
  if (hit(B.sound, x, y)) { setSound(!soundOn); SFX.tap(); return; }
  if (HELD) { const b = heldBtn(); if (Math.hypot(x - b.cx, y - b.cy) < b.r + 12) { releaseHeld(); return; } }
  if (TILT.on) { const b = tiltBubble(); if (Math.hypot(x - b.cx, y - b.cy) < b.r + 8) { TILT.relevel = true; SFX.tap(); return; } }
  if (inPad(x, y)) { if (!PAD.pen) { PAD.penId = e.pointerId; penDown(x, y, e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} } return; }
  const inArena = x >= L.arena.x && x <= L.arena.x + L.arena.w && y >= L.arena.y && y <= L.arena.y + L.arena.h;
  if (inArena && !stick) { stick = { id: e.pointerId, x0: x, y0: y, x, y }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} }
});
cv.addEventListener('pointermove', e => {
  if (PAD.pen && e.pointerId === PAD.penId) { const list = e.getCoalescedEvents ? e.getCoalescedEvents() : []; for (const ev of list.length ? list : [e]) penMove(ev.clientX, ev.clientY, evTime(ev), padPressure(ev)); }
  else if (stick && e.pointerId === stick.id) { stick.x = e.clientX; stick.y = e.clientY; }
});
const lift = e => { if (PAD.pen && e.pointerId === PAD.penId) penUp(); if (stick && e.pointerId === stick.id) stick = null; };
cv.addEventListener('pointerup', lift);
cv.addEventListener('pointercancel', lift);
cv.addEventListener('contextmenu', e => e.preventDefault());
// nothing on this page scrolls or zooms
for (const ev of ['touchstart', 'touchmove', 'touchend', 'gesturestart']) document.addEventListener(ev, e => { if (tiltBtn && e.target === tiltBtn && ev !== 'touchmove') return; if (e.cancelable) e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', e => {
  keys[e.code] = true; audio();
  if (e.code === 'Escape' && overlay && overlay.kind === 'scroll') overlay = null;
  if (e.code === 'Space' && state === 'play' && !overlay) { releaseHeld(); e.preventDefault(); }
  if ((e.code === 'KeyM' || e.code === 'Tab') && state === 'play' && !overlay) { overlay = { kind: 'scroll', t: 0 }; e.preventDefault(); }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; stick = null; });

// ── the loop ──
let last = performance.now(), MANUAL = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { if (!MANUAL) update(dt); render(); } catch (err) { console.error(err); }
}
// if the page is updated while it's open, come back to the dojo rather than to the title
const hot = window.claude && window.claude.hot;
try { if (hot && hot.snapshot) hot.snapshot(() => ({ playing: state === 'play' })); } catch (_) {}
function boot(data) {
  if (data && data.playing === true) { const s = loadSave(); if (s) { save = s; continueGame(); } }
  requestAnimationFrame(frame);
}
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data || {});

// ── for tests: start a way, write a move as a steady hand would, step time by hand ──
window.INKDOJO = {
  get state() { return state; }, get overlay() { return overlay; }, get fight() { return FIGHT; }, get player() { return player; }, get foes() { return FOES; }, get npcs() { return NPCS; }, get save() { return save; },
  get scene() { return SCENE; }, get held() { return HELD; }, Q, goal, enterScene, talkNext, afterLearn, afterFall, releaseHeld, whitesBeaten, fighters,
  begin(way) { beginGame(way); }, cont() { save = loadSave(); continueGame(); },
  write(key, o = {}) { const m = MOVES[save.way].find(m => m.key === key); let s = writeOut(m, { wobble: 0.01, ...o }); if (o.curl) s = withCurl(s); return padJudge(s); },
  // cast any spell straight away, as anyone, at a given strength (for looking at spells)
  castAs(who, id, P = 1) { const f = who === 'foe' ? FIGHT && FIGHT.foe : player, [way, key] = id.split(':'), m = MOVES[way].find(m => m.key === key); if (!f || !m) return false; f.ki = Math.max(f.ki, m.cost); if (!startMove(f, m, P, foeOf(f))) return false; f.act.t = 0; return true; },
  manual(on) { MANUAL = on; }, step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt); },
  tapOverlay() { const b = buttons[buttons.length - 1]; if (b) b.go(); }, close() { overlay = null; },
  teleport(x, y) { player.x = x; player.y = y; updateCam(0, true); },
  koFoe() { if (FIGHT && FIGHT.on) knockedOut(FIGHT.foe, player); }, koMe() { if (FIGHT && FIGHT.on) knockedOut(player, FIGHT.foe); },
  get tilt() { return TILT; }, tiltBubble, heldBtn,
  // a bot plays you: it walks as a fighter would and writes the spell a fighter would pick, by hand (so not always neatly)
  // the player played by a fighter's mind too, so two ways can be weighed against each other on equal terms
  dmgLog(on) { if (on) DMGLOG = {}; const L = DMGLOG; if (!on) DMGLOG = null; return L; },
  aiPlayer(dt) { const foe = FIGHT && FIGHT.foe; if (!BOT || !foe || !FIGHT.on) return; aiFight(player, foe, dt); const sp = player.speed * moveMul(player) || 1; BOT.mx = player.vx / sp; BOT.my = player.vy / sp; },
  bot(on, o = {}) { BOT = on ? { mx: 0, my: 0, ...o } : null; if (on && player) player.ai.cd = {}; },
  botStep(dt, K, wobble) {
    const foe = FIGHT && FIGHT.foe; if (!BOT || !foe || !FIGHT.on) return null;
    const d = aiWalk(player, foe, dt); BOT.mx = d.mx; BOT.my = d.my;
    if (player.act || !canCast(player) || PAD.judgeAt) return null;
    const c = aiChoose(player, foe, myMoves(), dt, K); if (!c) return null;
    const R = padJudge(writeOut(c.move, { wobble: wobble ?? (0.008 + Math.random() * 0.03), seed: Math.random() * 9 }));
    return R && R.verdict !== 'fizzle' ? c.move.key : 'fizzle';
  },
  INK, ROSTER, MOVES, RANKS, WAYMOD, ADV, HALL, YOU, skillAt, skillFor, learnedCount, myMoves, padJudge, startFight, setSound, setupWorld, resetFighter,
  get shots() { return SHOTS; }, get waves() { return WAVES; }, get zones() { return ZONES; }, get ents() { return ENTS; }, get stones() { return STONES; }, get fx() { return FX; },
};
})();
