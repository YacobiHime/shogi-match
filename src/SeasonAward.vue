<template>
  <!--
    表彰式(docs/season-award-design.md)。期の終わりに、縦書きの賞状を1枚わたし、判子を押す。
    紙が上がる → 一拍おいて判子(音) → やこび姫のねぎらい。押せば演出を飛ばす。賞状帳から開いたときは動かさない。
    縦書きの字は、1字ずつ箱に入れて並べる(VerticalText.vue。字体によって漢字が重なって潰れるのを防ぐ)。
  -->
  <div
    :class="['season-award', `season-award--${award.grade}`, { 'season-award--play': playing }]"
    role="dialog"
    aria-modal="true"
    :aria-label="`${text.title} ${text.heading}`"
    data-season-award
    @click="skip"
  >
    <span v-for="piece in confetti" :key="piece.id" class="season-award__confetti" :style="piece.style" aria-hidden="true"></span>
    <article class="season-award__paper" data-award-paper>
      <div class="season-award__frame">
        <h2 class="season-award__heading"><VerticalText :text="text.heading" /></h2>
        <p class="season-award__title"><VerticalText :text="text.title" /></p>
        <p class="season-award__prize" data-award-prize><VerticalText :text="text.prize" /></p>
        <p v-for="note in text.notes" :key="note" class="season-award__note"><VerticalText :text="note" /></p>
        <p class="season-award__name"><VerticalText :text="text.name" /></p>
        <p class="season-award__body"><VerticalText :text="text.body" /></p>
        <p class="season-award__date"><VerticalText :text="text.date" /></p>
        <p class="season-award__signer">
          <VerticalText text="やこび姫" />
          <span class="season-award__seal" aria-hidden="true">{{ award.seal }}</span>
        </p>
      </div>
    </article>
    <div class="season-award__foot">
      <p class="season-award__talk">
        <img class="season-award__face" :src="charaUrl" alt="" draggable="false">
        <span>{{ talk }}</span>
      </p>
      <button type="button" class="season-award__button" data-award-done @click.stop="emit('done')">{{ buttonText }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import { awardTalk, awardText } from "./core/season-award.mjs";
import VerticalText from "./VerticalText.vue";
import { createMoveSoundPlayer } from "./core/move-sound";

export type SeasonAwardData = {
  id: string; tournament: string; name: string; seal: string; no: number; grade: string;
  prize: string; notes: string[]; entry: string; wins: number; losses: number; playerName: string; at: number;
};

const props = defineProps({
  award: { type: Object as PropType<SeasonAwardData>, required: true },
  /** 表彰式(紙が上がり、判子を押す)。賞状帳から見返すときは偽。 */
  ceremony: { type: Boolean, default: false },
  buttonText: { type: String, default: "閉じる" },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ done: [] }>();

const text = computed(() => awardText(props.award));
const talk = computed(() => awardTalk(props.award));
const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);

/** 判子が着く時刻(ms)。CSSの紙の上がり(500ms)のあと、判子の遅れ700ms・長さ260msの7割。 */
const STAMP_SOUND_AT = 880;
const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const playing = ref(props.ceremony && !reducedMotion);
const soundPlayer = createMoveSoundPlayer(() => props.assetBaseUrl);
const timers: ReturnType<typeof setTimeout>[] = [];
onMounted(() => {
  if (!props.ceremony) return;
  timers.push(setTimeout(() => soundPlayer.play("stamp"), playing.value ? STAMP_SOUND_AT : 0));
});
onBeforeUnmount(() => timers.splice(0).forEach(clearTimeout));
/** 押したら、演出を最後の形へ飛ばす(操作を止めない)。 */
function skip() {
  playing.value = false;
}

/** 紙吹雪(金・銀・朱の賞状だけ。敢闘賞は静かに)。 */
const CONFETTI_COLORS = ["#f1a54c", "#c4604c", "#fffcf4", "#7fb3d5", "#9ccf8a"];
const confetti = computed(() => {
  if (!props.ceremony || props.award.grade === "fight") return [];
  const count = props.award.grade === "gold" ? 28 : 16;
  return Array.from({ length: count }, (_, index) => {
    const left = (index * 37) % 100;
    const delay = ((index * 13) % 10) * 0.12;
    const size = 6 + (index % 3) * 2;
    return {
      id: index,
      style: `left:${left}%;width:${size}px;height:${size}px;background:${CONFETTI_COLORS[index % CONFETTI_COLORS.length]};animation-delay:${0.6 + delay}s;`,
    };
  });
});
</script>

<style>
.shogi-game .season-award {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  justify-items: center;
  gap: 0.8rem;
  overflow: hidden;
  padding: 1rem max(16px, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  background: radial-gradient(ellipse at 50% 35%, #2b3d58 0%, #121c2e 70%);
}
/* 紙: 縦書き。右から、見出し・期・賞・名前・本文・日付・やこび姫と判子。紙の幅は中身に合わせる(縦の長さだけ決める)。 */
.shogi-game .season-award__paper {
  align-self: center;
  box-sizing: border-box;
  max-width: 100%;
  padding: 0.7rem;
  border-radius: 0.2rem;
  background: #fbf6e6;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.35), 0 0 0 1px #d8cba5;
}
.shogi-game .season-award__frame {
  box-sizing: border-box;
  height: min(26rem, calc(100dvh - 15rem));
  max-width: 100%;
  padding: 1.1rem 1.2rem;
  border: 3px double #8a6d3b;
  color: #2a2016;
  font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  writing-mode: vertical-rl;
  overflow: hidden;
}
.shogi-game .season-award--gold .season-award__frame { border: 6px double #c9962e; box-shadow: inset 0 0 0 3px #f3dc9a; }
.shogi-game .season-award--silver .season-award__frame { border: 6px double #8c98a6; box-shadow: inset 0 0 0 3px #dfe5ec; }
.shogi-game .season-award--red .season-award__frame { border: 5px double #c4604c; }
.shogi-game .season-award__frame p,
.shogi-game .season-award__frame h2 { margin: 0 0 0 0.5rem; }
.shogi-game .season-award__heading { margin-left: 1.3rem !important; padding-top: 0.6em; font-size: 2.1rem; font-weight: 900; --vtext-gap: 0.9em; }
.shogi-game .season-award__title { font-size: 1.05rem; font-weight: 800; }
.shogi-game .season-award__prize { padding-top: 1em; color: #8f2f1f; font-size: 1.35rem; font-weight: 900; }
.shogi-game .season-award--gold .season-award__prize { color: #9a6a10; }
.shogi-game .season-award__note { padding-top: 2em; font-size: 1rem; font-weight: 800; }
.shogi-game .season-award__name { margin: 0.6rem 0 0.6rem 1.1rem !important; padding-top: 3em; font-size: 1.45rem; font-weight: 900; }
.shogi-game .season-award__body { margin-left: 0.8rem !important; font-size: 0.98rem; font-weight: 700; line-height: 1.8; }
.shogi-game .season-award__date { padding-top: 1em; font-size: 0.9rem; font-weight: 700; }
.shogi-game .season-award__signer { position: relative; margin-left: 0 !important; padding-bottom: 3.2rem; font-size: 1.1rem; font-weight: 900; text-align: end; }
.shogi-game .season-award__seal {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  margin-left: -1.2rem;
  border: 3px solid #c4604c;
  border-radius: 0.3rem;
  color: #c4604c;
  background: rgba(251, 246, 230, 0.4);
  font-size: 1.3rem;
  font-weight: 900;
  writing-mode: horizontal-tb;
  rotate: -6deg;
}
.shogi-game .season-award__foot { display: grid; gap: 0.6rem; width: min(100%, 36rem); }
.shogi-game .season-award__talk {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.4rem 0.7rem;
  border-radius: 0.8rem;
  color: #172632;
  background: #fffcf4;
  font-size: 0.92rem;
  font-weight: 800;
}
.shogi-game .season-award__face { flex: none; width: 2.2rem; height: 2.2rem; object-fit: contain; }
.shogi-game .season-award__button {
  min-height: 52px;
  border: 0;
  border-radius: 0.8rem;
  color: #172632;
  background: #f1a54c;
  box-shadow: 0 4px 0 #b06a1c;
  font: inherit;
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  cursor: pointer;
}
/* 触れても琥珀色のまま少し明るくする(全体のボタンの灰色の触れ方に負けないよう、同じ書き方で)。 */
.shogi-game .season-award__button:not(:disabled):hover,
.shogi-game .season-award__button:focus-visible { border-color: #f6bb6e; color: #172632; background: #f6bb6e; }
.shogi-game .season-award__confetti { position: absolute; top: -12px; opacity: 0; pointer-events: none; }
/* 表彰式の動き: 紙が下から上がり、判子が落ちる。紙吹雪は1回だけ降る。ねぎらいとボタンは判子のあと。 */
.shogi-game .season-award--play .season-award__paper { animation: season-award-rise 500ms cubic-bezier(0.2, 0.8, 0.3, 1) both; }
.shogi-game .season-award--play .season-award__seal { animation: season-award-stamp 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 700ms both; }
.shogi-game .season-award--play .season-award__foot { animation: season-award-fade 300ms ease-out 1000ms both; }
.shogi-game .season-award--play .season-award__confetti { animation: season-award-fall 2.6s linear both; }
@keyframes season-award-rise {
  0% { opacity: 0; transform: translateY(40%) scale(0.9); }
  100% { opacity: 1; transform: none; }
}
@keyframes season-award-stamp {
  0% { opacity: 0; transform: scale(2.6); }
  70% { opacity: 1; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes season-award-fade {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: none; }
}
@keyframes season-award-fall {
  0% { opacity: 1; transform: translateY(0) rotate(0deg); }
  100% { opacity: 0.9; transform: translateY(110vh) rotate(540deg); }
}
/* スマホ縦: 字を小さく、紙の余白を詰める。 */
@media (max-width: 599px) {
  .shogi-game .season-award__paper { padding: 0.45rem; }
  .shogi-game .season-award__frame { padding: 0.9rem 0.6rem; }
  .shogi-game .season-award__heading { font-size: 1.7rem; margin-left: 0.8rem !important; }
  .shogi-game .season-award__prize { font-size: 1.15rem; }
  .shogi-game .season-award__name { font-size: 1.2rem; margin: 0.4rem 0 0.4rem 0.7rem !important; }
  .shogi-game .season-award__body { font-size: 0.86rem; line-height: 1.65; }
  .shogi-game .season-award__title,
  .shogi-game .season-award__note,
  .shogi-game .season-award__date { font-size: 0.86rem; }
  .shogi-game .season-award__frame p,
  .shogi-game .season-award__frame h2 { margin-left: 0.35rem; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .season-award--play .season-award__paper,
  .shogi-game .season-award--play .season-award__seal,
  .shogi-game .season-award--play .season-award__foot,
  .shogi-game .season-award--play .season-award__confetti { animation: none; }
}
</style>
