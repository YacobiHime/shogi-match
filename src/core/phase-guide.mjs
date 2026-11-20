// 序盤のあとの補助(docs/phase-guide-design.md)。定跡の案内が終わった欄を、中盤は「作戦ボード」、終盤は「寄せの速度計」にする。
// 答えの手は言わず、考える場所(方針・玉の堅さ・攻める筋・詰めろの有無)だけを出す。
// エンジンの読みは、やこび姫の助言がすでに読んだもの(reading)だけを使い、ここでは探索しない。
import { attackersOf, findKing, opponentOf, parseSfenState, squareXY, xySquare } from './piece-movement.mjs';
import { isEndgame } from './coach-insight.mjs';
import { POLICY_MATERIAL_MARGIN } from './coach-advice.mjs';
import { detectTesujiShape } from './tesuji-shape.mjs';
import { detectTesuji } from './move-tesuji.mjs';

/** 定跡の案内が何も出さなくなってから、作戦ボードを出し始める手数(3章)。 */
export const MIDDLE_MIN_PLY = 20;
/** 方針の「形勢が良い・悪い」の境目(プレイヤーから見た評価値。助言の中盤の方針と同じ)。 */
const POLICY_SCORE_MARGIN = 300;
/** 玉のまわり8升のうち、この数だけ相手の利きがあれば「迫っている」(isEndgameと同じ)。 */
const PRESSURE_SQUARES = 3;
/** 守り駒に数える駒(relay-commentary.mjsのkingGuardと同じ)。 */
const GUARD_KINDS = new Set(['G', 'S', '+P', '+L', '+N', '+S']);

export const PHASE_GUIDE_TEXT = Object.freeze({
  middleTitle: '作戦ボード',
  endgameTitle: '寄せの速度計',
  middleIntro: '囲いの時間はおしまい。ここからは作戦ボードで方針を見よう',
  endgameIntro: 'どちらの玉が先に詰むか、ここで見よう',
  myKing: 'あなたの玉',
  theirKing: '相手の玉',
  attackKing: '相手玉',
  ownKing: '自玉',
  tesuji: '使えそうな手筋があるよ。閃きで答えを見られるよ',
  safety: { 3: '堅い', 2: 'ふつう', 1: '薄い' },
  attackLevels: { 1: 'まだ遠い', 2: '迫っている', 3: '詰めろをかけられる', 4: '詰みがある' },
  riskLevels: { 1: '安全', 2: '迫られている', 3: '詰めろ', 4: '王手' },
});

/** 玉のまわり8升。 */
function neighbors(square) {
  const { x, y } = squareXY(square);
  const result = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const next = (dx || dy) ? xySquare(x + dx, y + dy) : null;
      if (next) result.push(next);
    }
  }
  return result;
}

/** 玉のまわり8升のうち、相手の利きがある升の数。 */
function kingPressure(board, color) {
  const king = findKing(board, color);
  if (!king) return 0;
  const enemy = opponentOf(color);
  return neighbors(king).filter((square) => attackersOf(board, square, enemy).length > 0).length;
}

/**
 * 玉の堅さ(4章の2)。目盛り = 1 + 守り駒 + 穴熊なら1 − 相手の利きがある玉のまわりの升の数÷2(切り捨て)。0〜5。
 * @param {string} sfen @param {'black' | 'white'} color
 * @returns {{ pips: number, word: string, guards: number, pressure: number, anaguma: boolean } | null}
 */
export function kingSafety(sfen, color) {
  const { board } = parseSfenState(sfen);
  const king = findKing(board, color);
  if (!king) return null;
  const around = new Set(neighbors(king));
  let guards = 0;
  for (const [square, piece] of board) {
    if (piece.color === color && around.has(square) && GUARD_KINDS.has(piece.kind)) guards += 1;
  }
  const anaguma = (color === 'black' ? ['9i', '1i'] : ['1a', '9a']).includes(king);
  const pressure = kingPressure(board, color);
  const pips = Math.max(0, Math.min(5, 1 + guards + (anaguma ? 1 : 0) - Math.floor(pressure / 2)));
  const word = PHASE_GUIDE_TEXT.safety[pips >= 4 ? 3 : pips >= 2 ? 2 : 1];
  return { pips, word, guards, pressure, anaguma };
}

/**
 * 攻める筋(4章の3)。相手玉の筋と左右2筋のうち、相手玉から自分の側へ3段の升で「自分の利きの数 − 相手の利きの数」が
 * いちばん大きく、自分の利きが2つ以上ある筋。なければnull。
 * @param {string} sfen @param {'black' | 'white'} color 攻める側(プレイヤー)
 * @returns {number | null} 筋(1〜9)
 */
export function attackFile(sfen, color) {
  const { board } = parseSfenState(sfen);
  const enemy = opponentOf(color);
  const king = findKing(board, enemy);
  if (!king) return null;
  const { x: kx, y: ky } = squareXY(king);
  // 相手玉の前(先手が攻めるなら段の数が増える方、つまり盤の下側)。
  const toward = color === 'black' ? 1 : -1;
  let best = null;
  for (let x = kx - 2; x <= kx + 2; x += 1) {
    if (x < 1 || x > 9) continue;
    let mine = 0;
    let theirs = 0;
    for (let step = 0; step <= 2; step += 1) {
      const square = xySquare(x, ky + step * toward);
      if (!square) continue;
      mine += attackersOf(board, square, color).length;
      theirs += attackersOf(board, square, enemy).filter(({ kind }) => kind !== 'K').length;
    }
    if (mine < 2) continue;
    const margin = mine - theirs;
    // 同じ差なら、相手玉に近い筋。
    if (!best || margin > best.margin || (margin === best.margin && Math.abs(x - kx) < Math.abs(best.x - kx))) {
      best = { x, margin };
    }
  }
  return best && best.margin > 0 ? best.x : null;
}

/** 最善手が名前の付いた手筋か(4章の4)。 */
export function bestMoveIsTesuji(sfen, bestMove) {
  if (!bestMove) return false;
  try {
    return Boolean(detectTesujiShape({ sfenBefore: sfen, usi: bestMove })) || detectTesuji({ sfenBefore: sfen, usi: bestMove }).length > 0;
  } catch {
    return false;
  }
}

/**
 * どの段階か(3章)。定跡の案内が何かを出しているあいだはopening(この欄は出さない)。
 * いちど終盤に入ったら、その対局では終盤のまま(玉のまわりの利きで判定するので、1手ごとに中盤と行き来しないように)。
 * @param {{ sfen: string, ply: number, openingShown: boolean, reachedEndgame?: boolean }} input
 *   reachedEndgame: この対局の、今より前の手で終盤に入ったか。
 * @returns {'opening' | 'middle' | 'endgame'}
 */
export function guidePhase({ sfen, ply, openingShown, reachedEndgame = false }) {
  if (openingShown) return 'opening';
  if (reachedEndgame || isEndgame(sfen, ply)) return 'endgame';
  return ply >= MIDDLE_MIN_PLY ? 'middle' : 'opening';
}

/**
 * @typedef {{ score?: { type: string, value: number } | null, mateThreat?: boolean | null, bestMove?: string,
 *   bestGivesCheck?: boolean, bestGivesMateThreat?: boolean | null }} PhaseReading
 *   助言の読み(今の局面のものだけ)。scoreはプレイヤーから見た値。mateThreatは自玉が詰めろか(確かめていなければnull)。
 */

/**
 * 作戦ボード(4章)。
 * @param {{ sfen: string, color: 'black' | 'white', materialDiff?: number | null, reading?: PhaseReading | null }} input
 *   materialDiff: プレイヤーから見た駒の損得(piece-points.mjsのmaterialBalanceの差。歩=90)。
 */
export function middleBoard({ sfen, color, materialDiff = null, reading = null }) {
  const mine = kingSafety(sfen, color);
  const theirs = kingSafety(sfen, opponentOf(color));
  const file = attackFile(sfen, color);
  const score = reading?.score?.type === 'cp' && Number.isFinite(reading.score.value) ? reading.score.value : null;
  const material = Number.isFinite(materialDiff) ? Number(materialDiff) : 0;
  const up = material >= POLICY_MATERIAL_MARGIN;
  const down = material <= -POLICY_MATERIAL_MARGIN;
  let policy = null;
  if (score !== null && score >= POLICY_SCORE_MARGIN && up) policy = { key: 'ahead-up', text: '駒を交換して、局面を単純に' };
  else if (score !== null && score >= POLICY_SCORE_MARGIN && down) policy = { key: 'ahead-down', text: '攻めの勢いがある。手を緩めない' };
  else if (score !== null && score <= -POLICY_SCORE_MARGIN && down) policy = { key: 'behind-down', text: '交換を避けて、複雑にして粘る' };
  else if (score !== null && score <= -POLICY_SCORE_MARGIN && up) policy = { key: 'behind-up', text: '駒得はしてる。守りを固めてしのぐ' };
  else if (score === null && up) policy = { key: 'up', text: '駒得。駒を交換して、局面を単純に' };
  else if (score === null && down) policy = { key: 'down', text: '駒損。交換を避けて、粘ろう' };
  else if (mine && theirs && theirs.pips - mine.pips >= 2) policy = { key: 'fortify', text: 'まず玉を固めよう' };
  else if (file) policy = { key: 'attack-file', text: `攻めるなら${file}筋に駒を集めよう` };
  else policy = { key: 'activate', text: '駒を前に出して、働かせよう' };
  return {
    phase: /** @type {'middle'} */ ('middle'),
    title: PHASE_GUIDE_TEXT.middleTitle,
    policy,
    kings: [
      { side: 'mine', label: PHASE_GUIDE_TEXT.myKing, ...(mine ?? { pips: 0, word: '' }) },
      { side: 'theirs', label: PHASE_GUIDE_TEXT.theirKing, ...(theirs ?? { pips: 0, word: '' }) },
    ],
    // 方針で筋を言ったときは、同じことを2回言わない。
    file: policy.key === 'attack-file' ? null : file,
    fileText: file && policy.key !== 'attack-file' ? `攻めるなら${file}筋（相手の守りが手薄だよ）` : '',
    tesuji: bestMoveIsTesuji(sfen, reading?.bestMove ?? ''),
  };
}

/**
 * 寄せの速度計(5章)。
 * @param {{ sfen: string, color: 'black' | 'white', reading?: PhaseReading | null }} input
 */
export function endgameGauge({ sfen, color, reading = null }) {
  const { board } = parseSfenState(sfen);
  const enemy = opponentOf(color);
  const ownKing = findKing(board, color);
  const inCheck = Boolean(ownKing && attackersOf(board, ownKing, enemy).length);
  const score = reading?.score ?? null;
  const winMate = score?.type === 'mate' && score.value > 0;
  const attack = winMate ? 4
    : reading?.bestGivesMateThreat === true ? 3
      : kingPressure(board, enemy) >= PRESSURE_SQUARES ? 2 : 1;
  const risk = inCheck ? 4
    : reading?.mateThreat === true ? 3
      : kingPressure(board, color) >= PRESSURE_SQUARES ? 2 : 1;
  let action;
  if (attack === 4) action = { key: 'mate', text: '詰ませにいこう' };
  else if (risk === 4) action = { key: 'check', text: '王手をしのごう' };
  else if (risk === 3 && reading?.bestGivesCheck) action = { key: 'threat-check', text: '王手で迫りながら、しのごう' };
  else if (risk === 3) action = { key: 'threat-defend', text: 'まず受けよう' };
  else if (attack === 3) action = { key: 'race', text: '詰めろをかけて、攻め合いで勝とう' };
  else if (risk === 2 && attack === 1) action = { key: 'defend-first', text: '一手かけて守ろう' };
  else action = { key: 'approach', text: '相手玉に迫る手を探そう' };
  return {
    phase: /** @type {'endgame'} */ ('endgame'),
    title: PHASE_GUIDE_TEXT.endgameTitle,
    action,
    attack: { level: attack, label: PHASE_GUIDE_TEXT.attackKing, text: PHASE_GUIDE_TEXT.attackLevels[attack] },
    risk: { level: risk, label: PHASE_GUIDE_TEXT.ownKing, text: PHASE_GUIDE_TEXT.riskLevels[risk] },
  };
}

// ---- はじめての1行を見た印(3章。phase-guide:v1)

export const PHASE_GUIDE_KEY = 'yacobihime:shogi-match:phase-guide:v1';

/** @returns {{ middle: boolean, endgame: boolean }} */
export function loadPhaseIntroSeen(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(PHASE_GUIDE_KEY) ?? 'null');
    return { middle: Boolean(raw?.middle), endgame: Boolean(raw?.endgame) };
  } catch {
    return { middle: false, endgame: false };
  }
}

/** @param {'middle' | 'endgame'} phase */
export function markPhaseIntroSeen(phase, storage = globalThis.localStorage) {
  const seen = { ...loadPhaseIntroSeen(storage), [phase]: true };
  try {
    storage?.setItem(PHASE_GUIDE_KEY, JSON.stringify(seen));
  } catch {
    // 保存できなくても遊べる。
  }
  return seen;
}
