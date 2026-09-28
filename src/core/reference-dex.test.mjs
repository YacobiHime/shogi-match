import { describe, expect, it } from "vitest";
import { Position } from "tsshogi";
import { createGameRecord, enumerateLegalMoves } from "../game-state";
import {
  REFERENCE_DEX_KINDS,
  pieceReachSquares,
  referenceDexEntries,
  referenceDexGroups,
  referenceEntryMarks,
  referenceEntrySfen,
} from "./reference-dex.mjs";

const KINDS = Object.keys(REFERENCE_DEX_KINDS);

describe("reference dex", () => {
  it("offers piece, tesuji and shogi-world dexes with grouped entries", () => {
    expect(KINDS).toEqual(["piece", "tesuji", "world"]);
    for (const kind of KINDS) {
      const entries = referenceDexEntries(kind);
      expect(entries.length, kind).toBeGreaterThanOrEqual(8);
      expect(new Set(entries.map(({ id }) => id)).size).toBe(entries.length);
      const grouped = referenceDexGroups(kind).flatMap(({ items }) => items.map(({ id }) => id));
      expect(grouped).toEqual(entries.map(({ id }) => id));
    }
  });

  it.each(KINDS)("shows a legal position with valid arrows and marks for every %s entry", (kind) => {
    for (const entry of referenceDexEntries(kind)) {
      const sfen = referenceEntrySfen(entry);
      const record = createGameRecord(sfen);
      // 手番でない側が王手されている局面は不正。
      const fields = sfen.split(" ");
      fields[1] = fields[1] === "b" ? "w" : "b";
      expect(Position.newBySFEN(fields.join(" "))?.checked, `${entry.id}: 手番でない側が王手されている`).toBe(false);
      const legal = enumerateLegalMoves(record.position).map(({ usi }) => usi);
      for (const usi of entry.arrows ?? []) expect(legal, `${entry.id}: ${usi}`).toContain(usi);
      for (const { file, rank, tone } of referenceEntryMarks(entry)) {
        expect(file).toBeGreaterThanOrEqual(1);
        expect(file).toBeLessThanOrEqual(9);
        expect(rank).toBeGreaterThanOrEqual(1);
        expect(rank).toBeLessThanOrEqual(9);
        expect(["reach", "target", "key"]).toContain(tone);
      }
      expect(entry.overview, entry.id).toEqual(expect.any(String));
      expect(entry.rows.length, entry.id).toBeGreaterThanOrEqual(2);
    }
  });

  it.each([
    ["pawn", ["5d"]],
    ["knight", ["6c", "4c"]],
    ["gold", ["6d", "5d", "4d", "6e", "4e", "5f"]],
    ["silver", ["6d", "5d", "4d", "6f", "4f"]],
  ])("colors the squares the %s can move to", (id, expected) => {
    const entry = referenceDexEntries("piece").find((candidate) => candidate.id === id);
    const reach = referenceEntryMarks(entry).filter(({ tone }) => tone === "reach")
      .map(({ file, rank }) => `${file}${String.fromCharCode(96 + rank)}`);
    expect(new Set(reach)).toEqual(new Set(expected));
  });

  it("counts the long-range reach of the major pieces", () => {
    const pieces = referenceDexEntries("piece");
    const reachOf = (id) => {
      const entry = pieces.find((candidate) => candidate.id === id);
      return pieceReachSquares(referenceEntrySfen(entry), entry.pieceSquare);
    };
    expect(reachOf("rook")).toHaveLength(16);
    expect(reachOf("bishop")).toHaveLength(16);
    expect(reachOf("dragon")).toHaveLength(20);
    expect(reachOf("horse")).toHaveLength(20);
    expect(reachOf("king")).toHaveLength(8);
  });

  it("demonstrates the head-gold mate and the knight fork", () => {
    const tesuji = referenceDexEntries("tesuji");
    const mate = createGameRecord(referenceEntrySfen(tesuji.find(({ id }) => id === "drop-to-bottom")));
    expect(mate.append(mate.position.createMoveByUSI("G*5b"))).toBe(true);
    // 頭金で後手は一手も指せない（詰み）。
    expect(enumerateLegalMoves(mate.position)).toHaveLength(0);
    const fork = tesuji.find(({ id }) => id === "knight-fork");
    const afterFork = createGameRecord(referenceEntrySfen(fork));
    afterFork.append(afterFork.position.createMoveByUSI("4e5c"));
    expect(pieceReachSquares(afterFork.position.sfen, "5c").sort()).toEqual(["4a", "6a"]);
  });
});
