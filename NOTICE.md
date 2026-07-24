# Upstream and assets

- Interaction and public API design are based on the MIT-licensed
  [ShogiHome](https://github.com/sunfish-shogi/shogihome) board primitive
  (Kubo Ryosuke, version 1.28.0). This package is an independently maintained,
  small browser-facing adapter; it does not include ShogiHome application code.
- Move validation and SFEN parsing use [tsshogi](https://github.com/sunfish-shogi/tsshogi),
  the MIT-licensed library also used by ShogiHome.
- The default piece images are served from
  [shogi-images](https://sunfish-shogi.github.io/shogi-images/), CC0 1.0.
  Consumers may set `assetBaseUrl` to self-host those images.
