// every spell, cast at a target that stands still: what it did, and a picture of it in the middle of doing it
const GAME = 'file://' + require('path').resolve(__dirname, '../../inkdojo.html');
const OUTDIR = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUTDIR, { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const OUT = OUTDIR + '/gal/';
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2], P = +(process.argv[3] || 1);
(async () => {
  const br = await chromium.launch(); const errs = [];
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(GAME); await p.waitForTimeout(300);
  const rows = [];
  for (const way of ['water', 'fire', 'earth', 'air']) {
    if (only && only !== way) continue;
    const foeId = { water: 'e3', fire: 'w3', earth: 'a3', air: 'f3' }[way];
    await p.evaluate(([w, id]) => { localStorage.clear(); INKDOJO.begin(w); INKDOJO.close(); const f = INKDOJO.foes.find(f => f.id === id); INKDOJO.teleport(715, 1065); f.x = 885; f.y = 1065; INKDOJO.startFight(f); }, [way, foeId]);
    for (let i = 0; i < 40 && !(await p.evaluate(() => INKDOJO.fight && INKDOJO.fight.on)); i++) await p.waitForTimeout(100);
    const shots = [];
    const CLOSE = ['jab', 'roundhouse', 'knee', 'fist', 'quake', 'meialua', 'flurry', 'sand', 'breath', 'vent', 'stance', 'gust', 'toss', 'pushhands', 'statue'];
    for (const m of await p.evaluate(w => INKDOJO.MOVES[w].map(m => ({ key: m.key, name: m.name, tag: m.tag })), way)) {
      m.close = CLOSE.includes(m.key);
      // a fresh start for both, the foe standing still 170 to the right
      await p.evaluate(gap => {
        const F = INKDOJO.fight, f = F.foe, me = INKDOJO.player;
        INKDOJO.resetFighter(f); INKDOJO.resetFighter(me); f.speed = 0;
        me.x = F.cx - gap / 2; me.y = F.cy; f.x = F.cx + gap / 2; f.y = F.cy; f.hp = f.maxHp; me.hp = me.maxHp * 0.6; me.ki = 100; f.ki = 100;
        f.ai.think = 1e9; f.ai.reacted = true; f.ai.reactT = 1e9; f.vx = f.vy = 0; f.kx = f.ky = 0; me.kx = me.ky = 0;
        if (me.way === 'fire') me.heat = 60; if (me.way === 'air') me.wind = 70;
      }, m.close ? 70 : 170);
      if (m.key === 'freeze' || m.key === 'ignite' || m.key === 'shatter' || m.key === 'downdraft' || m.key === 'whistle') await p.evaluate(k => {
        const F = INKDOJO.fight, f = F.foe;
        if (k === 'freeze') f.st.soak = 4; if (k === 'ignite') f.st.burn = 4; if (k === 'downdraft') { f.st.air = 1; f.st.airMax = 1; }
        if (k === 'shatter') { INKDOJO.castAs('me', 'earth:wall', 1); }
        if (k === 'whistle') { const mv = INKDOJO.MOVES[f.way].find(m => m.cost <= 20 && m.tag === 'Shot'); f.ki = 100; INKDOJO.castAs('foe', f.way + ':' + mv.key, 0.9); f.act.t = 1.5; }
      }, m.key);
      // set the scene for the spells that answer something
      const PRE = { shatter: ['me', 'earth:wall'], echo: ['me', 'air:blade'], tidal: ['foe', 'earth:wall'], knee: ['shield'] };
      const POST = { pushhands: 'Strike', statue: 'Shot', double: 'Shot', crosswind: 'Shot', mirror: 'Shot', airshield: 'Shot', bubble: 'Shot', flameshield: 'Strike' };
      if (PRE[m.key] && PRE[m.key][0] !== 'shield') { await p.evaluate(([who, id]) => INKDOJO.castAs(who, id, 1), PRE[m.key]); await p.waitForTimeout(500); }
      if (PRE[m.key] && PRE[m.key][0] === 'shield') await p.evaluate(() => { const f = INKDOJO.fight.foe; f.st.shield = 20; f.st.shieldT = 5; f.st.armor = 3; f.st.armorK = 0.5; f.st.armorKind = 'stone'; });
      if (m.key === 'shatter') await p.waitForTimeout(100);
      const before = await p.evaluate(() => ({ hp: INKDOJO.fight.foe.hp, me: INKDOJO.player.hp, ki: INKDOJO.player.ki }));
      const ok = await p.evaluate(([w, k, P]) => INKDOJO.castAs('me', w + ':' + k, P), [way, m.key, P]);
      if (POST[m.key]) { await p.waitForTimeout(120); await p.evaluate(tag => { const f = INKDOJO.fight.foe, mv = INKDOJO.MOVES[f.way].find(m => m.tag === tag); f.ki = 100; INKDOJO.castAs('foe', f.way + ':' + mv.key, 0.9); }, POST[m.key]); }
      const at = { ultimate: 900, Blast: 700, Launch: 520, Summon: 650, Roll: 450, Leap: 640, Area: 600 }[m.tag] || (m.key === 'flood' || m.key === 'mountain' || m.key === 'meteor' ? 900 : 260);
      await p.waitForTimeout(Math.min(at, 950));
      const file = OUT + `${way}_${String(rows.length % 20).padStart(2, '0')}_${m.key}.png`;
      await p.screenshot({ path: file, clip: { x: 0, y: 60, width: 390, height: 360 } });
      shots.push([m.name, file]);
      await p.waitForTimeout(1500);
      const after = await p.evaluate(() => { const f = INKDOJO.fight && INKDOJO.fight.foe, me = INKDOJO.player, S = f.st, M = me.st, on = o => Object.entries(o).filter(([k, v]) => typeof v === 'number' && v > 0 && !['airMax', 'armorK', 'veilK', 'regenRate', 'flash', 'shieldT'].includes(k)).map(([k]) => k).join(',');
        return { hp: f.hp, me: me.hp, foeSt: on(S), meSt: on(M), stones: INKDOJO.stones.length, zones: INKDOJO.zones.map(z => z.kind).join(','), ents: INKDOJO.ents.map(e => e.kind).join(','), fx: INKDOJO.fx.length, on: INKDOJO.fight.on }; });
      rows.push(`${way.padEnd(6)} ${m.key.padEnd(12)} ${ok ? 'cast' : 'FAIL'} foe -${Math.round(before.hp - after.hp).toString().padStart(3)}  me ${after.me - before.me >= 0 ? '+' : ''}${Math.round(after.me - before.me).toString().padStart(3)}  foe[${after.foeSt}] me[${after.meSt}] stones ${after.stones} zones[${after.zones}] ents[${after.ents}] fx ${after.fx}${after.on ? '' : ' (FIGHT OVER)'}`);
      if (!after.on) { // someone fell: start a fresh fight
        await p.evaluate(([w, id]) => { INKDOJO.close(); const f = INKDOJO.foes.find(f => f.id === id); f.beaten = false; f.mode = 'post'; INKDOJO.startFight(f); }, [way, foeId]);
        for (let i = 0; i < 60 && !(await p.evaluate(() => INKDOJO.fight && INKDOJO.fight.on)); i++) await p.waitForTimeout(100);
      }
    }
    // a contact sheet for the way
    const pg = await br.newPage({ viewport: { width: 1300, height: 100 } });
    await pg.setContent(`<body style="margin:0;background:#222;font:13px sans-serif;color:#eee;display:grid;grid-template-columns:repeat(5,260px);gap:2px">${shots.map(([n, f]) => `<div><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:260px;display:block"><div style="padding:2px 4px">${n}</div></div>`).join('')}</body>`);
    await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + `sheet_${way}.png`, fullPage: true }); await pg.close();
  }
  console.log(rows.join('\n'));
  console.log('errors', errs.slice(0, 12));
  await br.close();
})();
