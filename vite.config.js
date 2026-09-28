import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  resolve: {
    alias: [{ find: "@", replacement: resolve(import.meta.dirname, "src") }],
  },
  plugins: [vue()],
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
  },
});
