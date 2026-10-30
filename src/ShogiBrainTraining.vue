<template>
  <!-- 脳トレ道場(docs/brain-training-design.md)。見た目は将棋教室と同じ枠(shogi-dex・shogi-tutorial)を使う。 -->
  <div class="shogi-dex shogi-tutorial shogi-brain" role="dialog" aria-modal="true" aria-labelledby="shogi-brain-title" data-brain-training>
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="goBack">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-brain-title">{{ BRAIN_TITLE }}</h1>
    </header>

    <!-- 入口。いちばん上に「今日の3種目」、下に見る・覚えるの2つの棚。 -->
    <section class="shogi-tutorial__shelf shogi-brain__home" aria-label="脳トレの種目">
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ homeMessage }}</p>
      </div>
      <button type="button" class="shogi-brain__today" disabled data-brain-today>
        <span class="shogi-brain__today-eyebrow">約5分</span>
        <strong>今日の3種目</strong>
        <small>準備中</small>
      </button>
      <div v-for="shelf in BRAIN_SHELVES" :key="shelf.id" class="shogi-brain__shelf">
        <h2 class="shogi-brain__shelf-title">{{ shelf.label }}</h2>
        <ul class="shogi-brain__cards">
          <li v-for="game in shelf.games" :key="game.id">
            <button type="button" class="shogi-brain__card" disabled :data-brain-game="game.id">
              <strong>{{ game.label }}</strong>
              <small>{{ game.desc }}</small>
              <span class="shogi-brain__card-tag">準備中</span>
            </button>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits(["close"]);

const BRAIN_TITLE = "脳トレ道場";
/** 種目の棚。見る(処理速度)と覚える(記憶)の2つに分ける(3章)。 */
const BRAIN_SHELVES = [
  {
    id: "see",
    label: "見る",
    games: [{ id: "glance", label: "ちらっと盤", desc: "一瞬で、駒と玉の場所を見る" }],
  },
  {
    id: "remember",
    label: "覚える",
    games: [
      { id: "board-memory", label: "盤面の記憶", desc: "局面を覚えて、並べ直す" },
      { id: "mental", label: "頭の中の盤", desc: "見えない駒を、頭の中で動かす" },
      { id: "palace", label: "記憶の宮殿", desc: "場所法で、言葉や定跡を覚える" },
    ],
  },
] as const;

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const homeMessage = "将棋の盤で、見る速さと記憶をきたえよう。";
const backLabel = "ホームへ戻る";

/** ブラウザの戻る操作と、見出しの戻るボタン。入口からはホームへ戻る。 */
function goBack() {
  emit("close");
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .shogi-brain__home {
  display: grid;
  gap: 0.9rem;
  align-content: start;
}
.shogi-game .shogi-brain__today {
  display: grid;
  gap: 0.1rem;
  justify-items: start;
  width: min(100%, 40rem);
  margin: 0 auto;
  padding: 0.8rem 1.1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.9rem;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 4px 0 #172632;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-brain__today strong { font-size: 1.3em; }
.shogi-game .shogi-brain__today small { color: #cfd8de; }
.shogi-game .shogi-brain__today-eyebrow {
  color: #f1a54c;
  font-size: 0.8em;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.shogi-game .shogi-brain__today:disabled,
.shogi-game .shogi-brain__card:disabled {
  opacity: 0.55;
  cursor: default;
}
.shogi-game .shogi-brain__shelf {
  display: grid;
  gap: 0.4rem;
  width: min(100%, 40rem);
  margin: 0 auto;
}
.shogi-game .shogi-brain__shelf-title {
  margin: 0;
  color: #f1a54c;
  font-size: 0.95rem;
  letter-spacing: 0.12em;
}
.shogi-game .shogi-brain__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-brain__card {
  position: relative;
  display: grid;
  gap: 0.15rem;
  justify-items: start;
  width: 100%;
  min-height: 44px;
  padding: 0.65rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 0.8rem;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 3px 0 #172632;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-brain__card strong { font-size: 1.05em; }
.shogi-game .shogi-brain__card small { color: #cfd8de; font-size: 0.82em; }
.shogi-game .shogi-brain__card-tag {
  position: absolute;
  top: 0.5rem;
  right: 0.6rem;
  color: #d7d1fd;
  font-size: 0.75em;
  font-weight: 800;
}
@media (hover: hover) {
  .shogi-game .shogi-brain__today:not(:disabled):hover,
  .shogi-game .shogi-brain__card:not(:disabled):hover {
    border-color: #f1a54c;
    transform: translateY(-0.1em);
  }
}
</style>
