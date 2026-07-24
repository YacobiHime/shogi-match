import { defineCustomElement } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";

export { ShogiMatchBoard };

export const ShogiMatchBoardElement = defineCustomElement(ShogiMatchBoard);

if (!customElements.get("shogi-match-board")) {
  customElements.define("shogi-match-board", ShogiMatchBoardElement);
}
