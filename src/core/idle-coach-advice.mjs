export const IDLE_COACH_DELAY_MS = 15000;

/** 探索した最善手の性質から、考慮中に出す軽い助言を組み立てる。 */
export function getIdleCoachAdvice({
  usi = '',
  formattedMove = '',
  pieceType = '',
  capturedPieceType = '',
  toRank,
  color = '',
  lastMove = '',
  givesCheck = false,
} = {}) {
  if (!usi) return null;
  const lastDestination = /^([1-9][a-i])([1-9][a-i])\+?$/.exec(lastMove)?.[2];
  const destination = /^[A-Z]\*([1-9][a-i])$/.exec(usi)?.[1]
    ?? /^[1-9][a-i]([1-9][a-i])\+?$/.exec(usi)?.[1];
  if (
    pieceType === 'pawn' && capturedPieceType && destination
    && destination === lastDestination
  ) {
    return { key: 'idle-recapture-pawn', text: 'ここは同歩で良さそうじゃない？' };
  }
  if (/^[A-Z]\*/.test(usi)) {
    return { key: 'idle-drop', text: '持ち駒は何があるかな？ 使えそうな駒を探してみよう！' };
  }
  if (givesCheck) {
    return { key: 'idle-check', text: 'とりあえず王手してみる？ 相手の応手を読んでみよう！' };
  }
  const inOwnCamp = color === 'black' ? toRank >= 7 : color === 'white' ? toRank <= 3 : false;
  if (!capturedPieceType && inOwnCamp && ['king', 'gold', 'silver'].includes(pieceType)) {
    return { key: 'idle-castle', text: 'あんまりできること無いし、自玉でも囲っておく？' };
  }
  if (capturedPieceType) {
    return { key: 'idle-capture', text: '取れそうな駒はないかな？ 駒得できる手を探してみよう！' };
  }
  if (formattedMove) {
    return { key: 'idle-candidate', text: `${formattedMove}あたりを考えてみる？` };
  }
  return { key: 'idle-plan', text: '相手の狙いを見ながら、次に使いたい駒を考えてみよう！' };
}
