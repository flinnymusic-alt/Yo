const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const lean = (p, beta, gamma) => p.evaluate(([b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: g })), [beta, gamma]);
async function hold(p, beta, gamma, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { await lean(p, beta, gamma); await p.waitForTimeout(16); } }
const vec = p => p.evaluate(() => { const T = INKDOJO.tilt; return `walk (${T.x.toFixed(2)}, ${T.y.toFixed(2)})`; });
(async () => {
  const br = await chromium.launch();
  for (const angle of [0, 90, 270]) {
    const ctx = await br.newContext({ viewport: angle ? { width: 844, height: 390 } : { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.addInitScript(a => { Object.defineProperty(screen, 'orientation', { configurable: true, get: () => ({ angle: a, type: 'x', addEventListener() {} }) }); }, angle);
    await p.goto(GAME); await p.waitForTimeout(200);
    await p.evaluate(() => { INKDOJO.begin('earth'); INKDOJO.close(); });
    // how this phone is held when still, and what "away", "toward", "right down", "left down" are, as (beta, gamma)
    const P = angle === 0 ? { still: [40, 0], away: [22, 0], toward: [58, 0], right: [40, 16], left: [40, -16] }
            : angle === 90 ? { still: [0, -35], away: [0, -17], toward: [0, -53], right: [16, -35], left: [-16, -35] }
            : { still: [0, 35], away: [0, 17], toward: [0, 53], right: [-16, 35], left: [16, 35] };
    await hold(p, ...P.still, 250); await p.evaluate(() => { INKDOJO.tilt.relevel = true; }); await hold(p, ...P.still, 250);
    console.log(`angle ${angle}: still ${await vec(p)}`);
    for (const k of ['away', 'toward', 'right', 'left']) { await hold(p, ...P[k], 400); console.log(`   ${k.padEnd(7)} ${await vec(p)}`); }
    await ctx.close();
  }
  // the fight: what stops the walk?
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(GAME); await p.waitForTimeout(200);
  await p.evaluate(() => { localStorage.clear(); INKDOJO.begin('earth'); INKDOJO.close(); INKDOJO.teleport(800, 1000); });
  await hold(p, 40, 0, 300);
  await p.evaluate(() => { const f = INKDOJO.foes[0]; INKDOJO.teleport(f.x + 150, f.y); INKDOJO.startFight(f); });
  for (let i = 0; i < 40 && !(await p.evaluate(() => INKDOJO.fight && INKDOJO.fight.on)); i++) await hold(p, 40, 0, 100);
  await hold(p, 40, 16, 300);
  console.log('fight:', await p.evaluate(() => { const P = INKDOJO.player, F = INKDOJO.fight; return JSON.stringify({ on: F.on, intro: F.intro, over: !!F.over, act: P.act && P.act.move && P.act.move.role, stun: P.st.stun, hp: P.hp, vx: Math.round(P.vx), vy: Math.round(P.vy), tx: INKDOJO.tilt.x.toFixed(2), paused: INKDOJO.tilt.paused, overlay: INKDOJO.overlay && INKDOJO.overlay.kind, x: Math.round(P.x), cx: Math.round(F.cx), r: F.r }); }));
  await br.close();
})();
