<template>
  <div class="shogi-dex" role="dialog" aria-modal="true" aria-labelledby="shogi-reference-dex-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-reference-dex-title">{{ dex.title }}</h1>
    </header>

    <!-- 小さい画面では一覧をハンバーガーメニューにまとめる。 -->
    <button
      v-if="isNarrow"
      type="button"
      class="shogi-dex__list-toggle"
      :aria-expanded="listOpen"
      aria-controls="shogi-reference-dex-list"
      @click="listOpen = !listOpen"
    >
      <span aria-hidden="true">☰</span>
      <span>{{ dex.listLabel }}</span>
      <small v-if="selectedEntry">現在：{{ selectedEntry.label }}</small>
    </button>

    <div ref="bodyEl" class="shogi-dex__body">
      <nav
        id="shogi-reference-dex-list"
        class="shogi-dex__list"
        :class="{ 'shogi-dex__list--open': listOpen }"
        :aria-label="dex.listLabel"
      >
        <button
          v-if="isNarrow"
          type="button"
          class="shogi-dex__list-close"
          @click="listOpen = false"
        >✕ 閉じる</button>
        <section v-for="group in groups" :key="group.id" class="shogi-dex__group">
          <h2>{{ group.label }}</h2>
          <ul>
            <li v-for="item in group.items" :key="item.id">
              <button
                type="button"
                :class="{ 'shogi-dex__item--active': item.id === selectedId }"
                @click="selectItem(item.id)"
              >
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </section>
      </nav>

      <section v-if="selectedEntry" ref="detailEl" class="shogi-dex__detail">
        <div class="shogi-dex__main">
          <button
            v-if="returnEntry"
            type="button"
            class="shogi-reference-dex__return"
            @click="returnToTable"
          >
            <span aria-hidden="true">←</span> {{ returnEntry.label }}へ戻る
          </button>
          <div class="shogi-dex__detail-head">
            <h2>{{ selectedEntry.label }}</h2>
            <span v-if="kind === 'tesuji' && sideToMove === 'white'" class="shogi-dex__side-note">後手番の局面</span>
          </div>
          <table v-if="selectedEntry.table" class="shogi-reference-dex__tiers">
            <caption>点数は駒得の目安（局面によって変わるよ）。駒を押すと説明が見られるよ</caption>
            <tbody>
              <tr v-for="row in selectedEntry.table" :key="row.tier">
                <th scope="row" :class="`shogi-reference-dex__tier shogi-reference-dex__tier--${tierClass(row.tier)}`">
                  {{ row.tier }}
                </th>
                <td>
                  <ul>
                    <li
                      v-for="piece in row.pieces"
                      :key="piece.label"
                      class="shogi-reference-dex__tier-piece"
                      :title="piece.label"
                    >
                      <span class="shogi-reference-dex__piece-images">
                        <button
                          v-for="image in piece.images"
                          :key="image"
                          type="button"
                          class="shogi-reference-dex__piece-link"
                          :aria-label="`${pieceEntryLabel(image)}の説明を見る`"
                          @click="openPieceEntry(image)"
                        >
                          <img :src="pieceImageUrl(image)" alt="" draggable="false">
                        </button>
                      </span>
                      <span class="shogi-reference-dex__points">{{ piece.points }}<small v-if="piece.points !== '∞'">点</small></span>
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
          <section v-if="selectedEntry.aiTable" class="shogi-reference-dex__ai" aria-labelledby="shogi-reference-dex-ai-title">
            <h3 id="shogi-reference-dex-ai-title">{{ selectedEntry.aiTable.title }}</h3>
            <p>{{ selectedEntry.aiTable.note }}</p>
            <ol>
              <li v-for="piece in aiPieces" :key="piece.label" :title="piece.label">
                <span class="shogi-reference-dex__ai-bar" :style="{ width: `${piece.ratio * 100}%` }" aria-hidden="true"></span>
                <span class="shogi-reference-dex__piece-images">
                  <button
                    v-for="image in piece.images"
                    :key="image"
                    type="button"
                    class="shogi-reference-dex__piece-link"
                    :aria-label="`${pieceEntryLabel(image)}の説明を見る`"
                    @click="openPieceEntry(image)"
                  >
                    <img :src="pieceImageUrl(image)" alt="" draggable="false">
                  </button>
                </span>
                <strong>{{ piece.value }}</strong>
                <small>歩×{{ piece.relative }}</small>
              </li>
            </ol>
          </section>
          <div v-else class="shogi-dex__stage">
            <div class="shogi-dex__board">
              <ShogiMatchBoard
                :sfen="sfen"
                :allow-move="false"
                :enable-drag-and-drop="false"
                :mobile="isNarrow"
                :layout="isNarrow ? 'portrait' : 'standard'"
                :asset-base-url="assetBaseUrl"
                :candidates="arrows"
                :mark-squares="marks"
              />
            </div>
          </div>
          <ul v-if="legend.length" class="shogi-reference-dex__legend" aria-label="盤面の色の意味">
            <li v-for="item in legend" :key="item.tone">
              <span :class="`shogi-reference-dex__swatch shogi-reference-dex__swatch--${item.tone}`" aria-hidden="true"></span>
              {{ item.label }}
            </li>
          </ul>
        </div>

        <div class="shogi-dex__explanation-col">
          <div class="shogi-dex__explanation">
            <div class="shogi-dex__speech">
              <img
                class="shogi-dex__chara"
                :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
                alt=""
                aria-hidden="true"
              >
              <p>{{ selectedEntry.overview }}</p>
            </div>
            <dl>
              <div v-for="[label, text] in selectedEntry.rows" :key="label">
                <dt>{{ label }}</dt>
                <dd>{{ text }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import {
  REFERENCE_DEX_KINDS,
  referenceDexEntries,
  referenceDexGroups,
  referenceEntryMarks,
  referenceEntrySfen,
  referencePieceImageEntryId,
} from "./core/reference-dex.mjs";

type ReferenceDexKind = "piece" | "tesuji" | "world";
type TierRow = { tier: string; pieces: { label: string; images: string[]; points: number | string }[] };
type AiTable = { title: string; note: string; pieces: { label: string; images: string[]; value: number }[] };
type ReferenceEntry = {
  id: string;
  label: string;
  table?: TierRow[];
  aiTable?: AiTable;
  overview: string;
  rows: [string, string][];
  arrows?: string[];
};

const props = defineProps({
  kind: { type: String as () => ReferenceDexKind, required: true },
  // 教室などから開いたとき、最初に表示する項目。
  initialId: { type: String, default: "" },
  assetBaseUrl: { type: String, default: "." },
  // 教室から重ねて開いたときは教室へ戻るため、「戻る」とだけ表示する。
  backLabel: { type: String, default: "タイトルへ戻る" },
});
const emit = defineEmits(["close"]);

const LEGEND_LABELS = {
  reach: "駒が動けるマス",
  target: "ねらう駒・危ない駒",
  key: "大事なマス",
} as const;

const dex = computed(() => REFERENCE_DEX_KINDS[props.kind]);
const entries = computed(() => referenceDexEntries(props.kind) as ReferenceEntry[]);
const groups = computed(() => referenceDexGroups(props.kind));
const initialEntryId = () => (
  entries.value.some(({ id }) => id === props.initialId) ? props.initialId : entries.value[0]?.id ?? ""
);
const selectedId = ref(initialEntryId());
const listOpen = ref(false);
watch(() => [props.kind, props.initialId], () => { selectedId.value = initialEntryId(); });

// 狭い画面では縦長レイアウトの盤に切り替え、駒を見やすくする。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(max-width: 56rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) {
  isNarrow.value = event.matches;
  if (!event.matches) listOpen.value = false;
}
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));

const selectedEntry = computed(() => entries.value.find(({ id }) => id === selectedId.value) ?? null);
const sfen = computed(() => (selectedEntry.value ? referenceEntrySfen(selectedEntry.value) : ""));
const sideToMove = computed(() => (sfen.value.split(" ")[1] === "w" ? "white" : "black"));
const marks = computed(() => (selectedEntry.value ? referenceEntryMarks(selectedEntry.value) : []));
const arrows = computed(() => (selectedEntry.value?.arrows ?? []).map((usi) => ({ usi, guideKind: "plan" as const })));
const legend = computed(() => {
  const tones = new Set(marks.value.map(({ tone }: { tone: keyof typeof LEGEND_LABELS }) => tone));
  return (Object.keys(LEGEND_LABELS) as (keyof typeof LEGEND_LABELS)[])
    .filter((tone) => tones.has(tone))
    .map((tone) => ({ tone, label: LEGEND_LABELS[tone] }));
});

// 盤で選んだ駒の書体に合わせて、表の駒画像を表示する。
function pieceTheme() {
  try {
    return localStorage.getItem("shogi-match-piece-theme") || "hitomoji_wood";
  } catch {
    return "hitomoji_wood";
  }
}
const theme = pieceTheme();
function pieceImageUrl(name: string) {
  return `${props.assetBaseUrl.replace(/\/$/, "")}/piece/${theme}/${name}.webp`;
}
// 将棋AIの点数を大きい順に並べ、歩を1とした倍率と棒の長さを添える。
const aiPieces = computed(() => {
  const table = selectedEntry.value?.aiTable;
  if (!table) return [];
  const pawn = table.pieces.find(({ label }) => label === "歩兵")?.value ?? 90;
  const max = Math.max(...table.pieces.map(({ value }) => value));
  return [...table.pieces]
    .sort((left, right) => right.value - left.value)
    .map((piece) => ({
      ...piece,
      ratio: piece.value / max,
      relative: Number((piece.value / pawn).toFixed(1)),
    }));
});

function tierClass(tier: string) {
  return tier === "別格" ? "top" : tier.toLowerCase();
}

function selectItem(id: string) {
  selectedId.value = id;
  returnPoint.value = null;
  // 一覧から選んだらメニューを閉じる。
  listOpen.value = false;
}

// 表の駒から説明へ飛んだとき、元の表とスクロール位置を覚えておき、ワンタップで戻れるようにする。
// スクロールするのは、広い画面では詳細、狭い画面では本文全体。
const bodyEl = ref<HTMLElement | null>(null);
const detailEl = ref<HTMLElement | null>(null);
const returnPoint = ref<{ id: string; scroll: [number, number] } | null>(null);
const returnEntry = computed(() => entries.value.find(({ id }) => id === returnPoint.value?.id) ?? null);
watch(() => [props.kind, props.initialId], () => { returnPoint.value = null; });

function setScroll([body, detail]: [number, number]) {
  nextTick(() => {
    if (bodyEl.value) bodyEl.value.scrollTop = body;
    if (detailEl.value) detailEl.value.scrollTop = detail;
  });
}
function pieceEntryLabel(image: string) {
  const id = referencePieceImageEntryId(image);
  return entries.value.find((entry) => entry.id === id)?.label ?? "";
}
function openPieceEntry(image: string) {
  const id = referencePieceImageEntryId(image);
  if (!id) return;
  returnPoint.value = {
    id: selectedId.value,
    scroll: [bodyEl.value?.scrollTop ?? 0, detailEl.value?.scrollTop ?? 0],
  };
  selectedId.value = id;
  setScroll([0, 0]);
}
function returnToTable() {
  const point = returnPoint.value;
  if (!point) return false;
  returnPoint.value = null;
  selectedId.value = point.id;
  setScroll(point.scroll);
  return true;
}
// ブラウザの戻るでは、駒の説明から表へ戻り、それ以外は図鑑を閉じる。
function goBack() {
  if (!returnToTable()) emit("close");
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .shogi-reference-dex__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
}
.shogi-game .shogi-reference-dex__legend li {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}
.shogi-game .shogi-reference-dex__swatch {
  display: inline-block;
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 0.2rem;
}
.shogi-game .shogi-reference-dex__swatch--reach {
  background: radial-gradient(circle, rgba(29, 78, 216, 0.95) 0 30%, transparent 34%), rgba(96, 165, 250, 0.35);
}
.shogi-game .shogi-reference-dex__swatch--target { background: rgba(220, 38, 38, 0.6); }
.shogi-game .shogi-reference-dex__swatch--key {
  background: rgba(68, 204, 68, 0.65);
  box-shadow: inset 0 0 0 2px rgba(34, 153, 34, 0.9);
}
.shogi-game .shogi-reference-dex__tiers {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 0.4rem;
}
.shogi-game .shogi-reference-dex__tiers caption {
  margin-bottom: 0.2rem;
  font-size: 0.8rem;
  text-align: left;
  opacity: 0.85;
}
.shogi-game .shogi-reference-dex__tier {
  width: 3.4rem;
  border-radius: 0.35rem 0 0 0.35rem;
  color: #14212e;
  font-size: 1.25rem;
  font-weight: 800;
  text-align: center;
}
.shogi-game .shogi-reference-dex__tier--top { background: #f6d365; }
.shogi-game .shogi-reference-dex__tier--s { background: #f28b82; }
.shogi-game .shogi-reference-dex__tier--a { background: #f7b267; }
.shogi-game .shogi-reference-dex__tier--b { background: #fde68a; }
.shogi-game .shogi-reference-dex__tier--c { background: #a7f3d0; }
.shogi-game .shogi-reference-dex__tier--d { background: #bfdbfe; }
.shogi-game .shogi-reference-dex__tiers td {
  padding: 0.35rem;
  border-radius: 0 0.35rem 0.35rem 0;
  background: rgba(255, 252, 244, 0.08);
}
.shogi-game .shogi-reference-dex__tiers ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-reference-dex__tier-piece {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.25rem 0.5rem 0.25rem 0.3rem;
  border: 1px solid rgba(241, 165, 76, 0.55);
  border-radius: 0.3rem;
  background: rgba(255, 252, 244, 0.92);
}
.shogi-game .shogi-reference-dex__piece-images {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex: none;
  gap: 0.1rem;
}
.shogi-game .shogi-reference-dex__piece-images img {
  display: block;
  width: 2.3rem;
  height: 2.5rem;
  object-fit: contain;
  user-select: none;
}
/* 駒画像そのものを押せるようにし、共通のボタン装飾は外す。 */
.shogi-game button.shogi-reference-dex__piece-link {
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  box-shadow: none;
}
@media (hover: hover) {
  .shogi-game button.shogi-reference-dex__piece-link:not(:disabled):hover {
    background: rgba(241, 165, 76, 0.28);
    transform: translateY(-1px);
  }
}
.shogi-game button.shogi-reference-dex__piece-link:active {
  background: rgba(241, 165, 76, 0.4);
}
.shogi-game .shogi-dex button.shogi-reference-dex__return {
  align-self: flex-start;
  min-height: 2.4rem;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  font-size: 0.85rem;
}
.shogi-game .shogi-reference-dex__ai {
  margin-top: 0.9rem;
}
.shogi-game .shogi-reference-dex__ai h3 {
  margin: 0 0 0.2rem;
  font-size: 1rem;
}
.shogi-game .shogi-reference-dex__ai p {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  opacity: 0.85;
}
.shogi-game .shogi-reference-dex__ai ol {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-reference-dex__ai li {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.5rem;
  align-items: center;
  overflow: hidden;
  padding: 0.2rem 0.55rem 0.2rem 0.3rem;
  border-radius: 0.3rem;
  background: rgba(255, 252, 244, 0.92);
  color: #14212e;
}
.shogi-game .shogi-reference-dex__ai li .shogi-reference-dex__piece-images img {
  width: 1.9rem;
  height: 2.05rem;
}
.shogi-game .shogi-reference-dex__ai-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(241, 165, 76, 0.4);
}
.shogi-game .shogi-reference-dex__ai li strong,
.shogi-game .shogi-reference-dex__ai li small {
  position: relative;
  z-index: 1;
}
.shogi-game .shogi-reference-dex__ai li strong {
  font-size: 1.05rem;
}
.shogi-game .shogi-reference-dex__ai li small {
  min-width: 3.6rem;
  text-align: right;
  opacity: 0.75;
}
.shogi-game .shogi-reference-dex__points {
  color: #c2410c;
  font-size: 1.15rem;
  font-weight: 800;
  text-align: right;
}
.shogi-game .shogi-reference-dex__points small {
  margin-left: 0.1rem;
  font-size: 0.7rem;
}
</style>
