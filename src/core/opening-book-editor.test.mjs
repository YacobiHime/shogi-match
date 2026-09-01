import { describe, expect, it } from "vitest";
import { STANDARD_SFEN } from "../game-state";
import { createOpeningBookDraft, parseOpeningBook, replayOpeningBranch, serializeOpeningBook, validateOpeningBook } from "./opening-book-editor.mjs";

function draft() {
  return createOpeningBookDraft({ definition: { id: "sample", label: "サンプル", blackMoves: ["7g7f"] }, initialSfen: STANDARD_SFEN });
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
});
