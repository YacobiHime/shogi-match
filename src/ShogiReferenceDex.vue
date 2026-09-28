<template>
  <div class="shogi-dex" role="dialog" aria-modal="true" aria-labelledby="shogi-reference-dex-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> タイトルへ戻る
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

    <div class="shogi-dex__body">
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

      <section v-if="selectedEntry" class="shogi-dex__detail">
        <div class="shogi-dex__main">
          <div class="shogi-dex__detail-head">
            <h2>{{ selectedEntry.label }}</h2>
            <span v-if="kind === 'tesuji' && sideToMove === 'white'" class="shogi-dex__side-note">後手番の局面</span>
          </div>
          <div class="shogi-dex__stage">
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import {
  REFERENCE_DEX_KINDS,
  referenceDexEntries,
  referenceDexGroups,
  referenceEntryMarks,
  referenceEntrySfen,
} from "./core/reference-dex.mjs";

type ReferenceDexKind = "piece" | "tesuji" | "world";
type ReferenceEntry = {
  id: string;
  label: string;
  overview: string;
  rows: [string, string][];
  arrows?: string[];
};

const props = defineProps({
  kind: { type: String as () => ReferenceDexKind, required: true },
  assetBaseUrl: { type: String, default: "." },
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
const selectedId = ref(entries.value[0]?.id ?? "");
const listOpen = ref(false);
watch(() => props.kind, () => { selectedId.value = entries.value[0]?.id ?? ""; });

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

function selectItem(id: string) {
  selectedId.value = id;
  // 一覧から選んだらメニューを閉じる。
  listOpen.value = false;
}
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
  background: rgba(234, 179, 8, 0.65);
  box-shadow: inset 0 0 0 2px rgba(202, 138, 4, 0.9);
}
</style>
