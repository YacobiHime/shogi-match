// 脳トレの将棋の棚の3種目(docs/brain-training-design.mdの12章)。将棋の力を、将棋の盤と駒の上で練習する。
// - 直観の一手: 局面と3本の矢印から、時間内にいちばん良い手を選ぶ。
// - 思い込み外し: 最初に目に付く手(得する駒取りか王手)より良い手を、盤で指して答える。
// - 目隠しの詰将棋: 盤は初めの局面のまま、手順を文字で進め、最後の詰ませる手を3つから選ぶ。
// 問題の元は、棋力テストの束(エンジンで確かめた局面)と問題集の詰将棋。データは画面が読み込んで渡す(この処理は持たない)。
import { Position } from 'tsshogi';
import { enumerateLegalMoves } from '../game-state';
import { materialSwing, profitableCaptures } from './skill-test-promise.mjs';

/** 直観の一手の段。秒は選ぶ時間、maxBは出す問題の難しさの上限(棋力テストの束のb。Lvの目安)。 */
export const INTUITION_LEVELS = Object.freeze([
  { seconds: 7, maxB: 12 },
  { seconds: 6, maxB: 16 },
  { seconds: 5, maxB: 20 },
  { seconds: 4, maxB: 26 },
  { seconds: 3, maxB: 32 },
  { seconds: 2, maxB: 99 },
].map((level) => Object.freeze(level)));
export const INTUITION_MAX_LEVEL = INTUITION_LEVELS.length - 1;

/** 目隠しの詰将棋の段。pliesは詰みの手数、hideは手順の文字を最後まで見せないか(1手ずつ出して消す)。 */
export const BLIND_LEVELS = Object.freeze([
  { plies: 3, hide: false },
  { plies: 3, hide: true },
  { plies: 5, hide: false },
  { plies: 5, hide: true },
  { plies: 7, hide: false },
  { plies: 7, hide: true },
].map((level) => Object.freeze(level)));
export const BLIND_MAX_LEVEL = BLIND_LEVELS.length - 1;

/** 思い込み外しの1回の問題数。 */
export const EINSTELLUNG_COUNT = 6;

/** 文字列から決まる数(問題ごとに選択肢の並びを固定する)。 */
function hashOf(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const positionOf = (sfen) => /** @type {Position} */ (Position.newBySFEN(sfen));
const legalOf = (sfen) => enumerateLegalMoves(positionOf(sfen)).map(({ usi }) => usi);
const destination = (usi) => usi.slice(2, 4);

/** 指したあとの局面(合法でなければnull)。 */
export function afterMove(sfen, usi) {
  const position = positionOf(sfen);
  const move = position.createMoveByUSI(usi);
  if (!move || !position.doMove(move)) return null;
  return position;
}

/** 王手になる手か。 */
export function givesCheck(sfen, usi) {
  return Boolean(afterMove(sfen, usi)?.checked);
}

/** 詰ませる手か(王手で、相手に合法手がない)。 */
export function givesMate(sfen, usi) {
  const position = afterMove(sfen, usi);
  return Boolean(position?.checked) && enumerateLegalMoves(position).length === 0;
}

/**
 * 最初に目に付く手。正解でない手のうち、得する駒取り(取る駒の得の大きい順)、なければ王手。なければnull。
 * 手筋の問題では、正解でない手はどれも最善より200以上悪い(docs/skill-assessment-design.mdの10-4)。
 * @param {string} sfen @param {readonly string[]} accepted
 */
export function temptingMove(sfen, accepted) {
  const others = legalOf(sfen).filter((usi) => !accepted.includes(usi));
  const captures = profitableCaptures(sfen, others).sort((a, b) => materialSwing(sfen, b) - materialSwing(sfen, a) || (a < b ? -1 : 1));
  if (captures.length) return { usi: captures[0], kind: /** @type {'capture' | 'check'} */ ('capture') };
  const checks = others.filter((usi) => givesCheck(sfen, usi)).sort();
  return checks.length ? { usi: checks[0], kind: /** @type {'capture' | 'check'} */ ('check') } : null;
}

/**
 * 正解のほかに見せる手(n本)。目に付く手(得する駒取り・王手)を先に、行き先の升が重ならないように選ぶ。
 * avoidの手(正解など)とも行き先を重ねない(盤の札A・B・Cが重ならないように)。
 * @param {string} sfen @param {readonly string[]} exclude 選ばない手 @param {readonly string[]} avoid 行き先を重ねない手 @param {number} count
 * @param {(usi: string) => boolean} [allow]
 */
function distractors(sfen, exclude, avoid, count, allow = () => true) {
  const others = legalOf(sfen).filter((usi) => !exclude.includes(usi) && allow(usi));
  const seed = hashOf(sfen);
  const order = (list) => [...list].sort((a, b) => (hashOf(`${seed}:${a}`) - hashOf(`${seed}:${b}`)));
  const captures = order(profitableCaptures(sfen, others));
  const checks = order(others.filter((usi) => givesCheck(sfen, usi) && !captures.includes(usi)));
  const rest = order(others.filter((usi) => !captures.includes(usi) && !checks.includes(usi)));
  const picked = [];
  const used = new Set(avoid.map(destination));
  for (const usi of [...captures, ...checks, ...rest]) {
    if (picked.length >= count) break;
    if (used.has(destination(usi))) continue;
    used.add(destination(usi));
    picked.push(usi);
  }
  return picked;
}

/** 並びを問題ごとに混ぜる(正解がいつもAにならないように)。 */
function shuffled(list, key) {
  return [...list].sort((a, b) => hashOf(`${key}:${a}`) - hashOf(`${key}:${b}`));
}

/**
 * 直観の一手の問題の束。棋力テストの手筋と判断の問題から作る。
 * 判断の問題は3択のまま、手筋の問題は正解と、正解でない合法手2つ(目に付く手を先に)。行き先の升が重なる問題は使わない。
 * @param {readonly any[]} bank 棋力テストの束(SKILL_TEST_BANK)
 */
export function intuitionPool(bank) {
  const pool = [];
  for (const item of bank) {
    if (item.type !== 'judge' && item.type !== 'tactic') continue;
    let choices = item.choices ? [...item.choices] : null;
    if (!choices) {
      const others = distractors(item.sfen, item.accepted, [item.best], 2);
      if (others.length < 2) continue;
      choices = shuffled([item.best, ...others], item.id);
    }
    if (new Set(choices.map(destination)).size !== choices.length) continue;
    pool.push(Object.freeze({
      id: item.id, sfen: item.sfen, b: item.b, best: item.best,
      accepted: Object.freeze([...(item.accepted ?? [item.best])].filter((usi) => choices.includes(usi))),
      choices: Object.freeze(choices), tesuji: item.tesuji ?? '', line: item.line ?? [],
    }));
  }
  return Object.freeze(pool.sort((a, b) => a.b - b.b || (a.id < b.id ? -1 : 1)));
}

/**
 * 段に合った問題を1つ選ぶ。まだ出していない、難しさが段の上限以下の問題から、seedで選ぶ。足りなければ、出した問題も使う。
 * @param {readonly any[]} pool @param {number} level @param {number} seed @param {ReadonlySet<string>} [used]
 */
export function pickProblem(pool, level, seed, used = new Set(), maxB = Infinity) {
  const fits = pool.filter((problem) => (problem.b ?? 0) <= maxB);
  const fresh = fits.filter(({ id }) => !used.has(id));
  const list = fresh.length ? fresh : fits.length ? fits : pool;
  if (!list.length) return null;
  return list[Math.abs(Math.floor(seed)) % list.length];
}

/** 直観の一手の段に合った問題。 */
export function pickIntuition(pool, level, seed, used = new Set()) {
  const { maxB } = INTUITION_LEVELS[Math.max(0, Math.min(INTUITION_MAX_LEVEL, level))];
  return pickProblem(pool, level, seed, used, maxB);
}

/** 直観の一手の答え合わせ。時間切れ(null)はまちがえと同じ。 */
export function scoreChoice(problem, usi) {
  return { correct: Boolean(usi) && problem.accepted.includes(usi) };
}

/**
 * 思い込み外しの問題の束。正解でない「得する駒取り」か「王手」がある、棋力テストの手筋の問題。
 * @param {readonly any[]} bank
 */
export function einstellungPool(bank) {
  const pool = [];
  for (const item of bank) {
    if (item.type !== 'tactic') continue;
    const tempting = temptingMove(item.sfen, item.accepted);
    if (!tempting) continue;
    pool.push(Object.freeze({
      id: item.id, sfen: item.sfen, b: item.b, best: item.best, accepted: Object.freeze([...item.accepted]),
      tempting: tempting.usi, temptingKind: tempting.kind, tesuji: item.tesuji ?? '', line: item.line ?? [],
    }));
  }
  return Object.freeze(pool.sort((a, b) => a.b - b.b || (a.id < b.id ? -1 : 1)));
}

/**
 * 思い込み外しで盤に指した手の判定。正解、目に付く手(数えずにもう一度)、ほかの手(まちがえ)。
 * @returns {'correct' | 'tempting' | 'wrong'}
 */
export function judgeEinstellung(problem, usi) {
  if (problem.accepted.includes(usi)) return 'correct';
  if (usi === problem.tempting) return 'tempting';
  return 'wrong';
}

/**
 * 目隠しの詰将棋の問題の束。問題集の詰将棋(作意手順のある3・5・7手詰め)。
 * @param {readonly { id: string, sfen: string, line: string }[]} problems
 */
export function blindMatePool(problems) {
  return Object.freeze(problems
    .map((problem) => ({ id: problem.id, sfen: problem.sfen, line: problem.line.trim().split(/\s+/) }))
    .filter(({ line }) => [3, 5, 7].includes(line.length))
    .map((problem) => Object.freeze({ ...problem, line: Object.freeze(problem.line) })));
}

/**
 * 目隠しの詰将棋の1問(段の手数)。最後の手の前の局面で、正解(最後の手)と、詰まない手2つ(王手を先に)の3択。
 * 最後の手の前までを文字で見せる(shown)。作れなければnull。
 * @param {readonly any[]} pool @param {number} level @param {number} seed @param {ReadonlySet<string>} [used]
 */
export function blindMateProblem(pool, level, seed, used = new Set()) {
  const { plies, hide } = BLIND_LEVELS[Math.max(0, Math.min(BLIND_MAX_LEVEL, level))];
  const fits = pool.filter(({ line }) => line.length === plies);
  const fresh = fits.filter(({ id }) => !used.has(id));
  const list = fresh.length ? fresh : fits;
  for (let offset = 0; offset < list.length; offset += 1) {
    const base = list[(Math.abs(Math.floor(seed)) + offset) % list.length];
    const shown = base.line.slice(0, -1);
    const position = positionOf(base.sfen);
    const sfens = [base.sfen];
    let ok = true;
    for (const usi of shown) {
      const move = position.createMoveByUSI(usi);
      if (!move || !position.doMove(move)) {
        ok = false;
        break;
      }
      sfens.push(position.sfen);
    }
    if (!ok) continue;
    const lastSfen = sfens.at(-1);
    const answer = base.line.at(-1);
    if (!givesMate(lastSfen, answer)) continue;
    const others = distractors(lastSfen, [answer], [answer], 2, (usi) => !givesMate(lastSfen, usi));
    if (others.length < 2) continue;
    return Object.freeze({
      id: base.id, plies, hide, sfen: base.sfen, shown: Object.freeze(shown), sfens: Object.freeze(sfens),
      lastSfen, answer, choices: Object.freeze(shuffled([answer, ...others], base.id)),
    });
  }
  return null;
}

/** 段の記録の見せ方(直観: n秒で選べた、目隠し: 5手詰め(手順を隠して))。valueは段+1。 */
export function intuitionLevelText(value) {
  const level = INTUITION_LEVELS[Math.max(0, Math.min(INTUITION_MAX_LEVEL, value - 1))];
  return `${level.seconds}秒で選べた`;
}
export function blindLevelText(value) {
  const level = BLIND_LEVELS[Math.max(0, Math.min(BLIND_MAX_LEVEL, value - 1))];
  return `${level.plies}手詰め${level.hide ? "（手順を隠して）" : ""}`;
}
