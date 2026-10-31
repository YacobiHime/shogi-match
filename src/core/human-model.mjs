/**
 * 人間らしいCPU(docs/cpu-human-model-design.md)。Lv11〜39(もとの校正のLv。表示のLvではsource)で、
 * 「見えたものの中で最善を尽くし、弱さは見え方の限界から出す」ための、画面に依存しない部分。
 * - 気づきの表(6-2の表2)と、見えにくい手の倍率(3-3): humanPerception
 * - 判断のぶれ(4-3): 候補ごとに正規分布のぶれを1回引く。温度の抽選(ガンベルのぶれ)より裾が軽く、理由のない大損が出にくい
 * - 指す前の安全確認(4-5・5章): 1手で見える台無し(A級)・3手前後で見える台無し(B級)・小さな損を、レベルの確率で防ぐ
 * - 信念の式(4-2・13-3): 見えている駒の損得＋大局観の重み×(評価値−全部見えたときの駒の損得)。詰めろの見落とし
 * - 棋士の特徴のずれ(6-4・13-2): characterHuman
 * 着手の選び方そのもの(候補の挙げ方・読み)は aware-move-choice.mjs。
 */
import { Position } from 'tsshogi';
import { captureMoves, captureSearch, handPressureLoss, material, playLight, replyLoss } from './logic-position.mjs';
import { isKingAttacked, opponentOf, parseUsiMove, squareXY } from './piece-movement.mjs';

/** 台無しの手(5-2)。互角に近い局面から、1手でこれ以上失う手(または詰みを許す手)。 */
export const RUIN_LOSS = 800;
/** 小さな損(A級の300〜800)。 */
export const SMALL_LOSS = 300;
/** 見落とし率の上限(3-3)。 */
const MISS_CAP = 0.6;
/** 遠くからの利きとみなす距離(升)。 */
const FAR = 3;
/** 直前の手から遠い場所とみなす距離(升)。 */
const AWAY = 4;

/**
 * レベルごとの値(6-2の表2・表3)。点の間は直線で補う。lvはもとの校正のLv(表示のLvのsource)。
 * miss*: 見落とし率(major・minor: 直前の手の大駒・小駒への当たり、other: ほかの当たり、free: 取れる駒、fork: 両取り)。
 * prevent*: 指す前の確認で防ぐ確率(A: 1手で見える台無し、B: 3手前後で見える台無し、small: 1手で見える小さな損)。
 * sigma: 判断のぶれ(温度に掛ける倍率)。自己対局で今の強さにそろえて決めた(docs/difficulty-calibration.md)。
 * w: 大局観の重み、depth: 見えている取り合いの手数、mateSight: 相手の詰みに半分の確率で気づく手数(13-3)。
 * limitA・limitB: 1局で指してよい台無しの手の回数(A級・B級を分けて数える。6-2の表3)。点の間では上の点の値(表3の「16〜18」のように、その帯に入ったら下げる)。
 * k: 候補数の上限(6-2の表1)。上限で落ちる手は「目に付かなかった手」になる。初段前後を最大にし、上で絞る(上はエンジンの上位手がそのまま候補になる)。
 */
export const HUMAN_TABLE = Object.freeze([
  { lv: 11, major: 0.02, minor: 0.08, other: 0.15, free: 0.05, fork: 0.45, preventA: 0.9, preventB: 0.5, preventSmall: 0.5, sigma: 1.28, w: 0.5, depth: 2, mateSight: 2.4, limitA: 1, limitB: 2, k: 4 },
  { lv: 13, major: 0.015, minor: 0.07, other: 0.13, free: 0.05, fork: 0.42, preventA: 0.95, preventB: 0.6, preventSmall: 0.55, sigma: 1.28, w: 0.55, depth: 3, mateSight: 2.8, limitA: 1, limitB: 2, k: 4 },
  { lv: 15, major: 0.01, minor: 0.06, other: 0.11, free: 0.04, fork: 0.38, preventA: 0.98, preventB: 0.7, preventSmall: 0.6, sigma: 1.28, w: 0.6, depth: 4, mateSight: 3.2, limitA: 1, limitB: 2, k: 5 },
  { lv: 18, major: 0.005, minor: 0.04, other: 0.08, free: 0.03, fork: 0.32, preventA: 1, preventB: 0.8, preventSmall: 0.7, sigma: 1.28, w: 0.65, depth: 4, mateSight: 3.8, limitA: 0, limitB: 1, k: 5 },
  { lv: 20, major: 0, minor: 0.03, other: 0.07, free: 0.03, fork: 0.28, preventA: 1, preventB: 0.85, preventSmall: 0.75, sigma: 1.28, w: 0.7, depth: 5, mateSight: 4.2, limitA: 0, limitB: 1, k: 6 },
  { lv: 23, major: 0, minor: 0.02, other: 0.05, free: 0.02, fork: 0.22, preventA: 1, preventB: 0.92, preventSmall: 0.85, sigma: 1.28, w: 0.8, depth: 6, mateSight: 5.0, limitA: 0, limitB: 1, k: 6 },
  { lv: 25, major: 0, minor: 0.015, other: 0.04, free: 0.02, fork: 0.18, preventA: 1, preventB: 0.95, preventSmall: 0.9, sigma: 1.28, w: 0.85, depth: 6, mateSight: 5.5, limitA: 0, limitB: 1, k: 7 },
  { lv: 28, major: 0, minor: 0.005, other: 0.03, free: 0.01, fork: 0.13, preventA: 1, preventB: 1, preventSmall: 0.95, sigma: 1.28, w: 0.95, depth: 6, mateSight: 6.3, limitA: 0, limitB: 0, k: 7 },
  { lv: 30, major: 0, minor: 0, other: 0.02, free: 0.01, fork: 0.1, preventA: 1, preventB: 1, preventSmall: 0.95, sigma: 1.28, w: 1, depth: 6, mateSight: 7.0, limitA: 0, limitB: 0, k: 8 },
  { lv: 32, major: 0, minor: 0, other: 0.01, free: 0.005, fork: 0.06, preventA: 1, preventB: 1, preventSmall: 1, sigma: 1.28, w: 1, depth: 6, mateSight: 8.5, limitA: 0, limitB: 0, k: 8 },
  { lv: 35, major: 0, minor: 0, other: 0.003, free: 0, fork: 0.02, preventA: 1, preventB: 1, preventSmall: 1, sigma: 1.28, w: 1, depth: 6, mateSight: 10.5, limitA: 0, limitB: 0, k: 6 },
  { lv: 39, major: 0, minor: 0, other: 0, free: 0, fork: 0, preventA: 1, preventB: 1, preventSmall: 1, sigma: 1.28, w: 1, depth: 6, mateSight: 15, limitA: 0, limitB: 0, k: 3 },
].map((row) => Object.freeze(row)));

/**
 * もとの校正のLv(小数)の値。
 * @param {number} level
 */
export function humanSettingsForLevel(level) {
  const lv = Math.min(39, Math.max(11, Number(level) || 11));
  const upper = Math.max(1, HUMAN_TABLE.findIndex((row) => row.lv >= lv));
  const a = HUMAN_TABLE[upper - 1];
  const b = HUMAN_TABLE[upper];
  const t = b.lv === a.lv ? 0 : (lv - a.lv) / (b.lv - a.lv);
  const mix = (key) => Math.round((a[key] + (b[key] - a[key]) * t) * 10000) / 10000;
  return {
    miss: { major: mix('major'), minor: mix('minor'), other: mix('other'), free: mix('free'), fork: mix('fork') },
    prevent: { A: mix('preventA'), B: mix('preventB'), small: mix('preventSmall') },
    sigma: mix('sigma'),
    belief: { w: mix('w'), depth: Math.round(mix('depth')), mateSight: mix('mateSight') },
    limit: { A: t > 0 ? b.limitA : a.limitA, B: t > 0 ? b.limitB : a.limitB },
    candidates: Math.round(mix('k')),
  };
}

/** 序盤(作戦の定跡手があるうち)の判断のぶれの倍率(4-3・6-3)。定跡を覚えている人は、序盤では迷いが少ない。 */
export const OPENING_SIGMA_SCALE = 0.5;

/**
 * 1局の台無しの手の記録(手数と種類)を整える。待ったで戻した手(maxPly以降)と、形の違う値は捨てる。
 * @param {unknown} value
 * @param {number} maxPly
 * @returns {{ ply: number, kind: 'A' | 'B' }[]}
 */
export function normalizeHumanBlunders(value, maxPly = Infinity) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && Number.isInteger(entry.ply) && entry.ply >= 0 && entry.ply < maxPly && (entry.kind === 'A' || entry.kind === 'B'))
    .map(({ ply, kind }) => ({ ply, kind }));
}

/**
 * 選んだ手が台無し(A級・B級)なら記録に足す。plyはその手の手数(0始まり)。
 * @param {{ ply: number, kind: 'A' | 'B' }[]} records
 * @param {number} ply
 * @param {unknown} kind
 * @returns {{ ply: number, kind: 'A' | 'B' }[]}
 */
export function noteHumanBlunder(records, ply, kind) {
  const kept = normalizeHumanBlunders(records, ply);
  return kind === 'A' || kind === 'B' ? [...kept, { ply, kind: /** @type {'A' | 'B'} */ (kind) }] : kept;
}

/**
 * この手番で、まだ台無しの手を指してよいか(A級・B級を分けて、1局の上限まで。6-2の表3)。
 * limitがなければ(前の版の強さ設定)、nullを返す(呼ぶ側は今までの悪手の回数で決める)。
 * @param {{ A: number, B: number } | undefined} limit
 * @param {{ ply: number, kind: 'A' | 'B' }[]} records
 * @param {number} ply
 * @returns {{ A: boolean, B: boolean } | null}
 */
export function humanBlunderAllowance(limit, records, ply) {
  if (!limit) return null;
  const past = normalizeHumanBlunders(records, ply);
  const used = (kind) => past.filter((entry) => entry.kind === kind).length;
  return { A: used('A') < limit.A, B: used('B') < limit.B };
}

/** 確率をロジットでずらす。1は0.995から下げる(上げるときは1のまま)。 */
function shiftLogit(probability, delta) {
  if (!delta || !Number.isFinite(probability)) return probability;
  if (probability >= 1 && delta > 0) return 1;
  const p = Math.min(0.995, Math.max(1e-4, probability));
  return Math.round(1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + delta))) * 10000) / 10000;
}

/**
 * 棋士の特徴と能力の配分(player-character.mjsのつまみ)を、人間らしいCPUの値のずれにする(6-4・13-2)。
 * blindは見落とし率の倍率(×(1+blind)。負なら見落としにくい。視野の能力・視野の特殊能力)、
 * wShiftは大局観の重みのずれ(大局観の能力。1を超えない)、sightは相手の詰めろに気づく手数のずれ(受けの能力)。
 * docs/player-abilities-design.mdの13章。
 * @param {ReturnType<typeof humanSettingsForLevel>} human
 * @param {{ sharpen?: number, steady?: number, overlook?: number, loose?: number, mate?: number, blind?: number, nodes?: number,
 *   wShift?: number, sight?: number }} knobs
 */
export function characterHuman(human, { sharpen = 0, steady = 0, overlook = 0, loose = 0, mate = 0, blind = 0, nodes = 1, wShift = 0, sight = 0 } = {}) {
  const sharp = Math.min(1, Math.max(-1, sharpen));
  const missScale = 2 ** (-0.5 * sharp) * (1 - 0.3 * steady) * (1 + 0.8 * overlook) * (1 + 0.5 * loose) * (1 + Math.max(-0.8, blind));
  const preventShift = 1.0 * steady - 1.2 * overlook - 0.8 * loose;
  const round = (value) => Math.round(value * 10000) / 10000;
  const belief = human.belief ?? { w: 1, depth: 6, mateSight: 15 };
  return {
    ...human,
    miss: Object.fromEntries(Object.entries(human.miss).map(([key, value]) => [key, round(Math.min(MISS_CAP, value * missScale))])),
    prevent: Object.fromEntries(Object.entries(human.prevent).map(([key, value]) => [key, shiftLogit(value, preventShift)])),
    sigma: round(human.sigma * (1 - 0.15 * steady) * (1 + 0.25 * loose)),
    // うっかり・甘い棋士は、1局の上限も少し多い(今までの悪手の回数blunderLimitのずれと同じ向き)。
    ...(human.limit ? { limit: {
      A: Math.max(0, Math.round(human.limit.A + 0.5 * overlook)),
      B: Math.max(0, Math.round(human.limit.B + overlook + 0.5 * loose - 0.5 * steady)),
    } } : {}),
    belief: {
      ...belief,
      w: round(Math.min(1, Math.max(0.3, belief.w + wShift))),
      depth: Math.min(6, Math.max(1, belief.depth + (nodes >= 1.25 ? 1 : nodes <= 0.85 ? -1 : 0))),
      mateSight: round(Math.max(1, belief.mateSight + steady - 2 * overlook + 0.5 * mate + sight)),
    },
  };
}

const distance = (a, b) => {
  const p = squareXY(a);
  const q = squareXY(b);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
};

/** 見えにくさの倍率(3-3)。far: 遠くからの利き・遠くから取る、away: 直前の手から遠い、drop: 打つ手、back: 後ろへ下がる取り。 */
const HARDNESS = Object.freeze({ far: 1.6, away: 1.4, drop: 2, back: 1.6 });
const hardnessOf = (reasons) => reasons.reduce((factor, reason) => factor * HARDNESS[reason], 1);

/**
 * 当たりの見えにくさの理由。当たりが遠くからの利きか(far)、直前の手から遠い場所か(away)。
 * @param {{ square?: string, attackers?: string[] }} threat
 * @param {string} lastTo 直前の相手の手の行き先
 * @returns {('far' | 'away')[]}
 */
export function threatHardReasons(threat, lastTo = '') {
  const reasons = [];
  const attackers = threat.attackers ?? [];
  if (threat.square && attackers.length && attackers.every((from) => distance(from, threat.square) >= FAR)) reasons.push('far');
  if (threat.square && lastTo && distance(threat.square, lastTo) >= AWAY) reasons.push('away');
  return reasons;
}

/**
 * 見えにくさの倍率(3-3)。当たりが遠くからの利きか、直前の手から遠い場所か。
 * @param {{ square?: string, attackers?: string[], salience?: string }} threat
 * @param {string} lastTo 直前の相手の手の行き先
 */
export function threatHardness(threat, lastTo = '') {
  return hardnessOf(threatHardReasons(threat, lastTo));
}

/**
 * 1手の見えにくさの理由。打つ手(drop)・後ろへ下がる取り(back)・遠くからの取り(far)。
 * @param {string} usi
 * @param {'black' | 'white'} turn
 * @returns {('drop' | 'back' | 'far')[]}
 */
function moveHardReasons(usi, turn) {
  const parsed = parseUsiMove(usi);
  if (!parsed) return [];
  if (parsed.drop) return ['drop'];
  const reasons = [];
  const from = squareXY(parsed.from);
  const to = squareXY(parsed.to);
  const forward = turn === 'black' ? from.y - to.y : to.y - from.y;
  if (forward < 0) reasons.push('back');
  if (distance(parsed.from, parsed.to) >= FAR) reasons.push('far');
  return reasons;
}

/**
 * 機会の見えにくさの理由。いちばん見えやすい手で決める(どれか1つに気づけばよい)。
 * @param {{ moves?: string[] }} chance
 * @param {'black' | 'white'} turn
 */
export function chanceHardReasons(chance, turn) {
  const moves = chance.moves ?? [];
  if (!moves.length) return [];
  return moves.map((usi) => moveHardReasons(usi, turn))
    .reduce((easiest, reasons) => hardnessOf(reasons) < hardnessOf(easiest) ? reasons : easiest);
}

/**
 * 機会の見えにくさの倍率。打つ手(2.0)・後ろへ下がる取り(1.6)・遠くからの取り(1.6)。
 * @param {{ moves?: string[] }} chance
 * @param {'black' | 'white'} turn
 */
export function chanceHardness(chance, turn) {
  return hardnessOf(chanceHardReasons(chance, turn));
}

const missToSee = (miss, factor) => 1 - Math.min(MISS_CAP, Math.max(0, miss) * factor);

/**
 * この局面での気づきの確率(rollPerceptionに渡す形)。レベルの見落とし率に、見えにくさの倍率を掛ける。
 * @param {Record<string, number>} base 今の気づきの確率(hybridSettingsForLevelのperception)。決まっていない項目に使う
 * @param {ReturnType<typeof humanSettingsForLevel>} human
 * @param {{ threats: any[], chances: any[] }} awareness
 * @param {{ lastMove?: string, turn: 'black' | 'white' }} context
 */
export function humanPerception(base, human, awareness, { lastMove = '', turn }) {
  const lastTo = parseUsiMove(lastMove)?.to ?? '';
  const captures = awareness.threats.filter(({ kind }) => kind === 'capture' || kind === 'breakthrough');
  const salience = captures.map(({ salience }) => salience);
  const miss = salience.includes('last-move-major') ? human.miss.major
    : salience.includes('last-move-minor') ? human.miss.minor : human.miss.other;
  const hardness = captures.length ? Math.min(...captures.map((threat) => threatHardness(threat, lastTo))) : 1;
  const frees = awareness.chances.filter(({ kind }) => ['free-capture', 'winning-capture'].includes(kind));
  const forks = awareness.chances.filter(({ kind }) => kind === 'fork');
  return {
    ...base,
    hanging: missToSee(miss, hardness),
    freeCapture: missToSee(human.miss.free, frees.length ? Math.min(...frees.map((chance) => chanceHardness(chance, turn))) : 1),
    threat: missToSee(human.miss.fork, forks.length ? Math.min(...forks.map((chance) => chanceHardness(chance, turn))) : 1),
  };
}

/**
 * 標準正規分布の乱数(箱ミュラー法)。
 * @param {() => number} random
 */
export function gaussian(random) {
  const u = Math.max(1e-12, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * 判断のぶれ(4-3)で選ぶ。候補ごとにぶれを1回引き、信念(点＋ぶれ)が最大の手。
 * @template {{ score: number }} T
 * @param {T[]} entries
 * @param {number} sigma ぶれの標準偏差(点)
 * @param {() => number} random
 * @returns {T}
 */
export function pickByBelief(entries, sigma, random) {
  let best = entries[0];
  let bestBelief = -Infinity;
  for (const entry of entries) {
    const belief = entry.score + (sigma > 0 ? sigma * gaussian(random) : 0);
    if (belief > bestBelief) {
      best = entry;
      bestBelief = belief;
    }
  }
  return best;
}

/**
 * 指したあと、相手に1手詰めがあるか。詰みの探索(problem-solver.tsのfindMateLine)は呼ぶ側から渡す。
 * このモジュールを強さの表から読むNodeのスクリプトが、TypeScriptを読まずに済むように。
 * @param {string} sfen
 * @param {string} usi
 * @param {((sfen: string, plies: number, options: { nodeLimit: number, maxTimeMs: number }) => unknown) | null} [findMate]
 */
export function allowsMateInOne(sfen, usi, findMate = null) {
  if (!findMate) return false;
  try {
    const position = Position.newBySFEN(sfen);
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) return false;
    // 探索の上限に達した(undefined)ときは、詰みがあるとは言わない。
    const line = findMate(position.sfen, 1, { nodeLimit: 3000, maxTimeMs: 20 });
    return Array.isArray(line) && line.length > 0;
  } catch {
    return false;
  }
}

/**
 * 選んだ手の間違いの種類(5-1)。エンジンの損(reference - その手の評価)と、ロジックの取りの読みで見える損で決める。
 * - A: 1手(取り返しまで)で見える台無し(800以上)、または相手の1手詰めを許す
 * - B: 3手前後(取り合いを4手)で見える台無し
 * - small: 1手で見える300〜800の損
 * - null: 見えない深い損(C級)か、損ではない
 * 比べる基準は最善の候補の、同じ読みで見える損(もともと取られる駒がある局面で、どの手も損に見えるのを除く)。
 * allowedMateは、この手のあとの相手の詰みの手数(エンジンの評価値から)。1手詰めはA級、3手詰めはB級(5-1)。
 * @param {{ state: any, sfen: string, move: string, best: string, engineLoss: number, deadline?: number,
 *   findMate?: Parameters<typeof allowsMateInOne>[2], allowedMate?: number }} input
 * @returns {'A' | 'B' | 'small' | null}
 */
export function blunderKind({ state, sfen, move, best, engineLoss, deadline = Infinity, findMate = null, allowedMate = 0 }) {
  if (!(engineLoss >= SMALL_LOSS) || move === best) return null;
  if (engineLoss >= RUIN_LOSS && allowedMate === 1) return 'A';
  if (engineLoss >= RUIN_LOSS && allowsMateInOne(sfen, move, findMate) && !allowsMateInOne(sfen, best, findMate)) return 'A';
  if (engineLoss >= RUIN_LOSS && allowedMate > 0 && allowedMate <= 3) return 'B';
  const child = playLight(state, move);
  const base = playLight(state, best);
  const near = replyLoss(child, 2, deadline) - replyLoss(base, 2, deadline);
  if (engineLoss >= RUIN_LOSS && near >= RUIN_LOSS - 200) return 'A';
  if (near >= SMALL_LOSS) return 'small';
  if (engineLoss >= RUIN_LOSS && replyLoss(child, 4, deadline) - replyLoss(base, 4, deadline) >= RUIN_LOSS - 200) return 'B';
  return null;
}

/**
 * 指す前の確認(4-5)で、この手を止めるか。止める確率はレベルの値。
 * 1局の上限を使い切った種類の台無しは必ず止める。allowance(A級・B級を分けた残り)がなければ、今までの悪手の回数(blunderAllowed)で決める。
 * @param {'A' | 'B' | 'small' | null} kind
 * @param {ReturnType<typeof humanSettingsForLevel>['prevent']} prevent
 * @param {{ blunderAllowed: boolean, allowance?: { A: boolean, B: boolean } | null, random: () => number }} options
 */
export function preventsBlunder(kind, prevent, { blunderAllowed, allowance = null, random }) {
  if (!kind) return false;
  if (kind !== 'small' && (allowance ? !allowance[kind] : !blunderAllowed)) return true;
  return random() < (prevent[kind] ?? 1);
}

/**
 * 相手の取り合いの読みの損(replyLoss)のうち、CPUに見えている分(13-3)。
 * blindの升(気づかなかった当たり)への最初の取りを除き、取り合いはdepth手まで読む。
 * @param {ReturnType<typeof playLight>} state 候補を指したあとの局面(相手の手番)
 * @param {number} depth
 * @param {Set<string>} blind
 * @param {number} [deadline]
 */
export function seenReplyLoss(state, depth, blind, deadline = Infinity) {
  if (!blind.size) return replyLoss(state, depth, deadline);
  const side = state.turn;
  const standPat = material(state, side);
  let best = standPat;
  if (depth > 0) {
    for (const move of captureMoves(state.board, side)) {
      if (Date.now() >= deadline) break;
      if (blind.has(move.usi.slice(2, 4)) || move.king) continue;
      const child = playLight(state, move.usi);
      if (!child || isKingAttacked(child.board, side)) continue;
      best = Math.max(best, -captureSearch(child, depth - 1, -Infinity, Infinity, deadline));
    }
  }
  return Math.max(0, best - standPat) + handPressureLoss(state, opponentOf(side));
}

/** エンジンの評価値(手番側から見た候補の評価)が、相手に詰まされる形なら、その相手の詰みの手数(候補の手を除く)。 */
export function allowedMatePlies(score) {
  return score?.type === 'mate' && Number.isInteger(score.value) && score.value < 0 ? Math.max(1, Math.abs(score.value) - 1) : 0;
}

/** 詰みに気づく確率(4-3)。p(n) = 1 / (1 + exp(−(c − n)))。 */
export function mateSightChance(plies, sight) {
  return 1 / (1 + Math.exp(-(sight - plies)));
}

/**
 * 候補ごとの信念(4-2・13-3)。評価値の代わりに、CPUの目で見た良さで比べる。
 * - believed: CPUから見た評価値(損の上限の判定に使う)。気づかなかった詰めろ・見つけなかった詰みは、詰みのない候補の大局観の平均で見る(ふつうの手として比べる)
 * - belief: 見えている駒の損得＋w×大局観(好みは呼ぶ側で足す)
 * - mateUnseen: 気づかなかった相手の詰みの手数、ownMateUnseen: 見つけなかった自分の詰みの手数
 * 読みが時間の上限に届いたらnullを返す(呼ぶ側は評価値と好みで選ぶ)。
 * @template {{ move: string, engineValue: number, candidate?: { score?: { type: string, value: number } } }} T
 * @param {T[]} entries
 * @param {{ state: any, belief: { w: number, depth: number, mateSight: number }, blind?: Set<string>, random: () => number,
 *   blunderAllowed?: boolean, allowance?: { A: boolean, B: boolean } | null, ownMateMissed?: boolean, deadline?: number }} options
 * @returns {(T & { believed: number, belief: number, mateUnseen: number, ownMateUnseen: number })[] | null}
 */
export function beliefScores(entries, { state, belief, blind = new Set(), random, blunderAllowed = true, allowance = null, ownMateMissed = false, deadline = Infinity }) {
  const me = state.turn;
  const rows = [];
  for (const entry of entries) {
    const child = playLight(state, entry.move);
    if (!child) return null;
    const after = material(child, me);
    const full = after - replyLoss(child, 6, deadline);
    const seen = after - seenReplyLoss(child, belief.depth, blind, deadline);
    if (Date.now() >= deadline) return null;
    const score = entry.candidate?.score;
    const allowed = allowedMatePlies(score);
    // 1局の上限を使い切った種類の詰めろには必ず気づく(4-5)。1手詰めはA級、3手詰めまではB級、それより長い詰めろはC級で数えない(5-1・5-2)。
    const unseenAllowed = allowance ? (allowed === 1 ? allowance.A : allowed <= 3 ? allowance.B : true) : blunderAllowed;
    const mateUnseen = allowed && unseenAllowed && random() >= mateSightChance(allowed, belief.mateSight) ? allowed : 0;
    const ownMateUnseen = ownMateMissed && score?.type === 'mate' && score.value > 0 ? score.value : 0;
    rows.push({ entry, full, seen, hidden: Boolean(mateUnseen || ownMateUnseen), mateUnseen, ownMateUnseen });
  }
  // 詰みの見えない手は、詰みのない手の大局観の平均で見る(手がかりがないので、ふつうの手として比べる)。
  const plain = rows.filter(({ entry }) => entry.candidate?.score?.type !== 'mate');
  const referenceView = plain.length ? plain.reduce((sum, { entry, full }) => sum + entry.engineValue - full, 0) / plain.length : 0;
  return rows.map(({ entry, full, seen, hidden, mateUnseen, ownMateUnseen }) => {
    const view = hidden ? referenceView : entry.engineValue - full;
    return { ...entry, believed: full + view, belief: seen + belief.w * view, mateUnseen, ownMateUnseen };
  });
}
