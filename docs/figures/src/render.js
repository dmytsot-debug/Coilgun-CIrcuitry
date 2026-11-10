const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = __dirname;
  const scale = Number(process.argv[2] || 2);
  const out = process.argv[3] || path.join(dir, 'system-diagram.png');
  const svg = process.argv[4] || 'system-diagram.svg';
  const W = Number(process.argv[5] || 900), H = Number(process.argv[6] || 700);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  await page.goto('file://' + path.join(dir, svg));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();
})();
