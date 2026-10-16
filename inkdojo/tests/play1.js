const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const way = process.argv[2] || 'water';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT/.test(m.text())) errs.push(m.text()); });
  await p.goto(GAME); await p.waitForTimeout(500);
  // pick the way by tapping its card, then Enter
  const card = await p.evaluate(w => { const i = ['water', 'fire', 'earth', 'air'].indexOf(w); return i; }, way);
  await p.evaluate(w => INKDOJO.begin(w), way);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUTDIR + '/i2_dojo.png' });
  // walk toward the first fighter of the hall of Water
  await p.evaluate(() => INKDOJO.teleport(390, 700));
  await p.waitForTimeout(400);
  console.log('after walking near Mei:', await p.evaluate(() => INKDOJO.foes.map(f => f.mode).join(',')));
  for (let i = 0; i < 150 && !(await p.evaluate(() => !!INKDOJO.fight)); i++) await p.waitForTimeout(100);
  console.log('fight?', await p.evaluate(() => !!INKDOJO.fight && [INKDOJO.fight.foe.name, INKDOJO.fight.on].join(' ')));
  // fight: write a move every ~1.2 s
  const roles = await p.evaluate(() => INKDOJO.myMoves().map(m => m.key)), heal = roles[2];
  let shot = false;
  for (let i = 0; i < 70; i++) {
    const s = await p.evaluate(() => { const F = INKDOJO.fight; return F ? { on: F.on, over: !!F.over, php: Math.round(INKDOJO.player.hp), fhp: Math.round(F.foe.hp), ki: Math.round(INKDOJO.player.ki) } : null; });
    if (!s || s.over) break;
    if (s.on) {
      const role = s.php < 40 && s.ki > 25 ? heal : roles[i % roles.length];
      const R = await p.evaluate(r => { const R = INKDOJO.write(r); return R && [R.best && R.best.g.role, R.verdict, Math.round(R.power * 100)].join(' '); }, role);
      if (i < 6) console.log('wrote', role, '→', R, '| hp', s.php, 'vs', s.fhp);
    }
    if (i === 6 && !shot) { shot = true; await p.waitForTimeout(150); await p.screenshot({ path: OUTDIR + '/i3_fight.png' }); }
    await p.waitForTimeout(1200);
  }
  await p.waitForTimeout(2500);
  console.log('after fight:', await p.evaluate(() => JSON.stringify({ state: INKDOJO.state, overlay: INKDOJO.overlay && INKDOJO.overlay.kind, beaten: INKDOJO.save.beaten, php: Math.round(INKDOJO.player.hp), learned: INKDOJO.learnedCount() })));
  await p.screenshot({ path: OUTDIR + '/i4_after.png' });
  console.log('errors', errs);
  await b.close();
})();
