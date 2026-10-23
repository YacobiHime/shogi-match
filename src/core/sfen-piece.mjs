// SFENの盤の文字列から駒を読む小さな道具。Nodeの開発用スクリプトからも読めるよう、ほかのモジュールに頼らない。
const RANKS = 'abcdefghi';

/** SFENの盤から、USIのマス(例 "2h")にある駒の文字(先手は大文字、成り駒は"+R"など)を返す。 */
export function pieceAt(sfen, square) {
  const rows = String(sfen ?? '').trim().split(/\s+/)[0]?.split('/') ?? [];
  const file = Number(square?.[0]);
  const row = rows[RANKS.indexOf(square?.[1])];
  if (!row || !file) return '';
  let column = 9;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (/\d/.test(char)) {
      column -= Number(char);
      continue;
    }
    const piece = char === '+' ? `+${row[++index]}` : char;
    if (column === file) return piece;
    column -= 1;
  }
  return '';
}

