/**
 * やこび姫の助言の強化、段階1(docs/coach-advice-expansion-design.md)。
 * - N1 最善手の翻訳: 最善手の種類(タダで取る・手筋・王手・打つ…)を、答えを言わずに言葉にする
 * - N4 見逃し: 指す前にあった詰み・タダの駒を、指した手で逃したとき
 * - N5 相手のミス: CPUが読みの最善より大きく悪い手を指したとき
 * - N8 弱点の記憶: 前の対局の弱点(play-insight.mjsのdetectWeaknesses)を、始めの一言と乗り越えたときのほめ言葉に使う
 * - N10 ほめる: AIと同じ手の連続・狙いを受けた・自分で詰ませた・チャンスを生かした
 * 段階2(10章): N7 閃きの3段階(言葉 → 動かす駒 → 矢印)・N3 終盤の方針(攻めるか受けるか)。
 * 段階3(11章): N6 格言・N9 大会の物語・N11 もう一言(「なぜ？」とさっきの話)。
 * どれも、すでに読んでいる結果だけを使い、新しい探索は足さない。台詞はこのファイルにまとめる。
 */
import { detectTesuji } from './move-tesuji.mjs';
import { exchangeGain, captureSwing } from './exchange-eval.mjs';
import { value } from './logic-position.mjs';
import { mateLineByChecks } from './engine-mate-check.mjs';
import {
  applyUsiToBoard, attackedSquares, attackersOf, findKing, isKingAttacked, opponentOf, parseSfenState, parseUsiMove, squareXY,
} from './piece-movement.mjs';

const PIECE_NAMES = Object.freeze({
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛車', K: '玉',
  '+P': 'と金', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '竜',
});
const RANK_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const BIG_PIECES = new Set(['B', 'R', '+B', '+R']);

/**
 * 「教える」助言(最善手の種類。評価の崖のときは除く)を、続けて言わない手数(プレイヤーの4手 = 8手)。
 * しゃべりすぎないため(docs/coach-advice-expansion-design.mdの2章、G:9-1)。
 */
export const INSIGHT_INTERVAL_PLIES = 8;

/** 飛車・角の利きがこれだけ増える手を「眠っている大駒を働かせる手」とする。 */
export const ACTIVATE_MIN_GAIN = 3;
/** 守りの手とする、自玉からの距離(玉のまわり2升まで)。 */
const DEFEND_DISTANCE = 2;

function squareText(square) {
  const { x, y } = squareXY(square);
  return `${x}${RANK_KANJI[y - 1] ?? ''}`;
}

function bigPieceReach(board, color) {
  let total = 0;
  const reach = new Map();
  for (const [square, piece] of board) {
    if (piece.color !== color || !BIG_PIECES.has(piece.kind)) continue;
    const count = attackedSquares(board, square, piece).length;
    reach.set(square, { kind: piece.kind, count });
    total += count;
  }
  return { total, reach };
}

function distance(a, b) {
  const p = squareXY(a);
  const q = squareXY(b);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
}

/**
 * 手番の側の1手の種類(N1)。助言で「何があるか」を、答え(どの手か)を言わずに言うのに使う。
 * 上から先に当たったものにする: タダで取る → 手筋 → 駒得の取り → 王手 → 逃げる → 打つ → 大駒を働かせる → 守る → 取り合い。
 * @param {string} sfen 手番の側が指す前の局面
 * @param {string} usi
 * @returns {{ kind: 'free-capture' | 'tesuji' | 'capture-gain' | 'check' | 'escape' | 'drop' | 'activate' | 'defend' | 'capture',
 *   piece?: string, captured?: string, square?: string, tesuji?: string } | null}
 */
export function moveMeaning(sfen, usi) {
  const { board, turn } = parseSfenState(sfen);
  const parsed = parseUsiMove(usi);
  const applied = parsed ? applyUsiToBoard(board, usi, turn) : null;
  if (!parsed || !applied) return null;
  const enemy = opponentOf(turn);
  const after = applied.board;
  const to = applied.moved.to;
  const captured = applied.captured && applied.captured.kind !== 'K' ? applied.captured.kind : '';
  // 取ったあと、相手が取り返して得をするか(取り合いの計算。CPUと同じ)。
  const recapture = captured ? exchangeGain(after, to, enemy, { mode: 'full' }).gain : 0;
  if (captured && recapture === 0) return { kind: 'free-capture', captured, square: to };
  const tesuji = detectTesuji({ sfenBefore: sfen, usi }).find((id) => TESUJI_HINT_LINES[id]);
  if (tesuji) return { kind: 'tesuji', tesuji };
  if (captured && captureSwing(captured) - recapture >= captureSwing('N')) return { kind: 'capture-gain', captured, square: to };
  if (isKingAttacked(after, enemy)) return { kind: 'check' };
  const mover = parsed.drop ? null : board.get(parsed.from);
  if (mover && mover.kind !== 'K' && exchangeGain(board, parsed.from, enemy, { mode: 'full' }).gain > 0
    && exchangeGain(after, to, enemy, { mode: 'full' }).gain === 0) {
    return { kind: 'escape', piece: mover.kind };
  }
  if (parsed.drop) return { kind: 'drop', piece: parsed.drop };
  const before = bigPieceReach(board, turn);
  const reachAfter = bigPieceReach(after, turn);
  if (reachAfter.total - before.total >= ACTIVATE_MIN_GAIN) {
    // いちばん利きが増えた大駒の名前で言う(動かした大駒なら行き先の駒)。
    let best = { kind: 'B', gain: -Infinity };
    for (const [square, { kind, count }] of reachAfter.reach) {
      const old = before.reach.get(square)?.count ?? (mover && square === to ? before.reach.get(parsed.from)?.count ?? 0 : 0);
      if (count - old > best.gain) best = { kind, gain: count - old };
    }
    return { kind: 'activate', piece: best.kind };
  }
  const king = findKing(after, turn);
  if (mover && (mover.kind === 'K'
    || (['G', 'S'].includes(mover.kind) && !captured && king && distance(to, king) <= DEFEND_DISTANCE))) {
    return { kind: 'defend', piece: mover.kind };
  }
  if (captured) return { kind: 'capture', captured, square: to };
  return null;
}

/** 手筋の形があるときの一言(答えの手は言わない)。 */
const TESUJI_HINT_LINES = Object.freeze({
  'head-gold': '「頭金」の形が見えるよ！',
  'double-check': '「両王手」ができそうだよ！',
  'knight-fork': '「ふんどしの桂」の両取りがありそう！',
  'knight-check': '桂の王手が効きそうだよ！',
  'rook-cross-fork': '「十字飛車」の両取りがありそう！',
  'belly-silver': '「腹銀」で迫れそうだよ！',
  'tapping-pawn': '「叩きの歩」が効きそう！',
  'gold-bottom-pawn': '「金底の歩」で守りを固められそう！',
  'tokin-on-53': 'と金を作って迫れそうだよ！',
});

/**
 * N1の一言。キーは評価の崖(`candidate-evaluation-cliff`)の続きにして、今の優先度と急ぎの扱いをそのまま使う。
 * @param {ReturnType<typeof moveMeaning>} meaning
 * @returns {{ key: string, text: string } | null}
 */
export function meaningAdvice(meaning) {
  if (!meaning) return null;
  const key = `candidate-evaluation-cliff-${meaning.kind}`;
  const name = PIECE_NAMES[meaning.piece ?? ''] ?? '';
  switch (meaning.kind) {
    case 'free-capture': return { key, text: 'タダで取れる駒があるよ！ 探してみて' };
    case 'tesuji': return { key: `${key}-${meaning.tesuji}`, text: TESUJI_HINT_LINES[meaning.tesuji ?? ''] ?? '手筋が使えそうだよ！' };
    case 'capture-gain': return { key, text: '駒得できるチャンスだよ！ 取れる駒を探してみて' };
    case 'check': return { key, text: '王手から迫れそうだよ！' };
    case 'escape': return { key, text: `${name || '大事な駒'}がねらわれてるよ。先に逃がそう！` };
    case 'drop': return { key: `${key}-${meaning.piece}`, text: `持ち駒の${name}が光る場面だよ！` };
    case 'activate': return { key, text: `眠ってる${name}を働かせる手がありそう！` };
    case 'defend': return { key, text: '守りの一手が大事な場面だよ。玉のまわりを見てみよう' };
    case 'capture': return { key, text: '駒を取り合う勝負どころだよ。どの駒で取るか、よく読もう！' };
    default: return null;
  }
}

function comparable(score) {
  if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
  if (score?.type === 'mate' && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

/** 見逃したタダの駒として言う、取れた駒の最小の値打ち(銀以上)。 */
const MISSED_CAPTURE_MIN = value('S');
/** 見逃した詰みとして言う、いちばん長い手数(これより長い詰みは、勝ちの局面の一手の違いにすぎない)。 */
export const MISSED_MATE_MAX_PLIES = 9;
/** 見逃しとして言う、指した手の損(プレイヤーから見た点)。 */
export const MISSED_LOSS = 300;

/**
 * N4 見逃し。指す前にあった詰み・タダの駒を、指した手で逃したとき。悪手の指摘より具体的なので、こちらを先に言う。
 * @param {{ sfenBefore: string, playedUsi: string, before?: { type: string, value: number } | null,
 *   after?: { type: string, value: number } | null, beforePv?: readonly string[] }} input
 *   before・after: 指す前と指したあとの評価(プレイヤーから見た値)。beforePv: 指す前の読み筋(最善手から)。
 * @returns {{ key: string, text: string } | null}
 */
export function missedChanceAdvice({ sfenBefore, playedUsi, before = null, after = null, beforePv = [] }) {
  if (!before || !after) return null;
  // 長い詰み(MISSED_MATE_MAX_PLIESより長い)は、見つけてほしい見逃しではないので言わない。
  if (before.type === 'mate' && before.value > 0 && !(after.type === 'mate' && after.value > 0)) {
    if (before.value > MISSED_MATE_MAX_PLIES) return null;
    const plies = before.value;
    const byChecks = mateLineByChecks(sfenBefore, beforePv, plies);
    return {
      key: `move-missed-mate-${plies}`,
      text: byChecks === true
        ? `いま、${plies}手詰めがあったよ！ 次は王手の続く手から探してみよう`
        : `いま、${plies}手で詰ませる手順があったよ！ 次は相手の玉の逃げ道から考えてみよう`,
    };
  }
  const best = beforePv[0];
  const beforeValue = comparable(before);
  const afterValue = comparable(after);
  if (!best || best === playedUsi || beforeValue === undefined || afterValue === undefined) return null;
  const loss = beforeValue - afterValue;
  const meaning = moveMeaning(sfenBefore, best);
  if (meaning?.kind !== 'free-capture' || !meaning.captured || !meaning.square) return null;
  const worth = value(meaning.captured);
  // 損が、取れた駒の分で説明できるときだけ(ほかの悪手が重なっているときは、悪手の理由のほうを言う)。
  if (worth < MISSED_CAPTURE_MIN || loss < MISSED_LOSS || loss > captureSwing(meaning.captured) + MISSED_LOSS) return null;
  const { turn } = parseSfenState(sfenBefore);
  const mark = turn === 'black' ? '△' : '▲';
  return {
    key: 'move-missed-capture',
    text: `${mark}${squareText(meaning.square)}の${PIECE_NAMES[meaning.captured]}がタダで取れたよ。次は、取れる駒がないか先に探してみよう！`,
  };
}

/** 相手のミスとして言う、CPUの選んだ手と読みの最善との差(CPUから見た点)。 */
export const SLIP_MIN_LOSS = 300;
/** 相手のミスを言うのは、1局にこの回数まで。 */
export const SLIP_MAX_PER_GAME = 3;
/** これより負けている(プレイヤーから見て)ときは、チャンスと言わない。 */
const SLIP_MIN_PLAYER_SCORE = -1000;

/**
 * N5 相手のミス。CPUが読みの最善より大きく悪い手を指したときの一言。答え(手)は言わない。
 * @param {{ best?: { type: string, value: number } | null, selected?: { type: string, value: number } | null,
 *   sfenAfter?: string, reply?: string }} input
 *   best・selected: CPUの読みの最善の評価と、選んだ手の評価(どちらもCPUから見た値)。
 *   sfenAfter: CPUが指したあとの局面(プレイヤーの手番)。reply: 選んだ手の読み筋の次の手(プレイヤーのいちばんの応手)。
 * @returns {{ key: string, text: string } | null}
 */
export function opponentSlipAdvice({ best = null, selected = null, sfenAfter = '', reply = '' }) {
  if (!best || !selected) return null;
  // 相手が詰ませる手を逃した。
  if (best.type === 'mate' && best.value > 0 && !(selected.type === 'mate' && selected.value > 0)) {
    return { key: 'chance-escaped-mate', text: '危なかった！ 相手は詰ませる手を逃したよ。今のうちに玉を守ろう！' };
  }
  // 選んだ手でCPUが詰まされる形は、詰みの一言(勝ちの詰み)が言う。
  if (selected.type === 'mate' || best.type === 'mate') return null;
  if (best.value - selected.value < SLIP_MIN_LOSS || -selected.value < SLIP_MIN_PLAYER_SCORE) return null;
  const meaning = sfenAfter && reply ? moveMeaning(sfenAfter, reply) : null;
  if (meaning && ['free-capture', 'capture-gain'].includes(meaning.kind)) {
    return { key: 'chance-opponent-loose', text: 'チャンス！ 相手の駒が浮いたよ。取れる駒を探してみて！' };
  }
  return { key: 'chance-opponent-slip', text: 'チャンス！ 相手の今の手で、こっちが良くなったよ。何が変わったか探してみて！' };
}

/** 弱点の始めの一言(N8)。play-insight.mjsのWEAKNESS_KINDSと同じ種類。 */
const WEAKNESS_OPENING_LINES = Object.freeze({
  mate: '前の対局で、詰みを見逃してたね。今日は、王手の続く手を探してみよう！',
  ending: '前は、終盤で逆転されることがあったね。勝っているときは、自分の玉の安全も確かめよう！',
  free: '前は、駒をタダで取られることが多かったね。動かす前に、取られないか確かめよう（「駒の利き」も使ってね）',
  opening: '前は、序盤で押されがちだったね。作戦カードで、目指す形を決めてから指してみよう！',
});

/** 弱点の始めの一言を、同じ弱点で続けて言わない対局の数。 */
export const WEAKNESS_REMIND_GAMES = 3;

/**
 * 対局の始めに言う弱点(N8)。いちばん上の弱点で、前に言ってからWEAKNESS_REMIND_GAMES局以上たったものだけ。
 * @param {readonly { kind: string }[]} weaknesses detectWeaknessesの結果(上ほど優先)
 * @param {Record<string, number>} reminded 弱点ごとに、前に言ったときの対局数(記録の局数)
 * @param {number} gameCount いまの対局数(記録の局数)
 * @returns {{ key: string, text: string, kind: string } | null}
 */
export function weaknessReminder(weaknesses, reminded, gameCount) {
  const target = weaknesses.find(({ kind }) => WEAKNESS_OPENING_LINES[kind]
    && !(Number.isFinite(reminded?.[kind]) && gameCount - reminded[kind] < WEAKNESS_REMIND_GAMES));
  return target ? { key: `weakness-${target.kind}`, text: WEAKNESS_OPENING_LINES[target.kind], kind: target.kind } : null;
}

/** 弱点の始めの一言を言った記録の保存先。{ 弱点の種類: そのときの対局数 }。 */
export const WEAKNESS_REMINDER_KEY = 'yacobihime:shogi-match:coach-weakness:v1';

/**
 * 弱点の始めの一言を言った記録を読む。読めなければ空(言ってよい)。
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @returns {Record<string, number>}
 */
export function loadWeaknessReminders(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(WEAKNESS_REMINDER_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, count]) => Number.isFinite(count)));
  } catch {
    return {};
  }
}

/**
 * 弱点の始めの一言を言ったことを残す。
 * @param {Pick<Storage, 'setItem'> | null | undefined} storage
 * @param {Record<string, number>} reminders
 */
export function saveWeaknessReminders(storage, reminders) {
  try {
    storage?.setItem(WEAKNESS_REMINDER_KEY, JSON.stringify(reminders));
  } catch {
    // 保存できなくても遊べる(次の対局でも言うだけ)。
  }
}

/**
 * 弱点を乗り越えたときの一言(N8)。終局の画面に添える。
 * - mate: 詰ませて勝った。ending: 勝った(終盤で逆転されなかった)。opening: 30手目で互角以上だった。
 * @param {readonly string[]} kinds 対局の始めにあった弱点の種類
 * @param {{ won: boolean, checkmate: boolean, standing30?: number | null }} result
 */
export function weaknessOvercomeLine(kinds, { won, checkmate, standing30 = null }) {
  if (kinds.includes('mate') && won && checkmate) return '前は逃してた詰み、今日は見つけたね！';
  if (kinds.includes('ending') && won) return '前は終盤で逆転されてたけど、今日は勝ちきったね！';
  if (kinds.includes('opening') && Number.isFinite(standing30) && /** @type {number} */ (standing30) >= 0) {
    return '序盤、うまく指せてたよ！ 前より良くなってる！';
  }
  return '';
}

/** AIと同じ手の連続を、ほめる手数。 */
export const AI_STREAK_PRAISE = Object.freeze([3, 5, 10]);

/**
 * N10 ほめる。getMovePraiseで、手筋の次に見る(何が良かったかを1文で言う。G:5-8)。
 * @param {{ aiStreak?: number, defendedThreat?: boolean, seizedChance?: boolean }} context
 * @returns {{ key: string, text: string } | null}
 */
export function insightPraise({ aiStreak = 0, defendedThreat = false, seizedChance = false }) {
  if (seizedChance) return { key: 'praise-seized-chance', text: 'チャンスを逃さなかったね！ いい反応！' };
  if (defendedThreat) return { key: 'praise-threat-defended', text: '相手の狙いを、ちゃんと受けたね！' };
  if (AI_STREAK_PRAISE.includes(aiStreak)) {
    return { key: `praise-ai-streak-${aiStreak}`, text: `AIと同じ手が${aiStreak}手続いたね！ 冴えてる！` };
  }
  return null;
}

/** 自分の力で詰ませたときの一言(閃きを使わずに、詰ませる手を指した)。 */
export function selfMatePraise(plies = 0) {
  return Number.isInteger(plies) && plies > 1 ? `自分の力で${plies}手の詰みを読みきったね！ お見事！` : '自分の力で詰ませたね！ お見事！';
}

// ---- 段階2(docs/coach-advice-expansion-design.mdの10章)。N3 終盤の方針(N7 閃きの3段階は、2026-10-29に外した。10-3)。

/** この手数からは終盤として方針を言う(N3)。 */
export const ENDGAME_PLY = 60;
/** これより前は、玉のまわりの様子に関係なく終盤とみなさない。 */
const ENDGAME_EARLIEST_PLY = 30;
/** 玉のまわり8升のうち、相手の利きがこれだけあれば、玉のまわりで戦いが始まったとみなす。 */
const KING_PRESSURE_SQUARES = 3;

/**
 * 終盤か(N3)。61手目から、または31手目からで、どちらかの玉のまわりに相手の利きが集まっているとき。
 * @param {string} sfen
 * @param {number} ply いま何手目まで指したか
 */
export function isEndgame(sfen, ply) {
  if (ply >= ENDGAME_PLY) return true;
  if (ply < ENDGAME_EARLIEST_PLY) return false;
  const { board } = parseSfenState(sfen);
  for (const color of ['black', 'white']) {
    const king = findKing(board, color);
    if (!king) continue;
    const { x, y } = squareXY(king);
    let pressed = 0;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if ((!dx && !dy) || x + dx < 1 || x + dx > 9 || y + dy < 1 || y + dy > 9) continue;
        const square = `${x + dx}${String.fromCharCode(96 + y + dy)}`;
        if (attackersOf(board, square, opponentOf(color)).length) pressed += 1;
      }
    }
    if (pressed >= KING_PRESSURE_SQUARES) return true;
  }
  return false;
}

/**
 * N3 終盤の「攻めるか、受けるか」。どちらの玉が先に詰むかから方針を言う。答えの手は言わない。
 * @param {{ mateThreat: boolean, bestGivesCheck: boolean, bestGivesMateThreat?: boolean | null, bestIsDefensive?: boolean,
 *   playerScore?: { type: string, value: number } | null }} input
 *   mateThreat: 自玉が詰めろか。bestGivesMateThreat: 最善手が相手玉に詰めろをかけるか(確かめていなければnull)。
 * @returns {{ key: string, text: string } | null}
 */
export function endgamePolicyAdvice({ mateThreat, bestGivesCheck, bestGivesMateThreat = null, bestIsDefensive = false, playerScore = null }) {
  // 詰みがあるとき・詰まされるときは、詰みの一言が言う。
  if (playerScore?.type === 'mate') return null;
  if (mateThreat) {
    return bestGivesCheck
      ? { key: 'endgame-threat-check', text: '自玉に詰めろがかかってる。王手で迫りながら、しのごう！' }
      : { key: 'endgame-threat-defend', text: '自玉に詰めろがかかってるよ。まずは受けよう！' };
  }
  if (bestGivesMateThreat === true && !bestGivesCheck) {
    return { key: 'endgame-race-attack', text: '自玉はまだ安全！ 相手玉に詰めろをかけて、攻め合いで勝とう！' };
  }
  if (bestIsDefensive && !bestGivesCheck) {
    return { key: 'endgame-defend-first', text: '相手の攻めのほうが速いよ。一手かけて守ろう' };
  }
  return null;
}

// ---- 段階3(docs/coach-advice-expansion-design.mdの11章)。N6 格言・N9 大会の物語・N11 もう一言。

/** 格言(N6)。dexは手筋図鑑の項目(格言帳に入れる。図鑑にない格言は'')。 */
export const COACH_PROVERBS = Object.freeze({
  'idle-king': { dex: 'avoid-idle-king', text: '『居玉は避けよ』だよ。玉を横に動かして囲おう！' },
  'king-rook': { dex: '', text: '『玉飛接近すべからず』。玉と飛車は離しておこう' },
  'high-knight': { dex: 'high-knight', text: '『桂の高跳び歩の餌食』。その桂、歩でねらわれちゃうよ' },
});
/** 居玉を言うのは、この手数を過ぎてから。玉飛接近は、この手数まで。 */
const IDLE_KING_AFTER_PLY = 24;
const KING_ROOK_UNTIL_PLY = 40;

/**
 * 格言(N6)。AIの最善手が格言に沿うときだけ言う(桂の高跳びは、跳ねた桂が歩でねらわれたとき)。1局に1回ずつ。
 * @param {{ sfen: string, ply: number, color: 'black' | 'white', bestMove?: string, lastPlayerMove?: string, said?: readonly string[] }} input
 *   sfen: プレイヤーの手番の局面。lastPlayerMove: プレイヤーが前に指した手。said: この対局で言った格言。
 * @returns {{ key: string, text: string, proverb: string, dex: string } | null}
 */
export function proverbAdvice({ sfen, ply, color, bestMove = '', lastPlayerMove = '', said = [] }) {
  const { board } = parseSfenState(sfen);
  const make = (proverb) => ({ key: `proverb-${proverb}`, text: COACH_PROVERBS[proverb].text, proverb, dex: COACH_PROVERBS[proverb].dex });
  const king = findKing(board, color);
  const home = color === 'black' ? '5i' : '5a';
  const fromOf = (usi) => (usi && !usi.includes('*') ? usi.slice(0, 2) : '');
  // 桂の高跳び: 前に跳ねた桂が、相手の歩に取られる升にいる。
  const parsed = parseUsiMove(lastPlayerMove);
  if (!said.includes('high-knight') && parsed && !parsed.drop) {
    const knight = board.get(parsed.to);
    const { y } = squareXY(parsed.to);
    const deep = color === 'black' ? y <= 4 : y >= 6;
    if (knight?.color === color && knight.kind === 'N' && deep
      && attackersOf(board, parsed.to, opponentOf(color)).some(({ kind }) => kind === 'P')) return make('high-knight');
  }
  if (!bestMove) return null;
  // 居玉: 駒の取り合いが始まった(持ち駒がある)のに、玉が初めの升のまま。最善手が玉を動かす手。
  const anyHand = (String(sfen).replace(/^sfen\s+/, '').trim().split(/\s+/)[2] ?? '-') !== '-';
  if (!said.includes('idle-king') && ply > IDLE_KING_AFTER_PLY && king === home && anyHand && fromOf(bestMove) === home) {
    return make('idle-king');
  }
  // 玉飛接近: 玉と飛車が同じ段で隣り合い、最善手が玉か飛車を離す手。
  if (!said.includes('king-rook') && ply <= KING_ROOK_UNTIL_PLY && king) {
    const kingXY = squareXY(king);
    for (const [square, piece] of board) {
      if (piece.color !== color || piece.kind !== 'R') continue;
      const rookXY = squareXY(square);
      if (rookXY.y === kingXY.y && Math.abs(rookXY.x - kingXY.x) === 1 && [king, square].includes(fromOf(bestMove))) return make('king-rook');
    }
  }
  return null;
}

/**
 * 大会の物語(N9)。相手と、この1局に賭けているものに触れる。種類ごとに1局に1回。
 * @param {{ playerScore?: { type: string, value: number } | null, previousScore?: { type: string, value: number } | null,
 *   endgame: boolean, opponent?: { id?: string, name?: string, character?: { traits?: { id: string }[] } } | null,
 *   stakes?: string, tone?: string, said?: readonly string[] }} input
 *   stakes: 舞台の「勝てば○○」。tone: 番勝負のfinal・reach・kadoban。
 * @returns {{ key: string, text: string } | null}
 */
export function storyAdvice({ playerScore = null, previousScore = null, endgame, opponent = null, stakes = '', tone = '', said = [] }) {
  if (!opponent || playerScore?.type !== 'cp') return null;
  const value = playerScore.value;
  const has = (id) => Boolean(opponent.character?.traits?.some((trait) => trait.id === id));
  const name = opponent.name ?? '相手';
  const fresh = (key) => !said.includes(key);
  if (opponent.id === 'hanane' && fresh('story-hanane-turn') && previousScore?.type === 'cp' && previousScore.value <= -300 && value >= 300) {
    return { key: 'story-hanane-turn', text: '羽音ちゃん、悔しそう…でもまだ油断しないで！' };
  }
  if (has('comeback') && fresh('story-comeback') && value >= 1000) {
    return { key: 'story-comeback', text: `${name}さんは逆転の名手。最後まで気を抜かないで！` };
  }
  if ((has('endgame-collapse') || has('weak-defense')) && fresh('story-endgame-weak') && endgame && Math.abs(value) < 300) {
    return { key: 'story-endgame-weak', text: `${name}さんは終盤が苦手。ここからがチャンスだよ！` };
  }
  if (stakes.startsWith('勝てば') && fresh('story-stakes') && endgame && value >= 1500) {
    return { key: 'story-stakes', text: `${stakes}！ 最後の詰みまで、丁寧にいこう` };
  }
  if ((tone === 'kadoban' || tone === 'final') && fresh('story-crunch') && endgame && Math.abs(value) < 300) {
    return { key: 'story-crunch', text: 'ここが正念場。一手ずつ、落ち着いて！' };
  }
  return null;
}

/** 吹き出しの「なぜ？」で足す1行(N11)。助言の鍵の頭で決める。ないときは''。 */
const ADVICE_REASONS = Object.freeze([
  [/^candidate-evaluation-cliff-free-capture/, '相手の駒で、どの駒にも守られていない駒を探してみて。取っても取り返されないよ'],
  [/^candidate-evaluation-cliff-capture-gain/, '取り返されても、取った駒のほうが値打ちが高ければ得だよ'],
  [/^candidate-evaluation-cliff-check/, '王手は相手が必ず受けないといけないから、こっちが手番を握れるよ'],
  [/^candidate-evaluation-cliff-escape/, '取られそうな駒は、取られない升へ動かすか、守りの駒を足そう'],
  [/^candidate-evaluation-cliff-drop/, '持ち駒は好きな空き升に打てるよ。相手の駒に2つ当たる升はないかな？'],
  [/^candidate-evaluation-cliff-activate/, '大駒は通り道が開くと、遠くまで利くよ。前にある駒をどけてみよう'],
  [/^candidate-evaluation-cliff-defend/, '玉のまわりに金銀が多いほど、詰まされにくいよ'],
  [/^candidate-evaluation-cliff-tesuji/, '手筋は昔から伝わる、決まりの良い手の形だよ。図鑑の「手筋」でも見られるよ'],
  [/^candidate-evaluation-cliff-capture/, '取り合いは、最後に取ったほうが得をするか、駒の値打ちを数えてみよう'],
  [/^candidate-evaluation-cliff$/, '上の候補と、それ以外の手で、形勢が大きく違う局面だよ。相手の駒の利きをよく見て'],
  [/^move-missed-mate/, '王手を続けて、玉の逃げ道を1つずつふさいでいくと、詰みが見つかるよ'],
  [/^move-missed-capture/, '指す前に「取れる駒はないかな？」と一度見るくせをつけよう'],
  [/^move-(blunder|mistake)/, '指す前に、動かした駒が相手の駒に取られないか確かめよう（「駒の利き」が使えるよ）'],
  [/^threat-/, '点線の矢印が相手の狙いだよ。その升を守るか、ねらわれた駒を動かそう'],
  [/^endgame-threat/, '詰めろは「次に詰ませるぞ」という手。受けないと、次の手で負けちゃう'],
  [/^endgame-race-attack/, '相手玉に詰めろをかけ続ければ、相手は受けるしかなくて、こっちの玉は安全なままだよ'],
  [/^endgame-defend-first/, '相手の攻めが先に届くときは、一手守ってから攻め返そう'],
  [/^chance-escaped-mate/, '相手が気づかなかった詰み筋があるよ。玉のまわりの穴をふさごう'],
  [/^chance-/, '相手の今の手で、空いた升や守りの外れた駒がないか見てみよう'],
  [/^mate-risk/, '詰めろかどうかは、相手にもう1手指させたら詰むかで考えるよ'],
  [/^king-in-check/, '王手は、玉が逃げる・王手の駒を取る・間に駒を打つ、の3つで受けるよ'],
  [/^proverb-idle-king/, '玉が初めの升のままだと、飛車や角の利きに入りやすくて、戦いが始まると危ないんだ'],
  [/^proverb-king-rook/, '玉と飛車が近いと、両方まとめてねらわれやすいよ'],
  [/^proverb-high-knight/, '桂は前にしか進めないから、跳ねすぎると逃げ場がなくなるよ'],
]);
export function adviceReason(key = '') {
  // 考えているあいだの一言(idle-<種類>)は、最善手の種類の一言と同じ理由。
  const normalized = key.replace(/^idle-(?=free-capture|capture-gain|check|escape|drop|activate|defend|tesuji|capture)/, 'candidate-evaluation-cliff-');
  return ADVICE_REASONS.find(([pattern]) => pattern.test(normalized))?.[1] ?? '';
}

/** やこび姫の顔を押すと見られる「さっきの話」の数(N11)。 */
export const RECENT_TALK_LIMIT = 3;
/**
 * さっきの話に足す(新しい順、同じ台詞は1つ)。
 * @param {{ ply: number, text: string }[]} talk
 * @param {{ ply: number, text: string }} line
 */
export function addRecentTalk(talk, line) {
  if (!line?.text) return talk;
  return [line, ...talk.filter(({ text }) => text !== line.text)].slice(0, RECENT_TALK_LIMIT);
}
