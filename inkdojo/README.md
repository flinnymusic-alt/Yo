# Ink Dojo

A one-page calligraphy adventure for phones. You pick a way (Water, Fire, Earth or Air) and fight by **writing moves with a brush** on a paper pad. Each move is one stroke, read the moment your finger lifts. The more accurate the writing, the stronger the move, and the curve gets steeper toward the top.

The story (chapter one, a demo): Mum sends you from your home at the edge of the valley into town to fetch a package. There are wolves on the road. In town you talk to people. The postmaster won't hand the package over until you've beaten the dojo's four white belts. On the way home three bandits attack you one after another. Back home, Mum opens the package: grandfather's golden crane, with a buyer in the far city of Kyōsei.

- **Play:** https://flinnymusic-alt.github.io/Yo/inkdojo.html (add `?v=N` for a fresh copy; the last one used was `?v=9`)
- **claude.ai Artifact:** https://claude.ai/artifact/KLmvzmpV49ZY4sLsHeNvrU
- A duplicate Artifact, https://claude.ai/artifact/S3ynonYsvUxZ2UHdP7WvAm, was made by mistake. The owner hasn't said yet whether to delete it.

## Files

- `inkdojo.html` (repo root) is **built**. Never edit it by hand.
- `inkdojo/src/` holds the sources. `python3 inkdojo/build.py` joins them into `inkdojo.html`, and also writes `inkdojo/build/page.html`, the version used for the Artifact.
- `inkdojo/tests/` holds Playwright and Node checks. They write screenshots to `inkdojo/tests/out/`; `build/` and `out/` aren't committed.

What each source file holds (they're concatenated in this order: `lib`, `a`, `b`, `m`, `c`, `d`, `fx`, `e`, `f`, `q`, `g`):

| File | What's in it |
|---|---|
| `lib.js` | The four ways (`WAYS`), **all 80 moves** (`MOVES`), the tiers, and the **reader**: `recognize` (`CLEAN` 0.8 / `ROUGH` 0.42), `accuracy` and `powerOf` (the power curve), `curlCut` (finds the little curl that holds an attack), `withCurl` (adds one, for tests), and `writeOut`, a believable hand used by demos, tests and bots |
| `game_a.js` | Screen layout, sound, **tilt to walk** (iPhone permission via a hidden real button), saves (`inkdojo-adv-1`), `learnedCount` (which moves you know) |
| `game_b.js` | The dojo map (`paintDojo`, `DOJO_SOLIDS`), `blocked` (walls, round and square solids, the pond), the camera. `SCENE` and `WORLD` say which place is on screen |
| `game_m.js` | The other places: `SCENES` (valley `home`, `town`, `dojo`: size, arrival spots, exits), their solids and floors, drawing pines, houses and stalls, the exits, `enterScene` |
| `game_c.js` | Fighters: `RANKS` (belts), `WAYMOD` (each way's damage, health, speed, plus `beast`), `HALL` and `YOU` (difficulty tuning), `skillAt(k)`, statuses, drawing fighters and wolves |
| `game_d.js` | The **spell engine**: timings, `HOLD` (which attacks a curl can hold), every spell (`SPELL`), hits (`hurt`), statuses, ki flow, and the **fighters' minds** (`AIH`, `aiChoose`, `aiFight`; a fighter with a `kit` uses only that) |
| `game_fx.js` | Particles, decals, and drawing zones, waves, stones, summons, shots and beams |
| `game_e.js` | The paper pad: brush ink, pools, pressure, `padJudge` (read on lift, curl → held), `HELD`, `releaseHeld`, the held seal |
| `game_f.js` | Game flow: who challenges you, fights, lessons, falls, the per-frame `update`, rendering, HUD (goal box), the arrow to the goal |
| `game_q.js` | **The story**: stages `Q`, the wolves (`WOLF_KIT`), the bandits, the people and what they say (`npcTalk`, `npcIdle`), `skillFor`, `wonAgainst`, `fellTo`, the ambush, `goal()` |
| `game_g.js` | Title, overlays (MOVES scroll, move cards, lessons, talk, fallen, the end), input, and the test hooks on `window.INKDOJO` |

## How it plays now

- **Ways.** Water beats Fire, Fire beats Air, Air beats Earth, Earth beats Water (`ADV`). Each way has its twist (Water soaks and freezes; Fire's heat; Earth's stones; Air's wind) and refills ki its own way (`kiFlow`).
- **Power curve.** Accuracy runs from 0% (just readable) to 100% (`accuracy(q)`, q 0.42 → 0.985). Power is `0.4 + 0.25a + 1.35a⁴`: a scrappy glyph ×0.6, a fair one ×1.0, a very good one ×1.5, a perfect one (97%+) ×2 with a gold "Perfect!" burst. The panel shows `Clean · 91% · ×1.5`. Fighters don't write; their strength is `skillAt(k).power` (0.6 to 1).
- **The curl.** End an attack (any tag in `HOLD`) with a small loop and it's held instead of thrown: ki is paid now, and a red seal by the top right of the pad throws it at the strength it was written (tap it, or Space). One held at a time. A stroke counts as curled only if cutting the loop off reads *better* than the whole stroke, so moves that end in loops (Meteor, Geyser) are unaffected.
- **The story, step by step** (`save.q`): 0 talk to Mum → 1 the road and town (three wolves, `skillAt(0)` × 0.8 health) → 2 the postmaster sends you to the dojo → white belts (`skillAt(1..4)`), each teaching a move → 3 collect the package → 4 the ambush on the road home: Crow, Tusk, then the boss Kagero (`BANDIT_TUNE`: `skillAt` 7.5, 8.5, 9.5, so late brown belts and a black-belt boss), a quarter of your health back between them. They're meant to be decently hard. Their ways are chosen from yours so none beats you (`banditWays`). Fall, and you wake at the top of the road and they ambush again → 5 home to Mum → 6 the end.
- **Moves known.** The three basic moves, plus one from Old Hana the calligrapher (who also explains the curl), plus one per white belt: 8 by the bandits. The brown and black belts are in the dojo but wave you off.
- **People.** Walk up to someone and they talk once at each point in the story (`save.heard`); after that a line shows in a bubble as you pass.

## Testing

Run these from `inkdojo/tests/` after `python3 ../build.py`. Use `timeout` (some run for minutes).

| Test | What it checks | Expected now |
|---|---|---|
| `node smoke.js` | Loads, no errors | `errors []` |
| `node adventure.js water` (any way) | The bot plays the whole story; screenshots in `out/adv/` | ends `q 6`, overlay `end`, `errors []` |
| `node play1.js water` (any way) | Real time on a phone screen: Mum, the first wolf, a curled attack held and thrown with a tap | wolf beaten, `thrown`, `errors []` |
| `node ui.js` | Touch: pick a way, Mum, walk, write with a finger, a finger-drawn curl and a tap on the seal, the scroll, lose to a wolf, the end | `held: Rock Throw`, `thrown`, `end 6` |
| `node road.js 12` | Each fight of the story, many times, bot at a human pace | wolves and white belts: every hand wins. All three bandits in one go: neat hand 81–94%, `WOB=0.05` 31–69%, `WOB=0.08` 6–31% |
| `WOB=0.1 THINK='[2.4,3.6]' REACT=0.15 node road.js 16` | The same with a rough, slow "beginner" | wolves and white belts 100%; the bandits mostly beat them |
| `BK=7,8,9 REST=0.3 ONLY=bandits node road.js 16` | Try other bandit strengths and breathers without rebuilding | |
| `node practice.js` | Every spell cast outside a fight | `none` stuck |
| `node hot.js`, `node panel.js` | Reload while playing; the pad panel | `errors []` |
| `node tilt.js`, `node tilt2.js` | Tilt to walk, including the iPhone permission flow | moves the right ways |
| `node calib.js water` (any way) | Every move written neatly or roughly reads as itself; scribbles fizzle | `moves needing work: 0` |
| `node cross.js` | No move reads **cleanly** as another way's move | 0 clean (rough look-alikes are fine) |
| `node gallery.js fire` | Casts each spell at a target; contact sheet in `out/gal/` | look at the sheet |
| `node duel.js 150` | Way against way, both played by the same AI (balance) | each way about 47–55%; "beats" pairs about 58–65% |

`botpower.js` and `wobpower.js` show how strongly the test bot writes. `perf.js` checks frame rate. `sheet2.js` makes a contact sheet from screenshots.

Tests drive the game through `window.INKDOJO`: `begin(way)`, `close()`, `manual(true)` plus `step(n)` to run frames without real time (overlay buttons only exist after a real frame, so in manual mode use `talkNext()`, `afterLearn()`, `afterFall()`), `castAs(who, 'way:key', P)`, `write(key, { curl })`, `held`, `heldBtn()`, `releaseHeld()`, `bot()`/`botStep()`/`aiPlayer()`, `startFight(f)`, `koFoe()`, `skillAt(k)`, `skillFor(f)`, `scene`, `enterScene(name, spot)`, `npcs`, `goal()`, `Q`, `dmgLog(on)` (damage by spell). The tuning tables (`WAYMOD`, `ADV`, `HALL`, `YOU`, `RANKS`) are exposed so tests can try values without rebuilding.

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
- Earlier balance reasoning in short: the AI-vs-AI duels keep the kits fair against each other; `HALL` and `YOU` tune what a human actually feels. The power curve made neat writers much stronger than before; the story's fights were tuned with `road.js` so a beginner can still get through.
- The old dojo-only game (Ren, belts in order, the Grandmaster) is gone; its tests (`curve`, `endgame`, `flow`, `tiers`, `balance2`) were removed with it. `RANKS[4]` and `WAYMOD.master` are still there for a later chapter.
