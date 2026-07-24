# shogi-match-ui

ブラウザで使える、SFEN入力・USI出力の再利用可能な将棋盤UIです。ShogiHome 1.28.0の盤面部品を切り出し、対局エンジン、RPG進行、保存、通信を含めないWeb Componentとして提供します。

```html
<link rel="stylesheet" href="./shogi-match-ui.css">
<script type="module" src="./shogi-match-ui.js"></script>
<shogi-match-board sfen="lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"></shogi-match-board>
<script>
  document.querySelector("shogi-match-board").addEventListener("usi-move", (event) => {
    console.log(event.detail[0]); // 例: 7g7f
  });
</script>
```

`dist/`の2ファイルと、`public/`配下の`piece`、`board`、`stand`、`arrow`
ディレクトリを同じサイトから配信してください。

- `sfen`: 表示するSFEN
- `allow-move`: `false` にすると閲覧専用
- `flip`: 盤面を反転
- `asset-base-url`: 同梱した盤・駒・駒台・矢印画像の公開先
- `candidates`: `{ usi, score? }[]`。候補手をShogiHomeと同じ矢印で表示
- `last-move`: 直前手のUSI
- `usi-move`: 合法手をUSI文字列で発火。ホストは局面を更新して` sfen `を再設定します。

MITライセンスです。ShogiHome由来コードの著作権表示と素材の出典は[NOTICE.md](./NOTICE.md)を参照してください。
