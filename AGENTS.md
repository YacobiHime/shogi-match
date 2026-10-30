# shogi-match 作業ガイド

このリポジトリは、Vue Custom Elementとして配布する将棋対局ランタイムです。
ふだん変更するのは`src/`です。公開の入口は`game.html`、Firebase Hostingの設定は`firebase.json`にあります。
利用者向けの説明は`README.md`、ローカルでの起動と定跡編集の手順は`docs/local-development.md`にあります。
遊びとUIの設計の指針（桜井政博・任天堂のゲーム論とUI論）は`docs/nintendo-design/`にあります。ゲームデザインやUIデザインに関わる作業では、必ずこれを読んでから始めます（下の「遊びとUIの設計指針」）。

## このゲームの柱

- 主役は**大会**（竜王戦・名人戦）と**物語モード**（後で作る）です。
- 将棋教室・問題集（詰将棋）・図鑑・終盤戦・自由対局は、主役を楽しむために強くなるための機能です。
- 設計で迷ったら「大会（と物語）をもっと楽しむことにつながるか」を問います。「つぎはこれ」の練習も、最後は大会へ戻る道として勧めます（`docs/first-play-design.md`の0章）。

## ユーザーとの約束（会話を消しても、毎回守ること）

会話の履歴（`/clear`・要約）は消えても、この節は残ります。前の会話で決めた約束はここに書き足します。

- **返事は日本語**で書きます。コード・コミット・文書も日本語です（識別子は英語）。
- **迷っても質問せず、自分で決めて進めます。** 決めた理由（どの設計原則か）は設計文書かコミットの本文に書きます。ユーザーにしか決められないこと（公開・削除など）だけ確かめます。
- **1つの依頼が終わったら、コミットして作業ブランチへpushします。** 作業ブランチの名前は、セッションの指示（システムの指示）にあるものを使います。`git push -q -u origin HEAD:<作業ブランチ>`。
- **mainへのpushとデプロイは、ユーザーが「pushとデプロイ」と言ったときだけ**行います。手順は次の1行です。mainが手元の祖先でないとき（ほかの変更が入った）は止めて、取り込んでから確かめ直します。

  ```sh
  git fetch -q origin main && git merge-base --is-ancestor origin/main HEAD && git push origin HEAD:main && npm run deploy
  ```

  終わったら、公開先（`https://shogi-64125.web.app`）とコミット、公開したサイトをブラウザで確かめたかどうかを報告します。前にpushしただけでmainに出していなかったコミットも一緒に公開されるので、それも伝えます。
- **AIのモデルの名前や型番**を、コミット・文書・コードのコメントに書きません（コミットの末尾の署名の行はセッションの指示どおり）。
- **確かめていないことを確かめたと書きません。** 検証記録（`docs/yakobihime-opening-guide-verification.md`）には「実装・自動テスト済み」と書き、実際に遊んでの確認はユーザーがするまで「未確認」とします。報告でも、テスト・型・ビルド・ブラウザのどれを確かめたかを分けて言います。
- 羽音は敬語を使いません。CPUの強さの上限はLv49（下の「CPU」）。
- 型エラーは0件のままにします（下の「検証」）。

## 1つの依頼の進め方

1. **読む**: ゲームやUIに触れるなら`docs/nintendo-design/`（下の「遊びとUIの設計指針」）、上の表で関係する場所と設計文書。
2. **設計する**: 新しい遊びや画面は、その機能の設計文書（`docs/*-design.md`）に章を足して、「機能設計メモのテンプレート」の形で決めたことと原則を書きます。続きの依頼は同じ文書に章を足します（例: `docs/tournament-relay-design.md`の11〜13章）。
3. **作る**: 画面に依存しない処理は`src/core/*.mjs`に置き、テスト（`*.test.mjs`）を書きます。画面はVueの部品、対局画面とのつなぎは`ShogiMatchGame.vue`か`src/composables/match/`。
4. **確かめる**: `npm test`・`npm run typecheck`・`npm run build`・`git diff --check`と、画面を変えたらブラウザで3つの大きさ（下の「検証」）。
5. **文書を直す**: 設計文書に「実装（日付、実装・自動テスト済み）」の節、`README.md`の機能の説明、この`AGENTS.md`の表の行、検証記録の1行。
6. **コミットしてpush**し、ユーザーに日本語で短く報告します（何ができたか、確かめたこと、確かめていないこと）。

### コミットの本文と、設計原則の書き方

本文の箇条書きには、その決定がどの原則に基づくかを括弧で書きます。記号は次のとおりです（過去のコミットには揺れがあります）。

| 記号 | 文書 | 例 |
| --- | --- | --- |
| `D:章` | `docs/nintendo-design/Game_Nintendo_Design.md` | `(D:2-2 溜めと解放)` |
| `G:章` | `Game_Nintendo_Implementation.md` | `(G:3 出来事の重さと演出)` |
| `UD:章` | `UI_Nintendo_Design.md` | `(UD:4-1 対局画面)` |
| `U:章` | `UI_Nintendo_Implementation.md` | `(U:7-4 操作しやすさ)` |
| `N:章` | `UI_Nintendo.md` | `(N:6-1)` |

本文の最後の箇条は「設計はn章、README・AGENTS.md・検証記録を更新」のように、直した文書を書きます。

## 最初に確認する場所

| 作業 | 主な参照先 |
| --- | --- |
| 対局画面・状態遷移・やこび姫の表示 | `src/ShogiMatchGame.vue`、スタイルは`src/ShogiMatchGame.css`、対局画面から切り出した部品は`src/composables/match/` |
| はじめての分岐（どのくらい知ってるか）と、大会へ向かう「つぎはこれ」 | 設計は`docs/first-play-design.md`（はじめての案内は`src/core/welcome.mjs`、教室の始める場所は`src/core/tutorial-map.mjs`の`TUTORIAL_PLACEMENTS`。弱点の練習の行き先（教室の章・問題集の5問）は`src/core/play-coach.mjs`の`practiceDestination`と`PRACTICE_CHAPTERS`、5問の並びは`src/core/problem-set.mjs`の`drillProblems`、竜王戦・名人戦への誘いは`tournamentInvite`）。CPUの段級位の作り直し（15級〜タイトル保持者）の設計は`docs/level-ladder-design.md` |
| ホーム画面と強くなる道 | `src/ShogiMatchGame.vue`の`homeNext`・`homeRoadmapState`、段の判定は`src/core/home-roadmap.mjs`（問題集の解いた記録は`src/core/problem-progress.mjs`から読む）、設計は`docs/home-roadmap-design.md`。実力と実績で「つぎはこれ」とおすすめの強さを変える見立ては`src/core/play-coach.mjs`、対局の中身の記録（自由対局と竜王戦）と弱点の判定は`src/core/play-insight.mjs`、竜王戦の期の途中の「続きを指す」と「○○対策」・次の期へは`src/core/ryuo-next.mjs`、今日の1局・まだ見ていない遊び・あと少しのご褒美は`src/core/home-extras.mjs`、その裏の解析は`src/composables/match/usePlayInsightAnalysis.ts`（竜王戦の統計と共通の浅い読みは`scanAnalysis.ts`。設計は`docs/home-next-adaptive-design.md`） |
| 対局準備の画面 | `src/ShogiMatchGame.vue`の対局準備（`pregameSides`・`pregameCommonRows`・`pregamePickerConfig`）、選択肢の定数は`src/composables/match/pregameOptions.ts`、選択シートは`src/PregamePicker.vue` |
| ブラウザの戻る操作と、来た場所へ戻る | `src/composables/useBackNavigation.ts`、`src/ShogiMatchGame.vue`の`navigateBack`。ほかの画面から開いた画面の戻り先（大会から開いたノート`noteFromTournament`、ノート・図鑑から開いた対局準備`pregameReturn`・`leavePregame`、ノートから開いた図鑑`dexFromNote`・作戦カード`planSheetFromNote`・棋力テスト`skillTestFromNote`）は`ShogiMatchGame.vue`、設計は`docs/return-path-design.md`。画面の間を移る入口を足したら、戻り先も足す |
| 画面の大きさによる配置の切り替え | `src/composables/useResponsiveLayout.ts`（縦積みの盤の段の上限`uiStackBoardMax`→`--stack-board-max`）、縦積みの5段の配置とやこび姫の欄（台詞と補助の包み`shogi-game__dock`）は`src/ShogiMatchGame.css`の「レイアウト: 縦積み」、設計は`docs/stable-board-layout-design.md` |
| 戦法・囲いの手順、完成条件、分類 | `src/core/opening-guide.mjs`（戦法と囲いを駒ごとに合わせる`composeOpeningPlan`と合わない組の`openingPlanCompatibility`）、本番と同じデータでの監査は`src/core/opening-audit.mjs`・`src/core/opening-guide-integrity.test.mjs`・`scripts/opening-guide-audit.mjs`（設計は`docs/opening-guide-integrity-design.md`） |
| やこび姫補助の作戦カード（選び方・解放・完成形の小さな盤と薄い駒） | 目録は`src/core/opening-catalog.mjs`、解放とやこび姫のおすすめ（`recommendPlan`）は`src/core/opening-unlocks.mjs`、完成形は`src/core/opening-formation.mjs`、戦法占いは`src/core/opening-fortune.mjs`と`src/OpeningFortune.vue`（作戦カードのシートと定跡図鑑から開く）、画面は`src/OpeningPlanSheet.vue`と`src/FormationThumb.vue`、対局画面の`planSheet`・`planGhosts`・`planInterruption`（今の局面から組める作戦と残り手数は`planBuildable`、作戦を選べるか・欄を出すかは`planChoiceOpen`・`openingGuideShown`）、設計は`docs/opening-guide-ux-design.md`（分かりやすさの見直しは13章） |
| 定跡エディターの上書きデータ | `src/data/opening-guide-overrides.mjs`（`npm run import:opening-library`で生成） |
| 戦法・囲いの解説文 | `src/core/opening-explanations.mjs` |
| 戦型検出 | `src/core/formation-tracker.mjs`、`src/data/hiragana_suisho_formations.json` |
| やこび姫の助言・称賛 | `src/core/coach-advice.mjs`、AIの候補手を作戦の名前に翻訳して提案する作戦の助言（飛車を振る提案と振り直し）は`src/core/coach-plan-advice.mjs`と対局画面の`offerCoachPlan`・`coachPlanOffer`（設計と、ほかの助言の強化の検討は`docs/coach-plan-advice-design.md`、出る回数の測定は`scripts/coach-plan-advice-report.mjs`）、悪手の理由と相手の狙いは`src/core/coach-reason.mjs`（悪手判定の読み筋と詰めろの確かめの最善手を言葉にする。新しい探索は足さない）、大会の1局の始めの相手の棋風の一言は`src/core/coach-opponent.mjs`、形勢と駒の損得による方針の一言は`coach-advice.mjs`の`situationPolicy`、手筋の名前でほめる一言は`move-praise.mjs`の`TESUJI_PRAISE`、`src/core/move-praise.mjs`、神の一手の基準（対局中と棋譜解析で共通）は`src/core/god-move.mjs`。助言の大幅な強化（設計は`docs/coach-advice-expansion-design.md`）の段階1（最善手の種類を答えを言わずに言う・見逃し・相手のミス・前の対局の弱点・ほめ言葉。新しい探索は足さない）は`src/core/coach-insight.mjs`、出る回数の測定は`npx vite-node scripts/coach-insight-report.mjs --`。段階2（閃きの3段階は2026-10-29に外し、閃きは1回で答えを出す。10-3。相手の狙いの点線の矢印`threatArrow`と悪手で取られる駒の赤い輪`mistakeRingSquare`（`coach-reason.mjs`の`mistakeTarget`、盤は`ShogiMatchBoard.vue`の`threatArrows`・`riskSquares`）、終盤の方針`isEndgame`・`endgamePolicyAdvice`（詰めろの確かめを1回だけ足す））と段階3（格言`proverbAdvice`（格言帳へ`recordProverb`）・大会の物語`storyAdvice`・「なぜ？」の`adviceReason`と顔を押すとさっきの話`addRecentTalk`・`recentTalk`）も`coach-insight.mjs`（設計は10・11章） |
| CPU難易度 | `src/core/strength-settings.mjs`（Lv0〜49の段級位の表。2026-10-22に15級〜タイトル保持者へ作り直し、2026-10-23に下へ24級〜16級を足して50段階にした。各Lvは、もとの校正`CALIBRATION_PRESETS`のどの強さを使うか`source`で持つ。前の保存の移しかえ（v1・v2→今の版3）は`src/core/level-ladder.mjs`、設計は`docs/level-ladder-design.md`の12章）、ロジックAIは`src/core/logic-ai.mjs`（24級〜16級のLv1〜9で、表の`source`を小数のLvにして指す。`logicLevelOf`）、局面の気づきは`src/core/position-awareness.mjs`、マスごとの利きから取り合いの損得を出す計算（見え方のレベル差つき）は`src/core/exchange-eval.mjs`、Lv1〜39の選び方は`src/core/aware-move-choice.mjs`（設計は`docs/logic-ai-design.md`・`docs/cpu-purposeful-moves-design.md`）。Lv10〜48の人間らしい選び方（見えにくさつきの気づき`humanPerception`・判断のぶれ`pickByBelief`・指す前の台無しの確認`blunderKind`・`preventsBlunder`、レベル表`HUMAN_TABLE`）は`src/core/human-model.mjs`で、`aware-move-choice.mjs`が`strength.human`を見て使う（設計と校正は`docs/cpu-human-model-design.md`の12章。今までの選び方との比べは自己対局の`L<n>classic`、間違いの種類の測定は`scripts/cpu-mistake-report.mjs`の`--classic`） |
| CPUの戦法の選び方 | `src/core/cpu-opening-repertoire.mjs` |
| 棋譜解析 | `src/core/kifu-analysis.mjs`、`src/EvaluationGraph.vue`、解析用エンジンの追加と解放は`src/composables/match/analysisEngines.ts`、対局の振り返りは`src/composables/match/useGuidedReview.ts`（台本は`src/core/guided-review.mjs`） |
| リロード復元 | `src/core/match-persistence.mjs` |
| プレイヤー名 | 保存と整え方は`src/core/player-name.mjs`、タイトル画面の名前のボタンと名前の札は`src/ShogiMatchGame.vue`の`playerName`・`nameDialogOpen`、設計は`docs/player-name-design.md` |
| 棋力測定 | 棋力は「このゲームのCPUと五分に指せるLv」。診断（札の目安の幅と測る前の実績の勝ち負け`measurePrior`、測定対局の勝ち負け、31手目からの手の損（中盤・終盤のLvごとの表`LOG_LOSS_TABLES`、重み1/3）のベイズ推定。表はCPUの対局をアプリと同じ解析で読んで作る。1手の損は解析の`measureLoss`。序盤の手は数えない）と、最初の相手を選ぶ札（`MEASURE_START_CHOICES`・`measureStartChoices`）、足りないとき・幅が広いとき（確かめの1局）に続けて測る相手のLv（`measureFollowUp`）・持ち越す手と勝ち負けは`src/core/skill-estimate.mjs`、測定・申告のあとのレーティングの幅（数局で合わせ直す）は`src/core/player-rating.mjs`の`deviation`、対局中の測定の札は`src/ShogiMatchGame.vue`の`measureBand`、測る前の目安は`measurePriorState`、画面は`src/ShogiMatchGame.vue`の`measureStartFrom`（最初の相手の札）・`measureSession`・`measureCarry`・`continueMeasure`・`enterTournamentFromMeasure`（結果から竜王戦の入口へ。測定は大会の難易度を決めるためのもの）、設計は`docs/skill-measure-design.md` |
| 棋力テスト・棋力カルテ | 勝ち負け・テスト・場面採点・札を1つの見立てに合わせる棋力カルテは`src/core/skill-profile.mjs`（`estimateProfile`。1Lvの重さは勝ち負けから学ぶ）、対局画面の`skillProfile`・`applySkillProfileToRating`（テストのあとと平手でレーティングに数える対局のあとにレーティングへ反映）、16問の適応型テストの出し方と採点は`src/core/skill-test.mjs`、問題の束と人に合わせた難しさ（`CPU_TO_HUMAN_OFFSET`・`TYPE_OFFSETS`）は`src/core/skill-test-bank.mjs`（問題集のデータを読むので、テストの画面からだけ読む）、問題は`scripts/build-skill-test-items.mjs`で作る`src/data/skill-test-items.mjs`（手で書き換えない）と問題集の詰将棋、画面は`src/ShogiSkillTest.vue`と対局画面の`openSkillTest`・`finishSkillTest`・`skillTestReport`、対局の場面採点は`src/core/play-content.mjs`（`play-insight.mjs`の要約の`content`）、答えの匿名の送信（同意・公式の公開先だけ）は`src/core/skill-data.mjs`と`firestore.rules`、集めた答えの集計は`scripts/skill-data-report.mjs`、設計は`docs/skill-assessment-design.md`（問いの言葉と採点を合わせ、手筋を名前で決める問題の見直しは10章。まだ設計だけ） |
| 大会（竜王戦）・称号・プロフィール | `src/core/ryuo.mjs`（トーナメント表・棋士の生成・自動対局・昇級降級・シーズンの進行）、`src/core/ryuo-data.mjs`（棋士の名前・戦法）、`src/core/player-character.mjs`（棋士の棋風と特徴・特殊能力、強さ設定への反映、詰みが見える手数）、`src/core/player-abilities.mjs`（8つの能力値。強さはレーティングのまま配分で持つ）、プレイヤー自身の能力（最近の対局の要約`play-insight.mjs`の`axes`から、名鑑の棋士と同じ形で出す。やこびノートの「能力」の項目）と得意戦法・棋風（コレクションの戦型の回数から。分身もこれで指す。`myRepertoire`・`myStyleAttack`、対局画面の`avatarRepertoire`。設計は`docs/tournament-relay-design.md`の28章）は`src/core/my-abilities.mjs`と`src/YakobiNote.vue`の`myAbility`、`src/core/opening-usage.mjs`（戦法と囲いの使用率）、`src/core/ryuo-simulation.mjs`（棋士どうしの自動対局を序盤・中盤・終盤のまねで決める）、`src/PlayerAbilityPanel.vue`（能力のレーダーチャート・ランク・特殊能力・使用率。名鑑と次の相手の札で共通）、設計は`docs/player-abilities-design.md`、`src/core/ryuo-roster.mjs`（期をまたいで残る架空の棋士の名簿と、期の結果での更新）、`src/core/ryuo-league.mjs`（棋界の1年: 年間成績・順位戦・竜王以外のタイトル戦・昇段・将棋大賞）、`src/core/ryuo-names.mjs`（名前）、`src/core/ryuo-repertoire.mjs`（得意戦法）、やこびノートのコレクション（アルバムのページ・カード・挑戦できる・Lvの壁・NEW。囲いは居飛車の囲いと振り飛車の囲いに分け、ページの切り替えは見出し「戦法」「囲い」「そのほか」でまとめる`ALBUM_PAGES`・`ALBUM_PAGE_GROUPS`・`albumPageId`）は`src/core/collection.mjs`の`albumCards`・`levelWall`と`src/YakobiNote.vue`の`collection`（カードから作戦カードのくわしい画面へは対局画面の`openPlanFromNote`。設計は`docs/player-world-note-design.md`の4章・8章）、やこびノートの各項目を1画面に収める並び（項目の欄`shogi-note__panel--fit`・枠の中で動く一覧`shogi-note__scroll`と下の端を薄くする`src/composables/vScrollMore.ts`・項目の中のタブ`shogi-note__segmented`（`recordView`・`styleSide`・`tournamentView`）・2列の境目`wide`）と「戦型」の項目の使用率と勝率の表（`src/core/style-usage.mjs`の`rookSplit`・`battleSplit`・`usageTable`・`repertoireTable`）は`src/YakobiNote.vue`（設計は`docs/player-world-note-design.md`の8章）、`src/core/ryuo-book.mjs`と`src/RyuoRosterBook.vue`（棋士名鑑。やこびノートの「棋士名鑑」の項目。絞り込みは`bookMembers`、くわしい情報は重ねて開くシート（横長の広い画面では一覧の右にいつも並べ、選ぶ前は先頭の棋士`side`）。ノートの「大会」の項目は`src/YakobiNote.vue`の`tournament`。設計は`docs/player-world-note-design.md`の3章）、`src/core/ryuo-strength.mjs`（棋士のレーティング・難易度によるLvへの換算・自動対局の勝率。世界の物差し（レーティングの差の0.6倍をLvの差にする。頭打ちなし）は`worldCpuLevel`・`worldRating`）、大会で共通の「世界」（難易度で決め、期をまたいで固定する基準のLv。保存・難易度の変え方・強くなった／苦しい期の見直し・格上／格下の札`rankTag`、難易度のシートの選択肢と段級位の目安`difficultyOptions`・`levelGradeName`・`difficultyName`）は`src/core/tournament-world.mjs`、いちばん上の難易度「本物」（棋力に合わせず、レーティングを段級位の強さに置く`REAL_WORLD`・`REAL_WORLD_POINTS`・`realExactLevel`。善彦はいつもLv49）は`ryuo-strength.mjs`と`ryuo.mjs`の`seasonPlayer`・`engine-game.mjs`の`realPlayerLevel`（設計は`docs/tournament-strength-spread-design.md`の8・9章）、期の相手のLvは`ryuo.mjs`の`seasonLevelFor`（世界を持たない前の期は前の換算）、何期でどこまで登れるかの試算は`scripts/tournament-career-sim.mjs`、設計は`docs/tournament-strength-spread-design.md`、`src/core/ryuo-career.mjs`（キャリアと保存）、`src/core/ryuo-stats.mjs`（統計・レーダーチャート・解説）、`src/core/ryuo-stages.mjs`（期を①組のランキング戦・②決勝トーナメント・③番勝負の3段階に分けて見せる形。設計は`docs/ryuo-stages-design.md`）、`src/core/player-profile.mjs`（称号）、名人戦（順位戦から名人へ。竜王戦とは別の暦）は`src/core/meijin.mjs`（順位戦の世界・期・順位表・昇級と降級点・プレーオフ・七番勝負・キャリアと保存。保存と暦に依存しない形で、後で作る棋士モードからも呼ぶ）と`src/ShogiMeijin.vue`（入口・期の画面・結果）・`src/MeijinPagoda.vue`（五重塔）・`src/MeijinLeagueTable.vue`（リーグ表）、対局画面の`meijinSeason`・`recordMeijinOutcome`（名人戦の分身の期は`meijin.mjs`の`asAvatarMeijinSeason`・`playMeijinSpectatorGame`、回戦の中継ボード（リーグ表の行にいまの対局。22章）は大会の画面の`startMeijinLive`・`meijinLiveRows`と`relay-live.mjs`の`meijinLiveRound`・`meijinHiddenKeys`、`meijin.mjs`の`applyMeijinRoundResults`、欄は竜王戦と共通の`src/RelayLivePanel.vue`、行は`MeijinLeagueTable.vue`の`live`、対局画面の`playMeijinWatchGame`。自分の出ない番勝負の観戦（どのクラスの期もA級1位が名人に挑む。1局ずつ本局で見て残りを指し直し、名簿は確定してから）は`meijin.mjs`の`replayMeijinRest`・`settleMeijinRest`・`meijinRestOpen`、`relay-live.mjs`の`meijinAfterRounds`・`applyMeijinWatchedRound`・`meijinFinale`、大会の画面の`startMeijinAfterWatch`・`nextMeijinAfterRound`、対局画面の`settleMeijinSeason`。設計は`docs/tournament-relay-design.md`の21〜23章）、設計は`docs/meijin-design.md`、順位戦の世界（クラスごとの順位・降級点・名人）は名簿の`roster.junni`に1つだけ持つ（作る・照らし合わせる・控え（`member.junni`・名人）を書くのは`src/core/ryuo-league.mjs`の`createJunniWorld`・`syncJunni`・`writeJunniToMembers`、1期進める・参加・前の保存の移しかえは`src/core/junni-world.mjs`。ほかの場所で`member.junni`や名人を書き換えない。設計は`docs/player-world-note-design.md`）、`src/ShogiTournament.vue`（タイトル画面から入る大会の画面）、棋士の世界（名簿）を最初に戻す（大会の選択のいちばん下のボタン`data-world-reset`。プレイヤーの竜王・順位戦のクラスは写す。期・挑戦の途中は戻せない）は`src/core/world-reset.mjs`の`resetRoster`・`worldResetBlocker`と対局画面の`worldResetState`・`resetTournamentWorld`（設計は`docs/player-world-note-design.md`の7章）、大会を途中でやめる（大会の選択の`data-withdraw`の行。竜王戦・名人戦は残りを不戦敗にして期を最後まで決める棄権、奨励会は退会、研修会はやめる）は`src/core/tournament-withdraw.mjs`の`withdrawRyuoSeason`・`withdrawMeijinSeason`・`withdrawOptions`、`shoreikai.mjs`の`withdrawShoreikaiRun`と対局画面の`tournamentWithdraw`・`withdrawTournament`（設計は`docs/tournament-withdraw-design.md`）、大会の対局中の舞台（対局の札・開幕の札・封じ手・タイトル戦の背景と肩書）は`src/core/match-stage.mjs`と`src/ShogiMatchGame.vue`の`matchStage`・`stageCard`（設計は`docs/match-stage-design.md`。相手の顔・一言・特殊能力の札とほかの対局の速報（段階1）と中継の勝率バー・控室の一言（段階2）は`src/core/match-presence.mjs`と対局画面の`opponentFace`・`presenceLine`・`startPresence`・`broadcastShown`・`noteRoomComment`、竜王戦の山と名人戦の暮れる空の背景・終局の判子（段階3）は`match-stage.mjs`の`scenery`・`skyPhase`と`match-presence.mjs`の`finishStamp`、対局画面の`showFinishStamp`、秒読みの演出（段階4）は`src/core/byoyomi.mjs`と`src/composables/match/useByoyomi.ts`（名札の輪は`BoardView.vue`の`playerCountdown`、エントリー設定の行は`ShogiTournament.vue`・`ShogiMeijin.vue`の「秒読みの演出」）、設計は`docs/tournament-match-presence-design.md`。タイトル戦（二日制）の1日目のまとめ・封じ手予想と開封の札・勝負メシ・観戦記は`src/core/title-day.mjs`と`src/TitleDaySheet.vue`、対局画面の`titleDay`・`sealTitleDay`・`lunchOffer`・`writeTitleKansenki`、ノートの観戦記は`src/YakobiNote.vue`の`kansenki`（設計は`docs/title-match-day-design.md`）。勝負メシのその後（お昼の休憩の札・料理の一言・相手の一言・おまかせ・控室の注文・午後の「○○パワー」・勝ちメシと勝負メシ帳）は`title-day.mjs`の`MEAL_NOTES`・`lunchCard`・`lunchCoachLine`・`lunchOpponentLine`・`lunchAutoDue`・`lunchRushDue`・`mealPowerDue`・`loadMealBook`・`noteMealBook`・`mealBookView`と、対局画面の`chooseLunch`・`withMealPower`・`recordTitleMeal`・`resultMeal`、ノートの`mealBook`（設計は`docs/title-match-day-design.md`の8章）。昼休みと封じ手のあとの休憩のふりかえり（盤で1手ずつ戻す・形勢が動いたところ）は対局画面の`dayBreak`・`daySummaryView`・`dayReview`と`TitleDaySheet.vue`、見どころは`title-day.mjs`の`dayHighlights`（9章）。速報のため、同じ回戦のほかの試合はプレイヤーの局の前に決める（`ryuo.mjs`の`advanceBracket`、`meijin.mjs`の`pending.others`））、期の終わりの表彰式の賞状と賞状帳は`src/core/season-award.mjs`と`src/SeasonAward.vue`（縦書きの字は`src/VerticalText.vue`で1字ずつ箱に入れて並べる。`writing-mode: vertical-rl`の文をそのまま書くと、字体によって漢字が潰れる。賞状は期が終わったときに`ShogiMatchGame.vue`の`awardRyuoSeason`・`awardMeijinSeason`が足す。紙の幅はブラウザに計算させず、`SeasonAward.vue`の`fitPaper`が各行の位置を測って決め、画面に合わせて縮める（iPadのSafariで紙が細くなったため。設計は4章）。設計は`docs/season-award-design.md`）、`src/RyuoMountain.vue`（期の画面のドット絵の山の地図「竜王への道」。配置は`src/core/ryuo-mountain-layout.mjs`、道の段は`src/core/ryuo-road.mjs`、設計は`docs/ryuo-ui-renewal-design.md`）、`src/RyuoBracket.vue`（試合の札のトーナメント表）、`src/RyuoSeries.vue`（番勝負の星取り）、`src/RadarChart.vue`、`src/RyuoLadder.vue`（組の階段）、`src/ShogiMatchGame.vue`の`ryuoSeason`・`ryuoGame`、統計のための裏の解析は`src/composables/match/useRyuoStatsAnalysis.ts`、設計は`docs/tournament-design.md`、ライバルの天鷺羽音と父の天鷺善彦（物語の人物・台詞。羽音は敬語を使わない。羽音の人物と口調はノベルのリポジトリから写した`docs/hanane-character.md`に合わせる）は`src/core/ryuo-story.mjs`、羽音の立ち絵は対局画面の開幕の札だけで`src/HananePortrait.vue`と`ryuo-story.mjs`の`HANANE_PORTRAIT`（VS画面を含め、ほかの場面はドット絵の`HANANE_SPRITE`）、設計は`docs/hanane-rival-design.md`（立ち絵は12章）、制度の調査は`docs/ryuo-sen-research.md`。研修会と奨励会は下の「大会（研修会）」「大会（奨励会）」の行 |
| 大会の中継（観戦） | ほかの棋士どうしの対局を中継の記録として見る。局の設定・目標の形勢の線・1手の選び方・投了・持ち時間と時刻は`src/core/relay-game.mjs`（勝ち負けと展開は`ryuo-simulation.mjs`の記録の`story`のまま。エンジンはその線に沿って指すだけ）、見られる対局の一覧（竜王戦・名人戦の期から）は`src/core/relay-games.mjs`、解説者・聞き手・棋譜読み上げ・視聴者のコメント（書き手の種類`VIEWER`・`POOL_KIND`、初心者の質問と答え`NEWBIE`、運営の帯、駒割りと玉の守りの数え方`materialSwap`・`materialText`・`kingGuard`。設計は12章と12-5。読み上げ`RELAY_READER`・善彦の口調（`speak`の4つめ）・解説への反応`react`・下に止まる大きなコメント`UNDER`（画面は`RelayViewer.vue`の`under`）は25章。コメントの条件・名詞の差し替え（視聴者の呼び方`fan`・格上`stronger`・戦法の短い呼び方`shortOpening`・珍しい囲い`RARE_CASTLE`）と解説に連動して遅れて流す`lag`（`REACT_LAG`）は27章。二日制のタイトル戦の配信の例（会場・視聴者の数の節目`AUDIENCE_MARKS`・昼食の掛け合い・封じ手・形勢の入れ替わり`leaders`・投げどころ・番勝負の角番（項目の`series`は`relay-games.mjs`の`seriesBefore`）・終局のふり返り）は30章。善彦が解説するときの配信の例の掛け合い（聞き手の丁寧な紹介・「タイトルホルダー同士」・棋譜読み上げへの振り・肩書`titleOf`・読み上げの若手`relayCast`の`reader`）は36章、ほかの場面の善彦の言い方の案を局ごとに選ぶ`yo`は37章（善彦らしくない行の直しは41章、善彦の対局中の一言`match-presence.mjs`の`LINES.yoshihiko`と心の声`THOUGHTS.yoshihiko`を解説の口調にそろえたのは42章、モデルの羽生善治・藤井聡太の話し言葉に寄せたのは43章。ユーザーが入力した善彦の台詞は変えない）、善彦への視聴者のつっこみを場面ごとに全部流す`reactAll`は38章、羽音の解説の言い方を局ごとに選ぶ`ha`は39章、ノベルの設定の口調に合わせたのは44章）・心の声・札は`src/core/relay-commentary.mjs`（保存しない。棋譜と種から毎回同じものを作る）、同じ回戦のほかの結果は`relay-games.mjs`の`relayRoundNews`、作った棋譜と視聴済みの印は`src/core/relay-store.mjs`（`relay:v1`）、エンジンで棋譜を作るのは`src/composables/match/useRelayGenerator.ts`（対局用とは別の軽いエンジン。自分の対局中は作らない）、分身を出場させる（入口の「出場する」の上のボタン`data-avatar-enter`。ふつうの期の自分の席を分身にし、記録はふつうの期と同じ。違うのは「対局する」が「観戦する」になることだけ。レーティングには数えない。17章。分身の記録と分身の期の難易度は自分の能力値に入れない（いつもの世界を保存しない`commitTournamentWorld`の`keep`、分身の強さはその期の世界で出す`avatarMember`、ノートの難易度`ryuoAbilityDifficulty`は分身の期を除く）。40章）は`src/core/ryuo.mjs`の`asAvatarSeason`・`playSpectatorGame`と対局画面の`enterRyuoSeason`・`avatarMember`・`playRyuoWatchGame`、大会の画面の`spectating`・`commitAvatarGame`・`arriveFromGame`、回戦の中継ボード（「観戦する」でトーナメント表に移り、同じ回戦の対局が同時に進む。札に何手目・形勢のバー・視聴者数。手数と形勢は筋書きから決めエンジンは使わない。同じ回戦の結果はボードで終局するまで伏せる。18章）は`src/core/relay-live.mjs`（`liveRound`・`liveState`・`hiddenRoundIds`・`maskBracketView`）、ほかの組の注目の棋士（羽音・善彦・推し）の同じ時の対局をボードに足すのは`relay-live.mjs`の`elsewhereGames`（ほかの組は組ごとの種`groupRng`で決め、先に決めた表は`ryuo.mjs`の`previewGroupBrackets`。本局にしない。欄の「注目の対局」の行は`RelayLivePanel.vue`の`featured`と大会の画面の`liveFeatured`。31章）、表の札の1行は`src/RyuoBracket.vue`の`live`、大会の画面の`startLive`・`openLiveGame`・`finishLive`・`maskedTable`、中継を途中の手から開くのは`RelayViewer.vue`の`startAt`、分身の対局をエンジンが本当に指す本局（20章の段階1。両側とも対局用と同じCPU・棋風・定跡で指し、盤の上で勝ち負けを決める。投了・千日手・途中の保存`engine-game:v1`）は`src/core/engine-game.mjs`（`playEngineGame`・`engineGameResult`）とブラウザの`src/composables/match/useEngineGame.ts`、期への記録は`ryuo.mjs`の`playSpectatorGame`の`real`、大会の画面の`startRealGame`・`realSource`・`watchResultOnly`。分身の回戦の全局を本局にする（20-9の段階2）: 棋士どうしのLv`engineLevel`・強さの表`LEVEL_STRENGTH`・主要キャラ`isMainCharacter`・観戦用の読み`lightReading`・本局の設定`realGameSpec`は`engine-game.mjs`、同じ回戦のほかの局の結果の差し替えは`ryuo.mjs`の`applyRoundResults`（`playSpectatorGame`の`round`）、何局も同時に指すエンジンの並び（台数`setEngines`・読む順`setPriority`）は`useEngineGame.ts`、大会の画面の`startLive`（スマホ`phoneScreen`と結果だけ見るは主要キャラの局だけ）・`stopRealGames`・`finishLive`。敗退後の観戦を本局にする（20-10の段階3）: 敗退した時点の期の形`rest`と、決めてある結果`overrides`で残りを指し直す`replayRest`・確定`settleRest`・`restOpen`は`ryuo.mjs`、見終えた回戦の結果で指し直す`applyWatchedRound`は`relay-live.mjs`、大会の画面の`playAfterRound`・`nextAfterRound`（`watch-round`・`watch-settle`）、名簿を進めるのは残りを確定してから（対局画面の`finalizeRyuoSeason`・`applyRyuoWorld`・`settleRyuoSeason`）、中継の画面は`RelayViewer.vue`の`live`（棋譜を作らず本局の手を受け取る）、敗退後の観戦（結果の画面の「このあとの対局を観戦」。同じトーナメント表のボードで1回戦ずつ進め、後ろの回戦は伏せ、最後に竜王の発表。19章）は`src/core/ryuo-watch.mjs`（`watchSteps`・`stepsAfterElimination`・`watchFinale`）と`relay-live.mjs`の`afterWatchRounds`・`hiddenTables`・`maskSeriesViews`、大会の画面の`startAfterWatch`・`nextAfterRound`・`endAfterWatch`、見届けた回戦の数の保存は`src/core/ryuo-watch-store.mjs`（`ryuo-watch:v1`）、観戦の期のプロ並みの棋譜は`relay-game.mjs`の`relayQuality`、棋士ごとの投了の早さ（潔い・ふつう・粘る・最後まで指す。本局の`shouldEngineResign`と筋書きの`shouldResign`が使う。名鑑の「投了」の行）は`src/core/resign-style.mjs`の`resignStyleOf`・`resignsBy`（29章）、負ける側が大差のまま投了しないための崩れ方（詰みを点に直す`scaledCp`、大差なら駒を渡す手も選ぶ`DESPERATE_LEAD`。前の版の崩れた棋譜は`relay-store.mjs`の`isStaleRelayGame`で作り直す。設計は15章）と、その測定`scripts/relay-resign-report.mjs`（Nodeのエンジンで何局も作り、終わりの形勢を出す）、勝率バーの一言（「○○優勢」）は`relay-game.mjs`の`rateVerdict`、画面は`src/RelayViewer.vue`（解説の欄は見たところまで全部残してスクロール、流れるコメントの字は盤の幅に合わせる。16章。盤面の反転は`flipped`と「反転」のボタン`data-relay-flip`。32章。流れるコメントが重ならない置き方は`src/core/danmaku-lanes.mjs`の`placeComment`と`RelayViewer.vue`の`launch`。33章。ニコニコの置き方をもとに、4秒で流し、探し始める高さを無作為にして欄の全体に散らすのは45章。コメントの段を名札と残り時間に重ねないのは`launch`の`laneBounds`、中継ボードの欄の予想のシートを戻る操作で先に閉じるのは`RelayLivePanel.vue`の`closeSheet`。34章の点検）と一覧`src/RelayGameList.vue`、入口は`src/ShogiTournament.vue`の`openRelayList`・`watchMatch`（帯の「中継」・次の相手のシート）、`src/RyuoBracket.vue`の`watchable`（決着した札の▶）、`src/ShogiMeijin.vue`の`relay`、中継の楽しみ（24章）の選び方・記録・保存（勝敗の予想`pickWinner`・`settlePrediction`・`relay-predict:v1`、次の一手の候補`quizChoices`・`relay-quiz:v1`、見どころ`highlightPlan`、研究ノート`addNote`・`relay-notes:v1`）は`src/core/relay-fun.mjs`、予想の行とシートは中継ボードの欄`src/RelayLivePanel.vue`と大会の画面の`pickPrediction`・`predictView`、次の一手・見どころ・大盤解説・☆ノートは`RelayViewer.vue`の`startQuiz`・`startHighlights`・`startBigBoard`・`saveNote`（札は盤に重ねず欄の上に出す）、研究ノートの札とシートは`src/YakobiNote.vue`の`data-note-study`、自分で指す期の対局後の回戦の中継ボード（自分の対局のあと、同じ回戦のほかの対局を分身の期と同じボードで見て、本局の結果で回戦を決め直す。35章）は`relay-live.mjs`の`playedRound`・`meijinPlayedRound`、`ryuo.mjs`の`replayUserRound`・`meijin.mjs`の`replayMeijinUserRound`、対局画面の`notePlayedRound`・`playedBoard`・`applyPlayedRound`、大会の画面の`startPlayedLive`（`played`・`meijin-played`）、設計は`docs/tournament-relay-design.md` |
| 寄せの記録・観戦記・自分の対局の中継 | 最後の王手の連続から「N手詰め」を数える処理と記録（`mate-finish:v1`）は`src/core/mate-finish.mjs`（`finishingMate`・`addMateRecord`）、終局の判子の重さは`match-presence.mjs`の`finishStamp`の`mateTier`、対局画面の`noteMateFinish`・`finishMate`（判子の下`data-finish-mate`・結果の窓`data-result-mate`）、ふつうの大会の対局の観戦記は`src/core/game-kansenki.mjs`の`writeGameKansenki`とタイトル戦の`title-day.mjs`の`writeKansenki`の`mate`（対局画面の`writeTournamentKansenki`・勝率の記録`gameRates`）、自分の対局の棋譜（`my-games:v1`）は`src/core/my-games.mjs`（`myGameRecord`・`myRelaySpec`）と対局画面の`saveOwnGame`・`moveSeconds`・`watchOwnRelay`、残した手を読み直す中継は`relay-game.mjs`の`replayKifuGame`（`useRelayGenerator.ts`が`spec.kifu`で使う）、大会の画面の`relayKey`・`openMyRelay`・`myRelayEntries`（一覧の「あなたの対局」は`relay-games.mjs`の`RELAY_SECTIONS.mine`）、解説の「あなたの対局」と「最後はN手詰め」は`relay-commentary.mjs`の`isYou`・`givesCheck`、ノートの「寄せの記録」は`src/YakobiNote.vue`の`mates`、設計は`docs/mate-finish-design.md` |
| 大会（研修会） | 規定・研修会員の世界・入会試験・例会・指導対局（駒落ち）・A2とSと保存は`src/core/kenshukai.mjs`（画面・保存の仕組み・暦に依存しない。昇級の記録と降級点は`shoreikai.mjs`の関数を使う）、やこび姫の台詞と判子は`src/core/kenshukai-speech.mjs`、画面は`src/ShogiKenshukai.vue`（入口・入会試験・例会・Sクラス。奨励会の画面の部品と名札掛け`ShoreikaiNameboard.vue`を使う）、対局画面の`kenshukaiCareer`・`enterKenshukai`・`startKenshukaiGame`・`recordKenshukaiOutcome`・`transferKenshukai`（`ryuoGame.event`が`kenshukai`。指導対局は`startRyuoMatch`で駒落ちの開始局面にする）、奨励会6級への編入は`shoreikai.mjs`の`createShoreikaiRun`の`transfer`と奨励会のキャリアの`transfer`、賞状は`season-award.mjs`の`kenshukaiAward`、設計は`docs/kenshukai-design.md` |
| 大会（奨励会） | 規定・奨励会員の世界・入会試験・例会・三段リーグ・挑戦（run）と経歴の保存は`src/core/shoreikai.mjs`（画面・保存の仕組み・暦に依存しない。後で作る棋士モードからも呼ぶ）、やこび姫・師匠・羽音の台詞と判子は`src/core/shoreikai-speech.mjs`、画面は`src/ShogiShoreikai.vue`（入口・入会試験・例会・三段リーグ・不合格・退会・四段の式。大会の画面`ShogiTournament.vue`の中に出す）と`src/ShoreikaiNameboard.vue`（名札掛け）、対局画面の`shoreikaiCareer`・`enterShoreikai`・`startShoreikaiGame`・`recordShoreikaiOutcome`（`ryuoGame.event`が`shoreikai`）、四段の免状は`src/core/season-award.mjs`の`shoreikaiAward`、やこびノートの「大会」の奨励会の札は`src/YakobiNote.vue`、設計は`docs/shoreikai-design.md` |
| 将棋教室 | `src/ShogiTutorial.vue`、`src/core/tutorial-curriculum.mjs`、盤の上のひとこと（文・マス・位置）と吹き出しの色の札は`src/core/tutorial-callout.mjs`、読み上げの読み方は`src/core/tutorial-voice.mjs`、判定は`src/core/tutorial-runner.mjs`（問題集の問題と攻めくらべは`src/core/tutorial-problem.mjs`。対局画面から読まない。駒得するまで指す課題・角打ちの隙の駒の損得の読みは`src/core/material-tactics.mjs`）、地図・メダル・称号は`src/core/tutorial-map.mjs`、利きメガネの所持・にがての記録・格言帳は`src/core/tutorial-progress.mjs`、設計は`docs/nyumon-mode-design.md` |
| 盤の見える化 | 駒の値段と駒得の数字は`src/core/piece-points.mjs`（入門用のtier表・教室の値と、図鑑のAI用の表・対局の「駒の損得」で使う`AI_PIECE_POINTS`、札の点数`materialBalance`と盤に浮かべる数字`materialPops`（取った駒の元の値段と成りの分`promotionBonus`を分ける）を管理。対局の札は`src/ShogiMatchGame.vue`の`materialChip`、設計は`docs/material-guide-design.md`）、取られるマス・玉の逃げ道・取り返し・利いているマスの数は`src/core/board-insight.mjs`（取られるかの判断はCPUと同じ`src/core/exchange-eval.mjs`の取り合いの計算）、利きの地図は`src/core/learning-setup.mjs`の`attackMap` |
| 将棋問題集 | `src/ShogiProblemSet.vue`、問題とやこび姫の台詞は`src/core/problem-set.mjs`、対局で見逃したn手詰めの「あなたの対局から」の問題（解析の読み筋を答えにし、違う詰み方は詰み探索で確かめる。問題集の「あなたの対局」の棚と復習の箱）は`src/core/review-problems.mjs`と`problem-set.mjs`の`judgeGameDeviation`、読み筋の確かめは`problem-solver.ts`の`isMatingLine`（設計は`docs/missed-mate-problems-design.md`）、練習問題の正誤判定の詰み探索は`src/core/problem-solver.ts`（正解は書かず探索で決める）、詰将棋（駒の少ない詰将棋と実戦詰将棋）と詰将棋図巧のデータは`src/data/tsume-problems.mjs`・`src/data/jissen-tsume-problems.mjs`・`src/data/zukou-problems.mjs`（外部データの手順で判定する。手で書き換えない） |
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
- 補足が要るときは、本文を1行空けて箇条書きで書きます。設計原則の書き方は上の「コミットの本文と、設計原則の書き方」。

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
- 縦画面（縦積み）では、盤の大きさと位置を中身で変えないでください（`docs/stable-board-layout-design.md`）。
  - 盤の段は`--stack-board-max`まで、残りはやこび姫の欄（`shogi-game__dock`。最低の高さ`--stack-dock-min`を先に取る）です。台詞や補助の欄に何を足しても、盤は動きません。
  - 補助の欄に新しい札を足すときは、`shogi-game__plan-interrupt`か`shogi-game__rook-choice`の形にします。札のあいだは作戦カードなどがしまわれ、ボタンが横1列になります。
  - 対局の札（上の欄）に、対局の途中で出たり消えたりする行を足さないでください。足すなら、最初から行を取っておきます（戦型の行と同じ）。
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
| 赤い輪 | 利きメガネで、駒を選んだとき、動かすと取られて損をする移動先。やこび姫が悪手の理由で「取られちゃう」と言った駒の升（次に自分が指すまで） | `BoardView.vue`の`.risk-ring`（固定の輪は`riskSquares`） |

- 図鑑の凡例（`ShogiReferenceDex.vue`の`__swatch--*`）と、教室の吹き出しの色の札（`ShogiTutorial.vue`の`__swatch--*`。「緑のマス」などの言葉の前に付く）は、盤上の色と同じ色相にします。
- 升の色を変えるときは、台詞や凡例にある色の名前（「緑のマス」など）も同じ変更で直します。
- 対局中の矢印（危険な定跡手の黄色、AI候補の赤など）は升の強調とは別の表示で、この表の対象外です。やこび姫が言った相手の狙いは**点線**の矢印で、色は「駒の利き」と同じ（先手の狙いは青、後手の狙いは赤。`BoardView.vue`の`threat-black`・`threat-white`）にして、AI候補の赤い実線と見分けます。
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
  - 大きさは390×844（スマホ縦）・820×1180（タブレット縦）・1366×768（デスクトップ）です。どれでも横にはみ出さない（`scrollWidth`が`clientWidth`以下）ことと、写真で重なり・切れがないことを見ます。
  - `game.html`は`src/`ではなく`dist/`を読み込みます。確認の前に`npm run build`を実行してください。
  - Viteの開発サーバーを起動したままビルドし直すと、古い`dist/`のJSが配信され続けることがあります。ビルドし直したら、開発サーバーを起動し直すか、キャッシュしない静的サーバーを使ってください。
  - WASMエンジンを動かすには、サーバーがCOOP/COEPヘッダーを返す必要があります。
  - ブラウザ操作の自動化ツール（Playwright）は、リポジトリの依存関係に入っていません。使うときは、リポジトリの外に用意してください（クラウドの作業環境には入っています。`/opt/node-tools/node_modules/playwright`）。
  - 手順は次のとおりです。`serve-static.mjs`はCOOP/COEPを返し、キャッシュさせない静的サーバーです。`browser-check.mjs`は3つの大きさで開き、はじめての案内と段級位のお知らせ（`[data-ladder-notice-ok]`）を飛ばして、ホームのタイル・ボタンを順に押し、写真とはみ出しを出します。

    ```sh
    npm run build
    node scripts/serve-static.mjs 8766 &   # http://127.0.0.1:8766/game.html
    node scripts/browser-check.mjs --out <一時の置き場所> --tile 大会 --click '[data-tournament="ryuo"]'
    ```

    - 写真や一時の確認用スクリプトは、リポジトリの外（作業用の一時フォルダー）に置きます。
    - 途中の状態（竜王戦の期の途中など）から見るときは、`--seed`に保存の中身のJSON（`{ "ryuo-career": …, "ryuo-roster": … }`。キーは`yacobihime:shogi-match:`の後ろで、`:v1`などの版も含める）を渡します。保存の名前は各モジュールの`*_KEY`（`export const …_KEY`）にあります。
    - 込み入った操作は、`browser-check.mjs`を写して一時の置き場所で書き換えます。押す場所は、なるべく`data-*`の属性（`[data-watch-enter]`など）で指します。
    - 大会はホームのタイル「大会」→`[data-tournament="ryuo"]`（竜王戦）・`"meijin"`（名人戦）などで入ります。

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
- 依頼を終えたら、下の「いまの状態と次の候補」を直します。

## いまの状態と次の候補（引き継ぎ）

会話を消したあとに続きを頼まれたら、ここと`git log --oneline -20`から始めます。くわしい経緯は各設計文書の最後の章にあります。

- いまの主な作業: 大会の中継（観戦）。`docs/tournament-relay-design.md`の11章（中継）・12章（視聴者のコメントの種類）・13章（分身で観戦参加・回戦ごとの観戦・敗退後の観戦・プロ並みの棋譜）まで実装し、mainに公開済み（2026-10-28）。15章（優勢なのに投了の直し・勝率バーを盤の上へ・名前の札と「○○優勢」）と12-5（視聴者のコメントの書き手を8種類足した）もmainに公開済み（2026-10-28）。13-6（観戦の期をふつうの竜王戦と同じ画面で進める）もmainに公開済み（2026-10-28）。16章（解説をスクロールで読み返す・コメントの字を盤の幅に合わせる）と17章（観戦はエントリーの設定の「対局: 観戦」にし、ふつうの竜王戦と同じに数える）もmainに公開済み（2026-10-28）。18章（入口の「分身を出場させる」と、トーナメント表で同じ回戦の対局が同時に進む回戦の中継ボード）もmainに公開済み（2026-10-28）。19章（敗退後の「このあとの対局を観戦」も同じトーナメント表のボードで1回戦ずつ見る）もmainに公開済み（2026-10-28）。
- 2026-10-28の依頼（3つ。mainに公開済み、2026-10-28）: やこび姫の助言の強化の段階2・3（`docs/coach-advice-expansion-design.md`の10・11章）、人間らしいCPUの選び方とレベル表（`docs/cpu-human-model-design.md`の12章。Lv10〜48、強さは今の表にそろえた）、中継の解説とコメントの追加（`docs/tournament-relay-design.md`の25章）。
- 観戦の画面の表示崩れの確認と修正（`docs/tournament-relay-design.md`の26章。6つの大きさ。mainに公開済み、2026-10-28）。
- 中継のコメントに条件を割り当て、名詞を差し替え、解説と連動させた（`docs/tournament-relay-design.md`の27章。mainに公開済み、2026-10-28）。
- 大会の難易度の強さの目安（段級位）と、いちばん上の難易度「本物」（実際の大会の強さ・観戦はプロの強さの本局・善彦はいつもLv49）（`docs/tournament-strength-spread-design.md`の8・9章）、分身の得意戦法と棋風（`docs/tournament-relay-design.md`の28章）。mainに公開済み（2026-10-29）。
- 観戦の対局の投了を遅らせ（ふつうは5手詰めあたりまで指す）、棋士ごとに投了の早さ（潔い・ふつう・粘る・最後まで指す）を持たせた（`docs/tournament-relay-design.md`の29章）。mainに公開済み（2026-10-29）。
- 二日制のタイトル戦の配信のコメントの例（約160行）を、条件と名詞の差し替えで中継に足した（`docs/tournament-relay-design.md`の30章）。mainに公開済み（2026-10-29）。
- 観戦の中継ボードで、ほかの組の羽音・推しの対局も見に行けるようにした（欄の「注目の対局」の行。`docs/tournament-relay-design.md`の31章）。mainに公開済み（2026-10-29）。
- 中継の盤面の反転（「反転」のボタンとFキー。`docs/tournament-relay-design.md`の32章）。mainに公開済み（2026-10-29）。
- 棋士の世界を最初に戻すボタン（`docs/player-world-note-design.md`の7章）と、羽音の勝ち上がり補正（+120）の廃止（`docs/hanane-rival-design.md`の13章）。mainに公開済み（2026-10-29）。
- 「なぜ？」が出ると立ち絵が消える不具合の修正（顔の上の透明なボタンが全体のボタンの書式に負けていた。`docs/coach-advice-expansion-design.md`の11-3）。mainに公開済み（2026-10-29）。
- 閃きの3段階を外し、1回押せばすぐ矢印と答えを出す元の形に戻した（対局準備の「閃きの出し方」も消した。`docs/coach-advice-expansion-design.md`の10-3）。mainに公開済み（2026-10-29）。
- 観戦の流れるコメントを、ニコニコ動画のように前のコメントに追いつかない段へ流し、重ならないようにした（`docs/tournament-relay-design.md`の33章）。mainに公開済み（2026-10-29）。
- 大会を途中でやめる（竜王戦・名人戦の棄権、奨励会の退会、研修会をやめる。`docs/tournament-withdraw-design.md`）。mainに公開済み（2026-10-29）。
- 観戦の画面とゲームデザインの点検と修正（クイズ中の読み筋・分身の対局の「次の相手」・コメントと名札・押しやすさ・横向きのスマホ・予想のシートと戻る操作・見どころのあとの手数・「結果まで進める」の待ち。`docs/tournament-relay-design.md`の34章）。mainに公開済み（2026-10-29）。
- iPadの縦画面で賞状の紙が細く縮んで字が切れる不具合の修正（`docs/season-award-design.md`の4章）。mainに公開済み（2026-10-29）。
- 大会で詰ませて勝ったときの寄せの記録と演出（N手詰め・自己最長・ノートの寄せの記録）、ふつうの大会の対局の観戦記、自分の対局を中継で振り返る（`docs/mate-finish-design.md`）。mainに公開済み（2026-10-29）。
- 来た場所へ戻る（大会の結果から開いたノートの「大会へ戻る」、ノートから開いた作戦カード・対局準備・図鑑・棋力テストの戻り先、図鑑の戦法占いからの対局準備。`docs/return-path-design.md`）と、大会の対局のあとに必ず観戦記を書く（舞台の札がない局も。`docs/mate-finish-design.md`の3章）。mainに公開済み（2026-10-29）。
- 自分で指す期も、対局後に同じ回戦のほかの対局を中継ボードで見る（竜王戦・名人戦の順位戦。速報で伝えた対局は終局した札、ほかは本局、見終えたら本局の結果で回戦を決め直す。`docs/tournament-relay-design.md`の35章）。mainに公開済み（2026-10-29）。
- やこびノートの画面の見直し（項目ごとにスクロールなしにする・「戦法」を「戦型」にして使用率を出す・大会を項目の中のタブで分ける・棋士名鑑を2列にして×を丸に・コレクションの囲いを居飛車と振り飛車に分ける・設定の棋力測定をなくす。`docs/player-world-note-design.md`の8章。実装は8-5）。mainに公開済み（2026-10-29）。続けて設定も小さいスマホで収めた（8-6。mainに公開済み、2026-10-29）。6つの大きさのどの項目も、中身の欄がスクロールしない。
- 善彦が解説するときの掛け合いを、ユーザーの配信の例のとおりに入れ（`docs/tournament-relay-design.md`の36章）、ほかの場面の善彦の言い方もその口調にそろえた（37章）。mainに公開済み（2026-10-30）。善彦の解説へのつっこみを場面ごとに全部流すようにした（38章）。mainに公開済み（2026-10-30）。羽音の解説の口調を、羽音の書き方に合わせて書き直した（39章）。mainに公開済み（2026-10-30）。分身の記録と分身の期の難易度を、自分の能力値に入れないようにした（40章）。善彦らしくない解説の行を直した（41章）。どちらもmainに公開済み（2026-10-30）。善彦の対局中の一言と心の声も解説の口調にそろえ（42章）、善彦の口調をモデルの羽生善治・藤井聡太の話し言葉に寄せた（43章。ユーザーが入力した台詞は変えない）。mainに公開済み（2026-10-30）。羽音の人物設定をノベルのリポジトリから写し（`docs/hanane-character.md`。ミステリーの筋は除いた）、羽音の台詞をノベルの口調に合わせた（44章）。流れるコメントを欄の全体に散らした（45章）。どちらもmainに公開済み（2026-10-30）。
- 棋力テストの問題の見直しを設計した（`docs/skill-assessment-design.md`の10章。2026-10-30）。今の束を調べると、問いの言葉（「得する駒取り」「詰まない手」）と採点（最善手から○点以内）が食い違い、「手筋」の70問のうち名前の付く形は14問だけだった。直すのは、約束を守る手を全部正解にする・人とエンジンのものさしが一致する局面だけを使う・手筋は名前の形で探す・二度読む・答えのあとに理由を見せる。実装はまだ（10-10の段階0から）。
- 次の候補（ユーザーの依頼はまだない。頼まれたら設計文書の章から始める）:
  - 観戦する対局をエンジンが本当に指して勝ち負けを決める（`docs/tournament-relay-design.md`の20章）。段階0（測定）は済み（20-6。見積もりは`scripts/engine-world-sim.mjs`）。段階1（分身の対局を本局にする、20-8）・段階2（分身の回戦の全局を本局にする、20-9。主要キャラ（分身・羽音・善彦）のいない局は観戦用の読み。強さの表は測り直し済み）・段階3（敗退後の観戦を本局にする、20-10。見終えるたびに残りを指し直し、名簿は残りを確定してから進める）も済み。20章の段階はここまで。本物のスマホ・タブレットでの速さと、上の世界（基準Lv40以上）のブラウザでの時間はまだ測っていない。
  - 名人戦の分身の観戦参加は21章、回戦の中継ボード（リーグ表の上で同時に進める・ほかの対局も本局に）は22章、自分の出ない番勝負の観戦（名人の発表）は23章で済み。
  - 中継の楽しみ（勝敗の予想・次の一手クイズ・見どころ再生・大盤解説・研究ノート）は24章で済み。14章の候補はこれで全部済み。20章の段階0〜3と21〜24章は、mainに公開済み（2026-10-28）。
  - 人間らしいCPUの続き（`docs/cpu-human-model-design.md`の12-5。棋士の特徴との対応・信念の式の大局観の重み・振り返りでCPUの見落としを説明）。選び方とレベル表は12章で実装済み（2026-10-28）。
  - 物語モード（主役の1つ。まだ設計もない）。
- 実際に遊んでの確認がまだのもの: 検証記録（`docs/yakobihime-opening-guide-verification.md`）の最近の行のうち「未確認」と書いたもの。
