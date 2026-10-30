// 流れるコメントの置き方(docs/tournament-relay-design.mdの33章・45章)。ニコニコ動画の置き方をもとにする。
// - コメントは右の端から左の端の外まで、4秒で流れる(長い字ほど速い。ニコニコと同じ時間)。
// - 置く高さで、そこにいるコメントとぶつかれば、ぶつかったコメントのすぐ下へずらして探し直す。
//   どこにも空きがなければ(弾幕)、無作為の高さに置く。待たない。
// - ニコニコは上の端から探し始めるので、コメントが少ないと上に集まる(この中継の量では7割が上の1割)。
//   画面全体に出すため、探し始める高さだけ無作為にし、下の端まで行ったら上の端へ回って探す。
// - ぶつかるかは、ニコニコの2本の判定線より厳しく、流れているあいだ一度も近づきすぎないかで見る(33章)。
// 画面に依存しない(時間はミリ秒、幅と高さはpxで受け取る)。

/** 前のコメントとのあいだに空ける幅(字の大きさに対する倍率)。 */
export const DANMAKU_GAP_EM = 1.2;
/** コメントが右の端から左の端の外まで流れる時間(ミリ秒)。ニコニコ動画と同じ4秒。 */
export const DANMAKU_DURATION_MS = 4000;

/**
 * @typedef {{ start: number, width: number, duration: number, top: number, height: number }} Placed
 * @typedef {{ placed: Placed[] }} DanmakuState
 */

/** @returns {DanmakuState} */
export function createDanmaku() {
  return { placed: [] };
}

/**
 * 2つのコメントが重なるか。先に入ったほうの後ろの端に、あとのほうの前の端が近づきすぎないかを、
 * 両方が画面にいるあいだで見る。どちらも速さが一定なので、距離は時間の1次式で、両端の時刻だけ見ればよい。
 * @param {{ start: number, width: number, duration: number }} a
 * @param {{ start: number, width: number, duration: number }} b
 * @param {number} areaWidth 流れる欄の幅(px)
 * @param {number} gap 空ける幅(px)
 */
export function collides(a, b, areaWidth, gap) {
  const [first, second] = a.start <= b.start ? [a, b] : [b, a];
  const speedFirst = (areaWidth + first.width) / first.duration;
  const speedSecond = (areaWidth + second.width) / second.duration;
  // 時刻tの、先のコメントの後ろの端と、あとのコメントの前の端(右の端からの距離ではなく、左からの位置)。
  const tail = (t) => areaWidth + first.width - speedFirst * (t - first.start);
  const head = (t) => areaWidth - speedSecond * (t - second.start);
  const from = second.start;
  // 先のコメントの後ろの端が左の端を出るまで(あとのコメントが出きるまで)。
  const to = Math.min(first.start + first.duration, second.start + second.duration);
  if (to <= from) return false;
  return head(from) - tail(from) < gap || head(to) - tail(to) < gap;
}

/**
 * コメントを1つ置く。置いた高さ(欄の上からのpx)と、流し始める時刻を返し、stateに覚える。
 * @param {DanmakuState} state
 * @param {{ start: number, width: number, height: number, duration: number, areaWidth: number, areaHeight: number,
 *   gap?: number, random?: () => number }} input
 *   startは流し始める時刻、width・heightは字の幅と行の高さ(px)、areaWidth・areaHeightは流す欄の大きさ(px)
 * @returns {{ top: number, start: number, crowded: boolean }} crowdedは、空きがなく無作為に置いたか
 */
export function placeComment(state, { start, width, height, duration, areaWidth, areaHeight, gap = 0, random = Math.random }) {
  // 流れ終わったコメントは忘れる(いま置くコメントより前に終わるもの)。
  state.placed = state.placed.filter((item) => item.start + item.duration > start);
  const room = Math.max(0, areaHeight - height);
  const me = { start, width, duration };
  // ぶつかるかもしれないのは、流れているあいだに近づきすぎるコメントだけ(高さは置く場所を決めてから見る)。
  const near = state.placed.filter((item) => collides(item, me, areaWidth, gap));
  const free = (/** @type {number} */ top) => !near.some((item) => top < item.top + item.height && item.top < top + height);
  // 探す高さ: 無作為の高さ、そこから下のぶつかるコメントのすぐ下、上の端、それより上のぶつかるコメントのすぐ下(回って探す)。
  const from = random() * room;
  const below = near.map((item) => item.top + item.height).filter((top) => top <= room).sort((a, b) => a - b);
  const order = [from, ...below.filter((top) => top > from), 0, ...below.filter((top) => top <= from)];
  let top = order.find(free);
  const crowded = top === undefined;
  if (top === undefined) top = random() * room;
  state.placed.push({ start, width, duration, top, height });
  return { top, start, crowded };
}

/**
 * 字の幅の見積もり(px)。測れないとき(テスト・canvasがない)に使う。全角は1字、半角は0.55字。
 * @param {string} text
 * @param {number} fontPx
 */
export function estimateTextWidth(text, fontPx) {
  let units = 0;
  for (const char of String(text ?? '')) units += /[\u0000-ÿ｡-ﾟ]/.test(char) ? 0.55 : 1;
  return units * fontPx;
}
