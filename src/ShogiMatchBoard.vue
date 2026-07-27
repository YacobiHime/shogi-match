<template>
  <div ref="root" class="shogi-match-root">
    <div class="shogi-match-theme-controls" aria-label="盤と駒の着せ替え">
      <label>
        盤
        <select v-model="selectedBoardTheme">
          <option v-for="theme in boardThemes" :key="theme.id" :value="theme.id">
            {{ theme.name }}
          </option>
        </select>
      </label>
      <label>
        駒
        <select v-model="selectedPieceTheme">
          <option v-for="theme in pieceThemes" :key="theme.id" :value="theme.id">
            {{ theme.name }}
          </option>
        </select>
      </label>
    </div>
    <BoardView
      v-if="position"
      :layout-type="layoutType"
      :board-image-type="BoardImageType.CUSTOM_IMAGE"
      :custom-board-image-url="boardImageUrl"
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
import BoardView from "./renderer/view/primitive/BoardView.vue";
import { RectSize } from "./common/assets/geometry";
import {
  CandidateInput,
  candidateMovesFromUsi,
  lastMoveFromUsi,
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

const boardThemes = [
  { id: "wood_light2", name: "木目・明るめ", file: "wood_light2.png" },
  { id: "sunfish_light", name: "白木", file: "sunfish_light.png" },
  { id: "sunfish_warm", name: "暖色木目", file: "sunfish_warm.png" },
  { id: "sunfish_dark", name: "濃色", file: "sunfish_dark.png" },
  { id: "sunfish_resin", name: "樹脂", file: "sunfish_resin.png" },
];
const pieceThemes = [
  { id: "hitomoji_wood", name: "一文字・木目" },
  { id: "hitomoji", name: "一文字" },
  { id: "hitomoji_dark", name: "一文字・濃色" },
  { id: "hitomoji_gothic", name: "一文字・ゴシック" },
  { id: "hitomoji_gothic_dark", name: "一文字・ゴシック濃色" },
  { id: "futamoji", name: "二文字" },
];
const storage = typeof localStorage === "undefined" ? null : localStorage;
const selectedBoardTheme = ref(storage?.getItem("shogi-match-board-theme") || "wood_light2");
const selectedPieceTheme = ref(storage?.getItem("shogi-match-piece-theme") || "hitomoji_wood");
const normalizedAssetBase = computed(() => props.assetBaseUrl.replace(/\/$/, ""));
const boardImageUrl = computed(() => {
  const theme = boardThemes.find(({ id }) => id === selectedBoardTheme.value) || boardThemes[0];
  return `${normalizedAssetBase.value}/board/${theme.file}`;
});
const pieceImageTemplate = computed(
  () => `${normalizedAssetBase.value}/piece/${selectedPieceTheme.value}/\${piece}.png`,
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
const lastMoveObject = computed(() =>
  position.value && props.lastMove ? lastMoveFromUsi(position.value, props.lastMove) : null
);
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
watch(selectedBoardTheme, (theme) => storage?.setItem("shogi-match-board-theme", theme));
watch(selectedPieceTheme, (theme) => storage?.setItem("shogi-match-piece-theme", theme));
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
.shogi-match-theme-controls {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 0.4rem 0;
  color: #f7ead5;
  font: 600 0.85rem/1.4 system-ui, sans-serif;
}
.shogi-match-theme-controls label {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}
.shogi-match-theme-controls select {
  min-height: 2rem;
  border: 1px solid #876d45;
  border-radius: 0.35rem;
  background: #fff8e8;
  color: #20180d;
}
.error { padding: 1rem; color: #b91c1c; background: #fee2e2; }
</style>
