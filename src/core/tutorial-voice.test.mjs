import { describe, expect, it } from "vitest";
import { TUTORIAL_VOICE_KEY, loadTutorialVoiceOn, pickJapaneseVoice, saveTutorialVoiceOn, voiceText } from "./tutorial-voice.mjs";

describe("読み上げの読み方", () => {
  it("符号を読み方に直す", () => {
    expect(voiceText("▲７六歩")).toBe("せんて、なな ろく ふ");
    expect(voiceText("△3四歩")).toBe("ごて、さん よん ふ");
    expect(voiceText("次は「2六銀」と指してみよう！")).toBe("次は「 に ろく ぎん」と指してみよう！");
    expect(voiceText("▲5三歩成")).toBe("せんて、ご さん ふ なり");
    expect(voiceText("△同歩")).toBe("ごて、どう ふ");
    expect(voiceText("同じ筋")).toBe("同じ筋");
    expect(voiceText("飛車で2四の銀")).toBe("ひしゃで に よんの銀");
    expect(voiceText("▲3九角打")).toBe("せんて、さん きゅう かく うつ");
  });

  it("駒の名前・数字・記号を読み違えないように直す", () => {
    expect(voiceText("歩を5五（緑のマス）まで動かそう！")).toBe("ふを ご ご（緑のマス）まで動かそう！");
    expect(voiceText("玉と角と金と香車と桂馬と飛車")).toBe("ぎょくとかくときんときょうしゃとけいまとひしゃ");
    expect(voiceText("駒得 ＋6！ 駒損 −5")).toBe("駒得 プラス6！ 駒損 マイナス5");
    expect(voiceText("★3 ▼")).toBe("3");
    expect(voiceText("①逃げる")).toBe("いち、逃げる");
    expect(voiceText("「成」を選んでね")).toBe("「なり」を選んでね");
  });

  it("日本語の声を選び、なければnull", () => {
    expect(pickJapaneseVoice([{ lang: "en-US" }])).toBeNull();
    expect(pickJapaneseVoice([{ lang: "en-US" }, { lang: "ja-JP", localService: false }, { lang: "ja-JP", localService: true }])).toEqual({ lang: "ja-JP", localService: true });
    expect(pickJapaneseVoice([{ lang: "ja_JP" }])).toEqual({ lang: "ja_JP" });
  });

  it("オン/オフを保存する。既定はオフで、読めなくても止まらない", () => {
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    expect(loadTutorialVoiceOn(storage)).toBe(false);
    saveTutorialVoiceOn(storage, true);
    expect(store.get(TUTORIAL_VOICE_KEY)).toBe("on");
    expect(loadTutorialVoiceOn(storage)).toBe(true);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadTutorialVoiceOn(broken)).toBe(false);
    expect(() => saveTutorialVoiceOn(broken, true)).not.toThrow();
  });
});
