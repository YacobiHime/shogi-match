/**
 * 自由対局の中身の記録(docs/home-next-adaptive-design.mdの5章。段階2)。
 * レーティングの対象の自由対局を、終局後に裏で浅く解析し(composables/match/usePlayInsightAnalysis.ts)、
 * 1局ずつの小さな要約にして、直近20局分を残す。見立て(core/play-coach.mjs)が、内容の強さと弱点の練習に使う。
 * 画面に依存しない。
 */
import { buildGuidedReview } from './guided-review.mjs';
import { REVIEW_PROBLEM_MAX_PLIES, reviewProblemId } from './review-problems.mjs';
import { levelForAverageLoss } from './skill-estimate.mjs';

export const PLAY_INSIGHT_KEY = 'yacobihime:shogi-match:play-insight:v1';
/** 覚えておく対局の数。 */
export const MAX_INSIGHT_GAMES = 20;
/** 解析を待つ対局の数の上限(解析できない環境で溜まり続けないように)。 */
const MAX_QUEUE = 5;
/** 1手の損失の上限と、損を測らない形勢(ryuo-stats.mjs・skill-estimate.mjsと同じ)。 */
const LOSS_CAP = 1000;
const DECIDED_STANDING = 1500;
/** 大きな悪手とみなす損。 */
export const BIG_LOSS = 300;
const PHASES = Object.freeze([
  { key: 'opening', until: 30 },
  { key: 'middle', until: 80 },
  { key: 'ending', until: Infinity },
]);
/** 30手目の形勢を見る手数。 */
const OPENING_CHECK_PLY = 30;
const MATE_STANDING = 3000;

/** 内容の強さを使い始める、測れる手の数(最近の対局から合わせて)。 */
export const CONTENT_MIN_MOVES = 40;
/** 内容の強さを見る対局の数。 */
export const CONTENT_GAMES = 10;
/** 弱点を見る対局の数。 */
export const WEAKNESS_GAMES = 3;

export function createPlayInsight() {
  return { games: [], queue: [], practice: null };
}

const isColor = (value) => value === 'black' || value === 'white';
const isOutcome = (value) => value === 'win' || value === 'loss' || value === 'draw';
const finite = (value) => Number.isFinite(value);

function validPhase(phase) {
  return phase && finite(phase.n) && finite(phase.sum) && finite(phase.big);
}

function validSummary(summary) {
  return summary && finite(summary.moves) && finite(summary.sum) && finite(summary.big) && finite(summary.freeLosses)
    && PHASES.every(({ key }) => validPhase(summary.phases?.[key]))
    && Array.isArray(summary.mates) && summary.mates.every((mate) => typeof mate?.sfen === 'string' && Number.isInteger(mate.length))
    && (summary.standing30 === null || finite(summary.standing30));
}

function validGame(game) {
  return game && finite(game.at) && finite(game.level) && isOutcome(game.outcome) && isColor(game.color)
    && (game.summary === null || validSummary(game.summary));
}

function validJob(job) {
  return job && finite(job.at) && finite(job.level) && isOutcome(job.outcome) && isColor(job.color)
    && Array.isArray(job.moves) && job.moves.every((move) => typeof move === 'string');
}

/** 保存から読む。読めない値は捨てる。 */
export function loadPlayInsight(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PLAY_INSIGHT_KEY) ?? 'null');
    const practice = parsed?.practice;
    return {
      games: (Array.isArray(parsed?.games) ? parsed.games : []).filter(validGame).slice(-MAX_INSIGHT_GAMES),
      queue: (Array.isArray(parsed?.queue) ? parsed.queue : []).filter(validJob).slice(-MAX_QUEUE),
      practice: practice && typeof practice.kind === 'string' && finite(practice.games) ? { kind: practice.kind, games: practice.games } : null,
    };
  } catch {
    return createPlayInsight();
  }
}

export function savePlayInsight(storage, insight) {
  try {
    storage?.setItem(PLAY_INSIGHT_KEY, JSON.stringify(insight));
  } catch {
    // 保存できない環境では、結果だけで見立てる。
  }
}

/**
 * 終えた対局を、解析を待つ列に足す。
 * @param {ReturnType<typeof createPlayInsight>} insight
 * @param {{ moves: string[], color: 'black' | 'white', outcome: 'win' | 'loss' | 'draw', level: number, at?: number }} game
 */
export function enqueuePlayInsight(insight, { moves, color, outcome, level, at = Date.now() }) {
  return { ...insight, queue: [...insight.queue, { at, moves: [...moves], color, outcome, level }].slice(-MAX_QUEUE) };
}

/**
 * 解析した対局の要約を記録に足し、列から外す。summaryがnull(解析できなかった)でも、勝ち負けは残す。
 * @param {ReturnType<typeof createPlayInsight>} insight
 * @param {{ at: number, level: number, outcome: string, color: string }} job
 * @param {ReturnType<typeof summarizePlayInsight> | null} summary
 */
export function completePlayInsight(insight, job, summary) {
  const game = { at: job.at, level: job.level, outcome: job.outcome, color: job.color, summary };
  return {
    ...insight,
    games: [...insight.games.filter((entry) => entry.at !== job.at), game].sort((a, b) => a.at - b.at).slice(-MAX_INSIGHT_GAMES),
    queue: insight.queue.filter((entry) => entry.at !== job.at),
  };
}

/** 弱点の練習を始めたことを残す(練習は対局2局に1回まで、同じ弱点を続けない)。gamesは、そのときのレーティングの対局数。 */
export function recordPractice(insight, { kind, games }) {
  return { ...insight, practice: { kind, games } };
}

/** 評価値(先手から見た値)を、colorの側から見た値に。詰みは±3000。 */
function standingFor(score, color) {
  if (!score || !finite(score.value)) return null;
  const sign = color === 'black' ? 1 : -1;
  if (score.type === 'mate') return score.value === 0 ? 0 : Math.sign(score.value) * sign * MATE_STANDING;
  return score.value * sign;
}

/**
 * 1局の要約。pointsは棋譜解析の点(kifu-analysis-pipeline.mjsのanalysisPointsFromResults)、sfensは0手目からの局面。
 * - moves・sum・big: 測れた手の数、損の合計(1手1000まで)、大きな悪手(損300以上)の数
 * - phases: 序盤(30手まで)・中盤(80手まで)・終盤の、測れた手の数・損の合計・大きな悪手の数
 * - mates: 逃した3手以内の詰み(詰ませる側の手番の局面と手数)
 * - freeLosses: 駒をタダで取られる形にして、大きく損をした手の数
 * - standing30: 30手目の形勢(自分から見た評価値)。30手に届かなければnull
 * @param {{ points: any[], sfens: string[], moves: string[], color: 'black' | 'white', initialSfen: string }} game
 */
export function summarizePlayInsight({ points, sfens, moves, color, initialSfen }) {
  const phases = Object.fromEntries(PHASES.map(({ key }) => [key, { n: 0, sum: 0, big: 0 }]));
  let measured = 0;
  let sum = 0;
  let big = 0;
  const lossAt = new Map();
  for (const point of points) {
    const measure = point.moveMeasure;
    if (!measure || measure.mover !== color) continue;
    lossAt.set(point.ply, measure.loss);
    if (Math.abs(measure.standing) >= DECIDED_STANDING) continue;
    const loss = Math.min(LOSS_CAP, measure.loss);
    const isBig = measure.loss >= BIG_LOSS ? 1 : 0;
    measured += 1;
    sum += loss;
    big += isBig;
    const phase = phases[PHASES.find(({ until }) => point.ply <= until).key];
    phase.n += 1;
    phase.sum += loss;
    phase.big += isBig;
  }
  const { moments = [] } = buildGuidedReview(points, { playerColor: color, moves, initialSfen, quizLimit: 0 });
  const mates = [];
  let freeLosses = 0;
  for (const moment of moments) {
    if (moment.mover !== color) continue;
    if (moment.missedMate > 0 && moment.missedMate <= REVIEW_PROBLEM_MAX_PLIES && sfens[moment.ply - 1]) {
      mates.push({ sfen: sfens[moment.ply - 1], length: moment.missedMate });
    }
    if (moment.leftFree && (lossAt.get(moment.ply) ?? 0) >= BIG_LOSS) freeLosses += 1;
  }
  const at30 = points.find((point) => point.ply === OPENING_CHECK_PLY);
  return {
    moves: measured,
    sum: Math.round(sum),
    big,
    phases: Object.fromEntries(Object.entries(phases).map(([key, phase]) => [key, { ...phase, sum: Math.round(phase.sum) }])),
    mates,
    freeLosses,
    standing30: at30 ? standingFor(at30.score, color) : null,
  };
}

const analyzed = (games) => games.filter((game) => game.summary);

/**
 * 内容の強さ(R内容)。最近10局の、測れた手の平均損失を、棋力診断(skill-estimate.mjs)と同じ換算でレーティングにする。
 * 測れた手が合わせて40手に満たなければnull。
 * @param {ReturnType<typeof createPlayInsight>['games']} games
 */
export function contentStrength(games) {
  const recent = analyzed(games).slice(-CONTENT_GAMES);
  const moves = recent.reduce((total, game) => total + game.summary.moves, 0);
  if (moves < CONTENT_MIN_MOVES) return null;
  const mean = recent.reduce((total, game) => total + game.summary.sum, 0) / moves;
  return Math.round(levelForAverageLoss(mean) * 80);
}

const average = (phase) => (phase.n ? phase.sum / phase.n : 0);
function mergedPhase(games, key) {
  return games.reduce((total, game) => ({
    n: total.n + game.summary.phases[key].n,
    sum: total.sum + game.summary.phases[key].sum,
    big: total.big + game.summary.phases[key].big,
  }), { n: 0, sum: 0, big: 0 });
}

/** 弱点の種類。上ほど優先(4-1の表の順)。 */
export const WEAKNESS_KINDS = Object.freeze(['mate', 'ending', 'free', 'opening']);
/** 終盤・序盤の弱点を見る、その局面の測れた手の数の下限。 */
const PHASE_MIN_MOVES = 3;

/**
 * 直近3局の要約から、目立つ弱点を、優先の順にすべて返す(4-1)。解析できた対局がなければ空。
 * - mate: 3手以内の詰みを1回以上逃した。problemIdは、いちばん新しい局面の問題のID(review-problems.mjs)
 * - ending: 終盤の平均損失が、序盤・中盤の2倍以上で、終盤に大きな悪手がある
 * - free: 1局あたり、タダで取られて大きく損をした手が2回以上
 * - opening: 序盤の平均損失が中盤・終盤より大きく、30手目の形勢が−300以下(3局の平均)
 * @param {ReturnType<typeof createPlayInsight>['games']} games
 * @returns {{ kind: string, count: number, problemId?: string }[]}
 */
export function detectWeaknesses(games) {
  const recent = analyzed(games).slice(-WEAKNESS_GAMES);
  if (!recent.length) return [];
  const found = [];
  const mates = recent.flatMap((game) => game.summary.mates);
  if (mates.length) found.push({ kind: 'mate', count: mates.length, problemId: reviewProblemId(mates.at(-1).sfen) });

  const opening = mergedPhase(recent, 'opening');
  const middle = mergedPhase(recent, 'middle');
  const ending = mergedPhase(recent, 'ending');
  const before = { n: opening.n + middle.n, sum: opening.sum + middle.sum };
  if (ending.n >= PHASE_MIN_MOVES && before.n && ending.big > 0 && average(ending) >= 2 * Math.max(1, average(before))) {
    found.push({ kind: 'ending', count: ending.big });
  }

  const freeLosses = recent.reduce((total, game) => total + game.summary.freeLosses, 0);
  if (freeLosses >= 2 * recent.length) found.push({ kind: 'free', count: freeLosses });

  const standings = recent.map((game) => game.summary.standing30).filter(finite);
  const standing = standings.length ? standings.reduce((total, value) => total + value, 0) / standings.length : null;
  if (opening.n >= PHASE_MIN_MOVES && standing !== null && standing <= -300
    && average(opening) > average(middle) && average(opening) > average(ending)) {
    found.push({ kind: 'opening', count: 1 });
  }
  return found;
}
