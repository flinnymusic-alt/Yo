// Does the page load without an error?
const { open } = require('./lib');
(async () => { const { browser, errs } = await open(); console.log(errs.length ? errs : 'loads clean'); await browser.close(); process.exit(errs.length ? 1 : 0); })();
