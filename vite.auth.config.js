import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * ログインのページ(auth.html)の中身だけを作る(docs/cloud-sync-design.mdの5章)。
 * FirebaseのSDKはこのページだけが読むので、対局画面(vite.config.js)とは別に作り、dist/auth/login.jsの1つのファイルにする。
 * npm run buildが、対局画面のあとに続けて作る。
 */
export default defineConfig({
  // public/の絵や音は対局画面のビルド(dist/)にあるので、ここには写さない。
  publicDir: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  resolve: {
    alias: [{ find: "@", replacement: resolve(import.meta.dirname, "src") }],
  },
  build: {
    outDir: "dist/auth",
    emptyOutDir: true,
    lib: {
      entry: "src/auth/login-page.ts",
      formats: ["es"],
      fileName: () => "login.js",
    },
    rolldownOptions: {
      output: {
        codeSplitting: false,
        minify: true,
        comments: { legal: true, annotation: false, jsdoc: false },
      },
    },
  },
});
