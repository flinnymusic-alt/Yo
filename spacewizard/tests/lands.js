// Every gate can be walked to from Hollowbrook; every far land builds, and its base and named places can be
// reached from its gate (on foot, or by boat where there's a sea). Saves a picture of each land's map.
const { openWorld } = require('./lib');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || path.resolve(__dirname, '../build/shots');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, errs } = await openWorld();
  let bad = 0;
  const home = await page.evaluate(() => {
    // flood out from Hollowbrook over ground you can walk on
    const flood = (sx, sy, ok) => {
      const seen = new Uint8Array(LN * LN), q = [];
      const at = (x, y) => [Math.floor((x - GX + AW) / LC), Math.floor((y - GY + AW) / LC)];
      const [i0, j0] = at(sx, sy); seen[j0 * LN + i0] = 1; q.push(j0 * LN + i0);
      for (let h = 0; h < q.length; h++) { const k = q[h], i = k % LN, j = (k - i) / LN; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= LN || b >= LN) continue; const m = b * LN + a; if (!seen[m] && ok(land[m])) { seen[m] = 1; q.push(m); } } }
      return (x, y) => { const [i, j] = at(x, y); return !!seen[j * LN + i]; };
    };
    window.flood = flood;
    const r = flood(0, 4650, footOk);
    return FARGATES.map(g => [g.land, r(g.out.x, g.out.y), r(g.in.x, g.in.y)]);
  });
  for (const [id, a, b] of home) { if (!a || !b) { bad++; console.log('HOME GATE NOT REACHABLE', id, a, b); } }
  console.log('home gates reachable:', home.filter(h => h[1] && h[2]).length, 'of', home.length);
  const ids = await page.evaluate(() => LANDS.map(L => L.id));
  for (const id of ids) {
    const r = await page.evaluate(id => {
      const L = landById(id), t0 = performance.now();
      enterLand(L);
      const ms = Math.round(performance.now() - t0);
      const walk = flood(L.arr.x, L.arr.y, footOk), sail = flood(L.arr.x, L.arr.y, t => footOk(t) || t === L_WATER);
      const miss = [];
      if (!walk(L.base.x + 60, L.base.y + 60)) miss.push('base');
      if (!walk(L.out.x, L.out.y)) miss.push('exit');
      for (const s of L.sites) if (!(s.isle ? sail : walk)(s.x, s.y + 70)) miss.push(s.id);
      if (L.g.dock && !walk(L.g.dock.pier.a.x, L.g.dock.pier.a.y)) miss.push('jetty');
      const cv = mapCanvas(), n = cv.width, half = Math.ceil(L.size * 1.45 / MAP_PX), out = document.createElement('canvas');
      out.width = out.height = half * 2; out.getContext('2d').drawImage(cv, n / 2 - half, n / 2 - half, half * 2, half * 2, 0, 0, half * 2, half * 2);
      const g = out.getContext('2d'), X = x => (x - L.gx) / MAP_PX + half, Y = y => (y - L.gy) / MAP_PX + half;
      g.fillStyle = '#ffd24a'; for (const s of L.sites) { g.beginPath(); g.arc(X(s.x), Y(s.y), 3, 0, 7); g.fill(); }
      g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(X(L.base.x), Y(L.base.y), 4, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(L.arr.x), Y(L.arr.y), 3, 0, 7); g.fill();
      for (let i = 0; i < 40; i++) tick(0.05);
      const res = { id, ms, miss, solids: L.g.solids.length, walls: L.g.walls.length, img: out.toDataURL('image/png') };
      leaveLand();
      for (let i = 0; i < 10; i++) tick(0.05);
      return res;
    }, id);
    fs.writeFileSync(path.join(OUT, `land-${id}.png`), Buffer.from(r.img.split(',')[1], 'base64'));
    if (r.miss.length) bad++;
    console.log(r.id.padEnd(6), `${r.ms}ms`.padStart(7), 'things', r.solids, 'walls', r.walls, r.miss.length ? 'CANNOT REACH: ' + r.miss.join(', ') : 'all reachable');
  }
  const back = await page.evaluate(() => [LANDNOW, GX, Math.round(player.x), Math.round(player.y), walls.length, landAt(0, 4650)]);
  console.log('home again:', back, errs.length ? errs : 'no errors');
  await browser.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
