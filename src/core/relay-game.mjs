// 大会のほかの対局の中継(docs/tournament-relay-design.md)。決まった勝ち負けと展開に沿って、エンジンで1手ずつ指した棋譜を作る。
// 勝ち負けは自動対局(ryuo-simulation.mjs)で先に決まっている。ここは、その展開(序盤・中盤・終盤のあとの形勢)を目標の線にして、
// 損をする側が分かれ目で悪手を指し、勝つ側が最善を指すように手を選ぶ。手はどれも合法で、終局は投了か詰み、勝者は決まった勝者。
// 持ち時間(1手の考えた時間・秒読み)と時刻(休憩・封じ手)も、ここで決める。エンジンの呼び出しは、引数のsearchに任せる(画面に依存しない)。

import { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } from '../game-state';
import { createRng, gauss } from './ryuo-random.mjs';
import { comparableScore, winRate } from './move-selection.mjs';
import { settleMultiPvCandidates } from './match-assists.mjs';
import { createNaturalnessEvaluator, PIECE_SACRIFICE_TAG } from './move-naturalness.mjs';
import { moveLeaning } from './cpu-move-choice.mjs';
import { nextOpeningPlanMove } from './opening-guide.mjs';
import { shouldUseCpuOpening } from './cpu-opening-repertoire.mjs';
import { openingEntry, proOpening } from './opening-usage.mjs';
import { createFormationState, detectFormationSnapshot, formationNamesFromState, updateFormationState } from './formation-tracker.mjs';

export const RELAY_VERSION = 1;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** 文字列の種(同じ対局は、同じ展開・同じ持ち時間・同じコメント)。 */
export function relaySeed(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ---- 持ち時間の決まり(4-1)

/** 秒読み(1手60秒未満)。 */
export const BYOYOMI_SECONDS = 60;

/**
 * 対局の持ち時間と、1日の時刻の決まり。時刻は0:00からの分。
 * breaksは、その時刻をまたいだ手のあとに入れる休憩(minutesは休憩の長さ)。sealは、二日制の1日目の封じ手の時刻。
 * @param {{ event?: string, kind?: string }} options kindは game(トーナメント)・league(順位戦)・playoff・finals(七番勝負)
 */
export function relayTimeControl({ event = 'ryuo', kind = 'game' } = {}) {
  const meijin = event === 'meijin';
  if (kind === 'finals') {
    return {
      main: (meijin ? 9 : 8) * 3600, byoyomi: BYOYOMI_SECONDS, days: 2, start: 9 * 60,
      breaks: [{ kind: 'lunch', at: 12 * 60 + 30, minutes: 60 }], seal: 18 * 60,
    };
  }
  return {
    main: (meijin ? 6 : 5) * 3600, byoyomi: BYOYOMI_SECONDS, days: 1, start: 10 * 60,
    breaks: [{ kind: 'lunch', at: 12 * 60, minutes: 40 }, { kind: 'dinner', at: 18 * 60, minutes: meijin ? 40 : 30 }], seal: null,
  };
}

// ---- 展開と目標の線(3-2)

/** 展開(レーティングの単位)を評価値(点)に直す倍率と、局面ごとの上限。 */
export const CP_PER_RATING = 2;
const OPENING_CAP = 600;
const MIDDLE_CAP = 1200;
/** 終局の予定で、勝者から見た目標の評価値。 */
export const DECISIVE_CP = 2500;
/** 先手の小さな有利(点)。 */
const BLACK_EDGE = 40;
/** ここまでは定跡の範囲として、形勢を動かさない。 */
export const THEORY_PLY = 16;
/** 分かれ目の手を作る、局面ごとの形勢の動きの下限(点)。 */
const EVENT_MIN = 200;
/** 終盤の決め手を与える悪手の大きさの下限(点)。 */
const DECISIVE_EVENT_MIN = 600;

/** 勝ち方ごとの、中盤の終わりから終局までの手数の幅。 */
const ENDING_LENGTH = Object.freeze({
  opening: [10, 30], middle: [16, 36], ending: [26, 56], comeback: [30, 60], recover: [24, 50],
});
/** 勝ち方ごとの、勝者から見た序盤・中盤のあとの形勢の幅(展開を持たない前の保存の局で使う)。 */
const HOW_STORY = Object.freeze({
  opening: [[150, 250], [250, 400]],
  middle: [[-50, 80], [200, 350]],
  ending: [[-60, 60], [-60, 80]],
  comeback: [[-80, 60], [-250, -120]],
  recover: [[-200, -100], [0, 150]],
});

const between = (rng, [low, high]) => low + rng.next() * (high - low);

/**
 * 対局の展開を、先手から見た形勢(レーティングの単位)で返す。記録にあればそれを、なければ勝ち方と種で作る。
 * @param {{ story?: number[] | null, how?: string, winner: 'black' | 'white', seed: number }} spec
 */
export function relayStoryValues(spec) {
  if (Array.isArray(spec.story) && spec.story.length >= 2 && spec.story.every(Number.isFinite)) return spec.story.slice(0, 3);
  const rng = createRng(spec.seed ^ 0x2f6b1d3);
  const sign = spec.winner === 'black' ? 1 : -1;
  const [first, second] = HOW_STORY[spec.how] ?? HOW_STORY.ending;
  return [between(rng, first) * sign, between(rng, second) * sign, 300 * sign].map(Math.round);
}

/**
 * 1局の筋書き。序盤・中盤の終わりと終局の予定の手数、分かれ目の手(どの手番の側が、何手目に、どれだけ損をするか)。
 * pliesは、指す前の手数(0始まり。0は先手の1手目)。手番は、plyが偶数なら先手。
 * @param {{ winner: 'black' | 'white', how?: string, story?: number[] | null, seed: number,
 *   black?: { character?: any }, white?: { character?: any } }} spec
 */
export function relayPlan(spec) {
  const rng = createRng(spec.seed ^ 0x51ed27);
  const winnerSign = spec.winner === 'black' ? 1 : -1;
  const values = relayStoryValues(spec);
  const e1 = clamp(values[0] * CP_PER_RATING, -OPENING_CAP, OPENING_CAP);
  const e2 = clamp(values[1] * CP_PER_RATING, -MIDDLE_CAP, MIDDLE_CAP);
  const openingEnd = 30 + Math.floor(rng.next() * 11);
  const middleEnd = 76 + Math.floor(rng.next() * 21);
  const [low, high] = ENDING_LENGTH[spec.how] ?? ENDING_LENGTH.ending;
  const end = Math.min(180, middleEnd + low + Math.floor(rng.next() * (high - low + 1)));
  const events = [];
  /** そのplyの範囲で、sideの手番の手数を1つ選ぶ。 */
  const pickPly = (from, to, side, taken) => {
    const parity = side === 'black' ? 0 : 1;
    const options = [];
    for (let ply = from; ply < to; ply += 1) if (ply % 2 === parity && !taken.includes(ply)) options.push(ply);
    return options.length ? options[Math.floor(rng.next() * options.length)] : null;
  };
  const phases = [
    { phase: 'opening', from: THEORY_PLY + 4, to: openingEnd, delta: e1 - BLACK_EDGE },
    { phase: 'middle', from: openingEnd + 2, to: middleEnd, delta: e2 - e1 },
  ];
  for (const { phase, from, to, delta } of phases) {
    if (Math.abs(delta) < EVENT_MIN) continue;
    // 先手が得をするなら後手が、後手が得をするなら先手が、分かれ目の手を指す。
    const side = delta > 0 ? 'white' : 'black';
    const count = Math.abs(delta) > 650 ? 2 : 1;
    const taken = [];
    for (let index = 0; index < count; index += 1) {
      const ply = pickPly(from, to, side, taken);
      if (ply === null) continue;
      taken.push(ply);
      events.push({ ply, side, size: Math.round((Math.abs(delta) * 0.8) / count), phase });
    }
  }
  // 終盤: 敗者が、決め手を与える悪手を指す。競り合い・逆転の局は終局の近くで、押し切る局は中盤の終わりの近くで。
  const loser = spec.winner === 'black' ? 'white' : 'black';
  const needed = DECISIVE_CP - winnerSign * e2;
  const late = spec.how === 'ending' || spec.how === 'comeback';
  const window = late ? [Math.max(middleEnd + 4, end - 22), end - 8] : [middleEnd + 4, Math.max(middleEnd + 6, end - 14)];
  const taken = [];
  const decisiveCount = needed > 1800 ? 2 : 1;
  for (let index = 0; index < decisiveCount; index += 1) {
    const ply = pickPly(window[0], Math.max(window[0] + 2, window[1]), loser, taken);
    if (ply === null) continue;
    taken.push(ply);
    events.push({
      ply, side: loser, size: Math.round(Math.max(DECISIVE_EVENT_MIN, (needed * 0.7) / decisiveCount)), phase: 'ending',
      kind: index === 0 ? 'decisive' : 'error',
    });
  }
  events.sort((a, b) => a.ply - b.ply);
  return { winner: spec.winner, winnerSign, values, e1, e2, openingEnd, middleEnd, end, events };
}

/** 分かれ目の手で動く目標(先手から見た点)。後手の悪手は先手の得。 */
const eventShift = (event) => (event.side === 'white' ? event.size : -event.size);

/**
 * 目標の形勢(先手から見た評価値)。plyは指したあとの手数。分かれ目の手で段のように動き、残りは局面のあいだで少しずつ動く。
 * @param {ReturnType<typeof relayPlan>} plan
 * @param {number} ply
 */
export function relayTarget(plan, ply) {
  const shifted = (from, to) => plan.events.filter((event) => event.ply >= from && event.ply < to && event.ply < ply)
    .reduce((sum, event) => sum + eventShift(event), 0);
  const eventsIn = (from, to) => plan.events.filter((event) => event.ply >= from && event.ply < to)
    .reduce((sum, event) => sum + eventShift(event), 0);
  const ramp = (from, to) => clamp((ply - from) / Math.max(1, to - from), 0, 1);
  const goal = plan.winnerSign * DECISIVE_CP;
  // 局面ごとの残りの動き(分かれ目の手で動かない分)を、直線で配る。
  const openingDrift = (plan.e1 - BLACK_EDGE) - eventsIn(0, plan.openingEnd);
  const middleDrift = (plan.e2 - plan.e1) - eventsIn(plan.openingEnd, plan.middleEnd);
  const endingDrift = (goal - plan.e2) - eventsIn(plan.middleEnd, Infinity);
  return BLACK_EDGE
    + shifted(0, plan.openingEnd) + openingDrift * ramp(THEORY_PLY, plan.openingEnd)
    + shifted(plan.openingEnd, plan.middleEnd) + middleDrift * ramp(plan.openingEnd, plan.middleEnd)
    + shifted(plan.middleEnd, Infinity) + endingDrift * ramp(plan.middleEnd, plan.end);
}

// ---- 評価値の扱い

/** 詰みの評価値を、保存と比べるための点にする(詰みは±30000から手数を引いた値)。 */
export const MATE_CP = 30000;
export function scoreToCp(score) {
  if (score?.type === 'mate' && Number.isFinite(score.value)) {
    if (score.value > 0) return MATE_CP - score.value;
    if (score.value < 0) return -MATE_CP - score.value;
    return MATE_CP;
  }
  return score?.type === 'cp' && Number.isFinite(score.value) ? score.value : 0;
}
/** 保存した点が詰みか。 */
export const isMateCp = (cp) => Math.abs(cp) >= MATE_CP - 1000;
/** 比べるための値(comparableScore。詰みは±100000から手数を引いた値)を、保存の点にする。 */
function valueToCp(value) {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 90000) return Math.sign(value) * (MATE_CP - (100000 - Math.abs(value)));
  return value;
}
/** 点を、先手の勝率(0〜1)にする。対局中の中継と同じ式(winRate)。 */
export function blackWinRate(cp) {
  if (isMateCp(cp)) return cp > 0 ? 1 : 0;
  return (winRate({ type: 'cp', value: cp }) ?? 50) / 100;
}

// ---- 1手の選び方(3-3)

/** 目標より良すぎるとみなす幅(点)。 */
const TOLERANCE = { opening: 200, middle: 200, ending: 300 };
/** 分かれ目でない手で、目標に合わせて損をしてよい上限(点)。 */
const SLIP_MAX = 120;
/** 敗者が終盤で大きく良すぎるとき(目標から800点以上)、1手で損をしてよい上限。 */
const COLLAPSE_SLIP = 400;
/** 序盤の作戦の手を、最善手との差がこれ以内なら指す。 */
const PLAN_LOSS_LIMIT = 150;
/** 鋭い一手(最善手と次の手の差)。 */
export const ONLY_MOVE_GAP = 300;
/** 投了の決まり。 */
export const RESIGN_CP = -2000;
const RESIGN_ANYTIME_CP = -3500;
const RESIGN_MATE_PLIES = 21;
const RESIGN_MIN_PLY = 50;
const RESIGN_AFTER_DECISIVE = 6;
export const RELAY_MAX_PLIES = 300;
/** 棋風で手を選ぶ幅(点)。 */
const STYLE_MARGIN = 40;
/** 悪手を探すとき、読み直す自然な手の数。 */
const WIDE_MOVES = 8;

const phaseOf = (plan, ply) => (ply < plan.openingEnd ? 'opening' : ply < plan.middleEnd ? 'middle' : 'ending');
const sideOf = (ply) => (ply % 2 === 0 ? 'black' : 'white');
const signOf = (side) => (side === 'black' ? 1 : -1);

/** 候補(手番の側から見た評価値)を、比べられる形にそろえる。 */
function rankedCandidates(result) {
  const settled = settleMultiPvCandidates(result?.candidates ?? [], result?.completedCandidates ?? []);
  return settled
    .map((candidate) => ({ ...candidate, value: comparableScore(candidate.score) }))
    .filter((candidate) => typeof candidate.move === 'string' && candidate.value !== undefined);
}

/** 盤の局面の鍵(手数を除く)。千日手を避けるのに使う。 */
const positionKey = (sfen) => sfen.split(' ').slice(0, 3).join(' ');

/**
 * 1局を指す。searchは、初期局面からmovesを指した局面を読む関数(エンジンの探索。候補は手番の側から見た評価値)。
 * onMoveは、1手ごとに残すもの(4章の形)を渡す。isCancelledが真になったら止める。
 * @param {{
 *   spec: any,
 *   search: (request: { moves: string[], multiPv: number, searchMoves?: string[] }) => Promise<any>,
 *   formationMaster?: any,
 *   onMove?: (entry: RelayMoveEntry, index: number) => void,
 *   isCancelled?: () => boolean,
 *   multiPv?: number,
 * }} options
 * @returns {Promise<RelayGame | null>} 止めたらnull
 */
export async function playRelayGame({ spec, search, formationMaster = null, onMove = () => {}, isCancelled = () => false, multiPv = 4 }) {
  const plan = relayPlan(spec);
  const rng = createRng(spec.seed ^ 0x1b873593);
  const record = createGameRecord(STANDARD_SFEN);
  const moves = [];
  const entries = [];
  const seen = new Map([[positionKey(record.position.sfen), 1]]);
  const clock = createRelayClock(spec, plan);
  const plans = { black: openingPlanOf(spec, 'black'), white: openingPlanOf(spec, 'white') };
  let formations = createFormationState();
  const doneEvents = new Set();
  let decisiveAt = null;
  let lastEval = BLACK_EDGE;
  let end = null;

  for (let ply = 0; ply < RELAY_MAX_PLIES; ply += 1) {
    if (isCancelled()) return null;
    const sfen = record.position.sfen;
    const side = sideOf(ply);
    const sign = signOf(side);
    const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
    if (!legal.length) {
      end = { winner: side === 'black' ? 'white' : 'black', reason: 'mate', plies: ply };
      break;
    }
    const isWinner = side === spec.winner;
    const result = await search({ moves: [...moves], multiPv });
    if (isCancelled()) return null;
    let candidates = rankedCandidates(result).filter(({ move }) => legal.includes(move));
    if (!candidates.length) candidates = [{ rank: 1, move: legal[0], pv: [legal[0]], value: 0, score: { type: 'cp', value: 0 } }];
    const best = candidates[0];
    const phase = phaseOf(plan, ply);

    // 投了: 敗者の手番で、もう勝ち目がない。
    if (!isWinner && shouldResign({ ply, best, decisiveAt, plan })) {
      end = { winner: spec.winner, reason: 'resign', plies: ply };
      break;
    }

    const evaluate = naturalnessOf(sfen, moves);
    const target = relayTarget(plan, ply + 1) * sign;
    const event = plan.events.find((entry) => entry.ply === ply && entry.side === side && !doneEvents.has(entry.ply));
    // 千日手にしない(同じ局面の3回目になる手は選ばない)。敗者は、自分が詰ます手・相手を詰ませる手を選ばない。
    const repeats = (usi) => (seen.get(positionKey(afterMove(sfen, usi))) ?? 0) >= 2;
    const allowed = (candidate) => !repeats(candidate.move)
      && (isWinner ? !(candidate.score?.type === 'mate' && candidate.score.value < 0) || candidate === best
        : !(candidate.score?.type === 'mate' && candidate.score.value > 0) && !matesOpponent(sfen, candidate.move));
    const pool = candidates.filter(allowed);
    const usable = pool.length ? pool : candidates;

    let choice = null;
    let kind = '';
    // 1. 序盤の作戦。
    const planMove = openingPlanMove({ plans, side, ply, record, moves, legal, formations, lastCapture: lastMoveCaptured(record) });
    if (planMove) {
      const planned = await valueOf(planMove, usable, () => search({ moves: [...moves], multiPv: 1, searchMoves: [planMove] }));
      if (planned !== null && best.value - planned.value <= PLAN_LOSS_LIMIT && (!event || best.value - target <= TOLERANCE[phase])) {
        choice = planned;
        kind = 'book';
      }
    }
    // 2. 詰み(勝者は、終盤か大差なら詰ます)。
    if (!choice && isWinner && best.score?.type === 'mate' && best.score.value > 0 && (phase === 'ending' || best.value >= 1500)) {
      choice = best;
      kind = 'mate';
    }
    // 3. 形勢を目標に合わせる。良すぎるときだけ損をする。
    if (!choice) {
      const excess = best.value - target;
      const tolerance = TOLERANCE[phase];
      const winnerLocked = isWinner && phase === 'ending';
      if (event && excess > tolerance / 2) {
        const want = Math.min(excess, event.size * 1.3);
        const range = { want, min: want * 0.5, max: event.size * 1.6, evaluate };
        choice = pickLoss(usable, best, range);
        if (!choice) {
          const wider = await widerCandidates({ sfen, moves, legal, candidates, search, evaluate, allowed });
          // 欲しい大きさの手がなければ、上限の中でいちばん大きく損をする手(100点以上)にする。残りは、あとの手で少しずつ損をする。
          choice = pickLoss([...usable, ...wider], best, range) ?? pickLoss([...usable, ...wider], best, { ...range, want: range.max, min: 100 });
        }
        if (choice && choice.move !== best.move) {
          kind = event.kind === 'decisive' ? 'decisive' : 'error';
          doneEvents.add(event.ply);
        }
      } else if (!winnerLocked && excess > tolerance && Math.abs(best.value) < 90000) {
        const collapse = !isWinner && phase === 'ending' && excess > 800;
        const cap = collapse ? COLLAPSE_SLIP : SLIP_MAX;
        choice = pickLoss(usable, best, { want: Math.min(excess - tolerance / 2, cap), min: 0, max: cap, evaluate });
        if (collapse && (!choice || best.value - choice.value < 100)) {
          const wider = await widerCandidates({ sfen, moves, legal, candidates, search, evaluate, allowed });
          choice = pickLoss([...usable, ...wider], best, { want: cap, min: 100, max: cap, evaluate }) ?? choice;
        }
        if (choice && choice.move !== best.move) kind = 'slip';
      }
      if (event && !doneEvents.has(event.ply)) doneEvents.add(event.ply);
      // 決め手の手番が来たら、悪手を指せたかどうかにかかわらず、勝負は決まったことにする(もう形勢が傾いていれば悪手は要らない)。
      if (event?.kind === 'decisive' && decisiveAt === null) decisiveAt = ply;
    }
    // 4. 目標どおりなら、最善手か、最善手に近い棋風に合う手。
    if (!choice) {
      choice = styledChoice(usable, best, spec[side]?.character, evaluate, rng) ?? best;
      if (!allowed(choice)) choice = usable[0] ?? best;
      const second = candidates[1];
      if (choice.move === best.move && second && best.value - second.value >= ONLY_MOVE_GAP && !isMateCp(best.value) && ply >= THEORY_PLY) kind = 'only';
    }

    const usi = choice.move;
    const loss = Math.max(0, best.value - (choice.value ?? best.value));
    const evalCp = valueToCp(choice.value ?? best.value) * sign;
    const gap = candidates[1] ? Math.abs((winRate(best.score) ?? 50) - (winRate(candidates[1].score) ?? 50)) : 50;
    const seconds = clock.think({
      side, ply, kind, gap, surprise: Math.abs(evalCp - lastEval), rng, character: spec[side]?.character,
    });
    if (!appendUsiMove(record, usi)) break;
    moves.push(usi);
    const key = positionKey(record.position.sfen);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (formationMaster) formations = updateFormationState(formations, detectFormationSnapshot(record.position.sfen, formationMaster));
    const entry = {
      move: usi,
      eval: Math.round(evalCp),
      pv: (choice.pv ?? []).slice(1, 5).join(' '),
      best: usi === best.move ? '' : best.move,
      loss: Math.round(loss),
      time: seconds,
      mark: kind,
    };
    entries.push(entry);
    lastEval = evalCp;
    onMove(entry, entries.length - 1);
  }
  if (!end) end = { winner: spec.winner, reason: 'resign', plies: moves.length };
  // 決まった勝者と違う終わり方(ほぼ起きない)は、敗者の投了にそろえる。
  if (end.winner !== spec.winner) end = { winner: spec.winner, reason: 'resign', plies: moves.length };
  return { v: RELAY_VERSION, key: spec.key, entries, end };
}

/**
 * @typedef {{ move: string, eval: number, pv: string, best: string, loss: number, time: number, mark: string }} RelayMoveEntry
 * @typedef {{ v: number, key: string, entries: RelayMoveEntry[], end: { winner: 'black' | 'white', reason: 'resign' | 'mate', plies: number } }} RelayGame
 */

/** 投了するか。bestは、敗者の手番での最善手(敗者から見た値)。 */
export function shouldResign({ ply, best, decisiveAt, plan }) {
  if (best.value <= RESIGN_ANYTIME_CP) return ply >= 30;
  if (ply < RESIGN_MIN_PLY) return false;
  // 終局の予定を大きく過ぎたら、はっきり不利なところで投げる(長引かせない)。
  if (Number.isFinite(plan.end) && ply > plan.end + 40) return best.value <= RESIGN_CP / 2;
  if (Number.isFinite(plan.end) && ply > plan.end) return best.value <= RESIGN_CP;
  if (decisiveAt === null && plan.events.some((event) => event.kind === 'decisive')) {
    // 決め手の悪手がまだなら、もう少し指す(寄せを見せる)。ただし大差なら投げる。
    return best.value <= RESIGN_ANYTIME_CP;
  }
  if (decisiveAt !== null && ply - decisiveAt < RESIGN_AFTER_DECISIVE) return false;
  if (best.score?.type === 'mate' && best.score.value < 0 && -best.score.value <= RESIGN_MATE_PLIES) return true;
  return best.value <= RESIGN_CP;
}

function afterMove(sfen, usi) {
  const record = createGameRecord(sfen);
  return appendUsiMove(record, usi) ? record.position.sfen : sfen;
}

/** その手で、相手が詰む(指せる手がなくなる)か。 */
function matesOpponent(sfen, usi) {
  const record = createGameRecord(sfen);
  if (!appendUsiMove(record, usi)) return false;
  return enumerateLegalMoves(record.position).length === 0;
}

function lastMoveCaptured(record) {
  const move = record.current?.move;
  return Boolean(move && typeof move === 'object' && 'capturedPieceType' in move && move.capturedPieceType);
}

/** 手の自然さ(目に付きやすさ・駒捨て・攻めか受けか)。 */
function naturalnessOf(sfen, moves) {
  let evaluator = null;
  const cache = new Map();
  return (usi) => {
    if (!cache.has(usi)) {
      try {
        evaluator ??= createNaturalnessEvaluator(sfen, { moveHistory: moves });
        cache.set(usi, evaluator(usi));
      } catch {
        cache.set(usi, { weight: 1, tags: [], check: false });
      }
    }
    return cache.get(usi);
  };
}

const isSacrifice = (evaluation) => evaluation.tags?.includes(PIECE_SACRIFICE_TAG) || evaluation.tags?.includes('sacrifice');

/**
 * 最善手との差がwantに近い手を選ぶ(min〜maxの範囲。駒をただで渡す手と、不自然な手は避ける)。範囲に手がなければnull。
 * @param {any[]} pool
 * @param {any} best
 * @param {{ want: number, min: number, max: number, evaluate: (usi: string) => any }} options
 */
export function pickLoss(pool, best, { want, min, max, evaluate }) {
  const options = pool
    .filter((candidate) => candidate.move !== best.move)
    .map((candidate) => ({ candidate, loss: best.value - candidate.value, evaluation: evaluate(candidate.move) }))
    .filter(({ loss, evaluation }) => loss >= min && loss <= max && !isSacrifice(evaluation) && (evaluation.weight ?? 1) >= 0.2);
  if (!options.length) return min <= 0 ? best : null;
  options.sort((a, b) => Math.abs(a.loss - want) - Math.abs(b.loss - want) || (b.evaluation.weight ?? 1) - (a.evaluation.weight ?? 1));
  return options[0].candidate;
}

/** 最善手に近い候補から、棋風(攻め・受け)に合う手を選ぶ。合う手がないか、選ばないときはnull。 */
function styledChoice(pool, best, character, evaluate, rng) {
  const attack = clamp(Number(character?.attack) || 0, -1, 1);
  if (Math.abs(attack) < 0.2 || rng.next() >= Math.abs(attack) * 0.6) return null;
  const want = Math.sign(attack);
  if (moveLeaning(evaluate(best.move)) === want) return null;
  const fitting = pool.filter((candidate) => candidate.move !== best.move && best.value - candidate.value <= STYLE_MARGIN
    && !isMateCp(candidate.value) && moveLeaning(evaluate(candidate.move)) === want && !isSacrifice(evaluate(candidate.move)));
  return fitting[0] ?? null;
}

/** 候補にない手の評価(候補にあればそれ、なければ読み直す)。 */
async function valueOf(usi, candidates, read) {
  const found = candidates.find(({ move }) => move === usi);
  if (found) return found;
  const result = await read();
  const ranked = rankedCandidates(result);
  return ranked.find(({ move }) => move === usi) ?? null;
}

/** 悪手を探すとき、候補にない自然な手を読み直す(最善手も一緒に読んで、同じ物差しにする)。 */
async function widerCandidates({ sfen, moves, legal, candidates, search, evaluate, allowed }) {
  const known = new Set(candidates.map(({ move }) => move));
  const extra = legal
    .filter((usi) => !known.has(usi) && !isSacrifice(evaluate(usi)))
    .sort((a, b) => (evaluate(b).weight ?? 1) - (evaluate(a).weight ?? 1))
    .slice(0, WIDE_MOVES);
  if (!extra.length) return [];
  const bestMove = candidates[0].move;
  const result = await search({ moves: [...moves], multiPv: extra.length + 1, searchMoves: [bestMove, ...extra] });
  const ranked = rankedCandidates(result);
  const anchor = ranked.find(({ move }) => move === bestMove);
  if (!anchor) return [];
  // 読み直しの最善手の値を、最初の読みの最善手の値にそろえる。
  const shift = candidates[0].value - anchor.value;
  void sfen;
  return ranked.filter(({ move }) => move !== bestMove).map((candidate) => ({ ...candidate, value: candidate.value + shift }))
    .filter(allowed);
}

// ---- 序盤の作戦

/** 棋士の、この局の戦法と囲い(定跡案内の戦法・囲いのid)。 */
function openingPlanOf(spec, side) {
  const id = spec.openings?.[side];
  if (!id || !proOpening(id)) return null;
  const castle = spec.castles?.[side] ?? proOpening(id)?.castles?.[0]?.[0] ?? '';
  const entry = openingEntry(id, castle);
  return entry ? { strategyId: entry.strategy, castleId: entry.castle ?? '' } : null;
}

function openingPlanMove({ plans, side, ply, record, moves, legal, formations, lastCapture }) {
  const plan = plans[side];
  if (!plan) return null;
  const own = moves.filter((_, index) => sideOf(index) === side);
  const other = moves.filter((_, index) => sideOf(index) !== side);
  const sfen = record.position.sfen;
  const inCheck = Boolean(record.position.checked);
  if (!shouldUseCpuOpening({ ply, cpuMoveCount: own.length, inCheck, lastMoveWasCapture: lastCapture })) return null;
  try {
    const move = nextOpeningPlanMove({
      strategyId: plan.strategyId, castleId: plan.castleId, color: side, playedMoves: own, opponentMoves: other, moveHistory: moves,
      legalMoves: legal, detectedFormations: formationNamesFromState(formations, side),
      opponentFormations: formationNamesFromState(formations, side === 'black' ? 'white' : 'black'), currentSfen: sfen,
    });
    return move && legal.includes(move.usi) ? move.usi : null;
  } catch {
    return null;
  }
}

// ---- 持ち時間(4-2)

/** 1手の考えた時間の、局面ごとの重み。 */
const PHASE_TIME = { opening: 0.6, middle: 1.35, ending: 0.85 };

const traitDegree = (character, id) => {
  const trait = character?.traits?.find((entry) => entry.id === id);
  return trait ? (trait.degree === 2 ? 2 : 1) : 0;
};

/**
 * 持ち時間の時計。think()が、その手の考えた時間(秒)を返し、残りを減らす。持ち時間を使い切ったら秒読み(1手10〜59秒)。
 * @param {any} spec
 * @param {ReturnType<typeof relayPlan>} plan
 */
export function createRelayClock(spec, plan) {
  const control = relayTimeControl({ event: spec.event, kind: spec.kind });
  const remaining = { black: control.main, white: control.main };
  const tempoRng = createRng(spec.seed ^ 0x7feb352d);
  const tempo = {};
  for (const side of ['black', 'white']) {
    const character = spec[side]?.character;
    const reading = clamp(Number(character?.abilities?.reading) || 0, -30, 30);
    tempo[side] = Math.exp(reading / 60 + gauss(tempoRng) * 0.12) * (traitDegree(character, 'demon-reading') ? 1.15 : 1);
  }
  const byoyomiSeconds = (rng) => Math.round(clamp(28 + rng.next() * 31 + gauss(rng) * 4, 10, control.byoyomi - 1));
  return {
    control,
    remaining,
    /**
     * @param {{ side: 'black' | 'white', ply: number, kind: string, gap: number, surprise: number, rng: { next(): number }, character?: any }} move
     *   gapは、候補の上位2手の勝率の差(ポイント。小さいほど迷う)。surpriseは、直前の手での形勢の動き(点)。
     */
    think({ side, ply, kind, gap, surprise, rng, character }) {
      const left = remaining[side];
      if (left <= 0) return byoyomiSeconds(rng);
      let seconds;
      if (kind === 'book' && ply < 24) {
        seconds = 5 + rng.next() * 70;
      } else {
        const movesLeft = Math.max(6, (plan.end - ply) / 2);
        const phase = phaseOf(plan, ply);
        const trouble = traitDegree(character, 'time-trouble');
        const phaseWeight = PHASE_TIME[phase] * (phase === 'middle' && trouble ? 1.3 + 0.3 * trouble : 1);
        const doubt = clamp(1 - gap / 20, 0, 1);
        seconds = (left / movesLeft) * phaseWeight * (0.55 + 0.9 * doubt) * (1 + 0.8 * Math.min(1, surprise / 500))
          * tempo[side] * Math.exp(gauss(rng) * 0.55);
        // ときどき長考(目安の3〜6倍)。
        if (ply >= 24 && rng.next() < 0.06 + 0.1 * doubt) seconds *= 2.5 + rng.next() * 3;
        seconds = Math.min(seconds, left * 0.35 + 30, 3 * 3600);
      }
      seconds = Math.max(2, Math.round(seconds));
      if (seconds >= left) {
        // 持ち時間を使い切って、秒読みの中で指した。
        const used = left + byoyomiSeconds(rng);
        remaining[side] = 0;
        return Math.round(used);
      }
      remaining[side] = left - seconds;
      return seconds;
    },
  };
}

/**
 * 1手ごとの残り時間・時刻・休憩(再生の画面で使う。棋譜の時間から毎回同じものを作る)。
 * clockは0:00からの分(指し終えた時刻)、dayは1か2。breaksは、その手のあとに入る休憩・封じ手。
 * @param {{ entries: { time: number }[] }} game
 * @param {ReturnType<typeof relayTimeControl>} control
 * @returns {{ remaining: { black: number, white: number }, byoyomi: { black: boolean, white: boolean }, clock: number, day: number,
 *   breaks: { kind: 'lunch' | 'dinner' | 'seal', from: number, to: number, day: number }[] }[]}
 *   0番目は対局開始(まだ指していない)、i番目はi手目を指したあと。
 */
export function relayTimeline(game, control) {
  const remaining = { black: control.main, white: control.main };
  const byoyomi = { black: false, white: false };
  let minute = control.start;
  let day = 1;
  const timeline = [{ remaining: { ...remaining }, byoyomi: { ...byoyomi }, clock: minute, day, breaks: [] }];
  const done = new Set();
  game.entries.forEach((entry, index) => {
    const side = sideOf(index);
    remaining[side] = Math.max(0, remaining[side] - entry.time);
    if (remaining[side] === 0) byoyomi[side] = true;
    minute += entry.time / 60;
    const breaks = [];
    for (const rest of control.breaks) {
      const id = `${day}-${rest.kind}`;
      if (!done.has(id) && minute >= rest.at) {
        done.add(id);
        breaks.push({ kind: rest.kind, from: Math.round(minute), to: Math.round(minute + rest.minutes), day });
        minute += rest.minutes;
      }
    }
    if (control.seal !== null && day === 1 && minute >= control.seal && index < game.entries.length - 1) {
      // 1日目の終わり。次の手が封じ手になり、2日目の朝に開ける。
      breaks.push({ kind: 'seal', from: Math.round(minute), to: control.start, day });
      day = 2;
      minute = control.start;
    }
    timeline.push({ remaining: { ...remaining }, byoyomi: { ...byoyomi }, clock: minute, day, breaks });
  });
  return timeline;
}

/** 分(0:00から)を「14:32」の形にする。 */
export function clockText(minute) {
  const value = Math.floor(minute) % (24 * 60);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

/** 秒を「4:12:30」「52:10」の形にする(残り時間)。 */
export function remainingText(seconds) {
  const value = Math.max(0, Math.round(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** 考えた時間の言葉(「12分」「1時間5分」「30秒」)。 */
export function thinkTimeText(seconds) {
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return `${value}秒`;
  const minutes = Math.round(value / 60);
  if (minutes < 60) return `${minutes}分`;
  return `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ''}`;
}
