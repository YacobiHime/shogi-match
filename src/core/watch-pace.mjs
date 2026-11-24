// 師匠の1年の観戦で、手を見せる速さと時計(docs/disciple-mode-design.mdの38章)。画面に依存しない。
// エンジンが手を考え終えた時ではなく、その手で使った持ち時間(entry.time)に合わせた早送りの長さで1手ずつ見せる。
// 序盤はエンジンが速く指すので、見せる手の先まで読みが進み、終盤の重い局面でも待たずに同じ調子で見せられる。

import { fastForwardSeconds } from './time-control.mjs';

/** 1手を見せるまでの長さの下限と上限(ミリ秒)。下限は、序盤の速い手も目で追える長さ。 */
export const PACE_MIN_MS = 700;
export const PACE_MAX_MS = 2200;

/**
 * 1手を見せるまでの長さ(ミリ秒)。使った持ち時間が長いほど長いが、1分の手でおよそ1秒、長考でも2.2秒まで
 * (大会の対局の相手の早送り`fastForwardSeconds`と同じ縮め方。棋士の1年と同じくリアルタイムより速い)。
 * @param {{ time?: number } | null | undefined} entry
 */
export function paceMs(entry) {
  const ms = Math.round(fastForwardSeconds(Number(entry?.time) || 0) * 1000);
  return Math.min(PACE_MAX_MS, Math.max(PACE_MIN_MS, ms));
}

/**
 * 盤の名札の横の時計。uptoまでの手の時間を引き、次の手(entries[upto])を考えている途中(progress 0〜1)なら、その手の時間の分だけ早送りで減らす。
 * 持ち時間を使い切った側は、秒読みの残り秒を出す。
 * @param {{ time?: number }[]} entries
 * @param {number} upto 見せた手の数
 * @param {{ control: { main: number, byoyomi: number }, whiteFirst?: boolean, progress?: number }} options
 * @returns {{ black: number, white: number, blackByoyomi?: number, whiteByoyomi?: number, fast: 'black' | 'white' | '' }}
 */
export function watchClocks(entries, upto, { control, whiteFirst = false, progress = 0 }) {
  const sideAt = (ply) => ((ply % 2 === 0) !== whiteFirst ? 'black' : 'white');
  const left = { black: control.main, white: control.main };
  const count = Math.max(0, Math.min(entries.length, upto));
  for (let ply = 0; ply < count; ply += 1) {
    const side = sideAt(ply);
    left[side] = Math.max(0, left[side] - (Number(entries[ply]?.time) || 0));
  }
  /** @type {{ black: number, white: number, blackByoyomi?: number, whiteByoyomi?: number, fast: 'black' | 'white' | '' }} */
  const view = { black: Math.round(left.black), white: Math.round(left.white), fast: '' };
  const setByoyomi = (side, seconds) => {
    if (side === 'black') view.blackByoyomi = seconds;
    else view.whiteByoyomi = seconds;
  };
  for (const side of /** @type {const} */ (['black', 'white'])) {
    if (left[side] <= 0) setByoyomi(side, control.byoyomi);
  }
  const next = entries[count];
  if (next && progress > 0) {
    const side = sideAt(count);
    const spent = (Number(next.time) || 0) * Math.min(1, progress);
    if (spent < left[side]) {
      view[side] = Math.max(0, Math.round(left[side] - spent));
    } else {
      view[side] = 0;
      setByoyomi(side, Math.max(0, Math.round(control.byoyomi - (spent - left[side]))));
    }
    if (progress < 1) view.fast = side;
  }
  return view;
}
