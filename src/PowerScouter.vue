<template>
  <!--
    棋力スカウター(docs/power-scouter-design.md)。次の相手の札の横の小さなボタン。
    押すと、レンズの中で相手と自分の戦闘力の数が跳ね上がりながら測られ、勝つ見込みとやこび姫の一言が出る。
    測っているあいだは押すと飛ばせる(G:演出は1.5秒以内・スキップ可)。
  -->
  <button
    type="button"
    class="scouter__open"
    :aria-label="`${opponentName}の戦闘力を測る`"
    data-scouter-open
    @click.stop="openScouter"
  >
    <span class="scouter__open-lens" aria-hidden="true"></span>スカウター
  </button>
  <div v-if="open && reading" class="scouter" role="dialog" aria-modal="true" aria-label="棋力スカウター" data-scouter @click="onTap">
    <div class="scouter__lens" :class="{ 'scouter__lens--crack': cracked, 'scouter__lens--done': phase === 'done' }">
      <svg v-if="cracked" class="scouter__crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M62 0 L55 22 L66 35 L52 58 L60 72 L48 100" />
        <path d="M55 22 L38 30 L30 26" />
        <path d="M52 58 L74 64 L88 60" />
      </svg>
      <p class="scouter__title">棋力スカウター<span v-if="phase === 'scan'" class="scouter__scan">計測中…</span></p>
      <div class="scouter__row scouter__row--them">
        <span class="scouter__who">{{ opponentName }}</span>
        <b class="scouter__power" data-scouter-opponent>{{ powerText(shownOpponent) }}</b>
      </div>
      <div class="scouter__row scouter__row--you">
        <span class="scouter__who">{{ userName }}</span>
        <b class="scouter__power" data-scouter-you>{{ powerText(shownYou) }}</b>
      </div>
      <template v-if="phase === 'done'">
        <div class="scouter__tug" role="img" :aria-label="`勝つ見込み ${reading.winChance}%`">
          <span class="scouter__tug-you" :style="{ width: `${Math.round(reading.share * 100)}%` }"></span>
        </div>
        <p class="scouter__chance">勝つ見込み <b data-scouter-chance>{{ reading.winChance }}%</b>
          <span class="scouter__tag" :class="`scouter__tag--${reading.grade}`" data-scouter-tag>{{ reading.tag }}</span>
        </p>
        <p class="scouter__line">{{ reading.line }}</p>
        <p class="scouter__note">戦闘力の比が、そのまま勝ちやすさの比だよ（大会の世界の強さで測っているよ）。</p>
        <button type="button" class="scouter__close" data-scouter-close @click.stop="close">閉じる</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { powerText, rollingPower, scoutReading } from "./core/power-scouter.mjs";
import { createWazaAudio, type WazaNote } from "./waza-audio";

const props = defineProps({
  opponentName: { type: String, default: "相手" },
  /** 相手のLv(期の世界の物差し)。 */
  opponentLevel: { type: Number, default: NaN },
  /** 自分のLv(レーティングから)。 */
  userLevel: { type: Number, default: NaN },
  userName: { type: String, default: "あなた" },
});

/** 測っている長さ(ミリ秒)。 */
const SCAN_MS = 1300;
const TICK_MS = 90;

const open = ref(false);
const phase = ref<"scan" | "done">("scan");
const progress = ref(0);
const noise = ref(0.5);
let timer: ReturnType<typeof setInterval> | null = null;
let startedAt = 0;
let audio: ReturnType<typeof createWazaAudio> | null = null;

const reading = computed(() => scoutReading({ opponentLevel: props.opponentLevel, userLevel: props.userLevel }));
const shownOpponent = computed(() => (reading.value ? rollingPower(reading.value.opponent, progress.value, noise.value) : 0));
const shownYou = computed(() => (reading.value ? rollingPower(reading.value.you, progress.value, 1 - noise.value) : 0));
const cracked = computed(() => phase.value === "done" && Boolean(reading.value?.crack));

const reduceMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
const note = (freq: number, ms: number, gain = 0.05, wave: WazaNote["wave"] = "triangle", at = 0): WazaNote => ({ freq, at, ms, gain, wave });

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
function finish() {
  stop();
  progress.value = 1;
  phase.value = "done";
  if (!audio) return;
  // 測り終えた音。ひびが入るときは低い音を重ねる。
  if (reading.value?.crack) audio.play([note(180, 220, 0.08, "triangle"), note(120, 320, 0.08, "triangle", 120)]);
  else audio.play([note(880, 90), note(1320, 160, 0.05, "sine", 90)]);
}
function openScouter() {
  if (!reading.value) return;
  open.value = true;
  phase.value = "scan";
  progress.value = 0;
  audio ??= createWazaAudio();
  if (reduceMotion()) {
    finish();
    return;
  }
  startedAt = Date.now();
  stop();
  timer = setInterval(() => {
    const p = Math.min(1, (Date.now() - startedAt) / SCAN_MS);
    progress.value = p;
    noise.value = Math.random();
    // 数が跳ねるたびに、上がっていく小さな音。
    audio?.play([note(520 + 700 * p, 28, 0.025, "sine")]);
    if (p >= 1) finish();
  }, TICK_MS);
}
function onTap() {
  if (phase.value === "scan") finish();
}
function close() {
  stop();
  open.value = false;
}
/** 戻る操作で閉じる(閉じたらtrue)。 */
function goBack() {
  if (!open.value) return false;
  close();
  return true;
}
defineExpose({ goBack });
onBeforeUnmount(() => {
  stop();
  audio?.close();
});
</script>

<style>
.shogi-game .scouter__open {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.3rem;
  min-height: 32px;
  padding: 0.15rem 0.6rem;
  border: 2px solid #f1a54c;
  border-radius: 999px;
  color: #3a1d06;
  background: linear-gradient(180deg, #ffd38a, #f1a54c);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 900;
  cursor: pointer;
}
.shogi-game .scouter__open:hover { filter: brightness(1.06); }
.shogi-game .scouter__open-lens {
  width: 0.9rem;
  height: 0.65rem;
  border: 2px solid #3a1d06;
  border-radius: 40% 60% 60% 40%;
  background: rgba(255, 120, 60, 0.55);
}
.shogi-game .scouter {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(8, 12, 18, 0.72);
}
.shogi-game .scouter__lens {
  position: relative;
  width: min(440px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 1rem 1.1rem 1.1rem;
  border: 3px solid #f1a54c;
  border-radius: 28px 28px 28px 8px;
  color: #ffd9a8;
  /* 琥珀色のレンズ。細い走査線を重ねる。 */
  background:
    repeating-linear-gradient(0deg, rgba(255, 170, 90, 0.07) 0 2px, transparent 2px 5px),
    radial-gradient(120% 90% at 30% 20%, rgba(150, 60, 18, 0.97), rgba(52, 16, 4, 0.98));
  box-shadow: 0 0 0 4px rgba(241, 165, 76, 0.25), 0 0 28px rgba(255, 140, 60, 0.45);
  font-variant-numeric: tabular-nums;
}
.shogi-game .scouter__lens--done { animation: scouter-settle 0.25s ease-out; }
.shogi-game .scouter__lens--crack { animation: scouter-shake 0.35s ease-out; }
.shogi-game .scouter__crack {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.shogi-game .scouter__crack path { fill: none; stroke: rgba(255, 245, 230, 0.85); stroke-width: 0.8; }
.shogi-game .scouter__title {
  margin: 0 0 0.6rem;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.12em;
}
.shogi-game .scouter__scan { margin-left: 0.6rem; color: #fff1d6; animation: scouter-blink 0.4s steps(2) infinite; }
.shogi-game .scouter__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.35rem 0;
  border-bottom: 1px dashed rgba(255, 200, 140, 0.35);
}
.shogi-game .scouter__who { min-width: 0; overflow: hidden; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .scouter__power { flex: none; color: #fff6e6; font-size: 1.6rem; font-weight: 900; text-shadow: 0 0 8px rgba(255, 150, 70, 0.8); }
.shogi-game .scouter__row--you .scouter__power { color: #bfe3ff; text-shadow: 0 0 8px rgba(110, 180, 255, 0.7); }
.shogi-game .scouter__tug {
  height: 12px;
  margin: 0.8rem 0 0.4rem;
  overflow: hidden;
  border: 1px solid rgba(255, 220, 180, 0.6);
  border-radius: 999px;
  background: #d9534f;
}
.shogi-game .scouter__tug-you { display: block; height: 100%; background: #4a90d9; transition: width 0.4s ease-out; }
.shogi-game .scouter__chance { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0.2rem 0; font-weight: 800; }
.shogi-game .scouter__chance b { color: #fff6e6; font-size: 1.25rem; }
.shogi-game .scouter__tag {
  padding: 0.05rem 0.55rem;
  border-radius: 999px;
  color: #2a1204;
  background: #ffd38a;
  font-size: 0.78rem;
}
.shogi-game .scouter__tag--beyond, .shogi-game .scouter__tag--much { color: #fff; background: #c0392b; }
.shogi-game .scouter__tag--below, .shogi-game .scouter__tag--far-below { color: #fff; background: #2e6fb5; }
.shogi-game .scouter__line { margin: 0.5rem 0 0.3rem; color: #fff1d6; line-height: 1.55; }
.shogi-game .scouter__note { margin: 0 0 0.7rem; color: rgba(255, 220, 180, 0.75); font-size: 0.72rem; line-height: 1.5; }
.shogi-game .scouter__close {
  display: block;
  min-height: 44px;
  margin-left: auto;
  padding: 0.3rem 1.2rem;
  border: 2px solid #f1a54c;
  border-radius: 999px;
  color: #3a1d06;
  background: #ffd38a;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}
@keyframes scouter-blink { to { opacity: 0.2; } }
@keyframes scouter-settle { from { transform: scale(0.97); } to { transform: none; } }
@keyframes scouter-shake {
  20% { transform: translateX(-6px) rotate(-1deg); }
  45% { transform: translateX(5px) rotate(1deg); }
  70% { transform: translateX(-3px); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .scouter__lens--done, .shogi-game .scouter__lens--crack, .shogi-game .scouter__scan { animation: none; }
}
</style>
