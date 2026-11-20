<template>
  <!--
    囲い・戦法の系統の紋(docs/formation-detect-design.mdの6-1)。人物の絵は使わず、形で系統を見せる。色は親の帯の色(currentColor)。
  -->
  <svg class="waza-mon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <g v-if="mon.shape === 'yagura'" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
      <path d="M6 10 H26 L22 4 H10 Z" /><path d="M9 10 V28 M23 10 V28 M9 16 L23 28 M23 16 L9 28 M7 28 H25" />
    </g>
    <g v-else-if="mon.shape === 'fan'" fill="currentColor">
      <path d="M16 28 L3 10 A16 16 0 0 1 29 10 Z" />
      <path d="M16 28 L10 7 M16 28 L16 5 M16 28 L22 7" fill="none" stroke="rgba(15,24,40,0.9)" stroke-width="1.5" />
    </g>
    <g v-else-if="mon.shape === 'crown'" fill="currentColor">
      <path d="M4 24 L6 10 L12 17 L16 6 L20 17 L26 10 L28 24 Z" /><rect x="4" y="25" width="24" height="3" />
    </g>
    <g v-else-if="mon.shape === 'paw'" fill="currentColor">
      <ellipse cx="16" cy="21" rx="8" ry="7" /><circle cx="7" cy="12" r="3" /><circle cx="13" cy="8" r="3" /><circle cx="19" cy="8" r="3" /><circle cx="25" cy="12" r="3" />
    </g>
    <g v-else-if="mon.shape === 'geese'" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12 L9 9 L14 12" /><path d="M12 20 L17 17 L22 20" /><path d="M18 28 L23 25 L28 28" />
    </g>
    <g v-else-if="mon.shape === 'boat'" fill="currentColor">
      <path d="M3 20 H29 L24 27 H8 Z" /><path d="M15 4 V19 H6 Z" /><rect x="15" y="4" width="2" height="16" />
    </g>
    <g v-else-if="mon.shape === 'twin'" fill="none" stroke="currentColor" stroke-width="2.6">
      <circle cx="11" cy="16" r="7" /><circle cx="21" cy="16" r="7" />
    </g>
    <g v-else-if="mon.shape === 'house'" fill="currentColor">
      <path d="M16 4 L29 15 H25 V28 H7 V15 H3 Z" />
    </g>
    <g v-else-if="mon.shape === 'bolt'" fill="currentColor">
      <path d="M19 3 L7 18 H15 L12 29 L25 13 H17 Z" />
    </g>
    <g v-else-if="mon.shape === 'mountain'" fill="currentColor">
      <path d="M2 27 L12 9 L17 17 L21 12 L30 27 Z" />
    </g>
    <g v-else-if="mon.shape === 'cloud'" fill="currentColor">
      <path d="M8 24 A6 6 0 0 1 9 12 A8 8 0 0 1 24 11 A6 6 0 0 1 25 24 Z" />
    </g>
    <g v-else-if="mon.shape === 'arrows'" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 11 H22 M17 6 L22 11 L17 16" /><path d="M29 21 H10 M15 16 L10 21 L15 26" />
    </g>
    <g v-else-if="mon.shape === 'shuriken'" fill="currentColor">
      <path d="M16 2 L19 13 L30 16 L19 19 L16 30 L13 19 L2 16 L13 13 Z" /><circle cx="16" cy="16" r="2.5" fill="rgba(15,24,40,0.9)" />
    </g>
    <g v-else-if="mon.shape === 'thousand' || mon.shape === 'file'">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="none" stroke="currentColor" stroke-width="2.5" />
      <text x="16" y="23" text-anchor="middle" font-size="18" font-weight="900" fill="currentColor">{{ mon.shape === "thousand" ? "千" : mon.text }}</text>
    </g>
    <g v-else fill="currentColor">
      <path d="M16 3 L28 7 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V7 Z" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

defineProps({
  mon: { type: Object as PropType<{ shape: string; text: string }>, required: true },
});
</script>

<style>
.waza-mon { display: block; width: 1.4em; height: 1.4em; flex: none; }
</style>
