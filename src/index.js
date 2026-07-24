import { defineCustomElement } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";

export { ShogiMatchBoard };

// BoardViewのscoped CSSを利用ページ側の同梱CSSから適用するため、
// light DOMで描画する。これによりネストしたShogiHomeコンポーネントにも
// 抽出済みスタイルが届く。
export const ShogiMatchBoardElement = defineCustomElement(
  ShogiMatchBoard,
  { shadowRoot: false },
);

if (!customElements.get("shogi-match-board")) {
  customElements.define("shogi-match-board", ShogiMatchBoardElement);
}
