// ホームがスマホのブラウザで1画面に収まるかを測る(docs/home-roadmap-design.mdの5章)。
// 使い方(先に npm run build と node scripts/serve-static.mjs 8766 を起動しておく):
//   node scripts/home-fit-check.mjs [--out <写真の置き場所>] [--url http://127.0.0.1:8766/game.html] [--seed seed.json]
// 見える大きさ(住所の帯とツールバーを除く)ごとに、ホームの欄(.shogi-home)の中身の下の端が見える高さに入るかを見る。
// 「長い文」の段では、つぎはこれの説明・記録の帯の札・2つ目の入口・同期の印と一言を、いちばん長くなる形に書き換えて測る。
// ホームに行を足したら、これで溢れないことを確かめる(新しい1行にせず、すでにある行の中に入れる)。
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

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const out = option('out', null);
const url = option('url', 'http://127.0.0.1:8766/game.html');
const seedFile = option('seed', null);
const seed = seedFile ? JSON.parse(readFileSync(seedFile, 'utf8')) : {};
if (out) mkdirSync(out, { recursive: true });

/** 縦向きで1画面に収める大きさ(5-1の表)。横向き・タブレット・PCは今の配置で収まるかを見る。 */
const SIZES = [
  ['iphone-se-safari', 375, 553],
  ['small-android', 360, 640],
  ['iphone14-safari', 390, 664],
  ['android-chrome', 412, 780],
  ['iphone14-full', 390, 844],
  ['narrow', 320, 568],
  ['landscape', 844, 340],
  ['tablet', 820, 1180],
  ['desktop', 1366, 768],
];

/** いちばん長くなる形に書き換える(高さは文の長さで変わるところだけ)。 */
function stress() {
  const set = (selector, text) => { const el = document.querySelector(selector); if (el) el.textContent = text; };
  // 今ある文のうち長いもの(竜王戦の対策。ryuo-next.mjsのcounterReason)。
  set('.shogi-title__next-label', '天鷺羽音対策');
  set('.shogi-title__next-desc', '得意の四間飛車（42%）を、本番と同じ後手で試そう。記録には残らないよ');
  set('.shogi-title__bubble', 'おかえり！ 続きから指そう');
  const main = document.querySelector('.shogi-title__record-main');
  if (main && !main.querySelector('[data-stress-badge]')) {
    main.insertAdjacentHTML('beforeend', '<span class="shogi-title__record-badge" data-stress-badge>竜王戦5組</span><span class="shogi-title__record-badge shogi-title__record-badge--streak" data-stress-badge>続けて12日</span>');
  }
  set('.shogi-title__name-text', 'やこびひめ');
  const wrap = document.querySelector('.shogi-title__next-wrap');
  let sub = document.querySelector('.shogi-title__next-sub');
  if (wrap && !sub) {
    wrap.insertAdjacentHTML('beforeend', '<button type="button" class="shogi-title__next-sub"></button>');
    sub = wrap.querySelector('.shogi-title__next-sub');
  }
  wrap?.classList.add('shogi-title__next-wrap--sub');
  if (sub) sub.textContent = '続きを指す（決勝T1回戦）';
  const sync = document.querySelector('.shogi-title__sync');
  if (sync && !sync.querySelector('.shogi-title__sync-mark')) sync.insertAdjacentHTML('beforeend', '<span class="shogi-title__sync-mark shogi-title__sync-mark--choose">!</span>');
  const row = document.querySelector('.shogi-title__record-row');
  if (row && !row.querySelector('.shogi-title__sync-toast')) row.insertAdjacentHTML('beforeend', '<p class="shogi-title__sync-toast">ほかの端末の記録と違います。どちらを使うか選んでね</p>');
}

function measure() {
  const home = document.querySelector('.shogi-home');
  const rect = home.getBoundingClientRect();
  const children = [...home.children].filter((el) => getComputedStyle(el).display !== 'none' && getComputedStyle(el).position !== 'absolute');
  const bottom = Math.max(...children.map((el) => el.getBoundingClientRect().bottom));
  const top = Math.min(...children.map((el) => el.getBoundingClientRect().top));
  const box = (el) => (el ? el.getBoundingClientRect() : null);
  const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const sub = box(document.querySelector('.shogi-title__next-sub'));
  const go = box(document.querySelector('.shogi-title__next-go'));
  const small = [...home.querySelectorAll('button')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height < 43.5;
  }).map((el) => `${el.className.split(' ')[0]}:${Math.round(el.getBoundingClientRect().height)}`);
  return {
    scroll: home.scrollHeight - home.clientHeight,
    contentTop: Math.round(top - rect.top),
    contentBottom: Math.round(bottom - rect.top),
    viewHeight: Math.round(rect.height),
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    subOverGo: Boolean(overlap(sub, go)),
    small,
  };
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let failed = 0;
for (const mode of ['real', 'stress']) {
  for (const [name, width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 900 });
    await page.addInitScript((seed) => {
      if (sessionStorage.getItem('home-fit-seeded')) return;
      sessionStorage.setItem('home-fit-seeded', '1');
      localStorage.clear();
      const prefix = 'yacobihime:shogi-match:';
      localStorage.setItem(`${prefix}welcome:v1`, JSON.stringify({ choice: 'player', at: 1 }));
      localStorage.setItem(`${prefix}player-name:v1`, JSON.stringify({ name: 'やこび' }));
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
    }, seed);
    await page.goto(url);
    await page.waitForSelector('.shogi-title__tile');
    if (await page.locator('[data-ladder-notice-ok]').count()) await page.click('[data-ladder-notice-ok]');
    await page.waitForTimeout(400);
    if (mode === 'stress') await page.evaluate(stress);
    await page.waitForTimeout(100);
    const m = await page.evaluate(measure);
    const portrait = height > width && height >= 540 && width >= 320;
    const ok = (!portrait || m.scroll <= 0) && m.pageOverflowX <= 0 && !m.subOverGo && m.small.length === 0;
    if (!ok) failed += 1;
    console.log(`${ok ? 'OK ' : 'NG '} ${mode.padEnd(6)} ${name.padEnd(17)} ${width}x${height} 中身 ${m.contentTop}〜${m.contentBottom}/${m.viewHeight}px スクロール ${Math.max(0, m.scroll)}px${m.pageOverflowX > 0 ? ` 横はみ出し${m.pageOverflowX}px` : ''}${m.subOverGo ? ' 2つ目の入口が「はじめる」に重なる' : ''}${m.small.length ? ` 44px未満: ${m.small.join(' ')}` : ''}`);
    if (out) await page.screenshot({ path: `${out}/${mode}-${name}.png` });
    await page.close();
  }
}
await browser.close();
if (failed) {
  console.log(`${failed}件が収まらない`);
  process.exitCode = 1;
}
