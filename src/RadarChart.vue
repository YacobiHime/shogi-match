<template>
  <svg
    class="shogi-radar"
    :viewBox="`${-margin} 0 ${size + margin * 2} ${size}`"
    role="img"
    :aria-label="ariaLabel"
    data-radar
  >
    <g class="shogi-radar__grid">
      <polygon v-for="ring in RINGS" :key="ring" :points="ringPoints(ring)" />
      <line v-for="(axis, index) in axes" :key="axis.key" :x1="center" :y1="center" :x2="axisPoint(index, 100).x" :y2="axisPoint(index, 100).y" />
    </g>
    <polygon class="shogi-radar__area" :points="areaPoints" />
    <g v-for="(axis, index) in axes" :key="`dot-${axis.key}`">
      <circle
        v-if="axis.value !== null"
        class="shogi-radar__dot"
        :cx="axisPoint(index, axis.value).x"
        :cy="axisPoint(index, axis.value).y"
        r="3.5"
      />
      <text class="shogi-radar__label" :x="labelPoint(index).x" :y="labelPoint(index).y" :text-anchor="anchor(index)" dominant-baseline="middle">
        {{ axis.label }}
      </text>
      <text class="shogi-radar__value" :x="labelPoint(index).x" :y="labelPoint(index).y + 14" :text-anchor="anchor(index)" dominant-baseline="middle">
        {{ axis.value === null ? "—" : axis.value }}
      </text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";

type Axis = { key: string; label: string; value: number | null };

const props = defineProps({
  axes: { type: Array as PropType<Axis[]>, required: true },
});

const RINGS = [20, 40, 60, 80, 100];
const size = 360;
// 左右のラベル(対居飛車・対振り飛車)が切れないよう、横に余白を取る。
const margin = 50;
const center = size / 2;
const radius = 108;

/** i番目の軸の、値(0〜100)に対応する点。最初の軸が真上で、時計回りに並べる。 */
function axisPoint(index: number, value: number) {
  const angle = -Math.PI / 2 + (index / props.axes.length) * Math.PI * 2;
  const r = (radius * value) / 100;
  return { x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r };
}
const labelPoint = (index: number) => axisPoint(index, 128);
const anchor = (index: number) => {
  const { x } = axisPoint(index, 100);
  return x < center - 4 ? "end" : x > center + 4 ? "start" : "middle";
};
const ringPoints = (ring: number) => props.axes.map((_, index) => {
  const { x, y } = axisPoint(index, ring);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");
const areaPoints = computed(() => props.axes.map((axis, index) => {
  const { x, y } = axisPoint(index, axis.value ?? 0);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" "));
const ariaLabel = computed(() => `レーダーチャート: ${props.axes.map((axis) => `${axis.label}${axis.value === null ? "データなし" : `${axis.value}点`}`).join("、")}`);
</script>

<style>
.shogi-game .shogi-radar { width: 100%; max-width: 26rem; height: auto; }
.shogi-game .shogi-radar__grid polygon { fill: none; stroke: rgba(255, 252, 244, 0.22); stroke-width: 1; }
.shogi-game .shogi-radar__grid line { stroke: rgba(255, 252, 244, 0.22); stroke-width: 1; }
.shogi-game .shogi-radar__area { fill: rgba(241, 165, 76, 0.35); stroke: #f1a54c; stroke-width: 2; stroke-linejoin: round; }
.shogi-game .shogi-radar__dot { fill: #f1a54c; stroke: #172632; stroke-width: 1.5; }
.shogi-game .shogi-radar__label { fill: #fffcf4; font-size: 13px; font-weight: 700; }
.shogi-game .shogi-radar__value { fill: #f1a54c; font-size: 12px; font-weight: 700; }
</style>
