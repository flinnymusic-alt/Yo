// In every far land, beasts turn up in the wilds, fight in their own ways without errors, and pay a bounty.
const { openWorld } = require('./lib');
(async () => {
  const { browser, page, errs } = await openWorld();
  const ids = await page.evaluate(() => LANDS.map(L => L.id));
  let bad = 0;
  for (const id of ids) {
    const r = await page.evaluate(id => {
      const L = landById(id); enterLand(L);
      const s = L.sites.find(s => !s.isle), p = s ? freeSpot((L.base.x + s.x) / 2, (L.base.y + s.y) / 2, 16) : { x: L.sites[0].x, y: L.sites[0].y + 80 };
      player.x = p.x; player.y = p.y;
      const t0 = ADV.world.tokens, seen = {}; let hurt = 0, kills = 0, maxFoes = 0;
      for (let i = 0; i < 120 * 20; i++) {
        const hp = player.hp; farX().food = 90;
        tick(0.05);
        if (state !== 'play') { state = 'play'; player.hp = player.maxHp; }
        hurt += Math.max(0, hp - player.hp); player.hp = player.maxHp;
        const live = foes.filter(f => f.far && !f.dead);
        maxFoes = Math.max(maxFoes, live.length);
        for (const f of live) seen[f.beast || f.art] = 1;
        if (i % 30 === 29) { const f = live.filter(f => !f.sub).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0]; if (f) { damageFoe(f, 999, 'prism'); kills++; } }
      }
      const res = { id, kinds: Object.keys(seen), maxFoes, kills, earned: ADV.world.tokens - t0, hurt: Math.round(hurt), food: farX().food };
      leaveLand();
      return res;
    }, id);
    const want = await page.evaluate(id => landById(id).beasts, id);
    const missing = want.filter(k => !r.kinds.includes(k));
    if (missing.length || !r.earned) bad++;
    console.log(r.id.padEnd(6), 'kinds', r.kinds.join(','), '| most at once', r.maxFoes, '| kills', r.kills, '| tokens', r.earned, '| hurt', r.hurt, missing.length ? '| NEVER SEEN: ' + missing : '');
  }
  console.log(errs.length ? errs : 'no errors');
  await browser.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
