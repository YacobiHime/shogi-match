// 流れるコメントの段の選び方(docs/tournament-relay-design.mdの33章)。ニコニコ動画と同じく、
// コメントは右の端から左の端の外まで、決まった時間で流れる(長い字ほど速い)。同じ段の前のコメントに、
// 入る時にも、流れているあいだにも追いつかない段を、上から選ぶ。どの段も空いていなければ、少しだけ待ってから流す。
// それでも空かなければ、重なりのいちばん少ない段にする。画面に依存しない(時間と幅はミリ秒とpxで受け取る)。

/** 前のコメントとのあいだに空ける幅(字の大きさに対する倍率)。 */
export const DANMAKU_GAP_EM = 1.2;
/** 空いた段がないとき、流し始めを遅らせてよい時間(ミリ秒)と、探す刻み。 */
export const DANMAKU_MAX_WAIT_MS = 1600;
const WAIT_STEP_MS = 100;

/**
 * @typedef {{ start: number, width: number, duration: number, lane: number, span: number }} Placed
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
 * コメントを1つ置く。置いた段と、流し始める時刻を返し、stateに覚える。
 * @param {DanmakuState} state
 * @param {{ start: number, width: number, duration: number, areaWidth: number, laneCount: number,
 *   span?: number, gap?: number, maxWait?: number }} input
 *   startは流し始めたい時刻、widthは字の幅(px)、spanは大きな字が使う段の数
 * @returns {{ lane: number, start: number }}
 */
export function placeComment(state, { start, width, duration, areaWidth, laneCount, span = 1, gap = 0, maxWait = DANMAKU_MAX_WAIT_MS }) {
  // 流れ終わったコメントは忘れる(いま置くコメントより前に終わるもの)。
  state.placed = state.placed.filter((item) => item.start + item.duration > start);
  const lanes = Math.max(1, Math.trunc(laneCount));
  const size = Math.min(Math.max(1, Math.trunc(span)), lanes);
  const top = lanes - size;
  const blockers = (lane, at) => state.placed.filter((item) => (
    item.lane < lane + size && lane < item.lane + item.span
    && collides(item, { start: at, width, duration }, areaWidth, gap)
  )).length;
  let choice = null;
  for (let wait = 0; wait <= maxWait && !choice; wait += WAIT_STEP_MS) {
    for (let lane = 0; lane <= top; lane += 1) {
      if (!blockers(lane, start + wait)) {
        choice = { lane, start: start + wait };
        break;
      }
    }
  }
  if (!choice) {
    // どの段もふさがっている(コメントがとても多い)。待たずに、重なるコメントのいちばん少ない段へ。
    let best = 0;
    let fewest = Infinity;
    for (let lane = 0; lane <= top; lane += 1) {
      const count = blockers(lane, start);
      if (count < fewest) [best, fewest] = [lane, count];
    }
    choice = { lane: best, start };
  }
  state.placed.push({ start: choice.start, width, duration, lane: choice.lane, span: size });
  return choice;
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
