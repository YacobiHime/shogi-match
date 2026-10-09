# shogi-match 作業ガイド

このリポジトリは、Vue Custom Elementとして配布する将棋対局ランタイムです。
ふだん変更するのは`src/`です。公開の入口は`game.html`、Firebase Hostingの設定は`firebase.json`にあります。
利用者向けの説明は`README.md`、ローカルでの起動と定跡編集の手順は`docs/local-development.md`にあります。

## 最初に確認する場所

| 作業 | 主な参照先 |
| --- | --- |
| 対局画面・状態遷移・やこび姫の表示 | `src/ShogiMatchGame.vue` |
| 対局準備の画面 | `src/ShogiMatchGame.vue`の対局準備（`pregameSides`・`pregameCommonRows`・`pregamePickerConfig`）、選択シートは`src/PregamePicker.vue` |
| ブラウザの戻る操作 | `src/composables/useBackNavigation.ts`、`src/ShogiMatchGame.vue`の`navigateBack` |
| 画面の大きさによる配置の切り替え | `src/composables/useResponsiveLayout.ts` |
| 戦法・囲いの手順、完成条件、分類 | `src/core/opening-guide.mjs` |
| 定跡エディターの上書きデータ | `src/data/opening-guide-overrides.mjs`（`npm run import:opening-library`で生成） |
| 戦法・囲いの解説文 | `src/core/opening-explanations.mjs` |
| 戦型検出 | `src/core/formation-tracker.mjs`、`src/data/hiragana_suisho_formations.json` |
| やこび姫の助言・称賛 | `src/core/coach-advice.mjs`、`src/core/move-praise.mjs`、神の一手の基準（対局中と棋譜解析で共通）は`src/core/god-move.mjs` |
| CPU難易度 | `src/core/strength-settings.mjs` |
| CPUの戦法の選び方 | `src/core/cpu-opening-repertoire.mjs` |
| 棋譜解析 | `src/core/kifu-analysis.mjs`、`src/EvaluationGraph.vue` |
| リロード復元 | `src/core/match-persistence.mjs` |
| 大会（研修会入会試験など）・称号・プロフィール | `src/core/tournament.mjs`（進行と判定）、`src/core/player-profile.mjs`（称号と成績の保存）、`src/ShogiMatchGame.vue`の`tournamentRun`、設計は`docs/tournament-design.md` |
| 将棋教室 | `src/ShogiTutorial.vue`、`src/core/tutorial-curriculum.mjs`、設計は`docs/nyumon-mode-design.md` |
| 将棋問題集 | `src/ShogiProblemSet.vue`、問題とやこび姫の台詞は`src/core/problem-set.mjs`、練習問題の正誤判定の詰み探索は`src/core/problem-solver.ts`（正解は書かず探索で決める）、詰将棋（駒の少ない詰将棋と実戦詰将棋）と詰将棋図巧のデータは`src/data/tsume-problems.mjs`・`src/data/jissen-tsume-problems.mjs`・`src/data/zukou-problems.mjs`（外部データの手順で判定する。手で書き換えない） |
| 図鑑 | `src/ShogiOpeningDex.vue`（定跡）、`src/ShogiReferenceDex.vue`と`src/core/reference-dex.mjs`（駒・手筋・将棋界・用語辞典）、用語辞典の項目は`src/data/shogi-glossary.mjs`、将棋界図鑑の代表局のKIFは`src/data/reference-kifu.mjs`、「詰将棋の名作」で解ける『将棋図巧』は将棋問題集の`ZUKOU_SET`と判定を使う、AI解析は`src/core/reference-kifu-analysis.mjs`（エンジンは`ShogiMatchGame.vue`の`dexAnalysisEngine`を借りる） |
| iframe・ノベル連携 | `src/novel-bridge.ts`、RPGは`integrations/shogi-rpg.js` |
| 手動検証履歴 | `docs/yakobihime-opening-guide-verification.md` |

文書と実装が食い違う場合は、テスト済みのコードを現在の仕様として扱います。同じ変更で文書も直してください。
ただし、ユーザーが手動で検証した結果を、自動テストだけで「動作確認済み」へ書き換えてはいけません。

## コミットメッセージ

- 日本語で書きます。件名は`<種別>: <内容>`の一行です。例: `fix: 角換わり手順の中断判定を修正する。`
- 種別には`feat`、`fix`、`style`、`perf`、`refactor`、`tune`、`docs`、`chore`、`revert`などを使います。
- 内容は、何を変えたかを体言止めか「〜する」の形で書きます。末尾には句点「。」を付けます。
- 補足が要るときは、本文を1行空けて箇条書きで書きます。

## 実装上の重要事項

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
- 定跡エディターの上書きデータは、テスト中は無効です（`opening-guide.mjs`の`EDITOR_OVERRIDES_ENABLED`）。
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
- CPU対局の強さの上限はLv40「藤井聡太並み」です。藤井聡太より強い人間はいないため、それより強いレベルは追加しません。棋譜解析は対局の強さとは別で、より深く読んでかまいません。
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
| 赤 | ねらう駒・目標のマス（`square-mark--target`） | `BoardView.vue`の`.square-mark--target` |

- 図鑑の凡例（`ShogiReferenceDex.vue`の`__swatch--*`）は、盤上の色と同じ色相にします。
- 升の色を変えるときは、台詞や凡例にある色の名前（「緑のマス」など）も同じ変更で直します。
- 対局中の矢印（危険な定跡手の黄色、AI候補の赤など）は升の強調とは別の表示で、この表の対象外です。

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
- `src/core/match-ui-regression.test.mjs`は、`ShogiMatchGame.vue`のソースを正規表現で調べるテストです。
  - 画面の書き方を変えると失敗することがあります。
  - 失敗したら、守りたい性質が新しい書き方でも保たれているかを確かめてから、パターンを直してください。
- 画面の操作を変更したら、可能なら実際のブラウザで、デスクトップ、スマホ縦、タブレット縦の3つを確認します。
  - `game.html`は`src/`ではなく`dist/`を読み込みます。確認の前に`npm run build`を実行してください。
  - Viteの開発サーバーを起動したままビルドし直すと、古い`dist/`のJSが配信され続けることがあります。ビルドし直したら、開発サーバーを起動し直すか、キャッシュしない静的サーバーを使ってください。
  - WASMエンジンを動かすには、サーバーがCOOP/COEPヘッダーを返す必要があります。
  - ブラウザ操作の自動化ツールは、リポジトリの依存関係に入っていません。使うときは、リポジトリの外に用意してください。

## 生成物と公開

- `dist/`と`firebase-public/`は生成物です。直接編集せず、`npm run build`か`npm run build:hosting`で作り直します。
- `src/data/opening-guide-overrides.mjs`は、定跡エディターのJSONから`npm run import:opening-library`で生成します。
- Firebase Hostingへは`npm run deploy`で公開します。pushとデプロイは、ユーザーが明示的に頼んだときだけ行います。
- HostingではHTMLを毎回再検証し、`scripts/build-hosting.mjs`がJSとCSSに内容のハッシュを付けます。大きな静的資産はキャッシュします。キャッシュの方針を変えるときは、ビルドスクリプトと`firebase.json`を一緒に確認します。

## 文書の保守

- 公開API、URLパラメーター、Custom Elementの属性とイベント、保存の動作、配布物が変わったら、`README.md`を更新します。
- ローカルでの起動方法や、定跡エディターの操作が変わったら、`docs/local-development.md`を更新します。
- 難易度の実際の値を変えたら、`docs/difficulty-calibration.md`を更新します。必要なら`docs/fujii-sota-strength-calibration.md`も更新します。
- やこび姫の補助の実装を変えたら、検証記録へ「実装・自動テスト済み」として追記します。実際の対局で確認されるまでは、手動検証済みとは区別します。
