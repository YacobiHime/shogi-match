import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const ENGINE_PROFILES = ["yaneuraou", "yaneuraou.halfkp.noeval"];
const ENGINE_SOURCE_VERSION = "20260727-2";

/**
 * エンジンのローダーのURLに付ける版(?v=)を、vendor/のエンジン一式の内容のハッシュにする。
 * ビルドの時点で埋め込むので、エンジンだけを差し替えても、それを読むチャンクの名前のハッシュが変わる。
 * (ビルド後に中身を書き換えると、名前が同じまま中身が変わり、長期キャッシュに古い版が残る。)
 */
function engineVersionPlugin() {
  const versions = new Map();
  for (const profile of ENGINE_PROFILES) {
    const hash = createHash("sha256");
    let found = 0;
    for (const suffix of ["js", "wasm", "data", "worker.js"]) {
      try {
        hash.update(readFileSync(resolve(import.meta.dirname, "vendor", `${profile}.${suffix}`)));
        found += 1;
      }
      catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (found > 0) versions.set(profile, hash.digest("hex").slice(0, 12));
  }
  return {
    name: "shogi-match:engine-version",
    apply: "build",
    transform(code, id) {
      if (!/[\/]core[\/]engine-loader\.mjs$/.test(id)) return null;
      let result = code;
      for (const [profile, version] of versions) {
        result = result.replaceAll(`${profile}.js?v=${ENGINE_SOURCE_VERSION}`, `${profile}.js?v=${version}`);
      }
      return result === code ? null : { code: result, map: null };
    },
  };
}

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  resolve: {
    alias: [{ find: "@", replacement: resolve(import.meta.dirname, "src") }],
  },
  plugins: [vue(), engineVersionPlugin()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    lib: {
      entry: "src/index.js",
      name: "ShogiMatch",
      formats: ["es"],
      fileName: "shogi-match",
    },
    rolldownOptions: {
      output: {
        // 画面ごとの遅延チャンクが入口のshogi-match.jsを直接importすると、
        // game.htmlの「shogi-match.js?v=…」と別のURLになり、同じモジュールが2回読まれる。
        // 入口から静的にたどれるモジュールは、内容のハッシュ付きの共通チャンクへまとめ、
        // 入口と遅延チャンクの両方がそこからimportするようにする。
        chunkFileNames: "chunks/[name]-[hash].js",
        codeSplitting: {
          groups: [
            {
              name: "runtime",
              tags: ["$initial"],
              test: (id) => !/[\/]src[\/]index\.js$/.test(id),
            },
          ],
        },
      },
    },
  },
});
