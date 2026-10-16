// ── Ink Dojo: the four ways, their twenty moves each, and the reader that judges a written glyph ──
const INK = (() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// shapes, in pad units: the pad is a circle of radius 1, x to the right, y down (0° points right, 90° down, 270° up)
const arc = (cx, cy, r, a0, a1, n = 64) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });
const spiral = (cx, cy, r0, r1, a0, turns, n = 140) => Array.from({ length: n + 1 }, (_, i) => { const k = i / n, a = (a0 + 360 * turns * k) * Math.PI / 180, r = r0 + (r1 - r0) * k; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });
const poly = (...v) => { const o = []; for (let i = 0; i < v.length; i += 2) o.push({ x: v[i], y: v[i + 1] }); return o; };
const quad = (x0, y0, x1, y1, x2, y2, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return { x: u * u * x0 + 2 * u * t * x1 + t * t * x2, y: u * u * y0 + 2 * u * t * y1 + t * t * y2 }; });
const hwave = (x0, x1, yc, amp, cycles, n = 90) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n; return { x: x0 + (x1 - x0) * u, y: yc - amp * Math.sin(TAU * cycles * u) }; });
const vwave = (y0, y1, xc, amp, cycles, n = 90) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n; return { x: xc + amp * Math.sin(TAU * cycles * u), y: y0 + (y1 - y0) * u }; });
const curve = (f, n = 120) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const join = (...parts) => parts.flatMap((p, i) => (i ? p.slice(1) : p));
const star = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => { const a = (-90 + i * 144) * Math.PI / 180; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });

// more shapes
const ellipse = (cx, cy, rx, ry, a0 = -90, a1 = 270, n = 72) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; });
const ngon = (cx, cy, r, k, a0 = -90) => Array.from({ length: k + 1 }, (_, i) => { const a = (a0 + i * 360 / k) * Math.PI / 180; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });
const sawRing = (cx, cy, r1, r2, k) => Array.from({ length: 2 * k + 1 }, (_, i) => { const a = (-90 + i * 180 / k) * Math.PI / 180, r = i % 2 ? r2 : r1; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });

// the four ways: what each is good at, what it lacks, and its twist
const WAYS = {
  water: { name: 'Water', animal: 'Snake', style: 'Tai Chi', color: '#4ab4ff', beats: 'fire',
    blurb: 'Heals best and controls the fight from range, and puts fire out, but its hits are light and earth drinks it up.', twist: 'Soak and freeze',
    twistWhat: 'Water soaks them and slows them; ice freezes a soaked foe solid. Puddles you leave on the floor make your water spells stronger, and fill your ki faster, while you stand in them. A soaked fire fighter’s flames come out damp.',
    ink: 'Light, unbroken ink.' },
  fire: { name: 'Fire', animal: 'Leopard', style: 'Muay Thai', color: '#ff6a3a', beats: 'air',
    blurb: 'Hits hardest and its burns keep hurting, but it defends poorly, barely heals, and water damps it.', twist: 'Heat',
    twistWhat: 'Every fire spell heats you up. Hot fire hits harder, but past the red line you start to burn yourself. Vent lets it all out in one blast. Running hot brings your ki back faster; being soaked damps your fire and slows the heat.',
    ink: 'A pooled start, then quick and thin.' },
  earth: { name: 'Earth', animal: 'Tiger', style: 'Hung Gar', color: '#c9a35c', beats: 'water',
    blurb: 'The toughest, and its stones block shots, but it is slow on its feet and slow to cast.', twist: 'Stones',
    twistWhat: 'Some spells raise rocks and walls that stay on the floor and block the way. Others throw them, roll them, or shatter them into shards. Standing your ground brings your ki back faster, and stone can’t burn.',
    ink: 'Heavy, slow, pressed ink.' },
  air: { name: 'Air', animal: 'Crane', style: 'Capoeira', color: '#f1dc6a', beats: 'earth',
    blurb: 'The fastest, and it throws foes about, but it has the least health and its single hits are small.', twist: 'Wind',
    twistWhat: 'Moving builds wind. Your air spells hit harder the more wind you carry, and standing still lets it die away. Keep moving and your ki comes back faster too.',
    ink: 'Light, fast ink.' },
};
const WAY_ORDER = ['water', 'fire', 'earth', 'air'];

// each spell: its key, name, a one-word kind, its ki cost, what it does, how to write it, its stroke (every move is one stroke,
// read the moment the brush lifts), whether it's a closed loop, where the ink must pool (0 the start, 1 the end), and the ink
// it wants (light, steady, heavy or any).
// In each way's list, the order is the order they're learned and how hard they are to write: three basic moves (one plain
// stroke each) that you know from the start, nine skilled ones (a turn or a loop more), then eight master moves (long strokes
// that take a second or two to write, and hit hardest).
const S = (key, name, tag, cost, what, how, strokes, o = {}) => ({ key, role: key, name, tag, cost, what, how, strokes: Array.isArray(strokes[0]) ? strokes : [strokes], closed: o.closed || null, pools: o.pools || null, ink: o.ink || 'any', loose: !!o.loose });
const TIERS = ['Basic', 'Skilled', 'Master'];
const heart = (cx, cy, s) => curve(u => { const t = Math.PI + u * TAU; return { x: cx + s * 16 * Math.sin(t) ** 3, y: cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) }; }, 160);
const MOVES = {
  water: [
    // basic
    S('bullet', 'Water Bullet', 'Shot', 8, 'A fast bullet of water that soaks them.', 'A deep cup: down, round the bottom and up.',
      arc(0, -0.15, 0.5, 180, 0), { ink: 'light' }),
    S('lash', 'Water Lash', 'Strike', 6, 'A whip of water lashes out to mid range and soaks them.', 'A J: straight down, hooking round to the left at the bottom.',
      join(poly(0.22, -0.7, 0.22, 0.2), arc(-0.08, 0.2, 0.3, 0, 180)), { ink: 'light' }),
    S('bubble', 'Bubble Shield', 'Absorb', 12, 'A bubble of water round you takes the next hits for you. When it bursts, it splashes and soaks them.', 'A circle.',
      arc(0, 0, 0.62, -90, 270), { closed: [true], ink: 'light', loose: true }),
    // skilled
    S('puddle', 'Puddle', 'Pool', 8, 'Splash a puddle under them: it soaks and slows whoever stands in it. Your water spells are stronger while you stand in one.', 'A wide flat oval low on the pad.',
      ellipse(0, 0.42, 0.62, 0.2), { closed: [true], ink: 'light' }),
    S('glide', 'Stream Glide', 'Glide', 8, 'Ride a stream across the floor, fast, leaving a trail of water behind you.', 'A long ripple across the middle: two waves.',
      hwave(-0.78, 0.78, 0, 0.21, 2), { ink: 'light' }),
    S('shards', 'Ice Shards', 'Chill', 12, 'Three shards of ice that chill them and slow them down, for longer if they are soaked.', 'Three spikes from one point low in the middle: up to the left and back, straight up and back, up to the right.',
      poly(0, 0.55, -0.5, -0.35, 0, 0.55, 0, -0.65, 0, 0.55, 0.5, -0.35), { ink: 'light' }),
    S('geyser', 'Geyser', 'Burst', 14, 'A jet of water bursts up under them: it hits, drenches them for a long time and slows them. Twice as strong if they stand in a puddle.', 'Straight up the middle, then round a circle at the top, like a jet of water bursting.',
      join(poly(0, 0.75, 0, -0.05), arc(0, -0.35, 0.3, 90, 450)), { ink: 'light' }),
    S('undertow', 'Undertow', 'Yank', 12, 'A current drags them to you, soaked and slowed.', 'From the top right, hook round and in to the centre. Pool the ink at the end.',
      spiral(0, 0, 0.72, 0.1, -45, 0.85), { pools: [[1]], ink: 'steady' }),
    S('mirror', 'Reflecting Pool', 'Reflect', 10, 'A mirror of water at your feet sends the next shot back at whoever threw it.', 'A bowl: straight across, then round underneath back to the start.',
      join(poly(-0.6, -0.12, 0.6, -0.12), arc(0, -0.12, 0.6, 0, 180)), { closed: [true], ink: 'light' }),
    S('draw', 'Draw from the Pond', 'Ki', 0, 'Draw ki from the water round you. Far more if you stand in a puddle.', 'A raindrop: from its point at the top, round the bottom and back up to the point.',
      curve(u => { const t = u * TAU; return { x: 0.42 * Math.sin(t) * Math.sin(t / 2), y: 0.05 - 0.55 * Math.cos(t) }; }), { closed: [true], ink: 'light' }),
    S('pushhands', 'Push Hands', 'Counter', 10, 'Stand ready for a moment: if they strike you up close, you catch the blow and throw them, soaked.', 'A long level line across the middle with one loop in it, like a hand turning a blow aside.',
      join(poly(-0.8, 0.1, 0, 0.1), arc(0, -0.12, 0.22, 90, -270), poly(0, 0.1, 0.8, 0.1)), { ink: 'light' }),
    S('double', 'Water Double', 'Decoy', 12, 'A double of you, made of water, stays behind while you slip aside. Their spells go at it, and it bursts into a puddle.', 'Two round cups side by side, like a w.',
      join(arc(-0.32, -0.1, 0.32, 180, 0), arc(0.32, -0.1, 0.32, 180, 0)), { ink: 'light' }),
    // master
    S('mist', 'Mist Veil', 'Conceal', 12, 'A mist wraps round you: most of their shots miss, and they lose track of you.', 'A sideways figure of eight across the middle.',
      curve(u => { const t = u * TAU; return { x: 0.68 * Math.sin(t), y: 0.28 * Math.sin(2 * t) }; }), { closed: [true], ink: 'light' }),
    S('rain', 'Healing Rain', 'Heal', 18, 'A little cloud rains on you and mends you, more if you stand in water. It puts out burns.', 'A cloud: along the flat bottom, then three bumps back over the top.',
      join(poly(-0.514, 0.2, 0.514, 0.2), arc(0.38, 0, 0.24, 56, -120), arc(0, -0.14, 0.3, -20, -160), arc(-0.38, 0, 0.24, -60, 124)), { closed: [true], ink: 'light' }),
    S('whirlpool', 'Whirlpool', 'Trap', 18, 'A whirlpool opens under them: it drags them to its middle and soaks them.', 'From the right-hand rim, spiral in two turns and pool in the centre.',
      spiral(0, 0, 0.85, 0.1, 0, 2), { pools: [[1]], ink: 'steady' }),
    S('freeze', 'Freeze', 'Freeze', 16, 'The only way to freeze: a soaked foe freezes solid wherever they stand, and every puddle turns to ice. A dry foe is only chilled.', 'A snowflake: a six-pointed star round the centre.',
      sawRing(0, 0, 0.72, 0.3, 6), { closed: [true] }),
    S('tidal', 'Tidal Wave', 'Wash', 20, 'A wide wave rolls across the ring: it soaks them, puts out their fire and lava, and wears away their stones.', 'A big wave: rise from the bottom left to a crest, curl right over into a loop, then run out along the bottom to the right.',
      join(quad(-0.8, 0.55, -0.35, -0.65, 0.25, -0.5), arc(0.25, -0.2, 0.3, -90, 200), quad(-0.032, -0.303, 0.0, 0.55, 0.8, 0.55)), { ink: 'light' }),
    S('ebb', 'Ebb and Flow', 'Swap', 12, 'Flow past them: you trade places in an instant, and they are left soaked.', 'Out and back: a ripple across the top to the right, round, and a ripple back along the bottom to the left.',
      join(hwave(-0.7, 0.55, -0.25, 0.12, 1.5), arc(0.55, 0, 0.25, -90, 90), hwave(0.55, -0.7, 0.25, 0.12, 1.5)), { ink: 'light' }),
    S('dragon', 'Water Dragon', 'Summon', 22, 'A serpent of water coils out, chases them and bites three times.', 'A long snake from the bottom to the top: three and a half bends.',
      vwave(0.8, -0.8, 0, 0.24, 3.5), { ink: 'light' }),
    S('flood', 'Great Flood', 'Ultimate', 60, 'The ring floods: a huge wave crashes over them, then everything freezes.', 'Pool in the centre, spiral out two and a half turns, climb up the left, and send a ripple across the top.',
      join(spiral(0, 0.1, 0.04, 0.5, 0, 2.5), poly(-0.5, 0.1, -0.5, -0.6), hwave(-0.5, 0.7, -0.6, 0.1, 1.5)), { pools: [[0]], ink: 'steady' }),
  ],
  fire: [
    // basic
    S('fireball', 'Fireball', 'Shot', 10, 'A ball of fire that bursts where it lands.', 'A peak: up to a point and back down, like the tip of a flame.',
      poly(-0.5, 0.45, 0, -0.55, 0.5, 0.45), { ink: 'light' }),
    S('jab', 'Flame Jab', 'Strike', 6, 'A fist wrapped in fire. It sets them burning.', 'One quick flick from the bottom left up to the top right.',
      poly(-0.45, 0.45, 0.45, -0.45), { ink: 'light' }),
    S('flameshield', 'Flame Shield', 'Thorns', 10, 'A ring of flame round you: it blunts their blows and burns whoever hits you.', 'A V: down to a point and back up.',
      poly(-0.5, -0.45, 0, 0.55, 0.5, -0.45)),
    // skilled
    S('embers', 'Ember Spray', 'Volley', 12, 'A fan of embers. Each one sets them burning.', 'An M across the top of the pad.',
      poly(-0.55, -0.1, -0.3, -0.66, 0, -0.3, 0.3, -0.66, 0.55, -0.1), { ink: 'light' }),
    S('rocket', 'Rocket Step', 'Dash', 9, 'Jets of fire hurl you away across the floor, leaving a burning trail behind you for them.', 'Two little zigzags at the bottom left, then one long stroke to the top right. Pool the ink first.',
      join(poly(-0.72, 0.72, -0.6, 0.5, -0.5, 0.66, -0.38, 0.46), poly(-0.38, 0.46, 0.66, -0.62)), { pools: [[0]], ink: 'light' }),
    S('knee', 'Burning Knee', 'Break', 14, 'A rising knee bursting with fire that smashes through shields, armour and guards, and burns.', 'A tall N: up, slash down to the bottom right, up again. Pool the ink first.',
      poly(-0.35, 0.65, -0.35, -0.65, 0.35, 0.65, 0.35, -0.65), { pools: [[0]] }),
    S('whip', 'Fire Whip', 'Grapple', 12, 'A whip of flame catches them and hauls you in to them for a burning blow.', 'A 7: across the top, then a long slash down to the left.',
      poly(-0.5, -0.55, 0.5, -0.55, -0.15, 0.68), { ink: 'light' }),
    S('vent', 'Vent', 'Release', 6, 'Let all your heat out in one blast round you. The hotter you are, the bigger it is.', 'A Z: across the top, slash down to the bottom left, across the bottom.',
      poly(-0.55, -0.5, 0.55, -0.5, -0.55, 0.5, 0.55, 0.5)),
    S('phoenix', 'Phoenix Rise', 'Heal', 14, 'Burn your heat into life: the hotter you are, the more it mends. It puts out your own burns.', 'Wings: a little loop, down to a point, back up, and another little loop.',
      join(arc(-0.6, -0.36, 0.14, -90, 270), poly(-0.6, -0.5, 0, 0.55, 0.6, -0.5), arc(0.6, -0.36, 0.14, -90, 270))),
    S('ignite', 'Ignite', 'Detonate', 10, 'Every burn on them flares up at once. The longer they have been burning, the harder it hits.', 'A lightning bolt from the top to the bottom.',
      poly(0.25, -0.75, -0.2, -0.05, 0.2, 0.05, -0.25, 0.75), { ink: 'light' }),
    S('brand', 'Searing Brand', 'Mark', 10, 'Burn your mark onto them: for a while every spell of yours hits them harder.', 'A triangle round the centre.',
      poly(0, -0.62, 0.55, 0.42, -0.55, 0.42, 0, -0.62), { closed: [true] }),
    S('fury', 'Fury', 'Fury', 10, 'Let the fire take you: for a few seconds your spells come out twice as fast and hit harder, but your heat climbs fast.', 'A Σ: across the top to the left, in to the middle, out to the bottom left, and across the bottom.',
      poly(0.5, -0.55, -0.45, -0.55, 0.15, 0, -0.45, 0.55, 0.5, 0.55)),
    // master
    S('roundhouse', 'Roundhouse Flame', 'Sweep', 14, 'A spinning kick throws a ring of fire all round you.', 'A sun: a jagged circle of ten points round the centre.',
      sawRing(0, 0, 0.66, 0.44, 10), { closed: [true] }),
    S('breath', 'Flame Breath', 'Cone', 14, 'Breathe a cone of fire at them for a moment.', 'A cone of flame: a zigzag from a point on the left, growing wider and wider to the right. Pool the ink first.',
      poly(-0.75, 0, -0.5, -0.12, -0.3, 0.18, -0.05, -0.3, 0.2, 0.4, 0.45, -0.5, 0.72, 0.6), { pools: [[0]] }),
    S('firewall', 'Fire Wall', 'Barrier', 16, 'A line of flame between you and them: it burns and slows whoever crosses it.', 'A row of flames: a zigzag of four peaks across the middle.',
      poly(-0.8, 0.2, -0.6, -0.25, -0.4, 0.2, -0.2, -0.25, 0, 0.2, 0.2, -0.25, 0.4, 0.2, 0.6, -0.25, 0.8, 0.2), { ink: 'light' }),
    S('lava', 'Lava Pool', 'Zone', 18, 'The floor under them melts: they slow to a crawl and burn.', 'A W low on the pad, finishing in a loop at the top right, like a bubble rising.',
      join(poly(-0.65, 0.1, -0.35, 0.62, 0, 0.28, 0.35, 0.62, 0.6, 0.15), arc(0.6, -0.07, 0.22, 90, 450))),
    S('charge', 'Sticky Charge', 'Bomb', 18, 'A burning charge sticks to them and blows up a moment later, unless they shake it off with a dodge or a dash.', 'A fuse and a bomb: a wavy line from the left into a big circle on the right.',
      join(hwave(-0.8, 0.05, 0.1, 0.12, 1.5), arc(0.38, 0.1, 0.33, 180, 540))),
    S('firework', 'Firework', 'Lob', 16, 'A rocket arcs over walls and stones and bursts over them in a shower of sparks.', 'A rocket and its burst: straight up from the bottom, then a five-pointed star at the top.',
      join(poly(0.2116, 0.78, 0.2116, -0.0587), [54, 198, 342, 126, 270, 54].map(a => ({ x: 0.36 * Math.cos(a * Math.PI / 180), y: -0.35 + 0.36 * Math.sin(a * Math.PI / 180) }))), { ink: 'light' }),
    S('meteor', 'Meteor', 'Blast', 26, 'A burning rock falls from the sky onto them and leaves molten ground.', 'A comet: one long stroke down from the top right, ending in a circle at the bottom left.',
      join(poly(0.75, -0.75, -0.25, 0.25), arc(-0.47, 0.47, 0.311, -45, 315))),
    S('inferno', 'Inferno', 'Ultimate', 60, 'A star of fire bursts across the ring, then explodes again.', 'A five-pointed star.',
      star(0, 0.05, 0.75), { closed: [true] }),
  ],
  earth: [
    // basic
    S('rock', 'Rock Throw', 'Shot', 10, 'Tear a rock from the floor and throw it. If one of your stones is beside you, you throw that instead, much harder.', 'One stroke straight up the middle.',
      poly(0, 0.65, 0, -0.65), { ink: 'heavy' }),
    S('fist', 'Stone Fist', 'Strike', 8, 'A fist cased in rock. Heavy, and it knocks them back.', 'An L: down the left, then along the bottom.',
      poly(-0.4, -0.6, -0.4, 0.5, 0.5, 0.5), { ink: 'heavy' }),
    S('wall', 'Stone Wall', 'Wall', 12, 'A wall of stone rises between you: it stops shots and blocks the way.', 'One long level line across the middle.',
      poly(-0.7, 0, 0.7, 0), { ink: 'heavy' }),
    // skilled
    S('skin', 'Stone Skin', 'Armor', 14, 'Your skin turns to stone: you take half the damage, burns can’t take hold and nothing knocks you back, but you move slower.', 'A big square round the centre. Pool the ink where you start.',
      poly(-0.55, -0.55, 0.55, -0.55, 0.55, 0.55, -0.55, 0.55, -0.55, -0.55), { closed: [true], pools: [[0]], ink: 'heavy' }),
    S('sand', 'Sand Blast', 'Blind', 12, 'A spray of sand stings them and blinds them, so their spells come out weak.', 'A dune: from the bottom left, two square steps up, across the top, and two steps down again.',
      poly(-0.75, 0.4, -0.45, 0.4, -0.45, 0.1, -0.15, 0.1, -0.15, -0.2, 0.15, -0.2, 0.15, 0.1, 0.45, 0.1, 0.45, 0.4, 0.75, 0.4), { ink: 'heavy' }),
    S('grip', 'Gravel Grip', 'Root', 12, 'Hands of earth grab their feet: they can’t move for a moment.', 'A bracket: across the top to the left, down, and back across the bottom.',
      poly(0.32, -0.55, -0.3, -0.55, -0.3, 0.55, 0.32, 0.55), { ink: 'heavy' }),
    S('pillar', 'Rock Pillar', 'Lift', 14, 'A pillar of rock lifts you up: shots from below can’t reach you, and your rocks hit harder. The pillar stays.', 'A tall narrow arch: up, a short way across the top, and back down.',
      poly(-0.22, 0.7, -0.22, -0.65, 0.22, -0.65, 0.22, 0.7), { ink: 'heavy' }),
    S('shatter', 'Shatter', 'Burst', 12, 'Every stone you have raised bursts into flying shards. The more stones near them, the more it hurts.', 'A crack: zigzag from the top left down to the bottom right.',
      poly(-0.62, -0.62, -0.259, -0.485, -0.237, -0.011, 0.237, 0.011, 0.259, 0.485, 0.62, 0.62), { ink: 'heavy' }),
    S('burrow', 'Burrow', 'Tunnel', 14, 'Sink into the ground and burst up beside them, throwing them off their feet.', 'A tunnel: down, along the bottom, and back up. Pool at the end.',
      poly(-0.62, -0.25, -0.62, 0.42, 0.62, 0.42, 0.62, -0.25), { pools: [[1]], ink: 'heavy' }),
    S('stance', 'Mountain Stance', 'Stance', 14, 'Root yourself like a mountain: nothing moves you, you mend a little, and your next blow lands half as hard again.', 'A square arch: up, across the top, and down. Pool at both ends.',
      poly(-0.6, 0.6, -0.6, -0.4, 0.6, -0.4, 0.6, 0.6), { pools: [[0, 1]], ink: 'heavy' }),
    S('weight', 'Weight of Stone', 'Ground', 12, 'Make them as heavy as stone: for a while they can’t dash, leap, glide or dodge, and they walk slower.', 'A heartbeat: level, a sharp dip and a peak, then level again.',
      poly(-0.75, 0.1, -0.25, 0.1, -0.1, 0.45, 0.1, -0.35, 0.25, 0.1, 0.75, 0.1)),
    S('statue', 'Jade Statue', 'Statue', 14, 'Turn to jade for a moment: nothing can hurt or move you, but you can’t act either. You come out of it mended a little.', 'A diamond, like a gem of jade.',
      poly(0, -0.65, 0.5, 0, 0, 0.65, -0.5, 0, 0, -0.65), { closed: [true], ink: 'heavy' }),
    // master
    S('spike', 'Earth Spike', 'Spike', 14, 'A spike of rock bursts up under them. It stays there as a stone.', 'Along the ground, sharply up to a high point and back down, and on along the ground.',
      poly(-0.75, 0.5, -0.2, 0.5, 0, -0.7, 0.2, 0.5, 0.75, 0.5), { ink: 'heavy' }),
    S('quake', 'Quake', 'Stun', 16, 'Stamp: a shockwave runs through the ground all round you and knocks them off their feet. It can’t touch anyone in the air.', 'Square teeth along the bottom of the pad: up, across, down, across, again and again.',
      poly(-0.8, 0.45, -0.8, 0.1, -0.48, 0.1, -0.48, 0.45, -0.16, 0.45, -0.16, 0.1, 0.16, 0.1, 0.16, 0.45, 0.48, 0.45, 0.48, 0.1, 0.8, 0.1, 0.8, 0.45), { ink: 'heavy' }),
    S('quicksand', 'Quicksand', 'Sink', 16, 'The floor under them turns to sand: they sink, slow to a crawl, and take damage while they are in it.', 'A funnel: across the top, slant in to a narrow bottom, and back up.',
      poly(-0.62, -0.45, 0.62, -0.45, 0.2, 0.5, -0.2, 0.5, -0.62, -0.45), { closed: [true], ink: 'heavy' }),
    S('boulder', 'Boulder Roll', 'Roll', 18, 'A boulder rolls across the ring at them, crushing. It uses one of your stones if it can.', 'A small square on the left, starting at its bottom right corner, then roll on along the floor to the right.',
      poly(-0.3, 0.25, -0.75, 0.25, -0.75, -0.2, -0.3, -0.2, -0.3, 0.25, 0.75, 0.25), { ink: 'heavy' }),
    S('crystal', 'Crystal Spear', 'Pierce', 16, 'A long spear of crystal that goes straight through walls and stones, even your own, so you can shoot from behind a wall.', 'A spear: one long stroke from the bottom left up to the top right, ending in a small diamond point.',
      poly(-0.75, 0.75, 0.15, -0.15, 0.4399, -0.2137, 0.5036, -0.5036, 0.2137, -0.4399, 0.15, -0.15)),
    S('toss', 'Tiger Toss', 'Throw', 14, 'Grab them up close and hurl them over you onto the floor behind. Throw them into a stone and it hurts far more.', 'A throw over your shoulder: a big arch from the bottom right over the top to the bottom left, landing in a small loop.',
      join(arc(0, 0.3, 0.6, 0, -180), arc(-0.6, 0.48, 0.18, -90, 270)), { ink: 'heavy' }),
    S('landslide', 'Landslide', 'Rockfall', 20, 'Rocks pour down over them, and some stay as stones.', 'Stairs going down from the top left to the bottom right: four steps.',
      poly(-0.75, -0.7, -0.4, -0.7, -0.4, -0.35, -0.05, -0.35, -0.05, 0, 0.3, 0, 0.3, 0.35, 0.65, 0.35, 0.65, 0.7)),
    S('mountain', 'Mountain Falls', 'Ultimate', 60, 'The ground splits and a mountain falls on them, leaving a ring of stones round them.', 'A square spiral: round the rim and in, corner by corner.',
      poly(-0.7, -0.7, 0.7, -0.7, 0.7, 0.7, -0.7, 0.7, -0.7, -0.32, 0.32, -0.32, 0.32, 0.32, -0.32, 0.32, -0.32, 0.02), { ink: 'heavy' }),
  ],
  air: [
    // basic
    S('blade', 'Wind Blade', 'Shot', 6, 'A crescent of cutting wind. Fast.', 'A C: a big curve round the left.',
      arc(0.15, 0, 0.55, 60, 300), { ink: 'light' }),
    S('gust', 'Gust', 'Push', 8, 'A blast of wind shoves them far back.', 'A >: from the top left to a point on the right, and back to the bottom left.',
      poly(-0.5, -0.5, 0.5, 0, -0.5, 0.5), { ink: 'light' }),
    S('feather', 'Feather Step', 'Dodge', 6, 'Leap away on the wind. Nothing touches you as you go.', 'One quick stroke from the top left down to the bottom right.',
      poly(-0.45, -0.45, 0.45, 0.45), { ink: 'light' }),
    // skilled
    S('meialua', 'Meia-lua Gale', 'Strike', 10, 'A half-moon kick throws a wide crescent of wind in front of you.', 'A wide arc over the top of the pad, left to right. Pool at the start: the planted foot.',
      arc(0, 0.15, 0.8, 200, 340), { pools: [[0]], ink: 'light' }),
    S('airshield', 'Air Shield', 'Deflect', 10, 'Wind whirls round you and turns their shots aside.', 'An Ω: a short foot, a big loop round over the top, and a short foot out.',
      join(poly(-0.62, 0.5, -0.3, 0.45), arc(0, 0.05, 0.5, 126.9, 413.1), poly(0.3, 0.45, 0.62, 0.5)), { ink: 'light' }),
    S('walk', 'Wind Walk', 'Haste', 10, 'The wind at your back: much faster for a while, and you gather wind twice as fast.', 'One long curve from the bottom left, bending up to the top right.',
      quad(-0.68, 0.62, -0.5, -0.45, 0.65, -0.58), { ink: 'light' }),
    S('breath', 'Breath of Life', 'Cleanse', 14, 'Clean wind blows away burns, water, sand, slows and holds, and mends you a little.', 'From the centre, spiral out one turn, then sweep away to the right.',
      join(spiral(-0.1, 0, 0.04, 0.38, 90, 1.0), quad(-0.1, 0.38, 0.5, 0.4, 0.75, -0.1)), { ink: 'light' }),
    S('whistle', 'Sharp Whistle', 'Interrupt', 10, 'A piercing whistle of wind breaks the spell they are writing.', 'A short ripple low on the left, then a sharp flick up to the top right.',
      join(hwave(-0.65, 0.15, 0.35, 0.13, 1), poly(0.15, 0.35, 0.62, -0.55)), { ink: 'light' }),
    S('vacuum', 'Vacuum', 'Silence', 14, 'Suck the air from round them: for a moment they cannot write a single spell.', 'An hourglass: across the top, down to the bottom left, across the bottom, and back up to the start.',
      poly(-0.5, -0.55, 0.5, -0.55, -0.5, 0.55, 0.5, 0.55, -0.5, -0.55), { closed: [true], ink: 'light' }),
    S('crosswind', 'Crosswind', 'Misdirect', 10, 'Their next spell is blown off course and goes wide.', 'A small standing 8.',
      curve(u => { const t = u * TAU; return { x: 0.22 * Math.sin(2 * t), y: 0.42 * Math.sin(t) }; }), { closed: [true], ink: 'light' }),
    S('echo', 'Echo', 'Echo', 8, 'The wind repeats your last spell, a little weaker.', 'Two loops in a row along the middle, the second smaller, like an echo.',
      curve(u => { const t = u * 2 * TAU, k = 1 - 0.45 * u; return { x: -0.62 + 1.24 * u - 0.24 * k * Math.sin(t), y: 0.08 + 0.32 * k * Math.cos(t) }; }, 160), { ink: 'light' }),
    S('weightless', 'Featherweight', 'Free', 12, 'Weigh nothing for a while: nothing can slow you, hold you, stun you or throw you about, and you move faster.', 'A curve rising to the top right, ending in a small loop, like a balloon drifting away.',
      join(quad(-0.65, 0.65, -0.25, 0.05, 0.229, -0.229), arc(0.36, -0.38, 0.2, 131, 491)), { ink: 'light' }),
    // master
    S('updraft', 'Updraft', 'Launch', 12, 'A column of wind lifts them into the air, helpless. Air hits harder on a foe in the air.', 'An arrow pointing up: straight up the middle, then the head: down to the left, back to the tip, down to the right.',
      poly(0, 0.7, 0, -0.6, -0.35, -0.25, 0, -0.6, 0.35, -0.25), { ink: 'light' }),
    S('downdraft', 'Downdraft', 'Slam', 14, 'A hammer of air from above. On a foe in the air, it slams them down hard.', 'An arrow pointing down: straight down the middle, then the head: up to the left, back to the tip, up to the right.',
      poly(0, -0.7, 0, 0.6, -0.35, 0.25, 0, 0.6, 0.35, 0.25), { ink: 'light' }),
    S('flurry', 'Hurricane Flurry', 'Flurry', 14, 'Five quick strikes riding gusts of wind.', 'Four small loops in a row across the middle.',
      curve(u => { const t = u * 4 * TAU; return { x: -0.66 + 1.32 * u - 0.16 * Math.sin(t), y: 0.05 + 0.2 * Math.cos(t) }; }, 200), { ink: 'light' }),
    S('twin', 'Twin Blades', 'Homing', 12, 'Two blades of wind that curve in on them from both sides, round walls and stones.', 'A heart: from the point at the bottom, up round the left, into the dip at the top, round the right and back down to the point.',
      heart(0, 0.1, 0.04), { closed: [true], ink: 'light' }),
    S('tornado', 'Tornado', 'Storm', 18, 'A whirlwind sets off in a straight line, throwing up anyone it passes.', 'A funnel: three loops from the bottom to the top, getting wider as they rise.',
      curve(u => { const t = u * 3 * TAU, w = 0.1 + 0.4 * u; return { x: w * Math.cos(t), y: 0.72 - 1.4 * u + 0.1 * Math.sin(t) }; }, 180), { ink: 'light' }),
    S('crane', 'Sky Crane', 'Leap', 18, 'Leap high where nothing can reach you, then dive down on them.', 'A tall arch with a small loop at the top: up from the bottom left, loop over, and down to the bottom right.',
      join(quad(-0.45, 0.72, -0.3, -0.2, -0.086, -0.505), arc(0.02, -0.58, 0.13, 145, 505), quad(-0.086, -0.505, 0.25, -0.2, 0.45, 0.72)), { ink: 'light' }),
    S('gale', 'Gale Force', 'Wave', 18, 'A wide wall of wind drives them all the way back to the edge of the ring.', 'Back and forth three times across the pad, turning round at each end, like a wall of wind.',
      join(poly(-0.65, -0.5, 0.5, -0.5), arc(0.5, -0.25, 0.25, -90, 90), poly(0.5, 0, -0.5, 0), arc(-0.5, 0.25, 0.25, 270, 90), poly(-0.5, 0.5, 0.65, 0.5)), { ink: 'light' }),
    S('typhoon', 'Typhoon', 'Ultimate', 60, 'A great storm lifts them and spins them. All your wind goes into it.', 'A ring of five loops round the centre.',
      curve(u => { const t = u * TAU; return { x: 0.5 * Math.cos(t) + 0.2 * Math.cos(6 * t), y: 0.5 * Math.sin(t) + 0.2 * Math.sin(6 * t) }; }, 240), { closed: [true], ink: 'light' }),
  ],
};
for (const w of WAY_ORDER) MOVES[w].forEach((m, i) => {
  m.way = w; m.id = w + ':' + m.key; m.order = i; m.tier = i < 3 ? 0 : i < 12 ? 1 : 2;
  if (!m.closed) m.closed = m.strokes.map(() => false);
  if (!m.pools) m.pools = m.strokes.map(() => []);
});

// ── the reader: each stroke resampled to N points; shape compared after centring and sizing, then size, place, pooling and ink ──
const N = 48;
const pathLen = p => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return L; };
function resample(pts, n) {
  const p = pts.map(q => ({ x: q.x, y: q.y })), I = pathLen(p) / (n - 1);
  if (!(I > 0)) return Array.from({ length: n }, () => ({ x: p[0].x, y: p[0].y }));
  const out = [{ x: p[0].x, y: p[0].y }];
  let D = 0;
  for (let i = 1; i < p.length; i++) {
    const d = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    if (d > 0 && D + d >= I) {
      const k = (I - D) / d, q = { x: p[i - 1].x + k * (p[i].x - p[i - 1].x), y: p[i - 1].y + k * (p[i].y - p[i - 1].y) };
      out.push(q); p.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ x: p[p.length - 1].x, y: p[p.length - 1].y });
  return out.slice(0, n);
}
function frame(ps) {
  let cx = 0, cy = 0;
  for (const q of ps) { cx += q.x; cy += q.y; }
  cx /= ps.length; cy /= ps.length;
  let r = 0;
  for (const q of ps) r += (q.x - cx) ** 2 + (q.y - cy) ** 2;
  r = Math.sqrt(r / ps.length) || 1e-6;
  return { cx, cy, r, n: ps.map(q => ({ x: (q.x - cx) / r, y: (q.y - cy) / r })) };
}
// sharp turns (a square has four, a circle none): the turning over three steps, counted at its peaks
function corners(r, cyclic) {
  const n = r.length, dir = [];
  for (let i = 0; i < n - 1; i++) dir.push(Math.atan2(r[i + 1].y - r[i].y, r[i + 1].x - r[i].x));
  if (cyclic) dir.push(Math.atan2(r[1].y - r[n - 1].y, r[1].x - r[n - 1].x));
  const m = dir.length, turn = [];
  for (let i = 0; i < m; i++) { const j = i + 1 < m ? i + 1 : cyclic ? 0 : -1; turn.push(j < 0 ? 0 : (((dir[j] - dir[i]) + 3 * Math.PI) % TAU) - Math.PI); }
  const win = [];
  for (let i = 0; i < m; i++) { let a = 0; for (let k = -1; k <= 1; k++) { const j = i + k; if (j >= 0 && j < m) a += turn[j]; else if (cyclic) a += turn[(j + m) % m]; } win.push(Math.abs(a)); }
  let count = 0, last = -9;
  for (let i = 0; i < m; i++) {
    const prev = win[(i - 1 + m) % m], next = win[(i + 1) % m];
    if (win[i] > 1.0 && win[i] >= prev && win[i] >= next && i - last > 3) { count++; last = i; }
  }
  return count;
}
const prepOf = (g, strokes) => strokes.map((s, i) => { const r = resample(s, N); return { f: frame(r), closed: g.closed[i], cyc: g.closed[i] || g.loose, pools: g.pools[i], corners: corners(r, g.closed[i]) }; });
const turned = (s, a) => s.map(p => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) }));
for (const w of WAY_ORDER) for (const g of MOVES[w]) { g.prep = prepOf(g, g.strokes); g.preps = g.loose ? Array.from({ length: 12 }, (_, k) => prepOf(g, g.strokes.map(s => turned(s, k * TAU / 12)))) : [g.prep]; }
const INKP = { MIN: 0.008, MAX: 0.06, POOL: 0.12, VTHIN: 4, VDRY: 2.6, POOLT: 0.28 };
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
function prepDrawn(strokes) {
  return strokes.map(s => {
    const L = s.len || pathLen(s.pts) || 1e-6;
    const pr = s.pts.map(p => p.p).filter(v => v != null);
    const r = resample(s.pts, N), f = frame(r), shut = Math.hypot(r[0].x - r[N - 1].x, r[0].y - r[N - 1].y) < 0.6 * f.r;
    return { f, pools: s.pools.map(p => clamp(p.s / L, 0, 1)), ink: median(s.pts.map(p => p.w)) / INKP.MAX, pr: pr.length ? pr.reduce((a, b) => a + b, 0) / pr.length : null, pts: s.pts, len: L,
             corners: corners(r, false), cornersShut: shut ? corners(r, true) : corners(r, false) };
  });
}
function fitStroke(d, t) {
  const A = d.f.n, B = t.f.n;
  let best = { err: Infinity, rev: false, k: 0 };
  for (const rev of [false, true]) {
    const P = rev ? A.slice().reverse() : A;
    const steps = t.cyc ? N : 1;
    for (let k = 0; k < steps; k += t.cyc ? 2 : 1) {
      let e = 0;
      for (let i = 0; i < N; i++) { const p = P[(i + k) % N], q = B[i]; e += Math.hypot(p.x - q.x, p.y - q.y); }
      e /= N;
      if (e < best.err) best = { err: e, rev, k };
    }
  }
  let ch = 0;
  for (const p of A) { let m = Infinity; for (const q of B) m = Math.min(m, (p.x - q.x) ** 2 + (p.y - q.y) ** 2); ch += Math.sqrt(m); }
  for (const q of B) { let m = Infinity; for (const p of A) m = Math.min(m, (p.x - q.x) ** 2 + (p.y - q.y) ** 2); ch += Math.sqrt(m); }
  ch /= 2 * N;
  const shape = (0.5 * best.err + 0.5 * ch) * clamp(t.f.r / 0.42, 0.55, 1);
  let need = 0, hit = 0;
  const used = new Set();
  for (const tp of t.pools) {
    need++;
    const want = t.cyc ? tp : best.rev ? 1 - tp : tp;
    let found = -1;
    d.pools.forEach((dp, i) => { if (Math.abs(dp - want) <= 0.13 && !used.has(i)) found = i; });
    if (found >= 0) { hit++; used.add(found); }
  }
  const dc = t.cyc ? d.cornersShut : d.corners;
  return { shape, place: Math.hypot(d.f.cx - t.f.cx, d.f.cy - t.f.cy), size: Math.abs(Math.log(d.f.r / t.f.r)), need, hit, extra: d.pools.length - used.size, corners: Math.max(0, Math.abs(dc - t.corners) - 1 - Math.floor(t.corners / 6)) }; // (sharp-cornered moves get a little more leeway)
}
function joined(D) {
  const pts = [], pools = [];
  let L = 0, gap = 0;
  D.forEach((d, i) => {
    if (i) gap = Math.max(gap, Math.hypot(d.pts[0].x - pts[pts.length - 1].x, d.pts[0].y - pts[pts.length - 1].y));
    for (const p of d.pools) pools.push({ s: L + p * d.len });
    pts.push(...d.pts); L += d.len;
  });
  return { one: prepDrawn([{ pts, pools, len: L }])[0], gap };
}
function inkMiss(level, want) {
  if (want === 'light') return clamp((level - 0.55) / 0.4, 0, 1);
  if (want === 'heavy') return clamp((0.55 - level) / 0.35, 0, 1);
  if (want === 'steady') return level < 0.3 ? clamp((0.3 - level) / 0.25, 0, 1) : clamp((level - 0.95) / 0.4, 0, 1);
  return 0;
}
function scoreGlyph(g, D) {
  let pairs = null, joinCost = 0;
  if (g.prep.length === D.length) pairs = D.length === 2 ? [[0, 1], [1, 0]] : [D.map((_, i) => i)];
  else if (g.prep.length === 1 && D.length > 1 && D.length <= 3) {
    const J = joined(D);
    if (J.gap > 0.25) return null;
    D = [J.one]; pairs = [[0]]; joinCost = 0.05 * (J.gap > 0.1 ? 2 : 1);
  } else return null;
  let best = null;
  for (const prep of g.preps) for (const order of pairs) {
    const fits = prep.map((t, i) => fitStroke(D[order[i]], t));
    const avg = k => fits.reduce((a, f) => a + f[k], 0) / fits.length, sum = k => fits.reduce((a, f) => a + f[k], 0);
    const r = { shape: avg('shape'), place: avg('place'), size: avg('size'), need: sum('need'), hit: sum('hit'), extra: sum('extra'), corners: sum('corners') };
    if (!best || r.shape + r.place < best.shape + best.place) best = r;
  }
  const level = D.reduce((a, d) => a + d.ink, 0) / D.length, miss = inkMiss(level, g.ink);
  const prs = D.map(d => d.pr).filter(v => v != null), pr = prs.length ? prs.reduce((a, b) => a + b, 0) / prs.length : null;
  const missing = best.need - best.hit;
  const q = 1 - 1.05 * best.shape - 1.2 * best.place - 0.6 * best.size - 0.12 * Math.min(3, best.corners) - 0.26 * missing - 0.06 * Math.min(3, Math.max(0, best.extra)) - 0.07 * miss - joinCost;
  return { g, q, level, pr, missing, extra: best.extra,
    parts: { shape: clamp(1 - best.shape / 0.5 - 0.15 * Math.min(3, best.corners), 0, 1), size: clamp(1 - best.size / 0.7, 0, 1), place: clamp(1 - best.place / 0.4, 0, 1),
             pooling: best.need ? clamp((best.hit - 0.34 * Math.max(0, best.extra)) / best.need, 0, 1) : clamp(1 - 0.34 * Math.max(0, best.extra), 0, 1), ink: 1 - miss } };
}
const CLEAN = 0.8, ROUGH = 0.42;
// read what's written against the moves you know: the closest, how well it was written, and how strong that makes it
function recognize(strokes, moves) {
  const D = prepDrawn(strokes.filter(s => s.pts.length > 1));
  if (!D.length) return null;
  const all = moves.map(g => scoreGlyph(g, D)).filter(Boolean).sort((a, b) => b.q - a.q);
  if (!all.length) return { verdict: 'fizzle', best: null, all, power: 0 };
  const b = all[0];
  const verdict = b.q >= CLEAN ? 'clean' : b.q >= ROUGH ? 'rough' : 'fizzle';
  let pbonus = 0;
  if (b.pr != null) { const want = { light: 0.3, steady: 0.55, heavy: 0.85, any: b.pr }[b.g.ink]; pbonus = 0.08 * (1 - 2 * Math.min(0.5, Math.abs(b.pr - want))); b.parts.pressure = clamp(1 - 2 * Math.abs(b.pr - want), 0, 1); }
  const power = verdict === 'fizzle' ? 0 : clamp(0.4 + 0.6 * (b.q - ROUGH) / (0.95 - ROUGH), 0.4, 1) + pbonus;
  return { verdict, best: b, power: Math.max(0, power), all };
}

// ── a believable hand, for demonstrations and tests: a template, written at the speed its ink wants ──
const SPEED = { light: 2.6, steady: 1.35, heavy: 0.7, any: 1.4 };
function writeOut(g, o = {}) {
  const off = o.off || { x: 0, y: 0 }, sc = o.scale || 1, wob = o.wobble ?? 0.012;
  return g.strokes.map((tp, si) => {
    const base = resample(tp, 110), ph = (si + 1) * 1.7 + (o.seed || 0);
    const pts = base.map((q, i) => ({ x: q.x * sc + off.x + wob * Math.sin(i * 0.11 + ph), y: q.y * sc + off.y + wob * Math.cos(i * 0.09 + ph * 1.3) }));
    const want = g.pools[si] || [], pools = [], L = pathLen(pts);
    let t = 0, w = INKP.MIN * 2, s = 0, load = 0;
    const out = [], dwells = [];
    pts.forEach((p, i) => {
      const prev = pts[i - 1], next = pts[i + 1];
      let turn = 0;
      if (prev && next) { const a1 = Math.atan2(p.y - prev.y, p.x - prev.x), a2 = Math.atan2(next.y - p.y, next.x - p.x); turn = Math.abs(((a2 - a1 + 3 * Math.PI) % TAU) - Math.PI); }
      const v = SPEED[g.ink] * (turn > 0.6 ? 0.35 : turn > 0.3 ? 0.7 : 1) * (o.speed || 1);
      const d = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0;
      t += d / v; s += d; load = Math.min(1, load + d / v / 0.8);
      const target = INKP.MIN + (INKP.MAX - INKP.MIN) * (0.25 + 0.75 * load) * clamp(1 - v / INKP.VTHIN, 0.06, 1);
      w += (target - w) * 0.35;
      const pt = { x: p.x, y: p.y, t, w, p: o.pressure ?? null, dry: v > INKP.VDRY && i > 3, seed: (i * 37 + si * 11) % 997 };
      const k = i / (pts.length - 1);
      for (const tq of want) if (!o.noPools && Math.abs(k - tq) < 0.5 / (pts.length - 1) + 1e-9) {
        dwells.push({ i: out.length, t0: t, t1: t + 0.45 });
        pools.push({ s, dwell: 0.45, w: INKP.POOL });
        t += 0.45; w = INKP.POOL * 0.9;
      }
      out.push(pt);
    });
    return { pts: out, pools, len: L, dwells, dur: t };
  });
}

return { TAU, clamp, WAYS, WAY_ORDER, MOVES, TIERS, INKP, CLEAN, ROUGH, recognize, writeOut, resample, pathLen, scoreGlyph, prepDrawn };
})();
if (typeof module !== 'undefined') module.exports = INK;
