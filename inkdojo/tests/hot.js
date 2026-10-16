const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(GAME); await p.waitForTimeout(300);
  await p.evaluate(() => { INKDOJO.begin('water'); INKDOJO.close(); });
  // a reload as the viewer would do it, with the snapshot handed back
  await p.addInitScript(() => { window.claude = { hot: { snapshot(fn) { window.__snap = fn; }, ready(start) { setTimeout(() => start({ playing: true }), 50); } } }; });
  await p.reload(); await p.waitForTimeout(500);
  console.log('after hot reload:', await p.evaluate(() => [INKDOJO.state, INKDOJO.save && INKDOJO.save.way, typeof window.__snap, JSON.stringify(window.__snap && window.__snap())].join(' ')));
  // and with no saved game, the title
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  console.log('no save:', await p.evaluate(() => INKDOJO.state));
  console.log('errors', errs); await b.close();
})();
