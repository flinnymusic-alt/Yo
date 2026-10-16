// every spell written outside a fight, in the dojo: nothing breaks, nobody gets stuck
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const br = await chromium.launch(); const p = await br.newPage({ viewport: { width: 390, height: 844 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT/.test(m.text())) errs.push(m.text()); });
  await p.goto(GAME); await p.waitForTimeout(300);
  const stuck = [];
  for (const way of ['water', 'fire', 'earth', 'air']) {
    await p.evaluate(w => { localStorage.clear(); INKDOJO.begin(w); INKDOJO.close(); INKDOJO.save.warm = true; INKDOJO.setupWorld(); INKDOJO.teleport(800, 1065); }, way);
    for (const key of await p.evaluate(w => INKDOJO.MOVES[w].map(m => m.key), way)) {
      await p.evaluate(([w, k]) => { INKDOJO.resetFighter(INKDOJO.player); INKDOJO.teleport(800, 1065); INKDOJO.castAs('me', w + ':' + k, 0.9); }, [way, key]);
      await p.waitForTimeout(1300);
      const s = await p.evaluate(() => { const S = INKDOJO.player.st; return ['under', 'leap', 'mend', 'stun', 'frozen', 'air'].filter(k => S[k] > 0).join(',') + (INKDOJO.player.act ? ' act' : ''); });
      if (s.trim()) stuck.push(`${way}:${key} → ${s}`);
    }
  }
  console.log('still busy after 1.3 s:', stuck.length ? stuck.join(' | ') : 'none');
  console.log('errors', errs.slice(0, 5)); await br.close();
})();
