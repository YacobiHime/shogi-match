<template>
  <div ref="root" class="shogi-match-root">
    <div class="shogi-match-theme-controls" aria-label="盤と駒の着せ替え">
      <label>
        盤
        <select v-model="selectedBoardTheme">
          <option v-for="theme in boardThemeOptions" :key="theme.id" :value="theme.id" :disabled="!theme.unlocked">
            {{ theme.label }}
          </option>
        </select>
      </label>
      <label>
        駒
        <select v-model="selectedPieceTheme">
          <option v-for="theme in pieceThemeOptions" :key="theme.id" :value="theme.id" :disabled="!theme.unlocked">
            {{ theme.label }}
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
      :custom-piece-stand-image-url="`${normalizedAssetBase}/stand/wood_dark.webp`"
      :hand-piece-order="HandPieceOrder.STRONGER_TO_LEFT"
      :promotion-selector-style="PromotionSelectorStyle.HORIZONTAL"
      :board-label-type="BoardLabelType.STANDARD"
      :max-size="maxSize"
      :position="position"
      :last-move="lastMoveObject"
      :candidates="candidateMoves"
      :movement-arrows="movementArrows"
      :attack-marks="attackMarks"
      :ghost-pieces="ghostPieceInputs"
      :float-labels="floatLabels"
      :callout="callout"
      :risk-destinations="riskDestinations"
      :risk-squares="riskSquares"
      :mark-squares="markSquares"
      :flip="flip"
      :mobile="mobile"
      :allow-move="allowMove"
      :enable-drag-and-drop="enableDragAndDrop"
      :black-player-name="blackPlayerName"
      :white-player-name="whitePlayerName"
      :black-player-detail="blackPlayerDetail"
      :white-player-detail="whitePlayerDetail"
      :player-countdown="playerCountdown"
      :hide-clock="!clocks"
      :black-player-time="clocks?.black"
      :white-player-time="clocks?.white"
      :black-player-byoyomi="clocks?.blackByoyomi"
      :white-player-byoyomi="clocks?.whiteByoyomi"
      :arrow-image-url="`${normalizedAssetBase}/arrow/arrow.svg`"
      @move="onMove"
      @resize="onResize"
    />
    <p v-else class="error" role="alert">局面を表示できません。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import BoardView from "./renderer/view/primitive/BoardView.vue";
import { RectSize } from "./common/assets/geometry";
import {
  CandidateInput,
  candidateMovesFromUsi,
  lastMoveBetween,
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
import {
  BOARD_THEMES,
  BOARD_THEME_KEY,
  DEFAULT_BOARD_THEME,
  DEFAULT_PIECE_THEME,
  PIECE_THEMES,
  PIECE_THEME_KEY,
  THEME_CHANGE_EVENT,
} from "./core/themes.mjs";
import { grantTheme, loadCollection, saveCollection, themeUnlock } from "./core/collection.mjs";
import { Color, PieceType, type Move } from "tsshogi";

type AttackMark = { file: number; rank: number; black: number; white: number };
type SquareMark = { file: number; rank: number; tone: "reach" | "target" | "key" | "covered" | "danger" };
type FloatLabel = { id: string | number; file: number; rank: number; text: string; tone: "good" | "bad"; big?: boolean; sub?: boolean; offset?: boolean; pin?: boolean };
type BoardCallout = {
  at: string; text: string; side: "above" | "below" | "left" | "right";
  x: number; y: number; width: number; height: number; tail: number; reach?: number; tone?: string;
};
type GhostPiece = { file: number; rank: number; kind: string; color?: "black" | "white" };
const GHOST_PIECE_TYPES: Record<string, PieceType> = {
  K: PieceType.KING, R: PieceType.ROOK, B: PieceType.BISHOP, G: PieceType.GOLD,
  S: PieceType.SILVER, N: PieceType.KNIGHT, L: PieceType.LANCE, P: PieceType.PAWN,
};

const props = defineProps({
  sfen: { type: String, required: true },
  candidates: { type: Array as () => CandidateInput[], default: () => [] },
  // 選んだ駒の動ける方向を矢印で見せる(学習対局の「動きの矢印」)。
  movementArrows: { type: Boolean, default: false },
  // 対局の「駒の利き」表示。各升に利いている先手・後手の駒数。
  attackMarks: { type: Array as () => AttackMark[], default: () => [] },
  // 図鑑で、駒の動きや大事なマスを色付けする。
  markSquares: { type: Array as () => SquareMark[], default: () => [] },
  // 駒得の数字(＋6／−5)。取ったマスの上に浮かべる。
  floatLabels: { type: Array as PropType<FloatLabel[]>, default: () => [] },
  // 教室の盤の上のひとこと(tutorial-callout.mjsのplaceCalloutの結果に文とtoneを足したもの)。
  callout: { type: Object as PropType<BoardCallout | null>, default: null },
  // 教室の「囲いを組もう」と、対局中の作戦の完成形で薄く見せる駒。kindはSFENの駒の文字("K"・"G"など)。colorを省くと先手。
  ghostPieces: { type: Array as () => GhostPiece[], default: () => [] },
  // 利きメガネ: 選んだ駒を動かすと取られて損をする行き先を返す。
  riskDestinations: { type: Function as PropType<((source: string) => string[]) | null>, default: null },
  // 悪手の理由で取られる駒の升(N2)。次の手を指すまで赤い輪を出す。
  riskSquares: { type: Array as PropType<string[]>, default: () => [] },
  // 相手の狙い(N2)。相手の手を、その側の色の点線の矢印で出す。手番は相手でないので、手番を入れ替えた局面で手を作る。
  threatArrows: { type: Array as PropType<{ usi: string; color: "black" | "white" }[]>, default: () => [] },
  lastMove: { type: String, default: "" },
  allowMove: { type: Boolean, default: true },
  enableDragAndDrop: { type: Boolean, default: true },
  flip: { type: Boolean, default: false },
  mobile: { type: Boolean, default: false },
  layout: { type: String, default: BoardLayoutType.STANDARD },
  assetBaseUrl: { type: String, default: "." },
  blackPlayerName: { type: String, default: "先手" },
  whitePlayerName: { type: String, default: "後手" },
  blackPlayerDetail: { type: String, default: "" },
  whitePlayerDetail: { type: String, default: "" },
  playerCountdown: { type: Object as PropType<{ color: "black" | "white"; left: number; fraction: number; stage: string; label: string } | null>, default: null },
  // 名札の横の時計(残りの持ち時間の秒と、秒読みの残り秒)。中継(RelayViewer.vue)だけで使う。なければ時計を出さない。
  clocks: {
    type: Object as PropType<{ black: number; white: number; blackByoyomi?: number; whiteByoyomi?: number } | null>,
    default: null,
  },
});
const emit = defineEmits(["usi-move", "invalid-sfen", "resize"]);
const root = ref<HTMLElement | null>(null);
const maxSize = ref(new RectSize(900, 620));
let resizeObserver: ResizeObserver | undefined;

const boardThemes = BOARD_THEMES;
const storage = typeof localStorage === "undefined" ? null : localStorage;
const selectedBoardTheme = ref(storage?.getItem(BOARD_THEME_KEY) || DEFAULT_BOARD_THEME);
const selectedPieceTheme = ref(storage?.getItem(PIECE_THEME_KEY) || DEFAULT_PIECE_THEME);

/*
 * 着せ替えの一部は、コレクションの印の数で使えるようになる(core/collection.mjs)。
 * 前から選んでいた着せ替えは、解放済みとして残す。まだのものは、選択肢に「印あと◯個」と出して選べなくする。
 */
const collection = ref(loadCollection(storage));
function keepChosenThemes() {
  let next = collection.value;
  if (!themeUnlock(next, "board", selectedBoardTheme.value).unlocked) next = grantTheme(next, "board", selectedBoardTheme.value);
  if (!themeUnlock(next, "piece", selectedPieceTheme.value).unlocked) next = grantTheme(next, "piece", selectedPieceTheme.value);
  if (next !== collection.value) {
    collection.value = next;
    saveCollection(storage, next);
  }
}
keepChosenThemes();
function themeOptions(kind: "board" | "piece", themes: readonly { id: string; name: string }[]) {
  return themes.map((theme) => {
    const unlock = themeUnlock(collection.value, kind, theme.id);
    return { ...theme, unlocked: unlock.unlocked, label: unlock.unlocked ? theme.name : `${theme.name}（印あと${unlock.remaining}個）` };
  });
}
const boardThemeOptions = computed(() => themeOptions("board", BOARD_THEMES));
const pieceThemeOptions = computed(() => themeOptions("piece", PIECE_THEMES));
// ほかの画面(やこびノート)で着せ替えを変えたら、開いている盤にも反映する。
function onThemeChange(event: Event) {
  const detail = (event as CustomEvent<{ kind: string; id: string }>).detail;
  collection.value = loadCollection(storage);
  if (detail?.kind === "board") selectedBoardTheme.value = detail.id;
  if (detail?.kind === "piece") selectedPieceTheme.value = detail.id;
}
if (typeof window !== "undefined") window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
onBeforeUnmount(() => {
  if (typeof window !== "undefined") window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
});
const normalizedAssetBase = computed(() => props.assetBaseUrl.replace(/\/$/, ""));
const boardImageUrl = computed(() => {
  const theme = boardThemes.find(({ id }) => id === selectedBoardTheme.value) || boardThemes[0];
  return `${normalizedAssetBase.value}/board/${theme.file}`;
});
const pieceImageTemplate = computed(
  () => `${normalizedAssetBase.value}/piece/${selectedPieceTheme.value}/\${piece}.webp`,
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
// 直前の局面を覚えておき、取った駒まで分かる形で直前の手を復元する(盤の着地の動きに使う)。
const previousSfen = ref("");
watch(() => props.sfen, (_, old) => { previousSfen.value = old ?? ""; });
const lastMoveObject = computed(() =>
  position.value && props.lastMove ? lastMoveBetween(previousSfen.value, position.value, props.lastMove) : null
);
const candidateMoves = computed(() => {
  if (!position.value) return [];
  const moves = candidateMovesFromUsi(position.value, props.candidates);
  for (const { usi, color } of props.threatArrows) {
    try {
      const parts = props.sfen.trim().split(/\s+/);
      parts[1] = color === "white" ? "w" : "b";
      const flipped = positionFromSfen(parts.join(" "));
      moves.push(...candidateMovesFromUsi(flipped, [{ usi, guideKind: color === "white" ? "threat-white" : "threat-black" }]));
    } catch {
      // 作れない手は出さない。
    }
  }
  return moves;
});

const ghostPieceInputs = computed(() => props.ghostPieces.flatMap(({ file, rank, kind, color }) => (
  GHOST_PIECE_TYPES[kind] ? [{ file, rank, type: GHOST_PIECE_TYPES[kind], color: color === "white" ? Color.WHITE : Color.BLACK }] : []
)));

function onMove(move: Move) {
  emit("usi-move", move.usi);
}
function onResize(size: RectSize) {
  emit("resize", { width: size.width, height: size.height });
}
function measure() {
  if (!root.value) return;
  const width = Math.max(1, Math.round(root.value.clientWidth || 900));
  const heightRatio = layoutType.value === BoardLayoutType.PORTRAIT
    ? 1.34
    : layoutType.value === BoardLayoutType.COMPACT ? 0.94 : 0.66;
  const height = Math.max(1, Math.round(root.value.clientHeight || width * heightRatio));
  if (maxSize.value.width === width && maxSize.value.height === height) return;
  maxSize.value = new RectSize(width, height);
}
onMounted(() => {
  measure();
  resizeObserver = new ResizeObserver(measure);
  if (root.value) resizeObserver.observe(root.value);
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(() => [props.sfen, props.layout], () => measure());
watch(selectedBoardTheme, (theme) => storage?.setItem(BOARD_THEME_KEY, theme));
watch(selectedPieceTheme, (theme) => storage?.setItem(PIECE_THEME_KEY, theme));
</script>

<style>
:host { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.shogi-match-root {
  --shadow-color: rgba(0, 0, 0, 0.5);
  /* 名札・手番・成り選択の色は、対局画面（ShogiMatchGame.css）の配色に合わせる。 */
  --text-color: #1d303f;
  --text-bg-color: #fffcf4;
  --text-bg-color-warning: #ffff88;
  --text-bg-color-danger: red;
  --text-color-danger: white;
  --plate-border-color: rgba(29, 48, 63, 0.35);
  --plate-active-color: #f1a54c;
  --plate-active-bg-color: #fff3dc;
  --plate-active-glow: rgba(241, 165, 76, 0.55);
  --plate-active-mark-color: #d9822b;
  --promote-bg-color: #fff3dc;
  --not-promote-bg-color: #cfcabd;
  --turn-label-color: #1d303f;
  --turn-label-bg-color: #f1a54c;
  --turn-label-border-color: #b57c39;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.shogi-match-root .frame {
  margin-inline: auto;
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
