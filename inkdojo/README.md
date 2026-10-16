# Ink Dojo

A one-page calligraphy fighting game for phones. You pick a way (Water, Fire, Earth or Air), walk a night-time dojo, and fight its fighters by **writing moves with a brush** on a paper pad. Each move is one stroke, read the moment your finger lifts. The cleaner the writing, the stronger the move.

- **Play:** https://flinnymusic-alt.github.io/Yo/inkdojo.html (add `?v=N` for a fresh copy; the last one used was `?v=7`)
- **claude.ai Artifact:** https://claude.ai/artifact/KLmvzmpV49ZY4sLsHeNvrU
- A duplicate Artifact, https://claude.ai/artifact/S3ynonYsvUxZ2UHdP7WvAm, was made by mistake. The owner hasn't said yet whether to delete it.

## Files

- `inkdojo.html` (repo root) is **built**. Never edit it by hand.
- `inkdojo/src/` holds the sources. `python3 inkdojo/build.py` joins them into `inkdojo.html`, and also writes `inkdojo/build/page.html`, the version used for the Artifact.
- `inkdojo/tests/` holds Playwright and Node checks. They write screenshots to `inkdojo/tests/out/`; `build/` and `out/` aren't committed.

What each source file holds (they're concatenated in this order: `lib`, `a`, `b`, `c`, `d`, `fx`, `e`, `f`, `g`):

| File | What's in it |
|---|---|
| `lib.js` | The four ways (`WAYS`: blurbs, twists), **all 80 moves** (`MOVES`: name, kind, ki cost, what it does, how to write it, its stroke), the tiers, and the **reader** (`recognize`, `CLEAN` 0.8 / `ROUGH` 0.42, power) plus `writeOut`, a believable hand used by demos, tests and bots |
| `game_a.js` | Screen layout, sound, **tilt to walk** (iPhone permission via a hidden real button), saves, `learnedCount` (which moves you know) |
| `game_b.js` | The dojo map, solids, camera |
| `game_c.js` | Fighters: `RANKS` (belts), `WAYMOD` (each way's damage, health, speed), `HALL` and `YOU` (difficulty tuning, below), `skillAt(k)` (how good a fighter is), Ren the student, statuses, drawing fighters |
| `game_d.js` | The **spell engine**: timings, fire's heat, every spell (`SPELL` table), hits (`hurt`), statuses, decoys, ki flow, and the **fighters' minds** (`AIH` hints, `aiChoose`, `aiFight`) |
| `game_fx.js` | Particles, decals, and drawing zones, waves, stones, summons, shots and beams |
| `game_e.js` | The paper pad: brush ink, pools, pressure, `padJudge` (read on lift) |
| `game_f.js` | Game flow: who may challenge you (belt order), fights, lessons, the per-frame `update`, rendering, HUD |
| `game_g.js` | Overlays (title, MOVES scroll, move cards, lessons, fallen, victory), input, and the test hooks on `window.INKDOJO` |

## How it plays now

- **Ways.** Water beats Fire, Fire beats Air, Air beats Earth, Earth beats Water. The way that beats another hits it slightly harder (`ADV` in `game_d.js`). Each way also has its own twist:
  - **Water:** soak, then freeze; puddles make water stronger.
  - **Fire:** heat builds power but burns you past the red line; a soaked fire fighter's spells come out damp.
  - **Earth:** stones that block, get thrown and shatter; stone skin can't burn.
  - **Air:** wind builds as you move.
  - **Ki:** each way also refills ki its own way (`kiFlow`).
- **20 moves per way, in three tiers**, ordered by `order` in `lib.js`:
  - **3 basic:** one plain stroke (a line, a cup, a V, an L, a C), known from the start.
  - **9 skilled:** a turn or loop more.
  - **8 master:** long strokes (stars, spirals, rows of loops). They hit 12% harder, and fighters take longer to write them in the air.
- **Opponents in order.**
  1. Ren, a first-day student, meets you by the pond.
  2. Then only white belts, until all four are beaten.
  3. Then brown, then black.
  4. Then Grandmaster Sumi.

  Later belts wave you off.
- **Skill rises with every win.** A fighter's skill is `skillAt(k)`, where `k` is how many you've beaten plus one:
  - It sets their health, damage, telegraph time, how often they think and react, aim, fizzles, and how many spells they know (about as many as you).
  - It's one smooth formula; the Grandmaster is `k` = 13.
- **Learning.** Ren, each white belt and each brown belt teach one skilled move; each black belt teaches two master moves (lessons show them one after another).
- **Difficulty tuning (`game_c.js`).**
  - `HALL`: per-way damage for the halls' fighters, so the four halls feel equally hard.
  - `YOU`: per-way damage for the player, so each way is an equally good choice at a human writing pace.

## Testing

Run these from `inkdojo/tests/` after `python3 ../build.py`. Use `timeout` (some run for minutes).

| Test | What it checks | Expected now |
|---|---|---|
| `node smoke.js` | Loads, no errors | `errors []` |
| `node play1.js water` (any way) | A bot writes moves by hand against Ren | wins, `learned` 4, `errors []` |
| `node ui.js` | Touch: pick a way, walk, write with a finger, scroll, lose, Grandmaster, the end | casts 1, `fallen`, `victory true` |
| `node endgame.js` | Last lesson (two moves), Grandmaster, victory, landscape | Blast then Ultimate; `victory true` |
| `node practice.js` | Every spell cast outside a fight | `none` stuck |
| `node hot.js`, `node panel.js` | Reload while playing; the pad panel | `errors []` |
| `node tilt.js`, `node tilt2.js` | Tilt to walk, including the iPhone permission flow | moves the right ways |
| `node calib.js water` (any way) | Every move written neatly or roughly reads as itself; scribbles fizzle | `moves needing work: 0` |
| `node cross.js` | No move reads **cleanly** as another way's move | 0 clean (rough look-alikes are fine) |
| `node gallery.js fire` | Casts each spell at a target; contact sheet in `out/gal/` | look at the sheet |
| `node duel.js 150` | Way against way, both played by the same AI (balance) | each way about 47–55%; "beats" pairs about 58–65% |
| `WAYS=water node curve.js 12` | The difficulty curve, fight by fight, with a bot at a human pace | wins every fight through 8, then about 96/81/73/52%; Grandmaster about 31% |
| `WAYS=water KS=0,1,2,3,4,5,6,7,8,9 WOB=0.1 THINK='[2.4,3.6]' REACT=0.15 node curve.js 10` | The same with a rough, slow "beginner" bot | wins everything through fight 6 |

`flow.js` and `tiers.js` take screenshots of the opening and the MOVES scroll. `botpower.js` and `wobpower.js` show how strongly the test bot writes. `perf.js` checks frame rate. `sheet2.js` makes a contact sheet from screenshots.

Tests drive the game through `window.INKDOJO`: `begin(way)`, `close()`, `manual(true)` plus `step(n)` to run frames without real time, `castAs(who, 'way:key', P)`, `write(key)`, `bot()`/`botStep()`/`aiPlayer()`, `startFight(f)`, `koFoe()`, `skillAt(k)`, `tierNow()`, `dmgLog(on)` (damage by spell). The tuning tables (`WAYMOD`, `ADV`, `HALL`, `YOU`, `RANKS`) are exposed so tests can try values without rebuilding.

## Publishing a change

1. `python3 inkdojo/build.py`, then run the tests that matter.
2. Commit on your branch, then push with `git push -u origin <branch>`.
3. **Pages:** in a separate worktree, copy `inkdojo.html` over the old one, commit, then pull and push:
   ```
   git fetch origin gh-pages
   git worktree add <scratch>/ghp origin/gh-pages -B gh-pages
   cp inkdojo.html <scratch>/ghp/ && cd <scratch>/ghp && git add inkdojo.html && git commit -m "..."
   git pull --rebase origin gh-pages && git push origin gh-pages
   ```
   The other game's thread also pushes to `gh-pages`, so always pull first. Only ever touch `inkdojo.html` there.
4. **Artifact:** publish `inkdojo/build/page.html` with `url` https://claude.ai/artifact/KLmvzmpV49ZY4sLsHeNvrU. In a new conversation, read it first; the tool refuses otherwise.
5. **Confirm the deploy.** The sandbox can't open github.io, so ask GitHub Actions instead:
   ```
   timeout 300 bash -c 'until gh api "repos/flinnymusic-alt/Yo/actions/runs?branch=gh-pages&per_page=1" --jq ".workflow_runs[0] | [.head_sha[0:7], .status, .conclusion] | @tsv" | grep -E "^<sha>\scompleted"; do sleep 5; done'
   ```
6. Tell the owner what changed, with the Play link and a new `?v=`.

## Things to know

- The reader compares shapes after centring and sizing. It is sensitive to rotation (a V isn't a ∧) but not to direction. New moves must pass `calib.js` (within the way) and `cross.js` (no clean read as another way's move).
- Spells scale with power `P` (how well written), `c.pw` (power times the way's twist), `c.sz` (size) and `c.am` (how much of the element is thrown out, for the visuals).
- Fights can be simulated far faster than real time with `manual(true)` and `step()`: `duel.js` runs thousands of fights in minutes.
- Earlier balance reasoning in short: the AI-vs-AI duels keep the kits fair against each other; `HALL` and `YOU` tune what a human actually feels.
