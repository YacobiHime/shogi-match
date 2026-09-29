import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../ShogiMatchGame.vue", import.meta.url), "utf8");
const responsiveSource = readFileSync(
  new URL("../composables/useResponsiveLayout.ts", import.meta.url),
  "utf8",
);

describe("match screen regressions", () => {
  it("passes only the SFEN to the engine because setPosition adds \"position sfen\"", () => {
    // 「sfen sfen ...」になるとエンジンがbestmoveを返さず、平手以外の対局でCPUが止まる。
    expect(source).not.toMatch(/`sfen \$\{/);
    expect(source).toContain('const base = matchInitialSfen.value === STANDARD_SFEN ? "startpos" : matchInitialSfen.value;');
  });

  it("keeps the flip control readable and reachable on every layout", () => {
    // ひふみんアイは、閃き・待ったと同じ並びに置く。
    expect(source).toMatch(/class="shogi-game__assist-actions"[\s\S]*?class="shogi-game__assist-toggle shogi-game__command--flip"[\s\S]*?aria-label="盤面を上下反転（ひふみんアイ）"/);
    // 狭い画面でもはみ出さないよう、区切り（<wbr>や空白）でだけ2行に折り返す。
    expect(source).toMatch(/\.shogi-game__assist-actions > button\s*\{[^}]*word-break:\s*keep-all/s);
    expect(source).toContain("ひふみん<wbr>アイ");
    // PC以外では見出しにボタンを並べない。棋譜解析中は解析パネルの「その他」から反転できる。
    expect(responsiveSource).toMatch(/const menuCollapsed = computed\(\(\) => uiLayout\.value !== "wide"\)/);
    expect(source).toMatch(/role="menuitemcheckbox"[\s\S]*?ひふみんアイ（盤を反転）/);
  });

  it("asks before resigning from the toolbar and the menu", () => {
    expect(source.match(/reviewMode \? completeReview\(\) : requestResign\(\)/g)).toHaveLength(2);
    expect(source).not.toMatch(/reviewMode \? completeReview\(\) : resign\(\)/);
    expect(source).toMatch(/function confirmResign\(\) \{\s*resignConfirmOpen\.value = false;\s*resign\(\);/);
  });

  it("does not hide opening-guide choices behind a fixed height in portrait", () => {
    const stack = source.split(".shogi-game--stack {")[1]?.split("}")[0] ?? "";
    expect(stack).toMatch(/grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto auto auto;/);
    expect(stack).toMatch(/"board" "coach" "guide" "actions"/);
    expect(source.match(/class="shogi-game__opening-guide"/g)).toHaveLength(1);
  });

  it("shows the opponent separately from the handicap", () => {
    expect(source).toMatch(/<dt>手合割<\/dt>/);
    expect(source).toMatch(/<dt>対戦相手<\/dt>/);
    expect(source).toMatch(/cpuPlayerName/);
    expect(source).not.toMatch(/手合割・対戦相手/);
  });

  it("keeps the menu above the board name plates", () => {
    const shell = source.split(".shogi-game__board-shell {")[1]?.split("}")[0] ?? "";
    expect(shell).toMatch(/isolation:\s*isolate;/);
  });

  it("puts the hands above and below the board on phone-shaped screens", () => {
    expect(responsiveSource).toMatch(/const PHONE_ASPECT_RATIO = 1\.5;/);
    expect(responsiveSource).toMatch(/height \/ width >= PHONE_ASPECT_RATIO\s*\?\s*\{ name: "portrait" as const/);
    expect(responsiveSource.match(/stackPreferredFrame\(/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("praises good moves only after mistakes are ruled out", () => {
    expect(source).toMatch(/const mistake = moveFeedback && \/move-\(blunder\|mistake\)\/\.test\(moveFeedback\.key\);/);
    expect(source).toMatch(/if \(!mistake\) moveFeedback = praise;/);
    // 好手判定の解析はCPU着手を描画した後、定跡補助の後ろへ積む。
    expect(source).toMatch(/scheduleOpeningFollowupCandidates\(\);\s*schedulePlayerMoveBaseline\(\);\s*schedulePlayerIdleAdvice\(\);/);
    expect(source).toMatch(/<ruby v-if="segment\.ruby">/);
  });

  it("announces the hint like a mentor naming the best move", () => {
    expect(source).toMatch(/hintText\.value = `最善手は\$\{formatSpokenMove\(moves\[0\]\.move, currentSfen\.value\)\}だよ！`;/);
  });

  it("draws detour arrows from opening-compatible candidates", () => {
    expect(source).toMatch(/openingDetourArrowCandidates\(\s*unsafePlanUsi,\s*compatibleCandidates,/);
  });

  it("guides strategy and castle moves in parallel by evaluation", () => {
    expect(source).toMatch(/return openingPlanParallelCandidates\(\{/);
    // 上位候補に入らなかった戦法・囲いの予定手も、同じ探索で評価してから比べる。
    expect(source).toMatch(/searchMoves: unscoredPlans,/);
    expect(source).toMatch(/const bestPlanUsi = selectBestOpeningPlan\(plannedOptions, compatibleCandidates\);/);
  });

  it("builds a random registered opening for the おまかせ CPU and keeps it across reloads", () => {
    expect(source).toMatch(/if \(!cpuOpeningPlan\) cpuOpeningPlan = randomCpuOpeningCombination\(cpuMoves, configuredCpuColor, legalMoves\);/);
    expect(source).toMatch(/randomOpeningCombinationRate\(strengthPresetFor\(searchNodes\.value\)\.skill\)/);
    expect(source).toMatch(/\* strength\.openingPlanScoreScale/);
    expect(source).toMatch(/cpuOpeningPlan = restoredCpuOpeningPlan\(snapshot\.cpuOpeningPlan\);/);
    expect(source).toMatch(/if \(restoringSavedMatch\) return;\s*cpuOpeningPlan = null;\s*\}, \{ flush: "sync" \}\);/);
  });

  it("plays the move sound for moves made during review, including CPU play from a review position", () => {
    const applyMove = source.split("function applyMove(")[1]?.split("async function showHint")[0] ?? "";
    expect(applyMove).toMatch(/moveSounds\.play\(selectMoveSound\([\s\S]*?\)\);\s*if \(!reviewMode\.value\) \{/);
  });

  it("locks the counterpart select for combined strategy/castle definitions", () => {
    expect(source).toMatch(/v-model="selectedStrategy"[\s\S]*?:disabled="strategySelectLocked"/);
    expect(source).toMatch(/v-model="selectedCastle"[\s\S]*?:disabled="castleSelectLocked"/);
    // 対局準備のCPU欄は「項目: 値 [変更]」の行で、一体型なら変更ボタンを無効にする。
    expect(source).toMatch(/id: "cpuDetailedStrategy"[\s\S]*?disabled: cpuStrategySelectLocked\.value/);
    expect(source).toMatch(/id: "cpuDetailedCastle"[\s\S]*?disabled: cpuCastleSelectLocked\.value/);
    expect(source).toMatch(/class="shogi-game__pregame-change"\s+:disabled="row\.disabled"/);
  });
});
