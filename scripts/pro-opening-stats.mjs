// プロの棋譜から、時代ごとの作戦の割合を数える(docs/disciple-mode-design.mdの40章のL1)。
// 手元の棋譜(scripts/fetch-pro-kifu.mjsの.kifu-cache/)を戦型の判定(formation-tracker.mjs)にかけ、60手までに組んだ戦法・囲いから、
// 棋士の得意戦法の目録(ryuo-data.mjsのOPPONENT_STYLES)のどれに当たるかを、先手・後手ごとに数える。
// アプリに入れるのは数えた数だけ(src/data/pro-opening-eras.mjs)。棋譜は入れない。
// 使い方:
//   node scripts/pro-opening-stats.mjs [--write] [--names]
//     --writeで src/data/pro-opening-eras.mjs を書き直す。--namesで、判定した名前の数(目録に寄せる前)も出す。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importCSA } from 'tsshogi';
import { createFormationState, detectFormationSnapshot, formationMove, formedNamesFromState, updateFormationState } from '../src/core/formation-tracker.mjs';
import { eraOf, ERAS } from './fetch-pro-kifu.mjs';

const CACHE = '.kifu-cache';
const OUT = 'src/data/pro-opening-eras.mjs';
const PLY_LIMIT = 60;
const master = JSON.parse(readFileSync('src/data/hiragana_suisho_formations.json', 'utf8'));

/**
 * 判定した名前(戦型・飛車の筋・組んだ戦法と囲い)から、得意戦法の目録のid。どれにも当たらなければ'other-static'か'other-ranging'。
 * @param {string[]} names
 * @param {string} rook 飛車の筋の名前(振り飛車なら'四間飛車'など。居飛車は'')
 */
export function styleOfNames(names, rook) {
  const has = (word) => names.some((name) => name.includes(word));
  const ranging = /飛車|石田/.test(rook) && !/居飛車|右四間/.test(rook);
  if (ranging || has('中飛車') || has('石田流') || has('早石田') || has('藤井システム')) {
    if (has('藤井システム')) return 'fujii-system';
    if (has('中飛車')) return 'gokigen';
    if (has('石田')) return 'ishida';
    if (has('三間飛車') || /三間/.test(rook)) return 'sangen';
    if (has('向かい飛車') || /向かい/.test(rook)) return 'mukai';
    if (has('四間飛車') || /四間/.test(rook)) {
      if (has('穴熊')) return 'shiken-anaguma';
      if (has('銀冠')) return 'shiken-silver-crown';
      return 'shiken-mino';
    }
    return 'other-ranging';
  }
  if (has('腰掛け銀') && has('角換わり')) return 'kakugawari-kg';
  if (has('角換わり')) return 'kakugawari';
  // 横歩取り・ひねり飛車は相掛かりの出だしから分かれる形なので、相掛かりに寄せる(目録に横歩取りの得意戦法はない)。
  if (has('相掛かり') || has('横歩取り') || has('ひねり飛車')) return 'aigakari';
  if (has('雁木')) return 'gangi';
  if (has('矢倉')) return 'yagura';
  if (has('右四間')) return 'right-shiken';
  if (has('居飛車穴熊')) return 'ibisha-anaguma';
  if (has('左美濃')) return 'left-mino';
  if (has('早繰り銀')) return 'hayaguri';
  if (has('棒銀')) return 'bougin';
  return 'other-static';
}

/** 1局を60手まで判定し、先手・後手の名前と得意戦法のid。 */
export function gameStyles(text) {
  const record = importCSA(text);
  if (record instanceof Error) return null;
  let state = createFormationState();
  record.goto(0);
  let ply = 0;
  for (let node = record.first.next; node && ply < PLY_LIMIT; node = node.next) {
    if (!node.move || typeof node.move.usi !== 'string') break;
    ply += 1;
    record.goto(ply);
    const sfen = record.position.sfen;
    state = updateFormationState(state, detectFormationSnapshot(sfen, master), formationMove(sfen, ply));
  }
  if (ply < 30) return null;
  const out = {};
  for (const color of ['black', 'white']) {
    const names = formedNamesFromState(state, color);
    out[color] = { names, style: styleOfNames(names, state[color].rook ?? '') };
  }
  return out;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const index = JSON.parse(readFileSync(join(CACHE, 'index.json'), 'utf8'));
  /** @type {Record<string, { games: number, black: Record<string, number>, white: Record<string, number> }>} */
  const table = {};
  const nameCount = new Map();
  for (const game of Object.values(index.games)) {
    const file = join(CACHE, 'games', `${game.id}.csa`);
    if (!existsSync(file)) continue;
    const group = game.tournament === '奨励会' ? 'shoreikai' : eraOf(game.date.slice(0, 4));
    if (!group) continue;
    const styles = gameStyles(readFileSync(file, 'utf8'));
    if (!styles) continue;
    table[group] ??= { games: 0, black: {}, white: {} };
    table[group].games += 1;
    for (const color of ['black', 'white']) {
      table[group][color][styles[color].style] = (table[group][color][styles[color].style] ?? 0) + 1;
      for (const name of styles[color].names) nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
    }
  }
  const groups = [...ERAS.map((era) => era.id), 'shoreikai'].filter((id) => table[id]);
  for (const id of groups) {
    const row = table[id];
    const merged = {};
    for (const color of ['black', 'white']) for (const [style, n] of Object.entries(row[color])) merged[style] = (merged[style] ?? 0) + n;
    const top = Object.entries(merged).sort((a, b) => b[1] - a[1]).map(([style, n]) => `${style} ${((n / (row.games * 2)) * 100).toFixed(1)}%`).join('、');
    console.log(`${id}（${row.games}局）: ${top}`);
  }
  if (args.includes('--names')) console.log([...nameCount].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([n, c]) => `${n}:${c}`).join(' '));
  if (args.includes('--write')) {
    const body = groups.map((id) => `  ${id}: Object.freeze(${JSON.stringify(table[id])}),`).join('\n');
    writeFileSync(OUT, `// 時代ごとの作戦の数(docs/disciple-mode-design.mdの40章のL1)。scripts/pro-opening-stats.mjs --writeで作る。手で書き換えない。
// 将棋DB2のプロの棋譜(私的利用)を戦型の判定にかけ、60手までに組んだ形から得意戦法の目録(ryuo-data.mjsのOPPONENT_STYLES)のidに寄せて数えた。
// 棋譜そのものは入れていない。gamesは数えた局の数、black・whiteは先手・後手ごとの数(other-static・other-rangingは目録に当たらない居飛車・振り飛車)。
// edo=江戸、early=明治〜昭和前期(1960年まで)、showa=昭和後期(1988年まで)、heisei=平成(2018年まで)、reiwa=令和、shoreikai=奨励会。

export const PRO_OPENING_ERAS = Object.freeze({
${body}
});
`);
    console.log(`${OUT} を書きました`);
  }
}
