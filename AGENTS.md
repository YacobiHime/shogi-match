# shogi-match 作業ガイド

このリポジトリは、Vue Custom Elementとして配布する将棋対局ランタイムです。
ふだん変更するのは`src/`です。公開の入口は`game.html`、Firebase Hostingの設定は`firebase.json`にあります。
利用者向けの説明は`README.md`、ローカルでの起動と定跡編集の手順は`docs/local-development.md`にあります。
遊びとUIの設計の指針（桜井政博・任天堂のゲーム論とUI論）は`docs/nintendo-design/`にあります。ゲームデザインやUIデザインに関わる作業では、必ずこれを読んでから始めます（下の「遊びとUIの設計指針」）。

## このゲームの柱

- 主役は**大会**（竜王戦・名人戦）と**物語モード**（後で作る）です。
- 将棋教室・問題集（詰将棋）・図鑑・終盤戦・自由対局は、主役を楽しむために強くなるための機能です。
- 設計で迷ったら「大会（と物語）をもっと楽しむことにつながるか」を問います。「つぎはこれ」の練習も、最後は大会へ戻る道として勧めます（`docs/first-play-design.md`の0章）。

## 最初に確認する場所

| 作業 | 主な参照先 |
| --- | --- |
| 対局画面・状態遷移・やこび姫の表示 | `src/ShogiMatchGame.vue`、スタイルは`src/ShogiMatchGame.css`、対局画面から切り出した部品は`src/composables/match/` |
| はじめての分岐（どのくらい知ってるか）と、大会へ向かう「つぎはこれ」 | 設計は`docs/first-play-design.md`（はじめての案内は`src/core/welcome.mjs`、教室の始める場所は`src/core/tutorial-map.mjs`の`TUTORIAL_PLACEMENTS`。弱点の練習の行き先（教室の章・問題集の5問）は`src/core/play-coach.mjs`の`practiceDestination`と`PRACTICE_CHAPTERS`、5問の並びは`src/core/problem-set.mjs`の`drillProblems`、竜王戦・名人戦への誘いは`tournamentInvite`）。CPUの段級位の作り直し（15級〜タイトル保持者）の設計は`docs/level-ladder-design.md` |
| ホーム画面と強くなる道 | `src/ShogiMatchGame.vue`の`homeNext`・`homeRoadmapState`、段の判定は`src/core/home-roadmap.mjs`（問題集の解いた記録は`src/core/problem-progress.mjs`から読む）、設計は`docs/home-roadmap-design.md`。実力と実績で「つぎはこれ」とおすすめの強さを変える見立ては`src/core/play-coach.mjs`、対局の中身の記録（自由対局と竜王戦）と弱点の判定は`src/core/play-insight.mjs`、竜王戦の期の途中の「続きを指す」と「○○対策」・次の期へは`src/core/ryuo-next.mjs`、今日の1局・まだ見ていない遊び・あと少しのご褒美は`src/core/home-extras.mjs`、その裏の解析は`src/composables/match/usePlayInsightAnalysis.ts`（竜王戦の統計と共通の浅い読みは`scanAnalysis.ts`。設計は`docs/home-next-adaptive-design.md`） |
| 対局準備の画面 | `src/ShogiMatchGame.vue`の対局準備（`pregameSides`・`pregameCommonRows`・`pregamePickerConfig`）、選択肢の定数は`src/composables/match/pregameOptions.ts`、選択シートは`src/PregamePicker.vue` |
| ブラウザの戻る操作 | `src/composables/useBackNavigation.ts`、`src/ShogiMatchGame.vue`の`navigateBack` |
| 画面の大きさによる配置の切り替え | `src/composables/useResponsiveLayout.ts` |
| 戦法・囲いの手順、完成条件、分類 | `src/core/opening-guide.mjs`（戦法と囲いを駒ごとに合わせる`composeOpeningPlan`と合わない組の`openingPlanCompatibility`）、本番と同じデータでの監査は`src/core/opening-audit.mjs`・`src/core/opening-guide-integrity.test.mjs`・`scripts/opening-guide-audit.mjs`（設計は`docs/opening-guide-integrity-design.md`） |
| やこび姫補助の作戦カード（選び方・解放・完成形の小さな盤と薄い駒） | 目録は`src/core/opening-catalog.mjs`、解放とやこび姫のおすすめ（`recommendPlan`）は`src/core/opening-unlocks.mjs`、完成形は`src/core/opening-formation.mjs`、戦法占いは`src/core/opening-fortune.mjs`と`src/OpeningFortune.vue`（作戦カードのシートと定跡図鑑から開く）、画面は`src/OpeningPlanSheet.vue`と`src/FormationThumb.vue`、対局画面の`planSheet`・`planGhosts`・`planInterruption`（今の局面から組める作戦と残り手数は`planBuildable`、作戦を選べるか・欄を出すかは`planChoiceOpen`・`openingGuideShown`）、設計は`docs/opening-guide-ux-design.md`（分かりやすさの見直しは13章） |
| 定跡エディターの上書きデータ | `src/data/opening-guide-overrides.mjs`（`npm run import:opening-library`で生成） |
| 戦法・囲いの解説文 | `src/core/opening-explanations.mjs` |
| 戦型検出 | `src/core/formation-tracker.mjs`、`src/data/hiragana_suisho_formations.json` |
| やこび姫の助言・称賛 | `src/core/coach-advice.mjs`、AIの候補手を作戦の名前に翻訳して提案する作戦の助言（飛車を振る提案と振り直し）は`src/core/coach-plan-advice.mjs`と対局画面の`offerCoachPlan`・`coachPlanOffer`（設計と、ほかの助言の強化の検討は`docs/coach-plan-advice-design.md`、出る回数の測定は`scripts/coach-plan-advice-report.mjs`）、悪手の理由と相手の狙いは`src/core/coach-reason.mjs`（悪手判定の読み筋と詰めろの確かめの最善手を言葉にする。新しい探索は足さない）、大会の1局の始めの相手の棋風の一言は`src/core/coach-opponent.mjs`、形勢と駒の損得による方針の一言は`coach-advice.mjs`の`situationPolicy`、手筋の名前でほめる一言は`move-praise.mjs`の`TESUJI_PRAISE`、`src/core/move-praise.mjs`、神の一手の基準（対局中と棋譜解析で共通）は`src/core/god-move.mjs` |
| CPU難易度 | `src/core/strength-settings.mjs`（Lv0〜49の段級位の表。2026-10-22に15級〜タイトル保持者へ作り直し、2026-10-23に下へ24級〜16級を足して50段階にした。各Lvは、もとの校正`CALIBRATION_PRESETS`のどの強さを使うか`source`で持つ。前の保存の移しかえ（v1・v2→今の版3）は`src/core/level-ladder.mjs`、設計は`docs/level-ladder-design.md`の12章）、ロジックAIは`src/core/logic-ai.mjs`（24級〜16級のLv1〜9で、表の`source`を小数のLvにして指す。`logicLevelOf`）、局面の気づきは`src/core/position-awareness.mjs`、マスごとの利きから取り合いの損得を出す計算（見え方のレベル差つき）は`src/core/exchange-eval.mjs`、Lv1〜39の選び方は`src/core/aware-move-choice.mjs`（設計は`docs/logic-ai-design.md`・`docs/cpu-purposeful-moves-design.md`。人間らしい思考のモデルとレベル表の設計（未実装）は`docs/cpu-human-model-design.md`、間違いの種類の測定は`scripts/cpu-mistake-report.mjs`） |
| CPUの戦法の選び方 | `src/core/cpu-opening-repertoire.mjs` |
| 棋譜解析 | `src/core/kifu-analysis.mjs`、`src/EvaluationGraph.vue`、解析用エンジンの追加と解放は`src/composables/match/analysisEngines.ts`、対局の振り返りは`src/composables/match/useGuidedReview.ts`（台本は`src/core/guided-review.mjs`） |
| リロード復元 | `src/core/match-persistence.mjs` |
| プレイヤー名 | 保存と整え方は`src/core/player-name.mjs`、タイトル画面の名前のボタンと名前の札は`src/ShogiMatchGame.vue`の`playerName`・`nameDialogOpen`、設計は`docs/player-name-design.md` |
| 棋力測定 | 棋力は「このゲームのCPUと五分に指せるLv」。診断（札の目安の幅と測る前の実績の勝ち負け`measurePrior`、測定対局の勝ち負け、31手目からの手の損（中盤・終盤のLvごとの表`LOG_LOSS_TABLES`、重み1/3）のベイズ推定。表はCPUの対局をアプリと同じ解析で読んで作る。1手の損は解析の`measureLoss`。序盤の手は数えない）と、最初の相手を選ぶ札（`MEASURE_START_CHOICES`・`measureStartChoices`）、足りないとき・幅が広いとき（確かめの1局）に続けて測る相手のLv（`measureFollowUp`）・持ち越す手と勝ち負けは`src/core/skill-estimate.mjs`、測定・申告のあとのレーティングの幅（数局で合わせ直す）は`src/core/player-rating.mjs`の`deviation`、対局中の測定の札は`src/ShogiMatchGame.vue`の`measureBand`、測る前の目安は`measurePriorState`、画面は`src/ShogiMatchGame.vue`の`measureStartFrom`（最初の相手の札）・`measureSession`・`measureCarry`・`continueMeasure`・`enterTournamentFromMeasure`（結果から竜王戦の入口へ。測定は大会の難易度を決めるためのもの）、設計は`docs/skill-measure-design.md` |
| 大会（竜王戦）・称号・プロフィール | `src/core/ryuo.mjs`（トーナメント表・棋士の生成・自動対局・昇級降級・シーズンの進行）、`src/core/ryuo-data.mjs`（棋士の名前・戦法）、`src/core/player-character.mjs`（棋士の棋風と特徴・特殊能力、強さ設定への反映、詰みが見える手数）、`src/core/player-abilities.mjs`（8つの能力値。強さはレーティングのまま配分で持つ）、プレイヤー自身の能力（最近の対局の要約`play-insight.mjs`の`axes`から、名鑑の棋士と同じ形で出す。やこびノートの「能力」の項目）は`src/core/my-abilities.mjs`と`src/YakobiNote.vue`の`myAbility`、`src/core/opening-usage.mjs`（戦法と囲いの使用率）、`src/core/ryuo-simulation.mjs`（棋士どうしの自動対局を序盤・中盤・終盤のまねで決める）、`src/PlayerAbilityPanel.vue`（能力のレーダーチャート・ランク・特殊能力・使用率。名鑑と次の相手の札で共通）、設計は`docs/player-abilities-design.md`、`src/core/ryuo-roster.mjs`（期をまたいで残る架空の棋士の名簿と、期の結果での更新）、`src/core/ryuo-league.mjs`（棋界の1年: 年間成績・順位戦・竜王以外のタイトル戦・昇段・将棋大賞）、`src/core/ryuo-names.mjs`（名前）、`src/core/ryuo-repertoire.mjs`（得意戦法）、やこびノートのコレクション（アルバムのページ・カード・挑戦できる・Lvの壁・NEW）は`src/core/collection.mjs`の`albumCards`・`levelWall`と`src/YakobiNote.vue`の`collection`（カードから作戦カードのくわしい画面へは対局画面の`openPlanFromNote`。設計は`docs/player-world-note-design.md`の4章）、`src/core/ryuo-book.mjs`と`src/RyuoRosterBook.vue`（棋士名鑑。やこびノートの「棋士名鑑」の項目。絞り込みは`bookMembers`、くわしい情報は重ねて開くシート。ノートの「大会」の項目は`src/YakobiNote.vue`の`tournament`。設計は`docs/player-world-note-design.md`の3章）、`src/core/ryuo-strength.mjs`（棋士のレーティング・難易度によるLvへの換算・自動対局の勝率）、`src/core/ryuo-career.mjs`（キャリアと保存）、`src/core/ryuo-stats.mjs`（統計・レーダーチャート・解説）、`src/core/ryuo-stages.mjs`（期を①組のランキング戦・②決勝トーナメント・③番勝負の3段階に分けて見せる形。設計は`docs/ryuo-stages-design.md`）、`src/core/player-profile.mjs`（称号）、名人戦（順位戦から名人へ。竜王戦とは別の暦）は`src/core/meijin.mjs`（順位戦の世界・期・順位表・昇級と降級点・プレーオフ・七番勝負・キャリアと保存。保存と暦に依存しない形で、後で作る棋士モードからも呼ぶ）と`src/ShogiMeijin.vue`（入口・期の画面・結果）・`src/MeijinPagoda.vue`（五重塔）・`src/MeijinLeagueTable.vue`（リーグ表）、対局画面の`meijinSeason`・`recordMeijinOutcome`、設計は`docs/meijin-design.md`、順位戦の世界（クラスごとの順位・降級点・名人）は名簿の`roster.junni`に1つだけ持つ（作る・照らし合わせる・控え（`member.junni`・名人）を書くのは`src/core/ryuo-league.mjs`の`createJunniWorld`・`syncJunni`・`writeJunniToMembers`、1期進める・参加・前の保存の移しかえは`src/core/junni-world.mjs`。ほかの場所で`member.junni`や名人を書き換えない。設計は`docs/player-world-note-design.md`）、`src/ShogiTournament.vue`（タイトル画面から入る大会の画面）、大会の対局中の舞台（対局の札・開幕の札・封じ手・タイトル戦の背景と肩書）は`src/core/match-stage.mjs`と`src/ShogiMatchGame.vue`の`matchStage`・`stageCard`（設計は`docs/match-stage-design.md`。相手の顔・一言・特殊能力の札とほかの対局の速報（段階1）と中継の勝率バー・控室の一言（段階2）は`src/core/match-presence.mjs`と対局画面の`opponentFace`・`presenceLine`・`startPresence`・`broadcastShown`・`noteRoomComment`、竜王戦の山と名人戦の暮れる空の背景・終局の判子（段階3）は`match-stage.mjs`の`scenery`・`skyPhase`と`match-presence.mjs`の`finishStamp`、対局画面の`showFinishStamp`、秒読みの演出（段階4）は`src/core/byoyomi.mjs`と`src/composables/match/useByoyomi.ts`（名札の輪は`BoardView.vue`の`playerCountdown`、エントリー設定の行は`ShogiTournament.vue`・`ShogiMeijin.vue`の「秒読みの演出」）、設計は`docs/tournament-match-presence-design.md`。タイトル戦（二日制）の1日目のまとめ・封じ手予想と開封の札・勝負メシ・観戦記は`src/core/title-day.mjs`と`src/TitleDaySheet.vue`、対局画面の`titleDay`・`sealTitleDay`・`lunchOffer`・`writeTitleKansenki`、ノートの観戦記は`src/YakobiNote.vue`の`kansenki`（設計は`docs/title-match-day-design.md`）。速報のため、同じ回戦のほかの試合はプレイヤーの局の前に決める（`ryuo.mjs`の`advanceBracket`、`meijin.mjs`の`pending.others`））、期の終わりの表彰式の賞状と賞状帳は`src/core/season-award.mjs`と`src/SeasonAward.vue`（賞状は期が終わったときに`ShogiMatchGame.vue`の`awardRyuoSeason`・`awardMeijinSeason`が足す。設計は`docs/season-award-design.md`）、`src/RyuoMountain.vue`（期の画面のドット絵の山の地図「竜王への道」。配置は`src/core/ryuo-mountain-layout.mjs`、道の段は`src/core/ryuo-road.mjs`、設計は`docs/ryuo-ui-renewal-design.md`）、`src/RyuoBracket.vue`（試合の札のトーナメント表）、`src/RyuoSeries.vue`（番勝負の星取り）、`src/RadarChart.vue`、`src/RyuoLadder.vue`（組の階段）、`src/ShogiMatchGame.vue`の`ryuoSeason`・`ryuoGame`、統計のための裏の解析は`src/composables/match/useRyuoStatsAnalysis.ts`、設計は`docs/tournament-design.md`、ライバルの天鷺羽音と父の天鷺善彦（物語の人物・台詞。羽音は敬語を使わない）は`src/core/ryuo-story.mjs`、羽音の立ち絵は対局画面の開幕の札だけで`src/HananePortrait.vue`と`ryuo-story.mjs`の`HANANE_PORTRAIT`（VS画面を含め、ほかの場面はドット絵の`HANANE_SPRITE`）、設計は`docs/hanane-rival-design.md`（立ち絵は12章）、制度の調査は`docs/ryuo-sen-research.md`。研修会と奨励会は下の「大会（研修会）」「大会（奨励会）」の行 |
| 大会（研修会） | 規定・研修会員の世界・入会試験・例会・指導対局（駒落ち）・A2とSと保存は`src/core/kenshukai.mjs`（画面・保存の仕組み・暦に依存しない。昇級の記録と降級点は`shoreikai.mjs`の関数を使う）、やこび姫の台詞と判子は`src/core/kenshukai-speech.mjs`、画面は`src/ShogiKenshukai.vue`（入口・入会試験・例会・Sクラス。奨励会の画面の部品と名札掛け`ShoreikaiNameboard.vue`を使う）、対局画面の`kenshukaiCareer`・`enterKenshukai`・`startKenshukaiGame`・`recordKenshukaiOutcome`・`transferKenshukai`（`ryuoGame.event`が`kenshukai`。指導対局は`startRyuoMatch`で駒落ちの開始局面にする）、奨励会6級への編入は`shoreikai.mjs`の`createShoreikaiRun`の`transfer`と奨励会のキャリアの`transfer`、賞状は`season-award.mjs`の`kenshukaiAward`、設計は`docs/kenshukai-design.md` |
| 大会（奨励会） | 規定・奨励会員の世界・入会試験・例会・三段リーグ・挑戦（run）と経歴の保存は`src/core/shoreikai.mjs`（画面・保存の仕組み・暦に依存しない。後で作る棋士モードからも呼ぶ）、やこび姫・師匠・羽音の台詞と判子は`src/core/shoreikai-speech.mjs`、画面は`src/ShogiShoreikai.vue`（入口・入会試験・例会・三段リーグ・不合格・退会・四段の式。大会の画面`ShogiTournament.vue`の中に出す）と`src/ShoreikaiNameboard.vue`（名札掛け）、対局画面の`shoreikaiCareer`・`enterShoreikai`・`startShoreikaiGame`・`recordShoreikaiOutcome`（`ryuoGame.event`が`shoreikai`）、四段の免状は`src/core/season-award.mjs`の`shoreikaiAward`、やこびノートの「大会」の奨励会の札は`src/YakobiNote.vue`、設計は`docs/shoreikai-design.md` |
| 将棋教室 | `src/ShogiTutorial.vue`、`src/core/tutorial-curriculum.mjs`、盤の上のひとこと（文・マス・位置）と吹き出しの色の札は`src/core/tutorial-callout.mjs`、読み上げの読み方は`src/core/tutorial-voice.mjs`、判定は`src/core/tutorial-runner.mjs`（問題集の問題と攻めくらべは`src/core/tutorial-problem.mjs`。対局画面から読まない。駒得するまで指す課題・角打ちの隙の駒の損得の読みは`src/core/material-tactics.mjs`）、地図・メダル・称号は`src/core/tutorial-map.mjs`、利きメガネの所持・にがての記録・格言帳は`src/core/tutorial-progress.mjs`、設計は`docs/nyumon-mode-design.md` |
| 盤の見える化 | 駒の値段と駒得の数字は`src/core/piece-points.mjs`（入門用のtier表・教室の値と、図鑑のAI用の表・対局の「駒の損得」で使う`AI_PIECE_POINTS`・`aiMaterialTotals`を管理。対局の札は`src/ShogiMatchGame.vue`の`materialChip`、設計は`docs/material-guide-design.md`）、取られるマス・玉の逃げ道・取り返し・利いているマスの数は`src/core/board-insight.mjs`（取られるかの判断はCPUと同じ`src/core/exchange-eval.mjs`の取り合いの計算）、利きの地図は`src/core/learning-setup.mjs`の`attackMap` |
| 将棋問題集 | `src/ShogiProblemSet.vue`、問題とやこび姫の台詞は`src/core/problem-set.mjs`、練習問題の正誤判定の詰み探索は`src/core/problem-solver.ts`（正解は書かず探索で決める）、詰将棋（駒の少ない詰将棋と実戦詰将棋）と詰将棋図巧のデータは`src/data/tsume-problems.mjs`・`src/data/jissen-tsume-problems.mjs`・`src/data/zukou-problems.mjs`（外部データの手順で判定する。手で書き換えない） |
| 図鑑 | 対局中に開く「図鑑」のボタンと図鑑の棚は`src/ShogiMatchGame.vue`の`DEX_SHELF`・`dexShelfOpen`・`dexFromMatch`（図鑑の絵は`src/DexIcon.vue`でホームと共通。設計は`docs/match-dex-design.md`）、`src/ShogiOpeningDex.vue`（定跡）、`src/ShogiReferenceDex.vue`と`src/core/reference-dex.mjs`（駒・手筋・将棋界・用語辞典）、用語辞典の項目は`src/data/shogi-glossary.mjs`、将棋界図鑑の代表局のKIFは`src/data/reference-kifu.mjs`、「詰将棋の名作」で解ける『将棋図巧』は将棋問題集の`ZUKOU_SET`と判定を使う、AI解析は`src/core/reference-kifu-analysis.mjs`（エンジンは`src/composables/match/useDexAnalysisEngine.ts`で対局用のものを借りる） |
| 展示（「最初から」と、インターネットなしのWindows用パッケージ） | 記録の消去は`src/core/exhibit-reset.mjs`、ボタンは`src/ShogiMatchGame.vue`の`exhibit`、パッケージは`scripts/build-exhibit.mjs`と`scripts/exhibit/`（PowerShellのサーバー・bat・説明書）、設計は`docs/exhibit-design.md` |
| iframe・ノベル連携 | `src/novel-bridge.ts`、RPGは`integrations/shogi-rpg.js` |
| 手動検証履歴 | `docs/yakobihime-opening-guide-verification.md` |
| 遊び・演出・ご褒美・難易度・教え方の設計 | 設計するときは`docs/nintendo-design/Game_Nintendo_Design.md`、実装するときは`docs/nintendo-design/Game_Nintendo_Implementation.md` |
| 画面・操作・文言の設計 | 設計するときは`docs/nintendo-design/UI_Nintendo_Design.md`、実装するときは`docs/nintendo-design/UI_Nintendo_Implementation.md`、根拠は`docs/nintendo-design/UI_Nintendo.md` |

文書と実装が食い違う場合は、テスト済みのコードを現在の仕様として扱います。同じ変更で文書も直してください。
ただし、ユーザーが手動で検証した結果を、自動テストだけで「動作確認済み」へ書き換えてはいけません。

## コミットメッセージ

- 日本語で書きます。件名は`<種別>: <内容>`の一行です。例: `fix: 角換わり手順の中断判定を修正する。`
- 種別には`feat`、`fix`、`style`、`perf`、`refactor`、`tune`、`docs`、`chore`、`revert`などを使います。
- 内容は、何を変えたかを体言止めか「〜する」の形で書きます。末尾には句点「。」を付けます。
- 補足が要るときは、本文を1行空けて箇条書きで書きます。

## 実装上の重要事項

### 遊びとUIの設計指針

- ゲームデザインやUIデザインに関わる作業では、**必ず**`docs/nintendo-design/`の文書を読んでから始めます。小さな修正でも省きません。
  - 対象は、遊び・演出・ご褒美・難易度・教え方・やこび姫の台詞と、画面の配置・操作・ボタン・文言・色・アニメーションを、新しく作る・変える・直す作業すべてです。
  - 設計する（何を作るか決める）ときは`*_Design.md`、コードを書くときは`*_Implementation.md`を読みます。両方に当たる作業では両方を読みます。
  - 文書は次の5つです。
    - `Game_Nintendo_Design.md`と`Game_Nintendo_Implementation.md`：遊び・演出・ご褒美・難易度・教え方
    - `UI_Nintendo_Design.md`と`UI_Nintendo_Implementation.md`：画面・操作・文言
    - `UI_Nintendo.md`：UI論の根拠と出典
- 設計を決めたら、どの原則に基づいたかを、設計文書（`docs/`）か、コミットの本文に書きます。新しい遊びや画面は、`Game_Nintendo_Design.md`の「機能設計メモのテンプレート」の形で設計文書に残します。
- 実装したら、`*_Implementation.md`の「実装後のチェックリスト」で確かめます。
- これらの文書にある時間や段階の数値は初期値です。触って調整したら、文書の表も直します。
- これらの文書とこの`AGENTS.md`が食い違ったら、`AGENTS.md`に従い、文書のほうを直します。

### 戦法・囲いの案内

- 戦法と囲いは別の計画です。囲いの定義に、特定の振り飛車の導入手順を入れないでください。振り飛車用の囲いでは、先に飛車の振り先を選ばせます。
- 戦法・囲いの手順は先手向けに定義し、後手では反転します。変更したら、先後の両方で合法性と完成判定をテストします。
- 完成後の計画はロックします。駒が動いて完成形が崩れても、寄り道判定へは戻しません。完成後の定跡・AI候補の案内は戦法だけに出し、囲いには出しません。
- 危険な定跡手を避ける場面では、危険な定跡手1本とAI候補3本を区別して表示します。
- 安全な寄り道は3手までです。次の場合は寄り道せずにすぐ中断し、別の戦法・囲いを選ぶよう促します。
  - 作戦の成立条件が失われた場合
  - 定跡の経路へ戻れない場合
- 角換わり系は、交換前に相手が角道を閉じたら中断し、右四間飛車への切り替えを案内します。
- 角交換は、誰が指したかではなく、盤上の角・馬と持ち駒から判定します。相手から交換された場合は取り返しを案内し、交換後の手順へ合流させます。
- 定跡手を消化したかどうかは、次の2つを併用して判定します。
  - 着手履歴での出現回数
  - 現在の局面で、同じ種類の駒が目的地に着いたか
- 予定の移動元が空でも、別の同じ種類の駒が目的地へ合法に動けるなら、その手を案内します。到達も代わりの手も無理なときだけ中断します。
- 原始棒銀は、銀が2六へ出た時点で完成です。合法なら1五銀・3五銀と、その後の飛車先交換を定跡候補として案内します。
- 完成形のマスは、その定義の手順を初めの配置から指した最後の形に合わせます。手順どおりに指せないときの近道は、完成形に割り当てた駒だけを動かし、道をふさぐだけの駒（8九の桂など）は動かしません。
- 戦法と囲いは駒ごとに合わせます（`composeOpeningPlan`）。戦法が動かした駒を使う囲いの手は外し、それでも組めない組は作戦カードに出しません。
- 定跡エディターの上書きデータは、テスト中は無効です（`opening-guide.mjs`の`EDITOR_OVERRIDES_ENABLED`）。環境変数`OPENING_GUIDE_EDITOR_OVERRIDES=1`を立ててから読むと有効になります（`opening-guide-integrity.test.mjs`）。
  - 本番では、上書きデータがある戦法・囲いに限り、`blackMoves`と完成条件がその内容で置き換わります。
  - 組み込みの定義を直す前に、`src/data/opening-guide-overrides.mjs`に同じIDのキー（`castle:<id>`・`strategy:<id>`）がないか確認してください。
  - 同じIDがあるときは、上書きデータも直さないと本番に反映されません。

### CPU

- 対局準備の「序盤傾向」の角道では、次の5つから選べます。
  - 開けたまま
  - 開けてから閉じる
  - CPUから角交換
  - プレイヤーからの角交換を待つ
  - 閉じたまま
- 角道の具体的な指定は、初手の指定の次に優先します。定跡が終わった後のAI候補にも、この制約を保ちます。
- 交換を待つ設定や閉じる設定などでは、CPUの角で相手の角を取りに行く手を除外します。
- CPU対局の強さの上限はLv49「藤井聡太並み」です（2026-10-23に下へ9段階足す前はLv40）。藤井聡太より強い人間はいないため、それより強いレベルは追加しません。棋譜解析は対局の強さとは別で、より深く読んでかまいません。
- 探索はエンジン内部のWorkerで動き、画面を止めません。
  - ただし、同じエンジンは一度に1つの探索しか処理できません。CPUが指す前に、助言用の探索を積まないでください。
  - JavaScript側の重い処理（詰み判定など）には時間の上限を付けます。原則としてエンジンに任せます。

### 画面と状態

- 対局中と終局後の状態は`localStorage`へ保存します。「対局準備」へ戻る操作が、保存を削除する境界です。
  - 対局の「中断」（ホーム画面がある表示だけ）は、保存を残したままホームへ戻ります。スナップショットの`suspended`を真にし、盤の状態は消します。再開はホームの「対局を再開」から`restorePersistedMatch({ resume: true })`で行います。リロードしたときは、中断した対局を自動では復元しません。
  - 中断した対局を消す操作（新しい対局・教室の対局・棋力測定の開始）には、`confirmDiscardSuspended`で確認を挟みます。ホームの上に出す確認は、`.shogi-game--home`が他の要素を隠すため、`shogi-game__confirm--over-home`を付けます。
- 縦画面では、飛車の選択などの操作を固定高で隠さないでください。スマホ幅とタブレット縦の両方を確認します。
- 対局準備の設定項目は「項目: 値 [変更]」の行で表示し、選択肢は`PregamePicker.vue`の選択シートで選ばせます。項目を増やすときの手順は次のとおりです。
  - `<select>`は直接置かず、`pregameSides`か`pregameCommonRows`に行を足します。
  - `pregamePickerConfig`と`onPregamePick`に、選択肢と反映先を足します。
- ホーム画面がある表示（`show-home`）では、ブラウザの戻る操作をアプリ内の戻る操作として扱います。
  - 重ねて開く画面やダイアログを増やしたら、`navigateBack`に閉じ方を足します。
  - ホームの上に開く画面なら、`useBackNavigation`の`canGoBack`にも足します。
  - 対局中と検討中は、戻る操作で対局画面から離れないでください。離れると保存した対局が消えるためです。

## 盤面の色の使い分け

盤の木目が黄色系なので、升の強調に黄色を使わないでください。図鑑・将棋教室・対局で、次の意味をそろえます。

| 色 | 意味 | 定義場所 |
| --- | --- | --- |
| 緑 | 駒が動いた跡、図鑑・教室の「大事なマス」（`square-mark--key`） | `src/renderer/view/primitive/board/params.ts`の`lastMoveTo`、`BoardView.vue`の`.square-mark--key` |
| 青い点 | 駒の動けるマス（`square-mark--reach`） | `BoardView.vue`の`.square-mark--reach` |
| 赤 | ねらう駒・目標のマス（`square-mark--target`）、駒を選んだときの相手の駒を取れる移動先 | `BoardView.vue`の`.square-mark--target`、`params.ts`の`captureDestination` |
| 青・赤・紫の面と数字 | 駒の利き（対局の「駒の利き」。学習・通常・竜王戦のどれでも使える。教室の利きメガネ）。青は先手、赤は後手、紫は両方の利き | `BoardView.vue`の`.attack-tint--*`・`.attack-count--*` |
| 青・赤の× | 玉の逃げ道で、相手の駒が利いているマス。後手の玉のまわりは先手の利き（青、`square-mark--covered`）、先手の玉のまわりは後手の利き（赤、`square-mark--danger`）。逃げられるマスは緑（`square-mark--key`） | `BoardView.vue`の`.square-mark--covered`・`.square-mark--danger` |
| 赤い輪 | 利きメガネで、駒を選んだとき、動かすと取られて損をする移動先 | `BoardView.vue`の`.risk-ring` |

- 図鑑の凡例（`ShogiReferenceDex.vue`の`__swatch--*`）と、教室の吹き出しの色の札（`ShogiTutorial.vue`の`__swatch--*`。「緑のマス」などの言葉の前に付く）は、盤上の色と同じ色相にします。
- 升の色を変えるときは、台詞や凡例にある色の名前（「緑のマス」など）も同じ変更で直します。
- 対局中の矢印（危険な定跡手の黄色、AI候補の赤など）は升の強調とは別の表示で、この表の対象外です。
- 駒得の数字（取ったマスに浮かべる緑の「＋6」・赤の「−5」、`BoardView.vue`の`.float-label`）と、囲いを組もうの薄い駒（`.ghost-piece`）、教室の盤の上のひとこと（`.board-callout`。白地に濃い縁で、黄色は使わない）も、升の強調とは別の表示です。駒得の数字の色は、教室の札（`ShogiTutorial.vue`の`--material-good`・`--material-bad`）とそろえます。

## 検証

変更の範囲に応じて、最低限次を実行します。

```sh
npm test
npm run build
npm run typecheck
git diff --check
```

- 型チェックのエラーは0件です（2026-10-07に、残っていた140件を解消しました）。型エラーを出さないでください。
  - `.mjs`の関数で`fn({ a = 1, b } = {})`と書くと、既定値のない`b`が型から落ち、呼び出し側でエラーになります。JSDocの`@param`で引数の型を書いてください。
- 戦法・囲いを変更したら、`src/core/opening-guide.test.mjs`で次の4つを確かめます。
  - 手順の合法性
  - 先後の反転
  - 完成条件
  - 分類
- 定跡エディターの上書きデータを直したら、`src/core/opening-guide-integrity.test.mjs`（本番と同じデータ）が通ることを確かめます。一覧は`node scripts/opening-guide-audit.mjs`で出せます。
- `src/core/match-ui-regression.test.mjs`は、`ShogiMatchGame.vue`のソースを正規表現で調べるテストです。
  - 調べるソースは、`ShogiMatchGame.vue`・`ShogiMatchGame.css`・`src/composables/match/*.ts`をつないだもの（`src/core/match-screen-source.mjs`）です。対局画面の処理を`src/composables/match/`へ移しても、同じテストで確かめられます。
  - 画面の書き方を変えると失敗することがあります。
  - 失敗したら、守りたい性質が新しい書き方でも保たれているかを確かめてから、パターンを直してください。
- 画面の操作を変更したら、可能なら実際のブラウザで、デスクトップ、スマホ縦、タブレット縦の3つを確認します。
  - `game.html`は`src/`ではなく`dist/`を読み込みます。確認の前に`npm run build`を実行してください。
  - Viteの開発サーバーを起動したままビルドし直すと、古い`dist/`のJSが配信され続けることがあります。ビルドし直したら、開発サーバーを起動し直すか、キャッシュしない静的サーバーを使ってください。
  - WASMエンジンを動かすには、サーバーがCOOP/COEPヘッダーを返す必要があります。
  - ブラウザ操作の自動化ツールは、リポジトリの依存関係に入っていません。使うときは、リポジトリの外に用意してください。

## 生成物と公開

- `dist/`と`firebase-public/`と`exhibit/`は生成物です。直接編集せず、`npm run build`か`npm run build:hosting`で作り直します。
- `src/data/opening-guide-overrides.mjs`は、定跡エディターのJSONから`npm run import:opening-library`で生成します。
- Firebase Hostingへは`npm run deploy`で公開します。pushとデプロイは、ユーザーが明示的に頼んだときだけ行います。
- HostingではHTMLを毎回再検証し、`scripts/build-hosting.mjs`がJSとCSSに内容のハッシュを付けます。大きな静的資産はキャッシュします。キャッシュの方針を変えるときは、ビルドスクリプトと`firebase.json`を一緒に確認します。
- 教室・問題集・図鑑・やこびノート・大会の画面は、`ShogiMatchGame.vue`から`defineAsyncComponent`で開いたときに読み込みます。
  - 入口から静的にたどれるモジュールは、`vite.config.js`の`codeSplitting`で`dist/chunks/runtime-<hash>.js`にまとめます。遅延チャンクが入口の`shogi-match.js`（`?v=`なし）をimportして、同じモジュールが2回読まれるのを防ぐためです。
  - 対局画面から、これらの画面だけが使う重いモジュール（`reference-dex.mjs`・`problem-set.mjs`・`tutorial-curriculum.mjs`など）を静的にimportしないでください。最初に読むJSに入ってしまいます。
  - ビルドの後でJSの中身を書き換えないでください。チャンクの名前のハッシュが変わらず、長期キャッシュに古い中身が残ります。エンジンの版は`vite.config.js`の`engineVersionPlugin`が埋め込みます。

## 文書の保守

- 公開API、URLパラメーター、Custom Elementの属性とイベント、保存の動作、配布物が変わったら、`README.md`を更新します。
- ローカルでの起動方法や、定跡エディターの操作が変わったら、`docs/local-development.md`を更新します。
- 難易度の実際の値を変えたら、`docs/difficulty-calibration.md`を更新します。必要なら`docs/fujii-sota-strength-calibration.md`も更新します。
- やこび姫の補助の実装を変えたら、検証記録へ「実装・自動テスト済み」として追記します。実際の対局で確認されるまでは、手動検証済みとは区別します。
