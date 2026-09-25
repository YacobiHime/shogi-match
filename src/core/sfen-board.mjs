/** SFENの盤上駒を升座標から参照する共通パーサー。 */
export function parseSfenBoard(sfen) {
  const boardPart = String(sfen ?? "").replace(/^sfen\s+/, "").trim().split(/\s+/)[0];
  const ranks = boardPart.split("/");
  if (ranks.length !== 9) return new Map();
  const board = new Map();
  ranks.forEach((rank, rankIndex) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) file -= Number(symbol);
      else if (symbol === "+") promoted = true;
      else {
        board.set(`${file}${String.fromCharCode(97 + rankIndex)}`, {
          color: symbol === symbol.toUpperCase() ? "black" : "white",
          kind: `${promoted ? "+" : ""}${symbol.toUpperCase()}`,
        });
        file -= 1;
        promoted = false;
      }
    }
  });
  return board;
}
