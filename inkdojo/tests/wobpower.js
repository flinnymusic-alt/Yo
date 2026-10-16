// how strong the bot's spells are at a given wobble (how rough its writing is)
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(GAME); await p.waitForTimeout(400);
  for (const wob of [0.02, 0.04, 0.06, 0.08, 0.1]) {
    const r = await p.evaluate(wob => { const D = INKDOJO; let sum = 0, n = 0, fiz = 0;
      for (const w of ['water', 'fire', 'earth', 'air']) { D.begin(w); D.close(); for (const m of D.MOVES[w].slice(0, 8)) for (let k = 0; k < 10; k++) { D.player.act = null; D.player.ki = 100; const R = D.write(m.key, { wobble: wob * (0.6 + Math.random() * 0.8), seed: Math.random() * 9 }); if (!R || R.verdict === 'fizzle') fiz++; else { sum += R.power; n++; } } }
      return { mean: (sum / n).toFixed(2), fizzled: Math.round(100 * fiz / (n + fiz)) + '%' }; }, wob);
    console.log('wobble', wob, JSON.stringify(r));
  }
  await b.close();
})();
