<template>
  <div class="evaluation-graph">
    <svg
      class="evaluation-graph__svg"
      viewBox="0 0 800 160"
      role="img"
      :aria-label="`棋譜の評価値グラフ。現在は${currentPly}手目`"
      @pointerdown="selectNearestPly"
    >
      <rect :x="plot.left" :y="plot.top" :width="plot.width" :height="plot.height" class="evaluation-graph__background" />
      <g class="evaluation-graph__grid">
        <line v-for="tick in yTicks" :key="tick.value" :x1="plot.left" :x2="plot.left + plot.width" :y1="tick.y" :y2="tick.y" />
        <line v-for="tick in xTicks" :key="tick.value" :x1="tick.x" :x2="tick.x" :y1="plot.top" :y2="plot.top + plot.height" />
      </g>
      <g class="evaluation-graph__labels">
        <text v-for="tick in yTicks" :key="`y-${tick.value}`" :x="plot.left - 8" :y="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
        <text v-for="tick in xTicks" :key="`x-${tick.value}`" :x="tick.x" :y="plot.top + plot.height + 22" text-anchor="middle">{{ tick.value }}手</text>
      </g>
      <line class="evaluation-graph__zero" :x1="plot.left" :x2="plot.left + plot.width" :y1="scoreY(0)" :y2="scoreY(0)" />
      <rect class="evaluation-graph__hit-area" :x="plot.left" :y="plot.top" :width="plot.width" :height="plot.height" />
      <polyline v-if="linePoints" class="evaluation-graph__line" :points="linePoints" />
      <line class="evaluation-graph__current" :x1="plyX(currentPly)" :x2="plyX(currentPly)" :y1="plot.top" :y2="plot.top + plot.height" />
      <g v-for="point in annotatedPoints" :key="point.ply">
        <polygon
          class="evaluation-graph__point"
          :class="[
            `evaluation-graph__point--${point.annotation!.kind}`,
            { 'evaluation-graph__point--current': point.ply === currentPly },
          ]"
          :points="trianglePoints(point.ply, point.graphValue, point.annotation!.mover)"
        >
          <title>{{ point.label }}：{{ point.annotation!.label }}（{{ point.scoreLabel }}）</title>
        </polygon>
      </g>
    </svg>
    <div class="evaluation-graph__legend" aria-label="評価記号の凡例">
      <span class="evaluation-graph__legend-brilliant">◆ 神の一手</span>
      <span class="evaluation-graph__legend-good">◆ 好手</span>
      <span class="evaluation-graph__legend-dubious">◆ 疑問手</span>
      <span class="evaluation-graph__legend-mistake">◆ 悪手</span>
      <span class="evaluation-graph__legend-blunder">◆ 大悪手</span>
      <small>先手△／後手▽</small>
    </div>
    <div class="evaluation-graph__selection" aria-live="polite">
      <strong>{{ selectedPoint?.label ?? `${currentPly}手目` }}</strong>
      <span>{{ selectedPoint?.scoreLabel ?? "解析中…" }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type AnalysisPoint = {
  ply: number;
  graphValue: number;
  label: string;
  scoreLabel: string;
  annotation?: {
    kind: "blunder" | "mistake" | "dubious" | "good" | "brilliant";
    label: string;
    mover: "black" | "white";
  } | null;
};

const props = defineProps<{
  points: AnalysisPoint[];
  currentPly: number;
  totalPly: number;
}>();
const emit = defineEmits<{ select: [ply: number] }>();

const plot = { left: 58, top: 5, width: 724, height: 125 };
const graphLimit = 6000;
const maxPly = computed(() => Math.max(1, props.totalPly));
const plyX = (ply: number) => plot.left + (Math.max(0, Math.min(maxPly.value, ply)) / maxPly.value) * plot.width;
const scoreY = (score: number) => plot.top + ((graphLimit - Math.max(-graphLimit, Math.min(graphLimit, score))) / (graphLimit * 2)) * plot.height;
const linePoints = computed(() => props.points.map((point) => `${plyX(point.ply)},${scoreY(point.graphValue)}`).join(" "));
const selectedPoint = computed(() => props.points.find((point) => point.ply === props.currentPly));
const annotatedPoints = computed(() => props.points.filter((point) => point.annotation));
const yTicks = computed(() => [6000, 4000, 2000, 0, -2000, -4000, -6000].map((value) => ({
  value,
  y: scoreY(value),
  label: value === 0 ? "0" : `${value > 0 ? "+" : ""}${value}`,
})));
const xTicks = computed(() => [...new Set([0, .25, .5, .75, 1].map((ratio) => Math.round(maxPly.value * ratio)))]
  .map((value) => ({ value, x: plyX(value) })));
const trianglePoints = (ply: number, score: number, mover: "black" | "white") => {
  const x = plyX(ply);
  const y = scoreY(score);
  return mover === "black"
    ? `${x - 5},${y + 4} ${x + 5},${y + 4} ${x},${y - 5}`
    : `${x - 5},${y - 4} ${x + 5},${y - 4} ${x},${y + 5}`;
};

function selectNearestPly(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const viewX = ((event.clientX - rect.left) / rect.width) * 800;
  const ratio = (viewX - plot.left) / plot.width;
  emit("select", Math.max(0, Math.min(props.totalPly, Math.round(ratio * maxPly.value))));
}
</script>

<style scoped>
.evaluation-graph { min-width: 0; color: #111; font-family: Arial, "Yu Gothic", sans-serif; }
.evaluation-graph__svg { display: block; width: 100%; min-height: 5rem; border: 2px solid #464646; background: #fff8e7; cursor: crosshair; touch-action: none; }
.evaluation-graph__background { fill: #fff8e7; }
.evaluation-graph__grid line { stroke: #979797; stroke-width: 1; }
.evaluation-graph__labels { fill: #111; font: 12px Arial, sans-serif; }
.evaluation-graph__zero { stroke: #555; stroke-width: 1.25; }
.evaluation-graph__line { fill: none; stroke: #163fff; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
.evaluation-graph__current { stroke: #ff3152; stroke-width: 2; }
.evaluation-graph__point { stroke-width: 1; }
.evaluation-graph__point--blunder { fill: #a00000; stroke: #6f0000; }
.evaluation-graph__point--mistake { fill: #f4212e; stroke: #c10d16; }
.evaluation-graph__point--dubious { fill: #f08a16; stroke: #c66200; }
.evaluation-graph__point--good { fill: #168bd2; stroke: #075f9b; }
.evaluation-graph__point--brilliant { fill: #9a43c9; stroke: #6a2194; }
.evaluation-graph__point--current { fill: #ff3152; stroke: #fff; stroke-width: 1.5; }
.evaluation-graph__hit-area { fill: transparent; }
.evaluation-graph__legend { display: flex; gap: .55rem; align-items: center; min-height: 1.2rem; padding: .1rem .2rem 0; color: #333; font: 11px Arial, "Yu Gothic", sans-serif; white-space: nowrap; }
.evaluation-graph__legend-brilliant { color: #7a279f; }
.evaluation-graph__legend-good { color: #075f9b; }
.evaluation-graph__legend-dubious { color: #b85800; }
.evaluation-graph__legend-mistake { color: #c10d16; }
.evaluation-graph__legend-blunder { color: #780000; }
.evaluation-graph__legend small { margin-left: auto; color: #444; }
.evaluation-graph__selection { display: flex; gap: .8rem; justify-content: flex-end; min-height: 1.2rem; margin-top: .15rem; color: #111; font-size: .78rem; }
.evaluation-graph__selection span { color: #333; }
</style>
