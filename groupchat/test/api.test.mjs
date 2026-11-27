// API tests: npm test. Starts a real server on a temporary database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgc-'));
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://localhost:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.mjs'], {
    cwd: path.join(import.meta.dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DB_FILE: path.join(dir, 'test.db'), SIGNUPS_PER_HOUR: '1000', FIRST_FRIEND: 'hostie' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise(ok => server.stdout.on('data', d => String(d).includes('running') && ok()));
});
after(() => { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

// A tiny client that keeps its own login cookie.
function client() {
  let cookie = '';
  const call = async (method, url, body) => {
    const r = await fetch(BASE + '/api' + url, {
      method,
      headers: { cookie, ...(method === 'GET' ? {} : { 'content-type': 'application/json' }) },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    const set = r.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await r.json();
    if (!r.ok) throw Object.assign(new Error(data.error), { status: r.status });
    return data;
  };
  return { call, get cookie() { return cookie; } };
}
async function user(name, invite) {
  const c = client();
  c.me = await c.call('POST', '/signup', { name, pass: 'pass', ok: true, invite });
  return c;
}
const status = p => p.then(() => 200, e => e.status);

test('sign up needs the disclaimer ticked and a free username', async () => {
  const c = client();
  assert.equal(await status(c.call('POST', '/signup', { name: 'nobox', pass: 'pass' })), 400);
  await user('taken');
  assert.equal(await status(c.call('POST', '/signup', { name: 'TAKEN', pass: 'pass', ok: true })), 409);
  assert.equal(await status(c.call('POST', '/signup', { name: 'a b', pass: 'pass', ok: true })), 400);
});

test('log in and out', async () => {
  await user('logan');
  const c = client();
  assert.equal(await status(c.call('POST', '/login', { name: 'logan', pass: 'nope' })), 401);
  const me = await c.call('POST', '/login', { name: 'logan', pass: 'pass' });
  assert.equal(me.name, 'logan');
  assert.deepEqual(me.groups.map(g => g.name), ['Friends', 'Family']);
  await c.call('POST', '/logout');
  assert.equal(await c.call('GET', '/me'), null);
  assert.equal(await status(c.call('GET', '/feed')), 401);
});

test('invite link makes you friends; strangers see nothing', async () => {
  const amy = await user('amy');
  const bob = await user('bob', 'amy');
  const eve = await user('eve');
  await amy.call('POST', '/posts', { body: 'hi all' });
  assert.equal((await bob.call('GET', '/feed')).posts[0].body, 'hi all');
  assert.equal((await eve.call('GET', '/feed')).posts.length, 0);
  assert.equal((await eve.call('GET', '/u/amy')).posts.length, 0);
  assert.equal(await status(eve.call('POST', `/posts/${(await amy.call('GET', '/feed')).posts[0].id}/comments`, { body: 'x' })), 404);
});

test('friend requests need both sides', async () => {
  const cat = await user('cat');
  const dan = await user('dan');
  await cat.call('POST', '/add/dan');
  assert.equal((await dan.call('GET', '/me')).requests, 1);
  assert.equal((await dan.call('GET', '/u/cat')).rel, 'received');
  await cat.call('POST', '/posts', { body: 'secret-ish' });
  assert.equal((await dan.call('GET', '/feed')).posts.length, 0);
  await dan.call('POST', '/add/cat');
  assert.equal((await dan.call('GET', '/u/cat')).rel, 'friends');
  assert.equal((await dan.call('GET', '/feed')).posts.length, 1);
});

test('posting to a group only reaches that group, and the feed filters by group', async () => {
  const mum = await user('mum');
  const kid = await user('kid', 'mum');
  const pal = await user('pal', 'mum');
  const family = mum.me.groups.find(g => g.name === 'Family').id;
  await mum.call('POST', `/groups/${family}/members`, { uid: kid.me.id, on: true });
  await mum.call('POST', '/posts', { body: 'family only', groups: [family] });
  await mum.call('POST', '/posts', { body: 'everyone' });
  assert.deepEqual((await kid.call('GET', '/feed')).posts.map(p => p.body), ['everyone', 'family only']);
  assert.deepEqual((await pal.call('GET', '/feed')).posts.map(p => p.body), ['everyone']);
  const own = (await mum.call('GET', '/feed')).posts;
  assert.deepEqual(own.find(p => p.body === 'family only').aud, [family]);
  assert.equal(own.find(p => p.body === 'everyone').aud, null);
  // kid filters their feed to their own Family group (mum isn't in it yet → empty)
  const kidFamily = kid.me.groups.find(g => g.name === 'Family').id;
  assert.equal((await kid.call('GET', `/feed?g=${kidFamily}`)).posts.length, 0);
  await kid.call('POST', `/groups/${kidFamily}/members`, { uid: mum.me.id, on: true });
  assert.equal((await kid.call('GET', `/feed?g=${kidFamily}`)).posts.length, 2);
  // can't post to someone else's group
  assert.equal(await status(pal.call('POST', '/posts', { body: 'x', groups: [family] })), 400);
  // can't put a non-friend in a group
  const stranger = await user('stranger');
  assert.equal(await status(mum.call('POST', `/groups/${family}/members`, { uid: stranger.me.id, on: true })), 400);
});

test('comments and likes', async () => {
  const ann = await user('ann');
  const ben = await user('ben', 'ann');
  const { id } = await ann.call('POST', '/posts', { body: 'joke' });
  const c = await ben.call('POST', `/posts/${id}/comments`, { body: 'lol' });
  assert.deepEqual(await ben.call('POST', '/like', { kind: 'post', id }), { liked: 1, likes: 1 });
  assert.deepEqual(await ann.call('POST', '/like', { kind: 'comment', id: c.id }), { liked: 1, likes: 1 });
  assert.deepEqual(await ben.call('POST', '/like', { kind: 'post', id }), { liked: 0, likes: 0 });
  const p = (await ann.call('GET', '/feed')).posts[0];
  assert.equal(p.comments[0].body, 'lol');
  assert.equal(p.comments[0].likes, 1);
  // the post owner can delete comments on their post; others can't delete the post
  assert.equal(await status(ben.call('DELETE', '/posts/' + id)), 404);
  await ann.call('DELETE', '/comments/' + c.id);
  assert.equal((await ann.call('GET', '/feed')).posts[0].comments.length, 0);
  await ann.call('DELETE', '/posts/' + id);
  assert.equal((await ben.call('GET', '/feed')).posts.length, 0);
});

test('blocking hides everything both ways', async () => {
  const kim = await user('kim');
  const troll = await user('troll', 'kim');
  const sam = await user('sam', 'kim');
  await sam.call('POST', '/add/troll');
  await troll.call('POST', '/add/sam');
  const { id } = await sam.call('POST', '/posts', { body: 'hello' });
  await troll.call('POST', `/posts/${id}/comments`, { body: 'mean thing' });
  await kim.call('POST', '/block/troll');
  assert.equal((await kim.call('GET', '/feed')).posts[0].comments.length, 0); // troll's comment hidden from kim
  assert.equal(await status(troll.call('GET', '/u/kim')), 404);
  assert.equal((await kim.call('GET', '/u/troll')).blocked, 1);
  assert.equal(await status(troll.call('POST', '/add/kim')), 404);
  await kim.call('POST', '/posts', { body: 'after block' });
  assert.ok(!(await troll.call('GET', '/feed')).posts.some(p => p.body === 'after block'));
});

test('profile, drawings and beats', async () => {
  const zed = await user('zed');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const d = await zed.call('POST', '/drawings', { png, pic: 1 });
  assert.equal((await zed.call('GET', '/me')).pic, d.id);
  assert.equal(await status(zed.call('POST', '/drawings', { png: 'data:image/png;base64,AAAA' })), 400);
  const img = await fetch(`${BASE}/d/${d.id}.png`, { headers: { cookie: zed.cookie } });
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal((await fetch(`${BASE}/d/${d.id}.png`)).status, 401);

  await zed.call('PUT', '/profile', { bio: 'I am a test', bg: '#112233', bgMode: 'tile', bgPic: d.id, font: 'comic', interests: { music: 'beeps' } });
  assert.equal(await status(zed.call('PUT', '/profile', { bg: 'red; background:url(x)' })), 400);
  assert.equal(await status(zed.call('PUT', '/profile', { font: 'papyrus' })), 400);

  const data = { bpm: 120, key: 0, scale: 1, d: [1, 0, 0, 0], b: [0, 0, 0, 0, 0, 0, 0, 0], s: [0, 1, 2].map(p => ({ p, r: [1, 0, 0, 0, 0, 0, 0, 0] })) };
  const b = await zed.call('POST', '/beats', { name: 'boop', data });
  assert.equal(await status(zed.call('POST', '/beats', { name: 'bad', data: { ...data, bpm: 9999 } })), 400);
  const prof = await zed.call('GET', '/u/zed');
  assert.equal(prof.prof.bio, 'I am a test');
  assert.equal(prof.prof.interests.music, 'beeps');
  assert.deepEqual(prof.beats[0].data, data);
  assert.equal(prof.beats[0].id, b.id);

  await zed.call('DELETE', '/drawings/' + d.id);
  const after = await zed.call('GET', '/u/zed');
  assert.equal(after.user.pic, null);
  assert.equal(after.prof.bgMode, 'color');
});

test('top friends shows chosen friends first, 4/8/12/16 of them', async () => {
  const star = await user('star');
  const fans = [];
  for (let i = 0; i < 5; i++) fans.push(await user('fan' + i, 'star'));
  await star.call('PUT', '/profile', { top: [fans[2].me.id] });
  assert.deepEqual((await star.call('GET', '/u/star')).top.map(t => t.name), ['fan2', 'fan0', 'fan1', 'fan3', 'fan4']);
  await star.call('PUT', '/profile', { topN: 4 });
  assert.deepEqual((await star.call('GET', '/u/star')).top.map(t => t.name), ['fan2', 'fan0', 'fan1', 'fan3']);
  assert.equal(await status(star.call('PUT', '/profile', { topN: 5 })), 400);
});

test('friends comments wall: friends only', async () => {
  const wally = await user('wally');
  const pal = await user('wallpal', 'wally');
  const nope = await user('wallnope');
  await pal.call('POST', '/u/wally/wall', { body: 'thanks for the add!' });
  assert.equal(await status(nope.call('POST', '/u/wally/wall', { body: 'hi' })), 403);
  const prof = await wally.call('GET', '/u/wally');
  assert.equal(prof.wallCount, 1);
  assert.equal(prof.wall[0].body, 'thanks for the add!');
  const stranger = await nope.call('GET', '/u/wally');
  assert.equal(stranger.wall, null);
  assert.equal(await status(nope.call('DELETE', '/wall/' + prof.wall[0].id)), 404);
  await wally.call('DELETE', '/wall/' + prof.wall[0].id); // the page owner can delete any comment on it
  assert.equal((await wally.call('GET', '/u/wally')).wallCount, 0);
});

test('profile views count each visitor once, not the owner', async () => {
  const pop = await user('popular');
  const fan = await user('viewer');
  await fan.call('GET', '/u/popular');
  await fan.call('GET', '/u/popular');
  await pop.call('GET', '/u/popular');
  assert.equal((await pop.call('GET', '/u/popular')).user.views, 1);
});

test('requests from other sites are refused', async () => {
  const r = await fetch(BASE + '/api/posts', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(r.status, 415);
  const r2 = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
  assert.equal(r2.status, 403);
});

test('delete account removes everything', async () => {
  const gone = await user('gone');
  const pal = await user('gonepal', 'gone');
  await gone.call('POST', '/posts', { body: 'bye' });
  assert.equal(await status(gone.call('DELETE', '/me', { pass: 'wrong' })), 401);
  await gone.call('DELETE', '/me', { pass: 'pass' });
  assert.equal((await pal.call('GET', '/feed')).posts.length, 0);
  assert.equal(await status(pal.call('GET', '/u/gone')), 404);
});

test('pages are served as the app', async () => {
  for (const p of ['/', '/u/someone', '/join/amy', '/beat']) {
    const r = await fetch(BASE + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /massive group chat/);
  }
  const js = await fetch(BASE + '/app.js', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(js.status, 200);
});

// Runs last: once "hostie" exists, everyone who signs up after starts out friends with them.
test('new members start out friends with the first friend', async () => {
  await user('hostie');
  const newbie = await user('newbie');
  assert.equal((await newbie.call('GET', '/u/hostie')).rel, 'friends');
  assert.equal((await newbie.call('GET', '/u/hostie')).wall.length, 0);
});
