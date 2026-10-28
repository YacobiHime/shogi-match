// 画面の確認: game.htmlを3つの大きさ(スマホ縦・タブレット縦・デスクトップ)で開き、操作して、写真と横はみ出しを出す。
// 使い方(先に npm run build と node scripts/serve-static.mjs を起動しておく):
//   node scripts/browser-check.mjs --out <写真の置き場所> [--tile 大会] [--click '[data-tournament="ryuo"]'] [--wait 800]
//     [--sizes 390x844,820x1180,1366x768] [--seed seed.json] [--url http://127.0.0.1:8766/game.html]
// --clickはくり返せる(書いた順に押す)。--seedは { "保存の名前の後ろ(ryuo-careerなど)": 値 } のJSON。
// Playwrightはリポジトリの依存に入れない。入っている環境(require('playwright')か/opt/node-tools)のものを使う。

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const name of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try { return require(name); } catch { /* 次を試す */ }
  }
  throw new Error('Playwrightが見つかりません。リポジトリの外に用意してください。');
}

function parseArgs(argv) {
  const options = { sizes: '390x844,820x1180,1366x768', out: 'browser-check', url: 'http://127.0.0.1:8766/game.html', wait: 800, clicks: [], tile: null, seed: null };
  for (let i = 0; i < argv.length; i += 1) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === '--click') options.clicks.push(value);
    else if (key === '--wait') options.wait = Number(value);
    else if (key.startsWith('--')) options[key.slice(2)] = value;
    else continue;
    i += 1;
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const seed = options.seed ? JSON.parse(readFileSync(options.seed, 'utf8')) : {};
mkdirSync(options.out, { recursive: true });
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
for (const [width, height] of options.sizes.split(',').map((size) => size.split('x').map(Number))) {
  const tag = `${width}x${height}`;
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (error) => console.log(tag, 'PAGEERROR', error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.log(tag, 'CONSOLE', message.text().slice(0, 200)); });
  // はじめての案内と名前の入力を飛ばす。リロードで消さないよう、最初の1回だけ入れる。
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('browser-check-seeded')) return;
    sessionStorage.setItem('browser-check-seeded', '1');
    localStorage.clear();
    const prefix = 'yacobihime:shogi-match:';
    localStorage.setItem(`${prefix}welcome:v1`, JSON.stringify({ choice: 'player', at: 1 }));
    localStorage.setItem(`${prefix}player-name:v1`, JSON.stringify({ name: 'やこび' }));
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
  }, seed);
  await page.goto(options.url);
  await page.waitForSelector('.shogi-title__tile');
  // 段級位の作り直しのお知らせ(対局したことのある保存で1回出る)を閉じる。
  if (await page.locator('[data-ladder-notice-ok]').count()) await page.click('[data-ladder-notice-ok]');
  if (options.tile) {
    await page.locator('.shogi-title__tile', { hasText: options.tile }).click();
    await page.waitForTimeout(options.wait);
  }
  for (const selector of options.clicks) {
    await page.locator(selector).first().click();
    await page.waitForTimeout(options.wait);
  }
  const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  console.log(tag, size.scrollWidth > size.clientWidth ? `横にはみ出し ${size.scrollWidth}>${size.clientWidth}` : 'はみ出しなし');
  await page.screenshot({ path: `${options.out}/${tag}.png` });
  await page.close();
}
await browser.close();
