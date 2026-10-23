/**
 * やこび姫の作戦の助言(段階1: 飛車を振る提案)。設計は docs/coach-plan-advice-design.md。
 * 詳しい助言で読んだ上位の候補手のうち、最善手が飛車を振る手で、振らない手より十分に良いとき、
 * 「右四間飛車にしたら？」「四間飛車に振り直したら？」と作戦の名前で提案する。
 * 根拠の点数は、2手に絞って深く読み直した値(confirmPlanAdvice)を出す。
 */
import { CASTLE_TIPS } from './coach-advice.mjs';
import { COUNTER_STRATEGY_TIPS, counterStrategyText } from './counter-strategy.mjs';
import { openingExplanation } from './opening-explanations.mjs';

/** 最善手の飛車を振る手が、振らない一番の手より何点以上良ければ提案するか(浅い読み)。 */
export const PLAN_SWING_MARGIN = 80;
/** 2手に絞って深く読み直したとき、何点以上の差が残れば提案するか。 */
export const PLAN_SWING_CONFIRM_MARGIN = 60;
/** 差がこれより大きいときは、作戦ではなく駒の取り合い(飛車が逃げる・取る手)なので言わない。 */
export const PLAN_SWING_MAX_GAIN = 300;
/** 形勢がこれより傾いていたら、方針より目の前の手が大事なので言わない。 */
export const PLAN_SWING_MAX_SCORE = 1500;
/** 何手目まで提案するか(振り直しは中盤でも促す)。 */
export const PLAN_SWING_MAX_PLY = 80;
/** 1局に出す作戦の助言の数。 */
export const PLAN_ADVICE_PER_GAME = 2;
/** 確かめの読みの量。 */
export const PLAN_CONFIRM_SEARCH = Object.freeze({
  standard: { nodes: 200000, maxTimeMs: 3000 },
  compact: { nodes: 100000, maxTimeMs: 2000 },
});

/**
 * 行き先の筋(プレイヤーから見た筋。先手の筋の数字)と作戦。fromは動かす前に飛車がいてよい筋。
 * 1筋・9筋にいる飛車は、振った飛車ではなく端へ逃げた飛車なので、どの行き先でも数えない。
 */
export const ROOK_SWING_PLANS = Object.freeze([
  { file: 3, planId: 'sodebisha', strategyId: 'sodebisha', label: '袖飛車', from: [2, 4] },
  { file: 4, planId: 'right-shiken', strategyId: 'right-shiken', label: '右四間飛車', from: [2, 3] },
  { file: 5, planId: 'nakabisha', strategyId: 'nakabisha', label: '中飛車' },
  { file: 6, planId: 'shiken', strategyId: 'shiken', label: '四間飛車' },
  { file: 7, planId: 'sangen', strategyId: 'sangen', label: '三間飛車' },
  { file: 8, planId: 'mukai', strategyId: 'mukai', label: '向かい飛車' },
]);
const HOME_FILE = 2;
const RANK_LETTERS = 'abcdefghi';

/** SFENの盤から、USIのマス(例 "2h")にある駒の文字(成り駒は"+R"など)を返す。 */
function pieceAt(sfen, square) {
  const rows = String(sfen ?? '').trim().split(/\s+/)[0]?.split('/') ?? [];
  const file = Number(square[0]);
  const rank = RANK_LETTERS.indexOf(square[1]);
  const row = rows[rank];
  if (!row || !file) return '';
  let column = 9;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (/\d/.test(char)) {
      column -= Number(char);
      continue;
    }
    const piece = char === '+' ? `+${row[++index]}` : char;
    if (column === file) return piece;
    column -= 1;
  }
  return '';
}

/**
 * 候補手が「飛車を振る手」なら、その作戦を返す。
 * 成っていない自分の飛車が、自陣の飛車の段(先手は8段目、後手は2段目)で横に動く手。
 * @param {string} sfen 指す前の局面
 * @param {string} usi
 * @param {"black" | "white"} color プレイヤー(指す側)
 */
export function rookSwing(sfen, usi, color) {
  const match = /^([1-9])([a-i])([1-9])([a-i])$/.exec(String(usi ?? ''));
  if (!match) return null;
  const [, fromFile, fromRank, toFile, toRank] = match;
  const homeRank = color === 'white' ? 'b' : 'h';
  if (fromRank !== homeRank || toRank !== homeRank) return null;
  if (pieceAt(sfen, `${fromFile}${fromRank}`) !== (color === 'white' ? 'r' : 'R')) return null;
  // プレイヤーから見た筋。後手は盤の数字を反転する。
  const view = (file) => (color === 'white' ? 10 - Number(file) : Number(file));
  const from = view(fromFile);
  const plan = ROOK_SWING_PLANS.find((entry) => entry.file === view(toFile));
  if (!plan || from === plan.file) return null;
  if (from < 2 || from > 8 || (plan.from && !plan.from.includes(from))) return null;
  return { ...plan, boardFile: Number(toFile), reswing: from !== HOME_FILE };
}

function comparable(score) {
  if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
  if (score?.type === 'mate' && Number.isFinite(score.value)) return score.value > 0 ? 100000 - score.value : -100000 - score.value;
  return undefined;
}

const PLAN_TOPIC_PREFIX = 'plan-';

/** 相手の戦型への対策の台詞が、その作戦を勧めていれば、相手の戦型の名前を返す。 */
function compatibleOpponent(plan, opponentFormations) {
  const furibisha = plan.file >= 5;
  // 「右四間飛車」の中の「四間飛車」を拾わない。
  const mentions = (text) => new RegExp(`(?<!右)${plan.label}`).test(text ?? '');
  for (const tip of COUNTER_STRATEGY_TIPS) {
    const name = tip.names.find((candidate) => opponentFormations.includes(candidate));
    if (name && mentions(counterStrategyText(tip, furibisha))) return name;
  }
  for (const tip of CASTLE_TIPS) {
    const name = tip.names.find((candidate) => opponentFormations.includes(candidate));
    if (name && mentions(furibisha ? tip.furibisha ?? tip.text : tip.text)) return name;
  }
  return '';
}

/** 提案の理由。相手の戦型との相性 → 作戦のねらい → AIの読み、の順で1つ。 */
export function planAdviceReason(plan, opponentFormations = []) {
  const opponent = compatibleOpponent(plan, opponentFormations);
  if (opponent) return `相手の${opponent}と相性がいい形だよ！`;
  const aim = openingExplanation(plan.strategyId)?.aim?.replace(/[！!。]+$/, '');
  if (aim) return `狙いは「${aim}」だよ！`;
  return 'AIの読みでも、いちばんの手だよ！';
}

/** 提案の台詞。筋の数字は盤に書いてある数字で言う。 */
export function planAdviceText(swing, opponentFormations = []) {
  const verb = swing.reswing ? '振り直して' : '振って';
  return `飛車を${swing.boardFile}筋に${verb}、${swing.label}にしたら？ ${planAdviceReason(swing, opponentFormations)}`;
}

/**
 * 詳しい助言の上位の候補手から、飛車を振る提案を作る。出さないときはnull。
 * 候補手の点数はプレイヤーから見た値にしておく。
 * @param {{
 *   candidates?: { rank?: number, move?: string, score?: { type: string, value: number } | null }[],
 *   sfen?: string, color?: "black" | "white", moveCount?: number, inCheck?: boolean, mateThreat?: boolean, rookUnderThreat?: boolean,
 *   selectedStrategy?: string, opponentFormations?: string[], advisedTopics?: Iterable<string>,
 * }} [options]
 */
export function planAdvice({
  candidates = [],
  sfen = '',
  color = 'black',
  moveCount = 0,
  inCheck = false,
  mateThreat = false,
  rookUnderThreat = false,
  selectedStrategy = '',
  opponentFormations = [],
  advisedTopics = [],
} = {}) {
  // 飛車が取られそうなときの横の動きは、逃げる手(危険の知らせが言う)。
  if (inCheck || mateThreat || rookUnderThreat || moveCount > PLAN_SWING_MAX_PLY) return null;
  const ranked = candidates
    .filter((candidate) => Number.isInteger(candidate?.rank) && candidate.rank >= 1 && candidate.move)
    .sort((left, right) => left.rank - right.rank);
  const best = ranked[0];
  if (best?.rank !== 1 || best.score?.type !== 'cp' || Math.abs(best.score.value) > PLAN_SWING_MAX_SCORE) return null;
  const swing = rookSwing(sfen, best.move, color);
  if (!swing || swing.strategyId === selectedStrategy) return null;
  const topics = [...advisedTopics];
  if (topics.includes(`${PLAN_TOPIC_PREFIX}${swing.planId}`)) return null;
  if (topics.filter((topic) => topic.startsWith(PLAN_TOPIC_PREFIX)).length >= PLAN_ADVICE_PER_GAME) return null;
  // 振らない手のうち、いちばん良い手と比べる(ほかの筋へ振る手も「振る手」として外す)。
  const other = ranked.find((candidate) => candidate !== best && !rookSwing(sfen, candidate.move, color));
  const bestValue = comparable(best.score);
  const otherValue = comparable(other?.score);
  if (!other || otherValue === undefined) return null;
  const gain = bestValue - otherValue;
  if (gain < PLAN_SWING_MARGIN || gain > PLAN_SWING_MAX_GAIN) return null;
  return {
    key: `plan-swing-${swing.planId}`,
    topic: `${PLAN_TOPIC_PREFIX}${swing.planId}`,
    text: planAdviceText(swing, opponentFormations),
    swing,
    swingMove: best.move,
    otherMove: other.move,
    swingScore: best.score,
    otherScore: other.score,
  };
}

/**
 * 2手に絞って深く読み直した結果で、提案を確かめる。差が残れば点数を読み直した値に替えて返し、残らなければnull。
 * @param {ReturnType<typeof planAdvice>} advice
 * @param {{ move?: string, score?: { type: string, value: number } | null }[]} confirmed プレイヤーから見た点数
 */
export function confirmPlanAdvice(advice, confirmed = []) {
  if (!advice) return null;
  const swing = confirmed.find((candidate) => candidate?.move === advice.swingMove);
  const other = confirmed.find((candidate) => candidate?.move === advice.otherMove);
  const swingValue = comparable(swing?.score);
  const otherValue = comparable(other?.score);
  if (swingValue === undefined || otherValue === undefined) return null;
  const gain = swingValue - otherValue;
  if (swing?.score?.type !== 'cp' || gain < PLAN_SWING_CONFIRM_MARGIN || gain > PLAN_SWING_MAX_GAIN) return null;
  return { ...advice, swingScore: swing.score, otherScore: other?.score ?? null };
}

/**
 * 提案のあとに飛車を振ったら、次の手番でほめる。同じ作戦の筋へ振った手ならほめる。
 * @param {{ swing: { planId: string, label: string } } | null} advice
 */
export function planSwingPraise(advice, { sfen = '', usi = '', color = 'black' } = {}) {
  if (!advice) return null;
  const played = rookSwing(sfen, usi, color);
  if (played?.planId !== advice.swing.planId) return null;
  return { key: `plan-swing-done-${played.planId}`, text: `${played.label}だね！ AIの読みと同じ、いい判断だよ！` };
}

/** 作戦の助言で「にする」を押した作戦。まだ使えない段でも作戦カードで選べるようにする(戦法占いと同じ)。 */
export const COACH_PLANS_KEY = 'yacobihime:shogi-match:coach-plans:v1';
const COACH_PLAN_IDS = ROOK_SWING_PLANS.map(({ planId }) => planId);

/** @param {Storage | null | undefined} storage */
export function loadCoachPlans(storage) {
  try {
    const value = JSON.parse(storage?.getItem(COACH_PLANS_KEY) ?? 'null');
    return Array.isArray(value?.plans) ? value.plans.filter((id) => COACH_PLAN_IDS.includes(id)) : [];
  } catch {
    return [];
  }
}

/** @param {Storage | null | undefined} storage @param {string} planId */
export function recordCoachPlan(storage, planId) {
  const plans = [...new Set([...loadCoachPlans(storage), planId])].filter((id) => COACH_PLAN_IDS.includes(id));
  try {
    storage?.setItem(COACH_PLANS_KEY, JSON.stringify({ plans }));
  } catch {
    // 保存できない環境では、この対局のあいだだけ使える。
  }
  return plans;
}
