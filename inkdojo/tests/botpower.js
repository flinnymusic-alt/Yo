// how well the test bot writes each way's glyphs (its spells' strength), at the wobble it uses in fights
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(GAME); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const D = INKDOJO, out = {};
    for (const w of ['water', 'fire', 'earth', 'air']) {
      D.begin(w); D.close(); D.save.beaten = D.ROSTER.map(r => r.id);
      let sum = 0, n = 0, fiz = 0; const per = {};
      for (const m of D.MOVES[w]) for (let k = 0; k < 12; k++) {
        D.player.act = null; D.player.ki = 100;
        const R = D.write(m.key, { wobble: 0.008 + Math.random() * 0.03, seed: Math.random() * 9 });
        if (!R || R.verdict === 'fizzle') { fiz++; continue; }
        sum += R.power; n++; per[m.key] = (per[m.key] || 0) + R.power / 12;
      }
      out[w] = { mean: (sum / n).toFixed(3), fiz, low: Object.entries(per).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ') };
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
