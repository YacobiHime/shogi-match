import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Position, Square } from "tsshogi";
import { createGameRecord, enumerateLegalMoves } from "../game-state";
import {
  REFERENCE_DEX_KINDS,
  pieceReachSquares,
  referenceDexEntries,
  referenceDexGroups,
  referenceEntryKifu,
  referenceEntryMarks,
  referenceEntrySfen,
  referencePieceImageEntryId,
} from "./reference-dex.mjs";

const KINDS = Object.keys(REFERENCE_DEX_KINDS);

describe("reference dex", () => {
  it("links every piece image in the value tables to its piece entry", () => {
    const entries = referenceDexEntries("piece");
    const ids = new Set(entries.map(({ id }) => id));
    const images = entries.flatMap(({ table, aiTable }) => [
      ...(table ?? []).flatMap(({ pieces }) => pieces),
      ...(aiTable?.pieces ?? []),
    ]).flatMap(({ images: names }) => names);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(ids.has(referencePieceImageEntryId(image)), image).toBe(true);
    expect(referencePieceImageEntryId("black_prom_pawn")).toBe("tokin");
    expect(referencePieceImageEntryId("black_prom_lance")).toBe("promoted-minor");
    expect(referencePieceImageEntryId("unknown")).toBe("");
  });

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
    for (const entry of referenceDexEntries(kind).filter(({ table }) => !table)) {
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

  it("replays every kifu in the shogi-world dex move by move to the end", () => {
    const entries = referenceDexEntries("world").filter(({ kifu }) => kifu);
    expect(entries.map(({ id }) => id)).toContain("koyama");
    for (const entry of entries) {
      const { steps } = referenceEntryKifu(entry);
      expect(steps[0].lastMove, entry.id).toBe("");
      for (let index = 1; index < steps.length; index += 1) {
        // 前の局面から、記録した手を合法に指すと次の局面になる。
        const record = createGameRecord(steps[index - 1].sfen);
        const move = record.position.createMoveByUSI(steps[index].lastMove);
        expect(move && record.append(move), `${entry.id}: ${index}手目`).toBe(true);
        expect(record.position.sfen.split(" ").slice(0, 3)).toEqual(steps[index].sfen.split(" ").slice(0, 3));
        expect(steps[index].label, `${entry.id}: ${index}手目`).toMatch(/^[▲△]/);
      }
      expect(referenceEntrySfen(entry)).toBe(steps.at(-1).sfen);
    }
  });

  it("shows Koyama Reo's entrance-exam win built on an anaguma", () => {
    const entry = referenceDexEntries("world").find(({ id }) => id === "koyama");
    const kifu = referenceEntryKifu(entry);
    expect(kifu.black).toBe("小山怜央 アマ");
    expect(kifu.white).toBe("横山友紀 四段");
    expect(kifu.ending).toBe("投了");
    expect(kifu.steps).toHaveLength(134);
    expect(kifu.steps.at(-1).label).toBe("▲７三角成");
    // 39手目の8八銀で、玉が9九・香が9八・銀が8八・金が7八の居飛車穴熊に組んでいる。
    const anaguma = Position.newBySFEN(kifu.steps[39].sfen);
    const at = (file, rank) => anaguma.board.at(new Square(file, rank));
    expect([at(9, 9), at(9, 8), at(8, 8), at(7, 8)].map((piece) => piece?.color === "black" && piece.type))
      .toEqual(["king", "lance", "silver", "gold"]);
    expect(kifu.steps[39].comment).toContain("穴熊");
    // 穴熊の完成は、棋譜のしおりで見せ場にしている。
    expect(kifu.steps.filter(({ highlight }) => highlight).map(({ highlight }) => highlight)).toEqual(["穴熊の完成"]);
    expect(kifu.steps[39].highlight).toBe("穴熊の完成");
    expect(kifu.winner).toBe("black");
    expect(entry.rows.map(([, text]) => text).join("")).toContain("相手がどんな指し手をしてきても、穴熊を組むことができる");
  });

  it("shows the oldest surviving kifu in the Edo meijin entry", () => {
    const entry = referenceDexEntries("world").find(({ id }) => id === "edo-meijin");
    const kifu = referenceEntryKifu(entry);
    expect(kifu.black).toBe("初代大橋宗桂");
    expect(kifu.white).toBe("本因坊算砂");
    expect(kifu.steps).toHaveLength(134);
    expect(kifu.steps[10].label).toBe("△４二飛");
    expect(kifu.steps.at(-1).label).toBe("▲６三香成");
    expect(kifu.winner).toBe("black");
  });

  it("shows Amano Soho's game from his side as the second player", () => {
    const entries = referenceDexEntries("world");
    const entry = entries.find(({ id }) => id === "amano-soho");
    const kifu = referenceEntryKifu(entry);
    expect(kifu.black).toBe("八代大橋宗珉");
    expect(kifu.white).toBe("天野宗歩");
    expect(entry.flip).toBe(true);
    expect(kifu.steps).toHaveLength(97);
    expect(kifu.steps.at(-1).label).toBe("△８六銀");
    expect(kifu.ending).toBe("投了");
    expect(kifu.winner).toBe("white");
    // 名棋士は時代の順に並べ、江戸時代の宗歩を最初にする。
    expect(entries.filter(({ group }) => group === "名棋士")[0].id).toBe("amano-soho");
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

  it("shows the piece value tier table without a board", () => {
    const entry = referenceDexEntries("piece").find(({ id }) => id === "piece-values");
    expect(entry.table.map(({ tier }) => tier)).toEqual(["別格", "S", "A", "B", "C", "D"]);
    expect(referenceEntrySfen(entry)).toBe("");
    expect(referenceEntryMarks(entry)).toEqual([]);
    const points = entry.table.flatMap(({ pieces }) => pieces).filter(({ points }) => typeof points === "number");
    // 上のtierほど点数が高く、同じtierの中でも点数の高い順に並ぶ。
    expect(points.map(({ points: value }) => value)).toEqual([...points.map(({ points: value }) => value)].sort((a, b) => b - a));
    expect(points.find(({ label }) => label === "歩兵").points).toBe(1);
    expect(points.find(({ label }) => label === "飛車").points).toBe(10);
    // 駒は文字でなく画像で並べる。画像名は盤の駒画像と同じ。
    for (const piece of [...entry.table.flatMap(({ pieces }) => pieces), ...entry.aiTable.pieces]) {
      expect(piece.images.length, piece.label).toBeGreaterThan(0);
      for (const image of piece.images) {
        expect(existsSync(new URL(`../../public/piece/hitomoji_wood/${image}.webp`, import.meta.url)), image).toBe(true);
      }
    }
    // 将棋AIの点数でも、成る前の駒は歩＜香＜桂＜銀＜金＜角＜飛の順になる。
    const ai = new Map(entry.aiTable.pieces.map(({ label, value }) => [label, value]));
    const order = ["歩兵", "香車", "桂馬", "銀将", "金将", "角行", "飛車"].map((label) => ai.get(label));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it("groups the tesuji dex by piece and the mating shapes", () => {
    const groups = referenceDexGroups("tesuji");
    expect(groups.map(({ label }) => label)).toEqual([
      "詰みの形", "歩の格言", "香の格言", "桂の格言", "銀の格言",
      "金の格言", "角の格言", "飛車の格言", "玉の格言", "全般の格言",
    ]);
    const labels = referenceDexEntries("tesuji").map(({ label }) => label);
    expect(labels.length).toBeGreaterThanOrEqual(35);
    for (const label of ["頭金", "竜は敵陣に馬は自陣に", "金底の歩、岩よりも堅し"]) expect(labels).toContain(label);
    expect(labels.some((label) => label.startsWith("腹銀"))).toBe(true);
  });

  it.each([
    ["head-gold", ["G*5b"]],
    // 腹銀のあと、相手が手を渡した形で5二金まで進めると詰む。
    ["belly-silver", ["S*4a", "G*5b"]],
  ])("mates with the %s shape", (id, moves) => {
    const entry = referenceDexEntries("tesuji").find((candidate) => candidate.id === id);
    let sfen = referenceEntrySfen(entry);
    for (const usi of moves) {
      const record = createGameRecord(sfen);
      expect(record.append(record.position.createMoveByUSI(usi)), usi).toBe(true);
      const fields = record.position.sfen.split(" ");
      fields[1] = "b";
      sfen = fields.join(" ");
    }
    const fields = sfen.split(" ");
    fields[1] = "w";
    const final = createGameRecord(fields.join(" "));
    expect(final.position.checked).toBe(true);
    expect(enumerateLegalMoves(final.position)).toHaveLength(0);
  });

  it("gives check with two pieces at once in the double-check example", () => {
    const entry = referenceDexEntries("tesuji").find(({ id }) => id === "double-check");
    const record = createGameRecord(referenceEntrySfen(entry));
    expect(record.append(record.position.createMoveByUSI("5e4c"))).toBe(true);
    const king = record.position.board.listNonEmptySquares()
      .find((square) => record.position.board.at(square)?.type === "king" && record.position.board.at(square)?.color === "white");
    expect(record.position.listAttackers(king).length).toBe(2);
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
