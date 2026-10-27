/**
 * やこび姫の助言の強化、段階1(docs/coach-advice-expansion-design.md)。
 * - N1 最善手の翻訳: 最善手の種類(タダで取る・手筋・王手・打つ…)を、答えを言わずに言葉にする
 * - N4 見逃し: 指す前にあった詰み・タダの駒を、指した手で逃したとき
 * - N5 相手のミス: CPUが読みの最善より大きく悪い手を指したとき
 * - N8 弱点の記憶: 前の対局の弱点(play-insight.mjsのdetectWeaknesses)を、始めの一言と乗り越えたときのほめ言葉に使う
 * - N10 ほめる: AIと同じ手の連続・狙いを受けた・自分で詰ませた・チャンスを生かした
 * どれも、すでに読んでいる結果だけを使い、新しい探索は足さない。台詞はこのファイルにまとめる。
 */
import { detectTesuji } from './move-tesuji.mjs';
import { exchangeGain, captureSwing } from './exchange-eval.mjs';
import { value } from './logic-position.mjs';
import { mateLineByChecks } from './engine-mate-check.mjs';
import {
  applyUsiToBoard, attackedSquares, findKing, isKingAttacked, opponentOf, parseSfenState, parseUsiMove, squareXY,
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
  if (before.type === 'mate' && before.value > 0 && !(after.type === 'mate' && after.value > 0)) {
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
