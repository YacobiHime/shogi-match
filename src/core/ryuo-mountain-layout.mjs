// 竜王への道の山の地図(docs/ryuo-ui-renewal-design.mdの5-2)の配置。段の数から、段の座標と山の輪郭を決める。
// 座標は、幅MOUNTAIN_WIDTHの図の中の値。画面ではこの図をそのまま拡大・縮小して描く(RyuoMountain.vue)。

/** 図の幅。スマホの縦の幅に合わせ、ほかの画面では拡大する。 */
export const MOUNTAIN_WIDTH = 390;
/** 段と段の高さの差。 */
export const STEP_RISE = 66;
/** 頂上(竜王の座)の段の高さ。上に金屏風を描く分をあける。 */
const SUMMIT_Y = 120;
/** 頂上と、そのすぐ下の段(七番勝負)の高さの差。金屏風と将棋盤の分だけ広くあける。 */
export const SUMMIT_RISE = 96;
/** いちばん下の段の下にあける高さ(将棋会館と段の名前)。 */
const FOOT = 96;
/** 段の横の位置(幅に対する割合)。左右に振って、つづら折りの道にする。 */
const ZIGZAG = Object.freeze([0.26, 0.58, 0.8, 0.5, 0.2, 0.46, 0.76, 0.54, 0.24, 0.6]);

/**
 * 段の座標と図の高さ。いちばん上の段(竜王)は真ん中で、その下だけ金屏風の分を広くあける。
 * @param {number} count 段の数(竜王の段を含む)
 * @returns {{ width: number, height: number, points: { x: number, y: number }[] }}
 */
export function mountainLayout(count) {
  const n = Math.max(1, count);
  const below = (index) => (index >= n - 1 ? 0 : SUMMIT_RISE + (n - 2 - index) * STEP_RISE);
  const height = SUMMIT_Y + below(0) + FOOT;
  const points = Array.from({ length: n }, (_, index) => {
    if (index === n - 1) return { x: MOUNTAIN_WIDTH / 2, y: SUMMIT_Y };
    return { x: Math.round(ZIGZAG[index % ZIGZAG.length] * MOUNTAIN_WIDTH), y: SUMMIT_Y + below(index) };
  });
  return { width: MOUNTAIN_WIDTH, height, points };
}

/**
 * 階段状(ドット絵ふう)の輪郭。折れ線の点を、stepの幅ごとの水平な段に直す。SVGのpolygonのpointsの文字列。
 * @param {[number, number][]} points
 * @param {number} [step]
 */
export function steppedOutline(points, step = 8) {
  const out = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const parts = Math.max(1, Math.round(Math.abs(x2 - x1) / step));
    for (let k = 0; k < parts; k += 1) {
      const xa = x1 + ((x2 - x1) * k) / parts;
      const xb = x1 + ((x2 - x1) * (k + 1)) / parts;
      const y = Math.round((y1 + ((y2 - y1) * k) / parts) / step) * step;
      out.push(`${Math.round(xa)},${y}`, `${Math.round(xb)},${y}`);
    }
  }
  const [lx, ly] = points.at(-1);
  out.push(`${lx},${ly}`);
  return out.join(' ');
}

/**
 * 山の層(奥から手前へ)。頂上は竜王の段の上。左右は図の外まで伸ばす(広い画面で端が切れないように)。
 * @param {number} height 図の高さ
 * @returns {{ fill: string, points: string }[]}
 */
export function mountainLayers(height) {
  const w = MOUNTAIN_WIDTH;
  const top = SUMMIT_Y - 40;
  const span = (fraction) => top + (height - top) * fraction;
  return [
    { fill: '#22385a', points: steppedOutline([[-w, height], [-w, span(0.45)], [-0.1 * w, span(0.5)], [0.14 * w, span(0.36)], [0.3 * w, span(0.42)], [0.42 * w, span(0.2)], [0.62 * w, span(0.3)], [0.82 * w, span(0.14)], [1.1 * w, span(0.3)], [2 * w, span(0.36)], [2 * w, height]]) },
    { fill: '#2b4568', points: steppedOutline([[-w, height], [-w, span(0.66)], [0.04 * w, span(0.6)], [0.22 * w, span(0.46)], [0.38 * w, span(0.18)], [0.5 * w, top + 30], [0.66 * w, span(0.2)], [0.86 * w, span(0.42)], [1.2 * w, span(0.56)], [2 * w, span(0.62)], [2 * w, height]]) },
    { fill: '#355780', points: steppedOutline([[-0.4 * w, height], [0.04 * w, span(0.8)], [0.2 * w, span(0.56)], [0.36 * w, span(0.28)], [0.46 * w, top + 12], [0.5 * w, top], [0.56 * w, top + 14], [0.7 * w, span(0.3)], [0.86 * w, span(0.6)], [1.04 * w, span(0.84)], [1.4 * w, height]]) },
    { fill: '#2a5047', points: steppedOutline([[-w, height], [-w, height - 60], [0.1 * w, height - 70], [0.3 * w, height - 58], [0.56 * w, height - 76], [0.8 * w, height - 62], [2 * w, height - 70], [2 * w, height]]) },
  ];
}
