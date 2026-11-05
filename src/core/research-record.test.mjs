import { describe, expect, it } from "vitest";
import {
  RESEARCH_LIMIT,
  STANDARD_SFEN,
  activeLine,
  branchesAt,
  chooseBranch,
  createResearch,
  currentPly,
  dropResearch,
  exportResearchKif,
  goToPly,
  importResearch,
  loadResearchBook,
  loadResearchSettings,
  moveLabel,
  normalizeResearchSettings,
  playLine,
  playMove,
  promoteBranch,
  putResearch,
  pvLabels,
  recordScore,
  removeBranch,
  researchTitle,
  restoreBranch,
  saveResearchBook,
  saveResearchSettings,
  sfenAt,
  stepPly,
} from "./research-record.mjs";

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
}

describe("研究の棋譜(分岐つき)", () => {
  it("手を指すと進み、同じ手ならそこへ進むだけ、ちがう手は分岐になる", () => {
    const research = createResearch({ now: 1 });
    expect(playLine(research, ["7g7f", "3c3d", "2g2f"])).toBe(3);
    expect(currentPly(research)).toBe(3);
    goToPly(research, 2);
    expect(playMove(research, "2g2f")).toBe(true);
    expect(nodeChildren(research, [0, 0])).toBe(1);
    goToPly(research, 2);
    expect(playMove(research, "6g6f")).toBe(true);
    expect(nodeChildren(research, [0, 0])).toBe(2);
    expect(activeLine(research).map(({ label }) => label)).toEqual(["▲7六歩", "△3四歩", "▲6六歩"]);
    const branches = branchesAt(research, 3);
    expect(branches.map(({ label, main, selected }) => [label, main, selected])).toEqual([["▲2六歩", true, false], ["▲6六歩", false, true]]);
  });

  it("指せない手は入れない", () => {
    const research = createResearch();
    expect(playMove(research, "7g7e")).toBe(false);
    expect(currentPly(research)).toBe(0);
  });

  it("戻っても選んでいた道は残り、1手ずつ進めると同じ道をたどる", () => {
    const research = createResearch({ moves: ["7g7f", "3c3d", "2g2f", "8c8d"] });
    goToPly(research, 2);
    playMove(research, "6g6f");
    playMove(research, "8c8d");
    goToPly(research, 0);
    expect(activeLine(research).map(({ usi }) => usi)).toEqual(["7g7f", "3c3d", "6g6f", "8c8d"]);
    stepPly(research, 3);
    expect(sfenAt(research)).toContain("w");
    expect(activeLine(research)[2].usi).toBe("6g6f");
  });

  it("分岐を選ぶ・本譜にする・消して戻す", () => {
    const research = createResearch({ moves: ["7g7f", "3c3d", "2g2f"] });
    goToPly(research, 2);
    playLine(research, ["6g6f", "8c8d"]);
    expect(chooseBranch(research, 3, 0)).toBe(true);
    expect(currentPly(research)).toBe(3);
    expect(activeLine(research)[2].usi).toBe("2g2f");
    expect(promoteBranch(research, 3, 1)).toBe(true);
    expect(branchesAt(research, 3).map(({ usi, main }) => [usi, main])).toEqual([["6g6f", true], ["2g2f", false]]);
    // いまの局面は2g2fのまま(番号が入れ替わっても同じ手)。
    expect(activeLine(research)[2].usi).toBe("2g2f");
    const undo = removeBranch(research, 3, 1);
    expect(undo).not.toBeNull();
    expect(currentPly(research)).toBe(2);
    expect(branchesAt(research, 3).map(({ usi }) => usi)).toEqual(["6g6f"]);
    expect(restoreBranch(research, undo)).toBe(true);
    expect(activeLine(research)[2].usi).toBe("2g2f");
    expect(currentPly(research)).toBe(3);
  });

  it("評価値は深いほうを残す", () => {
    const research = createResearch({ moves: ["7g7f"] });
    expect(recordScore(research, [0], { type: "cp", value: 40 }, 12)).toBe(true);
    expect(recordScore(research, [0], { type: "cp", value: 10 }, 8)).toBe(false);
    expect(activeLine(research)[0].score).toEqual({ type: "cp", value: 40 });
  });

  it("手の表記は左右と「同」を付ける", () => {
    const sfen = "lnsg1gsnl/1k3r1b1/ppppp2pp/5pp2/9/2P1P2P1/PP1P1PP1P/1BK2S1R1/LNSG1G1NL b - 13";
    expect(moveLabel(sfen, "4i5h")).toBe("▲5八金右");
    expect(moveLabel(sfen, "6i5h")).toBe("▲5八金左");
    expect(pvLabels(STANDARD_SFEN, ["7g7f", "3c3d", "8h2b+", "3a2b"])).toEqual(["▲7六歩", "△3四歩", "▲2二角成", "△同銀"]);
  });

  it("研究帳の名前は日付と1手目、編集した局面はそうと分かる", () => {
    const research = createResearch({ moves: ["7g7f"], now: new Date(2026, 10, 5).getTime() });
    expect(researchTitle(research)).toBe("11月5日 ▲7六歩");
    const edited = createResearch({ sfen: "4k4/9/9/9/9/9/9/9/4K4 b G 1", now: new Date(2026, 10, 5).getTime() });
    expect(researchTitle(edited)).toBe("11月5日 編集した局面");
  });
});

describe("研究帳の保存", () => {
  it("入れる・消す・古いものから消える", () => {
    const storage = memoryStorage();
    let book = loadResearchBook(storage);
    for (let index = 0; index < RESEARCH_LIMIT + 3; index += 1) book = putResearch(book, createResearch({ now: index + 1, id: `r${index}` }));
    expect(book.items).toHaveLength(RESEARCH_LIMIT);
    expect(book.current).toBe(`r${RESEARCH_LIMIT + 2}`);
    saveResearchBook(storage, book);
    const loaded = loadResearchBook(storage);
    expect(loaded.items[0].id).toBe(`r${RESEARCH_LIMIT + 2}`);
    const dropped = dropResearch(loaded, loaded.current);
    expect(dropped.current).toBe(dropped.items[0].id);
  });

  it("壊れた保存は空として読む", () => {
    const storage = memoryStorage();
    storage.setItem("yacobihime:shogi-match:research:v1", "{bad");
    expect(loadResearchBook(storage)).toEqual({ current: "", items: [] });
  });

  it("設定は範囲に収め、保存して読める", () => {
    expect(normalizeResearchSettings({ multiPv: 30, limit: "nope", arrows: false, display: "rate" })).toEqual({ multiPv: 10, limit: "infinite", arrows: false, display: "rate", analysisLevel: 1, autoReply: false, autoSide: "white", replyMs: 3000 });
    const storage = memoryStorage();
    saveResearchSettings(storage, { multiPv: 5, limit: "time-3" });
    expect(loadResearchSettings(storage)).toMatchObject({ multiPv: 5, limit: "time-3", arrows: true });
  });

  it("相手の手の自動は、知らない値をはじめの値に戻す", () => {
    expect(normalizeResearchSettings({ autoReply: true, autoSide: "black", replyMs: 1000 })).toMatchObject({ autoReply: true, autoSide: "black", replyMs: 1000 });
    expect(normalizeResearchSettings({ autoReply: "yes", autoSide: "red", replyMs: 2500 })).toMatchObject({ autoReply: false, autoSide: "white", replyMs: 3000 });
  });
});

describe("棋譜の読み込みと書き出し", () => {
  it("USIの手順・SFENを読む", () => {
    const research = importResearch("position startpos moves 7g7f 3c3d");
    expect(research).not.toBeInstanceOf(Error);
    expect(activeLine(research).map(({ usi }) => usi)).toEqual(["7g7f", "3c3d"]);
    expect(currentPly(research)).toBe(0);
    const sfen = importResearch("sfen 4k4/9/9/9/9/9/9/9/4K4 b G 1");
    expect(sfen.sfen).toBe("4k4/9/9/9/9/9/9/9/4K4 b G 1");
    expect(importResearch("7g7f 3c3d").root.children[0].usi).toBe("7g7f");
  });

  it("分岐のある研究をKIFにして、読み直すと分岐も戻る", () => {
    const research = createResearch({ moves: ["7g7f", "3c3d", "2g2f"] });
    goToPly(research, 2);
    playMove(research, "6g6f");
    const kif = exportResearchKif(research);
    expect(kif).toContain("変化");
    const back = importResearch(kif);
    expect(back).not.toBeInstanceOf(Error);
    expect(branchesAt(back, 3).map(({ usi }) => usi)).toEqual(["2g2f", "6g6f"]);
  });

  it("読めない文字はErrorを返す", () => {
    expect(importResearch("")).toBeInstanceOf(Error);
    expect(importResearch("position startpos moves 7g7f 7g7e")).toBeInstanceOf(Error);
  });
});

function nodeChildren(research, path) {
  let node = research.root;
  for (const index of path) node = node.children[index];
  return node.children.length;
}
