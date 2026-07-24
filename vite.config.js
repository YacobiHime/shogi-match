import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: "src/index.js",
      name: "ShogiMatchUI",
      formats: ["es"],
      fileName: "shogi-match-ui",
    },
  },
});
