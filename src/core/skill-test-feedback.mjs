/**
 * 棋力テストの問いの文と、答えたあとの一言・盤の印(docs/skill-assessment-design.mdの10-4と10-7)。
 * 問いは約束なので、問いの文と正解の一覧(問題のaccepted)は同じ約束を言う。答えのあとは、何が起きるところだったかを盤で見せる。
 * 棋力テストの画面(ShogiSkillTest.vue)だけが読む。
 */
import { formatHintMove } from './match-assists.mjs';
import { parseSfenState } from './piece-movement.mjs';
import { captureNote } from './skill-test-promise.mjs';
import { tesujiShape } from './tesuji-shape.mjs';

/** 問いの文(種類ごと)。手筋は駒得の手筋と寄せの手筋で分ける。 */
export const QUESTIONS = Object.freeze({
  take: '得する駒取りがあるよ。見つけて指そう',
  save: 'このままだと駒を取られちゃう！ 取られないように指そう',
  tacticGain: '手筋で駒得できるよ。見つけて指そう',
  tacticYose: '玉に迫る手筋があるよ。見つけて指そう',
  defend: 'このままだと詰まされちゃう！ 詰まないように受けよう',
  judge: 'いちばん良い手はどれ？ 3つから選ぼう',
});

/**
 * @typedef {{
 *   type: string, sfen: string, accepted?: readonly string[], choices?: readonly string[], best?: string,
 *   line?: readonly string[], threat?: string, target?: string, tesuji?: string, targets?: readonly string[], problem?: any,
 * }} FeedbackItem
 * @typedef {{ file: number, rank: number, tone: 'target' | 'key' }} FeedbackMark
 */

/**
 * 問いの文。
 * @param {FeedbackItem} item
 */
export function questionText(item) {
  if (item.type === 'mate') return `${item.problem?.plies ?? ''}手で詰ませよう`;
  if (item.type === 'tactic') return tesujiShape(item.tesuji ?? '')?.family === 'yose' ? QUESTIONS.tacticYose : QUESTIONS.tacticGain;
  return /** @type {Record<string, string>} */ (QUESTIONS)[item.type] ?? '';
}

const sideMark = (sfen) => (sfen.split(' ')[1] === 'w' ? '△' : '▲');
/** ▲7六歩のような、手番の印つきの手の書き方。 */
export const moveText = (usi, sfen) => `${sideMark(sfen)}${formatHintMove(usi, sfen)}`;
/** 手を渡した(何もしなかった)局面。 */
const passSfen = (sfen) => {
  const parts = sfen.split(' ');
  parts[1] = parts[1] === 'b' ? 'w' : 'b';
  return parts.join(' ');
};
const opponentColor = (sfen) => (sfen.split(' ')[1] === 'w' ? 'black' : 'white');
/** @returns {FeedbackMark} */
const squareMark = (square, tone) => ({ file: Number(square[0]), rank: square.charCodeAt(1) - 96, tone });
const kindAt = (sfen, square) => parseSfenState(sfen).board.get(square)?.kind ?? '';
/** 一言で使う駒の呼び方(「飛を取られた」ではなく「飛車を取られた」)。 */
const PIECE_WORDS = Object.freeze({
  P: '歩', L: '香車', N: '桂馬', S: '銀', G: '金', B: '角', R: '飛車', K: '玉',
  '+P': 'と金', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '竜',
});
const pieceName = (kind) => /** @type {Record<string, string>} */ (PIECE_WORDS)[kind] ?? '駒';

/**
 * 答えたあとの一言と盤の印。holdは、次へ進む待ち方(auto: 少し見せて進む、tesuji: 手筋の名前を読めるだけ見せて進む、manual: 「次の問題」を押すまで待つ)。
 * lineは、答えから盤で動かして見せる手順(正解のときは指した手のあとの続き、不正解のときは答えの手から)。
 * 詰将棋(mate)は問題集と同じ流れなので、ここでは扱わない。
 * @param {FeedbackItem} item
 * @param {{ correct: boolean, played?: string }} answer
 * @returns {{ speech: string, riskSquares: string[], threatArrows: { usi: string, color: 'black' | 'white' }[], marks: FeedbackMark[], line: string[], hold: 'auto' | 'tesuji' | 'manual' }}
 */
export function answerFeedback(item, { correct, played = '' }) {
  const { sfen } = item;
  const answer = item.best ?? item.accepted?.[0] ?? '';
  const answerLabel = answer ? `答えは${moveText(answer, sfen)}。` : '';
  /** @type {ReturnType<typeof answerFeedback>} */
  const feedback = { speech: '', riskSquares: [], threatArrows: [], marks: [], line: [], hold: correct ? 'auto' : 'manual' };
  if (item.type === 'take') {
    const note = captureNote(sfen, correct && played ? played : answer);
    const piece = note ? pieceName(note.kind) : '駒';
    if (correct) return { ...feedback, speech: `いいね！ ${piece}を取って得したね。` };
    return {
      ...feedback,
      speech: `${answerLabel}${note?.free ? `${piece}は、だれも守っていなかったよ。` : `取り返されても、${piece}を取って得だよ。`}`,
      marks: answer ? [squareMark(answer.slice(2, 4), 'target')] : [],
    };
  }
  if (item.type === 'save') {
    const piece = item.target ? pieceName(kindAt(sfen, item.target)) : '駒';
    if (correct) return { ...feedback, speech: `いいね！ ${piece}を守ったね。` };
    const threat = item.threat ? `${moveText(item.threat, passSfen(sfen))}で` : '';
    return {
      ...feedback,
      speech: `${answerLabel}何もしないと、${threat}${piece}を取られていたよ。`,
      riskSquares: item.target ? [item.target] : [],
      threatArrows: item.threat ? [{ usi: item.threat, color: opponentColor(sfen) }] : [],
    };
  }
  if (item.type === 'tactic') {
    const shape = tesujiShape(item.tesuji ?? '');
    const name = shape?.name ?? '手筋';
    const line = [...(item.line ?? [])];
    if (correct) {
      // 読み筋の1手目を指したときだけ、続き(相手の手と、駒を取る手)を盤で動かして見せる。
      return { ...feedback, speech: `${name}！ いいね。`, hold: 'tesuji', line: played === line[0] ? line.slice(1) : [] };
    }
    return {
      ...feedback,
      speech: `${answerLabel}手筋は「${name}」。${shape?.hint ?? ''}`,
      marks: (item.targets ?? []).map((square) => squareMark(square, 'target')),
      line,
    };
  }
  if (item.type === 'defend') {
    if (correct) return { ...feedback, speech: 'いいね！ 詰めろを受けたね。' };
    const threat = item.threat ? `${moveText(item.threat, passSfen(sfen))}から` : '';
    const more = (item.accepted?.length ?? 0) > 1 ? 'ほかにも受け方があったよ。' : '';
    return {
      ...feedback,
      speech: `${answerLabel}何もしないと、${threat}詰んでいたよ。${more}`,
      threatArrows: item.threat ? [{ usi: item.threat, color: opponentColor(sfen) }] : [],
    };
  }
  if (item.type === 'judge') {
    if (correct) return { ...feedback, speech: 'いいね！ そのとおり。' };
    const letter = 'ABC'[item.choices?.indexOf(answer) ?? -1] ?? '';
    return { ...feedback, speech: `答えは${letter}の${moveText(answer, sfen)}。そのあとの読み筋を盤で見せるね。`, line: [...(item.line ?? [])] };
  }
  return { ...feedback, speech: correct ? 'いいね！ そのとおり。' : `${answerLabel}次の問題へ進もう。` };
}
