import { defineCustomElement } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import ShogiMatchGame from "./ShogiMatchGame.vue";
import {
  buildGameUrl,
  openShogiMatch,
  parseMatchResultMessage,
  registerTyranoShogiMatch,
} from "./novel-bridge";

export { ShogiMatchBoard, ShogiMatchGame };
export {
  buildGameUrl,
  openShogiMatch,
  parseMatchResultMessage,
  registerTyranoShogiMatch,
};
export * from "./core/difficulty.mjs";
export * from "./core/board.js";
export * from "./core/board-theme.mjs";
export * from "./core/enemies.mjs";
export * from "./core/enemy-opening-books.mjs";
export * from "./core/engine-loader.mjs";
export * from "./core/engine.js";
export * from "./core/entering-king.mjs";
export * from "./core/formation-callouts.mjs";
export * from "./core/formations.mjs";
export * from "./core/hiragana-suisho-formations.mjs";
export * from "./core/items.mjs";
export * from "./core/legal-moves.mjs";
export * from "./core/level-unlocks.mjs";
export * from "./core/match-assists.mjs";
export * from "./core/match-setup.mjs";
export * from "./core/move-selection.mjs";
export * from "./core/nnue.mjs";
export * from "./core/repetition.mjs";
export * from "./core/selection-highlights.mjs";
export * from "./core/shogihome-board-adapter.mjs";

// BoardViewのscoped CSSを利用ページ側の同梱CSSから適用するため、
// light DOMで描画する。これによりネストしたShogiHomeコンポーネントにも
// 抽出済みスタイルが届く。
export const ShogiMatchBoardElement = defineCustomElement(
  ShogiMatchBoard,
  { shadowRoot: false },
);
export const ShogiMatchGameElement = defineCustomElement(
  ShogiMatchGame,
  { shadowRoot: false },
);

if (typeof customElements !== "undefined" && !customElements.get("shogi-match-board")) {
  customElements.define("shogi-match-board", ShogiMatchBoardElement);
}
if (typeof customElements !== "undefined" && !customElements.get("shogi-match-game")) {
  customElements.define("shogi-match-game", ShogiMatchGameElement);
}
