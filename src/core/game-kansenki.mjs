// ふつうの大会の対局の観戦記(docs/mate-finish-design.md)。記事の形は kansenki-writer.mjs の writeArticle
// (見出し・副見出し・リード・小見出しつきの段落・局後・形勢の線)。ここは対局画面から渡す材料をそのまま渡す入口。

import { writeArticle } from './kansenki-writer.mjs';

/**
 * 観戦記。保存の形はタイトル戦の観戦記と同じ(kansenki:v1。前の読み手のためにparagraphsも入れる)。
 * @param {{
 *   eventText: string, label: string, venue?: string, userName: string, opponentName: string, userColor: 'black' | 'white',
 *   formations: { black: string, white: string }, win: boolean, plies: number, decided?: string, score?: string,
 *   rates?: Array<[number, number]>, moveText: (ply: number) => string, mate?: { plies: number, from: number } | null,
 *   moves?: string[], initialSfen?: string, reason?: string, seed?: string | number, oversights?: number[],
 *   opponentDan?: string, opponentStyle?: string,
 * }} input
 *   ratesは、プレイヤーの手番ごとの勝率の記録([手数, プレイヤーから見た勝率%])。decidedは、この勝ちで決まったもの(「6組優勝」など)。
 */
export function writeGameKansenki(input) {
  return writeArticle(input);
}
