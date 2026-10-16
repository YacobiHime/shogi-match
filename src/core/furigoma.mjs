/**
 * 振り駒。歩を5枚振り、表(歩)と裏(と)の数で先後を決める。
 * CPU対局では、プレイヤーが振る側として扱い、歩が3枚以上ならプレイヤーが先手になる。
 */

export const FURIGOMA_PIECES = 5;

/**
 * @param {() => number} [random] 0以上1未満を返す乱数(テストで差し替える)
 * @returns {{ faces: ('fu' | 'to')[], fuCount: number, playerColor: 'black' | 'white' }}
 */
export function throwFurigoma(random = Math.random) {
  const faces = Array.from({ length: FURIGOMA_PIECES }, () => (random() < 0.5 ? 'fu' : 'to'));
  const fuCount = faces.filter((face) => face === 'fu').length;
  return { faces, fuCount, playerColor: fuCount * 2 > FURIGOMA_PIECES ? 'black' : 'white' };
}

/** 振り駒の結果を伝える一言。 */
export function furigomaMessage({ fuCount, playerColor }) {
  const face = fuCount * 2 > FURIGOMA_PIECES ? `歩が${fuCount}枚` : `と金が${FURIGOMA_PIECES - fuCount}枚`;
  return `${face}。あなたが${playerColor === 'black' ? '先手' : '後手'}だよ！`;
}
