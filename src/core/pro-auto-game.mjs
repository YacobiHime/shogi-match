// 分身の表示と勝敗確定で、同じ補正・先後・戦型を使う（docs/pro-year-design.mdの30章）。
import { createRng } from './ryuo-random.mjs';
import { simulateMemberGame } from './ryuo-simulation.mjs';
import { CONDITION_DEFAULT, autoRatingBonus } from './pro-week.mjs';
import { avatarEdge } from './pro-avatar.mjs';

/**
 * rngを省略したら保存された乱数の写しで計算する（表示用、元の状態を変えない）。
 * 勝敗を確定するときは、その後の処理にも使う実際のrngを渡す。
 * @param {any} state
 * @param {{ next(): number } | null} [rng]
 */
export function simulateProAutoGame(state, rng = null) {
  const pending = state?.pending;
  const me = state?.players?.user;
  const opponent = state?.players?.[pending?.opponentId];
  if (!pending?.gameId || !me || !opponent) return null;
  const game = state.games?.[pending.gameId];
  const color = pending.color === 'black' || pending.color === 'white' ? pending.color
    : game?.a === 'user' ? 'black' : 'white';
  const bonus = autoRatingBonus(state.condition ?? CONDITION_DEFAULT, pending.prep?.stars ?? 0) + avatarEdge(state.avatar);
  return simulateMemberGame(rng ?? createRng(state.rng), { ...me, rating: me.rating + bonus }, opponent, { aColor: color });
}

/** 補正後の表示用勝率。世界の乱数は消費せず、同じ状態の勝敗確定と同じ確率を返す。 @param {any} state */
export function proAutoChance(state) {
  return simulateProAutoGame(state)?.probability ?? null;
}
