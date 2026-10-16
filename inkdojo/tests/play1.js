// a bot plays the opening in real time on a phone-sized screen: Mum's talk (tapped through), then the first wolf on the
// road, writing moves by hand every ~1.2 s, holding one attack with a curl and throwing it with a tap on its seal.
// Usage: node play1.js [way]   Expect: the wolf beaten, held and thrown, errors []
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
  await p.evaluate(w => { localStorage.clear(); INKDOJO.begin(w); }, way);
  await p.waitForTimeout(1200);
  // Mum: tap through what she says
  for (let i = 0; i < 12 && (await p.evaluate(() => INKDOJO.overlay && INKDOJO.overlay.kind === 'talk')); i++) { await p.waitForTimeout(400); await p.touchscreen.tap(195, 300); }
  console.log('after Mum:', await p.evaluate(() => JSON.stringify({ q: INKDOJO.save.q, goal: INKDOJO.goal().text })));
  await p.screenshot({ path: OUTDIR + '/i2_home.png' });
  // walk up the road toward the first wolf
  await p.evaluate(() => { const f = INKDOJO.foes.find(f => f.id === 'wolf1'); INKDOJO.teleport(f.x + 120, f.y + 80); });
  for (let i = 0; i < 150 && !(await p.evaluate(() => !!INKDOJO.fight)); i++) await p.waitForTimeout(100);
  console.log('fight?', await p.evaluate(() => !!INKDOJO.fight && INKDOJO.fight.foe.name));
  const roles = await p.evaluate(() => INKDOJO.myMoves().map(m => m.key)), attack = await p.evaluate(() => INKDOJO.myMoves().find(m => m.tag === 'Shot').key);
  let shot = false, held = '', thrown = '';
  for (let i = 0; i < 70; i++) {
    const s = await p.evaluate(() => { const F = INKDOJO.fight; return F ? { on: F.on, over: !!F.over, php: Math.round(INKDOJO.player.hp), fhp: Math.round(F.foe.hp) } : null; });
    if (!s || s.over) break;
    if (s.on) {
      if (i === 3) {
        // a curl at the end of the attack: held, not thrown
        held = await p.evaluate(k => { const R = INKDOJO.write(k, { curl: true }); return [R && R.best.g.key, INKDOJO.held && INKDOJO.held.move.key].join(' → held '); }, attack);
      } else if (i === 5) {
        // tap its seal by the paper
        const c = await p.evaluate(() => { const b = INKDOJO.heldBtn(); return { x: b.cx, y: b.cy }; });
        await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(80);
        thrown = await p.evaluate(() => [INKDOJO.held ? 'still held' : 'thrown', INKDOJO.player.act && INKDOJO.player.act.move.key].join(' '));
      } else {
        const R = await p.evaluate(r => { const R = INKDOJO.write(r); return R && [R.best && R.best.g.role, R.verdict, Math.round(R.acc * 100) + '%', '×' + R.power.toFixed(2)].join(' '); }, roles[i % roles.length]);
        if (i < 3) console.log('wrote', roles[i % roles.length], '→', R, '| hp', s.php, 'vs', s.fhp);
      }
    }
    if (i === 4 && !shot) { shot = true; await p.waitForTimeout(150); await p.screenshot({ path: OUTDIR + '/i3_fight.png' }); }
    await p.waitForTimeout(1200);
  }
  console.log('curl:', held, '| tap:', thrown);
  await p.waitForTimeout(2500);
  console.log('after fight:', await p.evaluate(() => JSON.stringify({ state: INKDOJO.state, overlay: INKDOJO.overlay && INKDOJO.overlay.kind, wolves: INKDOJO.save.wolves, php: Math.round(INKDOJO.player.hp), learned: INKDOJO.learnedCount() })));
  await p.screenshot({ path: OUTDIR + '/i4_after.png' });
  console.log('errors', errs);
  await b.close();
})();
