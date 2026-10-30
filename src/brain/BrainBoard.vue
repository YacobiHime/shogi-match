<template>
  <!--
    脳トレの盤。駒を置く・印を付ける・マスを押すだけの軽い盤(対局の盤より軽く、時間をはかる種目でも遅れない)。
    升の印は緑(合った)・赤(ちがう・答え)だけで、黄色は使わない(AGENTS.mdの盤面の色)。
  -->
  <div class="brain-board-wrap" :class="{ 'brain-board-wrap--coords': coords }">
    <span v-if="coords" class="brain-board__files" aria-hidden="true">
      <span v-for="file in FILES" :key="file">{{ FILE_DIGITS[file] }}</span>
    </span>
    <div class="brain-board" role="grid" :aria-label="label">
      <component
        :is="interactive ? 'button' : 'span'"
        v-for="cell in cells"
        :key="cell.square"
        :type="interactive ? 'button' : undefined"
        class="brain-board__cell"
        :class="[cell.mark ? `brain-board__cell--${cell.mark}` : '', { 'brain-board__cell--button': interactive }]"
        :data-brain-square="cell.square"
        :aria-label="interactive ? cellLabel(cell) : undefined"
        @click="interactive && emit('square', cell.square)"
      >
        <span
          v-if="cell.piece"
          class="brain-piece"
          :class="{ 'brain-piece--white': cell.piece.color === 'white', 'brain-piece--king': cell.piece.kind === 'K', 'brain-piece--ghost': cell.ghost }"
        >{{ pieceName(cell.piece.kind, cell.piece.promoted) }}</span>
      </component>
    </div>
    <span v-if="coords" class="brain-board__ranks" aria-hidden="true">
      <span v-for="rank in RANKS" :key="rank">{{ RANK_KANJI[rank - 1] }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import { pieceName } from "../core/brain-mental-board.mjs";

type BoardPiece = { square: string; kind: string; color: "black" | "white" | string; promoted?: boolean };

const props = defineProps({
  pieces: { type: Array as PropType<BoardPiece[]>, default: () => [] },
  /** 薄く出す駒(答え合わせで、置き忘れた駒を見せる)。 */
  ghosts: { type: Array as PropType<BoardPiece[]>, default: () => [] },
  marks: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  coords: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
  label: { type: String, default: "盤" },
});
const emit = defineEmits<{ (event: "square", square: string): void }>();

const FILES = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const FILE_DIGITS = ["", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
const RANK_KANJI = "一二三四五六七八九";

const cells = computed(() => {
  const bySquare = new Map(props.pieces.map((piece) => [piece.square, piece]));
  const ghostBySquare = new Map(props.ghosts.map((piece) => [piece.square, piece]));
  const list: { square: string; piece: BoardPiece | null; ghost: boolean; mark: string }[] = [];
  for (const rank of RANKS) {
    for (const file of FILES) {
      const square = `${file}${String.fromCharCode(96 + rank)}`;
      const piece = bySquare.get(square) ?? null;
      const ghost = piece ? null : ghostBySquare.get(square) ?? null;
      list.push({ square, piece: piece ?? ghost, ghost: Boolean(ghost), mark: props.marks[square] ?? "" });
    }
  }
  return list;
});

function cellLabel(cell: { square: string; piece: BoardPiece | null }) {
  const name = `${FILE_DIGITS[Number(cell.square[0])]}${RANK_KANJI[cell.square.charCodeAt(1) - 97]}`;
  return cell.piece ? `${name} ${cell.piece.color === "white" ? "後手" : "先手"}の${pieceName(cell.piece.kind, cell.piece.promoted)}` : name;
}
</script>
