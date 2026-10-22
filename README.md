# Free Fruit Finder

A shared map of free fruit trees. Anyone can drop a pin on a tree, add a photo, say what fruit it is and whether it's fruiting, and leave notes on when it's ripe. Each pin links to Google Maps directions.

No accounts, no API keys, no AI. Plain HTML/CSS/JS on the front end and one small serverless function on the back end.

## Run it on your computer

Needs [Node.js](https://nodejs.org) 20 or newer.

```sh
npm start
```

Open http://localhost:8888. Data is saved in the `.data/` folder. You don't need `npm install` to run it locally.

Location ("Near me", "Use my location") only works on `localhost` or an `https://` site. Browsers block it on plain `http://`.

## Put it online (Netlify, free tier)

1. Push this repo to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and pick the repo. The settings come from `netlify.toml`, so leave the build settings as they are.
3. Deploy. Trees and photos are stored in Netlify Blobs, which needs no setup.
4. Optional: in **Site configuration → Environment variables**, add `ADMIN_TOKEN` (16+ random characters). You can then remove any tree by sending that token, for moderation (see below).

## How it works

| Piece | What it does |
| --- | --- |
| `public/index.html`, `app.css`, `app.js` | The whole app: map, filters, list, add-a-tree form, tree details and notes |
| `public/vendor/leaflet/` | The map library ([Leaflet](https://leafletjs.com) 1.9.4 and MarkerCluster 1.5.3), bundled so it doesn't depend on a CDN |
| `netlify/functions/api.mjs` | The API, and the only server code |
| `server.mjs`, `dev/file-store.mjs` | Local server that runs the same API using files instead of Netlify Blobs |
| `test/api.test.mjs` | API tests: `npm test` |

**Location features (all plain code):**
- **Pin from photo.** If a phone photo has GPS data, the pin is placed automatically.
- **Use my location.** Uses the browser's GPS, then you drag the pin onto the exact tree.
- **City.** Filled in from the pin using OpenStreetMap's free [Nominatim](https://nominatim.org) lookup. People can edit it if it's wrong. The city filter is built from these.
- **Near me.** Centers the map on you. The list shows the trees in view, closest first.
- **Directions.** Every pin and tree page links to Google Maps directions to its exact coordinates.

**Safeguards:**
- Inputs are length-limited and cleaned. Photos must really be JPG, PNG or WebP (checked by file contents), and are shrunk in the browser before upload (about 200–500 KB).
- The same fruit posted within 12 m of an existing one is treated as a duplicate. The poster is sent to the existing tree to add a note instead.
- Simultaneous posts never overwrite each other (conditional writes with automatic retry).
- Only the person who posted a tree can remove it. Their browser keeps a private edit key. The site owner can remove any tree with `ADMIN_TOKEN`.
- A hidden form field quietly drops most spam bots.

**Removing a tree as admin:**
```sh
curl -X DELETE https://YOUR-SITE.netlify.app/api/trees/TREE_ID -H "x-edit-token: YOUR_ADMIN_TOKEN"
```
The tree ID is in the tree's share link (`#tree-<id>`).

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/trees` | All trees |
| POST | `/api/trees` | Multipart form: `fruit`, `place`, `city`, `lat`, `lng`, `status` (`yes`/`no`), optional `note`, `name`, `photo`, `thumb` |
| GET | `/api/trees/:id/notes` | Notes, newest first |
| POST | `/api/trees/:id/notes` | JSON `{ text, status, name }`; a status updates the tree |
| DELETE | `/api/trees/:id` | Header `x-edit-token` |
| GET | `/api/photos/:id` and `/api/photos/:id-t` | Full photo and thumbnail |

## Limits to know about

- **Map tiles** come from OpenStreetMap's free servers, which are fine for a small community site. If the site gets busy (thousands of daily users), switch `TILE_URL` in `app.js` to a hosted tile provider such as MapTiler or Stadia Maps (both have free tiers).
- **City lookup** uses Nominatim's free service (at most 1 lookup per second across the site). If it's unavailable, people type the city themselves.
- All trees load in one request. That's fast up to several thousand trees, and the app caps the map at 20,000.
- There's no login, so anyone can post. Moderation is through `ADMIN_TOKEN`.
