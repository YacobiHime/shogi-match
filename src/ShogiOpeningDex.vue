<template>
  <div class="shogi-dex" role="dialog" aria-modal="true" aria-labelledby="shogi-dex-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="emit('close')">
        <span aria-hidden="true">←</span> タイトルへ戻る
      </button>
      <h1 id="shogi-dex-title">定跡図鑑</h1>
    </header>

    <div class="shogi-dex__modes" role="tablist" aria-label="定跡の種類">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'strategy'"
        :class="{ 'shogi-dex__mode--active': tab === 'strategy' }"
        @click="switchTab('strategy')"
      >
        <span class="shogi-dex__mode-icon" aria-hidden="true">攻</span>
        <span class="shogi-dex__mode-label">戦法</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'castle'"
        :class="{ 'shogi-dex__mode--active': tab === 'castle' }"
        @click="switchTab('castle')"
      >
        <span class="shogi-dex__mode-icon" aria-hidden="true">守</span>
        <span class="shogi-dex__mode-label">囲い</span>
      </button>
    </div>

    <!-- 小さい画面では定跡一覧をハンバーガーメニューにまとめる。 -->
    <button
      v-if="isNarrow"
      type="button"
      class="shogi-dex__list-toggle"
      :aria-expanded="listOpen"
      aria-controls="shogi-dex-list"
      @click="listOpen = !listOpen"
    >
      <span aria-hidden="true">☰</span>
      <span>定跡一覧</span>
      <small v-if="selectedDefinition">現在：{{ selectedDefinition.label }}</small>
    </button>

    <div class="shogi-dex__body">
      <nav
        id="shogi-dex-list"
        class="shogi-dex__list"
        :class="{ 'shogi-dex__list--open': listOpen }"
        aria-label="定跡一覧"
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
                <small v-if="item.sideTag" class="shogi-dex__side-tag">{{ item.sideTag }}</small>
              </button>
            </li>
          </ul>
        </section>
      </nav>

      <section v-if="selectedDefinition" class="shogi-dex__detail">
        <div class="shogi-dex__main">
          <div class="shogi-dex__detail-head">
            <h2>{{ selectedDefinition.label }}</h2>
            <span v-if="isWhiteSide" class="shogi-dex__side-note">後手から見た盤面</span>
          </div>
          <div class="shogi-dex__stage">
            <!-- 小さい画面では盤の横の矢印だけで前後できる。 -->
            <button
              v-if="isNarrow"
              type="button"
              class="shogi-dex__stage-nav"
              aria-label="前の局面へ戻る"
              :disabled="stepIndex === 0"
              @click="stepIndex -= 1"
            >◀</button>
            <div class="shogi-dex__board" :class="{ 'shogi-dex__board--done': stepIndex >= steps.length - 1 }">
              <ShogiMatchBoard
                :sfen="currentStep.sfen"
                :last-move="currentStep.lastMove"
                :allow-move="false"
                :enable-drag-and-drop="false"
                :flip="isWhiteSide"
                :mobile="isNarrow"
                :layout="isNarrow ? 'portrait' : 'standard'"
                :asset-base-url="assetBaseUrl"
              />
            </div>
            <button
              v-if="isNarrow"
              type="button"
              class="shogi-dex__stage-nav"
              aria-label="次の局面へ進む"
              :disabled="stepIndex >= steps.length - 1"
              @click="stepIndex += 1"
            >▶</button>
          </div>
          <div v-if="isNarrow" class="shogi-dex__stage-count" aria-live="polite">
            {{ stepIndex }}/{{ steps.length - 1 }}手目
          </div>
          <div v-if="!isNarrow" class="shogi-dex__controls">
            <button type="button" :disabled="stepIndex === 0" @click="stepIndex = 0">最初へ</button>
            <button type="button" :disabled="stepIndex === 0" @click="stepIndex -= 1">◀ 戻る</button>
            <span class="shogi-dex__step-count">{{ stepIndex }}/{{ steps.length - 1 }}手目</span>
            <button type="button" :disabled="stepIndex >= steps.length - 1" @click="stepIndex += 1">進む ▶</button>
            <button type="button" :disabled="stepIndex >= steps.length - 1" @click="stepIndex = steps.length - 1">完成形へ</button>
          </div>
          <ol v-if="!isNarrow" class="shogi-dex__moves" ref="moveListEl">
            <li v-for="(step, index) in steps" :key="index">
              <button
                type="button"
                :class="{ 'shogi-dex__move--current': stepIndex === index }"
                :aria-current="stepIndex === index ? 'step' : undefined"
                @click="stepIndex = index"
              >
                <span v-if="index === 0">初期局面</span>
                <template v-else>
                  <span>{{ index }}</span><span>{{ step.label }}</span>
                  <small v-if="step.routine" class="shogi-dex__move-routine">代表局面</small>
                </template>
              </button>
            </li>
          </ol>
        </div>

        <div class="shogi-dex__explanation-col">
          <div v-if="explanation" class="shogi-dex__explanation">
            <div class="shogi-dex__speech">
              <img
                class="shogi-dex__chara"
                :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
                alt=""
                aria-hidden="true"
              >
              <p>{{ explanation.overview }}</p>
            </div>
            <dl>
              <div v-for="row in explanationRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.text }}</dd>
              </div>
            </dl>
          </div>
          <p v-else class="shogi-dex__no-explanation">
            <img
              class="shogi-dex__chara"
              :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=2`"
              alt=""
              aria-hidden="true"
            >
            この定跡の解説はまだ用意できてないんだ……ごめんね！手順と盤面は見られるよ！
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { STANDARD_SFEN } from "./game-state";
import {
  OPENING_CASTLES,
  OPENING_CASTLE_GROUPS,
  OPENING_GUIDE_ROUTINES,
  OPENING_STRATEGIES,
} from "./core/opening-guide.mjs";
import { openingExplanation } from "./core/opening-explanations.mjs";
import { formatHintMove } from "./core/match-assists.mjs";
import { buildOpeningDexSteps } from "./core/opening-dex-replay.mjs";

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits(["close"]);

type DexDefinition = { id: string; label: string; blackMoves?: string[]; availability?: { colors?: string[] } };
type DexStep = { sfen: string; label: string; lastMove: string; routine: string | null };

const STRATEGY_GROUP_LABELS = [
  { id: "ibisha", label: "居飛車/基本戦法" },
  { id: "aigakari", label: "相居飛車／相掛かり" },
  { id: "yokofudori", label: "相居飛車／横歩取り" },
  { id: "yagura", label: "相居飛車／矢倉" },
  { id: "kakugawari", label: "相居飛車／角換わり" },
  { id: "gangi", label: "相居飛車／雁木" },
  { id: "anti-ranging", label: "対抗型／居飛車側" },
  { id: "shiken", label: "四間飛車" },
  { id: "sangen", label: "三間飛車" },
  { id: "nakabisha", label: "中飛車" },
  { id: "mukai", label: "向かい飛車" },
  { id: "special", label: "奇襲・特殊戦法" },
];

const tab = ref<"strategy" | "castle">("strategy");
const selectedId = ref("ibisha");
const stepIndex = ref(0);
const listOpen = ref(false);
const moveListEl = ref<HTMLElement | null>(null);

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

const definitions = computed<DexDefinition[]>(() => (
  tab.value === "strategy" ? OPENING_STRATEGIES : OPENING_CASTLES
));
const groups = computed(() => {
  const items = definitions.value;
  if (tab.value === "strategy") {
    return STRATEGY_GROUP_LABELS.map((group) => ({
      id: group.id,
      label: group.label,
      items: items.filter((item: any) => item.family === group.id).map(toListItem),
    })).filter((group) => group.items.length);
  }
  return OPENING_CASTLE_GROUPS.map((group: any) => ({
    id: group.id,
    label: group.label.split("／").pop() ?? group.label,
    items: items.filter((item: any) => item.menuGroup === group.id).map(toListItem),
  })).filter((group) => group.items.length)
    // 分類のない定跡も一覧に残す。
    .concat({
      id: "uncategorized",
      label: "その他",
      items: items.filter((item: any) => !item.menuGroup).map(toListItem),
    })
    .filter((group) => group.items.length);
});
function toListItem(item: any) {
  const colors = item.availability?.colors;
  const sideTag = Array.isArray(colors) && colors.length === 1
    ? (colors[0] === "white" ? "後手" : "先手")
    : "";
  return { id: item.id, label: item.label, sideTag };
}
const selectedDefinition = computed(() => (
  definitions.value.find((item) => item.id === selectedId.value) ?? null
));
const isWhiteSide = computed(() => {
  const colors = (selectedDefinition.value as any)?.availability?.colors;
  return Array.isArray(colors) && colors.length === 1 && colors[0] === "white";
});
const currentStep = computed(() => (
  steps.value[Math.min(stepIndex.value, steps.value.length - 1)] ?? { sfen: STANDARD_SFEN, label: "", lastMove: "", routine: null }
));
const explanation = computed(() => openingExplanation(selectedId.value));
// 戦法と囲いで解説の項目を切り替える。囲いは「特徴／弱点／発展形」の3項目。
const explanationRows = computed(() => {
  const entry = explanation.value as any;
  if (!entry) return [];
  if (tab.value === "castle") {
    return [
      { label: "特徴は？", text: entry.feature },
      { label: "弱点は？", text: entry.weakness },
      { label: "発展形", text: entry.development },
    ].filter((row) => row.text);
  }
  return [
    { label: "狙いは？", text: entry.aim },
    { label: "相性のいい囲い", text: entry.castles },
    { label: "形ができたら？", text: entry.followup },
    { label: "気をつけたいこと", text: entry.caution },
  ].filter((row) => row.text);
});

function switchTab(next: "strategy" | "castle") {
  if (tab.value === next) return;
  tab.value = next;
  const first = tab.value === "strategy" ? OPENING_STRATEGIES[0] : OPENING_CASTLES[0];
  selectedId.value = (first as any)?.id ?? "";
}
function selectItem(id: string) {
  selectedId.value = id;
  // 一覧から選んだらメニューを閉じる。
  listOpen.value = false;
}

// 定跡の手順を平手の初期局面から再生する。後手専用の戦法は左右を反転し、
// 「@角換わり」のような定型手順は代表局面の確認手順へ置き換える。
const steps = computed<DexStep[]>(() => buildOpeningDexSteps(
  selectedDefinition.value,
  {
    whiteSide: isWhiteSide.value,
    initialSfen: STANDARD_SFEN,
    routines: OPENING_GUIDE_ROUTINES as any,
    formatLabel: (usi: string, beforeSfen: string) => formatHintMove(usi, beforeSfen),
  },
));

// 定跡を選んだ直後は完成形を表示する。
watch(selectedId, () => { stepIndex.value = steps.value.length - 1; });
watch(steps, () => { stepIndex.value = steps.value.length - 1; }, { immediate: true });
watch(stepIndex, async () => {
  await nextTick();
  moveListEl.value?.querySelector(".shogi-dex__move--current")
    ?.scrollIntoView({ block: "nearest" });
});
</script>

<style>
.shogi-game .shogi-dex {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  background: #1d2b3a;
  color: var(--ink, #fff8ec);
  font-family: "Courier New", "Hiragino Kaku Gothic ProN", "Yu Gothic", monospace;
}
.shogi-game .shogi-dex__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid rgba(242, 227, 194, 0.35);
}
.shogi-game .shogi-dex__header h1 {
  margin: 0;
  font-size: 1.3rem;
  letter-spacing: 0.2em;
}
.shogi-game .shogi-dex .shogi-dex__back {
  min-height: 2rem;
  padding: 0.3rem 0.8rem;
  border: 1px solid rgba(242, 227, 194, 0.5);
  border-radius: 999px;
  color: #f2e3c2;
  background: transparent;
  font: 700 0.8rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex__modes {
  display: flex;
  gap: 0.6rem;
  padding: 0.6rem 1rem 0;
}
.shogi-game .shogi-dex .shogi-dex__modes button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  max-width: 14rem;
  min-height: 2.9rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(242, 227, 194, 0.5);
  border-radius: 0.6rem;
  color: #f2e3c2;
  background: rgba(242, 227, 194, 0.06);
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex .shogi-dex__modes button:hover {
  background: rgba(242, 227, 194, 0.14);
}
.shogi-game .shogi-dex .shogi-dex__modes button.shogi-dex__mode--active {
  color: #25151a;
  background: #e8a04c;
  border-color: #e8a04c;
}
.shogi-dex__mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 1.9rem;
  height: 1.9rem;
  border: 1px solid currentcolor;
  border-radius: 50%;
  font-size: 0.95rem;
  font-weight: 700;
}
.shogi-dex__mode-label {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.15em;
}
.shogi-game .shogi-dex__body {
  display: grid;
  grid-template-columns: 16rem minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  /* 盤面内部の巨大なz-index要素が一覧オーバーレイの上に出ないよう、
     独自のstacking contextに閉じ込める。 */
  position: relative;
  z-index: 0;
}
.shogi-game .shogi-dex__list {
  overflow-y: auto;
  padding: 0.5rem 0.4rem 1rem;
  border-right: 1px solid rgba(242, 227, 194, 0.25);
}
.shogi-game .shogi-dex .shogi-dex__list-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.55rem 0.6rem 0;
  min-height: 2.7rem;
  padding: 0.3rem 0.8rem;
  border: 1px solid rgba(242, 227, 194, 0.5);
  border-radius: 0.5rem;
  color: #f2e3c2;
  background: rgba(242, 227, 194, 0.08);
  font: 700 0.9rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex__list-toggle small {
  margin-left: auto;
  overflow: hidden;
  color: #e8a04c;
  font-size: 0.72rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-dex .shogi-dex__list-close {
  min-height: 2.2rem;
  margin: 0.5rem 0.4rem 0.2rem;
  padding: 0.25rem 0.8rem;
  border: 1px solid rgba(242, 227, 194, 0.5);
  border-radius: 999px;
  color: #f2e3c2;
  background: transparent;
  font: 700 0.8rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex__group h2 {
  margin: 0.6rem 0.3rem 0.25rem;
  font-size: 0.72rem;
  color: #e8a04c;
  letter-spacing: 0.08em;
}
.shogi-dex__group ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-dex__group li {
  margin: 0;
}
.shogi-game .shogi-dex .shogi-dex__group button {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  width: 100%;
  min-height: 1.9rem;
  padding: 0.25rem 0.55rem;
  border: 0;
  border-radius: 0.35rem;
  color: inherit;
  background: transparent;
  font: 500 0.82rem/1.35 inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-dex .shogi-dex__group button:hover {
  background: rgba(242, 227, 194, 0.12);
}
.shogi-game .shogi-dex .shogi-dex__item--active,
.shogi-game .shogi-dex .shogi-dex__item--active:hover {
  color: #25151a;
  background: #f2e3c2;
}
.shogi-game .shogi-dex__side-tag {
  flex: none;
  padding: 0 0.3rem;
  border: 1px solid #e8a04c;
  border-radius: 0.3rem;
  color: #e8a04c;
  font-size: 0.62rem;
  line-height: 1.3;
}
.shogi-game .shogi-dex__detail {
  display: flex;
  align-items: stretch;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.6rem 1rem 1rem;
  overflow-y: auto;
}
/* 左列：盤と操作系。右列：解説。盤は残った高さいっぱいに広がる。 */
/* 左列のbasisを0にし、盤の幅が解説列を押し潰さないようにする。 */
.shogi-game .shogi-dex__main {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}
.shogi-game .shogi-dex__explanation-col {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  flex: 0 1 clamp(15rem, 24vw, 22rem);
  min-width: min(14rem, 40vw);
  overflow-y: auto;
}
.shogi-dex__detail-head {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex: none;
}
.shogi-game .shogi-dex__detail-head h2 {
  margin: 0;
  font-size: 1.15rem;
}
.shogi-game .shogi-dex__side-note {
  color: #e8a04c;
  font-size: 0.72rem;
}
.shogi-game .shogi-dex__stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex: 1 1 0;
  min-height: 11rem;
  width: 100%;
}
.shogi-game .shogi-dex__stage-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 3rem;
  height: 4.5rem;
  border: 1px solid rgba(242, 227, 194, 0.5);
  border-radius: 0.5rem;
  color: #f2e3c2;
  background: rgba(242, 227, 194, 0.08);
  font: 700 1.1rem/1 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex__stage-nav:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.shogi-game .shogi-dex__board {
  height: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  /* 標準レイアウトの盤の縦横比(1471/959)。高さに合わせて幅を決める。 */
  aspect-ratio: 1471 / 959;
}
.shogi-game .shogi-dex__stage-count {
  align-self: center;
  font-size: 0.85rem;
}
/* 対局画面と同様、図鑑では盤・駒の着せ替えUIを隠す。 */
.shogi-game .shogi-dex .shogi-match-theme-controls {
  display: none;
}
.shogi-game .shogi-dex__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex: none;
}
.shogi-game .shogi-dex .shogi-dex__controls button {
  min-height: 2rem;
  padding: 0.3rem 0.8rem;
  border: 1px solid rgba(242, 227, 194, 0.5);
  border-radius: 0.4rem;
  color: #f2e3c2;
  background: rgba(242, 227, 194, 0.08);
  font: 700 0.8rem/1.2 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex .shogi-dex__controls button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.shogi-game .shogi-dex__step-count {
  min-width: 6em;
  text-align: center;
  font-size: 0.85rem;
}
.shogi-game .shogi-dex__moves {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  flex: none;
  margin: 0;
  padding: 0.4rem;
  list-style: none;
  border: 1px solid rgba(242, 227, 194, 0.25);
  border-radius: 0.5rem;
  max-height: 7.5rem;
  overflow-y: auto;
}
.shogi-game .shogi-dex .shogi-dex__moves button {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  min-height: 1.8rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid rgba(242, 227, 194, 0.35);
  border-radius: 0.35rem;
  color: inherit;
  background: transparent;
  font: 500 0.78rem/1.3 inherit;
  font-family: inherit;
  cursor: pointer;
}
.shogi-game .shogi-dex .shogi-dex__move--current,
.shogi-game .shogi-dex .shogi-dex__move--current:hover {
  color: #25151a;
  background: #e8a04c;
  border-color: #e8a04c;
}
.shogi-game .shogi-dex__move-routine {
  color: #e8a04c;
}
.shogi-game .shogi-dex .shogi-dex__move--current .shogi-dex__move-routine {
  color: #25151a;
}
.shogi-game .shogi-dex__explanation {
  padding: 0.7rem 0.9rem;
  border: 1px solid rgba(242, 227, 194, 0.35);
  border-radius: 0.6rem;
  background: rgba(29, 43, 58, 0.6);
}
.shogi-game .shogi-dex__speech {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  font-weight: 700;
}
.shogi-game .shogi-dex__speech p {
  margin: 0;
}
.shogi-game .shogi-dex__chara {
  flex: none;
  height: clamp(88px, 13vh, 120px);
  width: auto;
  pointer-events: none;
  image-rendering: pixelated;
  animation: shogi-dex-chara-float 4.5s ease-in-out infinite;
}
@keyframes shogi-dex-chara-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
.shogi-game .shogi-dex__no-explanation {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  margin: 0;
  color: rgba(242, 227, 194, 0.8);
  font-size: 0.85rem;
}
.shogi-game .shogi-dex__explanation dl {
  margin: 0;
}
.shogi-game .shogi-dex__explanation dl > div {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.4rem;
}
.shogi-game .shogi-dex__explanation dt {
  flex: none;
  min-width: 8em;
  color: #e8a04c;
  font-size: 0.78rem;
}
.shogi-game .shogi-dex__explanation dd {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.55;
}
@media (max-width: 56rem) {
  .shogi-game .shogi-dex__modes {
    gap: 0.4rem;
    padding: 0.5rem 0.6rem 0;
  }
  .shogi-game .shogi-dex .shogi-dex__modes button {
    min-height: 2.6rem;
    padding: 0.3rem 0.6rem;
  }
  .shogi-game .shogi-dex__body {
    grid-template-columns: 1fr;
    /* 詳細の高さは内容に任せ、はみ出した盤が解説に被らないようにする。 */
    grid-template-rows: auto;
    overflow-y: auto;
  }
  /* 一覧は非表示にし、ハンバーガーからオーバーレイで開く。
     fixedにして詳細のスクロールから切り離し、盤面内部の巨大なz-index
     (1000000)を超える値で最前面に置く。 */
  .shogi-game .shogi-dex__list {
    display: none;
    border-right: 0;
  }
  .shogi-game .shogi-dex__list--open {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1000001;
    background: #1d2b3a;
    padding-bottom: 1rem;
  }
  .shogi-game .shogi-dex__detail {
    flex-direction: column;
    overflow-y: visible;
    padding: 0.5rem 0.6rem 1rem;
  }
  .shogi-game .shogi-dex__main {
    flex: none;
  }
  .shogi-game .shogi-dex__explanation-col {
    flex: none;
    overflow-y: visible;
  }
  .shogi-game .shogi-dex__stage {
    flex: none;
    align-self: center;
    width: 100%;
    max-width: 28rem;
  }
  .shogi-game .shogi-dex__board {
    flex: 1;
    height: auto;
    /* 縦長レイアウトの盤の縦横比(878/1168)に合わせ、盤を最大化する。 */
    aspect-ratio: 878 / 1168;
  }
  .shogi-game .shogi-dex__stage-nav {
    width: 2.6rem;
    height: 4rem;
  }
}
</style>
