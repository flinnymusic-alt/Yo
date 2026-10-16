const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto(GAME); await p.waitForTimeout(400);
  await p.evaluate(() => { localStorage.clear(); INKDOJO.begin('water'); INKDOJO.close(); });
  await p.keyboard.press('KeyM'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUTDIR + '/t1_scroll_start.png' });
  await p.evaluate(() => INKDOJO.close());
  // after every hall but one black belt: all but two known, then win: a lesson of two
  await p.evaluate(() => { const S = INKDOJO.save; S.warm = true; S.beaten = INKDOJO.ROSTER.map(r => r.id).filter(id => id !== 'w3'); INKDOJO.setupWorld(); const f = INKDOJO.foes.find(f => f.id === 'w3'); INKDOJO.teleport(f.x + 120, f.y); INKDOJO.startFight(f); });
  await p.waitForTimeout(2300); await p.evaluate(() => INKDOJO.koFoe()); await p.waitForTimeout(3200);
  await p.screenshot({ path: OUTDIR + '/t2_lesson1.png' });
  await p.evaluate(() => INKDOJO.tapOverlay()); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUTDIR + '/t3_lesson2.png' });
  await p.evaluate(() => INKDOJO.tapOverlay()); await p.waitForTimeout(600);
  await p.keyboard.press('KeyM'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUTDIR + '/t4_scroll_all.png' });
  console.log('known', await p.evaluate(() => INKDOJO.learnedCount()), 'errors', errs); await b.close();
})();
