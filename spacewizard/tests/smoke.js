// The game loads, a battle runs, and the Scribing Dojo loads, on a phone-sized and a wide screen.
const { open, GAME } = require('./lib');
(async () => {
  let bad = 0;
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const { browser, page, errs } = await open(vp);
    const r = await page.evaluate(() => { startBattle('medium'); for (let i = 0; i < 1200; i++) tick(0.05); return [mode, state, friends.length, foes.length]; });
    console.log(vp.width, 'battle', r, errs);
    const w = await page.evaluate(() => { startGame(true); for (let i = 0; i < 200; i++) tick(0.05); return [mode, state]; });
    console.log(vp.width, 'adventure', w, errs);
    bad += errs.length;
    await page.goto(GAME.replace('pentagram', 'scribe')); await page.waitForTimeout(300);
    console.log(vp.width, 'scribe', errs); bad += errs.length;
    await browser.close();
  }
  process.exit(bad ? 1 : 0);
})();
