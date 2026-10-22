<template>
  <!--
    名人戦の五重塔(docs/meijin-design.mdの7章)。1階がC級2組、5階がA級、上の相輪の座が名人。
    自分の駒は、いまのクラスの階に立つ。竜王への道の山と同じドット絵の空。
  -->
  <div class="meijin-pagoda" data-pagoda>
    <svg :viewBox="`0 ${-headroom} ${WIDTH} ${HEIGHT + headroom}`" class="meijin-pagoda__svg" role="img" :aria-label="ariaLabel" shape-rendering="crispEdges">
      <g aria-hidden="true">
        <rect v-for="star in STARS" :key="star.id" :x="star.x" :y="star.y" :width="star.size" :height="star.size" :fill="star.color" class="meijin-pagoda__star" />
        <rect x="-200" :y="GROUND_Y" :width="WIDTH + 400" :height="HEIGHT - GROUND_Y + 200" fill="#2a5047" />
        <rect x="-200" :y="GROUND_Y" :width="WIDTH + 400" height="4" fill="#3d6a5c" />
        <!-- 基壇 -->
        <rect :x="CENTER - 92" :y="GROUND_Y - 10" width="184" height="10" fill="#8a98a8" />
        <rect :x="CENTER - 92" :y="GROUND_Y - 10" width="184" height="2" fill="#a9b6c4" />
        <!-- 相輪(名人の座) -->
        <rect :x="CENTER - 2" :y="spireTop" width="4" :height="floors.at(-1)!.y - spireTop" fill="#d9b860" />
        <rect v-for="ring in 5" :key="ring" :x="CENTER - 9" :y="spireTop + 10 + ring * 7" width="18" height="3" fill="#f6cf63" />
        <rect :x="CENTER - 6" :y="spireTop - 4" width="12" height="6" fill="#ffd27a" :class="{ 'meijin-pagoda__glow': current === 'meijin' }" />
      </g>
      <!-- 階(下から C級2組 → A級) -->
      <g v-for="floor in floors" :key="floor.cls" :class="['meijin-pagoda__floor', { 'meijin-pagoda__floor--current': floor.cls === current, 'meijin-pagoda__floor--done': floor.done }]" :data-pagoda-floor="floor.cls">
        <rect :x="CENTER - floor.w / 2" :y="floor.y" :width="floor.w" :height="FLOOR_H" :fill="floor.cls === current ? '#a8553a' : floor.done ? '#7a4630' : '#5b3a2c'" />
        <rect v-for="post in floor.posts" :key="post" :x="post" :y="floor.y" width="3" :height="FLOOR_H" fill="#3b241b" />
        <rect :x="CENTER - floor.w / 2 - ROOF_OVER" :y="floor.y - ROOF_H" :width="floor.w + ROOF_OVER * 2" :height="ROOF_H" fill="#2c3b4d" />
        <rect :x="CENTER - floor.w / 2 - ROOF_OVER - 4" :y="floor.y - 3" width="6" height="3" fill="#2c3b4d" />
        <rect :x="CENTER + floor.w / 2 + ROOF_OVER - 2" :y="floor.y - 3" width="6" height="3" fill="#2c3b4d" />
        <rect :x="CENTER - floor.w / 2 - ROOF_OVER" :y="floor.y - ROOF_H" :width="floor.w + ROOF_OVER * 2" height="2" :fill="floor.done || floor.cls === current ? '#f1a54c' : '#4b6585'" />
        <text :x="CENTER" :y="floor.y + FLOOR_H / 2 + 5" text-anchor="middle" class="meijin-pagoda__label">{{ floor.label }}</text>
      </g>
      <!-- 名人の座 -->
      <text :x="CENTER + 16" :y="spireTop + 4" class="meijin-pagoda__label meijin-pagoda__label--gold">{{ holderName ? `名人 ${holderName}` : "名人" }}</text>
      <!-- 自分の駒 -->
      <g v-if="piece" class="meijin-pagoda__piece" :transform="`translate(${piece.x}, ${piece.y})`">
        <polygon points="0,-30 11,-26 14,0 -14,0 -11,-26" fill="#0b1320" transform="translate(2, 2)" />
        <polygon points="0,-30 11,-26 14,0 -14,0 -11,-26" fill="#fffcf4" />
        <text x="0" y="-7" text-anchor="middle" class="meijin-pagoda__piece-char">自</text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";

const props = defineProps({
  /** いまのクラス(C2〜A)か、名人(meijin)。 */
  current: { type: String as PropType<"C2" | "C1" | "B2" | "B1" | "A" | "meijin">, required: true },
  /** いまの名人の名前(プレイヤーが名人なら空)。 */
  holderName: { type: String, default: "" },
  /** 塔の上にあける空(図の座標)。題字を重ねる画面で、相輪が隠れないようにする。 */
  headroom: { type: Number, default: 0 },
});

const WIDTH = 260;
const HEIGHT = 330;
const CENTER = WIDTH / 2;
const GROUND_Y = 306;
const FLOOR_H = 30;
const ROOF_H = 9;
const ROOF_OVER = 14;
const CLASSES = [
  { cls: "C2", label: "C級2組" },
  { cls: "C1", label: "C級1組" },
  { cls: "B2", label: "B級2組" },
  { cls: "B1", label: "B級1組" },
  { cls: "A", label: "A級" },
] as const;
const ORDER = ["C2", "C1", "B2", "B1", "A", "meijin"];

const floors = computed(() => CLASSES.map((entry, index) => {
  const w = 150 - index * 16;
  const y = GROUND_Y - 10 - (index + 1) * (FLOOR_H + ROOF_H + 4) + ROOF_H;
  const posts = [CENTER - w / 2 + 6, CENTER - w / 6, CENTER + w / 6 - 3, CENTER + w / 2 - 9];
  return { ...entry, w, y, posts, done: ORDER.indexOf(props.current) > index };
}));
const spireTop = computed(() => floors.value.at(-1)!.y - ROOF_H - 58);
const piece = computed(() => {
  if (props.current === "meijin") return { x: CENTER - 22, y: spireTop.value + 2 };
  const floor = floors.value.find(({ cls }) => cls === props.current);
  return floor ? { x: CENTER + floor.w / 2 + ROOF_OVER + 14, y: floor.y + FLOOR_H } : null;
});
const ariaLabel = computed(() => {
  const label = CLASSES.find(({ cls }) => cls === props.current)?.label;
  return label ? `名人への五重塔。いまは${label}` : "名人への五重塔。いまは名人";
});

/** 星(決まった並び)。 */
const STARS = (() => {
  let seed = 11;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const colors = ["#fffcf4", "#f1a54c", "#d8d0ff"];
  return Array.from({ length: 22 }, (_, id) => ({
    id, x: Math.round(next() * WIDTH), y: Math.round(next() * 150), size: next() < 0.4 ? 2 : 3, color: colors[id % 3],
  }));
})();
</script>

<style>
.shogi-game .meijin-pagoda { display: flex; min-height: 0; overflow: hidden; background: linear-gradient(#0f1828, #1c2c45 60%, #243755); }
.shogi-game .meijin-pagoda__svg { display: block; width: 100%; height: 100%; min-height: 0; }
.shogi-game .meijin-pagoda__label { font-size: 11px; font-weight: 900; fill: #fffcf4; stroke: #0b1320; stroke-width: 3px; paint-order: stroke; }
.shogi-game .meijin-pagoda__label--gold { fill: #ffd27a; }
.shogi-game .meijin-pagoda__floor:not(.meijin-pagoda__floor--current):not(.meijin-pagoda__floor--done) .meijin-pagoda__label { fill: #c9d6e6; }
.shogi-game .meijin-pagoda__piece-char { font-size: 13px; font-weight: 900; fill: #1a2433; }
.shogi-game .meijin-pagoda__piece { animation: meijin-pagoda-bob 2.4s ease-in-out infinite; }
@keyframes meijin-pagoda-bob { 50% { translate: 0 -3px; } }
.shogi-game .meijin-pagoda__star { animation: meijin-pagoda-twinkle 3.2s steps(2) infinite; }
@keyframes meijin-pagoda-twinkle { 50% { opacity: 0.35; } }
.shogi-game .meijin-pagoda__glow { animation: meijin-pagoda-glow 1.4s ease-in-out infinite; }
@keyframes meijin-pagoda-glow { 50% { filter: brightness(1.4); } }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .meijin-pagoda__piece,
  .shogi-game .meijin-pagoda__star,
  .shogi-game .meijin-pagoda__glow { animation: none; }
}
</style>
