import { parseSfenState } from "./piece-movement.mjs";
import { mirrorUsiMove } from "./opening-guide.mjs";

const bougin = "2g2f 8c8d 2f2e 8d8e 3i3h 4a3b 3h2g 7a7b 2g2f 9c9d 2f1e 5a4b 2e2d".split(" ");
export const CPU_POSITION_SET = Object.freeze([
  { id: "bougin-push", sfen: "ln1g2snl/1rs2kgb1/2ppppppp/p6P1/1p6S/9/PPPPPPP1P/1B5R1/LNSGKG1NL w - 1", moves: bougin },
  { id: "bougin-silver", sfen: "ln1g2snl/1rs2kgb1/2ppppp1p/p6S1/1p7/9/PPPPPPP1P/1B5R1/LNSGKG1NL w Pp 1", moves: [...bougin, "2c2d", "1e2d"] },
  { id: "center-trade", sfen: "lnsg1gsnl/3k1r3/ppppp1bpp/4Ppp2/7P1/2P6/PP1P1PP1P/1B5R1/LNSGKGSNL w - 1", moves: "7g7f 3c3d 2g2f 4c4d 2f2e 2b3c 5g5f 8b4b 5f5e 5a6b 5e5d".split(" ") },
  { id: "rook-attacked", sfen: "lnsgkgsnl/1r5b1/p2pppppp/2p6/4B4/2P4R1/PP1PPPP1P/2S6/LN1GKGSNL w Pp 1", lastMove: "8h5e" },
  // 玉9八では香の移動先9八と重なるため、玉8八の穴熊への移行形。
  { id: "anaguma", sfen: "lnsgkgsnl/1r5b1/ppppppppp/9/9/2B6/PPPPPPPPP/1KSG3R1/LN3GSNL b - 1" },
  { id: "hopeless", sfen: "4k4/4g4/9/9/9/9/1br3r2/G1G3G2/4K4 b N 1" },
]);

/** @param {string} sfen */
export function mirrorPositionSfen(sfen) {
  const { board, turn } = parseSfenState(sfen);
  const mirrored = new Map([...board].map(([square, piece]) => [mirrorUsiMove(square), {
    kind: piece.kind, color: piece.color === "black" ? "white" : "black",
  }]));
  const rows = [];
  for (let rank = 0; rank < 9; rank += 1) {
    let row = "";
    let empty = 0;
    for (let file = 9; file >= 1; file -= 1) {
      const piece = mirrored.get(`${file}${String.fromCharCode(97 + rank)}`);
      if (!piece) { empty += 1; continue; }
      if (empty) row += empty;
      empty = 0;
      row += piece.color === "black" ? piece.kind : piece.kind.toLowerCase();
    }
    rows.push(row + (empty || ""));
  }
  const fields = sfen.split(" ");
  const hands = fields[2].replace(/[a-zA-Z]/g, (c) => c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase());
  return `${rows.join("/")} ${turn === "black" ? "w" : "b"} ${hands} ${fields[3] ?? "1"}`;
}

export function cpuPositionVariants() {
  return CPU_POSITION_SET.flatMap((position) => {
    const moveHistory = position.moves ?? (position.lastMove ? [position.lastMove] : []);
    return [
      { ...position, mirrored: false, moveHistory },
      { ...position, sfen: mirrorPositionSfen(position.sfen), mirrored: true, moveHistory: moveHistory.map(mirrorUsiMove) },
    ];
  });
}
