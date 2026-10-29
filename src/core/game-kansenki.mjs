// ふつうの大会の対局の観戦記(docs/mate-finish-design.md)。タイトル戦(二日制)の観戦記(title-day.mjsのwriteKansenki)より短く、
// 見出しと3段落まで。形勢の分かれ目は、その局でやこび姫の読みがあったとき(勝率の記録があるとき)だけ書く。画面に依存しない。

import { turningPoint } from './title-day.mjs';
import { mateKansenkiSentence } from './mate-finish.mjs';

/**
 * 観戦記(見出しと段落)。保存の形はタイトル戦の観戦記と同じ(kansenki:v1)。
 * @param {{
 *   eventText: string, label: string, venue?: string, userName: string, opponentName: string, userColor: 'black' | 'white',
 *   formations: { black: string, white: string }, win: boolean, plies: number, decided?: string, score?: string,
 *   rates?: Array<[number, number]>, moveText: (ply: number) => string, mate?: { plies: number, from: number } | null,
 * }} input
 *   ratesは、プレイヤーの手番ごとの勝率の記録([手数, プレイヤーから見た勝率%])。decidedは、この勝ちで決まったもの(「6組優勝」など)。
 */
export function writeGameKansenki({
  eventText, label, venue = '', userName, opponentName, userColor, formations, win, plies, decided = '', score = '',
  rates = [], moveText, mate = null,
}) {
  const black = userColor === 'black' ? userName : opponentName;
  const white = userColor === 'black' ? opponentName : userName;
  let headline;
  if (win && decided) headline = `${userName}、${decided}`;
  else if (win && mate && mate.plies >= 3) headline = `${userName}、${mate.plies}手詰めで寄せ切る`;
  else if (win) headline = `${userName}、${plies}手で制す`;
  else headline = `${opponentName}が${plies}手で制す　${userName}は次の局へ`;
  const known = formations.black && formations.white;
  const paragraphs = [
    `${eventText}${label}は、${venue || '将棋会館'}で行われた。先手は${black}、後手は${white}。${known ? `戦型は${formations.black}対${formations.white}となった。` : '序盤から定跡を離れた力戦となった。'}`,
  ];
  const turning = turningPoint(rates, 0);
  const turningText = turning ? moveText(turning.ply) : '';
  if (turning && turningText) {
    const who = turning.by === 'user' ? userName : opponentName;
    paragraphs.push(`勝負を分けたのは${turning.ply}手目、${who}の${turningText}。この一手で、形勢は${who}に傾いた。`);
  }
  const mateText = win && mate ? mateKansenkiSentence({ ...mate, fromText: moveText(mate.from), userName }) : '';
  paragraphs.push(win
    ? `${mateText}${plies}手まで、${userName}の勝ち。${score ? `これで${score}。` : ''}${decided ? `${decided}を決めた。` : ''}`
    : `${plies}手まで、${opponentName}の勝ち。${score ? `これで${score}。` : ''}${userName}は、次の局へ静かに闘志を燃やしていた。`);
  return { headline, paragraphs };
}
