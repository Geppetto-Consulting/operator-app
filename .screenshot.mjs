import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const targets = [
  ['home', 'http://localhost:3000/'],
  ['signin', 'http://localhost:3000/sign-in'],
  ['signup', 'http://localhost:3000/sign-up'],
  ['createworkspace', 'http://localhost:3000/create-workspace'],
  ['admin', 'http://localhost:3000/god-mode/'],
  ['spaces', 'http://localhost:3000/spaces/'],
];
for (const [name, url] of targets) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/operator-app-screenshots/${name}.png`, fullPage: true });
    const title = await page.title();
    console.log(`✓ ${name}: ${title}`);
  } catch (e) {
    console.log(`✗ ${name}: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
