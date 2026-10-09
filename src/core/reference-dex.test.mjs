import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Position, Square } from "tsshogi";
import { createGameRecord, enumerateLegalMoves } from "../game-state";
import { ZUKOU_SET, judgeProblemMove } from "./problem-set.mjs";
import { MASUDA_KOZO_KYO_OCHI_KIFU } from "../data/reference-kifu.mjs";
import {
  REFERENCE_DEX_KINDS,
  pieceReachSquares,
  referenceDexEntries,
  referenceDexGroups,
  referenceEntryKifu,
  referenceEntryMarks,
  referenceEntryMatches,
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

  it("offers piece, tesuji, shogi-world and glossary dexes with grouped entries", () => {
    expect(KINDS).toEqual(["piece", "tesuji", "world", "glossary"]);
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

  it.each([
    // [id, 先手（下手）, 後手（上手）, 駒落ち, 最後の手, 勝った側, しおり]
    ["masuda", "大山康晴 名人", "升田幸三 九段", false, "△８五桂", "white", "升田の勝ち"],
    ["oyama", "大山康晴", "木村義雄", false, "▲７九玉", "black", "名人獲得"],
    ["nakahara", "大山康晴", "中原誠", false, "△６七香成", "white", "名人奪取"],
    ["tanigawa", "谷川浩司", "加藤一二三", false, "▲４四金", "black", "史上最年少名人"],
    ["fujii", "藤井聡太 竜王", "伊藤匠 七段", false, "▲６一飛", "black", "藤井の勝ち"],
  ])("shows the signature game of %s", (id, black, white, handicap, last, winner, highlight) => {
    const entry = referenceDexEntries("world").find((candidate) => candidate.id === id);
    const kifu = referenceEntryKifu(entry);
    expect(kifu).toMatchObject({ black, white, handicap, ending: "投了", winner });
    expect(kifu.steps.at(-1).label).toBe(last);
    expect(kifu.steps.at(-1).highlight).toBe(highlight);
    // 盤は、その棋士の側を下にして並べる。
    expect(Boolean(entry.flip)).toBe(winner === "white");
  });

  it("shows Masuda's △3五銀 as a highlight of the 1971 meijin match", () => {
    const entry = referenceDexEntries("world").find(({ id }) => id === "masuda");
    const { steps } = referenceEntryKifu(entry);
    expect(steps).toHaveLength(211);
    expect(steps[94].label).toBe("△３五銀");
    expect(steps[94].highlight).toBe("△3五銀");
  });

  it("shows the decisive game of the first jitsuryoku-sei meijin title", () => {
    const entry = referenceDexEntries("world").find(({ id }) => id === "modern-titles");
    const kifu = referenceEntryKifu(entry);
    expect(kifu).toMatchObject({ black: "木村義雄 八段", white: "花田長太郎 八段", handicap: false, ending: "投了", winner: "black" });
    expect(kifu.steps).toHaveLength(106);
    expect(kifu.steps.at(-1).highlight).toBe("初代の実力制名人");
    expect(Boolean(entry.flip)).toBe(false);
  });

  it("starts a handicap game from the uwate's move", () => {
    // 駒落ちの棋譜(升田幸三の香落ち)。図鑑では使わなくなったが、読み込みは保つ。
    const [start, first] = referenceEntryKifu({ kifu: MASUDA_KOZO_KYO_OCHI_KIFU }).steps;
    // 香落ちでは、上手（後手の側）の1一の香がなく、上手が先に指す。
    expect(start.sfen).toBe("lnsgkgsn1/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1");
    expect(first.label).toBe("△３四歩");
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

  it("shows Habu Yoshiharu's legendary 5二銀 game", () => {
    const entry = referenceDexEntries("world").find(({ id }) => id === "habu");
    const kifu = referenceEntryKifu(entry);
    expect(kifu.black).toBe("羽生善治");
    expect(kifu.white).toBe("加藤一二三");
    expect(kifu.steps).toHaveLength(68);
    expect(kifu.steps[61].label).toBe("▲５二銀");
    expect(kifu.steps[61].highlight).toBe("伝説の5二銀");
    // 5二の銀は、後手の金と飛車のどちらでも取れる。
    const position = Position.newBySFEN(kifu.steps[61].sfen);
    expect(position.listAttackers(Square.newByUSI("5b")).map(({ usi }) => usi).sort()).toEqual(["6a", "8b"]);
    expect(kifu.steps.at(-1).label).toBe("▲３二金");
    expect(kifu.ending).toBe("投了");
    expect(kifu.winner).toBe("black");
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

  it("collects every requested term in the glossary with valid related links", () => {
    const entries = referenceDexEntries("glossary");
    const terms = entries.map(({ label }) => label.replace(/（.*$/, ""));
    for (const term of [
      "寄せ", "詰めろ", "対抗形", "必至", "駒組み", "手筋", "さばき", "受け", "無理攻め", "駒得", "攻め駒", "守り駒",
      "遊び駒", "浮き駒", "離れ駒", "詰み筋", "王手飛車", "両取り", "定跡", "指し手", "振り飛車", "居飛車", "戦法", "囲い",
      "角交換", "形勢", "大局観", "入玉", "急戦", "最善手", "格言", "悪形", "形良く", "悪手", "好手", "神の一手", "二枚換え",
      "急所", "壁銀", "壁金", "受けなし", "一段金", "手番", "投了", "詰めろ逃れの詰めろ", "玉頭戦", "厚み", "合い駒",
      "開き王手", "合わせ", "居玉", "思い出王手", "棋風", "利き", "妙手", "奇襲戦法", "奇手", "大駒", "小駒", "渋い",
      "捨て駒", "詰将棋", "敗着", "早逃げ", "無理筋", "寄り形", "見落とし", "読み抜け", "力戦", "割り打ち",
    ]) expect(terms, term).toContain(term);
    const ids = new Set(entries.map(({ id }) => id));
    for (const { id, label, related = [] } of entries) {
      // 見出しには読みがなを添える。
      expect(label, id).toMatch(/（[ぁ-んー]+）$|^さばき$/);
      for (const target of related) {
        expect(ids.has(target), `${id} → ${target}`).toBe(true);
        expect(target, id).not.toBe(id);
      }
    }
  });

  it("searches the glossary by reading and explanation regardless of kana", () => {
    const entries = referenceDexEntries("glossary");
    const found = (query) => entries.filter((entry) => referenceEntryMatches(entry, query)).map(({ id }) => id);
    expect(found("つめろ")).toContain("tsumero");
    expect(found("ツメロ")).toContain("tsumero");
    expect(found("十字飛車")).toEqual(["ryodori"]);
    expect(found("")).toHaveLength(entries.length);
    const groups = referenceDexGroups("glossary", "かべ");
    expect(groups.flatMap(({ items }) => items.map(({ id }) => id))).toEqual(expect.arrayContaining(["kabe-gin", "kabe-kin"]));
    expect(referenceDexGroups("glossary", "存在しない言葉")).toEqual([]);
  });

  describe("glossary endgame claims", () => {
    const glossary = (id) => referenceDexEntries("glossary").find((entry) => entry.id === id);
    const play = (position, usi) => {
      const record = createGameRecord(position.sfen);
      expect(record.append(record.position.createMoveByUSI(usi)), usi).toBe(true);
      return record.position;
    };
    const isMate = (position) => position.checked && enumerateLegalMoves(position).length === 0;
    const hasMateInOne = (position) => enumerateLegalMoves(position).some(({ usi }) => isMate(play(position, usi)));

    it.each(["saizenshu", "kishu", "haichaku", "kabe-kin", "tsume-shogi"])("mates at once with the arrow in %s", (id) => {
      const start = createGameRecord(referenceEntrySfen(glossary(id))).position;
      expect(isMate(play(start, glossary(id).arrows[0]))).toBe(true);
    });

    it.each([
      ["myoushu", ["R*1a", "1b1a", "G*2b"]],
      ["kami-no-itte", ["B*2b", "2a2b", "S*1b"]],
      ["sute-goma", ["S*2a", "1b2a", "G*2b"]],
      ["tsumisuji", ["N*2c", "2b2c", "G*1b"]],
    ])("mates after the sacrifice in %s", (id, line) => {
      let position = createGameRecord(referenceEntrySfen(glossary(id))).position;
      expect(hasMateInOne(position), `${id}: いきなり詰む`).toBe(false);
      for (const usi of line) position = play(position, usi);
      expect(isMate(position)).toBe(true);
    });

    it.each(["yose", "hisshi", "ukenashi"])("leaves no defence after the quiet move in %s", (id) => {
      const start = createGameRecord(referenceEntrySfen(glossary(id))).position;
      const after = play(start, glossary(id).arrows[0]);
      expect(after.checked).toBe(false);
      for (const { usi } of enumerateLegalMoves(after)) expect(hasMateInOne(play(after, usi)), `${id}: ${usi}`).toBe(true);
    });

    it("drops the legendary silver where both the gold and the rook can take it in habu-magic", () => {
      const start = createGameRecord(referenceEntrySfen(glossary("habu-magic"))).position;
      const after = play(start, "S*5b");
      const replies = enumerateLegalMoves(after).map(({ usi }) => usi);
      expect(replies).toEqual(expect.arrayContaining(["6a5b", "8b5b"]));
    });

    it("threatens mate without check in the tsumero example, but it can be defended", () => {
      const start = createGameRecord(referenceEntrySfen(glossary("tsumero"))).position;
      const after = play(start, "P*2c");
      expect(after.checked).toBe(false);
      // 後手が何もしなければ（手番を渡せば）、2二銀で詰む。
      const fields = after.sfen.split(" ");
      fields[1] = "b";
      expect(isMate(play(createGameRecord(fields.join(" ")).position, "S*2b"))).toBe(true);
      expect(enumerateLegalMoves(after).some(({ usi }) => !hasMateInOne(play(after, usi)))).toBe(true);
    });
  });
});

describe("詰将棋の名作", () => {
  it("offers short Zukou problems from the problem set, judged the same way", () => {
    const entry = referenceDexEntries("world").find(({ id }) => id === "tsume-classic");
    const problems = entry.tsume.map(({ problem }) => problem);
    expect(problems.map(({ number }) => number)).toEqual([50, 7, 29, 13, 98]);
    for (const problem of problems) expect(ZUKOU_SET).toContain(problem);
    expect(problems.at(-1).title).toBe("第98番『裸玉』（31手）");
    expect(entry.sfen).toBe(problems[0].sfen);
    // 作者の手順どおりに指せば、玉方が応じて最後に詰む。
    const [problem] = problems;
    let state = { sfen: problem.sfen, step: 0 };
    for (let index = 0; index < problem.line.length; index += 2) {
      const result = judgeProblemMove(problem, problem.line[index], state.sfen, state.step);
      expect(result.correct, `${index + 1}手目`).toBe(true);
      if (result.next) state = result.next;
      else expect(result.solved).toBe(true);
    }
  });
});
