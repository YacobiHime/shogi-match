import { describe, expect, test, vi } from "vitest";
import { Position } from "tsshogi";
import { enumerateLegalMoves, STANDARD_SFEN } from "../game-state";
import { chooseAwareMove } from "./aware-move-choice.mjs";
import { CPU_POSITION_SET, cpuPositionVariants } from "./cpu-position-set.mjs";
import { createNaturalnessEvaluator } from "./move-naturalness.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, hybridSettingsForLevel } from "./strength-settings.mjs";
import { createRng } from "./ryuo-random.mjs";
import { chooseLogicMove } from "./logic-ai.mjs";

const legal = (sfen) => enumerateLegalMoves(Position.newBySFEN(sfen)).map(({ usi }) => usi);
const cp = (value) => ({ type: "cp", value });
const strength = (level = 20) => ({ ...getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value), logicHybrid: true,
  shallowReadRate: 0, trustedEngineRate: 0, oversightRate: 0, riskAttitude: 0 });
const fakeSearch = (moves, values = {}) => ({ move: moves[0], candidates: moves.map((move, i) => ({ move, rank: i + 1, score: cp(values[move] ?? -i * 10) })) });
const fakeVerify = (values = {}) => vi.fn(async (moves) => fakeSearch(moves, values));

describe("気づきと評価値から選ぶCPU", () => {
  test("Lv11〜39だけに連続した設定を足し、Lv0とLv40を変えない", () => {
    for (const level of [0, 49]) expect(getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value).logicHybrid).toBeUndefined();
    // 15級(Lv10)から上はみな、もとの校正のLv11以上の強さ(気づきと評価値で選ぶ)。24級〜16級はロジックAIで指すが、助言の探索の設定はLv11と同じ。
    for (const level of [1, 10, 19, 48]) expect(getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value).logicHybrid).toBe(true);
    expect(hybridSettingsForLevel(11)).toMatchObject({ logicHybrid: true, engineBestVisibility: 0.25, engineTopVisibility: 0.125, logicBonusCap: 200, takePolicyRate: 0.48 });
    expect(hybridSettingsForLevel(39)).toMatchObject({ engineBestVisibility: 0.995, engineTopVisibility: 0.4975, logicBonusCap: 20, takePolicyRate: 0 });
    expect(Object.values(hybridSettingsForLevel(20).perception).every((p) => p === 1)).toBe(true);
    for (let level = 12; level <= 39; level += 1) expect(hybridSettingsForLevel(level).engineBestVisibility).toBeGreaterThanOrEqual(hybridSettingsForLevel(level - 1).engineBestVisibility);
  });

  test.each(cpuPositionVariants().filter(({ id }) => id === "rook-attacked"))("目的のない歩打ちが最善手でも候補から外す: $mirrored", async (fixture) => {
    const legalMoves = legal(fixture.sfen);
    const idle = fixture.mirrored ? "P*2f" : "P*8d";
    const evaluate = createNaturalnessEvaluator(fixture.sfen);
    expect(evaluate(idle).purposeful).toBe(false);
    for (let seed = 1; seed <= 30; seed += 1) {
      const verify = fakeVerify();
      const choice = await chooseAwareMove({ strength: strength(), sfen: fixture.sfen, moveHistory: fixture.moveHistory, legalMoves,
        search: fakeSearch([idle]), verify, random: createRng(seed).next });
      expect(choice.move).not.toBe(idle);
      expect(choice.consideredMoves).not.toContain(idle);
      expect(evaluate(choice.move).purposeful).toBe(true);
      expect(verify.mock.calls.length).toBeLessThanOrEqual(1);
      expect(choice).toEqual(expect.objectContaining({ move: expect.any(String), rank: expect.any(Number), kind: expect.any(String), loss: expect.any(Number), reason: expect.any(String), missed: expect.any(Array), policy: null }));
    }
  });

  test("エンジンだけが見つける好手の視認率は25%、ロジックで見える取りは必ず残る", async () => {
    const legalMoves = legal(STANDARD_SFEN);
    const move = "3g3f"; // 自然さで同点の静かな手の上位4手には含まれない。
    const search = fakeSearch([move]);
    let visible = 0;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const choice = await chooseAwareMove({ strength: { ...strength(11), engineBestVisibility: 0.25, engineTopVisibility: 0 }, sfen: STANDARD_SFEN, legalMoves, search, verify: fakeVerify(), random: createRng(seed).next });
      visible += Number(choice.consideredMoves.includes(move));
    }
    expect(visible / 1000).toBeGreaterThan(0.2);
    expect(visible / 1000).toBeLessThan(0.3);
    const sfen = "4k4/9/9/9/4r4/4S4/2P6/9/4K4 b - 1";
    const choice = await chooseAwareMove({ strength: { ...strength(), engineBestVisibility: 0 }, sfen, legalMoves: legal(sfen), search: fakeSearch(["5f5e"]), verify: fakeVerify(), random: () => 0 });
    expect(choice.consideredMoves).toContain("5f5e");
  }, 20000);

  test("加点を上限で切り、損失上限と悪手回数制限を守る", async () => {
    const moves = ["7g7f", "2g2f", "3g3f"];
    const search = fakeSearch(moves, { "7g7f": 0, "2g2f": -100, "3g3f": -700 });
    for (let seed = 1; seed <= 80; seed += 1) {
      const choice = await chooseAwareMove({ strength: { ...strength(), moveLossCap: 400, logicBonusCap: 120, style: { attack: 1 } }, sfen: STANDARD_SFEN, legalMoves: moves, planMove: "2g2f", search, blunderAllowed: false, random: createRng(seed).next });
      expect(choice.logicBonus).toBeLessThanOrEqual(120);
      expect(choice.loss).toBeLessThan(300);
      expect(choice.consideredMoves).not.toContain("3g3f");
    }
  });

  test("候補がすべて損失上限の外なら候補中の最善を残す", async () => {
    const legalMoves = ["2g2f", "7g7f"];
    const choice = await chooseAwareMove({ strength: { ...strength(), moveLossCap: 1, engineBestVisibility: 0 }, sfen: STANDARD_SFEN, legalMoves,
      search: fakeSearch(["9i9h", "2g2f", "7g7f"], { "9i9h": 500, "2g2f": -500, "7g7f": -600 }), random: () => 0.5 });
    expect(choice.move).toBe("2g2f");
  });

  test("作戦の香上がり・王手・取りには目的がある", async () => {
    const choice = await chooseAwareMove({ strength: strength(), sfen: STANDARD_SFEN, legalMoves: ["9i9h", "2g2f"], planMove: "9i9h", search: fakeSearch(["9i9h", "2g2f"]), random: () => 0 });
    expect(choice.consideredMoves).toContain("9i9h");
  });

  test("受からないと気づいた局面では指定割合で取りに行く", async () => {
    const fixture = CPU_POSITION_SET.find(({ id }) => id === "hopeless");
    let take = 0;
    let policies = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const choice = await chooseAwareMove({ strength: { ...strength(11), perception: { ...strength(11).perception, hanging: 1, exchange: 0 }, takePolicyRate: 0.3 }, sfen: fixture.sfen,
        legalMoves: legal(fixture.sfen), search: fakeSearch(["7h7g"]), verify: fakeVerify(), random: createRng(seed).next });
      if (choice.policy) { policies += 1; take += Number(choice.policy === "take"); }
    }
    expect(policies).toBeGreaterThan(0);
    expect(Math.abs(take / policies - 0.3)).toBeLessThan(0.1);
  }, 20000);

  test("エンジン結果がなければ呼び出し元のLv10フォールバックに任せる", async () => {
    expect(await chooseAwareMove({ strength: strength(), sfen: STANDARD_SFEN, legalMoves: legal(STANDARD_SFEN) })).toBeNull();
    expect(await chooseAwareMove({ strength: strength(), sfen: STANDARD_SFEN, legalMoves: [] })).toBeNull();
  });

  test("今までの選び方(人間らしいCPUでない)では、見落としの追加読みも候補内で直列に行い、深い損失を記録する", async () => {
    const settings = { ...strength(20), human: null, oversightRate: 1, oversightShallowLoss: 100, oversightMaxLoss: 400, moveLossCap: 400 };
    let running = 0;
    let maximum = 0;
    const verify = vi.fn(async (moves, nodes) => {
      running += 1;
      maximum = Math.max(maximum, running);
      await Promise.resolve();
      running -= 1;
      const values = nodes === settings.oversightNodes ? { "7g7f": 0, "2g2f": -350 } : { "7g7f": 0, "2g2f": -10 };
      return { move: "7g7f", candidates: moves.filter((move) => values[move] !== undefined)
        .map((move, index) => ({ move, rank: index + 1, score: cp(values[move]) })) };
    });
    const choice = await chooseAwareMove({ strength: settings, sfen: STANDARD_SFEN, legalMoves: ["7g7f", "2g2f"], search: fakeSearch(["7g7f", "2g2f"]), verify, random: () => 0 });
    expect(maximum).toBe(1);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(verify.mock.calls.map(([, nodes]) => nodes)).toEqual([settings.nodes, settings.oversightNodes]);
    expect(choice).toMatchObject({ move: "2g2f", kind: "oversight", loss: 350 });
    for (const [moves] of verify.mock.calls) for (const move of moves) expect(choice.consideredMoves).toContain(move);
  });

  test("候補だけの評価が失敗したらLv10へのフォールバックを要求する", async () => {
    const choice = await chooseAwareMove({ strength: strength(), sfen: STANDARD_SFEN, legalMoves: legal(STANDARD_SFEN), search: fakeSearch(["9i9h"]), verify: async () => null, random: () => 0 });
    expect(choice).toBeNull();
  });

  test.each(["時間切れ", "追加評価の失敗"])("%sでも取得済みの目的のある評価を捨てない", async (kind) => {
    const verify = vi.fn(async () => null);
    const choice = await chooseAwareMove({ strength: { ...strength(), engineBestVisibility: 1, scoreTemperature: 1 },
      sfen: STANDARD_SFEN, legalMoves: ["7g7f", "2g2f"], search: fakeSearch(["7g7f"]), verify,
      maxTimeMs: kind === "時間切れ" ? 0 : 600, random: () => 0 });
    expect(choice).toMatchObject({ move: "7g7f", kind: "aware", loss: 0 });
    expect(verify).toHaveBeenCalledTimes(kind === "時間切れ" ? 0 : 1);
  });

  test("基準手を同じMultiPVで評価する場合は深さの違う値を混ぜない", async () => {
    const verify = fakeVerify({ "7g7f": 1200, "2g2f": 500 });
    const choice = await chooseAwareMove({ strength: { ...strength(), consistentCandidateScores: true, engineBestVisibility: 1, scoreTemperature: 1 }, sfen: STANDARD_SFEN,
      legalMoves: ["7g7f", "2g2f"], search: fakeSearch(["7g7f"], { "7g7f": 0 }), verify, random: () => 0 });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(new Set(verify.mock.calls[0][0])).toEqual(new Set(["7g7f", "2g2f"]));
    expect(choice).toMatchObject({ move: "7g7f", loss: 0 });
  });

  test("最善手を信頼する手番では途中の深さの古い2位スコアで逆転させない", async () => {
    const verify = fakeVerify();
    const search = fakeSearch(["7g7f", "2g2f"], { "7g7f": 0, "2g2f": 1000 });
    const choice = await chooseAwareMove({ strength: { ...strength(39), trustedEngineRate: 1, engineBestVisibility: 1,
      engineTopVisibility: 1, scoreTemperature: 1 }, sfen: STANDARD_SFEN, legalMoves: ["7g7f", "2g2f"],
      search, verify, random: () => 0 });
    expect(choice).toMatchObject({ move: "7g7f", loss: 0, consideredMoves: ["7g7f"] });
    expect(verify).not.toHaveBeenCalled();
  });

  test("上位で最善手に目的がなければ取得済みの目的のある次善手を使う", async () => {
    const verify = fakeVerify();
    const choice = await chooseAwareMove({ strength: { ...strength(39), trustedEngineRate: 1, engineBestVisibility: 1, engineTopVisibility: 0 },
      sfen: STANDARD_SFEN, legalMoves: ["9i9h", "7g7f"], search: fakeSearch(["9i9h", "7g7f"]), verify, random: () => 0.5 });
    expect(choice).toMatchObject({ move: "7g7f", rank: 2, loss: 10 });
    expect(verify).not.toHaveBeenCalled();
  });

  test("上位の次善手を使う経路でも大きな悪手を使い切った後の上限を守る", async () => {
    const verify = fakeVerify();
    const choice = await chooseAwareMove({ strength: { ...strength(39), trustedEngineRate: 1, engineBestVisibility: 1 },
      sfen: STANDARD_SFEN, legalMoves: ["9i9h", "7g7f", "2g2f"],
      search: fakeSearch(["9i9h", "7g7f", "2g2f"], { "9i9h": 0, "7g7f": -350, "2g2f": -100 }),
      verify, blunderAllowed: false, random: () => 0.5 });
    expect(choice).toMatchObject({ move: "2g2f", loss: 100 });
    expect(verify).not.toHaveBeenCalled();
  });

  test("浅く読む手番も具体的な候補を直列に一度だけ評価し、理由を返す", async () => {
    const verify = fakeVerify();
    const choice = await chooseAwareMove({ strength: { ...strength(11), shallowReadRate: 1 },
      sfen: STANDARD_SFEN, legalMoves: ["7g7f", "2g2f"], search: fakeSearch(["9i9h"]), verify, random: () => 0.5 });
    expect(choice.kind).toBe("aware-shallow");
    expect(["7g7f", "2g2f"]).toContain(choice.move);
    expect(createNaturalnessEvaluator(STANDARD_SFEN)(choice.move).purposeful).toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0]).toEqual([choice.move]);
  });

  test("浅い手番にも棋士の気づきと受けの棋風を反映する", async () => {
    const choice = await chooseAwareMove({ strength: { ...strength(11), shallowReadRate: 1, shallowDepth: 2, shallowTemperature: 1,
      perception: { ...strength(11).perception, hanging: 0, freeCapture: 0 }, style: { attack: -1 }, logicBonusCap: 200 },
      sfen: STANDARD_SFEN, legalMoves: ["7g7f", "6i7h"], search: fakeSearch(["7g7f", "6i7h"]), random: () => 0.5 });
    expect(choice).toMatchObject({ move: "6i7h", kind: "aware-shallow", noticed: { hanging: false, freeCapture: false } });
  });

  test("浅い候補の評価が返らなくても既知の候補を残し、候補の追加評価を重ねない", async () => {
    const verify = vi.fn(async () => null);
    const choice = await chooseAwareMove({ strength: { ...strength(11), shallowReadRate: 1, engineBestVisibility: 1 },
      sfen: STANDARD_SFEN, legalMoves: ["7g7f", "2g2f"], planMove: "2g2f", search: fakeSearch(["7g7f"]), verify, random: () => 0.5 });
    expect(choice).toMatchObject({ move: "7g7f", kind: "aware" });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0]).toEqual(["2g2f"]);
  });

  test("候補内で最高点でも、基準手より大きく悪い大駒のただ捨てを例外で残さない", async () => {
    const position = Position.newBySFEN(STANDARD_SFEN);
    for (const usi of ["7g7f", "3c3d"]) position.doMove(position.createMoveByUSI(usi));
    const choice = await chooseAwareMove({ strength: { ...strength(11), engineBestVisibility: 0, engineTopVisibility: 1 },
      sfen: position.sfen, legalMoves: ["9i9h", "8h3c+", "2g2f"],
      search: fakeSearch(["9i9h", "8h3c+", "2g2f"], { "9i9h": 0, "8h3c+": -1000, "2g2f": -2000 }), random: () => 0.5 });
    expect(choice.move).toBe("2g2f");
  });

  test("浅い手番より先に棋士が見つけたエンジンの詰みを採用する", async () => {
    const search = fakeSearch(["7g7f", "2g2f"]);
    search.candidates[0].score = { type: "mate", value: 3 };
    const choice = await chooseAwareMove({ strength: { ...strength(11), shallowReadRate: 1, shallowDepth: 2,
      mateFinding: { center: 100, slope: 1 } }, sfen: STANDARD_SFEN, legalMoves: ["7g7f", "2g2f"], search, random: () => 0.5 });
    expect(choice).toMatchObject({ move: "7g7f", kind: "mate", reason: "mate" });
  });

  test("最善手を信頼する上位でも棋風の働く手番を飛ばさない", async () => {
    const choice = await chooseAwareMove({ strength: { ...strength(39), trustedEngineRate: 1, engineBestVisibility: 1,
      engineTopVisibility: 1, logicBonusCap: 20, scoreTemperature: 1, style: { attack: -1, rate: 1 } },
      sfen: STANDARD_SFEN, legalMoves: ["7g7f", "6i7h"],
      search: fakeSearch(["7g7f", "6i7h"], { "7g7f": 0, "6i7h": -10 }), random: () => 0.5 });
    expect(choice.move).toBe("6i7h");
    expect(choice.logicBonus).toBe(20);
  });

  test("浅い手番の校正を、角を歩と引き換えに渡す手で弱くしない", async () => {
    const position = Position.newBySFEN(STANDARD_SFEN);
    for (const usi of ["7g7f", "3c3d"]) position.doMove(position.createMoveByUSI(usi));
    const moves = ["8h3c+", "2g2f", "6i7h"];
    const search = fakeSearch(["2g2f", "6i7h", "8h3c+"], { "2g2f": 0, "6i7h": -20, "8h3c+": -3000 });
    let shallowSacrifices = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const random = createRng(seed).next;
      random(); // 浅く読む手番のくじと揃える。
      const shallow = chooseLogicMove({ sfen: position.sfen, legalMoves: moves, level: 10, random });
      shallowSacrifices += Number(shallow.move === "8h3c+");
      const choice = await chooseAwareMove({ strength: { ...strength(11), shallowReadRate: 1, engineBestVisibility: 1 },
        sfen: position.sfen, legalMoves: moves, search, random: createRng(seed).next });
      expect(choice.move).not.toBe("8h3c+");
    }
    expect(shallowSacrifices).toBeGreaterThan(0);
  }, 20000);
});
