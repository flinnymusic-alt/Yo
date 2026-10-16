// the new opening: Ren's warm-up, the halls opening, belts in order
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
  await p.waitForTimeout(1200); await p.screenshot({ path: OUTDIR + '/f1_start.png' });
  for (let i = 0; i < 120 && !(await p.evaluate(() => INKDOJO.fight && INKDOJO.fight.on)); i++) await p.waitForTimeout(100);
  await p.waitForTimeout(2500); await p.screenshot({ path: OUTDIR + '/f2_ren.png' });
  console.log('fighting:', await p.evaluate(() => [INKDOJO.fight.foe.name, INKDOJO.fight.foe.way, Math.round(INKDOJO.fight.foe.maxHp), JSON.stringify(INKDOJO.fight.foe.sk, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v)].join(' ')));
  await p.evaluate(() => INKDOJO.koFoe()); await p.waitForTimeout(2600);
  await p.screenshot({ path: OUTDIR + '/f3_open.png' });
  await p.evaluate(() => INKDOJO.tapOverlay()); await p.waitForTimeout(900);
  await p.screenshot({ path: OUTDIR + '/f4_banner.png' });
  console.log('tier:', await p.evaluate(() => INKDOJO.tierNow()), 'warm:', await p.evaluate(() => INKDOJO.save.warm));
  // walk up to a Sensei: they wave you off
  await p.evaluate(() => { const f = INKDOJO.foes.find(f => f.id === 'w3'); INKDOJO.teleport(f.x + 110, f.y); });
  await p.waitForTimeout(4500); await p.screenshot({ path: OUTDIR + '/f5_notyet.png' });
  console.log('challenged by a Sensei?', await p.evaluate(() => INKDOJO.foes.find(f => f.id === 'w3').mode));
  // walk up to a white belt: they challenge
  await p.evaluate(() => { const f = INKDOJO.foes.find(f => f.id === 'w1'); INKDOJO.teleport(f.x + 150, f.y); });
  for (let i = 0; i < 80 && !(await p.evaluate(() => INKDOJO.fight)); i++) await p.waitForTimeout(100);
  console.log('white belt fight:', await p.evaluate(() => INKDOJO.fight && [INKDOJO.fight.foe.name, Math.round(INKDOJO.fight.foe.maxHp), INKDOJO.fight.foe.sk.k, INKDOJO.fight.foe.sk.spells].join(' ')));
  console.log('errors', errs); await b.close();
})();
