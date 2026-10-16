// the difficulty curve: a bot plays you (choosing as a fighter would, writing by hand at a human pace) through the dojo in order,
// fight by fight: the first-day student, the four white belts, the brown, the black, the Grandmaster
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const BOTK = { think: JSON.parse(process.env.THINK || '[1.6, 2.6]'), react: +(process.env.REACT || 0.35), wob: +(process.env.WOB || 0) };
const N = +(process.argv[2] || 8), WAYS = (process.env.WAYS || 'water,fire,earth,air').split(','), KS = (process.env.KS || '0,1,2,3,4,5,6,7,8,9,10,11,12,13').split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.goto(GAME); await p.waitForTimeout(400);
  for (const way of WAYS) {
    const row = [];
    for (const k of KS) {
      const r = await p.evaluate(([N, way, k, BOTK]) => {
        const D = INKDOJO; D.manual(true); D.setSound(false);
        let wins = 0, time = 0, hp = 0; const who = {};
        for (let n = 0; n < N; n++) {
          D.begin(way); D.close();
          const S = D.save, R = D.ROSTER, ids = r => R.filter(o => o.rank === r).map(o => o.id).sort(() => Math.random() - 0.5);
          S.warm = k > 0;
          // beaten so far: k-1 hall fighters, belts in order
          const order = [...ids(1), ...ids(2), ...ids(3)];
          S.beaten = k >= 1 ? order.slice(0, Math.min(12, k - 1)) : [];
          D.setupWorld();
          const foe = k === 0 ? D.student : k === 13 ? (D.spawnMaster(true), D.master) : D.foes.find(f => f.id === order[k - 1]);
          foe.beaten = false; foe.mode = 'post';
          D.teleport(foe.x + 140, foe.y + 40);
          D.startFight(foe); D.bot(true);
          who[foe.name] = 1;
          const K = { think: BOTK.think, react: BOTK.react };
          let t = 0;
          while (t < 150) { const F = D.fight; if (!F || F.over) break; if (F.on) D.botStep(1 / 60, K, BOTK.wob ? BOTK.wob * (0.6 + Math.random() * 0.8) : undefined); D.step(1); t += 1 / 60; }
          const F = D.fight, won = F && F.over && F.over.winner === D.player;
          if (won) { wins++; hp += D.player.hp / D.player.maxHp; }
          time += t;
          D.bot(false); D.step(130); D.close();
        }
        return { wins, time: time / N, hp: wins ? hp / wins : 0, who: Object.keys(who).length };
      }, [N, way, k, BOTK]);
      row.push(`${k}:${Math.round(100 * r.wins / N)}%`);
      console.log(`${way.padEnd(6)} fight ${String(k).padStart(2)}: won ${r.wins}/${N}  ${Math.round(r.time)}s  ${Math.round(100 * r.hp)}% hp left`);
    }
    console.log(`${way} curve: ${row.join(' ')}`);
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
