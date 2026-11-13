<template>
  <!--
    棋士の1年の結果の札(docs/pro-year-design.mdの19-3の7)。1枚ずつめくり、押して進むだけ(自動で送らない)。
    札が出てから少しのあいだ「次へ」を押せない(終局の窓から続けて押しても読み飛ばさない)。背景を押しても閉じない。
    戻る操作は1枚前へ(最初の札では何もしない。ShogiProYear.vueのgoBack)。最後の札の「棋士の1年へ」で見た印。
  -->
  <div class="pro-results" role="dialog" aria-modal="true" aria-labelledby="pro-results-heading" data-pro-results>
    <div
      v-if="page"
      :key="page.id"
      class="pro-results__panel"
      :class="[`pro-results__panel--${page.tone}`, `pro-results__panel--${page.kind}`]"
      :data-pro-result-page="page.kind"
    >
      <span v-for="piece in confetti" :key="piece.id" class="pro-results__confetti" :style="piece.style" aria-hidden="true"></span>
      <p class="pro-results__count" aria-live="polite">結果 {{ page.index + 1 }} / {{ pages.length }}</p>
      <p class="pro-results__eyebrow">{{ page.eyebrow }}</p>
      <div class="pro-results__head">
        <span v-if="page.seal" class="pro-results__seal" :class="{ 'pro-results__seal--loss': page.seal === '負' }" aria-hidden="true">{{ page.seal }}</span>
        <div class="pro-results__titles">
          <h2 id="pro-results-heading">{{ page.heading }}</h2>
          <p v-if="page.sub" class="pro-results__sub">{{ page.sub }}</p>
        </div>
      </div>

      <!-- 番勝負の星(あなたの○と相手の●を、勝ちに要る数だけ) -->
      <div v-if="page.series" class="pro-results__series" :aria-label="`${page.series.me}勝${page.series.them}敗 ${page.seriesText}`" data-pro-result-series>
        <span class="pro-results__stars">
          <i v-for="index in page.series.need" :key="`m${index}`" :class="{ 'pro-results__star--on': index <= page.series.me }" aria-hidden="true">○</i>
        </span>
        <b>{{ page.series.me }} - {{ page.series.them }}</b>
        <span class="pro-results__stars pro-results__stars--them">
          <i v-for="index in page.series.need" :key="`t${index}`" :class="{ 'pro-results__star--on': index <= page.series.them }" aria-hidden="true">●</i>
        </span>
        <small>{{ page.seriesText }}</small>
      </div>

      <ul v-if="page.rows?.length" class="pro-results__rows" data-pro-result-rows>
        <li v-for="(row, index) in page.rows" :key="index" :class="{ 'pro-results__row--win': row.won }">
          <b aria-hidden="true">{{ row.won ? "○" : "●" }}</b>
          <span><strong>{{ row.label }}</strong><small>対 {{ row.opponent }}{{ row.auto ? "（分身）" : "" }}{{ row.note ? `・${row.note}` : "" }}</small></span>
        </li>
      </ul>
      <ul v-if="page.lines.length" class="pro-results__lines">
        <li v-for="line in page.lines" :key="line">{{ line }}</li>
      </ul>
      <dl v-if="page.facts.length" class="pro-results__facts">
        <div v-for="fact in page.facts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div>
      </dl>
      <p v-if="page.coach" class="pro-results__coach">
        <img class="pro-results__face" :src="face" alt="" draggable="false">
        <span>{{ page.coach }}</span>
      </p>
      <p v-if="page.note" class="pro-results__note">{{ page.note }}</p>

      <div class="pro-results__actions">
        <button v-if="page.index > 0" type="button" class="pro-results__back" data-pro-result-prev @click="move(-1)">前へ</button>
        <button
          ref="nextButton"
          type="button"
          class="pro-results__next"
          :disabled="guarding"
          :aria-disabled="guarding"
          data-pro-result-next
          @click="next"
        >{{ page.last ? "棋士の1年へ" : "次へ" }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { RESULT_GUARD_MS, resultPages } from "./core/pro-year-results.mjs";
import { createMoveSoundPlayer } from "./core/move-sound";

const props = defineProps({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: { type: Array as PropType<any[]>, required: true },
  dropped: { type: Number, default: 0 },
  face: { type: String, required: true },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ done: [] }>();

const pages = computed(() => resultPages(props.results, { dropped: props.dropped }));
const index = ref(0);
const page = computed(() => pages.value[Math.min(index.value, pages.value.length - 1)] ?? null);
const nextButton = ref<HTMLButtonElement | null>(null);
const sounds = createMoveSoundPlayer(() => props.assetBaseUrl);

// 札が出てから少しのあいだ「次へ」を押せない(19-3の7)。
const guarding = ref(true);
let guardTimer: ReturnType<typeof setTimeout> | null = null;
function guard() {
  guarding.value = true;
  if (guardTimer) clearTimeout(guardTimer);
  guardTimer = setTimeout(() => {
    guarding.value = false;
    void nextTick(() => nextButton.value?.focus());
  }, RESULT_GUARD_MS);
}
/** 札の重さに合わせた音(段階6は判子と登る音、段階5は判子、負けは鳴らさない。G:3-1・G:7)。 */
function playSound() {
  const current = page.value;
  if (!current?.stamp || current.stamp === "loss") return;
  if (current.stamp === "nameplate") sounds.play("nameplate");
  else if (current.stamp === "win") sounds.play("stamp");
  else {
    sounds.play("stamp");
    if (current.tone === "gold") setTimeout(() => sounds.play("climb"), 360);
  }
}
watch(() => page.value?.id, () => {
  guard();
  playSound();
});
onMounted(() => {
  guard();
  playSound();
});
onBeforeUnmount(() => {
  if (guardTimer) clearTimeout(guardTimer);
});

function move(step: number) {
  index.value = Math.max(0, Math.min(pages.value.length - 1, index.value + step));
}
function next() {
  if (guarding.value || !page.value) return;
  if (page.value.last) emit("done");
  else move(1);
}
/** ブラウザの戻る操作: 1枚前へ。最初の札では何もしない(読み飛ばさない)。いつも閉じたことにする。 */
function goBack() {
  if (index.value > 0) move(-1);
  return true;
}
defineExpose({ goBack });

// 紙吹雪(段階6の札だけ。動きを減らす設定では出さない)。
const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const confetti = computed(() => {
  if (!page.value?.confetti || reduceMotion) return [];
  const colors = ["#f6d55c", "#f1a54c", "#e7685c", "#7fc3e8", "#fffcf4"];
  return Array.from({ length: 18 }, (_, i) => ({
    id: `${page.value?.id}-${i}`,
    style: { left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 6) * 90}ms`, "--drift": `${((i * 13) % 9) - 4}rem` },
  }));
});
</script>

<style>
.shogi-game .pro-results {
  position: fixed; inset: 0; z-index: 70; display: grid; place-items: center;
  padding: max(0.6rem, env(safe-area-inset-top)) 0.6rem max(0.6rem, env(safe-area-inset-bottom));
  background: rgba(10, 18, 26, 0.82);
}
.shogi-game .pro-results__panel {
  position: relative; display: grid; gap: 0.55rem; box-sizing: border-box; width: min(100%, 30rem); max-height: 100%; overflow: hidden auto;
  padding: 0.9rem 1rem 1rem; border: 0.13rem solid rgba(255, 252, 244, 0.45); border-radius: 0.9rem; color: #fffcf4; background: #172632;
  box-shadow: 0 0.6rem 1.6rem rgba(0, 0, 0, 0.45); text-align: center; animation: pro-results-pop 260ms ease-out;
}
.shogi-game .pro-results__panel--gold { border-color: var(--amber, #f1a54c); box-shadow: 0 0 0 0.2rem rgba(241, 165, 76, 0.35), 0 0.6rem 1.6rem rgba(0, 0, 0, 0.45); }
.shogi-game .pro-results__panel--good { border-color: #7fc3e8; }
.shogi-game .pro-results__panel--calm { border-color: rgba(255, 252, 244, 0.25); background: #1d2c38; }
.shogi-game .pro-results__count { margin: 0; color: #8fa3b0; font-size: 0.75rem; font-weight: 700; }
.shogi-game .pro-results__eyebrow { margin: 0; color: var(--amber, #f1a54c); font-size: 0.85rem; font-weight: 900; letter-spacing: 0.2em; }
.shogi-game .pro-results__head { display: flex; align-items: center; justify-content: center; gap: 0.7rem; }
.shogi-game .pro-results__titles { display: grid; gap: 0.15rem; min-width: 0; }
.shogi-game .pro-results__panel h2 { margin: 0; font-size: 1.35rem; line-height: 1.3; overflow-wrap: anywhere; }
.shogi-game .pro-results__panel--gold h2 { font-size: 1.75rem; letter-spacing: 0.06em; }
.shogi-game .pro-results__sub { margin: 0; color: #cfd8de; font-size: 0.95rem; font-weight: 800; }
.shogi-game .pro-results__panel--gold .pro-results__sub { color: #f6d55c; font-size: 1.1rem; }
.shogi-game .pro-results__seal {
  flex: none; display: grid; place-items: center; width: 3.4rem; height: 3.4rem; border: 0.2rem solid #c0392b; border-radius: 50%;
  color: #c0392b; background: rgba(255, 252, 244, 0.94); font-size: 1.7rem; font-weight: 900; transform: rotate(-12deg);
  animation: pro-results-stamp 300ms ease-out;
}
.shogi-game .pro-results__seal--loss { border-color: #5d6d7e; color: #5d6d7e; }
.shogi-game .pro-results__series { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.3rem 0.55rem; }
.shogi-game .pro-results__series b { font-size: 1.3rem; }
.shogi-game .pro-results__series small { flex-basis: 100%; color: var(--amber, #f1a54c); font-size: 0.95rem; font-weight: 900; }
.shogi-game .pro-results__stars { display: inline-flex; gap: 0.15rem; color: rgba(255, 252, 244, 0.25); font-style: normal; }
.shogi-game .pro-results__stars i { font-style: normal; font-size: 1.05rem; }
.shogi-game .pro-results__stars .pro-results__star--on { color: #fffcf4; }
.shogi-game .pro-results__stars--them .pro-results__star--on { color: #e7685c; }
.shogi-game .pro-results__lines, .shogi-game .pro-results__rows { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-results__lines li { padding: 0.3rem 0.5rem; border-radius: 0.55rem; background: rgba(43, 70, 91, 0.55); font-size: 0.9rem; font-weight: 700; }
.shogi-game .pro-results__rows { max-height: 14rem; overflow-y: auto; text-align: left; }
.shogi-game .pro-results__rows li { display: flex; align-items: center; gap: 0.5rem; min-height: 2.4rem; padding: 0.25rem 0.5rem; border-radius: 0.55rem; background: rgba(43, 70, 91, 0.55); }
.shogi-game .pro-results__rows li > b { flex: none; width: 1.2rem; color: #e7685c; text-align: center; }
.shogi-game .pro-results__rows .pro-results__row--win > b { color: #fffcf4; }
.shogi-game .pro-results__rows span { display: grid; min-width: 0; }
.shogi-game .pro-results__rows strong { overflow: hidden; font-size: 0.85rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-results__rows small { color: #cfd8de; font-size: 0.72rem; }
.shogi-game .pro-results__facts { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0; }
.shogi-game .pro-results__facts div { display: grid; gap: 0.05rem; min-width: 6rem; padding: 0.3rem 0.6rem; border-radius: 0.55rem; background: rgba(255, 252, 244, 0.08); }
.shogi-game .pro-results__facts dt { color: #8fa3b0; font-size: 0.7rem; font-weight: 700; }
.shogi-game .pro-results__facts dd { margin: 0; font-size: 0.95rem; font-weight: 900; }
.shogi-game .pro-results__coach { display: flex; align-items: center; gap: 0.5rem; margin: 0; text-align: left; }
.shogi-game .pro-results__face { flex: none; width: 2.8rem; height: 2.8rem; border-radius: 50%; object-fit: cover; object-position: 50% 0; image-rendering: pixelated; background: #2b465b; }
.shogi-game .pro-results__coach span {
  flex: 1; min-width: 0; padding: 0.4rem 0.65rem; border-radius: 0.8rem; color: #1d303f; background: #fffcf4; font-size: 0.88rem; font-weight: 700; line-height: 1.5;
}
.shogi-game .pro-results__note { margin: 0; color: #8fa3b0; font-size: 0.75rem; }
.shogi-game .pro-results__actions { display: flex; gap: 0.5rem; }
.shogi-game .pro-results__back, .shogi-game .pro-results__next {
  min-height: 48px; border-radius: 999px; font: inherit; font-weight: 900; cursor: pointer;
}
.shogi-game .pro-results__back { flex: none; padding: 0 1.1rem; border: 0.12rem solid rgba(255, 252, 244, 0.45); color: #fffcf4; background: transparent; }
.shogi-game .pro-results__next { flex: 1; border: 0; color: #172632; background: var(--amber, #f1a54c); transition: opacity 160ms ease; }
.shogi-game .pro-results__next:disabled { opacity: 0.45; cursor: default; }
/* 全体のボタンのホバーの書式(.shogi-game button:not(:disabled):hover)に負けないよう、札の中に限って書く。 */
.shogi-game .pro-results .pro-results__next:not(:disabled):hover { border: 0; color: #172632; background: #f6b968; }
.shogi-game .pro-results .pro-results__back:not(:disabled):hover { color: #fffcf4; background: rgba(255, 252, 244, 0.1); }
.shogi-game .pro-results__confetti {
  position: absolute; top: -0.6rem; width: 0.45rem; height: 0.8rem; border-radius: 0.1rem; opacity: 0; pointer-events: none;
  animation: pro-results-fall 1s ease-in both;
}
@keyframes pro-results-pop { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pro-results-stamp { from { transform: rotate(-12deg) scale(1.6); opacity: 0; } to { transform: rotate(-12deg) scale(1); opacity: 1; } }
@keyframes pro-results-fall {
  0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
  100% { opacity: 0; transform: translate(var(--drift, 0), 18rem) rotate(320deg); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .pro-results__panel, .shogi-game .pro-results__seal { animation: none; }
  .shogi-game .pro-results__next { transition: none; }
}
</style>
