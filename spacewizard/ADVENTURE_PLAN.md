# New Adventure — design plan

The user's request covers two parts:
1. Starting zone: five core moves, one per element. Each opens a literal gate.
   - Fire burns wood.
   - Haste runs through the gale trap. Blink is thrown back.
   - Soul Siphon drains the soul ward.
   - Water and Earth are my choice.
   - Each gate leads to an offshoot with 3 titans that get progressively stronger. Each adds a leg (rune) to the spell.
   - After each titan, a minion wave arrives in the formation the new spell is uniquely good at.
   - Minions are the type this element beats.
   - At the end: info about the element, which zone to go to next (the one it beats), and which to avoid.
2. After all 5: the wider world.
   - Hills with only certain paths up; ruined castles to walk through; single paths.
   - Rivers that need a boat or bridge; rivers joining a lake; sailing, sea monsters, islands, can't swim; boats go up rivers.
   - Forests with paths; biomes; a village.
   - Roaming minions; titans that guard and shoot their power; enemy wizards and astronauts.

Design rule (user): every spell is functionally unique. There's always a time to use each one, and knowing when is the skill.

## Spell lines (strict prefix chains: each titan adds one rune)

| Element | Core (gate) | Titan I (3) | Titan II (4) | Titan III (5) |
|---|---|---|---|---|
| Fire | FF Firebolt (burns the wooden gate) | FFA Fireball → PACK | FFAF Firestorm (NEW) → HORDE | FFAFF Inferno (NEW) → SIEGE |
| Water | WW Frost Shard (freezes the river) | WWA Ice Lance (pierce 3) → SPRINTERS | WWAW Tidal Wave (re-key WWWA, directional) → FLOOD | WWAWW Blizzard (re-key WAWAW) → STAMPEDE |
| Earth | EE Stone Spike (topples the pillar into a bridge) | EES Stone Wall (re-key EAE) → ARCHERS | EESE Stone Guardian → BRUTES | EESEE Petrify → ELITES |
| Air | AS Haste (runs the gale) | ASA Chain Lightning (re-key AWA) → SWARM | ASAW Thunderstorm (re-key AWAW) → SKIRMISHERS | ASAWA Tornado (NEW) → SCATTER |
| Spirit | SS Soul Siphon (drains the ward) | SSA Spirit Lance → COLUMN | SSAW Confusion (re-key SWSW, they fight each other) → WARBAND | SSAWS Time Stop (re-key SASAS) → BARRAGE |

- Zone minions are `elemBeats(zone)`.
  - Fire zone: air minions.
  - Water zone: fire.
  - Earth zone: spirit.
  - Air zone: earth.
  - Spirit zone: water.
- Zone titans are the zone's element and shoot it.
- Next zone is `elemBeats(E)`; the one to avoid is `elemWeakTo(E)`.
- In adventure, a spell can be cast only once learned. Woven (generated) spells can be discovered freely once the world is open.

## Map (one big world, ±8000)

- Sanctum region: a mountain massif, radius ~3300, with carved canyons.
- Hub: pentagonal court, circumradius 560, centre (0,0). Gates sit at the vertices in casting-star order:
  - S top, W upper right, F lower right, E lower left, A upper left.
- World Gate: middle of the bottom side. Five seals.
- Offshoot along direction θ:
  - Gate obstacle at r 600–760.
  - Arenas at r 1150, 1800, 2450, each radius 280.
  - Monument at r 2950, plus a return portal.
- Wider world:
  - Village south.
  - River from the NE mountains to the SE lake, with bridges.
  - Old Hills (plateaus with ramps) west, with a castle ruin on top.
  - Darkwood forest SW, with paths.
  - Highlands north, with a second ruin.
  - Islands in the lake; the boat docks near the village road.
- Terrain grid: 25-unit cells.
  - Types: OPEN, WATER, ROCK, BRIDGE, GAP.
  - A biome colour grid at 100 units.
  - Chunk-rendered ground (512 units per chunk, LRU cache).
  - Walls and solids for castles, houses and trees.

## Enemies
- Adventure foes reuse the battle unit art (drawUnit) with an element:
  - archetypes: brute (tank), imp (fast melee), flyer (flying), archer (ranged), wisp (floating ranged/tiny).
  - Damage uses elemMult.
- Titans: battle titan art, scaled. Element attacks:
  - fire: fireballs, ring, burning ground
  - water: frost volley, slow, ice zone
  - earth: boulder, quake ring
  - air: lightning strike, gust
  - spirit: soul orbs, blink
- World titans guard powers (spells) and attack with simplified versions of them.
- Enemy casters (wizards/astronauts): bolt, nova, blink, summon, shield. They drop scrolls.
- Sea monsters attack the boat.

## Flow / UI
- Save to localStorage. The Adventure menu offers Continue / New adventure.
- Checkpoints: hub, arena entrances, world waystones.
- Spell book overlay: known spells, runes, and when to use each.
- Monument overlay: element info, next zone, zone to avoid.
- Reveal screen for learning, with a when-to-use line.
