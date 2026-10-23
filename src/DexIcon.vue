<template>
  <svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <template v-if="kind === 'piece'">
      <g fill="#f1a54c">
        <rect x="5" y="1" width="6" height="1" />
        <rect x="4" y="2" width="8" height="2" />
        <rect x="3" y="4" width="10" height="8" />
        <rect x="4" y="12" width="8" height="2" />
        <rect x="5" y="14" width="6" height="1" />
      </g>
      <text x="8" y="11" class="shogi-home__koma-char" aria-hidden="true">飛</text>
    </template>
    <template v-else-if="kind === 'tesuji'">
      <g fill="#fffcf4">
        <rect x="3" y="2" width="10" height="12" />
        <rect x="2" y="1" width="2" height="14" />
      </g>
      <g fill="#f1a54c">
        <rect x="6" y="4" width="6" height="1" />
        <rect x="6" y="6" width="6" height="1" />
        <rect x="6" y="8" width="6" height="1" />
        <rect x="6" y="10" width="4" height="1" />
      </g>
    </template>
    <template v-else-if="kind === 'opening'">
      <g fill="#fffcf4">
        <rect x="2" y="3" width="5" height="10" />
        <rect x="9" y="3" width="5" height="10" />
        <rect x="7" y="2" width="2" height="12" />
      </g>
      <g fill="#f1a54c">
        <rect x="3" y="4" width="3" height="1" />
        <rect x="3" y="6" width="3" height="1" />
        <rect x="3" y="8" width="3" height="1" />
        <rect x="10" y="4" width="3" height="1" />
        <rect x="10" y="6" width="3" height="1" />
        <rect x="10" y="8" width="3" height="1" />
      </g>
    </template>
    <template v-else-if="kind === 'world'">
      <g fill="#f1a54c">
        <rect x="3" y="2" width="10" height="5" />
        <rect x="1" y="3" width="2" height="3" />
        <rect x="13" y="3" width="2" height="3" />
        <rect x="5" y="7" width="6" height="2" />
        <rect x="7" y="9" width="2" height="2" />
        <rect x="4" y="11" width="8" height="2" />
      </g>
      <g fill="#fffcf4">
        <rect x="7" y="3" width="2" height="3" />
        <rect x="3" y="13" width="10" height="1" />
      </g>
    </template>
    <template v-else>
      <g fill="#f1a54c">
        <rect x="3" y="1" width="10" height="14" />
      </g>
      <g fill="#fffcf4">
        <rect x="4" y="2" width="8" height="12" />
        <rect x="13" y="3" width="2" height="2" />
        <rect x="13" y="7" width="2" height="2" />
        <rect x="13" y="11" width="2" height="2" />
      </g>
      <g fill="#1d303f">
        <rect x="5" y="4" width="4" height="1" />
        <rect x="5" y="6" width="6" height="1" />
        <rect x="5" y="8" width="6" height="1" />
        <rect x="5" y="10" width="5" height="1" />
      </g>
    </template>
  </svg>
</template>

<script setup lang="ts">
// ホームの「しらべる」と対局中の図鑑の棚で、同じ図鑑に同じ絵を使う。
defineProps<{ kind: "piece" | "tesuji" | "opening" | "world" | "glossary" }>();
</script>
