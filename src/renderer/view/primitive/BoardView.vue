<template>
  <div>
    <div class="frame" :style="main.frame.style" @click="clickFrame()">
      <!-- 後手の駒台 -->
      <div class="hand" :class="flip ? 'front' : 'back'" :style="main.whiteHandStyle">
        <div
          class="hand-background"
          :class="{ 'drop-shadows': dropShadows }"
          :style="whiteHand.backgroundStyle"
        >
          <img v-if="whiteHand.textureImagePath" class="full" :src="whiteHand.textureImagePath" />
        </div>
        <div
          v-for="pointer in whiteHand.pointers"
          :key="pointer.id"
          :style="pointer.backgroundStyle"
        ></div>
        <div
          v-for="piece in whiteHand.pieces"
          :key="handPieceKey(Color.WHITE, piece.id)"
          :class="{ 'hand-piece--arrived': isArrivedHandPiece(Color.WHITE, piece.id) }"
          :style="piece.style"
        >
          <img class="piece-image" :src="piece.imagePath" />
        </div>
        <div v-for="number in whiteHand.numbers" :key="number.id" :style="number.style">
          {{ number.character }}
        </div>
      </div>

      <!-- 盤面 -->
      <div class="board" :style="main.boardStyle">
        <div v-if="board.background.textureImagePath" :style="board.background.style">
          <img class="full" :src="board.background.textureImagePath" />
        </div>
        <div
          class="board-background"
          :class="{ 'drop-shadows': dropShadows }"
          :style="board.background.style"
        >
          <BoardGrid class="full" :color="boardGridColor || board.background.gridColor" />
        </div>
        <div v-for="square in board.squares" :key="square.id" :style="square.backgroundStyle"></div>
        <div
          v-for="mark in squareMarkViews"
          :key="'square-mark-' + mark.id"
          class="square-mark"
          :class="'square-mark--' + mark.tone"
          :style="mark.style"
        ></div>
        <div
          v-for="mark in attackMarkViews"
          :key="'attack-tint-' + mark.id"
          class="attack-tint"
          :class="mark.tintClass"
          :style="mark.style"
        ></div>
        <!-- 教室の「囲いを組もう」で、駒を置く目的のマスに薄く見せる完成形の駒。 -->
        <div
          v-for="ghost in ghostPieceViews"
          :key="'ghost-' + ghost.id"
          class="ghost-piece"
          :style="ghost.style"
          aria-hidden="true"
        >
          <img class="piece-image" :src="ghost.imagePath" />
        </div>
        <div
          v-for="piece in board.pieces"
          :key="piece.id"
          :class="piece.landed ? ['piece--landed', `piece--land-${piece.landKind ?? 'move'}`] : []"
          :style="piece.style"
        >
          <img class="piece-image" :src="piece.imagePath" />
        </div>
        <div
          v-for="mark in attackMarkViews"
          :key="'attack-count-' + mark.id"
          class="attack-counts"
          :style="mark.countStyle"
          aria-hidden="true"
        >
          <span v-if="mark.white" class="attack-count attack-count--white">{{ mark.white }}</span>
          <span v-if="mark.black" class="attack-count attack-count--black">{{ mark.black }}</span>
        </div>
        <div v-for="label in board.labels" :key="label.id" :style="label.style">
          {{ label.character }}
        </div>
        <div
          v-for="square in board.squares"
          :key="'selection-' + square.id"
          :class="square.selectionClass"
          :style="square.selectionStyle"
        ></div>
        <!-- 駒得の数字。取った駒の値段を、取ったマスの上に浮かべて消す(教室・学習対局)。 -->
        <div
          v-for="label in floatLabelViews"
          :key="'float-' + label.id"
          class="float-label"
          :class="[`float-label--${label.tone}`, { 'float-label--big': label.big }]"
          :style="label.style"
          aria-hidden="true"
        ><span>{{ label.text }}</span></div>
        <!-- 教室の盤の上のひとこと。見るマスのそばに、しっぽ付きの札を1つだけ出す(tutorial-callout.mjs)。 -->
        <div
          v-if="calloutView"
          :key="calloutView.key"
          class="board-callout"
          :class="[`board-callout--${calloutView.side}`, calloutView.tone ? `board-callout--${calloutView.tone}` : '']"
          :style="calloutView.style"
          aria-hidden="true"
        >{{ calloutView.text }}</div>
        <div
          v-if="calloutView?.lineStyle"
          :key="calloutView.key + ':line'"
          class="board-callout-line"
          :class="calloutView.tone ? `board-callout-line--${calloutView.tone}` : ''"
          :style="calloutView.lineStyle"
          aria-hidden="true"
        ></div>
        <!-- 利きメガネ: 駒を選んだとき、動かすと取られて損をする行き先を赤い輪で示す。 -->
        <div
          v-for="risk in riskSquareViews"
          :key="'risk-' + risk.id"
          class="risk-ring"
          :style="risk.style"
          aria-hidden="true"
        ></div>
      </div>

      <!-- 先手の駒台 -->
      <div class="hand" :class="flip ? 'back' : 'front'" :style="main.blackHandStyle">
        <div
          class="hand-background"
          :class="{ 'drop-shadows': dropShadows }"
          :style="blackHand.backgroundStyle"
        >
          <img v-if="blackHand.textureImagePath" class="full" :src="blackHand.textureImagePath" />
        </div>
        <div
          v-for="pointer in blackHand.pointers"
          :key="pointer.id"
          :style="pointer.backgroundStyle"
        ></div>
        <div
          v-for="piece in blackHand.pieces"
          :key="handPieceKey(Color.BLACK, piece.id)"
          :class="{ 'hand-piece--arrived': isArrivedHandPiece(Color.BLACK, piece.id) }"
          :style="piece.style"
        >
          <img class="piece-image" :src="piece.imagePath" />
        </div>
        <div v-for="number in blackHand.numbers" :key="number.id" :style="number.style">
          {{ number.character }}
        </div>
      </div>

      <svg
        v-for="arrow in arrows"
        :key="arrow.id"
        class="arrows"
        :style="arrow.style"
        aria-hidden="true"
      >
        <line
          :x1="arrow.start.x"
          :y1="arrow.start.y"
          :x2="arrow.shaftEnd.x"
          :y2="arrow.shaftEnd.y"
          :stroke-width="arrow.shaftWidth"
          :stroke="arrow.color"
          class="arrow-shaft"
        />
        <polygon :points="arrow.headPoints" :fill="arrow.color" class="arrow-head" />
      </svg>
      <div
        v-for="arrow in arrows"
        v-show="arrow.labelText"
        :key="'label-' + arrow.id"
        class="arrow-label"
        :style="arrow.labelStyle"
      >
        {{ arrow.labelText }}
      </div>

      <!-- 操作用レイヤー -->
      <div ref="boardOpEl" class="board operation" :style="main.boardStyle">
        <div
          v-for="square in board.squares"
          :key="square.id"
          :style="square.style"
          @click.stop.prevent="clickSquare(square.file, square.rank)"
          @dblclick.stop.prevent="clickSquareR(square.file, square.rank)"
          @contextmenu.stop.prevent="clickSquareR(square.file, square.rank)"
          @pointerdown="onSquarePointerDown($event, square.file, square.rank)"
        ></div>
        <div
          v-if="board.promote"
          class="promote"
          :style="board.promote.style"
          @click.stop.prevent="clickPromote()"
        >
          <img class="piece-image" :src="board.promote.imagePath" draggable="false" />
        </div>
        <div
          v-if="board.doNotPromote"
          class="not-promote"
          :style="board.doNotPromote.style"
          @click.stop.prevent="clickNotPromote()"
        >
          <img class="piece-image" :src="board.doNotPromote.imagePath" draggable="false" />
        </div>
      </div>
      <div ref="blackHandOpEl" class="hand operation" :style="main.blackHandStyle">
        <div
          :style="blackHand.touchAreaStyle"
          @click.stop.prevent="clickHandArea(Color.BLACK)"
        ></div>
        <div
          v-for="pointer in blackHand.pointers"
          :key="pointer.id"
          :style="pointer.style"
          @click.stop.prevent="clickHand(Color.BLACK, pointer.type)"
          @pointerdown.stop="onHandPointerDown($event, Color.BLACK, pointer.type)"
        ></div>
      </div>
      <div ref="whiteHandOpEl" class="hand operation" :style="main.whiteHandStyle">
        <div
          :style="whiteHand.touchAreaStyle"
          @click.stop.prevent="clickHandArea(Color.WHITE)"
        ></div>
        <div
          v-for="pointer in whiteHand.pointers"
          :key="pointer.id"
          :style="pointer.style"
          @click.stop.prevent="clickHand(Color.WHITE, pointer.type)"
          @pointerdown.stop="onHandPointerDown($event, Color.WHITE, pointer.type)"
        ></div>
      </div>

      <!-- 先手の対局者名 -->
      <div
        class="player-name"
        :class="{ active: position.color == 'black', 'player-name--detail': blackPlayerDetail }"
        :style="main.blackPlayerName.style"
        :title="blackPlayerDetail ? `${blackPlayerName} ${blackPlayerDetail}` : undefined"
      >
        <span class="player-name-text">☗{{ blackPlayerName }}</span>
        <span v-if="blackPlayerDetail" class="player-name-detail">{{ blackPlayerDetail }}</span>
      </div>

      <!-- 先手の持ち時間 -->
      <div
        v-if="main.blackClock"
        class="clock"
        :class="blackPlayerTimeSeverity"
        :style="main.blackClock.style"
      >
        <span class="clock-text">{{ blackPlayerTimeText }}</span>
      </div>

      <!-- 後手の対局者名 -->
      <div
        class="player-name"
        :class="{ active: position.color == 'white', 'player-name--detail': whitePlayerDetail }"
        :style="main.whitePlayerName.style"
        :title="whitePlayerDetail ? `${whitePlayerName} ${whitePlayerDetail}` : undefined"
      >
        <span class="player-name-text">☖{{ whitePlayerName }}</span>
        <span v-if="whitePlayerDetail" class="player-name-detail">{{ whitePlayerDetail }}</span>
      </div>

      <!-- 後手の持ち時間 -->
      <div
        v-if="main.whiteClock"
        class="clock"
        :class="whitePlayerTimeSeverity"
        :style="main.whiteClock.style"
      >
        <span class="clock-text">{{ whitePlayerTimeText }}</span>
      </div>

      <!-- 手番 -->
      <div v-if="main.turn" class="turn" :style="main.turn.style">{{ t.nextTurn }}</div>

      <!-- コントロールパネル -->
      <div v-if="main.control" class="control" :style="main.control.left.style">
        <slot name="left-control"></slot>
      </div>
      <div v-if="main.control" class="control" :style="main.control.right.style">
        <slot name="right-control"></slot>
      </div>
    </div>
  </div>

  <!-- ドラッグ中の駒ゴースト -->
  <Teleport :to="ghostTeleportTarget">
    <div
      v-if="drag.active && drag.pieceImagePath"
      :style="{
        position: 'fixed',
        left: drag.ghostX + 'px',
        top: drag.ghostY + 'px',
        width: ghostPieceSize.width + 'px',
        height: ghostPieceSize.height + 'px',
        transform: 'translate(-50%, -50%)',
        'pointer-events': 'none',
        'z-index': '1000000',
      }"
    >
      <img :src="drag.pieceImagePath" style="width: 100%; height: 100%" draggable="false" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  PieceType,
  Square,
  Piece,
  Color,
  Move,
  ImmutablePosition,
  PositionChange,
  secondsToHHMMSS,
  reverseColor,
  unpromotedPieceType,
} from "tsshogi";
import { computed, reactive, ref, watch, onMounted, onUnmounted, PropType } from "vue";
import {
  BoardImageType,
  BoardLabelType,
  HandPieceOrder,
  KingPieceType,
  PieceStandImageType,
  PromotionSelectorStyle,
} from "@/common/settings/app";
import { Point, RectSize } from "@/common/assets/geometry";
import { newConfig } from "./board/config";
import { StandardLayoutBuilder } from "./board/standard";
import { PortraitLayoutBuilder } from "./board/portrait";
import { BoardLayoutBuilder } from "./board/board";
import {
  CompactHandLayoutBuilder,
  HandLayoutBuilder,
  PortraitHandLayoutBuilder,
} from "./board/hand";
import { BoardLayoutType } from "@/common/settings/layout";
import { CompactLayoutBuilder } from "./board/compact";
import BoardGrid from "./BoardGrid.vue";
import { t } from "@/common/i18n";
import { legalDestinationSquares, movementArrowMoves } from "@/position";
import { parallelArrowLaneOffsets } from "./arrow-layout";
import {
  boardParams,
  commonParams,
  handParams,
  compactHandParams,
  portraitHandParams,
} from "./board/params";

type CandidateMove = {
  move: Move;
  score?: number; // 手番側視点の数値スコア（showArrowScore が有効な場合のみ設定）
  promotion?: "成" | "不成";
  guideKind?: "plan" | "unsafe-plan" | "urgent" | "ai" | "move";
};

type State = {
  pointer: Square | Piece | null;
  reservedMove: Move | null;
};

const props = defineProps({
  layoutType: {
    type: String as PropType<BoardLayoutType>,
    required: false,
    default: BoardLayoutType.STANDARD,
  },
  boardImageType: {
    type: String as PropType<BoardImageType>,
    required: true,
  },
  customBoardImageUrl: {
    type: String,
    required: false,
    default: undefined,
  },
  boardImageOpacity: {
    type: Number,
    required: false,
    default: 1.0,
  },
  boardGridColor: {
    type: String,
    required: false,
    default: undefined,
  },
  pieceImageUrlTemplate: {
    type: String,
    required: true,
  },
  kingPieceType: {
    type: String as PropType<KingPieceType>,
    required: true,
  },
  pieceStandImageType: {
    type: String as PropType<PieceStandImageType>,
    required: true,
  },
  customPieceStandImageUrl: {
    type: String,
    required: false,
    default: undefined,
  },
  pieceStandImageOpacity: {
    type: Number,
    required: false,
    default: 1.0,
  },
  handPieceOrder: {
    type: String as PropType<HandPieceOrder>,
    required: false,
    default: HandPieceOrder.STRONGER_TO_LEFT,
  },
  promotionSelectorStyle: {
    type: String as PropType<PromotionSelectorStyle>,
    required: false,
    default: PromotionSelectorStyle.HORIZONTAL,
  },
  boardLabelType: {
    type: String as PropType<BoardLabelType>,
    required: true,
  },
  maxSize: {
    type: RectSize,
    required: true,
  },
  position: {
    type: Object as PropType<ImmutablePosition>,
    required: true,
  },
  lastMove: {
    type: Object as PropType<Move | null>,
    required: false,
    default: null,
  },
  candidates: {
    type: Array as PropType<CandidateMove[]>,
    required: false,
    default: () => [],
  },
  // 選んだ駒の動き方を矢印で見せる(学習対局の「動きの矢印」)。
  movementArrows: {
    type: Boolean,
    required: false,
    default: false,
  },
  // 駒得の数字(＋6／−5)。取ったマスの上に浮かべる。idが変わるたびに動きをやり直す。
  floatLabels: {
    type: Array as PropType<{ id: string | number; file: number; rank: number; text: string; tone: string; big?: boolean }[]>,
    required: false,
    default: () => [],
  },
  // 教室の盤の上のひとこと。位置はtutorial-callout.mjsのplaceCalloutで決めた、先手から見た盤の座標(マスを1とする)。
  callout: {
    type: Object as PropType<{
      at: string; text: string; side: "above" | "below" | "left" | "right";
      x: number; y: number; width: number; height: number; tail: number; reach?: number; tone?: string;
    } | null>,
    required: false,
    default: null,
  },
  // 教室の「囲いを組もう」の完成形。目的のマスに薄く駒を描く。
  ghostPieces: {
    type: Array as PropType<{ file: number; rank: number; type: PieceType; color: Color }[]>,
    required: false,
    default: () => [],
  },
  // 利きメガネ: 選んだ駒(盤の駒は"5e"、持ち駒は"P*")を動かすと取られて損をする行き先(USIのマス)を返す。
  riskDestinations: {
    type: Function as PropType<((source: string) => string[]) | null>,
    required: false,
    default: null,
  },
  attackMarks: {
    type: Array as PropType<{ file: number; rank: number; black: number; white: number }[]>,
    required: false,
    default: () => [],
  },
  markSquares: {
    type: Array as PropType<{ file: number; rank: number; tone: string }[]>,
    required: false,
    default: () => [],
  },
  flip: {
    type: Boolean,
    required: false,
  },
  hideClock: {
    type: Boolean,
    required: false,
    default: false,
  },
  mobile: {
    type: Boolean,
    required: false,
    default: false,
  },
  allowEdit: {
    type: Boolean,
    required: false,
  },
  allowMove: {
    type: Boolean,
    required: false,
  },
  enableDragAndDrop: {
    type: Boolean,
    required: false,
    default: true,
  },
  blackPlayerName: {
    type: String,
    required: false,
    default: "先手",
  },
  whitePlayerName: {
    type: String,
    required: false,
    default: "後手",
  },
  // 対局者名の下に小さく添える補足（CPUの棋力など）。
  blackPlayerDetail: {
    type: String,
    required: false,
    default: "",
  },
  whitePlayerDetail: {
    type: String,
    required: false,
    default: "",
  },
  blackPlayerTime: {
    type: Number,
    required: false,
    default: undefined,
  },
  blackPlayerByoyomi: {
    type: Number,
    required: false,
    default: undefined,
  },
  whitePlayerTime: {
    type: Number,
    required: false,
    default: undefined,
  },
  whitePlayerByoyomi: {
    type: Number,
    required: false,
    default: undefined,
  },
  dropShadows: {
    type: Boolean,
    required: false,
    default: true,
  },
  ghostTeleportTarget: {
    type: [String, Object] as PropType<string | HTMLElement>,
    required: false,
    default: "body",
  },
  arrowImageUrl: {
    type: String,
    required: false,
    default: "/arrow/arrow.svg",
  },
});

const emit = defineEmits<{
  resize: [size: RectSize];
  move: [move: Move];
  edit: [change: PositionChange];
}>();

const state = reactive({
  pointer: null,
  reservedMove: null,
} as State);

const resetState = () => {
  state.pointer = null;
  state.reservedMove = null;
};

watch(
  [() => props.position, () => props.position.sfen, () => props.allowEdit, () => props.allowMove],
  () => {
    resetState();
    resetDrag();
  },
);

type DragState = {
  pending: boolean; // pointerdown 記録済み、動き待ち
  active: boolean; // ゴースト表示中
  pointerId: number | null;
  source: Square | Piece | null;
  pieceImagePath: string | null;
  ghostX: number;
  ghostY: number;
  startX: number;
  startY: number;
};

const drag = reactive<DragState>({
  pending: false,
  active: false,
  pointerId: null,
  source: null,
  pieceImagePath: null,
  ghostX: 0,
  ghostY: 0,
  startX: 0,
  startY: 0,
});

const resetDrag = () => {
  drag.pending = false;
  drag.active = false;
  drag.pointerId = null;
  drag.source = null;
  drag.pieceImagePath = null;
  document.body.style.cursor = "";
};

// ドラッグ完了後に click イベントを無効化するフラグ（非リアクティブ）
let dragCompletedFlag = false;

const boardOpEl = ref<HTMLElement | null>(null);
const blackHandOpEl = ref<HTMLElement | null>(null);
const whiteHandOpEl = ref<HTMLElement | null>(null);

// ドラッグ中のゴースト駒サイズ
const ghostPieceSize = computed(() => ({
  width: commonParams.piece.width * main.value.ratio,
  height: commonParams.piece.height * main.value.ratio,
}));

// 駒の画像URLを取得
const getPieceImagePath = (piece: Piece): string => {
  const displayColor = config.value.flip ? reverseColor(piece.color) : piece.color;
  const pieceType =
    piece.type === PieceType.KING && piece.color === Color.BLACK ? "king2" : piece.type;
  return config.value.pieceImages[displayColor][pieceType as PieceType | "king2"];
};

// ドラッグ開始候補を記録（盤上の駒）
const beginDragFromSquare = (
  clientX: number,
  clientY: number,
  file: number,
  rank: number,
  pointerId: number,
) => {
  if (!props.enableDragAndDrop) {
    return;
  }
  if (!props.allowMove && !props.allowEdit) {
    return;
  }
  if (state.reservedMove) {
    return;
  }
  const square = new Square(file, rank);
  const piece = props.position.board.at(square);
  if (!piece) {
    return;
  }
  if (!props.allowEdit && piece.color !== props.position.color) {
    return;
  }
  drag.pending = true;
  drag.pointerId = pointerId;
  drag.source = square;
  drag.pieceImagePath = getPieceImagePath(piece);
  drag.startX = clientX;
  drag.startY = clientY;
  drag.ghostX = clientX;
  drag.ghostY = clientY;
};

// ドラッグ開始候補を記録（持ち駒）
const beginDragFromHand = (
  clientX: number,
  clientY: number,
  color: Color,
  type: PieceType,
  pointerId: number,
) => {
  if (!props.enableDragAndDrop) {
    return;
  }
  if (!props.allowMove && !props.allowEdit) {
    return;
  }
  if (state.reservedMove) {
    return;
  }
  if (props.position.hand(color).count(type) === 0) {
    return;
  }
  if (!props.allowEdit && color !== props.position.color) {
    return;
  }
  drag.pending = true;
  drag.pointerId = pointerId;
  drag.source = new Piece(color, type);
  drag.pieceImagePath = getPieceImagePath(new Piece(color, type));
  drag.startX = clientX;
  drag.startY = clientY;
  drag.ghostX = clientX;
  drag.ghostY = clientY;
};

// ドラッグを有効化してゴーストを表示
const activateDrag = () => {
  drag.active = true;
  document.body.style.cursor = "grabbing";
  // ソースをポインタに設定することでハイライト・候補表示を流用
  if (drag.source) {
    state.pointer = drag.source;
  }
};

const DRAG_THRESHOLD_SQ = 25; // 5px の2乗

// カーソル座標から盤上のマスを逆算
// .board.operation div は絶対配置の子のみのため getBoundingClientRect() の width/height が 0 になる。
// そのため rect.right / rect.bottom ではなく boardParams の実寸で範囲チェックする。
const getSquareFromClientPoint = (clientX: number, clientY: number): Square | null => {
  if (!boardOpEl.value) {
    return null;
  }
  const rect = boardOpEl.value.getBoundingClientRect();
  const ratio = main.value.ratio;
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  if (
    localX < 0 ||
    localX > boardParams.width * ratio ||
    localY < 0 ||
    localY > boardParams.height * ratio
  ) {
    return null;
  }
  const squareW = boardParams.squareWidth * ratio;
  const squareH = boardParams.squareHeight * ratio;
  const leftPad = boardParams.leftSquarePadding * ratio;
  const topPad = boardParams.topSquarePadding * ratio;
  const xi = Math.floor((localX - leftPad) / squareW);
  const yi = Math.floor((localY - topPad) / squareH);
  if (xi < 0 || xi > 8 || yi < 0 || yi > 8) {
    return null;
  }
  const file = config.value.flip ? xi + 1 : 9 - xi;
  const rank = config.value.flip ? 9 - yi : yi + 1;
  return new Square(file, rank);
};

// カーソル座標から駒台の手番色を特定
// .hand.operation div も同様に width/height が 0 になるためレイアウト種別に応じた実寸を使う。
const getHandColorFromClientPoint = (clientX: number, clientY: number): Color | null => {
  const ratio = main.value.ratio;
  let handW: number, handH: number;
  switch (props.layoutType) {
    case BoardLayoutType.COMPACT:
      handW = compactHandParams.width * ratio;
      handH = compactHandParams.height * ratio;
      break;
    case BoardLayoutType.PORTRAIT:
      handW = portraitHandParams.width * ratio;
      handH = portraitHandParams.height * ratio;
      break;
    default:
      handW = handParams.width * ratio;
      handH = handParams.height * ratio;
  }
  const inHand = (el: HTMLElement | null) => {
    if (!el) {
      return false;
    }
    const r = el.getBoundingClientRect();
    const lx = clientX - r.left;
    const ly = clientY - r.top;
    return lx >= 0 && lx <= handW && ly >= 0 && ly <= handH;
  };
  if (inHand(blackHandOpEl.value)) {
    return Color.BLACK;
  }
  if (inHand(whiteHandOpEl.value)) {
    return Color.WHITE;
  }
  return null;
};

// ドロップを処理
const completeDrop = (clientX: number, clientY: number) => {
  if (!drag.active) {
    return;
  }
  const source = drag.source;
  const square = getSquareFromClientPoint(clientX, clientY);
  if (square && source) {
    // ドロップ先に駒がある場合に clickSquare() を呼ぶとキャンセルと同時にその駒を選択してしまうため有効な移動かどうかを先に判定する。
    const moveFrom = source instanceof Square ? source : (source as Piece).type;
    const move = props.allowMove ? props.position.createMove(moveFrom, square) : null;
    const validMove =
      move !== null &&
      (props.position.isValidMove(move) || props.position.isValidMove(move.withPromote()));
    const validEdit = props.allowEdit && props.position.isValidEditing(source, square);
    if (validMove || validEdit) {
      clickSquare(square.file, square.rank);
    } else {
      resetState();
    }
  } else {
    const color = getHandColorFromClientPoint(clientX, clientY);
    if (color !== null) {
      clickHandArea(color);
    } else {
      resetState();
    }
  }
  dragCompletedFlag = true;
};

// グローバルポインタイベントハンドラ
const onGlobalPointerMove = (e: PointerEvent) => {
  if (e.pointerId !== drag.pointerId) {
    return;
  }
  if (!drag.pending && !drag.active) {
    return;
  }
  drag.ghostX = e.clientX;
  drag.ghostY = e.clientY;
  if (!drag.active) {
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD_SQ) {
      activateDrag();
    }
  }
};

const onGlobalPointerUp = (e: PointerEvent) => {
  if (e.pointerId !== drag.pointerId) {
    return;
  }
  if (drag.active) {
    completeDrop(e.clientX, e.clientY);
  }
  resetDrag();
};

const onGlobalPointerCancel = (e: PointerEvent) => {
  if (e.pointerId !== drag.pointerId) {
    return;
  }
  if (drag.active) {
    resetState();
  }
  resetDrag();
};

// 盤上マス：pointerdown
const onSquarePointerDown = (e: PointerEvent, file: number, rank: number) => {
  if (e.button !== 0) {
    return;
  } // 左ボタン・タッチのみ
  if (drag.pending || drag.active) {
    return;
  }
  dragCompletedFlag = false;
  beginDragFromSquare(e.clientX, e.clientY, file, rank, e.pointerId);
};

// 持ち駒：pointerdown
const onHandPointerDown = (e: PointerEvent, color: Color, type: PieceType) => {
  if (e.button !== 0) {
    return;
  } // 左ボタン・タッチのみ
  if (drag.pending || drag.active) {
    return;
  }
  dragCompletedFlag = false;
  beginDragFromHand(e.clientX, e.clientY, color, type, e.pointerId);
};

onMounted(() => {
  document.addEventListener("pointermove", onGlobalPointerMove);
  document.addEventListener("pointerup", onGlobalPointerUp);
  document.addEventListener("pointercancel", onGlobalPointerCancel);
});

onUnmounted(() => {
  document.removeEventListener("pointermove", onGlobalPointerMove);
  document.removeEventListener("pointerup", onGlobalPointerUp);
  document.removeEventListener("pointercancel", onGlobalPointerCancel);
  document.body.style.cursor = "";
});

const clickFrame = () => {
  if (dragCompletedFlag) {
    dragCompletedFlag = false;
    return;
  }
  resetState();
};

const updatePointer = (newPointer: Square | Piece, empty: boolean, color: Color | undefined) => {
  // reactiveで包むとSquare・Pieceのクラスの型が外れ、instanceofで絞り込めなくなるため、元の型に戻す。
  const prevPointer = state.pointer as State["pointer"];
  resetState();
  if (
    newPointer instanceof Square &&
    prevPointer instanceof Square &&
    newPointer.equals(prevPointer)
  ) {
    return;
  }
  if (
    newPointer instanceof Piece &&
    prevPointer instanceof Piece &&
    newPointer.equals(prevPointer)
  ) {
    return;
  }
  if (prevPointer) {
    const editFrom = prevPointer;
    const editTo = newPointer instanceof Square ? newPointer : newPointer.color;
    if (props.allowEdit && props.position.isValidEditing(editFrom, editTo)) {
      emit("edit", {
        move: {
          from: prevPointer,
          to: editTo,
        },
      });
      return;
    }
    if (props.allowMove && newPointer instanceof Square) {
      const moveFrom = prevPointer instanceof Square ? prevPointer : prevPointer.type;
      const moveTo = newPointer;
      const move = props.position.createMove(moveFrom, moveTo);
      if (!move) {
        return;
      }
      const noProm = props.position.isValidMove(move);
      const prom = props.position.isValidMove(move.withPromote());
      if (noProm && prom) {
        state.reservedMove = move;
        return;
      }
      if (noProm) {
        emit("move", move);
        return;
      }
      if (prom) {
        emit("move", move.withPromote());
        return;
      }
    }
  }
  if ((!props.allowMove && !props.allowEdit) || empty) {
    return;
  }
  if (!props.allowEdit && color !== props.position.color) {
    return;
  }
  state.pointer = newPointer;
};

const clickSquare = (file: number, rank: number) => {
  if (dragCompletedFlag) {
    dragCompletedFlag = false;
    return;
  }
  const square = new Square(file, rank);
  const piece = props.position.board.at(square);
  const empty = !piece;
  updatePointer(square, empty, piece?.color);
};

const clickHandArea = (color: Color) => {
  if (dragCompletedFlag) {
    dragCompletedFlag = false;
    return;
  }
  // 局面編集の場合はどの持ち駒でもない領域をクリックしても移動先として認識する。
  // empty = true なので移動先としてのみ利用され選択は残らない。
  updatePointer(new Piece(color, PieceType.PAWN), true, color);
};

const clickHand = (color: Color, type: PieceType) => {
  if (dragCompletedFlag) {
    dragCompletedFlag = false;
    return;
  }
  const empty = props.position.hand(color).count(type) === 0;
  updatePointer(new Piece(color, type), empty, color);
};

const clickSquareR = (file: number, rank: number) => {
  // モバイルの端末では異なるマスを素早く連続でタップするとダブルタップ判定されてしまうので、
  // 成・不成選択のUIがキャンセルされないようにイベントを無視する。
  if (props.mobile && !props.allowEdit) {
    return;
  }
  resetState();
  const square = new Square(file, rank);
  if (props.allowEdit && props.position.board.at(square)) {
    emit("edit", { rotate: square });
  }
};

const clickPromote = () => {
  const move = state.reservedMove;
  resetState();
  if (move && props.position.isValidMove(move.withPromote())) {
    emit("move", move.withPromote());
  }
};

const clickNotPromote = () => {
  const move = state.reservedMove;
  resetState();
  if (move && props.position.isValidMove(move)) {
    emit("move", move);
  }
};

const config = computed(() => {
  return newConfig({
    boardImageType: props.boardImageType,
    customBoardImageURL: props.customBoardImageUrl,
    pieceStandImageType: props.pieceStandImageType,
    customPieceStandImageURL: props.customPieceStandImageUrl,
    pieceImageURLTemplate: props.pieceImageUrlTemplate,
    kingPieceType: props.kingPieceType,
    boardImageOpacity: props.boardImageOpacity,
    pieceStandImageOpacity: props.pieceStandImageOpacity,
    handPieceOrder: props.handPieceOrder,
    promotionSelectorStyle: props.promotionSelectorStyle,
    boardLabelType: props.boardLabelType,
    upperSizeLimit: props.maxSize,
    flip: props.flip,
    hideClock: props.hideClock,
  });
});

const layoutBuilder = computed(() => {
  switch (props.layoutType) {
    default:
      return new StandardLayoutBuilder(config.value);
    case BoardLayoutType.COMPACT:
      return new CompactLayoutBuilder(config.value);
    case BoardLayoutType.PORTRAIT:
      return new PortraitLayoutBuilder(config.value);
  }
});

let lastFrameSize: RectSize | null = null;
const main = computed(() => {
  const main = layoutBuilder.value.build(props.position);
  if (!lastFrameSize || !lastFrameSize.equals(main.frame.size)) {
    emit("resize", main.frame.size);
    lastFrameSize = main.frame.size;
  }
  return main;
});

const boardLayoutBuilder = computed(() => {
  return new BoardLayoutBuilder(config.value, main.value.ratio);
});

const squareMarkViews = computed(() => {
  if (!props.markSquares.length) return [];
  const marks = new Map(props.markSquares.map((mark) => [`${mark.file}${mark.rank}`, mark.tone]));
  return board.value.squares.flatMap((square) => {
    const tone = marks.get(`${square.file}${square.rank}`);
    return tone ? [{ id: square.id, tone, style: square.style }] : [];
  });
});

const floatLabelViews = computed(() => {
  if (!props.floatLabels.length) return [];
  const squares = new Map(board.value.squares.map((square) => [`${square.file}${square.rank}`, square]));
  return props.floatLabels.flatMap((label) => {
    const square = squares.get(`${label.file}${label.rank}`);
    if (!square) return [];
    const height = Number.parseFloat(String(square.style.height)) || 0;
    return [{
      ...label,
      style: { ...square.style, fontSize: `${Math.max(14, height * (label.big ? 0.52 : 0.42))}px` },
    }];
  });
});

const FLIPPED_SIDES = { above: "below", below: "above", left: "right", right: "left" } as const;
const calloutView = computed(() => {
  const callout = props.callout;
  if (!callout) return null;
  const file = Number(callout.at[0]);
  const rank = callout.at.charCodeAt(1) - 96;
  const square = board.value.squares.find((item) => item.file === file && item.rank === rank);
  if (!square) return null;
  const w = Number.parseFloat(String(square.style.width)) || 0;
  const h = Number.parseFloat(String(square.style.height)) || 0;
  const left = Number.parseFloat(String(square.style.left)) || 0;
  const top = Number.parseFloat(String(square.style.top)) || 0;
  // 札の座標は先手から見た盤なので、盤を反転しているときは札も反転する。
  const flip = config.value.flip;
  const col = flip ? file - 1 : 9 - file;
  const row = flip ? 9 - rank : rank - 1;
  const x = flip ? 9 - callout.x - callout.width : callout.x;
  const y = flip ? 9 - callout.y - callout.height : callout.y;
  const vertical = callout.side === "above" || callout.side === "below";
  const tail = flip ? (vertical ? callout.width : callout.height) - callout.tail : callout.tail;
  // 札を見るマスから離して置いたときは、札のしっぽから見るマスの手前まで線を引く(先手から見た盤の座標で決めてから画面へ移す)。
  const screen = (bx: number, by: number) => ({
    x: left + ((flip ? 9 - bx : bx) - col) * w,
    y: top + ((flip ? 9 - by : by) - row) * h,
  });
  const baseCol = 9 - file;
  const baseRow = rank - 1;
  const margin = 0.06;
  const ends = !callout.reach
    ? null
    : callout.side === "above"
      ? [screen(baseCol + 0.5, callout.y + callout.height), screen(baseCol + 0.5, baseRow - margin)]
      : callout.side === "below"
        ? [screen(baseCol + 0.5, baseRow + 1 + margin), screen(baseCol + 0.5, callout.y)]
        : callout.side === "left"
          ? [screen(callout.x + callout.width, baseRow + 0.5), screen(baseCol - margin, baseRow + 0.5)]
          : [screen(baseCol + 1 + margin, baseRow + 0.5), screen(callout.x, baseRow + 0.5)];
  const lineStyle = ends
    ? {
      left: `${Math.min(ends[0].x, ends[1].x) - (vertical ? 1 : 0)}px`,
      top: `${Math.min(ends[0].y, ends[1].y) - (vertical ? 0 : 1)}px`,
      width: vertical ? "2px" : `${Math.abs(ends[1].x - ends[0].x)}px`,
      height: vertical ? `${Math.abs(ends[1].y - ends[0].y)}px` : "2px",
    }
    : null;
  return {
    lineStyle,
    key: `${callout.at}:${callout.text}`,
    text: callout.text,
    tone: callout.tone ?? "",
    side: flip ? FLIPPED_SIDES[callout.side] : callout.side,
    style: {
      left: `${left + (x - col) * w}px`,
      top: `${top + (y - row) * h}px`,
      width: `${callout.width * w}px`,
      height: `${callout.height * h}px`,
      fontSize: `${Math.max(11, w * 0.3)}px`,
      "--callout-tail": `${tail * (vertical ? w : h)}px`,
    },
  };
});

const ghostPieceViews = computed(() => {
  if (!props.ghostPieces.length) return [];
  const ghosts = new Map(props.ghostPieces.map((ghost) => [`${ghost.file}${ghost.rank}`, ghost]));
  return board.value.squares.flatMap((square) => {
    const ghost = ghosts.get(`${square.file}${square.rank}`);
    if (!ghost) return [];
    return [{ id: square.id, style: square.style, imagePath: getPieceImagePath(new Piece(ghost.color, ghost.type)) }];
  });
});

const USI_HAND_LETTERS: Partial<Record<PieceType, string>> = {
  [PieceType.PAWN]: "P",
  [PieceType.LANCE]: "L",
  [PieceType.KNIGHT]: "N",
  [PieceType.SILVER]: "S",
  [PieceType.GOLD]: "G",
  [PieceType.BISHOP]: "B",
  [PieceType.ROOK]: "R",
};

const riskSquareViews = computed(() => {
  if (!props.riskDestinations || !props.allowMove) return [];
  const pointer = state.pointer;
  const source = pointer instanceof Square
    ? pointer.usi
    : pointer instanceof Piece && USI_HAND_LETTERS[pointer.type]
      ? `${USI_HAND_LETTERS[pointer.type]}*`
      : "";
  if (!source) return [];
  const risky = new Set(props.riskDestinations(source));
  if (!risky.size) return [];
  return board.value.squares.flatMap((square) => (
    risky.has(`${square.file}${String.fromCharCode(96 + square.rank)}`) ? [{ id: square.id, style: square.style }] : []
  ));
});

const attackMarkViews = computed(() => {
  if (!props.attackMarks.length) return [];
  const marks = new Map(props.attackMarks.map((mark) => [`${mark.file}${mark.rank}`, mark]));
  return board.value.squares.flatMap((square) => {
    const mark = marks.get(`${square.file}${square.rank}`);
    if (!mark) return [];
    const height = Number.parseFloat(String(square.style.height)) || 0;
    // 先手だけ・後手だけ・両者が利かせている升を色で分ける。
    const tintClass = mark.black && mark.white
      ? "attack-tint--both"
      : mark.black ? "attack-tint--black" : "attack-tint--white";
    return [{
      id: square.id,
      black: mark.black,
      white: mark.white,
      tintClass,
      style: square.style,
      countStyle: { ...square.style, fontSize: `${Math.max(9, height * 0.26)}px` },
    }];
  });
});

const board = computed(() => {
  const dragSourceSquare = drag.active && drag.source instanceof Square ? drag.source : undefined;
  const selectedSource =
    state.pointer instanceof Square
      ? state.pointer
      : state.pointer instanceof Piece
        ? state.pointer.type
        : null;
  const legalDestinations =
    props.allowMove && selectedSource !== null
      ? legalDestinationSquares(props.position, selectedSource)
      : [];
  return boardLayoutBuilder.value.build(
    props.position.board,
    props.lastMove,
    state.pointer,
    state.reservedMove,
    dragSourceSquare,
    legalDestinations,
  );
});

const handLayoutBuilder = computed(() => {
  switch (props.layoutType) {
    default:
      return new HandLayoutBuilder(config.value, main.value.ratio);
    case BoardLayoutType.COMPACT:
      return new CompactHandLayoutBuilder(config.value, main.value.ratio);
    case BoardLayoutType.PORTRAIT:
      return new PortraitHandLayoutBuilder(config.value, main.value.ratio);
  }
});

const blackHand = computed(() => {
  const dragSourceType =
    drag.active && drag.source instanceof Piece && drag.source.color === Color.BLACK
      ? drag.source.type
      : undefined;
  return handLayoutBuilder.value.build(
    props.position.hand(Color.BLACK),
    Color.BLACK,
    state.pointer,
    dragSourceType,
  );
});

/*
 * 直前の手で取った駒が入った駒台の駒。取った駒の行き先が分かるよう、入った駒を跳ねさせる。
 * 駒台の駒のidは、駒を並べる配置では「種類＋番号」、数字で数を出す配置では「種類」。
 * 数字で数を出す配置では同じ駒が残るので、keyを変えて動きをもう一度付ける。
 */
const arrivedHandPiece = computed(() => {
  const move = props.lastMove;
  if (!move?.capturedPieceType) return null;
  const type = unpromotedPieceType(move.capturedPieceType);
  const count = props.position.hand(move.color).count(type);
  if (count < 1) return null;
  return { color: move.color, ids: new Set<string>([`${type}${count - 1}`, type]), key: props.position.sfen };
});
function isArrivedHandPiece(color: Color, id: string) {
  const arrived = arrivedHandPiece.value;
  return !!arrived && arrived.color === color && arrived.ids.has(id);
}
function handPieceKey(color: Color, id: string) {
  return isArrivedHandPiece(color, id) ? `${id}:${arrivedHandPiece.value?.key}` : id;
}

const whiteHand = computed(() => {
  const dragSourceType =
    drag.active && drag.source instanceof Piece && drag.source.color === Color.WHITE
      ? drag.source.type
      : undefined;
  return handLayoutBuilder.value.build(
    props.position.hand(Color.WHITE),
    Color.WHITE,
    state.pointer,
    dragSourceType,
  );
});

/** 動きの矢印。駒を選んでいる間は、ほかの案内の矢印の代わりに、その駒が動ける方向へ青い矢印を出す。 */
const movementCandidates = computed<CandidateMove[]>(() => {
  if (!props.movementArrows || !props.allowMove || !(state.pointer instanceof Square)) return [];
  return movementArrowMoves(props.position, state.pointer).map((move) => ({ move, guideKind: "move" as const }));
});
const shownCandidates = computed(() => (
  movementCandidates.value.length ? movementCandidates.value : props.candidates
));

/** 矢印の色。危険な定跡手は橙、動きの矢印は動けるマスの点と同じ青、それ以外(AI候補・定跡)は赤。 */
function arrowColor(guideKind: CandidateMove["guideKind"]) {
  if (guideKind === "unsafe-plan") return "#ff9d00";
  if (guideKind === "move") return "#1d6fe0";
  return "#fe0000";
}

const arrows = computed(() => {
  const arrowWidth = 30 * main.value.ratio;
  const candidates = shownCandidates.value;
  const n = candidates.length;
  const bestScore = candidates.reduce<number | undefined>(
    (best, c) => (c.score !== undefined && (best === undefined || c.score > best) ? c.score : best),
    undefined,
  );
  const geometries = candidates.map((candidate) => {
    const move = candidate.move;
    const boardBase = layoutBuilder.value.boardBasePoint;
    const blackHandBase = layoutBuilder.value.blackHandBasePoint;
    const whiteHandBase = layoutBuilder.value.whiteHandBasePoint;
    const start =
      move.from instanceof Square
        ? boardBase.add(boardLayoutBuilder.value.centerOfSquare(move.from))
        : move.color === Color.BLACK
          ? blackHandBase.add(
              handLayoutBuilder.value.centerOfPieceType(
                props.position.hand(Color.BLACK),
                Color.BLACK,
                move.from,
              ),
            )
          : whiteHandBase.add(
              handLayoutBuilder.value.centerOfPieceType(
                props.position.hand(Color.WHITE),
                Color.WHITE,
                move.from,
              ),
            );
    const end = boardBase.add(boardLayoutBuilder.value.centerOfSquare(move.to));
    const distance = start.distanceTo(end);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const unitX = distance > 0 ? dx / distance : 0;
    const unitY = distance > 0 ? dy / distance : 0;
    const perpendicularX = -unitY;
    const perpendicularY = unitX;
    return {
      candidate,
      move,
      start,
      end,
      distance,
      dx,
      dy,
      unitX,
      unitY,
      perpendicularX,
      perpendicularY,
    };
  });
  const laneOffsets = parallelArrowLaneOffsets(geometries, Math.max(18, arrowWidth * 0.6));

  return geometries.map((geometry, index) => {
    const {
      candidate, move, start, end, distance, dx, dy,
      unitX, unitY, perpendicularX, perpendicularY,
    } = geometry;
    const laneOffset = laneOffsets[index];
    const offset = new Point(perpendicularX * laneOffset, perpendicularY * laneOffset);
    const shiftedStart = start.add(offset);
    const shiftedEnd = end.add(offset);
    const middle = shiftedStart.add(shiftedEnd).multiply(0.5);
    const headLength = Math.min(arrowWidth, distance * 0.4);
    const headHalfWidth = arrowWidth * 0.5;
    const headBase = new Point(
      shiftedEnd.x - unitX * headLength,
      shiftedEnd.y - unitY * headLength,
    );
    const shaftEnd = new Point(
      shiftedEnd.x - unitX * headLength * 0.72,
      shiftedEnd.y - unitY * headLength * 0.72,
    );
    // z-index 決定のためスコアに基づいてランクを計算（同率は同順位）
    let evaluationLabel: string;
    let scoreRank: number;
    if (candidate.guideKind === "unsafe-plan") {
      scoreRank = index + 1;
      evaluationLabel = "定跡注意";
    } else if (candidate.score !== undefined && bestScore !== undefined) {
      const diff = candidate.score - bestScore;
      scoreRank =
        1 +
        candidates.filter((c) => c.score !== undefined && c.score > candidate.score!).length;
      evaluationLabel = diff === 0 ? "最善" : `${diff}`;
    } else {
      scoreRank = index + 1;
      evaluationLabel = "";
    }
    const labelText = [evaluationLabel, candidate.promotion].filter(Boolean).join("・");
    // 矢印が水平に近いほどラベルをずらす（最大でフォントサイズ12px分）
    // 矢印が水平より下向き（dy > |dx|）のときは上方向にオフセット
    const horizontalFactor = distance > 0 ? Math.abs(dx) / distance : 0;
    const labelOffsetY = dy > 0 ? -horizontalFactor * 12 : horizontalFactor * 12;
    return {
      id: move.usi,
      color: arrowColor(candidate.guideKind),
      labelText,
      start: shiftedStart,
      shaftEnd,
      shaftWidth: arrowWidth * 0.36,
      headPoints: [
        shiftedEnd,
        new Point(
          headBase.x + perpendicularX * headHalfWidth,
          headBase.y + perpendicularY * headHalfWidth,
        ),
        new Point(
          headBase.x - perpendicularX * headHalfWidth,
          headBase.y - perpendicularY * headHalfWidth,
        ),
      ].map(({ x, y }) => `${x},${y}`).join(" "),
      style: {
        left: "0px",
        top: "0px",
        width: main.value.frame.size.width + "px",
        height: main.value.frame.size.height + "px",
        zIndex: 100 + n - scoreRank,
      },
      labelStyle: {
        left: middle.x + "px",
        top: middle.y + labelOffsetY + "px",
        color: candidate.guideKind === "unsafe-plan" ? "#d96b00" : arrowColor(candidate.guideKind),
        zIndex: 100 + 2 * n - scoreRank,
      },
    };
  });
});

const formatTime = (time?: number, byoyomi?: number): string => {
  if (time) {
    return secondsToHHMMSS(time);
  } else if (byoyomi !== undefined) {
    return "" + byoyomi;
  }
  return "0:00:00";
};

const timeSeverity = (time?: number, byoyomi?: number) => {
  if (!time && !byoyomi) {
    return "normal";
  }
  const rem = (time || 0) + (byoyomi || 0);
  if (rem <= 5) {
    return "danger";
  } else if (rem <= 10) {
    return "warning";
  }
  return "normal";
};

const blackPlayerTimeText = computed(() => {
  return formatTime(props.blackPlayerTime, props.blackPlayerByoyomi);
});

const blackPlayerTimeSeverity = computed(() => {
  return timeSeverity(props.blackPlayerTime, props.blackPlayerByoyomi);
});

const whitePlayerTimeText = computed(() => {
  return formatTime(props.whitePlayerTime, props.whitePlayerByoyomi);
});

const whitePlayerTimeSeverity = computed(() => {
  return timeSeverity(props.whitePlayerTime, props.whitePlayerByoyomi);
});
</script>

<style scoped>
/* 図鑑・教室の升の色付け。青は駒の動き、赤はねらう駒、緑は大事なマス。
   大事なマスは、木目と見分けにくい黄色を避け、駒が動いた跡（params.tsのlastMoveTo）と同じ緑にする。 */
.square-mark {
  pointer-events: none;
}
.square-mark--reach {
  /* 木目の黄色と混ざって灰色に見えないよう、中央の点で示す。 */
  background:
    radial-gradient(circle, rgba(29, 78, 216, 0.9) 0 17%, transparent 19%),
    rgba(96, 165, 250, 0.22);
}
.square-mark--target {
  background: rgba(220, 38, 38, 0.3);
}
.square-mark--key {
  background: rgba(68, 204, 68, 0.45);
  box-shadow: inset 0 0 0 2px rgba(34, 153, 34, 0.9);
}
/* 玉の逃げ道: 相手の駒が利いていて逃げられないマス。先手の利きと同じ青に、×を重ねる。 */
.square-mark--covered {
  background:
    linear-gradient(45deg, transparent 44%, rgba(29, 78, 216, 0.85) 45% 55%, transparent 56%),
    linear-gradient(-45deg, transparent 44%, rgba(29, 78, 216, 0.85) 45% 55%, transparent 56%),
    rgba(37, 99, 235, 0.22);
  background-size: 60% 60%, 60% 60%, auto;
  background-position: center;
  background-repeat: no-repeat;
}
/* 玉の逃げ道: 自分の玉のまわりで、相手の駒が利いているマス。後手の利きと同じ赤に、×を重ねる。 */
.square-mark--danger {
  background:
    linear-gradient(45deg, transparent 44%, rgba(185, 28, 28, 0.85) 45% 55%, transparent 56%),
    linear-gradient(-45deg, transparent 44%, rgba(185, 28, 28, 0.85) 45% 55%, transparent 56%),
    rgba(220, 38, 38, 0.2);
  background-size: 60% 60%, 60% 60%, auto;
  background-position: center;
  background-repeat: no-repeat;
}
/* 駒得の数字。緑は駒得、赤は駒損。符号と白い縁取りで、色が見分けにくくても木目の上でも読めるようにする。 */
.float-label {
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 35;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  animation: float-label-rise 900ms ease-out both;
}
.float-label span {
  padding: 0.08em 0.28em;
  border-radius: 0.35em;
  color: #fff;
  box-shadow: 0 0 0 0.12em #fffcf4, 0 0.12em 0.25em rgba(0, 0, 0, 0.35);
}
.float-label--good span {
  background: #1f8a4c;
}
.float-label--bad span {
  background: #c0392b;
}
.float-label--big span {
  box-shadow: 0 0 0 0.14em #fffcf4, 0 0.16em 0.35em rgba(0, 0, 0, 0.45);
}
@keyframes float-label-rise {
  0% { opacity: 0; transform: translateY(0) scale(0.7); }
  18% { opacity: 1; transform: translateY(-15%) scale(1.08); }
  70% { opacity: 1; transform: translateY(-55%) scale(1); }
  100% { opacity: 0; transform: translateY(-80%) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .float-label {
    animation: float-label-fade 900ms linear both;
  }
  @keyframes float-label-fade {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }
}
/*
 * 教室の盤の上のひとこと。木目の上で読めるよう、白地に濃い文字と濃い縁にする(黄色は使わない)。
 * しっぽは見るマスの側に付け、--callout-tailがしっぽの位置。
 */
.board-callout {
  position: absolute;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  z-index: 36;
  pointer-events: none;
  padding: 0 0.3em;
  border: 2px solid #3b2f2a;
  border-radius: 0.6em;
  background: #fffdf7;
  color: #2a211d;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  box-shadow: 0 0.15em 0.4em rgba(0, 0, 0, 0.3);
  animation: board-callout-in 160ms ease-out both;
}
/* 札を見るマスから離したときの線。札の縁と同じ色で、駒の上を細く通す。 */
.board-callout-line {
  position: absolute;
  z-index: 36;
  pointer-events: none;
  background: #3b2f2a;
  box-shadow: 0 0 0 1px rgba(255, 253, 247, 0.85);
  animation: board-callout-in 160ms ease-out both;
}
.board-callout-line--good {
  background: #1f8a4c;
}
.board-callout-line--bad {
  background: #c0392b;
}
.board-callout--good {
  border-color: #1f8a4c;
}
.board-callout--bad {
  border-color: #c0392b;
  color: #8f1d12;
}
.board-callout::after {
  content: "";
  position: absolute;
  width: 0.55em;
  height: 0.55em;
  background: inherit;
  border: inherit;
  border-width: 0 2px 2px 0;
  border-radius: 0 0 0.12em 0;
}
.board-callout--above::after {
  left: calc(var(--callout-tail) - 0.3em);
  bottom: -0.33em;
  transform: rotate(45deg);
}
.board-callout--below::after {
  left: calc(var(--callout-tail) - 0.3em);
  top: -0.33em;
  transform: rotate(-135deg);
}
.board-callout--left::after {
  top: calc(var(--callout-tail) - 0.3em);
  right: -0.33em;
  transform: rotate(-45deg);
}
.board-callout--right::after {
  top: calc(var(--callout-tail) - 0.3em);
  left: -0.33em;
  transform: rotate(135deg);
}
@keyframes board-callout-in {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .board-callout,
  .board-callout-line {
    animation: none;
  }
}
/* 囲いを組もうの完成形。薄く見せ、置いた駒と見分けられるようにする。 */
.ghost-piece {
  pointer-events: none;
  opacity: 0.38;
  filter: grayscale(0.35);
}
/* 利きメガネ: 動かすと取られるマス。相手の利き(赤)と同じ色相の輪を、動けるマスの印の外側に付ける。 */
.risk-ring {
  pointer-events: none;
  box-shadow: inset 0 0 0 3px rgba(220, 38, 38, 0.85);
  border-radius: 50%;
}
/* 対局の「駒の利き」表示。青は先手、赤は後手、紫は両者が利かせている升。 */
.attack-tint {
  pointer-events: none;
}
.attack-tint--black {
  background: rgba(37, 99, 235, 0.2);
}
.attack-tint--white {
  background: rgba(220, 38, 38, 0.2);
}
.attack-tint--both {
  background: rgba(147, 51, 234, 0.22);
}
.attack-counts {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
  font-weight: 800;
  line-height: 1;
}
.attack-count {
  min-width: 1.15em;
  padding: 0.08em 0.18em;
  border-radius: 0.3em;
  color: #fff;
  text-align: center;
}
.attack-count--white {
  align-self: flex-start;
  background: rgba(185, 28, 28, 0.9);
}
.attack-count--black {
  align-self: flex-end;
  margin-top: auto;
  background: rgba(29, 78, 216, 0.9);
}
.frame {
  color: var(--text-color);
  user-select: none;
  position: relative;
}
.frame > * {
  position: absolute;
}
.board > * {
  position: absolute;
}
.board-background.drop-shadows {
  box-shadow: 3px 3px 6px var(--shadow-color);
}
.legal-destination::after {
  content: "";
  position: absolute;
  inset: 3px;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.03) 0%,
    rgba(255, 255, 255, 0.07) 48%,
    rgba(255, 250, 232, 0.15) 76%,
    rgba(255, 238, 184, 0.2) 100%
  );
  animation: legal-destination-breathe 3.2s ease-in-out infinite;
}
@keyframes legal-destination-breathe {
  0%,
  100% {
    opacity: 0.42;
  }
  50% {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .legal-destination::after {
    animation: none;
    opacity: 0.72;
  }
}
.hand > * {
  position: absolute;
}
.hand-background.drop-shadows {
  box-shadow: 3px 3px 6px var(--shadow-color);
}
/* 直前の手で動いた駒は、置いた瞬間に少し沈んで戻る。何が動いたかを目で追えるよう、短く小さく動かす。 */
.piece--landed {
  animation: piece-land 220ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
  transform-origin: 50% 85%;
}
@keyframes piece-land {
  0% {
    transform: translateY(-14%) scale(1.08);
  }
  60% {
    transform: translateY(0) scale(0.97, 1.02);
  }
  100% {
    transform: none;
  }
}
/* 取った駒は強めに、打った駒は上から置き、成った駒は裏返す。 */
.piece--land-capture {
  animation: piece-land-capture 260ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
}
.piece--land-drop {
  animation: piece-land-drop 240ms cubic-bezier(0.3, 1.3, 0.5, 1) both;
}
.piece--land-promote {
  animation: piece-land-promote 320ms ease-out both;
  transform-origin: 50% 50%;
}
@keyframes piece-land-capture {
  0% {
    transform: translateY(-22%) scale(1.14);
  }
  55% {
    transform: translateY(0) scale(0.94, 1.04);
  }
  100% {
    transform: none;
  }
}
@keyframes piece-land-drop {
  0% {
    opacity: 0.4;
    transform: translateY(-34%) scale(1.06);
  }
  65% {
    opacity: 1;
    transform: translateY(0) scale(0.97, 1.02);
  }
  100% {
    transform: none;
  }
}
@keyframes piece-land-promote {
  0% {
    transform: scaleX(1) scale(1.08);
  }
  40% {
    transform: scaleX(0.05) scale(1.12);
  }
  100% {
    transform: none;
  }
}
/* 取った駒が駒台に入ったら、小さく跳ねさせて行き先を見せる。 */
.hand-piece--arrived {
  animation: hand-piece-arrive 300ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
@keyframes hand-piece-arrive {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }
  70% {
    opacity: 1;
    transform: scale(1.15);
  }
  100% {
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .piece--landed,
  .hand-piece--arrived {
    animation: none;
  }
}
/* 対局者名は名札にし、手番の側を枠と光で示す。色だけに頼らないよう、手番の側には▶も付ける。 */
.player-name {
  background-color: var(--text-bg-color);
  display: flex;
  justify-content: left;
  align-items: center;
  border: 2px solid var(--plate-border-color);
  border-radius: 0.4em;
  box-sizing: border-box;
  font-weight: 700;
  transition: box-shadow 160ms ease, border-color 160ms ease;
}
.player-name.active {
  border-color: var(--plate-active-color);
  background-color: var(--plate-active-bg-color);
  box-shadow: 0 0 0 2px var(--plate-active-color), 0 0 12px 2px var(--plate-active-glow);
}
.player-name.active .player-name-text::before {
  content: "▶";
  margin-right: 0.15em;
  color: var(--plate-active-mark-color);
  font-size: 0.8em;
}
.player-name-text {
  margin-left: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 補足があるときは2行にし、名前欄の幅が狭い縦画面でも省略されないようにする。 */
.player-name--detail {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  line-height: 1.1;
}
.player-name--detail .player-name-text {
  max-width: calc(100% - 5px);
  font-size: 0.8em;
}
.player-name-detail {
  max-width: calc(100% - 5px);
  margin-left: 5px;
  overflow: hidden;
  font-size: 0.62em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clock {
  background-color: var(--text-bg-color);
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid black;
  box-sizing: border-box;
}
.clock.warning {
  background-color: var(--text-bg-color-warning);
}
.clock.danger {
  color: var(--text-color-danger);
  background-color: var(--text-bg-color-danger);
}
.clock-text {
  vertical-align: middle;
}
/* 成・不成は駒の絵だけでなく「成る」「成らない」の文字も添える。成るほうを明るく目立たせる。 */
.promote,
.not-promote {
  container-type: size;
  border-radius: 6%;
  cursor: pointer;
}
.promote {
  background-color: var(--promote-bg-color);
  box-shadow: inset 0 0 0 3px var(--plate-active-color), 0 0 14px 3px var(--plate-active-glow);
}
.not-promote {
  background-color: var(--not-promote-bg-color);
}
.promote::after,
.not-promote::after {
  position: absolute;
  bottom: -12cqh;
  left: 50%;
  padding: 0.1em 0.5em;
  border-radius: 999px;
  font-size: 17cqh;
  font-weight: 800;
  line-height: 1.25;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}
.promote::after {
  content: "成る";
  color: var(--turn-label-color);
  background: var(--turn-label-bg-color);
}
.not-promote::after {
  content: "成らない";
  color: #fffcf4;
  background: #445c6d;
}
.turn {
  color: var(--turn-label-color);
  background-color: var(--turn-label-bg-color);
  border: 2px solid var(--turn-label-border-color);
  box-sizing: border-box;
  font-weight: 800;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}
.piece-image {
  max-width: 100%;
  max-height: 100%;
}

.hand.back {
  z-index: 10;
}
.board {
  z-index: 11;
}
.hand.front {
  z-index: 12;
}
.arrows {
  z-index: 20;
  pointer-events: none;
  overflow: visible;
}
.arrow-shaft {
  stroke-linecap: round;
}
.arrow-label {
  position: absolute;
  z-index: 21;
  transform: translate(-50%, -50%);
  background: white;
  color: #fe0000;
  font-size: 12px;
  font-weight: bold;
  padding: 1px 4px;
  white-space: nowrap;
  line-height: 1.4;
  pointer-events: none;
}
.board.operation,
.hand.operation {
  touch-action: none;
}
.board.operation,
.hand.operation,
.player-name,
.clock,
.turn,
.control {
  z-index: 30;
}
</style>
