/**
 * 自由対局の中身の記録(docs/home-next-adaptive-design.mdの5章。段階2)。
 * レーティングの対象の自由対局を、終局後に裏で浅く解析し(composables/match/usePlayInsightAnalysis.ts)、
 * 1局ずつの小さな要約にして、直近20局分を残す。見立て(core/play-coach.mjs)が、内容の強さと弱点の練習に使う。
 * 画面に依存しない。
 */
import { buildGuidedReview } from './guided-review.mjs';
import { REVIEW_LINE_MAX_PLIES, reviewProblemId } from './review-problems.mjs';
import { levelForAverageLoss } from './skill-estimate.mjs';
import { contentEstimate, contentEvents } from './play-content.mjs';
import { levelRating } from './player-rating.mjs';
import { detectTesujiShape } from './tesuji-shape.mjs';
import { exchangeGain } from './exchange-eval.mjs';
import { applyUsiToBoard, opponentOf, parseSfenState } from './piece-movement.mjs';

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

/**
 * @returns {{ games: any[], queue: any[], practice: { kind: string, games: number, via?: { [kind: string]: string } } | null }}
 */
export function createPlayInsight() {
  return { games: [], queue: [], practice: null };
}

const isColor = (value) => value === 'black' || value === 'white';
const isOutcome = (value) => value === 'win' || value === 'loss' || value === 'draw';
const finite = (value) => Number.isFinite(value);

function validPhase(phase) {
  return phase && finite(phase.n) && finite(phase.sum) && finite(phase.big);
}

/** 能力の分析の集計の軸(my-abilities.mjs)。損の軸は{ n, sum }、割合の軸は{ n, hit }。 */
export const LOSS_AXES = Object.freeze(['opening', 'middle', 'ending', 'attack', 'defense']);
export const RATE_AXES = Object.freeze(['reading', 'stability', 'mate', 'vision', 'idea']);
/**
 * 2026-10-30に足した割合の軸(docs/player-abilities-design.mdの13-7)。前の要約にはないので、なくても正しい要約とする。
 * - vision: 視野。測れた手のうち、駒をタダで取られる形にした・タダの駒を取り逃した(どちらも損300以上)手の割合
 * - idea: 発想。最善手が名前の付いた手筋の形か捨て駒の局面で、その手を指した割合
 */
export const LATER_RATE_AXES = Object.freeze(['vision', 'idea']);
/** 優勢・劣勢とみなす形勢(攻め・受けの軸)。 */
const AXIS_STANDING = 300;
/** 発想の軸で、捨て駒とみなす、動かした駒を取られて失う駒の損(取り合いの計算。金1枚くらいより大きい)。 */
const SACRIFICE_GAIN = 300;

function validAxes(axes) {
  return axes && typeof axes === 'object'
    && LOSS_AXES.every((key) => finite(axes[key]?.n) && finite(axes[key]?.sum))
    && RATE_AXES.every((key) => (LATER_RATE_AXES.includes(key) && axes[key] === undefined)
      || (finite(axes[key]?.n) && finite(axes[key]?.hit)));
}

/**
 * 発想の軸で数える最善手か: 名前の付いた手筋の形(tesuji-shape.mjs)か、動かした駒を取られて駒を失う捨て駒。
 * @param {string} sfen 指す前の局面
 * @param {string} usi
 */
export function isInventiveMove(sfen, usi) {
  if (!sfen || !usi) return false;
  try {
    if (detectTesujiShape({ sfenBefore: sfen, usi })) return true;
    const { board, turn } = parseSfenState(sfen);
    const applied = applyUsiToBoard(board, usi, turn);
    if (!applied) return false;
    return exchangeGain(applied.board, applied.moved.to, opponentOf(turn), { mode: 'full' }).gain >= SACRIFICE_GAIN;
  } catch {
    return false;
  }
}

function validSummary(summary) {
  return summary && finite(summary.moves) && finite(summary.sum) && finite(summary.big) && finite(summary.freeLosses)
    && (summary.axes === undefined || validAxes(summary.axes))
    && PHASES.every(({ key }) => validPhase(summary.phases?.[key]))
    && Array.isArray(summary.mates) && summary.mates.every((mate) => typeof mate?.sfen === 'string' && Number.isInteger(mate.length)
      && (mate.line === undefined || (Array.isArray(mate.line) && mate.line.every((usi) => typeof usi === 'string'))))
    && (summary.standing30 === null || finite(summary.standing30))
    && (summary.content === undefined || summary.content === null || (finite(summary.content.level) && finite(summary.content.spread)));
}

function validGame(game) {
  return game && finite(game.at) && finite(game.level) && isOutcome(game.outcome) && isColor(game.color)
    && (game.event === undefined || typeof game.event === 'string')
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
      practice: practice && typeof practice.kind === 'string' && finite(practice.games)
        ? { kind: practice.kind, games: practice.games, via: validVia(practice.via) }
        : null,
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

/**
 * ほかで解析した対局(竜王戦の統計の裏の解析)の要約を、そのまま記録に足す。同じ時刻の記録は置き換える。
 * eventは棋戦('ryuo'など)。自由対局は省く。
 * @param {ReturnType<typeof createPlayInsight>} insight
 * @param {{ at: number, level: number, outcome: string, color: string, event?: string, summary: ReturnType<typeof summarizePlayInsight> | null }} game
 */
export function addAnalyzedGame(insight, { at, level, outcome, color, event, summary }) {
  const game = { at, level, outcome, color, summary, ...(event ? { event } : {}) };
  if (!validGame(game)) return insight;
  return {
    ...insight,
    games: [...insight.games.filter((entry) => entry.at !== at), game].sort((a, b) => a.at - b.at).slice(-MAX_INSIGHT_GAMES),
  };
}

const PRACTICE_VIA = new Set(['tutorial', 'problems', 'play']);
/** 弱点ごとの、前に行った練習の先(教室・問題集・今までの練習)。読めない値は捨てる。 */
function validVia(via) {
  if (!via || typeof via !== 'object') return {};
  return Object.fromEntries(Object.entries(via).filter(([, value]) => PRACTICE_VIA.has(value)));
}

/**
 * 弱点の練習を始めたことを残す(練習は対局2局に1回まで、同じ弱点を続けない)。gamesは、そのときのレーティングの対局数。
 * viaは練習の行き先(docs/first-play-design.mdの6-1)。弱点ごとに前の行き先を残し、教室の章を終えたあとの問題集と今までの練習を交互にする。
 * @param {ReturnType<typeof createPlayInsight>} insight
 * @param {{ kind: string, games: number, via?: string }} practice
 */
export function recordPractice(insight, { kind, games, via }) {
  const before = insight.practice?.via ?? {};
  return { ...insight, practice: { kind, games, via: via && PRACTICE_VIA.has(via) ? { ...before, [kind]: via } : before } };
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
 * - mates: 逃した詰み(詰ませる側の手番の局面と手数と、解析の読み筋line)。15手詰めまで。2026-10-27より前の要約は3手以内で、lineがない
 * - freeLosses: 駒をタダで取られる形にして、大きく損をした手の数
 * - standing30: 30手目の形勢(自分から見た評価値)。30手に届かなければnull
 * - axes: 能力の分析(my-abilities.mjs)のための集計。損は同じ読みの中の差(measureLoss。棋力測定と同じ)。
 *   序盤・中盤・終盤・攻め(優勢のとき)・受け(劣勢のとき)の損、読み(最善手を指した割合)、安定感(損300以上の割合)、
 *   詰み(詰みが見えている局面で、詰みを逃さなかった割合)。2026-10-25より前の要約にはない。
 *   視野・発想(LATER_RATE_AXES)は2026-10-30より前の要約にはない
 * - content: 場面採点(play-content.mjs)の、1局の中身の強さ(Lv)と幅と、場面ごとの数。場面が少なければnull。
 *   棋力カルテ(skill-profile.mjs)の材料。2026-10-27より前の要約にはない
 * @param {{ points: any[], sfens: string[], moves: string[], color: 'black' | 'white', initialSfen: string }} game
 */
export function summarizePlayInsight({ points, sfens, moves, color, initialSfen }) {
  const phases = Object.fromEntries(PHASES.map(({ key }) => [key, { n: 0, sum: 0, big: 0 }]));
  let measured = 0;
  let sum = 0;
  let big = 0;
  const lossAt = new Map();
  const axes = {
    ...Object.fromEntries(LOSS_AXES.map((key) => [key, { n: 0, sum: 0 }])),
    ...Object.fromEntries(RATE_AXES.map((key) => [key, { n: 0, hit: 0 }])),
  };
  const byPly = new Map(points.map((point) => [point.ply, point]));
  /** 測れた手(形勢が決まっていない)の、能力の分析の損。視野の軸で、見落としを数える手を決める。 */
  const axisLossAt = new Map();
  for (const point of points) {
    const measure = point.moveMeasure;
    if (!measure || measure.mover !== color) continue;
    lossAt.set(point.ply, measure.loss);
    // 詰みが見えている局面(着手前の読みで自分の詰み)で、詰みを逃さずに指したか(ryuo-stats.mjsと同じ見方)。
    if (isMateFor(byPly.get(point.ply - 1)?.score, color)) {
      axes.mate.n += 1;
      if (isMateFor(point.score, color) || point.score?.value === 0) axes.mate.hit += 1;
    }
    if (Math.abs(measure.standing) >= DECIDED_STANDING) continue;
    const axisLoss = Math.min(LOSS_CAP, measure.measureLoss ?? measure.loss);
    const phaseKey = PHASES.find(({ until }) => point.ply <= until).key;
    for (const key of [phaseKey, ...(measure.standing >= AXIS_STANDING ? ['attack'] : []), ...(measure.standing <= -AXIS_STANDING ? ['defense'] : [])]) {
      axes[key].n += 1;
      axes[key].sum += axisLoss;
    }
    axes.reading.n += 1;
    axes.reading.hit += axisLoss === 0 ? 1 : 0;
    axes.stability.n += 1;
    axes.stability.hit += axisLoss >= BIG_LOSS ? 1 : 0;
    axisLossAt.set(point.ply, axisLoss);
    // 発想: 最善手が手筋の形か捨て駒の局面で、それを指したか。
    const best = byPly.get(point.ply - 1)?.bestMove;
    if (best && isInventiveMove(sfens[point.ply - 1], best)) {
      axes.idea.n += 1;
      axes.idea.hit += moves[point.ply - 1] === best || axisLoss === 0 ? 1 : 0;
    }
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
  const pvAt = new Map(points.map((point) => [point.ply, point.pv]));
  let freeLosses = 0;
  for (const moment of moments) {
    if (moment.mover !== color) continue;
    if (moment.missedMate > 0 && moment.missedMate <= REVIEW_LINE_MAX_PLIES && sfens[moment.ply - 1]) {
      // 指す前の局面の読み筋が、詰みまでの手順(review-problems.mjsが確かめて答えにする)。
      const pv = pvAt.get(moment.ply - 1);
      const line = Array.isArray(pv) ? pv.slice(0, moment.missedMate).map(String) : [];
      mates.push({ sfen: sfens[moment.ply - 1], length: moment.missedMate, ...(line.length ? { line } : {}) });
    }
    if (moment.leftFree && (lossAt.get(moment.ply) ?? 0) >= BIG_LOSS) freeLosses += 1;
    // 視野: 駒をタダで取られる形にした・タダの駒を取り逃した手(損300以上)。
    if ((moment.leftFree || moment.missedFree) && (axisLossAt.get(moment.ply) ?? 0) >= BIG_LOSS) axes.vision.hit += 1;
  }
  axes.vision.n = axes.reading.n;
  const at30 = points.find((point) => point.ply === OPENING_CHECK_PLY);
  return {
    moves: measured,
    sum: Math.round(sum),
    big,
    phases: Object.fromEntries(Object.entries(phases).map(([key, phase]) => [key, { ...phase, sum: Math.round(phase.sum) }])),
    mates,
    freeLosses,
    standing30: at30 ? standingFor(at30.score, color) : null,
    content: contentEstimate(contentEvents({ points, sfens, moves, color })),
    axes: Object.fromEntries(Object.entries(axes).map(([key, axis]) => [key, 'sum' in axis ? { ...axis, sum: Math.round(axis.sum) } : axis])),
  };
}

/** 詰みの評価が、その色の勝ち(詰ませる側)か。 */
function isMateFor(score, color) {
  return score?.type === 'mate' && (color === 'black' ? score.value > 0 : score.value < 0);
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
  return levelRating(levelForAverageLoss(mean));
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
/** 弱点として数える、逃した詰みの手数の上限(問題集の詰将棋の手数と同じ)。 */
const WEAKNESS_MATE_MAX_PLIES = 7;
/** 終盤・序盤の弱点を見る、その局面の測れた手の数の下限。 */
const PHASE_MIN_MOVES = 3;

/**
 * 直近3局の要約から、目立つ弱点を、優先の順にすべて返す(4-1)。解析できた対局がなければ空。
 * - mate: 7手以内の詰みを1回以上逃した。problemIdとpliesは、いちばん新しい局面の問題のID(review-problems.mjs)と詰みの手数。
 *   それより長い詰みは「あなたの対局から」の問題にはするが、弱点としては数えない
 * - ending: 終盤の平均損失が、序盤・中盤の2倍以上で、終盤に大きな悪手がある
 * - free: 1局あたり、タダで取られて大きく損をした手が2回以上
 * - opening: 序盤の平均損失が中盤・終盤より大きく、30手目の形勢が−300以下(3局の平均)
 * @param {ReturnType<typeof createPlayInsight>['games']} games
 * @returns {{ kind: string, count: number, problemId?: string, plies?: number }[]}
 */
export function detectWeaknesses(games) {
  const recent = analyzed(games).slice(-WEAKNESS_GAMES);
  if (!recent.length) return [];
  const found = [];
  const mates = recent.flatMap((game) => game.summary.mates).filter((mate) => mate.length <= WEAKNESS_MATE_MAX_PLIES);
  if (mates.length) {
    const latest = mates.at(-1);
    found.push({ kind: 'mate', count: mates.length, problemId: reviewProblemId(latest.sfen), ...(finite(latest.length) ? { plies: latest.length } : {}) });
  }

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
