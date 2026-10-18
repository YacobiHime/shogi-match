<template>
  <!-- 戦法占い。質問に答えるたびに、上から下へ道が分かれていく図の上を進み、8つの作戦のどれかに着く。 -->
  <div class="fortune" data-opening-fortune>
    <YakobiSays
      class="fortune__says"
      size="md"
      merged
      :asset-base-url="assetBaseUrl"
      :lines="sayLines"
    />

    <div class="fortune__map" aria-hidden="true">
      <svg class="fortune__tree" :viewBox="`0 0 ${COLUMN * leafCount} ${treeHeight}`">
        <path
          v-for="edge in drawnEdges"
          :key="edge.key"
          class="fortune__edge"
          :class="{ 'fortune__edge--lit': edge.lit, 'fortune__edge--off': edge.off }"
          :d="edge.d"
        />
        <circle
          v-for="node in drawnNodes"
          :key="node.id"
          class="fortune__node"
          :class="{ 'fortune__node--done': node.done, 'fortune__node--current': node.current, 'fortune__node--off': node.off }"
          :cx="node.x" :cy="node.y" r="9"
        />
      </svg>
      <ol class="fortune__leaves" :style="{ gridTemplateColumns: `repeat(${leafCount}, minmax(0, 1fr))` }">
        <li
          v-for="leaf in drawnLeaves"
          :key="leaf.planId"
          :class="{ 'fortune__leaf--hit': leaf.hit, 'fortune__leaf--off': leaf.off }"
        >{{ leaf.label }}</li>
      </ol>
    </div>

    <div v-if="walked.node" class="fortune__question" aria-live="polite">
      <p class="fortune__step">しつもん {{ walked.path.length + 1 }} / {{ QUESTION_COUNT }}</p>
      <h4>{{ walked.node.question }}</h4>
      <div class="fortune__answers">
        <button
          v-for="(answer, index) in walked.node.answers"
          :key="answer.label"
          type="button"
          class="fortune__answer"
          :data-fortune-answer="index"
          @click="answer_(index)"
        >{{ answer.label }}</button>
      </div>
      <button v-if="answers.length" type="button" class="fortune__undo" @click="answers = answers.slice(0, -1)">ひとつ前の質問へ</button>
    </div>

    <div v-else-if="plan" class="fortune__result" aria-live="polite" data-fortune-result>
      <div class="fortune__card">
        <FormationThumb class="fortune__thumb" :strategy-id="plan.strategyId" :castle-id="plan.castles[0] ?? ''" />
        <div>
          <p class="fortune__type">{{ result?.type }}</p>
          <b>{{ planTitle }}</b>
          <small>{{ answerSummary }}</small>
        </div>
      </div>
      <p v-if="unlockedNow" class="fortune__unlock"><em>NEW</em>占いのごほうびで、この作戦が使えるようになったよ</p>
      <div class="fortune__actions">
        <button
          v-for="action in actionButtons"
          :key="action.kind"
          type="button"
          class="fortune__action"
          :class="{ 'fortune__action--primary': action.kind === actions[0] }"
          :data-fortune-action="action.kind"
          @click="emit('action', action.kind, plan.id)"
        >{{ action.label }}</button>
        <button type="button" class="fortune__again" @click="restart">もう一度占う</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from "vue";
import YakobiSays from "./YakobiSays.vue";
import FormationThumb from "./FormationThumb.vue";
import { FORTUNE_RESULTS, fortuneLayout, loadFortunePlans, recordFortunePlan, walkFortune } from "./core/opening-fortune.mjs";
import { openingPlanById } from "./core/opening-catalog.mjs";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";

export type FortuneAction = "play" | "practice" | "dex";

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  // 結果の画面に出す行き先。先頭をいちばん目立たせる。
  actions: { type: Array as PropType<FortuneAction[]>, default: () => ["play"] },
  // まだ使えない作戦のid。出た作戦がこの中にあれば、「使えるようになった」と知らせる。
  lockedIds: { type: Array as PropType<string[]>, default: () => [] },
});
const emit = defineEmits<{
  result: [planId: string];
  action: [kind: FortuneAction, planId: string];
}>();

const ACTION_LABELS: { [kind in FortuneAction]: string } = {
  play: "この作戦で指す",
  practice: "完成形から指してみる",
  dex: "図鑑で手順を見る",
};
const RESULT_SHORT: { [planId: string]: string } = {
  bougin: "棒銀", "hayaguri-gin": "早繰り銀", "koshikake-gin": "腰掛け銀", yagura: "矢倉",
  shiken: "四間飛車", sangen: "三間飛車", nakabisha: "中飛車", mukai: "向かい飛車",
};
const QUESTION_COUNT = 3;
const COLUMN = 60;
const ROW = 46;
const TOP = 14;

const answers = ref<number[]>([]);
const walked = computed(() => walkFortune(answers.value));
const result = computed(() => (walked.value.result ? FORTUNE_RESULTS[walked.value.result as keyof typeof FORTUNE_RESULTS] : null));
const plan = computed(() => (walked.value.result ? openingPlanById(walked.value.result) : null));
const planTitle = computed(() => {
  const value = plan.value;
  if (!value) return "";
  return value.name
    ?? OPENING_STRATEGIES.find(({ id }) => id === value.strategyId)?.label
    ?? OPENING_CASTLES.find(({ id }) => id === value.castles[0])?.label
    ?? "";
});
const answerSummary = computed(() => walked.value.path.map(({ answer }) => answer.replace(/！$/, "")).join(" → "));
const unlockedNow = ref(false);
const actionButtons = computed(() => props.actions.map((kind) => ({ kind, label: ACTION_LABELS[kind] })));

const sayLines = computed(() => {
  if (result.value) return [`君は${result.value.type}！`, result.value.line];
  if (!answers.value.length) return ["迷ったら、やこび姫が占ってあげる！", "3つの質問に、思ったとおりに答えてね。"];
  return ["ふむふむ……", "次の質問だよ！"];
});

function answer_(index: number) {
  answers.value = [...answers.value, index];
}
function restart() {
  answers.value = [];
  unlockedNow.value = false;
}

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
// 結果に着いたら、占いで出た作戦として残す(まだ使えない段でも使えるようになる)。
watch(() => walked.value.result, (planId) => {
  if (!planId) return;
  const before = loadFortunePlans(storage());
  unlockedNow.value = props.lockedIds.includes(planId) && !before.includes(planId);
  recordFortunePlan(storage(), planId);
  emit("result", planId);
});

// ===== 木の図 =====
const layout = fortuneLayout();
const leafCount = layout.leaves.length;
const treeHeight = TOP + layout.depth * ROW;
const position = (x: number, depth: number) => ({ x: (x + 0.5) * COLUMN, y: TOP + depth * ROW });
const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
/** いまの質問から、まだ着ける結果。 */
const reachable = computed(() => {
  if (walked.value.result) return new Set([walked.value.result]);
  const current = walked.value.node?.id ?? "";
  const found = new Set<string>();
  const visit = (id: string) => {
    for (const leaf of layout.leaves) if (leaf.parent === id) found.add(leaf.planId);
    for (const edge of layout.edges) if (edge.from === id) visit(edge.to);
  };
  visit(current);
  return found;
});
const chosen = computed(() => new Set(walked.value.path.map(({ nodeId, index }) => `${nodeId}:${index}`)));
const onPath = computed(() => new Set([...walked.value.path.map(({ nodeId }) => nodeId), walked.value.node?.id ?? ""]));
const step = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const middle = from.y + (to.y - from.y) / 2;
  return `M${from.x} ${from.y} V${middle} H${to.x} V${to.y}`;
};
const drawnEdges = computed(() => [
  ...layout.edges.map((edge) => {
    const from = nodeById.get(edge.from)!;
    const to = nodeById.get(edge.to)!;
    const lit = chosen.value.has(`${edge.from}:${edge.index}`);
    return {
      key: `${edge.from}-${edge.to}`,
      d: step(position(from.x, from.depth), position(to.x, to.depth)),
      lit,
      off: !lit && !onPath.value.has(edge.to) && !onPath.value.has(edge.from),
    };
  }),
  ...layout.leaves.map((leaf) => {
    const from = nodeById.get(leaf.parent)!;
    const lit = chosen.value.has(`${leaf.parent}:${leaf.index}`);
    return {
      key: `${leaf.parent}-${leaf.planId}`,
      d: step(position(from.x, from.depth), { x: (leaf.x + 0.5) * COLUMN, y: treeHeight }),
      lit,
      off: !lit && !reachable.value.has(leaf.planId),
    };
  }),
]);
const drawnNodes = computed(() => layout.nodes.map((node) => ({
  id: node.id,
  ...position(node.x, node.depth),
  done: walked.value.path.some(({ nodeId }) => nodeId === node.id),
  current: walked.value.node?.id === node.id,
  off: !onPath.value.has(node.id),
})));
const drawnLeaves = computed(() => layout.leaves.map((leaf) => ({
  planId: leaf.planId,
  label: RESULT_SHORT[leaf.planId] ?? leaf.planId,
  hit: walked.value.result === leaf.planId,
  off: !reachable.value.has(leaf.planId),
})));
</script>

<style>
.fortune {
  --fortune-ink: #1d303f;
  --fortune-muted: #6b5a45;
  --fortune-line: #d9cfbd;
  --fortune-lit: #c98a3d;
  --fortune-accent: #2f6f9f;
  display: grid;
  gap: 0.7em;
  color: var(--fortune-ink);
}
.shogi-game .fortune .yakobi-says__bubble {
  color: var(--fortune-ink);
}
/* 図は幅に合わせて縦横の比を保つ。広い画面でも横に伸ばしすぎない。 */
.fortune__map {
  display: grid;
  justify-self: center;
  width: min(100%, 30em);
}
.fortune__tree {
  display: block;
  width: 100%;
  height: auto;
}
.fortune__edge {
  fill: none;
  stroke: #b7ab96;
  stroke-width: 2.5;
  vector-effect: non-scaling-stroke;
  transition: stroke 200ms, opacity 200ms;
}
.fortune__edge--lit {
  stroke: var(--fortune-lit);
  stroke-width: 5;
}
.fortune__edge--off {
  opacity: 0.3;
}
.fortune__node {
  fill: #fff;
  stroke: #b7ab96;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}
.fortune__node--done {
  fill: var(--fortune-lit);
  stroke: var(--fortune-lit);
}
.fortune__node--current {
  fill: #fff;
  stroke: var(--fortune-accent);
  stroke-width: 4;
  animation: fortune-pulse 1.2s ease-in-out infinite;
}
.fortune__node--off {
  opacity: 0.35;
}
@keyframes fortune-pulse {
  50% { stroke-width: 7; }
}
.fortune__leaves {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.fortune__leaves li {
  justify-self: center;
  min-height: 5.2em;
  padding: 0.3em 0.15em;
  border: 2px solid var(--fortune-line);
  border-radius: 0.35em;
  color: var(--fortune-ink);
  background: #fff;
  font-size: 0.82em;
  font-weight: 700;
  line-height: 1.1;
  writing-mode: vertical-rl;
  transition: opacity 200ms;
}
.fortune__leaves li.fortune__leaf--off {
  opacity: 0.35;
}
.fortune__leaves li.fortune__leaf--hit {
  border-color: var(--fortune-lit);
  color: #fff;
  background: var(--fortune-lit);
}
.fortune__question {
  display: grid;
  gap: 0.5em;
  text-align: center;
}
.fortune__step {
  margin: 0;
  color: var(--fortune-muted);
  font-size: 0.8em;
  font-weight: 700;
}
.fortune__question h4 {
  margin: 0;
  font-size: 1.15em;
}
.fortune__answers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5em;
}
.shogi-game .fortune__answer {
  min-height: 3.2em;
  padding: 0.4em 0.6em;
  border: 2px solid var(--fortune-lit);
  border-radius: 0.6em;
  color: var(--fortune-ink);
  background: #fff;
  font-size: 1em;
  font-weight: 800;
}
.shogi-game .fortune__undo,
.shogi-game .fortune__again {
  justify-self: center;
  min-height: 2.75em;
  padding: 0.3em 0.9em;
  border: 0;
  color: var(--fortune-muted);
  background: transparent;
  box-shadow: none;
  font-size: 0.85em;
  text-decoration: underline;
}
.fortune__result {
  display: grid;
  gap: 0.6em;
}
.fortune__card {
  display: grid;
  grid-template-columns: 8em minmax(0, 1fr);
  gap: 0.7em;
  align-items: center;
  padding: 0.6em;
  border: 3px solid var(--fortune-lit);
  border-radius: 0.6em;
  background: #fff;
}
.fortune__card div {
  display: grid;
  gap: 0.15em;
}
.fortune__card b {
  font-size: 1.15em;
}
.fortune__card small {
  color: var(--fortune-muted);
  font-size: 0.8em;
}
.fortune__type {
  margin: 0;
  color: var(--fortune-lit);
  font-size: 0.85em;
  font-weight: 800;
}
.fortune__unlock {
  margin: 0;
  font-size: 0.85em;
  font-weight: 700;
}
.fortune__unlock em {
  margin-right: 0.4em;
  padding: 0.05em 0.4em;
  border-radius: 0.3em;
  color: #fff;
  background: #c0392b;
  font-size: 0.8em;
  font-style: normal;
}
.fortune__actions {
  display: grid;
  gap: 0.45em;
}
.shogi-game .fortune__action {
  min-height: 2.9em;
  border: 2px solid var(--fortune-line);
  border-radius: 0.5em;
  color: var(--fortune-ink);
  background: #fff;
  font-weight: 700;
}
.shogi-game .fortune__action--primary {
  border-color: var(--fortune-accent);
  color: #fff;
  background: var(--fortune-accent);
  font-size: 1.05em;
}
@media (hover: hover) {
  .shogi-game .fortune__answer:not(:disabled):hover,
  .shogi-game .fortune__action:not(:disabled):hover {
    border-color: var(--fortune-lit);
    background-color: #fdf3e2;
  }
  .shogi-game .fortune__action--primary:not(:disabled):hover {
    background-color: #3a80b3;
  }
  .shogi-game .fortune__undo:not(:disabled):hover,
  .shogi-game .fortune__again:not(:disabled):hover {
    background-color: transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fortune__node--current { animation: none; }
  .fortune__edge, .fortune__leaves li { transition: none; }
}
</style>
