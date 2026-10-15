import { Position, Square } from "tsshogi";

/** 局面の指定したマスの駒が利いているマス(USI)。図鑑と教室で、駒の動きを青く塗るのに使う。 */
export function pieceReachSquares(sfen, squareUsi) {
  const position = Position.newBySFEN(sfen);
  const from = Square.newByUSI(squareUsi);
  if (!position || !from) return [];
  return Square.all
    .filter((square) => position.listAttackers(square).some((attacker) => attacker.equals(from)))
    .map((square) => square.usi);
}
