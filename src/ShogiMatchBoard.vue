<template>
  <section class="match-board" :class="{ flipped: flip }" aria-label="将棋盤">
    <div class="hand white"><button v-for="entry in whiteHand" :key="entry.type" :disabled="!canSelectHand('white', entry.type)" @click="selectHand('white', entry.type)">{{ label(entry.type) }}{{ entry.count > 1 ? entry.count : '' }}</button></div>
    <div class="grid" role="grid">
      <button v-for="square in squares" :key="square.id" class="square" :class="{ selected: selected?.id === square.id }" :aria-label="square.id" @click="selectSquare(square)">
        <img v-if="square.piece" :src="imageUrl(square.piece)" :alt="label(square.piece.type)" @error="hideImage" />
        <span v-if="square.piece" class="fallback">{{ label(square.piece.type) }}</span>
      </button>
    </div>
    <div class="hand black"><button v-for="entry in blackHand" :key="entry.type" :disabled="!canSelectHand('black', entry.type)" @click="selectHand('black', entry.type)">{{ label(entry.type) }}{{ entry.count > 1 ? entry.count : '' }}</button></div>
    <div v-if="promotion" class="promotion" role="dialog" aria-label="成りの選択"><button @click="emitMove(false)">成らない</button><button @click="emitMove(true)">成る</button></div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { Color, Piece, PieceType, Position, Square } from "tsshogi";

const props = defineProps({
  sfen: { type: String, required: true },
  allowMove: { type: Boolean, default: true },
  flip: { type: Boolean, default: false },
  assetBaseUrl: { type: String, default: "https://sunfish-shogi.github.io/shogi-images/hitomoji/" },
});
const emit = defineEmits(["usi-move", "invalid-sfen"]);
const selected = ref(null);
const promotion = ref(null);
const position = computed(() => {
  try { return Position.newBySFEN(props.sfen); } catch (error) { emit("invalid-sfen", error); return null; }
});
watch(() => props.sfen, () => { selected.value = null; promotion.value = null; });

const typeNames = { pawn: "歩", lance: "香", knight: "桂", silver: "銀", gold: "金", bishop: "角", rook: "飛", king: "王", promPawn: "と", promLance: "杏", promKnight: "圭", promSilver: "全", horse: "馬", dragon: "龍" };
const fileName = { pawn: "pawn", lance: "lance", knight: "knight", silver: "silver", gold: "gold", bishop: "bishop", rook: "rook", king: "king", promPawn: "tokin", promLance: "promoted_lance", promKnight: "promoted_knight", promSilver: "promoted_silver", horse: "horse", dragon: "dragon" };
const files = [9,8,7,6,5,4,3,2,1];
const ranks = [1,2,3,4,5,6,7,8,9];
const squares = computed(() => position.value ? ranks.flatMap((rank) => files.map((file) => {
  const square = new Square(file, rank); const piece = position.value.board.at(square);
  return { id: `${file}${String.fromCharCode(96 + rank)}`, square, piece };
})) : []);
const hand = (color) => Object.values(PieceType).filter((type) => typeof type === "string").map((type) => ({ type, count: position.value?.hand(color).count(type) || 0 })).filter((entry) => entry.count);
const blackHand = computed(() => hand(Color.BLACK));
const whiteHand = computed(() => hand(Color.WHITE));
const label = (type) => typeNames[type] || type;
const imageUrl = (piece) => `${props.assetBaseUrl}${piece.color === Color.BLACK ? "black" : "white"}_${fileName[piece.type]}.png`;
const hideImage = (event) => { event.target.style.display = "none"; };
const canSelectHand = (color, type) => props.allowMove && position.value?.color === (color === "black" ? Color.BLACK : Color.WHITE) && position.value.hand(color === "black" ? Color.BLACK : Color.WHITE).count(type) > 0;
const selectHand = (color, type) => { selected.value = new Piece(color === "black" ? Color.BLACK : Color.WHITE, type); };
function selectSquare(target) {
  if (!props.allowMove || !position.value) return;
  if (!selected.value) { if (target.piece?.color === position.value.color) selected.value = target.square; return; }
  const from = selected.value instanceof Square ? selected.value : selected.value.type;
  const move = position.value.createMove(from, target.square);
  selected.value = null;
  if (!move) return;
  const normal = position.value.isValidMove(move);
  const promoted = position.value.isValidMove(move.withPromote());
  if (normal && promoted) promotion.value = move;
  else if (normal) emit("usi-move", move.usi);
  else if (promoted) emit("usi-move", move.withPromote().usi);
}
function emitMove(promote) { emit("usi-move", promote ? promotion.value.withPromote().usi : promotion.value.usi); promotion.value = null; }
</script>

<style>
:host { display: block; } .match-board { position: relative; display: grid; grid-template-columns: 1fr minmax(0, 9fr) 1fr; gap: .4rem; max-width: 720px; margin: auto; color: #2b1609; } .grid { aspect-ratio: 1; display: grid; grid-template-columns: repeat(9, 1fr); border: 4px solid #71401e; background: #d9a85e; } .square { position: relative; border: .5px solid #71401e; padding: 0; background: transparent; cursor: pointer; } .square.selected { outline: 3px solid #e34f26; outline-offset: -3px; } img,.fallback { position: absolute; inset: 4%; width: 92%; height: 92%; object-fit: contain; } .fallback { display: grid; place-items: center; font: 700 clamp(14px, 3.6vw, 32px) serif; } img + .fallback { display: none; } .hand { display: flex; flex-direction: column; gap: .25rem; justify-content: center; } .hand button,.promotion button { border: 1px solid #71401e; border-radius: .25rem; background: #f2d89f; padding: .35rem; color: inherit; font-weight: 700; } .promotion { position: absolute; inset: 35% 20%; display: grid; place-content: center; gap: .5rem; padding: 1rem; background: #fff7e8; border: 3px solid #71401e; box-shadow: 0 3px 16px #0008; } .flipped .grid { transform: rotate(180deg); } .flipped .square img,.flipped .fallback { transform: rotate(180deg); }
</style>
