// The town's posts: reputation opens them, a season passes when you come home after a while away, and what you
// choose shows. A town given no place of prayer slides into stealing and burning; one that is cared for thrives.
const { openWorld } = require('./lib');
(async () => {
  const { browser, page, errs } = await openWorld();
  let bad = 0;
  const ok = (name, v, extra = '') => { if (!v) bad++; console.log(v ? '  ok ' : 'FAIL ', name, extra); };
  await page.evaluate(() => {
    window.put = (x, y) => { const p = freeSpot(x, y, 16); player.x = p.x; player.y = p.y; };
    window.run = s => { for (let i = 0; i < s * 20; i++) { tick(0.05); if (state !== 'play' && state !== 'shop') state = 'play'; player.hp = player.maxHp; farX().food = 50; } };
    window.away = () => { enterLand(landById('mere')); townX().away = 200; leaveLand(); run(0.2); };
    window.fresh = () => { const X = farX(); X.town = null; X.rep = 0; return townX(); };
  });
  // the halls stand where you can walk in, and their keepers speak
  const halls = await page.evaluate(() => ['townhall', 'dojo'].map(id => { const h = hallOf(id); put(h.x + h.w / 2, h.y + h.h + 40); run(0.2); const out = !WLD.hall; player.x = h.x + h.w / 2; player.y = h.y + 110; run(0.4); return [id, out, WLD.hall && WLD.hall.id, WLD.talk && WLD.talk.name, !!(WLD.talk && WLD.talk.act)]; }));
  ok('halls and keepers', halls.every(h => h[1] && h[2] === h[0] && h[3] && h[4]), JSON.stringify(halls));
  // no reputation, no post; 40 gives one, 120 gives two
  const posts = await page.evaluate(() => { const T = fresh(), X = farX(), r = []; takePost('mayor'); r.push(T.posts.length); X.rep = 40; takePost('mayor'); r.push(T.posts.length); takePost('dojo'); r.push(T.posts.length); X.rep = 120; takePost('dojo'); r.push(T.posts.length, T.offers.length, !!T.dojo.ask); return r; });
  ok('reputation opens posts', JSON.stringify(posts) === '[0,1,1,2,4,true]', JSON.stringify(posts));
  // a short hop through a gate is not a season; a proper journey is
  const season = await page.evaluate(() => { const T = townX(), s0 = T.season; enterLand(landById('mere')); run(2); leaveLand(); const s1 = T.season; away(); return [s0, s1, T.season, T.report.length > 0, T.unread]; });
  ok('seasons', season[1] === season[0] && season[2] === season[0] + 1 && season[3] && season[4], JSON.stringify(season));
  // the cards open and their buttons work
  const cards = await page.evaluate(() => {
    const T = townX(), g0 = T.gold; openTownHall(); const html = document.getElementById('farcard').innerText;
    const fund = T.offers.find(id => workById(id).kind !== 'private'), w = workById(fund); farCard.go('fund', fund);
    const priv = T.offers.find(id => workById(id).kind === 'private'); if (priv) farCard.go('refuse', priv);
    closeFarCard(); openDojo(); const d0 = { ...T.dojo }; farCard.go('train', 'code'); farCard.go('ask', '0'); const dh = document.getElementById('farcard').innerText; closeFarCard();
    return { council: html.includes('Before the council') && html.includes('The town chest'), paid: g0 - T.gold === w.cost, built: T.built.includes(fund), refused: !T.offers.includes(priv), code: T.dojo.code > d0.code, asked: T.dojo.ask === null, dojo: dh.includes('This season’s training'), noScore: !/score|points|\/100/i.test(html) };
  });
  ok('council and dojo cards', Object.values(cards).every(Boolean), JSON.stringify(cards));
  // two mayors: one builds only what pays and gives leave to every venture; one builds prayer and fine things first
  const tale = await page.evaluate(() => {
    const play = (wise, n) => {
      const T = fresh(); farX().rep = 200; takePost('mayor'); takePost('dojo');
      const log = [];
      for (let s = 0; s < n; s++) {
        for (const id of [...T.offers]) {
          const w = workById(id), S = townSums(T), fits = w.kind === 'private' || (T.gold >= w.cost && S.keep + w.keep <= townIncome(T, S));
          const want = wise ? (w.kind === 'spirit' || w.classic || (w.kind === 'need' && T.spirit >= 55) || (w.kind === 'private' && !w.need)) : (w.kind === 'need' || w.kind === 'private' || w.modern);
          if (fits && want) { if (w.cost) T.gold -= w.cost; T.built.push(id); }
        }
        const D = T.dojo;
        if (wise) { if (D.gold >= 40) { D.gold -= 40; D.code = Math.min(100, D.code + 18); } if (D.gold >= 40 && D.code > 70) { D.gold -= 40; D.fighters += 5; } }
        else { while (D.gold >= 60 && D.skill < 5) { D.gold -= 60; D.skill++; D.code -= 5; } while (D.gold >= 40) { D.gold -= 40; D.fighters += 5; D.code -= 4; } }
        T.away = 200; townSeason();
        log.push(...T.report.filter(r => /burnt|Thieves|deserted|brawl/.test(r)));
      }
      return { spirit: Math.round(T.spirit), cohesion: Math.round(T.cohesion), gold: Math.round(T.gold), built: T.built.length, rep: farX().rep - 200, fighters: T.dojo.fighters, code: Math.round(T.dojo.code), might: +crewMight('fighter').toFixed(2), meal: mealCost(), trouble: log.length, sample: log.slice(-2) };
    };
    return { greedy: play(false, 12), wise: play(true, 12) };
  });
  console.log('   greedy mayor:', JSON.stringify(tale.greedy));
  console.log('   wise mayor:  ', JSON.stringify(tale.wise));
  ok('a town without prayer falls apart', tale.greedy.spirit < 30 && tale.greedy.trouble >= 3 && tale.greedy.code < 40);
  ok('a town cared for thrives', tale.wise.spirit >= 60 && tale.wise.cohesion >= 60 && tale.wise.trouble === 0 && tale.wise.rep > 20 && tale.wise.code >= 60);
  console.log(errs.length ? errs : 'no errors');
  await browser.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
