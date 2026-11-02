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

// ---- コメントの出し方(docs/tournament-relay-design.mdの50章)
// 画面のコマ数(リフレッシュレート)が少ないと、流れる字は1コマで大きく跳び、ぶれて読みにくい。
// 1コマに動く幅は速さに比例するので、ゆっくり流すか、動かさずに出す。

/**
 * 出し方と、1つのコメントを見せる時間(ミリ秒。速さ×1のとき)。
 * flow: 4秒で流す(ニコニコと同じ)、slow: 8秒で流す(1コマに動く幅が半分。30コマの画面でも60コマで流すのと同じくらい)、
 * still: 動かさずにその場に3秒出す(字は跳ばない)。
 */
export const COMMENT_FLOWS = Object.freeze({
  flow: Object.freeze({ ms: DANMAKU_DURATION_MS, label: '流す', short: '', note: '右から左へ流す（ふつう）' }),
  slow: Object.freeze({ ms: DANMAKU_DURATION_MS * 2, label: 'ゆっくり流す', short: 'ゆっくり', note: '速さを半分にする。字がぶれて読みにくい画面に' }),
  still: Object.freeze({ ms: 3000, label: '止めて出す', short: '止める', note: '動かさずに、その場に3秒出す' }),
});
/** @typedef {keyof typeof COMMENT_FLOWS} CommentFlow */

/** 保存した値を出し方にする(知らない値はふつうの「流す」)。 @returns {CommentFlow} */
export function normalizeCommentFlow(value) {
  return value === 'slow' || value === 'still' ? value : 'flow';
}

/**
 * 1コマの間(ミリ秒)の並びの真ん中の値。少なすぎるときはnull(測れていない)。
 * 重い処理で1コマだけ長くなっても引きずられないよう、平均ではなく真ん中を使う。
 * @param {number[]} intervals
 */
export function medianFrameInterval(intervals) {
  const list = intervals.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (list.length < 20) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

/**
 * 測った1コマの間から、合う出し方を選ぶ。45コマ以上なら流す、22コマ以上ならゆっくり流す、それより少なければ止めて出す。
 * 測れていなければ流す(ふつう)。
 * @param {number | null} interval 1コマの間(ミリ秒)
 * @returns {CommentFlow}
 */
export function flowForFrameInterval(interval) {
  if (!interval) return 'flow';
  if (interval <= 1000 / 45) return 'flow';
  if (interval <= 1000 / 22) return 'slow';
  return 'still';
}

/** @returns {{ placed: { start: number, duration: number, left: number, top: number, width: number, height: number }[] }} */
export function createStillBoard() {
  return { placed: [] };
}

/**
 * 止めて出すコメントの位置を決める(欄の中の左と上、px)。見せているあいだに重なるコメントを避けて、
 * 無作為の位置を何度か試す。空きがなければ最後に試した位置に置く(待たない)。
 * @param {ReturnType<typeof createStillBoard>} state
 * @param {{ start: number, width: number, height: number, duration: number, areaWidth: number, areaHeight: number,
 *   gap?: number, random?: () => number, tries?: number }} input
 * @returns {{ left: number, top: number, crowded: boolean }}
 */
export function placeStill(state, { start, width, height, duration, areaWidth, areaHeight, gap = 0, random = Math.random, tries = 24 }) {
  state.placed = state.placed.filter((item) => item.start + item.duration > start);
  const near = state.placed.filter((item) => item.start < start + duration);
  const roomX = Math.max(0, areaWidth - width);
  const roomY = Math.max(0, areaHeight - height);
  const overlaps = (left, top) => near.some((item) => left < item.left + item.width + gap && item.left < left + width + gap
    && top < item.top + item.height && item.top < top + height);
  let left = 0;
  let top = 0;
  let crowded = true;
  for (let index = 0; index < tries; index += 1) {
    left = random() * roomX;
    top = random() * roomY;
    if (!overlaps(left, top)) {
      crowded = false;
      break;
    }
  }
  state.placed.push({ start, duration, left, top, width, height });
  return { left, top, crowded };
}
