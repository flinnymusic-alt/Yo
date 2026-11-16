// A brand-new adventure can walk straight out of the Sanctum into the wide world, and the menu's
// "The Wide World" button works with no save at all.
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  let bad = 0;
  const ok = (name, v, extra = '') => { if (!v) bad++; console.log(v ? '  ok ' : 'FAIL ', name, extra); };
  const r = await page.evaluate(() => {
    localStorage.removeItem(ADV_SAVE);
    startGame(true);
    const wall = segWalls.includes(WORLD_WALL), mastered = allMastered(), openNow = worldOpen();
    // walk from the court straight down through the World Gate
    let steps = 0;
    for (; steps < 4000 && player.y < 3600; steps++) { movePlayer(0, 1, 9); if (steps % 20 === 0) tick(0.05); }
    const out = player.y >= 3600 && Math.abs(player.x) < 300;
    for (let i = 0; i < 40; i++) tick(0.05);
    return { wall, mastered, openNow, out, y: Math.round(player.y), pack: packShown(), known: ADV.known.size };
  });
  ok('walk out of the Sanctum on a new adventure', !r.wall && !r.mastered && r.openNow && r.out && r.pack, JSON.stringify(r));
  const m = await page.evaluate(() => {
    localStorage.removeItem(ADV_SAVE); state = 'title'; menuPage = 'adventure';
    for (let i = 0; i < 3; i++) render();
    const b = titleButtons.find(b => b.title === 'The Wide World'); b.go();
    for (let i = 0; i < 40; i++) tick(0.05);
    const far = enterLand(landById('mere')) || LANDNOW.id; for (let i = 0; i < 20; i++) tick(0.05); leaveLand();
    return { state, at: [Math.round(player.x), Math.round(player.y)], inS: insideSanctum(player.x, player.y), far, sub: b.sub };
  });
  ok('the menu’s Wide World button with no save', m.state === 'play' && !m.inS && m.far === 'mere', JSON.stringify(m));
  console.log(errs.length ? errs : 'no errors');
  await browser.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
