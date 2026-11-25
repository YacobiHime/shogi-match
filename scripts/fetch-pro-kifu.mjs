// プロの棋譜を手元に集める(docs/disciple-mode-design.mdの40章)。将棋DB2(https://shogidb2.com/)の棋戦の一覧と、1局のページの「CSA形式」から読む。
// 集めた棋譜は手元(.kifu-cache/。.gitignoreに入れてある)にだけ置き、リポジトリにもアプリにも入れない。アプリに入れるのは、棋譜から数えた小さな数字だけ。
// 私的利用(自分と友人が遊ぶゲームの調整)の範囲で使う(2026-11-25のユーザーの判断)。無料で運営されているサイトなので、1回ずつ間を空けて少しずつ読む。
//
// 使い方:
//   node scripts/fetch-pro-kifu.mjs list  [--tournaments 名人戦,順位戦,...] [--max-pages 80]   棋戦の一覧のページを読み、.kifu-cache/index.jsonに1局ずつの見出しを足す
//   node scripts/fetch-pro-kifu.mjs fetch [--per-era 300] [--shoreikai 400] [--gap 3000]       時代ごとに決めた数だけ選び、1局ずつCSAを.kifu-cache/games/<id>.csaに保存する(途中から続けられる)
//   node scripts/fetch-pro-kifu.mjs stats                                                  集めた数を時代ごとに出す
// Playwrightはリポジトリの依存に入れない(browser-check.mjsと同じ探し方)。

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const SITE = 'https://shogidb2.com';
const CACHE = '.kifu-cache';
const INDEX = join(CACHE, 'index.json');
const GAMES = join(CACHE, 'games');
const USER_AGENT = 'Mozilla/5.0 (compatible; personal-shogi-study/1.0)';

/** 読む棋戦(平手の公式戦が多いもの)。江戸時代の古典棋譜と奨励会も入れる。 */
export const DEFAULT_TOURNAMENTS = Object.freeze([
  '江戸時代の古典棋譜', '名人戦', '順位戦', '九段戦', '十段戦', '竜王戦', '王将戦', '王位戦', '棋聖戦', '王座戦', '棋王戦', '叡王戦', 'NHK杯', '奨励会',
]);

/** 時代の区切り(西暦の年。その年までを含む)。 */
export const ERAS = Object.freeze([
  { id: 'edo', label: '江戸', until: 1867 },
  { id: 'early', label: '明治〜昭和前期', until: 1960 },
  { id: 'showa', label: '昭和後期', until: 1988 },
  { id: 'heisei', label: '平成', until: 2018 },
  { id: 'reiwa', label: '令和', until: 9999 },
]);

/** 年から時代。 */
export function eraOf(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  return ERAS.find((era) => y <= era.until)?.id ?? null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const options = { command: argv[0] ?? 'stats', tournaments: DEFAULT_TOURNAMENTS.join(','), 'max-pages': '80', 'per-era': '300', shoreikai: '400', gap: '3000' };
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      options[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

function loadIndex() {
  return existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : { games: {} };
}
function saveIndex(index) {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(INDEX, JSON.stringify(index));
}

const decode = (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/**
 * 棋戦の一覧の1ページから、1局ずつの見出しを読む。
 * @param {string} html
 * @param {string} tournament
 */
export function parseListing(html, tournament) {
  const out = [];
  const re = /<a href="\/games\/([0-9a-f]+)">([\s\S]*?)<\/a>/g;
  let match;
  while ((match = re.exec(html))) {
    const body = match[2];
    const ps = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
    const head = ps[0] ?? '';
    const date = head.match(/(\d{4})-(\d{2})-(\d{2})/);
    out.push({
      id: match[1],
      tournament,
      date: date ? `${date[1]}-${date[2]}-${date[3]}` : '',
      detail: head.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s*/, ''),
      black: (ps.find((p) => p.startsWith('Black ')) ?? '').slice(6),
      white: (ps.find((p) => p.startsWith('White ')) ?? '').slice(6),
      strategy: (ps.find((p) => p.startsWith('Strategy:')) ?? '').slice(9).trim(),
      handicap: (ps.find((p) => p.startsWith('Handicap:')) ?? '').slice(9).trim(),
    });
  }
  const pages = [...html.matchAll(/page=(\d+)/g)].map((m) => Number(m[1]));
  return { games: out, lastPage: pages.length ? Math.max(...pages) : 1 };
}

async function listCommand(options) {
  const index = loadIndex();
  const gap = Math.max(1500, Number(options.gap) / 2);
  for (const tournament of options.tournaments.split(',').map((s) => s.trim()).filter(Boolean)) {
    let last = 1;
    for (let page = 1; page <= Math.min(last, Number(options['max-pages'])); page += 1) {
      const url = `${SITE}/tournament/${encodeURIComponent(tournament)}?q=&page=${page}`;
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
      if (!response.ok) {
        console.log(`${tournament} ${page}: ${response.status}`);
        break;
      }
      const { games, lastPage } = parseListing(await response.text(), tournament);
      last = Math.max(last, lastPage);
      let added = 0;
      for (const game of games) {
        if (!index.games[game.id]) added += 1;
        index.games[game.id] = { ...index.games[game.id], ...game };
      }
      console.log(`${tournament} ${page}/${last}: ${games.length}局(新しく${added})`);
      saveIndex(index);
      if (!games.length) break;
      await sleep(gap);
    }
  }
}

/** 時代ごとに、平手の局を決めた数だけ選ぶ(年と棋戦が偏らないよう、年ごとに順に1局ずつ取る)。 */
export function chooseSample(games, { perEra = 300, shoreikai = 400 } = {}) {
  const hirate = games.filter((g) => !g.handicap || g.handicap === '平手');
  const buckets = new Map();
  for (const game of hirate) {
    const key = game.tournament === '奨励会' ? 'shoreikai' : eraOf(game.date.slice(0, 4));
    if (!key) continue;
    const year = game.date.slice(0, 4);
    if (!buckets.has(key)) buckets.set(key, new Map());
    const years = buckets.get(key);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(game);
  }
  const chosen = [];
  for (const [key, years] of buckets) {
    const limit = key === 'shoreikai' ? shoreikai : perEra;
    const lists = [...years.values()].map((list) => [...list].sort((a, b) => a.id.localeCompare(b.id)));
    const picked = [];
    for (let round = 0; picked.length < limit; round += 1) {
      let any = false;
      for (const list of lists) {
        if (list[round] && picked.length < limit) {
          picked.push(list[round]);
          any = true;
        }
      }
      if (!any) break;
    }
    chosen.push(...picked.map((g) => ({ ...g, group: key })));
  }
  return chosen;
}

function loadPlaywright() {
  for (const name of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try { return require(name); } catch { /* 次を試す */ }
  }
  throw new Error('Playwrightが見つかりません。リポジトリの外に用意してください。');
}

async function fetchCommand(options) {
  const index = loadIndex();
  const sample = chooseSample(Object.values(index.games), { perEra: Number(options['per-era']), shoreikai: Number(options.shoreikai) });
  mkdirSync(GAMES, { recursive: true });
  const todo = sample.filter((g) => !existsSync(join(GAMES, `${g.id}.csa`)) && !(index.games[g.id]?.failed && options.retry !== 'yes'));
  console.log(`選んだ${sample.length}局のうち、これから読むのは${todo.length}局`);
  if (!todo.length) return;
  const { chromium } = loadPlaywright();
  let browser = null;
  let context = null;
  const open = async () => {
    if (browser) await browser.close().catch(() => {});
    browser = await chromium.launch();
    context = await browser.newContext({ userAgent: USER_AGENT });
    // 広告と計測は読まない(相手のサーバーと自分の時間を使わない)。
    await context.route('**/*', (route) => (/googlesyndication|googletagmanager|google-analytics|amazon-adsystem|doubleclick|fonts\.g|apis\.google|adservice/.test(route.request().url()) ? route.abort() : route.continue()));
  };
  await open();
  let done = 0;
  for (const game of todo) {
    const started = Date.now();
    // 1局ごとにページを開き直す(前の局の文字が残らないように)。ブラウザが落ちていたら立ち上げ直して、1回だけ読み直す。
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let page = null;
      try {
        page = await context.newPage();
        await page.goto(`${SITE}/games/${game.id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // LiveViewがつながってから(.phx-connected)「CSA形式」を押す。つながる前に押すと、何も返ってこない。
        await page.waitForSelector('.phx-connected', { timeout: 20000 });
        await page.locator('[phx-click="csa"]').first().click();
        await page.waitForFunction(() => document.querySelector('#kifu-modal textarea')?.value?.length > 0, null, { timeout: 15000 });
        const csa = await page.locator('#kifu-modal textarea').inputValue();
        writeFileSync(join(GAMES, `${game.id}.csa`), csa);
        index.games[game.id].group = game.group;
        delete index.games[game.id].failed;
        done += 1;
        if (done % 20 === 0) {
          saveIndex(index);
          console.log(`${done}/${todo.length}`);
        }
        break;
      } catch (error) {
        const message = String(error?.message ?? error);
        if (/closed|crash|Target/.test(message) && attempt === 0) {
          await open();
          continue;
        }
        index.games[game.id].failed = message.slice(0, 120);
        console.log(`読めなかった: ${game.id} ${index.games[game.id].failed.split('\n')[0]}`);
        break;
      } finally {
        await page?.close().catch(() => {});
      }
    }
    await sleep(Math.max(0, Number(options.gap) - (Date.now() - started)));
  }
  saveIndex(index);
  await browser?.close();
  console.log(`読んだ${done}局`);
}

function statsCommand() {
  const index = loadIndex();
  const games = Object.values(index.games);
  const count = {};
  for (const game of games) {
    const key = game.tournament === '奨励会' ? 'shoreikai' : eraOf(game.date.slice(0, 4)) ?? '?';
    count[key] ??= { listed: 0, saved: 0 };
    count[key].listed += 1;
    if (existsSync(join(GAMES, `${game.id}.csa`))) count[key].saved += 1;
  }
  console.log(JSON.stringify(count, null, 1));
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  const run = { list: listCommand, fetch: fetchCommand, stats: statsCommand }[options.command];
  if (!run) throw new Error(`知らない命令です: ${options.command}`);
  await run(options);
}
