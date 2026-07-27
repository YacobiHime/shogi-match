# shogi-match

ブラウザ、RPG、ノベルゲームへ埋め込める、単独動作可能な将棋対局ランタイムです。
ShogiHome 1.28.0由来の盤面と`tsshogi`を使い、サーバーなしで動作します。

## 完全対局ランタイム

0.5.0以降はYaneuraOu.wasm本体も同梱し、`game.html`をWebサーバーから開くだけで対局できます。
将棋RPGで実績のある次の機能もパッケージ本体から公開します。

- YaneuraOu.wasmのUSI通信、起動・応答タイムアウト
- NNUEの初期化前ロードと内蔵評価へのフォールバック
- 標準定跡DB、敵固有定跡、`go searchmoves`
- 探索ノード数、難易度、MultiPV候補ランク
- リアルタイムヒント解析、候補手・評価・読み筋整形
- 待った用の手番履歴
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
プレイヤー着手前へ戻す「待った」を管理します。既定回数はヒント3回、待った1回で、
`hint-count`と`undo-count`属性から変更できます。
CPU対局では画面上の「CPU強さ」から5段階で選べます。各項目には読む手数の目安を
表示します。変更は次のCPU着手から反映されます。埋め込み時は
`engine-nodes`属性、URLでは`engine_nodes`パラメーターから初期値を指定できます。

主なイベント:

- `match-ready`: 対局の準備完了
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

npmパッケージ自体にYaneuraOuのWASMバイナリ、NNUE、定跡DBは含めません。AI対局で
それらを同梱配布する場合は、各資産のライセンスと対応ソース提供条件も満たしてください。
