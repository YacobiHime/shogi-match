// 棋士の1年の「勝負どころから指す」(docs/pro-year-design.mdの13-3の6)。画面に依存しない。
// 対局の前に、あなたの分身と相手で40手前後まで指した局面を作り、そこから自分で続きを指す。
// 局面は中継の棋譜を作る仕組み(relay-game.mjsのplayRelayGame)で作り、決めた手数で止める。勝ち負けは盤の上で決める。

import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';
import { relaySeed } from './relay-game.mjs';
import { autoRatingBonus } from './pro-week.mjs';

/** 止める手数の幅(この中で、あなたの手番になる手数)。 */
export const CUT_PLIES = Object.freeze({ min: 36, max: 44, floor: 20 });
/** 止める局面の形勢の上限(先手から見た評価値の絶対値)。どちらかに大きく傾く前で止める。 */
export const CUT_LIMIT_CP = 300;
/** 調子と対策が局面の作り方に効く上限(レーティングの単位。CP_PER_RATINGで2倍の評価値になる)。 */
const CUT_BONUS_CAP = 120;

const PRO_USER_ID = 'you';

/**
 * 局面を作る中継の局の設定(relay-game.mjsのspec)。公式戦の対局待ちでなければnull。
 * 形勢の筋書きは五分から、調子と対策の分だけあなたに寄せる(13-3の3)。止める手数は、あなたの手番になる数。
 * @param {any} state 棋士の1年の状態
 * @param {{ userName?: string, userCharacter?: any }} [options]
 * @returns {{ spec: any, plies: number, color: 'black' | 'white' } | null}
 */
export function cutSpec(state, { userName = 'あなた', userCharacter = null } = {}) {
  const pending = state?.pending;
  if (!pending?.gameId || pending.kind === 'study' || pending.kind === 'shidou') return null;
  const color = pending.color === 'white' ? 'white' : 'black';
  const other = color === 'black' ? 'white' : 'black';
  const opponent = state.players?.[pending.opponentId] ?? {};
  const key = `pro-cut:${state.seed}:${pending.gameId}`;
  const seed = relaySeed(key);
  // 止める手数: 36〜44のうち、指し終えたあとにあなたの手番になる数(先手なら偶数、後手なら奇数)。
  const span = CUT_PLIES.max - CUT_PLIES.min + 1;
  let plies = CUT_PLIES.min + (seed % span);
  if ((plies % 2 === 0) !== (color === 'black')) plies = plies + 1 > CUT_PLIES.max ? plies - 1 : plies + 1;
  const bonus = Math.max(-CUT_BONUS_CAP, Math.min(CUT_BONUS_CAP, autoRatingBonus(pending.condition ?? state.condition ?? 2, pending.prep?.stars ?? 0)));
  const sign = color === 'black' ? 1 : -1;
  const lean = Math.round(bonus * sign);
  const player = (side) => (side === color
    ? { id: PRO_USER_ID, name: userName, dan: '', rating: 0, level: null, story: null, kind: 'pro', character: userCharacter, repertoire: null }
    : { id: pending.opponentId, name: opponent.name ?? '', dan: opponent.dan ?? '', rating: opponent.rating ?? 0, level: null, story: opponent.story ?? null, kind: 'pro', character: opponent.character ?? null, repertoire: opponent.repertoire ?? null });
  const spec = {
    key, event: 'pro-year', kind: 'cut', label: pending.label ?? '', seed, quality: '',
    black: player('black'), white: player('white'),
    // 勝ち負けは盤の上で決めるので、筋書きの勝者は形勢を寄せる側(五分なら種で)。止めるのは中盤の途中なので、決め手の手までは指さない。
    winner: lean > 0 ? 'black' : lean < 0 ? 'white' : (seed & 1 ? 'black' : 'white'),
    how: 'ending',
    story: [lean, lean, 300 * (lean >= 0 ? 1 : -1)],
    openings: { [color]: null, [other]: pending.style?.opening ?? null },
    castles: { black: null, white: null },
  };
  return { spec, plies, color };
}

/**
 * 作った手から、止める手数を決める。目当ての手数から戻りながら、あなたの手番で、形勢が±300以内の局面を探す。
 * 見つからなければnull(最初から指す)。
 * @param {{ eval: number }[]} entries 中継の棋譜の手(evalは指したあとの先手から見た評価値)
 * @param {{ plies: number, color: 'black' | 'white' }} target
 */
export function pickCutPly(entries, { plies, color }) {
  const parity = color === 'black' ? 0 : 1;
  for (let ply = Math.min(plies, entries.length); ply >= CUT_PLIES.floor; ply -= 1) {
    if (ply % 2 !== parity) continue;
    const value = Number(entries[ply - 1]?.eval);
    if (Number.isFinite(value) && Math.abs(value) <= CUT_LIMIT_CP) return ply;
  }
  return null;
}

/**
 * 手を指したあとの局面(SFEN)。指せない手があればnull。
 * @param {string[]} moves USIの手
 */
export function sfenAfter(moves) {
  const record = createGameRecord(STANDARD_SFEN);
  for (const usi of moves) {
    if (!appendUsiMove(record, usi)) return null;
  }
  return record.position.sfen;
}
