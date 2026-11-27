# massive group chat

*the original social network*

A fake, old-school social network for messing around with friends. You get a page you can dress up, a drawing pad to draw your face, a beat maker whose loop plays at the top of your page, and a text feed your friends can comment on and like.

> **This is a pretend site. It is not secure.** Don't put anything real on it: no real names, addresses, phone numbers, passwords you use anywhere else, or bank or card details. The site says this on every page.

## Run it

Needs [Node.js](https://nodejs.org) 22.13 or newer. There's nothing to install: the database is the SQLite built into Node.

```sh
npm start        # http://localhost:8080
npm test         # API tests
npm run demo     # builds demo/demo.html, a playable preview with pretend friends and no server
```

Everything is saved in `data.db`, one file. To back up, copy it while the server is stopped.

## Put it online

It needs a small always-on server with a disk, because the database is a file. A $4–6/month VPS, Fly.io or Railway with a volume, or a Raspberry Pi at home all work. Netlify and other serverless hosts won't, because they have no disk that lasts.

With Docker:

```sh
docker build -t groupchat .
docker run -p 8080:8080 -v groupchat-data:/data groupchat
```

Put it behind HTTPS (Caddy, or your host's built-in HTTPS) so passwords aren't sent in the clear.

| Setting | Default | |
| --- | --- | --- |
| `PORT` | `8080` | |
| `DB_FILE` | `./data.db` | Where the database lives |
| `TRUST_PROXY` | off | Set to `1` behind a proxy or HTTPS terminator, so login cookies are marked secure and rate limits see real addresses |
| `SIGNUPS_PER_HOUR` | `30` | Sign-ups allowed per internet address per hour |
| `FIRST_FRIEND` | none | A username every new member starts out friends with, like MySpace's Tom. Set it to your own username. |

## What's in it

| Piece | |
| --- | --- |
| `server.mjs` | The whole back end: accounts, friends, groups, posts, comments, likes, blocks, drawings, beats. No packages. |
| `public/app.js` | The whole front end: plain JavaScript, no libraries. Beats are synthesized in the browser, so no audio files are stored. |
| `public/style.css`, `index.html` | Look and shell |
| `test/api.test.mjs` | API tests |
| `demo/` | The preview: `fake-api.js` answers the same requests as the server, but inside the browser, with made-up people. `build.mjs` joins it to the real front end in one file. |

**How it works**
- **Friends.** Two people are friends when both have added each other. Signing up through someone's invite link (`/join/username`) makes you friends straight away.
- **Feed.** You only see posts from friends. Posts are text only.
- **Groups.** Everyone starts with "Friends" and "Family" and can add more. A post goes to all your friends, or only to the groups you pick. The feed can be filtered by group. If you take someone out of a group, they stop seeing posts sent to it.
- **Blocking.** Blocking unfriends both of you and hides each person's page, posts and comments from the other. There's no report button. Block and move on.
- **Friends Comments.** The comment wall at the bottom of each page ("Thanks for the add!"). Only the page owner's friends can see it or write on it. The owner can delete any comment on it.
- **MySpace extras.** Profile views (each visitor counts once every 6 hours), a mood with an emoticon, and a Top 4, 8, 12 or 16.
- **Deleting.** You can delete your own posts and comments, comments on your posts, your drawings, your beats and your whole account.
- **Pages.** Any logged-in member can see anyone's page except people who blocked them. Posts on a page only show to people the post was shared with.
- **Drawings.** 300×300, black and white. Use one as your pic, or as your page background (tiled like a mosaic, or one big image), tinted with your background color.
- **Beats.** 16 steps: 4 drum sounds, bass, and 3 synths with 5 sounds to choose from. The notes are on a pentatonic scale so it always sounds OK. Each beat is stored as about 200 bytes of numbers.

**Safety basics (still not a secure site):** passwords are hashed with scrypt; login cookies are HttpOnly and SameSite; pages only run the site's own scripts (CSP); everything people type is shown as plain text; profile colors and fonts are picked from fixed choices; sign-ups, logins and posting are rate limited.
