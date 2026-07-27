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
  build: {
    lib: {
      entry: "src/index.js",
      name: "ShogiMatch",
      formats: ["es"],
      fileName: "shogi-match",
    },
  },
});
