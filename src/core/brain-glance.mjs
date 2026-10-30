// 脳トレ「ちらっと盤」(docs/brain-training-design.mdの3-1)。見る速さの練習(UFOV型)の問題の作り方と採点。
// 盤が一瞬だけ出て隠れる。真ん中の駒(金か銀か)と、まわりに出た玉の方向(8方向)を答える。画面に依存しない。

import { createRng, pick } from './ryuo-random.mjs';

/**
 * 段ごとの見せる時間(ミリ秒)と、じゃまの駒(歩)の数。段が上がるほど短く、後半はじゃまの駒が増える
 * (UFOVの3段目と同じく、まわりを散らかして難しくする)。
 */
export const GLANCE_LEVELS = Object.freeze([
  { ms: 800, distractors: 0 },
  { ms: 600, distractors: 0 },
  { ms: 450, distractors: 0 },
  { ms: 350, distractors: 0 },
  { ms: 270, distractors: 0 },
  { ms: 200, distractors: 0 },
  { ms: 150, distractors: 0 },
  { ms: 120, distractors: 0 },
  { ms: 100, distractors: 0 },
  { ms: 150, distractors: 4 },
  { ms: 120, distractors: 4 },
  { ms: 100, distractors: 4 },
  { ms: 80, distractors: 4 },
  { ms: 65, distractors: 8 },
  { ms: 50, distractors: 8 },
]);
export const GLANCE_MAX_LEVEL = GLANCE_LEVELS.length - 1;
/** 「見て」の合図と、隠す模様(マスク)の時間。 */
export const GLANCE_READY_MS = 500;
export const GLANCE_MASK_MS = 300;

/** 真ん中のマス(5五)と、玉が出る8方向(真ん中から4マス)。名前は盤を手前から見た向き。 */
export const GLANCE_CENTER = '5e';
export const GLANCE_DIRECTIONS = Object.freeze([
  { id: 'up-left', label: '左上', dx: 4, dy: -4 },
  { id: 'up', label: '上', dx: 0, dy: -4 },
  { id: 'up-right', label: '右上', dx: -4, dy: -4 },
  { id: 'left', label: '左', dx: 4, dy: 0 },
  { id: 'right', label: '右', dx: -4, dy: 0 },
  { id: 'down-left', label: '左下', dx: 4, dy: 4 },
  { id: 'down', label: '下', dx: 0, dy: 4 },
  { id: 'down-right', label: '右下', dx: -4, dy: 4 },
]);
export const GLANCE_CENTER_PIECES = Object.freeze([
  { id: 'G', label: '金' },
  { id: 'S', label: '銀' },
]);

/** USIのマス('5e')と筋・段(1〜9)の行き来。筋は大きいほど盤の左。 */
export function squareOf(file, rank) {
  return file >= 1 && file <= 9 && rank >= 1 && rank <= 9 ? `${file}${String.fromCharCode(96 + rank)}` : null;
}
export function fileRankOf(square) {
  return { file: Number(square[0]), rank: square.charCodeAt(1) - 96 };
}

export function glanceLevel(level) {
  return GLANCE_LEVELS[Math.max(0, Math.min(GLANCE_MAX_LEVEL, Math.floor(level)))];
}

/**
 * 1問を作る。同じ種と段なら同じ問題。
 * @param {number} seed
 * @param {number} level
 * @returns {{ center: 'G' | 'S', direction: string, king: string, distractors: string[], ms: number, level: number }}
 */
export function glanceProblem(seed, level) {
  const rng = createRng(seed);
  const { ms, distractors: count } = glanceLevel(level);
  const center = pick(rng, GLANCE_CENTER_PIECES).id;
  const direction = pick(rng, GLANCE_DIRECTIONS);
  const { file, rank } = fileRankOf(GLANCE_CENTER);
  const king = squareOf(file + direction.dx, rank + direction.dy);
  const taken = new Set([GLANCE_CENTER, king]);
  const distractors = [];
  // じゃまの駒は、真ん中のまわり1マスにはおかない(真ん中の駒が見えにくくなるだけで、練習にならないため)。
  const free = [];
  for (let f = 1; f <= 9; f += 1) {
    for (let r = 1; r <= 9; r += 1) {
      const square = squareOf(f, r);
      if (taken.has(square) || (Math.abs(f - file) <= 1 && Math.abs(r - rank) <= 1)) continue;
      free.push(square);
    }
  }
  while (distractors.length < count && free.length) {
    const index = Math.floor(rng.next() * free.length);
    distractors.push(free.splice(index, 1)[0]);
  }
  return { center, direction: direction.id, king, distractors, ms, level: Math.max(0, Math.min(GLANCE_MAX_LEVEL, Math.floor(level))) };
}

/** 答えの採点。両方合えば正解。 */
export function scoreGlance(problem, answer) {
  const centerOk = answer.center === problem.center;
  const directionOk = answer.direction === problem.direction;
  return { centerOk, directionOk, correct: centerOk && directionOk };
}

/**
 * 実際に盤が出ていた時間が、約束した時間として数えてよいか。画面の更新の間隔(約17ms)より短くは出せないので、
 * 1コマ分の誤差は認め、それより長く(または短く)出ていたら数えない。
 */
export function glanceTimingValid(targetMs, shownMs, frameMs = 17) {
  if (!Number.isFinite(shownMs)) return false;
  return shownMs <= targetMs + frameMs * 1.5 && shownMs >= targetMs - frameMs * 1.5;
}

/** 記録の見せ方。「0.12秒」、じゃまの駒があれば「（じゃま駒4枚）」を添える。 */
export function glanceLevelLabel(level) {
  const { ms, distractors } = glanceLevel(level);
  const seconds = `${(ms / 1000).toFixed(ms >= 100 ? 2 : 3).replace(/0$/, '')}秒`;
  return distractors ? `${seconds}（じゃま駒${distractors}枚）` : seconds;
}

/**
 * 1回のまとめ。記録はその回に「2問続けて正解した」いちばん上の段(段に上がれたら、その前の段は見えていた)。
 * 1度も続けて正解できなければ、始めた段より1つ下(0より下はない)を記録にせず、valueは0。
 * @param {{ level: number, correct: boolean, counted: boolean }[]} trials
 */
export function glanceSummary(trials) {
  let best = -1;
  let streak = 0;
  for (const trial of trials) {
    if (!trial.counted) continue;
    if (trial.correct) {
      streak += 1;
      if (streak >= 2) best = Math.max(best, trial.level);
    } else {
      streak = 0;
    }
  }
  const counted = trials.filter((trial) => trial.counted);
  return {
    bestLevel: best,
    correct: counted.filter((trial) => trial.correct).length,
    total: counted.length,
    // 記録(大きいほど良い)は段+1。0は「まだ記録なし」。
    value: best + 1,
  };
}
