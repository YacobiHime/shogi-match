/**
 * 人間らしいCPU(docs/cpu-human-model-design.md)。Lv11〜39(もとの校正のLv。表示のLvではsource)で、
 * 「見えたものの中で最善を尽くし、弱さは見え方の限界から出す」ための、画面に依存しない部分。
 * - 気づきの表(6-2の表2)と、見えにくい手の倍率(3-3): humanPerception
 * - 判断のぶれ(4-3): 候補ごとに正規分布のぶれを1回引く。温度の抽選(ガンベルのぶれ)より裾が軽く、理由のない大損が出にくい
 * - 指す前の安全確認(4-5・5章): 1手で見える台無し(A級)・3手前後で見える台無し(B級)・小さな損を、レベルの確率で防ぐ
 * 着手の選び方そのもの(候補の挙げ方・読み)は aware-move-choice.mjs。
 */
import { Position } from 'tsshogi';
import { playLight, replyLoss } from './logic-position.mjs';
import { parseUsiMove, squareXY } from './piece-movement.mjs';

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
 */
export const HUMAN_TABLE = Object.freeze([
  { lv: 11, major: 0.02, minor: 0.08, other: 0.15, free: 0.05, fork: 0.45, preventA: 0.9, preventB: 0.5, preventSmall: 0.5, sigma: 1.28 },
  { lv: 13, major: 0.015, minor: 0.07, other: 0.13, free: 0.05, fork: 0.42, preventA: 0.95, preventB: 0.6, preventSmall: 0.55, sigma: 1.28 },
  { lv: 15, major: 0.01, minor: 0.06, other: 0.11, free: 0.04, fork: 0.38, preventA: 0.98, preventB: 0.7, preventSmall: 0.6, sigma: 1.28 },
  { lv: 18, major: 0.005, minor: 0.04, other: 0.08, free: 0.03, fork: 0.32, preventA: 1, preventB: 0.8, preventSmall: 0.7, sigma: 1.28 },
  { lv: 20, major: 0, minor: 0.03, other: 0.07, free: 0.03, fork: 0.28, preventA: 1, preventB: 0.85, preventSmall: 0.75, sigma: 1.28 },
  { lv: 23, major: 0, minor: 0.02, other: 0.05, free: 0.02, fork: 0.22, preventA: 1, preventB: 0.92, preventSmall: 0.85, sigma: 1.28 },
  { lv: 25, major: 0, minor: 0.015, other: 0.04, free: 0.02, fork: 0.18, preventA: 1, preventB: 0.95, preventSmall: 0.9, sigma: 1.28 },
  { lv: 28, major: 0, minor: 0.005, other: 0.03, free: 0.01, fork: 0.13, preventA: 1, preventB: 1, preventSmall: 0.95, sigma: 1.28 },
  { lv: 30, major: 0, minor: 0, other: 0.02, free: 0.01, fork: 0.1, preventA: 1, preventB: 1, preventSmall: 0.95, sigma: 1.28 },
  { lv: 32, major: 0, minor: 0, other: 0.01, free: 0.005, fork: 0.06, preventA: 1, preventB: 1, preventSmall: 1, sigma: 1.28 },
  { lv: 35, major: 0, minor: 0, other: 0.003, free: 0, fork: 0.02, preventA: 1, preventB: 1, preventSmall: 1, sigma: 1.28 },
  { lv: 39, major: 0, minor: 0, other: 0, free: 0, fork: 0, preventA: 1, preventB: 1, preventSmall: 1, sigma: 1.28 },
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
  };
}

const distance = (a, b) => {
  const p = squareXY(a);
  const q = squareXY(b);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
};

/**
 * 見えにくさの倍率(3-3)。当たりが遠くからの利きか、直前の手から遠い場所か。
 * @param {{ square?: string, attackers?: string[], salience?: string }} threat
 * @param {string} lastTo 直前の相手の手の行き先
 */
export function threatHardness(threat, lastTo = '') {
  let factor = 1;
  const attackers = threat.attackers ?? [];
  if (threat.square && attackers.length && attackers.every((from) => distance(from, threat.square) >= FAR)) factor *= 1.6;
  if (threat.square && lastTo && distance(threat.square, lastTo) >= AWAY) factor *= 1.4;
  return factor;
}

/**
 * 機会の見えにくさの倍率。打つ手(2.0)・後ろへ下がる取り(1.6)・遠くからの取り(1.6)。
 * @param {{ moves?: string[] }} chance
 * @param {'black' | 'white'} turn
 */
export function chanceHardness(chance, turn) {
  const moves = chance.moves ?? [];
  if (!moves.length) return 1;
  // いちばん見えやすい手で決める(どれか1つに気づけばよい)。
  return Math.min(...moves.map((usi) => {
    const parsed = parseUsiMove(usi);
    if (!parsed) return 1;
    if (parsed.drop) return 2;
    let factor = 1;
    const from = squareXY(parsed.from);
    const to = squareXY(parsed.to);
    const forward = turn === 'black' ? from.y - to.y : to.y - from.y;
    if (forward < 0) factor *= 1.6;
    if (distance(parsed.from, parsed.to) >= FAR) factor *= 1.6;
    return factor;
  }));
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
 * @param {{ state: any, sfen: string, move: string, best: string, engineLoss: number, deadline?: number,
 *   findMate?: Parameters<typeof allowsMateInOne>[2] }} input
 * @returns {'A' | 'B' | 'small' | null}
 */
export function blunderKind({ state, sfen, move, best, engineLoss, deadline = Infinity, findMate = null }) {
  if (!(engineLoss >= SMALL_LOSS) || move === best) return null;
  if (engineLoss >= RUIN_LOSS && allowsMateInOne(sfen, move, findMate) && !allowsMateInOne(sfen, best, findMate)) return 'A';
  const child = playLight(state, move);
  const base = playLight(state, best);
  const near = replyLoss(child, 2, deadline) - replyLoss(base, 2, deadline);
  if (engineLoss >= RUIN_LOSS && near >= RUIN_LOSS - 200) return 'A';
  if (near >= SMALL_LOSS) return 'small';
  if (engineLoss >= RUIN_LOSS && replyLoss(child, 4, deadline) - replyLoss(base, 4, deadline) >= RUIN_LOSS - 200) return 'B';
  return null;
}

/**
 * 指す前の確認(4-5)で、この手を止めるか。止める確率はレベルの値。1局の悪手の回数を使い切った(blunderAllowed=false)ら、台無しは必ず止める。
 * @param {'A' | 'B' | 'small' | null} kind
 * @param {ReturnType<typeof humanSettingsForLevel>['prevent']} prevent
 * @param {{ blunderAllowed: boolean, random: () => number }} options
 */
export function preventsBlunder(kind, prevent, { blunderAllowed, random }) {
  if (!kind) return false;
  if (!blunderAllowed && kind !== 'small') return true;
  return random() < (prevent[kind] ?? 1);
}
