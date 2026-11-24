// 将棋AI(論理)の駒の価値(docs/disciple-mode-design.mdの39章)。理由で指す棋士の探索(logic-search.mjs・reason-search.mjs)が使う。
// 盤上の成り駒の価値を「元の駒の価値」と「成った分」に分ける。成り駒を取ると、取った側の持ち駒になるのは元の駒なので、
// 取る側にとって、と金は歩と同じ価値(取った得は、相手の盤から消えると金と、持ち駒の歩)。
// 成った分は、相手に成られたときの損として小さめに持つ(と金の怖さは、敵陣の利き・玉に迫る駒の点で数える)。
// 馬と角の交換は、相手の馬が消えて互いに角を持ち駒にするので、馬−角(成った分)だけ得になる。
// 対局の札・図鑑の「駒の損得」(piece-points.mjsのAI_PIECE_POINTS)とは別の表(あちらは画面の言葉に使う)。

/** 元の駒の価値(盤上と持ち駒。将棋AIで使われる値。歩が90)。 */
export const BASE_VALUES = Object.freeze({ P: 90, L: 315, N: 405, S: 495, G: 540, B: 855, R: 990 });

/**
 * 成った分の価値(成り駒の盤上の価値 − 元の駒の価値)。と金は歩＋120で210(前は金と同じ540で、取ると630の得になり、
 * 飛車・馬と引きかえにと金を取りに行きすぎた)。成香・成桂も金より軽い。馬は角＋90、竜は飛車＋405(大駒は成ると働きが大きく変わる)。
 */
export const PROMOTION_GAIN = Object.freeze({ P: 120, L: 120, N: 100, S: 45, B: 90, R: 405 });

/** 盤上の駒の価値(成り駒は元の駒＋成った分)。玉は0(取ると勝ち)。 */
export const LOGIC_VALUES = Object.freeze({
  ...BASE_VALUES,
  '+P': BASE_VALUES.P + PROMOTION_GAIN.P,
  '+L': BASE_VALUES.L + PROMOTION_GAIN.L,
  '+N': BASE_VALUES.N + PROMOTION_GAIN.N,
  '+S': BASE_VALUES.S + PROMOTION_GAIN.S,
  '+B': BASE_VALUES.B + PROMOTION_GAIN.B,
  '+R': BASE_VALUES.R + PROMOTION_GAIN.R,
  K: 0,
});

/**
 * 盤上の駒を取ったときの駒の損得の動き(取る側から見た得)。相手の盤から消える価値と、自分の持ち駒になる元の駒の価値。
 * @param {string} kind 'P'・'+P'など
 */
export function captureSwing(kind) {
  const base = String(kind).replace('+', '');
  return (LOGIC_VALUES[/** @type {keyof typeof LOGIC_VALUES} */ (kind)] ?? 0) + (BASE_VALUES[/** @type {keyof typeof BASE_VALUES} */ (base)] ?? 0);
}
