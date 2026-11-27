// Builds demo/demo.html: the real front end plus the pretend back end in fake-api.js,
// in one file that runs anywhere without a server. Run: npm run demo
import fs from 'node:fs';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
let app = read('../public/app.js');
function swap(from, to) {
  if (!app.includes(from)) throw new Error(`public/app.js changed, so demo/build.mjs needs updating. Can't find:\n${from}`);
  app = app.replace(from, to);
}
// The preview has no server and runs inside a frame, so pages are tracked in memory instead of the address bar.
swap('const SITE_URL = location.origin;', "const SITE_URL = 'https://massivegroupchat.example';");
swap('const drawingUrl = id => `/d/${id}.png`;', 'const drawingUrl = id => demoDrawing(id);');
swap('const here = () => location.pathname + location.hash;', "let demoPath = '/';\nconst here = () => demoPath;");
swap("const setHere = (path, replace) => history[replace ? 'replaceState' : 'pushState'](null, '', path);",
  "const setHere = (path, replace) => { demoPath = path; try { history[replace ? 'replaceState' : 'pushState']({ path }, ''); } catch { /* frame may not allow it */ } };");
swap("addEventListener('popstate', () => render());", "addEventListener('popstate', e => { demoPath = (e.state && e.state.path) || '/'; render(); });");

const html = read('../public/index.html');
const banner = `<div id="demo"><div class="wrap">
  <span><b>Preview.</b> You're logged in as a pretend member, <b>new_kid</b>. Everyone here is made up and nothing leaves your browser.</span>
  <button type="button" id="demo-reset">Start over</button>
</div></div>
`;
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).trim().replace('<main id="app"', banner + '<main id="app"');
const css = read('../public/style.css') + `
#demo { background: #222; color: #fff; font-size: 12px; padding: 6px 0; }
#demo .wrap { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: center; text-align: center; }
#demo button { font-size: 12px; padding: 2px 8px; }
`;
const reset = `document.getElementById('demo-reset').onclick = act(async () => {
  if (!(await ask('Start the preview over? Your pretend posts, drawings and beats are wiped.'))) return;
  demoReset();
  await refreshMe();
  go('/');
});`;
const scripts = [read('fake-api.js'), app, reset];
if (scripts.some(s => /<\/script/i.test(s))) throw new Error('A script contains "</script", which would break the page.');

const out = `<title>massive group chat</title>
<meta name="description" content="A playable preview of massive group chat with pretend friends. Nothing here is real.">
<style>
${css}</style>
${body}
${scripts.map(s => `<script>\n${s}\n</script>`).join('\n')}
`;
fs.writeFileSync(new URL('demo.html', import.meta.url), out);
console.log(`demo/demo.html written (${Math.round(out.length / 1024)} KB)`);
