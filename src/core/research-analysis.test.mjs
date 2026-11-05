import { describe, expect, it } from "vitest";
import { blackScoreOf, candidateArrows, candidateRows, himeLine, nodeText, scoreText, statsText, verdictText } from "./research-analysis.mjs";

const STUDY = "lnsg1gsnl/1k3r1b1/ppppp2pp/5pp2/9/2P1P2P1/PP1P1PP1P/1BK2S1R1/LNSG1G1NL b - 13";

describe("検討の見せ方", () => {
  it("評価値は先手から見た値にそろえる", () => {
    expect(blackScoreOf({ type: "cp", value: 86 }, STUDY)).toEqual({ type: "cp", value: 86 });
    expect(blackScoreOf({ type: "cp", value: 86 }, STUDY.replace(" b ", " w "))).toEqual({ type: "cp", value: -86 });
    expect(scoreText({ type: "cp", value: 86 })).toBe("+86");
    expect(scoreText({ type: "cp", value: -120 })).toBe("-120");
    expect(scoreText({ type: "mate", value: 5 })).toBe("▲5手詰");
    expect(scoreText({ type: "mate", value: -3 })).toBe("△3手詰");
  });

  it("勝率の一言は中継と同じ言い方", () => {
    expect(verdictText({ type: "cp", value: 0 })).toBe("互角");
    expect(verdictText({ type: "cp", value: 300 })).toBe("先手やや有利");
    expect(verdictText({ type: "cp", value: -2000 })).toBe("後手勝勢");
    expect(verdictText({ type: "mate", value: 3 })).toBe("先手勝ち");
  });

  it("候補を順位の順に並べ、読み筋を日本語にし、矢印は上限まで", () => {
    const candidates = [
      { rank: 2, move: "9g9f", pv: ["9g9f", "9c9d"], depth: 20, score: { type: "cp", value: 72 } },
      { rank: 1, move: "4i5h", pv: ["4i5h", "7a7b", "9g9f"], depth: 20, score: { type: "cp", value: 86 } },
      { rank: 3, move: "7g7e", score: { type: "cp", value: 10 } },
    ];
    const rows = candidateRows(STUDY, candidates);
    expect(rows.map(({ rank, label, scoreText: text }) => [rank, label, text])).toEqual([[1, "▲5八金右", "+86"], [2, "▲9六歩", "+72"]]);
    expect(rows[0].line).toBe("△7二銀 ▲9六歩");
    expect(candidateArrows(rows, { limit: 1 })).toEqual([{ usi: "4i5h", rank: 1 }]);
  });

  it("読みの情報と局面数の文字", () => {
    expect(nodeText(8500)).toBe("8,500");
    expect(nodeText(12340000)).toBe("1,234万");
    expect(nodeText(120000000)).toBe("1.2億");
    expect(statsText({ depth: 24, nodes: 12340000, nps: 850000, elapsedMs: 14200 })).toEqual({ main: "深さ 24 ・ 1,234万局面", sub: "1秒に 85万局面 ・ 14秒" });
  });

  it("やこび姫の一言は1位の手と形勢、詰みは詰みと言う", () => {
    const rows = candidateRows(STUDY, [{ rank: 1, move: "4i5h", score: { type: "cp", value: 300 } }]);
    expect(himeLine(rows).text).toBe("▲5八金右がいちばんだって。先手やや有利だよ。");
    expect(himeLine(rows, { settled: false }).text).toContain("まだ読んでいる");
    const mate = candidateRows(STUDY, [{ rank: 1, move: "4i5h", score: { type: "mate", value: 7 } }]);
    expect(himeLine(mate)).toEqual({ text: "7手詰めがあるよ！ ▲5八金右から詰ませられる。", tone: "notice" });
    expect(himeLine([]).text).toBe("いまの局面を読んでいるよ。");
  });
});
