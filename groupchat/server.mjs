// massive group chat: the whole server. No npm packages. Needs Node 22.13+ (built-in SQLite).
// Run: npm start  →  http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const DB_FILE = process.env.DB_FILE || path.join(ROOT, 'data.db');
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // set when behind a proxy that sets x-forwarded-*
const SIGNUPS_PER_HOUR = Number(process.env.SIGNUPS_PER_HOUR) || 30; // per internet address (friends on one wifi share one)
const FIRST_FRIEND = process.env.FIRST_FRIEND || ''; // a username every new member starts out friends with (MySpace's "Tom")
const DAY = 864e5;
const SESSION_DAYS = 60;
const scrypt = promisify(crypto.scrypt);

// ---------- database ----------
if (DB_FILE !== ':memory:') fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, pass TEXT NOT NULL,
  pic INTEGER, prof TEXT NOT NULL DEFAULT '{}', seen INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  created INTEGER NOT NULL) WITHOUT ROWID;
-- a added b. Two rows (a→b and b→a) = friends. One row = a friend request.
CREATE TABLE IF NOT EXISTS adds(a INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  b INTEGER NOT NULL REFERENCES users ON DELETE CASCADE, created INTEGER NOT NULL, PRIMARY KEY(a,b)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS adds_b ON adds(b,a);
CREATE TABLE IF NOT EXISTS blocks(a INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  b INTEGER NOT NULL REFERENCES users ON DELETE CASCADE, PRIMARY KEY(a,b)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS grps(id INTEGER PRIMARY KEY, uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE, name TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS grps_uid ON grps(uid);
CREATE TABLE IF NOT EXISTS members(gid INTEGER NOT NULL REFERENCES grps ON DELETE CASCADE,
  uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE, PRIMARY KEY(gid,uid)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS members_uid ON members(uid);
-- aud=0: all my friends. aud=1: only friends in the groups listed in post_aud.
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  body TEXT NOT NULL, aud INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS posts_uid ON posts(uid,id);
CREATE TABLE IF NOT EXISTS post_aud(pid INTEGER NOT NULL REFERENCES posts ON DELETE CASCADE,
  gid INTEGER NOT NULL REFERENCES grps ON DELETE CASCADE, PRIMARY KEY(pid,gid)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, pid INTEGER NOT NULL REFERENCES posts ON DELETE CASCADE,
  uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE, body TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS comments_pid ON comments(pid,id);
-- kind 0 = post, 1 = comment
CREATE TABLE IF NOT EXISTS likes(kind INTEGER NOT NULL, tid INTEGER NOT NULL, uid INTEGER NOT NULL,
  PRIMARY KEY(kind,tid,uid)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS drawings(id INTEGER PRIMARY KEY, uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  png BLOB NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS drawings_uid ON drawings(uid,id);
CREATE TABLE IF NOT EXISTS beats(id INTEGER PRIMARY KEY, uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  name TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS beats_uid ON beats(uid,id);
-- "Friends Comments" on someone's page
CREATE TABLE IF NOT EXISTS wall(id INTEGER PRIMARY KEY, owner INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  uid INTEGER NOT NULL REFERENCES users ON DELETE CASCADE, body TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS wall_owner ON wall(owner,id);
`);
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'views')) db.exec('ALTER TABLE users ADD COLUMN views INTEGER NOT NULL DEFAULT 0');

const stmts = new Map();
const st = sql => stmts.get(sql) || stmts.set(sql, db.prepare(sql)).get(sql);
const all = (sql, ...p) => st(sql).all(...p);
const get = (sql, ...p) => st(sql).get(...p);
const run = (sql, ...p) => st(sql).run(...p);
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ---------- small helpers ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const now = () => Date.now();
function text(v, max, what) {
  if (v == null) return '';
  if (typeof v !== 'string') fail(400, `${what} must be text.`);
  v = v.replace(/\r\n?/g, '\n').trim();
  if (v.length > max) fail(400, `${what} is too long (max ${max} characters).`);
  return v;
}
function num(v) {
  v = Number(v);
  if (!Number.isInteger(v) || v < 1) fail(400, 'Bad id.');
  return v;
}

const hits = new Map(); // simple rate limits, in memory
function limit(key, max, ms) {
  const t = now();
  let h = hits.get(key);
  if (!h || h.reset < t) hits.set(key, (h = { n: 0, reset: t + ms }));
  if (++h.n > max) fail(429, 'Slow down a bit and try again soon.');
}
setInterval(() => { const t = now(); for (const [k, h] of hits) if (h.reset < t) hits.delete(k); }, 6e5).unref();

const ipOf = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;

// ---------- accounts & sessions ----------
async function hashPass(p) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + (await scrypt(p, salt, 32)).toString('hex');
}
async function checkPass(p, stored) {
  const [salt, key] = stored.split(':');
  return crypto.timingSafeEqual(await scrypt(String(p), Buffer.from(salt, 'hex'), 32), Buffer.from(key, 'hex'));
}
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const isHttps = req => (TRUST_PROXY ? req.headers['x-forwarded-proto'] === 'https' : !!req.socket.encrypted);
function cookie(req, res, token, maxAge) {
  res.setHeader('set-cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`);
}
function startSession(req, res, uid) {
  const token = crypto.randomBytes(24).toString('base64url');
  run('INSERT INTO sessions(token,uid,created) VALUES(?,?,?)', sha(token), uid, now());
  cookie(req, res, token, SESSION_DAYS * 86400);
}
const seenAt = new Map();
function auth(req) {
  const m = /(?:^|;\s*)sid=([\w-]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const token = sha(m[1]);
  const u = get('SELECT u.id, u.name, s.created FROM sessions s JOIN users u ON u.id=s.uid WHERE s.token=?', token);
  if (!u) return null;
  if (u.created < now() - SESSION_DAYS * DAY) { run('DELETE FROM sessions WHERE token=?', token); return null; }
  const t = now();
  if ((seenAt.get(u.id) || 0) < t - 6e4) { seenAt.set(u.id, t); run('UPDATE users SET seen=? WHERE id=?', t, u.id); }
  return { id: u.id, name: u.name, token };
}
const meInfo = uid => ({
  ...get('SELECT id, name, pic FROM users WHERE id=?', uid),
  requests: get('SELECT count(*) n FROM adds x WHERE x.b=? AND NOT EXISTS(SELECT 1 FROM adds WHERE a=x.b AND b=x.a)', uid).n,
  groups: all('SELECT id, name FROM grps WHERE uid=? ORDER BY id', uid),
});

// ---------- relationships ----------
const added = (a, b) => !!get('SELECT 1 FROM adds WHERE a=? AND b=?', a, b);
const isFriend = (a, b) => added(a, b) && added(b, a);
const blockedEither = (a, b) => !!get('SELECT 1 FROM blocks WHERE (a=? AND b=?) OR (a=? AND b=?)', a, b, b, a);
const userNamed = name => get('SELECT id, name, pic, prof, seen, created, views FROM users WHERE name=?', String(name)) || fail(404, 'No one has that username.');
function unfriend(a, b) {
  run('DELETE FROM adds WHERE (a=? AND b=?) OR (a=? AND b=?)', a, b, b, a);
  run('DELETE FROM members WHERE (uid=? AND gid IN (SELECT id FROM grps WHERE uid=?)) OR (uid=? AND gid IN (SELECT id FROM grps WHERE uid=?))', b, a, a, b);
}

// ---------- posts: who can see what ----------
// My circle = my friends + me. A post is visible if its author is in my circle and either it's mine,
// it went to all friends, or I'm in one of the author's groups it was sent to.
const CIRCLE = '(SELECT b FROM adds WHERE a=$me INTERSECT SELECT a FROM adds WHERE b=$me UNION SELECT $me)';
const AUD_OK = '(p.uid=$me OR p.aud=0 OR EXISTS(SELECT 1 FROM post_aud pa JOIN members m ON m.gid=pa.gid WHERE pa.pid=p.id AND m.uid=$me))';
const canSee = (me, pid) => get(`SELECT p.id, p.uid FROM posts p WHERE p.id=$pid AND p.uid IN ${CIRCLE} AND ${AUD_OK}`, { me, pid });

function feed(me, { author = 0, group = 0, before = 0, limit: n = 20 }) {
  const posts = all(`SELECT p.id, p.uid, u.name, u.pic, p.body, p.created,
      CASE WHEN p.uid=$me AND p.aud=1 THEN (SELECT json_group_array(gid) FROM post_aud WHERE pid=p.id) END aud,
      (SELECT count(*) FROM likes WHERE kind=0 AND tid=p.id) likes,
      EXISTS(SELECT 1 FROM likes WHERE kind=0 AND tid=p.id AND uid=$me) liked
    FROM posts p JOIN users u ON u.id=p.uid
    WHERE p.uid IN ${CIRCLE} AND ${AUD_OK}
      AND ($author=0 OR p.uid=$author)
      AND ($group=0 OR p.uid IN (SELECT m.uid FROM members m JOIN grps g ON g.id=m.gid WHERE g.id=$group AND g.uid=$me))
      AND ($before=0 OR p.id<$before)
    ORDER BY p.id DESC LIMIT $n`, { me, author, group, before, n: n + 1 });
  const more = posts.length > n;
  if (more) posts.pop();
  const byId = new Map();
  for (const p of posts) { p.aud = p.aud ? JSON.parse(p.aud) : null; p.comments = []; byId.set(p.id, p); }
  if (posts.length) {
    const cs = all(`SELECT c.id, c.pid, c.uid, u.name, u.pic, c.body, c.created,
        (SELECT count(*) FROM likes WHERE kind=1 AND tid=c.id) likes,
        EXISTS(SELECT 1 FROM likes WHERE kind=1 AND tid=c.id AND uid=$me) liked
      FROM comments c JOIN users u ON u.id=c.uid
      WHERE c.pid IN (SELECT value FROM json_each($ids))
        AND NOT EXISTS(SELECT 1 FROM blocks WHERE (a=$me AND b=c.uid) OR (a=c.uid AND b=$me))
      ORDER BY c.id`, { me, ids: JSON.stringify([...byId.keys()]) });
    for (const c of cs) byId.get(c.pid).comments.push(c);
  }
  return { posts, more };
}

// ---------- profile & beats validation ----------
const COLORS = ['bg', 'box', 'head', 'accent', 'text', 'link'];
const FONTS = ['verdana', 'arial', 'georgia', 'times', 'courier', 'comic', 'trebuchet', 'impact'];
const TEXTS = { headline: 120, mood: 40, bio: 3000, about: 3000, who: 3000, know: 3000 };
const INTERESTS = ['general', 'music', 'movies', 'tv', 'books', 'heroes'];
const ownDrawing = (uid, v) => (v == null ? null : (get('SELECT id FROM drawings WHERE id=? AND uid=?', num(v), uid) || fail(400, 'That drawing is gone.')).id);

const int16 = v => Number.isInteger(v) && v >= 0 && v < 65536;
const rowsOk = (a, n) => Array.isArray(a) && a.length === n && a.every(int16);
function cleanBeat(d) {
  if (!d || typeof d !== 'object') fail(400, 'Bad beat.');
  const { bpm, key, scale, s } = d;
  if (!(Number.isInteger(bpm) && bpm >= 60 && bpm <= 200 && Number.isInteger(key) && key >= 0 && key < 12 &&
    (scale === 0 || scale === 1) && rowsOk(d.d, 4) && rowsOk(d.b, 8) && Array.isArray(s) && s.length === 3 &&
    s.every(x => x && Number.isInteger(x.p) && x.p >= 0 && x.p < 5 && rowsOk(x.r, 8)))) fail(400, 'Bad beat.');
  return { bpm, key, scale, d: d.d, b: d.b, s: s.map(x => ({ p: x.p, r: x.r })) };
}

// ---------- API routes ----------
const routes = [];
const route = (method, pattern, fn, open = false) =>
  routes.push({ method, re: new RegExp('^/api' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn, open });

route('POST', '/signup', async ({ req, res, body: b }) => {
  limit('signup:' + ipOf(req), SIGNUPS_PER_HOUR, 36e5);
  if (b.ok !== true) fail(400, 'Tick the box to show you understand this site is fake and not secure.');
  const name = String(b.name || '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) fail(400, 'Usernames are 3–20 letters, numbers or _.');
  const pass = String(b.pass || '');
  if (pass.length < 4 || pass.length > 200) fail(400, 'Passwords need at least 4 characters.');
  if (get('SELECT 1 FROM users WHERE name=?', name)) fail(409, 'That username is taken.');
  const hash = await hashPass(pass);
  const inviter = b.invite ? get('SELECT id FROM users WHERE name=?', String(b.invite)) : null;
  const first = FIRST_FRIEND ? get('SELECT id FROM users WHERE name=?', FIRST_FRIEND) : null;
  const uid = tx(() => {
    if (get('SELECT 1 FROM users WHERE name=?', name)) fail(409, 'That username is taken.');
    const t = now();
    const id = Number(run('INSERT INTO users(name,pass,created) VALUES(?,?,?)', name, hash, t).lastInsertRowid);
    run("INSERT INTO grps(uid,name) VALUES(?, 'Friends'), (?, 'Family')", id, id);
    for (const f of [inviter, first]) if (f) run('INSERT OR IGNORE INTO adds(a,b,created) VALUES(?,?,?), (?,?,?)', id, f.id, t, f.id, id, t);
    return id;
  });
  startSession(req, res, uid);
  return meInfo(uid);
}, true);

route('POST', '/login', async ({ req, res, body: b }) => {
  limit('login:' + ipOf(req), 30, 6e5);
  const u = get('SELECT id, pass FROM users WHERE name=?', String(b.name || '').trim());
  if (!u || !(await checkPass(b.pass, u.pass))) fail(401, 'Wrong username or password.');
  startSession(req, res, u.id);
  return meInfo(u.id);
}, true);

route('POST', '/logout', ({ req, res, me }) => {
  if (me) run('DELETE FROM sessions WHERE token=?', me.token);
  cookie(req, res, '', 0);
}, true);

route('GET', '/invite/:name', ({ params }) => ({ name: userNamed(params[0]).name }), true);

route('GET', '/me', ({ me }) => (me ? meInfo(me.id) : null), true);

route('DELETE', '/me', async ({ req, res, me, body: b }) => {
  const u = get('SELECT pass FROM users WHERE id=?', me.id);
  if (!(await checkPass(b.pass || '', u.pass))) fail(401, 'Wrong password.');
  tx(() => {
    run('DELETE FROM likes WHERE uid=?', me.id);
    run('DELETE FROM likes WHERE kind=0 AND tid IN (SELECT id FROM posts WHERE uid=?)', me.id);
    run('DELETE FROM likes WHERE kind=1 AND tid IN (SELECT c.id FROM comments c JOIN posts p ON p.id=c.pid WHERE c.uid=? OR p.uid=?)', me.id, me.id);
    run('DELETE FROM users WHERE id=?', me.id);
  });
  cookie(req, res, '', 0);
});

route('GET', '/feed', ({ me, url }) => feed(me.id, {
  group: Number(url.searchParams.get('g')) || 0,
  before: Number(url.searchParams.get('before')) || 0,
}));

route('POST', '/posts', ({ me, body: b }) => {
  limit('w:' + me.id, 120, 6e5);
  const body = text(b.body, 2000, 'Your post');
  if (!body) fail(400, 'Write something first.');
  const groups = [...new Set((Array.isArray(b.groups) ? b.groups : []).map(num))];
  if (groups.length > 20) fail(400, 'Too many groups.');
  if (groups.length && get('SELECT count(*) n FROM grps WHERE uid=? AND id IN (SELECT value FROM json_each(?))', me.id, JSON.stringify(groups)).n !== groups.length)
    fail(400, 'One of those groups is gone.');
  return tx(() => {
    const id = Number(run('INSERT INTO posts(uid,body,aud,created) VALUES(?,?,?,?)', me.id, body, groups.length ? 1 : 0, now()).lastInsertRowid);
    for (const g of groups) run('INSERT INTO post_aud(pid,gid) VALUES(?,?)', id, g);
    return { id };
  });
});

route('DELETE', '/posts/:id', ({ me, params }) => {
  const id = num(params[0]);
  if (!get('SELECT 1 FROM posts WHERE id=? AND uid=?', id, me.id)) fail(404, 'Post not found.');
  tx(() => {
    run('DELETE FROM likes WHERE (kind=0 AND tid=?) OR (kind=1 AND tid IN (SELECT id FROM comments WHERE pid=?))', id, id);
    run('DELETE FROM posts WHERE id=?', id);
  });
});

route('POST', '/posts/:id/comments', ({ me, params, body: b }) => {
  limit('w:' + me.id, 120, 6e5);
  const pid = num(params[0]);
  if (!canSee(me.id, pid)) fail(404, 'Post not found.');
  const body = text(b.body, 1000, 'Your comment');
  if (!body) fail(400, 'Write something first.');
  return { id: Number(run('INSERT INTO comments(pid,uid,body,created) VALUES(?,?,?,?)', pid, me.id, body, now()).lastInsertRowid) };
});

route('DELETE', '/comments/:id', ({ me, params }) => {
  const id = num(params[0]);
  const c = get('SELECT c.uid, p.uid owner FROM comments c JOIN posts p ON p.id=c.pid WHERE c.id=?', id);
  if (!c || (c.uid !== me.id && c.owner !== me.id)) fail(404, 'Comment not found.');
  run('DELETE FROM likes WHERE kind=1 AND tid=?', id);
  run('DELETE FROM comments WHERE id=?', id);
});

route('POST', '/like', ({ me, body: b }) => {
  const kind = b.kind === 'comment' ? 1 : 0;
  const id = num(b.id);
  if (kind === 0 ? !canSee(me.id, id) : (() => {
    const c = get('SELECT pid, uid FROM comments WHERE id=?', id);
    return !c || !canSee(me.id, c.pid) || blockedEither(me.id, c.uid);
  })()) fail(404, 'Not found.');
  const liked = !run('DELETE FROM likes WHERE kind=? AND tid=? AND uid=?', kind, id, me.id).changes;
  if (liked) run('INSERT INTO likes(kind,tid,uid) VALUES(?,?,?)', kind, id, me.id);
  return { liked: +liked, likes: get('SELECT count(*) n FROM likes WHERE kind=? AND tid=?', kind, id).n };
});

route('GET', '/u/:name', ({ me, params }) => {
  const u = userNamed(params[0]);
  const prof = JSON.parse(u.prof);
  if (u.id !== me.id) {
    if (get('SELECT 1 FROM blocks WHERE a=? AND b=?', u.id, me.id)) fail(404, 'No one has that username.');
    if (get('SELECT 1 FROM blocks WHERE a=? AND b=?', me.id, u.id)) return { blocked: 1, name: u.name };
    const seenKey = `view:${me.id}:${u.id}`; // count each visitor once every 6 hours
    if (!hits.has(seenKey)) { hits.set(seenKey, { n: 0, reset: now() + 6 * 36e5 }); run('UPDATE users SET views=views+1 WHERE id=?', u.id); u.views++; }
  }
  const rel = u.id === me.id ? 'me' : added(me.id, u.id) ? (added(u.id, me.id) ? 'friends' : 'sent') : added(u.id, me.id) ? 'received' : 'none';
  const topIds = JSON.stringify(Array.isArray(prof.top) ? prof.top : []);
  const topN = [4, 8, 12, 16].includes(prof.topN) ? prof.topN : 8;
  const FRIEND_OF = 'EXISTS(SELECT 1 FROM adds WHERE a=$uid AND b=u.id) AND EXISTS(SELECT 1 FROM adds WHERE a=u.id AND b=$uid) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (a=$me AND b=u.id) OR (a=u.id AND b=$me))';
  const top = all(`SELECT u.id, u.name, u.pic FROM json_each($top) t JOIN users u ON u.id=t.value WHERE ${FRIEND_OF} ORDER BY t.key LIMIT $n`, { top: topIds, uid: u.id, me: me.id, n: topN });
  if (top.length < topN) top.push(...all(`SELECT u.id, u.name, u.pic FROM adds x JOIN users u ON u.id=x.b
      WHERE x.a=$uid AND ${FRIEND_OF} AND u.id NOT IN (SELECT value FROM json_each($top)) ORDER BY x.created LIMIT $n`,
    { uid: u.id, me: me.id, top: topIds, n: topN - top.length }));
  return {
    user: { id: u.id, name: u.name, pic: u.pic, seen: u.seen, created: u.created, views: u.views },
    prof, rel, top,
    friendCount: get('SELECT count(*) n FROM adds x JOIN adds y ON y.a=x.b AND y.b=x.a WHERE x.a=?', u.id).n,
    ingroups: all('SELECT m.gid FROM members m JOIN grps g ON g.id=m.gid WHERE g.uid=? AND m.uid=?', me.id, u.id).map(r => r.gid),
    drawings: all('SELECT id FROM drawings WHERE uid=? ORDER BY id DESC', u.id).map(r => r.id),
    beats: all('SELECT id, name, data FROM beats WHERE uid=? ORDER BY id DESC', u.id).map(r => ({ ...r, data: JSON.parse(r.data) })),
    posts: feed(me.id, { author: u.id, limit: 5 }).posts,
    wallCount: get('SELECT count(*) n FROM wall WHERE owner=?', u.id).n,
    wall: rel === 'me' || rel === 'friends' ? all(`SELECT w.id, w.uid, u.name, u.pic, w.body, w.created FROM wall w JOIN users u ON u.id=w.uid
      WHERE w.owner=$owner AND NOT EXISTS(SELECT 1 FROM blocks WHERE (a=$me AND b=w.uid) OR (a=w.uid AND b=$me))
      ORDER BY w.id DESC LIMIT 50`, { owner: u.id, me: me.id }) : null,
  };
});

route('POST', '/u/:name/wall', ({ me, params, body: b }) => {
  limit('w:' + me.id, 120, 6e5);
  const u = userNamed(params[0]);
  if (u.id !== me.id && !isFriend(me.id, u.id)) fail(403, `Be friends with ${u.name} to leave a comment.`);
  const body = text(b.body, 1000, 'Your comment');
  if (!body) fail(400, 'Write something first.');
  return { id: Number(run('INSERT INTO wall(owner,uid,body,created) VALUES(?,?,?,?)', u.id, me.id, body, now()).lastInsertRowid) };
});
route('DELETE', '/wall/:id', ({ me, params }) => {
  if (!run('DELETE FROM wall WHERE id=? AND (uid=? OR owner=?)', num(params[0]), me.id, me.id).changes) fail(404, 'Comment not found.');
});

route('PUT', '/profile', ({ me, body: b }) => {
  const row = get('SELECT prof FROM users WHERE id=?', me.id);
  const p = JSON.parse(row.prof);
  for (const k in TEXTS) if (k in b) p[k] = text(b[k], TEXTS[k], k);
  if (b.interests && typeof b.interests === 'object') {
    p.interests = p.interests || {};
    for (const k of INTERESTS) if (k in b.interests) p.interests[k] = text(b.interests[k], 600, k);
  }
  for (const k of COLORS) if (k in b) {
    if (!/^#[0-9a-f]{6}$/i.test(b[k])) fail(400, 'Bad color.');
    p[k] = b[k].toLowerCase();
  }
  if ('font' in b) p.font = FONTS.includes(b.font) ? b.font : fail(400, 'Bad font.');
  if ('bgMode' in b) p.bgMode = ['color', 'tile', 'full'].includes(b.bgMode) ? b.bgMode : fail(400, 'Bad background.');
  if ('bgPic' in b) p.bgPic = ownDrawing(me.id, b.bgPic);
  if ('autoplay' in b) p.autoplay = b.autoplay ? 1 : 0;
  if ('song' in b) p.song = b.song == null ? null : (get('SELECT id FROM beats WHERE id=? AND uid=?', num(b.song), me.id) || fail(400, 'That beat is gone.')).id;
  if ('topN' in b) p.topN = [4, 8, 12, 16].includes(b.topN) ? b.topN : fail(400, 'Top friends can be 4, 8, 12 or 16.');
  if ('top' in b) {
    if (!Array.isArray(b.top) || b.top.length > 16) fail(400, 'Top friends is 16 people max.');
    p.top = [...new Set(b.top.map(num))];
  }
  if ('pic' in b) run('UPDATE users SET pic=? WHERE id=?', ownDrawing(me.id, b.pic), me.id);
  run('UPDATE users SET prof=? WHERE id=?', JSON.stringify(p), me.id);
  return { prof: p };
});

route('POST', '/drawings', ({ me, body: b }) => {
  limit('w:' + me.id, 120, 6e5);
  if (get('SELECT count(*) n FROM drawings WHERE uid=?', me.id).n >= 30) fail(400, 'You have 30 drawings. Delete one first.');
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.png || ''));
  const png = m && Buffer.from(m[1], 'base64');
  if (!png || png.length < 33 || png.readUInt32BE(0) !== 0x89504e47 || png.readUInt32BE(12) !== 0x49484452) fail(400, 'That is not a drawing.');
  if (png.length > 200_000) fail(413, 'Drawing is too big.');
  if (png.readUInt32BE(16) > 600 || png.readUInt32BE(20) > 600) fail(400, 'Drawing is too big.');
  const id = Number(run('INSERT INTO drawings(uid,png,created) VALUES(?,?,?)', me.id, png, now()).lastInsertRowid);
  if (b.pic) run('UPDATE users SET pic=? WHERE id=?', id, me.id);
  return { id };
});

route('DELETE', '/drawings/:id', ({ me, params }) => {
  const id = num(params[0]);
  if (!run('DELETE FROM drawings WHERE id=? AND uid=?', id, me.id).changes) fail(404, 'Drawing not found.');
  run('UPDATE users SET pic=NULL WHERE id=? AND pic=?', me.id, id);
  const p = JSON.parse(get('SELECT prof FROM users WHERE id=?', me.id).prof);
  if (p.bgPic === id) { p.bgPic = null; p.bgMode = 'color'; run('UPDATE users SET prof=? WHERE id=?', JSON.stringify(p), me.id); }
});

route('POST', '/beats', ({ me, body: b }) => {
  limit('w:' + me.id, 120, 6e5);
  if (get('SELECT count(*) n FROM beats WHERE uid=?', me.id).n >= 8) fail(400, 'You have 8 beats. Delete one first.');
  const name = text(b.name, 40, 'Beat name') || 'Untitled beat';
  return { id: Number(run('INSERT INTO beats(uid,name,data,created) VALUES(?,?,?,?)', me.id, name, JSON.stringify(cleanBeat(b.data)), now()).lastInsertRowid) };
});

route('GET', '/beats/:id', ({ me, params }) => {
  const r = get('SELECT b.id, b.name, b.data, b.uid, u.name AS author FROM beats b JOIN users u ON u.id=b.uid WHERE b.id=?', num(params[0]));
  if (!r || blockedEither(me.id, r.uid)) fail(404, 'Beat not found.');
  return { id: r.id, name: r.name, by: r.author, data: JSON.parse(r.data) };
});

route('DELETE', '/beats/:id', ({ me, params }) => {
  if (!run('DELETE FROM beats WHERE id=? AND uid=?', num(params[0]), me.id).changes) fail(404, 'Beat not found.');
});

route('GET', '/friends', ({ me }) => ({
  friends: all(`SELECT u.id, u.name, u.pic,
      (SELECT json_group_array(m.gid) FROM members m JOIN grps g ON g.id=m.gid WHERE g.uid=$me AND m.uid=u.id) gids
    FROM adds x JOIN adds y ON y.a=x.b AND y.b=x.a JOIN users u ON u.id=x.b WHERE x.a=$me ORDER BY u.name`, { me: me.id })
    .map(r => ({ ...r, gids: JSON.parse(r.gids) })),
  requests: all('SELECT u.id, u.name, u.pic FROM adds x JOIN users u ON u.id=x.a WHERE x.b=? AND NOT EXISTS(SELECT 1 FROM adds WHERE a=x.b AND b=x.a) ORDER BY x.created DESC', me.id),
  sent: all('SELECT u.id, u.name, u.pic FROM adds x JOIN users u ON u.id=x.b WHERE x.a=? AND NOT EXISTS(SELECT 1 FROM adds WHERE a=x.b AND b=x.a) ORDER BY x.created DESC', me.id),
  blocked: all('SELECT u.id, u.name FROM blocks k JOIN users u ON u.id=k.b WHERE k.a=? ORDER BY u.name', me.id),
  groups: all('SELECT id, name FROM grps WHERE uid=? ORDER BY id', me.id),
}));

route('POST', '/add/:name', ({ me, params }) => {
  limit('w:' + me.id, 120, 6e5);
  const u = userNamed(params[0]);
  if (u.id === me.id) fail(400, "That's you!");
  if (blockedEither(me.id, u.id)) fail(404, 'No one has that username.');
  run('INSERT OR IGNORE INTO adds(a,b,created) VALUES(?,?,?)', me.id, u.id, now());
});
route('POST', '/unfriend/:name', ({ me, params }) => { tx(() => unfriend(me.id, userNamed(params[0]).id)); });
route('POST', '/block/:name', ({ me, params }) => {
  const u = userNamed(params[0]);
  if (u.id === me.id) fail(400, "You can't block yourself.");
  tx(() => { unfriend(me.id, u.id); run('INSERT OR IGNORE INTO blocks(a,b) VALUES(?,?)', me.id, u.id); });
});
route('POST', '/unblock/:name', ({ me, params }) => { run('DELETE FROM blocks WHERE a=? AND b=?', me.id, userNamed(params[0]).id); });

route('POST', '/groups', ({ me, body: b }) => {
  const name = text(b.name, 30, 'Group name');
  if (!name) fail(400, 'Give the group a name.');
  if (get('SELECT count(*) n FROM grps WHERE uid=?', me.id).n >= 20) fail(400, '20 groups is the max.');
  return { id: Number(run('INSERT INTO grps(uid,name) VALUES(?,?)', me.id, name).lastInsertRowid) };
});
route('DELETE', '/groups/:id', ({ me, params }) => {
  if (!run('DELETE FROM grps WHERE id=? AND uid=?', num(params[0]), me.id).changes) fail(404, 'Group not found.');
});
route('POST', '/groups/:id/members', ({ me, params, body: b }) => {
  const gid = num(params[0]), uid = num(b.uid);
  if (!get('SELECT 1 FROM grps WHERE id=? AND uid=?', gid, me.id)) fail(404, 'Group not found.');
  if (b.on) {
    if (!isFriend(me.id, uid)) fail(400, 'You can only put friends in groups.');
    run('INSERT OR IGNORE INTO members(gid,uid) VALUES(?,?)', gid, uid);
  } else run('DELETE FROM members WHERE gid=? AND uid=?', gid, uid);
});

// ---------- HTTP plumbing ----------
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
function json(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY });
  res.end(JSON.stringify(obj));
}
function readJson(req) {
  return new Promise((ok, no) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 300_000) { no(new HttpError(413, 'Too big.')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      if (!size) return ok({});
      try { const v = JSON.parse(Buffer.concat(chunks)); ok(v && typeof v === 'object' ? v : {}); } catch { no(new HttpError(400, 'Bad JSON.')); }
    });
    req.on('error', no);
  });
}
async function handleApi(req, res, url) {
  if (req.method !== 'GET') {
    // Blocks other websites from posting on your behalf: they can't send JSON here without permission.
    if (!String(req.headers['content-type']).startsWith('application/json')) fail(415, 'Send JSON.');
    const origin = req.headers.origin, host = (TRUST_PROXY && req.headers['x-forwarded-host']) || req.headers.host;
    if (origin && origin.replace(/^https?:\/\//, '') !== host) fail(403, 'Wrong site.');
  }
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(url.pathname);
    if (!m) continue;
    const me = auth(req);
    if (!me && !r.open) fail(401, 'Log in first.');
    const body = req.method === 'GET' ? {} : await readJson(req);
    const out = await r.fn({ req, res, me, body, url, params: m.slice(1).map(decodeURIComponent) });
    return json(res, 200, out === undefined ? { ok: 1 } : out);
  }
  fail(404, 'Not found.');
}

// Static files: loaded and gzipped once at startup, revalidated with ETags.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const files = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'public'))) {
  const body = fs.readFileSync(path.join(ROOT, 'public', f));
  files.set('/' + f, {
    body, gz: zlib.gzipSync(body, { level: 9 }),
    type: TYPES[path.extname(f)] || 'application/octet-stream',
    etag: '"' + crypto.createHash('sha1').update(body).digest('base64url').slice(0, 16) + '"',
  });
}
function serveFile(req, res, f) {
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, { etag: f.etag }); return res.end(); }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, {
    'content-type': f.type, etag: f.etag, 'cache-control': 'no-cache', vary: 'accept-encoding',
    ...(gz ? { 'content-encoding': 'gzip' } : {}), ...SECURITY,
  });
  res.end(gz ? f.gz : f.body);
}
function serveDrawing(req, res, id) {
  if (!auth(req)) fail(401, 'Log in first.');
  const d = get('SELECT png FROM drawings WHERE id=?', id) || fail(404, 'Not found.');
  // Drawings never change once posted, so browsers can keep them forever.
  res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'private, max-age=31536000, immutable', ...SECURITY });
  res.end(d.png);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Not allowed.');
    const d = /^\/d\/(\d+)\.png$/.exec(url.pathname);
    if (d) return serveDrawing(req, res, Number(d[1]));
    serveFile(req, res, files.get(url.pathname) || files.get('/index.html')); // every page is the same app
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) json(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Something broke. Try again.' });
  }
});
server.listen(PORT, () => console.log(`massive group chat is running at http://localhost:${server.address().port}`));

setInterval(() => run('DELETE FROM sessions WHERE created < ?', now() - SESSION_DAYS * DAY), DAY).unref();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
