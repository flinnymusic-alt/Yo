// tilt to walk: feed the page orientation readings as a phone would, and watch where you go
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const OUT = OUTDIR + '/';
const lean = (p, beta, gamma) => p.evaluate(([b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: g })), [beta, gamma]);
async function hold(p, beta, gamma, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { await lean(p, beta, gamma); await p.waitForTimeout(16); } }
const pos = p => p.evaluate(() => [Math.round(INKDOJO.player.x), Math.round(INKDOJO.player.y)]);
async function walk(p, label, beta, gamma, ms = 600) {
  const a = await pos(p); await hold(p, beta, gamma, ms); const b = await pos(p);
  console.log(`${label.padEnd(34)} moved ${String(b[0] - a[0]).padStart(5)} ${String(b[1] - a[1]).padStart(5)}`);
  return [b[0] - a[0], b[1] - a[1]];
}
(async () => {
  const br = await chromium.launch(); const errs = [];
  // ── a phone held upright-ish, portrait ──
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(GAME); await p.waitForTimeout(300);
    console.log('screen angle:', await p.evaluate(() => screen.orientation && screen.orientation.angle));
    await p.evaluate(() => { localStorage.clear(); INKDOJO.begin('earth'); INKDOJO.close(); INKDOJO.teleport(800, 1000); });
    console.log('tilt before readings:', await p.evaluate(() => INKDOJO.tilt.on));
    await hold(p, 40, 0, 300);
    console.log('tilt after readings:', await p.evaluate(() => [INKDOJO.tilt.on, Math.round(INKDOJO.tilt.pitch0 * 180 / Math.PI)].join(' pitch0=')));
    await walk(p, 'held still (40, 0)', 40, 0);
    await walk(p, 'small wobble (42.5, 1.5)', 42.5, 1.5);
    await walk(p, 'top away 18° → up', 22, 0);
    await walk(p, 'right side down 15° → right', 40, 15);
    await walk(p, 'top toward you 15° → down', 55, 0);
    await walk(p, 'left side down 15° → left', 40, -15);
    await hold(p, 55, 0, 100);
    await p.screenshot({ path: OUT + 't1_portrait.png' });
    // tap the level while leaning: that lean is now "still"
    const b = await p.evaluate(() => INKDOJO.tiltBubble());
    await p.touchscreen.tap(b.cx, b.cy);
    await p.waitForTimeout(50);
    await walk(p, 'after level, held at (55, 0)', 55, 0);
    await walk(p, 'from there, top away → up', 37, 0);
    // past upright and back: no jump
    await hold(p, 85, 0, 200); await p.evaluate(() => { INKDOJO.tilt.relevel = true; }); await hold(p, 85, 0, 200);
    await walk(p, 'held at 85°: still', 85, 0);
    await walk(p, 'tipped past upright (100°) → down', 100, 0);
    // a fight: tilt still walks you, inside the ring
    await hold(p, 40, 0, 100); await p.evaluate(() => { INKDOJO.tilt.relevel = true; });
    await p.evaluate(() => { const f = INKDOJO.foes.find(f => f.id === 'e1') || INKDOJO.foes[0]; INKDOJO.teleport(f.x + 150, f.y); INKDOJO.startFight(f); });
    for (let i = 0; i < 40 && !(await p.evaluate(() => INKDOJO.fight && INKDOJO.fight.on)); i++) await hold(p, 40, 0, 100);
    await walk(p, 'in a fight, right side down → right', 40, 16, 500);
    await p.screenshot({ path: OUT + 't2_fight.png' });
    // overlays re-level: open MOVES while leaning, close it, and that lean is "still"
    await p.evaluate(() => { INKDOJO.koFoe(); }); await p.waitForTimeout(3500);
    console.log('overlay:', await p.evaluate(() => INKDOJO.overlay && INKDOJO.overlay.kind));
    await hold(p, 30, 8, 200); await p.evaluate(() => INKDOJO.tapOverlay()); await p.waitForTimeout(300); await hold(p, 30, 8, 200);
    await walk(p, 'after the lesson, held at (30, 8)', 30, 8);
    await ctx.close();
  }
  // ── landscape, phone turned with its top to the left ──
  {
    const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { Object.defineProperty(screen, 'orientation', { configurable: true, get: () => ({ angle: 90, type: 'landscape-primary', addEventListener() {} }) }); });
    await p.goto(GAME); await p.waitForTimeout(300);
    console.log('screen angle:', await p.evaluate(() => screen.orientation.angle));
    await p.evaluate(() => { INKDOJO.begin('air'); INKDOJO.close(); INKDOJO.teleport(800, 1000); });
    // held facing you at about 35°: the screen's top is the phone's right edge, raised (gamma −35)
    await hold(p, 0, -35, 300);
    await walk(p, 'landscape held still', 0, -35);
    await walk(p, 'landscape: right of screen down → right', 14, -35);
    await walk(p, 'landscape: top of screen away → up', 0, -18);
    await walk(p, 'landscape: top toward you → down', 0, -52);
    await walk(p, 'landscape: near upright, past it', 0, -88);
    await hold(p, 0, -35, 100);
    await p.screenshot({ path: OUT + 't3_wide.png' });
    await ctx.close();
  }
  // ── an iPhone: asks once, on a tap, and only then listens ──
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__asked = 0; DeviceOrientationEvent.requestPermission = () => { window.__asked++; return Promise.resolve('granted'); }; });
    await p.goto(GAME); await p.waitForTimeout(300);
    await hold(p, 40, 0, 150);
    console.log('iOS before any tap: asked', await p.evaluate(() => window.__asked), 'on', await p.evaluate(() => INKDOJO.tilt.on));
    await p.touchscreen.tap(195, 300); await p.waitForTimeout(100); // a tap on the title (choosing a way)
    console.log('iOS tap on the title: asked', await p.evaluate(() => window.__asked));
    await p.evaluate(() => { INKDOJO.begin('water'); INKDOJO.close(); INKDOJO.teleport(800, 1000); });
    await p.touchscreen.tap(195, 200); await p.waitForTimeout(100);
    await p.touchscreen.tap(195, 220); await p.waitForTimeout(100);
    await hold(p, 40, 0, 200);
    console.log('iOS after taps in the dojo: asked', await p.evaluate(() => window.__asked), 'on', await p.evaluate(() => INKDOJO.tilt.on));
    await walk(p, 'iOS: top away → up', 24, 0);
    await ctx.close();
  }
  // ── no motion readings at all (a computer, or the Artifact viewer): no level shown, drag still walks ──
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(GAME); await p.waitForTimeout(300);
    await p.evaluate(() => { INKDOJO.begin('fire'); INKDOJO.close(); INKDOJO.teleport(800, 1000); });
    await p.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {})));
    const a = await pos(p);
    const cdp = await ctx.newCDPSession(p);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await tp('touchStart', 195, 250); for (let i = 1; i <= 10; i++) { await tp('touchMove', 195 + i * 6, 250); await p.waitForTimeout(30); }
    await p.waitForTimeout(400); await tp('touchEnd');
    const b = await pos(p);
    console.log('no sensor: tilt on', await p.evaluate(() => INKDOJO.tilt.on), '| drag right moved', b[0] - a[0], b[1] - a[1]);
    await ctx.close();
  }
  console.log('errors', errs);
  await br.close();
})();
