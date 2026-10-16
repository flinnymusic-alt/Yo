// how alike are the scribes across the four ways? write each move cleanly and read it against every other way's moves
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const INK = require('../src/lib.js');
const { MOVES, WAY_ORDER, recognize, writeOut } = INK;
const pairs = [];
for (const a of WAY_ORDER) for (const m of MOVES[a]) for (const b of WAY_ORDER) if (b !== a) {
  let best = null;
  for (let k = 0; k < 4; k++) { const R = recognize(writeOut(m, { wobble: 0.01 }), MOVES[b]); if (R && R.best && (!best || R.best.q > best.q)) best = { q: R.best.q, v: R.verdict, g: R.best.g }; }
  if (best && best.v !== 'fizzle') pairs.push(`${m.way}:${m.name} (${m.role}) reads as ${best.g.way}:${best.g.name} (${best.g.role}) ${best.v} q${best.q.toFixed(2)}`);
}
console.log(pairs.length + ' cross-way look-alikes');
console.log(pairs.join('\n'));
