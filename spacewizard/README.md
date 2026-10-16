# Space Wizard

A wizard battle game for phones. You cast spells by **tracing runes on a pentagram**: each point is an element (Spirit, Water, Fire, Earth, Air), and a spell is a sequence of them, like `FFA` for Fireball. In battles against the computer you can instead **write brush glyphs** ("Scribing"). Every attack has an element. Each element beats the next round the cycle Water → Fire → Air → Earth → Spirit → Water (2.5× damage one way, 0.4× the other).

- **Play:** https://flinnymusic-alt.github.io/Yo/pentagram.html (add `?v=N` for a fresh copy)
- **Scribing Dojo (try-it page):** https://flinnymusic-alt.github.io/Yo/scribe.html
- **claude.ai Artifacts:**
  - Space Wizard: https://claude.ai/artifact/SzJqihtGueCq3csDZiC9eN
  - Scribing Dojo: https://claude.ai/artifact/4SKZZcva6pg2RuZSGYmF2q

## Files

- `pentagram.html` (repo root) **is the game**: one file, about 15,000 lines, no build step. Edit it directly.
- `scribe.html` is the Scribing Dojo: a stand-alone page for trying casting by brush shape.
- `spacewizard/ADVENTURE_PLAN.md` holds the design notes for the Adventure mode (gates, titans, spell lines).

The previous thread edited `pentagram.html` with small Python patch scripts that replace exact text and check it matched once:

```python
p = '/home/user/Yo/pentagram.html'; s = open(p).read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:100], s.count(a)); s = s.replace(a, b)
rep("old exact text", "new text")
open(p, 'w').write(s)
```

## What's in the game

The file is organised in sections that start with `// ── name ──` comments. Search for these:

- **Battle** (`battle mode`): your team against the computer's (two or three teams), with minions, titans, turrets, territory, an eclipse clock and "resonance" team powers.
  - Difficulty runs Easy, Medium, Hard, Very Hard. On Hard and Very Hard the computer's wizards cast the whole spell book, and on Very Hard red thinks as one army.
  - On the Battle page you choose to cast with **the pentagram or Scribing** (`Scribing in battle`; 15 glyphs, each mapped to a spell in `SCRIBE_SPELL`).
- **Play with Friends**: up to three phones; the host's device runs the battle.
  - Joining uses a lobby code or an invite link `#join=CODE`.
  - Phones connect peer to peer with PeerJS and Trystero. When that fails, a backup route runs over public MQTT brokers on secure websockets.
- **Adventure** (New Adventure / Continue):
  - **The Sanctum:** five element gates. Each opens onto arenas with three titans, then a minion wave.
  - **The Wide World:** hills, rivers, a boat, sea serpents, rivals, roaming packs, waystones and a map.
  - **Hollowbrook:** the Spell School duels, the Scribe's House with the spell book, the Healing House, and teachers.
  - **Elsewhere in the world:** about 30 folk who need help, tokens and minion coins, and Barnaby's spell stall.
- **Brush Lab**: a tester for casting with a brush (on the title screen).
- **How to Play**: a quick start with moving pictures.
- **Looks**: Wizard or Space. Sound is synthesised, so there are no asset files.

Saves live in the phone's `localStorage` under keys starting with `pentagram-` (the Scribing Dojo uses `scribe-names`).

## Testing

The previous thread drove the game with Playwright scripts. The game's script isn't wrapped in a function, so a test can read and call its globals directly: `mode`, `state`, `difficulty`, `player`, `friends`, `foes`, `titleButtons`, `tick(dt)` and so on. The Scribing code is inside `const DOJO = (() => { ... })()`. For example:

```js
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/user/Yo/pentagram.html'); await p.waitForTimeout(300);
  const btn = await p.evaluate(() => titleButtons.map(b => [b.title, b.x + b.w / 2, b.y + b.h / 2]));
  const bt = btn.find(x => x[0] === 'Battle'); await p.mouse.click(bt[1], bt[2]);
  const r = await p.evaluate(() => { for (let i = 0; i < 1200; i++) tick(0.05); return [state, friends.length, foes.length]; });
  console.log(r, errs); await b.close();
})();
```

Check on a phone-sized screen (390×844) as well as a wide one. For Play with Friends, test with two browser pages.

## Publishing a change

1. Commit on your branch, then push with `git push -u origin <branch>`.
2. **Pages:** in a separate worktree, copy `pentagram.html` (and/or `scribe.html`) over the old one, commit, then pull and push:
   ```
   git fetch origin gh-pages
   git worktree add <scratch>/ghp origin/gh-pages -B gh-pages
   cp pentagram.html <scratch>/ghp/ && cd <scratch>/ghp && git add pentagram.html && git commit -m "..."
   git pull --rebase origin gh-pages && git push origin gh-pages
   ```
   The Ink Dojo thread also pushes to `gh-pages`, so always pull first. Only ever touch your own files there.
3. **Artifact:** publish `pentagram.html` with `url` https://claude.ai/artifact/SzJqihtGueCq3csDZiC9eN, and `scribe.html` with `url` https://claude.ai/artifact/4SKZZcva6pg2RuZSGYmF2q when it changes. In a new conversation, read each one first; the tool refuses otherwise.
4. **Confirm the deploy.** The sandbox can't open github.io, so ask GitHub Actions instead:
   ```
   timeout 300 bash -c 'until gh api "repos/flinnymusic-alt/Yo/actions/runs?branch=gh-pages&per_page=1" --jq ".workflow_runs[0] | [.head_sha[0:7], .status, .conclusion] | @tsv" | grep -E "^<sha>\scompleted"; do sleep 5; done'
   ```
5. Tell the owner what changed, with the Play link and a new `?v=`.

## Recent history

Run `git log --oneline -- pentagram.html scribe.html` for the full history. The latest Space Wizard work was:

- Scribing in battle: write glyphs with a brush instead of using the pentagram
- The Scribing Dojo page and the Brush Lab
- Online play that no longer falls behind on slow links
- Tokens, Barnaby's spell stall, and a scribe who can't tell a spell from a fizzle
- Folk who need help all over the world; Hollowbrook's halls
- The Adventure mode: the Sanctum's five elements, then the Wide World
- Three-player battles and Play with Friends with a backup route
