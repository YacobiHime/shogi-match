<template>
  <!--
    揮毫(docs/pro-year-design.mdの10-2の6)。色紙に書く言葉を選び、ボタンを押し続けて1字ずつ書く(離すと止まり、また押すと続き)。
    書き終えたら名前を入れて、揮毫帳に残す。言葉は、タイトル獲得・棋戦優勝の回数で増える(D:5-1 ご褒美の使い道)。
  -->
  <section class="festival-kigou" aria-label="揮毫" data-festival-kigou>
    <template v-if="!word">
      <p class="festival-kigou__lead">色紙に書く言葉を選んでね。</p>
      <ul class="festival-kigou__words" aria-label="言葉">
        <li v-for="entry in words" :key="entry.word">
          <button type="button" class="festival-kigou__word" :disabled="!entry.open" :data-kigou-word="entry.word" @click="word = entry.word">
            <b>{{ entry.word }}</b>
            <small>{{ entry.open ? entry.note : `タイトル・優勝あと${entry.left}回で書ける` }}</small>
          </button>
        </li>
      </ul>
      <button type="button" class="shogi-tournament__sub" data-kigou-back @click="emit('cancel')">やめる</button>
    </template>
    <template v-else>
      <div class="festival-kigou__paper" :class="{ 'festival-kigou__paper--done': done }" aria-hidden="true">
        <span class="festival-kigou__text"><VerticalText :text="written" /></span>
        <span v-if="done" class="festival-kigou__sign"><VerticalText :text="`${playerName} 四段`" /></span>
        <span v-if="done" class="festival-kigou__seal">印</span>
      </div>
      <p class="festival-kigou__line" aria-live="polite" data-kigou-line>{{ done ? `「${word}」と書けたよ！ 揮毫帳に残そう。` : "ボタンを押し続けて、1字ずつ書こう。" }}</p>
      <div class="festival-kigou__actions">
        <template v-if="!done">
          <button type="button" class="shogi-tournament__sub" data-kigou-rechoose @click="reset">言葉を選び直す</button>
          <button
            type="button"
            class="shogi-tournament__start festival-kigou__hold"
            :class="{ 'festival-kigou__hold--on': holding }"
            data-kigou-hold
            @pointerdown.prevent="hold(true)"
            @pointerup="hold(false)"
            @pointerleave="hold(false)"
            @pointercancel="hold(false)"
            @keydown.space.prevent="stroke"
            @keydown.enter.prevent="stroke"
          >押し続けて書く（{{ count }}/{{ chars.length }}）</button>
        </template>
        <button v-else type="button" class="shogi-tournament__start" data-kigou-done @click="emit('done', word)">揮毫帳に残す</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType } from "vue";
import VerticalText from "./VerticalText.vue";

const props = defineProps({
  words: { type: Array as PropType<{ word: string; note: string; open: boolean; left: number }[]>, required: true },
  playerName: { type: String, default: "あなた" },
});
const emit = defineEmits<{ done: [word: string]; cancel: [] }>();

/** 1字を書く時間(ミリ秒)。押し続けると、この間隔で1字ずつ進む。 */
const STROKE_MS = 420;

const word = ref("");
const count = ref(0);
const holding = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
const chars = computed(() => Array.from(word.value));
const written = computed(() => chars.value.slice(0, count.value).join(""));
const done = computed(() => Boolean(word.value) && count.value >= chars.value.length);

/** 1字書く(キーは押すたび。押し続けたときのキーの繰り返しでも進む)。 */
function stroke() {
  if (done.value) return;
  count.value += 1;
  if (done.value) hold(false);
}
function hold(on: boolean) {
  holding.value = on && !done.value;
  if (timer) clearInterval(timer);
  timer = null;
  if (holding.value) timer = setInterval(stroke, STROKE_MS);
}
function reset() {
  hold(false);
  word.value = "";
  count.value = 0;
}
onBeforeUnmount(() => hold(false));
</script>

<style>
.shogi-game .festival-kigou { display: grid; align-content: start; justify-items: center; gap: 0.6rem; height: 100%; min-height: 0; overflow-y: auto; }
.shogi-game .festival-kigou__lead, .shogi-game .festival-kigou__line { margin: 0; font-weight: 800; text-align: center; }
.shogi-game .festival-kigou__words { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.4rem; width: min(100%, 36rem); margin: 0; padding: 0; list-style: none; }
.shogi-game .festival-kigou__word {
  display: grid; gap: 0.1rem; width: 100%; min-height: 44px; padding: 0.4rem 0.6rem; border: 0.1rem solid rgba(255, 252, 244, 0.35); border-radius: 0.6rem;
  color: #fffcf4; background: rgba(43, 70, 91, 0.9); font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .festival-kigou__word b { font-size: 1.05rem; }
.shogi-game .festival-kigou__word small { color: #cfd8de; font-size: 0.7rem; }
.shogi-game .festival-kigou__word:disabled { opacity: 0.45; cursor: default; }
/* 色紙(縦長の白い紙に金の縁)。字は上から下へ、名前は左下。 */
.shogi-game .festival-kigou__paper {
  position: relative; display: grid; grid-template-columns: auto auto; justify-content: center; align-items: start; gap: 1.2rem;
  width: min(62vw, 15rem); aspect-ratio: 27 / 30; padding: 1.2rem 0.8rem; box-sizing: border-box;
  border: 0.35rem solid #d4af37; border-radius: 0.3rem; color: #1b1b1b; background: #fbf8f0;
  box-shadow: 0 0.3rem 1rem rgba(0, 0, 0, 0.35);
}
.shogi-game .festival-kigou__text { grid-column: 2; font-family: "Yu Mincho", "Hiragino Mincho ProN", serif; font-size: clamp(1.8rem, 9vw, 2.8rem); font-weight: 700; --vtext-gap: 0.15em; }
.shogi-game .festival-kigou__text .vtext__group, .shogi-game .festival-kigou__sign .vtext__group { display: block; }
.shogi-game .festival-kigou__text .vtext__ch, .shogi-game .festival-kigou__sign .vtext__ch { display: block; }
.shogi-game .festival-kigou__sign { grid-column: 1; grid-row: 1; align-self: end; font-family: "Yu Mincho", "Hiragino Mincho ProN", serif; font-size: 0.85rem; }
.shogi-game .festival-kigou__seal {
  position: absolute; left: 0.5rem; bottom: 0.5rem; display: grid; place-items: center; width: 1.6rem; height: 1.6rem;
  border-radius: 0.2rem; color: #fff; background: #c0392b; font-size: 0.8rem; font-weight: 900;
}
.shogi-game .festival-kigou__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
.shogi-game .festival-kigou__hold { touch-action: none; user-select: none; }
.shogi-game .festival-kigou__hold--on { filter: brightness(1.15); transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .festival-kigou__hold--on { transform: none; }
}
</style>
