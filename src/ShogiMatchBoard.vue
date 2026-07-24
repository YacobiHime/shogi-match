<template>
  <div ref="root" class="shogi-match-root">
    <BoardView
      v-if="position"
      :layout-type="layoutType"
      :board-image-type="BoardImageType.CUSTOM_IMAGE"
      :custom-board-image-url="`${normalizedAssetBase}/board/wood_light2.png`"
      :piece-image-url-template="pieceImageTemplate"
      :king-piece-type="KingPieceType.GYOKU_AND_OSHO"
      :piece-stand-image-type="PieceStandImageType.CUSTOM_IMAGE"
      :custom-piece-stand-image-url="`${normalizedAssetBase}/stand/wood_dark.png`"
      :hand-piece-order="HandPieceOrder.STRONGER_TO_LEFT"
      :promotion-selector-style="PromotionSelectorStyle.HORIZONTAL"
      :board-label-type="BoardLabelType.STANDARD"
      :max-size="maxSize"
      :position="position"
      :last-move="lastMoveObject"
      :candidates="candidateMoves"
      :flip="flip"
      :mobile="mobile"
      :allow-move="allowMove"
      :enable-drag-and-drop="enableDragAndDrop"
      :black-player-name="blackPlayerName"
      :white-player-name="whitePlayerName"
      :arrow-image-url="`${normalizedAssetBase}/arrow/arrow.svg`"
      @move="onMove"
      @resize="onResize"
    />
    <p v-else class="error" role="alert">局面を表示できません。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Move } from "tsshogi";
import BoardView from "./renderer/view/primitive/BoardView.vue";
import { RectSize } from "./common/assets/geometry";
import {
  CandidateInput,
  candidateMovesFromUsi,
  positionFromSfen,
} from "./position";
import {
  BoardImageType,
  BoardLabelType,
  HandPieceOrder,
  KingPieceType,
  PieceStandImageType,
  PromotionSelectorStyle,
} from "./common/settings/app";
import { BoardLayoutType } from "./common/settings/layout";

const props = defineProps({
  sfen: { type: String, required: true },
  candidates: { type: Array as () => CandidateInput[], default: () => [] },
  lastMove: { type: String, default: "" },
  allowMove: { type: Boolean, default: true },
  enableDragAndDrop: { type: Boolean, default: true },
  flip: { type: Boolean, default: false },
  mobile: { type: Boolean, default: false },
  layout: { type: String, default: BoardLayoutType.STANDARD },
  assetBaseUrl: { type: String, default: "." },
  blackPlayerName: { type: String, default: "先手" },
  whitePlayerName: { type: String, default: "後手" },
});
const emit = defineEmits(["usi-move", "invalid-sfen", "resize"]);
const root = ref<HTMLElement | null>(null);
const maxSize = ref(new RectSize(900, 620));
let resizeObserver: ResizeObserver | undefined;

const normalizedAssetBase = computed(() => props.assetBaseUrl.replace(/\/$/, ""));
const pieceImageTemplate = computed(
  () => `${normalizedAssetBase.value}/piece/hitomoji_wood/\${piece}.png`,
);
const layoutType = computed(() =>
  Object.values(BoardLayoutType).includes(props.layout as BoardLayoutType)
    ? props.layout as BoardLayoutType
    : BoardLayoutType.STANDARD,
);
const position = computed(() => {
  try {
    return positionFromSfen(props.sfen);
  } catch (error) {
    emit("invalid-sfen", error);
    return null;
  }
});
const toMove = (usi: string): Move | null => position.value?.createMoveByUSI(usi) || null;
const lastMoveObject = computed(() => props.lastMove ? toMove(props.lastMove) : null);
const candidateMoves = computed(() =>
  position.value ? candidateMovesFromUsi(position.value, props.candidates) : []
);

function onMove(move: Move) {
  emit("usi-move", move.usi);
}
function onResize(size: RectSize) {
  emit("resize", { width: size.width, height: size.height });
}
function measure() {
  if (!root.value) return;
  const width = Math.round(Math.max(280, root.value.clientWidth || 900));
  const height = Math.round(Math.min(760, Math.max(420, width * 0.68)));
  if (maxSize.value.width === width && maxSize.value.height === height) return;
  maxSize.value = new RectSize(width, height);
}
onMounted(() => {
  measure();
  resizeObserver = new ResizeObserver(measure);
  if (root.value) resizeObserver.observe(root.value);
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(() => props.sfen, () => measure());
</script>

<style>
:host { display: block; width: 100%; }
.shogi-match-root {
  --shadow-color: rgba(0, 0, 0, 0.5);
  --text-color: black;
  --text-bg-color: white;
  --text-bg-color-warning: #ffff88;
  --text-bg-color-danger: red;
  --text-color-danger: white;
  --promote-bg-color: white;
  --not-promote-bg-color: gray;
  --turn-label-color: lightyellow;
  --turn-label-bg-color: #2424e6;
  --turn-label-border-color: midnightblue;
  width: 100%;
  min-height: 360px;
  overflow: hidden;
}
.shogi-match-root .full { width: 100%; height: 100%; }
.error { padding: 1rem; color: #b91c1c; background: #fee2e2; }
</style>
