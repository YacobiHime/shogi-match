import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchScreenSource } from "./match-screen-source.mjs";

const source = matchScreenSource();
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

  it("keeps the flip control reachable on every layout from the header menu", () => {
    // 対局中の操作列は閃き・待ったに絞り、ひふみんアイは見出しのメニューに置く。メニューはどの画面の形にもある。
    const menu = source.split('class="shogi-game__menu" role="menu"')[1]?.split("</header>")[0] ?? "";
    expect(menu).toMatch(/role="menuitemcheckbox"[\s\S]*?aria-label="盤面を上下反転（ひふみんアイ）"[\s\S]*?@click="boardFlipOverride = !boardFlipOverride"/);
    expect(menu).not.toMatch(/v-if="menuCollapsed"[^>]*>\s*<button[^>]*aria-label="盤面を上下反転/);
    // 狭い画面でもはみ出さないよう、操作列のボタンは区切り（<wbr>や空白）でだけ2行に折り返す。
    expect(source).toMatch(/\.shogi-game__assist-actions > button\s*\{[^}]*word-break:\s*keep-all/s);
    // PC以外では見出しにボタンを並べない。棋譜解析中は解析パネルの「その他」からも反転できる。
    expect(responsiveSource).toMatch(/const menuCollapsed = computed\(\(\) => uiLayout\.value !== "wide"\)/);
    expect(source).toMatch(/role="menuitemcheckbox"[\s\S]*?ひふみんアイ（盤を反転）/);
  });

  it("suspends a match to the home screen and resumes it from the saved state", () => {
    // 中断は、ホームのある表示だけで出す。保存に印を付け、盤の状態を消してホームへ戻る。
    expect(source).toMatch(/v-if="!menuCollapsed && !reviewMode"[\s\S]*?v-if="showHome"[\s\S]*?suspendConfirmOpen = true[\s\S]*?>中断<\/button>/);
    expect(source).toMatch(/v-if="menuCollapsed && !reviewMode"[\s\S]*?v-if="showHome"[\s\S]*?suspendConfirmOpen = true[\s\S]*?>対局を中断する<\/button>/);
    expect(source).toContain("suspended: suspendedMatch.value !== null,");
    expect(source).toMatch(/function suspendMatch\(\)[\s\S]*?persistMatchState\(\);[\s\S]*?matchStarted\.value = false;[\s\S]*?openHome\(\);/);
    // 中断した対局は、リロードしても自動では復元せず、ホームの「対局を再開」から復元する。
    expect(source).toMatch(/snapshot\.suspended === true && props\.showHome && !resume/);
    expect(source).toMatch(/function resumeSuspendedMatch\(\)[\s\S]*?restorePersistedMatch\(\{ resume: true \}\)[\s\S]*?scheduleCpuMove\(\);/);
    // 新しい対局を始めると中断した対局が消えるため、開始の3経路で確認する。
    expect(source).toMatch(/function openMatchSetup[\s\S]*?confirmDiscardSuspended/);
    expect(source).toContain("confirmDiscardSuspended(startMeasureMatchNow)");
    expect(source).toContain("confirmDiscardSuspended(() => startMatchFromTutorialNow(request))");
    // ブラウザの戻る操作で、確認ダイアログも閉じられる。
    expect(source).toMatch(/function navigateBack\(\)[\s\S]*?discardSuspendedPending[\s\S]*?suspendConfirmOpen/);
  });

  it("runs the Ryuo tournament as its own mode from the title screen, with saved seasons and its own result dialog", () => {
    // 大会は、対局設定ではなく、タイトル画面のボタンから入る専用の画面で参加する。
    expect(source).toMatch(/@click="openTournamentScreen"[\s\S]*?<span class="shogi-title__label">大会<\/span>/);
    const kindStart = source.indexOf("const MATCH_KIND_OPTIONS");
    const kindOptions = source.slice(kindStart, source.indexOf("\n];", kindStart));
    expect(kindOptions).toContain("learning");
    expect(kindOptions).not.toContain("tournament");
    expect(source).toMatch(/<ShogiTournament[\s\S]*?@enter="enterRyuoSeason"[\s\S]*?@play="startRyuoGame"/);
    // 大会の対局は内部の種類「tournament」で動かし、通常の結果ダイアログとは別に、大会専用の結果を出す。
    expect(source).toContain('type MatchKind = "normal" | "learning" | "tournament";');
    expect(source).toMatch(/v-if="resultDialogOpen && result && resultPresentation && !ryuoGame"/);
    expect(source).toMatch(/v-if="resultDialogOpen && result && resultPresentation && ryuoGame"[\s\S]*?data-tournament-result/);
    // 対局準備を開くときは、通常対局へ戻す(大会の対局準備はない)。
    expect(source).toMatch(/if \(matchKind\.value === "tournament"\) matchKind\.value = "normal";/);
    // 終局を記録してから保存し、保存と復元に、いま指している大会の対局を含める。
    expect(source).toMatch(/recordRyuoOutcome\(matchResult\);[\s\S]*?persistMatchState\(\);/);
    expect(source).toContain("ryuoGame: ryuoGame.value,");
    expect(source).toMatch(/const savedRyuo = snapshot\.ryuoGame;/);
    // 期とキャリアは、1局ごとに別のキーへ保存する。終わった期は、1回だけキャリアと称号に反映する。
    expect(source).toMatch(/const next = recordUserGame\(rawRyuoSeason\(\), outcome\);[\s\S]*?saveSeason\(browserStorage\(\), next\);/);
    // 終えた対局は、統計のために、別のエンジンで裏で解析する(保存して、リロードしても続ける)。
    expect(source).toMatch(/next\.analysisQueue = \[/);
    expect(source).toMatch(/async function processQueue\(\)/);
    expect(source).toMatch(/void ryuoStats\.processQueue\(\)/);
    expect(source).toMatch(/stages: \["scan"\]/);
    expect(source).toMatch(/current\.id !== job\.seasonId/);
    // 結果の画面を見終えたら記録し、次に竜王戦を選ぶと次の期のエントリーになる。
    expect(source).toMatch(/@result-seen="markRyuoResultSeen"/);
    expect(source).toMatch(/season\.phase !== "done" \|\| season\.applied/);
    // 千日手は、結果に数えず、先後を入れ替えて指し直す。
    expect(source).toMatch(/if \(!matchResult\.winner\) \{[\s\S]*?next\.pending\.color = next\.pending\.color === "black" \? "white" : "black";/);
    // 重ねて開く画面なので、ブラウザの戻る操作で閉じられる(大会の画面の中の戻りを先に行う)。中断した対局を消す確認も挟む。
    expect(source).toMatch(/function navigateBack\(\)[\s\S]*?tournamentView\.value\.goBack\(\)/);
    expect(source).toMatch(/canGoBack: \(\) =>[^\n]*tournamentOpen\.value/);
    expect(source).toMatch(/function startRyuoGame\(\) \{\s*confirmDiscardSuspended\(startRyuoGameNow\);/);
    // 大会の閃き・待ったの回数は、エントリー設定で決める。
    expect(source).toMatch(/matchKind\.value === "tournament"\) return assistAllowance\(Number\(ryuoSeason\.value\?\.settings\?\.hintLimit/);
    // 竜王戦の対局も、自由対局と同じくレーティングとやこびノートに数え、棋戦・相手・段階を残す。千日手は指し直した対局だけを数える。
    expect(source).toMatch(/const rated = \(matchKind\.value === "normal" \|\| tournament\)/);
    expect(source).toMatch(/event: tournament \? "ryuo" : "free"/);
    expect(source).toMatch(/if \(!rated \|\| \(tournament && !matchResult\.winner\)\) return;/);
  });

  it("offers to set the rating only in the measurement started from the notebook", () => {
    // 診断は、棋力測定の対局では常に出し、ほかの棋譜解析では「その他」から開いた人だけに出す。
    // 「レーティングに設定」のボタンは、棋力測定の対局だけ。
    expect(source).toMatch(/v-if="skillDiagnosis && \(measureSession \|\| skillDiagnosisVisible\)"/);
    expect(source).toMatch(/v-if="skillDiagnosis && !measureSession"[^>]*@click="skillDiagnosisVisible = !skillDiagnosisVisible"/);
    expect(source.match(/@click="applySkillDiagnosis"/g)).toHaveLength(2);
    expect(source).toMatch(/<button v-if="measureSession" type="button"[^>]*@click="applySkillDiagnosis"/);
    // 測定の結果のダイアログは、測定の対局(measureSession)のときだけ開く。
    expect(source).toMatch(/measureSession\.value && !measureReportDismissed\.value && Boolean\(skillDiagnosis\.value\)/);
  });

  it("returns to the Ryuo screen, not the home screen, after a Ryuo game or its review", () => {
    // 対局や検討を終えたら、竜王戦の対局なら竜王戦の画面(トーナメント表)へ戻る。明示的な「ホームへ」だけはホームへ。
    expect(source).toMatch(/const backToTournament = !toHome && props\.showHome && Boolean\(ryuoGame\.value\)/);
    expect(source).toMatch(/if \(backToTournament\) \{\s*tournamentStartAt\.value = "season";\s*tournamentOpen\.value = true;/);
    expect(source).toMatch(/@click="leaveFinishedMatch\(\{ toHome: true \}\)"/);
  });

  it("keeps the Ryuo screen buttons the same size and lets Yakobihime do the explaining", () => {
    const tournament = readFileSync(new URL("../ShogiTournament.vue", import.meta.url), "utf8");
    // 選択肢の高さ・大きな操作ボタンの高さを、共通の値にそろえ、選択肢は等分のグリッドで並べる。
    expect(tournament).toContain("--tr-control: 2.75rem;");
    expect(tournament).toContain("--tr-action: 3.25rem;");
    expect(tournament).toMatch(/\.shogi-tournament__choices--ten \{ grid-template-columns: repeat\(14, minmax\(0, 1fr\)\); \}/);
    expect(tournament).toMatch(/\.shogi-tournament__choices button,[\s\S]*?height: var\(--tr-control\);/);
    expect(tournament).toMatch(/\.shogi-tournament__start,\s*\.shogi-game \.shogi-tournament__sub \{[\s\S]*?height: var\(--tr-action\);/);
    // 大会の選択は、参加できる竜王戦を1枚だけ大きく出し、準備中のタイルは、段によらず同じ大きさで同じ列に並べる。
    expect(tournament).toMatch(/class="shogi-title__next" data-tournament="ryuo"/);
    expect(tournament).toMatch(/shogi-tournament-home \.shogi-tournament__soon-tiles \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
    // 説明・エントリーの一言・次の対局・結果の解説は、やこび姫のセリフにする。
    // 顔を何度も並べず、各画面に、大きなやこび姫の解説役(xl)を1人置いて話させる。
    expect(tournament.match(/<YakobiSays[^>]*size="xl"/g)?.length).toBe(3);
    // エントリーの設定を選ぶと、やこび姫がその設定について話す(選択シートで選んだとき)。
    expect(tournament).toMatch(/difficulty\.value = Number\(value\); talkTopic\.value = "difficulty";/);
    for (const helper of ["ryuoGuideLines", "entryDifficultyLine", "opponentLines", "resultLines", "seasonPhaseLines"]) {
      expect(tournament).toContain(helper);
    }
  });

  it("asks before resigning from the toolbar and the menu", () => {
    expect(source.match(/@click="(?:closeSettings\(\); )?requestResign\(\)"/g)).toHaveLength(2);
    expect(source).not.toMatch(/@click="(?:closeSettings\(\); )?resign\(\)"/);
    expect(source).toMatch(/function confirmResign\(\) \{\s*resignConfirmOpen\.value = false;\s*resign\(\);/);
  });

  it("shows the button that finishes the review outside the menu, naming where it goes", () => {
    // 検討を終えるボタンは、狭い画面でもメニュー(ハンバーガー)にしまわない。
    const toolbar = source.split('class="shogi-game__toolbar"')[1]?.split('class="shogi-game__menu-toggle')[0] ?? "";
    expect(toolbar).toMatch(/v-if="reviewMode && !measureAnalyzing"[\s\S]*?@click="completeReview\(\)"/);
    expect(toolbar).not.toMatch(/v-if="!menuCollapsed"[^>]*>[\s\S]*?completeReview/);
    expect(source).toMatch(/"完了して教室へ"[\s\S]*"完了して竜王戦へ"[\s\S]*"完了してホームへ" : "完了して対局準備へ"/);
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
    // 好手判定の解析はCPU着手を描画した後、定跡補助の後ろへ積む。その前に、局面の注意(詰み筋・評価の崖など)の解析を積む。
    expect(source).toMatch(/scheduleOpeningFollowupCandidates\(\);\s*if \([^)]*\)\) \{\s*scheduleDedicatedCoachAdvice\(null, \{ riskOnly: hadScore \}\);\s*\}\s*scheduleMoveJudgeBaseline\(\);\s*schedulePlayerMoveBaseline\(\);\s*schedulePlayerIdleAdvice\(\);/);
    // CPUの選んだ手の評価値がないとき(Lv0〜10など)も、プレイヤーの手番に読み直して形勢の助言を出す。
    expect(source).toContain("schedulePostCpuAssists(selectedCpuScore !== undefined);");
    // 悪手判定は、着手の前後を同じ深さで読んで比べる。着手後の局面は、相手の思考時間としてCPUの探索の前に読む。
    const cpuTurn = source.split("async function scheduleCpuMove()")[1]?.split("// 図鑑の棋譜解析")[0] ?? "";
    expect(cpuTurn.indexOf("judged = await judgePlayerMove(")).toBeGreaterThan(-1);
    expect(cpuTurn.indexOf("judged = await judgePlayerMove(")).toBeLessThan(cpuTurn.indexOf("const search = await engine.go({"));
    expect(cpuTurn).toMatch(/if \(!judged\) \{\s*moveFeedback = getMoveFeedback\(/);
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
    // 駒音は、検討中かどうかで分ける前に鳴らす(検討中の手にも鳴らす)。
    const soundAt = applyMove.indexOf("moveSounds.play(selectMoveSound(");
    const reviewGate = applyMove.indexOf("if (!reviewMode.value) {");
    expect(soundAt).toBeGreaterThan(-1);
    expect(soundAt).toBeLessThan(reviewGate);
    expect(applyMove.slice(0, soundAt)).not.toMatch(/if \(!?reviewMode\.value\) \{\s*$/);
  });

  it("picks the player's plan from opening plan cards and locks the CPU counterpart for combined definitions", () => {
    // やこび姫補助の作戦は、<select>ではなく、完成形の小さな盤が描かれた作戦カードのシートで選ぶ。
    expect(source).not.toMatch(/v-model="selected(Strategy|Castle)"/);
    expect(source).toMatch(/<OpeningPlanSheet[\s\S]*?@choose="choosePlan"[\s\S]*?@auto="autoPickOpeningPlan/);
    // 対局準備の「あなたの作戦」は、おまかせと変更の2つのボタンを持つ行。
    expect(source).toMatch(/kind: "plan", id: "playerPlan", label: "あなたの作戦"/);
    expect(source).toMatch(/row\.kind === 'plan'[\s\S]*?data-plan-auto[\s\S]*?openPlanSheet\('pregame'\)/);
    // 中断したら「作戦を変えよう」の札で、近い作戦を残り手数つきで並べる。
    expect(source).toMatch(/data-plan-interruption[\s\S]*?chooseSuggestedPlan\(suggestion\.kind, suggestion\.id\)/);
    // 完成形の駒を盤に薄く出す。
    expect(source).toMatch(/:ghost-pieces="planGhosts"/);
    // 戻る操作で作戦カードのシートを閉じる。
    expect(source).toMatch(/else if \(planSheet\.value\) \{\s*closePlanSheet\(\);/);
    // 対局準備のCPU欄は「項目: 値 [変更]」の行で、一体型なら変更ボタンを無効にする。
    expect(source).toMatch(/id: "cpuDetailedStrategy"[\s\S]*?disabled: cpuStrategySelectLocked\.value/);
    expect(source).toMatch(/id: "cpuDetailedCastle"[\s\S]*?disabled: cpuCastleSelectLocked\.value/);
    expect(source).toMatch(/class="shogi-game__pregame-change"\s+:disabled="row\.disabled"/);
  });

  it("puts the next challenge first on the result screen and keeps the retry suggestion optional", () => {
    // リトライは迅速に: 通常の対局の結果では「もう一局」が「対局を振り返る」より手前にある。
    const dialog = source.split('aria-labelledby="match-result-title"')[1]?.split('aria-labelledby="tournament-result-title"')[0] ?? "";
    expect(dialog.indexOf("data-rematch")).toBeGreaterThan(-1);
    expect(dialog.indexOf("data-rematch")).toBeLessThan(dialog.indexOf("対局を振り返る"));
    // 連敗の提案は、挑戦を続ける道を先頭に並べ、強さは自動では変えない。
    expect(dialog).toMatch(/data-retry-suggestion[\s\S]*?もう一度挑む[\s\S]*?で腕ならし[\s\S]*?香落ちで挑む/);
    expect(source).not.toMatch(/resultRetrySuggestion[^\n]*searchNodes\.value\s*=/);
    // 次の級・段までの残りを、対局直後に見せる。
    expect(dialog).toContain("data-next-goal");
    // 「もう一局」は対局準備を開かずに始める。
    const rematch = source.split("function rematch(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(rematch).toMatch(/openPregame\(\);[\s\S]*?beginMatch\(\)/);
    expect(rematch).not.toMatch(/pregameOpen\.value = true/);
  });

  it("starts the home recommendation without the setup screen and decides colors by furigoma", () => {
    const homeNext = source.split("function startHomeNext()")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(homeNext).toContain("startQuickMatch()");
    const quick = source.split("function startQuickMatch()")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(quick).toMatch(/throwFurigoma\(\)[\s\S]*?beginMatch\(\);[\s\S]*?showFurigoma/);
    // 振り駒の知らせは盤の操作を妨げない。
    expect(source).toMatch(/\.shogi-game__furigoma \{[^}]*pointer-events: none/s);
  });

  it("lets a lost game be replayed from the position before the losing move", () => {
    expect(source).toMatch(/data-retry-from-losing[\s\S]*?@click="retryFromPly\(guidedRetryPly\)"/);
    const retry = source.split("function retryFromPly(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(retry).toContain("startPositionMatch(sfen, playerColor, RETRY_START_LABEL)");
    // 局面からの対局は平手の初期局面ではないので、レーティングの対象にならない。
    expect(source).toMatch(/&& matchInitialSfen\.value === STANDARD_SFEN\s*&& level !== undefined/);
  });

  it("stops only what happens next for heavy moments, and the board can always cut the stop short", () => {
    // 止めるのはCPUの応手と結果画面の開始だけ。盤を触ると止めを打ち切る。
    expect(source).toMatch(/await waitForImpactHold\(\);\s*if \(generation !== matchGeneration\) return;\s*if \(applyMove\(usi, "cpu"\)/);
    expect(source).toMatch(/class="shogi-game__board-shell"[\s\S]*?@pointerdown\.capture="releaseImpactHold"/);
    const finish = source.split("function finish(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(finish).toMatch(/finishImpact\([\s\S]*?setTimeout\(revealResult, finishing\.stopMs\)/);
    // 光りは升の色を変えず、揺れるのは光の枠だけにする。
    expect(source).toMatch(/\.shogi-game__board-impact \{[^}]*pointer-events: none/s);
    expect(source).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.shogi-game__board-shell--impact-5 \.shogi-game__board-impact \{\s*animation: shogi-board-impact-fade/);
    // 効果音は見出しのメニューで切り替えられる。
    expect(source).toMatch(/data-sound-toggle\s+@click="toggleSound"/);
  });

  it("records the collection at the end of a CPU game and shows what was gained", () => {
    // 対局中に一度でも組んだ形を控え、終局で記録する。保存はいつも読み直してから書く(盤の部品の解放済みを消さない)。
    expect(source).toMatch(/function observeFormations[\s\S]*?matchFormationNames\.add\(name\)/);
    const record = source.split("function recordCollection(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(record).toMatch(/if \(normalizedMode\.value !== "cpu"\) return;/);
    expect(record).toMatch(/const before = loadCollection\(browserStorage\(\)\);[\s\S]*?saveCollection\(browserStorage\(\), recorded\.state\)/);
    // Lvの壁は、レーティングが動いた対局で勝ったときだけ。
    expect(record).toMatch(/wonLevel: won && ratingChange\.value && level !== undefined \? level : null/);
    expect(source).toMatch(/recordRatedGame\(matchResult\);\s*recordCollection\(outcome === "win"\);/);
    const dialog = source.split('aria-labelledby="match-result-title"')[1]?.split('aria-labelledby="tournament-result-title"')[0] ?? "";
    expect(dialog).toContain("data-collection-result");
    // 強い相手を選ぶ見返りを、強さの選択肢に出す(レーティングの計算は変えない)。
    expect(source).toMatch(/初めて勝つと★/);
  });

  it("starts an endgame from a famous game without loading the game records up front", () => {
    // 代表局の棋譜は重いので、押したときに読み込む(最初に読むJSに入れない)。
    expect(source).not.toMatch(/^import [^;]*endgame-start\.mjs/m);
    expect(source).toMatch(/await import\("\.\/core\/endgame-start\.mjs"\)/);
    expect(source).toMatch(/data-endgame-tile\s+@click="startEndgameMatch"/);
    const start = source.split("async function startEndgameNow(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(start).toMatch(/startPositionMatch\(start\.sfen, start\.playerColor, ENDGAME_START_LABEL\)/);
    // 「もう一局」は、別の名局の終盤を選ぶ。
    expect(source).toMatch(/learningStartLabel\.value === ENDGAME_START_LABEL[\s\S]{0,80}startEndgameNow\(\{ excludeSfen: matchInitialSfen\.value \}\)/);
  });

  it("brings back a struggled problem days later in the problem set", () => {
    const problemSet = readFileSync(new URL("../ShogiProblemSet.vue", import.meta.url), "utf8");
    expect(problemSet).toMatch(/data-review-due[\s\S]*?openProblem\(reviewDueProblem\.id, \{ review: true \}\)/);
    // 解き終えたとき・答えを見たときに、復習の箱へ反映する。
    expect(problemSet).toMatch(/recordProblemSolved\([\s\S]*?recordReview\(problem, firstTry\)/);
    expect(problemSet).toMatch(/function openAnswer\(\)[\s\S]*?recordReview\(currentProblem\.value, false\)/);
  });

  it("lets the player cheer for a ryuo player and predict the group winner", () => {
    // 推しの棋士は名鑑で選び、大会の画面を開くたびに読み直して渡す。
    expect(source).toMatch(/watch\(tournamentOpen, \(open\) => \{[\s\S]*?loadOshi\(browserStorage\(\)\)/);
    expect(source).toMatch(/:oshi="ryuoOshi"/);
    const tournament = readFileSync(new URL("../ShogiTournament.vue", import.meta.url), "utf8");
    expect(tournament).toMatch(/v-if="predictionOptions"[\s\S]*?data-prediction/);
    // 予想の的中は、計算(computed)の中ではなくwatchで一度だけ記録する。
    expect(tournament).toMatch(/watch\(predictionResult, countPredictionHit, \{ immediate: true \}\)/);
    expect(tournament).toMatch(/:mark-id="oshi\?\.id \?\? ''"/);
    const book = readFileSync(new URL("../RyuoRosterBook.vue", import.meta.url), "utf8");
    expect(book).toMatch(/data-oshi-toggle[\s\S]*?@click="toggleOshi\(member\.id\)"/);
    expect(book).toMatch(/member\.catchphrase/);
  });

  it("counts play days only for shogi actions and never pressures the player", () => {
    // 1局指し終えたら数える(すぐ投了した対局は数えない)。開いただけでは数えない。
    expect(source).toMatch(/if \(matchResult\.moveCount >= 2\) savePlayStreak\(browserStorage\(\), recordPlay\(loadPlayStreak\(browserStorage\(\)\)\)\)/);
    expect(source).not.toMatch(/onMounted\([^)]*recordPlay/);
    const problemSet = readFileSync(new URL("../ShogiProblemSet.vue", import.meta.url), "utf8");
    expect(problemSet).toMatch(/recordReview\(problem, firstTry\);[\s\S]{0,80}recordPlay\(loadPlayStreak\(storage\)\)/);
    const tutorial = readFileSync(new URL("../ShogiTutorial.vue", import.meta.url), "utf8");
    expect(tutorial).toMatch(/recordLessonCleared\([\s\S]{0,120}recordPlay\(loadPlayStreak\(storage\)\)/);
    // 「今日やらないと」と急かす言葉は使わない。
    expect(source + problemSet + tutorial).not.toMatch(/今日やらないと|記録が消え|途切れちゃう/);
  });

  it("connects tesuji, review positions, own games and the oshi's season result to the existing features", () => {
    // 手筋は、プレイヤーの手(検討中は除く)から見分け、終局でコレクションに渡す。
    expect(source).toMatch(/actor === "player" && !reviewMode\.value && normalizedMode\.value === "cpu"\) \{\s*for \(const id of detectTesuji\(/);
    expect(source).toMatch(/tesuji: \[\.\.\.matchTesuji\],\s*tesujiNames: TESUJI_NAMES,/);
    // 振り返りで見逃した短い詰みを、問題と復習の箱に入れる。
    expect(source).toMatch(/saveMissedMatesAsProblems\(guidedReviewScript\);/);
    // 終局まで指した平手の対局を残し、終盤戦の候補に加える。
    expect(source).toMatch(/saveRecentGames\(browserStorage\(\), addRecentGame\(/);
    expect(source).toMatch(/pickEndgameStart\(\[\.\.\.endgameSources\(\), \.\.\.ownSources\]/);
    // 推しの棋士の組の順位は、名簿を進める前に控える。
    const finalize = source.split("function finalizeRyuoSeason(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(finalize.indexOf("oshiStandings")).toBeLessThan(finalize.indexOf("applySeasonToRoster"));
    const tournament = readFileSync(new URL("../ShogiTournament.vue", import.meta.url), "utf8");
    expect(tournament).toMatch(/props\.view\?\.result\?\.oshiLine/);
  });

  it("keeps the classroom lessons moving without hunting for buttons", () => {
    const tutorial = readFileSync(new URL("../ShogiTutorial.vue", import.meta.url), "utf8");
    // 説明は画面のどこを押しても進む。「次へ」のボタンは置かない。
    // 盤のマスはクリックを止めるので、キャプチャ段階で受け取り、盤を押しても進む。
    expect(tutorial).toMatch(/data-tutorial-stage @click\.capture="onStageTap"/);
    expect(tutorial).not.toMatch(/>\{\{ stepIndex >= currentLesson\.steps\.length - 1 \? "レッスン完了！" : "次へ" \}\}</);
    // 正解した押下で次まで飛ばないよう、正解の直後と続けての押下は無視する。
    expect(tutorial).toMatch(/now - lastTapAt < TUTORIAL_TAP_GUARD_MS \|\| now - solvedAt < 400/);
    // 選択問題も、正解すると解説を読む時間をとって自動で進む。まちがえた選択肢は押せなくする。
    expect(tutorial).toMatch(/choiceAdvanceDelay\(step\.explanation \?\? ""\)/);
    expect(tutorial).toMatch(/:disabled="stepSolved \|\| wrongChoices\.includes\(Number\(index\)\)"/);
    // 困ったら、ヒントはボタンを押さなくても、しばらくするとそっと出る。
    expect(tutorial).toMatch(/TUTORIAL_IDLE_HINT_MS/);
    expect(tutorial).not.toMatch(/@click="showHint"/);
    // スキップは見出しへ。タイトル画面の「つぎはこれ」からは、本棚を通さずにレッスンを始める。
    expect(tutorial).toMatch(/class="shogi-tutorial__header-skip"/);
    expect(source).toMatch(/homeNext\.value\.id === "tutorial"\) openTutorialLesson\(\)/);
    expect(source).toMatch(/:auto-start="tutorialAutoStart"/);
  });

  it("lays the classroom out as one map and chains short lessons within a chapter", () => {
    const tutorial = readFileSync(new URL("../ShogiTutorial.vue", import.meta.url), "utf8");
    // 本棚と巻の一覧のかわりに、1本の道の地図。マスを押せばすぐ始まる。
    expect(tutorial).toMatch(/v-if="view === 'map'"[\s\S]*?data-tutorial-map/);
    expect(tutorial).not.toMatch(/view === 'shelf'|view === 'volume'/);
    expect(tutorial).toMatch(/@click="onNodeClick\(row\)"/);
    // 同じ章のあいだは、結果の画面を挟まずにクリアの知らせを出して続ける。章の最後だけ章クリアの画面。
    const finish = tutorial.split("function finishLesson()")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(finish).toMatch(/continueAfter\(lesson, stars\)/);
    expect(finish).not.toMatch(/showResult\(/);
    const after = tutorial.split("function continueAfter(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(after).toMatch(/nextLessonInChapter\([\s\S]*?showChapterClear\(lesson\.chapterId\)[\s\S]*?setTimeout\(continueChain, STAGE_CLEAR_MS\)/);
    expect(tutorial).toMatch(/data-stage-clear @click="continueChain"/);
    expect(tutorial).toMatch(/view === 'chapter' && clearedChapter/);
  });
});
