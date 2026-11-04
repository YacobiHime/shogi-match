// 脳トレ道場の拡大率(docs/brain-training-design.mdの15章)。
// 道場の画面は、スマホからタブレットの大きさで文字と盤が読める作りになっている。大きなPCの画面でそのまま出すと、
// 余白だらけになり文字が小さい。そこで、広くて高い画面だけ、道場ぜんたいを拡大する。
// 小さい画面(スマホ・タブレット・1366×768のPC)は1のまま。拡大は横と縦の小さいほうに合わせるので、はみ出さない。

/** 拡大するのは、横がこれ以上のPCの画面だけ。タブレット横(1180)までは今までの画面のまま。 */
export const ZOOM_MIN_WIDTH = 1280;
/** 拡大率1の大きさ(横×縦。CSSピクセル)。1366×768のPCで今の配置が収まることを確かめてある。 */
export const ZOOM_BASE_WIDTH = 1100;
export const ZOOM_BASE_HEIGHT = 768;
/** 拡大の上限。4Kの画面でも、文字が大きすぎて1画面に収まらなくならないように。 */
export const ZOOM_MAX = 2.2;
/** 倍率の刻み(細かく変えると、窓の大きさを変えている間に文字がちらつく)。 */
export const ZOOM_STEP = 0.05;

/**
 * 画面の大きさ(CSSピクセル)から、道場の拡大率を出す。
 * @param {number} width
 * @param {number} height
 */
export function brainZoom(width, height) {
  if (!(width >= ZOOM_MIN_WIDTH) || !(height > 0)) return 1;
  const raw = Math.min(width / ZOOM_BASE_WIDTH, height / ZOOM_BASE_HEIGHT);
  const stepped = Math.floor(raw / ZOOM_STEP + 1e-9) * ZOOM_STEP;
  const zoom = Math.min(ZOOM_MAX, Math.max(1, stepped));
  return Math.round(zoom * 100) / 100;
}
