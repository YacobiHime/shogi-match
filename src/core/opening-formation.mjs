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
 * @typedef {{ id: string, square: string, kind: string, promoted: boolean, moved: boolean }} FormationPiece
 *   idは初めにいたマス(打った駒は「drop:マス」)。再生で同じ駒をすべらせて動かすのに使う。
 * @typedef {{ usi: string, phase: "strategy" | "castle", kind: string, from: string, to: string, promote: boolean, drop: boolean, exchange: boolean }} FormationStep
 */

/**
 * 手順を先手の駒だけで指し進め、1手ごとの形を残す(くわしい画面の1手ずつの再生と、完成形の小さな盤)。
 * stepsは実際に駒が動いた手だけ(動かす駒がいない手は入れない)。framesはstepsより1つ多く、frames[0]が初めの形。
 * @param {string} strategyId
 * @param {string} castleId
 * @returns {{ steps: readonly FormationStep[], frames: readonly (readonly FormationPiece[])[] }}
 */
export function openingFormationSteps(strategyId = "", castleId = "") {
  const key = `${strategyId}|${castleId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const board = new Map(INITIAL_BLACK.map(([square, kind]) => [square, { id: square, kind, promoted: false, moved: false }]));
  const { strategy, castle } = resolveOpeningPlanDefinitions(strategyId, castleId);
  /** @type {[string, "strategy" | "castle"][]} */
  const moves = [
    ...(strategy?.blackMoves ?? []).map((move) => [move, "strategy"]),
    ...(castle?.blackMoves ?? []).map((move) => [move, "castle"]),
  ];
  /** @type {FormationStep[]} */
  const steps = [];
  const snapshot = () => Object.freeze([...board].map(([square, piece]) => Object.freeze({ square, ...piece })));
  const frames = [snapshot()];
  const record = (step) => {
    steps.push(Object.freeze(step));
    frames.push(snapshot());
  };
  const play = (from, to, promote, usi, phase) => {
    const piece = board.get(from);
    if (!piece) return;
    board.delete(from);
    board.set(to, { ...piece, promoted: piece.promoted || promote, moved: true });
    record({ usi, phase, kind: piece.kind, from, to, promote: promote && !piece.promoted, drop: false, exchange: false });
  };
  for (const [move, phase] of moves) {
    if (typeof move !== "string") continue;
    if (move === "@kakugawari") {
      play("7g", "7f", false, "7g7f", phase);
      if (board.get("8h")?.kind === "B") {
        board.delete("8h");
        record({ usi: "@kakugawari", phase, kind: "B", from: "8h", to: "", promote: false, drop: false, exchange: true });
      }
      continue;
    }
    const drop = USI_DROP.exec(move);
    if (drop) {
      if (board.has(drop[2])) continue;
      board.set(drop[2], { id: `drop:${drop[2]}`, kind: drop[1], promoted: false, moved: true });
      record({ usi: move, phase, kind: drop[1], from: "", to: drop[2], promote: false, drop: true, exchange: false });
      continue;
    }
    const step = USI_MOVE.exec(move);
    if (step) play(step[1], step[2], step[3] === "+", move, phase);
  }
  const result = Object.freeze({ steps: Object.freeze(steps), frames: Object.freeze(frames) });
  cache.set(key, result);
  return result;
}

/**
 * 先手から見た完成形。piecesは自分の駒すべて、movedは手順で動いた駒のマス(カードで濃く描き、対局で薄く出す)。
 * @param {string} strategyId
 * @param {string} castleId
 * @returns {{ pieces: readonly FormationPiece[], moved: string[] }}
 */
export function openingFormation(strategyId = "", castleId = "") {
  const { frames } = openingFormationSteps(strategyId, castleId);
  const pieces = frames[frames.length - 1];
  return { pieces, moved: pieces.filter(({ moved }) => moved).map(({ square }) => square) };
}

const FILE_DIGITS = ["", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
const RANK_KANJI = { a: "一", b: "二", c: "三", d: "四", e: "五", f: "六", g: "七", h: "八", i: "九" };
const PIECE_NAMES = { K: "玉", R: "飛", B: "角", G: "金", S: "銀", N: "桂", L: "香", P: "歩" };

/**
 * 再生の1手の名前(「▲7六歩」)。後手で指すときは盤を反転したマスで「△3四歩」と書く。
 * @param {FormationStep} step
 * @param {"black" | "white"} color
 */
export function openingStepLabel(step, color = "black") {
  if (step.exchange) return "角を交換する";
  const to = color === "white" ? mirrorUsiMove(`${step.to}${step.to}`).slice(0, 2) : step.to;
  const mark = color === "white" ? "△" : "▲";
  const suffix = step.drop ? "打" : step.promote ? "成" : "";
  return `${mark}${FILE_DIGITS[Number(to[0])]}${RANK_KANJI[/** @type {keyof typeof RANK_KANJI} */ (to[1])]}${PIECE_NAMES[/** @type {keyof typeof PIECE_NAMES} */ (step.kind)] ?? ""}${suffix}`;
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
