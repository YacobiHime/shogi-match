// 大会の対局の秒読みの演出(docs/tournament-match-presence-design.mdの7章)。
// 時間の緊張だけを足し、0秒になっても負けにはしない(Game 4-1 初心者が楽しめなくなる罰を作らない)。

/** エントリー設定の選択肢。既定は「なし」。 */
export const BYOYOMI_CHOICES = Object.freeze([
  Object.freeze({ value: 0, label: 'なし' }),
  Object.freeze({ value: 30, label: '30秒' }),
]);

/** 読み上げ音を鳴らし始める残り秒。 */
export const BYOYOMI_BEEP_FROM = 10;

/** 期の設定から、秒読みの秒数(なしは0)。前の版の保存には設定がないので、なし。 */
export function byoyomiSeconds(settings) {
  const value = Number(settings?.byoyomi);
  return BYOYOMI_CHOICES.some((choice) => choice.value === value) ? value : 0;
}

/** 設定の行に出す言葉。 */
export const byoyomiLabel = (seconds) => BYOYOMI_CHOICES.find((choice) => choice.value === seconds)?.label ?? 'なし';

/**
 * 残り秒になったときに鳴らす音。10秒から1秒ごとに短い音、0秒で長い音。
 * @param {number} left
 * @returns {'byoyomi' | 'byoyomi-end' | null}
 */
export function byoyomiSound(left) {
  if (left === 0) return 'byoyomi-end';
  return left > 0 && left <= BYOYOMI_BEEP_FROM ? 'byoyomi' : null;
}

/**
 * 名札の輪の見た目。残りの割合(輪の長さ)と、急ぐ段(10秒から)・時間いっぱい。
 * @param {number} left
 * @param {number} total
 */
export function byoyomiRing(left, total) {
  const clamped = Math.max(0, Math.min(total, left));
  return {
    left: clamped,
    fraction: total > 0 ? clamped / total : 0,
    stage: clamped === 0 ? 'up' : clamped <= BYOYOMI_BEEP_FROM ? 'hurry' : 'calm',
    label: clamped === 0 ? '時間いっぱい' : `残り${clamped}秒`,
  };
}
