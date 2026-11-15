// Every mission can be taken, done and paid: the player is moved from step to step and the game is left to notice.
// Also: food runs down and you faint at the gate; hired hands fight; the coach runs; a save made in a far town loads there.
const { openWorld } = require('./lib');
(async () => {
  const { browser, page, errs } = await openWorld();
  let bad = 0;
  const ok = (name, v, extra = '') => { if (!v) bad++; console.log(v ? '  ok ' : 'FAIL ', name, extra); };
  await page.evaluate(() => {
    window.run = (s, f) => { for (let i = 0; i < s * 20; i++) { tick(0.05); if (state === 'shop') closeFarCard(); if (state !== 'play') { state = 'play'; } player.hp = player.maxHp; farX().food = 50; if (f && f()) return true; } return !f; };
    window.put = (x, y) => { const p = freeSpot(x, y, 16); player.x = p.x; player.y = p.y; player.onBoat = false; };
    window.toLand = id => { if ((LANDNOW ? LANDNOW.id : 'home') === id) return; if (LANDNOW) leaveLand(); if (id !== 'home') enterLand(landById(id)); };
    window.person = (id, pred) => { toLand(id); return farFolk().find(pred); };
    window.tap = () => { if (WLD.talk && WLD.talk.act) { WLD.talk.act(); return true; } return false; };
  });
  const ids = await page.evaluate(() => MISSIONS.map(M => M.id));
  for (const id of ids) {
    const r = await page.evaluate(id => {
      const M = missionById(id), X = farX(), t0 = ADV.world.tokens, r0 = X.rep, log = [];
      // ask the giver
      const g = person(M.at, p => p.role === 'giver' && p.m === M);
      if (!g) return { id, log: ['no giver'] };
      put(g.x + 30, g.y + 30); run(0.3);
      if (!WLD.talk || WLD.talk.name !== M.who) log.push('giver does not speak: ' + (WLD.talk && WLD.talk.name));
      tap(); if (!farCard) log.push('no card'); else farCard.go('take');
      if (!mOn(M)) return { id, log: [...log, 'not taken'] };
      toLand(M.land);
      const L = LANDNOW;
      if (M.kind === 'letter') { const p = farFolk().find(p => p.role === 'to' && p.m === M); put(p.x + 30, p.y + 30); run(0.3); if (!tap()) log.push('recipient has nothing to tap'); }
      else if (M.kind === 'advert') { put(L.base.x + 50, L.base.y + 50); run(5); }
      else {
        if (M.kind === 'fetch') { const s = siteOf(L.id, M.site); player.x = s.x; player.y = s.y + 70; run(0.5); if (!mState(M).got) log.push('item not picked up'); }
        if (M.kind === 'find') { const s = siteOf(L.id, M.site); player.x = s.x + 46; player.y = s.y + 110; run(0.5); if (!mState(M).got) log.push('not found'); put(L.base.x + 60, L.base.y + 60); run(1); if (!mState(M).safe) log.push('not made safe'); }
        if (M.kind === 'explore') for (const sid of M.sites) { const s = siteOf(L.id, sid); player.x = s.x; player.y = s.y + 60; run(0.4); }
        if (M.kind === 'hunt') { const s = siteOf(L.id, M.site); player.x = s.x; player.y = s.y + 300; run(1); const c = foes.find(f => f.chief === M.chief && !f.dead); if (!c) log.push('no chief'); else { run(4); damageFoe(c, 99999, 'prism'); run(0.3); } }
        if (M.kind === 'count') for (let i = 0; i < M.n; i++) { const f = makeBeast(M.beast, player.x + 200, player.y); foes.push(f); damageFoe(f, 9999, 'prism'); }
        if (!mReady(M)) log.push('not ready: ' + JSON.stringify(mState(M)));
        const g2 = person(M.at, p => p.role === 'giver' && p.m === M);
        put(g2.x + 30, g2.y + 30); run(0.3); if (!tap()) log.push('giver has nothing to tap');
      }
      if (farCard) closeFarCard();
      run(0.2);
      return { id, kind: M.kind, done: mDone(M), paid: ADV.world.tokens - t0, rep: X.rep - r0, want: [M.pay, M.rep], log };
    }, id);
    const good = r.done && r.paid >= r.want[0] && r.rep >= r.want[1] && !r.log.length;
    ok(`${r.id} ${r.kind || ''}`.padEnd(12), good, good ? '' : JSON.stringify(r));
  }
  const tally = await page.evaluate(() => [MISSIONS.filter(mDone).length, MISSIONS.length, farX().rep, Object.keys(farX().been).length]);
  console.log('missions done', tally[0], 'of', tally[1], '· reputation', tally[2], '· lands entered', tally[3]);
  // hunger: the food runs down out in the wilds, and with none you faint and wake at the gate, your hired hands gone
  const hunger = await page.evaluate(() => {
    toLand('home'); const X = farX(); ADV.world.tokens = 1000; X.crew = []; crewLoad();
    const hired = crewHire('fighter') && crewHire('medic');
    toLand('mere'); const L = LANDNOW; X.food = 10;
    const s = L.sites[1]; put((L.base.x + s.x) / 2, (L.base.y + s.y) / 2);
    let t = 0; const f0 = X.food;
    for (let i = 0; i < 20 * 20; i++) { tick(0.05); if (state !== 'play') state = 'play'; player.hp = player.maxHp; t += 0.05; }
    const eaten = f0 - X.food;
    X.food = 0; let fainted = false;
    for (let i = 0; i < 40 * 20 && !fainted; i++) { tick(0.05); if (state !== 'play') state = 'play'; player.hp = player.maxHp; fainted = !LANDNOW; }
    return { hired, crewInLand: 2, eaten: +eaten.toFixed(2), expect: +(20 * 3 / 30).toFixed(2), fainted, crewAfter: crew.length, at: [Math.round(player.x), Math.round(player.y)], gate: [L.gate.in.x, L.gate.in.y] };
  });
  ok('hunger', hunger.hired && Math.abs(hunger.eaten - hunger.expect) < 0.2 && hunger.fainted && hunger.crewAfter === 0 && hunger.at[0] === hunger.gate[0], JSON.stringify(hunger));
  // hired hands fight; a fighter brings a beast down on its own
  const fight = await page.evaluate(() => {
    const X = farX(); ADV.world.tokens = 1000; X.food = 60; crewHire('fighter'); crewHire('fighter'); crewHire('medic');
    toLand('wood'); const L = LANDNOW, s = L.sites[0]; put((L.base.x + s.x) / 2, (L.base.y + s.y) / 2);
    const f = makeBeast('leaper', player.x + 120, player.y, { tier: 1 }); foes.push(f);
    let t = 0; for (; t < 30 && !f.dead; t += 0.05) { tick(0.05); if (state !== 'play') state = 'play'; player.hp = player.maxHp; }
    return { dead: f.dead, secs: +t.toFixed(1), crew: crew.length };
  });
  ok('hired hands fight', fight.dead && fight.crew >= 2, JSON.stringify(fight));
  // the coach, and a save made in a far town loads there
  const coach = await page.evaluate(() => {
    toLand('home'); put(HOME_COACH.x, HOME_COACH.y + 40); run(0.3);
    const spoke = WLD.talk && WLD.talk.name; tap(); const had = !!farCard; if (farCard) farCard.go('go', 'coast');
    run(1);
    const there = LANDNOW && LANDNOW.id, c = ADV.check && ADV.check.land;
    advSave(); startGame(false);
    return { spoke, had, there, check: c, afterLoad: LANDNOW && LANDNOW.id, crew: crew.length, near: Math.round(Math.hypot(player.x - LANDNOW.base.x, player.y - LANDNOW.base.y)) };
  });
  ok('coach and resume', coach.had && coach.there === 'coast' && coach.afterLoad === 'coast' && coach.near < 400, JSON.stringify(coach));
  // falling in a far land wakes you in its town; then home through the arch and into a battle with the ground put right
  const fell = await page.evaluate(() => {
    const L = LANDNOW, s = L.sites[2]; put(s.x, s.y + 80); player.hp = 0.01; player.invuln = 0; player.ward = 0; hurtPlayer(5); const dead = state === 'dead'; respawn();
    const back = LANDNOW === L && Math.hypot(player.x - L.base.x, player.y - L.base.y) < 400;
    startBattle('easy'); for (let i = 0; i < 100; i++) tick(0.05);
    const battle = [mode, LANDNOW, GX, walls.length > 40];
    startGame(false); for (let i = 0; i < 40; i++) tick(0.05);
    return { dead, back, battle, again: LANDNOW && LANDNOW.id };
  });
  ok('fall, battle, back', fell.dead && fell.back && fell.battle[1] === null && fell.battle[2] === 0 && fell.battle[3] && fell.again === 'coast', JSON.stringify(fell));
  console.log(errs.length ? errs : 'no errors');
  await browser.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
