# Yo: two games in one repo

This repo holds two separate browser games. Each one has its own thread (Claude Code session) and its own notes. Read the notes for your game before you change anything:

| Game | What you edit | Notes |
|---|---|---|
| **Ink Dojo**: a calligraphy fighting game | `inkdojo/src/*.js`, then build `inkdojo.html` | `inkdojo/README.md` |
| **Space Wizard**: the pentagram wizard battle game (adventure, friends, Hollowbrook) | `pentagram.html` (edited directly), plus its try-it page `scribe.html` | `spacewizard/README.md` |

`game.html` is an old, unrelated survival game (the Pages site also serves it as `index.html`). Leave it alone.

**Work only on your own game's files.** Both games publish through the same `gh-pages` branch, so always pull before you push there (your notes say how).

## Where the latest work is

The newest version of both games is on the branch `claude/pentagram-spell-combos-nbk0ml`. The repo's default branch (`claude/survival-game-nVjXA`) is old. Start your work from the newest branch:

```
git fetch origin claude/pentagram-spell-combos-nbk0ml
git checkout -B <your-branch> origin/claude/pentagram-spell-combos-nbk0ml
```

## How the owner likes to work

- **Ideas get options first.** When asked for a design change ("these are just ideas"), give a short set of options with a recommendation, and let them choose before building. Plain bugs can just be fixed.
- **Reports in plain words.** Lead with what changed and the Play link. Add `?v=N` to the link so the phone doesn't show an old copy. Keep reports short, and keep numbers to the few that matter.
- **Phone first.** They play on an iPhone: touch, tilt, small screens.
- **Publish every change** (see your notes): commit and push your branch, update the Pages copy, update the claude.ai Artifact, and confirm the Pages deploy finished.
- Don't open pull requests unless asked. Don't put model names in commit messages.
