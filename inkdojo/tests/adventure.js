// the whole demo, played by the bot: Mum, the wolves, the town, the calligrapher, the four white belts, the package,
// the bandits, and home. Screenshots of each place go to out/adv/. Usage: node adventure.js [way]
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const path = require('path'), fs = require('fs');
const OUTDIR = path.join(__dirname, 'out', 'adv'); fs.mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const WAY = process.argv[2] || 'water';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.goto(GAME); await p.waitForTimeout(400);
  const shot = async name => { await p.evaluate(() => INKDOJO.manual(false)); await p.waitForTimeout(250); await p.screenshot({ path: path.join(OUTDIR, name + '.png') }); await p.evaluate(() => INKDOJO.manual(true)); };
  const log = [];
  await p.evaluate(way => { localStorage.clear(); const D = INKDOJO; D.manual(true); D.setSound(false); D.begin(way); D.step(30); }, WAY);
  // helpers inside the page
  await p.evaluate(() => {
    const D = INKDOJO;
    window.T = {
      talk() { let n = 0; while (D.overlay && (D.overlay.kind === 'talk' || D.overlay.kind === 'learn') && n++ < 60) { D.step(60); if (D.overlay.kind === 'talk') D.talkNext(); else D.afterLearn(); } D.step(2); },
      learn() { this.talk(); },
      // walk up to someone and wait for whatever they start
      near(x, y) { D.teleport(x, y); D.step(10); },
      fight() {
        let t = 0; const K = { think: [1.6, 2.6], react: 0.35 };
        while (!D.fight && t < 12) { D.step(1); t += 1 / 60; }
        if (!D.fight) return 'no fight';
        const foe = D.fight.foe.name; D.bot(true); t = 0;
        while (t < 150) { const F = D.fight; if (!F || F.over) break; if (F.on) D.botStep(1 / 60, K); D.step(1); t += 1 / 60; }
        const won = D.fight && D.fight.over && D.fight.over.winner === D.player;
        D.bot(false); D.step(130);
        return `${foe}: ${won ? 'won' : 'LOST'} in ${Math.round(t)}s`;
      },
      // keep fighting someone until you beat them (falling sends you back; walk up again)
      beat(id, x, y, tries = 5) {
        const out = [];
        for (let i = 0; i < tries; i++) {
          const f = D.foes.find(f => f.id === id); if (f.beaten) break;
          if (x != null) this.near(x, y);
          const r = this.fight(); out.push(r);
          if (D.overlay && D.overlay.kind === 'fallen') { D.afterFall(); D.step(5); }
          this.learn(); this.talk();
          if (r === 'no fight') break;
        }
        return out.join('; ');
      },
    };
  });
  const st = () => p.evaluate(() => ({ q: INKDOJO.save.q, scene: INKDOJO.scene, moves: INKDOJO.learnedCount(), overlay: INKDOJO.overlay && INKDOJO.overlay.kind, goal: INKDOJO.goal().text }));
  log.push('start ' + JSON.stringify(await st()));
  await shot('01-mum');
  await p.evaluate(() => T.talk());
  log.push('after Mum ' + JSON.stringify(await st()));
  await shot('02-home');
  // the three wolves on the road
  for (const w of ['wolf1', 'wolf2', 'wolf3']) {
    const r = await p.evaluate(id => { const f = INKDOJO.foes.find(f => f.id === id); return T.beat(id, f.post.x + 120, f.post.y + 60); }, w);
    log.push(r);
  }
  await shot('03-road');
  // to town by the north exit
  await p.evaluate(() => { const D = INKDOJO; D.teleport(500, 150); for (let i = 0; i < 120 && D.scene === 'home'; i++) { D.teleport(D.player.x, D.player.y - 6); D.step(1); } D.step(30); });
  log.push('town ' + JSON.stringify(await st()));
  await shot('04-town');
  // the postmaster, the calligrapher, and everyone else
  await p.evaluate(() => { const D = INKDOJO, n = id => D.npcs.find(n => n.id === id); for (const id of ['post', 'scribe', 'baker', 'farmer', 'granny', 'guard', 'kid']) { const q = n(id); T.near(q.x + 40, q.y + 30); D.step(10); T.talk(); T.learn(); T.talk(); } });
  log.push('talked ' + JSON.stringify(await st()));
  // into the dojo
  await p.evaluate(() => { const D = INKDOJO; T.near(650, 300); D.step(30); });
  log.push('dojo ' + JSON.stringify(await st()));
  await p.evaluate(() => { const D = INKDOJO, s = D.npcs.find(n => n.id === 'sensei'); T.near(s.x + 30, s.y + 50); D.step(10); T.talk(); });
  await shot('05-dojo');
  for (const id of ['w1', 'f1', 'e1', 'a1']) {
    const r = await p.evaluate(id => { const f = INKDOJO.foes.find(f => f.id === id); return T.beat(id, f.post.x + 60, f.post.y + 60); }, id);
    log.push(r);
  }
  log.push('whites ' + JSON.stringify(await st()));
  // back to town and the package
  await p.evaluate(() => { const D = INKDOJO; T.near(800, 1112); D.step(30); const q = D.npcs.find(n => n.id === 'post'); T.near(q.x + 40, q.y + 30); D.step(10); T.talk(); });
  log.push('package ' + JSON.stringify(await st()) + ' carry ' + (await p.evaluate(() => INKDOJO.player.carry)));
  // home through the gate, and down the road: the ambush
  await p.evaluate(() => { const D = INKDOJO; T.near(650, 1200); D.step(30); for (let i = 0; i < 200 && !D.overlay; i++) { D.teleport(D.player.x, D.player.y + 8); D.step(1); } });
  log.push('ambush ' + JSON.stringify(await st()));
  await shot('06-ambush');
  await p.evaluate(() => T.talk());
  for (let round = 0; round < 6; round++) {
    const r = await p.evaluate(() => {
      const D = INKDOJO, out = [];
      for (let i = 0; i < 3; i++) { const left = D.foes.filter(f => f.bandit && !f.beaten); if (!left.length || D.save.q !== D.Q.HOME) break; const r = T.fight(); out.push(r); if (D.overlay && D.overlay.kind === 'fallen') { D.afterFall(); D.step(5); break; } }
      // fell: walk down the road again until they ambush
      if (D.save.q === D.Q.HOME && !D.save.ambush) { for (let i = 0; i < 200 && !D.overlay; i++) { D.teleport(D.player.x, D.player.y + 8); D.step(1); } T.talk(); }
      return out.join('; ');
    });
    log.push('bandits: ' + r);
    if ((await st()).q !== 4) break;
  }
  log.push('after bandits ' + JSON.stringify(await st()));
  // home to Mum
  await p.evaluate(() => { const D = INKDOJO, m = D.npcs.find(n => n.id === 'mum'); T.near(m.x + 40, m.y + 20); D.step(10); });
  await shot('07-reveal');
  await p.evaluate(() => T.talk());
  log.push('end ' + JSON.stringify(await st()));
  await shot('08-end');
  console.log(log.join('\n'));
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
