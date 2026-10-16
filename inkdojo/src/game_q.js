// ── the story: Mum's errand, the townsfolk, the wolves on the road, the dojo's white belts, and the bandits ──
// Where the story has got to (save.q):
const Q = { START: 0, ROAD: 1, DOJO: 2, PACKAGE: 3, HOME: 4, LAST: 5, DONE: 6 };

// ── the wolves: they don't write, they bite and pounce ──
const beastMove = (key, name, tag, cost, what) => ({ key, role: key, name, tag, cost, what, how: '', strokes: [[{ x: 0, y: 0 }, { x: 0.1, y: 0 }]], pools: [[]], closed: [false], ink: 'any', way: 'beast', id: 'beast:' + key, order: 0, tier: 0 });
const WOLF_KIT = [beastMove('bite', 'Bite', 'Strike', 5, 'A snapping bite.'), beastMove('pounce', 'Pounce', 'Dash', 8, 'A leap at you, teeth first.')];
SPELL['beast:bite'] = c => { melee(c, { reach: 46, lunge: 46, dmg: 7, hit: { knock: 60 }, fx: (x, y) => { slash(x, y, c.a, '#f4efe4', 18); slash(x, y, c.a + 0.5, '#f4efe4', 14); } }); };
SPELL['beast:pounce'] = c => {
  const { f, a } = c, sp = 520;
  f.dash = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.32, hitOnce: { dmg: 6, power: c.pw, knock: 120, melee: true } };
  dust(f.x, f.y, 4, { sp: 60 });
};
AIH['beast:bite'] = { r: [0, 90], w: 3 };
AIH['beast:pounce'] = { r: [110, 330], w: 1.6 };
const WOLVES = [
  { id: 'wolf1', name: 'Grey wolf', post: [600, 1990], look: { fur: '#8d8a86', furDark: '#5e5b58' } },
  { id: 'wolf2', name: 'Lean wolf', post: [380, 1700], look: { fur: '#9a8f80', furDark: '#62584c' } },
  { id: 'wolf3', name: 'Old wolf', post: [610, 1150], look: { fur: '#6f6c6a', furDark: '#3f3d3b' } },
];
// ── the bandits: brown-belt fighters who wait for you on the road home, and come at you one after another ──
const BANDITS = [
  { id: 'b1', name: 'Crow', look: { gi: '#3a3530', mask: '#16131b', belt: '#8a5a2b' } },
  { id: 'b2', name: 'Tusk', look: { gi: '#4a3a2a', mask: '#16131b', belt: '#8a5a2b' } },
  { id: 'b3', name: 'Kagero', boss: true, look: { gi: '#2a1f24', mask: '#7a1f1a', belt: '#8a5a2b', trim: '#c63f2e' } },
];
// none of them follows the way that beats yours: first the way yours beats, then your own way, then the last one (the boss)
function banditWays() { const mine = save.way, easy = WAYS[mine].beats, hard = WAY_ORDER.find(w => WAYS[w].beats === mine); return [easy, mine, WAY_ORDER.find(w => w !== mine && w !== easy && w !== hard)]; }
// ── the people ──
const NPC_LIST = [
  { id: 'mum', name: 'Mum', scene: 'home', post: [445, 2282], look: { gi: '#b65c4a', trim: '#f0e2c0', belt: '#f0e2c0', hair: '#6a6058', skin: '#e8bd98', scarf: '#e0c070' } },
  { id: 'post', name: 'Postmaster Ono', scene: 'town', post: [378, 640], look: { gi: '#3b4f7a', trim: '#e9bb52', belt: '#e9bb52', hair: '#7a7064' } },
  { id: 'scribe', name: 'Old Hana', scene: 'town', post: [930, 640], look: { gi: '#efe6d0', trim: '#19141f', belt: '#19141f', hair: '#d8d2c8', skin: '#e0ac85' } },
  { id: 'baker', name: 'Kiko the baker', scene: 'town', post: [470, 820], look: { gi: '#f4efe4', trim: '#d9935a', belt: '#d9935a', scarf: '#f4efe4' } },
  { id: 'farmer', name: 'Farmer Daisuke', scene: 'town', post: [835, 820], look: { gi: '#6f8a4a', trim: '#4a3a2a', belt: '#4a3a2a' } },
  { id: 'kid', name: 'Little Yuki', scene: 'town', post: [700, 470], wander: 90, look: { gi: '#ff9ab8', trim: '#c63f2e', belt: '#c63f2e' } },
  { id: 'granny', name: 'Granny Fuji', scene: 'town', post: [345, 1040], look: { gi: '#5a3d4f', trim: '#d8d2c8', belt: '#d8d2c8', hair: '#e8e2d8', scarf: '#8a6a8a' } },
  { id: 'guard', name: 'Botan, the gate guard', scene: 'town', post: [760, 1090], look: { gi: '#5e5446', trim: '#c9a35c', belt: '#16131b' } },
  { id: 'sensei', name: 'Master Ishida', scene: 'dojo', post: [DAIS.x, DAIS.y], look: { gi: '#2b2531', trim: '#c63f2e', belt: '#16131b', hair: '#e8e2d8' } },
];
let NPCS = [];
function makeNpc(o) { const n = makeFighter({ ...o, way: 'none', rank: 0 }); n.isNpc = true; n.scene = o.scene; n.wander = o.wander || 0; n.home = { x: n.x, y: n.y }; n.face = Math.PI / 2; return n; }
const npcsHere = () => NPCS.filter(n => n.scene === SCENE);
const npc = id => NPCS.find(n => n.id === id);

// what someone says to you: a talk (once, the first time you walk up to them at this point in the story), then a
// line in a bubble whenever you pass
function npcTalk(n) {
  const q = save.q, w = whitesBeaten(), W = WAYS[save.way];
  switch (n.id) {
    case 'mum':
      if (q === Q.START) return { key: 'mum0', pages: [
        ['Mum', 'Morning, love. A letter came from your grandfather’s lawyer. There’s a package waiting for us at the post office in town.'],
        ['Mum', 'Will you walk in and fetch it for me? Just follow the road north.'],
        ['Mum', `Be careful, though. Wolves have been seen on the road. If they come at you, fight the way your grandfather taught you: the Way of ${W.name}.`],
        ['Mum', 'Write your moves on the paper. And write them neatly: the cleaner the stroke, the harder it hits. A perfect one hits twice as hard as a scrappy one.'],
      ], after: () => { save.q = Q.ROAD; say('Go into town', 'Follow the road north to the town gate. Open MOVES to see how to write your first three moves.', 5, C.gold); } };
      if (q === Q.LAST) return { key: 'mum5', pages: [
        ['Mum', 'You’re back! And you’ve got it. Come on, let’s open it.'],
        ['', 'Inside, wrapped in old silk, is a golden statue: a crane with its wings spread, heavy as a stone.'],
        ['Mum', 'Your grandfather’s golden crane. He always said it would come to you one day.'],
        ['Mum', 'There’s a letter with it. A buyer in the far city of Kyōsei wants the crane, and will pay enough to change our lives.'],
        ['Mum', 'Those bandits won’t be the last to come after it. If we’re taking it all the way to the city, you’ll need every move you can learn.'],
      ], after: () => { save.q = Q.DONE; save.stats.t1 = Date.now(); player.carry = false; writeSave(); overlay = { kind: 'end', t: 0 }; SFX.learn(); } };
      return null;
    case 'post':
      if (q <= Q.DOJO && w < 4) return { key: 'post1', pages: [
        ['Postmaster Ono', 'A package for your family? Yes, from your grandfather. It came in last week.'],
        ['Postmaster Ono', 'But I can’t just hand it over. Bandits have been robbing people on the valley road, and this one is worth a lot.'],
        ['Postmaster Ono', 'Show me you can look after it. Beat the four white belts at the dojo, up the street, and I’ll know you can carry it home.'],
      ], after: () => { save.q = Q.DOJO; say('Beat the white belts', 'The dojo is at the top of the street. Each white belt you beat teaches you a move.', 4.5, C.gold); } };
      if (q <= Q.PACKAGE) return { key: 'post3', pages: [
        ['Postmaster Ono', 'All four white belts? Word gets round fast in this town!'],
        ['Postmaster Ono', 'Here’s your package. It’s heavier than it looks. Keep it close, and go straight home.'],
      ], after: () => { save.q = Q.HOME; player.carry = true; say('Take it home to Mum', 'Back out of the town gate and down the valley road.', 4.5, C.gold); } };
      return null;
    case 'scribe':
      if (q >= Q.ROAD && !save.scribe) return { key: 'scribe', pages: [
        ['Old Hana', 'You hold a brush like your grandfather did. He sat in that very chair to practise.'],
        ['Old Hana', 'He had a trick: end an attack with a little curl, a tiny loop at the very end of the stroke. Then the move doesn’t fly. You hold it.'],
        ['Old Hana', 'Its red seal waits by your paper, and you let it go with a tap when the moment is right. Write a shield, then throw what you were holding.'],
        ['Old Hana', 'And here is a move of your way to go with it.'],
      ], after: () => { const before = learnedCount(); save.scribe = true; overlay = lesson({ name: 'Old Hana' }, before, learnedCount(), { teach: true }); SFX.learn(); } };
      return null;
    case 'baker': return { key: 'baker', pages: [['Kiko the baker', 'Fresh buns! Well, they were fresh this morning. Off to the dojo? The white belts eat here every day. Hungry lot.']] };
    case 'farmer': return { key: 'farmer', pages: [['Farmer Daisuke', 'Lost two sheep to wolves this spring. If you came up the valley road, you’ll have met them.']] };
    case 'kid': return { key: 'kid', pages: [['Little Yuki', 'Are you going to fight at the dojo? The white belts are easy. Well, easier than the brown belts. The brown belts are scary.']] };
    case 'granny': return { key: 'granny', pages: [['Granny Fuji', 'Your grandfather? Best brush in the valley. They say he once saw off ten bandits writing with his left hand.']] };
    case 'guard': return { key: 'guard', pages: [['Botan, the gate guard', 'Bandits on the valley road again. Three of them, I hear. Their boss, Kagero, writes like a brown belt. Mind how you go.']] };
    case 'sensei':
      if (w < 4) return { key: 'sensei', pages: [
        ['Master Ishida', 'So you’re the grandchild. Welcome to my dojo. Your grandfather trained on these mats.'],
        ['Master Ishida', 'My white belts will spar with you; walk up to one and they’ll bow. Each one you beat will show you a move. The brown and black belts are not for you yet.'],
      ] };
      return { key: 'sensei4', pages: [['Master Ishida', 'All four white belts. Well fought. Come back when you’re ready for the brown belts.']] };
  }
  return null;
}
function npcIdle(n) {
  const q = save.q, w = whitesBeaten();
  switch (n.id) {
    case 'mum': return q >= Q.HOME ? 'Is that it? Bring it here!' : 'The road north takes you to town.';
    case 'post': return q >= Q.HOME ? 'Straight home, now.' : q === Q.DOJO ? `White belts beaten: ${w} of 4.` : 'Post office!';
    case 'scribe': return 'End an attack with a little curl to hold it.';
    case 'baker': return 'Buns! Two for one!';
    case 'farmer': return 'Mind the wolves.';
    case 'kid': return 'Show me a move!';
    case 'granny': return 'Best brush in the valley, he was.';
    case 'guard': return q >= Q.HOME ? 'Watch the road. Bandits.' : 'Morning.';
    case 'sensei': return `White belts: ${w} of 4.`;
  }
  return '';
}

// ── who fights you, and how good they are ──
const banditsLeft = () => FOES.filter(f => f.bandit && !f.beaten);
function mayChallenge(f) {
  if (f.beast) return save.q >= Q.ROAD && save.q < Q.HOME;
  if (f.bandit) return !!save.ambush && f === banditsLeft()[0];
  return f.rank === 1 && save.q >= Q.ROAD && save.q < Q.DONE;
}
function waveOff(f) { return f.beast || f.bandit ? '' : f.rank > 1 ? 'Not you. Not yet.' : save.q < Q.ROAD ? '' : ''; }
function skillFor(f) {
  if (f.beast) { const s = skillAt(0); return { ...s, hp: s.hp * 0.8, fizzle: 0, aim: 0.2, spells: 2 }; }
  if (f.bandit) return skillAt([4.5, 5.2, 6][BANDITS.findIndex(b => b.id === f.id)]);
  return skillAt(1 + whitesBeaten());
}
function challengeLine(f) {
  if (f.beast) return 'A wolf on the road';
  if (f.bandit) return f.boss ? 'The bandits’ boss · fights like a brown belt' : 'A bandit · fights like a brown belt';
  return `${HALLS[f.way].label} · ${RANKS[f.rank].beltName}`;
}
// you've won: what happens next
function wonAgainst(foe) {
  if (foe.beast) {
    if (!save.wolves.includes(foe.id)) save.wolves.push(foe.id);
    foe.mode = 'flee'; writeSave();
    say(`The ${foe.name.toLowerCase()} runs off`, save.wolves.length >= WOLVES.length ? 'That’s the last of the wolves.' : '', 2.4, C.gold);
    player.hp = player.maxHp; player.ki = player.maxKi; player.pose = 'idle';
    return;
  }
  if (foe.bandit) {
    foe.mode = 'flee';
    const next = banditsLeft()[0];
    if (next) {
      // a breather, then the next one steps up
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.5); player.ki = player.maxKi; player.pose = 'idle';
      calm = 1.6; say(`${foe.name} runs for the trees`, `${next.name} steps up${next.boss ? ': the boss' : ''}. You catch your breath.`, 2.6, fcol(next));
    } else {
      save.q = Q.LAST; save.ambush = false; writeSave();
      player.hp = player.maxHp; player.ki = player.maxKi; player.pose = 'idle';
      say('The bandits flee!', 'The road is clear. Take the package home to Mum.', 4.5, C.gold); SFX.learn();
    }
    return;
  }
  // a white belt bows and shows you a move
  const before = learnedCount();
  if (!save.beaten.includes(foe.id)) save.beaten.push(foe.id);
  foe.mode = 'return';
  const done = whitesBeaten() >= 4 && save.q === Q.DOJO;
  if (done) save.q = Q.PACKAGE;
  writeSave();
  overlay = lesson(foe, before, learnedCount(), { allWhite: whitesBeaten() >= 4 });
  SFX.learn();
}
// you've fallen: where you wake
function fellTo(foe) {
  if (foe && foe.bandit) { resetBandits(); enterScene('home', 'north'); say('You wake at the top of the road', 'The package is still with you. The bandits will be waiting.', 4, C.muted); }
  else if (foe && foe.beast) enterScene('home', 'door');
  else enterScene(SCENE, Object.keys(SCENES[SCENE].spots)[0]);
}
function resetBandits() {
  save.ambush = false;
  for (const f of FOES.filter(f => f.bandit)) { f.beaten = false; f.hidden = true; f.mode = 'post'; resetFighter(f); }
}
// on the road home with the package: the bandits step out of the trees
function checkAmbush() {
  if (save.q !== Q.HOME || save.ambush || SCENE !== 'home' || FIGHT || overlay || player.y < 520) return;
  save.ambush = true;
  const B = FOES.filter(f => f.bandit), spots = [[-110, 230], [130, 260], [0, 330]];
  B.forEach((f, i) => {
    const x = clamp(player.x + spots[i][0], 80, WORLD.w - 80), y = clamp(player.y + spots[i][1], 80, WORLD.h - 80);
    f.x = x; f.y = y; f.post = { x, y }; f.hidden = false; f.beaten = false; f.mode = 'post'; f.face = angTo(f, player);
    smoke(x, y, 6, { size: 14 });
  });
  overlay = { kind: 'talk', t: 0, i: 0, pages: [
    ['Kagero', 'Well, well. That’s a heavy little box for a child to be carrying.'],
    ['Kagero', 'Put it down on the road and walk away, and nobody gets hurt.'],
    ['', 'You plant your feet and lift your brush.'],
    ['Kagero', 'Have it your way. Crow! Teach this one a lesson. Then Tusk. Then me.'],
  ], after: () => { calm = 0.4; } };
  SFX.drum(2);
}

// ── what to do next, and where ──
function goal() {
  const q = save.q, w = whitesBeaten(), ex = id => SCENES[SCENE].exits.find(e => e.id === id), N = id => npc(id);
  const toTown = SCENE === 'home' ? ex('town') : SCENE === 'dojo' ? ex('town') : null;
  if (q === Q.START) return { text: 'Talk to Mum', at: SCENE === 'home' ? N('mum') : null };
  if (q === Q.ROAD) return { text: 'Walk into town and find the post office', at: SCENE === 'town' ? N('post') : toTown };
  if (q === Q.DOJO || q === Q.PACKAGE && w < 4) {
    const next = SCENE === 'dojo' ? fighters().filter(f => f.rank === 1 && !f.beaten).sort((a, b) => dist(a, player) - dist(b, player))[0] : null;
    return { text: `Beat the white belts at the dojo · ${w} of 4`, at: SCENE === 'town' ? ex('dojo') : SCENE === 'home' ? ex('town') : next };
  }
  if (q === Q.PACKAGE) return { text: 'Collect the package from the post office', at: SCENE === 'town' ? N('post') : toTown };
  if (q === Q.HOME) return { text: save.ambush ? 'Fight off the bandits' : 'Take the package home to Mum', at: SCENE === 'home' ? (save.ambush ? banditsLeft()[0] : N('mum')) : SCENE === 'town' ? ex('valley') : ex('town') };
  if (q === Q.LAST) return { text: 'Take the package home to Mum', at: SCENE === 'home' ? N('mum') : SCENE === 'town' ? ex('valley') : ex('town') };
  return { text: 'The end of chapter one', at: null };
}

// ── every frame, outside a fight: the people, the ways out, the ambush ──
function storyTick(dt) {
  for (const n of npcsHere()) {
    const d = dist(n, player);
    if (n.wander && d > 120) {
      n.wt = (n.wt || 0) - dt;
      if (n.wt <= 0) { n.wt = rr(1.5, 3.5); const a = rr(0, TAU), r = rr(0, n.wander); n.goal = { x: n.home.x + Math.cos(a) * r, y: n.home.y + Math.sin(a) * r }; }
      if (n.goal && dist(n, n.goal) > 6) { const a = angTo(n, n.goal); n.x += Math.cos(a) * 55 * dt; n.y += Math.sin(a) * 55 * dt; n.face = a; n.walk += dt * 9; blocked(n, n.r); } else n.walk *= 0.8;
    }
    if (d < 150) n.face = angTo(n, player);
    // you can't walk through people
    const m = n.r + player.r; if (d < m && d > 0) { player.x = n.x + (player.x - n.x) / d * m; player.y = n.y + (player.y - n.y) / d * m; }
    n.poseT += dt * 3.2;
    if (FIGHT || overlay || writing() || fighters().some(f => f.mode === 'approach') || d > 78) continue;
    const talk = npcTalk(n);
    if (talk && !save.heard[talk.key]) { overlay = { kind: 'talk', t: 0, i: 0, pages: talk.pages, key: talk.key, after: talk.after }; n.pose = 'bow'; n.poseT = 0; return; }
  }
  if (FIGHT || overlay) return;
  checkAmbush();
  // leaving for the next place
  const e = !writing() && !fighters().some(f => f.mode === 'approach') ? exitAt(player) : null;
  if (e) { enterScene(e.to, e.at); updateCam(0, true); calm = Math.max(calm, 1.2); say(SCENES[e.to].name, '', 1.6, C.paper); }
}
function talkNext() {
  const O = overlay;
  if (!O || O.kind !== 'talk' || O.t < 0.25) return;
  O.i++; O.t = 0;
  if (O.i < O.pages.length) return;
  overlay = null;
  if (O.key) save.heard[O.key] = true;
  if (O.after) O.after();
  writeSave();
}
// someone's line over their head, as you pass
function drawBubbles() {
  if (FIGHT) return;
  for (const n of npcsHere()) {
    const d = dist(n, player);
    if (d > 140) continue;
    const text = npcIdle(n); if (!text) continue;
    ctx.font = `12px ${BODY}`; const w = Math.min(190, ctx.measureText(text).width + 16), lines = wrapLines(text, w - 12), h = 8 + lines.length * 15, x = n.x, y = n.y - 44 - h;
    ctx.globalAlpha = clamp((140 - d) / 40, 0, 1);
    roundRect(x - w / 2, y, w, h, 8); ctx.fillStyle = 'rgba(239,230,208,0.95)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y + h); ctx.lineTo(x, y + h + 8); ctx.lineTo(x + 6, y + h); ctx.fill();
    ctx.fillStyle = '#2e2216'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, x, y + 16 + i * 15));
    ctx.globalAlpha = 1;
  }
}
