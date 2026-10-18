<template>
  <div class="plan-sheet" role="dialog" aria-modal="true" :aria-label="title" @click.self="emit('close')">
    <div ref="panel" class="plan-sheet__panel" tabindex="-1">
      <header class="plan-sheet__header">
        <button v-if="detail || fortuneOpen" type="button" class="plan-sheet__back" aria-label="一覧へ戻る" @click="backToList">‹</button>
        <h3>{{ fortuneOpen ? "戦法占い" : detail ? detailName : title }}</h3>
        <button type="button" class="plan-sheet__close" aria-label="閉じる" @click="emit('close')">×</button>
      </header>

      <!-- 戦法占い。結果の「この作戦で指す」で、その作戦を選ぶ。 -->
      <div v-if="fortuneOpen" class="plan-sheet__body">
        <OpeningFortune
          :asset-base-url="assetBaseUrl"
          :actions="['play']"
          :locked-ids="lockedIds"
          @result="emit('fortune-result', $event)"
          @action="(_, planId) => chooseFortune(planId)"
        />
      </div>

      <!-- くわしく: 完成形を大きく見せ、得意・苦手・コツを1行ずつ。囲いは合う順に並べて替えられる。 -->
      <div v-else-if="detail" class="plan-sheet__body plan-sheet__detail">
        <div class="plan-sheet__detail-head">
          <FormationThumb class="plan-sheet__detail-thumb" :strategy-id="detail.plan.strategyId" :castle-id="detailCastle" />
          <div class="plan-sheet__tags">
            <span class="plan-sheet__tag" :class="`plan-sheet__tag--${detail.plan.style}`">{{ OPENING_STYLE_LABELS[detail.plan.style] }}</span>
            <span class="plan-sheet__stars" :aria-label="`難しさ${detail.plan.difficulty}`">{{ stars(detail.plan.difficulty) }}</span>
            <span v-if="detail.count" class="plan-sheet__count">完成 {{ detail.count }}回</span>
          </div>
          <p class="plan-sheet__legend"><span class="plan-sheet__legend-swatch" aria-hidden="true"></span>緑のわくの駒を動かして、この形を作るよ</p>
        </div>
        <div v-if="detail.castles.length && detail.plan.strategyId && !detail.plan.name" class="plan-sheet__castles"role="radiogroup" aria-label="いっしょに組む囲い">
          <p>いっしょに組む囲い</p>
          <div>
            <button
              v-for="(castleId, index) in detail.castles"
              :key="castleId"
              type="button"
              role="radio"
              class="plan-sheet__castle"
              :class="{ 'plan-sheet__castle--selected': detailCastle === castleId }"
              :aria-checked="detailCastle === castleId"
              @click="detailCastle = castleId"
            ><b aria-hidden="true">{{ index === 0 ? "◎" : "○" }}</b>{{ castleLabel(castleId) }}<small v-if="index === 0">いちばん合う</small></button>
            <button
              type="button"
              role="radio"
              class="plan-sheet__castle"
              :class="{ 'plan-sheet__castle--selected': !detailCastle }"
              :aria-checked="!detailCastle"
              @click="detailCastle = ''"
            >囲いは組まない</button>
          </div>
        </div>
        <dl class="plan-sheet__facts">
          <template v-for="fact in detailFacts" :key="fact.label">
            <dt>{{ fact.label }}</dt>
            <dd>{{ fact.text }}</dd>
          </template>
        </dl>
      </div>

      <div v-else class="plan-sheet__body">
        <div class="plan-sheet__actions">
          <button type="button" class="plan-sheet__auto" @click="emit('auto')">
            <span>おまかせ</span>
            <small>やこび姫が1つ選ぶよ</small>
          </button>
          <button type="button" class="plan-sheet__fortune" data-fortune-open @click="fortuneOpen = true">
            <span>迷ったら占う</span>
            <small>3つの質問で、やこび姫が占うよ</small>
          </button>
          <button v-if="allowClear" type="button" class="plan-sheet__clear" @click="emit('clear')">作戦なしにする</button>
        </div>
        <p v-if="note" class="plan-sheet__note">{{ note }}</p>
        <section v-for="group in groups" :key="group.id" class="plan-sheet__group" :aria-label="group.label">
          <h4>{{ group.label }}<small>{{ group.description }}</small></h4>
          <div class="plan-sheet__cards">
            <button
              v-for="entry in group.open"
              :key="entry.plan.id"
              type="button"
              class="plan-sheet__card"
              :class="{ 'plan-sheet__card--selected': entry.plan.id === selectedId }"
              :aria-pressed="entry.plan.id === selectedId"
              :data-plan-id="entry.plan.id"
              @click="openDetail(entry)"
            >
              <FormationThumb class="plan-sheet__thumb" :strategy-id="entry.plan.strategyId" :castle-id="entry.castles[0] ?? ''" />
              <span class="plan-sheet__card-text">
                <b>{{ planTitle(entry.plan) }}<em v-if="entry.isNew" class="plan-sheet__new">NEW</em></b>
                <small>{{ catchLine(entry.plan) }}</small>
                <span class="plan-sheet__tags">
                  <span class="plan-sheet__tag" :class="`plan-sheet__tag--${entry.plan.style}`">{{ OPENING_STYLE_LABELS[entry.plan.style] }}</span>
                  <span class="plan-sheet__stars" :aria-label="`難しさ${entry.plan.difficulty}`">{{ stars(entry.plan.difficulty) }}</span>
                  <span v-if="entry.count" class="plan-sheet__count">完成 {{ entry.count }}回</span>
                </span>
              </span>
            </button>
            <!-- まだ使えない作戦は、段ごとにまとめて、形の影と名前と条件だけを見せる。 -->
            <div v-for="locked in group.locked" :key="locked.tier" class="plan-sheet__locked" :data-locked-tier="locked.tier">
              <div class="plan-sheet__locked-shapes">
                <span v-for="entry in locked.preview" :key="entry.plan.id" class="plan-sheet__locked-shape">
                  <FormationThumb :strategy-id="entry.plan.strategyId" :castle-id="entry.plan.castles[0] ?? ''" silhouette />
                  <small>{{ planTitle(entry.plan) }}</small>
                </span>
                <span v-if="locked.rest" class="plan-sheet__locked-rest">ほか{{ locked.rest }}つ</span>
              </div>
              <p><span aria-hidden="true">🔒</span>{{ locked.condition }}</p>
            </div>
          </div>
        </section>
        <div v-if="showSwitch" class="plan-sheet__switch-row">
          <span>
            ぜんぶの作戦を使う
            <small>将棋に慣れていたら、まだ使えない作戦もすぐ選べるよ</small>
          </span>
          <button
            type="button"
            role="switch"
            class="shogi-game__switch"
            :aria-checked="showAll"
            aria-label="ぜんぶの作戦を使う"
            @click="emit('toggle-all', !showAll)"
          ><span aria-hidden="true"></span></button>
        </div>
      </div>

      <footer v-if="detail && !fortuneOpen" class="plan-sheet__footer">
        <button type="button" class="plan-sheet__choose" @click="choose">この作戦にする</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import FormationThumb from "./FormationThumb.vue";
import OpeningFortune from "./OpeningFortune.vue";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";
import { openingExplanation } from "./core/opening-explanations.mjs";
import { OPENING_PLAN_GROUPS, OPENING_PLAN_TIERS, OPENING_STYLE_LABELS } from "./core/opening-catalog.mjs";

export type OpeningPlanView = {
  id: string; strategyId: string; castles: readonly string[]; group: string; tier: string;
  style: string; difficulty: number; name?: string; catch?: string; explanation?: string;
};
export type OpeningPlanEntry = {
  plan: OpeningPlanView;
  // 今の局面から組める、合う囲い(合う順)。
  castles: string[];
  locked: boolean;
  condition: string;
  isNew: boolean;
  count: number;
};

const props = defineProps({
  title: { type: String, default: "作戦をえらぶ" },
  entries: { type: Array as PropType<OpeningPlanEntry[]>, required: true },
  selectedId: { type: String, default: "" },
  selectedCastle: { type: String, default: "" },
  allowClear: { type: Boolean, default: true },
  showSwitch: { type: Boolean, default: true },
  showAll: { type: Boolean, default: false },
  note: { type: String, default: "" },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{
  choose: [planId: string, castleId: string];
  clear: [];
  auto: [];
  "toggle-all": [on: boolean];
  close: [];
  "fortune-result": [planId: string];
}>();

const GROUP_DESCRIPTIONS: { [id: string]: string } = {
  static: "飛車をそのまま使って、まっすぐ攻める",
  ranging: "飛車を横に動かして、受けてから反撃する",
  surprise: "相手をおどろかせる作戦。決まると一気に有利",
  castle: "戦法は決めずに、玉を守る形だけを組む",
};
const LOCKED_PREVIEW = 3;

const strategyLabel = (id: string) => OPENING_STRATEGIES.find((entry) => entry.id === id)?.label ?? "";
function castleLabel(id: string) {
  return OPENING_CASTLES.find((entry) => entry.id === id)?.label ?? "";
}
function planTitle(plan: OpeningPlanView) {
  return plan.name ?? (plan.strategyId ? strategyLabel(plan.strategyId) : castleLabel(plan.castles[0] ?? ""));
}
const explanationOf = (plan: OpeningPlanView) => openingExplanation(plan.explanation || plan.strategyId || plan.castles[0] || "");
function catchLine(plan: OpeningPlanView) {
  return plan.catch ?? explanationOf(plan)?.overview ?? "";
}
function stars(difficulty: number) {
  return "★".repeat(difficulty) + "☆".repeat(Math.max(0, 3 - difficulty));
}

const groups = computed(() => OPENING_PLAN_GROUPS.map((group) => {
  const inGroup = props.entries.filter(({ plan }) => plan.group === group.id);
  const lockedEntries = inGroup.filter(({ locked }) => locked);
  const locked = OPENING_PLAN_TIERS.flatMap((tier) => {
    const entries = lockedEntries.filter(({ plan }) => plan.tier === tier.id);
    if (!entries.length) return [];
    return [{
      tier: tier.id,
      preview: entries.slice(0, LOCKED_PREVIEW),
      rest: Math.max(0, entries.length - LOCKED_PREVIEW),
      condition: entries[0].condition,
    }];
  });
  return {
    ...group,
    description: GROUP_DESCRIPTIONS[group.id] ?? "",
    open: inGroup.filter(({ locked: isLocked }) => !isLocked),
    locked,
  };
}).filter(({ open, locked }) => open.length || locked.length));

const detailId = ref("");
const detailCastle = ref("");
const detail = computed(() => props.entries.find(({ plan, locked }) => plan.id === detailId.value && !locked) ?? null);
const detailName = computed(() => {
  if (!detail.value) return "";
  const title = planTitle(detail.value.plan);
  const castle = detail.value.plan.strategyId && !detail.value.plan.name && detailCastle.value ? castleLabel(detailCastle.value) : "";
  return castle ? `${title}＋${castle}` : title;
});
const detailFacts = computed(() => {
  const plan = detail.value?.plan;
  if (!plan) return [];
  const own = explanationOf(plan);
  const castle = detailCastle.value && plan.strategyId && !plan.name ? openingExplanation(detailCastle.value) : null;
  const facts = [
    { label: plan.strategyId ? "どんな作戦？" : "どんな囲い？", text: plan.catch ?? own?.overview ?? "" },
    { label: "ねらい", text: own?.aim ?? "" },
    { label: "コツ", text: own?.tip ?? "" },
    { label: "気をつけること", text: own?.caution ?? own?.weakness ?? "" },
    { label: castle ? `${castleLabel(detailCastle.value)}は` : "", text: castle?.overview ?? "" },
  ];
  return facts.filter(({ label, text }) => label && text);
});

function openDetail(entry: OpeningPlanEntry) {
  detailId.value = entry.plan.id;
  const current = entry.plan.id === props.selectedId && entry.castles.includes(props.selectedCastle) ? props.selectedCastle : "";
  detailCastle.value = current || entry.castles[0] || "";
}
const fortuneOpen = ref(false);
const lockedIds = computed(() => props.entries.filter(({ locked }) => locked).map(({ plan }) => plan.id));
function backToList() {
  fortuneOpen.value = false;
  detailId.value = "";
}
/** 占いの結果の作戦にする。囲いは、今の局面から組める合う囲いのいちばん目。 */
function chooseFortune(planId: string) {
  const entry = props.entries.find(({ plan }) => plan.id === planId);
  emit("choose", planId, entry?.castles[0] ?? "");
}
function choose() {
  if (!detail.value) return;
  emit("choose", detail.value.plan.id, detailCastle.value);
}
// Escは、くわしい画面なら一覧へ、一覧ならシートを閉じる。開いたら、キーボードで続けて操作できるようパネルへ移る。
const panel = ref<HTMLElement | null>(null);
function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.stopPropagation();
  if (detailId.value || fortuneOpen.value) backToList();
  else emit("close");
}
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  panel.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style>
.plan-sheet {
  --plan-sheet-accent: #c98a3d;
  --plan-sheet-ink: #1d303f;
  --plan-sheet-paper: #fffcf4;
  --plan-sheet-line: #d9cfbd;
  --plan-sheet-muted: #6b5a45;
  --plan-sheet-selected: #2f6f9f;
  --plan-sheet-attack: #b4432f;
  --plan-sheet-defense: #2f6f9f;
  --plan-sheet-counter: #7a4ea3;
  position: absolute;
  z-index: 115;
  inset: 0;
  display: grid;
  place-items: center;
  padding: clamp(0.4em, 3vw, 2em);
  background: rgba(23, 38, 50, 0.6);
}
.plan-sheet__panel {
  outline: none;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(46em, 100%);
  max-height: min(48em, 100%);
  overflow: hidden;
  border: 3px solid var(--plan-sheet-accent);
  border-radius: 0.6em;
  color: var(--plan-sheet-ink);
  background: var(--plan-sheet-paper);
  box-shadow: 0 1em 2.6em rgba(7, 18, 26, 0.5);
}
.plan-sheet__header {
  position: relative;
  padding: 0.55em 2.8em;
  background: var(--plan-sheet-accent);
  text-align: center;
}
.plan-sheet__header h3 {
  margin: 0;
  color: var(--plan-sheet-paper);
  font-size: 1.1em;
  letter-spacing: 0.06em;
}
.shogi-game .plan-sheet__close,
.shogi-game .plan-sheet__back {
  position: absolute;
  top: 50%;
  width: 2.2em;
  min-height: 2.2em;
  padding: 0;
  border: 0;
  color: var(--plan-sheet-paper);
  background: transparent;
  box-shadow: none;
  font-size: 1.2em;
  line-height: 1;
  transform: translateY(-50%);
}
.shogi-game .plan-sheet__close { right: 0.3em; }
.shogi-game .plan-sheet__back { left: 0.3em; font-size: 1.6em; }
.plan-sheet__body {
  display: grid;
  gap: 0.8em;
  align-content: start;
  padding: 0.8em;
  overflow: auto;
  overscroll-behavior: contain;
}
.plan-sheet__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
}
.shogi-game .plan-sheet__auto {
  display: grid;
  flex: 1 1 12em;
  justify-items: start;
  min-height: 2.9em;
  padding: 0.4em 0.9em;
  border: 2px solid var(--plan-sheet-accent);
  border-radius: 0.5em;
  color: var(--plan-sheet-paper);
  background: var(--plan-sheet-accent);
  text-align: left;
}
.plan-sheet__auto span { font-size: 1.05em; font-weight: 800; }
.plan-sheet__auto small { opacity: 0.9; }
.shogi-game .plan-sheet__fortune {
  display: grid;
  flex: 1 1 12em;
  justify-items: start;
  min-height: 2.9em;
  padding: 0.4em 0.9em;
  border: 2px solid var(--plan-sheet-accent);
  border-radius: 0.5em;
  color: var(--plan-sheet-ink);
  background: #fff;
  text-align: left;
}
.plan-sheet__fortune span { font-size: 1.05em; font-weight: 800; }
.plan-sheet__fortune small { color: var(--plan-sheet-muted); }
.shogi-game .plan-sheet__clear {
  min-height: 2.9em;
  padding: 0.4em 0.9em;
  border: 2px solid var(--plan-sheet-line);
  border-radius: 0.5em;
  color: var(--plan-sheet-ink);
  background: #fff;
}
.plan-sheet__note {
  margin: 0;
  color: var(--plan-sheet-muted);
  font-size: 0.85em;
}
.plan-sheet__group {
  display: grid;
  gap: 0.45em;
}
.plan-sheet__group + .plan-sheet__group {
  padding-top: 0.7em;
  border-top: 2px solid var(--plan-sheet-line);
}
.plan-sheet__group h4 {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em 0.6em;
  align-items: baseline;
  margin: 0;
  font-size: 1em;
}
.plan-sheet__group h4 small {
  color: var(--plan-sheet-muted);
  font-size: 0.78em;
  font-weight: 600;
}
.plan-sheet__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17em, 1fr));
  gap: 0.5em;
}
.shogi-game .plan-sheet__card {
  display: grid;
  grid-template-columns: 7.4em minmax(0, 1fr);
  gap: 0.6em;
  align-items: center;
  min-height: 4.4em;
  padding: 0.45em 0.6em;
  border: 2px solid var(--plan-sheet-line);
  border-radius: 0.5em;
  color: var(--plan-sheet-ink);
  background: #fff;
  text-align: left;
}
.shogi-game .plan-sheet__card--selected {
  border-color: var(--plan-sheet-selected);
  box-shadow: 0 0 0 2px var(--plan-sheet-selected);
}
.plan-sheet__card-text {
  display: grid;
  gap: 0.15em;
  min-width: 0;
}
.plan-sheet__card-text b {
  font-size: 1em;
}
.plan-sheet__card-text > small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--plan-sheet-muted);
  font-size: 0.78em;
  line-height: 1.35;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.plan-sheet__new {
  margin-left: 0.4em;
  padding: 0.05em 0.4em;
  border-radius: 0.3em;
  color: #fff;
  background: #c0392b;
  font-size: 0.7em;
  font-style: normal;
  vertical-align: 0.15em;
}
.plan-sheet__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
  align-items: center;
  font-size: 0.78em;
}
.plan-sheet__tag {
  padding: 0.05em 0.45em;
  border-radius: 0.3em;
  color: #fff;
  font-weight: 700;
}
.plan-sheet__tag--attack { background: var(--plan-sheet-attack); }
.plan-sheet__tag--defense { background: var(--plan-sheet-defense); }
.plan-sheet__tag--counter { background: var(--plan-sheet-counter); }
.plan-sheet__stars { color: #a86a1e; letter-spacing: 0.05em; }
.plan-sheet__count { color: #2f7d3a; font-weight: 700; }
.plan-sheet__locked {
  display: grid;
  gap: 0.35em;
  padding: 0.5em 0.6em;
  border: 2px dashed var(--plan-sheet-line);
  border-radius: 0.5em;
  color: var(--plan-sheet-muted);
  background: #f6f1e6;
}
.plan-sheet__locked p {
  margin: 0;
  font-size: 0.8em;
}
.plan-sheet__locked-shapes {
  display: flex;
  gap: 0.4em;
  align-items: end;
}
.plan-sheet__locked-shape {
  display: grid;
  gap: 0.1em;
  width: 4.6em;
  font-size: 0.85em;
  text-align: center;
}
.plan-sheet__locked-shape small {
  overflow: hidden;
  font-size: 0.75em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan-sheet__locked-rest {
  align-self: center;
  font-size: 0.8em;
  font-weight: 700;
}
.plan-sheet__switch-row {
  display: flex;
  gap: 0.8em;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.7em;
  border-top: 2px solid var(--plan-sheet-line);
}
.plan-sheet__switch-row span {
  display: grid;
  font-weight: 700;
}
.plan-sheet__switch-row small {
  color: var(--plan-sheet-muted);
  font-size: 0.78em;
  font-weight: 500;
}
.plan-sheet__detail-head {
  display: grid;
  gap: 0.4em;
  justify-items: center;
}
.plan-sheet__detail-thumb {
  width: min(20em, 100%);
}
.plan-sheet__legend {
  display: flex;
  gap: 0.4em;
  align-items: center;
  margin: 0;
  color: var(--plan-sheet-muted);
  font-size: 0.8em;
}
.plan-sheet__legend-swatch {
  width: 0.9em;
  height: 0.9em;
  border: 2px solid #2f7d3a;
  border-radius: 0.2em;
  background: rgba(64, 160, 84, 0.3);
}
.plan-sheet__castles {
  display: grid;
  gap: 0.35em;
}
.plan-sheet__castles p {
  margin: 0;
  font-size: 0.85em;
  font-weight: 700;
}
.plan-sheet__castles > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em;
}
.shogi-game .plan-sheet__castle {
  display: inline-flex;
  gap: 0.3em;
  align-items: baseline;
  min-height: 2.75em;
  padding: 0.35em 0.75em;
  border: 2px solid var(--plan-sheet-line);
  border-radius: 0.5em;
  color: var(--plan-sheet-ink);
  background: #fff;
}
.plan-sheet__castle small {
  color: var(--plan-sheet-muted);
  font-size: 0.75em;
}
.shogi-game .plan-sheet__castle--selected {
  border-color: var(--plan-sheet-selected);
  box-shadow: 0 0 0 2px var(--plan-sheet-selected);
}
.plan-sheet__facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.35em 0.8em;
  margin: 0;
  font-size: 0.92em;
}
.plan-sheet__facts dt {
  color: var(--plan-sheet-muted);
  font-weight: 700;
}
.plan-sheet__facts dd {
  margin: 0;
}
.plan-sheet__footer {
  display: grid;
  padding: 0.6em 0.8em;
  border-top: 2px solid var(--plan-sheet-line);
}
.shogi-game .plan-sheet__choose {
  min-height: 2.9em;
  border: 0;
  border-radius: 0.5em;
  color: #fff;
  background: var(--plan-sheet-selected);
  font-size: 1.05em;
  font-weight: 800;
}
/* 対局画面のボタンの暗い色の「触れたとき」を、明るい用紙の上の色に置き換える。 */
@media (hover: hover) {
  .shogi-game .plan-sheet__card:not(:disabled):hover,
  .shogi-game .plan-sheet__fortune:not(:disabled):hover,
  .shogi-game .plan-sheet__castle:not(:disabled):hover,
  .shogi-game .plan-sheet__clear:not(:disabled):hover {
    border-color: var(--plan-sheet-accent);
    background-color: #fdf3e2;
  }
  .shogi-game .plan-sheet__auto:not(:disabled):hover {
    background-color: #d99a4d;
  }
  .shogi-game .plan-sheet__choose:not(:disabled):hover {
    background-color: #3a80b3;
  }
  .shogi-game .plan-sheet__close:not(:disabled):hover,
  .shogi-game .plan-sheet__back:not(:disabled):hover {
    background-color: transparent;
  }
}
@media (max-width: 30em) {
  .plan-sheet__cards { grid-template-columns: minmax(0, 1fr); }
  .plan-sheet__facts { grid-template-columns: minmax(0, 1fr); }
  .plan-sheet__facts dd { margin-bottom: 0.3em; }
}
</style>
