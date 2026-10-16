const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const OUT = OUTDIR + '/';
(async () => {
  const b = await chromium.launch();
  const errs = [], strips = [];
  for (const [w, h, tag] of [[390, 844, 'tall'], [844, 390, 'wide'], [1024, 700, 'tab'], [360, 640, 'small']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(GAME); await p.waitForTimeout(300);
    await p.evaluate(() => { INKDOJO.begin('earth'); INKDOJO.close(); });
    await p.waitForTimeout(200);
    // the strip round the buttons
    const clip = await p.evaluate(([w, h]) => {
      const wide = w > h * 1.05;
      let r, cy, x0 = 0;
      if (wide) { r = Math.min(h * 0.4, w * 0.21, 210); cy = h / 2 + 26; x0 = w - 2 * r - 56; }
      else { r = Math.min(w * 0.42, h * 0.215, 210); cy = h - r - Math.max(14, h * 0.02); }
      const y = cy - r - 30;
      return { x: x0, y: Math.max(0, y - 24), width: w - x0, height: 48 };
    }, [w, h]);
    const grab = async name => { const f = OUT + `p_${tag}_${name}.png`; await p.screenshot({ path: f, clip }); strips.push([tag + ' ' + name, f]); };
    await grab('hint');
    await p.evaluate(() => { const m = INKDOJO.MOVES.earth.find(m => m.key === 'boulder'); INKDOJO.padJudge(INKDOJO.INK.writeOut(m, { wobble: 0.01 })); });
    await p.waitForTimeout(120); await grab('read');
    await p.waitForTimeout(1300);
    await p.evaluate(() => { const m = INKDOJO.MOVES.earth.find(m => m.key === 'mountain'); INKDOJO.padJudge(INKDOJO.INK.writeOut(m, { wobble: 0.01 })); });
    await p.waitForTimeout(120); await grab('locked');
    await p.waitForTimeout(1300);
    // not enough ki: a heavy move when ki is empty
    await p.evaluate(() => { INKDOJO.player.ki = 0; const m = INKDOJO.MOVES.earth.find(m => m.key === 'boulder'); INKDOJO.padJudge(INKDOJO.INK.writeOut(m, { wobble: 0.01 })); });
    await p.waitForTimeout(120); await grab('noki');
    await ctx.close();
  }
  const p = await b.newPage({ viewport: { width: 1100, height: 100 } });
  await p.setContent(`<body style="margin:0;background:#444;font:12px sans-serif;color:#fff">${strips.map(([t, f]) => `<div style="display:flex;align-items:center;gap:8px;margin:3px"><span style="width:90px">${t}</span><img style="height:48px" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"></div>`).join('')}</body>`);
  await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'p_strips.png', fullPage: true });
  console.log('errors', errs);
  await b.close();
})();
