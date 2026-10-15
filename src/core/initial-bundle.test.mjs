import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = ["", ".mjs", ".js", ".ts", ".vue", "/index.js"];

// import() を除いた静的なimport・export ... fromの指定子。Vueのファイルは<script>だけを見る。
function staticSpecifiers(file) {
  let code = readFileSync(file, "utf8");
  if (file.endsWith(".vue")) code = [...code.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const specifiers = [];
  for (const match of code.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^;'"]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveLocal(from, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;
  const base = specifier.startsWith("@/") ? resolve(src, specifier.slice(2)) : resolve(dirname(from), specifier);
  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension) && !base.endsWith("/") && (extension || /\.\w+$/.test(base))) return base + extension;
  }
  return null;
}

/** 入口から静的なimportだけでたどれるsrc/のファイル。これが最初に読むJSに入る。 */
function initialModules(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of staticSpecifiers(file)) {
      const next = resolveLocal(file, specifier);
      if (next && /\.(mjs|js|ts|vue)$/.test(next)) stack.push(next);
    }
  }
  return [...seen].map((file) => file.slice(src.length + 1).replaceAll("\\", "/"));
}

describe("最初に読むJS", () => {
  const modules = initialModules(resolve(src, "index.js"));

  it("対局画面と盤をたどれている", () => {
    expect(modules).toContain("ShogiMatchGame.vue");
    expect(modules).toContain("core/opening-guide.mjs");
  });

  it("教室・問題集・図鑑・やこびノート・大会の画面と、それだけが使う重いデータを含まない", () => {
    // ここに入るものは、開いたときにdefineAsyncComponentで読み込む。
    for (const lazy of [
      "ShogiTutorial.vue",
      "ShogiProblemSet.vue",
      "ShogiOpeningDex.vue",
      "ShogiReferenceDex.vue",
      "YakobiNote.vue",
      "ShogiTournament.vue",
      "core/tutorial-curriculum.mjs",
      "core/reference-dex.mjs",
      "core/problem-set.mjs",
      "data/shogi-glossary.mjs",
      "data/reference-kifu.mjs",
      "data/tsume-problems.mjs",
      "data/jissen-tsume-problems.mjs",
      "data/zukou-problems.mjs",
    ]) {
      expect(modules, lazy).not.toContain(lazy);
    }
  });
});
