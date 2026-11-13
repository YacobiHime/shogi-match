// Googleアカウントでの同期の通しの確かめ(docs/cloud-sync-design.mdの2章の検証方法)。
// FirestoreとAuthenticationのエミュレーターで、2台の端末(別々のブラウザの保存)をまねて次を見る。
//   1. 端末Aでログイン → 記録がクラウドに保存される(見出しと分けた文書)。
//   2. 端末B(記録なし)でログイン → 聞かずにクラウドの記録を受け取り、読み直して「読み込んだ」の一言。
//   3. 端末Aで遊ぶ(記録を変える)→ 画面が隠れたときに送る。端末Bでも記録を変えてから開き直す → 「どちらの記録を使う？」が出て、
//      初期フォーカスは「あとで決める」。「クラウドの記録」を選ぶと、Aの記録で置き換わる。
//   4. ルール：ほかの人の印では読めない。
//   5. 端末Aで「クラウドの記録を消す」→ 消えてログアウト。端末Bを開き直すと、ログアウトして一言。
//   各段で、390×844・820×1180・1366×768・844×390のどこでも横にはみ出さないかを見て、写真を撮る。
// 使い方(先に npm run build と、エミュレーターと静的サーバーを起動しておく):
//   npx firebase-tools emulators:start --only auth,firestore --project shogi-64125   (ポートは9099と8080)
//   node scripts/serve-static.mjs 8796
//   node scripts/cloud-sync-check.mjs [--url http://127.0.0.1:8796] [--out <写真の置き場所>]
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
const BASE = args.url ?? 'http://127.0.0.1:8796';
const OUT = args.out ?? null;
const FIRESTORE = 'http://127.0.0.1:8080/v1/projects/shogi-64125/databases/(default)/documents';
const AUTH = 'http://127.0.0.1:9099';
const Y = 'yacobihime:shogi-match:';
const SIZES = [[390, 844], [820, 1180], [1366, 768], [844, 390]];
if (OUT) mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK ' : 'NG '} ${label}${detail ? `：${detail}` : ''}`);
  if (!ok) failures += 1;
}

// エミュレーターをまっさらにする。
await fetch(`${FIRESTORE.replace('/v1/', '/emulator/v1/')}`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/shogi-64125/accounts`, { method: 'DELETE' });

async function device(name, [width, height], seed) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log(name, 'PAGEERROR', error.message));
  await page.goto(`${BASE}/game.html`);
  await page.evaluate((entries) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, seed);
  return { name, context, page };
}

/** 段級位のお知らせ(古い形のレーティングを読んだとき)を閉じる。 */
async function dismissNotices(page) {
  await page.waitForTimeout(400);
  if (await page.locator('[data-ladder-notice-ok]').count()) await page.click('[data-ladder-notice-ok]');
}

async function openHome(page) {
  await page.goto(`${BASE}/game.html`);
  await page.waitForSelector('.shogi-title__tile', { timeout: 20000 });
  await dismissNotices(page);
}

async function signIn(page, email) {
  await page.goto(`${BASE}/auth.html?emulator=1&return=${encodeURIComponent('/game.html')}`);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('[data-login-google]')]);
  await popup.waitForLoadState();
  await popup.waitForTimeout(800);
  const existing = popup.locator('li, .mdc-list-item', { hasText: email });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await popup.getByText('Add new account').click();
    await popup.fill('#email-input', email);
    await popup.fill('#display-name-input', email.split('@')[0]);
    await popup.click('#sign-in');
  }
  await page.waitForURL(/game\.html/, { timeout: 20000 });
  await page.waitForSelector('.shogi-title__tile', { timeout: 20000 });
  await dismissNotices(page);
}

async function stored(page, key) {
  return page.evaluate((name) => localStorage.getItem(name), key);
}

async function syncState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), `${Y}cloud-sync:v1`);
}

async function head(uid) {
  const response = await fetch(`${FIRESTORE}/cloudSaves/${uid}`, { headers: { Authorization: 'Bearer owner' } });
  return response.ok ? response.json() : null;
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
}

async function shoot(page, label) {
  if (OUT) await page.screenshot({ path: `${OUT}/${label}.png` });
}

async function waitFor(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

const ratingA = JSON.stringify({ rating: 1650, games: 12, wins: 7, losses: 5, draws: 0 });
const a = await device('A', SIZES[0], {
  [`${Y}player-name:v1`]: JSON.stringify({ name: 'やこび' }),
  [`${Y}player-rating`]: ratingA,
});
const b = await device('B', SIZES[1], {});

// 1. 端末Aでログインし、記録を保存する。
await signIn(a.page, 'player@example.com');
const stateA = await syncState(a.page);
check('Aのログインの印', Boolean(stateA?.uid && stateA?.refreshToken && stateA?.emulator));
check('Aがクラウドに保存', await waitFor(async () => Boolean((await syncState(a.page))?.base)), JSON.stringify((await syncState(a.page))?.base ?? null));
const head1 = await head(stateA.uid);
check('見出しがある(rev 1)', head1?.fields?.rev?.integerValue === '1');
check('ホームに状態', /☁/.test(await a.page.locator('[data-sync-status-text]').textContent() ?? ''));
check('ホームにログインの一言', await a.page.locator('[data-sync-toast]').count() > 0, await a.page.locator('[data-sync-toast]').textContent().catch(() => ''));
await shoot(a.page, 'a-home-390');
check('A 390×844 はみ出しなし', !(await overflow(a.page)));

// シートの同期の組を4つの大きさで見る。
await dismissNotices(a.page);
for (const [width, height] of SIZES) {
  await a.page.setViewportSize({ width, height });
  await a.page.click('[data-save-transfer-open]');
  await a.page.waitForSelector('[data-sync-group]');
  check(`シートの同期の組 ${width}×${height}`, (await a.page.locator('[data-sync-account]').textContent())?.includes('player@example.com') && !(await overflow(a.page)));
  await shoot(a.page, `a-sheet-${width}x${height}`);
  await a.page.click('[data-transfer-close]');
}
await a.page.setViewportSize({ width: SIZES[0][0], height: SIZES[0][1] });

// 2. 端末B(記録なし)でログインすると、聞かずに受け取る。
await signIn(b.page, 'player@example.com');
check('Bがクラウドの記録を受け取る', await waitFor(async () => (await stored(b.page, `${Y}player-rating`)) !== null, 20000));
await b.page.waitForSelector('.shogi-title__tile', { timeout: 20000 });
await dismissNotices(b.page);
check('Bに読み込んだ一言', await waitFor(async () => /読み込んだ/.test(await b.page.locator('[data-sync-toast]').textContent().catch(() => '') ?? '')));
check('Bの名前が移る', (await stored(b.page, `${Y}player-name:v1`))?.includes('やこび'));
await shoot(b.page, 'b-home-820');

// 3. 両方で変えてから開き直すと、どちらを使うか聞く。
await a.page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ marker: 'A-played' })), `${Y}research:v1`);
await a.page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
check('Aが隠れたときに送る', await waitFor(async () => (await head(stateA.uid))?.fields?.rev?.integerValue === '2', 20000));
await b.page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ marker: 'B-played' })), `${Y}research:v1`);
await openHome(b.page);
check('Bに「どちらの記録を使う？」', await waitFor(async () => (await b.page.locator('[data-step="cloud-choice"]').count()) > 0, 20000));
check('初期フォーカスは「あとで決める」', await b.page.evaluate(() => document.activeElement?.hasAttribute('data-sync-later')));
for (const [width, height] of SIZES) {
  await b.page.setViewportSize({ width, height });
  await b.page.waitForTimeout(200);
  check(`選ぶ段 ${width}×${height} はみ出しなし`, !(await overflow(b.page)));
  await shoot(b.page, `b-choice-${width}x${height}`);
}
await b.page.click('[data-sync-use-cloud]');
await b.page.waitForSelector('.shogi-title__tile', { timeout: 20000 });
check('Bがクラウド(A)の記録になる', await waitFor(async () => (await stored(b.page, `${Y}research:v1`))?.includes('A-played'), 20000));

// 4. ルール：ほかの人の印では読めない。
const other = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'other@example.com', password: 'secret12', returnSecureToken: true }),
})).json();
const peek = await fetch(`${FIRESTORE}/cloudSaves/${stateA.uid}`, { headers: { Authorization: `Bearer ${other.idToken}` } });
check('ほかの人は読めない', peek.status === 403, String(peek.status));
const write = await fetch(`${FIRESTORE}/cloudSaves/${other.localId}`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${other.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { v: { integerValue: '1' }, junk: { stringValue: 'x' } } }),
});
check('決まっていない項目は書けない', write.status === 403, String(write.status));

// 5. Aでクラウドの記録を消すと、Bも次に開いたときにログアウトする。
await openHome(a.page);
await a.page.click('[data-save-transfer-open]');
await a.page.click('[data-sync-delete]');
check('消す段の初期フォーカスは「戻る」', await a.page.evaluate(() => document.activeElement?.textContent?.trim() === '戻る'));
await shoot(a.page, 'a-delete-390');
await a.page.click('[data-sync-delete-go]');
check('Aはログアウト', await waitFor(async () => (await syncState(a.page)) === null));
check('クラウドの記録が消える', (await head(stateA.uid)) === null);
check('Aの記録は残る', (await stored(a.page, `${Y}research:v1`))?.includes('A-played'));
await openHome(b.page);
check('Bもログアウト', await waitFor(async () => (await syncState(b.page)) === null, 20000));
check('Bに一言', await waitFor(async () => /消された/.test(await b.page.locator('[data-sync-toast]').textContent().catch(() => '') ?? '')));

await browser.close();
console.log(failures ? `\nNG: ${failures}件` : '\nすべてOK');
process.exitCode = failures ? 1 : 0;
