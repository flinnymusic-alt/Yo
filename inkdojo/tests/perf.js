const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const br = await chromium.launch(); const errs = [];
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(GAME); await p.waitForTimeout(300);
  for (const way of ['water', 'fire']) {
    await p.evaluate(([w]) => { localStorage.clear(); INKDOJO.begin(w); INKDOJO.close(); const f = INKDOJO.foes.find(f => f.id === 'a3'); INKDOJO.teleport(715, 1065); f.x = 885; f.y = 1065; INKDOJO.startFight(f); }, [way]);
    await p.waitForTimeout(2200);
    const r = await p.evaluate(async w => {
      const heavy = { water: ['tidal', 'flood', 'dragon', 'whirlpool', 'needles', 'geyser'], fire: ['inferno', 'meteor', 'breath', 'lava', 'firework', 'explosion'] }[w];
      let frames = 0, worst = 0, last = performance.now(); const t0 = last;
      let i = 0; const iv = setInterval(() => { INKDOJO.castAs('me', w + ':' + heavy[i++ % heavy.length], 1); INKDOJO.player.hp = INKDOJO.player.maxHp; INKDOJO.fight.foe.hp = INKDOJO.fight.foe.maxHp; }, 700);
      await new Promise(res => { const tick = now => { frames++; worst = Math.max(worst, now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
      clearInterval(iv);
      return { fps: Math.round(frames / 6), worst: Math.round(worst), fx: INKDOJO.fx.length };
    }, way);
    console.log(way, JSON.stringify(r));
  }
  console.log('errors', errs); await br.close();
})();
