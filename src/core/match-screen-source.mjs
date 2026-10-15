import { existsSync, readFileSync, readdirSync } from "node:fs";

// 対局画面(ShogiMatchGame.vue)のソースを、分けたスタイルとcomposableも含めて1つの文字列にする。
// 画面の書き方を正規表現で調べるテストが、ファイルを分けても同じ性質を確かめられるようにするため。
const src = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, src), "utf8");

export function matchScreenSource() {
  const parts = [read("ShogiMatchGame.vue"), read("ShogiMatchGame.css")];
  const matchComposables = new URL("composables/match/", src);
  if (existsSync(matchComposables)) {
    for (const name of readdirSync(matchComposables).sort()) {
      if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) parts.push(read(`composables/match/${name}`));
    }
  }
  return parts.join("\n");
}
