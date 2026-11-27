// プロの序盤の手の数(docs/disciple-mode-design.mdの40-9)。
// 局面ごとに、プロが何局でその手を指したか(src/data/pro-opening-book.mjs。scripts/pro-opening-book.mjsで作る)を読み、
// 棋士の育った時代の手を多めに数えて1手を選ぶ。読み・駒の損得の確かめは呼ぶ側(reason-think.mjs)。画面・保存の仕組みに依存しない。

import { PRO_OPENING_BOOK } from '../data/pro-opening-book.mjs';

/** 数の並び(scripts/pro-opening-book.mjsのGROUPSと同じ順)。 */
export const BOOK_GROUPS = Object.freeze(['edo', 'early', 'showa', 'heisei', 'reiwa', 'shoreikai']);
/** 育った時代の局を、ほかの時代の局の何倍に数えるか。 */
export const ERA_BOOK_WEIGHT = 4;

/** 局面の鍵(SFENの盤・手番・持ち駒。手数は除く)。 */
export const bookKey = (sfen) => String(sfen).trim().split(/\s+/).slice(0, 3).join(' ');

/**
 * 局面のプロの手と、時代ごとの局の数。表にない局面は空。
 * @param {string} sfen
 * @param {Record<string, string>} [table]
 * @returns {{ usi: string, counts: number[], total: number }[]}
 */
export function bookMoves(sfen, table = PRO_OPENING_BOOK) {
  const row = table?.[bookKey(sfen)];
  if (!row) return [];
  return row.split(' ').map((item) => {
    const [usi, list] = item.split(':');
    const counts = list.split(',').map(Number);
    return { usi, counts, total: counts.reduce((a, b) => a + b, 0) };
  });
}

/**
 * プロの手から1手を選ぶ。局の数に比例し、育った時代の局はERA_BOOK_WEIGHT倍に数える。表になければnull。
 * @param {string} sfen
 * @param {{ era?: string | null, random?: () => number, table?: Record<string, string> }} [options]
 */
export function pickBookMove(sfen, { era = null, random = Math.random, table = PRO_OPENING_BOOK } = {}) {
  const moves = bookMoves(sfen, table);
  if (!moves.length) return null;
  const g = era ? BOOK_GROUPS.indexOf(era) : -1;
  const weights = moves.map(({ counts, total }) => total + (g >= 0 ? (ERA_BOOK_WEIGHT - 1) * counts[g] : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  let roll = random() * sum;
  for (let i = 0; i < moves.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return moves[i].usi;
  }
  return moves.at(-1).usi;
}
