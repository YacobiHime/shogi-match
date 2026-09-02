import { describe, expect, it } from "vitest";
import { STANDARD_SFEN } from "../game-state";
import { createOpeningBookDraft, createOpeningBookLibrary, deleteOpeningBookFromLibrary, openingBookDraftKey, parseOpeningBook, parseOpeningBookLibrary, replayOpeningBranch, saveOpeningBookToLibrary, serializeOpeningBook, serializeOpeningBookLibrary, validateOpeningBook } from "./opening-book-editor.mjs";

function draft() {
  return createOpeningBookDraft({ definition: { id: "sample", label: "サンプル", family: "ibisha", rookStyle: "static", blackMoves: ["7g7f"] }, initialSfen: STANDARD_SFEN });
}

describe("opening book editor", () => {
  it("replays an alternating legal line", () => {
    const book = draft();
    book.branches[0].moves = [{ usi: "7g7f" }, { usi: "3c3d" }, { usi: "2g2f" }];
    const result = replayOpeningBranch(book, book.branches[0]);
    expect(result.error).toBeNull();
    expect(result.applied).toBe(3);
    expect(result.position.sfen).toContain(" w ");
  });

  it("reports an illegal move at its exact ply", () => {
    const book = draft();
    book.branches[0].moves = [{ usi: "7g7f" }, { usi: "7g7f" }];
    expect(validateOpeningBook(book).errors).toContain("変化1: 2手目「7g7f」は、この局面では指せません。");
  });

  it("requires traceable sources and rejects duplicate branches", () => {
    const book = draft();
    book.sources = [{ title: "参考", url: "http://example.com", checkedAt: "today" }];
    book.branches = [
      { id: "main", label: "本線", moves: [{ usi: "7g7f" }] },
      { id: "main", label: "重複", moves: [{ usi: "7g7f" }] },
    ];
    expect(validateOpeningBook(book).errors).toHaveLength(4);
  });

  it("round-trips versioned JSON", () => {
    expect(parseOpeningBook(serializeOpeningBook(draft()))).toMatchObject({ schemaVersion: 1, id: "sample" });
  });

  it("stores strategy and castle classifications", () => {
    expect(draft().classification).toEqual({ family: "ibisha", rookStyle: "static", menuGroup: "", contexts: [] });
    const castle = createOpeningBookDraft({
      definition: { id: "mino", label: "本美濃", family: "mino", rookStyle: "ranging", menuGroup: "ranging-mino", contexts: ["anti-static-ranging", "double-ranging"] },
      kind: "castle",
      initialSfen: STANDARD_SFEN,
    });
    expect(castle.classification).toEqual({
      family: "mino", rookStyle: "ranging", menuGroup: "ranging-mino",
      contexts: ["anti-static-ranging", "double-ranging"],
    });
  });

  it("stores drafts independently for each opening", () => {
    const first = draft();
    const second = createOpeningBookDraft({ definition: { id: "mino", label: "本美濃", blackMoves: ["5i4h"], completionSquares: [["2h", "K"]] }, kind: "castle", initialSfen: STANDARD_SFEN });
    let library = saveOpeningBookToLibrary(createOpeningBookLibrary(), first);
    library = saveOpeningBookToLibrary(library, second);
    const restored = parseOpeningBookLibrary(serializeOpeningBookLibrary(library));
    expect(openingBookDraftKey(first)).toBe("strategy:sample");
    expect(restored.activeKey).toBe("castle:mino");
    expect(Object.keys(restored.books)).toEqual(["strategy:sample", "castle:mino"]);
    expect(restored.books["strategy:sample"].guideMoves).toEqual(["7g7f"]);
    expect(restored.books["castle:mino"].guideMoves).toEqual(["5i4h"]);
  });

  it("deletes only the selected saved opening", () => {
    const first = draft();
    const second = createOpeningBookDraft({ definition: { id: "other", label: "別定跡", blackMoves: ["2g2f"] }, initialSfen: STANDARD_SFEN });
    let library = saveOpeningBookToLibrary(createOpeningBookLibrary(), first);
    library = saveOpeningBookToLibrary(library, second);
    library = deleteOpeningBookFromLibrary(library, "strategy:other");
    expect(Object.keys(library.books)).toEqual(["strategy:sample"]);
    expect(library.activeKey).toBe("");
  });

  it("stores and validates completion choices", () => {
    const book = draft();
    book.completionChoices = {
      enabled: true,
      prompt: "次の戦法を選んでね",
      strategyIds: ["bougin", "hayaguri-gin"],
    };
    book.branches[0].moves = [{ usi: "7g7f" }];
    book.sources = [{ title: "参考", url: "https://example.com", checkedAt: "2026-09-02" }];
    expect(validateOpeningBook(book).errors).toEqual([]);
    book.completionChoices.strategyIds = [];
    expect(validateOpeningBook(book).errors).toContain("完成後に選ばせる派生戦法を1つ以上追加してください。");
  });

  it("stores AND conditions for a guide move", () => {
    const book = draft();
    book.movePositionPrerequisites = {
      "6i7h": [
        { square: "8e", owner: "opponent", kind: "P" },
        { square: "8b", owner: "opponent", kind: "R" },
      ],
    };
    book.guideMoves.push("6i7h");
    book.branches[0].moves = [{ usi: "7g7f" }];
    book.sources = [{ title: "参考", url: "https://example.com", checkedAt: "2026-09-02" }];
    expect(validateOpeningBook(book).errors).toEqual([]);
    book.movePositionPrerequisites["6i7h"][0].square = "8五";
    expect(validateOpeningBook(book).errors).toContain("案内手「6i7h」の条件1: マスが不正です。");
  });

  it("imports and validates castle completion variants", () => {
    const book = createOpeningBookDraft({
      definition: {
        id: "sample-castle",
        label: "サンプル囲い",
        family: "mino",
        rookStyle: "ranging",
        menuGroup: "ranging-mino",
        contexts: ["anti-static-ranging"],
        blackMoves: ["5i4h"],
        completionVariants: [
          [["3h", "K"], ["4h", "G"]],
          [["2h", "K"], ["3h", "S"]],
        ],
      },
      kind: "castle",
      initialSfen: STANDARD_SFEN,
    });
    expect(book.completionVariants).toEqual([
      [["3h", "K"], ["4h", "G"]],
      [["2h", "K"], ["3h", "S"]],
    ]);
    book.branches[0].moves = [{ usi: "5i4h" }];
    book.sources = [{ title: "参考", url: "https://example.com", checkedAt: "2026-09-02" }];
    expect(validateOpeningBook(book).errors).toEqual([]);
    book.completionVariants[0].push(["3h", "S"]);
    expect(validateOpeningBook(book).errors).toContain("完成形1: 同じマス「3h」が重複しています。");
  });
});
