<template>
  <!-- 作戦カードの完成形の小さな盤。自分の側の下5段だけを描く(盤の部品を何枚も並べると重いため、SVGの文字で描く)。 -->
  <svg
    class="formation-thumb"
    :class="{ 'formation-thumb--silhouette': silhouette }"
    :viewBox="`0 0 ${FILES * CELL} ${RANKS.length * CELL}`"
    aria-hidden="true"
    focusable="false"
  >
    <rect class="formation-thumb__board" x="0" y="0" :width="FILES * CELL" :height="RANKS.length * CELL" />
    <line
      v-for="index in FILES - 1"
      :key="`v${index}`"
      class="formation-thumb__line"
      :x1="index * CELL" y1="0" :x2="index * CELL" :y2="RANKS.length * CELL"
    />
    <line
      v-for="index in RANKS.length - 1"
      :key="`h${index}`"
      class="formation-thumb__line"
      x1="0" :y1="index * CELL" :x2="FILES * CELL" :y2="index * CELL"
    />
    <!-- 再生では同じ駒をすべらせて動かすため、駒の初めのマスをkeyにし、位置はCSSのtransformで変える。 -->
    <g
      v-for="piece in cells"
      :key="piece.id"
      class="formation-thumb__cell"
      :style="{ transform: `translate(${piece.x}px, ${piece.y}px)` }"
    >
      <rect
        v-if="piece.moved"
        class="formation-thumb__mark"
        :class="{ 'formation-thumb__mark--pending': piece.pending, 'formation-thumb__mark--last': piece.last }"
        x="0.6" y="0.6" :width="CELL - 1.2" :height="CELL - 1.2" rx="1.6"
      />
      <path
        class="formation-thumb__piece"
        :class="{
          'formation-thumb__piece--moved': piece.moved,
          'formation-thumb__piece--pending': piece.pending,
        }"
        :d="PIECE_PATH"
      />
      <text
        v-if="!silhouette"
        class="formation-thumb__label"
        :class="{ 'formation-thumb__label--moved': piece.moved, 'formation-thumb__label--promoted': piece.promoted }"
        :x="CELL / 2" :y="CELL / 2 + 0.6"
      >{{ piece.label }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { openingFormationSteps } from "./core/opening-formation.mjs";

const props = defineProps({
  strategyId: { type: String, default: "" },
  castleId: { type: String, default: "" },
  // まだ使えない作戦は、動いた駒を影にして形だけを見せる。
  silhouette: { type: Boolean, default: false },
  // 対局中の進み具合。完成形のうち、もう駒が着いたマス(先手から見た座標)。nullなら全部を完成として描く。
  filledSquares: { type: Array as () => string[] | null, default: null },
  // くわしい画面の手順の再生。何手目までの形を描くか(0は初めの形)。nullなら完成形。
  ply: { type: Number as () => number | null, default: null },
});

const FILES = 9;
const CELL = 10;
const RANKS = ["e", "f", "g", "h", "i"];
// 将棋の駒の五角形(1マスに収まる大きさ)。
const PIECE_PATH = "M5 1.2 L8.1 2.6 L8.8 8.8 L1.2 8.8 L1.9 2.6 Z";
const LABELS: { [kind: string]: string } = { K: "玉", R: "飛", B: "角", G: "金", S: "銀", N: "桂", L: "香", P: "歩" };
const PROMOTED_LABELS: { [kind: string]: string } = { R: "龍", B: "馬", S: "全", N: "圭", L: "杏", P: "と" };

const cells = computed(() => {
  const { steps, frames } = openingFormationSteps(props.strategyId, props.castleId);
  const index = props.ply === null ? frames.length - 1 : Math.max(0, Math.min(frames.length - 1, props.ply));
  // 再生中は、いま動いた駒のマスを濃く塗る(緑は「駒が動いた跡」)。
  const lastSquare = props.ply === null || index === 0 ? "" : steps[index - 1]?.to ?? "";
  const filled = props.filledSquares ? new Set(props.filledSquares) : null;
  return frames[index].flatMap((piece) => {
    const rankIndex = RANKS.indexOf(piece.square[1]);
    if (rankIndex < 0) return [];
    const file = Number(piece.square[0]);
    return [{
      id: piece.id,
      square: piece.square,
      last: piece.square === lastSquare,
      x: (FILES - file) * CELL,
      y: rankIndex * CELL,
      moved: piece.moved,
      promoted: piece.promoted,
      pending: Boolean(filled && piece.moved && !filled.has(piece.square)),
      label: piece.promoted ? PROMOTED_LABELS[piece.kind] ?? piece.kind : LABELS[piece.kind] ?? piece.kind,
    }];
  });
});
</script>

<style>
/* 緑は「駒が動いた跡」(盤面の色の使い分け)。完成形で動かす駒を緑で示す。 */
.formation-thumb {
  --formation-thumb-board: #ead2a0;
  --formation-thumb-line: rgba(92, 62, 24, 0.28);
  --formation-thumb-piece: #f7ecd2;
  --formation-thumb-piece-edge: #b99a6a;
  --formation-thumb-text: #8c7a5e;
  --formation-thumb-moved: #2f7d3a;
  --formation-thumb-moved-fill: rgba(64, 160, 84, 0.3);
  --formation-thumb-shadow: #4d4338;
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.3em;
}
.formation-thumb__board { fill: var(--formation-thumb-board); }
.formation-thumb__line { stroke: var(--formation-thumb-line); stroke-width: 0.35; }
.formation-thumb__mark { fill: var(--formation-thumb-moved-fill); }
.formation-thumb__cell { transition: transform 160ms ease-out; }
.formation-thumb__mark--last { fill: rgba(64, 160, 84, 0.7); }
.formation-thumb__mark--pending { fill: none; stroke: var(--formation-thumb-moved); stroke-width: 0.5; stroke-dasharray: 1.2 1; }
.formation-thumb__piece { fill: var(--formation-thumb-piece); stroke: var(--formation-thumb-piece-edge); stroke-width: 0.4; }
.formation-thumb__piece--moved { fill: #fffaf0; stroke: var(--formation-thumb-moved); stroke-width: 0.7; }
.formation-thumb__piece--pending { opacity: 0.4; }
.formation-thumb__label {
  fill: var(--formation-thumb-text);
  font-size: 5.4px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
}
.formation-thumb__label--moved { fill: #1d303f; }
.formation-thumb__label--promoted { fill: #b0322a; }
.formation-thumb--silhouette .formation-thumb__mark { fill: none; }
.formation-thumb--silhouette .formation-thumb__piece { opacity: 0.35; }
.formation-thumb--silhouette .formation-thumb__piece--moved { fill: var(--formation-thumb-shadow); stroke: var(--formation-thumb-shadow); opacity: 0.8; }
@media (prefers-reduced-motion: reduce) {
  .formation-thumb__cell { transition: none; }
}
</style>
