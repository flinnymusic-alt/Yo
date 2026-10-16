const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const OUT = OUTDIR + '/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  await p.goto(GAME); await p.waitForTimeout(400);
  // a locked move written
  await p.evaluate(() => { INKDOJO.begin('fire'); INKDOJO.close(); });
  await p.evaluate(() => { const m = INKDOJO.MOVES.fire.find(m => m.tag === 'Ultimate'); INKDOJO.padJudge(INKDOJO.INK.writeOut(m, { wobble: 0.01 })); });
  console.log('locked move:', await p.evaluate(() => document && (window.__msg = null, 1)) && await p.evaluate(() => { const C = document.getElementById('game'); return true; }));
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + 'e1_locked.png', clip: { x: 0, y: 420, width: 390, height: 60 } });
  // the twelfth lesson is the ultimate; then the Grandmaster; then the end
  await p.evaluate(() => { const S = INKDOJO.save; S.beaten = INKDOJO.ROSTER.map(r => r.id).filter(id => id !== 'a3'); INKDOJO.setupWorld(); const f = INKDOJO.foes.find(f => f.id === 'a3'); INKDOJO.teleport(f.x + 120, f.y + 40); INKDOJO.startFight(f); });
  await p.waitForTimeout(2200);
  await p.evaluate(() => INKDOJO.koFoe());
  await p.waitForTimeout(3500);
  console.log('lesson:', await p.evaluate(() => INKDOJO.overlay && [INKDOJO.overlay.kind, INKDOJO.overlay.move && INKDOJO.overlay.move.tag, 'then', (INKDOJO.overlay.more || []).map(m => m.tag).join('+'), INKDOJO.learnedCount()].join(' ')));
  await p.evaluate(() => INKDOJO.tapOverlay()); await p.waitForTimeout(1200);
  console.log('second lesson:', await p.evaluate(() => INKDOJO.overlay && [INKDOJO.overlay.kind, INKDOJO.overlay.move && INKDOJO.overlay.move.name, INKDOJO.overlay.move && INKDOJO.overlay.move.tag].join(' ')));
  await p.screenshot({ path: OUT + 'e2_lesson20.png' });
  await p.evaluate(() => INKDOJO.tapOverlay()); await p.waitForTimeout(800);
  console.log('master spawned:', await p.evaluate(() => !!INKDOJO.master), await p.evaluate(() => INKDOJO.master && INKDOJO.master.mode));
  await p.evaluate(() => INKDOJO.teleport(800, 770)); await p.waitForTimeout(4500);
  console.log('master fight:', await p.evaluate(() => INKDOJO.fight && [INKDOJO.fight.foe.name, INKDOJO.fight.on].join(' ')));
  await p.screenshot({ path: OUT + 'e3_master.png' });
  for (let i = 0; i < 40 && !(await p.evaluate(() => INKDOJO.fight && INKDOJO.fight.on)); i++) await p.waitForTimeout(100);
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'e3b_masterfight.png' });
  await p.evaluate(() => INKDOJO.koFoe());
  await p.waitForTimeout(2500);
  console.log('end:', await p.evaluate(() => [INKDOJO.overlay && INKDOJO.overlay.kind, INKDOJO.save.master].join(' ')));
  await p.screenshot({ path: OUT + 'e4_victory.png' });
  // landscape
  await p.setViewportSize({ width: 844, height: 390 });
  await p.evaluate(() => { INKDOJO.close(); INKDOJO.cont(); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'e5_wide.png' });
  console.log('errors', errs);
  await b.close();
})();
