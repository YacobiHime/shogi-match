// 中継の投了図から詰将棋(docs/tournament-relay-design.mdの47章)。投了した側の受け(AIの読み筋の応手)を1手指した局面から、
// 勝った側が連続王手で詰ませる手順を、問題集と同じ詰み探索(problem-solver)で探す。見つからなければ問題にしない。
// 中継の画面からだけ読む(盤と探索を持つので、対局画面からは読まない)。

import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import { findMateLine, isMatingLine, judgeMateStep } from './problem-solver';

/** 問題にする詰みの手数の上限(問題集の長手数と同じ)。 */
export const RELAY_TSUME_MAX_PLIES = 13;
/** 1つの手数を探す時間の上限(ミリ秒)。短い手数から順に探す。 */
export const RELAY_TSUME_STEP_MS = 350;

const sideOf = (sfen) => (String(sfen).split(' ')[1] === 'w' ? 'white' : 'black');

/** 指したあとの局面(指せなければnull)。 */
function after(sfen, usi) {
  const record = createGameRecord(sfen);
  return appendUsiMove(record, usi) ? record.position.sfen : null;
}

/**
 * 局面から、手番の側がいちばん短く詰ませる手順(maxPlies手まで)。見つからない・読み切れないときはnull。
 * @param {string} sfen 攻め方の手番
 * @param {{ maxPlies?: number, stepMs?: number }} [options]
 */
export function shortestMate(sfen, { maxPlies = RELAY_TSUME_MAX_PLIES, stepMs = RELAY_TSUME_STEP_MS } = {}) {
  for (let plies = 1; plies <= maxPlies; plies += 2) {
    const line = findMateLine(sfen, plies, { nodeLimit: 400000, maxTimeMs: stepMs });
    if (line === undefined) return null;
    if (line && line.length % 2 === 1 && isMatingLine(sfen, line)) return line;
  }
  return null;
}

/**
 * 投了図から詰将棋を作る。投了した側の受けは、最後の手の読み筋の応手(なければ、王手されていれば合法な受けのうち、いちばん長く逃れる手)。
 * 読み筋が詰みまで残っていて(勝った側が詰みを読んで指した手。relay-game.mjsの`storedPv`)、王手の連続で詰む手順なら、それを答えにする
 * (探索しない)。そうでなければ、詰み探索で短い手数から探す。
 * @param {{ sfen: string, reply?: string, pv?: string | string[], maxPlies?: number, stepMs?: number }} input
 *   sfenは投了図(投了した側の手番)、pvは最後の手の読み筋(投了した側の受けから)
 * @returns {{ start: string, defense: string, sfen: string, line: string[], plies: number, attacker: 'black' | 'white' } | null}
 */
export function resignTsume({ sfen, reply = '', pv = [], maxPlies = RELAY_TSUME_MAX_PLIES, stepMs = RELAY_TSUME_STEP_MS }) {
  if (!sfen) return null;
  const record = createGameRecord(sfen);
  const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
  if (!legal.length) return null;
  const defender = sideOf(sfen);
  const attacker = defender === 'black' ? 'white' : 'black';
  const moves = (Array.isArray(pv) ? pv : String(pv ?? '').split(' ')).filter(Boolean);
  if (!reply && moves.length) reply = moves[0];
  // 読み筋の詰み手順(受けのあと、攻め方の手で終わる奇数の手順)。
  const read = moves.slice(1);
  if (legal.includes(reply) && read.length % 2 === 1 && read.length <= maxPlies) {
    const next = after(sfen, reply);
    if (next && isMatingLine(next, read)) {
      // 読み筋より短い王手の詰みがあれば、そちらを答えにする(短い詰みだけ、すぐ探す)。
      const shorter = read.length > 3 ? shortestMate(next, { maxPlies: Math.min(read.length - 2, 5), stepMs }) : null;
      const line = shorter ?? read;
      return { start: sfen, defense: reply, sfen: next, line, plies: line.length, attacker };
    }
  }
  const tries = legal.includes(reply) ? [reply] : record.position.checked && legal.length <= 12 ? legal : [];
  let best = null;
  for (const defense of tries) {
    const next = after(sfen, defense);
    if (!next) continue;
    const line = shortestMate(next, { maxPlies, stepMs });
    // 受けのどれかが詰まない(逃れる)なら、王手の受けは問題にしない(読み筋の応手だけのときは、その変化で問題にする)。
    if (!line) {
      if (tries.length > 1) return null;
      continue;
    }
    if (!best || line.length > best.line.length) best = { defense, sfen: next, line };
  }
  if (!best) return null;
  return { start: sfen, defense: best.defense, sfen: best.sfen, line: best.line, plies: best.line.length, attacker };
}

/**
 * 詰将棋の1手を判定する。読み筋どおりならすぐ正解(応手も読み筋から)。違う王手は、残りの手数で詰むかを探索で確かめる(遠回りは認めない)。
 * @param {{ sfen: string, usi: string, line: string[], remaining: number }} state lineはいまの局面からの読み筋(外れたら空)
 * @returns {{ status: 'mated' } | { status: 'continue', reply: string, line: string[], remaining: number }
 *   | { status: 'not-check' | 'escapes' | 'illegal' | 'unknown' }}
 */
export function judgeTsumeMove({ sfen, usi, line, remaining }) {
  const next = after(sfen, usi);
  if (!next) return { status: 'illegal' };
  if (line?.[0] === usi) {
    if (line.length === 1) return { status: 'mated' };
    return { status: 'continue', reply: line[1], line: line.slice(2), remaining: remaining - 2 };
  }
  const verdict = judgeMateStep(sfen, usi, remaining, { slack: 0 });
  if (verdict.status === 'mated') return { status: 'mated' };
  if (verdict.status === 'continue') return { status: 'continue', reply: verdict.reply, line: [], remaining: verdict.plies };
  return { status: verdict.status };
}

/** いまの局面の次の一手のヒント(読み筋があればその手、なければ詰み探索)。 */
export function tsumeHint({ sfen, line, remaining }) {
  if (line?.length) return line[0];
  return findMateLine(sfen, Math.max(1, remaining), { nodeLimit: 300000, maxTimeMs: 800 })?.[0] ?? '';
}
