/**
 * 将棋教室の観戦レッスンで使う自作の棋譜（USI）。どちらも平手から始まる。
 * 先手は「実力者」、後手は「将棋をおぼえたての人」として、CPU同士に指させて作った。
 * 8手目までは手で決め、そのあとを scripts/tutorial-watch-game.mjs で指し継いだ
 * （先手はやねうら王の15万nodes探索の最善手、後手は教室向けの弱いCPU設定）。
 */

const moves = (text) => Object.freeze(text.trim().split(/\s+/));

/**
 * 舟囲い＋袖飛車の先手が、囲いの薄い四間飛車の後手を、と金で寄せる73手の対局。
 * 後手はCPU Lv12、乱数の種は14。
 */
export const WATCH_GAME_FUNAGAKOI = moves(`
  7g7f 3c3d 2g2f 4c4d 2f2e 2b3c 3i4h 8b4b 3g3f 4a3b 5i6h 4b4a 9g9f 5a6b 9f9e 6b7b
  6h7h 3a2b 4i5h 6a6b 5g5f 7c7d 2h3h 6b7c 4h5g 1c1d 3f3e 5c5d 3e3d 3c5a 5f5e 5d5e
  5g6f 5a6b 6f5e 6c6d 3h3f 7b8b 4g4f 4a4b 2i3g 4b5b 4f4e 2b1c P*5d 3b3a 4e4d 7a7b
  4d4c+ 5b2b 5d5c+ 6b7a 3d3c+ 2a3c 3f3c+ P*3b 3c3f P*4b 4c5b 1a1b 5b6b 6d6e 5e5d 3a4a
  6b7a 1c2d 7a7b 8b9b 7b7c 8a7c B*7a 6e6f G*8b
`);

/**
 * 銀を繰り出して3筋から攻める先手が、受けを誤った中飛車の後手を龍と馬で寄せる67手の対局。
 * 後手はCPU Lv8、乱数の種は12。
 */
export const WATCH_GAME_KURIDASHI = moves(`
  7g7f 3c3d 2g2f 4c4d 2f2e 2b3c 3i4h 8b4b 3g3f 7a7b 9g9f 5a6b 9f9e 7c7d 5g5f 7b7c
  5i6h 1c1d 2h3h 4b5b 4h5g 3a3b 6h7h 3b4c 3f3e 3d3e 5g4f 5b5a 4f3e 6a5b P*3d 5a7a
  3d3c+ 2a3c 2e2d 4a5a 2d2c+ 3c4e 3e4f 4c5d 8h4d 5d6e 4f4e 9a9b 3h3b+ 6b7b 4d1a+ 1d1e
  1a5e 5a4b 3b1b 9c9d 5e6e 4b4a N*8e 9b9c 2c3b 7a5a 3b4a P*2f 4a5a 5b6b R*9b 7b7a
  L*7b 6b7b 9b7b+
`);

/**
 * WATCH_GAME_KURIDASHIの各局面（0手目〜67手目）の評価値。先手から見た値で、数値はcp、詰みは{ type: "mate" }。
 * scripts/lib/node-engine.mjs のやねうら王で、各局面を15万nodes探索した最善手の値を記録した。
 */
export const WATCH_GAME_KURIDASHI_EVALUATIONS = Object.freeze([
  70, 54, 90, 72, 124, 65, 110, 102, 132, 141, 76, 64, 168, 164, 231, 215,
  234, 244, 238, 227, 427, 473, 411, 385, 434, 308, 457, 411, 772, 801, 2055, 2156,
  4191, 4037, 4108, 4053, 5004, 5130, 5117, 4976, 5328, 5261, 5937, 5930, 6222, 6373, 6341, 6370,
  6736, 6471, 7004, 6978, 7144, 7184, 7280, 7394, 7584, 7433,
  ...[25, 12, 9, 8, 7, 6, 3, 2, 1, 0].map((value) => Object.freeze({ type: "mate", value })),
]);
