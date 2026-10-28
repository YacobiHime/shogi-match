import { describe, expect, test } from "vitest";
import { Position } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";
import { chooseAwareMove } from "./aware-move-choice.mjs";
import {
  RUIN_LOSS, allowsMateInOne, blunderKind, chanceHardness, gaussian, humanPerception, humanSettingsForLevel,
  pickByBelief, preventsBlunder, threatHardness,
} from "./human-model.mjs";
import { stateFromSfen } from "./logic-position.mjs";
import { findMateLine } from "./problem-solver";
import { createRng } from "./ryuo-random.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from "./strength-settings.mjs";

const legal = (sfen) => enumerateLegalMoves(Position.newBySFEN(sfen)).map(({ usi }) => usi);
const cp = (value) => ({ type: "cp", value });
// 先手の飛車(5八)は、5四へ出ると後手の5三の歩に取られる。ほかの駒も少しある、互角に近い局面。
const HANG = "kg7/sg7/p1p1p4/9/9/9/P1P6/GS2R4/KG7 b - 1";

describe("人間らしいCPUの値(6-2)", () => {
  test("上のレベルほど見落としが減り、確認で防ぐ率が上がる。点の間は直線で補う", () => {
    let previous = humanSettingsForLevel(11);
    for (let level = 12; level <= 39; level += 1) {
      const now = humanSettingsForLevel(level);
      for (const key of Object.keys(now.miss)) expect(now.miss[key]).toBeLessThanOrEqual(previous.miss[key]);
      for (const key of Object.keys(now.prevent)) expect(now.prevent[key]).toBeGreaterThanOrEqual(previous.prevent[key]);
      previous = now;
    }
    expect(humanSettingsForLevel(12).miss.other).toBeCloseTo(0.14, 5);
    expect(humanSettingsForLevel(20).prevent.A).toBe(1);
    expect(humanSettingsForLevel(28).prevent.B).toBe(1);
    expect(humanSettingsForLevel(39).miss).toEqual({ major: 0, minor: 0, other: 0, free: 0, fork: 0 });
  });

  test("強さの表のLv11〜39(もとの校正)に入り、Lv0・Lv49・ロジックAIの手には影響しない", () => {
    expect(getStrengthSearchSettings(CPU_STRENGTH_PRESETS[0].value).human).toBeUndefined();
    expect(getStrengthSearchSettings(CPU_STRENGTH_PRESETS[49].value).human).toBeUndefined();
    expect(getStrengthSearchSettings(CPU_STRENGTH_PRESETS[19].value).human?.prevent.A).toBeGreaterThan(0.9);
  });
});

describe("見えにくさ(3-3)", () => {
  test("遠くからの利き・直前の手から遠い当たりは見えにくい", () => {
    expect(threatHardness({ square: "5e", attackers: ["5d"] }, "5d")).toBe(1);
    expect(threatHardness({ square: "5e", attackers: ["5a"] }, "5f")).toBeCloseTo(1.6);
    expect(threatHardness({ square: "5e", attackers: ["5a"] }, "5a")).toBeCloseTo(1.6 * 1.4);
    expect(threatHardness({ square: "1i", attackers: ["1h"] }, "9a")).toBeCloseTo(1.4);
  });
  test("打つ手・後ろへ下がる取り・遠くからの取りは見えにくい(どれか1つに気づけばよいので、いちばん見えやすい手で決める)", () => {
    expect(chanceHardness({ moves: ["N*5e"] }, "black")).toBe(2);
    expect(chanceHardness({ moves: ["5e5f"] }, "black")).toBeCloseTo(1.6);
    expect(chanceHardness({ moves: ["5e5f"] }, "white")).toBe(1);
    expect(chanceHardness({ moves: ["N*5e", "5e5d"] }, "black")).toBe(1);
  });
  test("見落とし率に倍率を掛け、上限は60%", () => {
    const human = humanSettingsForLevel(11);
    const awareness = { threats: [{ kind: "capture", square: "5e", attackers: ["5a"], salience: "other" }], chances: [{ kind: "fork", moves: ["N*4c"] }] };
    const p = humanPerception({ hanging: 0.5, mate1: 0.9 }, human, awareness, { lastMove: "5d5f", turn: "black" });
    expect(p.hanging).toBeCloseTo(1 - 0.15 * 1.6, 5);
    expect(p.threat).toBeCloseTo(1 - Math.min(0.6, 0.45 * 2), 5);
    expect(p.mate1).toBe(0.9);
    // 強いレベルでは、見えにくい手でも見落とさない。
    expect(humanPerception({}, humanSettingsForLevel(39), awareness, { turn: "black" })).toMatchObject({ hanging: 1, threat: 1, freeCapture: 1 });
  });
});

describe("判断のぶれ(4-3)", () => {
  test("ぶれが0なら最大の手。ぶれがあっても、800点悪い手はほとんど選ばない(温度の抽選より裾が軽い)", () => {
    const entries = [{ move: "a", score: 0 }, { move: "b", score: -100 }, { move: "c", score: -RUIN_LOSS }];
    expect(pickByBelief(entries, 0, Math.random).move).toBe("a");
    const rng = createRng(7);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i += 1) counts[pickByBelief(entries, 130, rng.next).move] += 1;
    expect(counts.a).toBeGreaterThan(counts.b);
    expect(counts.b).toBeGreaterThan(200);
    expect(counts.c).toBeLessThan(4);
  });
  test("正規分布の乱数の平均はおよそ0、標準偏差はおよそ1", () => {
    const rng = createRng(3);
    const values = Array.from({ length: 6000 }, () => gaussian(rng.next));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
});

describe("指す前の確認(4-5・5章)", () => {
  test("1手で見える大駒の損はA級、ほかの手と同じ損なら数えない", () => {
    const state = stateFromSfen(HANG);
    expect(blunderKind({ state, sfen: HANG, move: "5h5d", best: "5h5f", engineLoss: 900 })).toBe("A");
    expect(blunderKind({ state, sfen: HANG, move: "5h5f", best: "5h5f", engineLoss: 0 })).toBeNull();
    // エンジンの損が小さい手(狙いのある捨て駒など)は止めない。
    expect(blunderKind({ state, sfen: HANG, move: "5h5d", best: "5h5f", engineLoss: 100 })).toBeNull();
  });
  test("相手の1手詰めを許す手を見分ける", () => {
    // 後手玉5一の両脇は桂、5三に先手の歩、先手は飛車を持っている。何もしないと▲5二飛で詰む。玉が逃げれば詰まない。
    const sfen = "3nkn3/9/4P3p/9/9/9/9/9/4K4 w R 1";
    expect(allowsMateInOne(sfen, "1c1d", findMateLine)).toBe(true);
    expect(allowsMateInOne(sfen, "5a4b", findMateLine)).toBe(false);
    // 詰みの探索を渡さないとき・探索が上限に達したとき(undefined)は、詰みがあるとは言わない。
    expect(allowsMateInOne(sfen, "1c1d")).toBe(false);
    expect(allowsMateInOne(sfen, "1c1d", () => undefined)).toBe(false);
  });
  test("台無しはレベルの確率で止め、悪手の回数を使い切ったら必ず止める", () => {
    const prevent = { A: 0.9, B: 0.5, small: 0.5 };
    expect(preventsBlunder(null, prevent, { blunderAllowed: true, random: () => 0 })).toBe(false);
    expect(preventsBlunder("A", prevent, { blunderAllowed: true, random: () => 0.95 })).toBe(false);
    expect(preventsBlunder("A", prevent, { blunderAllowed: true, random: () => 0.5 })).toBe(true);
    expect(preventsBlunder("B", prevent, { blunderAllowed: false, random: () => 0.99 })).toBe(true);
    expect(preventsBlunder("small", prevent, { blunderAllowed: false, random: () => 0.99 })).toBe(false);
  });
  test("確認で防ぐ率が1なら、乱数を変えた何百回の選択で、当たりの駒を放っておく台無しの手を一度も選ばない(今までの選び方は選ぶ)", async () => {
    // 後手の飛車(4二)が、先手の金(4八)に当たっている。金を逃げずに▲3六歩と突くと、金をただで取られる。
    const sfen = "8k/5r3/9/9/9/9/2P3P2/2B2G3/K8 b - 1";
    const moves = legal(sfen);
    const search = { move: "4h3h", candidates: [
      { move: "4h3h", rank: 1, score: cp(0) }, { move: "3g3f", rank: 2, score: cp(-950) }, { move: "4h5h", rank: 3, score: cp(-20) },
    ] };
    const verify = async (list) => ({ move: list[0], candidates: list.map((move, index) => ({ move, rank: index + 1,
      score: cp(move === "3g3f" ? -950 : move === "4h3h" ? 0 : -40 - index * 5) })) });
    for (const [level, human] of [[16, true], [16, false]]) {
      const base = getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value);
      // 大きな温度(ぶれ)にして、ぶれだけでは止まらないことを確かめる。
      const strength = { ...base, scoreTemperature: 2000, shallowReadRate: 0, trustedEngineRate: 0, riskAttitude: 0, oversightRate: 0,
        engineBestVisibility: 1, engineTopVisibility: 1, human: human ? { ...base.human, prevent: { A: 1, B: 1, small: 1 } } : null };
      let hung = 0;
      for (let seed = 1; seed <= 120; seed += 1) {
        const choice = await chooseAwareMove({ strength, sfen, legalMoves: moves, search, verify, random: createRng(seed).next, maxTimeMs: 2000 });
        if (choice?.move === "3g3f") hung += 1;
      }
      if (human) expect(hung).toBe(0);
      else expect(hung).toBeGreaterThan(0);
    }
  }, 120000);
});
