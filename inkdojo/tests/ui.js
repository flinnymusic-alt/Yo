const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const OUT = OUTDIR + '/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT/.test(m.text())) errs.push(m.text()); });
  await p.goto(GAME); await p.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(p);
  const touch = async (pts, holdStart = 0, holdEnd = 0, ms = 16) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
    if (holdStart) await p.waitForTimeout(holdStart);
    for (const q of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] }); await p.waitForTimeout(ms); }
    if (holdEnd) await p.waitForTimeout(holdEnd);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  // title: tap the Earth card, then Enter
  const tapBtn = async pred => { const c = await p.evaluate(pred); if (c) await p.touchscreen.tap(c.x, c.y); return c; };
  await p.touchscreen.tap(97 + 0, 560); await p.waitForTimeout(200); // (somewhere on the Water card)
  await p.evaluate(() => {});
  // tap the third card (Earth) by its position: second row, left
  await p.touchscreen.tap(100, 640); await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + 'u1_pick.png' });
  await p.touchscreen.tap(195, 795); await p.waitForTimeout(700);
  console.log('entered:', await p.evaluate(() => [INKDOJO.state, INKDOJO.save && INKDOJO.save.way].join(' ')));
  // Mum talks: tap through
  await p.waitForTimeout(600);
  for (let i = 0; i < 12 && (await p.evaluate(() => INKDOJO.overlay && INKDOJO.overlay.kind === 'talk')); i++) { await p.waitForTimeout(350); await p.touchscreen.tap(195, 300); }
  console.log('Mum done:', await p.evaluate(() => INKDOJO.save.q));
  // walk with a drag on the floor (up, for a second)
  const x0 = await p.evaluate(() => [INKDOJO.player.x, INKDOJO.player.y].map(Math.round));
  await touch(Array.from({ length: 60 }, (_, i) => ({ x: 195, y: 300 - Math.min(40, i * 3) })), 0, 0, 16);
  const x1 = await p.evaluate(() => [INKDOJO.player.x, INKDOJO.player.y].map(Math.round));
  console.log('walked from', x0, 'to', x1);
  // write a glyph with a finger: Earth's Rock Throw (pool the ink at the bottom, then one stroke straight up the middle)
  const P = await p.evaluate(() => { const r = Math.min(innerWidth * 0.42, innerHeight * 0.215, 210); return { cx: innerWidth / 2, cy: innerHeight - r - Math.max(14, innerHeight * 0.02), r }; });
  const at = (u, v) => ({ x: P.cx + u * P.r, y: P.cy + v * P.r });
  await touch(Array.from({ length: 34 }, (_, i) => at(0, 0.7 - 1.4 * i / 33)), 500, 0, 30);
  await p.waitForTimeout(900);
  console.log('finger glyph:', await p.evaluate(() => JSON.stringify({ casts: INKDOJO.save.stats.casts, clean: INKDOJO.save.stats.clean, act: INKDOJO.player.act && INKDOJO.player.act.move.name, ki: Math.round(INKDOJO.player.ki) })));
  await p.screenshot({ path: OUT + 'u2_written.png' });
  // the same, ending in a little curl: held; then a tap on its seal throws it
  await p.waitForTimeout(800);
  const curl = Array.from({ length: 26 }, (_, i) => { const th = -Math.PI / 2 + i / 25 * Math.PI * 2.15; return at(0.09 * Math.cos(th) + 0.09, -0.7 + 0.09 * Math.sin(th) + 0.09); });
  await touch([...Array.from({ length: 34 }, (_, i) => at(0, 0.7 - 1.4 * i / 33)), ...curl], 500, 0, 30);
  await p.waitForTimeout(500);
  console.log('curled glyph held:', await p.evaluate(() => INKDOJO.held && INKDOJO.held.move.name));
  await p.screenshot({ path: OUT + 'u2b_held.png' });
  const hb = await p.evaluate(() => { const b = INKDOJO.heldBtn(); return { x: b.cx, y: b.cy }; });
  await p.touchscreen.tap(hb.x, hb.y); await p.waitForTimeout(100);
  console.log('after tapping the seal:', await p.evaluate(() => [INKDOJO.held ? 'still held' : 'thrown', INKDOJO.player.act && INKDOJO.player.act.move.name].join(' ')));
  // the scroll of moves, and one move's card
  await tapBtn(() => ({ x: 12 + 42, y: (() => { const r = Math.min(innerWidth * 0.42, innerHeight * 0.215, 210); return innerHeight - r - Math.max(14, innerHeight * 0.02) - r - 30; })() }));
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'u3_scroll.png' });
  await p.touchscreen.tap(48, 110); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'u4_card.png' });
  await p.evaluate(() => INKDOJO.close());
  // lose a bout on purpose, to a wolf
  await p.evaluate(() => { const f = INKDOJO.foes.find(f => f.id === 'wolf1'); INKDOJO.teleport(f.x - 150, f.y); INKDOJO.startFight(f); });
  await p.waitForTimeout(2300);
  await p.evaluate(() => { INKDOJO.player.hp = 1; });
  for (let i = 0; i < 200 && !(await p.evaluate(() => INKDOJO.overlay && INKDOJO.overlay.kind === 'fallen')); i++) await p.waitForTimeout(100);
  await p.waitForTimeout(800);
  console.log('after losing:', await p.evaluate(() => [INKDOJO.overlay && INKDOJO.overlay.kind, INKDOJO.player.hp].join(' ')));
  await p.screenshot({ path: OUT + 'u5_fallen.png' });
  await p.waitForTimeout(500); await p.touchscreen.tap(195, 400); await p.waitForTimeout(400);
  console.log('woke at:', await p.evaluate(() => [INKDOJO.scene, Math.round(INKDOJO.player.y)].join(' ')));
  // the end: home with the package, Mum opens it
  await p.evaluate(() => { const S = INKDOJO.save; S.q = INKDOJO.Q.LAST; INKDOJO.setupWorld(); const m = INKDOJO.npcs.find(n => n.id === 'mum'); INKDOJO.teleport(m.x + 50, m.y + 20); });
  for (let i = 0; i < 30 && !(await p.evaluate(() => INKDOJO.overlay)); i++) await p.waitForTimeout(100);
  for (let i = 0; i < 12 && (await p.evaluate(() => INKDOJO.overlay && INKDOJO.overlay.kind === 'talk')); i++) { await p.waitForTimeout(350); await p.touchscreen.tap(195, 300); }
  await p.waitForTimeout(1600);
  console.log('end:', await p.evaluate(() => [INKDOJO.overlay && INKDOJO.overlay.kind, INKDOJO.save.q].join(' ')));
  await p.screenshot({ path: OUT + 'u8_end.png' });
  console.log('errors', errs);
  await b.close();
})();
