// For each way: every move written neatly, roughly, without its pools and far off, against that way's twenty; and scribbles.
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const INK = require('../src/lib.js');
const only = process.argv[2];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let totalBad = 0;
for (const w of INK.WAY_ORDER) {
  if (only && only !== w) continue;
  const moves = INK.MOVES[w], rows = [], confusions = {};
  let minMargin = 9, minWho = '';
  const trial = (g, o, n) => {
    const res = [];
    for (let i = 0; i < n; i++) {
      const oo = { ...o, seed: rnd() * 10, wobble: o.wobble, off: o.off ? { x: (rnd() - 0.5) * 2 * o.off, y: (rnd() - 0.5) * 2 * o.off } : undefined,
                   scale: o.scale ? 1 + (rnd() - 0.5) * 2 * o.scale : (o.fixScale || 1), speed: o.speed ? 1 + (rnd() - 0.5) * 2 * o.speed : 1 };
      if (o.shift) oo.off = { x: o.shift * Math.cos(i * 2.4), y: o.shift * Math.sin(i * 2.4) };
      const R = INK.recognize(INK.writeOut(g, oo), moves);
      const second = R.all[1];
      res.push({ id: R.best ? R.best.g.role : '-', v: R.verdict, q: R.best ? R.best.q : 0, margin: R.best && second ? R.best.q - second.q : 1, second: second ? second.g.role : '-' });
    }
    return res;
  };
  for (const g of moves) {
    const good = trial(g, { wobble: 0.014, off: 0.05, scale: 0.08, speed: 0.25 }, 12);
    const rough = trial(g, { wobble: 0.03, off: 0.12, scale: 0.18, speed: 0.4 }, 12);
    const np = g.pools.flat().length ? trial(g, { wobble: 0.014, noPools: true }, 6) : null;
    const far = trial(g, { wobble: 0.014, shift: 0.5 }, 6);
    const ok = r => r.id === g.role && r.v !== 'fizzle';
    const gRight = good.filter(ok).length, gClean = good.filter(r => ok(r) && r.v === 'clean').length;
    const rRight = rough.filter(ok).length, rWrong = rough.filter(r => r.v !== 'fizzle' && r.id !== g.role);
    for (const r of good.concat(rough)) if (r.v !== 'fizzle' && r.id !== g.role) confusions[g.role + '→' + r.id] = (confusions[g.role + '→' + r.id] || 0) + 1;
    for (const r of good) if (r.id === g.role && r.margin < minMargin) { minMargin = r.margin; minWho = g.role + ' vs ' + r.second; }
    const gm = Math.min(...good.filter(r => r.id === g.role).map(r => r.margin));
    const farWrong = far.filter(r => r.v !== 'fizzle' && r.id !== g.role).length, farFizz = far.filter(r => r.v === 'fizzle').length;
    const bad = gRight < 12 || gClean < 10 || rWrong.length > 1;
    if (bad) totalBad++;
    rows.push(`${bad ? '✗' : ' '} ${g.role.padEnd(10)} good ${gRight}/12 clean ${String(gClean).padStart(2)} q${(good.reduce((a, r) => a + r.q, 0) / 12).toFixed(2)} margin ${isFinite(gm) ? gm.toFixed(2) : ' -- '} | rough ${String(rRight).padStart(2)}/12 wrong ${rWrong.length}${rWrong.length ? '(' + [...new Set(rWrong.map(r => r.id))].join(',') + ')' : ''} | ${np ? 'nopool ' + np.filter(ok).length + '/6 clean ' + np.filter(r => ok(r) && r.v === 'clean').length : 'no pools        '} | far: fizzle ${farFizz}/6 wrong ${farWrong}`);
  }
  // scribbles
  let fz = 0;
  for (let k = 0; k < 40; k++) {
    const n = 8 + Math.floor(rnd() * 20), pts = [];
    let x = (rnd() - 0.5) * 1.2, y = (rnd() - 0.5) * 1.2;
    for (let i = 0; i < n; i++) { x = Math.max(-0.9, Math.min(0.9, x + (rnd() - 0.5) * 0.7)); y = Math.max(-0.9, Math.min(0.9, y + (rnd() - 0.5) * 0.7)); pts.push({ x, y }); }
    const g = { strokes: [pts], pools: [[]], ink: 'any', closed: [false] };
    const R = INK.recognize(INK.writeOut(g, { wobble: 0 }), moves);
    if (R.verdict === 'fizzle') fz++;
  }
  console.log(`\n== ${w.toUpperCase()}  (scribbles fizzle ${fz}/40; smallest neat margin ${minMargin.toFixed(2)}: ${minWho})`);
  console.log(rows.join('\n'));
  const cf = Object.entries(confusions).sort((a, b) => b[1] - a[1]);
  if (cf.length) console.log('confusions:', cf.map(([k, v]) => k + '×' + v).join('  '));
}
console.log('\nmoves needing work:', totalBad);
