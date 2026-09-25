import { describe, expect, it } from "vitest";
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import {
  isOpeningPlanComplete, nextOpeningPlanMove, rangingRookStrategyChoices,
  OPENING_CASTLES,
} from "./opening-guide.mjs";
import { CPU_OPENING_REPERTOIRES } from "./cpu-opening-repertoire.mjs";

function planFailure(strategyId, castleId, color) {
  let record = createGameRecord();
  const playedMoves = [];
  const opponentMoves = [];
  const moveHistory = [];
  const apply = (usi, owner) => {
    const fields = record.position.sfen.split(" ");
    fields[1] = owner === "black" ? "b" : "w";
    record = createGameRecord(fields.join(" "));
    if (!appendUsiMove(record, usi)) return false;
    (owner === color ? playedMoves : opponentMoves).push(usi);
    moveHistory.push(usi);
    return true;
  };
  if (strategyId === "kakugawari") {
    if (!apply("7g7f", "black") || !apply("3c3d", "white")) return "setup illegal";
  }
  if (strategyId === "pacman" && color === "white" && !apply("7g7f", "black")) {
    return "setup illegal";
  }
  for (let step = 0; step < 60; step += 1) {
    if (isOpeningPlanComplete({ strategyId, castleId, color, playedMoves, opponentMoves,
      currentSfen: record.position.sfen })) return null;
    const fields = record.position.sfen.split(" ");
    fields[1] = color === "black" ? "b" : "w";
    const position = createGameRecord(fields.join(" "));
    const legalMoves = enumerateLegalMoves(position.position).map(({ usi }) => usi);
    const next = nextOpeningPlanMove({ strategyId, castleId, color, playedMoves,
      opponentMoves, moveHistory, currentSfen: record.position.sfen, legalMoves });
    if (!next) return `no candidate after ${playedMoves.join(" ")} (${step} steps)`;
    if (!apply(next.usi, color)) return `illegal ${next.usi}`;
    if (strategyId === "pacman" && color === "white" && next.usi === "4c4d"
      && !apply("8h4d", "black")) return "illegal 8h4d";
    if (["8h2b+", "2b8h+"].includes(next.usi)) {
      const recapture = color === "black" ? "3a2b" : "7i8h";
      if (!apply(recapture, color === "black" ? "white" : "black")) return `illegal ${recapture}`;
    }
  }
  return "too many moves";
}

describe("戦法と囲いの組み合わせ", () => {
  const pairs = new Map();
  for (const { id: castleId } of OPENING_CASTLES) {
    for (const { id: strategyId } of rangingRookStrategyChoices(castleId)) {
      pairs.set(`${strategyId}+${castleId}`, { strategyId, castleId });
    }
  }
  for (const repertoire of Object.values(CPU_OPENING_REPERTOIRES)) {
    pairs.set(`${repertoire.strategyId}+${repertoire.castleId}`, repertoire);
  }
  it.each(["black", "white"])("案内された組み合わせを最後まで進められる: %s", (color) => {
    const failures = [...pairs.values()].flatMap(({ strategyId, castleId }) => {
      const reason = planFailure(strategyId, castleId, color);
      return reason ? [`${strategyId}+${castleId}: ${reason}`] : [];
    });
    expect(failures).toEqual([]);
  });
});
