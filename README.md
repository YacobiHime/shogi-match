# shogi-match-ui

ブラウザで使える、SFEN入力・USI出力の再利用可能な将棋盤UIです。ShogiHomeの盤面部品の公開APIと操作設計を参考に、対局エンジン、RPG進行、保存、通信を含めない小さなWeb Componentとして提供します。

```html
<script type="module" src="./shogi-match-ui.js"></script>
<shogi-match-board sfen="lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"></shogi-match-board>
<script>
  document.querySelector("shogi-match-board").addEventListener("usi-move", (event) => {
    console.log(event.detail[0]); // 例: 7g7f
  });
</script>
```

- `sfen`: 表示するSFEN
- `allow-move`: `false` にすると閲覧専用
- `flip`: 盤面を反転
- `asset-base-url`: 駒画像の自己ホスト先。既定値はshogi-imagesのCC0画像
- `usi-move`: 合法手をUSI文字列で発火。ホストは局面を更新して` sfen `を再設定します。

MITライセンスです。出典・素材は[NOTICE.md](./NOTICE.md)を参照してください。
