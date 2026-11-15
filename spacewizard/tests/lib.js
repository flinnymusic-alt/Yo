// Shared bits for the Space Wizard test scripts: open the game in a headless browser and reach its globals.
// Run any script here with `node spacewizard/tests/<name>.js`.
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const GAME = 'file://' + path.resolve(__dirname, '../../pentagram.html');
async function open(viewport = { width: 390, height: 844 }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(GAME); await page.waitForTimeout(400);
  return { browser, page, errs };
}
// a save with the Sanctum finished, so the wide world is open
async function openWorld(viewport, extra = '') {
  const o = await open(viewport);
  await o.page.evaluate(extra => {
    const a = advFresh();
    for (const e of ZONE_ELEMS) Object.assign(a.zones[e], { gate: true, beaten: 3, stage: 3, done: true });
    for (const k of Object.values(LINE).flat()) a.known.add(k);
    a.check = { x: 0, y: 4600 }; a.world.welcomed = true; a.world.tokens = 2000;
    localStorage.setItem(ADV_SAVE, JSON.stringify({ ...a, known: [...a.known] }));
    startGame(false);
    if (extra) eval(extra);
  }, extra);
  return o;
}
module.exports = { open, openWorld, GAME };
