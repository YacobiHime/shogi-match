// 形の点の重みを、プロの棋譜に合わせる(docs/disciple-mode-design.mdの40章のL2)。
// コンピューター将棋のBonanzaと同じ考え方を小さくしたもの: 局面ごとに、すべての合法手を指して取り合いを読み切った先(静止探索の末端)の形を数え、
// 「駒の損得＋形の点の重み×形の数」が、プロの指した手でいちばん大きくなるように重みを動かす(手ごとの点のソフトマックスで、プロの手の確率を上げる)。
// 駒の価値(logic-values.mjs)は動かさない。学ぶのは形の点の重み(十数個)と、点の物差しの温度だけ。
// アプリに入れるのは重みだけ(src/data/pro-shape-weights.mjs)。棋譜は入れない。
// 使い方:
//   node scripts/pro-shape-tune.mjs [--mode texel|choice] [--positions 12000] [--test 3000] [--every 3] [--l2 0.002] [--write] [--phase all|op|mid|end]
//     texel(既定)は対局の勝ち負けに合わせる。choiceはプロの指した手の確率を上げる(1手先の形だけで比べるので重みが極端になり、自己対局で弱くなった。40-8)。
//     一致率の道具(reason-match-report.mjs)が使う局(各時代のidの並びの先頭60局)は使わない。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importCSA } from 'tsshogi';
import { FastBoard, PAWN } from '../src/core/fast-board.mjs';
import { HAND_SHAPE_WEIGHTS, SHAPE_TERMS, evaluateTerms } from '../src/core/logic-search.mjs';
import { priorPhase } from '../src/core/move-prior.mjs';
import { createRng } from '../src/core/ryuo-random.mjs';
import { eraOf } from './fetch-pro-kifu.mjs';

const CACHE = '.kifu-cache';
const OUT = 'src/data/pro-shape-weights.mjs';
const HOLDOUT_PER_GROUP = 60;
const QDEPTH = 4;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const POSITIONS = Number(option('positions', '12000'));
const TEST = Number(option('test', '3000'));
const EVERY = Number(option('every', '3'));
const PHASE = option('phase', 'all');

/** 形を数えるための、重みがすべて1の表(evaluateTermsの項目がそのまま形の数になる)。 */
const UNIT = Object.fromEntries(SHAPE_TERMS.map((name) => [name, 1]));

function tryMake(board, move) {
  const color = board.turn;
  board.make(move);
  if (board.inCheck(color)) {
    board.unmake(move);
    return false;
  }
  if ((move & 127) === 81 + PAWN && board.inCheck() && !board.hasLegal()) {
    board.unmake(move);
    return false;
  }
  return true;
}

const material = (board) => evaluateTerms(board, { shape: false }).material;

/** 駒の損得だけの静止探索。読み筋(取る手の並び)を返す。点は手番の側から見た値。 */
function quiesce(board, alpha, beta, depth) {
  const stand = (board.turn === 0 ? 1 : -1) * material(board);
  if (depth <= 0 || stand >= beta || board.inCheck()) return { score: stand, pv: [] };
  let best = { score: stand, pv: [] };
  if (stand > alpha) alpha = stand;
  for (const move of board.pseudo([], { captures: true })) {
    if (!((board.sq[(move >> 7) & 127]))) continue;
    if (!tryMake(board, move)) continue;
    const child = quiesce(board, -beta, -alpha, depth - 1);
    board.unmake(move);
    const score = -child.score;
    if (score > best.score) best = { score, pv: [move, ...child.pv] };
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** 1手を指して取り合いを読み切った先の、駒の損得と形の数(指した側から見た値)。 */
function leafOf(board, move) {
  const mover = board.turn;
  board.make(move);
  const { pv } = quiesce(board, -1e9, 1e9, QDEPTH);
  for (const m of pv) board.make(m);
  const terms = evaluateTerms(board, { shape: 3, weights: UNIT });
  for (let i = pv.length - 1; i >= 0; i -= 1) board.unmake(pv[i]);
  board.unmake(move);
  const sign = mover === 0 ? 1 : -1;
  return { material: sign * terms.material, features: SHAPE_TERMS.map((name) => sign * terms[name]) };
}

// 局面を集める(学びに使う局から、EVERY手おきに)。
const index = JSON.parse(readFileSync(join(CACHE, 'index.json'), 'utf8'));
const byGroup = new Map();
for (const game of Object.values(index.games)) {
  if (!existsSync(join(CACHE, 'games', `${game.id}.csa`))) continue;
  const group = game.tournament === '奨励会' ? 'shoreikai' : eraOf(game.date.slice(0, 4));
  if (!group) continue;
  if (!byGroup.has(group)) byGroup.set(group, []);
  byGroup.get(group).push(game);
}
const games = [];
for (const list of byGroup.values()) games.push(...[...list].sort((a, b) => a.id.localeCompare(b.id)).slice(HOLDOUT_PER_GROUP));
const rng = createRng(17);
for (let i = games.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rng.next() * (i + 1));
  [games[i], games[j]] = [games[j], games[i]];
}

const K = SHAPE_TERMS.length;
const handW = SHAPE_TERMS.map((name) => HAND_SHAPE_WEIGHTS[name]);

/** 棋譜の勝った側(先手=1・後手=0・千日手=0.5)。最後に指した側が勝ち(投了は負けた側の手番)。 */
function winnerOf(text) {
  if (/%SENNICHITE/.test(text)) return 0.5;
  const moves = text.split('\n').filter((line) => /^[+-]\d{4}[A-Z]{2}/.test(line));
  const last = moves.at(-1);
  return last ? (last[0] === '+' ? 1 : 0) : null;
}

if (option('mode', 'texel') === 'texel') {
  // Texel法: 局面の点(駒の損得＋形の点)を、その対局の勝ち負けに合わせる。局面は取り合いを読み切った先(静止探索の末端)で数える。
  const rows = [];
  const startedT = Date.now();
  for (const game of games) {
    if (rows.length >= POSITIONS + TEST) break;
    const text = readFileSync(join(CACHE, 'games', `${game.id}.csa`), 'utf8');
    const result = winnerOf(text);
    if (result === null) continue;
    const record = importCSA(text);
    if (record instanceof Error) continue;
    const board = FastBoard.fromSfen(record.initialPosition.sfen);
    let ply = 0;
    for (let node = record.first.next; node && rows.length < POSITIONS + TEST; node = node.next) {
      const usi = node.move?.usi;
      if (typeof usi !== 'string') break;
      const move = board.legal().find((m) => board.toUsi(m) === usi);
      if (move === undefined) break;
      board.make(move);
      ply += 1;
      if (ply < 16 || ply % EVERY !== 0 || board.inCheck()) continue;
      const phase = priorPhase(ply);
      if (PHASE !== 'all' && PHASE !== phase) continue;
      const { pv } = quiesce(board, -1e9, 1e9, QDEPTH);
      for (const m of pv) board.make(m);
      const terms = evaluateTerms(board, { shape: 3, weights: UNIT });
      for (let i = pv.length - 1; i >= 0; i -= 1) board.unmake(pv[i]);
      rows.push({ mat: terms.material, f: SHAPE_TERMS.map((name) => terms[name]), y: result, phase });
    }
  }
  process.stderr.write(`集めた局面: ${rows.length} (${Math.round((Date.now() - startedT) / 1000)}秒)\n`);
  const trainT = rows.slice(0, POSITIONS);
  const testT = rows.slice(POSITIONS);
  const sd = new Float64Array(K).map((_, k) => {
    const xs = trainT.map((r) => r.f[k]);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1;
  });
  /** 勝つ見込み = 1/(1+exp(-点/C))。損失は交差エントロピー。 */
  const lossOf = (set, w, logC) => {
    const invC = Math.exp(-logC);
    let loss = 0;
    const grad = new Float64Array(K);
    let gC = 0;
    for (const r of set) {
      let e = r.mat;
      for (let k = 0; k < K; k += 1) e += w[k] * r.f[k];
      const p = 1 / (1 + Math.exp(-e * invC));
      const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
      loss -= r.y * Math.log(q) + (1 - r.y) * Math.log(1 - q);
      const d = (p - r.y) * invC;
      for (let k = 0; k < K; k += 1) grad[k] += d * r.f[k];
      gC += (p - r.y) * -e * invC;
    }
    const n = set.length;
    return { loss: loss / n, grad: grad.map((g) => g / n), gC: gC / n };
  };
  let logC = Math.log(600);
  for (let i = 0; i < 200; i += 1) logC -= 2 * lossOf(trainT, handW, logC).gC;
  const show = (label, w, c) => console.log(`${label}: 学び ${lossOf(trainT, w, c).loss.toFixed(4)} / 確かめ ${lossOf(testT, w, c).loss.toFixed(4)} (C=${Math.exp(c).toFixed(0)})`);
  show('手で決めた重み', handW, logC);
  let logC0 = logC;
  const zero = handW.map(() => 0);
  for (let i = 0; i < 200; i += 1) logC0 -= 2 * lossOf(trainT, zero, logC0).gC;
  show('駒の損得だけ', zero, logC0);
  const L2T = Number(option('l2', '0.002'));
  const u = handW.map((v, k) => v * sd[k]);
  const m1 = new Float64Array(K + 1);
  const m2 = new Float64Array(K + 1);
  for (let step = 1; step <= 600; step += 1) {
    const w = u.map((x, k) => x / sd[k]);
    const r = lossOf(trainT, w, logC);
    const g = [...r.grad.map((x, k) => x / sd[k] + L2T * 1e-4 * (u[k] - handW[k] * sd[k])), r.gC];
    for (let k = 0; k <= K; k += 1) {
      m1[k] = 0.9 * m1[k] + 0.1 * g[k];
      m2[k] = 0.999 * m2[k] + 0.001 * g[k] * g[k];
      const delta = (0.02 * (m1[k] / (1 - 0.9 ** step))) / (Math.sqrt(m2[k] / (1 - 0.999 ** step)) + 1e-8);
      if (k < K) u[k] -= delta * 100;
      else logC -= delta;
    }
    if (step % 100 === 0) process.stderr.write(`\r学び ${step}/600 ${r.loss.toFixed(5)}`);
  }
  process.stderr.write('\n');
  const learnedT = u.map((x, k) => x / sd[k]);
  show('学んだ重み', learnedT, logC);
  const roundedT = Object.fromEntries(SHAPE_TERMS.map((name, k) => [name, name === 'hand' ? Math.round(learnedT[k] * 1000) / 1000 : Math.round(learnedT[k])]));
  console.log('重み:', SHAPE_TERMS.map((name) => `${name} ${HAND_SHAPE_WEIGHTS[name]}→${roundedT[name]}`).join('、'));
  if (args.includes('--write')) {
    writeFileSync(OUT, `// 形の点の重み(docs/disciple-mode-design.mdの40章のL2)。scripts/pro-shape-tune.mjs --writeで作る。手で書き換えない。
// 将棋DB2のプロの棋譜(私的利用)の${trainT.length}局面で、取り合いを読み切った先の「駒の損得＋形の点」が、その対局の勝ち負けをいちばんよく当てるように合わせた重み(Texel法)。
// 駒の価値は動かしていない。棋譜そのものは入れていない。名前の意味はlogic-search.mjsのHAND_SHAPE_WEIGHTS。

export const PRO_SHAPE_WEIGHTS = Object.freeze(${JSON.stringify(roundedT)});
`);
    console.log(`${OUT} を書きました`);
  }
  process.exit(0);
}

/** 局面ごと: 手の数、プロの手の番号、手ごとの駒の損得と形の数。 */
const samples = [];
const started = Date.now();
for (const game of games) {
  if (samples.length >= POSITIONS + TEST) break;
  const record = importCSA(readFileSync(join(CACHE, 'games', `${game.id}.csa`), 'utf8'));
  if (record instanceof Error) continue;
  const board = FastBoard.fromSfen(record.initialPosition.sfen);
  let ply = 0;
  for (let node = record.first.next; node && samples.length < POSITIONS + TEST; node = node.next) {
    const usi = node.move?.usi;
    if (typeof usi !== 'string') break;
    const legal = board.legal();
    const pro = legal.find((m) => board.toUsi(m) === usi);
    if (pro === undefined) break;
    ply += 1;
    const phase = priorPhase(ply);
    if (ply % EVERY === 0 && legal.length >= 2 && (PHASE === 'all' || PHASE === phase)) {
      const mat = new Float64Array(legal.length);
      const feat = new Float64Array(legal.length * K);
      let proIndex = -1;
      legal.forEach((m, i) => {
        const leaf = leafOf(board, m);
        mat[i] = leaf.material;
        feat.set(leaf.features, i * K);
        if (m === pro) proIndex = i;
      });
      samples.push({ n: legal.length, pro: proIndex, mat, feat, phase });
    }
    board.make(pro);
  }
  if (samples.length && samples.length % 1000 < 3) process.stderr.write(`\r${samples.length}局面 (${Math.round((Date.now() - started) / 1000)}秒)`);
}
process.stderr.write(`\n集めた局面: ${samples.length} (${Math.round((Date.now() - started) / 1000)}秒)\n`);
const train = samples.slice(0, POSITIONS);
const test = samples.slice(POSITIONS);

// 物差しをそろえる: 形の数の大きさ(標準偏差)で割ってから学び、最後に戻す。
const scale = new Float64Array(K);
{
  const sum = new Float64Array(K);
  const sq = new Float64Array(K);
  let count = 0;
  for (const s of train) {
    for (let i = 0; i < s.n; i += 1) {
      for (let k = 0; k < K; k += 1) {
        const v = s.feat[i * K + k];
        sum[k] += v;
        sq[k] += v * v;
      }
      count += 1;
    }
  }
  for (let k = 0; k < K; k += 1) scale[k] = Math.sqrt(Math.max(1e-9, sq[k] / count - (sum[k] / count) ** 2)) || 1;
}

/** 点 = (駒の損得 + Σ w_k 形_k) / T。重みwは元の物差し、温度Tはlog(T)で持つ。 */
function evaluate(set, w, logT) {
  const invT = Math.exp(-logT);
  let nll = 0;
  let top1 = 0;
  const grad = new Float64Array(K);
  let gradLogT = 0;
  const byPhase = {};
  for (const s of set) {
    const scores = new Float64Array(s.n);
    let max = -Infinity;
    for (let i = 0; i < s.n; i += 1) {
      let v = s.mat[i];
      for (let k = 0; k < K; k += 1) v += w[k] * s.feat[i * K + k];
      scores[i] = v * invT;
      if (scores[i] > max) max = scores[i];
    }
    let z = 0;
    for (let i = 0; i < s.n; i += 1) z += Math.exp(scores[i] - max);
    const logZ = max + Math.log(z);
    nll += logZ - scores[s.pro];
    let best = 0;
    for (let i = 1; i < s.n; i += 1) if (scores[i] > scores[best]) best = i;
    const hit = best === s.pro ? 1 : 0;
    top1 += hit;
    const cell = (byPhase[s.phase] ??= { hit: 0, total: 0 });
    cell.hit += hit;
    cell.total += 1;
    // 勾配: E_p[f] - f_pro(点に1/Tが掛かる)。
    for (let i = 0; i < s.n; i += 1) {
      const p = Math.exp(scores[i] - logZ);
      const coef = (p - (i === s.pro ? 1 : 0)) * invT;
      for (let k = 0; k < K; k += 1) grad[k] += coef * s.feat[i * K + k];
      gradLogT += (p - (i === s.pro ? 1 : 0)) * -scores[i];
    }
  }
  const n = set.length;
  return { nll: nll / n, top1: top1 / n, grad: grad.map((g) => g / n), gradLogT: gradLogT / n, byPhase };
}

const report = (label, w, logT) => {
  const tr = evaluate(train, w, logT);
  const te = evaluate(test, w, logT);
  const phases = Object.entries(te.byPhase).map(([p, c]) => `${p} ${((c.hit / c.total) * 100).toFixed(1)}%`).join(' ');
  console.log(`${label}: 学び nll ${tr.nll.toFixed(3)} 一致 ${(tr.top1 * 100).toFixed(1)}% / 確かめ nll ${te.nll.toFixed(3)} 一致 ${(te.top1 * 100).toFixed(1)}% (${phases}) T=${Math.exp(logT).toFixed(0)}`);
  return te;
};

// 手で決めた重みでの温度を先に合わせる(比べるための出発点)。
let logT = Math.log(100);
for (let step = 0; step < 60; step += 1) logT -= 0.5 * evaluate(train, handW, logT).gradLogT;
report('手で決めた重み', handW, logT);
const zeroW = handW.map(() => 0);
let logT0 = logT;
for (let step = 0; step < 60; step += 1) logT0 -= 0.5 * evaluate(train, zeroW, logT0).gradLogT;
report('駒の損得だけ', zeroW, logT0);

// Adamで学ぶ(物差しをそろえた空間で。手で決めた重みから始め、手で決めた重みへ弱く引き戻す)。
const L2 = Number(option('l2', '0.002'));
let u = handW.map((v, k) => v * scale[k]);
const m = new Float64Array(K + 1);
const v2 = new Float64Array(K + 1);
const lr = 0.05;
for (let step = 1; step <= 400; step += 1) {
  const w = u.map((x, k) => x / scale[k]);
  const r = evaluate(train, w, logT);
  // u = w × 標準偏差なので、uでの勾配はwでの勾配÷標準偏差。手で決めた重みへの引き戻しは、点(cp)の差の2乗に比例。
  const g = [...r.grad.map((x, k) => x / scale[k] + L2 * 1e-4 * (u[k] - handW[k] * scale[k])), r.gradLogT];
  for (let k = 0; k <= K; k += 1) {
    m[k] = 0.9 * m[k] + 0.1 * g[k];
    v2[k] = 0.999 * v2[k] + 0.001 * g[k] * g[k];
    const step2 = (lr * (m[k] / (1 - 0.9 ** step))) / (Math.sqrt(v2[k] / (1 - 0.999 ** step)) + 1e-8);
    if (k < K) u[k] -= step2 * 100;
    else logT -= step2;
  }
  if (step % 50 === 0) process.stderr.write(`\r学び ${step}/400 nll ${r.nll.toFixed(4)}`);
}
process.stderr.write('\n');
const learned = u.map((x, k) => x / scale[k]);
report('学んだ重み', learned, logT);
const rounded = Object.fromEntries(SHAPE_TERMS.map((name, k) => [name, name === 'hand' ? Math.round(learned[k] * 1000) / 1000 : Math.round(learned[k])]));
console.log('重み:', SHAPE_TERMS.map((name, k) => `${name} ${HAND_SHAPE_WEIGHTS[name]}→${rounded[name]}`).join('、'));

if (args.includes('--write')) {
  writeFileSync(OUT, `// 形の点の重み(docs/disciple-mode-design.mdの40章のL2)。scripts/pro-shape-tune.mjs --writeで作る。手で書き換えない。
// 将棋DB2のプロの棋譜(私的利用)の${train.length}局面で、すべての合法手を指して取り合いを読み切った先の形を数え、
// プロの指した手の点がいちばん大きくなるように合わせた重み。駒の価値は動かしていない。棋譜そのものは入れていない。
// 名前の意味はlogic-search.mjsのHAND_SHAPE_WEIGHTS。

export const PRO_SHAPE_WEIGHTS = Object.freeze(${JSON.stringify(rounded)});
`);
  console.log(`${OUT} を書きました`);
}
