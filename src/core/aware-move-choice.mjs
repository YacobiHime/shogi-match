import { Position } from "tsshogi";
import { analyzePosition, perceptionForPosition } from "./position-awareness.mjs";
import { chooseLogicMove, rollPerception } from "./logic-ai.mjs";
import { createNaturalnessEvaluator, PIECE_SACRIFICE_TAG } from "./move-naturalness.mjs";
import { comparableScore } from "./move-selection.mjs";
import { BLUNDER_LOSS, chooseMatingMove, chooseRiskAwareMove, moveLeaning, pickWeighted, tryOversight } from "./cpu-move-choice.mjs";
import { attackersOf, guardsSquare, isKingAttacked, opponentOf, parseUsiMove } from "./piece-movement.mjs";
import { kingZonePressure, playLight, replyLoss, stateFromSfen } from "./logic-position.mjs";
import { findMateLine } from "./problem-solver";

/**
 * Lv11〜39。気づいた脅威・機会から候補を作り、読みとロジックの加点で選ぶ。
 * verifyとprobeは呼び出し側のエンジンを必ず直列に使う。
 * @param {{strength: ReturnType<typeof import('./strength-settings.mjs').getStrengthSearchSettings> & Record<string, any>, sfen: string, legalMoves: string[], moveHistory?: string[], planMove?: string | null, planScoreLossLimit?: number, search?: {move: string, candidates?: {rank: number, move: string, score?: any, pv?: string[]}[]}, verify?: (moves: string[], nodes: number) => Promise<any>, probe?: (moves: string[], options: {nodes: number, multiPv: number}) => Promise<any>, random?: () => number, blunderAllowed?: boolean, maxTimeMs?: number}} options
 */
export async function chooseAwareMove({ strength, sfen, legalMoves, moveHistory = [], planMove = null, planScoreLossLimit,
  search, verify, probe, random = Math.random, blunderAllowed = true, maxTimeMs = 600 }) {
  if (!legalMoves.length || !search?.move) return null;
  const deadline = Date.now() + maxTimeMs;
  const allowed = new Set(legalMoves);
  const engineCandidates = (search.candidates ?? []).filter(({ move }) => allowed.has(move));
  const bestValue = comparableScore(engineCandidates.find(({ move }) => move === search.move)?.score);
  const lossCap = Math.min(strength.moveLossCap ?? Infinity, blunderAllowed ? Infinity : BLUNDER_LOSS - 1);
  const plan = planMove && allowed.has(planMove) ? planMove : null;
  const mating = chooseMatingMove({ candidates: engineCandidates, strength, random });
  if (mating) {
    const evaluation = createNaturalnessEvaluator(sfen, { moveHistory, continuations: engineCandidates })(mating.move);
    return { ...mating, naturalness: evaluation.weight, reason: "mate", missed: [], policy: null };
  }
  // Lv10から少しずつ読みを増やす校正用設定。浅い読みの候補も後段の損失上限で確かめる。
  const shallowChoice = strength.shallowReadRate > 0 && random() < strength.shallowReadRate
    ? chooseLogicMove({ sfen, legalMoves, moveHistory, planMove: plan, level: 10, random,
      temperature: strength.shallowTemperature,
      readDepth: strength.shallowDepth,
      // Lv11以上は、取り合いを安い駒から読み、読みの深い手番では裏の利き・ピンまで見る。
      exchangeView: { mode: (strength.shallowDepth ?? 4) >= 4 ? "full" : "see", scope: "all" },
      perceptionOverride: strength.perception, style: strength.style, styleBonusCap: strength.logicBonusCap,
      maxTimeMs: Math.min(120, Math.max(0, deadline - Date.now())) }) : null;
  let evaluator;
  const memo = new Map();
  const evaluate = (move) => {
    if (!memo.has(move)) {
      evaluator ??= createNaturalnessEvaluator(sfen, { moveHistory, simplicity: strength.simplicity ?? 0,
        advantage: bestValue, planMoves: plan ? [plan] : [], continuations: engineCandidates });
      memo.set(move, evaluator(move));
    }
    return memo.get(move);
  };
  const naturalness = (move) => evaluate(move).weight;
  naturalness.isSacrifice = (move) => evaluate(move).tags.some((tag) => [PIECE_SACRIFICE_TAG, "sacrifice"].includes(tag));
  naturalness.leaning = (move) => moveLeaning(evaluate(move));
  let candidateVerificationUsed = false;
  // 浅い読みを増やす校正のために、大駒などをただで渡す候補を優先しない。
  // その場合は通常の候補比較へ戻し、正当な捨て駒かをエンジンの損得で確かめる。
  const shallowEvaluation = shallowChoice && (shallowChoice.naturalnessEvaluation ?? evaluate(shallowChoice.move));
  if (shallowChoice && !shallowEvaluation.tags.includes(PIECE_SACRIFICE_TAG)) {
    // 一つの狙いだけを読む手番では、気づきの表を二度作らず、Lv10の理由・方針をそのまま使う。
    let candidate = engineCandidates.find(({ move }) => move === shallowChoice.move);
    if (comparableScore(candidate?.score) === undefined && verify && Date.now() < deadline) {
      candidateVerificationUsed = true;
      const result = await verify([shallowChoice.move], strength.nodes);
      candidate = result?.candidates?.find(({ move }) => move === shallowChoice.move);
    }
    if (comparableScore(candidate?.score) !== undefined) {
      return { ...shallowChoice, kind: "aware-shallow", rank: candidate.rank ?? 0,
        naturalness: shallowEvaluation.weight, loss: Math.max(0, (bestValue ?? comparableScore(candidate.score)) - comparableScore(candidate.score)),
        logicBonus: 0, consideredMoves: [shallowChoice.move] };
    }
    // 少ないnodesで候補の評価が返らなくても、通常探索の既知の候補を捨てない。
  }
  const awareness = analyzePosition(sfen, { moveHistory, legalMoves, maxTimeMs: Math.min(120, Math.max(0, deadline - Date.now())) });
  const noticed = rollPerception(perceptionForPosition(strength.perception ?? {}, awareness), random);
  const missed = [];
  if (!noticed.hanging && awareness.threats.some(({ kind }) => ["capture", "breakthrough"].includes(kind))) missed.push("hanging");
  if (!noticed.defendMate && awareness.threats.some(({ kind }) => kind === "mate-threat")) missed.push("mate-threat");
  const seesEngineBest = random() < (strength.engineBestVisibility ?? 1);
  const wantsOversight = verify && blunderAllowed && (strength.moveLossCap ?? Infinity) >= BLUNDER_LOSS
    && strength.oversightRate > 0 && random() < strength.oversightRate;
  const expressesStyle = strength.style && random() < Math.abs(strength.style.attack ?? 0) * (strength.style.rate ?? 1);
  if (seesEngineBest && strength.trustedEngineRate > 0 && random() < strength.trustedEngineRate && !wantsOversight && !expressesStyle) {
    // 最善手に狙いがなければ、同じ探索で読めた次の目的のある候補を使う。
    // 見えている次善手を捨てて、大量の候補を読み直す必要はない。
    const candidate = [...engineCandidates].sort((a, b) => a.move === search.move ? -1 : b.move === search.move ? 1 : a.rank - b.rank)
      .find(({ move, score }) => evaluate(move).purposeful && comparableScore(score) !== undefined
        && (move === search.move || (bestValue ?? comparableScore(score)) - comparableScore(score) <= lossCap)
        && (!naturalness.isSacrifice(move) || (bestValue ?? comparableScore(score)) - comparableScore(score) <= 150));
    if (candidate) return { move: candidate.move, rank: candidate.rank,
      kind: "aware", naturalness: naturalness(candidate.move), loss: Math.max(0, (bestValue ?? comparableScore(candidate.score)) - comparableScore(candidate.score)),
      reason: evaluate(candidate.move).tags.find((tag) => ["guard", "escape", "develop", "attack-plan", "guard-plan", "combination", "mate-plan"].includes(tag)) ?? "engine",
      missed, policy: null, logicBonus: 0, consideredMoves: [candidate.move] };
  }
  const state = stateFromSfen(sfen);
  const opp = opponentOf(state.turn);
  const inCheck = isKingAttacked(state.board, state.turn);
  const rows = new Map();
  const purposeful = (move) => evaluate(move).purposeful || move === plan;
  const add = (move, reason, priority, value = 0) => {
    if (!allowed.has(move) || !purposeful(move)) return;
    const row = rows.get(move);
    if (!row) rows.set(move, { move, reason, priority, value });
    else if (priority > row.priority || (priority === row.priority && value > row.value)) {
      if (reason === "engine") row.priority = priority;
      else Object.assign(row, { reason, priority, value });
    }
  };
  const observed = awareness.threats.filter(({ kind }) => kind === "check" || (kind === "mate-threat" ? noticed.defendMate : noticed.hanging));
  for (const move of legalMoves) {
    const evaluation = evaluate(move);
    const parsed = parseUsiMove(move);
    if (inCheck) add(move, "check-evasion", 10);
    for (const threat of observed) {
      const priority = threat.salience === "last-move-major" ? 9 : threat.salience === "last-move-minor" ? 8 : 7;
      if (threat.kind === "capture") {
        if (parsed.from === threat.square && evaluation.tags.includes("escape")) add(move, "escape", priority, threat.value);
        if (threat.attackers.includes(parsed.to) && state.board.get(parsed.to)?.color === opp) add(move, "capture", priority, threat.value);
        const child = playLight(state, move);
        const blocks = guardsSquare(state.board, child.board, threat.square, state.turn);
        const counter = threat.attackers.some((square) => attackersOf(child.board, square, state.turn).length > attackersOf(state.board, square, state.turn).length);
        if (blocks) add(move, "guard", priority, threat.value);
        if (counter || evaluation.check || evaluation.tags.includes("threaten")) add(move, evaluation.check ? "check" : "threat", priority - 1, threat.value);
      } else if (threat.kind === "breakthrough" && (evaluation.tags.includes("guard") || threat.attackers.includes(parsed.to))) add(move, "breakthrough", priority, threat.value);
      else if (threat.kind === "mate-threat" && Date.now() < deadline) {
        const position = Position.newBySFEN(sfen);
        const next = position.createMoveByUSI(move);
        if (next && position.doMove(next)) {
          const line = findMateLine(position.sfen, 1, { nodeLimit: 3000, maxTimeMs: Math.min(20, Math.max(0, deadline - Date.now())) });
          if (line === null) add(move, "mate-defense", 10);
        }
      }
    }
  }
  for (const chance of awareness.chances) {
    const seen = ["free-capture", "winning-capture"].includes(chance.kind) ? noticed.freeCapture
      : chance.kind === "fork" ? noticed.threat : chance.kind === "mate" ? noticed.mate1 : true;
    if (seen) for (const move of chance.moves) add(move, chance.kind, chance.kind === "mate" ? 10 : 5, chance.value);
    else if (!missed.includes(chance.kind)) missed.push(chance.kind);
  }
  if (plan) add(plan, "plan", 6);
  const quiet = legalMoves.filter((move) => purposeful(move) && !state.board.has(parseUsiMove(move).to) && !evaluate(move).check)
    .sort((a, b) => naturalness(b) - naturalness(a)).slice(0, 4);
  for (const move of quiet) add(move, evaluate(move).tags.find((tag) => ["castle-build", "develop", "open-line", "guard"].includes(tag)) ?? "develop", 1);

  let policy = null;
  if (noticed.hanging && legalMoves.length && Date.now() < deadline) {
    const depth = noticed.exchange ? 4 : 1;
    const considered = legalMoves.filter(purposeful);
    // 方針の判定だけで全体の制限時間を使い切らない。未完了なら受からないとは断定しない。
    const policyDeadline = Math.min(deadline, Date.now() + 30);
    const hopeless = considered.length && considered.every((move) => Date.now() < policyDeadline
      && replyLoss(playLight(state, move), depth, policyDeadline) >= 600) && Date.now() < policyDeadline;
    if (hopeless) {
      policy = random() < (strength.takePolicyRate ?? 0) ? "take" : "attack";
      for (const move of legalMoves) {
        const capture = state.board.get(parseUsiMove(move).to)?.color === opp;
        const attack = naturalness.leaning(move) === 1 || kingZonePressure(playLight(state, move).board, opp) > kingZonePressure(state.board, opp);
        if (policy === "take" ? capture : attack) add(move, policy, 6);
      }
    }
  }
  // 見えた最善手が候補数の上限で落ちると、設定の視認率を下回ってしまう。
  if (seesEngineBest) add(search.move, "engine", 11);
  for (const candidate of engineCandidates.filter(({ rank }) => rank >= 2 && rank <= 3)) {
    if (random() < (strength.engineTopVisibility ?? 0.5)) add(candidate.move, "engine", 2);
  }
  let pool = [...rows.values()].sort((a, b) => b.priority - a.priority || b.value - a.value || naturalness(b.move) - naturalness(a.move)).slice(0, 12);
  if (!pool.length) {
    const fallback = legalMoves.filter(purposeful);
    const choices = fallback.length ? fallback : legalMoves;
    const picked = pickWeighted(choices.map((move) => ({ move, weight: naturalness(move) })), random);
    return { move: picked.move, rank: 0, kind: "aware", naturalness: naturalness(picked.move), loss: undefined, reason: "natural", missed, policy };
  }
  const scored = new Map(engineCandidates.map((candidate) => [candidate.move, candidate]));
  const missing = pool.filter(({ move }) => comparableScore(scored.get(move)?.score) === undefined).map(({ move }) => move);
  if (missing.length && verify && !candidateVerificationUsed && Date.now() < deadline) {
    // 比較用の基準手も同じ深さで読む校正用設定。異なるMultiPVの深さを混ぜる偏りを避ける。
    const searched = strength.consistentCandidateScores ? pool.map(({ move }) => move) : missing;
    const result = await verify(searched, strength.candidateNodes ?? strength.nodes);
    for (const candidate of result?.candidates ?? []) if (searched.includes(candidate.move)) scored.set(candidate.move, candidate);
  }
  pool = pool.map((entry) => ({ ...entry, candidate: scored.get(entry.move), engineValue: comparableScore(scored.get(entry.move)?.score) }))
    .filter(({ engineValue }) => engineValue !== undefined);
  if (!pool.length) return null;
  const reference = Math.max(comparableScore(scored.get(search.move)?.score) ?? bestValue ?? -Infinity,
    ...pool.map(({ engineValue }) => engineValue));
  // 候補内の最高点というだけで、大駒をただで渡す手を損失上限の例外にしない。
  pool = pool.filter(({ move, engineValue }) => move === search.move || !naturalness.isSacrifice(move) || reference - engineValue <= 150);
  if (!pool.length) {
    const safe = legalMoves.filter((move) => purposeful(move) && !naturalness.isSacrifice(move));
    if (!safe.length) return null;
    const picked = pickWeighted(safe.map((move) => ({ move, weight: naturalness(move) })), random);
    return { move: picked.move, rank: 0, kind: "aware", naturalness: naturalness(picked.move), loss: undefined,
      reason: "natural", missed, policy, logicBonus: 0, consideredMoves: [picked.move] };
  }
  const poolBest = Math.max(...pool.map(({ engineValue }) => engineValue));
  const cap = strength.logicBonusCap ?? 0;
  const openingLimit = planScoreLossLimit ?? Math.min(250 * (strength.openingPlanScoreScale ?? 1), strength.maxScoreLoss ?? Infinity);
  pool = pool.filter(({ move, engineValue }) => engineValue === poolBest || (reference - engineValue <= lossCap
    && (move !== plan || reference - engineValue <= openingLimit)
    && (!naturalness.isSacrifice(move) || reference - engineValue <= 150)));
  for (const entry of pool) {
    let bonus = 0;
    if (entry.move === plan && moveHistory.length <= 30 && reference - entry.engineValue <= openingLimit) bonus += cap;
    const leaning = naturalness.leaning(entry.move);
    const style = strength.style?.attack ?? 0;
    if (Math.sign(style) === leaning && leaning) bonus += cap * Math.abs(style);
    if (evaluate(entry.move).tags.some((tag) => ["free-capture", "winning-capture", "even-trade", "desperado", "recapture"].includes(tag))) bonus += cap * (strength.simplicity ?? 0) * 0.5;
    if (policy === "take" ? state.board.get(parseUsiMove(entry.move).to)?.color === opp : policy === "attack" && leaning === 1) bonus += cap;
    entry.logicBonus = Math.min(cap, bonus);
    entry.score = entry.engineValue + entry.logicBonus;
  }
  const candidates = pool.map(({ candidate, move }, index) => ({ ...candidate, move, rank: candidate?.rank ?? index + 1 }));
  const best = pool.find(({ engineValue }) => engineValue === poolBest);
  const finish = (picked, kind = "aware") => {
    const row = pool.find(({ move }) => move === picked.move);
    return { move: picked.move, rank: row?.candidate?.rank ?? 0, kind, naturalness: naturalness(picked.move),
      loss: Math.max(0, reference - (row?.engineValue ?? poolBest)), reason: row?.reason ?? "engine", missed, policy,
      logicBonus: row?.logicBonus ?? 0, consideredMoves: pool.map(({ move }) => move) };
  };
  if (Date.now() < deadline && wantsOversight && verify && lossCap >= BLUNDER_LOSS) {
    const oversight = await tryOversight({ search: { move: best.move }, candidates, legalMoves: pool.map(({ move }) => move), strength,
      naturalness, verify, random, lossCap: Math.max(0, lossCap - (reference - poolBest)) });
    if (oversight) return { ...finish(oversight, "oversight"), loss: oversight.loss + Math.max(0, reference - poolBest), deepLoss: oversight.deepLoss };
  }
  const risky = Date.now() < deadline
    ? await chooseRiskAwareMove({ sfen, search: { move: best.move }, candidates, strength, naturalness, probe, lossCap }) : null;
  if (risky) return finish(risky, risky.kind);
  const top = Math.max(...pool.map(({ score }) => score));
  const picked = pickWeighted(pool.map((entry) => ({ ...entry, weight: Math.exp((entry.score - top) / Math.max(1, strength.scoreTemperature ?? 1)) })), random);
  return finish(picked);
}
