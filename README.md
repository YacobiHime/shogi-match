# shogi-match

ブラウザ、RPG、ノベルゲームへ埋め込める、単独動作可能な将棋対局ランタイムです。
ShogiHome 1.28.0由来の盤面と`tsshogi`を使い、サーバーなしで動作します。

## 完全対局ランタイム

現在の配布物にはYaneuraOu.wasm本体も同梱し、`game.html`をWebサーバーから開くだけで対局できます。
将棋RPGで実績のある次の機能もパッケージ本体から公開します。

- YaneuraOu.wasmのUSI通信、起動・応答タイムアウト
- NNUEの初期化前ロードと内蔵評価へのフォールバック
- 標準定跡DB、敵固有定跡、`go searchmoves`
- 探索ノード数、難易度、MultiPV候補ランク
- リアルタイムヒント解析、候補手・評価・読み筋整形
- 終局後の棋譜解析、先手視点の評価値グラフ、クリックによる局面移動、対局時の助言再表示
- 待った用の手番履歴
- やこび姫による戦法・囲い補助、定跡手と安全なAI候補の盤上表示
- 居飛車などの基本形完成後に、棒銀・早繰り銀・腰掛け銀などの派生戦法を選び直す段階式補助
- スマートフォン・タブレット縦画面を含むレスポンシブ対局UI
- 対局中の棋譜・設定・残り補助回数・終局結果の自動保存とリロード復元
- 入玉宣言、千日手、連続王手、打ち歩詰め
- 戦形・敵・アイテム・解禁条件の検証
- 戦形検出、候補矢印、直前手・合法手強調
- 対局準備、消費棋具、セーブ連携を含む将棋RPG用ランタイム

`integrations/shogi-rpg.js`が完全なRPG対局画面を起動します。RPG側には、
マスタJSON、セーブAPI、エンジン・評価関数・定跡資産と、終局結果を進行へ反映する
ホスト層だけを残します。

## すぐ遊ぶ

`game.html`、`dist/`を同じ階層へ配置し、HTTPサーバーから`game.html`を開きます。

```text
game.html?mode=cpu&player_color=black&match_id=chapter1-boss
```

- `mode=cpu`: 同梱のやねうら王と対局
- `mode=local`: 1台の端末で先手・後手を交互に操作
- `player_color=black|white`: CPU対局で人間が持つ側
- `initial_sfen`: 任意の開始局面
- `match_id`: ノベル側で対局を識別するID
- `engine_nodes`: CPUが1手ごとに読む探索量（既定値は30000）

やねうら王を取得・起動できない場合だけ、合法手から選ぶ軽量CPUへ自動的に切り替わります。
棋力を必要とする場合は、別配布のUSIエンジンアダプターを使用してください。

対局開始後の状態はブラウザーの`localStorage`へ30日間保存されます。同じURLをリロードすると、
指し手、先後、CPU設定、選択中の戦法・囲い、残りヒント・待った、終局結果、
局面ごとに表示されたやこび姫の助言を復元します。棋譜解析では同じ局面を表示した瞬間に、
対局時の助言を再表示します。
結果画面から「対局準備」へ戻ると保存を削除し、次の対局は未選択状態から始まります。

## Firebase Hostingへ公開

依存関係をインストールし、公開用ファイルを生成します。

```sh
npm install
npm run build:hosting
```

Firebase CLIでログイン済みなら、次のコマンドで`.firebaserc`に設定されたプロジェクトへ
デプロイできます。

```sh
npm run deploy
```

公開用ファイルは`firebase-public/`へ生成されます。このフォルダーと`.firebase/`は
生成物のためGitには含めません。
HTMLは常に再検証し、JS/CSSには内容ハッシュ付きURLを自動生成します。画像・WASM・評価データを含む
静的資産には`firebase.json`でキャッシュを設定し、更新の即時反映と転送量削減を両立します。

## ローカル定跡エディター

初回準備、対局画面の起動、保存方法を含む詳しい手順は[ローカル起動・定跡編集ガイド](docs/local-development.md)を参照してください。

戦法・囲いの案内手順を手作業で調査・修正するときは、次を実行します。

```sh
npm run opening-editor
```

表示された「やこび姫 定跡編集」で既存の戦法・囲いを選ぶと、現行の案内手が右側の編集一覧へ読み込まれます。
囲いでは案内手に加え、必要な駒とマスからなる完成形を編集でき、複数の完成形も登録できます。
既存データは戦法・囲いの分類ごとにまとめて表示されます。分類IDとは別に「分類名」を直接編集でき、保存すると同じ分類IDの一覧見出しへ反映されます。戦法のメニュー分類・飛車分類と、囲いの系統・表示グループ・対応戦型も編集してJSONへ保存できます。
案内手一覧は内部スクロールせず、登録した全手を続けて表示します。相手の応手を含む確認手順は任意で、「実戦確認」を開いたときだけ表示されます。
一覧では「▲２六歩」のような日本語表記を確認でき、移動元・移動先のマスを日本語で選んで案内手を追加・編集できます。手をクリックすると、相手の応手を入力していなくても案内手だけを進めた確認局面と矢印を盤上へ表示します。USI表記は必要な場合だけ「詳細（USI）」から確認できます。
相手の指し手を登録しなくても定跡を保存できます。登録する場合も定跡を完全一致で固定するものではなく、その応手でも案内手が合法かを確認するための記録です。
戦法では「完成後に次の戦法を選ばせる」を有効にすると、選択時の案内文と派生戦法の追加・削除もJSONへ保存できます。
各案内手には複数の盤上条件を指定できます。条件グループ同士はAND、各グループ内はORとして扱うため、「相手の8二に飛車」かつ「相手の8四または8五に歩」のように設定できます。
「この局面から分岐」で応手別の変化を作成できます。Wikipediaなど確認したページの名称、HTTPS URL、
確認日を登録し、評価値の安全確認結果をメモしてからJSONを書き出してください。

下書きはブラウザの`localStorage`だけに保存され、公開対局画面やFirebase Hostingには含まれません。
下書きは戦法・囲いごとに個別保存され、一覧から切り替えると各定跡の保存内容を再読込します。
既存データで選択した定跡は、保存済みかどうかに関係なく「選択した定跡を削除」でこのブラウザの一覧から削除できます。
書き出すJSONは`schemaVersion: 1`を持ち、開始SFEN、現行の先手基準案内手、先後を含む実戦分岐、
出典、検証メモを保持します。自動検査は各手の合法性と手番、分岐ID・同一手順の重複、出典形式を確認します。

## ゲームとして埋め込む

```html
<link rel="stylesheet" href="./shogi-match.css">
<script type="module" src="./shogi-match.js"></script>

<shogi-match-game
  mode="cpu"
  player-color="black"
  asset-base-url="."
  cpu-player-name="将棋CPU"
></shogi-match-game>
```

`<shogi-match-game>`は対局進行、合法手適用、軽量CPU、投了、詰み、千日手、
連続王手、再戦に加えて、やこび姫の戦形判定、候補手を盤上表示するヒント、
プレイヤー着手前へ戻す「待った」を管理します。既定回数はヒント3回、待った3回で、
`hint-count`と`undo-count`属性から変更できます。
CPU対局では画面上の「CPU強さ」からLv0〜24の25段階で選べます。各項目には棋力の目安を
表示します。変更は次のCPU着手から反映されます。埋め込み時は
`engine-nodes`属性、URLでは`engine_nodes`パラメーターから初期値を指定できます。

主なイベント:

- `match-ready`: 対局の準備完了。リロード復元時は`restored: true`を含む
- `match-move`: 着手完了
- `match-end`: 終局。勝者、理由、手数、USI指し手列、最終SFENを返す
- `match-error`: 開始局面などのエラー

VueのCustom Elementイベントでは、イベント値は`event.detail[0]`に入ります。

```js
document.querySelector("shogi-match-game").addEventListener("match-end", (event) => {
  console.log(event.detail[0]);
});
```

## ティラノスクリプトなどから呼ぶ

`game.html`を同一オリジンのiframeで開きます。終局時は親ウィンドウへ次の
`postMessage`を送信します。

```js
{
  type: "shogi-match:result",
  version: 1,
  matchId: "chapter1-boss",
  result: {
    outcome: "black-win",
    winner: "black",
    reason: "checkmate",
    moveCount: 57,
    moves: ["7g7f", "3c3d"],
    finalSfen: "..."
  }
}
```

受信側は`event.origin`、`event.source`、`matchId`を検証してください。

ティラノスクリプトでは、初期化後に一度だけタグを登録します。

```html
<script type="module">
  import { registerTyranoShogiMatch } from "./shogi-match.js";
  registerTyranoShogiMatch(window.tyrano, { gameUrl: "./game.html" });
</script>
```

以降はシナリオからタグだけで対局できます。

```ks
[shogi_match match_id="chapter1:boss" mode="cpu" player_color="black"]
```

終局結果は`f.match_result`へ入り、シナリオ処理が次へ進みます。`openShogiMatch()`を
直接呼べば、ティラノ以外のノベルエンジンでも同じ全画面iframeと結果検証を利用できます。

## 盤面だけを使う互換API

従来の`<shogi-match-board>`も引き続き利用できます。

```html
<shogi-match-board
  sfen="lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
></shogi-match-board>
```

- `sfen`: 表示するSFEN
- `allow-move`: `false`にすると閲覧専用
- `flip`: 盤面反転
- `asset-base-url`: 盤・駒・駒台・矢印画像の公開先
- `candidates`: `{ usi, score? }[]`
- `last-move`: 直前手のUSI
- `usi-move`: 合法手をUSI文字列で通知

## ライセンス

完全対局ランタイムはGPL-3.0-or-laterです。ShogiHome、tsshogiなどMIT由来コードと
素材の出典は[NOTICE.md](./NOTICE.md)を参照してください。

配布設定にはYaneuraOuのWASMバイナリ、評価データ、Workerを含みます。AI資産を再配布する場合は、
GPL-3.0-or-laterを含む各資産のライセンスと対応ソース提供条件を満たしてください。
