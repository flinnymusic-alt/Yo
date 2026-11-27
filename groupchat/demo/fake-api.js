'use strict';
// Pretend back end for the preview. It answers the same /api requests as server.mjs,
// but keeps everything in this browser. The people, posts and beats are all made up.
(() => {
  const KEY = 'mgc-demo-1';
  const MIN = 6e4, HR = 36e5, DAY = 864e5;
  const now = () => Date.now();
  let D = null;
  const viewed = new Set();

  // ---------- helpers ----------
  const fail = (status, error) => { throw { status, error }; };
  const has = (list, k) => list.includes(k);
  const put = (list, k) => { if (!list.includes(k)) list.push(k); };
  const drop = (list, k) => { const i = list.indexOf(k); if (i >= 0) list.splice(i, 1); };
  const nextId = () => D.seq++;
  const user = id => D.users.find(u => u.id === id);
  const find = n => D.users.find(u => u.name.toLowerCase() === String(n).toLowerCase());
  const named = n => find(n) || fail(404, 'No one has that username.');
  const added = (a, b) => has(D.adds, a + '>' + b);
  const friends = (a, b) => added(a, b) && added(b, a);
  const blockedEither = (a, b) => has(D.blocks, a + '>' + b) || has(D.blocks, b + '>' + a);
  const inGroup = (gid, uid) => has(D.members, gid + '>' + uid);
  const likeCount = (k, id) => D.likes.filter(x => x.startsWith(`${k}:${id}:`)).length;
  const visible = (me, p) => p.uid === me || (friends(me, p.uid) && (!p.aud || p.aud.some(g => inGroup(g, me))));
  const face = u => ({ id: u.id, name: u.name, pic: u.pic });
  const clean = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const later = (ms, fn) => setTimeout(() => { fn(); save(); }, ms);
  const tell = msg => window.toast && window.toast(msg);

  // ---------- doodled faces, drawn the same way people draw on the site ----------
  function doodle([hair, eyes, mouth]) {
    const c = document.createElement('canvas');
    c.width = c.height = 300;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 300, 300);
    x.strokeStyle = x.fillStyle = '#000';
    x.lineCap = x.lineJoin = 'round';
    x.lineWidth = 4;
    const rx = 92, ry = 108, top = 160 - ry;
    x.beginPath(); x.ellipse(150, 160, rx, ry, 0, 0, Math.PI * 2); x.stroke();
    x.beginPath();
    if (hair === 0) for (let i = -3; i <= 3; i++) { x.moveTo(150 + i * 22, top + 4 + Math.abs(i) * 7); x.lineTo(150 + i * 28, top - 34 + Math.abs(i) * 9); }
    if (hair === 1) for (let i = -4; i <= 4; i++) { const cx = 150 + i * 19, cy = top + 8 + i * i * 2.2; x.moveTo(cx + 10, cy); x.arc(cx, cy, 10, 0, Math.PI, true); }
    if (hair === 2) { x.moveTo(150 - rx + 4, 140); x.quadraticCurveTo(150, top - 50, 150 + rx - 4, 140); x.moveTo(150 - rx * .75, 105); x.lineTo(150 + rx * .5, 72); }
    x.stroke();
    for (const s of [-1, 1]) {
      const cx = 150 + s * 38, cy = 140;
      x.beginPath();
      if (eyes === 0) { x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill(); }
      if (eyes === 1) { x.arc(cx, cy, 15, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(cx + 4, cy + 3, 5, 0, Math.PI * 2); x.fill(); }
      if (eyes === 2) { x.moveTo(cx - 10, cy - 9); x.lineTo(cx + 10, cy + 9); x.moveTo(cx + 10, cy - 9); x.lineTo(cx - 10, cy + 9); x.stroke(); }
      if (eyes === 3) x.fillRect(cx - 24, cy - 11, 48, 22);
    }
    if (eyes === 3) { x.beginPath(); x.moveTo(130, 136); x.lineTo(170, 136); x.stroke(); }
    x.beginPath();
    if (mouth === 0 || mouth === 3) x.arc(150, 180, 42, .2 * Math.PI, .8 * Math.PI);
    if (mouth === 1) { x.moveTo(122, 212); x.lineTo(178, 212); }
    if (mouth === 2) x.ellipse(150, 214, 16, 22, 0, 0, Math.PI * 2);
    x.stroke();
    if (mouth === 3) { x.beginPath(); x.moveTo(146, 218); x.quadraticCurveTo(160, 252, 176, 212); x.stroke(); }
    return c.toDataURL('image/png');
  }

  // ---------- beats, written as step patterns: x = hit ----------
  const steps = str => [...str].reduce((a, ch, i) => (ch === 'x' ? a | (1 << i) : a), 0);
  const notes = pairs => { const r = [0, 0, 0, 0, 0, 0, 0, 0]; for (const [step, row] of pairs) r[row] |= 1 << step; return r; };
  const beat = (bpm, key, scale, drums, bass, synths) => ({ bpm, key, scale, d: drums.map(steps), b: notes(bass), s: synths.map(([p, n]) => ({ p, r: notes(n) })) });
  const SONGS = {
    host: ['Welcome Jingle', beat(110, 0, 1, ['x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.', ''],
      [[0, 0], [6, 3], [8, 0], [14, 3]],
      [[4, [[0, 2], [4, 4], [8, 5], [12, 7], [14, 5]]], [3, []], [2, [[0, 0], [0, 2], [0, 4], [8, 3], [8, 5]]]])],
    dj_toast: ['Toaster Breakbeat', beat(150, 2, 0, ['x.....x...x.....', '....x.......x..x', 'xxxxxxxxxxxxxxxx', '............x...'],
      [[0, 0], [3, 1], [6, 0], [10, 0], [14, 3]],
      [[0, [[0, 7], [2, 5], [4, 4], [8, 4], [10, 3], [12, 2], [14, 2]]], [1, []], [2, [[0, 0], [0, 2], [8, 1], [8, 3]]]])],
    nana_beats: ['Knitting Circle', beat(95, 7, 1, ['x.......x.......', '................', '..x...x...x...x.', '....x.......x...'],
      [[0, 0], [8, 3], [12, 2]],
      [[4, [[0, 0], [2, 2], [4, 4], [6, 7], [8, 5], [10, 4], [12, 2], [14, 0]]], [3, []], [2, [[0, 0], [0, 2], [8, 3], [8, 5]]]])],
    skaterkat: ['Kickflip', beat(128, 9, 0, ['x...x...x...x...', '................', '..x...x...x...x.', '....x.......x...'],
      [[0, 0], [3, 0], [6, 0], [8, 3], [11, 3], [14, 2]],
      [[3, [[0, 4], [2, 5], [4, 4], [6, 2], [8, 4], [10, 7], [12, 5], [14, 4]]], [1, []], [2, []]])],
    'xX_gloom_Xx': ['it is not a phase', beat(70, 4, 0, ['x.........x.....', '........x.......', '', ''],
      [[0, 0], [8, 2], [12, 1]],
      [[2, [[0, 0], [0, 2], [0, 4], [8, 1], [8, 3], [8, 5]]], [4, [[4, 7], [12, 6]]], [2, []]])],
    new_kid: ['first loop', beat(100, 9, 0, ['x.......x.x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.', ''],
      [[0, 0], [8, 0], [10, 3], [14, 2]],
      [[0, []], [3, [[0, 4], [3, 5], [6, 4], [12, 2]]], [2, [[0, 0], [0, 2], [0, 4], [8, 3], [8, 5]]]])],
  };

  // ---------- the made-up world ----------
  const LOOK = {
    classic: { bg: '#e5e5e5', box: '#ffffff', head: '#6699cc', accent: '#ff6600', text: '#000000', link: '#003399', font: 'verdana' },
    emo: { bg: '#000000', box: '#141414', head: '#cc0066', accent: '#ff66cc', text: '#eeeeee', link: '#66ccff', font: 'trebuchet' },
    bubblegum: { bg: '#ffcce6', box: '#fff5fa', head: '#ff66aa', accent: '#cc0066', text: '#330022', link: '#8800cc', font: 'comic' },
    hacker: { bg: '#001a00', box: '#000000', head: '#008800', accent: '#33ff33', text: '#66ff66', link: '#ccffcc', font: 'courier' },
    skater: { bg: '#333333', box: '#f2e6c9', head: '#8b4513', accent: '#b22222', text: '#222222', link: '#004488', font: 'georgia' },
    ocean: { bg: '#0b3d5c', box: '#e8f6ff', head: '#1478a6', accent: '#ff7f50', text: '#0b2233', link: '#005f87', font: 'arial' },
  };
  const PEOPLE = [
    ['host', [3, 0, 0], true, { ...LOOK.classic, headline: "Everyone's first friend. Say hi!", mood: 'chill 😎',
      bio: 'Every new member starts out friends with me, like the old days.', about: 'I read every post. Mostly.',
      who: 'A pretend person. Everyone on here is pretend.', know: 'Favourite thing: a good Top 8 argument.',
      interests: { general: 'Welcoming people, pressing buttons', music: 'Anything with a good bassline', heroes: 'Whoever invented the Top 8' } }],
    ['dj_toast', [0, 3, 0], true, { ...LOOK.hacker, headline: 'bread is just cake that gave up', mood: 'hyper 🤪',
      bio: 'I make beats and I burn toast. Sometimes at the same time.', about: 'Smoke alarm is my hype man.',
      interests: { music: 'Breakbeats, toaster noises, the beep of a smoke alarm', movies: 'Anything with a heist', heroes: 'Whoever invented the crumb tray' } }],
    ['skaterkat', [2, 1, 3], false, { ...LOOK.skater, headline: 'gravity is a suggestion', mood: 'sleepy 😴',
      bio: 'Skate, snack, nap, repeat.', know: 'I have fallen off in front of every bus in town.',
      interests: { general: 'Kickflips (attempted)', tv: 'Cartoons. All of them.' } }],
    ['nana_beats', [1, 1, 0], true, { ...LOOK.bubblegum, headline: 'knitting at 140bpm', mood: 'happy 😀',
      bio: 'Grandma of the group chat. I made one beat and now I cannot stop.', about: 'The Bell synth is my best friend.',
      interests: { general: 'Knitting, gossip, the Bell synth', books: 'Mysteries where the cat did it' } }],
    ['xX_gloom_Xx', [2, 2, 1], false, { ...LOOK.emo, headline: 'nobody understands my playlist', mood: 'sad 😢',
      bio: 'It is not a phase.', interests: { music: 'Sad songs. Sadder songs.' } }],
    ['big_steve', [0, 0, 2], false, { ...LOOK.ocean, headline: 'professional snacker', mood: 'hungry 🍕',
      bio: "Ask me about pizza. Actually don't, I won't stop.", interests: { general: 'Pizza, naps, pizza naps', movies: 'Food documentaries' } }],
  ];
  const REPLIES = ['lol', 'hahaha', 'this is the best thing I have read all day', 'classic', 'ok but why', 'same', 'iconic', 'who let you cook', '😂😂😂', 'tell me more', 'not again'];

  function newUser(name, pass, prof, created) {
    const id = nextId();
    D.users.push({ id, name, pass, pic: null, prof, seen: now(), created, views: 0 });
    D.grps.push({ id: nextId(), uid: id, name: 'Friends' }, { id: nextId(), uid: id, name: 'Family' });
    return id;
  }
  function befriend(a, b) { put(D.adds, a + '>' + b); put(D.adds, b + '>' + a); }
  function unfriend(a, b) {
    drop(D.adds, a + '>' + b);
    drop(D.adds, b + '>' + a);
    D.members = D.members.filter(k => {
      const [gid, uid] = k.split('>').map(Number), owner = D.grps.find(g => g.id === gid).uid;
      return !((owner === a && uid === b) || (owner === b && uid === a));
    });
  }

  function seed() {
    D = { v: 1, seq: 1, me: null, users: [], adds: [], blocks: [], grps: [], members: [], posts: [], comments: [], likes: [], drawings: [], beats: [], wall: [] };
    const t = now(), ids = {};
    const addPerson = (name, look, pass, prof, ago) => {
      const uid = newUser(name, pass, prof, t - ago);
      const d = nextId();
      D.drawings.push({ id: d, uid, png: doodle(look) });
      user(uid).pic = d;
      if (SONGS[name]) D.beats.push({ id: nextId(), uid, name: SONGS[name][0], data: SONGS[name][1] });
      ids[name] = uid;
      return uid;
    };
    PEOPLE.forEach(([name, look, online, prof], i) => {
      const uid = addPerson(name, look, null, prof, (60 - i * 7) * DAY);
      Object.assign(user(uid), { seen: online ? t : t - (i + 2) * HR, views: [912, 233, 118, 341, 66, 150][i], online });
    });
    const you = addPerson('new_kid', [1, 0, 3], 'pass', { ...LOOK.classic, bg: '#cfe0f5', bgMode: 'tile', headline: 'testing testing 1 2 3', mood: 'cheeky 😜',
      bio: 'This is your pretend page. Tap Edit Page to change everything on it.', about: 'I just joined. Be nice.',
      interests: { music: 'Whatever I make in the Beat Maker', heroes: 'My nan (not nana_beats, a different nan)' } }, 4 * DAY);
    user(you).prof.bgPic = user(you).pic;
    user(you).views = 27;
    D.me = you;

    for (const n of ['dj_toast', 'skaterkat', 'nana_beats', 'xX_gloom_Xx', 'big_steve', 'new_kid']) befriend(ids.host, ids[n]);
    for (const n of ['dj_toast', 'skaterkat', 'nana_beats', 'big_steve']) befriend(you, ids[n]);
    for (const [a, b] of [['dj_toast', 'skaterkat'], ['dj_toast', 'big_steve'], ['nana_beats', 'big_steve'], ['skaterkat', 'big_steve']]) befriend(ids[a], ids[b]);
    put(D.adds, ids['xX_gloom_Xx'] + '>' + you); // a friend request waiting for you

    const grp = (who, name) => D.grps.find(g => g.uid === ids[who] && g.name === name).id;
    const member = (who, gname, whom) => put(D.members, grp(who, gname) + '>' + ids[whom]);
    member('new_kid', 'Friends', 'dj_toast'); member('new_kid', 'Friends', 'skaterkat'); member('new_kid', 'Friends', 'big_steve');
    member('new_kid', 'Family', 'nana_beats');
    member('nana_beats', 'Family', 'new_kid'); member('nana_beats', 'Family', 'big_steve');

    const post = (who, ago, body, toGroup, comments = [], likers = []) => {
      const pid = nextId();
      D.posts.push({ id: pid, uid: ids[who], body, aud: toGroup ? [grp(who, toGroup)] : null, created: t - ago });
      for (const [w, a, b] of comments) D.comments.push({ id: nextId(), pid, uid: ids[w], body: b, created: t - a });
      for (const l of likers) put(D.likes, `0:${pid}:${ids[l]}`);
    };
    // oldest first
    post('host', 6 * DAY, "Welcome to massive group chat! Nothing on here is real, so don't post real stuff. Draw your face, make a beat, be silly.",
      null, [['nana_beats', 6 * DAY - 2 * HR, 'Hello dear!'], ['dj_toast', 6 * DAY - HR, 'first!!']], ['dj_toast', 'nana_beats', 'big_steve', 'skaterkat']);
    post('new_kid', 3 * DAY, 'is this thing on', null, [['host', 3 * DAY - 20 * MIN, 'loud and clear!'], ['skaterkat', 2 * DAY, 'no']], ['host']);
    post('big_steve', 2 * DAY, "what's the best pizza topping. wrong answers only", null,
      [['dj_toast', 2 * DAY - HR, 'toast'], ['nana_beats', 2 * DAY - 50 * MIN, 'more toast'], ['skaterkat', DAY, 'gravel']], ['dj_toast', 'new_kid']);
    post('skaterkat', 5 * HR, 'fell off my board in front of a whole bus. the bus clapped.', null,
      [['dj_toast', 4 * HR, 'the bus has seen things'], ['host', 3 * HR, '10/10 landing']], ['nana_beats', 'big_steve']);
    post('nana_beats', HR, 'Family dinner sunday?? Bring toast for dj_toast, he burnt his again.', 'Family',
      [['big_steve', 40 * MIN, "I'll bring 3 pizzas"]], ['big_steve']);
    post('dj_toast', 12 * MIN, 'just set off the smoke alarm making toast. again. 🍞🔥', null,
      [['skaterkat', 9 * MIN, 'classic'], ['big_steve', 6 * MIN, 'save me a slice'], ['nana_beats', 2 * MIN, 'Oh honey.']], ['skaterkat', 'nana_beats', 'big_steve']);

    const wall = (owner, who, ago, body) => D.wall.push({ id: nextId(), owner: ids[owner], uid: ids[who], body, created: t - ago });
    wall('new_kid', 'host', 4 * DAY, 'Thanks for the add! Welcome to massive group chat 👋');
    wall('new_kid', 'dj_toast', DAY, "yo nice page. your beat needs more cowbell (we don't have cowbell)");
    wall('new_kid', 'nana_beats', 3 * HR, 'Lovely page dear x');
    wall('dj_toast', 'skaterkat', 3 * DAY, 'toast king 👑');
    wall('dj_toast', 'host', 20 * DAY, 'Thanks for the add!');
    wall('nana_beats', 'dj_toast', 2 * DAY, 'nana your beat slaps');
    wall('nana_beats', 'big_steve', 5 * DAY, 'can you knit me a pizza');
    wall('skaterkat', 'big_steve', 8 * HR, 'are you ok');
    wall('big_steve', 'host', 30 * DAY, 'Thanks for the add!');
    wall('host', 'nana_beats', 10 * DAY, 'Thank you for running this lovely place');
    wall('xX_gloom_Xx', 'host', 25 * DAY, 'Thanks for the add! Cheer up mate');
  }

  function load() {
    if (D) return;
    try { D = JSON.parse(localStorage.getItem(KEY)); } catch { D = null; }
    if (!D || D.v !== 1) seed();
    for (const u of D.users) if (u.online) u.seen = now(); // a few pretend people are always "Online Now!"
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch { /* storage full or blocked: keep going in memory */ } }

  // ---------- the same answers server.mjs gives ----------
  const meInfo = uid => ({
    ...face(user(uid)),
    requests: D.users.filter(u => added(u.id, uid) && !added(uid, u.id)).length,
    groups: D.grps.filter(g => g.uid === uid).map(({ id, name }) => ({ id, name })),
  });
  function feed(me, { author = 0, group = 0, before = 0, n = 20 }) {
    const g = group && D.grps.find(x => x.id === group && x.uid === me);
    const ps = D.posts.filter(p => visible(me, p) && (!author || p.uid === author) && (!group || (g && inGroup(g.id, p.uid))) && (!before || p.id < before))
      .sort((a, b) => b.id - a.id);
    return {
      more: ps.length > n,
      posts: ps.slice(0, n).map(p => ({
        ...face(user(p.uid)), id: p.id, uid: p.uid, body: p.body, created: p.created,
        aud: p.uid === me && p.aud ? p.aud : null, likes: likeCount(0, p.id), liked: +has(D.likes, `0:${p.id}:${me}`),
        comments: D.comments.filter(c => c.pid === p.id && !blockedEither(me, c.uid)).map(c => ({
          ...face(user(c.uid)), id: c.id, pid: c.pid, uid: c.uid, body: c.body, created: c.created,
          likes: likeCount(1, c.id), liked: +has(D.likes, `1:${c.id}:${me}`),
        })),
      })),
    };
  }
  function postOf(me, id) { const p = D.posts.find(x => x.id === id); return p && visible(me, p) ? p : fail(404, 'Post not found.'); }
  // Pretend people react to what you post, so the preview feels alive.
  function react(pid) {
    const p = D.posts.find(x => x.id === pid);
    const fans = p ? D.users.filter(u => u.id !== p.uid && !u.pass && visible(u.id, p)) : [];
    if (!fans.length) return;
    const f = pick(fans);
    D.comments.push({ id: nextId(), pid, uid: f.id, body: pick(REPLIES), created: now() });
    put(D.likes, `0:${pid}:${f.id}`);
    tell(`${f.name} commented on your post. Tap Home to see it.`);
  }

  const ROUTES = [
    ['GET', /^\/me$/, me => (me ? meInfo(me) : null), true],
    ['POST', /^\/signup$/, (me, b) => {
      if (b.ok !== true) fail(400, 'Tick the box to show you understand this site is fake and not secure.');
      const name = String(b.name || '').trim();
      if (!/^\w{3,20}$/.test(name)) fail(400, 'Usernames are 3–20 letters, numbers or _.');
      if (String(b.pass || '').length < 4) fail(400, 'Passwords need at least 4 characters.');
      if (find(name)) fail(409, 'That username is taken.');
      const uid = newUser(name, String(b.pass), {}, now());
      for (const f of [b.invite && find(b.invite), find('host')]) if (f) befriend(uid, f.id);
      D.wall.push({ id: nextId(), owner: uid, uid: find('host').id, body: 'Thanks for the add! Welcome to massive group chat 👋', created: now() });
      D.me = uid;
      return meInfo(uid);
    }, true],
    ['POST', /^\/login$/, (me, b) => {
      const u = find(String(b.name || '').trim());
      if (!u || !u.pass || u.pass !== b.pass) fail(401, 'Wrong username or password. (The pretend account is new_kid, password: pass)');
      D.me = u.id;
      return meInfo(u.id);
    }, true],
    ['POST', /^\/logout$/, () => { D.me = null; }, true],
    ['GET', /^\/invite\/(\w+)$/, (me, b, [n]) => ({ name: named(n).name }), true],
    ['DELETE', /^\/me$/, (me, b) => {
      if (user(me).pass !== b.pass) fail(401, 'Wrong password.');
      const mine = new Set(D.posts.filter(p => p.uid === me).map(p => p.id));
      D.users = D.users.filter(u => u.id !== me);
      D.adds = D.adds.filter(k => !k.split('>').map(Number).includes(me));
      D.blocks = D.blocks.filter(k => !k.split('>').map(Number).includes(me));
      const gone = new Set(D.grps.filter(g => g.uid === me).map(g => g.id));
      D.grps = D.grps.filter(g => g.uid !== me);
      D.members = D.members.filter(k => { const [g, u] = k.split('>').map(Number); return !gone.has(g) && u !== me; });
      D.posts = D.posts.filter(p => p.uid !== me);
      D.comments = D.comments.filter(c => c.uid !== me && !mine.has(c.pid));
      D.likes = D.likes.filter(k => Number(k.split(':')[2]) !== me);
      D.drawings = D.drawings.filter(d => d.uid !== me);
      D.beats = D.beats.filter(x => x.uid !== me);
      D.wall = D.wall.filter(w => w.owner !== me && w.uid !== me);
      D.me = null;
    }],
    ['GET', /^\/feed$/, (me, b, p, q) => feed(me, { group: Number(q.get('g')) || 0, before: Number(q.get('before')) || 0 })],
    ['POST', /^\/posts$/, (me, b) => {
      const body = clean(b.body, 2000);
      if (!body) fail(400, 'Write something first.');
      const groups = [...new Set(b.groups || [])];
      if (groups.some(g => !D.grps.some(x => x.id === g && x.uid === me))) fail(400, 'One of those groups is gone.');
      const id = nextId();
      D.posts.push({ id, uid: me, body, aud: groups.length ? groups : null, created: now() });
      later(2500, () => react(id));
      return { id };
    }],
    ['DELETE', /^\/posts\/(\d+)$/, (me, b, [id]) => {
      id = Number(id);
      if (!D.posts.some(p => p.id === id && p.uid === me)) fail(404, 'Post not found.');
      const cs = new Set(D.comments.filter(c => c.pid === id).map(c => c.id));
      D.posts = D.posts.filter(p => p.id !== id);
      D.comments = D.comments.filter(c => c.pid !== id);
      D.likes = D.likes.filter(k => { const [kind, t] = k.split(':').map(Number); return !(kind === 0 && t === id) && !(kind === 1 && cs.has(t)); });
    }],
    ['POST', /^\/posts\/(\d+)\/comments$/, (me, b, [id]) => {
      const p = postOf(me, Number(id));
      const body = clean(b.body, 1000);
      if (!body) fail(400, 'Write something first.');
      const cid = nextId();
      D.comments.push({ id: cid, pid: p.id, uid: me, body, created: now() });
      return { id: cid };
    }],
    ['DELETE', /^\/comments\/(\d+)$/, (me, b, [id]) => {
      id = Number(id);
      const c = D.comments.find(x => x.id === id), p = c && D.posts.find(x => x.id === c.pid);
      if (!c || (c.uid !== me && p.uid !== me)) fail(404, 'Comment not found.');
      D.comments = D.comments.filter(x => x.id !== id);
      D.likes = D.likes.filter(k => !k.startsWith(`1:${id}:`));
    }],
    ['POST', /^\/like$/, (me, b) => {
      const kind = b.kind === 'comment' ? 1 : 0, id = Number(b.id);
      if (kind) { const c = D.comments.find(x => x.id === id) || fail(404, 'Not found.'); postOf(me, c.pid); } else postOf(me, id);
      const k = `${kind}:${id}:${me}`, liked = !has(D.likes, k);
      liked ? put(D.likes, k) : drop(D.likes, k);
      return { liked: +liked, likes: likeCount(kind, id) };
    }],
    ['GET', /^\/u\/(\w+)$/, (me, b, [n]) => {
      const u = named(n);
      if (u.id !== me) {
        if (has(D.blocks, u.id + '>' + me)) fail(404, 'No one has that username.');
        if (has(D.blocks, me + '>' + u.id)) return { blocked: 1, name: u.name };
        if (!viewed.has(u.id)) { viewed.add(u.id); u.views++; }
      }
      const rel = u.id === me ? 'me' : added(me, u.id) ? (added(u.id, me) ? 'friends' : 'sent') : added(u.id, me) ? 'received' : 'none';
      const fr = D.users.filter(x => friends(u.id, x.id) && !blockedEither(me, x.id));
      const topN = [4, 8, 12, 16].includes(u.prof.topN) ? u.prof.topN : 8;
      const chosen = (u.prof.top || []).map(user).filter(x => x && fr.includes(x));
      return {
        user: { id: u.id, name: u.name, pic: u.pic, seen: u.seen, created: u.created, views: u.views },
        prof: u.prof, rel,
        top: [...chosen, ...fr.filter(x => !chosen.includes(x))].slice(0, topN).map(face),
        friendCount: D.users.filter(x => friends(u.id, x.id)).length,
        ingroups: D.grps.filter(g => g.uid === me && inGroup(g.id, u.id)).map(g => g.id),
        drawings: D.drawings.filter(d => d.uid === u.id).map(d => d.id).reverse(),
        beats: D.beats.filter(x => x.uid === u.id).reverse().map(({ id, name, data }) => ({ id, name, data })),
        posts: feed(me, { author: u.id, n: 5 }).posts,
        wallCount: D.wall.filter(w => w.owner === u.id).length,
        wall: rel === 'me' || rel === 'friends'
          ? D.wall.filter(w => w.owner === u.id && !blockedEither(me, w.uid)).sort((a, z) => z.created - a.created).slice(0, 50)
            .map(w => ({ ...face(user(w.uid)), id: w.id, uid: w.uid, body: w.body, created: w.created }))
          : null,
      };
    }],
    ['POST', /^\/u\/(\w+)\/wall$/, (me, b, [n]) => {
      const u = named(n);
      if (u.id !== me && !friends(me, u.id)) fail(403, `Be friends with ${u.name} to leave a comment.`);
      const body = clean(b.body, 1000);
      if (!body) fail(400, 'Write something first.');
      const id = nextId();
      D.wall.push({ id, owner: u.id, uid: me, body, created: now() });
      if (!u.pass) later(3000, () => { // pretend people write back on your page
        D.wall.push({ id: nextId(), owner: me, uid: u.id, body: pick(['thanks for the comment!!', 'hahaha', 'right back at ya', 'love u (as a friend)']), created: now() });
        tell(`${u.name} wrote on your page.`);
      });
      return { id };
    }],
    ['DELETE', /^\/wall\/(\d+)$/, (me, b, [id]) => {
      id = Number(id);
      if (!D.wall.some(w => w.id === id && (w.uid === me || w.owner === me))) fail(404, 'Comment not found.');
      D.wall = D.wall.filter(w => w.id !== id);
    }],
    ['PUT', /^\/profile$/, (me, b) => {
      const u = user(me), p = u.prof;
      for (const k of ['headline', 'mood', 'bio', 'about', 'who', 'know']) if (k in b) p[k] = clean(b[k], 3000);
      for (const k of ['bg', 'box', 'head', 'accent', 'text', 'link', 'font', 'bgMode', 'bgPic', 'autoplay', 'song', 'top', 'topN']) if (k in b) p[k] = b[k];
      if (b.interests) p.interests = { ...p.interests, ...b.interests };
      if ('pic' in b) u.pic = b.pic;
      return { prof: p };
    }],
    ['POST', /^\/drawings$/, (me, b) => {
      if (D.drawings.filter(d => d.uid === me).length >= 30) fail(400, 'You have 30 drawings. Delete one first.');
      if (!/^data:image\/png;base64,/.test(b.png || '')) fail(400, 'That is not a drawing.');
      const id = nextId();
      D.drawings.push({ id, uid: me, png: b.png });
      if (b.pic) user(me).pic = id;
      return { id };
    }],
    ['DELETE', /^\/drawings\/(\d+)$/, (me, b, [id]) => {
      id = Number(id);
      if (!D.drawings.some(d => d.id === id && d.uid === me)) fail(404, 'Drawing not found.');
      D.drawings = D.drawings.filter(d => d.id !== id);
      const u = user(me);
      if (u.pic === id) u.pic = null;
      if (u.prof.bgPic === id) Object.assign(u.prof, { bgPic: null, bgMode: 'color' });
    }],
    ['POST', /^\/beats$/, (me, b) => {
      if (D.beats.filter(x => x.uid === me).length >= 8) fail(400, 'You have 8 beats. Delete one first.');
      const id = nextId();
      D.beats.push({ id, uid: me, name: clean(b.name, 40) || 'Untitled beat', data: JSON.parse(JSON.stringify(b.data)) });
      return { id };
    }],
    ['GET', /^\/beats\/(\d+)$/, (me, b, [id]) => {
      const x = D.beats.find(y => y.id === Number(id));
      if (!x || blockedEither(me, x.uid)) fail(404, 'Beat not found.');
      return { id: x.id, name: x.name, by: user(x.uid).name, data: x.data };
    }],
    ['DELETE', /^\/beats\/(\d+)$/, (me, b, [id]) => {
      if (!D.beats.some(x => x.id === Number(id) && x.uid === me)) fail(404, 'Beat not found.');
      D.beats = D.beats.filter(x => x.id !== Number(id));
    }],
    ['GET', /^\/friends$/, me => ({
      friends: D.users.filter(u => friends(me, u.id)).sort((a, z) => a.name.localeCompare(z.name))
        .map(u => ({ ...face(u), gids: D.grps.filter(g => g.uid === me && inGroup(g.id, u.id)).map(g => g.id) })),
      requests: D.users.filter(u => added(u.id, me) && !added(me, u.id)).map(face),
      sent: D.users.filter(u => added(me, u.id) && !added(u.id, me)).map(face),
      blocked: D.users.filter(u => has(D.blocks, me + '>' + u.id)).map(({ id, name }) => ({ id, name })),
      groups: D.grps.filter(g => g.uid === me).map(({ id, name }) => ({ id, name })),
    })],
    ['POST', /^\/(add|unfriend|block|unblock)\/(\w+)$/, (me, b, [what, n]) => {
      const u = named(n);
      if (u.id === me) fail(400, "That's you!");
      if (what === 'add') {
        if (blockedEither(me, u.id)) fail(404, 'No one has that username.');
        put(D.adds, me + '>' + u.id);
        if (!u.pass && !added(u.id, me)) later(2500, () => { put(D.adds, u.id + '>' + me); tell(`${u.name} accepted your friend request!`); });
        if (!u.pass) later(4000, () => {
          if (!friends(me, u.id)) return;
          D.wall.push({ id: nextId(), owner: me, uid: u.id, body: 'thanks for the add!! :)', created: now() });
          tell(`${u.name} wrote on your page.`);
        });
      } else if (what === 'unfriend') unfriend(me, u.id);
      else if (what === 'block') { unfriend(me, u.id); put(D.blocks, me + '>' + u.id); }
      else drop(D.blocks, me + '>' + u.id);
    }],
    ['POST', /^\/groups$/, (me, b) => {
      const name = clean(b.name, 30);
      if (!name) fail(400, 'Give the group a name.');
      const id = nextId();
      D.grps.push({ id, uid: me, name });
      return { id };
    }],
    ['DELETE', /^\/groups\/(\d+)$/, (me, b, [id]) => {
      id = Number(id);
      if (!D.grps.some(g => g.id === id && g.uid === me)) fail(404, 'Group not found.');
      D.grps = D.grps.filter(g => g.id !== id);
      D.members = D.members.filter(k => Number(k.split('>')[0]) !== id);
      for (const p of D.posts) if (p.aud) p.aud = p.aud.filter(g => g !== id);
    }],
    ['POST', /^\/groups\/(\d+)\/members$/, (me, b, [id]) => {
      const g = D.grps.find(x => x.id === Number(id) && x.uid === me) || fail(404, 'Group not found.');
      if (b.on) {
        if (!friends(me, b.uid)) fail(400, 'You can only put friends in groups.');
        put(D.members, g.id + '>' + b.uid);
      } else drop(D.members, g.id + '>' + b.uid);
    }],
  ];

  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('/api/')) return realFetch(url, opts);
    const u = new URL(url, 'https://demo.invalid'), path = u.pathname.slice(4), method = opts.method || 'GET';
    let status = 200, out;
    try {
      load();
      const r = ROUTES.find(([m, re]) => m === method && re.test(path)) || fail(404, 'Not found.');
      if (!D.me && !r[3]) fail(401, 'Log in first.');
      if (D.me) user(D.me).seen = now();
      out = r[2](D.me, opts.body ? JSON.parse(opts.body) : {}, r[1].exec(path).slice(1), u.searchParams);
      if (out === undefined) out = { ok: 1 };
      if (method !== 'GET') save();
    } catch (e) {
      if (!e || !e.status) console.error(e);
      status = (e && e.status) || 500;
      out = { error: (e && e.error) || 'Something broke. Try again.' };
    }
    return new Response(JSON.stringify(out), { status, headers: { 'content-type': 'application/json' } });
  };
  window.demoDrawing = id => { load(); return (D.drawings.find(d => d.id === id) || {}).png || ''; };
  window.demoReset = () => { try { localStorage.removeItem(KEY); } catch { /* blocked */ } D = null; viewed.clear(); load(); save(); };
})();
