<template>
  <div class="evaluation-graph">
    <div class="evaluation-graph__legend" aria-hidden="true">
      <span class="evaluation-graph__legend-black">先手有利</span>
      <span>互角</span>
      <span class="evaluation-graph__legend-white">後手有利</span>
    </div>
    <svg
      class="evaluation-graph__svg"
      viewBox="0 0 800 260"
      role="img"
      :aria-label="`棋譜の評価値グラフ。現在は${currentPly}手目`"
      @pointerdown="selectNearestPly"
    >
      <defs>
        <linearGradient id="evaluation-positive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2b8cca" stop-opacity=".34" />
          <stop offset="1" stop-color="#2b8cca" stop-opacity=".04" />
        </linearGradient>
        <linearGradient id="evaluation-negative" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d05b78" stop-opacity=".04" />
          <stop offset="1" stop-color="#d05b78" stop-opacity=".34" />
        </linearGradient>
      </defs>
      <rect :x="plot.left" :y="plot.top" :width="plot.width" :height="plot.height / 2" fill="url(#evaluation-positive)" />
      <rect :x="plot.left" :y="plot.top + plot.height / 2" :width="plot.width" :height="plot.height / 2" fill="url(#evaluation-negative)" />
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
      <g v-for="point in points" :key="point.ply">
        <circle
          class="evaluation-graph__point"
          :class="{ 'evaluation-graph__point--current': point.ply === currentPly }"
          :cx="plyX(point.ply)"
          :cy="scoreY(point.graphValue)"
          :r="point.ply === currentPly ? 5.5 : 2.5"
        >
          <title>{{ point.label }}：{{ point.scoreLabel }}</title>
        </circle>
      </g>
    </svg>
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
};

const props = defineProps<{
  points: AnalysisPoint[];
  currentPly: number;
  totalPly: number;
}>();
const emit = defineEmits<{ select: [ply: number] }>();

const plot = { left: 58, top: 14, width: 724, height: 210 };
const graphLimit = 2000;
const maxPly = computed(() => Math.max(1, props.totalPly));
const plyX = (ply: number) => plot.left + (Math.max(0, Math.min(maxPly.value, ply)) / maxPly.value) * plot.width;
const scoreY = (score: number) => plot.top + ((graphLimit - Math.max(-graphLimit, Math.min(graphLimit, score))) / (graphLimit * 2)) * plot.height;
const linePoints = computed(() => props.points.map((point) => `${plyX(point.ply)},${scoreY(point.graphValue)}`).join(" "));
const selectedPoint = computed(() => props.points.find((point) => point.ply === props.currentPly));
const yTicks = computed(() => [2000, 1000, 0, -1000, -2000].map((value) => ({
  value,
  y: scoreY(value),
  label: value === 0 ? "0" : `${value > 0 ? "+" : ""}${value}`,
})));
const xTicks = computed(() => [...new Set([0, .25, .5, .75, 1].map((ratio) => Math.round(maxPly.value * ratio)))]
  .map((value) => ({ value, x: plyX(value) })));

function selectNearestPly(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const viewX = ((event.clientX - rect.left) / rect.width) * 800;
  const ratio = (viewX - plot.left) / plot.width;
  emit("select", Math.max(0, Math.min(props.totalPly, Math.round(ratio * maxPly.value))));
}
</script>

<style scoped>
.evaluation-graph { min-width: 0; }
.evaluation-graph__legend { display: flex; justify-content: space-between; margin-bottom: .25rem; font-size: .78rem; }
.evaluation-graph__legend-black { color: #78d4ff; }
.evaluation-graph__legend-white { color: #ff9eb5; }
.evaluation-graph__svg { display: block; width: 100%; min-height: 11rem; border: 1px solid rgba(216, 173, 85, .55); background: rgba(10, 13, 20, .92); cursor: crosshair; touch-action: none; }
.evaluation-graph__grid line { stroke: rgba(255, 255, 255, .13); stroke-width: 1; }
.evaluation-graph__labels { fill: #d9ccc4; font: 12px sans-serif; }
.evaluation-graph__zero { stroke: rgba(255, 255, 255, .5); stroke-width: 1.5; }
.evaluation-graph__line { fill: none; stroke: #f4d890; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
.evaluation-graph__current { stroke: #62d8ff; stroke-width: 2; stroke-dasharray: 5 4; }
.evaluation-graph__point { fill: #f4d890; stroke: #271117; stroke-width: 1; }
.evaluation-graph__point--current { fill: #62d8ff; stroke: white; stroke-width: 2; }
.evaluation-graph__hit-area { fill: transparent; }
.evaluation-graph__selection { display: flex; gap: .8rem; justify-content: center; margin-top: .35rem; font-size: .9rem; }
.evaluation-graph__selection span { color: #f4d890; }
</style>
