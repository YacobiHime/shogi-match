import { describe, expect, it } from "vitest";
import { addAward, awardLine, awardTalk, awardText, kanjiDate, kanjiNumber, kanjiText, loadAwards, meijinAward, ryuoAward, shoreikaiAward } from "./season-award.mjs";
import { CLASS_LABELS } from "./meijin.mjs";

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
const AT = new Date(2026, 9, 22, 12).getTime();
const ryuoSeason = (result, mode = "challenge") => ({
  no: 2, mode,
  result: { startGroup: 5, newGroup: 5, promoted: false, wins: 5, losses: 1, path: [], ...result },
});

describe("漢数字", () => {
  it("位取りで書く", () => {
    expect(kanjiNumber(0)).toBe("〇");
    expect(kanjiNumber(1)).toBe("一");
    expect(kanjiNumber(10)).toBe("十");
    expect(kanjiNumber(12)).toBe("十二");
    expect(kanjiNumber(22)).toBe("二十二");
    expect(kanjiNumber(105)).toBe("百五");
    expect(kanjiText("第2期 5勝10敗")).toBe("第二期 五勝十敗");
  });
  it("日付の年は一字ずつ", () => {
    expect(kanjiDate(AT)).toBe("二〇二六年十月二十二日");
  });
});

describe("竜王戦の賞状", () => {
  it("竜王獲得は金、防衛戦なら竜王防衛", () => {
    expect(ryuoAward(ryuoSeason({ outcome: "champion", newGroup: 1 }), { at: AT })).toMatchObject({ grade: "gold", prize: "竜王獲得", seal: "竜", id: "ryuo-2" });
    expect(ryuoAward(ryuoSeason({ outcome: "champion" }, "defense"), { at: AT })).toMatchObject({ grade: "gold", prize: "竜王防衛", entry: "竜王" });
    expect(ryuoAward(ryuoSeason({ outcome: "champion", promoted: true, newGroup: 1 })).notes).toEqual([]);
  });
  it("七番勝負に出たら銀、決勝トーナメントに進んだら朱", () => {
    expect(ryuoAward(ryuoSeason({ outcome: "finals-lost" })).grade).toBe("silver");
    expect(ryuoAward(ryuoSeason({ outcome: "main-out" }))).toMatchObject({ grade: "red", prize: "決勝トーナメント 進出" });
  });
  it("組の優勝・準優勝・昇級は朱。昇級は添え書きにも出す", () => {
    const won = ryuoAward(ryuoSeason({ outcome: "ranking-out", path: [{ stage: "ranking", text: "優勝" }], promoted: true, newGroup: 4 }));
    expect(won).toMatchObject({ grade: "red", prize: "5組 優勝", notes: ["4組へ昇級"] });
    expect(ryuoAward(ryuoSeason({ outcome: "ranking-out", path: [{ stage: "ranking", text: "準優勝（決勝で敗退）" }] })).prize).toBe("5組 準優勝");
    expect(ryuoAward(ryuoSeason({ outcome: "ranking-out", promoted: true, newGroup: 4 }))).toMatchObject({ prize: "5組 昇級", notes: [] });
  });
  it("それ以外は敢闘賞(負けても、最後まで戦ったことをたたえる)", () => {
    const award = ryuoAward(ryuoSeason({ outcome: "ranking-out", wins: 0, losses: 1, path: [{ stage: "ranking", text: "1回戦で敗退" }] }), { playerName: "ひめ", at: AT });
    expect(award.grade).toBe("fight");
    const text = awardText(award);
    expect(text.heading).toBe("敢闘賞");
    expect(text.name).toBe("ひめ 殿");
    expect(text.body).toBe("あなたは第二期竜王戦の五組ランキング戦に出場し、〇勝一敗の成績で、最後まで力を尽くして戦いました。その健闘をたたえ、ここに賞します。");
    expect(text.date).toBe("二〇二六年十月二十二日");
    expect(awardTalk(award)).toBe("第2期、おつかれさま！ 勝った対局も負けた対局も、ぜんぶ次の力になるよ");
    expect(awardTalk(ryuoAward(ryuoSeason({ outcome: "champion" })))).toBe("第2期、おつかれさま！ 竜王獲得、ほんとうにおめでとう！");
  });
});

describe("名人戦の賞状", () => {
  const season = (result, mode = "challenge") => ({ no: 1, mode, cls: result.cls ?? "C2", result: { cls: "C2", wins: 8, losses: 2, place: 2, ...result } });
  it("昇級は朱で順位を書き、次のクラスを添える", () => {
    const award = meijinAward(season({ outcome: "promote" }), { classLabels: CLASS_LABELS, nextClass: "C1", at: AT });
    expect(award).toMatchObject({ grade: "red", prize: "C級2組順位戦 2位", notes: ["C級1組へ昇級"], seal: "名", id: "meijin-1" });
    expect(awardText(award).prize).toBe("C級二組順位戦 二位");
    expect(awardText(award).heading).toBe("賞状");
  });
  it("名人は金、挑戦は銀、残留・降級点は敢闘賞", () => {
    expect(meijinAward(season({ cls: "A", outcome: "meijin" }), { classLabels: CLASS_LABELS }).grade).toBe("gold");
    expect(meijinAward(season({ outcome: "defend" }, "defense"), { classLabels: CLASS_LABELS })).toMatchObject({ grade: "gold", entry: "名人" });
    expect(meijinAward(season({ cls: "A", outcome: "challenger" }), { classLabels: CLASS_LABELS }).grade).toBe("silver");
    expect(meijinAward(season({ outcome: "point" }), { classLabels: CLASS_LABELS })).toMatchObject({ grade: "fight", prize: "C級2組順位戦 出場" });
  });
});

describe("奨励会の免状", () => {
  it("四段の免状は金で、棋士番号と入会の級・成績・師匠を書く", () => {
    const award = shoreikaiAward({ id: 3, kishiNumber: 352, entryRank: "4級", wins: 61, losses: 29, mentor: "森川修八段" }, { playerName: "やこび", at: AT });
    expect(award).toMatchObject({ id: "shoreikai-3", grade: "gold", seal: "奨", prize: "四段", no: 352, notes: ["師匠 森川修八段"] });
    const text = awardText(award);
    expect(text.heading).toBe("免状");
    expect(text.title).toBe("棋士番号 第三百五十二号");
    expect(text.body).toContain("四級で入会し");
    expect(text.name).toBe("やこび 殿");
    expect(awardLine(award)).toBe("奨励会 四段昇段（棋士番号352号）");
    expect(awardTalk(award)).toContain("プロ棋士");
  });
});

describe("賞状帳", () => {
  it("同じ期は1枚だけ残し、古い順に読む", () => {
    const storage = memoryStorage();
    const first = ryuoAward(ryuoSeason({ outcome: "main-out" }), { at: AT });
    addAward(storage, first);
    addAward(storage, { ...first, prize: "べつの賞" });
    addAward(storage, meijinAward({ no: 1, cls: "C2", result: { cls: "C2", wins: 3, losses: 7, place: 40, outcome: "stay" } }, { classLabels: CLASS_LABELS, at: AT }));
    const awards = loadAwards(storage);
    expect(awards.map((award) => award.id)).toEqual(["ryuo-2", "meijin-1"]);
    expect(awards[0].prize).toBe("決勝トーナメント 進出");
    expect(awardLine(awards[1])).toBe("第1期 名人戦 C級2組順位戦 出場");
  });
  it("壊れた保存は読み飛ばす", () => {
    const storage = memoryStorage();
    storage.setItem("yacobihime:shogi-match:awards", "{broken");
    expect(loadAwards(storage)).toEqual([]);
    storage.setItem("yacobihime:shogi-match:awards", JSON.stringify([{ id: 1 }, null]));
    expect(loadAwards(storage)).toEqual([]);
  });
});
