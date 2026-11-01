<template>
  <!--
    将棋まつりの画面(docs/pro-year-design.mdの10-2の6)。4つの催しの札(どれをやっても、飛ばしてもよい)と、いまの謝礼の見込み。
    「まつりを終える」で謝礼を受け取り、1年の画面へ戻る。駒落ち指導対局は対局画面で指す(終わるとここへ戻る)。
    ぐるぐる指導・トークショー・揮毫は、この画面の上で遊ぶ。
  -->
  <div class="pro-festival" role="dialog" aria-modal="true" :aria-label="festival.name" data-pro-festival>
    <header class="pro-festival__head">
      <span class="pro-festival__lantern" aria-hidden="true">祭</span>
      <div class="pro-festival__title">
        <h2>{{ festival.name }}</h2>
        <small>{{ festival.dateText }}・{{ festival.place }}</small>
      </div>
      <button v-if="screen !== 'list'" type="button" class="shogi-tournament__topbar-back" data-festival-back @click="screen = 'list'">
        <span aria-hidden="true">←</span><span class="shogi-tournament__topbar-back-text">まつりへ</span>
      </button>
    </header>

    <section v-if="screen === 'list'" class="pro-festival__body" aria-label="催し">
      <ul class="pro-festival__events">
        <li v-for="event in festival.events" :key="event.id">
          <button
            type="button"
            class="pro-festival__event"
            :class="{ 'pro-festival__event--done': event.done }"
            :disabled="Boolean(event.done)"
            :data-festival-event="event.id"
            @click="open(event.id)"
          >
            <span class="pro-festival__event-icon" aria-hidden="true">{{ ICONS[event.id] }}</span>
            <span class="pro-festival__event-text">
              <b>{{ event.label }}</b>
              <small>{{ event.done ? doneText(event) : event.id === "shidou" ? `${festival.guest.name}（${festival.guest.dan}）と${festival.guest.handicapLabel}` : event.note }}</small>
            </span>
            <span class="pro-festival__event-mark">{{ event.done ? "済" : "＋5万円" }}</span>
          </button>
        </li>
      </ul>
      <p class="pro-festival__status" data-festival-status>
        <span>謝礼の見込み <b>{{ moneyText(festival.fee) }}</b></span>
        <span>ファン <b>＋{{ festival.fans }}</b></span>
      </p>
      <p class="shogi-tournament__tip-line shoreikai__tip pro-festival__talk">
        <img class="shogi-tournament__tip-face pro-year__sprite" :src="`${assetBaseUrl}/characters/yakobihime-mini.webp?v=4`" alt="" draggable="false">
        <span class="shogi-tournament__tip-text">{{ coachLine }}</span>
      </p>
      <button type="button" class="shogi-tournament__start" data-festival-finish @click="finishAsk">まつりを終える</button>
    </section>

    <section v-else-if="screen === 'simul'" class="pro-festival__body pro-festival__body--board" aria-label="ぐるぐる指導対局">
      <FestivalSimul
        :guests="festival.simul"
        :player-name="playerName"
        :asset-base-url="assetBaseUrl"
        :seed="festival.seed"
        @done="onSimulDone"
        @cancel="screen = 'list'"
      />
    </section>

    <section v-else-if="screen === 'kigou'" class="pro-festival__body" aria-label="揮毫">
      <FestivalKigou :words="festival.words" :player-name="playerName" @done="onKigouDone" @cancel="screen = 'list'" />
    </section>

    <NovelScene
      v-if="screen === 'talk'"
      :scene="scene"
      :asset-base-url="assetBaseUrl"
      @choose="reactions.push($event.value)"
      @done="onTalkDone"
    />

    <!-- まだの催しがあるときだけ確かめる(終えると戻れない。UD:5-2) -->
    <div v-if="confirmOpen" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="まつりを終える" data-festival-confirm @click.self="confirmOpen = false">
      <div class="shogi-tournament__sheet-panel shogi-tournament__detail">
        <h2>まつりを終える？</h2>
        <p class="shogi-tournament__text">まだの催しがあるよ。終えると、このまつりには戻れないよ。謝礼は{{ moneyText(festival.fee) }}。</p>
        <div class="shogi-tournament__actions shogi-tournament__actions--two">
          <button ref="confirmCancel" type="button" class="shogi-tournament__sub" data-festival-stay @click="confirmOpen = false">まつりを続ける</button>
          <button type="button" class="shogi-tournament__start" data-festival-confirm-finish @click="finish">終える</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type PropType } from "vue";
import FestivalKigou from "./FestivalKigou.vue";
import FestivalSimul from "./FestivalSimul.vue";
import NovelScene from "./NovelScene.vue";
import { moneyText } from "./core/pro-life.mjs";
import { talkScene } from "./core/pro-festival.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Festival = any;

const props = defineProps({
  /** まつりの画面の形(pro-year.mjsの`proYearView`の`festival`)。 */
  festival: { type: Object as PropType<Festival>, required: true },
  playerName: { type: String, default: "あなた" },
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits<{ life: [action: { kind: string; [key: string]: unknown }] }>();

const ICONS: { [id: string]: string } = { shidou: "指", simul: "回", talk: "話", kigou: "書" };
const screen = ref<"list" | "simul" | "talk" | "kigou">("list");
const reactions = ref<string[]>([]);
const confirmOpen = ref(false);
const confirmCancel = ref<HTMLButtonElement | null>(null);
const scene = computed(() => talkScene({ seed: props.festival.seed, name: props.festival.name }, props.playerName));

const doneCount = computed(() => props.festival.events.filter((event: { done: unknown }) => event.done).length);
const coachLine = computed(() => {
  if (doneCount.value >= props.festival.events.length) return "4つ全部やったね！ みんな大喜びだよ。謝礼を受け取って帰ろう！";
  if (!doneCount.value) return "将棋まつりだよ！ 好きな催しからやってみよう。どれをやっても、飛ばしてもいいよ。";
  return `${doneCount.value}つ終わったね！ ほかの催しもやる？ 終えるときは「まつりを終える」だよ。`;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function doneText(event: any) {
  const done = event.done;
  if (event.id === "shidou") return `${done.name}に${done.r === "loss" ? "負けて大喜びされた" : done.r === "win" ? "勝った" : "引き分け"}（ファン＋${done.fans}）`;
  if (event.id === "simul") return `${done.wins}勝${done.losses}敗${done.draws ? `${done.draws}分` : ""}（ファン＋${done.fans}）`;
  if (event.id === "talk") return `会場が盛り上がった（ファン＋${done.fans}）`;
  if (event.id === "kigou") return `「${done.word}」を書いた（ファン＋${done.fans}）`;
  return "";
}

function open(id: string) {
  if (id === "shidou") {
    emit("life", { kind: "festival-shidou" });
    return;
  }
  if (id === "talk") reactions.value = [];
  screen.value = id as "simul" | "talk" | "kigou";
}
function onSimulDone(tally: { wins: number; losses: number; draws: number }) {
  emit("life", { kind: "festival-event", id: "simul", result: tally });
  screen.value = "list";
}
function onTalkDone() {
  emit("life", { kind: "festival-event", id: "talk", result: { reactions: [...reactions.value] } });
  screen.value = "list";
}
function onKigouDone(word: string) {
  emit("life", { kind: "festival-event", id: "kigou", result: { word } });
  screen.value = "list";
}
function finishAsk() {
  if (doneCount.value >= props.festival.events.length) {
    finish();
    return;
  }
  confirmOpen.value = true;
  void nextTick(() => confirmCancel.value?.focus());
}
function finish() {
  confirmOpen.value = false;
  emit("life", { kind: "festival-finish" });
}

/** 戻る操作(重ねて開いたものを閉じたら真)。 */
function goBack() {
  if (confirmOpen.value) confirmOpen.value = false;
  else if (screen.value !== "list" && screen.value !== "talk") screen.value = "list";
  else return false;
  return true;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .pro-festival {
  position: fixed; inset: 0; z-index: 60; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 0.4rem;
  padding: 0.6rem; color: #fffcf4;
  background:
    radial-gradient(circle at 12% 0%, rgba(245, 183, 177, 0.28), transparent 32%),
    radial-gradient(circle at 88% 0%, rgba(241, 165, 76, 0.25), transparent 32%),
    #172632;
}
.shogi-game .pro-festival__head { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.shogi-game .pro-festival__lantern {
  display: grid; place-items: center; flex: none; width: 2.6rem; height: 3rem; border-radius: 1.2rem / 1.4rem;
  color: #fffcf4; background: radial-gradient(circle at 50% 40%, #e74c3c, #a93226); box-shadow: 0 0 0.8rem rgba(231, 76, 60, 0.6);
  font-weight: 900;
}
.shogi-game .pro-festival__title { display: grid; flex: 1; min-width: 0; }
.shogi-game .pro-festival__title h2 { margin: 0; font-size: 1.15rem; }
.shogi-game .pro-festival__title small { overflow: hidden; color: #cfd8de; font-size: 0.78rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .pro-festival__body { display: grid; align-content: start; gap: 0.6rem; width: min(100%, 44rem); min-height: 0; margin: 0 auto; overflow-y: auto; }
.shogi-game .pro-festival__body--board { width: 100%; height: 100%; align-content: stretch; overflow: hidden; }
.shogi-game .pro-festival__events { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .pro-festival__event {
  display: grid; grid-template-columns: 2.6rem minmax(0, 1fr) auto; align-items: center; gap: 0.6rem; width: 100%; min-height: 4rem;
  padding: 0.5rem 0.7rem; border: 0.12rem solid rgba(245, 183, 177, 0.6); border-radius: 0.8rem;
  color: #fffcf4; background: rgba(43, 70, 91, 0.92); font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .pro-festival__event:hover:not(:disabled) { border-color: var(--amber, #f1a54c); }
.shogi-game .pro-festival__event--done { opacity: 0.75; cursor: default; border-style: dashed; }
.shogi-game .pro-festival__event-icon {
  display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: 50%;
  color: #172632; background: #f5b7b1; font-size: 1.1rem; font-weight: 900;
}
.shogi-game .pro-festival__event-text { display: grid; min-width: 0; }
.shogi-game .pro-festival__event-text b { font-size: 0.98rem; }
.shogi-game .pro-festival__event-text small { color: #cfd8de; font-size: 0.74rem; }
.shogi-game .pro-festival__event-mark { padding: 0.1rem 0.5rem; border-radius: 999px; color: #172632; background: #e9c46a; font-size: 0.72rem; font-weight: 900; }
.shogi-game .pro-festival__event--done .pro-festival__event-mark { background: #86d4a9; }
.shogi-game .pro-festival__status { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.3rem 1rem; margin: 0; padding: 0.4rem 0.7rem; border-radius: 0.6rem; background: rgba(23, 38, 50, 0.85); font-size: 0.88rem; }
.shogi-game .pro-festival__status b { color: #e9c46a; font-size: 1.05rem; }
</style>
