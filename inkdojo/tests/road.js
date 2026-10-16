// the difficulty of the story's fights, with a bot writing by hand at a human pace: the three wolves, the four white belts
// (each a little better than the last), and the bandits one after another (a breather of 40% health between them).
// Usage: node road.js [N]  (env: WAYS, WOB a rougher hand, THINK and REACT how quick the bot is)
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const BOTK = { think: JSON.parse(process.env.THINK || '[1.6, 2.6]'), react: +(process.env.REACT || 0.35), wob: +(process.env.WOB || 0) };
const N = +(process.argv[2] || 10), WAYS = (process.env.WAYS || 'water,fire,earth,air').split(',');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.goto(GAME); await p.waitForTimeout(400);
  for (const way of WAYS) {
    const r = await p.evaluate(([N, way, BOTK]) => {
      const D = INKDOJO; D.manual(true); D.setSound(false);
      const K = { think: BOTK.think, react: BOTK.react }, wob = () => (BOTK.wob ? BOTK.wob * (0.6 + Math.random() * 0.8) : undefined);
      const fight = foe => {
        D.teleport(foe.x + 140, foe.y + 40); D.startFight(foe); D.bot(true);
        let t = 0; while (t < 150) { const F = D.fight; if (!F || F.over) break; if (F.on) D.botStep(1 / 60, K, wob()); D.step(1); t += 1 / 60; }
        const won = D.fight && D.fight.over && D.fight.over.winner === D.player, hp = D.player.hp / D.player.maxHp;
        D.bot(false); D.step(130); D.close();
        return { won, hp };
      };
      const setup = (q, whites, scribe) => {
        localStorage.clear(); D.begin(way); D.close();
        const S = D.save; S.q = q; S.scribe = scribe; S.heard = { mum0: 1, post1: 1, scribe: 1, sensei: 1 };
        S.beaten = ['w1', 'f1', 'e1', 'a1'].sort(() => Math.random() - 0.5).slice(0, whites);
        S.scene = q >= 4 ? 'home' : whites || scribe ? 'dojo' : 'home'; S.at = S.scene === 'home' ? 'north' : 'gate';
        D.setupWorld();
      };
      const out = {};
      const tally = (k, won) => { out[k] = out[k] || [0, 0]; out[k][0] += won ? 1 : 0; out[k][1]++; };
      for (let n = 0; n < N; n++) {
        // a wolf, with the three basic moves
        setup(1, 0, false);
        const wolf = D.foes.find(f => f.id === 'wolf' + (1 + (n % 3))); wolf.hidden = false;
        tally('wolf', fight(wolf).won);
        // the white belts, in turn (the calligrapher's move learned)
        for (let w = 0; w < 4; w++) {
          setup(2, w, true);
          const foe = D.foes.filter(f => f.rank === 1 && !f.beaten)[0];
          tally('white' + (w + 1), fight(foe).won);
        }
        // the bandits, one after another, all eight moves known
        setup(4, 4, true);
        D.save.ambush = true;
        const B = D.foes.filter(f => f.bandit); B.forEach((f, i) => { f.hidden = false; f.x = D.player.x + 60 * i; f.y = D.player.y + 300; });
        let all = true;
        for (const f of B) { const r = fight(f); tally(f.name, r.won); if (!r.won) { all = false; break; } }
        tally('all 3 bandits', all);
      }
      return out;
    }, [N, way, BOTK]);
    console.log(way.padEnd(6), Object.entries(r).map(([k, [w, n]]) => `${k} ${Math.round(100 * w / n)}%`).join(' · '));
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
