// プロの棋譜から、人が指しそうな手の好みの重みを数える(docs/disciple-mode-design.mdの40章のL3)。
// 局面ごとに、プロの手の特徴(move-prior.mjsのmoveFeatures)と、合法手全体の中の特徴の割合を数え、その比の対数を重みにする。
// アプリに入れるのは重みだけ(src/data/pro-move-prior.mjs)。棋譜は入れない。
// 使い方:
//   node scripts/pro-move-prior.mjs [--write] [--max-games 1500] [--skip-groups edo]
//     学びに使う局は、一致率の道具(reason-match-report.mjs)が使う局(各時代のidの並びの先頭)と重ならないよう、各時代の後ろ半分から取る。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importCSA } from 'tsshogi';
import { FastBoard } from '../src/core/fast-board.mjs';
import { moveFeatures, priorPhase } from '../src/core/move-prior.mjs';
import { eraOf } from './fetch-pro-kifu.mjs';

const CACHE = '.kifu-cache';
const OUT = 'src/data/pro-move-prior.mjs';
/** 一致率の道具が測りに使う局の数(各時代の先頭から)。学びには使わない。 */
export const HOLDOUT_PER_GROUP = 60;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const skip = new Set(String(option('skip-groups', '')).split(',').filter(Boolean));
const index = JSON.parse(readFileSync(join(CACHE, 'index.json'), 'utf8'));
const byGroup = new Map();
for (const game of Object.values(index.games)) {
  if (!existsSync(join(CACHE, 'games', `${game.id}.csa`))) continue;
  const group = game.tournament === '奨励会' ? 'shoreikai' : eraOf(game.date.slice(0, 4));
  if (!group || skip.has(group)) continue;
  if (!byGroup.has(group)) byGroup.set(group, []);
  byGroup.get(group).push(game);
}
const train = [];
for (const list of byGroup.values()) train.push(...[...list].sort((a, b) => a.id.localeCompare(b.id)).slice(HOLDOUT_PER_GROUP));
const maxGames = Number(option('max-games', '1500'));

/** 段ごとに、プロの手が持つ特徴の数と、合法手の中の特徴の割合の和。 */
const stats = { op: { positions: 0, pro: {}, legal: {} }, mid: { positions: 0, pro: {}, legal: {} }, end: { positions: 0, pro: {}, legal: {} } };
let used = 0;
for (const game of train.slice(0, maxGames)) {
  const record = importCSA(readFileSync(join(CACHE, 'games', `${game.id}.csa`), 'utf8'));
  if (record instanceof Error) continue;
  const board = FastBoard.fromSfen(record.initialPosition.sfen);
  let ply = 0;
  let lastTo = -1;
  for (let node = record.first.next; node; node = node.next) {
    const usi = node.move?.usi;
    if (typeof usi !== 'string') break;
    const legal = board.legal();
    const pro = legal.find((m) => board.toUsi(m) === usi);
    if (pro === undefined) break;
    ply += 1;
    const phase = priorPhase(ply);
    const cell = stats[phase];
    cell.positions += 1;
    for (const f of moveFeatures(board, pro, { lastTo })) cell.pro[f] = (cell.pro[f] ?? 0) + 1;
    const share = {};
    for (const m of legal) for (const f of moveFeatures(board, m, { lastTo })) share[f] = (share[f] ?? 0) + 1;
    for (const [f, n] of Object.entries(share)) cell.legal[f] = (cell.legal[f] ?? 0) + n / legal.length;
    board.make(pro);
    lastTo = (pro >> 7) & 127;
  }
  used += 1;
  if (used % 100 === 0) console.error(`${used}局`);
}

const weights = {};
for (const [phase, cell] of Object.entries(stats)) {
  weights[phase] = {};
  const features = new Set([...Object.keys(cell.pro), ...Object.keys(cell.legal)]);
  for (const f of features) {
    const pro = ((cell.pro[f] ?? 0) + 1) / (cell.positions + 2);
    const legal = ((cell.legal[f] ?? 0) + 1) / (cell.positions + 2);
    weights[phase][f] = Math.round(Math.log(pro / legal) * 100) / 100;
  }
}
console.log(`学びに使った局: ${used}、局面: ${Object.values(stats).map((c) => c.positions).join('/')}`);
for (const [phase, w] of Object.entries(weights)) {
  console.log(phase, Object.entries(w).sort((a, b) => b[1] - a[1]).map(([f, v]) => `${f}:${v}`).join(' '));
}
if (args.includes('--write')) {
  const body = Object.entries(weights).map(([phase, w]) => `  ${phase}: Object.freeze(${JSON.stringify(Object.fromEntries(Object.entries(w).sort()))}),`).join('\n');
  writeFileSync(OUT, `// 人が指しそうな手の好みの重み(docs/disciple-mode-design.mdの40章のL3)。scripts/pro-move-prior.mjs --writeで作る。手で書き換えない。
// 将棋DB2のプロの棋譜(私的利用)で、プロの手がその特徴を持つ割合と、合法手全体の中の割合の比の対数。棋譜そのものは入れていない。
// op=序盤(30手まで)・mid=中盤(80手まで)・end=終盤。特徴の名前はmove-prior.mjsのmoveFeatures。

export const PRO_MOVE_PRIOR = Object.freeze({
${body}
});
`);
  console.log(`${OUT} を書きました`);
}
