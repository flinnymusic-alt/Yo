'use strict';
// massive group chat: the whole front end. Plain JavaScript, no libraries.

const SITE = 'massive group chat';
const WARNING = "This is a fake site. It is NOT secure. Don't put anything real on it: no real names, addresses, phone numbers, passwords, bank or card details, or anything private. If anyone asks you for real info or money, don't trust them. Block them and don't talk to them.";
const app = document.getElementById('app');
const nav = document.getElementById('nav');
let me = null;

// Addresses. (demo/build.mjs swaps these four lines so the preview runs with no server.)
const SITE_URL = location.origin;
const drawingUrl = id => `/d/${id}.png`;
const here = () => location.pathname + location.hash;
const setHere = (path, replace) => history[replace ? 'replaceState' : 'pushState'](null, '', path);

// ---------- tiny helpers ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
async function api(method, url, body) {
  const r = await fetch('/api' + url, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: r.status });
  return data;
}
function toast(msg) {
  for (const old of document.querySelectorAll('.toast')) old.remove();
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
// The site's own "Are you sure?" box. Resolves true/false, or the typed text for a password box.
function ask(msg, { input, value = '' } = {}) {
  return new Promise(done => {
    let finished = false;
    const field = input && h('input', { type: input, value, readOnly: input === 'text', 'aria-label': msg });
    const d = h('dialog', { class: 'ask' });
    const close = ok => {
      if (finished) return;
      finished = true;
      d.close();
      d.remove();
      done(ok && (input === 'password' ? field.value : true));
    };
    d.append(h('form', { class: 'in', onsubmit: e => { e.preventDefault(); close(true); } },
      h('p', {}, msg), field,
      h('div', { class: 'row end' }, input !== 'text' && h('button', { type: 'button', onclick: () => close(false) }, 'Cancel'),
        h('button', { class: 'go' }, input === 'text' ? 'Done' : 'OK'))));
    d.addEventListener('cancel', e => { e.preventDefault(); close(false); });
    document.body.append(d);
    d.showModal();
    if (field) { field.focus(); field.select(); }
  });
}
// Wrap an event handler so errors show up as a message instead of vanishing.
const act = fn => async e => { try { await fn(e); } catch (err) { toast(err.message); } };
const store = {
  get(k) { try { return localStorage.getItem('mgc.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('mgc.' + k, v); } catch { /* private mode */ } },
};
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
  if (s < 604800) { const d = Math.floor(s / 86400); return d + (d > 1 ? ' days ago' : ' day ago'); }
  return new Date(t).toLocaleDateString();
}
const pic = (id, size, name) => id
  ? h('img', { class: 'pic', src: drawingUrl(id), width: size, height: size, alt: name + "'s pic", loading: 'lazy' })
  : h('div', { class: 'pic nopic', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size / 3) + 'px' }, title: 'No pic yet' }, '?');
const box = (title, ...kids) => h('section', { class: 'box' }, title && h('h2', {}, title), h('div', { class: 'in' }, ...kids));
const pbox = (title, props, ...kids) => h('section', { class: 'pbox', ...props }, title && h('h3', {}, title), ...kids);
const chip = (label, on, onclick) => h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick }, label);
function select(options, value, onchange) {
  const s = h('select', { onchange }, options.map(([v, label]) => h('option', { value: v }, label)));
  s.value = value;
  return s;
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied!'); } catch { await ask('Copy this:', { input: 'text', value: text }); }
}
const inviteLink = () => SITE_URL + '/join/' + me.name;

// ---------- routing ----------
let view = 0;
function go(path, replace) {
  setHere(path, replace);
  render();
}
addEventListener('popstate', () => render());
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || a.target || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});

const ROUTES = [
  [/^\/$/, () => feedPage()],
  [/^\/u\/(\w{1,20})$/, m => profilePage(m[1])],
  [/^\/edit$/, (m, frag) => editPage(frag)],
  [/^\/draw$/, () => drawPage()],
  [/^\/beat(?:\/(\d+))?$/, m => beatPage(m[1])],
  [/^\/friends$/, () => friendsPage()],
];

async function render() {
  const v = ++view;
  Sound.stop();
  resetTheme();
  drawNav();
  const [path, frag = ''] = here().split('#');
  const join = /^\/join\/(\w{1,20})$/.exec(path);
  let el;
  try {
    if (!me) el = join ? await joinPage(join[1]) : landingPage();
    else if (join) return go('/u/' + join[1], true);
    else {
      const r = ROUTES.find(([re]) => re.test(path));
      el = r ? await r[1](r[0].exec(path), frag) : box('Not found', h('p', {}, 'Nothing here. ', h('a', { href: '/' }, 'Go home')));
    }
  } catch (err) {
    if (err.status === 401) { me = null; return render(); }
    el = box('Oops', h('p', {}, err.message), h('p', {}, h('a', { href: '/' }, 'Go home')));
  }
  if (v !== view) return; // the person already clicked somewhere else
  app.replaceChildren(el);
  scrollTo(0, 0);
  if (el.theme) applyTheme(el.theme);
  if (el.after) el.after();
}

function drawNav() {
  if (!me) return nav.replaceChildren();
  const links = [['/', 'Home'], ['/u/' + me.name, 'My Page'], ['/friends', 'Friends' + (me.requests ? ` (${me.requests})` : '')],
    ['/draw', 'Draw'], ['/beat', 'Beat Maker'], ['/edit', 'Edit Page']];
  nav.replaceChildren(
    ...links.map(([href, t]) => h('a', { href, class: here().split('#')[0] === href ? 'here' : '' }, t)),
    h('button', { onclick: act(async () => { await api('POST', '/logout'); me = null; go('/'); }) }, 'Log out'));
}
async function refreshMe() { me = await api('GET', '/me'); drawNav(); }

// ---------- log in / sign up ----------
function authForm(signup, invite) {
  const name = h('input', { autocomplete: 'username', maxLength: 20, required: true, pattern: '[A-Za-z0-9_]{3,20}', autocapitalize: 'off', spellcheck: false });
  const pass = h('input', { type: 'password', autocomplete: signup ? 'new-password' : 'current-password', minLength: 4, required: true });
  const ok = signup && h('input', { type: 'checkbox', required: true });
  return h('form', {
    class: 'stack',
    onsubmit: act(async e => {
      e.preventDefault();
      me = await api('POST', signup ? '/signup' : '/login',
        signup ? { name: name.value, pass: pass.value, invite, ok: ok.checked } : { name: name.value, pass: pass.value });
      go(invite ? '/u/' + invite : signup ? '/u/' + me.name : '/', true);
    }),
  },
  h('label', {}, 'Username', name),
  h('label', {}, 'Password', pass),
  signup && h('p', { class: 'hint' }, "Make up a username (not your real name) and use a password you don't use anywhere else."),
  signup && h('label', { class: 'check' }, ok, h('span', {}, "I get it: this site is fake and not secure. I won't put anything real on it.")),
  h('button', { class: 'go' }, signup ? 'Sign up' : 'Log in'));
}
const bigWarning = () => h('div', { class: 'bigwarn' }, h('h2', {}, '⚠ Read this first'), h('p', {}, WARNING));

function landingPage() {
  return h('div', {},
    bigWarning(),
    h('div', { class: 'cols2' }, box('Member login', authForm(false)), box('New here? Sign up', authForm(true))),
    box(`What is ${SITE}?`, h('p', {}, "A silly, old-school social network for you and your friends. Make a page and dress it up, draw your face, make a beat that plays at the top of your page, and post dumb stuff for your friends to comment on. That's it."),
      h('p', {}, "You only see posts from your friends. You can sort friends into groups like Friends or Family, then post to just that group or filter your feed by it.")));
}

async function joinPage(name) {
  const inv = await api('GET', '/invite/' + name).catch(() => null);
  return h('div', {},
    bigWarning(),
    h('div', { class: 'cols2' },
      box(inv ? `${inv.name} invited you!` : `Join ${SITE}`,
        inv && h('p', {}, `Sign up and you and ${inv.name} will be friends straight away.`), authForm(true, inv && inv.name)),
      box('Already a member? Log in', authForm(false, inv && inv.name))));
}

// ---------- feed ----------
async function feedPage() {
  let filter = Number(store.get('filter')) || 0;
  if (!me.groups.some(g => g.id === filter)) filter = 0;
  const list = h('div', {});
  const more = h('button', { class: 'more', hidden: true }, 'Load more');
  let before = 0;
  async function load(reset) {
    if (reset) before = 0;
    const r = await api('GET', `/feed?g=${filter}&before=${before}`);
    const posts = r.posts.map(postEl);
    reset ? list.replaceChildren(...posts) : list.append(...posts);
    if (r.posts.length) before = r.posts.at(-1).id;
    more.hidden = !r.more;
    if (!list.children.length) list.append(h('p', { class: 'empty' }, filter
      ? 'Nobody in this group has posted yet. (Put people in groups on the Friends page.)'
      : 'Nothing here yet. Write something, or send your invite link to some friends.'));
  }
  more.onclick = act(() => load(false));
  const tabs = h('div', { class: 'chips' });
  const drawTabs = () => tabs.replaceChildren(...[{ id: 0, name: 'All' }, ...me.groups].map(g =>
    chip(g.name, g.id === filter, act(async () => { filter = g.id; store.set('filter', filter); drawTabs(); await load(true); }))));
  drawTabs();
  await load(true);
  return h('div', { class: 'home' },
    sidebar(),
    h('div', {}, composer(() => load(true)), box('Posts from your friends', h('div', { class: 'show' }, 'Show:', tabs), list, more)));
}

function sidebar() {
  const link = inviteLink();
  return h('aside', {},
    box(null, h('div', { class: 'hello' }, h('a', { href: '/u/' + me.name }, pic(me.pic, 80, me.name)),
      h('div', {}, h('b', {}, `Hello, ${me.name}!`), h('br'), h('a', { href: '/u/' + me.name }, 'View my page'), h('br'), h('a', { href: '/edit' }, 'Edit my page')))),
    me.requests ? box('Friend requests', h('p', {}, h('a', { href: '/friends' }, `You have ${me.requests} new friend request${me.requests > 1 ? 's' : ''}!`))) : null,
    box('Invite friends', h('p', { class: 'hint' }, "Send them this link. When they sign up, you're friends."),
      h('input', { readOnly: true, value: link, onclick: e => e.target.select(), 'aria-label': 'Invite link' }),
      h('div', { class: 'row' }, h('button', { onclick: () => copy(link) }, 'Copy invite link'))),
    box('Make stuff', h('ul', { class: 'links' },
      h('li', {}, h('a', { href: '/draw' }, 'Draw something')),
      h('li', {}, h('a', { href: '/beat' }, 'Make a beat')),
      h('li', {}, h('a', { href: '/friends' }, 'Sort friends into groups')))));
}

function composer(onPosted) {
  const ta = h('textarea', { maxLength: 2000, rows: 3, placeholder: 'Write something funny for your friends… (nothing real, this site is fake!)', 'aria-label': 'New post' });
  const sel = new Set(); // empty = everyone
  const chips = h('div', { class: 'chips' });
  const drawChips = () => chips.replaceChildren(
    chip('All my friends', !sel.size, () => { sel.clear(); drawChips(); }),
    ...me.groups.map(g => chip(g.name, sel.has(g.id), () => { sel.has(g.id) ? sel.delete(g.id) : sel.add(g.id); drawChips(); })));
  drawChips();
  const btn = h('button', { class: 'go' }, 'Post');
  return h('form', {
    class: 'box',
    onsubmit: act(async e => {
      e.preventDefault();
      if (!ta.value.trim()) return;
      btn.disabled = true;
      try { await api('POST', '/posts', { body: ta.value, groups: [...sel] }); ta.value = ''; await onPosted(); } finally { btn.disabled = false; }
    }),
  }, h('h2', {}, 'Post something'), h('div', { class: 'in' }, ta,
    h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Who sees it:'), chips),
    h('div', { class: 'row end' }, btn)));
}

const groupName = id => (me.groups.find(g => g.id === id) || { name: 'deleted group' }).name;
function likeButton(kind, o) {
  const b = h('button', { onclick: act(async () => { Object.assign(o, await api('POST', '/like', { kind, id: o.id })); paint(); }) });
  const paint = () => {
    b.className = 'like' + (o.liked ? ' on' : '');
    b.textContent = (o.liked ? '♥ ' : '♡ ') + (o.likes || 'Like');
    b.title = o.liked ? 'Unlike' : 'Like';
  };
  paint();
  return b;
}
function postEl(p) {
  const comments = h('div', {}, p.comments.map(c => commentEl(c, p)));
  const input = h('input', { maxLength: 1000, placeholder: 'Write a comment…', 'aria-label': 'Write a comment' });
  const el = h('article', { class: 'post' },
    h('a', { href: '/u/' + p.name, tabIndex: -1 }, pic(p.pic, 48, p.name)),
    h('div', { class: 'pbody' },
      h('div', {}, h('a', { href: '/u/' + p.name, class: 'who' }, p.name), ' ',
        h('span', { class: 'when', title: new Date(p.created).toLocaleString() }, ago(p.created)),
        p.aud && h('span', { class: 'aud' }, ' · to ' + (p.aud.length ? p.aud.map(groupName).join(', ') : 'only you'))),
      h('div', { class: 'text' }, p.body),
      h('div', { class: 'actions' }, likeButton('post', p),
        p.uid === me.id && h('button', {
          class: 'linkish small',
          onclick: act(async () => { if (await ask('Delete this post?')) { await api('DELETE', '/posts/' + p.id); el.remove(); } }),
        }, 'Delete')),
      comments,
      h('form', {
        class: 'reply',
        onsubmit: act(async e => {
          e.preventDefault();
          const body = input.value.trim();
          if (!body) return;
          const r = await api('POST', `/posts/${p.id}/comments`, { body });
          input.value = '';
          comments.append(commentEl({ id: r.id, uid: me.id, name: me.name, pic: me.pic, body, created: Date.now(), likes: 0, liked: 0 }, p));
        }),
      }, input, h('button', {}, 'Send'))));
  return el;
}
function commentEl(c, p) {
  const el = h('div', { class: 'comment' },
    h('a', { href: '/u/' + c.name, tabIndex: -1 }, pic(c.pic, 28, c.name)),
    h('div', { class: 'pbody' }, h('a', { href: '/u/' + c.name, class: 'who' }, c.name), ' ', h('span', { class: 'text' }, c.body),
      h('div', { class: 'meta' }, h('span', { class: 'when' }, ago(c.created)), likeButton('comment', c),
        (c.uid === me.id || p.uid === me.id) && h('button', {
          class: 'linkish small',
          onclick: act(async () => { if (await ask('Delete this comment?')) { await api('DELETE', '/comments/' + c.id); el.remove(); } }),
        }, 'Delete'))));
  return el;
}

// ---------- profile ----------
const CLASSIC = { bg: '#e5e5e5', box: '#ffffff', head: '#6699cc', accent: '#ff6600', text: '#000000', link: '#003399', font: 'verdana', bgMode: 'color', bgPic: null };
const PRESETS = {
  Classic: CLASSIC,
  'Emo Night': { bg: '#000000', box: '#141414', head: '#cc0066', accent: '#ff66cc', text: '#eeeeee', link: '#66ccff', font: 'trebuchet' },
  Bubblegum: { bg: '#ffcce6', box: '#fff5fa', head: '#ff66aa', accent: '#cc0066', text: '#330022', link: '#8800cc', font: 'comic' },
  Hacker: { bg: '#001a00', box: '#000000', head: '#008800', accent: '#33ff33', text: '#66ff66', link: '#ccffcc', font: 'courier' },
  Skater: { bg: '#333333', box: '#f2e6c9', head: '#8b4513', accent: '#b22222', text: '#222222', link: '#004488', font: 'georgia' },
  Ocean: { bg: '#0b3d5c', box: '#e8f6ff', head: '#1478a6', accent: '#ff7f50', text: '#0b2233', link: '#005f87', font: 'arial' },
};
const FONTS = {
  verdana: ['Verdana', 'Verdana, Geneva, sans-serif'], arial: ['Arial', 'Arial, Helvetica, sans-serif'],
  georgia: ['Georgia', 'Georgia, serif'], times: ['Times', '"Times New Roman", Times, serif'],
  courier: ['Courier', '"Courier New", Courier, monospace'], comic: ['Comic Sans', '"Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive'],
  trebuchet: ['Trebuchet', '"Trebuchet MS", sans-serif'], impact: ['Impact', 'Impact, "Arial Black", sans-serif'],
};
const SECTIONS = [['bio', 'Bio'], ['about', 'About me'], ['who', 'Who am I'], ['know', 'Get to know me']];
const INTERESTS = [['general', 'General'], ['music', 'Music'], ['movies', 'Movies'], ['tv', 'Television'], ['books', 'Books'], ['heroes', 'Heroes']];
const COLOR_NAMES = [['bg', 'Page background'], ['box', 'Boxes'], ['head', 'Box headers'], ['accent', 'Highlights'], ['text', 'Text'], ['link', 'Links']];

const isDark = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000 < 150; };
function applyTheme(p) {
  const t = { ...CLASSIC, ...p }, s = document.body.style;
  resetTheme();
  for (const [k] of COLOR_NAMES) s.setProperty('--' + k, t[k]);
  s.setProperty('--headtext', isDark(t.head) ? '#fff' : '#000');
  s.setProperty('--font', (FONTS[t.font] || FONTS.verdana)[1]);
  if (t.bgMode !== 'color' && t.bgPic) {
    // Drawings are black on white. On a light color, "multiply" swaps the white for your color.
    // On a dark color, flip the drawing to white lines first (difference with white), then "lighten" adds your color.
    const img = `url("${drawingUrl(Number(t.bgPic))}")`, size = t.bgMode === 'full' ? 'cover' : '160px';
    if (isDark(t.bg)) Object.assign(s, { backgroundImage: `linear-gradient(${t.bg},${t.bg}), ${img}, linear-gradient(#fff,#fff)`, backgroundBlendMode: 'lighten, difference, normal', backgroundSize: `auto, ${size}, auto` });
    else Object.assign(s, { backgroundImage: img, backgroundBlendMode: 'multiply', backgroundSize: size });
    if (t.bgMode === 'full') Object.assign(s, { backgroundPosition: 'center', backgroundAttachment: 'fixed' });
  }
  document.body.classList.add('themed');
}
function resetTheme() { document.body.removeAttribute('style'); document.body.classList.remove('themed'); }

async function profilePage(name) {
  const r = await api('GET', '/u/' + name);
  if (r.blocked) return box(r.name, h('p', {}, `You blocked ${r.name}.`), h('button', { onclick: act(async () => { await api('POST', '/unblock/' + r.name); render(); }) }, 'Unblock'));
  const u = r.user, p = { ...CLASSIC, ...r.prof }, mine = r.rel === 'me', ints = p.interests || {};
  const online = Date.now() - u.seen < 5 * 6e4;
  const jump = (label, id) => h('button', { class: 'linkish', onclick: () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }, label);
  const music = musicBox(r, p, mine);

  const left = h('div', {},
    pbox(null, { class: 'pbox ident' },
      h('h1', {}, u.name),
      h('div', { class: 'idrow' }, pic(u.pic, 150, u.name),
        h('div', { class: 'idinfo' },
          p.headline && h('p', { class: 'headline' }, `"${p.headline}"`),
          p.mood && h('p', {}, h('b', { class: 'acc' }, 'Mood: '), p.mood),
          h('p', {}, online ? h('span', { class: 'online' }, 'Online Now!') : 'Last seen: ' + (u.seen ? ago(u.seen) : 'a while ago')),
          h('p', {}, h('b', { class: 'acc' }, 'Profile views: '), u.views.toLocaleString()),
          h('p', {}, 'Member since ' + new Date(u.created).toLocaleDateString()),
          mine && !u.pic && h('p', {}, h('a', { href: '/draw' }, 'Draw your face →')))),
      h('p', { class: 'viewmy' }, h('b', {}, 'View my: '), jump('Drawings', 'drawings'), ' | ', jump('Music', 'music'), ' | ', jump('Friends', 'friendspace'), ' | ', jump('Comments', 'comments'))),
    contactBox(r),
    pbox(null, {}, h('div', { class: 'url' }, h('b', {}, `${u.name}'s URL:`), h('br'), SITE_URL + '/u/' + u.name)),
    pbox(`${u.name}'s Interests`, {}, INTERESTS.some(([k]) => ints[k])
      ? h('table', { class: 'ints' }, INTERESTS.filter(([k]) => ints[k]).map(([k, label]) => h('tr', {}, h('th', {}, label), h('td', {}, ints[k]))))
      : h('p', { class: 'small' }, mine ? h('a', { href: '/edit' }, 'Add your interests') : 'Nothing here yet.')));

  const ext = { me: 'This is your page. Make it yours!', friends: `${u.name} is your friend!`, received: `${u.name} wants to be your friend!`,
    sent: `You asked ${u.name} to be friends.`, none: `${u.name} is in your extended network` }[r.rel];
  const right = h('div', {},
    pbox(null, { class: 'pbox ext' }, ext),
    pbox(`${u.name}'s Blurbs`, {}, SECTIONS.some(([k]) => p[k]) || mine
      ? SECTIONS.filter(([k]) => p[k] || mine).map(([k, label]) => h('div', { class: 'blurb' }, h('h4', { class: 'acc' }, label + ':'),
        p[k] ? h('p', { class: 'text' }, p[k]) : h('p', { class: 'small' }, h('a', { href: '/edit' }, 'Write something here'))))
      : h('p', { class: 'small' }, 'Nothing here yet.')),
    drawingsBox(r, p, mine),
    pbox(`${u.name}'s Friend Space`, { id: 'friendspace' },
      h('p', {}, h('b', { class: 'acc' }, `${u.name} has ${r.friendCount} friend${r.friendCount === 1 ? '' : 's'}.`), r.top.length ? ` Top ${p.topN || 8}:` : ''),
      r.top.length ? h('div', { class: 'top8' }, r.top.map(f => h('a', { href: '/u/' + f.name, class: 'friend' }, pic(f.pic, 80, f.name), f.name))) : null,
      mine && h('p', { class: 'small' }, h('a', { href: '/friends' }, 'See all my friends'), ' · ', h('a', { href: '/edit#top8' }, 'Pick my Top friends'))),
    pbox(`${u.name}'s Latest Posts`, {}, r.posts.length ? r.posts.map(postEl)
      : h('p', { class: 'small' }, mine ? 'You haven\'t posted yet.' : r.rel === 'friends' ? 'No posts yet.' : `Be friends with ${u.name} to see their posts.`)),
    wallBox(r));

  const el = h('div', { class: 'profile' }, music, h('div', { class: 'pcols' }, left, right));
  el.theme = p;
  // Browsers only allow sound after you've clicked something on the site, so autoplay only kicks in then.
  if (p.autoplay && r.beats.length && navigator.userActivation?.hasBeenActive) el.after = () => music.querySelector('.play')?.click();
  return el;
}

// "Friends Comments": the comment wall at the bottom of a page. Only the owner's friends see it and write on it.
function wallBox(r) {
  const u = r.user, mine = r.rel === 'me';
  const head = h('p', {}, h('b', { class: 'acc' }, `${u.name} has ${r.wallCount} comment${r.wallCount === 1 ? '' : 's'}.`));
  if (!r.wall) return pbox(`${u.name}'s Friends Comments`, { id: 'comments' }, head, h('p', { class: 'small' }, `Be friends with ${u.name} to see and leave comments.`));
  const one = w => {
    const el = h('div', { class: 'wall' },
      h('a', { href: '/u/' + w.name, class: 'friend' }, pic(w.pic, 56, w.name), w.name),
      h('div', { class: 'pbody' }, h('div', { class: 'when' }, ago(w.created)), h('div', { class: 'text' }, w.body),
        (mine || w.uid === me.id) && h('button', {
          class: 'linkish small',
          onclick: act(async () => { if (await ask('Delete this comment?')) { await api('DELETE', '/wall/' + w.id); el.remove(); } }),
        }, 'Delete')));
    return el;
  };
  const list = h('div', {}, r.wall.map(one));
  const input = h('textarea', { rows: 2, maxLength: 1000, placeholder: mine ? 'Write on your own page…' : 'Leave a comment… (thanks for the add!)', 'aria-label': 'Leave a comment' });
  return pbox(`${u.name}'s Friends Comments`, { id: 'comments' }, head,
    h('form', {
      class: 'stack',
      onsubmit: act(async e => {
        e.preventDefault();
        const body = input.value.trim();
        if (!body) return;
        const res = await api('POST', `/u/${u.name}/wall`, { body });
        input.value = '';
        list.prepend(one({ id: res.id, uid: me.id, name: me.name, pic: me.pic, body, created: Date.now() }));
      }),
    }, input, h('div', { class: 'row end' }, h('button', {}, 'Add comment'))),
    list);
}

function contactBox(r) {
  const u = r.user;
  const cmd = (label, path, q, after) => h('button', {
    class: 'linkish',
    onclick: act(async () => { if (q && !(await ask(q))) return; await api('POST', path + u.name); await refreshMe(); after ? after() : render(); }),
  }, label);
  if (r.rel === 'me') return pbox("It's you!", {}, h('div', { class: 'cgrid' },
    h('a', { href: '/edit' }, 'Edit my page'), h('a', { href: '/draw' }, 'Draw something'),
    h('a', { href: '/beat' }, 'Make a beat'), h('button', { class: 'linkish', onclick: () => copy(inviteLink()) }, 'Copy invite link')));
  const main = {
    none: cmd('➕ Add to Friends', '/add/'),
    sent: cmd('Cancel friend request', '/unfriend/'),
    received: cmd('✔ Accept friend request', '/add/'),
    friends: cmd('Unfriend', '/unfriend/', `Unfriend ${u.name}?`),
  }[r.rel];
  return pbox(`Contacting ${u.name}`, {},
    h('div', { class: 'cgrid' }, main,
      h('button', { class: 'linkish', onclick: () => copy(SITE_URL + '/u/' + u.name) }, 'Copy link to page'),
      cmd('🚫 Block', '/block/', `Block ${u.name}? You won't see each other's stuff, and you won't be friends anymore.`, () => go('/'))),
    r.rel === 'friends' && h('div', {}, h('p', { class: 'small' }, `Put ${u.name} in your groups:`), groupChips(u.id, r.ingroups)));
}

function groupChips(uid, ingroups) {
  const on = new Set(ingroups);
  const el = h('div', { class: 'chips' });
  const draw = () => el.replaceChildren(...me.groups.map(g => chip(g.name, on.has(g.id), act(async () => {
    const v = !on.has(g.id);
    await api('POST', `/groups/${g.id}/members`, { uid, on: v });
    v ? on.add(g.id) : on.delete(g.id);
    draw();
  }))));
  draw();
  return el;
}

function drawingsBox(r, p, mine) {
  const setProf = (data, msg) => act(async () => { await api('PUT', '/profile', data); if ('pic' in data) me.pic = data.pic; toast(msg); render(); });
  return pbox(`${r.user.name}'s Drawings`, { id: 'drawings' },
    r.drawings.length ? h('div', { class: 'drawings' }, r.drawings.map(id => h('figure', {},
      h('img', { src: drawingUrl(id), alt: 'A drawing', loading: 'lazy', width: 150, height: 150 }),
      mine && h('figcaption', {},
        h('button', { class: 'linkish', onclick: setProf({ pic: id }, 'That\'s your pic now.') }, 'Use as pic'),
        h('button', { class: 'linkish', onclick: setProf({ bgPic: id, bgMode: p.bgMode === 'full' ? 'full' : 'tile' }, 'Background set.') }, 'Use as background'),
        h('button', { class: 'linkish', onclick: act(async () => { if (await ask('Delete this drawing?')) { await api('DELETE', '/drawings/' + id); if (me.pic === id) me.pic = null; render(); } }) }, 'Delete')))))
      : h('p', { class: 'small' }, mine ? h('a', { href: '/draw' }, 'Draw something') : 'No drawings yet.'));
}

function musicBox(r, p, mine) {
  const beats = [...r.beats].sort((a, b) => (b.id === p.song) - (a.id === p.song));
  if (!beats.length && !mine) return h('div', { id: 'music' });
  return pbox(`♫ ${r.user.name}'s Music`, { class: 'pbox music', id: 'music' },
    beats.length ? beats.map(b => {
      const btn = h('button', { class: 'play', title: 'Play' }, '▶');
      const steps = h('span', { class: 'steps', 'aria-hidden': 'true' }, Array.from({ length: 16 }, () => h('i')));
      btn.onclick = () => Sound.token === b ? Sound.stop() : Sound.play(b.data, s => {
        [...steps.children].forEach((x, i) => x.classList.toggle('on', i === s));
        btn.textContent = s < 0 ? '▶' : '■';
        btn.title = s < 0 ? 'Play' : 'Stop';
      }, b);
      const row = h('div', { class: 'track' }, btn, h('span', { class: 'name' }, b.name), steps,
        h('a', { href: '/beat/' + b.id, class: 'small' }, mine ? 'Edit a copy' : 'Remix'),
        mine && h('button', { class: 'linkish small', onclick: act(async () => { if (await ask(`Delete "${b.name}"?`)) { await api('DELETE', '/beats/' + b.id); render(); } }) }, 'Delete'));
      return row;
    }) : h('p', { class: 'small' }, 'No music yet. ', h('a', { href: '/beat' }, 'Make a beat'), ' and it plays here.'));
}

// ---------- edit my page ----------
const MOODS = ['happy 😀', 'cheeky 😜', 'chill 😎', 'sleepy 😴', 'hyper 🤪', 'in love 😍', 'sad 😢', 'grumpy 😠', 'bored 😐', 'hungry 🍕', 'thinking 🤔', 'partying 🥳'];
const TOP_SIZES = [4, 8, 12, 16];

async function editPage(frag) {
  const [r, f] = await Promise.all([api('GET', '/u/' + me.name), api('GET', '/friends')]);
  const p = { ...CLASSIC, ...r.prof }, ints = p.interests || {};
  const input = (name, value, max, rows) => rows
    ? h('textarea', { name, maxLength: max, rows, value: value || '' })
    : h('input', { name, maxLength: max, value: value || '' });
  const field = (label, el) => h('label', {}, label, el);
  const els = {};
  for (const [k, max] of [['headline', 120], ['mood', 40]]) els[k] = input(k, p[k], max);
  for (const [k] of SECTIONS) els[k] = input(k, p[k], 3000, 4);
  for (const [k] of INTERESTS) els['i_' + k] = input('i_' + k, ints[k], 600, 2);
  for (const [k] of COLOR_NAMES) els[k] = h('input', { type: 'color', value: p[k] });
  els.font = select(Object.entries(FONTS).map(([k, v]) => [k, v[0]]), p.font);
  els.bgMode = select([['color', 'Just the color'], ['tile', 'Tile my drawing (mosaic)'], ['full', 'One big drawing']], p.bgMode);
  els.song = select([['', '(newest beat)'], ...r.beats.map(b => [b.id, b.name])], p.song || '');
  els.autoplay = h('input', { type: 'checkbox', checked: !!p.autoplay });
  let bgPic = p.bgPic;
  const picker = h('div', { class: 'picker' }, r.drawings.length ? r.drawings.map(id => h('label', {},
    h('img', { src: drawingUrl(id), alt: 'Drawing', width: 70, height: 70 }),
    h('input', { type: 'radio', name: 'bgpic', checked: id === bgPic, onchange: () => { bgPic = id; preview(); } }))) : h('span', { class: 'small' }, 'Draw something first, then you can use it as your background.'));
  const topIds = (Array.isArray(p.top) && p.top.length ? p.top : r.top.map(t => t.id));
  const tops = Array.from({ length: 16 }, (_, i) => select([['', '(empty)'], ...f.friends.map(x => [x.id, x.name])], topIds[i] || ''));
  const topBox = h('div', { class: 'top8pick' });
  els.topN = select(TOP_SIZES.map(n => [n, `Top ${n}`]), p.topN || 8, () => drawTops());
  const drawTops = () => topBox.replaceChildren(...tops.slice(0, Number(els.topN.value)).map((s, i) => field(`#${i + 1}`, s)));
  drawTops();

  const read = () => ({
    headline: els.headline.value, mood: els.mood.value,
    ...Object.fromEntries(SECTIONS.map(([k]) => [k, els[k].value])),
    interests: Object.fromEntries(INTERESTS.map(([k]) => [k, els['i_' + k].value])),
    ...Object.fromEntries(COLOR_NAMES.map(([k]) => [k, els[k].value])),
    font: els.font.value, bgMode: els.bgMode.value, bgPic: bgPic || null,
    song: els.song.value ? Number(els.song.value) : null, autoplay: els.autoplay.checked ? 1 : 0,
    topN: Number(els.topN.value),
    top: [...new Set(tops.slice(0, Number(els.topN.value)).map(s => Number(s.value)).filter(Boolean))],
  });
  const preview = () => applyTheme(read()); // shows your colors and background while you edit
  const presets = h('div', { class: 'row presets' }, Object.entries(PRESETS).map(([name, t]) => h('button', {
    type: 'button', style: { background: t.bg, color: t.text, borderColor: t.head, fontFamily: FONTS[t.font][1] },
    onclick: () => { for (const [k] of COLOR_NAMES) els[k].value = t[k]; els.font.value = t.font; preview(); },
  }, name)));
  const save = h('button', { class: 'go' }, 'Save my page');

  const el = h('form', {
    oninput: preview, onchange: preview,
    onsubmit: act(async e => { e.preventDefault(); save.disabled = true; try { await api('PUT', '/profile', read()); go('/u/' + me.name); } finally { save.disabled = false; } }),
  },
  box('About you', h('p', { class: 'warnline' }, 'Remember: nothing real. Make stuff up, be silly.'),
    h('div', { class: 'stack' }, field('Headline (a quote under your name)', els.headline), field('Mood', els.mood),
      h('div', { class: 'chips' }, MOODS.map(m => chip(m, false, () => { els.mood.value = m; }))),
      ...SECTIONS.map(([k, label]) => field(label, els[k])))),
  box('Interests', h('div', { class: 'stack' }, ...INTERESTS.map(([k, label]) => field(label, els['i_' + k])))),
  box('Dress up your page', h('p', { class: 'hint' }, 'Pick a starter look, then change anything. The page behind this form shows your background as you go.'),
    presets,
    h('div', { class: 'colors' }, ...COLOR_NAMES.map(([k, label]) => field(label, els[k]))),
    h('div', { class: 'row' }, field('Font', els.font), field('Background', els.bgMode)),
    h('p', { class: 'small' }, 'Background drawing:'), picker),
  box('Music', h('div', { class: 'stack' }, field('Song at the top of my page', els.song),
    h('label', { class: 'check' }, els.autoplay, h('span', {}, 'Play it when people open my page (old school!)')))),
  h('section', { class: 'box', id: 'top8' }, h('h2', {}, 'My Top Friends'), h('div', { class: 'in' },
    f.friends.length ? [h('div', { class: 'row' }, field('How many to show', els.topN)), topBox] : h('p', { class: 'small' }, 'Add some friends first.'))),
  h('div', { class: 'row end' }, h('a', { href: '/u/' + me.name }, 'Cancel'), save),
  box('Delete my account', h('p', { class: 'small' }, 'This deletes your page, posts, comments, drawings and beats for good.'),
    h('button', {
      type: 'button', class: 'danger',
      onclick: act(async () => {
        const pass = await ask('Type your password to delete your account. This cannot be undone.', { input: 'password' });
        if (!pass) return;
        await api('DELETE', '/me', { pass });
        me = null;
        go('/', true);
      }),
    }, 'Delete my account')));
  el.theme = p;
  if (frag === 'top8') el.after = () => document.getElementById('top8')?.scrollIntoView();
  return el;
}

// ---------- drawing pad ----------
function drawPage() {
  const S = 300;
  const c = h('canvas', { width: S, height: S, class: 'pad', 'aria-label': 'Drawing pad' });
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff';
  x.fillRect(0, 0, S, S);
  x.lineCap = x.lineJoin = 'round';
  const TOOLS = { Pencil: [2, '#000'], Marker: [7, '#000'], Eraser: [18, '#fff'] };
  let tool = 'Pencil', down = false, last = null, drew = false;
  const undo = [];
  const at = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * S / b.width, (e.clientY - b.top) * S / b.height]; };
  const line = (a, b) => {
    [x.lineWidth, x.strokeStyle] = TOOLS[tool];
    x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke();
  };
  const save = () => { undo.push(x.getImageData(0, 0, S, S)); if (undo.length > 25) undo.shift(); };
  c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); save(); down = drew = true; last = at(e); line(last, [last[0] + .1, last[1]]); };
  c.onpointermove = e => { if (!down) return; for (const ev of e.getCoalescedEvents?.() || [e]) { const pt = at(ev); line(last, pt); last = pt; } };
  c.onpointerup = c.onpointercancel = () => { down = false; };
  const tools = h('div', { class: 'chips' });
  const drawTools = () => tools.replaceChildren(...Object.keys(TOOLS).map(t => chip(t, t === tool, () => { tool = t; drawTools(); })));
  drawTools();
  const post = asPic => act(async e => {
    if (!drew && !(await ask("It's blank. Post it anyway?"))) return;
    e.target.disabled = true;
    try {
      const r = await api('POST', '/drawings', { png: c.toDataURL('image/png'), pic: asPic ? 1 : 0 });
      if (asPic) me.pic = r.id;
      go('/u/' + me.name);
    } finally { e.target.disabled = false; }
  });
  return box('Draw something', h('p', { class: 'hint' }, 'Black and white, pencil only. Draw your face and make it your pic, or post any doodle to your page.'),
    h('div', { class: 'row' }, tools,
      h('button', { onclick: () => { if (undo.length) x.putImageData(undo.pop(), 0, 0); } }, 'Undo'),
      h('button', { onclick: () => { save(); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); } }, 'Clear')),
    c,
    h('div', { class: 'row' }, h('button', { class: 'go', onclick: post(true) }, 'Post & make it my pic'), h('button', { onclick: post(false) }, 'Post to my page')));
}

// ---------- sound: drums, bass and 3 synths, all made in the browser ----------
const SCALES = [[0, 3, 5, 7, 10, 12, 15, 17], [0, 2, 4, 7, 9, 12, 14, 16]]; // minor and major pentatonic: everything sounds OK together
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DRUMS = ['Kick', 'Snare', 'Hi-hat', 'Clap'];
const SYNTHS = [
  { name: 'Square lead', type: 'square', a: .005, d: .22, cut: 2400, oct: 12, vol: .11 },
  { name: 'Saw', type: 'sawtooth', a: .005, d: .3, cut: 3200, oct: 12, vol: .1 },
  { name: 'Soft pad', type: 'triangle', a: .08, d: .8, cut: 5000, oct: 0, vol: .25 },
  { name: 'Pluck', type: 'sawtooth', a: .002, d: .16, cut: 5000, oct: 12, vol: .15, sweep: 1 },
  { name: 'Bell', type: 'sine', a: .002, d: .9, cut: 9000, oct: 24, vol: .14, bell: 1 },
];
const midiOf = (B, track, row) => (track === 'b' ? 36 : 48 + SYNTHS[B.s[track].p].oct) + B.key + SCALES[B.scale][row];
const noteName = m => KEYS[m % 12] + (Math.floor(m / 12) - 1);
const newBeat = () => ({ bpm: 100, key: 9, scale: 0, d: [0x0501, 0x1010, 0x5555, 0], b: [0, 0, 0, 0, 0, 0, 0, 0], s: [0, 3, 2].map(p => ({ p, r: [0, 0, 0, 0, 0, 0, 0, 0] })) });

const Sound = (() => {
  let ctx, out, noise, timer = null, step = 0, next = 0, beat = null, cb = null;
  const S = { token: null };
  const freq = m => 440 * 2 ** ((m - 69) / 12);
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createDynamicsCompressor();
    out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const gain = (dest = out) => { const g = ctx.createGain(); g.connect(dest); return g; };
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  const filt = (type, f, q, dest) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
  const osc = (type, f, t, len, dest) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + len + .05); return o; };
  const hiss = (t, len, dest) => { const s = ctx.createBufferSource(); s.buffer = noise; s.connect(dest); s.start(t); s.stop(t + len); };
  const DRUM = [
    t => { const g = gain(); env(g, t, 1, .002, .35); osc('sine', 150, t, .4, g).frequency.exponentialRampToValueAtTime(42, t + .12); },
    t => { const g = gain(); env(g, t, .5, .001, .17); hiss(t, .2, filt('highpass', 1200, .7, g)); const g2 = gain(); env(g2, t, .35, .001, .08); osc('triangle', 190, t, .1, g2); },
    t => { const g = gain(); env(g, t, .22, .001, .045); hiss(t, .06, filt('highpass', 7500, .7, g)); },
    t => {
      const g = gain();
      for (const dt of [0, .011, .022]) { g.gain.setValueAtTime(.6, t + dt); g.gain.exponentialRampToValueAtTime(.05, t + dt + .01); }
      g.gain.setValueAtTime(.5, t + .033); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
      hiss(t, .22, filt('bandpass', 1400, 1.2, g));
    },
  ];
  function bass(f, t) {
    const g = gain(); env(g, t, .4, .005, .3); osc('sawtooth', f, t, .35, filt('lowpass', 650, 5, g));
    const g2 = gain(); env(g2, t, .35, .005, .3); osc('sine', f, t, .35, g2);
  }
  function synth(k, f, t) {
    const P = SYNTHS[k], g = gain(); env(g, t, P.vol, P.a, P.d);
    const lp = filt('lowpass', P.cut, 1, g);
    if (P.sweep) { lp.frequency.setValueAtTime(P.cut, t); lp.frequency.exponentialRampToValueAtTime(350, t + P.d); }
    osc(P.type, f, t, P.a + P.d, lp);
    if (P.bell) osc('sine', f * 2.76, t, P.a + P.d * .4, lp); // a slightly "off" overtone makes it ring like a bell
  }
  function hit(B, track, row, t) {
    if (track === 'd') DRUM[row](t);
    else if (track === 'b') bass(freq(midiOf(B, 'b', row)), t);
    else synth(B.s[track].p, freq(midiOf(B, track, row)), t);
  }
  function playStep(i, t) {
    const bit = 1 << i, B = beat;
    B.d.forEach((m, r) => m & bit && hit(B, 'd', r, t));
    B.b.forEach((m, r) => m & bit && hit(B, 'b', r, t));
    B.s.forEach((sy, k) => sy.r.forEach((m, r) => m & bit && hit(B, k, r, t)));
  }
  function tick() { // schedule a little ahead so timing stays tight
    while (next < ctx.currentTime + .12) {
      playStep(step, next);
      const s = step, c = cb;
      setTimeout(() => cb === c && c && c(s), Math.max(0, (next - ctx.currentTime) * 1000));
      next += 60 / beat.bpm / 4;
      step = (step + 1) % 16;
    }
  }
  S.play = (b, onStep, token) => {
    init(); S.stop(); ctx.resume();
    beat = b; cb = onStep; S.token = token; step = 0; next = ctx.currentTime + .06;
    tick(); timer = setInterval(tick, 25);
  };
  S.stop = () => {
    clearInterval(timer); timer = null;
    const c = cb; cb = null; S.token = null;
    if (c) c(-1);
  };
  S.preview = (B, track, row) => { init(); ctx.resume(); hit(B, track, row, ctx.currentTime + .01); };
  return S;
})();

// ---------- beat maker ----------
async function beatPage(id) {
  let beat = newBeat(), name = '', from = null;
  if (id) { const r = await api('GET', '/beats/' + id); beat = r.data; name = r.name; from = r.by; }
  const TABS = [['d', 'Drums'], ['b', 'Bass'], [0, 'Synth 1'], [1, 'Synth 2'], [2, 'Synth 3']];
  const rowsOf = t => (t === 'd' ? beat.d : t === 'b' ? beat.b : beat.s[t].r);
  let tab = 'd', cols = [];
  const tabs = h('div', { class: 'tabs' });
  const grid = h('div', { class: 'beatgrid' });
  const opts = h('div', { class: 'row' });
  const drawTabs = () => tabs.replaceChildren(...TABS.map(([t, label]) =>
    h('button', { type: 'button', class: t === tab ? 'on' : '', onclick: () => { tab = t; drawTabs(); drawGrid(); } }, label + (rowsOf(t).some(Boolean) ? ' •' : ''))));
  function drawGrid() {
    const rows = rowsOf(tab);
    cols = Array.from({ length: 16 }, () => []);
    const order = tab === 'd' ? [0, 1, 2, 3] : [7, 6, 5, 4, 3, 2, 1, 0]; // high notes on top
    grid.replaceChildren(...order.map(r => h('div', { class: 'gr' },
      h('span', { class: 'lab' }, tab === 'd' ? DRUMS[r] : noteName(midiOf(beat, tab, r))),
      Array.from({ length: 16 }, (_, i) => {
        const cell = h('button', {
          type: 'button', 'aria-label': `step ${i + 1}`, class: 'cell' + (i % 8 < 4 ? '' : ' q') + (rows[r] >> i & 1 ? ' on' : ''),
          onclick: () => {
            rows[r] ^= 1 << i;
            const on = rows[r] >> i & 1;
            cell.classList.toggle('on', !!on);
            if (on) Sound.preview(beat, tab, r);
            drawTabs();
          },
        });
        cols[i].push(cell);
        return cell;
      }))));
    opts.replaceChildren(...[
      typeof tab === 'number' && h('label', { class: 'inline' }, 'Sound:', select(SYNTHS.map((P, k) => [k, P.name]), beat.s[tab].p, e => { beat.s[tab].p = Number(e.target.value); drawGrid(); })),
      h('button', { type: 'button', class: 'linkish small', onclick: () => { rows.fill(0); drawGrid(); drawTabs(); } }, 'Clear this track')].filter(Boolean));
  }
  const playBtn = h('button', { type: 'button', class: 'go' }, '▶ Play');
  const onStep = s => {
    cols.forEach((c, i) => c.forEach(cell => cell.classList.toggle('now', i === s)));
    playBtn.textContent = s < 0 ? '▶ Play' : '■ Stop';
  };
  playBtn.onclick = () => (Sound.token === beat ? Sound.stop() : Sound.play(beat, onStep, beat));
  const bpm = h('b', {}, beat.bpm);
  const nameIn = h('input', { maxLength: 40, placeholder: 'Name your beat', value: name, 'aria-label': 'Beat name' });
  const saveBtn = h('button', {
    type: 'button', class: 'go',
    onclick: act(async () => {
      saveBtn.disabled = true;
      try { await api('POST', '/beats', { name: nameIn.value, data: beat }); go('/u/' + me.name); } finally { saveBtn.disabled = false; }
    }),
  }, 'Post to my page');
  drawTabs();
  drawGrid();
  return box('Beat Maker',
    from && h('p', { class: 'small' }, `Remixing "${name}" by ${from}. Posting saves your own copy.`),
    h('p', { class: 'hint' }, 'Tap squares to add sounds, then press Play. Switch between Drums, Bass and the 3 Synths. It loops 16 steps. Post it and it plays at the top of your page.'),
    h('div', { class: 'row' }, playBtn,
      h('label', { class: 'inline' }, 'Speed', h('input', { type: 'range', min: 60, max: 180, value: beat.bpm, oninput: e => { beat.bpm = Number(e.target.value); bpm.textContent = beat.bpm; } }), bpm),
      h('label', { class: 'inline' }, 'Key', select(KEYS.map((k, i) => [i, k]), beat.key, e => { beat.key = Number(e.target.value); drawGrid(); })),
      h('label', { class: 'inline' }, 'Mood', select([[0, 'Moody'], [1, 'Happy']], beat.scale, e => { beat.scale = Number(e.target.value); drawGrid(); }))),
    tabs, opts, grid,
    h('div', { class: 'row' }, nameIn, saveBtn));
}

// ---------- friends ----------
async function friendsPage() {
  const f = await api('GET', '/friends');
  me.groups = f.groups;
  me.requests = f.requests.length;
  drawNav();
  const link = inviteLink();
  const person = (u, ...extra) => h('div', { class: 'person' }, h('a', { href: '/u/' + u.name, tabIndex: -1 }, pic(u.pic, 40, u.name)),
    h('a', { href: '/u/' + u.name, class: 'who grow' }, u.name), ...extra);
  const cmd = (label, path, q) => h('button', { onclick: act(async () => { if (q && !(await ask(q))) return; await api('POST', path); render(); }) }, label);
  const newGroup = h('input', { maxLength: 30, placeholder: 'New group name, like "Band" or "Work"', 'aria-label': 'New group name' });
  const find = h('input', { maxLength: 20, placeholder: 'username', 'aria-label': 'Username', autocapitalize: 'off' });
  return h('div', {},
    box('Invite people',
      h('p', {}, "Send this link to friends. When they sign up with it, you're friends straight away."),
      h('div', { class: 'row' }, h('input', { readOnly: true, value: link, onclick: e => e.target.select(), 'aria-label': 'Invite link' }), h('button', { class: 'go', onclick: () => copy(link) }, 'Copy')),
      h('p', { class: 'warnline' }, 'Tell them: this site is fake. Nothing real goes on here.')),
    f.requests.length ? box(`Friend requests (${f.requests.length})`, f.requests.map(u => person(u,
      cmd('Accept', '/add/' + u.name), cmd('Ignore', '/unfriend/' + u.name), cmd('Block', '/block/' + u.name, `Block ${u.name}?`)))) : null,
    box(`My friends (${f.friends.length})`,
      h('p', { class: 'hint' }, 'Tap a group to put someone in it. Then you can filter your feed by that group, or post just to them.'),
      f.friends.length ? f.friends.map(u => person(u,
        cmd('Unfriend', '/unfriend/' + u.name, `Unfriend ${u.name}?`),
        cmd('Block', '/block/' + u.name, `Block ${u.name}? You won't see each other's stuff.`),
        groupChips(u.id, u.gids))) : h('p', { class: 'empty' }, 'No friends yet. Send your invite link!')),
    box('My groups',
      f.groups.map(g => h('div', { class: 'person' }, h('b', { class: 'grow' }, g.name),
        h('button', {
          onclick: act(async () => {
            if (!(await ask(`Delete the group "${g.name}"? Posts you sent only to it will be visible only to you.`))) return;
            await api('DELETE', '/groups/' + g.id); render();
          }),
        }, 'Delete'))),
      h('form', { class: 'row', onsubmit: act(async e => { e.preventDefault(); await api('POST', '/groups', { name: newGroup.value }); render(); }) }, newGroup, h('button', {}, 'Add group'))),
    f.sent.length ? box('Requests I sent', f.sent.map(u => person(u, cmd('Cancel', '/unfriend/' + u.name)))) : null,
    box('Find someone', h('form', { class: 'row', onsubmit: e => { e.preventDefault(); if (find.value.trim()) go('/u/' + find.value.trim()); } }, find, h('button', {}, 'Go to their page'))),
    f.blocked.length ? box('Blocked', f.blocked.map(u => h('div', { class: 'person' }, h('b', { class: 'grow' }, u.name), cmd('Unblock', '/unblock/' + u.name)))) : null);
}

// ---------- start ----------
(async () => {
  try { me = await api('GET', '/me'); } catch { me = null; } // null when logged out
  render();
})();
