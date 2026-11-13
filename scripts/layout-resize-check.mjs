// 画面の大きさと向きの確かめ(docs/stable-board-layout-design.mdの8-1)。
// 対局と棋譜解析の画面を、6つの大きさで「開き直したとき」と「大きさを順に変えたとき」の両方で測り、
// 盤の段の大きさ・配置の名前・盤の目の幅・はみ出し・画面の外のボタン・欄どうしの重なりを並べる。開き直しと違えば知らせる。
// 使い方(先に npm run build と node scripts/serve-static.mjs 8766 を起動しておく):
//   node scripts/layout-resize-check.mjs [--out <写真の置き場所>] [--url http://127.0.0.1:8766/game.html] [--sizes 390x844,...]
// Playwrightはリポジトリの依存に入れない(browser-check.mjsと同じ)。

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const name of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try { return require(name); } catch { /* 次を試す */ }
  }
  throw new Error('Playwrightが見つかりません。リポジトリの外に用意してください。');
}

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => (value.startsWith('--') ? [...pairs, [value.slice(2), list[index + 1]]] : pairs), []));
const URL = args.url ?? 'http://127.0.0.1:8766/game.html';
const OUT = args.out ?? null;
/** UI_Nintendo_Implementation.mdの7-5の6つの大きさと、ブラウザの帯が出ているスマホ縦。 */
const SIZES = (args.sizes ?? '360x640,390x844,390x760,844x390,820x1180,1180x820,1366x768,700x768').split(',').map((size) => size.split('x').map(Number));
if (OUT) mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const browser = await chromium.launch();

async function openMatch(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log(`${width}x${height}`, 'PAGEERROR', error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('layout-check')) return;
    sessionStorage.setItem('layout-check', '1');
    localStorage.clear();
    localStorage.setItem('yacobihime:shogi-match:player-name:v1', JSON.stringify({ name: 'やこび' }));
  });
  await page.goto(URL);
  await page.waitForSelector('.shogi-title__tile');
  if (await page.locator('[data-ladder-notice-ok]').count()) await page.click('[data-ladder-notice-ok]');
  await page.locator('.shogi-title__tile', { hasText: '自由対局' }).click();
  await page.waitForTimeout(700);
  await page.locator('button', { hasText: '対局開始' }).first().click();
  await page.waitForTimeout(2500);
  return page;
}

async function toAnalysis(page) {
  // 投了のボタンは、広い画面では操作の列(「投了」)に、狭い画面ではメニューの中(「投了する」)にある。
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === '投了' && el.getClientRects().length);
    button?.click();
    return Boolean(button);
  });
  if (!clicked) {
    await page.locator('.shogi-game__menu-toggle').click();
    await page.waitForTimeout(250);
    await page.locator('.shogi-game__menu-item--danger').first().click();
  }
  await page.waitForTimeout(250);
  await page.locator('.shogi-game__confirm-danger:visible').first().click();
  await page.waitForTimeout(1200);
  const analysis = page.locator('.shogi-game__analysis-button:visible').first();
  try {
    await analysis.click({ timeout: 8000 });
  } catch (error) {
    if (OUT) await page.screenshot({ path: `${OUT}/failed-analysis.png` });
    throw error;
  }
  await page.waitForTimeout(3500);
}

/** いまの画面を測る。 */
async function measure(page) {
  return page.evaluate(() => {
    const rect = (el) => el?.getBoundingClientRect();
    const visible = (el) => { const r = rect(el); const style = el && getComputedStyle(el); return r && r.width > 1 && r.height > 1 && style.visibility !== 'hidden' && style.display !== 'none'; };
    const shell = document.querySelector('.shogi-game__board-shell');
    const root = document.querySelector('.shogi-game');
    // 盤の目(9×9)の幅：盤の木の絵(.board-background)の幅。
    const boardGrid = shell?.querySelector('.board-background')?.getBoundingClientRect();
    const outside = [...document.querySelectorAll('button')].filter((button) => {
      if (!visible(button)) return false;
      const r = rect(button);
      return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1;
    }).map((button) => (button.textContent.trim() || button.getAttribute('aria-label') || button.className.split(' ')[0]).slice(0, 14));
    // 盤の段に重なる欄(盤の段の外に置くはずのもの)。
    const shellRect = rect(shell);
    const blocks = ['.shogi-game__coach', '.shogi-game__opening-guide', '.shogi-game__analysis', '.shogi-game__assist-actions', '.shogi-game__header', '.shogi-game__summary']
      .flatMap((selector) => [...document.querySelectorAll(selector)]).filter(visible);
    const overlaps = [];
    for (let i = 0; i < blocks.length; i += 1) {
      for (let j = i + 1; j < blocks.length; j += 1) {
        const a = rect(blocks[i]); const b = rect(blocks[j]);
        if (blocks[i].contains(blocks[j]) || blocks[j].contains(blocks[i])) continue;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 4 && h > 4) overlaps.push(`${blocks[i].className.split(' ')[0]}×${blocks[j].className.split(' ')[0]}`);
      }
      const a = rect(blocks[i]);
      if (shellRect) {
        const w = Math.min(a.right, shellRect.right) - Math.max(a.left, shellRect.left);
        const h = Math.min(a.bottom, shellRect.bottom) - Math.max(a.top, shellRect.top);
        if (w > 4 && h > 4 && !blocks[i].contains(shell)) overlaps.push(`board×${blocks[i].className.split(' ')[0]}`);
      }
    }
    return {
      layout: [...(root?.classList ?? [])].filter((name) => /--(wide|side|stack|analysis|short|narrow)$/.test(name)).map((name) => name.split('--')[1]).join(' '),
      shell: shellRect ? `${Math.round(shellRect.width)}x${Math.round(shellRect.height)}` : '-',
      grid: boardGrid ? Math.round(boardGrid.width) : 0,
      ratio: boardGrid ? Math.round((boardGrid.width / innerWidth) * 100) : 0,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      outside,
      overlaps: [...new Set(overlaps)],
    };
  });
}

const rows = [];
let problems = 0;
function report(tag, fresh, resized) {
  const differs = resized && (fresh.layout !== resized.layout || Math.abs(fresh.grid - resized.grid) > 2);
  const issues = [
    ...(fresh.overflow ? ['横にはみ出し'] : []),
    ...(fresh.outside.length ? [`画面の外: ${fresh.outside.join('・')}`] : []),
    ...(fresh.overlaps.length ? [`重なり: ${fresh.overlaps.join('・')}`] : []),
    ...(differs ? [`順に変えたとき ${resized.layout} 盤${resized.grid}px（開き直し ${fresh.grid}px）`] : []),
  ];
  problems += issues.length;
  rows.push(`| ${tag} | ${fresh.layout} | ${fresh.shell} | ${fresh.grid}px（${fresh.ratio}%） | ${issues.join('、') || 'なし'} |`);
}

for (const scene of ['play', 'analysis']) {
  // 開き直し：大きさごとに開く。
  const fresh = new Map();
  for (const [width, height] of SIZES) {
    const page = await openMatch(width, height);
    if (scene === 'analysis') await toAnalysis(page);
    fresh.set(`${width}x${height}`, await measure(page));
    if (OUT) await page.screenshot({ path: `${OUT}/${scene}-${width}x${height}.png` });
    await page.context().close();
  }
  // 順に変える：1つの画面のまま大きさを変える。
  const first = SIZES[0];
  const page = await openMatch(first[0], first[1]);
  if (scene === 'analysis') await toAnalysis(page);
  const resized = new Map();
  for (const [width, height] of [...SIZES, ...[...SIZES].reverse()]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(500);
    resized.set(`${width}x${height}`, await measure(page));
  }
  await page.context().close();
  for (const [width, height] of SIZES) {
    const key = `${width}x${height}`;
    report(`${scene === 'play' ? '対局' : '解析'} ${key}`, fresh.get(key), resized.get(key));
  }
}
await browser.close();

console.log('| 画面 | 配置 | 盤の段 | 盤の目の幅 | 見つけたこと |');
console.log('| --- | --- | --- | --- | --- |');
for (const row of rows) console.log(row);
console.log(problems ? `\n見つけたこと: ${problems}件` : '\n見つけたこと: なし');
process.exitCode = problems ? 1 : 0;
