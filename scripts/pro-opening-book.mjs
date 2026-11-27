// プロの棋譜から、序盤の局面ごとに「どの手を何局で指したか」を数える(docs/disciple-mode-design.mdの40-9)。
// アプリに入れるのは、いくつもの局に出た局面(MIN_GAMES局以上)の、手ごとの局の数だけ(src/data/pro-opening-book.mjs)。棋譜そのものは入れない。
// 数は時代ごと(江戸・明治〜昭和前期・昭和後期・平成・令和・奨励会)に分けて持ち、棋士の育った時代の手を指しやすくする。
// 使い方:
//   node scripts/pro-opening-book.mjs [--plies 30] [--min-games 3] [--write]
//     一致率の道具(reason-match-report.mjs)が使う局(各時代のidの並びの先頭60局)は数えない。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importCSA } from 'tsshogi';
import { eraOf } from './fetch-pro-kifu.mjs';

const CACHE = '.kifu-cache';
const OUT = 'src/data/pro-opening-book.mjs';
const HOLDOUT_PER_GROUP = 60;
/** 数の並び(src/core/pro-book.mjsのBOOK_GROUPSと同じ順)。 */
const GROUPS = ['edo', 'early', 'showa', 'heisei', 'reiwa', 'shoreikai'];

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const PLIES = Number(option('plies', '30'));
const MIN_GAMES = Number(option('min-games', '3'));

const positionKey = (sfen) => sfen.split(' ').slice(0, 3).join(' ');

const index = JSON.parse(readFileSync(join(CACHE, 'index.json'), 'utf8'));
const byGroup = new Map();
for (const game of Object.values(index.games)) {
  if (!existsSync(join(CACHE, 'games', `${game.id}.csa`))) continue;
  const group = game.tournament === '奨励会' ? 'shoreikai' : eraOf(game.date.slice(0, 4));
  if (!group) continue;
  if (!byGroup.has(group)) byGroup.set(group, []);
  byGroup.get(group).push(game);
}

/** 局面 → 手 → 時代ごとの局の数。 */
const book = new Map();
/** 局面 → その局面に来た局の数。 */
const reached = new Map();
let games = 0;
for (const [group, list] of byGroup) {
  const g = GROUPS.indexOf(group);
  for (const game of [...list].sort((a, b) => a.id.localeCompare(b.id)).slice(HOLDOUT_PER_GROUP)) {
    const record = importCSA(readFileSync(join(CACHE, 'games', `${game.id}.csa`), 'utf8'));
    if (record instanceof Error) continue;
    // 平手の初形から始まる局だけ。
    if (!record.initialPosition.sfen.startsWith('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL')) continue;
    games += 1;
    const seenHere = new Set();
    let ply = 0;
    for (let node = record.first.next; node && ply < PLIES; node = node.next) {
      const usi = node.move?.usi;
      if (typeof usi !== 'string') break;
      record.goto(ply);
      const key = positionKey(record.position.sfen);
      // 同じ局で同じ局面に戻っても(千日手の手順など)1局に数える。
      if (seenHere.has(key)) break;
      seenHere.add(key);
      reached.set(key, (reached.get(key) ?? 0) + 1);
      if (!book.has(key)) book.set(key, new Map());
      const moves = book.get(key);
      if (!moves.has(usi)) moves.set(usi, new Array(GROUPS.length).fill(0));
      moves.get(usi)[g] += 1;
      ply += 1;
    }
  }
}

// 残すのは、MIN_GAMES局以上に出た局面の、2局以上で指された手(1局だけの手は、その対局を写すことになるので残さない)。
const kept = {};
let moveCount = 0;
for (const [key, moves] of book) {
  if ((reached.get(key) ?? 0) < MIN_GAMES) continue;
  const list = [...moves].filter(([, counts]) => counts.reduce((a, b) => a + b, 0) >= 2);
  if (!list.length) continue;
  kept[key] = list.sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).map(([usi, counts]) => `${usi}:${counts.join(',')}`).join(' ');
  moveCount += list.length;
}
const text = JSON.stringify(kept);
console.log(`数えた局: ${games}、${PLIES}手まで。残した局面: ${Object.keys(kept).length}、手: ${moveCount}、大きさ: ${Math.round(text.length / 1024)}KB`);

if (args.includes('--write')) {
  writeFileSync(OUT, `// 序盤の局面ごとの、プロが指した手の局の数(docs/disciple-mode-design.mdの40-9)。scripts/pro-opening-book.mjs --writeで作る。手で書き換えない。
// 将棋DB2のプロの棋譜(私的利用)の${games}局を、${PLIES}手まで数えた。${MIN_GAMES}局以上に出た局面の、2局以上で指された手だけを残し、棋譜そのものは入れていない。
// 鍵は局面(SFENの盤・手番・持ち駒)。値は「手:江戸,明治〜昭和前期,昭和後期,平成,令和,奨励会の局の数」を空白で区切ったもの(src/core/pro-book.mjsが読む)。

export const PRO_OPENING_BOOK = Object.freeze(${text});
`);
  console.log(`${OUT} を書きました`);
}
