/**
 * やこび姫の助言に「なぜか」を添える。設計は docs/coach-plan-advice-design.md の9章(案A・案B)。
 * A. 悪手の理由: 悪手判定の読み(着手後の局面)の読み筋の1手目(相手のいちばんの応手)を言葉にする。
 * B. 相手の狙い: 詰めろの確かめ(手番を入れ替えた局面)の最善手を言葉にする。
 * どちらも、すでに読んでいる結果だけを使い、新しい探索は足さない。
 */
import { formatHintMove } from './match-assists.mjs';
import { pieceAt } from './sfen-piece.mjs';

export { pieceAt };

const PIECE_NAMES = {
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛車', K: '玉',
  '+P': 'と金', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '竜',
};
/** 取られたら「取られちゃう」と言う重さ(駒図鑑のtier表の値段)。歩は言わない。 */
const PIECE_WORTH = {
  P: 1, L: 3, N: 4, S: 5, G: 6, B: 8, R: 10, K: 99, '+P': 7, '+L': 6, '+N': 6, '+S': 6, '+B': 10, '+R': 12,
};
/** 相手の狙いとして言う、狙われる駒の最小の値段(銀以上)。 */
export const THREAT_MIN_WORTH = 5;
/** プレイヤーがこれ以上勝っているときは、小さな狙いを言わない(目の前の勝ち方が大事)。 */
export const THREAT_MAX_PLAYER_SCORE = 1500;
/** プレイヤーがこれ以上負けているときも言わない(勝負がついている。「まだ耐えられるよ」の範囲と同じ下限)。 */
export const THREAT_MIN_PLAYER_SCORE = -3000;
/** 相手に2手続けて指させたとき、これだけ得をするなら狙いとして言う(プレイヤーから見た点の差)。 */
export const THREAT_MIN_GAIN = 300;

function pieceOwner(piece) {
  const letter = piece.replace('+', '');
  return letter === letter.toUpperCase() ? 'black' : 'white';
}
function pieceKey(piece) {
  return piece.startsWith('+') ? `+${piece[1].toUpperCase()}` : piece.toUpperCase();
}
function moveParts(usi) {
  const match = /^([1-9][a-i])([1-9][a-i])(\+)?$/.exec(String(usi ?? ''));
  return match ? { from: match[1], to: match[2], promote: Boolean(match[3]) } : null;
}
function marked(usi, sfen) {
  const side = String(sfen ?? '').trim().split(/\s+/)[1] === 'w' ? '△' : '▲';
  try {
    return `${side}${formatHintMove(usi, sfen)}`;
  } catch {
    return '';
  }
}

/**
 * A. 悪手の理由。相手のいちばんの応手で、何を失うかを1つ言う。言えないときはnull。
 * @param {{ sfenAfter?: string, playedUsi?: string, pv?: string[], playerColor?: "black" | "white" }} [options]
 *   sfenAfter: プレイヤーが指したあとの局面(相手の手番)。pv: その局面の読み筋(相手の応手から)。
 */
export function mistakeReason({ sfenAfter = '', playedUsi = '', pv = [], playerColor = 'black' } = {}) {
  const reply = pv[0];
  const replyText = reply ? marked(reply, sfenAfter) : '';
  if (!replyText) return null;
  const parts = moveParts(reply);
  if (parts) {
    const captured = pieceAt(sfenAfter, parts.to);
    // 取り返して同じくらい取り返せる交換は、損の中身とは言わない。
    const recaptured = moveParts(pv[1])?.to === parts.to;
    if (captured && pieceOwner(captured) === playerColor && recaptured) return `相手の${replyText}が厳しいよ。`;
    if (captured && pieceOwner(captured) === playerColor && PIECE_WORTH[pieceKey(captured)] >= 3) {
      const name = PIECE_NAMES[pieceKey(captured)];
      return moveParts(playedUsi)?.to === parts.to
        ? `今動かした${name}が、${replyText}で取られちゃう。`
        : `${replyText}で${name}を取られちゃう。`;
    }
    const mover = pieceAt(sfenAfter, parts.from);
    if (parts.promote && mover && ['B', 'R'].includes(pieceKey(mover))) {
      return `${replyText}で${PIECE_NAMES[pieceKey(mover)]}に成り込まれちゃう。`;
    }
  }
  return `相手の${replyText}が厳しいよ。`;
}

/**
 * B. 相手の狙い。手番を入れ替えた局面で、相手がいちばん指したい手が、大きな駒を取る手・大駒が成り込む手なら言う。
 * @param {{
 *   threatSfen?: string, threatMove?: string, threatPv?: string[], threatScore?: { type: string, value: number } | null,
 *   playerScore?: { type: string, value: number } | null, playerColor?: "black" | "white",
 * }} [options]
 *   threatSfen: 手番を入れ替えた局面(相手の手番)。threatScore: その局面の相手から見た評価。playerScore: 今の局面のプレイヤーから見た評価。
 */
export function threatAdvice({ threatSfen = '', threatMove = '', threatPv = [], threatScore = null, playerScore = null, playerColor = 'black' } = {}) {
  if (threatScore?.type !== 'cp' || playerScore?.type !== 'cp' || playerScore.value >= THREAT_MAX_PLAYER_SCORE || playerScore.value <= THREAT_MIN_PLAYER_SCORE) return null;
  // 相手に2手続けて指させると、プレイヤーから見て何点下がるか。
  if (playerScore.value + threatScore.value < THREAT_MIN_GAIN) return null;
  const parts = moveParts(threatMove);
  const text = parts ? marked(threatMove, threatSfen) : '';
  if (!parts || !text) return null;
  const captured = pieceAt(threatSfen, parts.to);
  // 取り返せる交換(角交換など)は「取られそう」ではなく、その先の攻めが狙い。
  if (captured && pieceOwner(captured) === playerColor && moveParts(threatPv[1])?.to === parts.to) {
    return { key: `threat-attack-${threatMove}`, text: `相手の狙いは${text}からの攻めだよ。先に備えよう！` };
  }
  if (captured && pieceOwner(captured) === playerColor && PIECE_WORTH[pieceKey(captured)] >= THREAT_MIN_WORTH) {
    const name = PIECE_NAMES[pieceKey(captured)];
    return { key: `threat-capture-${threatMove}`, text: `相手の狙いは${text}だよ。${name}が取られそう！` };
  }
  const mover = pieceAt(threatSfen, parts.from);
  if (parts.promote && mover && ['B', 'R'].includes(pieceKey(mover))) {
    return { key: `threat-promote-${threatMove}`, text: `相手の狙いは${text}だよ。${PIECE_NAMES[pieceKey(mover)]}に成り込まれそう！` };
  }
  return null;
}

/** 悪手の台詞に理由を足す。理由がなければ元の台詞のまま。 */
export function withMistakeReason(feedback, reason) {
  if (!feedback || !reason || !/^move-(blunder|mistake)/.test(feedback.key)) return feedback;
  const change = /評価値変動([+-]\d+)/.exec(feedback.text)?.[1] ?? '';
  const head = feedback.key.startsWith('move-blunder') ? 'あちゃ～、やっちゃった…' : '今の手は悪手だね…';
  return { ...feedback, text: `${head}${reason}${change ? `（評価値変動${change}）` : ''}` };
}
