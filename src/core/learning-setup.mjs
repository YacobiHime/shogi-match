import { Color, InitialPositionSFEN, Position, Square } from "tsshogi";
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import {
  isOpeningPlanComplete,
  mirrorUsiMove,
  nextOpeningPlanMove,
  openingPlanInterruption,
} from "./opening-guide.mjs";
import { parseSfenBoard } from "./sfen-board.mjs";

export const STANDARD_START_SFEN = String(InitialPositionSFEN.STANDARD);

/** 駒落ちの一覧。上手（駒を落とす側）は後手で、上手から指し始める。 */
export const LEARNING_HANDICAPS = Object.freeze([
  { id: "lance", label: "香落ち", sfen: InitialPositionSFEN.HANDICAP_LANCE },
  { id: "right-lance", label: "右香落ち", sfen: InitialPositionSFEN.HANDICAP_RIGHT_LANCE },
  { id: "bishop", label: "角落ち", sfen: InitialPositionSFEN.HANDICAP_BISHOP },
  { id: "rook", label: "飛車落ち", sfen: InitialPositionSFEN.HANDICAP_ROOK },
  { id: "rook-lance", label: "飛香落ち", sfen: InitialPositionSFEN.HANDICAP_ROOK_LANCE },
  { id: "2pieces", label: "二枚落ち", sfen: InitialPositionSFEN.HANDICAP_2PIECES },
  { id: "4pieces", label: "四枚落ち", sfen: InitialPositionSFEN.HANDICAP_4PIECES },
  { id: "6pieces", label: "六枚落ち", sfen: InitialPositionSFEN.HANDICAP_6PIECES },
  { id: "8pieces", label: "八枚落ち", sfen: InitialPositionSFEN.HANDICAP_8PIECES },
  { id: "10pieces", label: "十枚落ち", sfen: InitialPositionSFEN.HANDICAP_10PIECES },
]);

/** 閃き・待ったの回数設定。-1は無制限。 */
export const LEARNING_ASSIST_LIMITS = Object.freeze([
  { value: 0, label: "なし" },
  { value: 1, label: "1回" },
  { value: 3, label: "3回" },
  { value: 5, label: "5回" },
  { value: 10, label: "10回" },
  { value: -1, label: "無制限" },
]);
export const UNLIMITED_ASSIST = -1;

/** 回数設定を残り回数へ変換する。無制限はInfinityで扱う。 */
export function assistAllowance(limit) {
  if (limit === UNLIMITED_ASSIST) return Number.POSITIVE_INFINITY;
  return Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 0;
}

export function formatAssistCount(count) {
  return Number.isFinite(count) ? String(count) : "∞";
}

/** 選択肢の値かを確かめ、そうでなければ既定値へ戻す。 */
export function normalizeAssistLimit(value, fallback = 3) {
  return LEARNING_ASSIST_LIMITS.some((option) => option.value === value) ? value : fallback;
}

export function handicapById(id) {
  return LEARNING_HANDICAPS.find((handicap) => handicap.id === id) ?? null;
}

/**
 * 学習対局の開始局面を決める。
 * 駒落ちでは上手を後手に置くため、駒を落とす側に合わせて自分の手番を決め直す。
 */
export function learningStartPosition({
  startType = "standard",
  handicapId = "",
  handicapGiver = "cpu",
  playerColor = "black",
  formationSfen = "",
  standardSfen = STANDARD_START_SFEN,
} = {}) {
  if (startType === "handicap") {
    const handicap = handicapById(handicapId) ?? LEARNING_HANDICAPS[0];
    return {
      sfen: handicap.sfen,
      playerColor: handicapGiver === "player" ? "white" : "black",
      label: handicap.label,
    };
  }
  if (startType === "formation" && formationSfen) {
    return { sfen: formationSfen, playerColor, label: "戦型完成" };
  }
  return { sfen: standardSfen, playerColor, label: "" };
}

// 角換わりなどを目指す相手のため、作戦のない側はまず角道を開ける。
const OPENING_WAITING_MOVE = "7g7f";
// 形を大きく変えずに手番を渡すため、自陣で1升動いてすぐ戻れる手を使う。
const SHUFFLE_MOVES = Object.freeze([
  "5i5h", "4i4h", "6i6h", "2h3h", "5i4h", "5i6h", "4i5h", "6i5h",
]);
const OWN_CAMP_RANKS = Object.freeze({ black: ["g", "h", "i"], white: ["a", "b", "c"] });

function planFor(plans, color) {
  const plan = plans[color];
  return plan && (plan.strategyId || plan.castleId) ? plan : null;
}

/**
 * 先手・後手の作戦をそれぞれ案内どおりに指し進め、両方が完成した局面を作る。
 * 作戦のない側や完成済みの側は、形を崩さない待機手で手番を渡す。
 */
export function buildFormationStart({ black = null, white = null, maxPlies = 200 } = {}) {
  const plans = { black, white };
  if (!planFor(plans, "black") && !planFor(plans, "white")) {
    return { ok: false, message: "完成させる戦法か囲いを選んでね。" };
  }
  const record = createGameRecord(STANDARD_START_SFEN);
  const moveHistory = [];
  const lastWaitingMove = { black: "", white: "" };
  let lastCaptureSquare = "";
  const options = (color, legalMoves) => {
    const parity = color === "black" ? 0 : 1;
    return {
      ...planFor(plans, color),
      color,
      playedMoves: moveHistory.filter((_, index) => index % 2 === parity),
      opponentMoves: moveHistory.filter((_, index) => index % 2 !== parity),
      moveHistory,
      legalMoves,
      currentSfen: record.position.sfen,
    };
  };
  const complete = (color) => {
    const plan = planFor(plans, color);
    return !plan || isOpeningPlanComplete(options(color, []));
  };
  const safeForFormation = (color, usi) => {
    if (!planFor(plans, color) || !complete(color)) return true;
    const probe = createGameRecord(record.position.sfen);
    if (!appendUsiMove(probe, usi)) return false;
    const parity = color === "black" ? 0 : 1;
    const history = [...moveHistory, usi];
    return isOpeningPlanComplete({
      ...planFor(plans, color),
      color,
      playedMoves: history.filter((_, index) => index % 2 === parity),
      opponentMoves: history.filter((_, index) => index % 2 !== parity),
      currentSfen: probe.position.sfen,
    });
  };
  const waitingMove = (color, legalMoves) => {
    const convert = color === "white" ? mirrorUsiMove : (move) => move;
    // 角交換などで駒を取られたら、まず同じ升で取り返す。
    if (lastCaptureSquare) {
      const recapture = legalMoves.find((usi) => (
        usi.slice(2, 4) === lastCaptureSquare && !usi.endsWith("+") && safeForFormation(color, usi)
      ));
      if (recapture) return recapture;
    }
    const usable = (move) => legalMoves.includes(move) && safeForFormation(color, move);
    const opening = convert(OPENING_WAITING_MOVE);
    if (!planFor(plans, color) && !moveHistory.includes(opening) && usable(opening)) return opening;
    // 直前の待機手を戻して、局面をできるだけ元の形に保つ。
    const previous = lastWaitingMove[color];
    const reverse = previous ? `${previous.slice(2, 4)}${previous.slice(0, 2)}` : "";
    if (reverse && usable(reverse)) return reverse;
    const shuffle = SHUFFLE_MOVES.map(convert).find(usable);
    if (shuffle) return shuffle;
    // 最後の手段として、自陣の中だけで駒を取らずに動く手を使う。
    const board = parseSfenBoard(record.position.sfen);
    return legalMoves.find((move) => (
      /^[1-9][a-i][1-9][a-i]$/.test(move)
      && OWN_CAMP_RANKS[color].includes(move[3])
      && !board.get(move.slice(2, 4))
      && ["K", "G", "S", "R"].includes(board.get(move.slice(0, 2))?.kind)
      && safeForFormation(color, move)
    ));
  };

  for (let ply = 0; ply < maxPlies; ply += 1) {
    if (complete("black") && complete("white")) {
      const fields = record.position.sfen.split(" ");
      fields[3] = "1";
      return { ok: true, sfen: fields.join(" "), moves: [...moveHistory] };
    }
    const color = record.position.color === Color.BLACK ? "black" : "white";
    const legalMoves = enumerateLegalMoves(record.position).map(({ usi }) => usi);
    let usi;
    if (planFor(plans, color) && !complete(color)) {
      const interruption = openingPlanInterruption(options(color, legalMoves));
      if (interruption) {
        return { ok: false, message: `${color === "black" ? "先手" : "後手"}の作戦を完成できない組み合わせだよ。${interruption.message}` };
      }
      usi = nextOpeningPlanMove(options(color, legalMoves))?.usi;
    }
    if (!usi) {
      usi = waitingMove(color, legalMoves);
      lastWaitingMove[color] = usi ?? "";
    }
    const destination = usi && /^[1-9][a-i][1-9][a-i]/.test(usi) ? usi.slice(2, 4) : "";
    const captures = Boolean(destination && parseSfenBoard(record.position.sfen).get(destination));
    if (!usi || !appendUsiMove(record, usi)) {
      return { ok: false, message: "この組み合わせでは完成形まで指し進められなかったよ。" };
    }
    lastCaptureSquare = captures ? destination : "";
    moveHistory.push(usi);
  }
  return { ok: false, message: "この組み合わせでは完成形まで指し進められなかったよ。" };
}

/** 盤上の各升に利いている先手・後手の駒数を返す。 */
export function attackMap(sfen) {
  const position = Position.newBySFEN(sfen);
  if (!position) return [];
  const entries = [];
  for (const square of Square.all) {
    let blackCount = 0;
    let whiteCount = 0;
    for (const from of position.listAttackers(square)) {
      if (position.board.at(from)?.color === Color.BLACK) blackCount += 1;
      else whiteCount += 1;
    }
    if (blackCount || whiteCount) {
      entries.push({ file: square.file, rank: square.rank, black: blackCount, white: whiteCount });
    }
  }
  return entries;
}
