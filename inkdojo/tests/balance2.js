// fights simulated in quick time: a bot plays you, choosing as a fighter would, writing by hand at a human pace
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const SIM = JSON.parse(process.env.SIM || '{}'), N = +(process.argv[2] || 6), WAYS = (process.env.WAYS || 'water,fire,earth,air').split(','), FOES = (process.env.FOES || 'w1,f2,e3,a3,m').split(',');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.goto(GAME); await p.waitForTimeout(400);
  for (const way of WAYS) for (const foeId of FOES) {
    const r = await p.evaluate(([N, way, foeId, SIM]) => {
      const D = INKDOJO; D.manual(true); D.setSound(false);
      if (SIM.hall) Object.assign(D.HALL, SIM.hall);
      if (SIM.you) Object.assign(D.YOU, SIM.you);
      let wins = 0, time = 0, hpLeft = 0, casts = 0, fizz = 0; const used = {};
      for (let k = 0; k < N; k++) {
        D.begin(way); D.close();
        const S = D.save, rank = foeId === 'm' ? 4 : +foeId[1];
        S.beaten = D.ROSTER.map(r => r.id).filter(id => id !== foeId).slice(0, { 1: 0, 2: 4, 3: 8, 4: 12 }[rank]);
        D.setupWorld();
        const foe = foeId === 'm' ? (D.spawnMaster(true), D.master) : D.foes.find(f => f.id === foeId);
        foe.beaten = false; foe.mode = 'post';
        D.teleport(foe.x + 140, foe.y + 40);
        D.startFight(foe); D.bot(true);
        const K = { think: [1.6, 2.6], react: 0.35 };
        let t = 0;
        while (t < 150) {
          const F = D.fight; if (!F || F.over) break;
          if (F.on) { const c = D.botStep(1 / 60, K); if (c) { if (c === 'fizzle') fizz++; else { casts++; used[c] = (used[c] || 0) + 1; } } }
          D.step(1); t += 1 / 60;
        }
        const F = D.fight, won = F && F.over && F.over.winner === D.player;
        if (won) wins++;
        time += t; hpLeft += won ? D.player.hp / D.player.maxHp : 0;
        D.bot(false); D.step(130); D.close();
      }
      const top = Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + '×' + v).join(' ');
      return `${way.padEnd(6)} vs ${foeId === 'm' ? 'master ' : 'rank ' + foeId[1] + ' ' + foeId[0]}: won ${wins}/${N}, ${Math.round(time / N)}s, ${wins ? Math.round(100 * hpLeft / wins) : 0}% hp left, ${Math.round(casts / N)} casts (${fizz} fizzled) · ${top}`;
    }, [N, way, foeId, SIM]);
    console.log(r);
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
