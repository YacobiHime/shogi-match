import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchScreenSource } from "./match-screen-source.mjs";

const source = matchScreenSource();
const responsiveSource = readFileSync(
  new URL("../composables/useResponsiveLayout.ts", import.meta.url),
  "utf8",
);

describe("match screen regressions", () => {
  it("toggles a material balance chip and capture numbers in every match kind", () => {
    expect(source).toMatch(/aria-label="駒の損得を表示"\s*:aria-pressed="materialGuideEnabled"[\s\S]*?@click="toggleMaterialGuide"/);
    expect(source).toMatch(/v-if="materialChip"[\s\S]*?data-material-chip/);
    expect(source).toMatch(/const materialChip = computed\(\(\) => \{\s*if \(!materialGuideEnabled\.value[\s\S]*?aiMaterialTotals\(currentSfen\.value\)/);
    // 学習対局ではいつも、ほかの対局では付けているときに、取ったマスへ数字を浮かべる。
    expect(source).toMatch(/\(matchKind\.value !== "learning" && !materialGuideEnabled\.value\)/);
  });
  it("lets the player enter a name next to the notebook band and shows it on the board and in the Ryuo season", () => {
    expect(source).toMatch(/<div class="shogi-title__record-row">[\s\S]*?data-player-name\s*@click="openNameDialog"[\s\S]*?class="shogi-title__record" @click="yakobiNoteOpen = true"/);
    expect(source).toMatch(/v-if="nameDialogOpen"[\s\S]*?@submit\.prevent="acceptPlayerName"[\s\S]*?data-player-name-save>この名前にする</);
    // CPUとの対局では、プレイヤーの側の名札に名前を出す。対局準備と竜王戦の新しい期にも使う。
    // タイトル戦の防衛戦では、名前に肩書を足す(docs/match-stage-design.md)。名前を入れていなければ先手・後手の表示名。
    expect(source).toMatch(/const stageUserName = computed\(\(\) => \{[\s\S]*?: playerName\.value;/);
    expect(source).toMatch(/cpuColor\.value === Color\.WHITE && stageUserName\.value \? stageUserName\.value : props\.blackPlayerName/);
    expect(source).toMatch(/userName: playerDisplayName\(playerName\.value\)/);
    // 重ねて開く札は、ブラウザの戻る操作で閉じる。
    expect(source).toMatch(/else if \(nameDialogOpen\.value\) \{\s*nameDialogOpen\.value = false;/);
    expect(source).toMatch(/canGoBack: [^\n]*nameDialogOpen\.value/);
  });
  it("shows a measuring card with one forward-only bar while the measurement is analyzed", () => {
    // 結果は少し遅れて出るので、測定中だと分かる札を盤の上に出す。閉じても状態表示の細い棒は残る。
    expect(source).toMatch(/v-if="measureAnalyzing && !measureWaitHidden"[\s\S]*?data-measure-wait[\s\S]*?role="progressbar"[\s\S]*?data-measure-wait-hide @click="measureWaitHidden = true">盤を見ながら待つ</);
    expect(source).toMatch(/MEASURE_STAGE_SPANS[^=]*= \{ scan: \[0, 60\], review: \[60, 85\], focus: \[85, 100\] \}/);
    expect(source).toMatch(/if \(measuring\) \{\s*measureWaitHidden\.value = false;\s*measureAnalyzing\.value = true;/);
  });
  it("offers another measuring game with the carried moves when too few moves were measured", () => {
    // 力の差で早く形勢が決まると測れる手が足りない。相手を近づけてもう1局、手は持ち越す(docs/skill-measure-design.md)。
    expect(source).toMatch(/v-if="skillDiagnosis\.insufficient && measureNext"[\s\S]*?data-measure-continue @click="continueMeasure">もう1局指す（Lv\.\{\{ measureNext\.level \}\}）</);
    expect(source).toMatch(/estimateSkill\(analysisPoints\.value, [^;]*carried\)/);
    expect(source).toMatch(/function continueMeasure\(\) \{[\s\S]*?measurableMoves\(analysisPoints\.value, color\)[\s\S]*?startMeasureMatchNow\(\{ level: next\.level, carry \}\)/);
    // 対局準備・ホームへ戻ると、持ち越した手は捨てる。
    expect(source).toMatch(/measureAnalyzing\.value = false;\s*measureCarry\.value = null;/);
  });
  it("keeps sheet close buttons still under the finger (no transform centering, 44px target)", () => {
    // ボタン共通の触れたとき・押したときのtransformが、真ん中寄せのtranslateY(-50%)を上書きして×が逃げていた。
    const sheets = [
      ["../PregamePicker.vue", "pregame-picker__close"],
      ["../OpeningPlanSheet.vue", "plan-sheet__close"],
      ["../ShogiOpeningDex.vue", "shogi-dex__fortune-close"],
    ];
    for (const [file, className] of sheets) {
      const css = readFileSync(new URL(file, import.meta.url), "utf8");
      const rule = css.match(new RegExp(`\\.${className}[^{]*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule, className).toContain("bottom: 0;");
      expect(rule, className).toContain("44px");
      expect(rule, className).not.toMatch(/transform/);
    }
  });
  it("uses the aware selector in match and review, and falls back to Lv10 without bypassing opening restrictions", () => {
    expect(source).toContain('import { chooseAwareMove } from "./core/aware-move-choice.mjs"');
    expect(source).toContain('selectionStrength.logicHybrid ? chooseAwareMove : chooseCpuMove');
    expect(source).toMatch(/strength\.logicHybrid[\s\S]*?await chooseAwareMove\([\s\S]*?chooseLogicMove\([\s\S]*?level: 10/);
    expect(source).toMatch(/!logicLevel && !selectionStrength\.logicHybrid[\s\S]*?allowedOpeningMove/);
    expect(source).toMatch(/chooseAwareMove : chooseCpuMove\)\(\{[\s\S]*?legalMoves: allowedCpuMoveList[\s\S]*?planMove: allowedOpeningMove/);
    expect(source).toMatch(/const hybridFallback[\s\S]*?cpuMovesAllowedByBishopSetting\(\)[\s\S]*?chooseLogicMove\([\s\S]*?legalMoves: fallbackAllowed/);
  });
  it("passes only the SFEN to the engine because setPosition adds \"position sfen\"", () => {
    // 「sfen sfen ...」になるとエンジンがbestmoveを返さず、平手以外の対局でCPUが止まる。
    expect(source).not.toMatch(/`sfen \$\{/);
    expect(source).toContain('const base = matchInitialSfen.value === STANDARD_SFEN ? "startpos" : matchInitialSfen.value;');
  });

  it("keeps display tools next to hints and collapses them without shrinking buttons", () => {
    // 頻繁に使う反転を操作列へ。幅が足りないときは3つを同じ折り畳みで開く。
    const displayTools = source.split('data-display-tools')[1]?.split('</details>')[0] ?? "";
    expect(displayTools).toContain('data-assist-flip');
    expect(displayTools).toContain('class="shogi-game__assist-toggle shogi-game__command--attack"');
    expect(displayTools).toContain('data-material-toggle');
    expect(source).toContain(':open="!assistToolsCollapsed || assistToolsOpen"');
    expect(source).toContain('@keydown.esc.stop.prevent="closeAssistTools(true)"');
    // 見出しのメニューにも同じ反転状態を残す。
    const menu = source.split('class="shogi-game__menu" role="menu"')[1]?.split("</header>")[0] ?? "";
    expect(menu).toMatch(/role="menuitemcheckbox"[\s\S]*?aria-label="盤面を上下反転（ひふみんアイ）"[\s\S]*?@click="boardFlipOverride = !boardFlipOverride"/);
    expect(menu).not.toMatch(/v-if="menuCollapsed"[^>]*>\s*<button[^>]*aria-label="盤面を上下反転/);
    // 狭い画面でもはみ出さないよう、操作列のボタンは区切り（<wbr>や空白）でだけ2行に折り返す。
    expect(source).toMatch(/\.shogi-game__assist-actions > button,[^{]*\{[^}]*word-break:\s*keep-all/s);
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
    expect(source).toContain("confirmDiscardSuspended(() => startMeasureMatchNow())");
    expect(source).toContain("confirmDiscardSuspended(() => startMatchFromTutorialNow(request))");
    // ブラウザの戻る操作で、確認ダイアログも閉じられる。
    expect(source).toMatch(/function navigateBack\(\)[\s\S]*?discardSuspendedPending[\s\S]*?suspendConfirmOpen/);
    // 竜王戦の対局を中断したら、竜王戦の画面の次の一局の枠からも再開できる(同じ相手のときだけ)。
    expect(source).toMatch(/ryuoOpponentId: ryuoGame\.value\?\.opponentId \?\? null/);
    expect(source).toMatch(/suspended\.ryuoOpponentId === pending\.opponentId/);
    expect(source).toMatch(/function resumeRyuoGame\(\)[\s\S]*?tournamentOpen\.value = false;[\s\S]*?resumeSuspendedMatch\(\);/);
    expect(source).toMatch(/:suspended-moves="suspendedRyuoMoves"[\s\S]*?@resume="resumeRyuoGame"/);
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
    expect(source).toMatch(/matchKind\.value === "tournament"\) return assistAllowance\(Number\(tournamentSeasonOf\(ryuoGame\.value\)\?\.settings\?\.hintLimit/);
    // 竜王戦の対局も、自由対局と同じくレーティングとやこびノートに数え、棋戦・相手・段階を残す。千日手は指し直した対局だけを数える。
    expect(source).toMatch(/const rated = \(matchKind\.value === "normal" \|\| tournament\)/);
    expect(source).toMatch(/event: tournament \? \(ryuoGame\.value\?\.event === "meijin" \? "meijin" : "ryuo"\) : "free"/);
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
    // 対局から戻ったときは、竜王への道で前の段から登る動きを見せる(fromGame)。
    expect(source).toMatch(/if \(backToTournament\) \{\s*tournamentStartAt\.value = backEvent === "meijin" \? "meijin" : "season";\s*tournamentFromGame\.value = true;\s*tournamentOpen\.value = true;/);
    // 名人戦の対局も同じ道を通る(大会の対局のevent: "meijin")。終えたら名人戦の画面へ。
    expect(source).toMatch(/const backEvent = ryuoGame\.value\?\.event;\s*stopGuidedReview\(\);\s*openPregame\(\);/);
    expect(source).toMatch(/function recordRyuoOutcome\(matchResult: MatchResult\) \{\s*if \(ryuoGame\.value\?\.event === "meijin"\) \{\s*recordMeijinOutcome\(matchResult\);/);
    expect(source).toMatch(/ryuoGame\.value = \{ opponentId: pending\.opponentId, label: pending\.label \?\? "", event: "meijin" \};\s*startRyuoMatch\(\);/);
    expect(source).toMatch(/:from-game="tournamentFromGame"/);
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
    // 竜王戦と名人戦は、同じタイトル戦の枠に同格のタイルで並べる。
    const titleChoices = tournament.match(/<div[^>]* data-title-tournaments>([\s\S]*?)<\/div>/)?.[1] ?? "";
    expect(titleChoices.match(/class="shogi-title__tile" data-tournament="(?:ryuo|meijin)"/g)).toHaveLength(2);
    expect(tournament).not.toMatch(/class="shogi-title__next" data-tournament=/);
    expect(tournament).toMatch(/shogi-tournament-home \.shogi-tournament__soon-tiles \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
    // 説明・エントリーの一言・次の対局・結果の解説は、やこび姫のセリフにする。
    // 大きなやこび姫の解説役(xl)は、竜王戦の説明のシートと、結果の解説の2人だけ。次の一局では1行の手がかりにする。
    expect(tournament.match(/<YakobiSays[^>]*size="xl"/g)?.length).toBe(2);
    expect(tournament).toMatch(/data-tip data-coach-more @click="sheet = 'coach'">[\s\S]*?\{\{ tipLine \}\}/);
    // エントリーの設定を選ぶと、やこび姫がその設定について話す(選択シートで選んだとき)。
    expect(tournament).toMatch(/difficulty\.value = Number\(value\); talkTopic\.value = "difficulty";/);
    for (const helper of ["ryuoGuideLines", "entryDifficultyLine", "opponentLines", "resultLines", "seasonPhaseLines"]) {
      expect(tournament).toContain(helper);
    }
  });

  it("opens the Ryuo season with one goal and shows what the next game is for", () => {
    const tournament = readFileSync(new URL("../ShogiTournament.vue", import.meta.url), "utf8");
    // 入口は1画面・1ボタン。目標の1行と、設定の要約。説明は「竜王戦ってなに？」で開く(docs/ryuo-ux-redesign.mdの4-1)。
    expect(tournament).toMatch(/data-entry-goal>\{\{ entryGoal \}\}/);
    expect(tournament).toMatch(/v-if="settingsOpen" class="shogi-tournament__settings"/);
    expect(tournament).toMatch(/v-if="guideOpen"[^>]*role="dialog"/);
    // 次の一局: 勝てば・負ければと、山場の札(4-2)。期の画面はドット絵の山の地図と下の枠(docs/ryuo-ui-renewal-design.mdの5-2)。
    // 表は「表」で重ねて開く。
    expect(tournament).toMatch(/data-stakes-win>\{\{ view\.pending\.stakes\.win \}\}/);
    expect(tournament).toMatch(/data-stakes-lose>\{\{ view\.pending\.stakes\.lose \}\}/);
    expect(tournament).toMatch(/shogi-tournament__hud--boss': view\.pending\.stakes\?\.boss/);
    expect(tournament).toMatch(/<RyuoMountain[\s\S]*?@open-opponent="sheet = 'opponent'"/);
    expect(tournament).not.toMatch(/data-pane=|pane-tabs/);
    // トーナメント表と相手の能力は、奥に隠さない。表は地図と並ぶタブ(広い画面では横にいつも)、能力は次の一局の枠にいつも出す。
    expect(tournament).toMatch(/role="tablist" aria-label="地図と表の切り替え"[\s\S]*?data-table-open @click="tableOpen = true">トーナメント表</);
    expect(tournament).toMatch(/\.shogi-tournament__stage > \.shogi-tournament__tables \{\s*grid-area: map;/);
    expect(tournament).toMatch(/grid-template-areas: "top top" "map hud" "table hud";/);
    expect(tournament).toMatch(/:wide="pcWide"/);
    expect(tournament).toMatch(/data-hud-ability\s*@click="sheet = 'opponent'"[\s\S]*?<RadarChart class="shogi-tournament__mini-radar"/);
    expect(tournament).toMatch(/data-pending[\s\S]*?opponentAbility\.specials\.slice\(0, 3\)[\s\S]*?data-tournament-play/);
    // 重ねて開いたものは、ブラウザの戻る操作で先に閉じる。
    expect(tournament).toMatch(/function goBack\(\) \{[\s\S]*?if \(sheet\.value\) sheet\.value = "";\s*else if \(resultDetailOpen\.value\)[\s\S]*?else if \(tableOpen\.value\) tableOpen\.value = false;/);
    // 入口と結果も、ドット絵の山の地図の画面(段階C)。入口はカメラが頂上から降りる。
    expect(tournament).toMatch(/<RyuoMountain :road="entryMapRoad" :asset-base-url="assetBaseUrl" intro/);
    expect(tournament).toMatch(/data-result-screen>[\s\S]*?<RyuoMountain v-if="view\.road"/);
    // ボタンは短い動詞(U:3-2)。結果の画面の主役は「次の期へ」。
    expect(tournament).toMatch(/data-tournament-play @click="versusOpen = true">\{\{ playText \}\}</);
    // 中断したこの対局があれば、「対局する」の代わりに「対局を再開」(VS画面を通さない)。
    expect(tournament).toMatch(/v-if="suspendedMoves !== null"[^>]*data-tournament-resume @click="emit\('resume'\)"/);
    // 番勝負では「第3局を指す」(docs/ryuo-stages-design.mdの4章)。
    expect(tournament).toMatch(/pending && pending\.kind !== "game" \? `第\$\{pending\.gameNo\}局を指す` : "対局する"/);
    // 期の画面は3つの段階(① 組・② 決勝トーナメント・③ 番勝負)。上の帯は1本で、段階の道のりを押すと、その段階の表を見る。
    expect(tournament).toMatch(/<header v-if="screen !== 'season' && screen !== 'meijin'" class="shogi-dex__header">/);
    // 名人戦は大会の選択の札から入り、大会の画面の中に出す(docs/meijin-design.md)。
    expect(tournament).toMatch(/data-tournament="meijin" @click="chooseMeijin"/);
    expect(tournament).toMatch(/<ShogiMeijin\s+v-if="screen === 'meijin'"/);
    // 名人戦の3つの画面は、どれも同じ上の帯の左上に、行き先を書いた戻るを置く。入口は大会の選択へ、期の画面と結果は入口(五重塔)へ。
    // 大会の選択から選んだら入口から。対局から戻ったときだけ、期の画面を直接開く。
    const meijin = readFileSync(new URL("../ShogiMeijin.vue", import.meta.url), "utf8");
    expect(meijin.match(/<header class="shogi-tournament__topbar meijin__topbar">/g)).toHaveLength(3);
    expect(meijin).toMatch(/const backLabel = computed\(\(\) => \(screen\.value === "entry" \? "大会の選択へ" : "五重塔へ"\)\);/);
    expect(meijin).toMatch(/function topBack\(\) \{\s*if \(screen\.value === "entry"\) \{\s*emit\("back"\);[\s\S]*?screen\.value = "entry";/);
    expect(meijin).toMatch(/props\.openSeason && props\.view && !props\.view\.result \? "season" : "entry"/);
    expect(tournament).toMatch(/const meijinFromGame = ref\(props\.fromGame && props\.startAt === "meijin"\);/);
    expect(tournament).toMatch(/function chooseMeijin\(\) \{\s*meijinFromGame\.value = false;/);
    expect(tournament).toMatch(/data-stage-steps[\s\S]*?@click="showStage\(index\)"/);
    expect(tournament).toMatch(/<RyuoBracket\s+v-if="viewStageIndex === 0[\s\S]*?<RyuoBracket\s+v-if="viewStageIndex === 1[\s\S]*?<RyuoSeries\s+v-if="viewStageIndex === 2"/);
    // 「対局する」のあとは、VS画面(段階B)を出してから対局を始める。押せばすぐ始まる。
    expect(tournament).toMatch(/<RyuoVersus[\s\S]*?@done="startPlay"/);
    expect(tournament).toMatch(/function startPlay\(\) \{\s*versusOpen\.value = false;\s*emit\("play"\);/);
    // 期の結果の主役は「表彰式へ」。賞状(縦書き・判子)をわたし、閉じると期を見終えて大会の選択へ(docs/season-award-design.md)。
    expect(tournament).toMatch(/data-award-open @click="openCeremony\(`ryuo-\$\{seasonNo\}`\)">表彰式へ</);
    expect(tournament).toMatch(/@ceremony="openCeremony\(`meijin-\$\{meijinView\?\.no \?\? 0\}`\)"/);
    expect(tournament).toMatch(/:button-text="awardCeremony \? '大会の選択へ' : '閉じる'"/);
    expect(tournament).toMatch(/function finishCeremony\(\) \{\s*if \(screen\.value === "meijin"\) \{\s*emit\("meijin-result-seen"\);\s*screen\.value = "select";[\s\S]*?backToSelect\(\);/);
    expect(tournament).toMatch(/function goBack\(\) \{\s*if \(awardShown\.value\) \{/);
    expect(tournament).toMatch(/data-award-book @click="bookOpen = true"/);
    // 賞状は期が終わったときに対局画面が足す(竜王戦・名人戦とも)。
    expect(source).toMatch(/saveCareer\(browserStorage\(\), career\);\s*awardRyuoSeason\(season\);/);
    expect(source).toMatch(/saveMeijinCareer\(browserStorage\(\), meijinCareer\.value\);\s*awardMeijinSeason\(next\);/);
    expect(source).toContain('{{ tournamentResult.done ? "結果を見る" : tournamentResult.back }}');
    expect(source).toMatch(/back: "竜王戦へ戻る"/);
    expect(source).toMatch(/back: "名人戦へ戻る"/);
    // 節目の判子(段階3): 対局から戻ったときだけ出し、押すと閉じる。判子の音を鳴らすときは、登る音を鳴らさない。
    expect(tournament).toMatch(/const milestoneOpen = ref\(props\.fromGame && Boolean\(props\.view\?\.milestone\)/);
    expect(tournament).toMatch(/data-milestone\s*@click="milestoneOpen = false"/);
    expect(tournament).toMatch(/:muted="Boolean\(celebration\)"/);
    expect(tournament).toMatch(/soundPlayer\.play\("stamp"\)/);
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
    // 戦法占いで出た作戦は解放に加え、定跡図鑑の占いの結果から対局準備へ進める。
    expect(source).toMatch(/@fortune-result="onFortuneResult"/);
    expect(source).toMatch(/extraIds: \[\.\.\.fortunePlanIds\.value,/);
    expect(source).toMatch(/@play-plan="playPlanFromDex"/);
    // 戻る操作で作戦カードのシートを閉じる。
    expect(source).toMatch(/else if \(planSheet\.value\) \{\s*closePlanSheet\(\);/);
    // 対局準備のCPUの作戦も「項目: 値 [変更]」の1行で、作戦カードのシート(大まかな方針と全部のカード)で選ぶ。
    expect(source).toMatch(/id: "cpuPlan",\s*label: "作戦"/);
    expect(source).toMatch(/if \(id === "cpuPlan"\) openPlanSheet\("cpu"\)/);
    expect(source).toMatch(/:mode="planSheet === 'cpu' \? 'cpu' : 'player'"[\s\S]*?@broad="chooseCpuBroadPlan"/);
    expect(source).toMatch(/class="shogi-game__pregame-change"\s+:disabled="row\.disabled"/);
  });

  it("puts the next challenge first on the result screen and keeps the retry suggestion optional", () => {
    // リトライは迅速に: 通常の対局の結果では「もう一局」が「対局を振り返る」より手前にある。
    const dialog = source.split('aria-labelledby="match-result-title"')[1]?.split('aria-labelledby="tournament-result-title"')[0] ?? "";
    expect(dialog.indexOf("data-rematch")).toBeGreaterThan(-1);
    expect(dialog.indexOf("data-rematch")).toBeLessThan(dialog.indexOf("対局を振り返る"));
    // 連敗の提案は、挑戦を続ける道を先頭に並べ、強さは自動では変えない。
    expect(dialog).toMatch(/data-retry-suggestion[\s\S]*?もう一度挑む[\s\S]*?で腕ならし[\s\S]*?rematch\(\{ handicapId: resultRetrySuggestion\.handicapId \}\)">\{\{ resultRetrySuggestion\.handicapLabel \}\}で挑む/);
    expect(source).not.toMatch(/resultRetrySuggestion[^\n]*searchNodes\.value\s*=/);
    // 次の級・段までの残りを、対局直後に見せる。
    expect(dialog).toContain("data-next-goal");
    // 「もう一局」は対局準備を開かずに始める。
    const rematch = source.split("function rematch(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(rematch).toMatch(/openPregame\(\);[\s\S]*?beginMatch\(\)/);
    expect(rematch).not.toMatch(/pregameOpen\.value = true/);
  });

  it("lets the player toggle the attack map in every match kind", () => {
    // 駒の利きは、学習対局だけでなく、通常対局・竜王戦でも付け外しできる。始めるときに勝手に消さない。
    expect(source).toMatch(/<button\s+type="button"\s+class="shogi-game__assist-toggle shogi-game__command--attack"/);
    expect(source).toMatch(/const attackGuideVisible = computed\(\(\) => \(\s*attackGuideEnabled\.value && matchStarted\.value && !pregameOpen\.value/);
    expect(source).toMatch(/const boardAttackMarks = computed\(\(\) => \(\s*attackGuideVisible\.value \? attackMap/);
    expect(source).not.toMatch(/matchKind\.value === "learning" && attackGuideEnabled/);
    expect(source).not.toMatch(/attackGuideEnabled\.value = false/);
    expect(source).toMatch(/attackGuideEnabled\.value = learning\.attackGuide === true;/);
  });

  it("analyzes finished free games in the background and offers practice from their content", () => {
    // 自由対局だけを、終局後に裏の解析の列へ足す(竜王戦は大会の統計で解析する)。対局中は解析を止める。
    const rated = source.split("function recordRatedGame(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(rated).toMatch(/if \(!tournament\) \{[\s\S]*?enqueuePlayInsight\([\s\S]*?playInsightAnalysis\.processQueue\(\)/);
    expect(source).toMatch(/usePlayInsightAnalysis\(\{[\s\S]*?paused: \(\) => active\.value/);
    expect(source).toMatch(/playInsightAnalysis\.dispose\(\)/);
    // 見立ては中身の記録と復習の箱も見る。練習は「つぎはこれ」から始め、始めたことを記録する。
    expect(source).toMatch(/recommendPlay\(ratingState\.value, \{\s*insight: playInsight\.value,/);
    expect(source).toMatch(/if \(plan\.practice\) return \{ id: "practice"/);
    const practice = source.split("function startPractice(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(practice).toMatch(/recordPractice\(/);
    expect(practice).toMatch(/problemSetOpen\.value = true/);
    expect(practice).toMatch(/startEndgameNow\(\{ ownOnly: true \}\)/);
    expect(practice).toMatch(/startQuickMatch\(\{ attackGuide: true \}\)/);
    expect(practice).toMatch(/openPlanSheet\("pregame"\)/);
    expect(source).toMatch(/:start-problem-id="problemSetStart\?\.id \?\? ''"/);
  });

  it("starts the home recommendation without the setup screen and decides colors by furigoma", () => {
    const homeNext = source.split("function startHomeNext()")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(homeNext).toContain("startQuickMatch()");
    const quick = source.split("function startQuickMatch(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    // 強さは、実力と実績の見立て(play-coach)で決める。香落ちの立て直しは振り駒をしない。
    expect(quick).toMatch(/options\.level \?\? playPlan\.value\.level/);
    expect(quick).toMatch(/if \(options\.handicapId\) \{[\s\S]*?learningHandicapGiver\.value = "cpu";\s*beginMatch\(\);\s*return;/);
    expect(source).toMatch(/default:[\s\S]{0,1500}?return \{ id: "match", label: plan\.title, description: plan\.reason, handicapLevel: plan\.handicapLevel, handicapId: plan\.handicapId \?\? null \}/);
    // 竜王戦の期の途中は、次の相手の対策か続き。主役でない方を小さな入口にする(docs/home-next-adaptive-design.mdの13章)。
    expect(source).toMatch(/const ryuo = homeRyuoPlan\.value;[\s\S]*?id: "ryuo-counter"[\s\S]*?sub: \{ id: "ryuo-season"[\s\S]*?id: "ryuo-season"[\s\S]*?sub: \{ id: "ryuo-counter"/);
    expect(source).toMatch(/v-if="homeNext\.sub"[\s\S]*?:data-next-sub="homeNext\.sub\.id"[\s\S]*?@click="startHomeNextSub"/);
    expect(homeNext).toContain('homeNext.value.id === "ryuo-counter") startRyuoCounter()');
    // 対策は学習対局(レーティングにも竜王戦にも数えない)で、相手の棋風と得意戦法、本番と同じ手番。終局後は「本番へ」。
    const counter = source.split("function startRyuoCounter()")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(counter).toMatch(/confirmDiscardSuspended[\s\S]*?matchKind\.value = "learning";[\s\S]*?selectedPlayerColor\.value = color;[\s\S]*?counterStyle\([\s\S]*?beginMatch\(\);/);
    expect(source).toMatch(/ryuoGame\.value \? ryuoOpponent\.value\?\.character \?\? null : ryuoCounterOpponent\.value\?\.character \?\? null/);
    expect(source).toMatch(/v-if="ryuoCounter && !tutorialMatch && !measureSession"[\s\S]*?data-counter-go @click="goToRyuoFromCounter"/);
    // 段階2(14章): 苦手な戦型の練習は、その戦法を指すCPUとの学習対局。練習で変えたCPUの設定は、離れたら戻す。
    expect(source).toMatch(/practice\.kind === "matchup"[\s\S]*?startMatchupPractice\(/);
    const matchup = source.split("function startMatchupPractice(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(matchup).toMatch(/settingsBeforePractice = captureMatchSettings\(\);[\s\S]*?matchKind\.value = "learning";[\s\S]*?cpuRookPreference\.value = rook;[\s\S]*?beginMatch\(\);/);
    expect(counter).toMatch(/settingsBeforePractice = captureMatchSettings\(\);/);
    expect(source).toMatch(/if \(settingsBeforePractice\) restoreMatchSettings\(settingsBeforePractice\);\s*settingsBeforePractice = null;/);
    // 段階3(15章): ふだんの対局の場面だけ、まだ見ていない遊びと「今日の1局」。図鑑や終盤戦を開いたら見たことを残す。
    expect(source).toMatch(/if \(plan\.kind === "normal"\) \{[\s\S]*?homeDiscovery\.value;[\s\S]*?id: "discover"[\s\S]*?todayPlan\(/);
    expect(source).toMatch(/watch\(dexOpen, \(open\) => \{ if \(open\) noteFeatureSeen\("opening-dex"\); \}\)/);
    expect(source).toMatch(/function startEndgameMatch\(\) \{\s*noteFeatureSeen\("endgame"\);/);
    expect(homeNext).toContain('homeNext.value.id === "discover" && homeDiscovery.value) openDiscovery(');
    // 竜王戦の統計の裏の解析から、対局の中身の要約も足す(二度読まない)。
    expect(source).toMatch(/useRyuoStatsAnalysis\(\{[\s\S]*?storage: browserStorage,[\s\S]*?onInsight:/);
    // 勝ったら次のLvへ(同じ相手ともう一局は小さく残す)。
    expect(source).toMatch(/v-else-if="!tutorialMatch && !measureSession && resultNextStep"[\s\S]*?data-next-step-go[\s\S]*?data-next-step-same/);
    expect(quick).toMatch(/throwFurigoma\(\)[\s\S]*?beginMatch\(\);[\s\S]*?showFurigoma/);
    // 振り駒の知らせは盤の操作を妨げない。
    expect(source).toMatch(/\.shogi-game__furigoma \{[^}]*pointer-events: none/s);
    // 振る音のあいだ揺らし、撒く音の位置で結果を見せる。押すか指すと飛ばす。音を消していれば振らない。
    const show = source.split("function showFurigoma(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(show).toMatch(/moveSounds\.play\("furigoma"\)[\s\S]*?setTimeout\(\(\) => landFurigoma\(\), FURIGOMA_LAND_AT\)/);
    expect(show).toMatch(/phase: shaking \? "shake" : "land"/);
    const land = source.split("function landFurigoma(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(land).toMatch(/if \(skipped\) \{\s*stopFurigomaShake\(\);\s*moveSounds\.play\("furigoma-land"\)/);
    expect(source).toMatch(/@click="landFurigoma\(\{ skipped: true \}\)"/);
    expect(source).toMatch(/watch\(moveCount, \(ply\) => \{\s*if \(ply > furigomaStartPly\) landFurigoma\(\{ skipped: true \}\)/);
  });

  it("lets a lost game be replayed from the position before the losing move", () => {
    expect(source).toMatch(/data-retry-from-losing[\s\S]*?@click="retryFromPly\(guidedRetryPly\)"/);
    const retry = source.split("function retryFromPly(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(retry).toContain("startPositionMatch(sfen, playerColor, RETRY_START_LABEL)");
    // 局面からの対局は平手の初期局面ではないので、レーティングの対象にならない。
    expect(source).toMatch(/&& matchInitialSfen\.value === STANDARD_SFEN[\s\S]{0,120}?&& isRatedLevel\(level\)/);
  });

  it("stops only what happens next for heavy moments, and the board can always cut the stop short", () => {
    // 止めるのはCPUの応手と結果画面の開始だけ。盤を触ると止めを打ち切る。
    expect(source).toMatch(/await waitForImpactHold\(\);\s*if \(generation !== matchGeneration\) return;\s*if \(applyMove\(usi, "cpu"\)/);
    expect(source).toMatch(/class="shogi-game__board-shell"[\s\S]*?@pointerdown\.capture="onBoardShellPointerDown"/);
    expect(source).toMatch(/function onBoardShellPointerDown\(\) \{\s*releaseImpactHold\(\);/);
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
    expect(tournament).toMatch(/v-else-if="sheet === 'predict' && predictionOptions"[\s\S]*?data-prediction/);
    // 予想の的中は、計算(computed)の中ではなくwatchで一度だけ記録する。
    expect(tournament).toMatch(/watch\(predictionResult, countPredictionHit, \{ immediate: true \}\)/);
    expect(tournament).toMatch(/:oshi-id="oshi\?\.id \?\? ''"/);
    const book = readFileSync(new URL("../RyuoRosterBook.vue", import.meta.url), "utf8");
    expect(book).toMatch(/data-oshi-toggle[\s\S]*?@click="toggleOshi\(member\.id\)"/);
    // 名鑑は、顔の判子と肩書きの一覧から、くわしい情報を重ねて開く(個性の一言はくわしい情報に)。
    expect(book).toMatch(/selected\.catchphrase/);
    expect(book).toMatch(/data-book-member[\s\S]*?@click="openMember\(row\.id\)"/);
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
    // はじめて開いたときだけ、地図の前に「どのくらい知ってる？」の札を出す(設計17章)。
    expect(tutorial).toMatch(/v-if="view === 'map' && placementOpen"[\s\S]*?data-tutorial-placement/);
    expect(tutorial).toMatch(/v-if="view === 'map' && !placementOpen"[\s\S]*?data-tutorial-map/);
    expect(tutorial).not.toMatch(/view === 'shelf'|view === 'volume'/);
    expect(tutorial).toMatch(/@click="onNodeClick\(row\)"/);
    // 同じ章のあいだは、結果の画面を挟まずにクリアの知らせを出して続ける。章の最後だけ章クリアの画面。
    const finish = tutorial.split("function finishLesson()")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(finish).toMatch(/if \(maybeOfferReview\(lesson, stars\)\) return;\s*continueAfter\(lesson, stars\)/);
    // 腕だめしの飛び級は、★を記録したあと、復習のすすめより先に決める(設計20章)。
    expect(finish).toMatch(/recordLessonCleared\([\s\S]*?if \(lesson\.boss && finishSkipAhead\(lesson, stars\)\) return;\s*if \(maybeOfferReview/);
    // 先の腕だめしは鍵をかけず、押せば始まる(onNodeClickが止めるのは鍵のマスだけ)。
    expect(tutorial).toMatch(/if \(row\.state === "locked"\) \{/);
    expect(finish).not.toMatch(/showResult\(/);
    const after = tutorial.split("function continueAfter(")[1]?.split(/\r?\n\}\r?\n/)[0] ?? "";
    expect(after).toMatch(/nextLessonInChapter\([\s\S]*?showChapterClear\(lesson\.chapterId\)[\s\S]*?setTimeout\(continueChain, STAGE_CLEAR_MS\)/);
    expect(tutorial).toMatch(/data-stage-clear @click="continueChain"/);
    expect(tutorial).toMatch(/view === 'chapter' && clearedChapter/);
  });

  it('はじめての案内の4つの札から、教室の1問か、1級くらいとの棋力測定、測ったあと竜王戦へ(docs/first-play-design.md)', () => {
    // 背景や戻るで案内を回答済みにしない。進むのは明示的に選んだときだけ。
    const welcomeDialog = source.split('v-if="welcomeOpen && homeOpen"')[1]?.split('<!--')[0] ?? "";
    expect(welcomeDialog).not.toMatch(/@click\.self=/);
    expect(welcomeDialog).toContain('@click="chooseWelcome(choice.id)"');
    expect(welcomeDialog).toContain('@click="dismissWelcome">自分で選ぶ');
    expect(source).toMatch(/if \(welcomeOpen\.value && homeOpen\.value\) \{\s*(?:\/\/[^\n]*\n\s*)?return;/);

    expect(source).toMatch(/if \(choice === "beginner" \|\| choice === "rules"\) openTutorialLesson\(\);/);
    expect(source).toMatch(/choice === "some" \|\| choice === "player"[\s\S]{0,120}?startMeasureMatchNow\(\{ level: WELCOME_MEASURE_LEVEL, welcome: choice \}\)/);
    // 続けて測るときは、案内の答えを引き継ぐ。対局準備へ戻ると捨てる。
    expect(source).toMatch(/measureWelcome\.value = options\.welcome \?\? \(options\.carry \? measureWelcome\.value : ""\);/);
    expect(source).toMatch(/measureSession\.value = false;\s*measureWelcome\.value = "";/);
    // 測れたら、そのままレーティングにする。
    expect(source).toMatch(/watch\(skillDiagnosis, \(diagnosis\) => \{[\s\S]{0,200}?applySkillDiagnosis\(\);/);
    // よく指している人は「竜王戦に出る」が主ボタン、少し指せる人は「ホームへ」が主ボタン。
    expect(source).toMatch(/'shogi-game__rematch--primary': measureWelcome === 'player'[\s\S]{0,80}?data-measure-tournament[\s\S]{0,80}?竜王戦に出る/);
    expect(source).toMatch(/'shogi-game__rematch--primary': measureWelcome === 'some'[\s\S]{0,80}?data-measure-home/);
    expect(source).toMatch(/function enterTournamentFromMeasure\(\) \{[\s\S]{0,120}?tournamentStartAt\.value = "ryuo";/);
  });

  it('「つぎはこれ」の弱点の練習は教室の章・問題集の5問へ、大会への誘いは入口へ(docs/first-play-design.mdの6章)', () => {
    expect(source).toMatch(/tutorialLessons: homeTutorialProgress\.value\.lessons,/);
    expect(source).toMatch(/recordPractice\(loadPlayInsight\(browserStorage\(\)\), \{ kind: practice\.kind, games: ratingState\.value\.games, via: practice\.via \}\)/);
    expect(source).toMatch(/practice\.via === "tutorial" && practice\.chapterId\)[\s\S]{0,200}?tutorialStartChapter\.value = \{[\s\S]{0,120}?tutorialOpen\.value = true;/);
    expect(source).toMatch(/practice\.via === "problems" && practice\.drill\)[\s\S]{0,120}?problemSetDrill\.value = practice\.drill;[\s\S]{0,60}?problemSetOpen\.value = true;/);
    expect(source).toMatch(/:start-chapter="tutorialStartChapter"/);
    expect(source).toMatch(/:drill="problemSetDrill"/);
    // 誘いは強くなる道の段より先(中断した対局と、竜王戦の期の途中の次)。
    expect(source).toMatch(/const ryuo = homeRyuoPlan\.value;[\s\S]{0,1000}?const invite = homeInvite\.value;[\s\S]{0,400}?switch \(homeRoadmapState\.value\.current\)/);
    expect(source).toMatch(/homeNext\.value\.id === "ryuo-entry"\) openTournamentAt\("ryuo"\)/);
    expect(source).toMatch(/homeNext\.value\.id === "meijin-entry"\) openTournamentAt\("meijin"\)/);
  });
  it("対局中も見出しの「図鑑」から図鑑を開き、閉じると対局へ戻る(docs/match-dex-design.md)", () => {
    // メニューにしまわず、いつも見出しに出す。
    expect(source).toMatch(/<template v-if="!menuCollapsed && !reviewMode">[\s\S]*?<\/template>[\s\S]{0,200}?class="shogi-game__command shogi-game__dex-open"[\s\S]{0,120}?data-match-dex\s*@click="openDexShelf"/);
    expect(source).toMatch(/v-for="shelf in DEX_SHELF"[\s\S]{0,200}?@click="openDexFromMatch\(shelf\.kind\)"/);
    // 対局のエンジンを借りない。占いから新しい対局を始めない。戻る先は対局。
    expect(source).toMatch(/:analysis-engine="dexFromMatch \? null : dexAnalysisEngine"/);
    expect(source).toMatch(/:can-play="!dexFromMatch"/);
    expect(source).toMatch(/dexFromMatch\.value \? "対局へ戻る"/);
    // 対局は残したまま隠す。
    expect(source).toMatch(/'shogi-game--dex-over-match': dexOverMatch/);
    expect(source).toMatch(/\.shogi-game--dex-over-match > :not\(\.shogi-dex\) \{\s*visibility: hidden;/);
    expect(source).toMatch(/\} else if \(dexShelfOpen\.value\) \{\s*dexShelfOpen\.value = false;/);
  });
  it("やこび姫の作戦の助言は、危険の知らせのあと・ほかの助言の前に、確かめの読みを通してから出す(docs/coach-plan-advice-design.md)", () => {
    expect(source).toMatch(/const chosen = moveFeedback \?\? urgentAdvice \?\? threatLine \?\? planLine \?\? riskAdvice;/);
    expect(source).toMatch(/URGENT_RISK_ADVICE = \/\^\(forced-mate-loss\|king-in-check\|mate-risk\|candidate-evaluation-cliff\)\//);
    // 浅い読みの候補から提案を作り、2手に絞った読みで確かめる。
    expect(source).toMatch(/const proposal = planAdvice\(\{[\s\S]{0,1200}?searchMoves: \[proposal\.swingMove, proposal\.otherMove\][\s\S]{0,400}?confirmPlanAdvice\(proposal,/);
    // 「にする」は作戦カードに入れ、まだ使えない段でも使えるようにする。
    expect(source).toMatch(/function acceptCoachPlanOffer\(\) \{[\s\S]{0,200}?recordCoachPlan\(browserStorage\(\), offer\.planId\)[\s\S]{0,200}?applyPlan\(entry\.plan\.id/);
    expect(source).toMatch(/extraIds: \[\.\.\.fortunePlanIds\.value, \.\.\.coachPlanIds\.value\]/);
    expect(source).toMatch(/v-if="coachPlanOffer"[\s\S]{0,200}?data-plan-offer[\s\S]{0,600}?data-plan-offer-basis/);
  });
  it("悪手には相手の応手から理由を添え、相手の狙いは詰めろの確かめの最善手から言う(docs/coach-plan-advice-design.mdの9章)", () => {
    // 悪手判定の着手後の読み筋(相手のいちばんの応手)を、悪手の台詞に添える。
    expect(source).toMatch(/return \{ before, after, afterPv: afterSearch\.pv \};/);
    expect(source).toMatch(/moveFeedback = withMistakeReason\(getMoveFeedback\(\{[\s\S]{0,300}?\}\), mistakeReason\(\{[\s\S]{0,300}?pv: judged\.afterPv,/);
    // 相手の狙いは、新しい探索を足さず、詰めろの確かめ(手番を入れ替えた局面)の最善手を使う。
    expect(source).toMatch(/best: best\?\.move \? \{ move: best\.move, score: best\.score as EngineEvaluation \| undefined, pv: best\.pv/);
    expect(source).toMatch(/threatAdvice\(\{\s*threatSfen,\s*threatMove: mateThreatResult\.best\.move,/);
  });
  it("大会の1局の始めに、相手の棋風と特殊能力から戦い方を一言いう(大一番は開幕の一言を優先)", () => {
    expect(source).toMatch(/const opponentLine = opponentStyleAdvice\(opponent\.character, opponent\.name\);[\s\S]{0,300}?if \(stage\?\.coachLine && coachLevel\.value !== "off"\) guideText\.value = stage\.coachLine;[\s\S]{0,200}?else if \(opponentLine && coachLevel\.value !== "off"\) showCoachAdvice\(opponentLine\);/);
  });
  it("形勢の一言には駒の損得を、好手のほめ言葉には指した手の手筋を渡す", () => {
    expect(source).toMatch(/advisedTopics: advisedCoachTopics,\s*materialBalance: playerMaterialBalance\(\),/);
    expect(source).toMatch(/tesuji: detectTesuji\(\{ sfenBefore: sfenBeforeMove, usi \}\),/);
    expect(source).toMatch(/tesuji: flair\?\.tesuji \?\? \[\],/);
  });
  it("大会の1局で、相手の顔・一言・特殊能力の札・速報を、決まった高さの中継の1行に出す(docs/tournament-match-presence-design.md)", () => {
    expect(source).toMatch(/v-if="opponentFace"[\s\S]{0,300}?data-opponent-face/);
    expect(source).toMatch(/class="shogi-game__presence-line"[\s\S]{0,300}?data-presence-line/);
    // 始めのあいさつと速報の準備、CPUの手の特殊能力、手番ごとの速報、評価値での表情。
    expect(source).toMatch(/restart\(\);\s*startPresence\(\);/);
    expect(source).toMatch(/ryuoCpuMoves = \[[\s\S]{0,120}?cpuMoveRecord\];\s*notePresenceCpuMove\(cpuMoveRecord\);/);
    expect(source).toMatch(/schedulePlayerIdleAdvice\(\);\s*tickPresenceNews\(\);/);
    // 詳しい助言では、助言の読みの評価値だけを使う(浅いCPUの評価値でバーが跳ねないように)。
    expect(source).toMatch(/if \(coachLevel\.value === "encourage"\) notePresenceScore\(score\);/);
    expect(source).toMatch(/if \(coachLevel\.value !== "off" && !reviewMode\.value\) notePresenceScore\(score\);/);
    // 盤の大きさを変えないよう、中継の1行は高さを決めておく。
    expect(source).toMatch(/\.shogi-game__presence-line \{\s*display: block;\s*min-height: 1\.4em;/);
  });
  it("大会の1局で、中継の勝率バーと控室の一言を出す(助言なし・中継を切ったときは出さない)", () => {
    expect(source).toMatch(/const broadcastShown = computed\(\(\) => Boolean\(tournamentOpponent\.value\) && coachLevel\.value !== "off" && broadcastEnabled\.value\);/);
    expect(source).toMatch(/v-if="broadcastShown"[\s\S]{0,400}?data-broadcast/);
    expect(source).toMatch(/data-broadcast-toggle\s*@click="toggleBroadcast"/);
    expect(source).toMatch(/const BROADCAST_KEY = "yacobihime:shogi-match:broadcast:v1";/);
    expect(source).toMatch(/function noteRoomComment\(\) \{\s*if \(!broadcastShown\.value\) return;/);
    expect(source).toMatch(/notePresenceScore\(score\);\s*if \(riskOnly\) \{/);
    expect(source).toMatch(/\.shogi-game__broadcast \{[^}]*min-height: 1\.4em;/);
  });
});
