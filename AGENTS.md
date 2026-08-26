# shogi-match 作業ガイド

このリポジトリは、Vue Custom Elementとして配布する将棋対局ランタイムです。
通常の変更対象は`src/`、公開入口は`game.html`、Firebase Hosting用設定は`firebase.json`です。

## 最初に確認する場所

| 作業 | 主な参照先 |
| --- | --- |
| 対局画面・状態遷移・やこび姫の表示 | `src/ShogiMatchGame.vue` |
| 戦法・囲いの手順、完成条件、分類 | `src/core/opening-guide.mjs` |
| 戦型検出 | `src/core/formation-tracker.mjs`、`src/data/hiragana_suisho_formations.json` |
| CPU難易度 | `src/core/strength-settings.mjs` |
| 棋譜解析 | `src/core/kifu-analysis.mjs`、`src/EvaluationGraph.vue` |
| リロード復元 | `src/core/match-persistence.mjs` |
| 手動検証履歴 | `docs/yakobihime-opening-guide-verification.md` |

文書と実装が食い違う場合は、テスト済みのコードを現在仕様として扱い、同じ変更で文書も更新してください。
ただし、ユーザーによる手動検証結果を自動テストだけで「動作確認済み」へ変更してはいけません。

## 実装上の重要事項

- 戦法と囲いは別の計画です。囲い定義へ特定の振り飛車導入手順を埋め込まず、振り飛車用囲いでは先に飛車の振り先を選ばせます。
- 戦法・囲いの手順は先手向けを基準に定義し、後手では反転します。変更時は先後双方の合法性と完成判定をテストします。
- 完成後の計画はロックし、駒が動いて完成形が崩れても寄り道判定へ戻しません。完成後の定跡・AI候補案内は戦法だけに表示し、囲いには表示しません。
- 危険な定跡手を避ける場面では、危険な定跡手1本とAI候補3本を区別して表示します。現在の安全な寄り道上限は6手で、計画全体の期限とは別です。
- 角換わり系は、交換前に相手が角道を閉じた場合に中断し、右四間飛車への切り替えを案内します。
- 原始棒銀は銀が2六へ出た時点で完成です。合法なら1五銀・3五銀と、その後の飛車先交換を定跡候補として案内します。
- 対局中と終局後の状態は`localStorage`へ保存します。「対局準備」へ戻る操作は保存を削除する境界です。
- 縦画面では、飛車選択などの操作を固定高で隠さないでください。スマホ幅とタブレット縦の両方を確認します。

## 検証

変更範囲に応じて、最低限次を実行します。

```sh
npm test
npm run build
git diff --check
```

戦法・囲いを変更した場合は`src/core/opening-guide.test.mjs`で、手順の合法性、先後反転、完成条件、分類を確認します。
画面操作を変更した場合は、可能なら実ブラウザでデスクトップ、スマホ縦、タブレット縦を確認します。

## 生成物と公開

- `dist/`と`firebase-public/`は生成物です。直接編集せず、`npm run build`または`npm run build:hosting`で作り直します。
- Firebase Hostingは`npm run deploy`で公開します。pushやデプロイはユーザーが明示的に依頼した場合だけ行います。
- HostingではHTMLを再検証し、`scripts/build-hosting.mjs`がJS/CSSへ内容ハッシュを付けます。大きな静的資産はキャッシュします。キャッシュ方針を変える場合はビルドスクリプトと`firebase.json`を一緒に確認します。

## 文書の保守

- 公開API、URLパラメーター、保存動作、配布物が変わったら`README.md`を更新します。
- 難易度の実値を変えたら`docs/difficulty-calibration.md`と、必要に応じて`docs/fujii-sota-strength-calibration.md`を更新します。
- やこび姫補助の実装変更は検証記録へ「実装・自動テスト済み」として追記し、実対局で確認されるまで手動検証済みとは区別します。
