const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = __dirname;
  const scale = Number(process.argv[2] || 2);
  const out = process.argv[3] || path.join(dir, 'system-diagram.png');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: scale });
  await page.goto('file://' + path.join(dir, 'system-diagram.svg'));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 900, height: 700 } });
  await browser.close();
})();
