import { describe, expect, test } from "vitest";
import { Position } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";
import { chooseAwareMove } from "./aware-move-choice.mjs";
import {
  OPENING_SIGMA_SCALE, RUIN_LOSS, allowedMatePlies, allowsMateInOne, beliefScores, blunderKind, chanceHardReasons, chanceHardness, characterHuman,
  gaussian, humanBlunderAllowance, humanPerception, humanSettingsForLevel, mateSightChance, normalizeHumanBlunders, noteHumanBlunder, pickByBelief,
  preventsBlunder, seenReplyLoss, threatHardReasons, threatHardness,
} from "./human-model.mjs";
import { playLight, replyLoss, stateFromSfen } from "./logic-position.mjs";
import { applyCharacter } from "./player-character.mjs";
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
    // 本番の時間の上限(20ミリ秒)は、テストを並べて走らせると足りないことがある。手数とノードの上限はそのまま、時間だけ広げる。
    const roomy = (position, plies, options) => findMateLine(position, plies, { ...options, maxTimeMs: 2000 });
    expect(allowsMateInOne(sfen, "1c1d", roomy)).toBe(true);
    expect(allowsMateInOne(sfen, "5a4b", roomy)).toBe(false);
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

// 後手の飛車(4二)が、先手の金(4八)に当たっている。金を逃げずに▲3六歩と突くと、金をただで取られる。
const GOLD = "8k/5r3/9/9/9/9/2P3P2/2B2G3/K8 b - 1";

describe("信念の式(13-3)", () => {
  test("大局観の重み・取り合いの手数・詰めろに気づく手数は、上のレベルほど大きく、Lv39は全部見える", () => {
    let previous = humanSettingsForLevel(11).belief;
    for (let level = 12; level <= 39; level += 1) {
      const now = humanSettingsForLevel(level).belief;
      expect(now.w).toBeGreaterThanOrEqual(previous.w);
      expect(now.depth).toBeGreaterThanOrEqual(previous.depth);
      expect(now.mateSight).toBeGreaterThanOrEqual(previous.mateSight);
      previous = now;
    }
    expect(humanSettingsForLevel(11).belief).toEqual({ w: 0.5, depth: 2, mateSight: 2.4 });
    expect(humanSettingsForLevel(39).belief).toEqual({ w: 1, depth: 6, mateSight: 15 });
  });
  test("気づかなかった当たりの升への取りは、見えている駒の損得に入らない", () => {
    const child = playLight(stateFromSfen(GOLD), "3g3f");
    expect(replyLoss(child, 6)).toBeGreaterThanOrEqual(600);
    expect(seenReplyLoss(child, 6, new Set())).toBe(replyLoss(child, 6));
    expect(seenReplyLoss(child, 6, new Set(["4h"]))).toBe(0);
  });
  test("相手の詰みの手数と、気づく確率", () => {
    expect(allowedMatePlies({ type: "mate", value: -2 })).toBe(1);
    expect(allowedMatePlies({ type: "mate", value: -6 })).toBe(5);
    expect(allowedMatePlies({ type: "mate", value: 3 })).toBe(0);
    expect(allowedMatePlies(cp(-500))).toBe(0);
    expect(mateSightChance(5, 5)).toBeCloseTo(0.5);
    expect(mateSightChance(3, 7)).toBeGreaterThan(0.98);
  });
  test("見えている損得と大局観の重み。すべて見え、w=1なら評価値のまま", () => {
    const state = stateFromSfen(GOLD);
    const entries = [
      { move: "4h3h", engineValue: 0, candidate: { score: cp(0) } },
      { move: "3g3f", engineValue: -580, candidate: { score: cp(-580) } },
    ];
    const all = beliefScores(entries, { state, belief: { w: 1, depth: 6, mateSight: 15 }, random: () => 0.5 });
    // 全部見えていれば、信念の差は評価値の差のまま。
    expect(all[0].belief - all[1].belief).toBeCloseTo(580, 5);
    // 金の当たりに気づかないと、金を取られる損が消え、▲3六歩のほうが良く見える。
    const blind = beliefScores(entries, { state, belief: { w: 1, depth: 6, mateSight: 15 }, blind: new Set(["4h"]), random: () => 0.5 });
    expect(blind[1].belief).toBeGreaterThan(blind[0].belief);
    expect(all[1].belief).toBeLessThan(all[0].belief);
    // CPUから見た評価(損の上限の判定)は、詰めろの見落としのときだけ変える。
    expect(blind.map(({ believed }) => believed)).toEqual([0, -580]);
    // 大局観の重みが小さいと、駒の損得の割合が大きくなる(▲3六歩の、金を取られる損が評価値より重く見える)。
    const half = beliefScores(entries, { state, belief: { w: 0.5, depth: 6, mateSight: 15 }, random: () => 0.5 });
    expect(half[0].belief - half[1].belief).toBeGreaterThan(all[0].belief - all[1].belief);
  });
  test("気づかなかった詰めろの手は、詰みのない手として見る。悪手の回数を使い切った手番は、必ず気づく", () => {
    const state = stateFromSfen(GOLD);
    const entries = [
      { move: "4h3h", engineValue: 0, candidate: { score: cp(0) } },
      { move: "4h5h", engineValue: -99994, candidate: { score: { type: "mate", value: -6 } } },
    ];
    const belief = { w: 1, depth: 6, mateSight: 2 };
    const unseen = beliefScores(entries, { state, belief, random: () => 0.5 });
    expect(unseen[1].mateUnseen).toBe(5);
    expect(unseen[1].believed).toBeGreaterThan(-1000);
    const limited = beliefScores(entries, { state, belief, random: () => 0.5, blunderAllowed: false });
    expect(limited[1].mateUnseen).toBe(0);
    expect(limited[1].believed).toBe(-99994);
    // 気づく手数が長いレベルは、5手の詰めろにほぼ気づく。
    expect(beliefScores(entries, { state, belief: { ...belief, mateSight: 12 }, random: () => 0.5 })[1].mateUnseen).toBe(0);
  });
  test("1手詰めを許す手はA級、3手詰めはB級、5手以上は確認では止めない(C級)", () => {
    const state = stateFromSfen(GOLD);
    const base = { state, sfen: GOLD, move: "4h5h", best: "4h3h", engineLoss: 99994 };
    expect(blunderKind({ ...base, allowedMate: 1 })).toBe("A");
    expect(blunderKind({ ...base, allowedMate: 3 })).toBe("B");
    expect(blunderKind({ ...base, allowedMate: 5 })).toBeNull();
  });
  test("気づかなかった当たりは放っておき(振り返りの記録を残す)、確認で防ぐ率が1なら止める。気づいた当たりは放っておかない", async () => {
    const moves = legal(GOLD);
    // 金を動かさない手は金を取られる(-650)。▲3六歩は、金を取られなければ少し良い手(-580＋金600)。
    const score = (move) => cp(move.startsWith("4h") ? (move === "4h3h" ? 0 : -20) : move === "3g3f" ? -580 : -650);
    const search = { move: "4h3h", candidates: ["4h3h", "3g3f", "4h5h"].map((move, index) => ({ move, rank: index + 1, score: score(move) })) };
    const verify = async (list) => ({ move: list[0], candidates: list.map((move, index) => ({ move, rank: index + 1, score: score(move) })) });
    const base = getStrengthSearchSettings(CPU_STRENGTH_PRESETS[16].value);
    const run = async (prevent) => {
      const strength = { ...base, scoreTemperature: 1, shallowReadRate: 0, trustedEngineRate: 0, riskAttitude: 0, oversightRate: 0,
        engineBestVisibility: 1, engineTopVisibility: 1, moveLossCap: Infinity,
        human: { ...base.human, miss: { major: 0.6, minor: 0.6, other: 0.6, free: 0, fork: 0 }, prevent, belief: { w: 1, depth: 6, mateSight: 15 } } };
      const choices = [];
      for (let seed = 1; seed <= 40; seed += 1) {
        choices.push(await chooseAwareMove({ strength, sfen: GOLD, legalMoves: moves, search, verify, random: createRng(seed).next, maxTimeMs: 3000 }));
      }
      return choices;
    };
    const loose = await run({ A: 0, B: 0, small: 0 });
    const hung = loose.filter((choice) => !choice?.move.startsWith("4h"));
    expect(hung.length).toBeGreaterThan(5);
    // 放っておいたのは、気づかなかった手番だけ。気づかなかった当たりを振り返りのために残す。
    for (const choice of hung) expect(choice.oversights).toContainEqual({ kind: "hanging", square: "4h", piece: "G", attacker: "R", hard: ["far"] });
    for (const choice of loose.filter((entry) => !entry?.oversights?.some(({ kind }) => kind === "hanging"))) expect(choice.move.startsWith("4h")).toBe(true);
    const safe = await run({ A: 1, B: 1, small: 1 });
    expect(safe.filter((choice) => !choice?.move.startsWith("4h"))).toHaveLength(0);
  }, 120000);
});

describe("見つけなかった自分の詰み(13-3)", () => {
  test("詰みを見つけなかった棋士は、詰む手も詰みのない手として比べる(評価値の大きさで結局選ばない)。記録を残す", async () => {
    const moves = legal(GOLD);
    // 仮に▲2三角成が5手詰めとする(選び方だけを確かめる)。
    const score = (move) => (move === "7h2c+" ? { type: "mate", value: 5 } : cp(move.startsWith("4h") ? (move === "4h3h" ? 0 : -20) : -650));
    const search = { move: "7h2c+", candidates: ["7h2c+", "4h3h", "4h5h"].map((move, index) => ({ move, rank: index + 1, score: score(move) })) };
    const verify = async (list) => ({ move: list[0], candidates: list.map((move, index) => ({ move, rank: index + 1, score: score(move) })) });
    const base = getStrengthSearchSettings(CPU_STRENGTH_PRESETS[16].value);
    const run = async (center) => {
      const strength = { ...base, scoreTemperature: 1, shallowReadRate: 0, trustedEngineRate: 0, riskAttitude: 0, oversightRate: 0,
        engineBestVisibility: 1, engineTopVisibility: 1, mateFinding: { center, slope: 0.7 },
        human: { ...base.human, miss: { major: 0, minor: 0, other: 0, free: 0, fork: 0 }, belief: { w: 1, depth: 6, mateSight: 15 } } };
      const choices = [];
      for (let seed = 1; seed <= 20; seed += 1) {
        choices.push(await chooseAwareMove({ strength, sfen: GOLD, legalMoves: moves, search, verify, random: createRng(seed).next, maxTimeMs: 3000 }));
      }
      return choices;
    };
    const missed = (await run(0.5)).filter((choice) => choice?.move !== "7h2c+");
    expect(missed.length).toBeGreaterThan(5);
    for (const choice of missed) expect(choice.oversights).toContainEqual({ kind: "own-mate", plies: 5 });
    // 詰みをいつも見つける棋士は、詰ます。
    expect((await run(40)).every((choice) => choice?.move === "7h2c+")).toBe(true);
  }, 120000);
});

describe("棋士の特徴のずれ(6-4・13-2)", () => {
  const human = humanSettingsForLevel(25);
  test("悪手を抑えると見落としが減り、確認で防ぐ率が上がる。頓死は、確認が緩み、詰めろに気づく手数が縮む", () => {
    const steady = characterHuman(human, { steady: 2 });
    expect(steady.miss.other).toBeCloseTo(human.miss.other * 0.4, 5);
    expect(steady.prevent.B).toBeGreaterThan(human.prevent.B);
    expect(steady.prevent.A).toBe(1);
    expect(steady.belief.mateSight).toBe(human.belief.mateSight + 2);
    const collapse = characterHuman(human, { overlook: 2 });
    expect(collapse.miss.other).toBeGreaterThan(human.miss.other);
    expect(collapse.prevent.A).toBeLessThan(0.95);
    expect(collapse.belief.mateSight).toBeCloseTo(human.belief.mateSight - 4, 5);
    const loose = characterHuman(human, { loose: 1 });
    expect(loose.sigma).toBeGreaterThan(human.sigma);
    expect(characterHuman(human, { blind: 1 }).miss.other).toBeCloseTo(human.miss.other * 2, 5);
    expect(characterHuman(humanSettingsForLevel(18), { nodes: 1.6 }).belief.depth).toBe(5);
    expect(characterHuman(human, {})).toEqual(human);
  });
  test("終盤で自玉が危ないとき、頓死の多い棋士は確認が緩む。場面が違えば変わらない", () => {
    const strength = getStrengthSearchSettings(CPU_STRENGTH_PRESETS[25].value);
    const character = { attack: 0, traits: [{ id: "endgame-collapse", degree: 2 }] };
    const ending = applyCharacter(strength, character, { phase: "ending", kingDanger: true, attackChance: false, opponentRook: null, advantage: 0 }, { skill: 0.5 });
    expect(ending.human.prevent.A).toBeLessThan(strength.human.prevent.A);
    expect(ending.human.belief.mateSight).toBeLessThan(strength.human.belief.mateSight);
    const middle = applyCharacter(strength, character, { phase: "middle", kingDanger: false, attackChance: false, opponentRook: null, advantage: 0 }, { skill: 0.5 });
    expect(middle.human).toEqual(strength.human);
    // 受けが苦手: 自玉が危ないとき、当たりの見落としが増える。
    const weak = applyCharacter(strength, { attack: 0, traits: [{ id: "weak-defense", degree: 1 }] },
      { phase: "middle", kingDanger: true, attackChance: false, opponentRook: null, advantage: 0 }, { skill: 0.5 });
    expect(weak.human.miss.other).toBeGreaterThan(strength.human.miss.other);
  });
});

describe("見えにくさの理由(13-4の記録)", () => {
  test("当たりと機会の見えにくさの理由", () => {
    expect(threatHardReasons({ square: "5e", attackers: ["5a"] }, "5a")).toEqual(["far", "away"]);
    expect(threatHardReasons({ square: "5e", attackers: ["5d"] }, "5d")).toEqual([]);
    expect(chanceHardReasons({ moves: ["N*5e"] }, "black")).toEqual(["drop"]);
    expect(chanceHardReasons({ moves: ["5e5f"] }, "black")).toEqual(["back"]);
    expect(chanceHardReasons({ moves: ["N*5e", "5e5d"] }, "black")).toEqual([]);
  });
});

describe("1局の上限・候補数・序盤のぶれ(14章)", () => {
  test("1局の上限はA級とB級を分け、表3の帯に入ったら下げる。候補数は初段前後を最大にし、上で絞る", () => {
    expect(humanSettingsForLevel(11).limit).toEqual({ A: 1, B: 2 });
    expect(humanSettingsForLevel(15).limit).toEqual({ A: 1, B: 2 });
    // 表3の「16〜18」: 15を超えたらA級は0回、B級は1回。
    expect(humanSettingsForLevel(16).limit).toEqual({ A: 0, B: 1 });
    expect(humanSettingsForLevel(25).limit).toEqual({ A: 0, B: 1 });
    expect(humanSettingsForLevel(26).limit).toEqual({ A: 0, B: 0 });
    expect(humanSettingsForLevel(39).limit).toEqual({ A: 0, B: 0 });
    expect(humanSettingsForLevel(11).candidates).toBe(4);
    expect(humanSettingsForLevel(32).candidates).toBe(8);
    // 上の帯は今までと同じ12(14-3)。
    expect(humanSettingsForLevel(39).candidates).toBe(12);
    expect(OPENING_SIGMA_SCALE).toBe(0.5);
  });

  test("台無しの手は種類ごとに数え、使い切った種類だけ止める。待ったで戻した手は数えない", () => {
    let records = noteHumanBlunder([], 10, "A");
    records = noteHumanBlunder(records, 20, "small");
    records = noteHumanBlunder(records, 30, "B");
    expect(records).toEqual([{ ply: 10, kind: "A" }, { ply: 30, kind: "B" }]);
    expect(humanBlunderAllowance({ A: 1, B: 2 }, records, 40)).toEqual({ A: false, B: true });
    // 30手目より前に戻せば、30手目のB級は数えない。
    expect(humanBlunderAllowance({ A: 1, B: 1 }, records, 25)).toEqual({ A: false, B: true });
    expect(humanBlunderAllowance(undefined, records, 40)).toBeNull();
    expect(normalizeHumanBlunders([{ ply: 3, kind: "A" }, { ply: -1, kind: "B" }, { ply: 5, kind: "C" }, "x"], 10)).toEqual([{ ply: 3, kind: "A" }]);
    const prevent = { A: 0, B: 0, small: 0 };
    const random = () => 0.5;
    expect(preventsBlunder("A", prevent, { blunderAllowed: true, allowance: { A: false, B: true }, random })).toBe(true);
    expect(preventsBlunder("B", prevent, { blunderAllowed: true, allowance: { A: false, B: true }, random })).toBe(false);
    // 上限の残りがなければ、今までの悪手の回数で決める。
    expect(preventsBlunder("B", prevent, { blunderAllowed: false, random })).toBe(true);
  });

  test("詰めろの見落としも種類ごとの上限で止める。1手詰めはA級、3手詰めまではB級、長い詰めろは数えない", () => {
    const state = stateFromSfen(GOLD);
    const belief = { w: 1, depth: 6, mateSight: 0 };
    const random = () => 0.5;
    const entry = (plies) => [{ move: "4h3h", engineValue: 0, candidate: { score: cp(0) } },
      { move: "4h5h", engineValue: -99990, candidate: { score: { type: "mate", value: -(plies + 1) } } }];
    const noB = { A: true, B: false };
    expect(beliefScores(entry(1), { state, belief, random, allowance: noB })[1].mateUnseen).toBe(1);
    expect(beliefScores(entry(3), { state, belief, random, allowance: noB })[1].mateUnseen).toBe(0);
    expect(beliefScores(entry(5), { state, belief, random, allowance: { A: false, B: false } })[1].mateUnseen).toBe(5);
  });

  test("うっかり・甘い棋士は1局の上限が少し多く、悪手を抑える棋士は少ない", () => {
    const base = humanSettingsForLevel(20);
    expect(characterHuman(base, { overlook: 1 }).limit).toEqual({ A: 1, B: 2 });
    expect(characterHuman(base, { steady: 1 }).limit).toEqual({ A: 0, B: 1 });
    expect(characterHuman(base, { steady: 2 }).limit).toEqual({ A: 0, B: 0 });
  });
});
