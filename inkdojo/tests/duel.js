// element against element, both played by the same fighter's mind at the same strength: who wins, how often, how fast
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const N = +(process.argv[2] || 8), W = ['water', 'fire', 'earth', 'air'];
const SIM = JSON.parse(process.env.SIM || '{}');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.goto(GAME); await p.waitForTimeout(400);
  const res = await p.evaluate(([N, W, SIM]) => {
    const D = INKDOJO; D.manual(true); D.setSound(false);
    if (SIM.adv) Object.assign(D.ADV, SIM.adv);
    for (const w in D.HALL) D.HALL[w] = 1;
    if (SIM.mod) for (const w in SIM.mod) Object.assign(D.WAYMOD[w], SIM.mod[w]);
    D.RANKS[5] = { belt: '#000', beltName: 'sim', hp: 100, dmg: 1, windup: 0.46, think: [0.95, 1.5], react: 0.38, spells: 20, power: 0.92, ...SIM };
    const MOD = Object.fromEntries(['water', 'fire', 'earth', 'air'].map(w => [w, D.WAYMOD[w].hp]));
    const out = {}, used = {}; D.dmgLog(true);
    const one = (A, B) => {
      D.begin(A); D.close();
      const foe = D.foes.find(f => f.id === 'w1');
      foe.way = B; foe.ai.way = B; foe.beaten = false; foe.mode = 'post';
      D.teleport(foe.x + 140, foe.y + 40);
      D.startFight(foe); D.bot(true);
      const me = D.player;
      for (const [f, w] of [[me, A], [foe, B]]) { f.isPlayer = false; f.rank = 5; f.way = w; f.ai.way = w; f.maxHp = Math.round(MOD[w] * 1.25 * (SIM.hpK || 1)); f.hp = f.maxHp; f.kiRegen = 13; f.speed = 150 * D.WAYMOD[w].speed; f.ai.cd = {}; f.ai.think = 0.9; f.ai.range = 0; f.sk = null; }
      let t = 0;
      while (t < 120) {
        const F = D.fight; if (!F || F.over) break;
        if (F.on) D.aiPlayer(1 / 60);
        D.step(1); t += 1 / 60;
      }
      const F = D.fight, win = F && F.over ? (F.over.winner === me ? 1 : 0) : 0.5;
      const hpA = me.hp / me.maxHp, hpB = foe.hp / foe.maxHp;
      me.isPlayer = true; D.bot(false); D.step(130); D.close();
      return { win, t, hpA, hpB };
    };
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const A = W[i], B = W[j]; let wa = 0, time = 0, draws = 0;
      if (SIM.pair && SIM.pair !== A + '-' + B) continue;
      for (let k = 0; k < N; k++) {
        const r1 = one(A, B); wa += r1.win; time += r1.t; if (r1.win === 0.5) draws++;
        const r2 = one(B, A); wa += 1 - r2.win; time += r2.t; if (r2.win === 0.5) draws++;
      }
      out[A + '-' + B] = { a: wa / (2 * N), time: time / (2 * N), draws };
    }
    return { out, log: D.dmgLog(false) };
  }, [N, W, SIM]);
  const log = res.log;
  const tot = { water: 0, fire: 0, earth: 0, air: 0 };
  for (const [k, v] of Object.entries(res.out)) { const [a, b2] = k.split('-'); tot[a] += v.a; tot[b2] += 1 - v.a; console.log(`${a.padEnd(6)} vs ${b2.padEnd(6)}: ${a} wins ${Math.round(v.a * 100)}%  (${Math.round(v.time)}s avg${v.draws ? ', ' + v.draws + ' draws' : ''})`); }
  console.log('overall:', Object.entries(tot).map(([w, v]) => `${w} ${Math.round(v / 3 * 100)}%`).join('  '));
  if (process.env.LOG) for (const w of W) {
    const rows = Object.entries(log).filter(([k]) => k.startsWith(w + ':')), tot = rows.reduce((a, [, v]) => a + v, 0);
    console.log(`\n${w} damage dealt, by spell (${Math.round(tot)} in all; ki flow ×${(log['kf:' + w] / log['t:' + w]).toFixed(2)}):`);
    console.log(rows.filter(r => r[1] / tot > 0.004).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.split(':')[1]} ${Math.round(100 * v / tot)}%`).join('  '));
    const cs = Object.entries(log).filter(([k]) => k.startsWith('#' + w + ':')), ct = cs.reduce((a, [, v]) => a + v, 0);
    console.log(`casts (${ct}): ` + cs.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.split(':')[1]} ${Math.round(100 * v / ct)}%`).join('  '));
    console.log('dmg per cast: ' + cs.map(([k, v]) => [k.split(':')[1], (log[w + ':' + k.split(':')[1]] || 0) / v]).filter(r => r[1] > 0.5).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  '));
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
