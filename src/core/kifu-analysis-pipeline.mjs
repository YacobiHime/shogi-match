import {
  analyzedMoveLoss,
  classifyAnalyzedMove,
  formatAnalysisScore,
  scoreForBlack,
  scoreToGraphValue,
} from "./kifu-analysis.mjs";
import { GOD_MOVE_SACRIFICE_MIN_WINRATE_GAP, capGodMoves, judgeGodMove, moveContext, winRate } from "./god-move.mjs";

/**
 * 棋譜解析を3段階で行う。対局後の振り返りと、図鑑の代表局の解析で共通に使う。
 * 1. scan: 全局面をMultiPV 2で軽く読む。終局側から逆順に読み、置換表を前の局面へ引き継ぐ。
 * 2. review: 怪しい手(損が大きい手、詰みが絡む手)と、次善手との差が大きい最善手の前後を読み直す。
 * 3. focus: 神の一手の候補と大きな悪手の前後を、さらに深く読む。
 * 神の一手の「浅い読みでは見えない」の判定には、対局中の褒め言葉と同じ浅い読み(shallow)を使う。
 * 浅い読みは、次善手との差が神の一手になりうる局面だけで行う。深い読みの結果が置換表に残っていると
 * 浅い読みでも良い手が見えてしまうため、浅い読みでは置換表を消して(fresh)から読ませる。
 *
 * 局面ごとに、探索量の違う読み(reads)をすべて残す。グラフには最も深い読みを使い、
 * 指し手の損は、前後の局面に共通する最も深い探索量の読みどうしで比べる(深さの違う評価値を比べない)。
 *
 * lanesは探索関数の配列。1つの関数が1つのエンジンを使い、関数ごとに同時に1局面ずつ読む。
 * 探索関数は(sfen, { nodes, multiPv, maxTimeMs, fresh }, ply)を受け取り、{ candidates }を返す。
 * freshが真なら、置換表を消してから読む(USIのusinewgame)。
 * plyは局面の手数。千日手の判定に初期局面からの手順が要るエンジンでは、plyから手順を作って読ませる。
 * 評価値は手番側から見た値(USIのscoreのまま)。
 */

/**
 * 段階ごとの探索量。nodesは1局面あたり。maxTimeMsは遅い端末で止まらないための上限。
 * scanはMultiPV 2で読み、最善手を指した局面の次善手との差を見積もる。
 * reviewでは、損がlossThreshold以上の手と、次善手との差が勝率でgapThresholdポイント以上ある最善手を読み直す。
 * focusでは、神の一手の候補をgodLimit手、悪手以上をbadLimit手まで深く読む。
 */
export const STAGED_ANALYSIS_PLANS = Object.freeze({
  desktop: Object.freeze({
    scan: { nodes: 20000, maxTimeMs: 1500, multiPv: 2 },
    review: { nodes: 80000, maxTimeMs: 3000, lossThreshold: 80, gapThreshold: 4 },
    focus: { nodes: 500000, maxTimeMs: 8000, godLimit: 3, badLimit: 2 },
    shallow: { nodes: 1200, maxTimeMs: 150, multiPv: 3, fresh: true },
  }),
  // スマホは同時に読めるエンジンが1〜2つなので、読み直しを損の大きい手に絞る。
  mobile: Object.freeze({
    scan: { nodes: 6000, maxTimeMs: 1000, multiPv: 2 },
    review: { nodes: 15000, maxTimeMs: 2000, lossThreshold: 150, gapThreshold: 6 },
    focus: { nodes: 150000, maxTimeMs: 6000, godLimit: 2, badLimit: 1 },
    shallow: { nodes: 600, maxTimeMs: 100, multiPv: 3, fresh: true },
  }),
});

/** 解析の段階の表示名。 */
export const ANALYSIS_STAGE_LABELS = Object.freeze({
  scan: "全体を確認",
  review: "怪しい手を読み直し",
  focus: "大事な局面を深読み",
});

function comparable(score) {
  if (score?.type === "cp" && Number.isFinite(score.value)) return score.value;
  if (score?.type === "mate" && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

const sideToMove = (sfen) => (sfen.split(" ")[1] === "w" ? "white" : "black");
const rankOf = (candidates, rank) => candidates?.find((candidate) => candidate.rank === rank);

/** 局面の読みの一覧。古い形({ deep, nodes, multiPv })の結果も読みとして扱う。 */
function readsOf(result) {
  if (result?.reads) return result.reads;
  return result?.deep ? [{ nodes: result.nodes ?? 0, multiPv: result.multiPv ?? 1, candidates: result.deep }] : [];
}

/** 最も深い読み。withSecondなら次善手まである読みに限る。 */
function deepestRead(result, withSecond = false) {
  return readsOf(result)
    .filter(({ candidates }) => rankOf(candidates, 1) && (!withSecond || rankOf(candidates, 2)))
    .reduce((deepest, read) => (!deepest || read.nodes > deepest.nodes ? read : deepest), null);
}

/** 前後の局面に共通する、最も深い探索量の読みの組。共通の探索量がなければ、それぞれの最も深い読み。 */
function pairedReads(before, after) {
  const afterReads = readsOf(after).filter(({ candidates }) => rankOf(candidates, 1));
  const shared = readsOf(before)
    .filter(({ candidates, nodes }) => rankOf(candidates, 1) && afterReads.some((read) => read.nodes === nodes))
    .reduce((deepest, read) => (!deepest || read.nodes > deepest.nodes ? read : deepest), null);
  if (!shared) return { before: deepestRead(before), after: deepestRead(after) };
  return { before: shared, after: afterReads.find(({ nodes }) => nodes === shared.nodes) };
}

/** 読みの最善手と次善手の勝率差(ポイント)。次善手がなければundefined。 */
function winRateGap(read) {
  const best = rankOf(read?.candidates, 1);
  const second = rankOf(read?.candidates, 2);
  return best && second ? winRate(best.score) - winRate(second.score) : undefined;
}

/**
 * ply手目の手(steps[ply - 1]からsteps[ply]への手)の損と、最善手を指したか。
 * 損は指した側から見た評価値の下がり幅で、前後の局面に共通する探索量の読みで比べる。どちらかが未解析ならnull。
 */
export function moveFacts(steps, results, ply) {
  const pair = pairedReads(results[ply - 1], results[ply]);
  const beforeBest = rankOf(pair.before?.candidates, 1);
  const afterBest = rankOf(pair.after?.candidates, 1);
  const before = comparable(beforeBest?.score);
  const after = comparable(afterBest?.score);
  if (before === undefined || after === undefined) return null;
  // afterは相手の手番から見た値なので、指した側から見ると符号が逆になる。
  return {
    loss: Math.max(0, before + after),
    playedBest: beforeBest.move === steps[ply].lastMove,
    mate: beforeBest.score?.type === "mate" || afterBest.score?.type === "mate",
  };
}

/** 次善手との差が、神の一手(捨て駒の緩い基準)になりうる局面か。浅い読みが要るかを決める。 */
function needsShallow(steps, results, ply) {
  const read = deepestRead(results[ply], true);
  if (rankOf(read?.candidates, 1)?.move !== steps[ply + 1]?.lastMove) return false;
  return winRateGap(read) >= GOD_MOVE_SACRIFICE_MIN_WINRATE_GAP;
}

/** 次に指された手が、その局面の最も深い読みの最善手か。次善手との差を測るため、読み直しでもMultiPV 2にする。 */
function nextMoveIsBest(steps, results, ply) {
  return Boolean(steps[ply + 1]) && rankOf(deepestRead(results[ply])?.candidates, 1)?.move === steps[ply + 1].lastMove;
}

/**
 * 読み直す局面と、必要なMultiPV。返り値は「局面の手数→MultiPV」。
 * 損が大きい手と詰みが絡む手の前後と、次善手との差が大きい最善手(誰でも指す手を除く)の前後を選ぶ。
 * 次善手との差が分からない(scanがMultiPV 1)ときは、最善手をすべて読み直す。
 */
export function selectReviewPlies(steps, results, contexts, { lossThreshold = 150, gapThreshold = 4 } = {}) {
  const plies = new Map();
  const add = (ply, multiPv) => plies.set(ply, Math.max(multiPv, plies.get(ply) ?? 1));
  for (let ply = 1; ply < steps.length; ply += 1) {
    const facts = moveFacts(steps, results, ply);
    if (!facts) continue;
    if (facts.playedBest) {
      const gap = winRateGap(deepestRead(results[ply - 1], true));
      if (!contexts[ply]?.trivial && !(gap < gapThreshold)) {
        add(ply - 1, 2);
        add(ply, 1);
      }
    } else if (facts.loss >= lossThreshold || facts.mate) {
      // 読み直すと指した手が最善手に変わることがあるので、次善手との差も測れるようMultiPV 2で読む。
      add(ply - 1, 2);
      add(ply, 1);
    }
  }
  return plies;
}

/**
 * 深く読み直す局面。神の一手の候補(強さ順)と、損の大きい悪手(損の順)の前後を選ぶ。
 * 同じ探索量の読みで「最善手を指したのに損が大きい」手は読みが不安定なので、悪手と同じ枠で読み直す。
 */
export function selectFocusPlies(points, { godLimit = 4, badLimit = 4 } = {}, steps = [], results = []) {
  const plies = new Map();
  const add = (ply, multiPv) => plies.set(ply, Math.max(multiPv, plies.get(ply) ?? 1));
  const god = points
    .filter(({ annotation }) => annotation?.kind === "brilliant" || annotation?.godCandidate)
    .sort((left, right) => (right.annotation.strength ?? 0) - (left.annotation.strength ?? 0))
    .slice(0, godLimit);
  const unstable = (ply) => {
    const facts = ply > 0 && results.length ? moveFacts(steps, results, ply) : null;
    return Boolean(facts?.playedBest && facts.loss >= 300);
  };
  const bad = points
    .filter(({ ply, annotation }) => annotation?.kind === "blunder" || annotation?.kind === "mistake" || unstable(ply))
    .sort((left, right) => (
      Number(unstable(right.ply)) - Number(unstable(left.ply)) || (right.annotation?.loss ?? 0) - (left.annotation?.loss ?? 0)
    ))
    .slice(0, badLimit);
  for (const { ply } of god) {
    add(ply - 1, 2);
    add(ply, 1);
  }
  for (const { ply } of bad) {
    add(ply - 1, 2);
    add(ply, 1);
  }
  return plies;
}

/**
 * 局面の列を、探索関数ごとに連続した区間へ分け、区間の中を終局側から読ませる。
 * 早く終わった探索関数は、残りの最も多い区間の序盤側を引き取る。
 */
async function runScan(plies, lanes, runJob) {
  const size = Math.ceil(plies.length / lanes.length);
  const queues = lanes.map((_, index) => plies.slice(index * size, (index + 1) * size).reverse());
  await Promise.all(lanes.map(async (lane, index) => {
    for (;;) {
      let ply = queues[index].shift();
      if (ply === undefined) {
        const donor = queues.reduce((most, queue) => (queue.length > most.length ? queue : most), []);
        ply = donor.pop();
      }
      if (ply === undefined) return;
      if (!(await runJob(lane, ply))) return;
    }
  }));
}

/** 局面を終局側から順に、空いた探索関数へ渡す。 */
async function runQueue(plies, lanes, runJob) {
  const queue = [...plies].sort((left, right) => right - left);
  await Promise.all(lanes.map(async (lane) => {
    for (let ply = queue.shift(); ply !== undefined; ply = queue.shift()) {
      if (!(await runJob(lane, ply))) return;
    }
  }));
}

/**
 * 次善手の評価値を、比べる読みの最善手の評価値に合わせて置き直す。
 * 次善手まである読みが別の探索量のときは、その読みでの最善手との差を保つ。
 */
function alignedSecondScore(pairRead, secondRead) {
  const second = rankOf(secondRead?.candidates, 2)?.score;
  if (!second || !pairRead || secondRead === pairRead) return second;
  const pairBest = rankOf(pairRead.candidates, 1)?.score;
  const secondBest = rankOf(secondRead.candidates, 1)?.score;
  if (pairBest?.type !== "cp" || secondBest?.type !== "cp" || second.type !== "cp") return second;
  return { type: "cp", value: pairBest.value - (secondBest.value - second.value) };
}

/**
 * 段階解析の結果から、グラフの点と指し手の判定を作る。神の一手は上位3手に絞る。
 * steps[ply]は{ sfen, lastMove, label }。labelは「▲7六歩」のような指し手の表記。
 */
export function analysisPointsFromResults(steps, results, contexts = []) {
  const points = [];
  for (let ply = 0; ply < steps.length; ply += 1) {
    const read = deepestRead(results[ply]);
    const best = rankOf(read?.candidates, 1);
    const side = sideToMove(steps[ply].sfen);
    const score = scoreForBlack(best?.score, side);
    const graphValue = scoreToGraphValue(score);
    if (!score || graphValue === undefined) continue;
    const previous = points.at(-1);
    const before = results[ply - 1];
    const judged = ply > 0 && previous?.ply === ply - 1 && before;
    let annotation = null;
    let moveMeasure = null;
    if (judged) {
      const context = contexts[ply] ?? moveContext(steps[ply - 1].sfen, steps[ply].lastMove, steps[ply - 1].lastMove);
      const beforeSide = sideToMove(steps[ply - 1].sfen);
      const pair = pairedReads(before, results[ply]);
      const secondRead = deepestRead(before, true);
      const beforeBestScore = scoreForBlack(rankOf(pair.before?.candidates, 1)?.score, beforeSide);
      const afterScore = scoreForBlack(rankOf(pair.after?.candidates, 1)?.score, side);
      const measured = analyzedMoveLoss({ mover: beforeSide, beforeBestScore, afterScore });
      if (measured) moveMeasure = { mover: beforeSide, ...measured };
      annotation = classifyAnalyzedMove({
        ply,
        mover: beforeSide,
        playedMove: steps[ply].lastMove,
        bestMove: rankOf(pair.before?.candidates, 1)?.move,
        beforeBestScore: scoreForBlack(rankOf(pair.before?.candidates, 1)?.score, beforeSide),
        beforeSecondScore: scoreForBlack(alignedSecondScore(pair.before, secondRead), beforeSide),
        afterScore: scoreForBlack(rankOf(pair.after?.candidates, 1)?.score, side),
        godMove: judgeGodMove({
          move: steps[ply].lastMove,
          deepCandidates: secondRead?.candidates ?? [],
          shallowCandidates: before.shallow ?? [],
          trivial: context.trivial,
          obvious: context.obvious,
          sacrifice: context.sacrifice,
        }),
      });
    }
    points.push({
      ply,
      graphValue,
      label: ply === 0 ? "開始局面" : `${ply}手目 ${steps[ply].label || steps[ply].lastMove}`,
      scoreLabel: formatAnalysisScore(score),
      bestMove: best?.move,
      pv: best?.pv ?? [],
      score,
      secondScore: scoreForBlack(rankOf(deepestRead(results[ply], true)?.candidates, 2)?.score, side),
      annotation,
      // その手の評価値の損と着手前の形勢。棋力診断(skill-estimate.mjs)が使う。
      moveMeasure,
    });
  }
  return capGodMoves(points);
}

/**
 * 棋譜を3段階で解析し、局面ごとの結果({ reads, shallow })の配列を返す。readsは{ nodes, multiPv, candidates }の配列。
 * 途中経過はonResultsへ渡す(結果の配列は同じものを更新する)。onProgressには段階と、その段階の進み具合を渡す。
 * isCancelledが真になったら、読み終えた局面までで止める。
 * @param {{
 *   steps: { sfen: string, lastMove: string, label?: string }[],
 *   lanes: ((sfen: string, options: { nodes: number, multiPv: number, maxTimeMs: number }, ply: number) => Promise<{ candidates?: any[] }>)[],
 *   plan?: typeof STAGED_ANALYSIS_PLANS.desktop,
 *   stages?: ("scan" | "review" | "focus")[],
 *   results?: any[],
 *   isCancelled?: () => boolean,
 *   onResults?: (results: any[], contexts: any[]) => void,
 *   onProgress?: (progress: { stage: string, done: number, total: number }) => void,
 * }} options
 * resultsに前回の結果を渡すと、読み終えた探索量の局面は読み直さない(図鑑の「深く解析」)。
 */
export async function analyzeKifuStaged({
  steps,
  lanes,
  plan = STAGED_ANALYSIS_PLANS.desktop,
  stages = ["scan", "review", "focus"],
  results = [],
  isCancelled = () => false,
  onResults = () => {},
  onProgress = () => {},
}) {
  if (!lanes?.length) throw new Error("探索関数がありません");
  const contexts = steps.map((step, ply) => (
    ply > 0 ? moveContext(steps[ply - 1].sfen, step.lastMove, steps[ply - 1].lastMove) : null
  ));
  let progress = { stage: "", done: 0, total: 0 };
  const report = () => onProgress({ ...progress });
  /** その探索量・MultiPVで読み終えているか。 */
  const hasRead = (ply, nodes, multiPv) => readsOf(results[ply]).some((read) => read.nodes >= nodes && read.multiPv >= multiPv);

  /** 局面を読み、探索量ごとの読みとして残す。同じ探索量の読みは置き換える。 */
  const search = (budget, multiPvFor) => async (lane, ply) => {
    if (isCancelled()) return false;
    const multiPv = Math.max(multiPvFor(ply), nextMoveIsBest(steps, results, ply) ? 2 : 1);
    const { candidates = [] } = await lane(steps[ply].sfen, { nodes: budget.nodes, multiPv, maxTimeMs: budget.maxTimeMs }, ply);
    if (isCancelled()) return false;
    if (rankOf(candidates, 1)) {
      const reads = readsOf(results[ply]).filter((read) => read.nodes !== budget.nodes);
      results[ply] = { reads: [...reads, { nodes: budget.nodes, multiPv, candidates }], shallow: results[ply]?.shallow ?? null };
    }
    progress.done += 1;
    report();
    onResults(results, contexts);
    return true;
  };

  /** 神の一手になりうる局面だけ、褒め言葉と同じ浅い読みをする。 */
  const shallowPass = async () => {
    const plies = steps.map((_, ply) => ply)
      .filter((ply) => results[ply] && !results[ply].shallow && needsShallow(steps, results, ply));
    await runQueue(plies, lanes, async (lane, ply) => {
      if (isCancelled()) return false;
      const { candidates = [] } = await lane(steps[ply].sfen, plan.shallow, ply);
      if (isCancelled()) return false;
      results[ply] = { reads: readsOf(results[ply]), shallow: candidates };
      return true;
    });
    onResults(results, contexts);
  };

  /** 選んだ局面のうち、まだその探索量で読んでいない局面を読む。 */
  const deepen = async (stage, plies, budget) => {
    for (const [ply, multiPv] of plies) if (hasRead(ply, budget.nodes, multiPv)) plies.delete(ply);
    progress = { stage, done: 0, total: plies.size };
    report();
    await runQueue([...plies.keys()], lanes, search(budget, (ply) => plies.get(ply)));
  };

  if (stages.includes("scan")) {
    const multiPv = plan.scan.multiPv ?? 1;
    const plies = steps.map((_, ply) => ply).filter((ply) => !hasRead(ply, plan.scan.nodes, multiPv));
    progress = { stage: "scan", done: 0, total: plies.length };
    report();
    await runScan(plies, lanes, search(plan.scan, () => multiPv));
  }
  if (stages.includes("review") && !isCancelled()) {
    await deepen("review", selectReviewPlies(steps, results, contexts, plan.review), plan.review);
  }
  if (!isCancelled()) await shallowPass();
  if (stages.includes("focus") && !isCancelled()) {
    const points = analysisPointsFromResults(steps, results, contexts);
    await deepen("focus", selectFocusPlies(points, plan.focus, steps, results), plan.focus);
    if (!isCancelled()) await shallowPass();
  }
  return results;
}
