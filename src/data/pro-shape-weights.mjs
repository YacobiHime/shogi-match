// 形の点の重み(docs/disciple-mode-design.mdの40章のL2)。scripts/pro-shape-tune.mjs --writeで作る。手で書き換えない。
// 将棋DB2のプロの棋譜(私的利用)の55000局面で、取り合いを読み切った先の「駒の損得＋形の点」が、その対局の勝ち負けをいちばんよく当てるように合わせた重み(Texel法)。
// 駒の価値は動かしていない。棋譜そのものは入れていない。名前の意味はlogic-search.mjsのHAND_SHAPE_WEIGHTS。

export const PRO_SHAPE_WEIGHTS = Object.freeze({"hand":0.038,"guard":73,"kingCenter":-83,"attacker":44,"mobility":3,"kingZone":-40,"castle":97,"camp":13,"loose":-21,"hanging":-65,"pawnless":4,"pawnFront":66});
