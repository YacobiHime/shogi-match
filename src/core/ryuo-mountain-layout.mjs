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

// ---- 横長の地図(PCの期の画面で、真ん中の列の下に置く。docs/ryuo-stages-design.mdの10章)
// 麓(左)の将棋会館から、右へ登って頂上の竜王の座へ。段は左から右へ並べ、少しずつ高くする。

/** 横長の図の高さ。 */
export const WIDE_HEIGHT = 250;
/** 段と段の横の間隔。 */
export const WIDE_STEP_GAP = 84;
/** 頂上と、そのすぐ左の段(七番勝負)の横の間隔。金屏風の分だけ広くあける。 */
const WIDE_SUMMIT_GAP = 104;
/** いちばん左の段の左(将棋会館)と、頂上の右(いまの竜王の顔)にあける幅。 */
const WIDE_LEFT = 130;
const WIDE_RIGHT = 140;
/** 頂上の高さと、いちばん下の段・頂上のすぐ下の段の高さ。 */
const WIDE_SUMMIT_Y = 98;
const WIDE_FOOT_Y = 196;
const WIDE_TOP_Y = 150;
/** 段の高さの小さな上下(同じ高さが続いて平らに見えないように)。 */
const WIDE_WOBBLE = Object.freeze([0, -8, 4, -6, 6, -4]);

/**
 * 横長の地図の、段の座標と図の大きさ。いちばん右の段(竜王)が頂上。
 * @param {number} count 段の数(竜王の段を含む)
 * @returns {{ width: number, height: number, points: { x: number, y: number }[] }}
 */
export function mountainLayoutWide(count) {
  const n = Math.max(1, count);
  const climb = Math.max(1, n - 2);
  const width = WIDE_LEFT + Math.max(0, n - 2) * WIDE_STEP_GAP + (n > 1 ? WIDE_SUMMIT_GAP : 0) + WIDE_RIGHT;
  const points = Array.from({ length: n }, (_, index) => {
    if (index === n - 1) return { x: WIDE_LEFT + Math.max(0, n - 2) * WIDE_STEP_GAP + (n > 1 ? WIDE_SUMMIT_GAP : 0), y: WIDE_SUMMIT_Y };
    const rise = n - 2 > 0 ? ((WIDE_FOOT_Y - WIDE_TOP_Y) * index) / climb : WIDE_FOOT_Y - WIDE_TOP_Y;
    const wobble = index === 0 || index === n - 2 ? 0 : WIDE_WOBBLE[index % WIDE_WOBBLE.length];
    return { x: WIDE_LEFT + index * WIDE_STEP_GAP, y: Math.round(WIDE_FOOT_Y - rise + wobble) };
  });
  return { width, height: WIDE_HEIGHT, points };
}

/**
 * 横長の地図の山の層(奥から手前へ)。頂上はsummitXで、右は頂上から下る。左右は図の外まで伸ばす。
 * @param {number} width 図の幅
 * @param {number} summitX 頂上の横の位置
 * @returns {{ fill: string, points: string }[]}
 */
export function mountainLayersWide(width, summitX) {
  const h = WIDE_HEIGHT;
  const top = WIDE_SUMMIT_Y - 34;
  // 枠が図よりずっと横長でも山が切れないよう、左右へ大きく伸ばす。
  const far = 3000;
  const at = (fraction) => summitX * fraction;
  return [
    { fill: '#22385a', points: steppedOutline([[-far, h], [-far, 150], [at(0.12), 128], [at(0.3), 104], [at(0.46), 122], [at(0.62), 92], [at(0.8), 108], [summitX + 60, 84], [summitX + 200, 118], [width + far, 126], [width + far, h]]) },
    { fill: '#2b4568', points: steppedOutline([[-far, h], [-far, 186], [at(0.18), 170], [at(0.38), 146], [at(0.58), 132], [at(0.78), 116], [summitX - 40, top + 30], [summitX + 70, 120], [summitX + 180, 158], [width + far, 172], [width + far, h]]) },
    { fill: '#355780', points: steppedOutline([[-far, h], [-40, 222], [at(0.2), 206], [at(0.45), 184], [at(0.7), 162], [summitX - 60, top + 20], [summitX - 14, top + 4], [summitX, top], [summitX + 16, top + 6], [summitX + 70, top + 40], [summitX + 150, 190], [width + far, 226], [width + far, h]]) },
    { fill: '#2a5047', points: steppedOutline([[-far, h], [-far, h - 22], [at(0.25), h - 28], [at(0.55), h - 20], [at(0.85), h - 30], [width + far, h - 24], [width + far, h]]) },
  ];
}
