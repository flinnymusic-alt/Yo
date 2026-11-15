// Take pictures of the game at chosen spots:  node shot.js <name> "<js run in the page before the picture>" [wide]
// e.g. node shot.js reedham "enterLand(landById('mere')); const c = LANDNOW.base; player.x = c.x; player.y = c.y + 200"
const { openWorld } = require('./lib');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || path.resolve(__dirname, '../build/shots');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const [name, js, wide] = process.argv.slice(2);
  const { browser, page, errs } = await openWorld(wide ? { width: 1280, height: 800 } : { width: 390, height: 844 });
  const r = await page.evaluate(js => { const v = eval(js); for (let i = 0; i < 30; i++) tick(0.033); return v === undefined ? null : JSON.stringify(v); }, js || '');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log(name, r || '', errs.length ? errs : '');
  await browser.close();
})();
