const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
(async () => {
  const files = process.argv.slice(3), out = process.argv[2];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 100 } });
  await p.setContent(`<body style="margin:0;background:#222;display:flex;gap:6px">${files.map(f => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:195px">`).join('')}</body>`);
  await p.waitForTimeout(300); await p.screenshot({ path: out, fullPage: true }); await b.close();
})();
