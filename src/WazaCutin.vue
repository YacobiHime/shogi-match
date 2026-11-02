<template>
  <!--
    技の演出の帯(docs/move-waza-design.mdの4-2)。盤の上に重ねる(押せない。盤の操作を止めない)。
    自分の技は盤の真ん中に大きく、相手の技と1局で2回目からの技は盤の上の端に小さく。段階は★と色(銀・金・虹)。
  -->
  <div
    :key="cutin.id"
    class="waza-cutin"
    :class="[`waza-cutin--${cutin.size}`, `waza-cutin--${cutin.tier}`, { 'waza-cutin--theirs': !cutin.mine }]"
    :style="{ '--waza-ms': `${cutin.ms}ms` }"
    role="status"
    aria-live="polite"
    data-waza-cutin
    :data-waza-size="cutin.size"
    :data-waza-tier="cutin.tier"
  >
    <div class="waza-cutin__band">
      <span class="waza-cutin__kind">{{ cutin.kindLabel }}</span>
      <strong class="waza-cutin__name" data-waza-name>{{ cutin.name }}<small v-if="cutin.suffix">{{ cutin.suffix }}</small></strong>
      <span class="waza-cutin__stars" :aria-label="`★${cutin.stars}つ`">{{ "★".repeat(cutin.stars) }}</span>
      <em v-if="cutin.badge" class="waza-cutin__badge" data-waza-badge>{{ cutin.badge }}</em>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

export type WazaCutinView = {
  id: number;
  size: "big" | "small";
  mine: boolean;
  kindLabel: string;
  name: string;
  suffix: string;
  tier: "normal" | "rare" | "legend";
  stars: number;
  badge: string;
  ms: number;
};

defineProps({
  cutin: { type: Object as PropType<WazaCutinView>, required: true },
});
</script>

<style>
/*
 * 盤の木目(黄色系)の上で消えないよう、帯の地は濃い色にして縁と字で段階を見せる(G:3-2 暗い色を混ぜてコントラストを保つ)。
 * 升の強調には使わない(盤の色の決まりの対象外の、盤に重ねる札)。
 */
.shogi-game .waza-cutin {
  --waza-edge: #c9d6e6;
  --waza-text: #fffcf4;
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  z-index: 41;
  display: grid;
  justify-items: center;
  pointer-events: none;
  transform: translateY(-50%);
  animation: waza-cutin-life var(--waza-ms, 1200ms) linear both;
}
.shogi-game .waza-cutin--rare { --waza-edge: #f1c75b; --waza-text: #ffe7a3; }
.shogi-game .waza-cutin--legend { --waza-edge: #f6a5ff; --waza-text: #fffcf4; }
.shogi-game .waza-cutin__band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.15em 0.6em;
  width: 100%;
  box-sizing: border-box;
  padding: 0.35em 1em 0.45em;
  border-block: 3px solid var(--waza-edge);
  background: linear-gradient(90deg, rgba(15, 24, 40, 0) 0%, rgba(15, 24, 40, 0.92) 10%, rgba(15, 24, 40, 0.92) 90%, rgba(15, 24, 40, 0) 100%);
  box-shadow: 0 0 18px rgba(0, 0, 0, 0.45);
  animation: waza-cutin-slide 220ms cubic-bezier(0.2, 1.2, 0.4, 1) both;
}
.shogi-game .waza-cutin--legend .waza-cutin__band {
  border-image: linear-gradient(90deg, #ff7a7a, #ffd36b, #7dffa8, #6bc7ff, #c18bff) 1;
}
.shogi-game .waza-cutin__kind {
  padding: 0.05em 0.55em;
  border: 1px solid var(--waza-edge);
  border-radius: 999px;
  color: var(--waza-edge);
  font-size: 0.8em;
  font-weight: 900;
  letter-spacing: 0.15em;
}
.shogi-game .waza-cutin__name {
  color: var(--waza-text);
  font-size: clamp(1.5rem, 6.4vmin, 2.6rem);
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1.15;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6), 0 0 14px var(--waza-edge);
  white-space: nowrap;
}
.shogi-game .waza-cutin__name small { margin-left: 0.25em; font-size: 0.6em; }
.shogi-game .waza-cutin--legend .waza-cutin__name {
  background: linear-gradient(90deg, #ff9b9b, #ffe08a, #9dffbe, #8fd6ff, #d6a8ff, #ff9b9b);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.6));
  animation: waza-cutin-rainbow 1.2s linear infinite;
}
.shogi-game .waza-cutin__stars { color: var(--waza-edge); font-size: 1em; letter-spacing: 0.05em; }
.shogi-game .waza-cutin__badge {
  padding: 0.05em 0.5em;
  border-radius: 0.35em;
  color: #172632;
  background: #f1a54c;
  font-size: 0.78em;
  font-style: normal;
  font-weight: 900;
}
/* 相手の技と、2回目からの技は小さく、盤の上の端に。相手の技は朱の縁(注目)。 */
.shogi-game .waza-cutin--small { top: 12%; }
.shogi-game .waza-cutin--small .waza-cutin__band { width: auto; max-width: 94%; padding: 0.2em 0.9em 0.25em; border-radius: 0.6em; border: 2px solid var(--waza-edge); }
.shogi-game .waza-cutin--small .waza-cutin__name { font-size: clamp(1rem, 4.2vmin, 1.5rem); }
.shogi-game .waza-cutin--theirs { --waza-edge: #e2553b; }
.shogi-game .waza-cutin--theirs .waza-cutin__name { color: #fffcf4; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6); background: none; animation: none; }
@keyframes waza-cutin-slide {
  from { transform: translateX(-35%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes waza-cutin-life {
  0% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes waza-cutin-rainbow { to { background-position: 200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .waza-cutin__band { animation: none; }
  .shogi-game .waza-cutin--legend .waza-cutin__name { animation: none; }
}
</style>
