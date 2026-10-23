<template>
  <!--
    奨励会の名札掛け(docs/shoreikai-design.mdの7章)。道場の板に、段級ごとの列(左の6級から右の三段へ)と名札を掛ける。
    自分の名札は朱、同期は青、羽音は金の縁。名札は名前の1文字だけ(全員の名前は、押すと出る一覧で見る)。
    昇級したときは、自分の名札が上から掛かる動き(0.6秒)と、列の光り。動きを減らす設定では光るだけ。
  -->
  <figure class="nameboard" :class="{ 'nameboard--preview': preview }" data-nameboard>
    <div class="nameboard__board" role="img" :aria-label="summary">
      <div
        v-for="column in columns"
        :key="column.rank"
        class="nameboard__column"
        :class="{ 'nameboard__column--you': column.rank === youRank, 'nameboard__column--moved': column.rank === youRank && moved, 'nameboard__column--sandan': column.rank === 8 }"
        :data-nameboard-column="column.rank"
      >
        <span class="nameboard__label">{{ column.label }}</span>
        <span class="nameboard__tags">
          <i
            v-for="tag in column.tags"
            :key="tag.id"
            class="nameboard__tag"
            :class="{ 'nameboard__tag--you': tag.you, 'nameboard__tag--peer': tag.peer, 'nameboard__tag--rival': tag.rival, 'nameboard__tag--moved': tag.you && moved }"
            :data-nameboard-tag="tag.you ? 'you' : tag.peer ? 'peer' : tag.rival ? 'rival' : undefined"
          >{{ tag.you || tag.peer || tag.rival ? tag.name.slice(0, 1) : "" }}</i>
        </span>
      </div>
    </div>
    <figcaption v-if="!preview" class="nameboard__legend">
      <span v-if="youRank >= 0"><i class="nameboard__tag nameboard__tag--you" aria-hidden="true"></i>あなた</span>
      <span v-if="hasPeer"><i class="nameboard__tag nameboard__tag--peer" aria-hidden="true"></i>同期</span>
      <span v-if="hasRival"><i class="nameboard__tag nameboard__tag--rival" aria-hidden="true"></i>羽音</span>
      <span class="nameboard__legend-right">右ほど上の段級</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";

export type NameboardColumn = {
  rank: number; label: string;
  tags: { id: string; name: string; you: boolean; peer: boolean; rival: boolean }[];
};

const props = defineProps({
  columns: { type: Array as PropType<NameboardColumn[]>, required: true },
  /** 自分の名札が、いま掛け替わったところ(昇級の動き)。 */
  moved: { type: Boolean, default: false },
  /** 入口の、まだ自分の名札がない板(名札は飾り)。 */
  preview: { type: Boolean, default: false },
});

const youRank = computed(() => props.columns.find((column) => column.tags.some((tag) => tag.you))?.rank ?? -1);
const hasPeer = computed(() => props.columns.some((column) => column.tags.some((tag) => tag.peer)));
const hasRival = computed(() => props.columns.some((column) => column.tags.some((tag) => tag.rival)));
const summary = computed(() => {
  const you = props.columns.find((column) => column.rank === youRank.value);
  const counts = props.columns.map((column) => `${column.label}${column.tags.length}名`).join("、");
  return `名札掛け。${you ? `あなたは${you.label}。` : ""}${counts}`;
});
</script>

<style>
/* 名札掛け: 濃い木の枠に、明るい木の名札。升の強調ではないので黄色は使わず、木の色と朱・青・金の縁で分ける。 */
.shogi-game .nameboard {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  min-width: 0;
}
.shogi-game .nameboard__board {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 2px;
  padding: 6px;
  border: 4px solid #4a2f17;
  border-radius: 4px;
  background: #6e4520;
  box-shadow: inset 0 0 0 2px #8a5a2b, 0 4px 0 rgba(0, 0, 0, 0.35);
  image-rendering: pixelated;
}
.shogi-game .nameboard__column {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 4px;
  min-width: 0;
  padding: 3px 2px 5px;
  border-radius: 2px;
  background: #5b3818;
}
.shogi-game .nameboard__column--you { background: #7b4a20; box-shadow: inset 0 0 0 2px #e2553b; }
.shogi-game .nameboard__column--sandan { background: #4c2c12; }
.shogi-game .nameboard__column--moved { animation: nameboard-glow 1.1s ease-out 1; }
.shogi-game .nameboard__label {
  color: #fffcf4;
  font-size: clamp(0.62rem, 2.6cqw, 0.95rem);
  font-weight: 800;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
}
.shogi-game .nameboard__tags {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: center;
  gap: 2px;
}
.shogi-game .nameboard__tag {
  display: inline-grid;
  place-items: center;
  /* 大きさは置き場所の広さに合わせる(奨励会の画面の中の枠が入れ物。タブレットやPCの余白を、大きな名札で埋める)。 */
  width: clamp(9px, 2.6cqw, 22px);
  height: clamp(24px, min(6.4cqw, 7cqh), 60px);
  border: 1px solid #3a230f;
  border-radius: 1px;
  background: linear-gradient(180deg, #f0d7a6, #d9b57a);
  color: #fffcf4;
  font-size: clamp(0.5rem, 2cqw, 0.92rem);
  font-style: normal;
  font-weight: 900;
  line-height: 1;
  writing-mode: vertical-rl;
}
.shogi-game .nameboard__tag--you { border-color: #fffcf4; background: #c4604c; box-shadow: 0 0 0 1px #c4604c; }
.shogi-game .nameboard__tag--peer { background: #3d6fa5; }
.shogi-game .nameboard__tag--rival { border: 2px solid #e6c15c; background: #8e2b22; }
.shogi-game .nameboard__tag--moved { animation: nameboard-hang 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) 1; }
.shogi-game .nameboard--preview .nameboard__tag { opacity: 0.85; }
.shogi-game .nameboard__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.8rem;
  align-items: center;
  color: rgba(255, 252, 244, 0.8);
  font-size: 0.78em;
}
.shogi-game .nameboard__legend span { display: inline-flex; gap: 0.3rem; align-items: center; }
.shogi-game .nameboard__legend .nameboard__tag { width: 9px; height: 18px; }
.shogi-game .nameboard__legend-right { margin-left: auto; }
@keyframes nameboard-hang {
  0% { transform: translateY(-140%) rotate(-8deg); opacity: 0; }
  60% { transform: translateY(6%) rotate(2deg); opacity: 1; }
  100% { transform: none; }
}
@keyframes nameboard-glow {
  0% { box-shadow: inset 0 0 0 2px #e2553b, 0 0 0 0 rgba(255, 252, 244, 0.9); }
  100% { box-shadow: inset 0 0 0 2px #e2553b, 0 0 0 10px rgba(255, 252, 244, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .nameboard__tag--moved { animation: none; }
}
</style>
