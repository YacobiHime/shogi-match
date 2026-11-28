import { describe, expect, it } from "vitest";
import { VOICE_INTENTS, VOICE_LINE_CHARS, reasonVoice, voiceMood } from "./reason-voice.mjs";
import { THOUGHT_LINES } from "./disciple-review.mjs";

const START = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
// ▲7六歩のあと(後手番)
const AFTER_76 = "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 2";

describe("将棋AI(論理)の心の声", () => {
  it("理由の全部に1行目の言葉がある", () => {
    for (const reason of Object.keys(THOUGHT_LINES)) expect(VOICE_INTENTS[reason], reason).toBeTruthy();
  });

  it("1行目は手の表記つきのねらい、2行目はこの先の読み", () => {
    const voice = reasonVoice({ sfen: START, thought: { move: "7g7f", reason: "book", line: ["7g7f", "3c3d", "2g2f"], score: 0 } });
    expect(voice?.lines[0]).toBe("定跡どおり▲7六歩");
    expect(voice?.lines[1]).toBe("次は△3四歩▲2六歩と読む");
    expect(voice?.expects).toBe("3c3d");
  });

  it("読んでいた手が来たら読みどおり、違えば読んでいなかったと言う", () => {
    const thought = { move: "8c8d", reason: "rook-pawn", line: ["8c8d"], score: 0 };
    expect(reasonVoice({ sfen: AFTER_76, thought, lastMove: "7g7f", expected: "7g7f" })?.lines[1]).toBe("▲7六歩は読みどおり");
    expect(reasonVoice({ sfen: AFTER_76, thought, lastMove: "7g7f", expected: "2g2f" })?.lines[1]).toBe("▲7六歩は読んでいなかった");
  });

  it("プロの序盤の手と詰み", () => {
    expect(reasonVoice({ sfen: AFTER_76, thought: { move: "3c3d", reason: "book", pro: true } })?.lines[0]).toBe("プロがよく指す△3四歩でいこう");
    expect(reasonVoice({ sfen: AFTER_76, thought: { move: "3c3d", reason: "mate", mate: 3, line: ["3c3d"] } })?.lines[0]).toBe("詰みが見えた。△3四歩から3手詰め");
  });

  it("形勢の感じは点で決め、互角なら言わない", () => {
    expect(voiceMood(0)).toBe("");
    expect(voiceMood(900)).toBe("指しやすくなってきた");
    expect(voiceMood(-2500)).toBe("苦しい…");
    expect(voiceMood(29950)).toBe("");
  });

  it("2行目は長さの目安を超えない(最初の切れは残す)", () => {
    const voice = reasonVoice({ sfen: AFTER_76, thought: { move: "8c8d", reason: "rook-pawn", line: ["8c8d", "2g2f", "8d8e"], score: -2500 }, lastMove: "7g7f", expected: "2g2f" });
    expect(voice?.lines[1].length).toBeLessThanOrEqual(VOICE_LINE_CHARS);
    expect(voice?.lines[1].startsWith("▲7六歩は読んでいなかった")).toBe(true);
  });

  it("指せない手・手がないときは出さない", () => {
    expect(reasonVoice({ sfen: START, thought: null })).toBeNull();
    expect(reasonVoice({ sfen: START, thought: { move: "5a5b" } })).toBeNull();
  });
});
