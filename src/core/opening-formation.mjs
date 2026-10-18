import { mirrorUsiMove, resolveOpeningPlanDefinitions } from "./opening-guide.mjs";

/**
 * 作戦カードの「完成形の小さな盤」と、対局中に薄く出す完成形の駒(docs/opening-guide-ux-design.mdの3章・6章)。
 * 自分の駒だけを、戦法→囲いの順に手順どおり動かした形を作る。相手の駒は置かないので、
 * 盤の作り直し(learning-setup.mjsのbuildFormationStart)より大幅に軽く、カードを何枚並べても待たせない。
 *
 * - 自分の駒がいるマスへ動く手は、そこで駒を交換した(歩交換など)として、いた駒を盤から外す。
 * - 動かす駒がいない手は飛ばす(相手の応手しだいの分かれ道など)。
 * - 角換わりの手順(@kakugawari)は、7六歩と角の交換(盤から角が消える)として扱う。
 */

const INITIAL_BLACK = Object.freeze([
  ["9i", "L"], ["8i", "N"], ["7i", "S"], ["6i", "G"], ["5i", "K"], ["4i", "G"], ["3i", "S"], ["2i", "N"], ["1i", "L"],
  ["8h", "B"], ["2h", "R"],
  ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map((file) => [`${file}g`, "P"]),
]);

const USI_MOVE = /^([1-9][a-i])([1-9][a-i])(\+?)$/;
const USI_DROP = /^([PLNSGBR])\*([1-9][a-i])$/;

const cache = new Map();

/**
 * 先手から見た完成形。piecesは自分の駒すべて、movedは手順で動いた駒のマス(カードで濃く描き、対局で薄く出す)。
 * @param {string} strategyId
 * @param {string} castleId
 * @returns {{ pieces: { square: string, kind: string, promoted: boolean, moved: boolean }[], moved: string[] }}
 */
export function openingFormation(strategyId = "", castleId = "") {
  const key = `${strategyId}|${castleId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const board = new Map(INITIAL_BLACK.map(([square, kind]) => [square, { kind, promoted: false, moved: false }]));
  const { strategy, castle } = resolveOpeningPlanDefinitions(strategyId, castleId);
  const moves = [...(strategy?.blackMoves ?? []), ...(castle?.blackMoves ?? [])];
  const play = (from, to, promote = false) => {
    const piece = board.get(from);
    if (!piece) return;
    board.delete(from);
    board.set(to, { ...piece, promoted: piece.promoted || promote, moved: true });
  };
  for (const move of moves) {
    if (typeof move !== "string") continue;
    if (move === "@kakugawari") {
      play("7g", "7f");
      board.delete("8h");
      continue;
    }
    const drop = USI_DROP.exec(move);
    if (drop) {
      if (!board.has(drop[2])) board.set(drop[2], { kind: drop[1], promoted: false, moved: true });
      continue;
    }
    const step = USI_MOVE.exec(move);
    if (step) play(step[1], step[2], step[3] === "+");
  }
  const pieces = [...board].map(([square, piece]) => ({ square, ...piece }));
  const result = Object.freeze({
    pieces: Object.freeze(pieces),
    moved: Object.freeze(pieces.filter(({ moved }) => moved).map(({ square }) => square)),
  });
  cache.set(key, result);
  return result;
}

function sfenPieceAt(sfen) {
  const placement = String(sfen ?? "").split(" ")[0] ?? "";
  const squares = new Map();
  placement.split("/").forEach((row, rowIndex) => {
    let file = 9;
    for (let index = 0; index < row.length; index += 1) {
      const char = row[index];
      if (/\d/.test(char)) {
        file -= Number(char);
        continue;
      }
      const promoted = char === "+";
      const letter = promoted ? row[++index] : char;
      squares.set(`${file}${String.fromCharCode(97 + rowIndex)}`, {
        kind: letter.toUpperCase(),
        promoted,
        color: letter === letter.toUpperCase() ? "black" : "white",
      });
      file -= 1;
    }
  });
  return squares;
}

/**
 * 対局中に盤へ薄く出す、完成形のまだ埋まっていない駒。自分の駒がまだ来ていない空きマスだけに出す
 * (駒の上には重ねない)。後手なら盤を反転したマスに出す。
 * @param {{ strategyId?: string, castleId?: string, color?: "black" | "white", sfen: string }} options
 * @returns {{ file: number, rank: number, kind: string, color: "black" | "white" }[]}
 */
export function openingFormationGhosts({ strategyId = "", castleId = "", color = "black", sfen }) {
  if (!strategyId && !castleId) return [];
  const board = sfenPieceAt(sfen);
  const formation = openingFormation(strategyId, castleId);
  const ghosts = [];
  for (const piece of formation.pieces) {
    if (!piece.moved || piece.promoted) continue;
    const square = color === "white" ? mirrorUsiMove(`${piece.square}${piece.square}`).slice(0, 2) : piece.square;
    const current = board.get(square);
    if (current) continue;
    ghosts.push({ file: Number(square[0]), rank: square.charCodeAt(1) - 96, kind: piece.kind, color });
  }
  return ghosts;
}

/**
 * 完成形のうち、もう自分の駒が着いたマス(先手から見た座標)と、全体の数(補助の欄の「あと◯マス」と小さな盤の進み具合)。
 * @param {{ strategyId?: string, castleId?: string, color?: "black" | "white", sfen: string }} options
 * @returns {{ filled: number, total: number, filledSquares: string[] }}
 */
export function openingFormationProgress({ strategyId = "", castleId = "", color = "black", sfen }) {
  if (!strategyId && !castleId) return { filled: 0, total: 0, filledSquares: [] };
  const board = sfenPieceAt(sfen);
  const targets = openingFormation(strategyId, castleId).pieces.filter(({ moved, promoted }) => moved && !promoted);
  const filledSquares = [];
  for (const piece of targets) {
    const square = color === "white" ? mirrorUsiMove(`${piece.square}${piece.square}`).slice(0, 2) : piece.square;
    const current = board.get(square);
    if (current?.color === color && current.kind === piece.kind) filledSquares.push(piece.square);
  }
  return { filled: filledSquares.length, total: targets.length, filledSquares };
}
