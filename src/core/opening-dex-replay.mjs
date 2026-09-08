/**
 * 定跡図鑑用の簡易盤面再生。
 * 手順リストには相手の応手が省かれているため、合法手判定ではなく
 * USIの通りに盤面の駒を動かすだけでSFENを作り直す。
 */

const HAND_ORDER = Object.freeze(["R", "B", "G", "S", "N", "L", "P", "r", "b", "g", "s", "n", "l", "p"]);

export function mirrorUsiSquare(usi) {
  return String(usi).replace(/([1-9])([a-i])/g, (_, file, rank) => (
    `${10 - Number(file)}${String.fromCharCode(
      "a".charCodeAt(0) + "i".charCodeAt(0) - rank.charCodeAt(0),
    )}`
  ));
}

export function parseSfenBoard(sfen) {
  const parts = String(sfen ?? "").trim().split(/\s+/);
  const board = new Map();
  const hands = new Map();
  let handCount = "";
  for (const symbol of parts[2] ?? "-") {
    if (/\d/.test(symbol)) handCount += symbol;
    else if (/[PLNSGBRplnsgbr]/.test(symbol)) {
      hands.set(symbol, (hands.get(symbol) ?? 0) + (Number(handCount) || 1));
      handCount = "";
    }
  }
  (parts[0] ?? "").split("/").forEach((rank, rankIndex) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) file -= Number(symbol);
      else if (symbol === "+") promoted = true;
      else {
        board.set(`${file}${String.fromCharCode(97 + rankIndex)}`, `${promoted ? "+" : ""}${symbol}`);
        file -= 1;
        promoted = false;
      }
    }
  });
  return { board, hands };
}

export function serializeSfenBoard({ board, hands }) {
  const boardToken = Array.from({ length: 9 }, (_, rankIndex) => {
    let row = "";
    let empty = 0;
    for (let file = 9; file >= 1; file -= 1) {
      const piece = board.get(`${file}${String.fromCharCode(97 + rankIndex)}`);
      if (!piece) empty += 1;
      else {
        if (empty) row += String(empty);
        row += piece;
        empty = 0;
      }
    }
    return `${row}${empty || ""}`;
  }).join("/");
  const handToken = HAND_ORDER.map((symbol) => {
    const count = hands.get(symbol) ?? 0;
    return count ? `${count > 1 ? count : ""}${symbol}` : "";
  }).join("") || "-";
  return `${boardToken} b ${handToken} 1`;
}

function applyBlindMove({ board, hands }, usi, dropSymbol = "") {
  const drop = /^([PLNSGBR])\*([1-9][a-i])$/.exec(usi);
  const move = /^([1-9][a-i])([1-9][a-i])(\+)?$/.exec(usi);
  if (drop) {
    // 後手視点へ反転した盤面では、駒打ちも後手の駒として置く。
    const symbol = dropSymbol || drop[1];
    const count = hands.get(symbol) ?? 0;
    if (count > 1) hands.set(symbol, count - 1);
    else hands.delete(symbol);
    board.set(drop[2], symbol);
    return;
  }
  if (!move) return;
  const piece = board.get(move[1]);
  if (!piece) return;
  const captured = board.get(move[2]);
  if (captured) {
    const capturedKind = captured.replace("+", "");
    const handSymbol = capturedKind === capturedKind.toUpperCase()
      ? capturedKind.toLowerCase()
      : capturedKind.toUpperCase();
    hands.set(handSymbol, (hands.get(handSymbol) ?? 0) + 1);
  }
  board.delete(move[1]);
  board.set(move[2], move[3] && !piece.startsWith("+") ? `+${piece}` : piece);
}

/**
 * 定跡の手順を初期局面から再生した手順（局面つき）を返す。
 * @param {{ blackMoves?: string[] }} definition 定跡定義（先手基準の手順）
 * @param {{ whiteSide?: boolean, initialSfen: string,
 *           routines?: Array<{token: string, label: string, previewMoves?: string[]}>,
 *           formatLabel?: (usi: string, beforeSfen: string) => string }} options
 * @returns {Array<{ sfen: string, label: string, lastMove: string, routine: string | null }>}
 */
export function buildOpeningDexSteps(definition, { whiteSide = false, initialSfen, routines = [], formatLabel } = {}) {
  const initial = { sfen: initialSfen, label: "初期局面", lastMove: "", routine: null };
  if (!Array.isArray(definition?.blackMoves) || definition.blackMoves.length === 0) return [initial];
  const convert = whiteSide ? mirrorUsiSquare : (move) => move;
  const state = parseSfenBoard(initialSfen);
  const steps = [initial];
  const pushStep = (label, lastMove, routine) => {
    steps.push({ sfen: serializeSfenBoard(state), label, lastMove, routine });
  };
  for (const token of definition.blackMoves) {
    if (typeof token === "string" && token.startsWith("@")) {
      const routine = routines.find((candidate) => candidate.token === token);
      for (const previewMove of routine?.previewMoves ?? []) {
        applyBlindMove(
          state,
          convert(previewMove),
          whiteSide ? `${previewMove}`.slice(0, 1).toLowerCase() : "",
        );
      }
      pushStep(routine?.label ?? token, "", routine?.label ?? token);
      continue;
    }
    const usi = convert(token);
    const beforeSfen = serializeSfenBoard(state);
    const isDrop = /^([PLNSGBR])\*/.test(String(token));
    applyBlindMove(state, usi, whiteSide && isDrop ? `${token}`.slice(0, 1).toLowerCase() : "");
    let label = usi;
    try { label = formatLabel?.(usi, beforeSfen) ?? usi; } catch { label = usi; }
    pushStep(label, usi, null);
  }
  return steps;
}
