/**
 * 対局の振り返り（自動で進む棋譜並べ）の台本を作る。
 * 棋譜解析の点（analysisPointsFromResults）から、各手で話す一言と、止まって考えさせる局面を決める。
 *
 * - 止まる局面は2種類。
 *   - quiz: 手を指す前の局面で止め、プレイヤーにもっと良い手を探させる（見逃した詰み・敗着・悪手）。
 *   - pause: 手を指した後の局面で止め、その手の意味を伝える（決め手・相手の敗着・神の一手）。
 * - 考えさせるのはプレイヤーが指した手だけ。相手の手は、止まっても説明だけにする。
 * - 考えさせる局面が多すぎると流れが切れるので、損の大きい順に上限までに絞る。敗着と見逃した詰みは必ず残す。
 *
 * 点のscoreは先手から見た評価値。点のbestMoveは、その局面（ply手指した後）での最善手。
 *
 * 開始局面（initialSfen）を渡すと、盤を並べて駒のタダ取りも見る（core/review-tactics.mjs）。
 * - タダで取れる駒を見逃した手: エンジンの最善手がタダの駒を取る手だったのに、取らなかった。考えさせる。
 * - 駒をタダで取られる形にした手: 指した後、相手の最善手がタダで駒を取る手だった。悪手の問題の文を具体的にする。
 * - タダの駒を取った手、相手がタダの駒を見逃した手などには、一言を添える。
 * どれも、エンジンの最善手がその取る手のときだけ言う（取れそうに見えても取ると損な形は言わない）。
 */

import { capturedValue, freeCapture, freeCaptureOrigins, usiTo, boardsAlongLine } from './review-tactics.mjs';

/** 振り返りで手を進める間隔（ミリ秒）。 */
export const GUIDED_REVIEW_STEP_MS = 1300;
/** 一言を話した手で、次へ進むまで待つ間隔（ミリ秒）。 */
export const GUIDED_REVIEW_COMMENT_MS = 2600;
/** 振り返りの速さ。factorは、上の間隔に掛ける倍率。 */
export const GUIDED_REVIEW_SPEEDS = [
  { id: 'slow', label: 'ゆっくり', factor: 1.5 },
  { id: 'normal', label: 'ふつう', factor: 1 },
  { id: 'fast', label: '速い', factor: 0.5 },
  { id: 'fastest', label: 'とても速い', factor: 0.25 },
];
export const GUIDED_REVIEW_DEFAULT_SPEED = 'normal';

/** 速さのIDを、知っているIDに直す。知らないIDは「ふつう」にする。 */
export function normalizeGuidedReviewSpeed(id) {
  return GUIDED_REVIEW_SPEEDS.some((speed) => speed.id === id) ? id : GUIDED_REVIEW_DEFAULT_SPEED;
}

/** 速さの選択肢で、次の速さのID。最後の次は最初に戻る。 */
export function nextGuidedReviewSpeed(id) {
  const index = GUIDED_REVIEW_SPEEDS.findIndex((speed) => speed.id === normalizeGuidedReviewSpeed(id));
  return GUIDED_REVIEW_SPEEDS[(index + 1) % GUIDED_REVIEW_SPEEDS.length].id;
}

/**
 * 次へ進むまでの間隔（ミリ秒）。
 * @param {boolean} comment 一言を話した手か
 * @param {string} speedId 速さのID
 */
export function guidedReviewDelay(comment, speedId) {
  const speed = GUIDED_REVIEW_SPEEDS.find((entry) => entry.id === normalizeGuidedReviewSpeed(speedId));
  const base = comment ? GUIDED_REVIEW_COMMENT_MS : GUIDED_REVIEW_STEP_MS;
  return Math.round(base * (speed?.factor ?? 1));
}

/** 1局で考えさせる局面の上限。 */
export const GUIDED_REVIEW_QUIZ_LIMIT = 5;
/** タダの駒の見逃し・タダで取られる形を言う、勝率の下がり方の下限。 */
const MISSED_FREE_DROP = 0.03;

const WIN_RATE_SCALE = 600;

/** 評価値を、指定した側から見た勝率（0〜1）にする。 */
export function winRateFor(score, color) {
  if (!score || !Number.isFinite(score.value)) return undefined;
  const sign = color === 'black' ? 1 : -1;
  if (score.type === 'mate') {
    if (score.value === 0) return 0.5;
    return Math.sign(score.value) * sign > 0 ? 1 : 0;
  }
  return 1 / (1 + Math.exp(-(score.value * sign) / WIN_RATE_SCALE));
}

function opposite(color) {
  return color === 'black' ? 'white' : 'black';
}

/** 指した側から見て詰みがあった局面なら、その手数を返す。 */
function mateLengthFor(score, color) {
  if (score?.type !== 'mate' || !Number.isFinite(score.value) || score.value === 0) return 0;
  const sign = color === 'black' ? 1 : -1;
  return score.value * sign > 0 ? Math.abs(score.value) : 0;
}

/**
 * 振り返りの台本を作る。
 * 戻り値のstepsは手数（局面）ごとの台本。keyは局面の手数で、0は開始局面。
 * - comment: その局面に着いたときに話す一言（手を指した後の説明）。
 * - pause: 真なら、commentを話したところで止まる。
 * - quiz: その局面で止まって考えさせる問題（次の手を指す前）。
 * @param {{ ply: number, score?: { type: string, value: number }, bestMove?: string, pv?: string[], label?: string,
 *   annotation?: { kind: string, label: string, mover: 'black' | 'white' } | null }[]} points
 * @param {{
 *   playerColor?: 'black' | 'white',
 *   winner?: 'black' | 'white' | null,
 *   moves?: string[],
 *   moverForPly?: (ply: number) => 'black' | 'white',
 *   quizLimit?: number,
 *   initialSfen?: string,
 * }} [options]
 */
export function buildGuidedReview(points, {
  playerColor = 'black',
  winner = null,
  moves = [],
  moverForPly = (ply) => (ply % 2 === 1 ? 'black' : 'white'),
  quizLimit = GUIDED_REVIEW_QUIZ_LIMIT,
  initialSfen = '',
} = {}) {
  const boards = initialSfen ? boardsAlongLine(initialSfen, moves, moverForPly) : null;
  const byPly = new Map(points.map((point) => [point.ply, point]));
  const lastPly = Math.max(moves.length, ...points.map((point) => point.ply), 0);
  const moveInfos = [];
  for (let ply = 1; ply <= lastPly; ply += 1) {
    const before = byPly.get(ply - 1);
    const after = byPly.get(ply);
    if (!before?.score || !after?.score) continue;
    const mover = after.annotation?.mover ?? moverForPly(ply);
    const beforeRate = winRateFor(before.score, mover);
    const afterRate = winRateFor(after.score, mover);
    if (beforeRate === undefined || afterRate === undefined) continue;
    const played = moves[ply - 1];
    const missedMate = mateLengthFor(before.score, mover);
    const drop = Math.max(0, beforeRate - afterRate);
    moveInfos.push({
      ply,
      mover,
      before,
      after,
      beforeRate,
      afterRate,
      drop,
      missedMate: missedMate && played !== before.bestMove && !mateLengthFor(after.score, mover) ? missedMate : 0,
      // この手で、相手に詰みが生まれた(指す前は詰まされる形ではなかった)。
      allowedMate: !mateLengthFor(before.score, opposite(mover)) && mateLengthFor(after.score, opposite(mover)) > 0,
      ...tacticsOf(ply, played, before, after, drop),
    });
  }

  /*
   * 駒のタダ取り。boards[ply - 1]は手を指す前、boards[ply]は指した後の盤。
   * - tookFree: この手で、タダの駒を取った。
   * - missedFree: 最善手がタダの駒を取る手だったのに、取らなかった(勝率を少しでも落としたときだけ)。
   * - leftFree: 指した後、相手の最善手がこちらの駒をタダで取る手になった(勝率を落としたときだけ)。
   *   駒を取って取り返される交換で、取った駒の方が高いときは言わない。
   */
  function tacticsOf(ply, played, before, after, drop) {
    if (!boards || !played) return { tookFree: null, missedFree: null, leftFree: null };
    const boardBefore = boards[ply - 1];
    const boardAfter = boards[ply];
    const tookFree = freeCapture(boardBefore, played);
    const bestFree = before.bestMove && before.bestMove !== played ? freeCapture(boardBefore, before.bestMove) : null;
    const missedFree = bestFree && drop >= MISSED_FREE_DROP
      && !(tookFree && tookFree.value >= bestFree.value) && usiTo(played) !== bestFree.square
      ? bestFree
      : null;
    const replyFree = after.bestMove ? freeCapture(boardAfter, after.bestMove) : null;
    const leftFree = replyFree && drop >= MISSED_FREE_DROP && replyFree.value > capturedValue(boardBefore, played)
      ? replyFree
      : null;
    return { tookFree, missedFree, leftFree };
  }

  // 敗着: 負けた側の手のうち、まだ負けていない局面から勝率を最も落とした手。
  let losingMove = null;
  if (winner) {
    const loser = opposite(winner);
    for (const info of moveInfos) {
      if (info.mover !== loser || info.beforeRate < 0.3 || info.drop < 0.15) continue;
      if (!losingMove || info.drop > losingMove.drop) losingMove = info;
    }
  }

  // 決め手: 勝った側の神の一手・好手のうち一番後ろの手。なければ、勝った側が勝勢に入って最後まで保った手。
  let decisiveMove = null;
  if (winner) {
    const winnerMoves = moveInfos.filter((info) => info.mover === winner);
    decisiveMove = [...winnerMoves].reverse().find((info) => (
      ['brilliant', 'good'].includes(info.after.annotation?.kind ?? '')
      && winRateFor(info.after.score, winner) >= 0.6
    )) ?? null;
    if (!decisiveMove) {
      let crossing = null;
      for (const info of moveInfos) {
        const rate = winRateFor(info.after.score, winner);
        if (rate === undefined) continue;
        if (rate < 0.7) crossing = null;
        else if (!crossing && rate >= 0.85 && info.mover === winner) crossing = info;
      }
      decisiveMove = crossing;
    }
    // 敗着より前の手や、敗着の直後に駒を取っただけの手は決め手と言わない。
    if (decisiveMove && losingMove && decisiveMove.ply <= losingMove.ply + 2) decisiveMove = null;
  }

  const steps = new Map();
  const stepAt = (ply) => {
    if (!steps.has(ply)) steps.set(ply, {});
    return steps.get(ply);
  };

  // 考えさせる局面の候補。プレイヤーの手だけ。
  const quizCandidates = [];
  for (const info of moveInfos) {
    if (info.mover !== playerColor) continue;
    const kind = info.after.annotation?.kind;
    const isLosing = info === losingMove;
    if (info.missedMate) {
      quizCandidates.push({ info, priority: 3, type: 'mate' });
    } else if (isLosing) {
      quizCandidates.push({ info, priority: 2, type: 'losing' });
    } else if (kind === 'blunder' || kind === 'mistake') {
      quizCandidates.push({ info, priority: 1, type: kind });
    } else if (info.missedFree) {
      quizCandidates.push({ info, priority: 1, type: 'free-capture' });
    }
  }
  const required = quizCandidates.filter((candidate) => candidate.priority >= 2);
  const optional = quizCandidates
    .filter((candidate) => candidate.priority < 2)
    .sort((left, right) => right.info.drop - left.info.drop)
    .slice(0, Math.max(0, quizLimit - required.length));
  const quizzes = [...required, ...optional];
  const quizPlies = new Set();
  for (const { info, type } of quizzes) {
    quizPlies.add(info.ply);
    stepAt(info.ply - 1).quiz = {
      type,
      ply: info.ply,
      question: quizQuestion(type, info),
      bestMove: info.before.bestMove,
      bestLine: info.before.pv ?? [],
      playedMove: moves[info.ply - 1],
      mateLength: info.missedMate,
      // タダの駒を取る問題は、同じ駒を別の駒でタダで取っても正解にする。
      targetSquare: info.missedFree ? info.missedFree.square : undefined,
      targetFrom: info.missedFree && boards
        ? freeCaptureOrigins(boards[info.ply - 1], info.missedFree.square, info.mover)
        : undefined,
    };
  }

  for (const info of moveInfos) {
    const step = stepAt(info.ply);
    const kind = info.after.annotation?.kind;
    const isPlayer = info.mover === playerColor;
    const previous = moveInfos.find((entry) => entry.ply === info.ply - 1);
    const tacticComment = tacticCommentFor(info, isPlayer, previous);
    if (info === decisiveMove) {
      step.comment = isPlayer ? 'この手が勝負の決め手になったね！' : '相手のこの手が決め手になっちゃった…';
      step.pause = true;
    } else if (info === losingMove) {
      step.comment = isPlayer ? 'この手が敗着だったみたい…。' : '相手のこの手が敗着だったみたい。ここからチャンスをつかんだね！';
      step.pause = !isPlayer;
    } else if (kind === 'brilliant') {
      step.comment = isPlayer ? '神の一手！すごい手を見つけたね！' : '相手の神の一手…これは見えにくい手だね。';
      step.pause = true;
    } else if (info.missedMate) {
      step.comment = isPlayer ? '詰みを逃しちゃったね。' : `相手は${info.missedMate}手詰めを見逃してくれたよ！`;
    } else if (tacticComment) {
      step.comment = tacticComment;
    } else if (kind === 'good') {
      step.comment = isPlayer ? '好手だね！' : '相手の好手だね。';
    } else if (kind === 'blunder') {
      step.comment = isPlayer ? 'ここは大悪手だったね。' : '相手の大悪手！チャンスだよ。';
    } else if (kind === 'mistake') {
      step.comment = isPlayer ? 'ここは悪手だったね。' : '相手の悪手だよ。';
    } else if (kind === 'dubious') {
      step.comment = isPlayer ? 'ちょっと疑問手だったかも。' : '相手の疑問手だね。';
    }
    // 考えさせた手は、問題の答え合わせで説明するので短い一言だけにする。
    if (quizPlies.has(info.ply) && step.comment) step.pause = false;
  }

  return {
    steps,
    lastPly,
    losingPly: losingMove?.ply ?? null,
    decisivePly: decisiveMove?.ply ?? null,
    quizCount: quizzes.length,
    // 1手ごとの詰み逃しとタダ取られ。「つぎはこれ」の弱点の見立て(core/play-insight.mjs)が使う。
    moments: moveInfos.map(({ ply, mover, missedMate, leftFree }) => ({ ply, mover, missedMate, leftFree: Boolean(leftFree) })),
  };
}

/** 考えさせる問題の文。駒をタダで取られる形や、詰みが生まれた手は、何が起きたかを具体的に言う。 */
function quizQuestion(type, info) {
  if (type === 'mate') return `ここに${info.missedMate}手詰めがあったね。詰ませてみよう！`;
  if (type === 'free-capture') {
    return `ここでは、相手の${info.missedFree.name}がタダで取れたよ。どの手で取れるかな？`;
  }
  const lead = type === 'losing' ? '次の手が敗着だったみたい…。' : '';
  if (info.allowedMate) return `${lead}次の手で、相手に詰みが生まれちゃったよ。詰まされない手を探そう！`;
  if (info.leftFree) {
    return `${lead}次の手で、${info.leftFree.name}をタダで取られる形になっちゃったよ。取られない手を考えてみよう！`;
  }
  if (info.missedFree) return `${lead}ここでは、相手の${info.missedFree.name}がタダで取れたよ。どの手で取れるかな？`;
  if (type === 'losing') return '次の手が敗着だったみたい…。他の手は無かったかな？';
  return type === 'blunder'
    ? '次の手は大きな悪手だったみたい。もっと良い手を探してみよう！'
    : '次の手は悪手だったみたい。もっと良い手があるよ、探してみよう！';
}

/**
 * 駒のタダ取りについての一言。直前の手で言ったことは繰り返さない。
 * @param {any} info この手
 * @param {boolean} isPlayer プレイヤーの手か
 * @param {any} previous 直前の手(相手の手)
 */
function tacticCommentFor(info, isPlayer, previous) {
  if (isPlayer) {
    if (info.tookFree && previous?.leftFree?.square === info.tookFree.square) return `タダの${info.tookFree.name}をしっかり取ったね！`;
    if (info.leftFree) return `この手で、${info.leftFree.name}がタダで取られる形になっちゃった…。`;
    if (info.missedFree) return `相手の${info.missedFree.name}がタダで取れたのに、見逃しちゃったね。`;
    if (info.tookFree && info.tookFree.value >= 3) return `タダの${info.tookFree.name}をゲット！`;
    return '';
  }
  if (info.leftFree) return `相手の${info.leftFree.name}がタダで取れる形になったよ！`;
  if (info.tookFree && previous?.leftFree?.square === info.tookFree.square) return '';
  if (info.tookFree) return `${info.tookFree.name}をタダで取られちゃった…。`;
  if (previous?.leftFree && !info.tookFree) {
    return `相手は、タダの${previous.leftFree.name}を見逃してくれたね。`;
  }
  return '';
}

/** 振り返りの最後に話す一言。 */
export function guidedReviewSummary({ quizCount = 0, solved = 0 } = {}) {
  if (!quizCount) return '振り返りおしまい！大きなミスのない、いい将棋だったね！';
  return `振り返りおしまい！考えた${quizCount}問のうち、${solved}問で一番いい手を見つけたよ。次の対局に生かそうね！`;
}
